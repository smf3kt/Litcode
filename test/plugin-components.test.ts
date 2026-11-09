import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { loadProjectConfig } from "../src/config.js";
import { createPluginTools, discoverInstalledPluginComponents } from "../src/plugins.js";
import type { ToolContext } from "../src/tools.js";
import { hooksSchema, runHooks } from '../src/hooks.js';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { refreshPluginComponents } from '../src/skill-catalog.js';
import { childConfig } from '../src/subagents.js';
import { AsyncHookRegistry } from '../src/async-hooks.js';
import { reloadConfig } from '../src/reload.js';
import { forkSession } from '../src/sessions.js';

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
  const agent = (description: string, extra = "") => `---\nname: reviewer\ndescription: ${description}\n${extra}---\n${description} body`;
  put(source, "plugin.json", { name: "sample", version: "1", skills: "skills", agents: "agents",
    hooks: "hooks/config.json", mcpServers: "mcp/config.json" });
  put(source, "skills/example/SKILL.md", "---\nname: example\ndescription: Fixture skill\n---\nPlugin skill");
  put(source, "agents/reviewer.md", agent("plugin", "omitClaudeMd: true\n"));
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
    { hooks: [{ command: "plugin-hook" }], pluginOrigin: { id: `local:${path.join(f.workspace, '.harness/plugins/sample')}`,
      name: 'sample', root: path.join(f.workspace, '.harness/plugins/sample') } }, { command: "user-hook" },
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
  assert.ok(loaded.agentTypes!.some(agent => agent.name === 'sample:reviewer' && agent.description === 'plugin'));
  assert.equal(loaded.agentTypes!.find(agent => agent.name === 'sample:reviewer')?.omitClaudeMd, true);
  f.put(f.workspace, ".harness/settings.local.json", { plugins: { enabled: false } });
  loaded = loadProjectConfig(f.workspace, { userDir: f.userDir });
  assert.deepEqual(loaded.skills, []);
  assert.equal((loaded.settings.mcpServers as any)["sample/remote"], undefined);
});

test("component paths schemas and installed integrity fail before activation", async t => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.source, "plugin.json"), "utf8"));
  for (const patch of [{ hooks: "missing.json" },
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

test('legacy plugin hook snapshots stay pinned until explicit reload without mixing old and new commands', async t => {
  const f = fixture(t);
  f.put(f.source, 'hooks/config.json', { hooks: { SessionStart: [{ command: 'printf a >> trace' }] } });
  f.put(f.source, 'mcp/config.json', { mcpServers: {} });
  const installed = JSON.parse(await f.install());
  f.put(f.workspace, '.harness/settings.json', { plugins: { enabled: true }, hooks: { SessionStart: [{ command: 'printf e >> trace' }] } });
  const config = { ...defaultConfig(f.workspace, []), model: 'fixture', plugins: { enabled: true }, configSources: { userDir: f.userDir },
    hooks: { SessionStart: [{ command: 'printf a >> trace' }, { command: 'printf e >> trace' }] } };
  const initial = Session.open(f.workspace, { config }); await initial.close();
  const metadata = JSON.parse(fs.readFileSync(initial.file, 'utf8')); delete metadata.pluginHookOriginsVersion;
  fs.writeFileSync(initial.file, JSON.stringify(metadata) + '\n');
  f.put(f.source, 'hooks/config.json', { hooks: { SessionStart: [{ command: 'printf b >> trace' }] } });
  await createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_update')!.execute({ name: 'sample',
    directory: f.source, expected_digest: installed.plugin.digest },
    { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
  f.put(f.workspace, '.harness/settings.json', { plugins: { enabled: true }, hooks: { SessionStart: [{ command: 'printf f >> trace' }] } });
  const session = Session.open(f.workspace, { id: initial.id });
  const run = async (current: typeof session.config) => {
    refreshPluginComponents(current);
    await runHooks(current.hooks!, 'SessionStart', { cwd: f.workspace }, new AbortController().signal);
  };
  try {
    await run(session.config);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'trace'), 'utf8'), 'ae');
    const fork = forkSession(session);
    try { await run(fork.config); assert.deepEqual(fork.config.hooks, session.config.hooks); }
    finally { await fork.close(); }
    const coldFork = Session.open(f.workspace, { id: fork.id });
    try { assert.equal(coldFork.config.legacyPluginHookSnapshot, true); assert.deepEqual(coldFork.config.hooks, session.config.hooks); }
    finally { await coldFork.close(); }
    const child = childConfig(session.config, [], { mode: 'general', max_turns: 1 });
    await run(child);
    const next = reloadConfig(session.config, 'preview');
    assert.equal(next.legacyPluginHookSnapshot, undefined);
    await run(next);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'trace'), 'utf8'), 'aeaeaebf');
    const successor = Session.open(f.workspace, { config: next }); await successor.close();
    const reopened = Session.open(f.workspace, { id: successor.id });
    try { await run(reopened.config); assert.equal(fs.readFileSync(path.join(f.workspace, 'trace'), 'utf8'), 'aeaeaebfbf'); }
    finally { await reopened.close(); }
    f.put(f.workspace, '.harness/settings.json', { plugins: { enabled: false }, hooks: { SessionStart: [{ command: 'printf g >> trace' }] } });
    const disabled = reloadConfig(session.config, 'preview');
    assert.equal(disabled.legacyPluginHookSnapshot, undefined); await run(disabled);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'trace'), 'utf8'), 'aeaeaebfbfg');
  } finally { await session.close(); }
});

test('installed origin stays stable through update and child execution, and disappears on disabled reload', async t => {
  const f = fixture(t);
  const command = `printf '%s' '{"systemMessage":"plugin"}'`;
  f.put(f.source, 'hooks/config.json', { hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ command, async: true }] }] } });
  const installed = JSON.parse(await f.install());
  f.put(f.workspace, '.harness/settings.json', { plugins: { enabled: true } });
  const load = () => hooksSchema.parse(loadProjectConfig(f.workspace, { userDir: f.userDir }).settings.hooks);
  const before = load(); const group = before.SessionStart![0]!; assert.ok('hooks' in group);
  assert.equal(group.matcher, 'startup');
  f.put(f.source, 'changed.txt', 'new version');
  await createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_update')!.execute({
    name: 'sample', directory: f.source, expected_digest: installed.plugin.digest,
  }, { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
  assert.deepEqual(load(), before);
  const parent = defaultConfig(f.workspace, []); parent.hooks = before;
  const child = childConfig(parent, [], { mode: 'general', max_turns: 1 });
  const registry = new AsyncHookRegistry({ workspace: f.workspace });
  try {
    const result = await runHooks(child.hooks!, 'SessionStart', { cwd: f.workspace, source: 'startup' },
      new AbortController().signal, { startAsyncCommand: registry.start });
    assert.equal(result.backgroundTasks?.length, 1);
    const completion = await registry.wait(result.backgroundTasks![0]!);
    assert.equal(completion.delivery.kind, 'attachment');
    if (completion.delivery.kind === 'attachment') assert.equal(completion.delivery.attachment.pluginId, group.pluginOrigin!.id);
  } finally { await registry.close(); }
  f.put(f.workspace, '.harness/settings.json', { plugins: { enabled: true, enabledPlugins: { sample: false } } });
  assert.equal(loadProjectConfig(f.workspace, { userDir: f.userDir }).settings.hooks, undefined);
  assert.deepEqual(child.hooks, before, 'existing child retains its captured catalog');
});

test('live Agent replaces updated plugin hooks, removes disabled/deleted hooks and retains explicit hooks and child snapshots', async t => {
  const f = fixture(t);
  const writeHook = (letter: string) => f.put(f.source, 'hooks/config.json', { hooks: { PostToolUse: [{ command: `printf ${letter} >> trace` }] } });
  writeHook('a'); await f.install();
  const config = defaultConfig(f.workspace, []); config.plugins = { enabled: true }; config.model = 'fixture';
  config.hooks = { PostToolUse: [{ command: 'printf e >> trace' }] };
  const session = Session.open(f.workspace, { config });
  const provider = { count: async () => 1, complete: async (): Promise<never> => { throw Error('no model calls'); } };
  const agent = new Agent(session, provider, []);
  const context: ToolContext = { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 };
  const mutate = async (name: 'plugin_update' | 'plugin_remove') => {
    const previous = discoverInstalledPluginComponents(f.workspace, { enabled: true })[0]!.plugin;
    await createPluginTools({ enabled: true }).find(tool => tool.schema.name === name)!.execute({
      name: 'sample', expected_digest: previous.digest, ...(name === 'plugin_update' ? { directory: f.source } : {}),
    }, context);
  };
  try {
    await agent.emitHook('PostToolUse', {});
    const child = childConfig(session.config, [], { mode: 'general', max_turns: 1 });
    writeHook('b'); await mutate('plugin_update'); await agent.emitHook('PostToolUse', {});
    await agent.emitHook('PostToolUse', {});
    session.config.plugins!.enabledPlugins = { sample: false }; await agent.emitHook('PostToolUse', {});
    session.config.plugins!.enabledPlugins = {}; await agent.emitHook('PostToolUse', {});
    session.config.plugins!.enabled = false; await agent.emitHook('PostToolUse', {});
    session.config.plugins!.enabled = true; await agent.emitHook('PostToolUse', {});
    await mutate('plugin_remove'); await agent.emitHook('PostToolUse', {});
    refreshPluginComponents(child);
    await runHooks(child.hooks!, 'PostToolUse', { cwd: f.workspace });
    assert.equal(fs.readFileSync(path.join(f.workspace, 'trace'), 'utf8'), ['ae', 'be', 'be', 'e', 'be', 'e', 'be', 'e', 'ae'].join(''));
    assert.deepEqual(session.config.hooks, { PostToolUse: [{ command: 'printf e >> trace' }] });
  } finally { session.close(); }
});

test('live catalog rejects an oversized merged hook set before changing existing config', async t => {
  const f = fixture(t); await f.install();
  const config = defaultConfig(f.workspace, []); config.plugins = { enabled: true };
  config.hooks = { Stop: [{ hooks: Array.from({ length: 1024 }, () => ({ command: 'true' })) }] };
  const previous = config.hooks, system = config.system;
  assert.throws(() => refreshPluginComponents(config), /1024/);
  assert.equal(config.hooks, previous); assert.equal(config.system, system);
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
