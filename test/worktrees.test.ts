import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createWorktreeTools, WorktreeManager, WORKTREE_DIRECTORY } from "../src/worktrees.js";
import type { ToolContext } from "../src/tools.js";

const directories: string[] = [];
const managers: WorktreeManager[] = [];
const fixtureEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.test" };
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-worktrees-")));
  directories.push(dir);
  return dir;
}
function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root, env: fixtureEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000,
  }).trimEnd();
}
function repository(branch = "main"): string {
  const root = temp();
  git(root, "init", `--initial-branch=${branch}`);
  git(root, "config", "user.name", "Fixture");
  git(root, "config", "user.email", "fixture@example.test");
  fs.writeFileSync(path.join(root, "file.txt"), "baseline\n");
  fs.writeFileSync(path.join(root, ".gitignore"), "ignored.txt\n");
  git(root, "add", "file.txt", ".gitignore");
  git(root, "commit", "-m", "Synthetic fixture baseline");
  return root;
}
function manager(root: string, options: Partial<ConstructorParameters<typeof WorktreeManager>[0]> = {}): WorktreeManager {
  const instance = new WorktreeManager({ workspace: root, ...options });
  managers.push(instance);
  return instance;
}
function context(workspace: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000, ...overrides };
}
function tree(root: string, name: string): string { return path.join(root, WORKTREE_DIRECTORY, name); }
function state(root: string): { records: Array<Record<string, unknown>> } {
  return JSON.parse(fs.readFileSync(path.join(root, ".agent", "worktrees.json"), "utf8"));
}
after(async () => {
  await Promise.all(managers.map((instance) => instance.close()));
  for (const dir of directories) fs.rmSync(dir, { recursive: true, force: true });
});

test("factory exposes exactly create/list/remove tools with strict schemas", async () => {
  const root = repository();
  const instance = manager(root);
  const tools = createWorktreeTools(instance);
  assert.deepEqual(tools.map((tool) => tool.schema.name), ["worktree_create", "worktree_list", "worktree_remove"]);
  assert.deepEqual(tools.map((tool) => tool.readOnly), [false, true, false]);
  const [create, list, remove] = tools;
  const output = JSON.parse(await create!.execute({ name: "feature" }, context(root)));
  assert.equal(output.path, tree(root, "feature"));
  assert.equal(output.branch, "refs/heads/harness/feature");
  assert.equal(output.owned, true);
  const listed = JSON.parse(await list!.execute({}, context(root)));
  assert.equal(listed.find((item: { owned: boolean }) => item.owned).path, output.path);
  await assert.rejects(list!.execute({ stray: true }, context(root)), /Unrecognized key/);
  await remove!.execute({ name: "feature" }, context(root));
  assert.equal(fs.existsSync(output.path), false);
  assert.equal(git(root, "branch", "--list", "harness/feature"), "");
  assert.deepEqual(state(root).records, []);
});

test("no-argument factory binds lazily and isolates multiple workspaces", async () => {
  const a = repository(); const b = repository();
  const tools = createWorktreeTools();
  await tools[0]!.execute({ name: "same" }, context(a));
  await tools[0]!.execute({ name: "same" }, context(b));
  await tools[2]!.execute({ name: "same", delete_branch: false }, context(a));
  assert.ok(fs.existsSync(tree(b, "same")));
  assert.match(git(a, "branch", "--list", "harness/same"), /harness\/same/);
  await tools[2]!.execute({ name: "same" }, context(b));
});

test("list is read-only and preserves unusual external paths", async () => {
  const root = repository();
  const outside = path.join(temp(), "external\nwith space");
  git(root, "worktree", "add", "-b", "external", outside);
  const entries = await manager(root).list();
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => !entry.owned));
  assert.equal(entries.find((entry) => entry.branch === "refs/heads/external")!.path, outside);
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
  assert.equal(fs.existsSync(path.join(root, WORKTREE_DIRECTORY)), false);
});

test("durable ownership survives close/reopen; close preserves worktrees", async () => {
  const root = repository();
  const first = manager(root);
  const created = await first.create({ name: "durable" });
  await first.close();
  assert.ok(fs.existsSync(created.path));
  assert.equal(git(created.path, "rev-parse", "HEAD"), created.head);
  await assert.rejects(first.list(), /closed/);
  const reopened = manager(root);
  assert.equal((await reopened.list()).find((entry) => entry.path === created.path)!.owned, true);
  await reopened.remove({ name: "durable" });
});

test("creates from HEAD on any default branch and supports explicit manager/input base refs", async () => {
  const root = repository("trunk");
  git(root, "branch", "baseline");
  const baseline = git(root, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(root, "file.txt"), "next commit\n");
  git(root, "add", "file.txt"); git(root, "commit", "-m", "Synthetic next commit");
  const latest = git(root, "rev-parse", "HEAD");
  const instance = manager(root);
  assert.equal((await instance.create({ name: "head" })).head, latest);
  assert.equal((await instance.create({ name: "base", branch: "topic/nested", base_ref: "baseline" })).head, baseline);
  assert.equal((await manager(root, { baseRef: "baseline" }).create({ name: "defaultbase" })).head, baseline);
  await instance.remove({ name: "head" });
  await instance.remove({ name: "base" });
  await instance.remove({ name: "defaultbase" });
  assert.equal(git(root, "symbolic-ref", "--short", "HEAD"), "trunk");
});

test("source worktree dirty state and existing branches remain unchanged", async () => {
  const root = repository();
  fs.writeFileSync(path.join(root, "file.txt"), "user edit\n");
  fs.writeFileSync(path.join(root, "user.txt"), "untracked\n");
  git(root, "branch", "existing");
  const instance = manager(root);
  await assert.rejects(instance.create({ name: "existing", branch: "existing" }), /branch already exists/);
  await instance.create({ name: "isolated" });
  await instance.remove({ name: "isolated" });
  assert.equal(fs.readFileSync(path.join(root, "file.txt"), "utf8"), "user edit\n");
  assert.equal(fs.readFileSync(path.join(root, "user.txt"), "utf8"), "untracked\n");
  assert.match(git(root, "branch", "--list", "existing"), /existing/);
});

test("tracked and untracked dirty files require explicit discard", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "dirty" });
  fs.writeFileSync(path.join(tree(root, "dirty"), "file.txt"), "local changes\n");
  fs.writeFileSync(path.join(tree(root, "dirty"), "extra.txt"), "untracked\n");
  await assert.rejects(instance.remove({ name: "dirty", discard_changes: false }), /dirty files.*discard_changes/);
  assert.equal(fs.readFileSync(path.join(tree(root, "dirty"), "extra.txt"), "utf8"), "untracked\n");
  assert.equal(state(root).records[0]!.state, "ready");
  await instance.remove({ name: "dirty", discard_changes: true });
  assert.equal(fs.existsSync(tree(root, "dirty")), false);
});

test("ignored files require discard as well", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "ignored" });
  fs.writeFileSync(path.join(tree(root, "ignored"), "ignored.txt"), "user data\n");
  await assert.rejects(instance.remove({ name: "ignored" }), /dirty files.*discard_changes/);
  await instance.remove({ name: "ignored", discard_changes: true });
});

test("unmerged commits require discard even on a clean worktree", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "unmerged" });
  const target = tree(root, "unmerged");
  fs.writeFileSync(path.join(target, "new.txt"), "work\n");
  git(target, "add", "new.txt"); git(target, "commit", "-m", "Synthetic unmerged work");
  await assert.rejects(instance.remove({ name: "unmerged" }), /unmerged commits.*discard_changes/);
  assert.equal(fs.existsSync(target), true);
  await instance.remove({ name: "unmerged", discard_changes: true });
  assert.equal(git(root, "branch", "--list", "harness/unmerged"), "");
});

test("merged commits permit normal removal", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "merged" });
  const target = tree(root, "merged");
  fs.writeFileSync(path.join(target, "new.txt"), "work\n");
  git(target, "add", "new.txt"); git(target, "commit", "-m", "Synthetic merged work");
  git(root, "merge", "--ff-only", "harness/merged");
  assert.equal((await instance.remove({ name: "merged" })).branchDeleted, true);
});

test("unowned worktree inside managed container is never removed", async () => {
  const root = repository(); const instance = manager(root);
  fs.mkdirSync(path.join(root, WORKTREE_DIRECTORY));
  git(root, "worktree", "add", "-b", "external", tree(root, "external"));
  await assert.rejects(instance.remove({ name: "external", discard_changes: true }), /not owned/);
  assert.ok(fs.existsSync(tree(root, "external")));
  assert.match(git(root, "branch", "--list", "external"), /external/);
});

test("branch mismatch, detached state, moved and locked worktrees fail ownership checks", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "changed" });
  git(tree(root, "changed"), "checkout", "-b", "other");
  const entry = (await instance.list()).find((item) => item.name === "changed")!;
  assert.equal(entry.owned, false);
  assert.match(entry.verificationError!, /branch identity/);
  await assert.rejects(instance.remove({ name: "changed", discard_changes: true }), /branch identity/);
  git(tree(root, "changed"), "checkout", "--detach");
  await assert.rejects(instance.remove({ name: "changed", discard_changes: true }), /branch identity/);
  git(tree(root, "changed"), "checkout", "harness/changed");
  git(root, "worktree", "lock", "--reason", "user lock", tree(root, "changed"));
  await assert.rejects(instance.remove({ name: "changed", discard_changes: true }), /locked/);
  git(root, "worktree", "unlock", tree(root, "changed"));
  const moved = path.join(root, WORKTREE_DIRECTORY, "moved");
  git(root, "worktree", "move", tree(root, "changed"), moved);
  await assert.rejects(instance.remove({ name: "changed", discard_changes: true }), /registration is missing/);
  assert.ok(fs.existsSync(moved));
});

test("swapped directory and gitdir backlink fail verification", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "swapped" });
  const target = tree(root, "swapped");
  fs.renameSync(target, target + "-old");
  fs.mkdirSync(target);
  fs.copyFileSync(path.join(target + "-old", ".git"), path.join(target, ".git"));
  await assert.rejects(instance.remove({ name: "swapped", discard_changes: true }), /directory identity changed/);
  fs.rmSync(target, { recursive: true }); fs.renameSync(target + "-old", target);
  const gitDir = String(state(root).records[0]!.gitDir);
  fs.writeFileSync(path.join(gitDir, "gitdir"), target + "-old/.git\n");
  await assert.rejects(instance.remove({ name: "swapped", discard_changes: true }), /backlink|registration is missing/);
  fs.writeFileSync(path.join(gitDir, "gitdir"), path.join(target, ".git") + "\n");
  await instance.remove({ name: "swapped" });
});

test("existing destinations, traversal names and invalid/expanded branches are rejected", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "existing" });
  await assert.rejects(instance.create({ name: "existing" }), /already owned/);
  for (const name of ["../escape", "a/b", ".", "..", "-option", "name.lock", "a\nname"]) {
    await assert.rejects(instance.create({ name }));
  }
  for (const branch of ["--force", "bad..branch", "branch~1", "@{-1}", "a b", "a\u0000b"]) {
    await assert.rejects(instance.create({ name: "invalid", branch }));
  }
  await assert.rejects(instance.create({ name: "missing", base_ref: "missing-ref" }), /failed/);
  await assert.rejects(instance.create({ name: "flag", base_ref: "--help" }));
  fs.mkdirSync(tree(root, "occupied"));
  await assert.rejects(instance.create({ name: "occupied" }), /already exists/);
  await instance.remove({ name: "existing" });
});

test("metadata, container, target and gitfile symlinks are rejected without following them", async () => {
  const outside = temp();
  for (const component of [".agent", WORKTREE_DIRECTORY]) {
    const root = repository(); const instance = manager(root);
    fs.symlinkSync(outside, path.join(root, component));
    await assert.rejects(instance.create({ name: "test" }), /symlink/);
    assert.deepEqual(fs.readdirSync(outside), []);
  }
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "owned" });
  fs.symlinkSync(outside, tree(root, "linked"));
  await assert.rejects(instance.create({ name: "linked" }), /symlink/);
  const file = path.join(root, ".agent", "worktrees.json");
  const backup = fs.readFileSync(file);
  fs.unlinkSync(file); fs.symlinkSync(path.join(outside, "store.json"), file);
  await assert.rejects(instance.list(), /symlink/);
  fs.unlinkSync(file); fs.writeFileSync(file, backup);
  const dotGit = path.join(tree(root, "owned"), ".git");
  const dotGitBackup = fs.readFileSync(dotGit);
  const linked = path.join(outside, "gitfile"); fs.writeFileSync(linked, dotGitBackup);
  fs.unlinkSync(dotGit); fs.symlinkSync(linked, dotGit);
  await assert.rejects(instance.remove({ name: "owned", discard_changes: true }), /symlink/);
  fs.unlinkSync(dotGit); fs.writeFileSync(dotGit, dotGitBackup);
  await instance.remove({ name: "owned" });
});

test("malformed/foreign metadata and concurrent ownership lock fail closed", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "one" });
  const file = path.join(root, ".agent", "worktrees.json");
  const backup = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, "{ invalid");
  await assert.rejects(instance.list());
  const foreign = JSON.parse(backup); foreign.commonDir = "/different/git";
  fs.writeFileSync(file, JSON.stringify(foreign));
  await assert.rejects(instance.remove({ name: "one", discard_changes: true }), /identity mismatch/);
  fs.writeFileSync(file, backup);
  fs.writeFileSync(file + ".lock", "another owner");
  await assert.rejects(instance.create({ name: "two" }), /locked/);
  await assert.rejects(instance.remove({ name: "one" }), /locked/);
  assert.equal(fs.readFileSync(file + ".lock", "utf8"), "another owner");
  fs.unlinkSync(file + ".lock");
  await instance.remove({ name: "one" });
});

test("a store lock whose owner is dead is reclaimed; live and foreign locks stay", async () => {
  const root = repository(); const instance = manager(root);
  const file = path.join(root, ".agent", "worktrees.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const dead = spawnSync(process.execPath, ["-e", "0"]).pid;
  assert.ok(dead !== undefined && dead > 1);
  // The recovered sweep releases a lock whose reason names a dead pid (P1t/Rze); the store lock
  // carries the same owner identity so a crash mid-operation does not wedge the next session.
  fs.writeFileSync(file + ".lock", `harness worktree store (pid ${dead})`);
  await instance.create({ name: "reclaimed" });
  assert.equal(fs.existsSync(file + ".lock"), false);
  await instance.remove({ name: "reclaimed" });
  // A live owner (this process) or a pid outside the ported integer bound fails closed.
  fs.writeFileSync(file + ".lock", `harness worktree store (pid ${process.pid})`);
  await assert.rejects(instance.create({ name: "live" }), /locked/);
  assert.match(fs.readFileSync(file + ".lock", "utf8"), /harness worktree store/);
  fs.unlinkSync(file + ".lock");
  fs.writeFileSync(file + ".lock", "harness worktree store (pid 4000000000)");
  await assert.rejects(instance.create({ name: "range" }), /locked/);
  fs.unlinkSync(file + ".lock");
  await instance.close();
});

test("a creating record whose Git work landed is adopted and removable", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "adopt" });
  const file = path.join(root, ".agent", "worktrees.json");
  const store = JSON.parse(fs.readFileSync(file, "utf8"));
  store.records[0].state = "creating"; store.records[0].gitDir = null;
  fs.writeFileSync(file, JSON.stringify(store));
  // A crash after `git worktree add` but before the final save leaves this shape; the next locked
  // operation verifies the registration and restores the ready state instead of wedging the name.
  await assert.rejects(instance.create({ name: "adopt" }), /already owned/);
  assert.equal(state(root).records[0]!.state, "ready");
  await instance.remove({ name: "adopt" });
});

test("a creating reservation whose Git work never landed is reclaimed", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "seed" });
  const file = path.join(root, ".agent", "worktrees.json");
  const store = JSON.parse(fs.readFileSync(file, "utf8"));
  const ghost = tree(root, "ghost");
  fs.mkdirSync(ghost, { mode: 0o700 });
  const stat = fs.lstatSync(ghost);
  store.records.push({ ...store.records[0], name: "ghost", branch: "refs/heads/harness/ghost",
    directory: { dev: stat.dev, ino: stat.ino }, gitDir: null, state: "creating" });
  fs.writeFileSync(file, JSON.stringify(store));
  await instance.create({ name: "ghost" });
  const records = state(root).records;
  assert.deepEqual(records.map((record) => record.name).sort(), ["ghost", "seed"]);
  assert.equal(records.find((record) => record.name === "ghost")!.state, "ready");
});

test("non-repository, subdirectory and unborn HEAD errors have no worktree side effects", async () => {
  const plain = temp();
  await assert.rejects(manager(plain).create({ name: "one" }), /failed/);
  assert.deepEqual(fs.readdirSync(plain), []);
  const root = repository(); const sub = path.join(root, "sub"); fs.mkdirSync(sub);
  await assert.rejects(manager(sub).list(), /repository root/);
  const unborn = temp(); git(unborn, "init", "--initial-branch=brand-new");
  await assert.rejects(manager(unborn).create({ name: "one" }), /failed/);
  assert.equal(fs.existsSync(path.join(unborn, ".agent")), false);
});

test("pre-aborted calls and lifetime signal create no directories or branches", async () => {
  const root = repository(); const controller = new AbortController(); controller.abort();
  const instance = manager(root);
  await assert.rejects(instance.create({ name: "cancelled" }, controller.signal), { name: "AbortError" });
  await assert.rejects(instance.list(controller.signal), { name: "AbortError" });
  await assert.rejects(instance.remove({ name: "cancelled" }, controller.signal), { name: "AbortError" });
  await assert.rejects(manager(root, { signal: controller.signal }).list(), { name: "AbortError" });
  const tools = createWorktreeTools();
  await assert.rejects(tools[0]!.execute({ name: "cancelled" }, context(root, { signal: controller.signal })), { name: "AbortError" });
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
  assert.equal(git(root, "branch", "--list", "harness/cancelled"), "");
});

test("tool output is capped and supplied manager rejects another workspace", async () => {
  const root = repository(); const tools = createWorktreeTools(manager(root));
  const output = await tools[1]!.execute({}, context(root, { maxOutputBytes: 80 }));
  assert.match(output, /truncated/);
  assert.ok(Buffer.byteLength(output) <= 80);
  await assert.rejects(tools[1]!.execute({}, context(repository())), /workspace mismatch/);
});

test("subprocess output budget errors terminate without metadata mutations", async () => {
  const root = repository();
  await assert.rejects(manager(root, { maxOutputBytes: 1 }).list(), /output exceeded/);
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
});

test("repository checkout and status filters never execute", async () => {
  const root = repository();
  fs.writeFileSync(path.join(root, ".gitattributes"), "file.txt filter=fixture\n");
  git(root, "add", ".gitattributes"); git(root, "commit", "-m", "Synthetic filter declaration");
  const marker = path.join(temp(), "filter-ran");
  const executable = path.join(temp(), "filter");
  fs.writeFileSync(executable, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); process.exit(1);\n`, { mode: 0o700 });
  git(root, "config", "filter.fixture.smudge", executable);
  git(root, "config", "filter.fixture.clean", executable);
  git(root, "config", "filter.fixture.process", executable);
  git(root, "config", "filter.fixture.required", "true");
  const instance = manager(root);
  await instance.create({ name: "filtered" });
  assert.equal(fs.readFileSync(path.join(tree(root, "filtered"), "file.txt"), "utf8"), "baseline\n");
  await instance.remove({ name: "filtered" });
  assert.equal(fs.existsSync(marker), false);
});

// Only authored fixtures run here. The shim exercises process lifetime and
// partial Git success without reaching network or host configuration.
const realGit = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();
async function withGitShim<T>(body: string, action: (bin: string) => Promise<T>): Promise<T> {
  const bin = temp();
  fs.writeFileSync(path.join(bin, "git"), `#!${process.execPath}\n${body}\n`, { mode: 0o700 });
  const original = process.env.PATH;
  process.env.PATH = bin;
  try { return await action(bin); }
  finally { if (original === undefined) delete process.env.PATH; else process.env.PATH = original; }
}
async function waitForFile(file: string): Promise<string> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file, "utf8");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`fixture failed to become ready: ${file}`);
}
async function assertExited(pid: number): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return; throw error; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`fixture process ${pid} remained alive`);
}

test("Git spawn errors and stderr overflow fail explicitly", async () => {
  const root = repository(); const empty = temp(); const original = process.env.PATH;
  process.env.PATH = empty;
  try { await assert.rejects(manager(root).list(), /failed to launch git/); }
  finally { process.env.PATH = original; }
  await withGitShim("process.stderr.write('x'.repeat(100000)); setInterval(() => {}, 1000);", async () => {
    await assert.rejects(manager(root, { maxOutputBytes: 100 }).list(), /output exceeded/);
  });
});

test("timeout, abort and close kill owned Git process groups including descendants", async () => {
  const root = repository();
  for (const kind of ["timeout", "abort", "close"] as const) {
    const ready = path.join(temp(), "ready");
    const script = `const {spawn} = require('node:child_process');
const fs = require('node:fs');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: ['ignore', process.stdout, process.stderr]});
fs.writeFileSync(${JSON.stringify(ready)}, JSON.stringify([process.pid, child.pid]));
setInterval(() => {}, 1000);`;
    await withGitShim(script, async () => {
      const instance = manager(root, { timeoutMs: kind === "timeout" ? 1500 : 5000 });
      const controller = new AbortController();
      const running = instance.list(controller.signal);
      const rejected = assert.rejects(running, kind === "timeout" ? /timed out/ : { name: "AbortError" });
      const pids: number[] = JSON.parse(await waitForFile(ready));
      if (kind === "abort") controller.abort();
      if (kind === "close") await instance.close();
      await rejected;
      for (const pid of pids) await assertExited(pid);
      await instance.close();
    });
  }
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
});

test("creation interrupted after Git registration keeps durable owned recovery state", async () => {
  const root = repository(); const instance = manager(root, { maxOutputBytes: 10_000 });
  await withGitShim(`const {execFileSync} = require('node:child_process');
const args = process.argv.slice(2);
const out = execFileSync(${JSON.stringify(realGit)}, args, {cwd: process.cwd(), env: process.env});
if (args.includes('add')) { process.stdout.write('x'.repeat(20000)); setInterval(() => {}, 1000); }
else process.stdout.write(out);`, async () => {
    await assert.rejects(instance.create({ name: "interrupted" }), /output exceeded/);
  });
  assert.equal(state(root).records[0]!.state, "creating");
  assert.equal(fs.existsSync(path.join(root, ".agent", "worktrees.json.lock")), false);
  const found = (await instance.list()).find((entry) => entry.name === "interrupted")!;
  assert.equal(found.owned, true);
  await instance.remove({ name: "interrupted" });
  assert.deepEqual(state(root).records, []);
});

test("removal failure after directory deletion resumes using recorded commit identity", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "retry" });
  const shim = `const {execFileSync} = require('node:child_process');
const args = process.argv.slice(2);
if (args.includes('update-ref')) { process.stderr.write('synthetic ref failure'); process.exit(1); }
process.stdout.write(execFileSync(${JSON.stringify(realGit)}, args, {cwd: process.cwd(), env: process.env}));`;
  await withGitShim(shim, async () => {
    await assert.rejects(instance.remove({ name: "retry" }), /synthetic ref failure/);
  });
  assert.equal(fs.existsSync(tree(root, "retry")), false);
  assert.equal(state(root).records[0]!.state, "removing");
  assert.equal((await instance.remove({ name: "retry" })).branchDeleted, true);
  assert.deepEqual(state(root).records, []);
});

test("a changed branch after partial removal is preserved unless ownership is released", async () => {
  const root = repository(); const instance = manager(root);
  await instance.create({ name: "changed-ref" });
  await withGitShim(`const {execFileSync} = require('node:child_process');
const args = process.argv.slice(2);
if (args.includes('update-ref')) process.exit(1);
process.stdout.write(execFileSync(${JSON.stringify(realGit)}, args, {cwd: process.cwd(), env: process.env}));`, async () => {
    await assert.rejects(instance.remove({ name: "changed-ref" }), /failed/);
  });
  fs.writeFileSync(path.join(root, "new.txt"), "source update\n");
  git(root, "add", "new.txt"); git(root, "commit", "-m", "Synthetic source update");
  git(root, "update-ref", "refs/heads/harness/changed-ref", "HEAD");
  await assert.rejects(instance.remove({ name: "changed-ref" }), /branch changed/);
  assert.equal(git(root, "rev-parse", "harness/changed-ref"), git(root, "rev-parse", "HEAD"));
  await instance.remove({ name: "changed-ref", delete_branch: false });
  assert.deepEqual(state(root).records, []);
  assert.match(git(root, "branch", "--list", "harness/changed-ref"), /harness\/changed-ref/);
});
