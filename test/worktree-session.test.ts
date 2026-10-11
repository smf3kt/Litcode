import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { getEventListeners } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { defaultConfig } from "../src/agent.js";
import { Session, fingerprint } from "../src/session.js";
import { relocateSession } from "../src/workspace-session.js";
import { resolveWorktreeEntry, resolveWorktreeExit, removeExitedWorktree } from "../src/worktree-session.js";
import { WORKTREE_DIRECTORY } from "../src/worktrees.js";

const fixtureEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.test" };
function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root, env: fixtureEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
  }).trimEnd();
}
function repository(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-worktree-session-")));
  git(root, "init", "--initial-branch=trunk");
  fs.writeFileSync(path.join(root, "file.txt"), "baseline\n");
  git(root, "add", "file.txt"); git(root, "commit", "-m", "Disposable fixture baseline");
  return root;
}

test("entry/exit relocates and resumes completed history while preserving HEAD, dirty checkout and owned branch", async () => {
  const root = repository(); const sessions: Session[] = [];
  const signal = new AbortController().signal;
  try {
    const config = { ...defaultConfig(root, []), model: "fixture/worktree" };
    const source = Session.open(root, { config }); sessions.push(source);
    source.append({ kind: "message", message: { role: "user", content: "completed fixture" } });
    source.append({ kind: "message", message: { role: "assistant", content: "done" } });
    source.append({ kind: "turn_end", reason: "end_turn" });
    const before = fs.readFileSync(source.file);
    fs.writeFileSync(path.join(root, "file.txt"), "source edit\n");
    const entry = await resolveWorktreeEntry(source.config, "scratch", signal);
    assert.deepEqual(entry, { path: path.join(root, WORKTREE_DIRECTORY, "scratch"), origin: root, name: "scratch", created: true });
    assert.equal(git(entry.path, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD"));
    assert.equal(fs.readFileSync(path.join(entry.path, "file.txt"), "utf8"), "baseline\n");
    const entered = relocateSession(source, entry.path, (nextConfig) => {
      assert.equal(nextConfig.worktreeReturn, root); return [];
    }, { worktreeReturn: entry.origin }); sessions.push(entered);
    assert.deepEqual(entered.events.slice(1, 4), source.events.slice(1));
    assert.deepEqual(fs.readFileSync(source.file), before);
    const enteredId = entered.id; const pinned = structuredClone(entered.config); entered.close();
    const resumed = Session.open(entry.path, { id: enteredId, config: pinned }); sessions.push(resumed);
    assert.equal(resumed.config.worktreeReturn, root);
    fs.writeFileSync(path.join(entry.path, "file.txt"), "checkout edit\n");
    git(entry.path, "add", "file.txt"); git(entry.path, "commit", "-m", "Disposable unmerged work");
    fs.writeFileSync(path.join(entry.path, "kept.txt"), "keep this\n");
    assert.equal(await resolveWorktreeExit({ ...resumed.config, features: { tasks: false, subagents: false, worktrees: false } }, signal), root);
    const returned = relocateSession(resumed, root, (nextConfig) => {
      assert.equal(Object.hasOwn(nextConfig, "worktreeReturn"), false); return [];
    }, { worktreeReturn: null }); sessions.push(returned);
    assert.equal(Object.hasOwn(returned.config, "worktreeReturn"), false);
    const metadata = returned.events[0]!;
    assert.ok(metadata.kind === "metadata" && metadata.fingerprint === fingerprint(returned.config));
    const reuse = await resolveWorktreeEntry(returned.config, "scratch", signal);
    assert.equal(reuse.created, false); assert.equal(reuse.path, entry.path);
    assert.equal(fs.readFileSync(path.join(reuse.path, "kept.txt"), "utf8"), "keep this\n");
    assert.equal(fs.readFileSync(path.join(root, "file.txt"), "utf8"), "source edit\n");
    assert.equal(git(root, "symbolic-ref", "--short", "HEAD"), "trunk");
    assert.equal(git(entry.path, "symbolic-ref", "--short", "HEAD"), "harness/scratch");
    const generic = path.join(root, "generic"); fs.mkdirSync(generic);
    const unchanged = relocateSession(resumed, generic, () => []); sessions.push(unchanged);
    assert.equal(unchanged.config.worktreeReturn, root);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(fs.existsSync(path.join(root, ".agent", "worktrees.json.lock")), false);
  } finally {
    for (const session of sessions) session.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("invalid, nested, disabled, unowned, tampered, foreign and cancelled resolutions preserve checkouts", async () => {
  const root = repository(); const signal = new AbortController().signal;
  try {
    const config = defaultConfig(root, []);
    await assert.rejects(resolveWorktreeEntry({ ...config, worktreeReturn: root }, "nested", signal), /Exit the active/);
    await assert.rejects(resolveWorktreeEntry({ ...config, features: { tasks: false, subagents: false, worktrees: false } }, "disabled", signal), /disabled/);
    for (const name of ["", "../escape", "a/b", "name.lock", "-flag"]) {
      await assert.rejects(resolveWorktreeEntry(config, name, signal), /valid worktree name/);
    }
    assert.equal(fs.existsSync(path.join(root, WORKTREE_DIRECTORY)), false);
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(resolveWorktreeEntry(config, "cancelled", aborted.signal), { name: "AbortError" });
    assert.equal(getEventListeners(aborted.signal, "abort").length, 0);
    assert.equal(git(root, "branch", "--list", "harness/cancelled"), "");
    const entry = await resolveWorktreeEntry(config, "owned", signal);
    const active = { ...config, workspace: entry.path, worktreeReturn: root };
    await assert.rejects(resolveWorktreeExit(config, signal), /no active/);
    await assert.rejects(resolveWorktreeExit(active, aborted.signal), { name: "AbortError" });
    const foreign = path.join(root, "foreign"); fs.mkdirSync(foreign); git(foreign, "init", "--initial-branch=other");
    await assert.rejects(resolveWorktreeExit({ ...active, worktreeReturn: foreign }, signal), /absent/);
    await assert.rejects(resolveWorktreeExit({ ...active, worktreeReturn: path.join(root, "missing") }, signal), /ENOENT/);
    await assert.rejects(resolveWorktreeExit({ ...active, worktreeReturn: path.join(root, "file.txt") }, signal), /real directory/);
    const alias = path.join(root, "alias"); fs.symlinkSync(root, alias);
    await assert.rejects(resolveWorktreeExit({ ...active, worktreeReturn: alias }, signal), /real directory/);
    const external = path.join(root, WORKTREE_DIRECTORY, "external");
    git(root, "worktree", "add", "-b", "external", external);
    await assert.rejects(resolveWorktreeEntry(config, "external", signal), /already exists/);
    await assert.rejects(resolveWorktreeExit({ ...active, workspace: external }, signal), /verification failed/);
    git(entry.path, "checkout", "-b", "changed");
    await assert.rejects(resolveWorktreeEntry(config, "owned", signal), /verification failed/);
    await assert.rejects(resolveWorktreeExit(active, signal), /verification failed/);
    assert.equal(git(entry.path, "symbolic-ref", "--short", "HEAD"), "changed");
    assert.equal(fs.existsSync(external), true);
    assert.equal(fs.existsSync(entry.path), true);
    assert.match(git(root, "branch", "--list", "harness/owned"), /harness\/owned/);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    assert.equal(fs.existsSync(path.join(root, ".agent", "worktrees.json.lock")), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("exit removal archives unlocked journals, preserves dirty checkout on failure and removes only with explicit discard", async () => {
  const root = repository();
  try {
    const config = { ...defaultConfig(root, []), model: "fixture/worktree" }, entry = await resolveWorktreeEntry(config, "remove");
    const active = { ...config, workspace: entry.path, worktreeReturn: root };
    const session = Session.open(entry.path, { config: active });
    await assert.rejects(removeExitedWorktree(active), /still locked/);
    session.close();
    const before = fs.readFileSync(session.file);
    fs.writeFileSync(path.join(entry.path, "dirty.txt"), "keep");
    await assert.rejects(removeExitedWorktree(active), /dirty files/);
    assert.deepEqual(fs.readFileSync(session.file), before);
    assert.equal(fs.readFileSync(path.join(entry.path, "dirty.txt"), "utf8"), "keep");
    git(entry.path, "add", "dirty.txt"); git(entry.path, "commit", "-m", "Disposable unmerged fixture");
    await assert.rejects(removeExitedWorktree(active), /unmerged commits/);
    assert.deepEqual(fs.readFileSync(session.file), before);
    const result = await removeExitedWorktree(active, true);
    assert.equal(result.branchDeleted, true); assert.equal(fs.existsSync(entry.path), false);
    assert.deepEqual(fs.readFileSync(path.join(result.archive!, path.basename(session.file))), before);
    assert.equal(git(root, "branch", "--list", "harness/remove"), "");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
