import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig } from "../src/agent.js";
import { Session } from "../src/session.js";
import { checkpointConversation, previewRewind, applyRewind, automaticCheckpoint } from "../src/rewind.js";
import { recoverCheckpoint } from "../src/checkpoints.js";

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
    reopened.append = append;
    f.write("file.txt", "retry state");
    const retryId = reopened.id; reopened.close(); reopened = Session.open(f.workspace, { id: retryId });
    automaticCheckpoint(reopened, signal); automaticCheckpoint(reopened, signal);
    assert.equal(fs.readdirSync(manifests).length, 2);
    assert.deepEqual(fs.readFileSync(path.join(manifests, orphan)), orphanBytes);
    assert.equal(previewRewind(reopened, 0, signal).operations.length, 0);
    assert.equal(reopened.events.filter(event => event.kind === "checkpoint").length, 1);
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
