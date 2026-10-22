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
import { reloadConfig } from '../src/reload.js';
import { parseSettings } from '../src/runtime.js';
import { Session, configSchema } from '../src/session.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';
import { jsx } from '../src/tui-jsx.js';
import { s, n } from '../src/tui-base-components.js';
import { TuiRenderer } from '../src/tui-renderer.js';
import { copySelectionText, selectionAutoCopy, selectionCopyFeedback } from '../src/tui-selection-copy.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w294-selection-')));

function fixture(copyOnSelect?: boolean) {
  const screen = new HeadlessTerminal({ cols: 100, rows: 16, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function')
    throw new Error('Pinned xterm synchronous decoder is unavailable');
  const write = core.writeSync.bind(core);
  let raw = '';
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    raw += String(chunk); write(String(chunk)); done();
  } }), { isTTY: true, columns: 100, rows: 16 });
  const tui = new TuiTerminal({ input, output, copyOnSelect, sourceInputGestures: true }).start();
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const key = (value: string) => input.emit('data', value);
  const copies = () => Array.from(raw.matchAll(/\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/g),
    match => Buffer.from(match[1]!, 'base64').toString('utf8'));
  const select = (text: string, first: number, last: number, finish = true) => {
    const row = lines().findIndex(line => line.includes(text));
    assert.ok(row >= 0, lines().join('\n'));
    const column = lines()[row]!.indexOf(text);
    key(`\x1b[<0;${column + first + 1};${row + 1}M\x1b[<32;${column + last + 1};${row + 1}M`);
    if (finish) key(`\x1b[<0;${column + last + 1};${row + 1}m`);
    return { row, column };
  };
  return { screen, input, output, tui, key, lines, copies, select,
    close() { tui.close(); screen.dispose(); } };
}

test('selection copy keeps source latch, whitespace, byte cap and native no-clear effects', () => {
  let dragging = true, selected = true, text = 'alpha', enabled = true;
  const copied: string[] = [], feedback: string[] = [];
  const observer = selectionAutoCopy({ getState: () => ({ isDragging: dragging }), hasSelection: () => selected,
    copySelectionNoClear: () => { copySelectionText(text, value => copied.push(value)); return text; } },
    () => ({ copyOnSelect: enabled }), value => feedback.push(value));
  observer.change(); assert.equal(copied.length, 0);
  dragging = false; observer.change(); assert.equal(copied.length, 1); assert.equal(observer.peek(), 'alpha');
  observer.change(); assert.equal(copied.length, 1); assert.equal(observer.peek(), null);
  selected = false; observer.change(); selected = true; enabled = false; observer.change();
  assert.equal(copied.length, 1);
  enabled = true; assert.equal(copied.length, 1, 'changing the flag alone emits no selection event');
  observer.change(); assert.equal(copied.length, 2);
  dragging = true; observer.change(); dragging = false; text = '   '; observer.change();
  assert.equal(copied.length, 3, 'copyNoClear writes before the whitespace feedback gate');
  assert.deepEqual(feedback, ['alpha', 'alpha']); assert.equal(observer.peek(), null);
  observer.reset(); text = 'x'.repeat(100001); assert.throws(() => observer.change(), /100000 UTF-8 bytes/);
  assert.equal(copied.length, 3);
  const env = { terminal: process.env.TERM_PROGRAM, version: process.env.TERM_PROGRAM_VERSION };
  try {
    process.env.TERM_PROGRAM = 'iTerm.app';
    assert.match(selectionCopyFeedback('👩‍💻').text, /sent 1 char via OSC 52.*hold Option/);
    process.env.TERM_PROGRAM = 'Apple_Terminal';
    assert.match(selectionCopyFeedback('ab').text, /sent 2 chars via OSC 52.*hold Fn/);
    process.env.TERM_PROGRAM = 'vscode'; process.env.TERM_PROGRAM_VERSION = '1.124.0';
    assert.equal(selectionCopyFeedback('中').timeoutMs, 6000);
    assert.equal(selectionCopyFeedback('ascii').timeoutMs, 4000);
  } finally {
    for (const [key, value] of [['TERM_PROGRAM', env.terminal], ['TERM_PROGRAM_VERSION', env.version]] as const)
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  const payloads: string[] = [];
  const renderer = new TuiRenderer({ write(value) { payloads.push(value); } });
  const paint = () => renderer.renderElement(jsx(s, { selectionScope: true,
    children: jsx(n, { children: 'native sample' }, 'text') }, 'scope'), 60, 12,
    { row: 10, column: 0, visible: false });
  try {
    paint(); renderer.selectNative('start', 0, 0); renderer.selectNative('end', 5, 0);
    payloads.length = 0;
    assert.equal(renderer.selectionInstance.copySelectionNoClear(), 'native');
    assert.equal(payloads.filter(value => value.includes(']52;c;')).length, 1);
    assert.equal(renderer.selectionInstance.hasTextSelection(), true);
    renderer.renderElement(null, 60, 12, { row: 0, column: 0, visible: false });
    assert.equal(renderer.selectionInstance.hasTextSelection(), false);
  } finally { renderer.close(); }
});

test('finished selections auto-copy once, keep highlight and draft, and hand Ctrl+C back after clearing', async () => {
  const f = fixture(); let interrupted = 0;
  f.tui.on('interrupt', () => { interrupted++; });
  try {
    f.tui.append({ kind: 'assistant', text: 'alpha beta gamma' }); f.key('retained draft');
    const { row, column } = f.select('alpha beta gamma', 0, 4, false);
    assert.deepEqual(f.copies(), []);
    f.key(`\x1b[<0;${column + 5};${row + 1}m`);
    assert.deepEqual(f.copies(), ['alpha']);
    assert.ok(f.screen.buffer.active.getLine(row)!.getCell(column)!.isInverse());
    f.tui.setStatus('repaint only'); f.key('\x03');
    assert.deepEqual(f.copies(), ['alpha']); assert.equal(interrupted, 0);
    assert.equal(Boolean(f.screen.buffer.active.getLine(row)!.getCell(column)!.isInverse()), false);
    assert.equal(f.tui.state.text, 'retained draft');
    f.tui.setRunning(true); f.key('\x03'); assert.equal(interrupted, 1); f.tui.setRunning(false);
    f.tui.setCopyOnSelect(false); f.select('alpha beta gamma', 6, 9);
    assert.deepEqual(f.copies(), ['alpha']); assert.match(f.lines().at(-1)!, /ctrl\+c to copy/);
    f.tui.setCopyOnSelect(true); assert.deepEqual(f.copies(), ['alpha']);
    f.key('\x03'); assert.deepEqual(f.copies(), ['alpha', 'beta']);
    f.select('alpha beta gamma', 11, 15); assert.equal(f.copies().at(-1), 'gamma');
    f.key('\x1b[1;2D'); assert.equal(f.copies().length, 3);
    f.key('\x03'); assert.equal(f.copies().at(-1), 'gamm'); assert.equal(f.copies().length, 4);
    f.select('alpha beta gamma', 0, 4); const count = f.copies().length;
    const dialog = f.tui.prompt({ title: 'Owned modal', message: '', allowText: true }, new AbortController().signal);
    f.key('\x03'); await dialog; assert.equal(f.copies().length, count);
    assert.equal(f.tui.state.text, 'retained draft');
    f.select('alpha beta gamma', 6, 9); f.output.emit('resize'); const resized = f.copies().length;
    f.key('\x1b[99;6u'); assert.equal(f.copies().length, resized);
    f.select('alpha beta gamma', 0, 4); f.key('x'); const edited = f.copies().length;
    f.key('\x1b[99;6u'); assert.equal(f.copies().length, edited);
    assert.equal(f.tui.state.text, 'retained draftx');
    f.tui.setEditorMode('vim'); f.key('\x1b'); await delay(65);
    f.select('alpha beta gamma', 0, 4); const vim = f.copies().length; f.key('\x03');
    assert.equal(f.copies().length, vim); assert.equal(f.tui.state.text, 'retained draftx');
    f.tui.setEditorMode('normal'); f.tui.setCopyOnSelect(false);
    f.tui.append({ kind: 'assistant', text: 'spaces    follow' });
    const spaces = f.select('spaces    follow', 6, 9); f.tui.setRunning(true);
    f.key('\x03'); assert.equal(interrupted, 1);
    assert.equal(Boolean(f.screen.buffer.active.getLine(spaces.row)!.getCell(spaces.column + 6)!.isInverse()), false,
      'empty copy repaints the cleared highlight immediately');
    f.key('\x03'); assert.equal(interrupted, 2, 'empty selected text still tears down before the next interrupt');
    f.tui.setRunning(false);
    f.select('alpha beta gamma', 0, 4); f.key('\x13'); const stashed = f.copies().length;
    f.key('\x1b[99;6u'); assert.equal(f.copies().length, stashed, 'stash invalidates a transcript selection');
    f.key('\x13'); assert.equal(f.tui.state.text, 'retained draftx');
    f.select('alpha beta gamma', 0, 4); f.key('\x0f');
    assert.equal(f.tui.currentScreen, 'transcript');
    const switched = f.copies().length; f.key('\x1b[99;6u');
    assert.equal(f.copies().length, switched, 'screen switch clears the old row coordinates');
    f.select('alpha beta gamma', 0, 4); f.key('\x03');
    assert.equal(f.copies().at(-1), 'alpha'); assert.equal(f.tui.currentScreen, 'transcript');
    f.key('\x03'); assert.equal(f.tui.currentScreen, 'chat');
    f.tui.append({ kind: 'user', text: 'SECOND_PAYLOAD' }); f.key('\x0f');
    f.select('alpha beta gamma', 0, 4); const escaping = f.copies().length;
    f.key('\x1b'); await delay(65); assert.equal(f.tui.currentScreen, 'chat');
    f.key('\x1b[99;6u'); assert.equal(f.copies().length, escaping, 'Escape drops transcript coordinates before chat paints');
  } finally { f.close(); }
});

test('Copy on select persists as a user preference and reload and session binding retain its owner', async () => {
  const root = temporary(), user = path.join(root, 'user'), f = fixture(false);
  fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.git')); fs.mkdirSync(path.join(root, '.harness'));
  const userFile = path.join(user, 'settings.json'), projectFile = path.join(root, '.harness/settings.json');
  let session: Session | undefined;
  try {
    fs.writeFileSync(userFile, JSON.stringify({ copyOnSelect: false, keep: 1 }));
    fs.writeFileSync(projectFile, JSON.stringify({ copyOnSelect: true }));
    const settings = parseSettings(loadProjectConfig(root, { userDir: user, paths: [] }).settings);
    assert.equal(settings.copyOnSelect, false);
    const config = { ...defaultConfig(root, []), model: 'fixture', copyOnSelect: settings.copyOnSelect,
      configSources: { userDir: user } };
    assert.equal(configSchema.parse(config).copyOnSelect, false);
    session = Session.open(root, { config });
    const panel = new ConfigPanel(configPanelInput(config)); panel.focusRow('copyOnSelect');
    assert.deepEqual(panel.activate(), { kind: 'change', update: { id: 'copyOnSelect', value: true } });
    await saveConfigPanelSetting({ id: 'copyOnSelect', value: true }, root, user);
    assert.deepEqual(JSON.parse(fs.readFileSync(userFile, 'utf8')), { copyOnSelect: true, keep: 1 });
    assert.equal(reloadConfig(config).copyOnSelect, true);
    fs.writeFileSync(userFile, JSON.stringify({ keep: 1 }));
    assert.equal(reloadConfig(config).copyOnSelect, undefined, 'project data cannot replace the global user preference');
    fs.writeFileSync(userFile, JSON.stringify({ copyOnSelect: 'invalid' }));
    assert.throws(() => parseSettings(loadProjectConfig(root, { userDir: user, paths: [] }).settings), /copyOnSelect/);
    f.tui.append({ kind: 'assistant', text: 'binding alpha' }); f.key('draft');
    f.select('binding alpha', 0, 6); assert.deepEqual(f.copies(), []);
    await f.tui.bindInputHistory(session); f.key('\x1b[99;6u'); assert.deepEqual(f.copies(), []);
    assert.equal(f.tui.state.text, 'draft');
    f.select('binding alpha', 0, 6); assert.deepEqual(f.copies(), []);
    f.tui.setCopyOnSelect(); f.select('binding alpha', 8, 12); assert.deepEqual(f.copies(), ['alpha']);
    session.close(); session = Session.open(root, { id: session.id });
    assert.equal(session.config.copyOnSelect, false);
  } finally { f.close(); session?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
