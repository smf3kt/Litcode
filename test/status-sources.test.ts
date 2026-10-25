import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { interactiveLoop } from '../src/interactive.js';
import { DEFAULT_GATEWAY, type ModelProvider } from '../src/provider.js';
import { reloadConfig } from '../src/reload.js';
import { configSchema, Session } from '../src/session.js';
import { settingSourcesSchema } from '../src/setting-sources.js';
import { settingSourceRows, statusPanelRows } from '../src/status-panel.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'status-sources-')));
  const workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user'), managed = path.join(root, 'managed');
  for (const directory of [workspace, userDir, managed]) fs.mkdirSync(directory);
  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const options = { userDir, managedSettingsDir: managed };
  return { root, workspace, userDir, managed, write, options };
}

test('setting sources use parsed nonempty layers and accepted managed file and drop-in content', () => {
  const f = fixture();
  const load = () => loadProjectConfig(f.workspace, f.options);
  try {
    assert.deepEqual(load().settingSources, []);
    f.write(path.join(f.userDir, 'settings.json'), {});
    f.write(path.join(f.workspace, '.harness/settings.json'), { preferredNotifChannel: 'invalid' });
    f.write(path.join(f.managed, 'managed-settings.json'), { managedSourcesBehavior: 'merge' });
    f.write(path.join(f.managed, 'managed-settings.d/10-invalid.json'), '{');
    assert.deepEqual(load().settingSources, [], 'opened, invalid and ignored-only documents are not contributions');
    f.write(path.join(f.userDir, 'settings.json'), { model: 'fixture' });
    f.write(path.join(f.workspace, '.harness/settings.json'), { theme: 'dark' });
    f.write(path.join(f.workspace, '.harness/settings.local.json'), { prefersReducedMotion: true });
    const flag = path.join(f.root, 'flag.json'); f.write(flag, { thinking: false });
    f.write(path.join(f.managed, 'managed-settings.json'), { spinnerTipsEnabled: false });
    f.write(path.join(f.managed, 'managed-settings.d/20-valid.json'), { features: { tasks: false } });
    const loaded = loadProjectConfig(f.workspace, { ...f.options, settingsFile: flag });
    assert.deepEqual(loaded.settingSources, [{ source: 'userSettings' }, { source: 'projectSettings' },
      { source: 'localSettings' }, { source: 'flagSettings' }, { source: 'policySettings', origin: 'file + drop-ins' }]);
    assert.deepEqual(loaded.permissionLayers, [], 'ordinary settings still have full provenance');
    assert.equal(settingSourceRows(loaded.settingSources)[0]!.value,
      'User settings, Shared project settings, Project local settings, Command line arguments, Enterprise managed settings (file + drop-ins)');
    f.write(path.join(f.managed, 'managed-settings.json'), {});
    assert.deepEqual(load().settingSources.at(-1), { source: 'policySettings', origin: 'drop-ins' });
    f.write(path.join(f.managed, 'managed-settings.d/20-valid.json'), {});
    f.write(path.join(f.managed, 'managed-settings.json'), { spinnerTipsEnabled: false });
    assert.deepEqual(load().settingSources.at(-1), { source: 'policySettings', origin: 'file' });
    f.write(path.join(f.managed, 'managed-settings.d/20-valid.json'), { features: { invented: true } });
    assert.equal(load().settingSources.some(item => item.source === 'policySettings'), false, 'rejected merged policy contributes nothing');
    const policy = path.join(f.root, 'policy.json'); f.write(policy, {});
    assert.equal(loadProjectConfig(f.workspace, { ...f.options, managedSettingsFile: policy }).settingSources.some(item => item.source === 'policySettings'), false);
    f.write(policy, { spinnerTipsEnabled: false });
    assert.deepEqual(loadProjectConfig(f.workspace, { ...f.options, managedSettingsFile: policy }).settingSources.at(-1),
      { source: 'policySettings', origin: 'file' });
    fs.mkdirSync(path.join(f.workspace, '.git'));
    const nested = path.join(f.workspace, 'nested'); fs.mkdirSync(nested);
    f.write(path.join(nested, '.harness/settings.local.json'), { showTurnDuration: false });
    const merged = loadProjectConfig(nested, f.options);
    assert.equal(merged.settingSources.filter(item => item.source === 'localSettings').length, 1);
    assert.equal(merged.settings.prefersReducedMotion, true);
    assert.equal(merged.settings.showTurnDuration, false);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('typed provenance preserves original resume, historical absence and failed reload ownership', () => {
  const f = fixture(); let opened: Session | undefined;
  try {
    const policy = path.join(f.root, 'policy.json'); f.write(policy, {});
    f.write(path.join(f.userDir, 'settings.json'), { theme: 'dark' });
    const loaded = loadProjectConfig(f.workspace, { userDir: f.userDir, managedSettingsFile: policy });
    const config = { ...defaultConfig(f.workspace, []), model: 'fixture', configSources: { userDir: f.userDir, managedSettingsFile: policy },
      settingSources: loaded.settingSources };
    assert.equal(configSchema.safeParse(config).success, true);
    assert.equal(settingSourcesSchema.safeParse([{ source: 'policySettings' }]).success, false);
    assert.equal(settingSourcesSchema.safeParse([{ source: 'userSettings', origin: 'file' }]).success, false);
    assert.equal(settingSourcesSchema.safeParse([{ source: 'userSettings' }, { source: 'userSettings' }]).success, false);
    assert.equal(settingSourcesSchema.safeParse(Array.from({ length: 6 }, () => ({ source: 'userSettings' }))).success, false);
    opened = Session.open(f.workspace, { config });
    const original = opened.id, file = opened.file, bytes = fs.readFileSync(file);
    f.write(path.join(f.userDir, 'settings.json'), {});
    f.write(path.join(f.workspace, '.harness/settings.local.json'), { prefersReducedMotion: true });
    const next = reloadConfig(opened.config);
    assert.deepEqual(next.settingSources, [{ source: 'localSettings' }]);
    assert.deepEqual(opened.config.settingSources, [{ source: 'userSettings' }]);
    f.write(path.join(f.workspace, '.harness/settings.json'), '{');
    assert.throws(() => reloadConfig(next), /JSON/);
    assert.deepEqual(next.settingSources, [{ source: 'localSettings' }]);
    opened.close(); opened = Session.open(f.workspace, { id: original });
    assert.deepEqual(opened.config.settingSources, [{ source: 'userSettings' }]);
    assert.ok(bytes.equals(fs.readFileSync(file)));
    opened.close();
    const old = { ...defaultConfig(f.workspace, []), model: 'fixture' };
    opened = Session.open(f.workspace, { config: old }); const historical = opened.id;
    opened.close(); opened = Session.open(f.workspace, { id: historical });
    assert.equal(Object.hasOwn(opened.config, 'settingSources'), false);
    const input = { version: '1', sessionId: 'fixture', sessionKind: 'interactive', cwd: f.workspace, model: 'fixture' };
    assert.equal(statusPanelRows(input).some(row => row.label === 'Setting sources'), false);
    assert.deepEqual(statusPanelRows({ ...input, settingSources: [] }).at(-1), { label: 'Setting sources', value: '' });
    assert.equal(settingSourceRows([{ source: 'flagSettings' }, { source: 'userSettings' }])[0]!.value, 'User settings, Command line arguments');
  } finally { opened?.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('/status passes accepted setting sources without disk adoption and preserves piped JSON', async () => {
  const f = fixture();
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const config = { ...defaultConfig(f.workspace, []), model: 'fixture', configSources: { userDir: f.userDir },
    settingSources: settingSourcesSchema.parse([{ source: 'userSettings' }]),
    gateway: { ...DEFAULT_GATEWAY, baseURL: 'http://127.0.0.1:9999', tokenCounting: 'estimate' as const } };
  const session = Session.open(f.workspace, { config });
  let callbacks: TerminalCallbacks | undefined, calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => { calls++; throw new Error('Unexpected completion'); } };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const prompts: TerminalPromptRequest[] = [];
  let shown = () => {};
  const nextPrompt = () => new Promise<void>(resolve => { shown = resolve; });
  const terminal: TerminalSurface = { isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/status')); }, close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) { prompts.push(request); shown(); return undefined; } };
  const before = fs.readFileSync(session.file), first = nextPrompt();
  const loop = interactiveLoop(session, provider, runtime, { input: new PassThrough(), output, status: output,
    signal: new AbortController().signal, terminal });
  try {
    await first;
    assert.match(prompts[0]!.message, /Setting sources: User settings$/);
    assert.deepEqual(prompts[0]!.statusRows?.at(-1), { label: 'Setting sources', value: 'User settings' });
    f.write(path.join(f.userDir, 'settings.json'), '{');
    const second = nextPrompt(); setImmediate(() => callbacks!.onSubmit!('/status')); await second;
    assert.equal(prompts[1]!.message, prompts[0]!.message);
    assert.ok(before.equals(fs.readFileSync(session.file)));
    callbacks!.onExit!(); await loop; session.close();
    const piped = Session.open(f.workspace, { config });
    const input = new PassThrough(); let printed = '';
    const sink = new Writable({ write(chunk, _encoding, done) { printed += String(chunk); done(); } });
    try {
      const pipedLoop = interactiveLoop(piped, provider, runtime, { input, output: sink, status: output, signal: new AbortController().signal });
      input.end('/status\n/exit\n'); await pipedLoop;
      assert.deepEqual(JSON.parse(printed), { session: piped.id, model: 'fixture', theme: 'dark', gateway: 'http://127.0.0.1:9999',
        unfinished: false, contextTokens: 1000000, compactAt: 512000, skills: 0, counting: 'estimate', cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0 });
    } finally { piped.close(); }
    assert.equal(calls, 0);
  } finally { callbacks?.onExit?.(); await loop; session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});
