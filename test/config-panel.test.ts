import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { configPanelInput } from '../src/config-panel-input.js';
import type { ConfigPanelInput, ConfigUpdate } from '../src/config-panel.js';
import { configuredEffort } from '../src/effort-command.js';
import { modelPickerRequest } from '../src/model-picker.js';
import { parseSettings } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { saveConfigModelEffort, saveConfigPanelSetting, saveEffortSetting } from '../src/theme-settings.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

function fixture() {
  const screen = new HeadlessTerminal({ cols: 90, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (typeof core !== 'object' || core === null || !('writeSync' in core) || typeof core.writeSync !== 'function')
    throw new Error('Pinned xterm synchronous decoder is unavailable');
  const write = core.writeSync.bind(core);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { write(String(chunk)); done(); } }),
    { isTTY: true, columns: 90, rows: 30 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const rowOf = (text: string) => lines().findIndex(row => row.trim() === text);
  const mouse = (button: number, row: number, col: number, release = false) => key(`\x1b[<${button};${col};${row + 1}${release ? 'm' : 'M'}`);
  const escape = async () => { key('\x1b'); await delay(65); };
  return { screen, tui, key, lines, rowOf, mouse, escape,
    resize(columns: number, rows: number) { output.columns = columns; output.rows = rows; screen.resize(columns, rows); output.emit('resize'); },
    close() { tui.close(); screen.dispose(); } };
}

const input: ConfigPanelInput = { config: { model: 'model-01', thinking: false }, hidden: [] };

function updated(state: ConfigPanelInput, change: ConfigUpdate): ConfigPanelInput {
  switch (change.id) {
    case 'autoCompact': return { ...state, config: { ...state.config, autoCompactEnabled: change.value } };
    case 'verbose': return { ...state, config: { ...state.config, verbose: change.value } };
    case 'progressBar': return { ...state, config: { ...state.config, terminalProgressBarEnabled: change.value } };
    case 'reduceMotion': return { ...state, config: { ...state.config, prefersReducedMotion: change.value } };
    case 'tips': return { ...state, config: { ...state.config, spinnerTipsEnabled: change.value } };
    case 'copyOnSelect': return { ...state, config: { ...state.config, copyOnSelect: change.value } };
    case 'copyFullResponse': return { ...state, config: { ...state.config, copyFullResponse: change.value } };
    case 'notifChannel': return { ...state, config: { ...state.config, preferredNotifChannel: change.value } };
    case 'autoScroll': return { ...state, config: { ...state.config, autoScrollEnabled: change.value } };
    case 'thinking': return { ...state, config: { ...state.config, thinking: change.value } };
    case 'turnDuration': return { ...state, config: { ...state.config, showTurnDuration: change.value } };
    case 'editor': return { ...state, config: { ...state.config, editorMode: change.value } };
    case 'timeFormat': return { ...state, config: { ...state.config, timeFormat: change.value } };
    case 'askUserQuestionTimeout': return { ...state, config: { ...state.config, askUserQuestionTimeout: change.value } };
    case 'dialogExpiry': return { ...state, config: { ...state.config, dialogExpiry: change.value === 'default' ? undefined : change.value } };
    case 'permissionMode': return { ...state, config: { ...state.config,
      permissions: { ...(state.config.permissions ?? { mode: 'default' as const, allow: [], deny: [] }), defaultMode: change.value } } };
  }
}

test('config modal owns full query editing, immediate changes, errors and child handoff without leaking the draft', async () => {
  const f = fixture();
  let state = input, fail = false;
  const changes: ConfigUpdate[] = [];
  const host = () => ({ input: state, change: async (change: ConfigUpdate) => {
    if (fail) throw new Error('owned write failed');
    changes.push(change); state = updated(state, change); return state;
  } });
  try {
    f.key('retained draft');
    let pending = f.tui.prompt({ message: '', configPanel: host() }, new AbortController().signal);
    assert.equal(f.lines().filter(row => /^(Verbose output|Terminal progress bar|Auto-compact|Reduce motion|Thinking mode|Show turn duration|Time format|Default permission mode|Theme|Editor mode|Question auto-continue timeout|Model|Dialog expiry)\s/.test(row)).length, 13);
    f.key('tips\r '); await delay(0);
    assert.deepEqual(changes.pop(), { id: 'tips', value: false });
    assert.ok(f.lines().includes('Show tips  false'));
    f.key('/MOTION\r\r'); await delay(0);
    assert.deepEqual(changes, [{ id: 'reduceMotion', value: true }]);
    assert.ok(f.lines().includes('Reduce motion  true'));
    f.key('/vim\r\x1b[C'); await delay(0);
    assert.deepEqual(changes.at(-1), { id: 'editor', value: 'vim' });
    assert.ok(f.lines().includes('Editor mode  ‹ vim ›'));
    f.key('/thinking\r'); fail = true; f.key(' '); await delay(0);
    assert.ok(f.lines().some(row => row.includes('owned write failed')));
    assert.ok(f.lines().includes('Thinking mode  false'));
    fail = false; f.key('\x1b[C'); await delay(0);
    assert.ok(f.lines().includes('Thinking mode  true'));
    f.key('/24-hour\r\x1b[D'); assert.equal(f.tui.currentScreen, 'dialog');
    assert.ok(f.lines().some(row => row.startsWith('Time format')));
    f.key('\r');
    const child = await pending;
    assert.deepEqual(child?.configPanel, { state: { query: '24-hour', cursor: 7, focus: 'timeFormat', mode: 'list' }, open: 'timeFormat' });
    assert.equal(f.tui.state.text, 'retained draft');
    pending = f.tui.prompt({ message: '', configPanel: { ...host(), input: { ...state, state: child!.configPanel!.state } } }, new AbortController().signal);
    f.key('/'); f.key('t'); assert.ok(f.lines().some(row => row.includes('⌕ t')));
    f.key('\x15\x1b[200~editor\r\nignored\x1b[201~');
    assert.ok(f.lines().some(row => row.includes('⌕ editor')));
    assert.equal(f.lines().some(row => row.includes('ignored')), false);
    await f.escape(); assert.ok(f.lines().some(row => row.includes('⌕ Search settings')));
    f.key('missing'); f.key('\r\x1b[B');
    assert.ok(f.lines().some(row => row.includes('No settings match "missing"')));
    assert.ok(f.lines().some(row => row.includes('Type to filter')));
    await f.escape(); await f.escape(); await f.escape(); await pending;
    assert.equal(f.tui.state.text, 'retained draft');
    f.resize(20, 24);
    pending = f.tui.prompt({ message: '', configPanel: host() }, new AbortController().signal);
    f.key('abcdefghijklmno');
    assert.ok(f.lines().some(row => row.includes('⌕ abcdefgh…')));
    assert.equal(f.screen.buffer.active.cursorY, 2); assert.equal(f.screen.buffer.active.cursorX, 13);
    await f.escape(); await f.escape(); await f.escape(); await pending;
  } finally { f.close(); }
});

test('config viewport pages rendered rows, scrolls without selecting the hovered row and invalidates pointer ownership', async () => {
  const f = fixture(); const changes: ConfigUpdate[] = [];
  let state = input;
  try {
    f.resize(44, 24);
    let pending = f.tui.prompt({ message: '', configPanel: { input: state, change: async change => {
      changes.push(change); state = updated(state, change); return state;
    } } }, new AbortController().signal);
    f.key('\r\x1b[6~');
    assert.ok(f.rowOf('Verbose output') >= 0); assert.ok(f.rowOf('↑ 2 more') >= 0);
    f.key('\x1b[6~');
    assert.ok(f.rowOf('Auto-scroll') >= 0); assert.ok(f.rowOf('↑ 8 more') >= 0);
    f.key('\x1b[6~');
    assert.ok(f.rowOf('Dialog expiry') >= 0); assert.ok(f.rowOf('↑ 11 more') >= 0);
    f.key('\x1b[5~\x1b[5~\x1b[5~'); assert.ok(f.rowOf('Auto-compact') >= 0);
    f.mouse(65, f.rowOf('Thinking mode'), 3);
    assert.ok(f.rowOf('↑ 1 more') >= 0); assert.equal(f.rowOf('Auto-compact'), -1);
    const label = f.rowOf('Thinking mode');
    f.mouse(0, label, 3); f.mouse(0, label, 3, true); await delay(0);
    assert.deepEqual(changes, []);
    const value = label + 1;
    f.mouse(0, value, 4); f.resize(20, 24); f.mouse(0, value, 4, true); await delay(0);
    assert.deepEqual(changes, []);
    f.key('\x1b[H');
    const first = f.rowOf('Reduce motion') + 1;
    f.mouse(0, first, 4); f.mouse(32, first + 2, 4); f.mouse(0, first, 4, true); await delay(0);
    assert.deepEqual(changes, []);
    f.mouse(0, first, 4); f.mouse(0, first, 4, true); await delay(0);
    assert.deepEqual(changes, [{ id: 'reduceMotion', value: true }]);
    f.key('\x1b[F'); assert.ok(f.rowOf('Dialog expiry') >= 0); assert.ok(f.rowOf('‹ default ›') >= 0);
    await f.escape(); await pending;
    pending = f.tui.prompt(modelPickerRequest(['model-01'], 'model-01', 'high', false), new AbortController().signal);
    f.key('s'); assert.equal(f.tui.currentScreen, 'dialog'); f.key('\r');
    assert.deepEqual(await pending, { selected: ['model-01'] });
    pending = f.tui.prompt(modelPickerRequest(['model-01', 'model-02'], 'model-01', 'low', false,
      { modelSettings: { 'model-02': { effortLevel: 'xhigh' } }, fallback: 'low' }), new AbortController().signal);
    f.key('\x1b[B'); assert.ok(f.lines().some(row => row.includes('xHigh effort')));
    f.key('\r'); assert.deepEqual(await pending, { selected: ['model-02'] });
    let finishWrite: ((value: ConfigPanelInput) => void) | undefined;
    pending = f.tui.prompt({ message: '', configPanel: { input, change: () => new Promise(resolve => { finishWrite = resolve; }) } }, new AbortController().signal);
    f.key('\r\r'); assert.ok(f.lines().some(row => row.includes('Saving settings')));
    f.key('\x03'); let finished = false; void pending.then(() => { finished = true; }); await delay(0);
    assert.equal(finished, false); assert.equal(f.tui.currentScreen, 'chat');
    assert.ok(finishWrite); finishWrite(input); await pending; assert.equal(finished, true);
    const controller = new AbortController();
    pending = f.tui.prompt({ message: '', configPanel: { input, change: async () => input } }, controller.signal);
    controller.abort(); assert.equal(await pending, undefined);
  } finally { f.close(); }
});

test('config settings preserve authored data, hide foreign timeout rows and restore per-model effort from disk and session', async () => {
  const temporary = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w233-settings-'));
  const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  const userFile = path.join(userDir, 'settings.json'), localFile = path.join(workspace, '.harness', 'settings.local.json');
  fs.writeFileSync(userFile, JSON.stringify({ keep: { nested: true }, model: 'model-02', effort: 'medium',
    permissions: { allow: ['Bash'] }, modelSettings: { 'model-02': { unrelated: 7 } } }), { mode: 0o640 });
  try {
    await saveConfigPanelSetting({ id: 'reduceMotion', value: true }, workspace, userDir);
    await saveConfigPanelSetting({ id: 'tips', value: false }, workspace, userDir);
    await Promise.all([
      saveConfigPanelSetting({ id: 'thinking', value: true }, workspace, userDir),
      saveConfigPanelSetting({ id: 'verbose', value: true }, workspace, userDir),
      saveConfigPanelSetting({ id: 'progressBar', value: false }, workspace, userDir),
      saveConfigPanelSetting({ id: 'editor', value: 'vim' }, workspace, userDir),
      saveConfigPanelSetting({ id: 'dialogExpiry', value: '60s' }, workspace, userDir),
      saveConfigPanelSetting({ id: 'permissionMode', value: 'acceptEdits' }, workspace, userDir),
      saveConfigModelEffort('model-02[1m]', 'xhigh', userDir),
    ]);
    let authored = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    assert.deepEqual(authored, { keep: { nested: true }, model: 'model-02', effort: 'medium',
      permissions: { allow: ['Bash'], defaultMode: 'acceptEdits' },
      modelSettings: { 'model-02': { unrelated: 7, effortLevel: 'xhigh' } }, thinking: true, verbose: true,
      terminalProgressBarEnabled: false, editorMode: 'vim', dialogExpiry: '60s' });
    assert.equal(fs.statSync(userFile).mode & 0o777, 0o640);
    assert.deepEqual(JSON.parse(fs.readFileSync(localFile, 'utf8')), { prefersReducedMotion: true, spinnerTipsEnabled: false });
    const beforeMax = fs.readFileSync(userFile, 'utf8'); await saveConfigModelEffort('model-02', 'max', userDir);
    assert.equal(fs.readFileSync(userFile, 'utf8'), beforeMax);
    const loaded = parseSettings(loadProjectConfig(workspace, { userDir, paths: [] }).settings);
    assert.equal(configuredEffort(loaded, 'model-02[1m]'), 'xhigh'); assert.equal(configuredEffort(loaded, 'other-model'), 'medium');
    assert.equal(loaded.spinnerTipsEnabled, false);
    assert.equal(loaded.permissions?.mode, 'acceptEdits'); assert.equal(loaded.permissions?.defaultMode, 'acceptEdits');
    assert.equal(configPanelInput({ ...defaultConfig(workspace, []), permissions: loaded.permissions }).config.permissions?.defaultMode, 'acceptEdits');
    const config = { ...defaultConfig(workspace, []), model: 'model-02', thinking: true, modelSettings: loaded.modelSettings,
      effort: configuredEffort(loaded, 'model-02'), configSources: { userDir } };
    const session = Session.open(workspace, { config }); const id = session.id; session.close();
    const restored = Session.open(workspace, { id });
    assert.equal(restored.config.effort, 'xhigh'); assert.equal(restored.config.modelSettings?.['model-02']?.effortLevel, 'xhigh'); restored.close();
    const journal = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8');
    const metadata = JSON.parse(journal.split('\n')[0]!);
    assert.deepEqual(metadata.config.modelSettings, { 'model-02': { effortLevel: 'xhigh' } });
    assert.deepEqual(loaded.modelSettings, { 'model-02': { effortLevel: 'xhigh' } });
    saveEffortSetting('low', userDir, 'model-02');
    assert.equal(configuredEffort(parseSettings(loadProjectConfig(workspace, { userDir, paths: [] }).settings), 'model-02'), 'low');
    saveEffortSetting(undefined, userDir, 'model-02');
    assert.equal(configuredEffort(parseSettings(loadProjectConfig(workspace, { userDir, paths: [] }).settings), 'model-02'), undefined);
    const target = path.join(workspace, 'settings-target.json'), link = path.join(workspace, 'settings-link.json');
    fs.writeFileSync(target, JSON.stringify({ askUserQuestionTimeout: '5m', dialogExpiry: '10m' }));
    fs.symlinkSync(target, link);
    assert.deepEqual(configPanelInput({ ...config, configSources: { userDir, settingsFile: link } }).hidden, ['askUserQuestionTimeout', 'dialogExpiry']);
    await saveConfigPanelSetting({ id: 'dialogExpiry', value: 'default' }, workspace, userDir);
    authored = JSON.parse(fs.readFileSync(userFile, 'utf8')); assert.equal(Object.hasOwn(authored, 'dialogExpiry'), false);
    fs.writeFileSync(userFile, JSON.stringify({ permissions: 'legacy' }));
    await saveConfigPanelSetting({ id: 'permissionMode', value: 'dontAsk' }, workspace, userDir);
    assert.deepEqual(JSON.parse(fs.readFileSync(userFile, 'utf8')), { permissions: { defaultMode: 'dontAsk' } });
    fs.writeFileSync(userFile, '{invalid');
    await assert.rejects(saveConfigPanelSetting({ id: 'thinking', value: false }, workspace, userDir), SyntaxError);
    assert.equal(fs.readFileSync(userFile, 'utf8'), '{invalid');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
