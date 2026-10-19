import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Terminal } from '@xterm/headless';
import { TuiRenderer } from '../src/tui-renderer.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { createThemeColorComponents } from '../src/tui-theme-color-components.js';
import { S1 } from '../src/tui-theme-colors.js';
import { jsx } from '../src/tui-jsx.js';
import { ge } from '../src/tui-color.js';
import { clt, tLo } from '../src/tui-stream-preview.js';
import { Zqn, l$t } from '../src/tui-preview-visibility.js';
import { themeChoices } from '../src/tui-theme-state.js';
import { SystemThemeMonitor } from '../src/tui-system-theme.js';
import { ThinkingProgress } from '../src/tui-progress.js';
import { ProgressCompletion } from '../src/tui-progress-completion.js';
import { progressTime, progressVerbs } from '../src/tui-progress-settings.js';
import { rn, Yc } from '../src/tui-progress-source.js';
import { parseSettings } from '../src/runtime.js';
import type { TaskRecord } from '../src/tasks.js';
import { SKo } from '../src/tui-system-theme-source.js';
import { setTimeout as delay } from 'node:timers/promises';
import { welcomeDensity, WELCOME_ART_ROWS } from '../src/tui-welcome.js';

/** Terminal rows the composer, status line and margins take from the transcript. */
const WELCOME_CHROME_ROWS = 4;

/** The startup header leads the transcript, so content rows begin below it. */
const welcomeRows = (rows: number) =>
  (welcomeDensity(rows - WELCOME_CHROME_ROWS) === 'art' ? WELCOME_ART_ROWS : 1);

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const decoded = new WeakMap<Writable, Terminal>();
const seenFrames = new WeakMap<Writable, string[]>();
function watchScreen(output: Writable): void {
  let columns = 0, rows = 0;
  const terminal = new HeadlessTerminal({ allowProposedApi: true, logLevel: 'off' });
  const write = output.write.bind(output);
  decoded.set(output, terminal); seenFrames.set(output, []);
  const resize = () => {
    const size = output as Writable & { columns: number; rows: number };
    if (size.columns !== columns || size.rows !== rows) {
      columns = size.columns; rows = size.rows; terminal.resize(columns, rows);
    }
  };
  const feed = (text: string) => {
    resize();
    (terminal as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(text);
    seenFrames.get(output)!.push(screenLines(output).join('\n'));
  };
  output.write = ((...args: Parameters<Writable['write']>) => { feed(String(args[0])); return write(...args); }) as Writable['write'];
  output.on('resize', resize);
}
function screenLines(output: Writable): string[] {
  const terminal = decoded.get(output)!;
  const buffer = terminal.buffer.active;
  return Array.from({ length: terminal.rows }, (_, row) => buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '');
}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { createKillRing, emptyKillRing, nextYank, reduceKillRing } from '../src/kill-ring.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { ENTER_ALT_SCREEN, LEAVE_ALT_SCREEN, MOUSE_OFF, MOUSE_SCROLL, TerminalModeController } from '../src/tui-modes.js';
import { Keymap, contextStack, expandChord, type TuiContext } from '../src/tui-keys.js';
import { createTranscriptState, layoutTranscript, reduceTranscript, renderedTranscriptRows, transcriptLines } from '../src/tui-transcript.js';
import { pad, previewBox, TuiTerminal } from '../src/tui.js';
import { afkCountdown, afkTimeoutSettings, askUserQuestionTimeoutMs } from '../src/tui-afk.js';
import { layoutEngine } from '../src/tui-layout.js';
import { renderPreviewMarkdown } from '../src/tui-markdown.js';
import { wrapMessageText } from '../src/tui-wrap.js';
import { createSelection, moveSelectionColumn, reduceSelection, selectionColumn, selectionText, selectionTextFromRows } from '../src/tui-selection.js';
import { osc52Payload } from '../src/clipboard-osc52.js';
import { cellWidth, TerminalKeyDecoder } from '../src/terminal.js';

const cli = path.join(import.meta.dirname, '..', 'src', 'cli.ts');

test('recovered components keep native state, context, refs and one cleanup', async () => {
  const { nativeElement, Xe, qt, Ae, y, en, R } = await import('../src/plugin-chain-react-hooks.js');
  const context = qt('default');
  let increment: (() => void) | undefined, mounted = 0, cleaned = 0;
  let node: { nodeName?: string } | null = null;
  function Child() {
    const value = Ae(context), [count, setCount] = y(0), ref = R<{ nodeName?: string } | null>(null);
    increment = () => setCount(previous => previous + 1);
    en(() => { mounted++; node = ref.current; return () => { cleaned++; }; }, []);
    return Xe('Box', { ref, selectionScope: true, children: Xe('Text', { children: `${value} ${count}` }) });
  }
  const renderer = new TuiRenderer({ write() {} });
  const tree = nativeElement(Xe(context, { value: 'mounted', children: Xe(Child, {}) }));
  const paint = () => renderer.renderElement(tree, 60, 12, { row: 0, column: 0, visible: false });
  try {
    paint(); assert.match(renderer.frame.join('\n'), /mounted 0/); assert.equal(mounted, 1);
    assert.equal((node as { nodeName?: string } | null)?.nodeName, 'ink-box');
    increment!(); paint(); assert.match(renderer.frame.join('\n'), /mounted 1/);
    renderer.selectNative('start', 0, 0); renderer.selectNative('end', 6, 0);
    assert.equal(renderer.selectionInstance.getSelectedText(), 'mounted');
    renderer.renderElement(null, 60, 12, { row: 0, column: 0, visible: false });
    assert.equal(renderer.selectionInstance.hasTextSelection(), false, 'unmount releases the selection owner');
    renderer.renderElement(nativeElement(Xe('Text', { children: 'replacement' })), 60, 12,
      { row: 0, column: 0, visible: false });
    assert.equal(renderer.selectionInstance.getSelectedText(), '');
  } finally { renderer.close(); }
  assert.equal(cleaned, 1); assert.equal(renderer.liveNodes, 0);
});

test('the fullscreen Git sidebar preserves the draft, cycles bases, scrolls and releases its owner', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'native-diff-')));
  const userDir = path.join(root, 'user'); fs.mkdirSync(userDir);
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  git('init', '-b', 'main');
  fs.writeFileSync(path.join(root, 'sample.txt'), Array.from({ length: 80 }, (_, i) => `before ${i}`).join('\n') + '\n');
  git('add', 'sample.txt'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'baseline');
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; let raw = false; input.setRawMode = value => { raw = value; };
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 160, rows: 25 }); watchScreen(output);
  const config = defaultConfig(root, []); config.model = 'fixture/native-diff'; config.configSources = { userDir };
  config.automaticCheckpoints = true;
  const session = Session.open(root, { config });
  const tui = new TuiTerminal({ input, output });
  let renderError: Error | undefined; tui.on('inputError', error => { renderError = error; });
  tui.bindDiffPanel(session); tui.start();
  const key = (text: string) => input.emit('data', text);
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (renderError) throw renderError; assert.ok(Date.now() < deadline, screenLines(output).join('\n')); await delay(10); }
  };
  try {
    fs.writeFileSync(path.join(root, 'sample.txt'), Array.from({ length: 80 }, (_, i) => `after ${i}`).join('\n') + '\n');
    key('retained draft'); assert.equal(await tui.toggleDiffPanel(), 'Diff panel shown');
    await until(() => screenLines(output).some(row => row.includes('sample.txt')));
    assert.equal(tui.state.text, 'retained draft');
    key('\u0018b'); await until(() => screenLines(output).some(row => row.includes('uncommitted (vs HEAD)')));
    const actions: string[] = [], submitted: string[] = [];
    tui.on('action', action => actions.push(action)); tui.on('submit', text => submitted.push(text));
    key('\u0018\u0005'); key('\u0018\r'); key('\u0018\u0013');
    assert.deepEqual(actions, ['chat:externalEditor', 'chat:queueSubmit', 'chat:sendNow']);
    assert.deepEqual(submitted, ['retained draft'], 'the idle queue-submit chord retains its existing submission');
    tui.setEditorMode('vim'); key('\u000c'); key('a'.repeat(130)); key('\x1b'); await delay(70); key('0gj');
    assert.equal(tui.state.cursor, 85, 'Vim uses the 86-column composer while the sidebar is open');
    tui.setEditorMode('normal'); key('\u000c'); key('retained draft');
    const before = screenLines(output).join('\n'); key('\x1b[<65;120;15M');
    await until(() => screenLines(output).join('\n') !== before);
    assert.equal(tui.state.text, 'retained draft');
    const selectionRow = screenLines(output).findIndex(row => row.includes('before '));
    assert.ok(selectionRow > 0, screenLines(output).join('\n'));
    const selectionColumn = screenLines(output)[selectionRow]!.indexOf('before ');
    key(`\x1b[<0;${selectionColumn + 1};${selectionRow + 1}M\x1b[<32;${selectionColumn + 5};${selectionRow + 1}M\x1b[<0;${selectionColumn + 5};${selectionRow + 1}m`);
    await until(() => screenLines(output).some(row => row.includes('1 line from diff')));
    assert.equal(tui.state.text, 'retained draft', 'selection remains separate from the composer');
    const attachments: import('../src/terminal.js').PromptDiffSelection[] = [];
    tui.on('submit', (_text, attachment) => { if (attachment) attachments.push(attachment); });
    key('\r'); assert.equal(attachments[0]?.selection.text, 'befor');
    assert.equal(attachments[0]?.selection.filePath, 'sample.txt');
    const provider: ModelProvider = {
      count: async () => 1,
      complete: async request => {
        assert.deepEqual(request.messages.slice(-2), [
          { role: 'user', content: 'owned prompt' },
          { role: 'user', content: '<system-reminder>\nThe user selected the following 1 line from the diff view (in sample.txt):\nbefor\n\nThis may or may not be related to the current task.\n</system-reminder>' },
        ]);
        return { id: 'selection-fixture', model: config.model, role: 'assistant', type: 'message',
          content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
      },
    };
    await new Agent(session, provider, []).run('owned prompt', new AbortController().signal,
      undefined, undefined, [], attachments[0]!.selection);
    assert.equal(session.events.filter(event => event.kind === 'message' && event.isMeta).length, 1);
    tui.restoreDiffSelection(attachments[0]!);
    key('\x1b[Bx');
    assert.ok(screenLines(output).every(row => !row.includes('1 line from diff')), 'footer dismiss removes the pending attachment');
    key('retained draft');
    Object.assign(output, { columns: 80 }); output.emit('resize');
    assert.ok(screenLines(output).every(row => !row.includes('sample.txt')));
    Object.assign(output, { columns: 160 }); output.emit('resize');
    await until(() => screenLines(output).some(row => row.includes('sample.txt')));
    assert.equal(await tui.toggleDiffPanel(), 'Diff panel hidden');
    assert.equal(tui.state.text, 'retained draft');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')),
      { diffSidebarOpen: false, diffSidebarBaseMode: 'uncommitted' });
    Object.assign(output, { columns: 80 }); output.emit('resize');
    assert.match(await tui.toggleDiffPanel(), /at least 110 columns/);
    const { DiffPanel } = await import('../src/diff-panel.js');
    const { createTools } = await import('../src/tools.js');
    const { writeFileSync, readFileSync } = fs;
    const settings = path.join(userDir, 'settings.json');
    writeFileSync(settings, JSON.stringify({ diffSidebarOpen: true, diffSidebarBaseMode: 'uncommitted' }));
    let changes = 0;
    const panel = new DiffPanel(session, () => { changes++; }, () => {});
    try {
      panel.setColumns(120);
      const write = createTools().find(tool => tool.schema.name === 'write_file')!;
      const toolContext = { workspace: root, signal: new AbortController().signal, allowShell: false,
        maxOutputBytes: 24000, fileHistory: (file?: string) => session.touchFile(file) };
      await write.execute({ path: 'fresh.txt', content: 'fresh\n' }, toolContext);
      await until(() => panel.visible);
      assert.equal(panel.width(120), 50);
      const previous = changes;
      await write.execute({ path: 'fresh.txt', content: 'updated\n', overwrite: true }, toolContext);
      await until(() => changes > previous);
      assert.equal(session.fileHistory.trackedFiles.has('fresh.txt'), true);
    } finally { panel.close(); }
    const id = session.id, startedAt = session.startedAt, sequence = session.fileHistory.trackSequence;
    session.close();
    const resumed = Session.open(root, { id });
    try {
      assert.equal(resumed.startedAt, startedAt);
      assert.equal(resumed.fileHistory.trackSequence, sequence);
      assert.equal(resumed.fileHistory.trackedFiles.has('fresh.txt'), true);
      assert.equal(readFileSync(settings, 'utf8').includes('uncommitted'), true);
    } finally { resumed.close(); }
    tui.close();
    const nextConfig = defaultConfig(root, []); nextConfig.model = 'fixture/queued-diff'; nextConfig.configSources = { userDir };
    const queuedSession = Session.open(root, { config: nextConfig });
    const queuedInput = new PassThrough();
    const queuedOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
    let callbacks: import('../src/terminal.js').TerminalCallbacks | undefined;
    const queuedTerminal: import('../src/terminal.js').TerminalSurface = {
      isTTY: true, outputStream: queuedOutput,
      subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
      start() {
        callbacks!.onSubmit!('/clear');
        callbacks!.onSubmit!('queued prompt', { ...attachments[0]!, sessionId: queuedSession.id });
      },
      close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    };
    let requests = 0;
    const queuedProvider: ModelProvider = { count: async () => 1, complete: async request => {
      requests++;
      assert.equal(JSON.stringify(request.messages).includes('selected the following'), false,
        'an old-session attachment stays with its original queue owner');
      setImmediate(() => callbacks?.onExit?.());
      return { id: 'queue-fixture', model: nextConfig.model, role: 'assistant', type: 'message',
        content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    } };
    await interactiveLoop(queuedSession, queuedProvider,
      { tools: [], buildTools: () => [], close: async () => {}, limits: [] },
      { input: queuedInput, output: queuedOutput, status: queuedOutput, terminal: queuedTerminal,
        signal: new AbortController().signal });
    assert.equal(requests, 1);
  } finally { tui.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  assert.equal(raw, false);
});

test('mouse reports survive fragmentation and stay outside the input draft', () => {
  const reports = ['\x1b[<64;12;3M', '\x1b[<65;12;3m', '\x1b[M' + String.fromCharCode(96, 44, 35)];
  for (const report of reports) {
    const whole = new TerminalKeyDecoder().push(report);
    assert.equal(whole.length, 1);
    assert.equal(whole[0]?.type, 'mouse');
    for (let split = 1; split < report.length; split++) {
      const decoder = new TerminalKeyDecoder();
      assert.deepEqual(decoder.push(report.slice(0, split)), []);
      assert.deepEqual(decoder.push(report.slice(split)), whole);
    }
  }
  const decoder = new TerminalKeyDecoder();
  assert.deepEqual(decoder.push('\x1b[<84;2;3M'), [{ type: 'mouse', action: 'wheelup',
    button: 84, col: 2, row: 3, ctrl: true, meta: false, shift: true }]);
  assert.equal(decoder.push('\x1b[<35;2;3M')[0]?.type, 'mouse');
  assert.equal(decoder.push('\x1b[<0;2;3m')[0]?.type, 'mouse');
  assert.deepEqual(decoder.push('\x1b[<66;2;3M\x1b[M !!!'), [{ type: 'insert', text: '!' }]);
  assert.deepEqual(decoder.push('\x1b[<' + '9'.repeat(100)), []);
  assert.deepEqual(decoder.push(';2;3Mdraft'), [{ type: 'insert', text: 'draft' }]);
  assert.deepEqual(decoder.push('\x1b[<64;2;'), []);
  decoder.flushEscape();
  assert.deepEqual(decoder.push('3Mdraft'), [{ type: 'insert', text: 'draft' }]);
  assert.deepEqual(decoder.push('\x1b[200~\x1b[<64;2;3M\x1b[201~'),
    [{ type: 'paste', text: '\x1b[<64;2;3M' }]);
});

test('wheel scrolling unpins the live tail and respects prompt, screen and mode boundaries', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    for (let i = 0; i < 20; i++) tui.append({ kind: 'assistant', text: `line ${i}` });
    key('draft');
    key('\x1b[<64;2;3M');
    // Five visible rows after the source input's two borders and the startup header.
    assert.equal(tui.transcriptState.offset, 14);
    tui.append({ kind: 'assistant', text: 'new output' });
    assert.equal(tui.transcriptState.offset, 14);
    key('\x1b[M' + String.fromCharCode(97, 34, 35));
    assert.equal(tui.transcriptState.offset, 15);
    key('\x1b[<64;2;9M\x1b[<64;0;3M\x1b[<0;2;3M\x1b[<0;2;3m');
    assert.equal(tui.transcriptState.offset, 15);
    key('\u0012\x1b[<64;2;3M'); // Search owns its input; wheel does not move the transcript.
    assert.equal(tui.transcriptState.offset, 15);
    assert.equal(tui.state.text, 'draft');
  } finally { tui.close(); }
  const off = new TuiTerminal({ input, output, mouseTracking: 'off' }).start();
  try {
    for (let i = 0; i < 20; i++) off.append({ kind: 'assistant', text: `line ${i}` });
    const before = off.transcriptState.offset;
    key('\x1b[<64;2;3M');
    assert.equal(off.transcriptState.offset, before);
  } finally { off.close(); }
});

test('clicking a suggestion row fills the draft with that row, and a click elsewhere does not', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 40 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    key('/work');
    // `/workflows` is the second row of the band, so the row above it leads the band.
    const zeroBased = screenLines(output).findIndex(row => row.includes('/workflows'));
    assert.ok(zeroBased > 1, `the band is on screen: ${JSON.stringify(screenLines(output))}`);
    const rowAboveBand = zeroBased - 1;
    // The band is drawn above the composer, past the transcript rows, so a press on it
    // resolves to the row instead of a transcript selection. A press above it stays a
    // transcript click and leaves the draft alone.
    key(`\x1b[<0;4;${rowAboveBand}M\x1b[<0;4;${rowAboveBand}m`);
    assert.equal(tui.state.text, '/work');
    // A press on the row accepts it, the way Tab does, and dismisses the list.
    key(`\x1b[<0;4;${zeroBased + 1}M\x1b[<0;4;${zeroBased + 1}m`);
    assert.equal(tui.state.text, '/workflows ');
    assert.ok(!screenLines(output).some(row => row.includes('/workflows  ')), 'the band closed');
  } finally { tui.close(); }
});

test('pointer and keyboard selection copy the visible transcript without changing the draft', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const copy = () => {
    drawn = ''; key('\x1b[99;6u');
    const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
    return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
  };
  try {
    assert.ok(drawn.includes('\x1b[?1002h'));
    for (let index = 0; index < 20; index++) tui.append({ kind: 'assistant', text: `line ${index}` });
    key('draft');
    // Six visible rows: row 1 is line 14, row 2 is line 15.
    key('\x1b[<0;1;1M\x1b[<32;4;2M\x1b[<0;4;9m');
    assert.ok(screenLines(output)[1]?.startsWith('line'));
    for (let column = 0; column < 4; column++) assert.ok(decoded.get(output)!.buffer.active.getLine(1)!.getCell(column)!.isInverse());
    // A release on the prompt ends dragging; subsequent motion cannot extend it.
    key('\x1b[<32;7;3M');
    tui.append({ kind: 'assistant', text: 'new output' });
    assert.equal(copy(), 'line 14\nline');
    assert.equal(copy(), undefined);
    assert.equal(tui.state.text, 'draft');
    let submitted = 0;
    tui.on('submit', () => { submitted++; });
    key('\x1b[13;2u');
    assert.equal(tui.state.text, 'draft\n');
    assert.equal(submitted, 0);
    key('\x7f');
    // Reversing direction moves the focus, not the ordered end of the span.
    key('\x1b[<0;5;1M\x1b[<0;5;1m\x1b[1;2D\x1b[1;2D');
    assert.equal(copy(), 'ne');
    key('\x1b[1;2C');
    assert.equal(copy(), 'li');
    key('\x1b[<0;1;1M\x1b[<32;2;1M\x1b[<0;5;1m');
    assert.equal(copy(), 'line');
    tui.append({ kind: 'assistant', text: 'A\tBCDEFGHIJKLMN' });
    key('\x1b[<0;9;6M\x1b[<32;10;6M\x1b[<0;10;6m');
    assert.ok(screenLines(output)[5]?.includes('BC'));
    for (let column = 8; column < 10; column++) assert.ok(decoded.get(output)!.buffer.active.getLine(5)!.getCell(column)!.isInverse());
    assert.equal(copy(), 'BC');
    key('\x1b[<0;1;1M\x1b[<32;3;1M\x1b[<0;3;1m');
    output.emit('resize');
    assert.equal(copy(), undefined);
    key('\u0012\x1b[1;2C');
    assert.equal(copy(), undefined);
    assert.equal(tui.state.text, 'draft');
    key('\u0003'); // Leave search before selecting the collapsed notice.
    Object.assign(output, { columns: 20, rows: 40 }); output.emit('resize');
    tui.append({ kind: 'tool', text: Array.from({ length: 30 }, (_, i) => `row ${i}`).join('\n') });
    const noticeRow = transcriptLines(tui.transcriptState, 20).findIndex(line => line.startsWith('  ... 18')) + 1;
    key(`\x1b[<0;1;${noticeRow}M\x1b[<0;1;${noticeRow}m\x1b[1;2F`);
    assert.equal(copy(), '  ... 18 earlier lin');
  } finally { tui.close(); }
});

test('multi-click selects the word and then the whole row, and a drag extends that span', () => {
  // Each case starts a fresh terminal so the click sequence cannot carry over.
  const open = () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
    input.isTTY = true; input.setRawMode = () => {};
    let drawn = '';
    const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
    Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
    const tui = new TuiTerminal({ input, output }).start();
    tui.append({ kind: 'assistant', text: 'alpha beta-gamma delta' });
    tui.append({ kind: 'assistant', text: 'second row' });
    const copy = () => {
      drawn = ''; input.emit('data', '\x1b[99;6u');
      const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
      return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
    };
    return { tui, key: (text: string) => input.emit('data', text), copy };
  };
  // Row 1 is 'alpha beta-gamma delta', row 2 is 'second row'.
  // A double click on 'beta-gamma' takes the whole hyphenated run, not just 'beta'.
  const double = open();
  try {
    const top = welcomeRows(10) + 1;
    double.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M`);
    assert.equal(double.copy(), 'beta-gamma');
  } finally { double.tui.close(); }
  // A drag in the same sequence keeps the word span and grows its far edge.
  const dragged = open();
  try {
    const top = welcomeRows(10) + 1;
    dragged.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M\x1b[<32;22;${top}M`);
    assert.equal(dragged.copy(), 'beta-gamma delta');
  } finally { dragged.tui.close(); }
  // A third press selects the whole rendered row.
  const triple = open();
  try {
    const top = welcomeRows(10) + 1;
    triple.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M`);
    assert.equal(triple.copy(), 'alpha beta-gamma delta');
  } finally { triple.tui.close(); }
  // A line span drags by row, and its moving end snaps to the whole row under
  // the pointer rather than to the raw cell.
  const byLine = open();
  try {
    const top = welcomeRows(10) + 1;
    byLine.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M\x1b[<32;4;${top + 1}M`);
    assert.equal(byLine.copy(), 'alpha beta-gamma delta\nsecond row');
  } finally { byLine.tui.close(); }
  // A word span snaps the moving end to the word under the pointer, so a drag
  // into the middle of the next word takes that whole word rather than the
  // raw cells between the two points.
  const snapped = open();
  try {
    const top = welcomeRows(10) + 1;
    snapped.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M\x1b[<32;20;${top}M`);
    assert.equal(snapped.copy(), 'beta-gamma delta');
  } finally { snapped.tui.close(); }
  // A press far from the previous one restarts the sequence at one click, so a
  // drag from it is a plain character span rather than a word or row.
  const restarted = open();
  try {
    const top = welcomeRows(10) + 1;
    restarted.key(`\x1b[<0;7;${top}M\x1b[<0;7;${top}m\x1b[<0;7;${top}M`);
    restarted.key(`\x1b[<0;1;${top + 1}M\x1b[<32;4;${top + 1}M`);
    assert.equal(restarted.copy(), 'seco');
  } finally { restarted.tui.close(); }
  // Changing screens between presses restarts the sequence, so the press after
  // the change is a plain one rather than the second half of a double click.
  const acrossScreens = open();
  try {
    const top = welcomeRows(10) + 1;
    acrossScreens.key(`\x1b[<0;7;${top}M`);
    acrossScreens.key('\u000f');
    acrossScreens.key(`\x1b[<0;7;${top}M\x1b[<0;4;${top}m`);
    // A plain span between cells 6 and 3, i.e. 'ha b' reversed into reading order.
    assert.equal(acrossScreens.copy(), 'ha b');
  } finally { acrossScreens.tui.close(); }
});

test('wrapped rows copy as one logical line while explicit newlines keep theirs', () => {
  const open = (columns: number, text: string) => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
    input.isTTY = true; input.setRawMode = () => {};
    let drawn = '';
    const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
    Object.assign(output, { isTTY: true, columns, rows: 10 });
    const tui = new TuiTerminal({ input, output }).start();
    if (text) tui.append({ kind: 'assistant', text });
    const copy = () => {
      drawn = ''; input.emit('data', '\x1b[99;6u');
      const encoded = /\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/.exec(drawn)?.[1];
      return encoded === undefined ? undefined : Buffer.from(encoded, 'base64').toString('utf8');
    };
    return { tui, key: (keys: string) => input.emit('data', keys), copy };
  };
  // 20 columns with the '> ' user indent leaves 18 cells per row, so the
  // first line wraps and the second line is an explicit newline.
  const indented = open(20, '');
  try {
    indented.tui.append({ kind: 'user', text: 'aaaaaaaaaaaaaaaaaaaaaaaa\nbbbb' });
    // Selecting all three rows joins the wrapped tail back onto the first line,
    // while the explicit newline keeps its own prefix.
    const top = welcomeRows(10) + 1;
    indented.key(`\x1b[<0;1;${top}M\x1b[<32;10;${top + 2}M\x1b[<0;10;${top + 2}m`);
    assert.equal(indented.copy(), '> aaaaaaaaaaaaaaaaaaaaaaaa\n> bbbb');
  } finally { indented.tui.close(); }
  // A wrap point that lands on a space keeps it, so the halves do not glue.
  const spaced = open(12, 'hello world foo bar baz');
  try {
    const top = welcomeRows(10) + 1;
    spaced.key(`\x1b[<0;1;${top}M\x1b[<32;12;${top + 1}M\x1b[<0;12;${top + 1}m`);
    assert.equal(spaced.copy(), 'hello world foo bar baz');
  } finally { spaced.tui.close(); }
});

test('selection spans preserve wide and combining graphemes in both directions', () => {
  const lines = ['A中👩‍💻éZ', 'next   '];
  let state = reduceSelection(createSelection(), { type: 'start', at: { line: 0, column: 1 } });
  state = reduceSelection(state, { type: 'drag', at: { line: 0, column: 5 } });
  assert.equal(selectionText(state, lines), '中👩‍💻é');
  assert.equal(selectionColumn(lines[0]!, 2), 1);
  assert.equal(moveSelectionColumn(lines[0]!, 5, -1), 3);
  state = reduceSelection(state, { type: 'extend', to: { line: 1, column: 2 } });
  assert.equal(selectionText(state, lines), '中👩‍💻éZ\nnex');
  assert.equal(selectionText({ ...state, anchor: state.focus, focus: state.anchor }, lines), '中👩‍💻éZ\nnex');
  assert.equal(pad('中👩‍💻é', 5), '中👩‍💻é');
});

test('clipboard sequences match raw, kitty, tmux and screen framing with a byte cap', () => {
  const text = '中\u001b]52;test';
  const body = Buffer.from(text).toString('base64');
  const raw = `\x1b]52;c;${body}\x07`;
  assert.equal(osc52Payload(text, {}), raw);
  assert.equal(osc52Payload(text, { TERM: 'xterm-kitty' }), `\x1b]52;c;${body}\x1b\\`);
  assert.equal(osc52Payload(text, { TMUX: 'fixture' }), raw + `\x1bPtmux;${raw.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`);
  const long = 'a'.repeat(80), encoded = Buffer.from(long).toString('base64');
  assert.equal(osc52Payload(long, { STY: 'fixture' }),
    `\x1bP\x1b]52;c;${encoded.slice(0, 76)}\x1b\\\x1bP${encoded.slice(76)}\x07\x1b\\`);
  assert.throws(() => osc52Payload('中'.repeat(33334), {}), /100000 UTF-8 bytes/);
});

test('actual TUI input reaches contextual navigation while paste and overrides keep their intent', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, history: ['previous task'] }).start();
  const key = (text: string) => input.emit('data', text);
  const wait = () => new Promise(resolve => setTimeout(resolve, 70));
  try {
    for (let i = 0; i < 20; i++) tui.append({ kind: 'assistant', text: `line ${i}` });
    key('draft'); key('\u000f');
    assert.equal(tui.currentScreen, 'transcript');
    key('k'); assert.equal(tui.transcriptState.offset, 14);
    key('j'); assert.equal(tui.transcriptState.offset, 15);
    key('\u0005'); assert.equal(tui.transcriptState.showAll, true);
    key('g'); assert.equal(tui.transcriptState.offset, 0);
    key('G'); assert.equal(tui.transcriptState.offset, 15);
    key('\x1b[5~'); assert.equal(tui.transcriptState.offset, 9);
    key('q'); assert.equal(tui.currentScreen, 'chat');
    assert.equal(tui.state.text, 'draft');
    key('\u000f\x1b'); await wait();
    assert.equal(tui.currentScreen, 'chat');
    key('\x1b[200~jkq\x1b[201~');
    assert.equal(tui.state.text, 'draftjkq');
    key('\u001b'); key('c'); // Split Meta+C is a complete key, not Escape + ordinary c.
    assert.equal(tui.state.text, 'draftjkq');
    let submitted = 0; tui.on('submit', () => { submitted++; });
    key('\x1b[13;2u'); assert.equal(submitted, 0);
    assert.equal(tui.state.text, 'draftjkq\n');
    key('\x7f\u0012\t'); assert.equal(tui.currentScreen, 'chat');
    tui.setKeybindings({ '\u000f': null, '\r': 'newline' });
    key('\u000f\r'); assert.equal(tui.currentScreen, 'chat');
    assert.equal(tui.state.text, 'draftjkq\n');
    assert.equal(submitted, 0);
    tui.setKeybindings(); key('\r'); assert.equal(submitted, 1);
    key('\x1b[A'); assert.equal(tui.state.text, 'draftjkq\n');
  } finally { tui.close(); }
});

test('copied input rows keep visible navigation and raw submission aligned through resize and history', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const submitted: string[] = [];
  const tui = new TuiTerminal({ input, output, onSubmit: text => submitted.push(text) }).start();
  const key = (value: string) => input.emit('data', value);
  const raw = 'abcdefghijklmnopqrstuvwx0123456789ABCDEFGHIJ';
  try {
    key(raw);
    assert.ok(screenLines(output).includes('❯ ' + raw.slice(0, 37)));
    assert.ok(screenLines(output).includes('  ' + raw.slice(37)));
    assert.equal(decoded.get(output)!.buffer.active.cursorX, 9);
    key('\x1b[A'); assert.equal(tui.state.cursor, 7);
    assert.equal(decoded.get(output)!.buffer.active.cursorX, 9);
    key('X\x1b[B'); assert.equal(tui.state.cursor, 45);
    key('\x1b[H'); assert.equal(tui.state.cursor, 37);
    key('Y\u0001Z\u0005\r');
    assert.deepEqual(submitted, ['Z' + raw.slice(0, 7) + 'X' + raw.slice(7, 36) + 'Y' + raw.slice(36)]);
    key('\x1b[A'); assert.equal(tui.state.text, submitted[0]);
    key('\u0005\x1b[B'); assert.equal(tui.state.text, '');
    const unicode = 'é\u{1f469}‍\u{1f4bb}中';
    key(unicode.repeat(10)); Object.assign(output, { columns: 24 }); output.emit('resize');
    assert.equal(tui.state.text, unicode.repeat(10));
    key('\x1b[D!\r'); assert.equal(submitted[1], unicode.repeat(9) + unicode.slice(0, -1) + '!中');
  } finally { tui.close(); decoded.get(output)!.dispose(); }
});

test('TUI kill and yank commands fall through context bindings and isolate modal spans', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const submitted: string[] = [];
  const tui = new TuiTerminal({ input, output, onSubmit: text => submitted.push(text) }).start();
  const key = (value: string) => input.emit('data', value);
  try {
    key('alpha beta gamma\u0017\u0017\u0019\r'); assert.deepEqual(submitted, ['alpha beta gamma']);
    key('one two-three\x1b\u007f\x1b[D\x1b\u007f\u0019\x1by');
    assert.equal(tui.state.text, 'one three-');
    assert.ok(screenLines(output).includes('❯ one three-'));
    key('\x1b[C'); assert.equal(tui.state.text, 'one three-'); // Navigation interrupts the yank span.
    key('\x1by'); assert.equal(tui.state.text, 'one three-');
    const dialog = tui.prompt({ message: 'Answer', allowText: true }, new AbortController().signal);
    key('\u0019');
    key('answer words\u0017\u0019\r');
    assert.deepEqual(await dialog, { selected: [], text: 'answer words' });
    assert.equal(tui.state.text, 'one three-');
    key('\x1by'); assert.equal(tui.state.text, 'one three-');
    key('\u000c\u0019'); assert.equal(tui.state.text, 'two');
    tui.setKeybindings({ '\u0015': 'submit', '\u0019': null });
    key('\u0019\u0015'); assert.equal(submitted[1], 'two');
    tui.setKeybindings(); key('\u0019'); assert.equal(tui.state.text, 'two');
    key('\u0013replacement\u0013\x1by'); assert.equal(tui.state.text, 'two');
    const snapshot = tui.state; snapshot.killRing.ring.length = 0;
    assert.ok(tui.state.killRing.ring.length > 0);
  } finally { tui.close(); decoded.get(output)!.dispose(); }
});

test('TUI undo restores measured caret and isolates stash, dialog and rejected answer snapshots', async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const submitted: string[] = [];
  const tui = new TuiTerminal({ input, output, onSubmit: text => submitted.push(text) }).start();
  const key = (value: string) => input.emit('data', value);
  try {
    key('draft'); context.mock.timers.tick(1000);
    key('\x1b[D!\u001f'); assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, 4);
    assert.equal(decoded.get(output)!.buffer.active.cursorX, 6);
    key('\u001f'); assert.equal(tui.state.text, '');
    key('stash\u0013\u001f'); assert.equal(tui.state.text, '');
    key('\u0013\u001f'); assert.equal(tui.state.text, 'stash');
    const dialog = tui.prompt({ message: 'Answer', allowText: true, maxTextChars: 4 }, new AbortController().signal);
    key('good'); context.mock.timers.tick(1000); key('extra\u001f');
    assert.ok(screenLines(output).some(row => row.trim() === '>'));
    key('yes\r'); assert.deepEqual(await dialog, { selected: [], text: 'yes' });
    assert.equal(tui.state.text, 'stash');
    key('\r\u001f'); assert.deepEqual(submitted, ['stash']); assert.equal(tui.state.text, '');
    key('sta'); context.mock.timers.tick(1000); key('\u0012\u0012');
    assert.equal(tui.state.text, 'stash'); key('\u001f'); assert.equal(tui.state.text, 'sta');
    key('\u000c');
    key('pending'); context.mock.timers.tick(100); key(' timer');
    tui.close(); const frame = screenLines(output); context.mock.timers.tick(2000);
    assert.deepEqual(screenLines(output), frame);
  } finally { tui.close(); decoded.get(output)!.dispose(); context.mock.timers.reset(); }
});

test('the undo push treats a Vim INSERT run as one continuous gesture', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, editorMode: 'vim' }).start();
  const key = async (value: string) => { input.emit('data', value); if (value === '\x1b') await delay(70); };
  try {
    // `Er.current` opens on the first push of a run, so the rest of the typing coalesces through
    // the buffer's debounce; one undo therefore returns the text the run started from.
    for (const character of 'pqr') await key(character);
    await key('\x1b'); await key('u');
    assert.equal(tui.state.text, '', 'one undo drops the whole INSERT run');
    // Once a run's snapshot has landed, a mode switch opens a new run whose first push is its own
    // snapshot, so an undo straight after it returns the text before that run rather than the start.
    await key('i'); for (const character of 'abc') await key(character);
    await delay(1100);
    assert.equal(tui.state.text, 'abc');
    await key('\x1b'); await key('i'); await key('x'); await key('\x1b'); await key('u');
    assert.equal(tui.state.text, 'abc', 'the new run opens its own snapshot');
  } finally { tui.close(); decoded.get(output)!.dispose(); }
});

test('grouped questions step through each question and review before submitting', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ title: 'Questions', message: '', groups: [
      { key: 'First', title: 'First', message: 'Pick one', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Pick many',
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }], multiple: true },
    ] }, new AbortController().signal);
    assert.equal(frame()[0], 'First');
    assert.match(frame().at(-1)!, /Question 1 of 2/);
    key('\x1b[B\r');
    assert.equal(frame()[0], 'Second');
    assert.match(frame().at(-1)!, /Question 2 of 2/);
    key(' \x1b[B \r');
    // The review page lists every answer before the request settles.
    assert.equal(frame()[0], 'Review your answers');
    assert.ok(frame().includes('-   B'), drawn);
    assert.ok(frame().includes('-   X, Y'), drawn);
    assert.ok(frame().includes('Ready to submit your answers?'));
    assert.ok(frame().includes('[ Submit answers ]  [ Cancel ]'));
    assert.match(frame().at(-1)!, /Enter submit/);
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [
      { key: 'First', selected: ['B'] }, { key: 'Second', selected: ['X', 'Y'] }] });
  } finally { tui.close(); }
});

test('a single non-multi-select question submits when its answer is taken', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', groups: [
      { key: 'Only', title: 'Only', message: 'Pick', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] }] },
    new AbortController().signal);
    assert.equal(frame()[0], 'Only');
    // Right does not open a review tab: the source's next-tab bound is 0 for this question.
    key('\x1b[C');
    assert.equal(frame()[0], 'Only');
    key('\x1b[B\r');
    assert.deepEqual(await pending, { selected: [], groups: [{ key: 'Only', selected: ['B'] }] });
    assert.ok(!drawn.includes('Review your answers'));
  } finally { tui.close(); }
});

test('AFK settings follow the recovered enable gate and environment overrides', () => {
  assert.equal(afkTimeoutSettings(undefined, {}), undefined);
  assert.equal(afkTimeoutSettings(null, {}), undefined);
  assert.deepEqual(afkTimeoutSettings(60_000, {}), { timeoutMs: 60_000, countdownMs: 20_000 });
  assert.deepEqual(afkTimeoutSettings(null, { CLAUDE_AFK_TIMEOUT_MS: '120000' }),
    { timeoutMs: 120_000, countdownMs: 20_000 });
  assert.deepEqual(afkTimeoutSettings(60_000,
    { CLAUDE_AFK_TIMEOUT_MS: 'not-a-number', CLAUDE_AFK_COUNTDOWN_MS: '5000' }),
    { timeoutMs: 60_000, countdownMs: 5000 });
  assert.deepEqual(afkTimeoutSettings(10_000, {}), { timeoutMs: 10_000, countdownMs: 10_000 });
  assert.deepEqual(afkCountdown({ timeoutMs: 60_000, countdownMs: 20_000 }, 60, 39_999),
    { remainingSeconds: 60, showCountdown: false });
  assert.deepEqual(afkCountdown({ timeoutMs: 60_000, countdownMs: 20_000 }, 60, 40_000),
    { remainingSeconds: 20, showCountdown: true });
  assert.deepEqual(afkCountdown({ timeoutMs: 60_000, countdownMs: 20_000 }, 60, 60_000),
    { remainingSeconds: 0, showCountdown: true });
  // `Kdt`/`XZe`: only the three explicit durations arm the dialog clock.
  assert.equal(askUserQuestionTimeoutMs('60s'), 60_000);
  assert.equal(askUserQuestionTimeoutMs('5m'), 300_000);
  assert.equal(askUserQuestionTimeoutMs('10m'), 600_000);
  assert.equal(askUserQuestionTimeoutMs('never'), null);
  assert.equal(askUserQuestionTimeoutMs(undefined), null);
  assert.equal(askUserQuestionTimeoutMs('1h'), null);
});

test('the AFK countdown auto-continues with the answers taken so far', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_000_000 });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', afkTimeoutMs: 60_000, groups: [
      { key: 'First', title: 'First', message: 'Pick one', multiple: true,
        choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Pick many', multiple: true,
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }] },
    ] }, new AbortController().signal);
    key(' \r');           // First takes A and advances.
    key('\x1b[O');        // Focus leaves; idle time starts counting.
    context.mock.timers.tick(40_000);
    assert.match(frame().at(-1)!, /auto-continue in 20s · any key to stay/);
    key('\x1b[B');        // Any key stays; the countdown clears on the next tick.
    assert.ok(frame().at(-1)!.includes('auto-continue in 20s · any key to stay'), drawn);
    context.mock.timers.tick(1_000);
    assert.ok(!frame().at(-1)!.includes('auto-continue'), drawn);
    key('\x1b[O');        // Focus leaves again, so idle time resumes.
    context.mock.timers.tick(60_000);
    assert.deepEqual(await pending, { selected: [], groups: [{ key: 'First', selected: ['A'] }], afkTimeoutMs: 60_000 });
  } finally { tui.close(); context.mock.timers.reset(); }
});

test('AFK stays at full while the terminal is focused', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 2_000_000 });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', afkTimeoutMs: 60_000, groups: [
      { key: 'Only', title: 'Only', message: 'Pick', multiple: true,
        choices: [{ label: 'A', value: 'A' }] }] }, new AbortController().signal);
    key('\x1b[I');        // Focus is held.
    context.mock.timers.tick(120_000);
    assert.ok(!frame().at(-1)!.includes('auto-continue'), drawn);
    key('\x1b[O');
    context.mock.timers.tick(60_000);
    assert.deepEqual(await pending, { selected: [], groups: [], afkTimeoutMs: 60_000 });
  } finally { tui.close(); context.mock.timers.reset(); }
});

test('notes alone answer a preview question with the source notes-only marker', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', groups: [
      { key: 'Design', title: 'Design', message: 'Pick a design', choices: [
        { label: 'A', value: 'A', preview: 'Preview A' },
        { label: 'B', value: 'B', preview: 'Preview B' }] }] }, new AbortController().signal);
    assert.ok(frame().includes('Notes: press n to add notes'));
    key('n');
    assert.match(frame().at(-1)!, /Notes · Enter save \/ Esc exit/);
    assert.ok(frame().includes('Notes:'));
    key('note');
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [{
      key: 'Design', selected: [], text: '(notes only)', notes: 'note' }] });
  } finally { tui.close(); }
});

test('notes persist when an option is taken and stay off non-preview questions', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', groups: [
      { key: 'Design', title: 'Design', message: 'Pick a design', choices: [
        { label: 'A', value: 'A', preview: 'Preview A' },
        { label: 'B', value: 'B', preview: 'Preview B' }] },
      { key: 'Extra', title: 'Extra', message: 'Pick many', multiple: true, choices: [
        { label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }] },
    ] }, new AbortController().signal);
    key('n'); key('note'); key('\x1b');
    await delay(60);          // The standalone escape is held briefly by the decoder.
    assert.ok(frame().includes('Notes: note'));
    key('\x1b[B\r');          // move to B and take it; the note rides along.
    assert.equal(frame()[0], 'Extra');
    assert.ok(!frame().some(line => line.startsWith('Notes:')), 'multi-select has no notes row');
    key(' \r');
    assert.equal(frame()[0], 'Review your answers');
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [
      { key: 'Design', selected: ['B'], notes: 'note' },
      { key: 'Extra', selected: ['X'] }] });
  } finally { tui.close(); }
});

test('chat clarification returns stored answers and unsent notes, with Up returning to the choices', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 18 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', allowClarification: true, groups: [
      { key: 'First', title: 'First', message: 'First?', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Second?', choices: [
        { label: 'X', value: 'X', preview: 'Preview X' }, { label: 'Y', value: 'Y' }], allowText: true },
    ] }, new AbortController().signal);
    key('\r');
    key('n'); key('unsent note'); key('\x1b'); await delay(60);
    Object.assign(output, { rows: 10 }); output.emit('resize');
    key('\x1b[B\x1b[B\x1b[B');
    assert.ok(frame().includes('> Chat about this'));
    key('\x1b[A');
    assert.ok(frame().includes('> Other'));
    key('\x1b[B\r');
    assert.deepEqual(await pending, { selected: [], clarify: true, groups: [
      { key: 'First', selected: ['A'] }, { key: 'Second', selected: [], notes: 'unsent note' },
    ] });
    const controller = new AbortController();
    const ordinary = tui.prompt({ message: '', groups: [
      { key: 'Only', title: 'Only', message: 'Only?', choices: [{ label: 'A', value: 'A' }] },
    ] }, controller.signal);
    assert.equal(frame().some(line => line.includes('Chat about this')), false);
    controller.abort(); assert.equal(await ordinary, undefined);
  } finally { tui.close(); }
});

test('clarification keeps the current multi-select choices and Other text before submit', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    const pending = tui.prompt({ message: '', allowClarification: true, groups: [
      { key: 'Tags', message: 'Tags?', multiple: true, allowText: true,
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }] },
    ] }, new AbortController().signal);
    key(' \x1b[B\x1b[Bextra\x1b[B\r');
    assert.deepEqual(await pending, { selected: [], clarify: true,
      groups: [{ key: 'Tags', selected: ['X'], text: 'extra' }] });
  } finally { tui.close(); }
});

test('question external editor preserves notes, Other selections and root draft ownership', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'question-editor-'));
  const visual = process.env.VISUAL;
  const script = path.join(root, 'editor.mjs'), observed = path.join(root, 'observed.json');
  fs.writeFileSync(script, `import fs from 'node:fs';const file=process.argv.at(-1);fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify({content:fs.readFileSync(file,'utf8'),args:process.argv.slice(2)}));fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' edited\\n');`);
  process.env.VISUAL = process.execPath + ' ' + script;
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = raw => {input.isRaw = raw;};
  const output = new Writable({write(_chunk, _encoding, done) {done();}});
  Object.assign(output, {isTTY:true,columns:80,rows:24});watchScreen(output);
  const tui = new TuiTerminal({input,output,workspace:root}).start();
  const key = (text: string) => input.emit('data',text);
  const edited = async (text: string) => {
    for(let i=0;i<150 && !screenLines(output).some(line=>line.includes(text));i++)await delay(10);
    assert.ok(screenLines(output).some(line=>line.includes(text)));assert.equal(input.isRaw,true);
  };
  try {
    key('root draft'); const draft = structuredClone(tui.state);
    tui.setRunning(true);
    const pending = tui.prompt({message:'',allowClarification:true,groups:[
      {key:'same:first',message:'First?',choices:[{label:'A',value:'A',preview:'exact preview'},{label:'B',value:'B'}]},
      {key:'same:second',message:'Second?',allowText:true,choices:[{label:'X',value:'X'}]},
      {key:'same:third',message:'Third?',multiple:true,allowText:true,choices:[{label:'Y',value:'Y'}]},
    ]},new AbortController().signal);
    key('\u0007');assert.equal(fs.existsSync(observed),false);
    key('\x1b[B');key('n');key('seed\u0007\r');assert.equal(input.isRaw,false);await edited('seed edited');
    assert.equal(JSON.parse(fs.readFileSync(observed,'utf8')).content,'seed');
    assert.equal(JSON.parse(fs.readFileSync(observed,'utf8')).args.length,1);
    key('\r');
    key('\x1b[Bsingle\u0018');key('z');key('\u0007');await edited('singlez edited');key('\r');
    key(' \x1b[Bmulti\u0007');await edited('multi edited');key('\x1b[B\r');
    assert.deepEqual(await pending,{selected:[],clarify:true,groups:[
      {key:'same:first',selected:['B'],notes:'seed edited'},
      {key:'same:second',selected:[],text:'singlez edited'},
      {key:'same:third',selected:['Y'],text:'multi edited'},
    ]});
    assert.deepEqual(tui.state,draft.running ? draft : {...draft,running:true});
  } finally {tui.close();if(visual===undefined)delete process.env.VISUAL;else process.env.VISUAL=visual;fs.rmSync(root,{recursive:true,force:true});}
});

test('question external editor cancellation waits descendants and rejects a stale duplicate-header result', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'question-cancel-'));
  const visual=process.env.VISUAL,script=path.join(root,'editor.mjs'),ready=path.join(root,'ready.json');
  fs.writeFileSync(script,`import fs from 'node:fs';import {spawn} from 'node:child_process';const file=process.argv.at(-1);const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(file,'stale');fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({file,pid:process.pid,child:child.pid}));setInterval(()=>{},1000);`);
  process.env.VISUAL=process.execPath+' '+script;
  const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=raw=>{input.isRaw=raw;};
  const output=new Writable({write(_chunk,_encoding,done){done();}});Object.assign(output,{isTTY:true,columns:80,rows:24});
  const tui=new TuiTerminal({input,output,workspace:root}).start();
  const request={message:'',groups:[{key:'same',message:'Same?',allowText:true,choices:[{label:'A',value:'A'}]}]};
  try {
    const controller=new AbortController(),pending=tui.prompt(request,controller.signal);
    input.emit('data','\x1b[Boriginal\u0007');
    // `existsSync` can observe the file after `open` but before the editor's
    // write lands, so parse in the poll rather than once after it.
    const readyJson=async():Promise<{file:string;pid:number;child:number}>=>{
      for(let i=0;i<150;i++){try{return JSON.parse(fs.readFileSync(ready,'utf8'));}catch{await delay(10);}}
      throw new Error(`editor readiness file never parsed: ${ready}`);
    };
    const active=await readyJson();
    controller.abort();assert.equal(await pending,undefined);
    assert.equal(fs.existsSync(active.file),false);assert.equal(fs.existsSync(path.dirname(active.file)),false);
    for(const pid of [active.pid,active.child])assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
    assert.equal(input.isRaw,true);
    const next=tui.prompt(request,new AbortController().signal);
    input.emit('data','\x1b[Bfresh\r');assert.deepEqual(await next,{selected:[],groups:[{key:'same',selected:[],text:'fresh'}]});
    fs.rmSync(ready);const closing=tui.prompt(request,new AbortController().signal);
    input.emit('data','\x1b[B\u0007');const last=await readyJson();
    tui.close();assert.equal(await closing,undefined);assert.equal(input.isRaw,false);
    assert.equal(fs.existsSync(last.file),false);for(const pid of [last.pid,last.child])assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
    fs.writeFileSync(script,`import fs from 'node:fs';import {spawn} from 'node:child_process';const file=process.argv.at(-1);const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(file,'fresh external');fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({file,pid:process.pid,child:child.pid}));child.unref();`);
    fs.rmSync(ready);
    const input2=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
    input2.isTTY=true;input2.isRaw=false;input2.setRawMode=raw=>{
      if(raw && fs.existsSync(ready)) {
        const active=JSON.parse(fs.readFileSync(ready,'utf8'));
        assert.throws(()=>process.kill(active.child,0),{code:'ESRCH'});
        assert.equal(fs.existsSync(active.file),false);
      }
      input2.isRaw=raw;
    };
    const resumed=new TuiTerminal({input:input2,output,workspace:root}).start();
    try {
      const normal=resumed.prompt(request,new AbortController().signal);
      input2.emit('data','\x1b[Bseed\u0007');
      for(let i=0;i<300&&!input2.isRaw;i++)await delay(10);
      assert.equal(input2.isRaw,true);assert.ok(fs.existsSync(ready));
      input2.emit('data','\r');
      assert.deepEqual(await normal,{selected:[],groups:[{key:'same',selected:[],text:'fresh external'}]});
    } finally {resumed.close();}
    fs.rmSync(ready);
    fs.writeFileSync(script,`import fs from 'node:fs';process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({file:process.argv.at(-1),pid:process.pid}));setInterval(()=>{},1000);`);
    fs.writeFileSync(path.join(root,'ps'),'#!/bin/sh\nexit 2\n',{mode:0o700});
    const previousPath=process.env.PATH;
    process.env.PATH=root+path.delimiter+(previousPath??'');
    const input3=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
    input3.isTTY=true;input3.isRaw=false;input3.setRawMode=raw=>{input3.isRaw=raw;};
    const failing=new TuiTerminal({input:input3,output,workspace:root}).start();
    let ownedPid: number | undefined;
    let cancelled: Promise<unknown> | undefined;
    try {
      const controller=new AbortController();
      cancelled=failing.prompt(request,controller.signal);
      input3.emit('data','\x1b[Boriginal\u0007');
      for(let i=0;i<150&&!fs.existsSync(ready);i++)await delay(10);
      assert.ok(fs.existsSync(ready));const active=JSON.parse(fs.readFileSync(ready,'utf8'));ownedPid=active.pid;
      controller.abort();
      assert.equal(await Promise.race([cancelled,delay(3000).then(()=>'timed out')]),undefined);
      assert.throws(()=>process.kill(active.pid,0),{code:'ESRCH'});
      assert.equal(fs.existsSync(path.dirname(active.file)),false);
      assert.equal(input3.isRaw,true);
    } finally {
      if(ownedPid!==undefined)try{process.kill(ownedPid,'SIGKILL');}catch{}
      if(cancelled)await Promise.race([cancelled,delay(3000)]);
      failing.close();if(previousPath===undefined)delete process.env.PATH;else process.env.PATH=previousPath;
    }
  } finally {tui.close();if(visual===undefined)delete process.env.VISUAL;else process.env.VISUAL=visual;fs.rmSync(root,{recursive:true,force:true});}
});

test('question external editor keeps null and unchanged text, bounds edited text and pauses AFK', async () => {
  const root=fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'question-results-'));
  const visual=process.env.VISUAL,script=path.join(root,'editor.mjs'),mode=path.join(root,'mode');
  fs.writeFileSync(script,`import fs from 'node:fs';const file=process.argv.at(-1),mode=fs.readFileSync(${JSON.stringify(mode)},'utf8');if(mode==='null')process.exit(7);if(mode==='long')fs.writeFileSync(file,'x'.repeat(8193));if(mode==='wait')await new Promise(resolve=>setTimeout(resolve,1300));`);
  process.env.VISUAL=process.execPath+' '+script;
  const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};input.isTTY=true;input.isRaw=false;input.setRawMode=raw=>{input.isRaw=raw;};
  const output=new Writable({write(_chunk,_encoding,done){done();}});Object.assign(output,{isTTY:true,columns:80,rows:24});
  const tui=new TuiTerminal({input,output,workspace:root}).start();let settled=false;
  try {
    const pending=tui.prompt({message:'',afkTimeoutMs:500,groups:[{key:'Notes',message:'Notes?',choices:[{label:'A',value:'A',preview:'exact'}]}]},new AbortController().signal).then(answer=>{settled=true;return answer;});
    input.emit('data','n');input.emit('data','original');
    for(const value of ['null','unchanged','long','wait']) {
      fs.writeFileSync(mode,value);input.emit('data','\u0007');assert.equal(input.isRaw,false);
      for(let i=0;i<200&&!input.isRaw;i++)await delay(10);
      assert.equal(input.isRaw,true);assert.equal(settled,false);
    }
    input.emit('data','\r');assert.deepEqual(await pending,{selected:[],groups:[{key:'Notes',selected:[],text:'(notes only)',notes:'original'}]});
  } finally {tui.close();if(visual===undefined)delete process.env.VISUAL;else process.env.VISUAL=visual;fs.rmSync(root,{recursive:true,force:true});}
});

test('a grouped question can be reopened from the review page and cancelled', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 60, rows: 14 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).map(line => line.trim()).filter(Boolean);
  try {
    const pending = tui.prompt({ message: '', groups: [
      { key: 'First', title: 'First', message: 'Pick one', choices: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }] },
      { key: 'Second', title: 'Second', message: 'Pick many',
        choices: [{ label: 'X', value: 'X' }, { label: 'Y', value: 'Y' }], multiple: true },
    ] }, new AbortController().signal);
    key('\r');            // first question keeps A
    key(' \r');           // second question takes X
    assert.equal(frame()[0], 'Review your answers');
    // Left steps back one question, so it reopens the last one with its answer.
    key('\x1b[D');
    assert.equal(frame()[0], 'Second');
    assert.ok(frame().includes('Selected: X'), drawn);
    key('\x1b[D');
    assert.equal(frame()[0], 'First');
    assert.ok(frame().includes('Selected: A'), drawn);
    key('\x1b[B\r');      // change it to B, which advances to the second question
    assert.equal(frame()[0], 'Second');
    // Right on the last question opens the review page, as the last tab does.
    key('\x1b[C');
    assert.equal(frame()[0], 'Review your answers');
    key('\r');
    assert.deepEqual(await pending, { selected: [], groups: [
      { key: 'First', selected: ['B'] }, { key: 'Second', selected: ['X'] }] });
    // Escape on the review page cancels the whole request.
    const cancelled = tui.prompt({ message: '', groups: [
      { key: 'Only', title: 'Only', message: 'Pick', multiple: true,
        choices: [{ label: 'A', value: 'A' }] }] }, new AbortController().signal);
    key(' \r'); key('\x1b');
    assert.equal(await cancelled, undefined);
  } finally { tui.close(); }
});

test('the focused choice shows its preview in a box beside the options', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 80, rows: 16 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output);
  try {
    const pending = tui.prompt({ title: 'Pick', message: 'Choose', choices: [
      { label: 'A', value: 'A', preview: '# Heading\n\n- one' },
      { label: 'B', value: 'B', preview: Array.from({ length: 20 }, (_, index) => `row ${index}`).join('\n') },
    ] }, new AbortController().signal);
    const first = frame();
    // The focused choice's preview renders as a bordered box to the right.
    assert.ok(first.some(line => line.includes('┌') && line.includes('┐')), drawn);
    assert.ok(first.some(line => line.includes('Heading')), drawn);
    assert.equal(first.some(line => line.includes('# Heading')), false);
    assert.ok(first.some(line => line.includes('- one')), drawn);
    key('\x1b[B');
    const second = frame();
    // A body taller than the box ends with the recovered hidden-lines rule.
    assert.ok(second.some(line => /─── ✂ ─── \d+ lines hidden/.test(line)), drawn);
    assert.ok(!second.some(line => line.includes('Heading')), drawn);
    assert.ok(second.some(line => line.includes('└') && line.includes('┘')), drawn);
    assert.ok(second.every(line => cellWidth(line) <= 80));
    key('\r');
    assert.deepEqual(await pending, { selected: ['B'] });
    const fallback = tui.prompt({ message: 'Choose', choices: [
      { label: 'A', value: 'A', preview: 'x'.repeat(2001) },
      { label: 'B', value: 'B' },
      { label: 'C', value: 'C', preview: '```\n' + 'row\n'.repeat(30) + '```' },
    ] }, new AbortController().signal);
    assert.ok(frame().some(line => line.includes('preview cannot be shown')), drawn);
    key('\x1b[B');
    assert.ok(frame().some(line => line.includes('No preview available')), drawn);
    Object.assign(output, { columns: 40, rows: 24 }); output.emit('resize');
    assert.ok(frame().some(line => line.trim() === 'Preview:'), drawn);
    assert.ok(frame().some(line => line.includes('No preview available')), drawn);
    assert.ok(frame().every(line => cellWidth(line) <= 40));
    key('\x1b[B');
    assert.ok(frame().some(line => line.includes('└') && line.includes('┘')), drawn);
    assert.ok(frame().some(line => /\d+ lines hidden/.test(line)), drawn);
    key('\x1b'); tui.close();
    assert.equal(await fallback, undefined);
  } finally { tui.close(); }
});

test('streamed assistant text shares one formatted message and retains its response boundaries', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const text = '# Message layout\n\nOne streamed sentence keeps its words together.\n\n- First item\n\n```ts\nconst value = 1;\n```\n';
  try {
    tui.beginAssistantMessage();
    for (let offset = 0; offset < text.length; offset += 5) tui.writeAssistantText(text.slice(offset, offset + 5));
    assert.equal(tui.transcriptState.entries.length, 0);
    context.mock.timers.tick(99); assert.equal(tui.transcriptState.entries.length, 0);
    context.mock.timers.tick(1);
    assert.equal(tui.transcriptState.entries[0]?.streaming, true);
    assert.equal(tui.transcriptState.entries[0]?.hideTrailingLine, true);
    const messageKey = tui.transcriptState.entries[0]?.messageKey;
    assert.ok(messageKey);
    tui.endAssistantMessage();
    assert.equal(tui.transcriptState.entries[0]?.streaming, undefined);
    assert.deepEqual(tui.transcriptState.entries, [{ kind: 'assistant', speaker: true, markdown: text,
      text: 'Message layout\n\nOne streamed sentence keeps its words together.\n\n- First item\n\nts\nconst value = 1;' }]);
    const lines = transcriptLines(tui.transcriptState, 40);
    assert.equal(lines[0], '● Message layout');
    assert.ok(lines.every(line => cellWidth(line) <= 40));
    const sentenceRows = renderedTranscriptRows(createTranscriptState([{ kind: 'assistant', speaker: true,
      text: 'One streamed sentence keeps its words together.' }]), 40);
    assert.equal(selectionTextFromRows({ anchor: { line: 0, column: 2 },
      focus: { line: sentenceRows.length - 1, column: 39 }, dragging: false }, sentenceRows),
      'One streamed sentence keeps its words together.');
    for (const body of ['界👩‍💻é'.repeat(12), '👨‍👩‍👧‍👦'.repeat(12),
      '\u{F0000}👩‍💻\u{20000}\u{2FA1D}'.repeat(12), '🇺🇸1️⃣👍🏽'.repeat(12)]) {
      const rows = renderedTranscriptRows(createTranscriptState([{ kind: 'assistant', speaker: true, text: body }]), 20);
      const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const boundaries = new Set([...segments.segment(body)].map(part => part.index));
      boundaries.add(body.length);
      let offset = 0;
      for (const row of rows) {
        assert.ok(cellWidth(row.text) <= 20);
        offset += row.text.slice(2).length;
        assert.ok(boundaries.has(offset), `row splits a grapheme at ${offset}`);
      }
      assert.equal(rows.map(row => row.text.slice(2)).join(''), body);
      assert.equal(selectionTextFromRows({ anchor: { line: 0, column: 2 },
        focus: { line: rows.length - 1, column: 19 }, dragging: false }, rows), body);
    }
    const colored = wrapMessageText('\x1b[31m' + '👩‍💻é'.repeat(8) + '\x1b[39m', 8);
    assert.equal(colored.replace(/\x1b\[[\d;]*m/g, '').replaceAll('\n', ''), '👩‍💻é'.repeat(8));
    const linked = wrapMessageText('\x1b]8;;https://example.test/\u{F0000}\x07'
      + '👩‍💻'.repeat(8) + '\x1b]8;;\x07', 6);
    assert.ok(linked.includes('https://example.test/\u{F0000}'));
    assert.equal(linked.replace(/\x1b\]8;;[^\x07]*\x07/g, '').replaceAll('\n', ''), '👩‍💻'.repeat(8));
    assert.equal(lines.some(line => line.includes('earlier lines')), false);
    Object.assign(output, { columns: 100 }); output.emit('resize');
    const frame = screenLines(output).join('\n');
    assert.ok(frame.includes('One streamed sentence keeps its words together.'));
    assert.equal(frame.includes('```'), false);
    tui.beginAssistantMessage(); tui.writeAssistantText('Next\nresponse');
    context.mock.timers.tick(100);
    assert.notEqual(tui.transcriptState.entries[1]?.messageKey, messageKey);
    tui.endAssistantMessage();
    assert.equal(tui.transcriptState.entries.length, 2);
    assert.equal(tui.transcriptState.entries[1]?.text, 'Next\nresponse');
    tui.beginAssistantMessage(); tui.endAssistantMessage();
    assert.equal(tui.transcriptState.entries.length, 2);
    const long = 'Long response\n' + 'row\n'.repeat(30);
    tui.beginAssistantMessage(); tui.writeAssistantText(long); tui.endAssistantMessage();
    assert.equal(transcriptLines({ ...tui.transcriptState, entries: tui.transcriptState.entries.slice(-1) }, 40).length, 31);
    tui.close(); drawn = ''; context.mock.timers.tick(500);
    assert.equal(drawn, '');
  } finally { tui.close(); context.mock.timers.reset(); }
});

test('the source preview coalesces updates and releases pending work on end, error and close', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const store = tLo();
  const calls: (string | null)[] = [];
  const coalescer = clt({ scheduleTimeout: (flush: () => void, ms: number) => {
    assert.equal(ms, 100);
    const timer = setTimeout(flush, ms); return () => clearTimeout(timer);
  }, onFlush: (text: string | null) => { calls.push(text); store.setRaw(text); } });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let written = '';
  const output = new Writable({ write(chunk, _encoding, done) { written += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  try {
    let notified = 0; const unsubscribe = store.subscribe(() => notified++);
    const initial = store.getDerived();
    coalescer.apply(() => 'complete line\n'); coalescer.apply((value: string | null) => value + 'partial tail');
    context.mock.timers.tick(99); assert.equal(store.getDerived(), initial);
    context.mock.timers.tick(1); assert.deepEqual(calls, ['complete line\npartial tail']);
    assert.equal(store.getDerived().hideTrailingLine, true);
    const snapshot = store.getDerived(); store.setRaw(snapshot.displayed);
    assert.equal(store.getDerived(), snapshot); assert.equal(notified, 1);
    store.setTransformed('display replacement'); assert.equal(store.getDerived().hideTrailingLine, false);
    store.setTransformed(null); store.setRewrite({ original: 'complete', text: 'rewritten' });
    assert.equal(store.getDerived().displayed, 'rewritten line\npartial tail');
    store.setRewrite(null); store.setSalvage('prefix ', true);
    assert.equal(store.getDerived().displayed, 'prefix complete line\npartial tail');
    unsubscribe(); const previous = notified;
    coalescer.clear(); assert.equal(notified, previous);
    coalescer.apply(() => 'forced'); coalescer.flushNow();
    assert.equal(calls.at(-1), 'forced');
    coalescer.apply(() => 'discarded'); coalescer.dispose();
    context.mock.timers.tick(100); assert.equal(calls.at(-1), 'forced');

    tui.beginAssistantMessage(); tui.writeAssistantText('complete line\npartial tail');
    written = ''; context.mock.timers.tick(99); assert.equal(written, '');
    context.mock.timers.tick(1);
    assert.ok(screenLines(output).some(line => line.includes('complete line')));
    assert.equal(screenLines(output).some(line => line.includes('partial tail')), false);
    tui.writeAssistantText(' finished'); tui.endAssistantMessage();
    assert.ok(screenLines(output).some(line => line.includes('partial tail finished')));
    written = ''; context.mock.timers.tick(500); assert.equal(written, '');
    tui.beginAssistantMessage(); tui.writeAssistantText('fast response'); tui.endAssistantMessage();
    assert.equal(tui.transcriptState.entries.at(-1)?.text, 'fast response');
    let ended = false; tui.on('exit', () => ended = true);
    tui.beginAssistantMessage(); tui.writeAssistantText('cancelled pending response');
    input.emit('error', new Error('fixture input failure'));
    assert.equal(ended, true);
    written = ''; context.mock.timers.tick(500); assert.equal(written, '');
    assert.equal(tui.transcriptState.entries.some(entry => entry.text.includes('cancelled pending response')), false);

    const failing = new TuiTerminal({ input, output }).start();
    try {
      let failure: Error | undefined; let exited = false;
      failing.on('inputError', error => failure = error); failing.on('exit', () => exited = true);
      failing.beginAssistantMessage();
      context.mock.method(failing as unknown as { paintAssistantPreview(): void }, 'paintAssistantPreview', () => {
        throw new Error('fixture deferred render failure');
      });
      failing.writeAssistantText('pending render');
      context.mock.timers.tick(100);
      assert.equal(failure?.message, 'fixture deferred render failure'); assert.equal(exited, true);
      assert.ok(written.includes(LEAVE_ALT_SCREEN));
      written = ''; context.mock.timers.tick(500); assert.equal(written, '');
    } finally { failing.close(); }
  } finally { coalescer.dispose(); tui.close(); context.mock.timers.reset(); }
});

test('source reduced-motion and Windows Terminal gates hide previews while final text stays complete', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = process.env.WT_SESSION;
  try {
    for (const [reducedMotion, windowsTerminal] of [[undefined, false], [false, false], [true, false], [undefined, true]] as const) {
      if (windowsTerminal) process.env.WT_SESSION = 'owned-terminal-fixture'; else delete process.env.WT_SESSION;
      const visible = !reducedMotion && !windowsTerminal;
      assert.equal(Zqn(reducedMotion, l$t()), visible);
      const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
      input.isTTY = true; input.setRawMode = () => {};
      const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
      Object.assign(output, { isTTY: true, columns: 40, rows: 18 }); watchScreen(output);
      const tui = new TuiTerminal({ input, output, prefersReducedMotion: reducedMotion }).start();
      try {
        tui.beginAssistantMessage(); tui.writeAssistantText('complete prefix\npartial tail');
        context.mock.timers.tick(100);
        assert.equal(screenLines(output).some(line => line.includes('complete prefix')), visible);
        assert.equal(screenLines(output).some(line => line.includes('partial tail')), false);
        tui.setPrefersReducedMotion(false);
        assert.equal(screenLines(output).some(line => line.includes('complete prefix')), !windowsTerminal);
        tui.setPrefersReducedMotion(true);
        assert.equal(screenLines(output).some(line => line.includes('complete prefix')), false);
        assert.equal(tui.transcriptState.entries.filter(entry => entry.streaming).length, windowsTerminal ? 0 : 1);
        tui.writeAssistantText(' completed'); tui.endAssistantMessage();
        assert.ok(screenLines(output).some(line => line.includes('partial tail completed')));
        assert.equal(tui.transcriptState.entries.at(-1)?.markdown, 'complete prefix\npartial tail completed');
        tui.setPrefersReducedMotion(undefined);
        assert.ok(screenLines(output).some(line => line.includes('complete prefix')));
        tui.beginAssistantMessage(); tui.writeAssistantText('next prefix\nnext tail');
        context.mock.timers.tick(100);
        assert.equal(screenLines(output).some(line => line.includes('next prefix')), !windowsTerminal);
        tui.endAssistantMessage();
        assert.equal(tui.transcriptState.entries.length, 2);
      } finally { tui.close(); }
    }
  } finally {
    if (previous === undefined) delete process.env.WT_SESSION; else process.env.WT_SESSION = previous;
    context.mock.timers.reset();
  }
});

test('source Markdown components preserve cell styles, Unicode copies, width and document teardown', () => {
  const document = new TuiDocumentRenderer();
  const screen = new HeadlessTerminal({ cols: 40, rows: 24, allowProposedApi: true, logLevel: 'off' });
  const colors = ge as unknown as { level: number };
  const color = colors.level;
  try {
    colors.level = 3;
    const rows = document.renderMarkdown('# Heading\n\n- one\n  - child\n\n> quote\n\n```ts\nconst value = 1;\n```', 40, { speaker: true });
    (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(rows.map(row => row.ansi).join('\r\n'));
    assert.equal(rows[0]?.text, `${process.platform === 'darwin' ? '⏺' : '●'} Heading`);
    assert.ok(screen.buffer.active.getLine(0)!.getCell(2)!.isBold());
    assert.ok(screen.buffer.active.getLine(0)!.getCell(2)!.isUnderline());
    assert.ok(rows.some(row => row.text === '    - child'));
    assert.ok(rows.some(row => row.text === '  ▎ quote'));
    const code = rows.findIndex(row => row.text === '  const value = 1;');
    assert.ok(code >= 0);
    assert.ok(screen.buffer.active.getLine(code)!.getCell(2)!.isFgPalette());
    assert.equal(screen.buffer.active.getLine(code)!.getCell(2)!.getFgColor(), 4);
    assert.equal(rows.some(row => row.text.includes('```') || row.text === '  ts'), false);
    for (const text of ['One streamed sentence keeps its words together.', '界👩‍💻é'.repeat(12),
      '\u{F0000}👩‍💻\u{20000}\u{2FA1D}'.repeat(8)]) {
      const wrapped = document.renderMarkdown(text, 20, { speaker: true });
      assert.ok(wrapped.every(row => cellWidth(row.text) <= 20));
      assert.equal(selectionTextFromRows({ anchor: { line: 0, column: 2 },
        focus: { line: wrapped.length - 1, column: 19 }, dragging: false }, wrapped), text);
    }
    const table = document.renderMarkdown('| A | B |\n|---|---|\n| x | y |', 20, { speaker: true });
    assert.ok(table[0]?.text.includes('┌─────┬─────┐'));
    assert.ok(table.at(-1)?.text.includes('└─────┴─────┘'));
    const prefix = 'Stable paragraph with content.\n\n'.repeat(180);
    const open = prefix + '```ts\n' + 'const value = 1;\n'.repeat(350);
    document.renderMarkdown(prefix, 80, { speaker: true, streaming: true, messageKey: 'stream' });
    const streamed = document.renderMarkdown(open, 80, { speaker: true, streaming: true, messageKey: 'stream' });
    assert.equal(streamed.filter(row => row.text === '  Stable paragraph with content.').length, 179);
    assert.equal(streamed.filter(row => row.text === '  const value = 1;').length, 350);
    const closed = document.renderMarkdown(open + '```\n\nTail.', 80, { speaker: true, streaming: true, messageKey: 'stream' });
    assert.equal(closed.at(-1)?.text, '  Tail.');
    assert.equal(closed.some(row => row.text.includes('```')), false);
    assert.equal(document.renderMarkdown('replacement', 80, { speaker: true, streaming: true,
      messageKey: 'stream' }).length, 1);
    assert.equal(document.renderMarkdown('independent', 40, { speaker: true, streaming: true,
      messageKey: 'next' })[0]?.text.slice(2), 'independent');
  } finally { colors.level = color; document.close(); screen.dispose(); }
  assert.equal(document.liveNodes, 0);
  document.close();
});

test('source prose cap reflows paragraphs, lists and quotes while code, tables and frozen chunks keep their contracts', () => {
  const document = new TuiDocumentRenderer();
  const prose = 'ProseWord '.repeat(9).trim();
  const source = '# ' + 'HeadingWord '.repeat(6) + '\n\n' + prose + '\n\n- ' + 'ListWord '.repeat(9)
    + '\n\n> ' + 'QuoteWord '.repeat(9) + '\n\n```text\n' + 'CodeWide'.repeat(9)
    + '\n```\n\n| Long cell | End |\n|---|---|\n| ' + 'TableWide'.repeat(6) + ' | cell |\n';
  try {
    const capped = document.renderMarkdown(source, 100, { speaker: true, maxProseWidth: 40 });
    for (const row of capped.filter(row => /HeadingWord|ProseWord|ListWord|QuoteWord/.test(row.text)))
      assert.ok(cellWidth(row.text) <= 42, row.text);
    const code = '  ' + 'CodeWide'.repeat(9);
    const table = capped.filter(row => /[┌┐└┘├┤│]/.test(row.text));
    assert.ok(capped.some(row => row.text === code));
    assert.ok(table.some(row => cellWidth(row.text) > 42));
    const larger = document.renderMarkdown(source, 100, { speaker: true, maxProseWidth: 60 });
    assert.ok(larger.filter(row => /ProseWord/.test(row.text)).length < capped.filter(row => /ProseWord/.test(row.text)).length);
    assert.deepEqual(larger.filter(row => /[┌┐└┘├┤│]/.test(row.text)).map(row => row.text), table.map(row => row.text));
    const copied = document.renderMarkdown(prose, 100, { speaker: true, maxProseWidth: 40 });
    assert.equal(selectionTextFromRows({ anchor: { line: 0, column: 2 }, focus: { line: copied.length - 1, column: 99 },
      dragging: false }, copied), prose);
    const prefix = (prose + '\n\n').repeat(80);
    document.renderMarkdown(prefix, 100, { speaker: true, maxProseWidth: 40, streaming: true, messageKey: 'prose' });
    const stream = document.renderMarkdown(prefix + 'tail', 100,
      { speaker: true, maxProseWidth: 60, streaming: true, messageKey: 'prose' });
    assert.ok(stream[0]!.text.length > capped[0]!.text.length);
    const full = document.renderMarkdown(prefix + 'tail', 100, { speaker: true, streaming: true, messageKey: 'prose' });
    assert.ok(full[0]!.text.includes(prose)); assert.ok(full.length < stream.length);
  } finally { document.close(); }
  assert.equal(document.liveNodes, 0);
});

test('prose setting changes invalidate transcript rows and selection without changing raw source', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, maxProseWidth: 40 }).start();
  const source = 'ProseWord '.repeat(9).trim();
  try {
    tui.beginAssistantMessage(); tui.writeAssistantText(source + '\n\npartial'); context.mock.timers.tick(100);
    assert.equal(screenLines(output).filter(row => row.includes('ProseWord')).length, 3);
    tui.setMaxProseWidth(60);
    assert.equal(screenLines(output).filter(row => row.includes('ProseWord')).length, 2);
    tui.endAssistantMessage(); const entries = tui.transcriptState.entries;
    input.emit('data', '\x1b[<0;3;1M\x1b[<32;8;1M');
    assert.ok(decoded.get(output)!.buffer.active.getLine(0)!.getCell(2)!.isInverse());
    tui.setMaxProseWidth(undefined);
    assert.equal(decoded.get(output)!.buffer.active.getLine(0)!.getCell(2)!.isInverse(), 0);
    assert.equal(screenLines(output).filter(row => row.includes('ProseWord')).length, 1);
    assert.equal(tui.transcriptState.entries, entries);
    assert.equal(entries[0]?.markdown, source + '\n\npartial');
    assert.ok(tui.transcriptState.offset === Number.MAX_SAFE_INTEGER);
    for (let index = 0; index < 30; index++) tui.append({ kind: 'assistant', text: 'row ' + index });
    input.emit('data', '\x1b[<64;2;3M'); const offset = tui.transcriptState.offset;
    tui.setMaxProseWidth(40); assert.equal(tui.transcriptState.offset, offset);
  } finally { tui.close(); decoded.get(output)!.dispose(); context.mock.timers.reset(); }
});

test('source highlight setting preserves Markdown styles and re-renders frozen code with the source language label', () => {
  const document = new TuiDocumentRenderer();
  const colors = ge as unknown as { level: number }; const previous = colors.level;
  const source = '# Heading\n\n```ts\nconst value = 1;\n```\n';
  const inspect = (rows: ReturnType<TuiDocumentRenderer['renderMarkdown']>, text: string, highlighted: boolean) => {
    const screen = new HeadlessTerminal({ cols: 100, rows: 24, allowProposedApi: true, logLevel: 'off' });
    try {
      const index = rows.findIndex(row => row.text.includes(text)); assert.ok(index >= 0);
      (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(rows[index]!.ansi);
      const cell = screen.buffer.active.getLine(0)!.getCell(2)!;
      assert.equal(cell.getFgColorMode(), highlighted ? 16777216 : 0);
      assert.equal(cell.getFgColor(), highlighted ? 4 : -1);
      assert.equal(rows.some(row => row.text === '  ts' || row.text.endsWith(' ts')), !highlighted);
      assert.equal(selectionTextFromRows({ anchor: { line: index, column: 2 },
        focus: { line: index, column: 99 }, dragging: false }, rows), text);
    } finally { screen.dispose(); }
  };
  try {
    colors.level = 3;
    for (const disabled of [undefined, true, false, undefined]) {
      const rows = document.renderMarkdown(source, 100, { speaker: true, syntaxHighlightingDisabled: disabled });
      inspect(rows, 'const value = 1;', !disabled);
      assert.equal(rows[0]!.text, `${process.platform === 'darwin' ? '⏺' : '●'} Heading`);
      assert.match(rows[0]!.ansi, /\x1b\[[\d;]*1m/);
    }
    const prefix = '```ts\nconst frozen = 1;\n```\n\n'.repeat(150);
    for (const disabled of [false, true, false]) {
      const rows = document.renderMarkdown(prefix + '```ts\nconst tail = 2;\n```\n', 100,
        { speaker: true, streaming: true, messageKey: 'highlight-frozen', syntaxHighlightingDisabled: disabled });
      inspect(rows, 'const frozen = 1;', !disabled); inspect(rows, 'const tail = 2;', !disabled);
    }
  } finally { colors.level = previous; document.close(); }
  assert.equal(document.liveNodes, 0);
});

test('highlight setting invalidates streamed and completed transcript caches without altering raw text or viewport', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const colors = ge as unknown as { level: number }; const previous = colors.level; colors.level = 3;
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  // Tall enough that the sixteen-row startup header leaves the heading on screen.
  Object.assign(output, { isTTY: true, columns: 100, rows: 40 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const source = '# Heading\n\n```ts\nconst value = 1;\n```\n\npartial';
  const check = (highlighted: boolean) => {
    const row = screenLines(output).findIndex(line => line.includes('const value = 1;')); assert.ok(row >= 0);
    const cell = decoded.get(output)!.buffer.active.getLine(row)!.getCell(2)!;
    assert.equal(cell.getFgColor(), highlighted ? 4 : -1);
    assert.equal(cell.getFgColorMode(), highlighted ? 16777216 : 0);
    assert.equal(screenLines(output).some(line => line.trim() === 'ts'), !highlighted);
    // The header row, then the speaker's blank gutter row, then the heading.
    assert.ok(decoded.get(output)!.buffer.active.getLine(welcomeRows(40) + 1)!.getCell(2)!.isBold());
    return row;
  };
  try {
    tui.beginAssistantMessage(); tui.writeAssistantText(source); context.mock.timers.tick(100); check(true);
    tui.setSyntaxHighlightingDisabled(true); check(false);
    tui.endAssistantMessage(); const entries = tui.transcriptState.entries; const row = check(false);
    input.emit('data', `\x1b[<0;3;${row + 1}M\x1b[<32;8;${row + 1}M`);
    assert.ok(decoded.get(output)!.buffer.active.getLine(row)!.getCell(2)!.isInverse());
    tui.setSyntaxHighlightingDisabled(undefined); const restored = check(true);
    assert.equal(decoded.get(output)!.buffer.active.getLine(restored)!.getCell(2)!.isInverse(), 0);
    assert.equal(tui.transcriptState.entries, entries); assert.equal(entries[0]?.markdown, source);
    assert.equal(tui.transcriptState.offset, Number.MAX_SAFE_INTEGER);
    for (let index = 0; index < 30; index++) tui.append({ kind: 'assistant', text: 'row ' + index });
    input.emit('data', '\x1b[<64;2;3M'); const offset = tui.transcriptState.offset;
    tui.setSyntaxHighlightingDisabled(true); assert.equal(tui.transcriptState.offset, offset);
  } finally { tui.close(); decoded.get(output)!.dispose(); colors.level = previous; context.mock.timers.reset(); }
});

test('source theme colors redraw messages and chrome while chooser previews cancel without changing raw text or draft', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const colors = ge as unknown as { level: number }; const previous = colors.level; colors.level = 3;
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, theme: 'dark' }).start();
  const source = 'Use `sample` text.\n\n> Quote preview';
  const sample = () => {
    const rows = screenLines(output); const row = rows.findIndex(line => line.includes('Use sample'));
    assert.ok(row >= 0); const column = rows[row]!.indexOf('sample');
    const cell = decoded.get(output)!.buffer.active.getLine(row)!.getCell(column)!;
    return [cell.getFgColorMode(), cell.getFgColor()];
  };
  try {
    tui.beginAssistantMessage(); tui.writeAssistantText(source); context.mock.timers.tick(100);
    assert.deepEqual(sample(), [50331648, 11647481]); tui.setTheme('light');
    assert.deepEqual(sample(), [50331648, 5728759]); tui.endAssistantMessage();
    const entries = tui.transcriptState.entries;
    for (const [theme, color, mode] of [['dark', 11647481, 50331648], ['light', 5728759, 50331648],
      ['dark-daltonized', 10079487, 50331648], ['light-daltonized', 3368703, 50331648],
      ['dark-ansi', 12, 16777216], ['light-ansi', 4, 16777216]] as const) {
      tui.setTheme(theme); assert.deepEqual(sample(), [mode, color]);
      const border = screenLines(output).findIndex(row => row.includes('────'));
      const cell = decoded.get(output)!.buffer.active.getLine(border)!.getCell(0)!;
      assert.equal(cell.getFgColorMode(), mode);
      assert.equal(cell.getFgColor(), theme.endsWith('ansi') ? 7 : theme.startsWith('light') ? 9079434 : 8947848);
    }
    tui.setTheme('light'); input.emit('data', 'retained draft');
    const request = { title: 'Theme', message: 'Choose a theme', choices: themeChoices, defaultIndex: 2, themePreview: true };
    const controller = new AbortController(); const preview = tui.prompt(request, controller.signal);
    assert.deepEqual(sample(), [50331648, 5728759]); input.emit('data', '\x1b[B');
    assert.deepEqual(sample(), [50331648, 10079487]); input.emit('data', '\x03');
    assert.equal(await preview, undefined); assert.deepEqual(sample(), [50331648, 5728759]);
    assert.equal(tui.state.text, 'retained draft'); assert.equal(tui.transcriptState.entries, entries);
    assert.equal(entries[0]?.markdown, source);
    const aborter = new AbortController(); const aborted = tui.prompt(request, aborter.signal);
    input.emit('data', '\x1b[B'); aborter.abort(); assert.equal(await aborted, undefined);
    assert.deepEqual(sample(), [50331648, 5728759]);
    const selection = tui.prompt(request, controller.signal); input.emit('data', '\x1b[B\r');
    assert.deepEqual((await selection)?.selected, ['dark-daltonized']);
    assert.deepEqual(sample(), [50331648, 5728759]);
    for (let index = 0; index < 30; index++) tui.append({ kind: 'assistant', text: 'row ' + index });
    input.emit('data', '\x1b[<64;2;3M'); const offset = tui.transcriptState.offset;
    tui.setTheme('dark'); assert.equal(tui.transcriptState.offset, offset);
  } finally { tui.close(); decoded.get(output)!.dispose(); colors.level = previous; context.mock.timers.reset(); }
});

test('source system-theme watcher queries, falls back through mux, ignores malformed colors and cancels pending owners', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = { TMUX: process.env.TMUX, STY: process.env.STY, terminal: process.env.terminal };
  delete process.env.TMUX; delete process.env.STY; delete process.env.terminal;
  const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  const monitors: SystemThemeMonitor[] = [];
  try {
    assert.equal(SKo('rgb:ffff/ffff/ffff'), 'light'); assert.equal(SKo('rgba:0000/0000/0000/ffff'), 'dark');
    assert.equal(SKo('#fff'), 'light'); assert.equal(SKo('#000'), 'dark'); assert.equal(SKo('invalid'), undefined);
    let writes = ''; const changes: string[] = []; const failures: Error[] = [];
    const monitor = new SystemThemeMonitor({ write: text => { writes += text; } }, value => changes.push(value), error => failures.push(error));
    monitors.push(monitor); monitor.setActive(true);
    assert.equal(writes, '\x1b[?2031h\x1b]11;?\x07\x1b[c');
    monitor.onResponse({ type: 'themeNotify', dark: true });
    assert.equal(writes.match(/11;\?/g)?.length, 1);
    monitor.onResponse({ type: 'osc', code: 11, data: '#fff' }); monitor.onResponse({ type: 'da1', params: [] });
    await settle(); assert.deepEqual(changes, ['light']);
    monitor.onResponse({ type: 'themeNotify', dark: true });
    assert.equal(writes.match(/11;\?/g)?.length, 2);
    monitor.onResponse({ type: 'osc', code: 11, data: 'invalid' }); monitor.onResponse({ type: 'da1', params: [] });
    await settle(); assert.deepEqual(changes, ['light']);
    monitor.onResponse({ type: 'themeNotify', dark: true }); monitor.setActive(false);
    const stopped = writes; context.mock.timers.tick(3000); await settle(); assert.equal(writes, stopped);
    monitor.onResponse({ type: 'osc', code: 11, data: '#000' }); assert.deepEqual(changes, ['light']);
    monitor.close(); assert.equal(failures.length, 0);

    process.env.TMUX = 'owned-mux'; let muxWrites = ''; const muxChanges: string[] = [];
    const mux = new SystemThemeMonitor({ write: text => { muxWrites += text; } }, value => muxChanges.push(value), error => failures.push(error));
    monitors.push(mux); mux.setActive(true); assert.ok(muxWrites.includes('\x1bPtmux;\x1b\x1b]11;?\x07\x1b\\'));
    context.mock.timers.tick(2000); await settle();
    assert.ok(muxWrites.includes('\x1b[c\x1b]11;?\x07\x1b[c'));
    mux.onResponse({ type: 'osc', code: 11, data: '#000' });
    mux.onResponse({ type: 'da1', params: [1, 2] }); mux.onResponse({ type: 'da1', params: [1, 2] });
    await settle(); assert.deepEqual(muxChanges, ['dark']); mux.close();
    const closed = muxWrites; context.mock.timers.tick(5000); await settle(); assert.equal(muxWrites, closed);

    delete process.env.TMUX; let silentWrites = '';
    const silent = new SystemThemeMonitor({ write: text => { silentWrites += text; } }, value => changes.push(value), error => failures.push(error));
    monitors.push(silent); silent.setActive(true); context.mock.timers.tick(2000); await settle();
    silent.setActive(false); silent.setActive(true);
    assert.equal(silentWrites.match(/11;\?/g)?.length, 1);
    silent.onResponse({ type: 'themeNotify', dark: false });
    assert.equal(silentWrites.match(/11;\?/g)?.length, 2); silent.close();
    let failQuery = true;
    const broken = new SystemThemeMonitor({ write: text => { if (failQuery && text.includes('11;?')) { failQuery = false; throw new Error('owned query write'); } } },
      () => {}, error => failures.push(error));
    monitors.push(broken); broken.setActive(true); await settle();
    assert.equal(failures.at(-1)?.message, 'owned query write'); broken.close();
  } finally {
    for (const monitor of monitors) monitor.close();
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    context.mock.timers.reset();
  }
});

test('auto system-theme replies recolor cached messages and chrome without entering drafts or modal answers', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const colors = ge as unknown as { level: number }; const previousColor = colors.level; colors.level = 3;
  const previous = { COLORFGBG: process.env.COLORFGBG, TMUX: process.env.TMUX, STY: process.env.STY };
  process.env.COLORFGBG = '0;0'; delete process.env.TMUX; delete process.env.STY;
  const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({ write(chunk, _encoding, done) { writes += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, theme: 'auto' }).start();
  const source = 'Use `sample` text.\n\n';
  const sample = () => {
    const rows = screenLines(output); const row = rows.findIndex(line => line.includes('Use sample'));
    assert.ok(row >= 0); return decoded.get(output)!.buffer.active.getLine(row)!.getCell(rows[row]!.indexOf('sample'))!.getFgColor();
  };
  const reply = (data: string) => input.emit('data', `\x1b]11;${data}\x1b\\\x1b[?1;2c`);
  try {
    assert.ok(writes.includes('\x1b]11;?\x07'));
    tui.beginAssistantMessage(); tui.writeAssistantText(source); context.mock.timers.tick(100);
    input.emit('data', 'retained draft');
    input.emit('data', '\x1b]11;rgb:ffff/'); input.emit('data', 'ffff/ffff\x07\x1b[?1;2c'); await settle();
    assert.equal(sample(), 5728759); assert.equal(tui.state.text, 'retained draft');
    tui.endAssistantMessage(); const entries = tui.transcriptState.entries;
    input.emit('data', '\x1b[?997;1n'); reply('#000'); await settle(); assert.equal(sample(), 11647481);
    assert.equal(entries[0]?.markdown, source); assert.equal(tui.transcriptState.entries, entries);
    const controller = new AbortController(); const answer = tui.prompt({ title: 'Owned question', message: 'Enter text', allowText: true }, controller.signal);
    input.emit('data', '\x1b[?997;2n'); reply('#fff'); await settle(); input.emit('data', 'answer\r');
    assert.equal((await answer)?.text, 'answer'); assert.equal(tui.state.text, 'retained draft'); assert.equal(sample(), 5728759);
    tui.setTheme('dark'); const queries = writes.match(/11;\?/g)?.length;
    input.emit('data', '\x1b[?997;2n'); reply('#fff'); await settle();
    assert.equal(sample(), 11647481); assert.equal(writes.match(/11;\?/g)?.length, queries);
    tui.setTheme('auto'); assert.equal(sample(), 5728759);
    tui.close(); const closed = writes; context.mock.timers.tick(5000); await settle(); assert.equal(writes, closed);
    assert.ok(writes.includes('\x1b[?2031l'));
  } finally {
    tui.close(); decoded.get(output)!.dispose(); colors.level = previousColor;
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    context.mock.timers.reset();
  }
});

test('custom theme watcher refreshes source overrides, removes invalid files and preserves transcript, draft and owner cleanup', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'tui-custom-theme-'));
  const directory = path.join(root, 'themes'); fs.mkdirSync(directory);
  const file = path.join(directory, 'ocean.json');
  const writeTheme = (text: string, border: string) => fs.writeFileSync(file,
    JSON.stringify({ name: 'Ocean', base: 'light', overrides: { text, promptBorder: border, permission: '#abcdef' } }));
  writeTheme('#112233', '#445566');
  const colors = ge as unknown as { level: number }; const previous = colors.level; colors.level = 3;
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({ write(chunk, _encoding, done) { writes += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, userDir: root, theme: 'custom:ocean' }).start();
  const source = 'Use `sample` text.\n\npartial';
  const color = (border = false) => {
    const rows = screenLines(output); const row = rows.findIndex(line => border ? line.includes('────') : line.includes('Use sample'));
    assert.ok(row >= 0); return decoded.get(output)!.buffer.active.getLine(row)!.getCell(0)!.getFgColor();
  };
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() >= deadline) throw new Error('Custom theme frame did not update'); await delay(25); }
  };
  try {
    assert.ok((await tui.getThemeChoices()).some(choice => choice.value === 'custom:ocean' && choice.label === 'Ocean'));
    tui.beginAssistantMessage(); tui.writeAssistantText(source);
    await until(() => screenLines(output).some(line => line.includes('Use sample')));
    assert.equal(color(), 0x112233); assert.equal(color(true), 0x445566);
    const row = screenLines(output).findIndex(line => line.includes('Use sample'));
    assert.equal(decoded.get(output)!.buffer.active.getLine(row)!.getCell(6)!.getFgColor(), 5728759);
    input.emit('data', 'retained draft'); tui.endAssistantMessage(); const entries = tui.transcriptState.entries;
    writeTheme('#334455', '#667788'); await until(() => color() === 0x334455 && color(true) === 0x667788);
    assert.equal(tui.state.text, 'retained draft'); assert.equal(tui.transcriptState.entries, entries);
    fs.writeFileSync(file, '{'); await until(() => color() === 0xffffff);
    assert.equal((await tui.getThemeChoices()).some(choice => choice.value === 'custom:ocean'), false);
    writeTheme('#112233', '#445566'); await until(() => color() === 0x112233);
    const choices = await tui.getThemeChoices(); const controller = new AbortController();
    const prompt = tui.prompt({ title: 'Theme', message: 'Choose', choices, defaultIndex: 7, themePreview: true }, controller.signal);
    input.emit('data', '\x1b[A'); controller.abort(); assert.equal(await prompt, undefined);
    assert.equal(color(), 0x112233); assert.equal(tui.state.text, 'retained draft');
    assert.equal(entries[0]?.markdown, source);
    fs.unlinkSync(file); await until(() => color() === 0xffffff);
    writeTheme('#223344', '#556677'); await until(() => color() === 0x223344);
    tui.close(); const closed = writes; writeTheme('#ffffff', '#ffffff'); await delay(450); assert.equal(writes, closed);
  } finally {
    tui.close(); decoded.get(output)!.dispose(); colors.level = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a custom theme slot paints the suggestion band for every spelling an override may carry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-band-theme-'));
  const directory = path.join(root, 'themes'); fs.mkdirSync(directory);
  const file = path.join(directory, 'band.json');
  // The selected row takes `suggestion` and the skill lane takes `skill`, so both branches of
  // the band's colour path carry the value whichever row happens to be selected.
  const writeTheme = (value: string) => fs.writeFileSync(file,
    JSON.stringify({ name: 'Band', base: 'dark', overrides: { suggestion: value, skill: value } }));
  writeTheme('#010203');
  const colors = ge as unknown as { level: number }; const previous = colors.level; colors.level = 3;
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({ write(chunk, _encoding, done) { writes += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, userDir: root, theme: 'custom:band' }).start();
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() >= deadline) throw new Error('Band colour did not update'); await delay(25); }
  };
  try {
    input.emit('data', '/');
    assert.ok(screenLines(output).some(row => row.includes('/config')), screenLines(output).join('\n'));
    await until(() => writes.includes('\u001b[38;2;1;2;3m'));
    writeTheme('ansi256(42)'); await until(() => writes.includes('\u001b[38;5;42m'));
    writeTheme('#abc'); await until(() => writes.includes('\u001b[38;2;170;187;204m'));
  } finally {
    tui.close(); decoded.get(output)!.dispose(); colors.level = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('source progress settings preserve presets, pattern cleanup and append versus replace words', () => {
  const at = '2026-10-14T08:09:07.000Z', now = new Date('2026-10-14T12:00:00.000Z');
  assert.equal(progressTime({timeFormat:'24-hour-utc',timeZone:'Asia/Tokyo'}).format(at,now),'08:09Z');
  assert.equal(progressTime({timeFormat:'12-hour',timeZone:'UTC'}).format(at,now),'8:09 AM');
  assert.equal(progressTime({timeFormat:'24-hour',timeZone:'Asia/Tokyo'}).format(at,now),'17:09');
  assert.equal(progressTime({timeFormat:'%F %T %z %Z',timeZone:'UTC'}).format(at,now),'2026-10-14 08:09:07 +0000 UTC');
  const clean = progressTime({timeFormat:'\x1b[31m%H\n:%M\u200b',timeZone:'UTC'});
  assert.deepEqual(clean.resolve(),{kind:'pattern',pattern:'%H:%M',timeZone:'UTC'});
  assert.equal(clean.format(at,now),'08:09');
  assert.deepEqual(progressTime({timeFormat:'bad',timeZone:'not-a-zone'}).resolve(),{kind:'preset',preset:'auto',timeZone:undefined});
  assert.equal(clean.format('invalid',now),'');
  const base = progressVerbs(); assert.equal(base.length,188);
  assert.deepEqual(progressVerbs({mode:'replace',verbs:[]}),base);
  assert.deepEqual(progressVerbs({mode:'replace',verbs:['Owned building']}),['Owned building']);
  assert.deepEqual(progressVerbs({mode:'append',verbs:['Appended fixture']}),[...base,'Appended fixture']);
  const settings = {timeFormat:'arbitrary',timeZone:'not-a-zone',spinnerVerbs:{mode:'replace',verbs:['Owned building']}};
  assert.deepEqual(parseSettings(settings),settings);
  for (const field of ['timeFormat','timeZone']) assert.throws(()=>parseSettings({[field]:false}));
  for (const spinnerVerbs of [{mode:'other',verbs:[]},{mode:'replace',verbs:[1]},null]) assert.throws(()=>parseSettings({spinnerVerbs}));
});

test('TUI progress setting changes reflow completed rows and pin each active turn word', async () => {
  const input = new PassThrough() as PassThrough & {isTTY:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({write(chunk,_encoding,done){writes += String(chunk);done();}});
  Object.assign(output,{isTTY:true,columns:100,rows:24}); watchScreen(output);
  const settings = {timeFormat:'24-hour-utc',timeZone:'Asia/Tokyo',spinnerVerbs:{mode:'replace' as const,verbs:['Owned building']}};
  const tui = new TuiTerminal({input,output,progressSettings:settings}).start();
  const uuid='00000000-0000-4000-8000-000000000001',timestamp=new Date().toISOString();
  const frame=()=>screenLines(output).join('\n');
  try {
    input.emit('data','retained settings draft'); tui.setRunning(true);
    tui.setProgress({kind:'start',uuid,startedAt:Date.now()-18000}); assert.match(frame(),/Owned building…/);
    settings.spinnerVerbs.verbs[0]='external mutation';
    tui.setProgressSettings({timeFormat:'fixture %H:%M',timeZone:'UTC',spinnerVerbs:{mode:'replace',verbs:['Next building']}});
    assert.match(frame(),/Owned building…/);
    tui.setProgress({kind:'finish',reason:'end_turn',duration:{uuid,durationMs:1796000,timestamp}}); tui.setRunning(false);
    assert.match(frame(),/done fixture \d\d:\d\d/);
    tui.setProgressSettings({timeFormat:'24-hour-utc'}); assert.match(frame(),/done \d\d:\d\dZ/);
    assert.doesNotMatch(frame(),/done fixture/);
    tui.setProgressSettings({timeFormat:'fixture %H:%M',timeZone:'UTC',spinnerVerbs:{mode:'replace',verbs:['Next building']}});
    Object.assign(output,{columns:40}); output.emit('resize'); assert.match(frame(),/done fixture/);
    tui.setRunning(true); tui.setProgress({kind:'start',uuid:'00000000-0000-4000-8000-000000000002',startedAt:Date.now()});
    assert.match(frame(),/Next building…/); assert.equal(tui.state.text,'retained settings draft');
    tui.close(); const closed=writes; await delay(240); assert.equal(writes,closed);
  } finally {tui.close();decoded.get(output)!.dispose();}
});

test('TUI folded paste survives stash, history search, undo and isolated modal input', async context => {
  context.mock.timers.enable({apis:['setTimeout','Date'],now:10000});
  const input=new PassThrough() as PassThrough & {isTTY:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.setRawMode=()=>{};let writes='';const submitted:string[]=[];
  const output=new Writable({write(chunk,_encoding,done){writes+=String(chunk);done();}});
  Object.assign(output,{isTTY:true,columns:40,rows:24});watchScreen(output);
  const tui=new TuiTerminal({input,output,onSubmit:text=>submitted.push(text)}).start();
  const raw='first\nsecond\nthird\nfourth',paste='\x1b[200~'+raw+'\x1b[201~';
  try {
    input.emit('data',paste);assert.match(screenLines(output).join('\n'),/\[Pasted text #1 \+3 lines\]/);
    input.emit('data','\u0013scratch\u0013');assert.equal(tui.state.text,'[Pasted text #1 +3 lines]');
    context.mock.timers.tick(1100);input.emit('data',' suffix\u001f');assert.equal(tui.state.text,'[Pasted text #1 +3 lines]');
    const modal=tui.prompt({message:'Fixture',allowText:true},new AbortController().signal);
    input.emit('data','ok\r');assert.deepEqual(await modal,{selected:[],text:'ok'});assert.equal(tui.state.pastedContents['1']!.content,raw);
    input.emit('data','\r');assert.deepEqual(submitted,[raw]);
    input.emit('data','\u0012second\u0012\r');assert.deepEqual(submitted,[raw,raw]);
    input.emit('data',paste);Object.assign(output,{columns:100});output.emit('resize');
    assert.match(screenLines(output).join('\n'),/\[Pasted text #2 \+3 lines\]/);
    tui.close();assert.deepEqual(tui.state.pastedContents,{});assert.deepEqual(tui.state.historyPastes,[]);
    const before=writes;context.mock.timers.tick(2000);assert.equal(writes,before);
  } finally {tui.close();decoded.get(output)!.dispose();context.mock.timers.reset();}
});

test('source thinking progress retains frame, paused-time, task-count and completion contracts', async context => {
  context.mock.timers.enable({apis:['setTimeout','setInterval','Date'], now:10000});
  const document = new TuiDocumentRenderer(); let ticks = 0;
  const progress = new ThinkingProgress(() => ticks++);
  const task = (id: string, status: TaskRecord['status']): TaskRecord => ({id, status, subject:'Fixture ' + id,
    activeForm:status === 'in_progress' ? 'Building fixture' : undefined, description:'', metadata:{}, blockedBy:[]});
  const uuid = '00000000-0000-4000-8000-000000000001';
  const paint = () => document.renderElement(progress.element(100),100,{terminalRows:24}).map(row => row.text).join('\n');
  try {
    progress.tasks(Array.from({length:15},(_,index) => task(String(index+1), index === 14 ? 'in_progress' : 'completed')));
    progress.start(uuid, Date.now()-18000); progress.mode('thinking');
    paint(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.match(paint(), /Building fixture… \(18s · thinking\)/);
    assert.match(paint(), /15 tasks \(14 done, 1 in progress, 0 open\)/);
    context.mock.timers.tick(240); assert.ok(ticks > 0);
    progress.setReducedMotion(true); const stopped = ticks; context.mock.timers.tick(1000);
    assert.equal(ticks,stopped); assert.match(paint(), /● Building fixture… \(19s · thinking\)/);
    progress.pause(true); context.mock.timers.tick(5000); assert.match(paint(), /\(19s · thinking\)/);
    progress.pause(false); assert.match(paint(), /\(19s · thinking\)/);
    progress.stop(); assert.doesNotMatch(paint(), /Building fixture…/);
    const done = {uuid, durationMs:1796000, timestamp:new Date().toISOString()};
    const rows = document.renderElement(jsx(ProgressCompletion,{message:done},undefined),100).map(row => row.text);
    assert.ok(rows[0]!.startsWith(`✻ ${Yc(uuid)} for 29m 56s · done `));
    assert.equal(rn(60000,undefined),'1m 0s'); assert.equal(rn(59999,undefined),'59s');
    progress.close(); const closed = ticks; context.mock.timers.tick(35000); assert.equal(ticks,closed);
  } finally {progress.close(); document.close(); context.mock.timers.reset();}
  assert.equal(document.liveNodes,0);
});

test('TUI thinking progress isolates draft, cancels clocks and renders source summary across resize', async () => {
  const input = new PassThrough() as PassThrough & {isTTY:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({write(chunk,_encoding,done){writes += String(chunk);done();}});
  Object.assign(output,{isTTY:true,columns:100,rows:24}); watchScreen(output);
  const tui = new TuiTerminal({input,output}).start();
  const uuid='00000000-0000-4000-8000-000000000001';
  try {
    input.emit('data','retained thinking draft'); tui.setRunning(true);
    tui.setProgress({kind:'start',uuid,startedAt:Date.now()-18000}); tui.setProgress({kind:'phase',mode:'thinking'});
    tui.setTasks([{id:'1',subject:'Fixture',activeForm:'Building fixture',description:'',metadata:{},status:'in_progress',blockedBy:[]}]);
    const first = screenLines(output).join('\n'); assert.match(first,/1 tasks \(0 done, 1 in progress, 0 open\)/);
    assert.match(first,/Building fixture…/);
    await delay(750); assert.notEqual(screenLines(output).join('\n'),first);
    tui.setPrefersReducedMotion(true); await delay(40); const staticFrame=screenLines(output).join('\n');
    assert.match(staticFrame,/● Building fixture…/); await delay(240); assert.equal(screenLines(output).join('\n'),staticFrame);
    const dialog=tui.prompt({message:'Answer',allowText:true},new AbortController().signal);
    await delay(30); const modal=writes; await delay(240); assert.equal(writes,modal);
    input.emit('data','ok\r'); await dialog; assert.equal(tui.state.text,'retained thinking draft');
    Object.assign(output,{columns:40}); output.emit('resize'); assert.ok(screenLines(output).some(row=>row.includes('1 tasks')));
    input.emit('data','\x1b[O\x1b[I'); assert.equal(tui.state.text,'retained thinking draft');
    tui.setProgress({kind:'finish',reason:'end_turn',duration:{uuid,durationMs:1796000,timestamp:new Date().toISOString()}});
    tui.setRunning(false); assert.ok(screenLines(output).some(row=>row.includes('for 29m 56s')));
    tui.setShowTurnDuration(false); assert.equal(screenLines(output).some(row=>row.includes('for 29m 56s')),false);
    tui.setShowTurnDuration(); assert.ok(screenLines(output).some(row=>row.includes('for 29m 56s')));
    assert.equal(parseSettings({showTurnDuration:false}).showTurnDuration,false);
    assert.throws(()=>parseSettings({showTurnDuration:'false'}));
    tui.close(); const closed=writes; await delay(450); assert.equal(writes,closed);
  } finally {tui.close();decoded.get(output)!.dispose();}
});

test('source theme color components paint literal swatches, focus and current versus preset values', () => {
  const document = new TuiDocumentRenderer();
  const screen = new HeadlessTerminal({cols:40, rows:12, allowProposedApi:true, logLevel:'off'});
  const colors = ge as unknown as {level:number}, previous = colors.level; colors.level = 3;
  const paint = (element: unknown) => {
    const rows = document.renderElement(element, 40, {theme:'light', themeOverrides:{suggestion:'#445566'}});
    screen.reset();
    (screen as unknown as {_core:{writeSync(text:string):void}})._core.writeSync(rows.map(row => row.ansi).join('\r\n'));
    return rows.map(row => row.text);
  };
  try {
    const components = createThemeColorComponents({text:'#112233'}, S1('light'));
    assert.deepEqual(paint(components.renderItem('text', true)), ['██ text (custom)']);
    assert.equal(screen.buffer.active.getLine(0)!.getCell(0)!.getFgColor(), 0x112233);
    assert.equal(screen.buffer.active.getLine(0)!.getCell(3)!.getFgColor(), 0x445566);
    assert.deepEqual(paint(components.renderPreview('text')), ['current: ██ #112233', 'preset: ██ rgb(0,0,0)']);
    assert.equal(screen.buffer.active.getLine(0)!.getCell(9)!.getFgColor(), 0x112233);
    assert.equal(screen.buffer.active.getLine(1)!.getCell(8)!.getFgColor(), 0);
    const base = createThemeColorComponents({}, S1('light'));
    assert.deepEqual(paint(base.renderItem('text', false)), ['██ text']);
    assert.deepEqual(paint(base.renderPreview('text')), ['current: ██ rgb(0,0,0)']);
    const dark = createThemeColorComponents({}, S1('dark'));
    for (const columns of [20,40,100]) {
      const rows = document.renderElement(dark.renderPreview('text'), columns);
      assert.deepEqual(rows.map(row => row.text), columns === 20
        ? ['current: ██ ', 'rgb(255,255,255)'] : ['current: ██ rgb(255,255,255)']);
      assert.equal(rows.at(-1)!.end, undefined);
    }
    for (const [value, expected] of [['#123456',0x123456],['#abc',0xaabbcc],['ansi:red',1],['ansi256(42)',42],['rgb(1,2,3)',0x010203]] as const) {
      assert.deepEqual(paint(jsx(components.Swatch, {value}, undefined)), ['██']);
      assert.equal(screen.buffer.active.getLine(0)!.getCell(0)!.getFgColor(), expected);
    }
  } finally {document.close(); screen.dispose(); colors.level = previous;}
  assert.equal(document.liveNodes, 0);
  assert.throws(() => document.renderElement(null, 40), /closed/);
});

test('theme editor modal previews, cancels, persists and resets colors while preserving draft and owner cleanup', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'tui-theme-editor-'));
  fs.mkdirSync(path.join(root, 'themes'));
  const file = path.join(root, 'themes/ocean.json'); fs.writeFileSync(file, '{"name":"Ocean","base":"light","overrides":{"text":"#112233"}}');
  const colors = ge as unknown as {level:number}, previous = colors.level; colors.level = 3;
  const input = new PassThrough() as PassThrough & {isTTY:boolean; setRawMode:(raw:boolean) => void};
  input.isTTY = true; input.setRawMode = () => {}; let writes = '';
  const output = new Writable({write(chunk, _encoding, done) {writes += String(chunk); done();}});
  Object.assign(output, {isTTY:true, columns:100, rows:24}); watchScreen(output);
  const tui = new TuiTerminal({input, output, userDir:root, theme:'custom:ocean'}).start();
  const until = async (predicate:() => boolean) => { const deadline = Date.now() + 5000;
    while (!predicate()) {if (Date.now() >= deadline) throw new Error('Editor frame did not update'); await delay(25);} };
  const controller = new AbortController();
  try {
    await tui.getThemeChoices(); input.emit('data', 'retained editor draft');
    tui.beginAssistantMessage(); tui.writeAssistantText('Use `sample` text.\n\n'); tui.endAssistantMessage();
    const entries = tui.transcriptState.entries;
    const choices = await tui.getThemeChoices();
    const chooser = tui.prompt({message:'Choose', choices, defaultIndex:7, themePreview:true, themeEdit:true}, controller.signal);
    input.emit('data', '\x05'); assert.deepEqual(await chooser, {selected:['custom:ocean'], themeEdit:true});
    let editing = tui.editCustomTheme('custom:ocean', async value => tui.setTheme(value), controller.signal);
    await until(() => screenLines(output)[0]!.includes('Ocean · based on light'));
    input.emit('data', 'text'); input.emit('data', '\x1b[B');
    await until(() => screenLines(output).some(row => row.includes('current: ██ #112233')));
    const focusedRow = screenLines(output).findIndex(row => row.includes('> ██ text (custom)'));
    assert.equal(decoded.get(output)!.buffer.active.getLine(focusedRow)!.getCell(2)!.getFgColor(), 0x112233);
    assert.ok(screenLines(output).some(row => row.includes('preset: ██ rgb(0,0,0)')));
    input.emit('data', '\r');
    await until(() => screenLines(output).some(row => row.includes('Color: text')));
    input.emit('data', '\x15#334455');
    const previewColor = () => {const row = screenLines(output).findIndex(line => line.includes('Theme preview'));
      return decoded.get(output)!.buffer.active.getLine(row)!.getCell(0)!.getFgColor();};
    await until(() => previewColor() === 0x334455);
    Object.assign(output, {columns:40}); output.emit('resize');
    const valueSwatchRow = screenLines(output).findIndex(row => row.includes('██ text'));
    assert.ok(valueSwatchRow >= 0);
    assert.equal(decoded.get(output)!.buffer.active.getLine(valueSwatchRow)!.getCell(0)!.getFgColor(), 0x334455);
    input.emit('data', '\x1b');
    await until(() => screenLines(output)[0]!.includes('Ocean · based on light'));
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).overrides.text, '#112233');
    input.emit('data', 'text\x1b[B\r'); await until(() => screenLines(output).some(row => row.includes('Color: text')));
    input.emit('data', '\x15#334455\r'); await until(() => JSON.parse(fs.readFileSync(file, 'utf8')).overrides.text === '#334455');
    input.emit('data', 'text\x1b[B\t'); await until(() => Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).overrides).length === 0);
    input.emit('data', '\x1b'); await editing;
    assert.equal(tui.state.text, 'retained editor draft'); assert.equal(tui.transcriptState.entries, entries);
    assert.equal(entries.at(-1)!.markdown, 'Use `sample` text.\n\n');
    editing = tui.editCustomTheme('custom:ocean', async () => {}, controller.signal);
    await until(() => tui.currentScreen === 'dialog'); tui.close(); const closed = writes;
    await editing; await delay(450); assert.equal(writes, closed);
  } finally {tui.close(); decoded.get(output)!.dispose(); colors.level = previous; fs.rmSync(root, {recursive:true, force:true});}
});

test('the source renderer diffs frames, preserves styled wide cells, resizes and releases its root', () => {
  let writes = '';
  const output = new Writable({ write(chunk, _encoding, done) { writes += String(chunk); done(); } });
  Object.assign(output, { columns: 20, rows: 4 }); watchScreen(output);
  output.write(ENTER_ALT_SCREEN);
  const renderer = new TuiRenderer({ write: text => output.write(text) });
  const cursor = { row: 2, column: 2, visible: true };
  try {
    renderer.render(['Hello 界👩‍💻é', '\x1b[7mselected\x1b[27m'], 20, 4, cursor);
    assert.equal(screenLines(output)[0], 'Hello 界👩‍💻é');
    assert.ok(decoded.get(output)!.buffer.active.getLine(1)!.getCell(0)!.isInverse());
    assert.deepEqual({ row: decoded.get(output)!.buffer.active.cursorY, column: decoded.get(output)!.buffer.active.cursorX },
      { row: cursor.row, column: cursor.column });
    writes = '';
    renderer.render(['Hello 界👩‍💻é', '\x1b[7mselected\x1b[27m'], 20, 4, cursor);
    assert.equal(writes, '');
    renderer.render(['short', 'plain'], 20, 4, cursor);
    assert.equal(screenLines(output)[0], 'short');
    assert.equal(screenLines(output)[1], 'plain');
    assert.equal(decoded.get(output)!.buffer.active.getLine(1)!.getCell(0)!.isInverse(), 0);
    writes = '';
    renderer.render(['edge 界'.padEnd(18) + '界'], 20, 4, cursor);
    assert.ok(screenLines(output)[0]?.endsWith('界'));
    Object.assign(output, { columns: 12, rows: 6 }); output.emit('resize');
    renderer.render(['resized 界'], 12, 6, { row: 4, column: 1, visible: true });
    assert.equal(screenLines(output)[0], 'resized 界');
    assert.equal(screenLines(output)[5], '');
    assert.equal(cellWidth('✂ ⏺ © 🇦'), 7);
    assert.equal(cellWidth('☀︎'), 1);
    assert.equal(cellWidth('❤️'), 2);
    renderer.invalidate(); writes = '';
    renderer.render(['resized 界'], 12, 6, { row: 4, column: 1, visible: true });
    assert.ok(writes.includes('\x1b[2J'));
    Object.assign(output, { columns: 20, rows: 10 }); output.emit('resize');
    renderer.renderChat(['\x1b[31mselected\x1b[39m'], ['123456789012345678', ''], ['ready'],
      20, 10, { row: 7, column: 2, visible: true }, false,
      { state: { anchor: { line: 0, column: 0 }, focus: { line: 0, column: 2 }, dragging: false }, offset: 0, rows: 5 });
    const frame = screenLines(output);
    assert.equal(frame[5], '─'.repeat(20));
    assert.equal(frame[6], '❯ 123456789012345678');
    assert.equal(frame[7], '');
    assert.equal(frame[8], '─'.repeat(20));
    assert.equal(frame[9], 'ready');
    const selected = decoded.get(output)!.buffer.active.getLine(0)!.getCell(0)!;
    assert.ok(selected.isInverse());
    assert.equal(selected.getFgColor(), 1);
  } finally { renderer.close(); decoded.get(output)!.dispose(); }
  assert.equal(renderer.liveNodes, 0);
  renderer.close();
});

test('the copied layout core reflows cached geometry and the copied formatter renders preview content', () => {
  const config = layoutEngine.Config.create();
  const root = layoutEngine.Node.create(config), list = layoutEngine.Node.create(config), preview = layoutEngine.Node.create(config);
  root.insertChild(list, 0); root.insertChild(preview, 1);
  try {
    root.setWidth(80); root.setFlexDirection(2); root.setGap(2, 4);
    list.setWidth(30); preview.setFlexGrow(1); preview.setFlexShrink(1); preview.setMinWidth(44);
    root.calculateLayout(80, undefined, 1);
    assert.equal(preview.getComputedLeft(), 34); assert.equal(preview.getComputedWidth(), 46);
    root.calculateLayout(80, undefined, 1); assert.ok(config.cacheHits > 0);
    root.setWidth(100); root.calculateLayout(100, undefined, 1);
    assert.equal(preview.getComputedLeft(), 34); assert.equal(preview.getComputedWidth(), 66);
  } finally { root.freeRecursive(); config.free(); }
  assert.equal(config.liveNodes, 0);
  assert.equal(renderPreviewMarkdown('# Heading\n\n- one'), 'Heading\n\n- one');
  assert.equal(renderPreviewMarkdown('> quote\n\n**bold** and `code`'), '▎ quote\n\nbold and code');
  assert.equal(renderPreviewMarkdown('| A | B |\n|---|---|\n| x | y |'), '| A   | B   |\n|-----|-----|\n| x   | y   |');
  for (const width of [4, 8, 20, 80]) {
    const box = previewBox('界👩‍💻é\n'.repeat(9), 3, width);
    assert.ok(box.every(line => cellWidth(line) <= width));
    assert.ok(box.at(-1)?.endsWith('┘'));
  }
});

test('modal choices and Other text own input and restore the previous draft', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, done) { drawn += String(chunk); done(); } });
  Object.assign(output, { isTTY: true, columns: 50, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const signal = new AbortController().signal;
  const choices = [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }];
  try {
    key('draft\x1b[D');
    const before = tui.state;
    let submissions = 0; tui.on('submit', () => { submissions++; });
    const single = tui.prompt({ title: 'Choose', message: 'Choose an option', choices, allowText: true }, signal);
    assert.equal(tui.currentScreen, 'dialog');
    assert.ok(screenLines(output).join('\n').includes('Choose an option'));
    await assert.rejects(tui.prompt({ message: 'collision' }, signal), /Another interaction/);
    key('\x1b[B\rignored\r');
    assert.deepEqual(await single, { selected: ['B'] });
    assert.deepEqual(tui.state, before);
    assert.equal(submissions, 0);
    const multi = tui.prompt({ message: 'Choose several', choices, multiple: true, allowText: true }, signal);
    key('\r'); assert.equal(tui.currentScreen, 'dialog');
    assert.ok(screenLines(output).join('\n').includes('Space selects an option'));
    key(' '); key('\x1b[B '); key('\tcustom\x1b[13;2uanswer\x1b[A\r');
    assert.deepEqual(await multi, { selected: ['A', 'B'], text: 'custom\nanswer' });
    assert.deepEqual(tui.state, before);
    const confirmation = tui.prompt({ title: 'Approve', message: Array.from({ length: 30 }, (_, i) => `plan line ${i}`).join('\n'),
      choices: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] }, signal);
    assert.ok(screenLines(output).join('\n').includes('plan line 0'));
    key('\x1b[6~'); assert.ok(screenLines(output).join('\n').includes('plan line 7'));
    key('\x1b[5~'); assert.ok(screenLines(output).join('\n').includes('plan line 0'));
    key('\r'); assert.deepEqual(await confirmation, { selected: ['no'] });
    assert.deepEqual(tui.state, before);
    const bounded = tui.prompt({ message: 'Small answer', maxTextChars: 4 }, signal);
    key('12345'); assert.ok(screenLines(output).join('\n').includes('Answer exceeds 4 characters'));
    key('ok\r'); assert.deepEqual(await bounded, { selected: [], text: 'ok' });
  } finally { tui.close(); }
});

test('modal cancellation abort and close settle once without changing the draft', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    key('retained');
    const controller = new AbortController();
    let settled = 0;
    const aborted = tui.prompt({ message: 'Form', allowText: true }, controller.signal).then(answer => { settled++; return answer; });
    key('partial'); controller.abort();
    assert.equal(await aborted, undefined); assert.equal(settled, 1);
    assert.equal(tui.state.text, 'retained');
    const cancelled = tui.prompt({ message: 'Form' }, new AbortController().signal);
    key('\u0003tail'); assert.equal(await cancelled, undefined);
    assert.equal(tui.state.text, 'retained');
    key('\x1b[200~stale paste');
    const duringPaste = tui.prompt({ message: 'Confirmation', choices: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] }, new AbortController().signal);
    key('\x1b[B\r\x1b[201~');
    assert.equal(tui.currentScreen, 'dialog'); // Paste tail is drained, never interpreted as approval keys.
    key('\r'); assert.deepEqual(await duringPaste, { selected: ['no'] });
    const partialController = new AbortController();
    const partial = tui.prompt({ message: 'Form' }, partialController.signal);
    key('\x1b[200~partial'); partialController.abort();
    assert.equal(await partial, undefined);
    key('tail\r\x1b[201~'); assert.equal(tui.state.text, 'retained');
    const escaped = tui.prompt({ message: 'Form' }, new AbortController().signal);
    key('\x1b'); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(await escaped, undefined);
    const closing = tui.prompt({ message: 'Form' }, new AbortController().signal);
    tui.close(); assert.equal(await closing, undefined);
    assert.equal(tui.state.text, 'retained');
  } finally { tui.close(); }
});

test('common action keys preserve drafts and stash swaps text with its cursor', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 50, rows: 10 }); watchScreen(output);
  const actions: string[] = [];
  const tui = new TuiTerminal({ input, output, onAction: action => actions.push(action) }).start();
  const key = (text: string) => input.emit('data', text);
  try {
    key('draft\x1b[D');
    const cursor = tui.state.cursor;
    key('\x1bp\x1bt\u0014');
    assert.deepEqual(actions, ['chat:modelPicker', 'chat:thinkingToggle', 'app:toggleTodos']);
    assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
    key('\u0013'); assert.equal(tui.state.text, '');
    key('other\u0013'); assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
    key('\u0013'); assert.equal(tui.state.text, 'other');
    key('\r\u0013'); assert.equal(tui.state.text, 'draft'); assert.equal(tui.state.cursor, cursor);
  } finally { tui.close(); }
});

test('the kill ring coalesces, caps at ten, and cycles yank-pop', () => {
  let state = reduceKillRing(emptyKillRing, { type: 'kill', text: 'one' });
  assert.deepEqual(state.ring, ['one']);
  // A second kill while the run is open joins the head instead of adding an entry.
  state = reduceKillRing(state, { type: 'kill', text: 'two', direction: 'append' });
  assert.deepEqual(state.ring, ['onetwo']);
  state = reduceKillRing(state, { type: 'kill', text: 'zero', direction: 'prepend' });
  assert.deepEqual(state.ring, ['zeroonetwo']);
  // An empty kill only ends the run.
  state = reduceKillRing(state, { type: 'kill', text: '' });
  assert.equal(state.mode.type, 'idle');
  state = reduceKillRing(state, { type: 'kill', text: 'three' });
  assert.deepEqual(state.ring, ['three', 'zeroonetwo']);
  assert.equal(state.ring.length, 2);

  // Consecutive kills coalesce by design, so an entry only lands when the run
  // is broken between them; the ring then keeps the newest ten.
  for (let index = 0; index < 12; index++) {
    state = reduceKillRing(reduceKillRing(state, { type: 'interrupt' }), { type: 'kill', text: `e${index}` });
  }
  assert.equal(state.ring.length, 10);
  assert.equal(state.ring[0], 'e11');
  assert.equal(state.ring.at(-1), 'e2');

  // yankPop cycles the ring and reports the span it would replace.
  let yanked = reduceKillRing({ ring: ['a', 'b', 'c'], mode: { type: 'idle' } },
    { type: 'yank', start: 4, length: 1 });
  assert.deepEqual(nextYank(yanked), { text: 'b', start: 4, length: 1 });
  yanked = reduceKillRing(yanked, { type: 'yankPop' });
  assert.deepEqual(nextYank(yanked), { text: 'c', start: 4, length: 1 });
  // A single-entry ring has nothing to cycle to.
  assert.equal(nextYank({ ring: ['only'], mode: { type: 'yanked', start: 0, length: 4, index: 0 } }), null);
  // A store reads the same transitions.
  const ring = createKillRing();
  ring.dispatch({ type: 'kill', text: 'stored' });
  assert.deepEqual(ring.state.ring, ['stored']);
});

test('the keymap layers contexts and resolves multi-key chords', () => {
  const keymap = new Keymap();
  // `q` closes the transcript but is ordinary text in the chat context.
  const transcript = contextStack({ screen: 'transcript' });
  assert.deepEqual(keymap.push('q', transcript), { kind: 'match', match: {
    context: 'Transcript', action: 'transcript:exit', chord: 'q', consumed: ['q'] } });
  assert.equal(keymap.push('q', contextStack({ screen: 'chat' })).kind, 'none');

  // A sequence chord stays pending until its second key arrives.
  const diff: TuiContext[] = ['DiffPanel', 'Global'];
  assert.deepEqual(keymap.push('\u0018', diff), { kind: 'pending' });
  assert.equal(keymap.pendingChord, 'ctrl+x');
  const second = keymap.push('b', diff);
  assert.equal(second.kind, 'match');
  assert.equal(second.kind === 'match' ? second.match.action : '', 'app:cycleDiffBase');

  // A pending chord that cannot complete returns its buffered bytes.
  keymap.push('\u0018', diff);
  const replayed = keymap.push('\u0003', diff);
  assert.deepEqual(replayed, { kind: 'none', replay: '\u0018' });

  // Global is reachable from every screen, and the expansion covers alternatives.
  assert.equal(keymap.push('\u000f', contextStack({ screen: 'chat' })).kind, 'match');
  assert.deepEqual(expandChord('up'), [['\x1b[A'], ['\x1bOA']]);
  assert.deepEqual(expandChord('ctrl+x b'), [['\u0018', 'b']]);
  // An unbound key name expands to nothing rather than to a wrong sequence.
  assert.deepEqual(expandChord('ctrl+f13'), []);
});

test('the transcript viewport clamps its scroll and follows the tail only when pinned', () => {
  const view = { rows: 4, total: 0 };
  let state = createTranscriptState();
  for (let index = 0; index < 6; index++) {
    const total = transcriptLines(state, 40).length;
    state = reduceTranscript(state, { type: 'append', entry: { kind: 'assistant', text: `line ${index}` } }, { rows: 4, total });
  }
  const pinned = layoutTranscript(state, 40, 4);
  assert.equal(pinned.lines.length, 4);
  assert.equal(pinned.scrolled, false);
  assert.match(pinned.lines.at(-1)!, /line 5/);

  // Scrolling up unpins the view, and new output must not drag it back down.
  let scrolled = reduceTranscript(state, { type: 'scroll', command: 'top' }, { rows: 4, total: 6 });
  assert.equal(layoutTranscript(scrolled, 40, 4).lines[0], 'line 0');
  scrolled = reduceTranscript(scrolled, { type: 'scroll', command: 'lineDown' }, { rows: 4, total: 6 });
  scrolled = reduceTranscript(scrolled, { type: 'append', entry: { kind: 'assistant', text: 'line 6' } }, { rows: 4, total: 6 });
  assert.equal(layoutTranscript(scrolled, 40, 4).lines[0], 'line 1');

  // Half a page moves half the region, and the clamp holds at both ends.
  assert.equal(reduceTranscript({ ...state, offset: 0 }, { type: 'scroll', command: 'halfPageUp' }, { rows: 4, total: 6 }).offset, 0);
  assert.equal(reduceTranscript({ ...state, offset: 6 }, { type: 'scroll', command: 'halfPageDown' }, { rows: 4, total: 6 }).offset, 2);
  assert.equal(reduceTranscript({ ...state, offset: 0 }, { type: 'scroll', command: 'bottom' }, { rows: 4, total: 6 }).offset, 2);

  // Collapsed, a long entry keeps its tail and says how much it hid.
  const long = createTranscriptState([{ kind: 'tool', text: Array.from({ length: 30 }, (_, i) => `row ${i}`).join('\n') }]);
  const collapsed = transcriptLines(long, 40);
  assert.match(collapsed[0]!, /\.\.\. 18 earlier lines \(ctrl\+e/);
  assert.equal(collapsed[0]!.length, 40); // The notice shares the viewport's clipping boundary.
  // One notice plus the retained tail of twelve lines.
  assert.equal(collapsed.length, 13);
  const shown = transcriptLines({ ...long, showAll: true }, 40);
  assert.equal(shown.length, 30);
});

test('the full-screen layer draws, scrolls and restores the terminal it took', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-tui-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.configSources = { userDir: path.join(workspace, 'user') };
  const session = Session.open(workspace, { config });
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async (_request, _signal, onText) => {
      onText?.('answer'); onText?.(' '); onText?.('body');
      return { id: 'fixture', model: 'test', role: 'assistant', type: 'message',
        content: [{ type: 'text', text: 'answer body' }], stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    },
  };
  const runtime: Runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };

  let drawn = '';
  const output = new Writable({ write(chunk, _encoding, callback) { drawn += String(chunk); callback(); } });

  Object.assign(output, { isTTY: true, columns: 40, rows: 10 }); watchScreen(output);
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = (raw: boolean) => { input.isRaw = raw; };

  const tui = new TuiTerminal({ input, output, prompt: '> ', mouseTracking: 'scroll' });
  // The stream buffers until the layer attaches its reader, so both lines can
  // be queued up front: one task, then the exit that ends the session.
  input.write('hello\r/exit\r');
  try {
    await interactiveLoop(session, provider, runtime, { input, output,
      status: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
      signal: new AbortController().signal, terminal: tui });

    assert.match(drawn, new RegExp(ENTER_ALT_SCREEN.replace(/[?[\]]/g, '\\$&')));
    assert.match(drawn, new RegExp(MOUSE_SCROLL.replace(/[?[\]]/g, '\\$&')));
    // The task's answer reached the transcript, not the raw stream.
    assert.ok(seenFrames.get(output)!.some(frame => frame.includes('answer body')));
    // The status row carries the hints rather than scrolling the transcript.
    assert.ok(seenFrames.get(output)!.some(frame => frame.includes('ctrl+o transcript')));
    assert.match(drawn, new RegExp(LEAVE_ALT_SCREEN.replace(/[?[\]]/g, '\\$&')));
    assert.match(drawn, new RegExp(MOUSE_OFF.replace(/[?[\]]/g, '\\$&')));
  } finally {
    tui.close(); session.close();
  }

  // The controller restores every mode it set and is idempotent on both ends.
  let sequences: string[] = [];
  const controller = new TerminalModeController({ output: { write: (chunk: string) => { sequences.push(chunk); } },
    mouseTracking: 'scroll', synchronizedUpdate: true });
  controller.enter(); controller.enter();
  assert.equal(sequences.filter(sequence => sequence === ENTER_ALT_SCREEN).length, 1);
  sequences = [];
  controller.leave(); controller.leave();
  assert.equal(sequences.filter(sequence => sequence === LEAVE_ALT_SCREEN).length, 1);
  assert.ok(sequences.includes(MOUSE_OFF));
});

test('terminal end, close and rendering errors cancel the active turn and release its session', { timeout: 5_000 }, async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  for (const kind of ['end', 'close', 'error', 'render'] as const) {
    const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-tui-close-')));
    const config = defaultConfig(workspace, []); config.model = 'fixture';
    config.configSources = { userDir: path.join(workspace, 'user') };
    const session = Session.open(workspace, { config });
    const controller = new AbortController();
    const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (raw: boolean) => void };
    input.isTTY = true; input.isRaw = false; input.setRawMode = raw => { input.isRaw = raw; };
    let written = '', calls = 0, aborted = false, released = false;
    const output = new Writable({ write(chunk, _encoding, done) { written += String(chunk); done(); } });
    Object.assign(output, { isTTY: true, columns: 40, rows: 18 });
    const tui = new TuiTerminal({ input, output });
    let started!: () => void;
    const ready = new Promise<void>(resolve => started = resolve);
    const provider: ModelProvider = { count: async () => 1, complete: async (_request, signal, onText) => {
      calls++; onText?.('pending source\nunfinished tail'); started();
      return await new Promise<Anthropic.Message>((_resolve, reject) => {
        const cancel = () => { aborted = true; reject(signal.reason); };
        if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true });
      });
    } };
    const runtime: Runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
      releaseSession: async () => { released = true; } };
    const running = interactiveLoop(session, provider, runtime, { input, output, status: tui.statusStream,
      signal: controller.signal, terminal: tui });
    try {
      input.write('task\r'); await ready;
      input.write('queued task\r');
      if (kind === 'render') {
        context.mock.method(tui as unknown as { paintAssistantPreview(): void }, 'paintAssistantPreview', () => {
          throw new Error('owned render failure');
        });
        context.mock.timers.tick(100);
      } else if (kind === 'error') input.emit('error', new Error('owned input failure'));
      else input.emit(kind);
      await running;
      assert.equal(aborted, true, kind); assert.equal(calls, 1, kind);
      assert.equal(released, true, kind); assert.equal(input.isRaw, false, kind);
      assert.ok(written.includes(LEAVE_ALT_SCREEN), kind);
      assert.equal(session.events.filter(event => event.kind === 'turn_end').at(-1)?.reason, 'aborted');
      assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false, kind);
      written = ''; context.mock.timers.tick(500); assert.equal(written, '', kind);
    } finally {
      controller.abort(); await running;
      tui.close(); session.close(); fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
  context.mock.timers.reset();
});

test('alt+w dismisses and restores the workflow keyword run for the draft', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 140, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).join('\n');
  try {
    key('plain');
    key('\x1bw');
    assert.equal(frame().includes('Ultracode keyword ignored'), false, 'no keyword run means no notice');
    key(' ultracode');
    key('\x1bw');
    assert.ok(frame().includes('Ultracode keyword ignored'), 'dismissing shows the source notice');
    key('\x1bw');
    assert.equal(frame().includes('Ultracode keyword ignored'), false, 'restoring clears the notice');
    key('\x1bw');
    assert.ok(frame().includes('Ultracode keyword ignored'));
    for (let index = 0; index < ' ultracode'.length; index++) key('\x7f');
    assert.equal(frame().includes('Ultracode keyword ignored'), false, 'removing the run restores the gate');
  } finally { tui.close(); }
});

test('the workflow keyword toggle is inactive outside its availability and trigger gates', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 140, rows: 10 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output }).start();
  const key = (text: string) => input.emit('data', text);
  const frame = () => screenLines(output).join('\n');
  try {
    key('ultracode');
    tui.setWorkflowKeywordSettings({ available: false, triggerEnabled: true });
    key('\x1bw');
    assert.equal(frame().includes('Ultracode keyword ignored'), false);
    tui.setWorkflowKeywordSettings({ available: true, triggerEnabled: false });
    key('\x1bw');
    assert.equal(frame().includes('Ultracode keyword ignored'), false);
    tui.setWorkflowKeywordSettings({ available: true, triggerEnabled: true });
    key('\x1bw');
    assert.ok(frame().includes('Ultracode keyword ignored'));
  } finally { tui.close(); }
});

test('a terminal can open the full-screen interface and leave it on exit', { timeout: 60_000 }, () => {
  // Same PTY arrangement as the bare-invocation case: `script` allocates the
  // terminal, and the session runs behind a shell pipeline because `script`
  // refuses a socket as its own standard input. A host without `script` skips.
  const quit = ["printf '/exit\\n'", '|', 'script -q /dev/null', process.execPath, '--import', 'tsx', cli,
    '--interactive', '--tui'].join(' ');
  const result = spawnSync('/bin/sh', ['-c', quit], {
    encoding: 'utf8', timeout: 50_000,
    env: { ...process.env, LLM_API_KEY: 'offline-fixture-key', LLM_BASE_URL: 'http://127.0.0.1:1',
      LLM_MODEL: 'test-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
      LLM_THINKING: 'false', LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
  });
  if (result.error || /script: .*Operation not supported/.test(result.stderr ?? '')) return;
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(ENTER_ALT_SCREEN), 'the alternate screen was entered');
  assert.ok(result.stdout.includes(LEAVE_ALT_SCREEN), 'the alternate screen was restored');
  // The allocating terminal is narrow, so the row shows as much of the hint as
  // fits; the key itself must survive the clip.
  assert.match(result.stdout, /ctrl\+o/);
  // No task was given, so the session must not have spent a model call.
  assert.doesNotMatch(result.stdout, /model calls: [1-9]/);
});

test('the startup header stays in the log and scrolls with it', () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 40 }); watchScreen(output);
  const tui = new TuiTerminal({ input, output, version: '1.2.3' }).start();
  const key = (text: string) => input.emit('data', text);
  const header = () => screenLines(output).findIndex(line => line.includes('Welcome to LiTcode'));
  try {
    assert.equal(header(), 0);
    // Typing must not clear it: the header is the log's head, not a splash.
    tui.append({ kind: 'user', text: 'first task' });
    assert.equal(header(), 0);
    assert.ok(screenLines(output).some(line => line.includes('█◉██▽██◉█')));
    // It scrolls away with the log and comes back on a wheel-up.
    for (let index = 0; index < 60; index++) tui.append({ kind: 'assistant', text: `row ${index}` });
    assert.equal(header(), -1);
    assert.ok(tui.transcriptState.offset > 0);
    for (let index = 0; index < 200 && header() < 0; index++) key('\x1b[<64;2;3M');
    assert.equal(header(), 0);
    assert.equal(tui.transcriptState.offset, 0);
  } finally { tui.close(); }
});
