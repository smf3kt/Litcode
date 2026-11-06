import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig } from "../src/agent.js";
import { Session } from "../src/session.js";
import { checkpointConversation, previewRewind, applyRewind, automaticCheckpoint } from "../src/rewind.js";
import { captureCheckpoint, recoverCheckpoint, writeCheckpointAssociation } from "../src/checkpoints.js";
import { lock } from "../src/skill-effects.js";

const signal = new AbortController().signal;
function setup() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-rewind-")));
  const config = defaultConfig(workspace, []); config.model = "fixture";
  const session = Session.open(workspace, { config });
  const write = (name: string, content: string) => fs.writeFileSync(path.join(workspace, name), content);
  const turn = (text: string) => {
    session.append({ kind: "message", message: { role: "user", content: text } });
    session.append({ kind: "message", message: { role: "assistant", content: "done" } });
    session.append({ kind: "turn_end", reason: "end_turn" });
  };
  return { workspace, session, write, turn, close() { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); } };
}

test("combined rewind restores changed/deleted files, removes added files and persists the branch", () => {
  const f = setup(); let next: Session | undefined;
  try {
    f.write("edit.txt", "first"); f.write("deleted.txt", "restore me"); f.turn("first task");
    checkpointConversation(f.session, "first", signal);
    f.write("edit.txt", "second"); f.write("added.txt", "new"); fs.unlinkSync(path.join(f.workspace, "deleted.txt")); f.turn("second task");
    const preview = previewRewind(f.session, 1, signal);
    assert.equal(preview.operations.length, 3);
    assert.deepEqual(preview.external, { kind: 'none' });
    next = applyRewind(f.session, preview, preview.token, signal);
    assert.equal(fs.readFileSync(path.join(f.workspace, "edit.txt"), "utf8"), "first");
    assert.equal(fs.readFileSync(path.join(f.workspace, "deleted.txt"), "utf8"), "restore me");
    assert.equal(fs.existsSync(path.join(f.workspace, "added.txt")), false);
    assert.equal(next.messages.length, 2); assert.equal(f.session.messages.length, 4);
    assert.equal(previewRewind(next, 1, signal).operations.length, 0);
    const id = next.id; next.close(); next = Session.open(f.workspace, { id });
    assert.equal(next.awaitingResponse, false); assert.equal(next.messages.length, 2);
    assert.ok(next.events.some(event => event.kind === "branch" && event.source === f.session.id && event.reason === "rewind"));
  } finally { next?.close(); f.close(); }
});

test("stale file or history preview leaves files and session identity intact", () => {
  const f = setup();
  try {
    f.write("edit.txt", "base"); checkpointConversation(f.session, "initial", signal);
    f.write("edit.txt", "changed"); const preview = previewRewind(f.session, 0, signal);
    f.write("edit.txt", "external edit");
    assert.throws(() => applyRewind(f.session, preview, preview.token, signal), /stale/);
    assert.equal(fs.readFileSync(path.join(f.workspace, "edit.txt"), "utf8"), "external edit");
    const fresh = previewRewind(f.session, 0, signal); f.turn("new history");
    assert.throws(() => applyRewind(f.session, fresh, fresh.token, signal), /stale/);
    assert.equal(fs.readdirSync(path.join(f.workspace, ".agent")).filter(name => name.endsWith(".jsonl")).length, 1);
  } finally { f.close(); }
});

test("branch commit failure rolls files back and removes the uncommitted branch", () => {
  const f = setup(); const append = Session.prototype.append;
  try {
    f.write("edit.txt", "base"); checkpointConversation(f.session, "initial", signal);
    f.write("edit.txt", "changed"); f.write("added.txt", "keep on failure");
    const preview = previewRewind(f.session, 0, signal);
    Session.prototype.append = function(event) {
      append.call(this, event);
      if (event.kind === "rewind") throw new Error("injected journal commit failure");
    };
    assert.throws(() => applyRewind(f.session, preview, preview.token, signal), /injected journal commit failure/);
    assert.equal(fs.readFileSync(path.join(f.workspace, "edit.txt"), "utf8"), "changed");
    assert.equal(fs.readFileSync(path.join(f.workspace, "added.txt"), "utf8"), "keep on failure");
    assert.equal(fs.readdirSync(path.join(f.workspace, ".agent")).filter(name => name.endsWith(".jsonl")).length, 1);
    assert.equal(fs.existsSync(path.join(f.workspace, ".agent/checkpoints/lock")), false);
  } finally { Session.prototype.append = append; f.close(); }
});

test("durable branch proof preserves committed files through marker and cleanup failures", () => {
  for (const failure of ["marker", "cleanup"] as const) {
  const f = setup(); const rename = fs.renameSync;
  const unlink = fs.unlinkSync, sync = fs.fsyncSync;
  let removed = false;
  let reopened: Session | undefined;
  try {
    f.write("edit.txt", "base"); checkpointConversation(f.session, "initial", signal);
    f.write("edit.txt", "changed"); f.write("added.txt", "new");
    const preview = previewRewind(f.session, 0, signal);
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (failure === "marker" && String(to) === path.join(f.workspace, ".agent/checkpoints/transaction.json") && JSON.parse(fs.readFileSync(from, "utf8")).state === "committed") {
        throw new Error("injected committed marker failure");
      }
      return rename(from, to);
    }) as typeof fs.renameSync;
    fs.unlinkSync = ((target: fs.PathLike) => {
      const result = unlink(target);
      if (failure === "cleanup" && String(target) === path.join(f.workspace, ".agent/checkpoints/transaction.json")) removed = true;
      return result;
    }) as typeof fs.unlinkSync;
    fs.fsyncSync = ((fd: number) => {
      sync(fd);
      if (removed) { removed = false; throw new Error("injected cleanup fsync failure"); }
    }) as typeof fs.fsyncSync;
    assert.throws(() => applyRewind(f.session, preview, preview.token, signal), failure === "marker" ? /history committed/ : /cleanup fsync failure/);
    fs.renameSync = rename;
    fs.unlinkSync = unlink; fs.fsyncSync = sync;
    assert.equal(fs.readFileSync(path.join(f.workspace, "edit.txt"), "utf8"), "base");
    assert.equal(fs.existsSync(path.join(f.workspace, "added.txt")), false);
    const pending = path.join(f.workspace, ".agent/checkpoints/transaction.json");
    const transaction = failure === "marker" ? JSON.parse(fs.readFileSync(pending, "utf8")) : undefined;
    if (transaction) assert.equal(transaction.state, "pending");
    const ctx = { workspace: f.workspace, signal, allowShell: false, maxOutputBytes: 24000 };
    assert.deepEqual(recoverCheckpoint(ctx), { recovery: failure === "marker" ? "committed" : "none" });
    assert.deepEqual(recoverCheckpoint(ctx), { recovery: "none" });
    const branchId = transaction?.branch.id ?? fs.readdirSync(path.join(f.workspace, ".agent")).find(name => name.endsWith(".jsonl") && name !== `${f.session.id}.jsonl`)!.slice(0, -6);
    reopened = Session.open(f.workspace, { id: branchId });
    assert.ok(reopened.events.some(event => event.kind === "branch" && event.reason === "rewind"));
    assert.equal(previewRewind(reopened, 0, signal).operations.length, 0);
  } finally { fs.renameSync = rename; fs.unlinkSync = unlink; fs.fsyncSync = sync; reopened?.close(); f.close(); }
  }
});

test("checkpoint recovery holds the branch Session gate before cleanup", { timeout: 30000 }, async () => {
  const f = setup(), rename = fs.renameSync; let holder: ReturnType<typeof spawn> | undefined;
  try {
    f.write("edit.txt", "base"); checkpointConversation(f.session, "initial", signal); f.write("edit.txt", "changed");
    const preview = previewRewind(f.session, 0, signal), pending = path.join(f.workspace, ".agent/checkpoints/transaction.json");
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (String(to) === pending && JSON.parse(fs.readFileSync(from, "utf8")).state === "committed") throw new Error("marker failure");
      return rename(from, to);
    }) as typeof fs.renameSync;
    assert.throws(() => applyRewind(f.session, preview, preview.token, signal), /history committed/); fs.renameSync = rename;
    const transaction = JSON.parse(fs.readFileSync(pending, "utf8")), branch = path.join(f.workspace, ".agent", `${transaction.branch.id}.jsonl`);
    const branchLock = `${branch}.lock`, gatePath = `${branchLock}.gate`, gate = fs.statSync(gatePath, { bigint: true });
    const dead = spawnSync(process.execPath, ["-e", "process.kill(process.pid,'SIGKILL')"], { timeout: 5000 });
    assert.equal(dead.signal, "SIGKILL");
    const lockBytes = JSON.stringify({ pid: dead.pid, token: crypto.randomUUID(), gate: { dev: String(gate.dev), ino: String(gate.ino) } });
    fs.writeFileSync(branchLock, lockBytes, { mode: 0o600 });
    const worker = `import fs from 'node:fs';import {lock} from './src/skill-effects.ts';const fd=fs.openSync(process.argv[1],'r+');
      if(!lock(fd,false))throw Error('gate unavailable');process.stdout.write('ready\\n');process.stdin.once('data',()=>{fs.closeSync(fd);process.exit(0)});`;
    holder = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", worker, gatePath], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    const exited = once(holder, "exit"); let output = "", errors = "";
    holder.stdout!.on("data", chunk => { output += String(chunk); }); holder.stderr!.on("data", chunk => { errors += String(chunk); });
    const deadline = Date.now() + 10000;
    while (!output.includes("ready\n")) {
      assert.ok(Date.now() < deadline && holder.exitCode === null, errors); await new Promise(resolve => setTimeout(resolve, 10));
    }
    const store = path.join(f.workspace, ".agent/checkpoints"), tag = crypto.createHash("sha256").update(store).digest("hex").slice(0, 12);
    const staging = [f.workspace, store].map(directory => path.join(directory, `.checkpoint-${tag}-${crypto.randomUUID()}.tmp`));
    for (const file of staging) fs.writeFileSync(file, "retained");
    const ctx = { workspace: f.workspace, signal, allowShell: false, maxOutputBytes: 24000 };
    assert.throws(() => recoverCheckpoint(ctx), /branch.*gate.*busy/i);
    assert.equal(fs.readFileSync(branchLock, "utf8"), lockBytes); assert.ok(fs.existsSync(pending));
    for (const file of staging) assert.equal(fs.readFileSync(file, "utf8"), "retained");
    holder.stdin!.end("release\n"); await exited; holder = undefined;
    const originalTransaction = fs.readFileSync(pending), altered = JSON.parse(originalTransaction.toString("utf8"));
    altered.branch.external = { kind: "unknown" }; fs.writeFileSync(pending, JSON.stringify(altered));
    assert.throws(() => recoverCheckpoint(ctx), /branch has unrelated history/i); assert.ok(fs.existsSync(pending));
    fs.writeFileSync(pending, originalTransaction);
    fs.renameSync(gatePath, `${gatePath}-original`); fs.writeFileSync(gatePath, "", { mode: 0o600 });
    assert.throws(() => recoverCheckpoint(ctx), /branch.*gate.*changed/i);
    assert.equal(fs.readFileSync(branchLock, "utf8"), lockBytes); assert.ok(fs.existsSync(pending));
    fs.unlinkSync(gatePath); fs.renameSync(`${gatePath}-original`, gatePath); fs.unlinkSync(branchLock);
    fs.renameSync(gatePath, `${gatePath}-original`); fs.writeFileSync(gatePath, "", { mode: 0o600 });
    assert.throws(() => recoverCheckpoint(ctx), /branch.*gate.*changed/i); assert.ok(fs.existsSync(pending));
    fs.unlinkSync(gatePath); fs.renameSync(`${gatePath}-original`, gatePath);
    const contender = fs.openSync(gatePath, "r+"), unlink = fs.unlinkSync; let observedStoreCleanup = false;
    try {
      fs.unlinkSync = ((target: fs.PathLike) => {
        if (String(target) === staging[1]) { observedStoreCleanup = true; assert.equal(lock(contender, false), false); }
        return unlink(target);
      }) as typeof fs.unlinkSync;
      assert.deepEqual(recoverCheckpoint(ctx), { recovery: "committed" }); assert.equal(observedStoreCleanup, true);
    } finally { fs.unlinkSync = unlink; fs.closeSync(contender); }
    for (const file of staging) assert.equal(fs.existsSync(file), false);
  } finally {
    fs.renameSync = rename;
    if (holder && holder.exitCode === null) { const exited = once(holder, "exit"); holder.kill("SIGKILL"); await exited; }
    f.close();
  }
});

test("crashed uncommitted rewind waits for its branch gate before rollback", { timeout: 30000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-rewind-gate-crash-")));
  let holder: ReturnType<typeof spawn> | undefined;
  try {
    const writer = `import fs from 'node:fs';import path from 'node:path';import {Session} from './src/session.ts';
      import {defaultConfig} from './src/agent.ts';import {checkpointConversation,previewRewind,applyRewind} from './src/rewind.ts';
      const root=process.argv[1],signal=new AbortController().signal,s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
      fs.writeFileSync(path.join(root,'value'),'base');checkpointConversation(s,'initial',signal);fs.writeFileSync(path.join(root,'value'),'changed');
      const preview=previewRewind(s,0,signal),append=Session.prototype.append;
      Session.prototype.append=function(event,...args){if(event.kind==='rewind')process.kill(process.pid,'SIGKILL');return append.call(this,event,...args)};
      applyRewind(s,preview,preview.token,signal);`;
    const writerResult = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", writer, workspace],
      { cwd: process.cwd(), encoding: "utf8", timeout: 15000 });
    assert.equal(writerResult.signal, "SIGKILL", writerResult.stderr);
    const pending = path.join(workspace, ".agent/checkpoints/transaction.json"), transaction = JSON.parse(fs.readFileSync(pending, "utf8"));
    const branch = path.join(workspace, ".agent", `${transaction.branch.id}.jsonl`), branchLock = `${branch}.lock`, gatePath = `${branchLock}.gate`;
    const gate = fs.statSync(gatePath, { bigint: true });
    assert.deepEqual(transaction.branch.gate, { dev: String(gate.dev), ino: String(gate.ino) });
    const beforeLock = fs.readFileSync(branchLock), beforeBranch = fs.readFileSync(branch);
    const worker = `import fs from 'node:fs';import {lock} from './src/skill-effects.ts';const fd=fs.openSync(process.argv[1],'r+');
      if(!lock(fd,false))throw Error('gate unavailable');process.stdout.write('ready\\n');process.stdin.once('data',()=>{fs.closeSync(fd);process.exit(0)});`;
    holder = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", worker, gatePath], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    const exited = once(holder, "exit"); let output = "", errors = "";
    holder.stdout!.on("data", chunk => { output += String(chunk); }); holder.stderr!.on("data", chunk => { errors += String(chunk); });
    const deadline = Date.now() + 10000;
    while (!output.includes("ready\n")) {
      assert.ok(Date.now() < deadline && holder.exitCode === null, errors); await new Promise(resolve => setTimeout(resolve, 10));
    }
    const ctx = { workspace, signal, allowShell: false, maxOutputBytes: 24000 };
    assert.throws(() => recoverCheckpoint(ctx), /branch.*gate.*busy/i);
    assert.equal(fs.readFileSync(path.join(workspace, "value"), "utf8"), "base");
    assert.deepEqual(fs.readFileSync(branchLock), beforeLock); assert.deepEqual(fs.readFileSync(branch), beforeBranch); assert.ok(fs.existsSync(pending));
    holder.stdin!.end("release\n"); await exited; holder = undefined;
    assert.deepEqual(recoverCheckpoint(ctx), { recovery: "rolled_back" });
    assert.equal(fs.readFileSync(path.join(workspace, "value"), "utf8"), "changed");
    assert.equal(fs.existsSync(branch), false); assert.equal(fs.existsSync(branchLock), false); assert.equal(fs.existsSync(pending), false);
  } finally {
    if (holder && holder.exitCode === null) { const exited = once(holder, "exit"); holder.kill("SIGKILL"); await exited; }
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("legacy branch transactions still acquire their existing Session gate", () => {
  const f = setup(), rename = fs.renameSync; let gateFd: number | undefined;
  try {
    f.write("edit.txt", "base"); checkpointConversation(f.session, "initial", signal); f.write("edit.txt", "changed");
    const preview = previewRewind(f.session, 0, signal), pending = path.join(f.workspace, ".agent/checkpoints/transaction.json");
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (String(to) === pending && JSON.parse(fs.readFileSync(from, "utf8")).state === "committed") throw new Error("marker failure");
      return rename(from, to);
    }) as typeof fs.renameSync;
    assert.throws(() => applyRewind(f.session, preview, preview.token, signal), /history committed/); fs.renameSync = rename;
    const transaction = JSON.parse(fs.readFileSync(pending, "utf8")); delete transaction.branch.gate; delete transaction.branch.external;
    fs.writeFileSync(pending, JSON.stringify(transaction));
    const branchFile = path.join(f.workspace, ".agent", `${transaction.branch.id}.jsonl`), lines = fs.readFileSync(branchFile, "utf8").trimEnd().split("\n");
    const branchRecord = JSON.parse(lines.at(-1)!); delete branchRecord.external; lines[lines.length - 1] = JSON.stringify(branchRecord);
    fs.writeFileSync(branchFile, lines.join("\n") + "\n");
    const branchLock = `${branchFile}.lock`, gatePath = `${branchLock}.gate`;
    fs.writeFileSync(branchLock, JSON.stringify({ pid: 2147483647, token: crypto.randomUUID() }), { mode: 0o600 });
    gateFd = fs.openSync(gatePath, "r+"); assert.equal(lock(gateFd, false), true);
    const ctx = { workspace: f.workspace, signal, allowShell: false, maxOutputBytes: 24000 };
    assert.throws(() => recoverCheckpoint(ctx), /branch.*gate.*busy/i); assert.ok(fs.existsSync(pending));
    fs.closeSync(gateFd); gateFd = undefined;
    assert.deepEqual(recoverCheckpoint(ctx), { recovery: "committed" }); assert.equal(fs.existsSync(branchLock), false);
  } finally { fs.renameSync = rename; if (gateFd !== undefined) fs.closeSync(gateFd); f.close(); }
});

test("branch checkpoint paths cannot be forged through Session.append", () => {
  const f = setup(), outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-branch-")));
  let targetSession: Session | undefined, other: Session | undefined;
  try {
    const target = path.join(outside, "untracked"); fs.writeFileSync(target, "UNTRACKED");
    f.session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const grant = f.session.workingDirectories(false).readHandle?.(outside); assert.ok(grant);
    const fabricated = { trackingPath: target, lexicalPath: target, grant: { root: outside, dev: String(grant.dev), ino: String(grant.ino) } };
    assert.throws(() => f.session.append({ kind: "branch", source: crypto.randomUUID(), workspace: f.workspace, boundary: 0, reason: "fork",
      external: { kind: "unavailable", paths: [target] }, checkpointPaths: { kind: "available", paths: [fabricated] } }), /branch.*authorization/i);
    assert.equal(f.session.events.some(event => event.kind === 'branch'), false);
    targetSession = Session.open(f.workspace, { config: f.session.snapshotConfig() });
    other = Session.open(f.workspace, { config: f.session.snapshotConfig() });
    const append = targetSession.append.bind(targetSession), alternate = other;
    targetSession.append = (event, authorization, token) => {
      if (event.kind === 'branch') {
        event.external = { kind: 'unavailable', paths: [target] };
        event.checkpointPaths = { kind: 'available', paths: [fabricated] };
      }
      append(event, authorization, token);
    };
    assert.throws(() => targetSession?.appendCheckpointBranch(f.session, { boundary: 0, reason: 'fork' }), /branch.*authorization/i);
    assert.equal(targetSession.events.some(event => event.kind === 'branch'), false);
    targetSession.append = (event, authorization, token) => alternate.append(event, authorization, token);
    assert.throws(() => targetSession?.appendCheckpointBranch(f.session, { boundary: 0, reason: 'fork' }), /branch.*authorization/i);
    assert.equal(other.events.some(event => event.kind === 'branch'), false);
    const captured: { value?: { event: Parameters<typeof append>[0]; token?: symbol } } = {};
    targetSession.append = (event, authorization, token) => {
      append(event, authorization, token); captured.value = { event: structuredClone(event), token };
    };
    targetSession.appendCheckpointBranch(f.session, { boundary: 0, reason: 'fork' });
    const used = captured.value; assert.ok(used);
    assert.throws(() => append(used.event, undefined, used.token), /branch.*authorization/i);
    assert.equal(targetSession.events.filter(event => event.kind === 'branch').length, 1);
    f.session.events.push({ kind: 'branch', source: crypto.randomUUID(), workspace: f.workspace, boundary: 0, reason: 'fork',
      external: { kind: 'unavailable', paths: [target] }, checkpointPaths: { kind: 'available', paths: [fabricated] } });
    try {
      targetSession.appendCheckpointBranch(f.session, { boundary: 0, reason: 'fork' });
      const latest = targetSession.events.at(-1); assert.ok(latest?.kind === 'branch');
      assert.deepEqual(latest.external, { kind: 'unknown' }); assert.deepEqual(latest.checkpointPaths, { kind: 'unknown' });
    } finally { f.session.events.pop(); }
  } finally { targetSession?.close(); other?.close(); f.close(); fs.rmSync(outside, { recursive: true, force: true }); }
});

test("legacy branches without an external witness stay unknown on cold reopen", () => {
  const f = setup(); let reopened: Session | undefined;
  try {
    checkpointConversation(f.session, "initial", signal);
    f.session.append({ kind: "branch", source: crypto.randomUUID(), workspace: f.workspace, boundary: 0, reason: "fork" });
    assert.deepEqual(previewRewind(f.session, 0, signal).external, { kind: "unknown" });
    assert.deepEqual(f.session.directoryCheckpointPathsAt(f.session.events.length), { kind: "unknown" });
    const id = f.session.id; f.session.close(); reopened = Session.open(f.workspace, { id });
    assert.deepEqual(previewRewind(reopened, 0, signal).external, { kind: "unknown" });
    assert.deepEqual(reopened.directoryCheckpointPathsAt(reopened.events.length), { kind: "unknown" });
    reopened.append({ kind: "branch", source: crypto.randomUUID(), workspace: f.workspace, boundary: 0, reason: "fork",
      external: { kind: "unavailable", paths: ["/untracked"] } });
    assert.deepEqual(reopened.directoryCheckpointPathsAt(reopened.events.length), { kind: "unknown" });
    reopened.close(); reopened = Session.open(f.workspace, { id });
    assert.deepEqual(reopened.directoryCheckpointPathsAt(reopened.events.length), { kind: "unknown" });
    reopened.close();
    fs.appendFileSync(f.session.file, JSON.stringify({ kind: "branch", source: crypto.randomUUID(), workspace: f.workspace, boundary: 0, reason: "fork",
      external: { kind: "unavailable", paths: ["/untracked"] }, checkpointPaths: { kind: "available", paths: [] } }) + "\n");
    reopened = Session.open(f.workspace, { id });
    assert.deepEqual(previewRewind(reopened, 0, signal).external, { kind: "unavailable", paths: ["/untracked"] });
    assert.deepEqual(reopened.directoryCheckpointPathsAt(reopened.events.length), { kind: "unknown" });
  } finally { reopened?.close(); f.close(); }
});

test("automatic main checkpoints deduplicate persisted boundaries and skip child snapshots", () => {
  const f = setup();
  let reopened: Session | undefined;
  try {
    f.session.config.automaticCheckpoints = true;
    // Create a fresh pinned session rather than modifying metadata identity.
    const config = structuredClone(f.session.config); f.session.close();
    reopened = Session.open(f.workspace, { config });
    f.write("file.txt", "initial");
    const append = reopened.append.bind(reopened);
    reopened.append = event => { if (event.kind === "checkpoint") throw new Error("injected association failure"); append(event); };
    assert.throws(() => automaticCheckpoint(reopened!, signal), /injected association failure/);
    const manifests = path.join(f.workspace, ".agent/checkpoints/manifests");
    const orphan = fs.readdirSync(manifests)[0]!;
    const orphanBytes = fs.readFileSync(path.join(manifests, orphan));
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 0);
    const store = path.join(f.workspace, ".agent/checkpoints");
    const intents = () => fs.readdirSync(store).filter(name => name.startsWith(".assoc-"));
    // The failed append keeps a durable intent naming the published manifest.
    assert.equal(intents().length, 1);
    reopened.append = append;
    f.write("file.txt", "retry state");
    const retryId = reopened.id; reopened.close(); reopened = Session.open(f.workspace, { id: retryId });
    // Reopening restores the missing association instead of leaving an unreachable manifest.
    assert.equal(intents().length, 0);
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 1);
    automaticCheckpoint(reopened, signal); automaticCheckpoint(reopened, signal);
    assert.equal(fs.readdirSync(manifests).length, 1);
    assert.deepEqual(fs.readFileSync(path.join(manifests, orphan)), orphanBytes);
    assert.equal(previewRewind(reopened, 0, signal).operations.length, 1);
    reopened.append({ kind: "message", message: { role: "user", content: "task" } });
    automaticCheckpoint(reopened, signal);
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 1);
    reopened.append({ kind: "message", message: { role: "assistant", content: "done" } });
    reopened.append({ kind: "turn_end", reason: "end_turn" });
    f.write("file.txt", "done"); automaticCheckpoint(reopened, signal);
    const id = reopened.id; reopened.close(); reopened = Session.open(f.workspace, { id });
    automaticCheckpoint(reopened, signal);
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 2);
    assert.equal(previewRewind(reopened, 0, signal).operations.length, 1);
    const child = Session.open(f.workspace, { config: { ...config, childMode: "general" } });
    try { automaticCheckpoint(child, signal); assert.equal(child.events.length, 1); } finally { child.close(); }
  } finally { reopened?.close(); f.close(); }
});

test("association recovery clears unprovable intents, keeps foreign evidence and is idempotent", () => {
  const f = setup(); let reopened: Session | undefined;
  try {
    const store = path.join(f.workspace, ".agent/checkpoints");
    const session = f.session.id;
    const missing = writeCheckpointAssociation(f.workspace, session, "never-captured", 0);
    const foreign = writeCheckpointAssociation(f.workspace, crypto.randomUUID(), "foreign", 0);
    const invalid = path.join(store, `.assoc-${crypto.randomUUID()}.json`);
    fs.writeFileSync(invalid, "{}");
    f.session.close();
    reopened = Session.open(f.workspace, { id: session });
    // No manifest was published, so the intent has no association to restore.
    assert.equal(fs.existsSync(missing), false);
    // Another session and an unreadable file stay for inspection.
    assert.equal(fs.existsSync(foreign), true);
    assert.equal(fs.existsSync(invalid), true);
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 0);
    const retained = fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).sort();
    checkpointConversation(reopened, "captured", signal);
    // A successful capture clears its own intent and leaves foreign evidence untouched.
    assert.deepEqual(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).sort(), retained);
    const id = reopened.id; reopened.close(); reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 1);
  } finally { reopened?.close(); f.close(); }
});

test("a published manifest survives a directory sync failure with its association", () => {
  const f = setup(), rename = fs.renameSync, sync = fs.fsyncSync;
  let reopened: Session | undefined, armed = false, injected = false;
  try {
    f.write("file.txt", "captured");
    const manifest = path.join(f.workspace, ".agent/checkpoints/manifests/sync-failure.json");
    fs.renameSync = (from, to) => {
      const result = rename(from, to);
      if (String(to) === manifest) armed = true;
      return result;
    };
    fs.fsyncSync = fd => {
      if (armed) { armed = false; injected = true; throw new Error("injected manifest directory sync failure"); }
      return sync(fd);
    };
    try { assert.throws(() => checkpointConversation(f.session, "sync-failure", signal), /injected manifest directory sync failure/); }
    finally { fs.renameSync = rename; fs.fsyncSync = sync; }
    assert.equal(injected, true); assert.equal(fs.existsSync(manifest), true);
    const store = path.join(f.workspace, ".agent/checkpoints");
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 1);
    const id = f.session.id; f.session.close();
    const manifestDir = fs.statSync(path.dirname(manifest)); let recoverySyncFailed = false;
    fs.fsyncSync = fd => {
      const current = fs.fstatSync(fd);
      if (!recoverySyncFailed && current.isDirectory() && current.dev === manifestDir.dev && current.ino === manifestDir.ino) {
        recoverySyncFailed = true; throw new Error("injected recovery sync failure");
      }
      return sync(fd);
    };
    try { reopened = Session.open(f.workspace, { id }); }
    finally { fs.fsyncSync = sync; }
    assert.equal(recoverySyncFailed, true);
    assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "sync-failure"), false);
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 1);
    reopened.close();
    reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint" && event.name === "sync-failure").length, 1);
    assert.equal(previewRewind(reopened, 0, signal).operations.length, 0);
    reopened.close(); reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint" && event.name === "sync-failure").length, 1);
  } finally { fs.renameSync = rename; fs.fsyncSync = sync; reopened?.close(); f.close(); }
});

test("association recovery fences a journal sync failure before reopening", () => {
  const f = setup(), sync = fs.fsyncSync, append = f.session.append.bind(f.session);
  let reopened: Session | undefined;
  try {
    f.write("file.txt", "captured");
    f.session.append = event => { if (event.kind === "checkpoint") throw new Error("injected pre-append failure"); append(event); };
    assert.throws(() => checkpointConversation(f.session, "journal-sync", signal), /injected pre-append failure/);
    f.session.append = append;
    const id = f.session.id, journal = f.session.file, before = fs.statSync(journal), store = path.join(f.workspace, ".agent/checkpoints");
    f.session.close();
    let injected = false, failure: unknown;
    fs.fsyncSync = fd => {
      const current = fs.fstatSync(fd);
      if (!injected && current.isFile() && current.dev === before.dev && current.ino === before.ino && current.size > before.size) {
        injected = true; throw new Error("injected recovered journal sync failure");
      }
      return sync(fd);
    };
    try { reopened = Session.open(f.workspace, { id }); } catch (error) { failure = error; }
    finally { fs.fsyncSync = sync; }
    assert.equal(injected, true); assert.ok(failure instanceof Error, "uncertain recovery must not return a live Session");
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 1);
    const rows = fs.readFileSync(journal, "utf8").trimEnd().split("\n").map(line => JSON.parse(line));
    assert.equal(rows.filter(row => row.kind === "checkpoint" && row.name === "journal-sync").length, 1);
    let resyncFailed = false; failure = undefined;
    fs.fsyncSync = fd => {
      const current = fs.fstatSync(fd);
      if (!resyncFailed && current.isFile() && current.dev === before.dev && current.ino === before.ino) {
        resyncFailed = true; throw new Error("injected existing journal sync failure");
      }
      return sync(fd);
    };
    try { reopened = Session.open(f.workspace, { id }); } catch (error) { failure = error; }
    finally { fs.fsyncSync = sync; }
    assert.equal(resyncFailed, true); assert.ok(failure instanceof Error);
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 1);
    for (let i = 0; i < 2; i++) {
      reopened = Session.open(f.workspace, { id });
      assert.equal(reopened.events.filter(event => event.kind === "checkpoint" && event.name === "journal-sync").length, 1);
      reopened.close(); reopened = undefined;
    }
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 0);
  } finally { fs.fsyncSync = sync; reopened?.close(); f.close(); }
});

test("association recovery preserves a torn row before retrying", () => {
  const f = setup(), append = f.session.append.bind(f.session);
  let reopened: Session | undefined;
  try {
    f.write("file.txt", "captured");
    f.session.append = event => { if (event.kind === "checkpoint") throw new Error("injected pre-append failure"); append(event); };
    assert.throws(() => checkpointConversation(f.session, "torn", signal), /injected pre-append failure/);
    f.session.append = append;
    const id = f.session.id, journal = f.session.file, original = fs.readFileSync(journal), store = path.join(f.workspace, ".agent/checkpoints");
    f.session.close();
    const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';const [root,id]=process.argv.slice(1);
      const journal=root+'/.agent/'+id+'.jsonl',identity=fs.statSync(journal),write=fs.writeSync;let partial=false;
      fs.writeSync=function(fd,bytes,offset,length,position){const stat=fs.fstatSync(fd);
        if(stat.dev===identity.dev&&stat.ino===identity.ino&&Buffer.isBuffer(bytes)){
          if(partial)throw Error('injected recovery short write');partial=true;return write.call(this,fd,bytes,offset,Math.floor(length/2),position)}
        return write.apply(this,arguments)};
      try{Session.open(root,{id});throw Error('uncertain open returned')}catch(error){if(!partial||!String(error).includes('injected recovery short write'))throw error;process.exit(7)}`;
    const failed = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", writer, f.workspace, id],
      { cwd: process.cwd(), encoding: "utf8", timeout: 15000 });
    assert.equal(failed.status, 7, failed.stderr);
    const torn = fs.readFileSync(journal); assert.ok(torn.subarray(0, original.length).equals(original)); assert.notEqual(torn.at(-1), 10);
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 1);
    reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint" && event.name === "torn").length, 1);
    const evidence = fs.readdirSync(path.dirname(journal)).filter(name => name.startsWith(path.basename(journal) + ".torn-"));
    assert.equal(evidence.length, 1); assert.deepEqual(fs.readFileSync(path.join(path.dirname(journal), evidence[0]!)), torn);
    reopened.close(); reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint" && event.name === "torn").length, 1);
    assert.equal(fs.readdirSync(store).filter(name => name.startsWith(".assoc-")).length, 0);
  } finally { reopened?.close(); f.close(); }
});

test("an existing checkpoint with a different boundary retains its intent", () => {
  const f = setup(); let reopened: Session | undefined;
  try {
    f.write("file.txt", "captured");
    const id = f.session.id, intent = writeCheckpointAssociation(f.workspace, id, "different-boundary", 0);
    const association = { id: path.basename(intent).slice(".assoc-".length, -".json".length), session: id, boundary: 0 };
    const captured = captureCheckpoint("different-boundary", { workspace: f.workspace, signal, allowShell: false, maxOutputBytes: 24000 }, association);
    f.session.append({ kind: "checkpoint", name: "different-boundary", digest: captured.checkpoint_digest, boundary: 1 });
    const journal = f.session.file, before = fs.readFileSync(journal); f.session.close();
    reopened = Session.open(f.workspace, { id });
    assert.ok(fs.existsSync(intent)); assert.deepEqual(fs.readFileSync(journal), before);
    const rows = reopened.events.filter(event => event.kind === "checkpoint" && event.name === "different-boundary");
    assert.equal(rows.length, 1); assert.equal(rows[0]?.kind === "checkpoint" && rows[0].boundary, 1);
  } finally { reopened?.close(); f.close(); }
});

test("a checkpoint witness commitment requires a live bracket authorization", () => {
  const f = setup();
  try {
    f.write("file.txt", "captured"); checkpointConversation(f.session, "unwitnessed", signal);
    const forged = { id: crypto.randomUUID(), name: "unwitnessed", witness: "0".repeat(64) };
    assert.throws(() => f.session.commitDirectoryCheckpointWitness(forged), /authorization/i);
    assert.throws(() => f.session.commitDirectoryCheckpointWitness(forged, Symbol('forged')), /authorization/i);
    assert.equal(f.session.events.some(event => event.kind === "directory_checkpoint_witness" && event.name === "unwitnessed"), false);
  } finally { f.close(); }
});

test("legacy manifests without a creation witness do not complete an intent", async () => {
  const f = setup(); let reopened: Session | undefined;
  try {
    f.write("file.txt", "legacy");
    const ctx = { workspace: f.workspace, signal, allowShell: false, maxOutputBytes: 24000 };
    captureCheckpoint("legacy", ctx);
    const intent = writeCheckpointAssociation(f.workspace, f.session.id, "legacy", 0), id = f.session.id;
    await f.session.close();
    for (let pass = 0; pass < 2; pass++) {
      reopened = Session.open(f.workspace, { id });
      assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "legacy"), false);
      assert.ok(fs.existsSync(intent)); await reopened.close(); reopened = undefined;
    }
  } finally { await reopened?.close(); f.close(); }
});

test("checkpoint recovery binds the captured Session boundary", { timeout: 30000 }, async () => {
  const f = setup(), marker = path.join(f.workspace, ".agent", "association-boundary.json");
  let child: ReturnType<typeof spawn> | undefined, reopened: Session | undefined;
  try {
    f.write("file.txt", "captured");
    const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {defaultConfig} from './src/agent.ts';
      import {checkpointConversation} from './src/rewind.ts';const [root,marker]=process.argv.slice(1);
      const s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}}),append=s.append.bind(s);
      s.append=function(event,...args){if(event.kind==='checkpoint'){fs.writeFileSync(marker,JSON.stringify({id:s.id}));process.kill(process.pid,'SIGSTOP')}return append(event,...args)};
      checkpointConversation(s,'boundary',new AbortController().signal);`;
    child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", writer, f.workspace, marker],
      { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
    const exited = once(child, "exit"); let errors = ""; child.stderr!.on("data", chunk => { errors += String(chunk); });
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(marker)) {
      assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    while (!spawnSync("ps", ["-o", "state=", "-p", String(child.pid)], { encoding: "utf8", timeout: 5000 }).stdout.trim().startsWith("T")) {
      assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const { id } = JSON.parse(fs.readFileSync(marker, "utf8")), store = path.join(f.workspace, ".agent/checkpoints");
    const name = fs.readdirSync(store).find(value => value.startsWith(".assoc-")); assert.ok(name);
    const intentPath = path.join(store, name), original = fs.readFileSync(intentPath), intent = JSON.parse(original.toString("utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(store, "manifests/boundary.json"), "utf8"));
    assert.deepEqual(manifest.association, { id: intent.id, session: id, boundary: intent.boundary });
    child.kill("SIGKILL"); await exited; child = undefined;
    const file = manifest.entries.find((entry: { path: string; kind: string }) => entry.path === "file.txt"); assert.ok(file && file.kind === "file");
    const object = path.join(store, "objects", file.sha256), objectBytes = fs.readFileSync(object);
    for (const state of ["missing", "corrupt"] as const) {
      if (state === "missing") fs.renameSync(object, `${object}-hidden`); else fs.writeFileSync(object, "CORRUPT");
      reopened = Session.open(f.workspace, { id, ...(state === "missing" ? { recoverLock: true } : {}) });
      assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "boundary"), false, state);
      assert.ok(fs.existsSync(intentPath)); await reopened.close(); reopened = undefined;
      if (state === "missing") fs.renameSync(`${object}-hidden`, object); else fs.writeFileSync(object, objectBytes);
    }
    fs.writeFileSync(intentPath, JSON.stringify({ ...intent, boundary: intent.boundary + 1 }));
    reopened = Session.open(f.workspace, { id });
    assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "boundary"), false);
    assert.ok(fs.existsSync(intentPath)); await reopened.close(); reopened = undefined;
    fs.writeFileSync(intentPath, original);
    reopened = Session.open(f.workspace, { id });
    const checkpoint = reopened.events.find(event => event.kind === "checkpoint" && event.name === "boundary");
    assert.ok(checkpoint && checkpoint.kind === "checkpoint"); assert.equal(checkpoint.boundary, intent.boundary);
    assert.equal(fs.existsSync(intentPath), false);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGKILL"); await exited; }
    await reopened?.close(); f.close();
  }
});

test("a killed checkpoint intent cannot claim another Session's same-name manifest", { timeout: 30000 }, async t => {
  for (const order of ["existing", "concurrent"] as const) {
    await t.test(order, async () => {
    const f = setup(), marker = path.join(f.workspace, ".agent", `association-${order}.json`);
    let reopened: Session | undefined, child: ReturnType<typeof spawn> | undefined;
    try {
      f.write("file.txt", "owner-a");
      if (order === "existing") checkpointConversation(f.session, "shared", signal);
      const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {defaultConfig} from './src/agent.ts';
        import {checkpointConversation} from './src/rewind.ts';const [root,marker]=process.argv.slice(1);
        const s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}}),rename=fs.renameSync,sync=fs.fsyncSync;let armed=false;
        fs.renameSync=function(from,to){const result=rename.apply(this,arguments);if(String(to).includes('/.assoc-'))armed=true;return result};
        fs.fsyncSync=function(fd){const result=sync.call(this,fd);if(armed){fs.writeFileSync(marker,JSON.stringify({id:s.id}));process.kill(process.pid,'SIGSTOP')}return result};
        checkpointConversation(s,'shared',new AbortController().signal);`;
      child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", writer, f.workspace, marker],
        { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
      const exited = once(child, "exit"); let errors = ""; child.stderr!.on("data", chunk => { errors += String(chunk); });
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(marker)) {
        assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const { id } = JSON.parse(fs.readFileSync(marker, "utf8"));
      while (!spawnSync("ps", ["-o", "state=", "-p", String(child.pid)], { encoding: "utf8", timeout: 5000 }).stdout.trim().startsWith("T")) {
        assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (order === "concurrent") { f.write("file.txt", "owner-a-concurrent"); checkpointConversation(f.session, "shared", signal); }
      const store = path.join(f.workspace, ".agent/checkpoints"), intents = fs.readdirSync(store).filter(name => name.startsWith(".assoc-"));
      assert.equal(intents.length, 1); const intent = path.join(store, intents[0]!);
      const journal = path.join(f.workspace, ".agent", `${id}.jsonl`), before = fs.readFileSync(journal);
      child.kill("SIGKILL"); await exited; child = undefined; f.write("file.txt", "current");
      reopened = Session.open(f.workspace, { id, recoverLock: true });
      assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "shared"), false, order);
      assert.deepEqual(fs.readFileSync(journal), before); assert.ok(fs.existsSync(intent));
      assert.throws(() => previewRewind(reopened!, 0, signal), /No file checkpoint/);
      await reopened.close(); reopened = Session.open(f.workspace, { id });
      assert.equal(reopened.events.some(event => event.kind === "checkpoint" && event.name === "shared"), false, order);
      assert.equal(fs.readFileSync(path.join(f.workspace, "file.txt"), "utf8"), "current");
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGKILL"); await exited; }
      await reopened?.close(); f.close();
    }
    });
  }
});

test("a real crash between capture and association is completed on the next open", () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-rewind-crash-")));
  try {
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `
      const { pathToFileURL } = await import("node:url");
      const fs = (await import("node:fs")).default;
      const path = (await import("node:path")).default;
      const root = process.env.HARNESS_ROOT, workspace = process.env.HARNESS_WORKSPACE;
      const { Session } = await import(pathToFileURL(path.join(root, "src/session.ts")).href);
      const { automaticCheckpoint } = await import(pathToFileURL(path.join(root, "src/rewind.ts")).href);
      const { defaultConfig } = await import(pathToFileURL(path.join(root, "src/agent.ts")).href);
      const config = defaultConfig(workspace, []); config.model = "fixture"; config.automaticCheckpoints = true;
      const session = Session.open(workspace, { config });
      fs.writeFileSync(path.join(workspace, "file.txt"), "before");
      const append = session.append.bind(session);
      session.append = event => { if (event.kind === "checkpoint") process.kill(process.pid, "SIGKILL"); return append(event); };
      automaticCheckpoint(session, new AbortController().signal);
    `], { cwd: path.resolve("."), encoding: "utf8", timeout: 20_000,
      env: { ...process.env, HARNESS_ROOT: path.resolve("."), HARNESS_WORKSPACE: workspace } });
    assert.equal(child.signal, "SIGKILL", child.stderr);
    const store = path.join(workspace, ".agent/checkpoints");
    assert.equal(fs.readdirSync(path.join(store, "manifests")).length, 1);
    const intents = () => fs.readdirSync(store).filter(name => name.startsWith(".assoc-"));
    assert.equal(intents().length, 1);
    const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"))!;
    const reopened = Session.open(workspace, { id: journal.slice(0, -".jsonl".length), recoverLock: true });
    try {
      assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 1);
      assert.equal(intents().length, 0);
      assert.equal(previewRewind(reopened, 0, new AbortController().signal).operations.length, 0);
    } finally { reopened.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
