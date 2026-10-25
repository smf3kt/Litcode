import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { persistAutoModeUpdate } from '../src/auto-mode-rules.js';
import { saveViewModeSetting } from '../src/focus-command.js';
import { interactiveLoop } from '../src/interactive.js';
import { persistPermissionUpdate, permissionSettingsPaths } from '../src/permission-settings.js';
import { setPluginEnabled } from '../src/plugin-toggle.js';
import { createPluginTools } from '../src/plugins.js';
import { PromptSuggestionStore } from '../src/prompt-suggestion-store.js';
import { PromptSuggestionRun } from '../src/prompt-suggestions.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime } from '../src/runtime.js';
import { saveScrollSpeedSetting } from '../src/scroll-speed.js';
import { Session } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { type SettingsWrite, subscribeSettingsWrites } from '../src/setting-writes.js';
import { saveSkillOverrides } from '../src/skills-panel.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';
import { saveAutoCompactSetting, saveConfigPanelSetting, saveEffortSetting, saveThemeSetting } from '../src/theme-settings.js';
import { markStashUsed } from '../src/tui-stash.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'live-setting-sources-')));
  const workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', settingSources: [], configSources: { userDir } };
  return { root, workspace, userDir, write, config, user: path.join(userDir, 'settings.json') };
}

test('dedicated writers publish committed presence and preserve successful writes when an observer throws', async () => {
  const f = fixture(), events: SettingsWrite[] = [];
  const failedObserver = subscribeSettingsWrites(() => { throw new Error('owned observer failure'); });
  const release = subscribeSettingsWrites(write => {
    assert.ok(Object.isFrozen(write));
    assert.deepEqual(Object.keys(write).sort(), ['file', 'present']);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(write.file, 'utf8')));
    events.push(write);
  });
  const written = async (operation: () => unknown, expected: boolean, file = f.user) => {
    const count = events.length;
    await operation();
    assert.equal(events.length, count + 1);
    assert.deepEqual(events.at(-1), { file, present: expected });
  };
  try {
    f.write(f.user, { preferredNotifChannel: 'invalid', promptSuggestionEnabled: 'invalid' });
    await written(() => saveAutoCompactSetting(100000, f.userDir), true);
    await written(() => saveAutoCompactSetting(undefined, f.userDir), false);
    await written(() => saveThemeSetting('dark', f.userDir), true);
    await written(() => saveViewModeSetting('focus', f.userDir), true);
    await written(() => saveScrollSpeedSetting(3, f.userDir), true);
    await written(() => markStashUsed(f.userDir), true);
    const unchanged = events.length;
    markStashUsed(f.userDir); saveEffortSetting('max', f.userDir);
    assert.equal(events.length, unchanged);
    await written(() => persistAutoModeUpdate(f.user, { kind: 'add', section: 'soft_deny', text: 'owned local rule' }), true);
    f.write(f.user, { promptSuggestionUnusedStreak: 20 });
    await written(() => new PromptSuggestionStore(f.userDir).enable(new PromptSuggestionRun()), true);
    const local = path.join(f.workspace, '.harness/settings.local.json');
    await written(() => saveSkillOverrides(local, { helper: 'off' }), true, local);
    await written(() => saveSkillOverrides(local, { helper: undefined }), false, local);
    const project = path.join(f.workspace, '.harness/settings.json');
    const plugin = path.join(f.root, 'plugin');
    fs.mkdirSync(plugin); f.write(path.join(plugin, 'plugin.json'), { name: 'owned', version: '1.0' });
    const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    assert.ok(install);
    await install.execute({ directory: plugin }, { workspace: f.workspace, signal: new AbortController().signal,
      allowShell: false, maxOutputBytes: 10000 });
    await written(async () => {
      assert.equal((await setPluginEnabled({ ...f.config, plugins: { enabled: true } }, 'owned', false)).success, true);
    }, true, project);
    const beforeFailure = events.length;
    f.write(f.user, '{');
    assert.throws(() => saveThemeSetting('light', f.userDir), SyntaxError);
    assert.equal((await persistPermissionUpdate({ type: 'setMode', mode: 'plan', destination: 'userSettings' },
      permissionSettingsPaths(f.workspace, f.userDir), false)).outcome, 'error');
    assert.equal(events.length, beforeFailure);
    assert.equal(fs.readFileSync(f.user, 'utf8'), '{');
  } finally { release(); failedObserver(); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('live sources stay separate from pinned metadata across local merges, aliases, forks and cleanup', async () => {
  const f = fixture(), sessions: Session[] = [];
  const open = (config = f.config) => { const session = Session.open(f.workspace, { config }); sessions.push(session); return session; };
  try {
    fs.mkdirSync(path.join(f.workspace, '.git'));
    const nested = path.join(f.workspace, 'nested'); fs.mkdirSync(nested);
    const current = Session.open(nested, { config: { ...f.config, workspace: nested,
      configSources: { ...f.config.configSources, settingsFile: f.user } } });
    sessions.push(current);
    const initial = fs.readFileSync(current.file), pinned = structuredClone(current.config);
    const otherUser = path.join(f.root, 'other-user'); fs.mkdirSync(otherUser);
    const other = open({ ...f.config, configSources: { userDir: otherUser } });
    const historical = Session.open(f.workspace, { config: { ...defaultConfig(f.workspace, []), model: 'historical', configSources: { userDir: f.userDir } } });
    sessions.push(historical);
    saveAutoCompactSetting(100000, f.userDir);
    assert.deepEqual(current.settingSources, [{ source: 'userSettings' }, { source: 'flagSettings' }]);
    assert.deepEqual(other.settingSources, []);
    assert.equal(historical.settingSources, undefined);
    assert.deepEqual(current.config, pinned);
    assert.ok(initial.equals(fs.readFileSync(current.file)));
    const paths = permissionSettingsPaths(nested, f.userDir);
    assert.ok(paths.localSettings); assert.ok(paths.legacyLocalSettings);
    saveSkillOverrides(paths.legacyLocalSettings, { legacy: 'off' });
    saveSkillOverrides(paths.localSettings, { current: 'off' });
    saveSkillOverrides(paths.localSettings, { current: undefined });
    assert.deepEqual(current.settingSources, [{ source: 'userSettings' }, { source: 'localSettings' }, { source: 'flagSettings' }]);
    f.write(paths.legacyLocalSettings, '{');
    saveSkillOverrides(paths.localSettings, {});
    assert.deepEqual(current.settingSources, [{ source: 'userSettings' }, { source: 'flagSettings' }], 'a failed sibling parse has no settings contribution');
    const result = await persistPermissionUpdate({ type: 'addRules', behavior: 'allow', destination: 'localSettings',
      rules: [{ toolName: 'Read' }] }, paths, false);
    assert.equal(result.outcome, 'written');
    assert.deepEqual(current.settingSources, [{ source: 'userSettings' }, { source: 'localSettings' }, { source: 'flagSettings' }]);
    const runtimeConfig = { ...current.config, features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
    const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Owned child completion'); } };
    const runtime = await createRuntime(runtimeConfig, provider, new AbortController().signal);
    try {
      runtime.buildTools(runtimeConfig, current.id);
      runtime.backgroundWorkCount?.(current.id);
      const launched = await runtime.launchSubtask!({ ...current.snapshotConfig(), features: runtimeConfig.features }, current.id,
        'owned child', new AbortController().signal, [{ role: 'user', content: 'owned parent context' }]);
      assert.equal(launched.kind, 'forked');
    } finally { await runtime.close(); }
    const copy = current.snapshotConfig(); copy.settingSources?.splice(0);
    assert.equal(current.settingSources?.length, 3);
    const fork = forkSession(current); sessions.push(fork);
    assert.deepEqual(fork.config.settingSources, current.settingSources);
    const forkId = fork.id; await fork.close();
    saveAutoCompactSetting(undefined, f.userDir);
    assert.deepEqual(current.settingSources, [{ source: 'localSettings' }]);
    assert.deepEqual(fork.settingSources, [{ source: 'userSettings' }, { source: 'localSettings' }, { source: 'flagSettings' }]);
    const resumedFork = Session.open(nested, { id: forkId }); sessions.push(resumedFork);
    assert.deepEqual(resumedFork.settingSources, fork.settingSources);
    const originalId = current.id; await current.close();
    const original = Session.open(nested, { id: originalId }); sessions.push(original);
    assert.deepEqual(original.settingSources, []);
    assert.ok(initial.equals(fs.readFileSync(original.file)));
    const failedLegacyPaths = { userSettings: f.user, localSettings: paths.localSettings, legacyLocalSettings: paths.legacyLocalSettings };
    fs.unlinkSync(paths.legacyLocalSettings); fs.mkdirSync(paths.legacyLocalSettings);
    const partial = await persistPermissionUpdate({ type: 'addRules', behavior: 'deny', destination: 'localSettings',
      rules: [{ toolName: 'Write' }] }, failedLegacyPaths, false);
    assert.equal(partial.outcome, 'error');
    assert.equal(JSON.parse(fs.readFileSync(paths.localSettings, 'utf8')).permissions.deny[0], 'Write');
    assert.deepEqual(original.settingSources, [{ source: 'localSettings' }], 'the canonical commit survives the aggregate legacy error');
  } finally { for (const session of sessions) await session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('Config saves update passive Status in place and clear captures the live sources', async () => {
  const f = fixture(); let callbacks: TerminalCallbacks | undefined, calls = 0, configVisits = 0;
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const provider: ModelProvider = { count: async () => 0, complete: async () => { calls++; throw new Error('Unexpected completion'); } };
  const session = Session.open(f.workspace, { config: f.config });
  const original = fs.readFileSync(session.file), status: TerminalPromptRequest[] = [];
  let shown = () => {};
  const nextPrompt = () => new Promise<void>(resolve => { shown = resolve; });
  const terminal: TerminalSurface = { isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks?.onSubmit?.('/config')); }, close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      if (request.configPanel) {
        configVisits++;
        await request.configPanel.change({ id: 'dialogExpiry', value: configVisits === 1 ? '60s' : 'default' });
      } else status.push(request);
      shown(); return undefined;
    } };
  let settled = nextPrompt();
  const loop = interactiveLoop(session, provider, { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
    { input: new PassThrough(), output, status: output, signal: new AbortController().signal, terminal });
  const submit = async (command: string) => { settled = nextPrompt(); setImmediate(() => callbacks?.onSubmit?.(command)); await settled; };
  try {
    await settled;
    assert.deepEqual(session.settingSources, [{ source: 'userSettings' }]);
    assert.deepEqual(session.config.settingSources, []);
    await submit('/status');
    assert.match(status.at(-1)!.message, /Setting sources: User settings$/);
    f.write(f.user, '{');
    await submit('/status');
    assert.match(status.at(-1)!.message, /Setting sources: User settings$/);
    assert.ok(original.equals(fs.readFileSync(session.file)));
    f.write(f.user, { dialogExpiry: '60s' });
    await submit('/config');
    assert.deepEqual(session.settingSources, []);
    await saveConfigPanelSetting({ id: 'dialogExpiry', value: 'never' }, f.workspace, f.userDir);
    setImmediate(() => { callbacks?.onSubmit?.('/clear'); callbacks?.onSubmit?.('/status'); });
    await (settled = nextPrompt());
    assert.match(status.at(-1)!.message, /Setting sources: User settings$/);
    const files = fs.readdirSync(path.join(f.workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
    assert.equal(files.length, 2);
    const successor = files.find(name => name !== path.basename(session.file)); assert.ok(successor);
    const metadata = JSON.parse(fs.readFileSync(path.join(f.workspace, '.agent', successor), 'utf8').split('\n')[0]!);
    assert.deepEqual(metadata.config.settingSources, [{ source: 'userSettings' }]);
    assert.ok(original.equals(fs.readFileSync(session.file)));
    callbacks?.onExit?.(); await loop;
    assert.equal(calls, 0);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally { callbacks?.onExit?.(); await loop; await session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});
