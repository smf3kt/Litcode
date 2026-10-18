import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { createPluginTools, discoverInstalledPluginComponents } from '../src/plugins.js';
import { loadPluginComponents, parsePluginFrontmatter } from '../src/plugin-components.js';
import { loadProjectConfig } from '../src/config.js';
import { refreshPluginComponents, reloadSkills } from '../src/skill-catalog.js';
import { resolveChildLaunch, preloadAgentSkills } from '../src/subagents.js';
import type { SessionConfig } from '../src/session.js';

function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w184-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace'), source = path.join(root, 'source'), user = path.join(root, 'user');
  for (const dir of [workspace, source, user]) fs.mkdirSync(dir);
  const put = (base: string, file: string, value: unknown) => {
    const target = path.join(base, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put(workspace, '.harness/settings.json', { plugins: { enabled: true } });
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 };
  const tools = createPluginTools({ enabled: true });
  const invoke = async (name: string, args: unknown) => JSON.parse(await tools.find(tool => tool.schema.name === name)!.execute(args, context));
  const install = () => invoke('plugin_install', { directory: source });
  const update = () => invoke('plugin_update', { name: 'sample', directory: source,
    expected_digest: discoverInstalledPluginComponents(workspace, { enabled: true })[0]!.plugin.digest });
  const catalog = () => loadPluginComponents(discoverInstalledPluginComponents(workspace, { enabled: true }));
  return { workspace, source, user, put, invoke, install, update, catalog };
}

test('W184 default custom empty declarations retain their distinct replacement contracts', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1' });
  f.put(f.source, 'SKILL.md', 'ROOT');
  await f.install();
  assert.deepEqual(f.catalog().skills.map(skill => skill.name), ['sample']);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '2', skills: [], agents: [], commands: {} });
  await f.update();
  assert.deepEqual(f.catalog().skills, []);
  f.put(f.source, 'skills/default/SKILL.md', 'DEFAULT');
  f.put(f.source, 'agents/default.md', 'AGENT');
  f.put(f.source, 'commands/default.md', 'COMMAND');
  await f.update();
  assert.deepEqual(f.catalog().skills.map(skill => skill.name), ['default']);
  assert.deepEqual(f.catalog().agents, []);
  assert.equal(f.catalog().diagnostics.filter(item => item.message.includes('folder-shadowed')).length, 2);
  f.put(f.source, 'extra/SKILL.md', '---\nname: Custom Name\n---\nCUSTOM');
  f.put(f.source, 'extra/agent.md', '---\nwhen-to-use: custom fallback\n---\nAGENT');
  f.put(f.source, 'plugin.json', { name: 'sample', version: '3', skills: ['extra', 'skills', 'extra/SKILL.md', '../outside', 'missing'], agents: 'extra/agent.md', commands: [] });
  await f.update();
  assert.deepEqual(f.catalog().skills.map(skill => skill.name), ['default', 'Custom-Name']);
  assert.equal(f.catalog().agents[0]!.name, 'sample:agent');
  assert.equal(f.catalog().agents[0]!.description, 'custom fallback');
  assert.ok(f.catalog().diagnostics.some(item => item.message.startsWith('path-traversal')));
  assert.ok(f.catalog().diagnostics.some(item => item.message.startsWith('path-not-found')));
  assert.ok(f.catalog().diagnostics.some(item => item.message.startsWith('component-load-failed')));
});

test('W184 nested directory direct metadata inline formats continue after bad entries', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1', commands: {
    direct: { source: 'single.md', content: 'WRONG', description: 'Override', allowedTools: ['read_file'] },
    nested: { source: 'commands' }, inline: { content: 'INLINE $ARGUMENTS' }, missing: { source: 'missing.md', content: 'WRONG' },
  } });
  f.put(f.source, 'single.md', 'DIRECT $ARGUMENTS');
  f.put(f.source, 'commands/sub/one.md', 'ONE');
  f.put(f.source, 'commands/pack/SKILL.md', 'PACK');
  f.put(f.source, 'commands/pack/ignored.md', 'IGNORED');
  f.put(f.source, 'commands/pack/deeper/ignored.md', 'IGNORED');
  f.put(f.source, 'commands/bad.md', 'X'.repeat(1048577));
  f.put(f.source, 'agents/sub/reviewer.md', '---\nname: reviewer\nwhen_to_use: Review things\npermissionMode: bypass\neffort: wrong\nmaxTurns: -1\n---\nREVIEW');
  f.put(f.source, 'agents/good.md', 'GOOD');
  await f.install();
  const catalog = f.catalog();
  assert.deepEqual(catalog.skills.map(skill => skill.name), ['sample:direct', 'pack', 'sample:sub:one', 'sample:inline']);
  const direct = catalog.skills.find(skill => skill.name === 'sample:direct')!;
  assert.equal(direct.body, 'DIRECT $ARGUMENTS');
  assert.equal(direct.format, 'command');
  assert.equal(direct.description, 'Override');
  assert.deepEqual(direct.allowedTools, ['read_file']);
  assert.ok(catalog.skills.find(skill => skill.name === 'pack')!.body.startsWith('Base directory for this skill:'));
  assert.ok(catalog.diagnostics.some(item => item.path.endsWith('bad.md')));
  assert.ok(catalog.diagnostics.some(item => item.message.includes('permissionMode is ignored')));
  assert.equal(catalog.agents.find(agent => agent.name === 'sample:sub:reviewer')!.description, 'Review things');
  assert.equal(catalog.agents.find(agent => agent.name === 'sample:sub:reviewer')!.maxTurns, undefined);
  assert.equal(parsePluginFrontmatter('﻿plain').body, '﻿plain');
  assert.deepEqual(parsePluginFrontmatter('---\nname: a: b\n---\nBODY'), { data: { name: 'a: b' }, body: 'BODY' });
  const failed = parsePluginFrontmatter('---\nx: "unterminated\n---\nBODY');
  assert.equal(failed.body, 'BODY');
  assert.ok(failed.error);
  assert.deepEqual(parsePluginFrontmatter('---\n- a\n---\nBODY').data, {});
});

test('W184 two catalog owners refresh after install update remove without replacing local content', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1' });
  f.put(f.source, 'commands/run.md', 'VERSION1');
  f.put(f.source, 'agents/reviewer.md', 'VERSION1');
  const loaded = loadProjectConfig(f.workspace, { userDir: f.user });
  const make = () => ({ workspace: f.workspace, plugins: { enabled: true }, skills: [...loaded.skills], agentTypes: [], system: 'SYSTEM' } as unknown as SessionConfig);
  const a = make(), b = make();
  refreshPluginComponents(a); refreshPluginComponents(b);
  await f.install();
  refreshPluginComponents(a); refreshPluginComponents(b);
  assert.equal(a.skills![0]!.body, 'VERSION1');
  assert.equal(b.skills![0]!.body, 'VERSION1');
  f.put(f.source, 'commands/run.md', 'VERSION2');
  f.put(f.source, 'agents/reviewer.md', 'VERSION2');
  await f.update();
  refreshPluginComponents(a); refreshPluginComponents(b);
  assert.equal(a.skills![0]!.body, 'VERSION2');
  assert.equal(resolveChildLaunch(b, { subagent_type: 'sample:reviewer' }, { enableAdvanced: true }).type!.body, 'VERSION2');
  await f.invoke('plugin_remove', { name: 'sample', expected_digest: discoverInstalledPluginComponents(f.workspace, { enabled: true })[0]!.plugin.digest });
  refreshPluginComponents(a); refreshPluginComponents(b);
  assert.deepEqual(a.skills, []);
  assert.deepEqual(b.agentTypes, []);
  assert.throws(() => resolveChildLaunch(b, { subagent_type: 'sample:reviewer' }, { enableAdvanced: true }), /Unknown agent type/);
});

test('W184 plugin agent fields follow the source gates and skill preloads', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1', skills: 'skills', agents: 'agents' });
  f.put(f.source, 'skills/helper/SKILL.md', '---\nname: helper\n---\nHELPER_BODY');
  f.put(f.source, 'agents/reviewer.md', `---\nname: ${'r'.repeat(300)}\nmemory: bad\nmaxTurns: "4"\nautoCompactWindow: 50\nexperimental:\n  cacheTtl: 1h\npermissionMode: bypass\nobserver: yes\nmodel: INHERIT\n---\nREVIEW`);
  f.put(f.source, 'agents/clean.md', '---\nname: clean\ndescription: Clean agent\nskills: [helper, missing]\nmemory: project\nautoCompactWindow: 250000\ntools: ["*"]\n---\nCLEAN');
  await f.install();
  const catalog = f.catalog();
  const long = catalog.agents.find(agent => agent.name === 'sample:reviewer')!;
  assert.equal(long.maxTurns, 4);
  assert.equal(long.memory, undefined);
  assert.equal(long.autoCompactWindow, undefined);
  assert.equal(long.cacheTtl, '1h');
  assert.equal(long.model, 'inherit');
  assert.equal(long.tools, undefined);
  assert.ok(catalog.diagnostics.some(item => item.message.includes('invalid memory value ignored')));
  assert.ok(catalog.diagnostics.some(item => item.message.includes('invalid autoCompactWindow ignored')));
  assert.ok(catalog.diagnostics.some(item => item.message.includes('permissionMode is ignored for plugin agents')));
  assert.ok(catalog.diagnostics.some(item => item.message.includes('observer is ignored for plugin agents')));
  const clean = catalog.agents.find(agent => agent.name === 'sample:clean')!;
  assert.equal(clean.memory, 'project');
  assert.equal(clean.autoCompactWindow, 250000);
  const preloads = preloadAgentSkills(clean, catalog.skills, clean.name);
  assert.equal(preloads.length, 1);
  assert.match(String(preloads[0]!.content), /<command-message>helper<\/command-message>/);
  assert.match(String(preloads[0]!.content), /<skill-format>true<\/skill-format>\nBase directory for this skill: .*\n\nHELPER_BODY/);
});

test('W184 a plugin refresh replaces only the agent catalog and keeps later child text', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1', agents: 'agents' });
  f.put(f.source, 'agents/reviewer.md', 'REVIEW');
  await f.install();
  const loaded = loadProjectConfig(f.workspace, { userDir: f.user });
  const config = { workspace: f.workspace, plugins: { enabled: true }, configSources: { userDir: f.user },
    skills: [...loaded.skills], agentTypes: [], system: 'SYSTEM' } as unknown as SessionConfig;
  refreshPluginComponents(config);
  const tail = '\nYou are a child agent assigned a focused task.\n\nAgent instructions:\nCHILD_BODY';
  config.system += tail;
  f.put(f.source, 'agents/reviewer.md', 'REVIEW2');
  await f.update();
  refreshPluginComponents(config);
  assert.ok(config.system.endsWith(tail));
  assert.ok(config.system.includes('sample:reviewer'));
  // A child snapshot never reloads the owner's catalog into its leased environment.
  const child = { ...config, childMode: 'general' as const, system: 'CHILD_SYSTEM' };
  refreshPluginComponents(child);
  assert.equal(child.system, 'CHILD_SYSTEM');
  assert.equal(child.pluginGeneration, config.pluginGeneration);
});

test('W184 a configuration reload keeps plugin components and a later catalog change re-merges them', async t => {
  const f = fixture(t);
  f.put(f.source, 'plugin.json', { name: 'sample', version: '1', skills: 'skills', agents: 'agents' });
  f.put(f.source, 'skills/local/SKILL.md', 'LOCAL');
  f.put(f.source, 'agents/reviewer.md', 'REVIEW');
  await f.install();
  const loaded = loadProjectConfig(f.workspace, { userDir: f.user });
  const config = { workspace: f.workspace, plugins: { enabled: true }, configSources: { userDir: f.user },
    skills: [...loaded.skills], agentTypes: [...(loaded.agentTypes ?? [])], system: 'SYSTEM' } as unknown as SessionConfig;
  refreshPluginComponents(config);
  assert.deepEqual(config.skills!.map(skill => skill.name), ['local']);
  reloadSkills(config);
  assert.deepEqual(config.skills!.map(skill => skill.name), ['local']);
  f.put(f.source, 'skills/local/SKILL.md', 'LOCAL2');
  await f.update();
  refreshPluginComponents(config);
  assert.equal(config.skills!.find(skill => skill.name === 'local')!.body, 'Base directory for this skill: '
    + path.join(f.workspace, '.harness/plugins/sample/skills/local') + '\n\nLOCAL2');
  assert.ok(config.system.includes('sample:reviewer'));
});
