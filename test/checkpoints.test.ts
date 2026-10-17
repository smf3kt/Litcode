import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createCheckpointTools, recoverCheckpoint } from "../src/checkpoints.js";
import type { ToolContext } from "../src/tools.js";

const tools = new Map(createCheckpointTools().map(tool => [tool.schema.name, tool]));
const temporary: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-checkpoints-")));
  temporary.push(root);
  return root;
}
after(() => { for (const root of temporary) fs.rmSync(root, { recursive: true, force: true }); });
function context(root: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspace: root, allowShell: false, signal: new AbortController().signal, maxOutputBytes: 100_000, ...overrides };
}
async function run(name: string, input: unknown, root: string, overrides: Partial<ToolContext> = {}): Promise<any> {
  return JSON.parse(await tools.get(name)!.execute(input, context(root, overrides)));
}
function write(root: string, relative: string, bytes: string | Buffer): void {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), bytes);
}
function read(root: string, relative: string): string { return fs.readFileSync(path.join(root, relative), "utf8"); }
function manifestPath(root: string, name = "base"): string { return path.join(root, ".agent/checkpoints/manifests", `${name}.json`); }
async function diff(root: string, name = "base"): Promise<any> { return run("checkpoint_diff", { name }, root); }
async function restore(root: string, options: Record<string, unknown> = {}): Promise<any> {
  const preview = await diff(root);
  return run("checkpoint_restore", { name: "base", expected_current_digest: preview.current_digest, dry_run: false, ...options }, root);
}
function digest(entries: unknown[]): string { return crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex"); }
function stagingTag(root: string): string {
  return crypto.createHash("sha256").update(path.join(root, ".agent/checkpoints")).digest("hex").slice(0, 12);
}

test("checkpoint tools expose permission metadata and restore confirmation contract", () => {
  assert.deepEqual([...tools.keys()], ["checkpoint_create", "checkpoint_list", "checkpoint_diff", "checkpoint_restore"]);
  assert.equal(tools.get("checkpoint_create")!.readOnly, false);
  assert.equal(tools.get("checkpoint_restore")!.readOnly, false);
  assert.equal(tools.get("checkpoint_list")!.readOnly, true);
  assert.equal(tools.get("checkpoint_diff")!.readOnly, true);
  assert.deepEqual(tools.get("checkpoint_restore")!.schema.input_schema.required, ["name", "expected_current_digest"]);
});

test("checkpoint snapshots hidden files and .harness, excluding reserved trees and symlink contents", async () => {
  const root = workspace();
  write(root, ".hidden", "hidden");
  write(root, ".harness/settings.json", "settings");
  write(root, ".harness/memory/note.md", "remember");
  write(root, ".harness-worktrees/worker/large", Buffer.alloc(3 * 1024 * 1024));
  write(root, "src/a.txt", "old");
  write(root, ".agent/sessions/session.json", "history");
  write(root, ".git/config", "git");
  write(root, "node_modules/large", Buffer.alloc(3 * 1024 * 1024));
  const outside = workspace();
  write(outside, "secret", "outside");
  fs.symlinkSync(outside, path.join(root, "link"));
  fs.chmodSync(path.join(root, "src/a.txt"), 0o751);
  const created = await run("checkpoint_create", { name: "base" }, root);
  assert.equal(created.files, 4);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), "utf8"));
  assert.deepEqual(manifest.entries.map((entry: any) => entry.path), [".harness", ".harness/memory", ".harness/memory/note.md", ".harness/settings.json", ".hidden", "link", "src", "src/a.txt"]);
  assert.equal(manifest.entries.find((entry: any) => entry.path === "link").target, outside);
  assert.equal(manifest.entries.find((entry: any) => entry.path === "src/a.txt").mode, 0o751);
  assert.equal(manifest.digest, digest(manifest.entries));
  assert.equal((await diff(root)).equal, true);
  const listed = await run("checkpoint_list", {}, root);
  assert.equal(listed.checkpoints[0].name, "base");
  assert.equal(read(root, ".agent/sessions/session.json"), "history");
  assert.equal(read(outside, "secret"), "outside");
});

test("incremental checkpoints survive new tool instances and restore modified/deleted bytes and modes", async () => {
  const root = workspace();
  write(root, "a.txt", "original");
  write(root, "nested/b.bin", Buffer.from([0, 255, 1]));
  fs.chmodSync(path.join(root, "a.txt"), 0o711);
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a.txt", "edited");
  fs.chmodSync(path.join(root, "a.txt"), 0o600);
  fs.rmSync(path.join(root, "nested"), { recursive: true });
  write(root, "new.txt", "keep new");
  await run("checkpoint_create", { name: "second" }, root);
  const secondTools = createCheckpointTools();
  const listed = JSON.parse(await secondTools.find(tool => tool.schema.name === "checkpoint_list")!.execute({}, context(root)));
  assert.equal(listed.total, 2);
  const delta = await diff(root);
  assert.deepEqual(delta.changes.map((entry: any) => [entry.path, entry.status]), [["a.txt", "modified"], ["nested", "deleted"], ["nested/b.bin", "deleted"], ["new.txt", "added"]]);
  const preview = await run("checkpoint_restore", { name: "base", expected_current_digest: delta.current_digest }, root);
  assert.equal(preview.dry_run, true);
  assert.equal(read(root, "a.txt"), "edited");
  assert.equal(fs.existsSync(path.join(root, "nested")), false);
  await restore(root);
  assert.equal(read(root, "a.txt"), "original");
  assert.deepEqual(fs.readFileSync(path.join(root, "nested/b.bin")), Buffer.from([0, 255, 1]));
  assert.equal(fs.statSync(path.join(root, "a.txt")).mode & 0o7777, 0o711);
  assert.equal(read(root, "new.txt"), "keep new");
  await restore(root, { remove_new: true, paths: ["new.txt"] });
  assert.equal(fs.existsSync(path.join(root, "new.txt")), false);
  assert.equal((await diff(root)).equal, true);
});

test("selected paths scope effects and removal requires explicit diff paths", async () => {
  const root = workspace();
  write(root, "a", "A");
  write(root, "b", "B");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A");
  write(root, "b", "changed B");
  write(root, "new", "new");
  await assert.rejects(restore(root, { remove_new: true }), /explicitly enumerated/);
  await assert.rejects(restore(root, { paths: ["new"] }), /absent from checkpoint/);
  await restore(root, { paths: ["a"] });
  assert.equal(read(root, "a"), "A");
  assert.equal(read(root, "b"), "changed B");
  assert.equal(read(root, "new"), "new");
});

test("stale digest catches unrelated changes and permissions before restore effects", async () => {
  const root = workspace();
  write(root, "a", "A");
  write(root, "b", "B");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed");
  const first = await diff(root);
  fs.chmodSync(path.join(root, "b"), 0o711);
  await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: first.current_digest, dry_run: false }, root), /workspace changed since diff/);
  assert.equal(read(root, "a"), "changed");
  await assert.rejects(run("checkpoint_restore", { name: "base", dry_run: false }, root));
});

test("corrupt manifest and content are checked in full even for a selected good file", async () => {
  const root = workspace();
  write(root, "a", "A");
  write(root, "z", "Z");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed");
  const current = await diff(root);
  const target = manifestPath(root);
  const original = fs.readFileSync(target);
  const manifest = JSON.parse(original.toString());
  manifest.digest = "0".repeat(64);
  fs.writeFileSync(target, JSON.stringify(manifest));
  const args = { name: "base", expected_current_digest: current.current_digest, dry_run: false, paths: ["a"] };
  await assert.rejects(run("checkpoint_restore", args, root), /manifest identity or digest mismatch/);
  assert.equal(read(root, "a"), "changed");
  fs.writeFileSync(target, original);
  const good = JSON.parse(original.toString());
  const zFile = good.entries.find((entry: any) => entry.path === "z");
  fs.writeFileSync(path.join(root, ".agent/checkpoints/objects", zFile.sha256), "corrupted");
  await assert.rejects(run("checkpoint_restore", args, root), /content digest mismatch/);
  assert.equal(read(root, "a"), "changed");
  assert.equal(fs.existsSync(path.join(root, ".agent/checkpoints/lock")), false);
});

test("structurally invalid rehashed manifests reject traversal and symlink parents", async () => {
  const root = workspace();
  write(root, "a", "A");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed");
  const current = await diff(root);
  const manifest = JSON.parse(fs.readFileSync(manifestPath(root), "utf8"));
  manifest.entries[0].path = "../outside";
  manifest.digest = digest(manifest.entries);
  fs.writeFileSync(manifestPath(root), JSON.stringify(manifest));
  await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }, root), /Invalid or reserved/);
  assert.equal(read(root, "a"), "changed");
});

test("metadata symlinks at .agent, checkpoint directories, manifest and objects are rejected", async () => {
  const root = workspace();
  const outside = workspace();
  write(root, "a", "A");
  fs.symlinkSync(outside, path.join(root, ".agent"));
  await assert.rejects(run("checkpoint_create", { name: "base" }, root), /metadata directory/);
  await assert.rejects(run("checkpoint_list", {}, root), /metadata directory/);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(path.join(root, ".agent"));
  await run("checkpoint_create", { name: "base" }, root);
  const target = manifestPath(root);
  const original = fs.readFileSync(target);
  write(outside, "manifest", original);
  fs.unlinkSync(target);
  fs.symlinkSync(path.join(outside, "manifest"), target);
  await assert.rejects(diff(root), /not regular/);
  fs.unlinkSync(target);
  fs.writeFileSync(target, original);
  const manifest = JSON.parse(original.toString());
  const object = path.join(root, ".agent/checkpoints/objects", manifest.entries[0].sha256);
  write(outside, "object", "A");
  fs.unlinkSync(object);
  fs.symlinkSync(path.join(outside, "object"), object);
  await assert.rejects(diff(root), /not regular/);
  fs.unlinkSync(object);
  fs.writeFileSync(object, "A");
  fs.renameSync(path.join(root, ".agent/checkpoints/objects"), path.join(root, ".agent/checkpoints/objects-original"));
  fs.symlinkSync(path.join(root, ".agent/checkpoints/objects-original"), path.join(root, ".agent/checkpoints/objects"));
  await assert.rejects(diff(root), /metadata directory/);
});

test("restore never follows leaf/ancestor symlinks or replaces captured symlink metadata", async () => {
  const root = workspace();
  const outside = workspace();
  write(root, "a", "A");
  write(root, "dir/b", "B");
  fs.symlinkSync("a", path.join(root, "link"));
  await run("checkpoint_create", { name: "base" }, root);
  write(outside, "file", "outside");
  fs.unlinkSync(path.join(root, "a"));
  fs.symlinkSync(path.join(outside, "file"), path.join(root, "a"));
  await assert.rejects(restore(root), /Symlink checkpoint path/);
  assert.equal(read(outside, "file"), "outside");
  fs.unlinkSync(path.join(root, "a"));
  write(root, "a", "changed");
  fs.rmSync(path.join(root, "dir"), { recursive: true });
  fs.symlinkSync(outside, path.join(root, "dir"));
  await assert.rejects(restore(root), /Symlink checkpoint path/);
  assert.equal(read(root, "a"), "changed");
  await assert.rejects(restore(root, { paths: ["link"] }), /Symlink checkpoint path/);
  assert.equal(fs.readlinkSync(path.join(root, "link")), "a");
});

test("invalid names and paths produce no workspace effects", async () => {
  const root = workspace();
  write(root, "a", "A");
  for (const name of ["../base", "a/b", "", "/base", "a.json", "base\\other"]) await assert.rejects(run("checkpoint_create", { name }, root));
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed");
  for (const selected of ["../a", "/a", ".agent/sessions", "x/../a", ".git/config", "node_modules/x", "a\\b", "a:a", "./a", "a/"]) await assert.rejects(restore(root, { paths: [selected], remove_new: true }), /Invalid or reserved/);
  await assert.rejects(restore(root, { paths: ["a", "a"] }), /Duplicate/);
  assert.equal(read(root, "a"), "changed");
});

test("pre-aborted tools leave checkpoint storage and workspace untouched", async () => {
  const root = workspace();
  write(root, "a", "A");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(run("checkpoint_create", { name: "base" }, root, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fs.existsSync(path.join(root, ".agent")), false);
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed");
  const current = await diff(root);
  for (const [name, args] of [["checkpoint_list", {}], ["checkpoint_diff", { name: "base" }], ["checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }]] as const) await assert.rejects(run(name, args, root, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(read(root, "a"), "changed");
  assert.equal(fs.existsSync(path.join(root, ".agent/checkpoints/lock")), false);
});

test("snapshot byte/count caps fail before checkpoint publication", async () => {
  const oversized = workspace();
  write(oversized, "large", Buffer.alloc(2 * 1024 * 1024 + 1));
  await assert.rejects(run("checkpoint_create", { name: "base" }, oversized), /byte cap/);
  assert.equal(fs.existsSync(path.join(oversized, ".agent")), false);
  const total = workspace();
  for (let i = 0; i < 17; i++) write(total, `file-${i}`, Buffer.alloc(2 * 1024 * 1024, i));
  await assert.rejects(run("checkpoint_create", { name: "base" }, total), /byte cap/);
  assert.equal(fs.existsSync(path.join(total, ".agent")), false);
  const count = workspace();
  for (let i = 0; i < 2001; i++) write(count, `file-${i}`, "");
  await assert.rejects(run("checkpoint_create", { name: "base" }, count), /entry count/);
  assert.equal(fs.existsSync(path.join(count, ".agent")), false);
});

test("exclusive locks and duplicate checkpoint names preserve existing snapshots", async () => {
  const root = workspace();
  write(root, "a", "A");
  await run("checkpoint_create", { name: "base" }, root);
  const original = fs.readFileSync(manifestPath(root));
  write(root, "a", "changed");
  await assert.rejects(run("checkpoint_create", { name: "base" }, root), /already exists/);
  assert.deepEqual(fs.readFileSync(manifestPath(root)), original);
  write(root, ".agent/checkpoints/lock", "held");
  await assert.rejects(restore(root), /EEXIST/);
  assert.equal(read(root, "a"), "changed");
  assert.equal(read(root, ".agent/checkpoints/lock"), "held");
});

test("a later filesystem failure rolls back earlier writes and newly created directories", async () => {
  const root = workspace();
  write(root, "a", "A");
  write(root, "nested/b", "B");
  write(root, "z", "Z");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A");
  write(root, "z", "changed Z");
  fs.rmSync(path.join(root, "nested"), { recursive: true });
  const current = await diff(root);
  const rename = fs.renameSync;
  let failed = false;
  fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if (String(to) === path.join(root, "z") && !failed) {
      failed = true;
      throw new Error("injected rename failure");
    }
    return rename(from, to);
  }) as typeof fs.renameSync;
  try {
    await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }, root), /injected rename failure/);
  } finally { fs.renameSync = rename; }
  assert.equal(read(root, "a"), "changed A");
  assert.equal(read(root, "z"), "changed Z");
  assert.equal(fs.existsSync(path.join(root, "nested")), false);
  assert.equal(fs.existsSync(path.join(root, ".agent/checkpoints/lock")), false);
  assert.equal((await diff(root)).current_digest, current.current_digest);
  assert.equal(fs.readdirSync(root).some(file => file.endsWith(".tmp")), false);
});

test("mid-restore cancellation rolls back committed bytes and explicit removals", async () => {
  const root = workspace();
  write(root, "a", "A");
  write(root, "z", "Z");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A");
  write(root, "new", "new bytes");
  write(root, "z", "changed Z");
  const current = await diff(root);
  const controller = new AbortController();
  const unlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    const result = unlink(target);
    if (String(target) === path.join(root, "new")) controller.abort();
    return result;
  }) as typeof fs.unlinkSync;
  try {
    await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false, remove_new: true, paths: ["a", "new", "z"] }, root, { signal: controller.signal }), { name: "AbortError" });
  } finally { fs.unlinkSync = unlink; }
  assert.equal(read(root, "a"), "changed A");
  assert.equal(read(root, "new"), "new bytes");
  assert.equal(read(root, "z"), "changed Z");
  assert.equal((await diff(root)).current_digest, current.current_digest);
});

test("a target edit during atomic staging survives the conflict and earlier effects roll back", async () => {
  for (const external of ["concurrent Z", "Z"]) {
  const root = workspace();
  write(root, "a", "A");
  write(root, "z", "Z");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A");
  write(root, "z", "changed Z");
  const current = await diff(root);
  const sync = fs.fsyncSync;
  let injected = false;
  fs.fsyncSync = ((fd: number) => {
    sync(fd);
    // Target the staged Z bytes, independent of journal/lock fsync counts.
    const stat = fs.fstatSync(fd);
    if (!injected && stat.isFile() && stat.size === 1 && read(root, "a") === "A") {
      injected = true;
      write(root, "z", external);
    }
  }) as typeof fs.fsyncSync;
  try {
    await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }, root), /conflict/);
  } finally { fs.fsyncSync = sync; }
  assert.equal(read(root, "a"), "changed A");
  assert.equal(injected, true);
  assert.equal(read(root, "z"), external);
  assert.equal(fs.existsSync(path.join(root, ".agent/checkpoints/transaction.json")), true);
  if (external !== "Z") assert.throws(() => recoverCheckpoint(context(root)), /conflict/);
  assert.equal(read(root, "a"), "changed A");
  assert.equal(fs.readdirSync(root).some(file => file.endsWith(".tmp")), false);
  }
});

test("recovery preserves active and invalid lock owners and validates legacy PID locks", async () => {
  const root = workspace(); write(root, "a", "A");
  await run("checkpoint_create", { name: "base" }, root);
  const target = path.join(root, ".agent/checkpoints/lock");
  const active = JSON.stringify({ pid: process.pid, token: crypto.randomUUID() });
  fs.writeFileSync(target, active);
  assert.throws(() => recoverCheckpoint(context(root)), /owner is active/);
  assert.equal(read(root, ".agent/checkpoints/lock"), active);
  fs.writeFileSync(target, `${process.pid}\n`);
  assert.throws(() => recoverCheckpoint(context(root)), /owner is active/);
  assert.equal(read(root, ".agent/checkpoints/lock"), `${process.pid}\n`);
  fs.writeFileSync(target, "partial JSON {");
  assert.throws(() => recoverCheckpoint(context(root)), /owner is invalid/);
  assert.equal(read(root, ".agent/checkpoints/lock"), "partial JSON {");
  assert.equal(fs.existsSync(`${target}.recovery`), false);
});

test("mkdir before inode publication preserves an explicit ownership residual", async () => {
  const root = workspace(); write(root, "a", "A"); write(root, "nested/b", "B");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A"); fs.rmSync(path.join(root, "nested"), { recursive: true });
  const current = await diff(root), mkdir = fs.mkdirSync;
  fs.mkdirSync = ((target: fs.PathLike, ...args: any[]) => {
    const result = (mkdir as any)(target, ...args);
    if (String(target) === path.join(root, "nested")) throw new Error("injected after mkdir");
    return result;
  }) as typeof fs.mkdirSync;
  try { await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }, root), /ownership is unknown/); }
  finally { fs.mkdirSync = mkdir; }
  const pending = path.join(root, ".agent/checkpoints/transaction.json");
  const bytes = fs.readFileSync(pending);
  assert.equal(JSON.parse(bytes.toString()).directories[0].inode, null);
  assert.throws(() => recoverCheckpoint(context(root)), /ownership is unknown/);
  assert.deepEqual(fs.readFileSync(pending), bytes);
  assert.equal(read(root, "a"), "A");
  assert.deepEqual(fs.readdirSync(path.join(root, "nested")), []);
});

test("diff/list outputs paginate and cap JSON while retaining digest confirmation", async () => {
  const root = workspace();
  for (let i = 0; i < 12; i++) write(root, `file-${i}`, "original");
  await run("checkpoint_create", { name: "base" }, root);
  for (let i = 0; i < 12; i++) write(root, `file-${i}`, "changed");
  const first = await run("checkpoint_diff", { name: "base", offset: 0, limit: 2 }, root);
  assert.equal(first.total, 12);
  assert.equal(first.changes.length, 2);
  assert.equal(first.next_offset, 2);
  const capped = await tools.get("checkpoint_diff")!.execute({ name: "base" }, context(root, { maxOutputBytes: 600 }));
  assert.ok(Buffer.byteLength(capped) <= 600);
  const parsed = JSON.parse(capped);
  assert.equal(parsed.current_digest, first.current_digest);
  assert.equal(parsed.checkpoint_digest, first.checkpoint_digest);
  assert.equal(parsed.truncated, true);
});

test("recovery removes this store's staging files and keeps foreign, legacy and linked ones", async () => {
  const root = workspace(); write(root, "a", "A");
  await run("checkpoint_create", { name: "base" }, root);
  const objects = path.join(root, ".agent/checkpoints/objects"), tag = stagingTag(root);
  const owned = path.join(objects, `.checkpoint-${tag}-${crypto.randomUUID()}.tmp`);
  const foreign = path.join(objects, `.checkpoint-${"0".repeat(12)}-${crypto.randomUUID()}.tmp`);
  const legacy = path.join(objects, `.checkpoint-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(owned, "orphan"); fs.writeFileSync(foreign, "foreign"); fs.writeFileSync(legacy, "legacy");
  const outside = path.join(root, "outside"); fs.writeFileSync(outside, "keep");
  const link = path.join(objects, `.checkpoint-${tag}-${crypto.randomUUID()}.tmp`);
  fs.symlinkSync(outside, link);
  assert.deepEqual(recoverCheckpoint(context(root)), { recovery: "none" });
  assert.equal(fs.existsSync(owned), false);
  assert.equal(fs.readFileSync(foreign, "utf8"), "foreign");
  assert.equal(fs.readFileSync(legacy, "utf8"), "legacy");
  assert.equal(fs.readFileSync(outside, "utf8"), "keep");
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
});

test("a pending transaction sweeps staging files from its target directories", async () => {
  const root = workspace(); write(root, "a", "A"); write(root, "nested/b", "B");
  await run("checkpoint_create", { name: "base" }, root);
  write(root, "a", "changed A"); fs.rmSync(path.join(root, "nested"), { recursive: true });
  const current = await diff(root), mkdir = fs.mkdirSync;
  fs.mkdirSync = ((target: fs.PathLike, ...args: any[]) => {
    const result = (mkdir as any)(target, ...args);
    if (String(target) === path.join(root, "nested")) throw new Error("injected after mkdir");
    return result;
  }) as typeof fs.mkdirSync;
  try { await assert.rejects(run("checkpoint_restore", { name: "base", expected_current_digest: current.current_digest, dry_run: false }, root), /ownership is unknown/); }
  finally { fs.mkdirSync = mkdir; }
  // The crashed restore left staging beside its target; recovery keeps the transaction but removes
  // the file because its name carries this store's tag.
  const temporary = path.join(root, "nested", `.checkpoint-${stagingTag(root)}-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temporary, "orphan");
  assert.throws(() => recoverCheckpoint(context(root)), /ownership is unknown/);
  assert.equal(fs.existsSync(temporary), false);
  assert.equal(fs.existsSync(path.join(root, ".agent/checkpoints/transaction.json")), true);
});
