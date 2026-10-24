import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
process.env.FORCE_COLOR = '3';
const { ShellProgressInteraction } = await import('../src/tui-shell-progress.js');
const { TuiTerminal } = await import('../src/tui.js');

function fixture(columns = 100, rows = 32) {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new HeadlessTerminal({ cols: columns, rows, allowProposedApi: true, logLevel: 'off' });
  let printed = '';
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    printed += String(chunk);
    (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk)); done();
  } }), { isTTY: true, columns, rows });
  const terminal = new TuiTerminal({ input, output, prefersReducedMotion: true });
  const errors: Error[] = []; terminal.on('inputError', error => errors.push(error)); terminal.start();
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const frame = () => lines().join('\n');
  const locate = (text: string) => {
    const row = lines().findIndex(line => line.includes(text)); assert.ok(row >= 0, text + '\n' + frame());
    return { row: row + 1, column: lines()[row]!.indexOf(text) + 1 };
  };
  const pointer = (button: number, column: number, row: number, end = 'M') => input.emit('data', `\x1b[<${button};${column};${row}${end}`);
  const cell = (text: string) => {
    const at = locate(text);
    return screen.buffer.active.getLine(screen.buffer.active.viewportY + at.row - 1)!.getCell(at.column - 1)!;
  };
  return { terminal, input, output, screen, errors, frame, locate, pointer, cell,
    get printed() { return printed; },
    async click(text: string, blank = false) {
      const at = locate(text), column = blank ? output.columns - 2 : at.column;
      pointer(35, column, at.row); pointer(0, column, at.row); pointer(0, column, at.row, 'm'); await delay(10);
    },
    close() { terminal.close(); screen.dispose(); },
  };
}
const output = Array.from({ length: 9 }, (_, index) => `OWNED_LINE_${index + 1}`).join('\n');
const progress = () => ({ output, fullOutput: output, elapsedTimeSeconds: 2, totalLines: 9, totalBytes: 116 });
const foreground = (cell: ReturnType<ReturnType<typeof fixture>['cell']>) => [cell.getFgColorMode(), cell.getFgColor()];

test('source tTe/oTo keeps click expansion, blank-cell admission, hyperlinks and verbose gates', () => {
  const interaction = new ShellProgressInteraction();
  const blank = { cellIsBlank: true, hyperlinkUrl: undefined, allowDefault() {} };
  assert.equal(interaction.clickable(progress(), 100, false), true);
  interaction.click(blank); assert.equal(interaction.expanded, false);
  let defaults = 0;
  interaction.click({ ...blank, cellIsBlank: false, hyperlinkUrl: 'https://owned.test', allowDefault() { defaults++; } });
  assert.equal(defaults, 1); assert.equal(interaction.expanded, false);
  interaction.click({ ...blank, cellIsBlank: false }); assert.equal(interaction.expanded, true);
  assert.equal(interaction.clickable({ output: 'short', fullOutput: 'short', totalLines: 1 }, 100, false), true);
  assert.equal(interaction.clickable(progress(), 100, true), false);
  interaction.click(blank); assert.equal(interaction.expanded, false);
  assert.equal(interaction.clickable({ output: 'short', fullOutput: 'short', totalLines: 1 }, 100, false), false);
  assert.equal(interaction.clickable({ output: '', fullOutput: '', totalLines: 9 }, 100, false), false);
  assert.equal(interaction.clickable({ output: 'x'.repeat(100), fullOutput: 'x'.repeat(100), totalLines: 1 }, 20, false), true);
});

test('running Shell uses native hover/click/drag and retains expansion through output and verbosity changes', async () => {
  const f = fixture();
  try {
    f.terminal.setDrainedShell(progress());
    assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    const collapsedColor = foreground(f.cell('OWNED_LINE_7')), at = f.locate('OWNED_LINE_7');
    f.pointer(35, at.column, at.row); await delay(10);
    assert.notDeepEqual(foreground(f.cell('OWNED_LINE_7')), collapsedColor);
    assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    f.pointer(35, 1, 1); await delay(10);
    assert.deepEqual(foreground(f.cell('OWNED_LINE_7')), collapsedColor);
    await f.click('OWNED_LINE_7'); assert.match(f.frame(), /OWNED_LINE_1/);
    const background = f.cell('OWNED_LINE_7').getBgColorMode(); assert.notEqual(background, 0);
    f.pointer(35, 1, 1); await delay(10); assert.match(f.frame(), /OWNED_LINE_1/);
    f.terminal.setDrainedShell({ ...progress(), elapsedTimeSeconds: 3 }); assert.match(f.frame(), /OWNED_LINE_1/);
    const secondary = f.locate('OWNED_LINE_7');
    f.pointer(2, secondary.column, secondary.row); f.pointer(2, secondary.column, secondary.row, 'm');
    await f.click('OWNED_LINE_7'); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    f.pointer(1, secondary.column, secondary.row); f.pointer(1, secondary.column, secondary.row, 'm');
    await f.click('OWNED_LINE_7'); assert.match(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_7', true); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_7', true); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    const drag = f.locate('OWNED_LINE_7');
    f.pointer(0, drag.column, drag.row); f.pointer(32, drag.column + 4, drag.row); f.pointer(0, drag.column + 4, drag.row, 'm');
    await delay(10); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    f.input.emit('data', '\x03'); await delay(10);
    f.terminal.setVerbose(true); assert.match(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_7'); f.terminal.setVerbose(false); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    await delay(510);
    await f.click('OWNED_LINE_7'); assert.match(f.frame(), /OWNED_LINE_1/);
    f.terminal.setVerbose(true); await f.click('OWNED_LINE_7', true); f.terminal.setVerbose(false);
    assert.match(f.frame(), /OWNED_LINE_1/);
    f.terminal.setDrainedShell(undefined); f.terminal.setDrainedShell(progress()); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    assert.deepEqual(f.errors, []);
  } finally { f.close(); }
});

test('modal, resize, clipped geometry and command replacement retire stale Shell pointer captures', async () => {
  const f = fixture();
  try {
    f.terminal.setDrainedShell(progress());
    const first = f.locate('OWNED_LINE_7'); f.pointer(0, first.column, first.row);
    const modal = f.terminal.prompt({ title: 'OWNED_MODAL', readOnly: true, message: 'Only this dialog owns clicks' }, new AbortController().signal);
    f.pointer(0, first.column, first.row, 'm'); f.input.emit('data', '\x1b'); await modal;
    assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_7'); assert.match(f.frame(), /OWNED_LINE_1/);
    f.output.rows = 12; f.screen.resize(100, 12); f.output.emit('resize');
    assert.match(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_1', true); assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    f.output.rows = 32; f.screen.resize(100, 32); f.output.emit('resize');
    const stale = f.locate('OWNED_LINE_7'); f.pointer(0, stale.column, stale.row);
    f.terminal.setDrainedShell(undefined); f.terminal.setDrainedShell(progress()); f.pointer(0, stale.column, stale.row, 'm');
    assert.doesNotMatch(f.frame(), /OWNED_LINE_1/);
    await f.click('OWNED_LINE_7'); assert.match(f.frame(), /OWNED_LINE_1/);
    f.terminal.setDrainedShell(undefined); f.terminal.close(); const before = f.printed;
    f.output.emit('resize'); f.pointer(35, stale.column, stale.row); await delay(20);
    assert.equal(f.printed, before); assert.deepEqual(f.errors, []);
  } finally { f.close(); }
});
