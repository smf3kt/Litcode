import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createEditorState, createTerminalInput, reduceEditor, TerminalKeyDecoder } from '../src/terminal.js';
import { TerminalFocus } from '../src/tui-focus.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal } = createRequire(import.meta.url)('@xterm/headless');
function fixture(mode: 'line' | 'tui') {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = value => { input.isRaw = value; };
  const screen = new Terminal({ cols: 40, rows: 10, allowProposedApi: true, logLevel: 'off' });
  let bytes = '';
  const output = new Writable({ write(chunk, _encoding, done) {
    bytes += String(chunk); screen._core.writeSync(String(chunk)); done();
  } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 10 });
  const submitted: string[] = [], actions: string[] = [];
  const options = { input, output, editorMode: 'vim' as const, vimInsertModeRemaps: { jj: '<Esc>' },
    onSubmit: (text: string) => submitted.push(text), onAction: (action: string) => actions.push(action) };
  const terminal = (mode === 'line' ? createTerminalInput(options) : new TuiTerminal(options)).start();
  const key = async (value: string) => { input.emit('data', value); if (value === '\x1b') await delay(70); };
  const inverse = () => {
    const buffer = screen.buffer.active;
    return Array.from({ length: 10 }, (_, y) => buffer.getLine(buffer.viewportY + y))
      .reduce((sum, line) => sum + Array.from({ length: 40 }, (_, x) => line?.getCell(x)?.isInverse() ? 1 : 0)
        .reduce<number>((a, b) => a + b, 0), 0);
  };
  const close = () => { terminal.close(); screen.dispose(); assert.equal(input.isRaw, false); assert.equal(input.listenerCount('data'), 0); };
  return { input, output, terminal, key, inverse, submitted, actions, screen, close, bytes: () => bytes };
}

test('source focus state and split reports remain outside editor, bindings and paste framing', context => {
  let now = 10000; context.mock.method(Date, 'now', () => now);
  const focus = new TerminalFocus(), other = new TerminalFocus(), events: string[] = [];
  const unsubscribe = focus.subscribe(() => events.push(focus.state));
  assert.equal(focus.focused, true); assert.equal(focus.state, 'unknown'); assert.equal(focus.gainedAt, -Infinity);
  focus.set(false); focus.set(false); assert.deepEqual(events, ['blurred']); assert.equal(other.state, 'unknown');
  focus.set(true); assert.equal(focus.gainedAt, now); now++;
  focus.set(true); assert.equal(focus.gainedAt, now); assert.deepEqual(events, ['blurred', 'focused', 'focused']);
  unsubscribe(); focus.close(); focus.set(false); assert.equal(events.length, 3); other.close();
  const state = createEditorState();
  for (const preserve of [false, true]) {
    for (const focused of [false, true]) {
      const report = focused ? '\x1b[I' : '\x1b[O';
      for (let split = 1; split < report.length; split++) {
        const decoder = new TerminalKeyDecoder({ [report]: 'submit' }, 10000, preserve, true);
        assert.deepEqual(decoder.push(report.slice(0, split)), []); if (split > 1) decoder.discardPending();
        const [action] = decoder.push(report.slice(split)); assert.deepEqual(action, { type: 'focus', focused });
        assert.equal(reduceEditor(state, action!).state, state);
      }
    }
    const decoder = new TerminalKeyDecoder({}, 10000, preserve, true);
    assert.deepEqual(decoder.push('\x1b[200~x\x1b[O\x1b[I\x1b[201~'), [{ type: 'paste', text: 'x\x1b[O\x1b[I' }]);
    decoder.push('\x1b[200~discard'); decoder.discardPending();
    assert.deepEqual(decoder.push('\x1b[O\x1b[201~\x1b[O'), [{ type: 'focus', focused: false }]);
  }
});

test('both terminal owners retain raw Vim draft, visual ranges, undo and handoff through focus changes', async () => {
  for (const mode of ['line', 'tui'] as const) {
    const owned = fixture(mode), { terminal, key, inverse, submitted } = owned;
    try {
      await key('é👩‍💻abc'); await key('\x1b'); await key('0vl');
      const before = terminal.state, selected = inverse(); assert.equal(selected, 3);
      await key('\x1b['); await key('O'); assert.equal(inverse(), 0); assert.deepEqual(terminal.state, before);
      await key('\x1b]11;#000\x07'); await key('\x1b[<64;2;2M'); assert.equal(inverse(), 0);
      await key('\x1b[I'); assert.equal(inverse(), selected); assert.deepEqual(terminal.state, before);
      await key('\x1b[O'); await key('l'); assert.equal(terminal.state.cursor, 7); assert.equal(inverse(), 4);
      await key('x'); await key('u'); assert.equal(terminal.state.text, before.text);
      await key('\x1b[O'); await key('\x1b'); assert.equal(Reflect.get(terminal, 'focus').state, 'focused');
      await key('\x1b[O\x1b[<128;2;1M'); assert.equal(Reflect.get(terminal, 'focus').state, 'focused');
      await key('\r'); assert.deepEqual(submitted, [before.text]);
      await key('draftj\x1b[O\x1b[Ij'); assert.equal(terminal.state.text, 'draft');
      await key('i'); await key('\x1b[O');
      const previous = { VISUAL: process.env.VISUAL, EDITOR: process.env.EDITOR };
      try { process.env.VISUAL = '/usr/bin/true'; process.env.EDITOR = 'unused'; await terminal.editDraft(new AbortController().signal); }
      finally { for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value; }
      assert.equal(Reflect.get(terminal, 'focus').state, 'blurred'); assert.equal(terminal.state.text, 'draft');
      await key('\x1b[200~é👩‍💻\x1b[201~'); assert.equal(Reflect.get(terminal, 'focus').state, 'focused');
      assert.equal(terminal.state.text, 'drafé👩‍💻t');
      assert.equal((owned.bytes().match(/\x1b\[\?1004h/g) ?? []).length, 2);
      terminal.close(); assert.equal((owned.bytes().match(/\x1b\[\?1004l/g) ?? []).length, 2);
      const end = owned.bytes(); await key('\x1b[O\x1b[I'); assert.equal(owned.bytes(), end);
    } finally { owned.close(); }
  }
});

test('TUI focus updates source clock and ends dragging while keeping modal and pending chord ownership', async () => {
  const owned = fixture('tui'), tui = owned.terminal as TuiTerminal, { key, actions } = owned;
  try {
    tui.write('select this text\nnext row\n'); await key('\x1b[<0;2;1M\x1b[<32;7;1M');
    const selected = structuredClone(Reflect.get(tui, 'selection')); assert.equal(selected.dragging, true);
    tui.setRunning(true); const progress = Reflect.get(tui, 'progress'), clock = Reflect.get(progress, 'clock');
    const intervals: number[] = [], original = clock.setTickInterval.bind(clock);
    clock.setTickInterval = (value: number) => { intervals.push(value); original(value); };
    await key('\x1b[O'); assert.deepEqual(Reflect.get(tui, 'selection'), { ...selected, dragging: false });
    await key('\x1b[<32;12;1M'); assert.equal(Reflect.get(tui, 'focus').state, 'blurred');
    assert.deepEqual(Reflect.get(tui, 'selection'), { ...selected, dragging: false });
    await key('\x1b[<64;2;2M'); assert.equal(Reflect.get(tui, 'focus').state, 'blurred');
    await key('\x1b[<0;2;1M'); assert.equal(Reflect.get(tui, 'focus').state, 'focused');
    assert.deepEqual(intervals, [32, 16]); tui.setRunning(false);
    await key('root'); const answer = tui.prompt({ message: 'Answer', allowText: true }, new AbortController().signal);
    await key('modal\x1b[O\x1b[I'); assert.equal(tui.state.text, 'root'); await key('\r\x1b[Odiscarded tail');
    assert.deepEqual(await answer, { selected: [], text: 'modal' });
    assert.equal(tui.state.text, 'root'); assert.equal(Reflect.get(tui, 'focus').state, 'blurred');
    assert.equal(owned.inverse(), 0); await key('\x1b[I');
    await key('\u0018\x1b[O\x1b[I\u0005'); assert.ok(actions.includes('chat:externalEditor')); assert.equal(tui.state.text, 'root');
    tui.close(); const end = owned.bytes(); await delay(100); assert.equal(owned.bytes(), end);
  } finally { owned.close(); }
});
