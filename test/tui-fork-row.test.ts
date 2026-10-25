import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import type { ForkRowFields } from '../src/fork-row.js';
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';

process.env.FORCE_COLOR = '3';
const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const { TuiDocumentRenderer } = await import('../src/tui-document-renderer.js');
const { ForkRow } = await import('../src/tui-fork-row.js');
const { jsx } = await import('../src/tui-jsx.js');
const { TuiTerminal } = await import('../src/tui.js');
const { wrapEntryRows } = await import('../src/tui-transcript.js');

function fixture() {
  return fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'tui-fork-')));
}
function lines(screen: Terminal) {
  return Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
}
const flush = (screen: Terminal) => new Promise<void>(resolve => screen.write('', resolve));

test('native fork rows preserve field order, primary styling and glyph text', async () => {
  const renderer = new TuiDocumentRenderer();
  const screen = new HeadlessTerminal({ cols: 120, rows: 4, allowProposedApi: true, logLevel: 'off' });
  const cases: { fields: ForkRowFields; text: string; primary?: string }[] = [
    { fields: { state: 'session running', chips: [] }, text: '  ⎿  session running' },
    { fields: { state: 'session running', id: 'abcdef01', chips: ['edits this checkout'] },
      text: '  ⎿  session running · abcdef01 · edits this checkout', primary: 'abcdef01' },
    { fields: { state: 'session running', name: 'parser ⑂ lexer', id: 'abcdef01',
      chips: ['own worktree', 'retained'] },
      text: '  ⎿  session running · parser ⑂ lexer · abcdef01 · own worktree · retained',
      primary: 'parser ⑂ lexer' },
  ];
  try {
    for (const sample of cases) {
      const rows = wrapEntryRows({ kind: 'system', text: 'plain fallback', fork: sample.fields }, 120,
        (entry, columns) => renderer.renderElement(jsx(ForkRow, { fields: entry.fork! }, undefined), columns,
          { theme: 'light-ansi' }));
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.text, sample.text);
      screen.reset(); screen.write(rows[0]!.ansi ?? rows[0]!.text); await flush(screen);
      assert.equal(lines(screen)[0], sample.text);
      const row = screen.buffer.active.getLine(0)!;
      assert.equal(Boolean(row.getCell(5)!.isBold()), false);
      assert.equal(row.getCell(5)!.getFgColor(), 8);
      if (sample.primary) {
        const start = sample.text.indexOf(sample.primary);
        assert.equal(Boolean(row.getCell(start)!.isBold()), true);
        assert.equal(Boolean(row.getCell(start)!.isUnderline()), false);
        if (sample.fields.name && sample.fields.id) {
          const id = row.getCell(sample.text.indexOf(sample.fields.id))!;
          assert.equal(Boolean(id.isBold()), false);
          assert.equal(id.getFgColor(), 8);
        }
      }
      for (const chip of sample.fields.chips) {
        const cell = row.getCell(sample.text.indexOf(chip))!;
        assert.equal(Boolean(cell.isBold()), false);
        assert.equal(cell.getFgColor(), 8);
      }
    }
  } finally { renderer.close(); screen.dispose(); }
  assert.equal(renderer.liveNodes, 0);
});

test('the terminal retains full fork fields across resize, theme repaint, selection and close', async () => {
  const root = fixture();
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const screen = new HeadlessTerminal({ cols: 60, rows: 24, allowProposedApi: true, logLevel: 'off' });
  let written = '';
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    const text = String(chunk); written += text; screen.write(text, done);
  } }), { isTTY: true, columns: 60, rows: 24 });
  const terminal = new TuiTerminal({ input, output, userDir: root, workspace: root, theme: 'light-ansi',
    prefersReducedMotion: true });
  const name = 'FORK_RENAME_RETAINS_THE_ENTIRE_ORIGINAL_TITLE_FOR_WIDE_WINDOWS';
  const chips: string[] = [];
  const fields: ForkRowFields = { state: 'session waiting for a prompt', name, id: 'abcdef01', chips };
  const rowIndex = () => lines(screen).findIndex(line => line.startsWith('  ⎿  session '));
  const resize = async (columns: number) => {
    screen.resize(columns, 24); output.columns = columns; output.emit('resize'); await flush(screen);
  };
  try {
    terminal.start(); terminal.setCopyOnSelect(false); terminal.writeForkRow(fields);
    chips.push('caller mutation');
    await flush(screen);
    assert.match(lines(screen)[rowIndex()]!, /^  ⎿  session waiting · .*… · abcdef01$/);
    const entry = terminal.transcriptState.entries.find(item => item.fork);
    assert.equal(entry?.kind, 'system');
    assert.equal(entry?.fork?.name, name);
    assert.deepEqual(entry?.fork?.chips, []);
    assert.equal(entry?.text, `session waiting for a prompt · ${name} · abcdef01`);
    await resize(140);
    assert.equal(lines(screen)[rowIndex()], `  ⎿  session waiting for a prompt · ${name} · abcdef01`);
    const before = screen.buffer.active.getLine(rowIndex())!.getCell(5)!.getFgColor();
    terminal.setTheme('dark'); await flush(screen);
    assert.equal(screen.buffer.active.getLine(rowIndex())!.getCell(5)!.isFgRGB(), true);
    assert.notEqual(screen.buffer.active.getLine(rowIndex())!.getCell(5)!.getFgColor(), before);
    await resize(60);
    assert.ok(lines(screen)[rowIndex()]!.includes('…'));
    await resize(140);
    const row = rowIndex(), start = lines(screen)[row]!.indexOf(name) + 1;
    const end = start + name.length - 1;
    input.emit('data', `\x1b[<0;${start};${row + 1}M\x1b[<32;${end};${row + 1}M\x1b[<0;${end};${row + 1}m`);
    input.emit('data', '\x03'); await flush(screen);
    assert.ok(written.includes(`\x1b]52;c;${Buffer.from(name).toString('base64')}\x07`));
    assert.equal(terminal.state.text, '');
  } finally {
    terminal.close(); await flush(screen); screen.dispose(); fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
  assert.ok(written.includes('\x1b[?1049l'));
});

test('/fork sends full fields to the native lane and preserves the plain terminal fallback', async () => {
  const { defaultConfig } = await import('../src/agent.js');
  const { interactiveLoop } = await import('../src/interactive.js');
  const { Session } = await import('../src/session.js');
  const root = fixture();
  const config = { ...defaultConfig(root, []), model: 'fixture', configSources: { userDir: root } };
  const session = Session.open(root, { config });
  const title = 'PARENT_TITLE_THAT_IS_TOO_LONG_FOR_THE_DEFAULT_TERMINAL_WIDTH';
  session.append({ kind: 'title', title });
  session.append({ kind: 'message', message: { role: 'user', content: 'parent task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'parent answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const before = structuredClone(session.events), rows: ForkRowFields[] = [];
  let callbacks: TerminalCallbacks | undefined, printed = '';
  const output = new Writable({ write(chunk, _encoding, done) { printed += String(chunk); done(); } });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks?.onSubmit?.('/fork')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    writeForkRow(fields) { rows.push(fields); },
  };
  const provider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const controller = new AbortController();
  const loop = interactiveLoop(session, provider, runtime, { input: new PassThrough(), output, status: output,
    signal: controller.signal, terminal, startBackground: () => ({ sessionId: 'abcdef01-2345-6789-abcd-ef0123456789',
      pid: undefined, log: '/fixture/copy.log' }) });
  try {
    const deadline = Date.now() + 5000;
    while (rows.length === 0) { assert.ok(Date.now() < deadline, printed); await new Promise(resolve => setImmediate(resolve)); }
    assert.deepEqual(rows, [{ state: 'session waiting for a prompt', name: title, id: 'abcdef01', chips: [] }]);
    assert.doesNotMatch(printed, /session waiting/);
    assert.match(printed, /Resume it with: litcode --workspace/);
    assert.deepEqual(session.events, before);
    callbacks?.onExit?.(); await loop;
    const plain: string[] = [];
    const fallback = new TuiTerminal({ input: new PassThrough(), output: new Writable({ write(chunk, _encoding, done) {
      plain.push(String(chunk)); done();
    } }) });
    try { fallback.writeForkRow(rows[0]!); }
    finally { fallback.close(); }
    assert.equal(plain.join(''), `session waiting for a prompt · ${title} · abcdef01\n`);
  } finally {
    controller.abort(); callbacks?.onExit?.(); await loop; session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
});
