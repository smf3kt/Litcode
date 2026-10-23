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
import { TranscriptScroll } from '../src/tui-scroll.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w295-scroll-')));

function fixture(autoScrollEnabled?: boolean) {
  const user = temporary();
  const screen = new HeadlessTerminal({ cols: 100, rows: 18, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function')
    throw new Error('Pinned xterm synchronous decoder is unavailable');
  const write = core.writeSync.bind(core);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { write(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 18 });
  const tui = new TuiTerminal({ input, output, userDir: user, autoScrollEnabled, prefersReducedMotion: true,
    sourceInputGestures: true }).start();
  const key = (value: string) => input.emit('data', value);
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const body = () => lines().slice(0, 14).flatMap(line => line.match(/^row-\d{3}/) ?? []).join('\n');
  const append = (first: number, last: number) => {
    for (let i = first; i <= last; i++) tui.append({ kind: 'assistant', text: `row-${String(i).padStart(3, '0')}` });
  };
  return { tui, screen, output, lines, body, append, key,
    close() { tui.close(); screen.dispose(); fs.rmSync(user, { recursive: true, force: true }); } };
}

test('source scroll owner distinguishes forced sticky, fixed bottom, high-water growth and user-away repins', () => {
  const scroll = new TranscriptScroll();
  const rows = [{ kind: 'assistant' as const, text: 'visible text' }];
  assert.equal(scroll.layout(30, 10, rows), 20);
  scroll.setEnabled(false);
  assert.equal(scroll.layout(35, 10, rows), 25, 'off retains existing sticky');
  scroll.scroll('top'); assert.equal(scroll.layout(35, 10, rows), 0);
  scroll.scroll('fullPageDown'); assert.equal(scroll.layout(35, 10, rows), 10);
  scroll.scroll('fullPageDown'); assert.equal(scroll.layout(35, 10, rows), 20);
  scroll.scroll('lineDown'); assert.equal(scroll.layout(35, 10, rows), 21);
  for (let i = 0; i < 4; i++) { scroll.scroll('lineDown'); scroll.layout(35, 10, rows); }
  assert.equal(scroll.isSticky(), false);
  assert.equal(scroll.layout(40, 10, rows), 25, 'incremental bottom stays fixed while off');
  scroll.onUserRowLanded(true); assert.equal(scroll.layout(42, 10, rows), 25);
  scroll.jumpToNew(); assert.equal(scroll.layout(42, 10, rows), 32);
  assert.equal(scroll.layout(44, 10, rows), 34);
  scroll.scroll('top'); scroll.layout(44, 10, rows);
  scroll.setEnabled(true); scroll.onPromptEdit('typed', '');
  assert.equal(scroll.layout(44, 10, rows), 0, 'typing does not override user-away');
  scroll.onUserRowLanded(true); assert.equal(scroll.layout(44, 10, rows), 34);
  scroll.scrollTo(34); scroll.setEnabled(false); scroll.layout(44, 10, rows);
  assert.equal(scroll.layout(20, 10, rows), 10);
  assert.equal(scroll.layout(30, 10, rows), 20);
  assert.equal(scroll.layout(46, 10, rows), 34, 'shrinking content retains its old position and high-water bottom');
  scroll.setEnabled(true); assert.equal(scroll.layout(48, 10, rows), 34);
  assert.equal(scroll.isSticky(), false, 'growth below the updated high-water bottom stays unpinned');
  scroll.scroll('bottom'); assert.equal(scroll.layout(48, 10, rows), 38);
  scroll.scrollTo(38); scroll.setEnabled(false); scroll.layout(48, 10, rows);
  scroll.setEnabled(true); assert.equal(scroll.layout(50, 10, rows), 40);
  assert.equal(scroll.isSticky(), true, 'positional growth at the old bottom restores follow');
  scroll.scroll('top'); scroll.layout(46, 10, rows); scroll.scroll('bottom');
  assert.equal(scroll.layout(48, 10, rows), 38, 'explicit bottom is forced');
  scroll.reset(); scroll.setEnabled(false); assert.equal(scroll.layout(15, 5, []), 10);
  scroll.setEnabled(true); scroll.layout(40, 10, rows); scroll.scroll('top'); scroll.layout(40, 10, rows);
  scroll.layout(41, 10, [...rows, { kind: 'system', text: '', duration: { uuid: 'duration', timestamp: '2026-10-23T00:00:00.000Z', durationMs: 1500 } }]);
  assert.equal(scroll.pill?.count ?? 0, 0, 'progress alone is not an unseen message');
});

test('real terminal streaming, scroll keys, bottom pill and submission retain their source ownership', async () => {
  const f = fixture(false);
  try {
    f.append(0, 39);
    const modalController = new AbortController();
    const modal = f.tui.prompt({ title: 'Owned dialog', message: 'Answer', allowText: true }, modalController.signal);
    f.tui.append({ kind: 'assistant', text: 'LATEST_DURING_MODAL' });
    assert.ok(f.lines().some(line => line.includes('LATEST_DURING_MODAL')), 'modal transcript retains the live tail');
    modalController.abort(); await modal; assert.match(f.body(), /row-039/);
    f.key('\x1b[5~'); const before = f.body(), offset = f.tui.transcriptState.offset;
    f.append(40, 44); assert.equal(f.tui.transcriptState.offset, offset);
    assert.equal(f.body(), before);
    f.key('draft'); assert.equal(f.tui.transcriptState.offset, offset);
    f.key('\r'); assert.equal(f.tui.state.text, '');
    assert.equal(f.tui.transcriptState.offset, offset, 'off suppresses own-submit repin');
    f.key('\x1b[1;5F'); assert.match(f.body(), /row-044/);
    f.append(45, 46); assert.match(f.body(), /row-046/, 'explicit bottom stays sticky while off');
    f.key('\x1b[5~'); f.append(47, 65);
    const pillRow = f.lines().findIndex(line => /new messages?/.test(line));
    assert.ok(pillRow >= 0, f.lines().join('\n'));
    const label = f.lines()[pillRow]!;
    const column = label.search(/\d+ new message/);
    assert.ok(column >= 0);
    f.key(`\x1b[<0;${column + 1};${pillRow + 1}M`);
    f.key(`\x1b[<0;${column + 1};${pillRow + 1}m`);
    assert.match(f.body(), /row-065/);
    assert.equal(f.lines().some(line => /new messages?/.test(line)), false);
    f.append(66, 67); assert.match(f.body(), /row-067/);
    f.key('\x1b[1;5F\x1b[<64;2;3M\x1b[5~');
    const pointerRow = f.lines().findIndex(line => /Jump to bottom|new messages?/.test(line));
    assert.ok(pointerRow >= 0, f.lines().join('\n'));
    const pointerCol = f.lines()[pointerRow]!.search(/Jump to bottom|\d+ new message/);
    f.key(`\x1b[<0;${pointerCol + 1};${pointerRow + 1}M`);
    const pointerController = new AbortController();
    const pointerModal = f.tui.prompt({ title: 'Pointer owner', message: 'Answer', allowText: true }, pointerController.signal);
    pointerController.abort(); await pointerModal;
    const pointerOffset = f.tui.transcriptState.offset;
    f.key(`\x1b[<0;${pointerCol + 1};${pointerRow + 1}m`);
    assert.equal(f.tui.transcriptState.offset, pointerOffset, 'unmounted pill drops its pending click');
    f.key('\x1b[5~'); const fixed = f.tui.transcriptState.offset;
    f.tui.setAutoScrollEnabled(true); f.key('kept draft');
    assert.equal(f.tui.transcriptState.offset, fixed);
    f.key('\r'); assert.ok(f.tui.transcriptState.offset > fixed);
    f.key('\x1b[5~'); const streamOffset = f.tui.transcriptState.offset;
    f.tui.beginAssistantMessage(); f.tui.writeAssistantText('stream first\n'); await delay(120);
    f.tui.writeAssistantText('stream second\n'); await delay(120); f.tui.endAssistantMessage();
    assert.equal(f.tui.transcriptState.offset, streamOffset);
    f.key('\x1b[1;5F'); assert.ok(f.lines().some(line => line.includes('stream second')));
    f.output.rows = 22; f.screen.resize(100, 22); f.output.emit('resize');
    assert.ok(f.lines().some(line => line.includes('stream second')));
  } finally { f.close(); }
});

test('Auto-scroll Config writes user settings, preserves merged precedence, reload deletion and session metadata', async () => {
  const root = temporary(), user = path.join(root, 'user'); fs.mkdirSync(user);
  fs.mkdirSync(path.join(root, '.git')); fs.mkdirSync(path.join(root, '.harness'));
  const userFile = path.join(user, 'settings.json'), project = path.join(root, '.harness/settings.json');
  let session: Session | undefined;
  try {
    fs.writeFileSync(userFile, JSON.stringify({ keep: 1, autoScrollEnabled: true }));
    fs.writeFileSync(project, JSON.stringify({ autoScrollEnabled: false }));
    const settings = parseSettings(loadProjectConfig(root, { userDir: user, paths: [] }).settings);
    assert.equal(settings.autoScrollEnabled, false);
    const config = { ...defaultConfig(root, []), model: 'fixture', autoScrollEnabled: settings.autoScrollEnabled,
      configSources: { userDir: user } };
    assert.equal(configSchema.parse(config).autoScrollEnabled, false);
    const panel = new ConfigPanel(configPanelInput(config)); panel.focusRow('autoScroll');
    assert.deepEqual(panel.activate(), { kind: 'change', update: { id: 'autoScroll', value: true } });
    await saveConfigPanelSetting({ id: 'autoScroll', value: true }, root, user);
    assert.deepEqual(JSON.parse(fs.readFileSync(userFile, 'utf8')), { keep: 1, autoScrollEnabled: true });
    assert.equal(reloadConfig(config).autoScrollEnabled, false, 'project layer still wins');
    fs.writeFileSync(project, '{}'); assert.equal(reloadConfig(config).autoScrollEnabled, true);
    fs.writeFileSync(userFile, JSON.stringify({ keep: 1 })); assert.equal(reloadConfig(config).autoScrollEnabled, undefined);
    assert.throws(() => parseSettings({ autoScrollEnabled: 'invalid' }), /autoScrollEnabled/);
    session = Session.open(root, { config }); const id = session.id; session.close();
    session = Session.open(root, { id }); assert.equal(session.config.autoScrollEnabled, false);
  } finally { session?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
