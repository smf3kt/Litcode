import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { thinkingDialogRequest, THINKING_DIALOG_MESSAGE, THINKING_DIALOG_TITLE } from '../src/thinking-dialog.js';
import { TuiTerminal } from '../src/tui.js';

test('the thinking dialog takes the recovered title, subtitle and two rows', () => {
  assert.equal(THINKING_DIALOG_TITLE, 'Toggle thinking mode');
  assert.equal(THINKING_DIALOG_MESSAGE, 'Enable or disable thinking for this session.');
  const off = thinkingDialogRequest(false);
  assert.equal(off.title, THINKING_DIALOG_TITLE);
  assert.equal(off.message, THINKING_DIALOG_MESSAGE);
  assert.deepEqual(off.choices?.map(row => [row.value, row.label, row.description]), [
    ['true', 'Enabled', 'Claude will think before responding'],
    ['false', 'Disabled', 'Claude will respond without extended thinking'],
  ]);
  assert.equal(off.defaultIndex, 1);
  assert.equal(thinkingDialogRequest(true).defaultIndex, 0);
});

test('the dialog focuses the current value and answers in row values', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; input.setRawMode = () => {};
  const chunks: string[] = [];
  const output = new (await import('node:stream')).Writable({
    write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  try {
    let pending = tui.prompt(thinkingDialogRequest(false), new AbortController().signal);
    // The renderer positions each word with cursor moves, so assert on the painted fragments.
    assert.ok(chunks.join('').includes('Toggle') && chunks.join('').includes('Disabled'));
    key('\r');
    assert.deepEqual(await pending, { selected: ['false'] });
    pending = tui.prompt(thinkingDialogRequest(false), new AbortController().signal);
    key('\x1b[A\r');
    assert.equal((await pending)?.selected[0], 'true');
    pending = tui.prompt(thinkingDialogRequest(true), new AbortController().signal);
    key('\x1b');
    assert.equal(await pending, undefined);
  } finally {
    tui.close();
  }
});

test('a modal dialog hands the two live-panel chords back to the host', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; input.setRawMode = () => {};
  const output = new (await import('node:stream')).Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const actions: string[] = [];
  tui.on('action', action => actions.push(action));
  const key = (value: string) => input.emit('data', value);
  try {
    const controller = new AbortController();
    const pending = tui.prompt(thinkingDialogRequest(true), controller.signal);
    key('\x1bt');
    key('\x1bp');
    assert.deepEqual(actions, ['chat:thinkingToggle', 'chat:modelPicker']);
    controller.abort();
    assert.equal(await pending, undefined);
  } finally {
    tui.close();
  }
});
