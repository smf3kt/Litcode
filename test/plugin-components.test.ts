import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { loadProjectConfig } from "../src/config.js";
import { createPluginTools, discoverInstalledPluginComponents } from "../src/plugins.js";
import type { ToolContext } from "../src/tools.js";

function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "plugin-components-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workspace = path.join(root, "workspace");
  const source = path.join(root, "source");
  const userDir = path.join(root, "user");
  for (const dir of [workspace, source, userDir]) fs.mkdirSync(dir);
  const put = (base: string, relative: string, value: unknown) => {
    const file = path.join(base, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  };
  const agent = (description: string) => `---\nname: reviewer\ndescription: ${description}\n---\n${description} body`;
  put(source, "plugin.json", { name: "sample", version: "1", skills: "skills", agents: "agents",
    hooks: "hooks/config.json", mcpServers: "mcp/config.json" });
  put(source, "skills/example/SKILL.md", "---\nname: example\ndescription: Fixture skill\n---\nPlugin skill");
  put(source, "agents/reviewer.md", agent("plugin"));
  put(source, "hooks/config.json", { hooks: { SessionStart: [{ command: "plugin-hook" }] } });
  put(source, "mcp/config.json", { mcpServers: { local: { command: "node", args: ["plugin.mjs"] },
    remote: { type: "http", url: "https://fixture.invalid/mcp", headersEnv: { Authorization: "FIXTURE_TOKEN" } } } });
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  const install = () => createPluginTools({ enabled: true }).find(tool => tool.schema.name === "plugin_install")!
    .execute({ directory: source }, context);
  return { workspace, source, userDir, put, agent, install };
}

test("actual install loads inert components with explicit activation and precedence", async t => {
  const f = fixture(t);
  const installed = JSON.parse(await f.install());
  assert.equal(installed.status, "installed");
  assert.deepEqual(discoverInstalledPluginComponents(f.workspace), []);
  assert.equal(loadProjectConfig(f.workspace, { userDir: f.userDir }).agentTypes, undefined);
  f.put(f.userDir, "settings.json", { hooks: { SessionStart: [{ command: "user-hook" }] },
    mcpServers: { "sample/local": { command: "user-command", args: ["user"] } } });
  f.put(f.workspace, ".harness/settings.json", { plugins: { enabled: true },
    hooks: { SessionStart: [{ matcher: "startup", hooks: [{ command: "project-hook" }] }] },
    mcpServers: { "sample/local": { type: "http", url: "http://127.0.0.1:1/mcp" } } });
  f.put(f.workspace, ".harness/settings.local.json", { hooks: { SessionStart: [{ command: "local-hook" }] } });
  f.put(f.workspace, "explicit.json", { hooks: { SessionStart: [{ command: "explicit-hook" }] } });
  let loaded = loadProjectConfig(f.workspace, { userDir: f.userDir, settingsFile: "explicit.json" });
  assert.equal(loaded.skills[0]!.name, "example");
  assert.equal(loaded.agentTypes![0]!.description, "plugin");
  assert.equal(loaded.agentTypeReports![0]!.source, "plugin");
  assert.deepEqual(loaded.settings.hooks, { SessionStart: [
    { command: "plugin-hook" }, { command: "user-hook" },
    { matcher: "startup", hooks: [{ command: "project-hook" }] }, { command: "local-hook" }, { command: "explicit-hook" },
  ] });
  assert.deepEqual((loaded.settings.mcpServers as any)["sample/local"], { type: "http", url: "http://127.0.0.1:1/mcp" });
  assert.deepEqual((loaded.settings.mcpServers as any)["sample/remote"].headersEnv, { Authorization: "FIXTURE_TOKEN" });
  f.put(f.userDir, "agents/reviewer.md", f.agent("user"));
  loaded = loadProjectConfig(f.workspace, { userDir: f.userDir });
  assert.equal(loaded.agentTypes![0]!.description, "user");
  f.put(f.workspace, ".harness/agents/reviewer.md", f.agent("project"));
  loaded = loadProjectConfig(f.workspace, { userDir: f.userDir });
  assert.equal(loaded.agentTypes![0]!.description, "project");
  assert.ok(loaded.agentTypeReports!.some(report => report.source === "plugin" && report.status === "shadowed"));
  f.put(f.workspace, ".harness/settings.local.json", { plugins: { enabled: false } });
  loaded = loadProjectConfig(f.workspace, { userDir: f.userDir });
  assert.deepEqual(loaded.skills, []);
  assert.equal((loaded.settings.mcpServers as any)["sample/remote"], undefined);
});

test("component paths schemas and installed integrity fail before activation", async t => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.source, "plugin.json"), "utf8"));
  for (const patch of [{ agents: "../agents" }, { agents: "mcp/config.json" }, { hooks: "missing.json" },
    { hooks: "/tmp/hooks.json" }, { mcpServers: "agents" }]) {
    f.put(f.source, "plugin.json", { ...manifest, ...patch });
    await assert.rejects(f.install());
  }
  f.put(f.source, "plugin.json", manifest);
  for (const servers of [{ local: { command: "node", env: { TOKEN: "embedded" } } },
    { local: { type: "http", url: "https://fixture.invalid/mcp", headers: { Authorization: "embedded" } } },
    { local: { type: "http", url: "https://fixture.invalid/mcp?token=embedded" } },
    { local: { type: "http", url: "https://fixture.invalid/mcp", headersEnv: { Authorization: "Bearer embedded" } } },
    { "bad/name": { command: "node" } }]) {
    f.put(f.source, "mcp/config.json", { mcpServers: servers });
    await assert.rejects(f.install());
  }
  f.put(f.source, "mcp/config.json", { mcpServers: { local: { command: "node" } } });
  f.put(f.source, "hooks/config.json", { hooks: { TypoEvent: [{ command: "fixture" }] } });
  await assert.rejects(f.install());
  f.put(f.source, "hooks/config.json", { hooks: { SessionStart: [{ command: "fixture" }] } });
  await f.install();
  f.put(f.workspace, ".harness/settings.json", { plugins: { enabled: true } });
  f.put(f.workspace, ".harness/plugins/sample/hooks/config.json", { hooks: { SessionStart: [{ command: "edited" }] } });
  assert.throws(() => loadProjectConfig(f.workspace, { userDir: f.userDir }), /Installed plugin changed/);
  fs.rmSync(path.join(f.workspace, ".harness/plugins/sample/hooks/config.json"));
  fs.symlinkSync(path.join(f.source, "hooks/config.json"), path.join(f.workspace, ".harness/plugins/sample/hooks/config.json"));
  assert.throws(() => discoverInstalledPluginComponents(f.workspace, { enabled: true }), /Symlink/);
});

test("plugin themes discover defaults and declared paths within verified snapshots", async t => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.source, "plugin.json"), "utf8"));
  f.put(f.source, "themes/ocean.json", { name: "Ocean", base: "light" });
  await f.install();
  const components = () => discoverInstalledPluginComponents(f.workspace, { enabled: true });
  assert.deepEqual(components()[0]!.themePaths, { name: "sample", themesPath: path.join(f.workspace, ".harness/plugins/sample/themes") });
  assert.deepEqual(discoverInstalledPluginComponents(f.workspace), []);
  f.put(f.source, "extra/single.json", { name: "Single" });
  f.put(f.source, "extra/directory/other.json", { name: "Other" });
  const update = async () => {
    const previous = components()[0]!.plugin;
    return createPluginTools({ enabled: true }).find(tool => tool.schema.name === "plugin_update")!
      .execute({ name: "sample", directory: f.source, expected_digest: previous.digest }, {
        workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 });
  };
  f.put(f.source, "plugin.json", { ...manifest, themes: ["extra/single.json", "extra/directory"] });
  await update();
  assert.deepEqual(components()[0]!.themePaths!.themesPaths, ["extra/single.json", "extra/directory"]
    .map(relative => path.join(f.workspace, ".harness/plugins/sample", relative)));
  f.put(f.source, "plugin.json", { ...manifest, themes: "extra/directory", experimental: { themes: "extra/single.json" } });
  await update();
  assert.deepEqual(components()[0]!.themePaths!.themesPaths, [path.join(f.workspace, ".harness/plugins/sample/extra/single.json")]);
  for (const themes of ["../outside", "/absolute", "missing.json"]) {
    f.put(f.source, "plugin.json", { ...manifest, themes });
    await assert.rejects(update());
  }
  f.put(f.workspace, ".harness/plugins/sample/extra/single.json", { name: "Tampered" });
  assert.throws(components, /Installed plugin changed/);
});

test("flattened hook cap includes groups events and explicit configuration", async t => {
  const f = fixture(t);
  const group = { hooks: Array.from({ length: 600 }, (_, index) => ({ command: `fixture-${index}` })) };
  f.put(f.source, "hooks/config.json", { hooks: { SessionStart: [group], Stop: [group] } });
  await assert.rejects(f.install(), /1024/);
  f.put(f.source, "hooks/config.json", { hooks: { SessionStart: [group] } });
  await f.install();
  f.put(f.workspace, ".harness/settings.json", { plugins: { enabled: true }, hooks: { Stop: [group] } });
  assert.throws(() => loadProjectConfig(f.workspace, { userDir: f.userDir }), /1024/);
});
