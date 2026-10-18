import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createPluginTools, discoverInstalledPluginComponents, discoverInstalledSkillDirectories, pluginConfigSchema, PLUGIN_LIMITS,
  type PluginConfig } from "../src/plugins.js";
import type { ToolContext } from "../src/tools.js";

const roots: string[] = [];
function root(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "local-plugin-test-")));
  roots.push(dir);
  return dir;
}
after(() => { for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true }); });
function put(dir: string, relative: string, bytes: string | Buffer): void {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
function packageAt(name = "sample", version = "1", skills = true): string {
  const dir = root();
  put(dir, "plugin.json", JSON.stringify({ name, version, description: "Independent fixture", ...(skills ? { skills: "skills" } : {}) }));
  put(dir, "data.bin", Buffer.from([0, 255, 10]));
  put(dir, "script.js", "throw new Error('fixture must remain inert');");
  if (skills) put(dir, "skills/example/SKILL.md", "---\nname: example\n---\nFixture skill.");
  return dir;
}
function context(workspace: string, extra: Partial<ToolContext> = {}): ToolContext {
  return { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000, ...extra };
}
async function run(workspace: string, name: string, input: unknown = {}, config: PluginConfig = { enabled: true }, extra: Partial<ToolContext> = {}): Promise<any> {
  const tool = createPluginTools(config).find(t => t.schema.name === name)!;
  return JSON.parse(await tool.execute(input, context(workspace, extra)));
}
const store = (workspace: string) => path.join(workspace, ".harness/plugins");
test('workflow paths use defaults only when absent and accumulate invalid custom diagnostics', async () => {
  const workspace = root();
  const declarations = [undefined, [], ['missing', '../escape', './custom.js'], 'custom.js'];
  for (const [i, workflows] of declarations.entries()) {
    const source = packageAt(`paths${i}`, '1', false);
    put(source, 'plugin.json', JSON.stringify({ name: `paths${i}`, version: '1', ...(workflows === undefined ? {} : { workflows }) }));
    put(source, 'workflows/default.js', 'inert');
    put(source, 'custom.js', 'inert');
    await run(workspace, 'plugin_install', { directory: source });
  }
  const [defaults, empty, mixed, custom] = discoverInstalledPluginComponents(workspace, { enabled: true });
  assert.equal(defaults!.workflowsPath, path.join(installed(workspace, 'paths0'), 'workflows'));
  assert.equal(empty!.workflowsPath, undefined);
  assert.equal(empty!.workflowsPaths, undefined);
  assert.equal(mixed!.workflowsPath, undefined);
  assert.deepEqual(mixed!.workflowsPaths, [path.join(installed(workspace, 'paths2'), 'custom.js')]);
  assert.deepEqual(mixed!.workflowProblems.map(error => error.type), ['path-not-found', 'path-traversal']);
  assert.deepEqual(custom!.workflowsPaths, [path.join(installed(workspace, 'paths3'), 'custom.js')]);
});
const installed = (workspace: string, name = "sample") => path.join(store(workspace), name);
const index = (workspace: string) => path.join(store(workspace), ".index.json");
function cleanTransactions(workspace: string): void {
  assert.deepEqual(fs.readdirSync(store(workspace)).filter(n => n === ".lock" || n.startsWith(".transaction-")), []);
}

test("plugin factory is explicitly gated and exposes local schemas and permissions", async () => {
  assert.deepEqual(createPluginTools(), []);
  assert.deepEqual(createPluginTools({ enabled: false }), []);
  assert.equal(pluginConfigSchema.parse({}).enabled, false);
  assert.throws(() => createPluginTools({ enabled: true, maxFiles: PLUGIN_LIMITS.files + 1 }));
  assert.throws(() => pluginConfigSchema.parse({ enabled: true, endpoint: "https://fixture.invalid" }));
  const tools = createPluginTools({ enabled: true });
  assert.deepEqual(tools.map(t => [t.schema.name, t.readOnly]), [
    ["plugin_list", true], ["plugin_install", false], ["plugin_update", false], ["plugin_remove", false],
  ]);
  assert.deepEqual(tools[2].schema.input_schema.required, ["name", "directory", "expected_digest"]);
  assert.deepEqual(tools[3].schema.input_schema.required, ["name", "expected_digest"]);
  const workspace = root();
  assert.deepEqual(discoverInstalledSkillDirectories(workspace), []);
  assert.deepEqual(discoverInstalledSkillDirectories(workspace, { enabled: true }), []);
  assert.equal((await run(workspace, "plugin_list")).total, 0);
  assert.equal(fs.existsSync(path.join(workspace, ".harness")), false);
});

test("local lifecycle persists digests, copies inert bytes, discovers skills, and survives factory recreation", async () => {
  const workspace = root();
  const source = packageAt();
  fs.chmodSync(path.join(source, "script.js"), 0o755);
  const created = await run(workspace, "plugin_install", { directory: source });
  assert.equal(created.status, "installed");
  assert.match(created.plugin.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(fs.readFileSync(path.join(installed(workspace), "data.bin")), Buffer.from([0, 255, 10]));
  assert.equal(fs.statSync(path.join(installed(workspace), "script.js")).mode & 0o777, 0o600);
  assert.equal(fs.statSync(installed(workspace)).mode & 0o777, 0o700);
  const before = await run(workspace, "plugin_list");
  assert.equal(before.total, 1);
  assert.equal(before.plugins[0].modified, false);
  assert.equal(before.plugins[0].current_digest, created.plugin.digest);
  assert.deepEqual(discoverInstalledSkillDirectories(workspace, { enabled: true }), [path.join(installed(workspace), "skills")]);
  const updated = await run(workspace, "plugin_update", { name: "sample", directory: packageAt("sample", "2"), expected_digest: created.plugin.digest });
  assert.equal(updated.status, "updated");
  assert.equal(updated.plugin.manifest.version, "2");
  assert.notEqual(updated.plugin.digest, created.plugin.digest);
  assert.notEqual(updated.index_digest, created.index_digest);
  const removed = await run(workspace, "plugin_remove", { name: "sample", expected_digest: updated.plugin.digest });
  assert.equal(removed.status, "removed");
  assert.equal(fs.existsSync(installed(workspace)), false);
  assert.equal((await run(workspace, "plugin_list")).total, 0);
  assert.deepEqual(discoverInstalledSkillDirectories(workspace, { enabled: true }), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, "plugin.json"), "utf8")).version, "1");
  cleanTransactions(workspace);
});

test("source digest is independent of supplied source directory and source permissions", async () => {
  const workspace = root();
  const source = packageAt();
  const first = await run(workspace, "plugin_install", { directory: source });
  fs.chmodSync(path.join(source, "data.bin"), 0o777);
  const other = root();
  const second = await run(other, "plugin_install", { directory: source });
  assert.equal(first.plugin.digest, second.plugin.digest);
  assert.equal(first.index_digest, second.index_digest);
});

test("relative sources and manifests without skills are accepted without adding discovery paths", async () => {
  const workspace = root();
  const source = packageAt("plain", "1", false);
  fs.cpSync(source, path.join(workspace, "source"), { recursive: true });
  const result = await run(workspace, "plugin_install", { directory: "source" });
  assert.equal(result.plugin.manifest.name, "plain");
  assert.deepEqual(discoverInstalledSkillDirectories(workspace, { enabled: true }), []);
});

test("stale digest, changed name, missing plugin, and invalid inputs preserve installed content", async () => {
  const workspace = root();
  const source = packageAt();
  const created = await run(workspace, "plugin_install", { directory: source });
  const initialIndex = fs.readFileSync(index(workspace));
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: "0".repeat(64) }), /Stale expected_digest/);
  await assert.rejects(run(workspace, "plugin_update", { name: "sample", directory: packageAt("other"), expected_digest: created.plugin.digest }), /manifest name/);
  await assert.rejects(run(workspace, "plugin_install", { directory: source }), /already installed/);
  await assert.rejects(run(workspace, "plugin_remove", { name: "missing", expected_digest: created.plugin.digest }), /missing/);
  await assert.rejects(run(workspace, "plugin_remove", { name: "../sample", expected_digest: created.plugin.digest }));
  await assert.rejects(run(workspace, "plugin_update", { name: "sample", directory: source }));
  await assert.rejects(run(workspace, "plugin_install", { directory: source, execute: true }));
  assert.deepEqual(fs.readFileSync(index(workspace)), initialIndex);
  assert.equal((await run(workspace, "plugin_list")).plugins[0].modified, false);
  cleanTransactions(workspace);
});

test("installed edits and unrelated installed edits block mutations and skill discovery", async () => {
  const workspace = root();
  const created = await run(workspace, "plugin_install", { directory: packageAt() });
  await run(workspace, "plugin_install", { directory: packageAt("other") });
  put(installed(workspace, "other"), "custom.txt", "user edit");
  const before = fs.readFileSync(index(workspace));
  const listed = await run(workspace, "plugin_list");
  assert.equal(listed.plugins.find((p: any) => p.manifest.name === "other").modified, true);
  await assert.rejects(run(workspace, "plugin_update", { name: "sample", directory: packageAt("sample", "2"), expected_digest: created.plugin.digest }), /Installed plugin changed/);
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: created.plugin.digest }), /Installed plugin changed/);
  assert.throws(() => discoverInstalledSkillDirectories(workspace, { enabled: true }), /Installed plugin changed/);
  assert.equal(fs.readFileSync(path.join(installed(workspace, "other"), "custom.txt"), "utf8"), "user edit");
  assert.deepEqual(fs.readFileSync(index(workspace)), before);
  fs.rmSync(path.join(installed(workspace, "other"), "custom.txt"));
  fs.chmodSync(path.join(installed(workspace), "data.bin"), 0o644);
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: created.plugin.digest }), /Installed plugin changed/);
  cleanTransactions(workspace);
});

test("missing package paths and invalid manifests fail without publishing an index", async () => {
  for (const manifest of [
    { name: "../escape", version: "1" }, { name: "Sample", version: "1" }, { name: "sample", version: "" },
    { name: "sample", version: "1", hooks: "/hooks.json" }, { name: "sample", version: "1", hooks: "missing.json" },
    { name: "sample", version: "1", hooks: { command: "execute" } },
  ]) {
    const workspace = root();
    const source = packageAt();
    put(source, "plugin.json", JSON.stringify(manifest));
    await assert.rejects(run(workspace, "plugin_install", { directory: source }));
    assert.equal(fs.existsSync(index(workspace)), false);
    cleanTransactions(workspace);
  }
  const workspace = root();
  const source = root();
  await assert.rejects(run(workspace, "plugin_install", { directory: source }), /plugin.json/);
  await assert.rejects(run(workspace, "plugin_install", { directory: path.join(source, "missing") }), /Missing/);
  put(source, "plugin.json", "{");
  await assert.rejects(run(workspace, "plugin_install", { directory: source }));
});

test("symlink ancestors, manifest links, skills links, and file hardlinks fail closed", async () => {
  for (const kind of ["root", "manifest", "skills", "file", "hardlink"]) {
    const workspace = root();
    let source = packageAt();
    const outside = root();
    if (kind === "root") {
      const alias = path.join(outside, "alias");
      fs.symlinkSync(source, alias);
      source = alias;
    } else if (kind === "manifest") {
      fs.renameSync(path.join(source, "plugin.json"), path.join(outside, "plugin.json"));
      fs.symlinkSync(path.join(outside, "plugin.json"), path.join(source, "plugin.json"));
    } else if (kind === "skills") {
      fs.rmSync(path.join(source, "skills"), { recursive: true });
      fs.symlinkSync(outside, path.join(source, "skills"));
    } else if (kind === "file") fs.symlinkSync(outside, path.join(source, "link"));
    else fs.linkSync(path.join(source, "data.bin"), path.join(outside, "shared"));
    await assert.rejects(run(workspace, "plugin_install", { directory: source }), /[Ss]ymlink|regular/);
    assert.equal(fs.existsSync(installed(workspace)), false);
    cleanTransactions(workspace);
  }
  const workspace = root();
  const outside = root();
  fs.symlinkSync(outside, path.join(workspace, ".harness"));
  await assert.rejects(run(workspace, "plugin_list"), /symlink/);
  await assert.rejects(run(workspace, "plugin_install", { directory: packageAt() }), /symlink/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("count, byte, index count, depth, and manifest limits are bounded", async () => {
  const workspace = root();
  const source = packageAt();
  await assert.rejects(run(workspace, "plugin_install", { directory: source }, { enabled: true, maxFiles: 1 }), /file count/);
  await assert.rejects(run(workspace, "plugin_install", { directory: source }, { enabled: true, maxFileBytes: 8 }), /byte cap/);
  await assert.rejects(run(workspace, "plugin_install", { directory: source }, { enabled: true, maxBytes: 8 }), /byte cap/);
  const large = root();
  put(large, "plugin.json", Buffer.alloc(PLUGIN_LIMITS.manifestBytes + 1, 32));
  await assert.rejects(run(workspace, "plugin_install", { directory: large }), /byte cap/);
  const deep = packageAt();
  put(deep, Array.from({ length: PLUGIN_LIMITS.depth + 1 }, () => "d").join("/") + "/x", "x");
  await assert.rejects(run(workspace, "plugin_install", { directory: deep }), /depth/);
  await run(workspace, "plugin_install", { directory: source }, { enabled: true, maxPlugins: 1 });
  await assert.rejects(run(workspace, "plugin_install", { directory: packageAt("other") }, { enabled: true, maxPlugins: 1 }), /plugin count/);
  cleanTransactions(workspace);
});

test("unindexed destinations are preserved and sources cannot overlap the working store", async () => {
  const workspace = root();
  put(installed(workspace), "user.txt", "unrelated");
  await assert.rejects(run(workspace, "plugin_install", { directory: packageAt() }), /occupied/);
  assert.equal(fs.readFileSync(path.join(installed(workspace), "user.txt"), "utf8"), "unrelated");
  await assert.rejects(run(workspace, "plugin_install", { directory: workspace }), /separate/);
  await assert.rejects(run(workspace, "plugin_install", { directory: installed(workspace) }), /separate/);
  cleanTransactions(workspace);
});

test("lock ownership and interrupted transactions are preserved", async () => {
  const workspace = root();
  const created = await run(workspace, "plugin_install", { directory: packageAt() });
  put(store(workspace), ".lock", "another owner");
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: created.plugin.digest }), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(store(workspace), ".lock"), "utf8"), "another owner");
  fs.unlinkSync(path.join(store(workspace), ".lock"));
  put(store(workspace), ".transaction-interrupted/old/user.txt", "recover me");
  await assert.rejects(run(workspace, "plugin_list"), /pending transaction/);
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: created.plugin.digest }), /pending transaction/);
  assert.equal(fs.readFileSync(path.join(store(workspace), ".transaction-interrupted/old/user.txt"), "utf8"), "recover me");
  assert.equal(fs.existsSync(path.join(store(workspace), ".lock")), false);
});

test("corrupt index and deleted installed directories remain explicit failures", async () => {
  const workspace = root();
  const created = await run(workspace, "plugin_install", { directory: packageAt() });
  const original = fs.readFileSync(index(workspace));
  const corrupt = JSON.parse(original.toString());
  corrupt.plugins[0].manifest.version = "tampered";
  put(store(workspace), ".index.json", JSON.stringify(corrupt));
  await assert.rejects(run(workspace, "plugin_list"), /digest/);
  await assert.rejects(run(workspace, "plugin_remove", { name: "sample", expected_digest: created.plugin.digest }), /digest/);
  corrupt.plugins.push(corrupt.plugins[0]);
  corrupt.digest = crypto.createHash("sha256").update(JSON.stringify(corrupt.plugins)).digest("hex");
  put(store(workspace), ".index.json", JSON.stringify(corrupt));
  await assert.rejects(run(workspace, "plugin_list"), /duplicate/);
  put(store(workspace), ".index.json", original);
  fs.rmSync(installed(workspace), { recursive: true });
  await assert.rejects(run(workspace, "plugin_list"), /Missing/);
  assert.throws(() => discoverInstalledSkillDirectories(workspace, { enabled: true }), /Missing/);
});

test("abort and tiny output caps fail before plugin publication", async () => {
  const workspace = root();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(run(workspace, "plugin_install", { directory: packageAt() }, { enabled: true }, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fs.existsSync(path.join(workspace, ".harness")), false);
  await assert.rejects(run(workspace, "plugin_install", { directory: packageAt() }, { enabled: true }, { maxOutputBytes: 1 }), /output byte cap/);
  assert.equal(fs.existsSync(installed(workspace)), false);
  assert.equal(fs.existsSync(index(workspace)), false);
  cleanTransactions(workspace);
});

test("update and removal roll back their tree when index commit fails", async () => {
  for (const operation of ["plugin_update", "plugin_remove"]) {
    const workspace = root();
    const created = await run(workspace, "plugin_install", { directory: packageAt() });
    const oldIndex = fs.readFileSync(index(workspace));
    const realRename = fs.renameSync;
    let injected = false;
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (String(from).endsWith("next-index.json") && String(to) === index(workspace)) {
        injected = true;
        throw new Error("fixture index rename failure");
      }
      return realRename(from, to);
    }) as typeof fs.renameSync;
    try {
      await assert.rejects(run(workspace, operation, { name: "sample", expected_digest: created.plugin.digest,
        ...(operation === "plugin_update" ? { directory: packageAt("sample", "2") } : {}) }), /fixture index rename failure/);
    } finally { fs.renameSync = realRename; }
    assert.equal(injected, true);
    assert.deepEqual(fs.readFileSync(index(workspace)), oldIndex);
    assert.equal(JSON.parse(fs.readFileSync(path.join(installed(workspace), "plugin.json"), "utf8")).version, "1");
    assert.equal((await run(workspace, "plugin_list")).plugins[0].modified, false);
    cleanTransactions(workspace);
  }
});

test("index edits made during staging are preserved while the original tree is restored", async () => {
  const workspace = root();
  const created = await run(workspace, "plugin_install", { directory: packageAt() });
  const original = fs.readFileSync(index(workspace));
  const changed = Buffer.concat([original, Buffer.from("\n")]);
  const realRename = fs.renameSync;
  let injected = false;
  fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    const result = realRename(from, to);
    if (String(from).endsWith("/new") && String(to) === installed(workspace)) {
      injected = true;
      put(store(workspace), ".index.json", changed);
    }
    return result;
  }) as typeof fs.renameSync;
  try {
    await assert.rejects(run(workspace, "plugin_update", { name: "sample", directory: packageAt("sample", "2"), expected_digest: created.plugin.digest }), /index changed before commit/);
  } finally { fs.renameSync = realRename; }
  assert.equal(injected, true);
  assert.deepEqual(fs.readFileSync(index(workspace)), changed);
  assert.equal(JSON.parse(fs.readFileSync(path.join(installed(workspace), "plugin.json"), "utf8")).version, "1");
  cleanTransactions(workspace);
});

test("rollback preserves conflicting replacement edits and recovery backup", async () => {
  const workspace = root();
  const created = await run(workspace, "plugin_install", { directory: packageAt() });
  const oldIndex = fs.readFileSync(index(workspace));
  const realRename = fs.renameSync;
  fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if (String(from).endsWith("next-index.json") && String(to) === index(workspace)) {
      put(installed(workspace), "concurrent.txt", "preserve this");
      throw new Error("fixture commit conflict");
    }
    return realRename(from, to);
  }) as typeof fs.renameSync;
  try {
    await assert.rejects(run(workspace, "plugin_update", { name: "sample", directory: packageAt("sample", "2"), expected_digest: created.plugin.digest }), /rollback requires recovery/);
  } finally { fs.renameSync = realRename; }
  assert.deepEqual(fs.readFileSync(index(workspace)), oldIndex);
  assert.equal(fs.readFileSync(path.join(installed(workspace), "concurrent.txt"), "utf8"), "preserve this");
  const pending = fs.readdirSync(store(workspace)).find(n => n.startsWith(".transaction-"))!;
  assert.equal(JSON.parse(fs.readFileSync(path.join(store(workspace), pending, "old/plugin.json"), "utf8")).version, "1");
  await assert.rejects(run(workspace, "plugin_list"), /pending transaction/);
  assert.equal(fs.existsSync(path.join(store(workspace), ".lock")), false);
});
