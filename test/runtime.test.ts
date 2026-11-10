import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';

import { Agent, defaultConfig } from '../src/agent.js';
import type { SkillInfo } from '../src/config.js';
import { saveThemeSetting } from '../src/theme-settings.js';
import { ThemeEditor, themeFileWriter } from '../src/theme-editor.js';
import { S1 } from '../src/tui-theme-colors.js';
import { ThemeState, themeChoices } from '../src/tui-theme-state.js';
import { CustomThemeCatalog } from '../src/tui-custom-themes.js';
import { initializeCustomThemes } from '../src/tui-custom-theme-source.js';
import { initializePluginThemes } from '../src/tui-plugin-theme-source.js';
import { createPluginTools, discoverInstalledPluginComponents } from '../src/plugins.js';
import { HOOK_EVENTS, type HooksConfig } from '../src/hooks.js';
import { activateTouchedSkills, discoverTouchedSkills } from '../src/skill-catalog.js';
import { PathApprovalCallOwner } from '../src/path-approval-call-owner.js';
import { describeDirectoryWriteInput, directoryWriteFingerprint, directoryWriteInputSchema } from '../src/directory-publication-authorization.js';
import type { ModelProvider } from '../src/provider.js';
import { Session, type SessionConfig } from '../src/session.js';
import { createTools, type ToolContext, type ToolDefinition } from '../src/tools.js';
import type { AgentProgressEvent } from '../src/tui-progress.js';
import {
  buildSystem,
  createRuntime,
  createSkillTool,
  expandUserSkill,
  findSkill,
  parseSettings,
  parseSlashCommand,
  pinToolSchemas,
  runtimeAbilities,
  validateRuntimeConfig,
  type Runtime,
} from '../src/runtime.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_MCP = String.raw`
const fs = require("fs");
const OUT = process.argv[1] || "";
function send(o) { process.stdout.write(JSON.stringify(o) + "\n"); }
function note(o) { if (OUT) { try { fs.appendFileSync(OUT, JSON.stringify(o) + "\n"); } catch (e) {} } }
if (OUT) note({ pid: process.pid });
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (chunk) {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { continue; }
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } } });
    else if (msg.method === "notifications/initialized") {}
    else if (msg.method === "tools/list") send({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } });
    else if (msg.method === "tools/call") send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "echo:" + ((msg.params.arguments && msg.params.arguments.text) || "") }] } });
  }
});
`;

const tempDirs: string[] = [];
function tmpDir(prefix = 'ccrev-runtime-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
});

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (check()) return; await delay(25); }
  throw new Error('condition was not met before the timeout');
}
function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function readNotes(file: string): Record<string, unknown>[] {
  let raw: string;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return raw.split('\n').filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l) as Record<string, unknown>]; } catch { return []; } });
}
function toContext(workspace: string): ToolContext {
  return { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
}
function skill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return { name: 'greet', description: 'Say hello', path: '/skills/greet/SKILL.md', body: 'Hello $ARGUMENTS',
    userInvocable: true, disableModelInvocation: false, ...overrides };
}
const unusedProvider: ModelProvider = {
  count: async () => 0,
  complete: async () => { throw new Error('model must not be called in this test'); },
};

test('trusted callback hooks reach child and skill lifecycles with independent once claims', async () => {
  const workspace = fs.realpathSync(tmpDir());
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: true, agentMessaging: true };
  config.hooks = { SessionStart: [{ type: 'callback', name: 'fixture', once: true }] };
  const ids: string[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async () => ({ id: 'fixture', model: 'fixture',
    type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn',
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as never) };
  const runtime = await createRuntime(config, provider, new AbortController().signal, { hookCallbacks: () => ({
    fixture: async (_definition, _event, payload) => { ids.push(payload.session_id!); return { additionalContext: 'trusted child context' }; },
  }) });
  let session: Session | undefined;
  try {
    config.tools = pinToolSchemas(runtime.tools);
    session = Session.open(workspace, { config });
    await runtime.bindSession!(session);
    const tools = runtime.buildTools(config, session.id);
    const agent = tools.find(tool => tool.schema.name === 'agent')!;
    await agent.execute({ prompt: 'child task', mode: 'general', background: false }, { ...toContext(workspace), session });
    await runtime.runSkill!(config, session.id, skill({ context: 'fork' }), 'skill task', new AbortController().signal);
    assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
    for (const id of ids) {
      const records = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.equal(records.filter(record => record.kind === 'hook_once').length, 1);
      assert.ok(records.some(record => record.kind === 'hook_result' && record.additionalContext.includes('trusted child context')));
    }
  } finally { await runtime.close(); session?.close(); }
});

// ---------------------------------------------------------------------------
// Settings mapping
// ---------------------------------------------------------------------------

test('parseSettings maps known runtime fields and ignores unknown keys', () => {
  const parsed = parseSettings({
    model: 'magpie-x', baseURL: 'http://127.0.0.1:9', auth: 'api-key', tokenCounting: 'api',
    thinking: true, prefersReducedMotion: true, maxProseWidth: 40, syntaxHighlightingDisabled: true,
    enableWorkflows: false, workflowKeywordTriggerEnabled: false,
    promptCaching: true, eagerToolInput: true, allowShell: true,
    maxTurns: 5, maxTokens: 10, contextTokens: 11, compactAt: 12, maxOutputBytes: 13,
    hooks: {
      PreToolUse: [{ command: 'echo hi', matcher: 'Write', timeout: 1.5 }],
      PostToolBatch: [{ command: 'echo batch' }],
      SessionEnd: [{ command: 'echo bye' }],
    },
    permissions: { mode: 'plan', allow: ['read_*'], deny: ['run_command'] },
    mcpServers: { srv: { command: 'node', args: ['-e', 'x'] } },
    features: { tasks: false },
    alpha: 1, list: [1, 2], nested: { x: 1 },
  });
  assert.equal(parsed.model, 'magpie-x');
  assert.equal(parsed.baseURL, 'http://127.0.0.1:9');
  assert.equal(parsed.auth, 'api-key');
  assert.equal(parsed.tokenCounting, 'api');
  assert.equal(parsed.thinking, true);
  assert.equal(parsed.prefersReducedMotion, true);
  assert.equal(parseSettings({ prefersReducedMotion: false }).prefersReducedMotion, false);
  assert.equal(parseSettings({}).prefersReducedMotion, undefined);
  assert.equal(parsed.maxProseWidth, 40);
  assert.equal(parseSettings({ maxProseWidth: 60 }).maxProseWidth, 60);
  assert.equal(parseSettings({}).maxProseWidth, undefined);
  for (const value of [null, false, '60', 39, -1, 40.5, NaN, Infinity])
    assert.equal(parseSettings({ maxProseWidth: value }).maxProseWidth, undefined);
  assert.equal(parsed.syntaxHighlightingDisabled, true);
  assert.equal(parseSettings({ syntaxHighlightingDisabled: false }).syntaxHighlightingDisabled, false);
  assert.equal(parseSettings({}).syntaxHighlightingDisabled, undefined);
  assert.equal(parseSettings({ syntaxHighlightingDisabled: undefined }).syntaxHighlightingDisabled, undefined);
  assert.equal(parsed.enableWorkflows, false);
  assert.equal(parseSettings({ enableWorkflows: true }).enableWorkflows, true);
  assert.equal(parseSettings({}).enableWorkflows, undefined);
  assert.throws(() => parseSettings({ enableWorkflows: 'yes' }), /settings\.enableWorkflows must be true or false/);
  assert.equal(parsed.workflowKeywordTriggerEnabled, false);
  assert.equal(parseSettings({ workflowKeywordTriggerEnabled: true }).workflowKeywordTriggerEnabled, true);
  assert.equal(parseSettings({}).workflowKeywordTriggerEnabled, undefined);
  assert.throws(() => parseSettings({ workflowKeywordTriggerEnabled: 1 }), /settings\.workflowKeywordTriggerEnabled must be true or false/);
  assert.equal(parsed.maxOutputBytes, 13);
  assert.deepEqual(parsed.permissions, { mode: 'plan', allow: ['read_*'], deny: ['run_command'] });
  assert.deepEqual(parsed.mcpServers, { srv: { command: 'node', args: ['-e', 'x'] } });
  assert.deepEqual(parsed.features, { tasks: false });
  assert.deepEqual(parsed.hooks, {
    PreToolUse: [{ command: 'echo hi', matcher: 'Write', timeout: 1.5 }],
    PostToolBatch: [{ command: 'echo batch' }],
    SessionEnd: [{ command: 'echo bye' }],
  });
  // Unknown keys never reach the parsed settings.
  assert.equal('alpha' in parsed, false);
  assert.equal('nested' in parsed, false);
});

test('source theme state and settings save preserve authored fields and failures', () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'theme-settings-'));
  const file = path.join(root, 'settings.json'); const previous = process.env.COLORFGBG;
  try {
    assert.deepEqual(themeChoices.map((choice: { value: string }) => choice.value),
      ['auto', 'dark', 'light', 'dark-daltonized', 'light-daltonized', 'dark-ansi', 'light-ansi']);
    for (const theme of themeChoices.map((choice: { value: string }) => choice.value).concat('custom:missing'))
      assert.equal(parseSettings({ theme }).theme, theme);
    for (const theme of [null, false, 1, 'Dark', 'unknown', [], {}]) assert.equal(parseSettings({ theme }).theme, undefined);
    const state = new ThemeState('dark'); state.previewTheme('light');
    assert.equal(state.setting, 'dark'); assert.equal(state.current, 'light');
    state.cancelPreview(); assert.equal(state.current, 'dark');
    process.env.COLORFGBG = '0;15'; state.reset('auto'); assert.equal(state.current, 'light');
    state.previewTheme('dark-ansi'); assert.equal(state.current, 'dark-ansi');
    state.cancelPreview(); assert.equal(state.current, 'light');
    process.env.COLORFGBG = '15;0'; state.reset('auto'); assert.equal(state.current, 'dark');
    process.env.COLORFGBG = '0;999'; state.reset('auto'); assert.equal(state.current, 'dark');
    state.reset('custom:missing'); assert.equal(state.current, 'dark');
    fs.writeFileSync(file, JSON.stringify({ model: 'pinned', nested: { keep: 1 }, syntaxHighlightingDisabled: false }));
    fs.chmodSync(file, 0o640); saveThemeSetting('light-ansi', root);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')),
      { model: 'pinned', nested: { keep: 1 }, syntaxHighlightingDisabled: false, theme: 'light-ansi' });
    assert.equal(fs.statSync(file).mode & 0o777, 0o640);
    fs.writeFileSync(file, '{'); assert.throws(() => saveThemeSetting('dark', root), /JSON/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{');
    fs.writeFileSync(file, '[]'); assert.throws(() => saveThemeSetting('dark', root), /object/);
    assert.equal(fs.readFileSync(file, 'utf8'), '[]');
    fs.unlinkSync(file); saveThemeSetting('dark', root); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(fs.readdirSync(root), ['settings.json']);
  } finally {
    if (previous === undefined) delete process.env.COLORFGBG; else process.env.COLORFGBG = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('source custom theme parser, serial catalog and live watcher preserve generation and file contracts', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'custom-theme-'));
  const themes = path.join(root, 'themes'); fs.mkdirSync(themes);
  const updates: unknown[] = [], warnings: string[] = [];
  const catalog = new CustomThemeCatalog(value => updates.push(value), message => warnings.push(message));
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() >= deadline) throw new Error('Theme watcher did not publish'); await delay(25); }
  };
  try {
    const parser = initializeCustomThemes({ be: () => root, BU: () => ({}), t: () => {} });
    const parsed = parser.parse('ocean', JSON.stringify({ name: 'Ocean', base: 'light', overrides: {
      text: '#112233', promptBorder: 'ansi:red', unknown: '#ffffff', error: 'invalid' } }), 'user');
    assert.deepEqual(parsed, { slug: 'ocean', name: 'Ocean', base: 'light',
      overrides: { text: '#112233', promptBorder: 'ansi:red' }, source: 'user' });
    assert.equal(parser.parse('bad', '{', 'user'), undefined); assert.equal(parser.parse('bad', '[]', 'user'), undefined);
    const fallback = parser.parse('fallback', '{"base":"auto"}', 'user');
    assert.ok(fallback); assert.equal(fallback.base, 'dark');
    fs.writeFileSync(path.join(themes, 'ocean.json'), JSON.stringify({ name: 'Zulu', base: 'light', overrides: { text: '#112233' } }));
    fs.writeFileSync(path.join(themes, 'first.json'), JSON.stringify({ name: 'Alpha' }));
    fs.writeFileSync(path.join(themes, 'bad.json'), '{');
    fs.writeFileSync(path.join(themes, 'large.json'), ' '.repeat(262145));
    fs.writeFileSync(path.join(themes, 'ignored.txt'), '{}');
    catalog.bind(root); await catalog.ready();
    assert.deepEqual(catalog.values.map(theme => theme.slug), ['first', 'ocean']);
    assert.ok(warnings.some(message => message.includes('256KB')));
    const stable = catalog.values; await catalog.reload(); assert.equal(catalog.values, stable);
    await delay(150);
    fs.writeFileSync(path.join(themes, 'ocean.json'), JSON.stringify({ name: 'Ocean', base: 'dark', overrides: { text: '#334455' } }));
    await until(() => catalog.values.find(theme => theme.slug === 'ocean')?.overrides.text === '#334455');
    fs.unlinkSync(path.join(themes, 'ocean.json'));
    await until(() => !catalog.values.some(theme => theme.slug === 'ocean'));
    fs.writeFileSync(path.join(themes, 'ocean.json'), JSON.stringify({ base: 'light' }));
    await until(() => catalog.values.some(theme => theme.slug === 'ocean'));
    assert.ok(catalog.choices().some(choice => choice.value === 'custom:ocean' && choice.origin === 'custom'));
    const other = path.join(root, 'other'); fs.mkdirSync(path.join(other, 'themes'), { recursive: true });
    fs.writeFileSync(path.join(other, 'themes/new.json'), '{"base":"dark-ansi"}');
    const pending = catalog.reload(); catalog.bind(other); await Promise.all([pending, catalog.ready()]);
    assert.deepEqual(catalog.values.map(theme => theme.slug), ['new']);
    const state = new ThemeState('custom:new'); state.setCustomThemes(catalog.values); assert.equal(state.current, 'dark-ansi');
    state.setCustomThemes([]); assert.equal(state.current, 'dark');
    const finishing = catalog.reload(); catalog.close(); const count = updates.length;
    await finishing; assert.equal(updates.length, count);
  } finally { catalog.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('source plugin theme catalog activates verified snapshots, retains user precedence and cancels stale loads', async () => {
  // Realpath'd: the plugin store refuses a workspace reached through a symlink, and macOS's tmpdir
  // is one.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'plugin-themes-')));
  const workspace = path.join(root, 'workspace'), user = path.join(root, 'user'), source = path.join(root, 'source');
  for (const directory of [workspace, user, source]) fs.mkdirSync(directory);
  fs.mkdirSync(path.join(source, 'themes')); fs.mkdirSync(path.join(user, 'themes'));
  fs.writeFileSync(path.join(source, 'plugin.json'), '{"name":"sample","version":"1"}');
  fs.writeFileSync(path.join(source, 'themes/ocean.json'), '{"name":"Zulu","base":"light","overrides":{"text":"#112233"}}');
  fs.writeFileSync(path.join(source, 'themes/alpha.json'), '{"name":"Alpha","base":"light-ansi"}');
  fs.writeFileSync(path.join(source, 'themes/bad.json'), '{');
  fs.writeFileSync(path.join(user, 'themes/sample:ocean.json'), '{"name":"User ocean","base":"dark-ansi"}');
  const warnings: string[] = [], updates: unknown[] = [];
  const catalog = new CustomThemeCatalog(themes => updates.push(themes), message => warnings.push(message));
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  const tools = createPluginTools({ enabled: true });
  try {
    await tools.find(tool => tool.schema.name === 'plugin_install')!.execute({ directory: source }, context);
    catalog.bind(user, workspace, { enabled: true }); await catalog.ready();
    assert.deepEqual(catalog.values.map(theme => theme.slug), ['sample:ocean', 'sample:alpha', 'sample:ocean']);
    assert.ok(warnings.some(message => message.includes('invalid JSON')));
    assert.ok(catalog.choices().some(choice => choice.value === 'custom:sample:ocean' && choice.origin === 'from sample'));
    const state = new ThemeState('custom:sample:ocean'); state.setCustomThemes(catalog.values); assert.equal(state.current, 'dark-ansi');
    const stable = catalog.values; catalog.bind(user, workspace, { enabled: true }); await catalog.ready(); assert.equal(catalog.values, stable);
    fs.unlinkSync(path.join(user, 'themes/sample:ocean.json')); await catalog.reload();
    state.setCustomThemes(catalog.values); assert.equal(state.current, 'light'); assert.equal(state.resolved.text, '#112233');
    catalog.bind(user, workspace, { enabled: true }); catalog.bind(user, workspace, { enabled: false }); await catalog.ready();
    assert.equal(catalog.values.length, 0); state.setCustomThemes(catalog.values); assert.equal(state.current, 'dark');
    catalog.bind(user, workspace, { enabled: true }); await catalog.ready(); assert.equal(catalog.values.length, 2);
    fs.writeFileSync(path.join(source, 'themes/ocean.json'), '{"name":"Zulu","base":"light","overrides":{"text":"#334455"}}');
    const previous = discoverInstalledPluginComponents(workspace, { enabled: true })[0]!.plugin;
    await tools.find(tool => tool.schema.name === 'plugin_update')!.execute({ name: 'sample', directory: source, expected_digest: previous.digest }, context);
    assert.equal(catalog.values.find(theme => theme.slug === 'sample:ocean')!.overrides.text, '#112233');
    catalog.bind(user, workspace, { enabled: true }); await catalog.ready();
    assert.equal(catalog.values.find(theme => theme.slug === 'sample:ocean')!.overrides.text, '#334455');
    fs.writeFileSync(path.join(workspace, '.harness/plugins/sample/themes/ocean.json'), '{}');
    catalog.bind(user, workspace, { enabled: true }); await catalog.ready();
    assert.equal(catalog.values.length, 0); assert.ok(warnings.some(message => message.includes('Installed plugin changed')));
    const sourceGate = initializePluginThemes({ VJn: () => { throw new Error('Disabled themes read paths'); }, BU: () => ({ pluginThemes: {
      setState: (update: (value: unknown[]) => unknown[]) => assert.deepEqual(update([{}]), []) } }), br: () => true, g: () => {} });
    assert.deepEqual(await sourceGate.load([{ name: 'sample', themesPath: 'unused' }]), []);
    catalog.bind(user, workspace, { enabled: true }); catalog.close(); const count = updates.length;
    await catalog.ready(); assert.equal(updates.length, count);
  } finally { catalog.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('source theme editor creates unique user files, previews, resets, forks and recovers writes', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'theme-editor-'));
  const state = new ThemeState('dark'), saved: string[] = [];
  const writer = themeFileWriter(root);
  const catalog = new CustomThemeCatalog(themes => state.setCustomThemes(themes), () => {});
  catalog.bind(root);
  const host = { save:writer, reload:() => catalog.reload(), pick:async (value: import('../src/tui-theme-state.js').ThemeSetting) => {
    saved.push(value); state.reset(value);
  }, preview:(value: Record<string,string> | null) => state.setPreviewOverrides(value), changed:() => {} };
  let owner = new ThemeEditor(undefined, 'dark', [{slug:'my-ocean', name:'Existing', base:'dark', overrides:{}, source:'user'}], host);
  try {
    owner.create('My Ocean'); await owner.flush();
    assert.equal(owner.slug, 'my-ocean-2'); assert.equal(owner.mode, 'colors');
    assert.deepEqual(saved, ['custom:my-ocean-2']);
    const file = path.join(root, 'themes/my-ocean-2.json');
    assert.equal(fs.readFileSync(file, 'utf8'), '{\n  "name": "My Ocean",\n  "base": "dark",\n  "overrides": {}\n}\n');
    assert.equal(fs.statSync(file).mode & 0o777, 0o600); fs.chmodSync(file, 0o640);
    assert.deepEqual(owner.filtered('PROMPTBORDER'), ['promptBorder', 'promptBorderShimmer']);
    owner.edit('text'); owner.change('#112233'); assert.equal(state.resolved.text, '#112233');
    owner.change('invalid'); assert.equal(owner.accept(), false); assert.equal(state.resolved.text, '#112233');
    owner.cancelValue(); assert.equal(state.resolved.text, S1('dark').text); assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).overrides.text, undefined);
    owner.edit('text'); owner.change('#112233'); assert.equal(owner.accept(), true); await owner.flush();
    assert.equal(fs.statSync(file).mode & 0o777, 0o640); assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).overrides.text, '#112233');
    owner.edit('text'); owner.change(S1('dark').text); owner.accept(); await owner.flush();
    assert.equal(Object.keys(owner.overrides).length, 0); assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).overrides, {});
    owner.edit('promptBorder'); owner.change('#445566'); owner.accept(); await owner.flush();
    owner.reset('promptBorder'); await owner.flush(); assert.equal(Object.keys(owner.overrides).length, 0);
    owner.close(); await catalog.reload(); assert.equal(state.resolved.text, S1('dark').text);
    const plugin = {slug:'sample:ocean', name:'Ocean', base:'light' as const, overrides:{text:'#223344'}, source:{plugin:'sample'}};
    owner = new ThemeEditor(plugin, 'dark', catalog.values, host);
    assert.equal(owner.fork, true); assert.equal(owner.mode, 'name'); assert.equal(owner.slug, '');
    owner.create('Ocean'); await owner.flush(); assert.equal(owner.slug, 'ocean');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'themes/ocean.json'), 'utf8')),
      {name:'Ocean', base:'light', overrides:{text:'#223344'}});
    owner.edit('text'); owner.change('#334455'); owner.accept(); owner.close(); await owner.flush();
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'themes/ocean.json'), 'utf8')).overrides.text, '#334455');
    assert.equal(plugin.overrides.text, '#223344');
    let fail = true;
    owner = new ThemeEditor({...plugin, slug:'retry', source:'user'}, 'dark', [], {...host, save:async theme => {
      if (fail) throw new Error('owned write failure'); await writer(theme);
    }});
    owner.edit('text'); owner.change('#556677'); owner.accept(); await owner.flush();
    assert.match(owner.error!, /owned write failure/); fail = false;
    owner.edit('text'); owner.change('#667788'); owner.accept(); await owner.flush();
    assert.equal(owner.error, undefined); assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'themes/retry.json'), 'utf8')).overrides.text, '#667788');
    await assert.rejects(writer({...plugin, slug:'../outside', source:'user'}), /slug/);
    fs.symlinkSync(file, path.join(root, 'themes/link.json')); await assert.rejects(writer({...plugin, slug:'link', source:'user'}), /regular file/);
  } finally { owner.close(); await owner.flush(); catalog.close(); fs.rmSync(root, {recursive:true, force:true}); }
});

test('parseSettings rejects malformed known fields and unknown hook events', () => {
  assert.throws(() => parseSettings({ thinking: 'yes' }), /settings\.thinking/);
  assert.throws(() => parseSettings({ prefersReducedMotion: 'yes' }), /settings\.prefersReducedMotion/);
  for (const value of [null, 'true', 0, 1, [], {}])
    assert.throws(() => parseSettings({ syntaxHighlightingDisabled: value }), /settings\.syntaxHighlightingDisabled/);
  assert.throws(() => parseSettings({ maxTurns: 0 }), /settings\.maxTurns/);
  assert.throws(() => parseSettings({ auth: 'basic' }), /settings\.auth/);
  assert.throws(() => parseSettings({ permissions: { mode: 'yolo', allow: [], deny: [] } }));
  // An unknown hook event name is dropped, not merged.
  assert.deepEqual(parseSettings({ hooks: { NotARealEvent: [{ command: 'x' }] } }).hooks, {});
  // A mix keeps the known event and drops only the unknown one.
  assert.deepEqual(
    parseSettings({ hooks: { Stop: [{ command: 'x' }], NotARealEvent: [{ command: 'y' }] } }).hooks,
    { Stop: [{ command: 'x' }] },
  );
  // Every new event is accepted by the lenient runtime loader.
  for (const event of HOOK_EVENTS) {
    assert.deepEqual(parseSettings({ hooks: { [event]: [{ command: 'x' }] } }).hooks, {
      [event]: [{ command: 'x' }],
    });
  }
});

test('the strict session config schema accepts every hook event but rejects an unknown one', () => {
  const config = defaultConfig(fs.realpathSync(tmpDir()), createTools());
  config.model = 'test';
  for (const event of HOOK_EVENTS) {
    config.hooks = { [event]: [{ command: 'true' }] };
    assert.doesNotThrow(() => validateRuntimeConfig(config), `session schema rejected ${event}`);
  }
  config.hooks = { NotARealEvent: [{ command: 'true' }] } as unknown as HooksConfig;
  assert.throws(() => validateRuntimeConfig(config));
});

test('parseSettings rejects an explicit MCP env member so no environment is journaled', () => {
  assert.throws(() => parseSettings({ mcpServers: { srv: { command: 'node', env: { TOKEN: 'secret' } } } }));
});

// ---------------------------------------------------------------------------
// System prompt assembly
// ---------------------------------------------------------------------------

test('buildSystem appends instructions and a model-invocable skill catalog', () => {
  const system = buildSystem('BASE', [{ path: '/repo/HARNESS.md', content: 'Do X\n' }], [
    skill(),
    skill({ name: 'auto', description: 'Auto only', disableModelInvocation: true }),
  ]);
  assert.ok(system.startsWith('BASE'));
  assert.match(system, /# Project instructions/);
  assert.match(system, /Instructions from \/repo\/HARNESS\.md:\nDo X/);
  assert.match(system, /# Available skills/);
  assert.match(system, /- greet: Say hello/);
  assert.ok(!/- auto:/.test(system), 'non-model-invocable skills are hidden from the catalog');

  assert.equal(buildSystem('BASE', [], []), 'BASE');
});

// ---------------------------------------------------------------------------
// Skill tool and slash resolution
// ---------------------------------------------------------------------------

test('the skill tool expands snapshot bodies and guards disable-model-invocation', async () => {
  const config = { skills: [skill(), skill({ name: 'auto', body: 'Auto', disableModelInvocation: true })] } as SessionConfig;
  const tool = createSkillTool(config);
  assert.equal(tool.readOnly, true);
  assert.equal(tool.schema.name, 'skill');
  assert.equal(await tool.execute({ name: 'greet', args: 'world' }, toContext('/tmp')), 'Hello world');
  await assert.rejects(tool.execute({ name: 'missing' }, toContext('/tmp')), /Unknown skill/);
  await assert.rejects(tool.execute({ name: 'auto' }, toContext('/tmp')), /not model-invocable/);
  await assert.rejects(tool.execute({ name: '' }, toContext('/tmp')));
});

test('skill instructions respect the output byte cap without splitting UTF-8', async () => {
  const config = { skills: [skill({ body: '你好'.repeat(100) })] } as SessionConfig;
  const output = await createSkillTool(config).execute({ name: 'greet' }, { ...toContext('/tmp'), maxOutputBytes: 7 });
  assert.ok(output.startsWith('你好\n')); assert.ok(!output.includes('�'));
  assert.match(output, /Skill instructions truncated/);
});

test('slash parsing and explicit skill expansion honor user-invocable', () => {
  assert.deepEqual(parseSlashCommand('/greet a b'), { name: 'greet', args: 'a b' });
  assert.deepEqual(parseSlashCommand('/greet'), { name: 'greet', args: '' });
  assert.equal(parseSlashCommand('hello'), undefined);
  assert.equal(parseSlashCommand('/'), undefined);
  assert.deepEqual(parseSlashCommand("/plugin:review:quick a b"), { name: "plugin:review:quick", args: "a b" });
  assert.equal(parseSlashCommand("/plugin::review"), undefined);

  const invocable = skill();
  assert.equal(expandUserSkill(invocable, 'x y'), 'Hello x y');
  assert.equal(findSkill([invocable], 'greet'), invocable);
  assert.equal(findSkill([invocable], 'nope'), undefined);
  const aliased = { ...invocable, name: "plugin:review", aliases: ["quick"] };
  assert.equal(findSkill([aliased], "quick"), aliased);
  assert.equal(findSkill([aliased, { ...invocable, name: "quick" }], "quick")!.name, "quick");
  assert.throws(() => findSkill([aliased, { ...aliased, name: "other:review" }], "quick"), /Ambiguous skill alias/);
  assert.throws(() => expandUserSkill(skill({ userInvocable: false }), 'x'), /not user-invocable/);
  // disable-model-invocation is permitted for an explicit user invocation.
  assert.equal(expandUserSkill(skill({ disableModelInvocation: true, body: 'B' }), ''), 'B');
});

// ---------------------------------------------------------------------------
// Abilities and schema pinning
// ---------------------------------------------------------------------------

test('runtimeAbilities distinguishes legacy and modern configurations', () => {
  const base = { features: undefined, skills: undefined, mcpServers: undefined } as unknown as SessionConfig;
  assert.deepEqual(runtimeAbilities(base), { skill: false, tasks: false, subagents: false });
  const modern = { features: { tasks: true, subagents: false } } as SessionConfig;
  assert.deepEqual(runtimeAbilities(modern), { skill: true, tasks: true, subagents: false });
  const skillsOnly = { skills: [] } as unknown as SessionConfig;
  assert.deepEqual(runtimeAbilities(skillsOnly), { skill: true, tasks: false, subagents: false });
});

test('pinToolSchemas marks every schema for eager input streaming', () => {
  const pinned = pinToolSchemas(createTools());
  assert.ok(pinned.length > 0);
  assert.ok(pinned.every(schema => (schema as { eager_input_streaming?: boolean }).eager_input_streaming === true));
});

test('validateRuntimeConfig accepts a well-formed base configuration', () => {
  const config = defaultConfig(tmpDir(), createTools());
  config.model = 'test';
  assert.doesNotThrow(() => validateRuntimeConfig(config));
});

// ---------------------------------------------------------------------------
// createRuntime: MCP discovery, tool assembly and teardown
// ---------------------------------------------------------------------------

function runtimeConfig(workspace: string, out: string): SessionConfig {
  const config = defaultConfig(workspace, createTools());
  config.model = 'test';
  config.features = { tasks: true, subagents: true };
  config.skills = [skill()];
  config.mcpServers = { srv: { command: process.execPath, args: ['-e', MOCK_MCP, out] } };
  return config;
}

test('named workflow owners isolate user roots and plugin gates through mutation, nesting and reload', async () => {
  const workspace = fs.realpathSync(tmpDir());
  const source = fs.realpathSync(tmpDir());
  const userA = tmpDir(), userB = tmpDir();
  const script = (value: string) => `export const meta = {name:'leaf',description:'fixture'}; return ${JSON.stringify(value)}`;
  for (const [directory, value] of [[userA, 'A'], [userB, 'B']]) {
    fs.mkdirSync(path.join(directory!, 'workflows'));
    fs.writeFileSync(path.join(directory!, 'workflows/leaf.js'), script(value!));
  }
  fs.mkdirSync(path.join(source, 'workflows'));
  fs.writeFileSync(path.join(source, 'workflows/leaf.js'), script('plugin-v1'));
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'fixture', version: '1' }));
  const a = defaultConfig(workspace, createTools()); a.model = 'test';
  a.features = { tasks: true, subagents: true, agentMessaging: true, workflow: true };
  a.plugins = { enabled: true }; a.configSources = { userDir: userA };
  const b = structuredClone(a); b.configSources = { userDir: userB }; b.plugins = { enabled: false };
  const runtime = await createRuntime(a, unusedProvider, new AbortController().signal);
  const other = await createRuntime(a, unusedProvider, new AbortController().signal);
  const call = async (tools: ToolDefinition[], name: string, input: unknown) => {
    const tool = tools.find(tool => tool.schema.name === name)!;
    return JSON.parse(String(await tool.execute(input, toContext(workspace))));
  };
  const named = (tools: ToolDefinition[], name = 'leaf') => call(tools, 'workflow_run', { name });
  try {
    const toolsA = runtime.buildTools(a, 'a'), toolsB = runtime.buildTools(b, 'b');
    const toolsC = runtime.buildTools({ ...b, plugins: { enabled: true } }, 'c');
    const toolsD = other.buildTools(a, 'd');
    const nestedOther = () => call(toolsD, 'workflow_run', { script: "export const meta={name:'parent',description:'fixture'};return await workflow('fixture:leaf')" });
    assert.deepEqual((await Promise.all([named(toolsA), named(toolsB)])).map(result => result.result), ['A', 'B']);
    const installed = await call(toolsA, 'plugin_install', { directory: source });
    assert.equal((await named(toolsA, 'fixture:leaf')).result, 'plugin-v1');
    assert.equal((await named(toolsC, 'fixture:leaf')).result, 'plugin-v1');
    assert.equal((await named(toolsD, 'fixture:leaf')).result, 'plugin-v1');
    assert.equal((await nestedOther()).result, 'plugin-v1');
    await assert.rejects(named(toolsB, 'fixture:leaf'), /not found/);
    const nested = () => call(toolsA, 'workflow_run', { script: "export const meta={name:'parent',description:'fixture'};return await workflow('fixture:leaf')" });
    assert.equal((await nested()).result, 'plugin-v1');
    fs.writeFileSync(path.join(source, 'workflows/leaf.js'), script('plugin-v2'));
    const updated = await call(toolsA, 'plugin_update', { name: 'fixture', directory: source, expected_digest: installed.plugin.digest });
    assert.equal((await nested()).result, 'plugin-v2');
    assert.equal((await named(toolsC, 'fixture:leaf')).result, 'plugin-v2');
    assert.equal((await named(toolsD, 'fixture:leaf')).result, 'plugin-v2');
    assert.equal((await nestedOther()).result, 'plugin-v2');
    await call(toolsA, 'plugin_remove', { name: 'fixture', expected_digest: updated.plugin.digest });
    assert.match((await nested()).error.message, /no workflow with that name/);
    await assert.rejects(named(toolsC, 'fixture:leaf'), /not found/);
    await assert.rejects(named(toolsD, 'fixture:leaf'), /not found/);
    assert.match((await nestedOther()).error.message, /no workflow with that name/);
    fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'fixture', version: '1', workflows: ['../escape', 'missing'] }));
    await call(toolsA, 'plugin_install', { directory: source });
    await assert.rejects(named(toolsD, 'fixture:leaf'), /not found/);
    const diagnostics = JSON.stringify(other.drainEvents!('d'));
    assert.match(diagnostics, /path-traversal/);
    assert.match(diagnostics, /\.\.\/escape/);
    assert.match(diagnostics, /path-not-found/);
    assert.match(diagnostics, /fixture\/missing/);
    assert.doesNotMatch(diagnostics, /\[object Object\]/);
    fs.writeFileSync(path.join(userA, 'workflows/leaf.js'), script('A-reloaded'));
    await runtime.releaseSession!('a');
    await assert.rejects(named(toolsA), /released/);
    assert.equal((await named(runtime.buildTools(a, 'a'))).result, 'A-reloaded');
    assert.equal((await named(toolsB)).result, 'B');
  } finally { await Promise.all([runtime.close(), other.close()]); }
});

test('createRuntime discovers MCP tools, assembles config tools and closes its children', async () => {
  const ws = tmpDir();
  const out = path.join(ws, 'notes.jsonl');
  const config = runtimeConfig(ws, out);
  const runtime: Runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const names = runtime.tools.map(t => t.schema.name);
    for (const expected of ['read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command']) {
      assert.ok(names.includes(expected), `missing base tool ${expected}`);
    }
    assert.ok(names.includes('task_create') && names.includes('task_list'));
    assert.ok(names.includes('skill'));
    assert.ok(names.includes('agent'));
    assert.ok(names.includes('mcp__srv__echo'));
    assert.ok(runtime.limits.some(entry => entry.includes('2024-11-05')));

    // The MCP tool is callable through the adapted definition.
    const echo = runtime.tools.find(t => t.schema.name === 'mcp__srv__echo');
    assert.ok(echo);
    assert.equal(await echo.execute({ text: 'hi' }, toContext(ws)), 'echo:hi');

    // buildTools returns a fresh array bound to the passed configuration.
    const rebuilt = runtime.buildTools(config);
    assert.notEqual(rebuilt, runtime.tools);
    assert.deepEqual(rebuilt.map(t => t.schema.name), names);

    await waitFor(() => readNotes(out).some(note => typeof note.pid === 'number'));
    const pid = readNotes(out).find(note => typeof note.pid === 'number')?.pid as number;
    assert.ok(processAlive(pid));

    await runtime.close();
    await runtime.close(); // idempotent
    await waitFor(() => !processAlive(pid));
  } finally {
    await runtime.close();
  }
});

test("a turn's touched-path skill catalog does not invalidate the live owner tool set", async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  config.skills = [];
  config.system = buildSystem('BASE', [], config.skills);
  config.heldSkills = [skill({ name: 'scoped', description: 'Scoped skill', paths: ['src'] })];
  fs.mkdirSync(path.join(ws, 'nested', '.harness', 'skills', 'local'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'nested', '.harness', 'skills', 'local', 'SKILL.md'),
    '---\nname: local\ndescription: Local skill\n---\nLocal body\n');
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const first = runtime.buildTools(config, 'turn-owner');
    config.tools = pinToolSchemas(first);
    // Same mutations a turn's path access makes on the live config: a held skill activates,
    // the visited harness skill directories are recorded, and the rendered section is rewritten.
    activateTouchedSkills(config, [path.join(ws, 'src', 'a.ts')]);
    await discoverTouchedSkills(config, [path.join(ws, 'nested', 'a.ts')]);
    assert.equal(config.heldSkills, undefined, 'the scoped skill left the held list');
    assert.deepEqual(config.dynamicSkillDirs, [path.join(ws, 'nested', '.harness', 'skills'), path.join(ws, '.harness', 'skills')]);
    const second = runtime.buildTools(config, 'turn-owner');
    assert.deepEqual(second.map(t => t.schema.name), first.map(t => t.schema.name));
    assert.ok(second.find(t => t.schema.name === 'skill'));
  } finally { await runtime.close(); }
});

test('live peer inbound policy keeps the owner tool set while pinned configuration changes still fail', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools()); config.model = 'test';
  config.features = { tasks: false, subagents: false, crossSessionMessaging: true };
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const owner = 'peer-policy', first = runtime.buildTools(config, owner);
    const list = first.find(tool => tool.schema.name === 'list_files'); assert.ok(list);
    assert.equal(runtime.backgroundWorkCount?.(owner), 0);
    for (const policy of ['accept', 'hold', 'refuse', undefined] as const) {
      config.crossSessionInbound = policy;
      const next = runtime.buildTools(config, owner);
      assert.deepEqual(next.map(tool => tool.schema.name), first.map(tool => tool.schema.name));
      assert.equal(next.find(tool => tool.schema.name === 'list_files'), list);
    }
    config.maxOutputBytes += 1;
    assert.throws(() => runtime.buildTools(config, owner), /Runtime owner configuration changed/);
    config.maxOutputBytes -= 1;
  } finally { await runtime.close(); }
});

test('a legacy configuration yields base tools only, matching a resumed old session', async () => {
  const ws = tmpDir();
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const names = runtime.tools.map(t => t.schema.name);
    assert.deepEqual(names, ['read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command']);
    assert.equal(names.includes('skill'), false);
    assert.equal(names.includes('agent'), false);
  } finally { await runtime.close(); }
});

test('runtime Write wrapper scope and executing Session can differ', { timeout: 30000 }, async () => {
  const ws = fs.realpathSync(tmpDir()), outside = fs.realpathSync(tmpDir()), file = path.join(outside, 'value');
  fs.writeFileSync(file, 'OWNER_ORIGINAL');
  const config = defaultConfig(ws, []); config.model = 'fixture'; config.permissions = { mode: 'bypass', allow: [], deny: [] };
  const provider = (id: string): ModelProvider => {
    let calls = 0;
    return { count: async () => 1, complete: async () => {
      const first = calls++ === 0;
      return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
        content: first ? [{ type: 'tool_use', id, name: 'write_file', input: { path: file, content: id, overwrite: true } }] :
          [{ type: 'text', text: 'done' }], stop_reason: first ? 'tool_use' : 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    } };
  };
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const owner = Session.open(ws, { config }), executing = Session.open(ws, { config });
  const append = Session.prototype.append;
  const captured: { event?: Parameters<Session['append']>[0]; authorization?: object } = {};
  const accessorEffect = path.join(ws, 'start-authorization-getter');
  const cancellation = new AbortController();
  let releasing: Promise<void> | undefined;
  let executingIncarnation = '', borrowedIncarnation = '', reopened: Session | undefined;
  Session.prototype.append = function(event, authorization, backupToken, runtimeAuthorization) {
    if (this === executing && event.kind === 'tool_start' && event.id === 'own-owner-write' && event.runtimeWriteOwner) {
      captured.event = structuredClone(event); captured.authorization = runtimeAuthorization;
    }
    if (this === executing && event.kind === 'tool_start' && event.id === 'tampered-owner-write' && event.runtimeWriteOwner && runtimeAuthorization) {
      const changed = { ...event };
      Object.defineProperty(changed, 'runtimeWriteOwner', { configurable: true, enumerable: true, get() {
        fs.writeFileSync(accessorEffect, 'UNEXPECTED'); return event.runtimeWriteOwner;
      } });
      assert.throws(() => append.call(this, changed, authorization, backupToken, runtimeAuthorization), /Runtime Write start authorization invalid/);
      assert.equal(fs.existsSync(accessorEffect), false);
      assert.throws(() => append.call(this, event, authorization, backupToken, runtimeAuthorization), /Runtime Write start authorization invalid/);
      throw new Error('injected tampered owner authorization');
    }
    if (this === executing && event.kind === 'tool_start' && event.id === 'tojson-owner-write' && event.runtimeWriteOwner && runtimeAuthorization) {
      const prototype = Object.create(null);
      Object.defineProperty(prototype, 'toJSON', { value() { fs.writeFileSync(accessorEffect, 'UNEXPECTED'); return event.runtimeWriteOwner; } });
      const changed = { ...event, runtimeWriteOwner: Object.assign(Object.create(prototype), event.runtimeWriteOwner) };
      assert.throws(() => append.call(this, changed, authorization, backupToken, runtimeAuthorization), /Runtime Write start authorization invalid/);
      assert.equal(fs.existsSync(accessorEffect), false);
      assert.throws(() => append.call(this, event, authorization, backupToken, runtimeAuthorization), /Runtime Write start authorization invalid/);
      throw new Error('injected serialized owner authorization');
    }
    if (this === executing && event.kind === 'tool_start' && event.id === 'release-before-write-start' && runtimeAuthorization)
      releasing = runtime.releaseSession!(executing.id);
    if (this === executing && event.kind === 'tool_start' && event.id === 'cancel-before-write-start' && runtimeAuthorization)
      cancellation.abort();
    return append.call(this, event, authorization, backupToken, runtimeAuthorization);
  };
  try {
    await runtime.bindSession!(owner); await runtime.bindSession!(executing);
    const ownerTools = runtime.buildTools(owner.config, owner.id), executingTools = runtime.buildTools(executing.config, executing.id);
    const ownerWrite = ownerTools.find(tool => tool.schema.name === 'write_file');
    const executingWrite = executingTools.find(tool => tool.schema.name === 'write_file');
    assert.ok(ownerWrite && executingWrite); assert.notEqual(ownerWrite, executingWrite);
    const ownerLease = runtime.sessionLease!(owner), executingLease = runtime.sessionLease!(executing);
    assert.equal(ownerLease(), true); assert.equal(executingLease(), true);
    executing.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(executing, provider('borrowed-owner-write'), ownerTools).run('track borrowed wrapper');
    assert.equal(fs.readFileSync(file, 'utf8'), 'borrowed-owner-write');
    await new Agent(executing, provider('own-owner-write'), executingTools).run('track own wrapper');
    for (const id of ['borrowed-owner-write', 'own-owner-write']) {
      const effect = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === id);
      const backup = executing.events.find(event => event.kind === 'directory_backup' && event.toolUseId === id);
      assert.ok(effect?.kind === 'tool_effect', id);
      assert.ok(!effect.result.is_error, String(effect.result.content));
      assert.ok(backup?.kind === 'directory_backup'); assert.equal(backup.owner, executing.id);
    }
    const borrowedStart = executing.events.find(event => event.kind === 'tool_start' && event.id === 'borrowed-owner-write');
    const ownStart = executing.events.find(event => event.kind === 'tool_start' && event.id === 'own-owner-write');
    assert.ok(borrowedStart && ownStart);
    assert.equal(Object.getOwnPropertyDescriptor(borrowedStart, 'runtimeWriteOwner'), undefined);
    const ownOrigin = Object.getOwnPropertyDescriptor(ownStart, 'runtimeWriteOwner')?.value;
    assert.equal(ownOrigin?.owner, executing.id);
    assert.match(ownOrigin?.incarnation ?? '', /^[0-9a-f-]{36}$/);
    executingIncarnation = ownOrigin.incarnation;
    assert.ok(captured.event && captured.authorization);
    assert.throws(() => executing.append(captured.event!, undefined, undefined, captured.authorization), /Runtime Write start authorization invalid/);
    const originalExecutor = executingWrite.execute, replacementEffect = path.join(ws, 'post-start-replacement');
    try {
      await new Agent(executing, provider('post-start-replacement'), executingTools, { status(text) {
        if (text === 'tool: write_file') executingWrite.execute = async () => { fs.writeFileSync(replacementEffect, 'UNEXPECTED'); return 'replacement'; };
      } }).run('replace after start');
    } finally { executingWrite.execute = originalExecutor; }
    const selected = executing.events.find(event => event.kind === 'tool_start' && event.id === 'post-start-replacement');
    const replaced = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'post-start-replacement');
    assert.ok(selected?.kind === 'tool_start' && selected.runtimeWriteOwner);
    assert.equal(selected.runtimeWriteOwner.incarnation, executingIncarnation);
    assert.ok(replaced?.kind === 'tool_effect' && replaced.result.is_error);
    assert.equal(replaced.result.content, 'Runtime built-in write_file wrapper changed');
    assert.equal(fs.existsSync(replacementEffect), false);
    assert.equal(executing.events.some(event => event.kind === 'directory_backup' && event.toolUseId === 'post-start-replacement'), false);
    assert.equal(executing.events.some(event => event.kind === 'runtime_write_execution' && event.id === 'post-start-replacement'), false);
    assert.equal(executing.events.some(event => event.kind === 'runtime_write_execution' && event.id === 'borrowed-owner-write'), false);
    await new Agent(executing, provider('tampered-owner-write'), executingTools).run('try altered start');
    const tampered = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'tampered-owner-write');
    assert.ok(tampered?.kind === 'tool_effect' && tampered.result.is_error);
    assert.equal(tampered.result.content, 'injected tampered owner authorization');
    assert.equal(executing.events.some(event => event.kind === 'tool_start' && event.id === 'tampered-owner-write'), false);
    await new Agent(executing, provider('tojson-owner-write'), executingTools).run('try serialized start');
    const serialized = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'tojson-owner-write');
    assert.ok(serialized?.kind === 'tool_effect' && serialized.result.is_error);
    assert.equal(serialized.result.content, 'injected serialized owner authorization');
    assert.equal(executing.events.some(event => event.kind === 'tool_start' && event.id === 'tojson-owner-write'), false);
    assert.equal(owner.events.some(event => event.kind === 'directory_backup'), false);
    assert.equal(fs.readFileSync(file, 'utf8'), 'own-owner-write');
    owner.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(owner, provider('old-generation-write'), ownerTools).run('track original owner');
    const oldStart = owner.events.find(event => event.kind === 'tool_start' && event.id === 'old-generation-write');
    assert.ok(oldStart?.kind === 'tool_start' && oldStart.runtimeWriteOwner);
    borrowedIncarnation = oldStart.runtimeWriteOwner.incarnation;
    const factoryRows = executing.events.filter(row => row.kind === 'runtime_wrapper_observer')
      .filter(row => row.toolUseId === 'borrowed-owner-write');
    assert.equal(factoryRows.length, 6);
    for (const row of factoryRows) {
      assert.equal(row.owner, executing.id);
      assert.deepEqual(row.writeFactory, oldStart.runtimeWriteOwner);
    }
    await runtime.releaseSession!(owner.id);
    assert.equal(ownerLease(), false); assert.equal(executingLease(), true);
    await new Agent(executing, provider('retired-owner-write'), ownerTools).run('track retired wrapper');
    const retired = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'retired-owner-write');
    assert.ok(retired?.kind === 'tool_effect' && retired.result.is_error);
    assert.match(String(retired.result.content), /Runtime session resources were released/);
    assert.equal(executing.events.some(event => event.kind === 'directory_backup' && event.toolUseId === 'retired-owner-write'), false);
    const forged = { kind: 'tool_start' as const, id: 'forged-owner-write', name: 'write_file', parentMessageId: crypto.randomUUID(),
      writeInputDigest: '0'.repeat(64), runtimeWriteOwner: { owner: executing.id, incarnation: crypto.randomUUID() } };
    assert.throws(() => executing.append(forged), /Runtime Write start authorization invalid/);
    const getterForgery = { kind: 'tool_start' as const, id: 'getter-forged-write', name: 'write_file', parentMessageId: crypto.randomUUID(),
      writeInputDigest: '0'.repeat(64) };
    let getterReads = 0;
    Object.defineProperty(getterForgery, 'runtimeWriteOwner', { enumerable: true, get() {
      fs.writeFileSync(accessorEffect, 'UNEXPECTED');
      return getterReads++ === 0 ? undefined : { owner: executing.id, incarnation: crypto.randomUUID() };
    } });
    assert.throws(() => executing.append(getterForgery), /Runtime Write start authorization invalid/);
    assert.equal(fs.existsSync(accessorEffect), false);
    await owner.close();
    reopened = Session.open(ws, { id: owner.id }); await runtime.bindSession!(reopened);
    reopened.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(reopened, provider('rebound-owner-write'), runtime.buildTools(reopened.config, reopened.id)).run('track rebound owner');
    const newStart = reopened.events.find(event => event.kind === 'tool_start' && event.id === 'rebound-owner-write');
    assert.ok(newStart?.kind === 'tool_start' && newStart.runtimeWriteOwner);
    assert.equal(newStart.runtimeWriteOwner.owner, owner.id);
    assert.notEqual(newStart.runtimeWriteOwner.incarnation, oldStart.runtimeWriteOwner.incarnation);
    await new Agent(executing, provider('cancel-before-write-start'), executingTools).run('cancel before start', cancellation.signal);
    assert.equal(executing.events.some(event => event.kind === 'tool_start' && event.id === 'cancel-before-write-start'), false);
    assert.equal(executing.events.some(event => event.kind === 'directory_backup' && event.toolUseId === 'cancel-before-write-start'), false);
    await new Agent(executing, provider('release-before-write-start'), executingTools).run('release before start');
    assert.ok(releasing); await releasing;
    const released = executing.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'release-before-write-start');
    assert.ok(released?.kind === 'tool_effect' && released.result.is_error);
    assert.equal(released.result.content, 'Runtime Write start authorization invalid');
    assert.equal(executing.events.some(event => event.kind === 'tool_start' && event.id === 'release-before-write-start'), false);
    assert.equal(executingLease(), false);
  } finally { Session.prototype.append = append; await owner.close(); await reopened?.close(); await executing.close(); await runtime.close(); }
  const reader = `import {Session} from './src/session.ts';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
    const backups=s.events.filter(x=>x.kind==='directory_backup').map(x=>({owner:x.owner,call:x.toolUseId}));
    const starts=s.events.filter(x=>x.kind==='tool_start').map(x=>({id:x.id,owner:x.runtimeWriteOwner??null}));
    const factories=s.events.filter(x=>x.kind==='runtime_wrapper_observer'&&x.stage==='checkScope'&&x.transition.phase==='admitted'
      &&['borrowed-owner-write','own-owner-write'].includes(x.toolUseId)).map(x=>x.writeFactory);
    process.stdout.write(JSON.stringify({backups,starts,factories,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close()`;
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, ws, executing.id, outside],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { backups: [
      { owner: executing.id, call: 'borrowed-owner-write' }, { owner: executing.id, call: 'own-owner-write' },
    ], starts: [{ id: 'borrowed-owner-write', owner: null },
      { id: 'own-owner-write', owner: { owner: executing.id, incarnation: executingIncarnation } },
      { id: 'post-start-replacement', owner: { owner: executing.id, incarnation: executingIncarnation } },
      { id: 'retired-owner-write', owner: null }], factories: [
        { owner: owner.id, incarnation: borrowedIncarnation }, { owner: executing.id, incarnation: executingIncarnation },
      ], grant: false });
  }
});

test('runtime Write start cannot be forged during event serialization', async () => {
  const ws = fs.realpathSync(tmpDir()), marker = path.join(ws, 'forged-event-effect');
  const config = defaultConfig(ws, createTools()); config.model = 'fixture';
  const session = Session.open(ws, { config });
  try {
    const owner = { owner: session.id, incarnation: crypto.randomUUID() }, parentMessageId = crypto.randomUUID();
    const late = { kind: 'tool_start' as const, id: 'late-forgery', parentMessageId, writeInputDigest: '0'.repeat(64) };
    Object.defineProperty(late, 'name', { enumerable: true, get() {
      fs.writeFileSync(marker, 'UNEXPECTED'); Object.defineProperty(late, 'runtimeWriteOwner', { value: owner, enumerable: true }); return 'write_file';
    } });
    const prototype = Object.create(null);
    Object.defineProperty(prototype, 'toJSON', { value() {
      return { kind: 'tool_start', id: 'serialized-forgery', name: 'write_file', parentMessageId,
        writeInputDigest: '0'.repeat(64), runtimeWriteOwner: owner };
    } });
    const disguised = Object.assign(Object.create(prototype), { kind: 'title', title: 'fixture' });
    const outcomes = [late, disguised].map(event => {
      try { session.append(event); return 'accepted'; } catch { return 'rejected'; }
    });
    assert.deepEqual(outcomes, ['rejected', 'rejected']);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(session.events.some(event => event.kind === 'tool_start' && event.runtimeWriteOwner !== undefined), false);
  } finally { await session.close(); }
});

test('runtime Write execution records reject changed phases and retire with the call', { timeout: 30000 }, async () => {
  for (const scenario of ['parsed-path-redirect', 'ordinary', 'input-after-entry', 'parsed-input-drift', 'start-object-after-append', 'entry-accessor', 'completion-rewrite', 'cancel-after-entry', 'release-before-entry'] as const) {
    const ws = fs.realpathSync(tmpDir()), outside = fs.realpathSync(tmpDir()), file = path.join(outside, 'value');
    fs.writeFileSync(file, 'EXECUTION_ORIGINAL');
    const config = defaultConfig(ws, []); config.model = 'fixture'; config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const cancellation = new AbortController(), toolInput = { path: file, content: 'NO', overwrite: false }; let calls = 0;
    let changeParsedInput = false;
    if (scenario === 'parsed-input-drift') Object.defineProperty(toolInput, 'content', { enumerable: true, get() {
      if (!changeParsedInput) return 'NO'; changeParsedInput = false; return 'CHANGED_AT_PARSE';
    } });
    const provider: ModelProvider = { count: async () => 1, complete: async () => {
      const first = calls++ === 0;
      return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
        content: first ? [{ type: 'tool_use', id: 'execution-write', name: 'write_file', input: toolInput }] :
          [{ type: 'text', text: 'done' }], stop_reason: first ? 'tool_use' : 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    } };
    const runtime = await createRuntime(config, provider, new AbortController().signal);
    config.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(ws, { config }), append = Session.prototype.append;
    const marker = path.join(ws, 'execution-accessor');
    const parse = directoryWriteInputSchema.parse;
    let release: Promise<void> | undefined;
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      Session.prototype.append = function(event, authorization, backupToken, runtimeAuthorization) {
        if (this === session && event.kind === 'runtime_write_execution') {
          if (scenario === 'entry-accessor' && event.phase === 'entered') {
            const changed = { ...event };
            Object.defineProperty(changed, 'runtimeWriteOwner', { enumerable: true, get() {
              fs.writeFileSync(marker, 'UNEXPECTED'); return event.runtimeWriteOwner;
            } });
            assert.throws(() => append.call(this, changed, authorization, backupToken, runtimeAuthorization), /Runtime Write execution authorization invalid/);
            assert.throws(() => append.call(this, event, authorization, backupToken, runtimeAuthorization), /Runtime Write execution authorization invalid/);
            throw new Error('injected rejected execution entry');
          }
          if (scenario === 'completion-rewrite' && event.phase === 'completed') {
            assert.throws(() => append.call(this, { ...event, outcome: 'returned' }, authorization, backupToken, runtimeAuthorization), /Runtime Write execution authorization invalid/);
            assert.throws(() => append.call(this, event, authorization, backupToken, runtimeAuthorization), /Runtime Write execution authorization invalid/);
            throw new Error('injected rejected execution completion');
          }
          if (scenario === 'release-before-entry' && event.phase === 'entered') release = runtime.releaseSession!(session.id);
        }
        const result = append.call(this, event, authorization, backupToken, runtimeAuthorization);
        if (this === session && scenario === 'parsed-path-redirect' && event.kind === 'tool_start' && event.runtimeWriteOwner) {
          directoryWriteInputSchema.parse = (...args) => ({ ...parse(...args), path: marker });
        }
        if (this === session && event.kind === 'tool_start' && scenario === 'start-object-after-append') {
          event.id = 'changed-after-commit'; if (event.runtimeWriteOwner) event.runtimeWriteOwner.incarnation = crypto.randomUUID();
        }
        if (this === session && event.kind === 'tool_start' && scenario === 'parsed-input-drift') changeParsedInput = true;
        if (this === session && event.kind === 'runtime_write_execution' && event.phase === 'entered' && scenario === 'input-after-entry') {
          toolInput.content = 'CHANGED_AFTER_ENTRY'; queueMicrotask(() => { toolInput.content = 'NO'; });
        }
        if (this === session && event.kind === 'runtime_write_execution' && event.phase === 'entered' && scenario === 'cancel-after-entry') cancellation.abort();
        return result;
      };
      await new Agent(session, provider, runtime.buildTools(session.config, session.id)).run('observe actual Write', cancellation.signal);
      if (release) await release;
      const observations = session.events.filter(event => event.kind === 'runtime_write_execution');
      const expected = scenario === 'ordinary' || scenario === 'input-after-entry' || scenario === 'start-object-after-append' ? ['entered', 'completed'] :
        scenario === 'completion-rewrite' || scenario === 'cancel-after-entry' ? ['entered'] : [];
      assert.deepEqual(observations.map(event => event.phase), expected, scenario);
      assert.ok(observations.every(event => event.id === 'execution-write'));
      assert.equal(fs.existsSync(marker), false); assert.equal(fs.readFileSync(file, 'utf8'), 'EXECUTION_ORIGINAL');
      assert.equal(session.events.some(event => event.kind === 'directory_backup'), scenario === 'ordinary' || scenario === 'input-after-entry' || scenario === 'start-object-after-append' || scenario === 'completion-rewrite', scenario);
      if (scenario === 'input-after-entry') {
        const actual = describeDirectoryWriteInput(session, { path: file, content: 'NO', overwrite: false }); assert.ok(actual);
        assert.ok(observations.every(event => event.writeInputDigest === directoryWriteFingerprint(actual)));
      }
      for (const event of observations) assert.throws(() => append.call(session, event), /Runtime Write execution authorization invalid/);
      const effect = session.events.find(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'execution-write');
      assert.ok(effect?.kind === 'tool_effect' && effect.result.is_error);
    } finally { directoryWriteInputSchema.parse = parse; Session.prototype.append = append; await session.close(); await runtime.close(); }
    const reopened = Session.open(ws, { id: session.id });
    try {
      assert.deepEqual(reopened.events.filter(event => event.kind === 'runtime_write_execution'),
        session.events.filter(event => event.kind === 'runtime_write_execution'));
      assert.equal(!!reopened.workingDirectories(false).readHandle?.(outside), false);
    } finally { await reopened.close(); }
    if (scenario === 'ordinary') {
      const original = fs.readFileSync(session.file), rows = original.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      const complete = rows.find(row => row.kind === 'runtime_write_execution' && row.phase === 'completed'); assert.ok(complete);
      for (const mutation of ['owner', 'input', 'phase', 'duplicate', 'outcome'] as const) {
        const changed = structuredClone(rows), row = changed.find(row => row.kind === 'runtime_write_execution' && row.phase === 'completed');
        if (mutation === 'owner') row.runtimeWriteOwner.incarnation = crypto.randomUUID();
        if (mutation === 'input') row.writeInputDigest = '0'.repeat(64);
        if (mutation === 'phase') row.phase = 'entered';
        if (mutation === 'duplicate') changed.push(structuredClone(complete));
        if (mutation === 'outcome') delete row.outcome;
        fs.writeFileSync(session.file, changed.map(row => JSON.stringify(row)).join('\n') + '\n');
        try { assert.throws(() => Session.open(ws, { id: session.id }), mutation); }
        finally { fs.writeFileSync(session.file, original); }
      }
    }
  }
});

test('public runtime APIs cannot mint a Write start without an Agent call', async () => {
  const ws = fs.realpathSync(tmpDir()), outside = fs.realpathSync(tmpDir()), file = path.join(outside, 'value');
  fs.writeFileSync(file, 'ORIGINAL');
  const config = defaultConfig(ws, []); config.model = 'fixture';
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(ws, { config }), call = new PathApprovalCallOwner().begin('counterfeit-write');
  try {
    await runtime.bindSession!(session);
    const tool = runtime.buildTools(session.config, session.id).find(item => item.schema.name === 'write_file'); assert.ok(tool);
    const input = { path: file, content: 'NO', overwrite: true }, parentMessageId = crypto.randomUUID();
    session.append({ kind: 'message', messageId: parentMessageId, message: { role: 'assistant', content: [
      { type: 'tool_use', id: 'counterfeit-write', name: 'write_file', input },
    ] } });
    const witness = describeDirectoryWriteInput(session, input); assert.ok(witness);
    const providerSignal = new AbortController().signal, authorizationSignal = new AbortController().signal;
    const module = await import('../src/runtime-write-start.js'), issue = Reflect.get(module, 'issueRuntimeWriteStart');
    if (typeof issue === 'function') {
      const forged = issue({ session, tool, call, signal: providerSignal, authorizationSignal, value: input,
        id: 'counterfeit-write', parentMessageId, writeInputDigest: directoryWriteFingerprint(witness) });
      if (forged) session.append(forged.event, undefined, undefined, forged.authorization);
    }
    assert.equal(session.events.some(event => event.kind === 'tool_start' && event.id === 'counterfeit-write' && event.runtimeWriteOwner), false);
    assert.equal(fs.readFileSync(file, 'utf8'), 'ORIGINAL');
  } finally { call.finish('cancelled'); await session.close(); await runtime.close(); }
});

test('a direct runtime Write call has no Agent-issued start even after an identical start', async () => {
  const ws = fs.realpathSync(tmpDir()), outside = fs.realpathSync(tmpDir()), file = path.join(outside, 'value');
  fs.writeFileSync(file, 'DIRECT_ORIGINAL');
  const config = defaultConfig(ws, []); config.model = 'fixture'; config.permissions = { mode: 'bypass', allow: [], deny: [] };
  let calls = 0;
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    const first = calls++ === 0;
    return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
      content: first ? [{ type: 'tool_use', id: 'direct-write', name: 'write_file', input: { path: file, content: 'AGENT', overwrite: true } }] :
        [{ type: 'text', text: 'done' }], stop_reason: first ? 'tool_use' : 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
  } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(ws, { config });
  const append = Session.prototype.append;
  try {
    await runtime.bindSession!(session);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const tools = runtime.buildTools(session.config, session.id), tool = tools.find(item => item.schema.name === 'write_file'); assert.ok(tool);
    const capture: { start?: { kind: 'tool_start'; id: string; parentMessageId?: string; runtimeWriteOwner?: { owner: string; incarnation: string } } } = {};
    Session.prototype.append = function(event, authorization, backupToken, runtimeAuthorization) {
      const result = append.call(this, event, authorization, backupToken, runtimeAuthorization);
      if (this === session && event.kind === 'tool_start' && event.id === 'direct-write') capture.start = structuredClone(event);
      return result;
    };
    await new Agent(session, provider, tools).run('agent start');
    Session.prototype.append = append;
    assert.ok(capture.start?.runtimeWriteOwner);
    const beforeDirect = fs.readFileSync(session.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const execution = beforeDirect.filter(row => row.kind === 'runtime_write_execution');
    assert.deepEqual(execution.map(row => ({ phase: row.phase, outcome: row.outcome ?? null })), [
      { phase: 'entered', outcome: null }, { phase: 'completed', outcome: 'returned' },
    ]);
    for (const row of execution) {
      assert.equal(row.id, 'direct-write'); assert.equal(row.parentMessageId, capture.start.parentMessageId);
      assert.deepEqual(row.runtimeWriteOwner, capture.start.runtimeWriteOwner);
      assert.throws(() => session.append(row), /Runtime Write execution authorization invalid/);
    }
    assert.ok(beforeDirect.indexOf(execution[0]) < beforeDirect.findIndex(row => row.kind === 'directory_backup'));
    assert.ok(beforeDirect.indexOf(execution[1]) < beforeDirect.findIndex(row => row.kind === 'tool_effect'));
    const input = { path: file, content: 'DIRECT', overwrite: true };
    await assert.rejects(tool.execute(input, { workspace: ws, signal: new AbortController().signal, allowShell: false,
      maxOutputBytes: 24_000, session, toolUseId: 'direct-write', workingDirectories: () => session.workingDirectories(false) }), /additional directory grants/);
    const backups = session.directoryBackups;
    assert.equal(backups.length, 1);
    assert.ok(backups.every(backup => backup.kind === 'valid' && backup.witness.owner === session.id));
    assert.equal(fs.readFileSync(file, 'utf8'), 'AGENT');
    const rows = fs.readFileSync(session.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.filter(row => row.kind === 'tool_start' && row.id === 'direct-write').length, 1);
    assert.equal(rows.filter(row => row.kind === 'directory_backup' && row.toolUseId === 'direct-write').length, 1);
    assert.deepEqual(rows.filter(row => row.kind === 'runtime_write_execution'), execution);
  } finally { Session.prototype.append = append; await session.close(); await runtime.close(); }
});

test('createRuntime surfaces an MCP connect failure without leaking the provider', async () => {
  const ws = tmpDir();
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  config.mcpServers = { bad: { command: process.execPath, args: ['-e', 'process.exit(0)'] } };
  await assert.rejects(createRuntime(config, unusedProvider, new AbortController().signal));
});

// ---------------------------------------------------------------------------
// The assembled config integrates with the session layer
// ---------------------------------------------------------------------------

test('thinking progress events, durable task notifications and completion timing recover under their owners', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, []); config.model = 'test'; config.features = {tasks:true, subagents:false};
  config.permissions = {mode:'default', allow:['task_*'], deny:[]};
  const progress: AgentProgressEvent[] = []; let calls = 0; let taskId = '';
  const provider: ModelProvider = {count:async () => 1, complete:async (_request,_signal,onText,onThinking) => {
    calls++; onThinking?.();
    if (calls <= 2) return {id:'fixture',model:'test',role:'assistant',type:'message',content:[{type:'tool_use',
      id:'call-'+calls,name:calls === 1 ? 'task_create' : 'task_update',input:calls === 1
        ? {subject:'Fixture task',description:'owned',activeForm:'Building fixture'} : {id:taskId,status:'in_progress'}}],
      stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1}} as Anthropic.Message;
    onText?.('done'); return {id:'fixture',model:'test',role:'assistant',type:'message',content:[{type:'text',text:'done'}],
      stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}} as Anthropic.Message;
  }};
  const runtime = await createRuntime(config,provider,new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const {Session} = await import('../src/session.js'); const session=Session.open(ws,{config});
  let updates=0; const stop=runtime.subscribeTasks!(config,() => {
    updates++; taskId=runtime.taskRecords!(config)[0]?.id ?? '';
  });
  try {
    await new Agent(session,provider,runtime.buildTools(config,session.id),{progress:event=>progress.push(event)}).run('Build fixture',new AbortController().signal);
    assert.ok(updates >= 2); assert.equal(runtime.taskRecords!(config)[0]?.status,'in_progress');
    assert.equal(progress[0]?.kind,'start'); assert.ok(progress.some(event=>event.kind==='phase'&&event.mode==='thinking'));
    assert.ok(progress.some(event=>event.kind==='phase'&&event.mode==='tool-use'));
    assert.equal(progress.at(-1)?.kind,'finish');
    const end=session.events.findLast(event=>event.kind==='turn_end'); assert.ok(end?.kind==='turn_end'&&end.duration);
    assert.ok(end.duration.durationMs >= 0); assert.equal(new Date(end.duration.timestamp).toISOString(),end.duration.timestamp);
    assert.deepEqual(runtime.taskRecords!({...config,features:{tasks:false,subagents:false}}),[]);
    session.close(); const restored=Session.open(ws,{id:session.id});
    try {assert.deepEqual(restored.events.findLast(event=>event.kind==='turn_end'),end);} finally {restored.close();}
    stop(); const stopped=updates;
    await runtime.buildTools(config,session.id).find(tool=>tool.schema.name==='task_update')!.execute({id:taskId,status:'completed'},toContext(ws));
    await delay(40); assert.equal(updates,stopped);
  } finally {stop();session.close();await runtime.close();}
});

test('a modern session round-trips runtime fields and rebuilt tools match the pinned schemas', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  config.skills = [skill()];
  config.features = { tasks: true, subagents: true };
  config.permissions = { mode: 'acceptEdits', allow: ['read_*'], deny: ['run_command'] };
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    config.tools = pinToolSchemas(runtime.tools);
    validateRuntimeConfig(config);
    const { Session } = await import('../src/session.js');
    const session = Session.open(ws, { config });
    try {
      assert.deepEqual(session.config.features, { tasks: true, subagents: true });
      assert.equal(session.config.skills?.length, 1);
      assert.deepEqual(session.config.permissions, { mode: 'acceptEdits', allow: ['read_*'], deny: ['run_command'] });
      assert.equal('env' in (session.config.mcpServers ?? {}), false);
      // Rebuilding tools for the resumed config must reproduce the pinned schemas,
      // which is what the Agent constructor enforces on resume.
      assert.doesNotThrow(() => new Agent(session, unusedProvider, runtime.buildTools(session.config)));
    } finally { session.close(); }
  } finally { await runtime.close(); }
});

// ---------------------------------------------------------------------------
// Session hook snapshots: optional stopRequested
// ---------------------------------------------------------------------------

test('a session hook_result round-trips an optional stopRequested and keeps legacy events unchanged', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  validateRuntimeConfig(config);
  const { Session } = await import('../src/session.js');
  // A legacy Stop result has no stopRequested; a terminal one adds it.
  const legacy = { kind: 'hook_result' as const, id: 'h1', event: 'Stop', blocked: true, reason: 'keep going', additionalContext: [] };
  const terminal = { kind: 'hook_result' as const, id: 'h2', event: 'Stop', blocked: true, additionalContext: [], stopRequested: true };
  const session = Session.open(ws, { config });
  try {
    session.append(legacy);
    session.append(terminal);
    const stored = session.events.filter((event) => event.kind === 'hook_result');
    assert.equal(stored.length, 2);
    // Absence is preserved: no default field is added to the legacy snapshot.
    assert.equal('stopRequested' in stored[0]!, false);
    assert.equal((stored[0] as { stopRequested?: boolean }).stopRequested, undefined);
    assert.equal((stored[1] as { stopRequested?: boolean }).stopRequested, true);
  } finally { session.close(); }
});
