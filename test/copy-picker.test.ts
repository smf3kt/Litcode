import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { ConfigPanel } from '../src/config-panel.js';
import { configPanelInput } from '../src/config-panel-input.js';
import { copyBlocks, copyBlockLabel, copyPickerRows, copyReport, copyResponseText, copyScratchDirectory, copyTarget } from '../src/copy-command.js';
import { interactiveLoop } from '../src/interactive.js';
import { reloadConfig } from '../src/reload.js';
import { createRuntime, parseSettings } from '../src/runtime.js';
import { Session, configSchema } from '../src/session.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w296-copy-')));
const response = '<cc-memory>heading</cc-memory>\n\n| A | B |\n|:-|--:|\n| 中 | **x** |\n\n> quote\n> next\n\n```ts\nconst n = 1;\n```\n';
const normalized = 'heading\n\n| A   | B     |\n| :-- | ----: |\n| 中  | **x** |\n\n> quote\n> next\n\n```ts\nconst n = 1;\n```\n';

test('copy normalization retains inline table Markdown and separates full-response and block sanitizers', () => {
  assert.equal(copyResponseText(response), normalized);
  assert.deepEqual(copyBlocks(normalized), [{ kind: 'quote', text: 'quote\nnext' }, { kind: 'code', text: 'const n = 1;', lang: 'ts' }]);
  const privateText = '<context>```sh\nhidden\n```</context>\n<cc-memory>```ts\nvisible\n```</cc-memory>';
  assert.match(copyResponseText(privateText), /hidden/);
  assert.deepEqual(copyBlocks(privateText), [{ kind: 'code', text: 'visible', lang: 'ts' }]);
  assert.deepEqual(copyBlocks('> first\n\n> second\n\nparagraph\n\n> third'),
    [{ kind: 'quote', text: 'first\n\nsecond' }, { kind: 'quote', text: 'third' }]);
  assert.equal(copyBlockLabel({ kind: 'quote', text: '\n  first\nsecond' }), '  first');
  assert.equal(copyBlockLabel({ kind: 'code', text: 'x'.repeat(119) + '😀z' }), 'x'.repeat(119) + '…');
  const blocks = copyBlocks(normalized), rows = copyPickerRows(normalized, blocks);
  assert.deepEqual(rows.map(row => row.value), ['full', '0', '1', 'always']);
  assert.deepEqual(rows[1]?.meta, ['quote, 2 lines']);
  assert.deepEqual(copyTarget(normalized, blocks, '0'), { text: 'quote\nnext', filename: 'copy.md' });
  assert.deepEqual(copyTarget(normalized, blocks, '1'), { text: 'const n = 1;', filename: 'copy.ts' });
  assert.deepEqual(copyTarget(normalized, blocks, 'always'), { text: normalized, filename: 'response.md' });
  const before = { program: process.env.TERM_PROGRAM, version: process.env.TERM_PROGRAM_VERSION };
  try {
    process.env.TERM_PROGRAM = 'vscode'; process.env.TERM_PROGRAM_VERSION = '1.124.0';
    assert.match(copyReport('中', '/file'), /1 characters, 1 lines.*\n⚠ VS Code 1\.123\/1\.124.*file below is unaffected\nAlso written to \/file/);
  } finally {
    for (const [key, value] of [['TERM_PROGRAM', before.program], ['TERM_PROGRAM_VERSION', before.version]])
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});

test('actual terminal copy picker copies chosen content, writes without OSC52, cancels, and persists the always choice', { timeout: 15000 }, async () => {
  const workspace = temporary(), user = path.join(workspace, 'user'); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ keep: 7 }));
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: user }, prefersReducedMotion: true };
  const controller = new AbortController();
  const provider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const runtime = await createRuntime(config, provider, controller.signal);
  const session = Session.open(workspace, { config });
  session.append({ kind: 'message', message: { role: 'assistant', content: [{ type: 'text', text: response }] } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function') throw new Error('Pinned xterm decoder unavailable');
  const write = core.writeSync.bind(core); let raw = '';
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { raw += String(chunk); write(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output, userDir: user, prefersReducedMotion: true, sourceInputGestures: true }).start();
  const lines = () => Array.from({ length: screen.rows }, (_, row) => screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const copies = () => [...raw.matchAll(/\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/g)].map(match => Buffer.from(match[1]!, 'base64').toString('utf8'));
  const key = (text: string) => input.emit('data', text);
  const until = async (predicate: () => boolean) => { for (let i = 0; i < 150; i++) { if (predicate()) return; await delay(10); } assert.fail(lines().join('\n')); };
  const loop = interactiveLoop(session, provider, runtime, { input, output, status: output, signal: controller.signal, terminal: tui });
  const open = async () => { key('/copy\r'); await until(() => tui.currentScreen === 'dialog'); };
  try {
    await delay(30); await open(); assert.ok(lines().some(line => line.includes('Full response') && line.includes('chars')));
    key('\x1b[A\r'); await until(() => copies().length === 1); assert.equal(copies()[0], normalized, 'previous at first clamps');
    await open(); key('\x1b[Bw'); await until(() => tui.currentScreen === 'chat'
      && fs.existsSync(path.join(copyScratchDirectory(), 'copy.md')));
    assert.equal(fs.readFileSync(path.join(copyScratchDirectory(), 'copy.md'), 'utf8'), 'quote\nnext'); assert.equal(copies().length, 1);
    await open(); key('\x1b[B\x1b[B\r'); await until(() => copies().length === 2); assert.equal(copies()[1], 'const n = 1;');
    for (const cancel of ['\x1b', '\x03\x03', '\x04\x04']) {
      await open(); key(cancel); await until(() => tui.currentScreen === 'chat'); assert.equal(copies().length, 2);
    }
    await open(); key('\x03'); assert.ok(lines().some(line => line.includes('Press Ctrl-C again to cancel')));
    await delay(850); assert.equal(tui.currentScreen, 'dialog'); assert.ok(lines().some(line => line.includes('w write to file')));
    key('\x1b'); await until(() => tui.currentScreen === 'chat');
    await open(); await delay(320);
    const row = lines().findIndex(line => line.includes('quote') && line.includes('2 lines')); assert.ok(row >= 0, lines().join('\n'));
    key(`\x1b[<0;4;${row + 1}M\x1b[<0;4;${row + 1}m`);
    await until(() => copies().length === 3); assert.equal(copies()[2], 'quote\nnext');
    const authored = fs.readFileSync(path.join(user, 'settings.json'), 'utf8');
    fs.writeFileSync(path.join(user, 'settings.json'), '{invalid');
    await open(); key('\x1b[F\r'); await until(() => lines().some(line => line.includes('error:')));
    assert.equal(copies().length, 3); assert.equal(session.config.copyFullResponse, undefined);
    assert.equal(fs.readFileSync(path.join(user, 'settings.json'), 'utf8'), '{invalid');
    fs.writeFileSync(path.join(user, 'settings.json'), authored);
    await open(); key('\x1b[F\x1b[B\r'); await until(() => copies().length === 4);
    assert.equal(copies()[3], normalized); assert.equal(session.config.copyFullResponse, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')), { keep: 7, copyFullResponse: true });
    key('/copy\r'); await until(() => copies().length === 5); assert.equal(tui.currentScreen, 'chat');
    key('/config\r'); await until(() => tui.currentScreen === 'dialog'); key('Skip the /copy picker\r ');
    await until(() => JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')).copyFullResponse === false);
    key('\x1b'); await until(() => tui.currentScreen === 'chat'); await open(); key('\x1b'); await until(() => tui.currentScreen === 'chat');
    const labelText = '```ts\n  hello\t\tworld\u0001 end\n```';
    const guardedRows = copyPickerRows(labelText, copyBlocks(labelText));
    const guarded = tui.prompt({ message: 'Select content to copy:', copyPicker: { rows: guardedRows } }, controller.signal);
    let guardedRow = lines().findIndex(line => line.includes('hello world end')); assert.ok(guardedRow >= 0, lines().join('\n'));
    const click = (row: number) => key(`\x1b[<0;4;${row + 1}M\x1b[<0;4;${row + 1}m`);
    click(guardedRow); assert.equal(tui.currentScreen, 'dialog', 'mount-settle click is dropped');
    await delay(320); key('\x1b[O'); click(guardedRow);
    assert.equal(tui.currentScreen, 'dialog', 'window activation click is dropped');
    click(guardedRow); assert.deepEqual(await guarded, { selected: ['0'] }, 'next deliberate click is accepted');
    const many = Array.from({ length: 36 }, (_, i) => `\x60\x60\x60ts\nrow-${i}\n\x60\x60\x60`).join('\n\n');
    const manyRows = copyPickerRows(many, copyBlocks(many));
    const edgeModal = tui.prompt({ message: 'Select content to copy:', copyPicker: { rows: manyRows } }, controller.signal);
    await delay(320); const edgeRow = lines().findIndex(line => /↓.*more/.test(line)); assert.ok(edgeRow >= 0);
    click(edgeRow); click(edgeRow); assert.equal(tui.currentScreen, 'dialog', 'overflow-hint repeat cannot select its replacement row');
    key('\x1b[H\x1b[6~'); assert.ok(lines().some(line => /↑.*more/.test(line)), 'page-down moves the row window');
    key('\x1b[F'); assert.ok(lines().some(line => line.includes('Always copy full response')));
    key('\x1b'); await delay(65); await edgeModal;
    const resized = tui.prompt({ message: 'Select content to copy:', copyPicker: { rows: guardedRows } }, controller.signal);
    await delay(320); guardedRow = lines().findIndex(line => line.includes('hello world end'));
    key(`\x1b[<0;4;${guardedRow + 1}M`); output.columns = 40; screen.resize(40, 30); output.emit('resize');
    guardedRow = lines().findIndex(line => line.includes('hello world end'));
    key(`\x1b[<0;4;${guardedRow + 1}m`); assert.equal(tui.currentScreen, 'dialog', 'resize invalidates a pending press');
    key('\x1b'); await delay(65); await resized;
    for (const rows of [10, 8]) {
      output.columns = 20; output.rows = rows; screen.resize(20, rows); output.emit('resize');
      const short = tui.prompt({ message: 'Select content to copy:', copyPicker: { rows: manyRows } }, controller.signal);
      key('\x1b[6~'); assert.ok(lines().some(line => /❯ row-0/.test(line)), lines().join('\n'));
      key('\x1b[F'); assert.ok(lines().some(line => /❯ Always copy/.test(line)), lines().join('\n'));
      key('\x1b'); await delay(65); await short;
    }
    output.columns = 100; output.rows = 30; screen.resize(100, 30); output.emit('resize');
    key('kept draft');
    const pending = tui.prompt({ message: 'Select content to copy:', copyPicker: { rows: copyPickerRows(normalized, copyBlocks(normalized)) } }, controller.signal);
    key('\x1b'); await delay(65); assert.equal(await pending, undefined); assert.equal(tui.state.text, 'kept draft');
  } finally {
    controller.abort(); await loop; tui.close(); screen.dispose(); session.close(); await runtime.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('copy preference belongs to the user layer, survives session metadata, and resets on reload deletion', async () => {
  const workspace = temporary(), user = path.join(workspace, 'user'); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
  const file = path.join(user, 'settings.json'), project = path.join(workspace, '.harness/settings.json');
  let session: Session | undefined;
  try {
    fs.writeFileSync(file, JSON.stringify({ keep: 1, copyFullResponse: false })); fs.writeFileSync(project, JSON.stringify({ copyFullResponse: true }));
    const loaded = parseSettings(loadProjectConfig(workspace, { userDir: user, paths: [] }).settings);
    const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir: user }, copyFullResponse: loaded.copyFullResponse };
    assert.equal(configSchema.parse(config).copyFullResponse, false);
    const panel = new ConfigPanel(configPanelInput(config)); panel.focusRow('copyFullResponse');
    assert.deepEqual(panel.activate(), { kind: 'change', update: { id: 'copyFullResponse', value: true } });
    await saveConfigPanelSetting({ id: 'copyFullResponse', value: true }, workspace, user);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { keep: 1, copyFullResponse: true });
    assert.equal(reloadConfig(config).copyFullResponse, true);
    session = Session.open(workspace, { config: { ...config, copyFullResponse: true } }); const id = session.id; session.close();
    session = Session.open(workspace, { id }); assert.equal(session.config.copyFullResponse, true);
    fs.writeFileSync(file, JSON.stringify({ keep: 1 })); assert.equal(reloadConfig(config).copyFullResponse, undefined);
    assert.throws(() => parseSettings({ copyFullResponse: 'wrong' }), /copyFullResponse/);
  } finally { session?.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
