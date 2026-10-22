import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import { modelPickerRequest } from '../src/model-picker.js';
import { ge } from '../src/tui-color.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

function fixture() {
  const screen = new HeadlessTerminal({ cols: 90, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (typeof core !== 'object' || core === null || !('writeSync' in core) || typeof core.writeSync !== 'function')
    throw new Error('Pinned xterm synchronous decoder is unavailable');
  const write = core.writeSync.bind(core);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    write(String(chunk)); done();
  } }), { isTTY: true, columns: 90, rows: 30 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const focused = () => lines().find(row => row.startsWith('❯'))?.trimEnd();
  const rowOf = (number: number) => lines().findIndex(row => new RegExp(`^[❯↑↓ ] ${number}\\.\\s+model-${number}(?: |$)`, 'u').test(row));
  const mouse = (button: number, row: number, release = false) => key(`\x1b[<${button};6;${row + 1}${release ? 'm' : 'M'}`);
  return { screen, tui, key, lines, focused, rowOf, mouse, resize(columns: number, rows: number) {
    output.columns = columns; output.rows = rows; screen.resize(columns, rows); output.emit('resize');
  }, close() { tui.close(); screen.dispose(); } };
}

const models = Array.from({ length: 12 }, (_, index) => `model-${index + 1}`);

test('model modal owns navigation, disabled search, numeric acceptance and manual effort without leaking draft input', async () => {
  const f = fixture();
  try {
    f.key('retained draft');
    let pending = f.tui.prompt(modelPickerRequest(models, 'model-1'), new AbortController().signal);
    assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    assert.ok(f.lines().some(row => row === '   … +4 models'));
    assert.equal(f.lines().some(row => row.includes('Selected:') || row.includes('Other')), false);
    f.key('/abc\t\x1b[200~s9\x1b[201~');
    assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    f.key('j'); assert.equal(f.focused(), '❯ 2.  model-2');
    f.key('k\x0e'); assert.equal(f.focused(), '❯ 2.  model-2');
    f.key('\x10'); assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    f.key('\x1b[6~'); assert.equal(f.focused(), '❯ 9.  model-9');
    f.key('\x1b[5~'); assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    f.key('\x1b[F'); assert.equal(f.focused(), '❯ 12. model-12');
    f.key('\x1b[B'); assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    f.key('\x1b[A'); assert.equal(f.focused(), '❯ 12. model-12');
    f.key('\x1b[H'); assert.equal(f.focused(), '❯ 1.  model-1 ✔  Current model');
    f.key('9trailing\r'); assert.deepEqual(await pending, { selected: ['model-9'] });
    assert.equal(f.tui.state.text, 'retained draft');
    pending = f.tui.prompt(modelPickerRequest(models, 'model-4'), new AbortController().signal);
    f.key('\x1b[C\x1b[D\x1b[Bs');
    assert.deepEqual(await pending, { selected: ['model-5'], adjusted: 'high', key: 's' });
    pending = f.tui.prompt(modelPickerRequest(models, 'model-1', 'max'), new AbortController().signal);
    f.key('\x1b[C\r'); assert.deepEqual(await pending, { selected: ['model-1'], adjusted: 'max' });
    pending = f.tui.prompt(modelPickerRequest([], 'missing'), new AbortController().signal);
    f.key('\r1s'); assert.equal(f.tui.currentScreen, 'dialog');
    f.key('\x03'); assert.equal(await pending, undefined);
    const controller = new AbortController();
    pending = f.tui.prompt(modelPickerRequest(models, 'model-1'), controller.signal);
    controller.abort(); assert.equal(await pending, undefined);
    pending = f.tui.prompt(modelPickerRequest(models, 'model-1'), new AbortController().signal);
    f.key('\x1b'); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(await pending, undefined);
    pending = f.tui.prompt(modelPickerRequest(models, 'model-1'), new AbortController().signal);
    f.tui.close(); assert.equal(await pending, undefined);
    assert.equal(f.tui.state.text, 'retained draft');
  } finally { f.close(); }
});

test('model effort paints source glyph, adjustment and max reminder styles through themes and empty lists', async () => {
  const previousColor: unknown = Reflect.get(ge, 'level');
  const previousReminder = process.env.LITCODE_MAX_EFFORT_REMINDER;
  assert.equal(Reflect.set(ge, 'level', 3), true);
  delete process.env.LITCODE_MAX_EFFORT_REMINDER;
  const f = fixture();
  const cellAt = (text: string, offset = 0) => {
    const lines = f.lines(), row = lines.findIndex(line => line.includes(text));
    assert.ok(row >= 0, `rendered ${text}`);
    return f.screen.buffer.active.getLine(f.screen.buffer.active.viewportY + row)!.getCell(lines[row]!.indexOf(text) + offset)!;
  };
  try {
    f.key('kept draft'); f.tui.setTheme('dark');
    let pending = f.tui.prompt(modelPickerRequest(models, 'model-1', 'high'), new AbortController().signal);
    assert.equal(cellAt('● high effort').getFgColor(), 0xe6e6e6);
    assert.equal(cellAt('● high effort', 2).getFgColor(), 0x999999);
    assert.equal(cellAt('←/→ to adjust').getFgColor(), 0x505050);
    f.tui.setTheme('light');
    assert.equal(cellAt('● high effort').getFgColor(), 0x505050);
    assert.equal(cellAt('● high effort', 2).getFgColor(), 0x666666);
    assert.equal(cellAt('←/→ to adjust').getFgColor(), 0xafafaf);
    f.tui.setTheme('dark-ansi');
    assert.equal(cellAt('● high effort').getFgColor(), 15);
    assert.equal(cellAt('● high effort', 2).getFgColor(), 7);
    f.key('\x03'); assert.equal(await pending, undefined);
    f.tui.setTheme('dark');
    for (const [value, warning] of [['', false], ['garbage', false], ['off', false], ['1', true], [' TRUE ', true], ['yes', true], ['on', true]] as const) {
      process.env.LITCODE_MAX_EFFORT_REMINDER = value;
      pending = f.tui.prompt(modelPickerRequest(models, 'model-1', 'max'), new AbortController().signal);
      const line = f.lines().find(row => row.includes('May use excessive tokens'))!;
      assert.equal(line.startsWith('⚠ '), warning);
      assert.equal(cellAt('May use excessive tokens').getFgColor(), warning ? 0xffc107 : 0x505050);
      f.key('\x1b[D');
      assert.ok(f.lines().some(row => row.includes('◉ xHigh effort ←/→ to adjust')));
      assert.equal(f.lines().some(row => row.includes('May use excessive tokens')), false);
      f.key('\x03'); assert.equal(await pending, undefined);
    }
    pending = f.tui.prompt(modelPickerRequest([], 'missing', 'max'), new AbortController().signal);
    assert.equal(f.lines().some(row => row.includes('effort') || row.includes('May use excessive tokens')), false);
    f.key('\x03'); assert.equal(await pending, undefined);
    assert.equal(f.tui.state.text, 'kept draft');
  } finally {
    f.close(); Reflect.set(ge, 'level', previousColor);
    if (previousReminder === undefined) delete process.env.LITCODE_MAX_EFFORT_REMINDER;
    else process.env.LITCODE_MAX_EFFORT_REMINDER = previousReminder;
  }
});

test('model rows retain current and focus colors, scroll within the list and remeasure pointer targets on resize', async () => {
  const previousColor: unknown = Reflect.get(ge, 'level');
  assert.equal(typeof previousColor, 'number');
  assert.equal(Reflect.set(ge, 'level', 3), true);
  const f = fixture();
  try {
    let pending = f.tui.prompt(modelPickerRequest(models, 'model-1'), new AbortController().signal);
    f.key('\x1b[B');
    const current = f.rowOf(1), focus = f.rowOf(2);
    const buffer = f.screen.buffer.active;
    const cell = (column: number, row: number) => buffer.getLine(buffer.viewportY + row)?.getCell(column);
    assert.equal(cell(6, current)?.getFgColor(), 0x4eba65);
    assert.equal(cell(6, focus)?.getFgColor(), 0xb1b9f9);
    assert.ok(cell(0, f.lines().findIndex(row => row === 'Select model'))?.isBold());
    f.mouse(65, f.lines().findIndex(row => row === 'Select model'));
    assert.ok(f.rowOf(1) >= 0);
    f.mouse(65, f.rowOf(8));
    assert.equal(f.rowOf(1), -1);
    assert.equal(f.focused(), '❯ 2.  model-2');
    f.mouse(64, f.rowOf(2)); assert.ok(f.rowOf(1) >= 0);
    f.mouse(0, f.rowOf(3));
    f.resize(44, 24);
    f.mouse(0, f.rowOf(3), true); assert.equal(f.tui.currentScreen, 'dialog');
    assert.ok(f.rowOf(3) >= 0);
    f.mouse(0, f.rowOf(3)); f.mouse(0, f.rowOf(3), true);
    assert.deepEqual(await pending, { selected: ['model-3'] });
    for (const columns of [20, 24]) {
      f.resize(columns, 24);
      pending = f.tui.prompt(modelPickerRequest(models, 'model-1', 'max'), new AbortController().signal);
      f.key('\x1b[F');
      const last = f.lines().findIndex(row => /^❯ 12\./u.test(row));
      assert.ok(last >= 0, `${columns}-column focused model stays visible beside the wrapped max note`);
      assert.ok(f.lines().some(row => row.includes('max effort')));
      f.mouse(0, last); f.mouse(0, last, true);
      assert.deepEqual(await pending, { selected: ['model-12'] });
    }
    pending = f.tui.prompt(modelPickerRequest(['model-1'], 'model-1'), new AbortController().signal);
    f.resize(90, 30);
    f.mouse(0, 0); f.mouse(0, 0, true); assert.equal(f.tui.currentScreen, 'dialog');
    f.mouse(0, f.rowOf(1)); f.mouse(0, f.rowOf(1), true);
    assert.deepEqual(await pending, { selected: ['model-1'] });
  } finally { f.close(); Reflect.set(ge, 'level', previousColor); }
});
