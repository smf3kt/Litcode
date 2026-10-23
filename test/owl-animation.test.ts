import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import type { Terminal } from '@xterm/headless';
import { ge } from '../src/tui-color.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

test('the actual terminal animates the owl while preserving draft, focus, viewport and cleanup ownership', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 10000 });
  const colors = ge as unknown as { level: number }, before = colors.level; colors.level = 3;
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function') throw new Error('Pinned xterm decoder unavailable');
  const write = core.writeSync.bind(core);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  let writes = 0;
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { writes++; write(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const tui = new TuiTerminal({ input, output, theme: 'dark', version: '1.2.3' }).start();
  const key = (value: string) => input.emit('data', value);
  const text = () => Array.from({ length: screen.rows }, (_, y) => screen.buffer.active.getLine(y)?.translateToString(true) ?? '').join('\n');
  const owl = () => Array.from({ length: 8 }, (_, y) => Array.from({ length: 20 }, (_, x) => {
    const cell = screen.buffer.active.getLine(y + 1)?.getCell(x);
    return cell ? [cell.getChars(), cell.getFgColor(), cell.getBgColor()] : [];
  }));
  try {
    key('retained draft'); const initial = owl();
    t.mock.timers.tick(2400); assert.notDeepEqual(owl(), initial, 'idle breath changes the actual rendered owl');
    assert.equal(tui.state.text, 'retained draft');
    t.mock.timers.tick(650); const open = owl(); t.mock.timers.tick(800);
    assert.notDeepEqual(owl(), open, 'eyes blink'); t.mock.timers.tick(150); assert.deepEqual(owl(), open, 'eyes reopen');
    key('\x1b[O'); const blurred = owl(); t.mock.timers.tick(10000); assert.deepEqual(owl(), blurred, 'blur pauses poses');
    key('\x1b[I'); t.mock.timers.tick(2100); assert.notDeepEqual(owl(), blurred, 'focus resumes poses');
    tui.setPrefersReducedMotion(true); const reduced = owl(); t.mock.timers.tick(12000);
    assert.deepEqual(owl(), reduced, 'reduced motion is static');
    tui.setPrefersReducedMotion(false); assert.notDeepEqual(owl(), reduced, 'motion resumes its previous pose live');
    t.mock.timers.tick(450); assert.deepEqual(owl(), reduced, 'the resumed pose advances to rest');
    const dialog = tui.prompt({ title: 'Owned modal', message: 'Choose', choices: [{ label: 'One', value: 'one' }] }, new AbortController().signal);
    const modalWrites = writes; t.mock.timers.tick(12000); assert.equal(writes, modalWrites, 'modal stops mascot repaint');
    key('\x1b'); t.mock.timers.tick(100); void dialog;
    for (let index = 0; index < 50; index++) tui.append({ kind: 'assistant', text: `owned row ${index}` });
    assert.doesNotMatch(text(), /Welcome to LiTcode/); const hiddenWrites = writes;
    t.mock.timers.tick(12000); assert.equal(writes, hiddenWrites, 'offscreen mascot owns no active timer');
    for (let count = 0; count < 100 && tui.transcriptState.offset > 0; count++) key('\x1b[<64;2;3M');
    assert.match(text(), /Welcome to LiTcode/); tui.setProgress({ kind: 'start', uuid: 'owned-turn', startedAt: Date.now() });
    const working = owl(); t.mock.timers.tick(450); assert.notDeepEqual(owl(), working, 'actual model work has its own poses');
    tui.setProgress({ kind: 'finish', reason: 'aborted', duration: { uuid: 'owned-turn', durationMs: 450, timestamp: new Date().toISOString() } });
    assert.equal(tui.state.text, 'retained draft');
    output.rows = 10; screen.resize(100, 10); output.emit('resize');
    assert.doesNotMatch(text(), /[▀▄█]/); const shortWrites = writes; t.mock.timers.tick(12000);
    assert.equal(writes, shortWrites, 'line fallback has no mascot animation');
    tui.close(); const closedWrites = writes; t.mock.timers.tick(20000); assert.equal(writes, closedWrites, 'close cancels every remaining pose');
  } finally { tui.close(); screen.dispose(); colors.level = before; t.mock.timers.reset(); }
});
