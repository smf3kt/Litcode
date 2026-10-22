import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import { createTerminalInput } from '../src/terminal.js';
import { BASH_CAVEAT, BASH_INPUT_TAG, BASH_PROGRESS_LINES, BASH_STDERR_TAG, BASH_STDOUT_TAG,
  bashCommand, bashInputText, bashResultText, composerMode, composerPointer, composerValue,
  drainedShellLineVisible, drainedShellRow, drainedShellTail, escapeBashText, isBareBashSigil,
  readBashInput, readBashResult, shellBytesText, shellDurationText, shellElapsedText,
  switchedToBash } from '../src/tui-bash-mode.js';

test('source x_/sI/Jgt: a leading ! reads as bash and the command drops it', () => {
  assert.equal(composerMode('ls'), 'prompt');
  assert.equal(composerMode('!ls'), 'bash');
  assert.equal(bashCommand('!ls -la'), 'ls -la');
  assert.equal(bashCommand('ls'), 'ls');
  // `sI` strips only the marker, not an exclamation inside the command.
  assert.equal(bashCommand('!echo hi!'), 'echo hi!');
  assert.equal(isBareBashSigil('!'), true);
  assert.equal(isBareBashSigil('!ls'), false);
});

test('source J1o: the mode switches only at caret 0 on a one-character growth', () => {
  assert.equal(switchedToBash({ nextValue: '!', value: '', cursorOffset: 0, mode: 'prompt' }), true);
  assert.equal(switchedToBash({ nextValue: '!x', value: 'x', cursorOffset: 0, mode: 'prompt' }), true);
  assert.equal(switchedToBash({ nextValue: '!xy', value: 'x', cursorOffset: 0, mode: 'prompt' }), false);
  assert.equal(switchedToBash({ nextValue: '!x', value: 'x', cursorOffset: 1, mode: 'prompt' }), false);
  assert.equal(switchedToBash({ nextValue: '!x', value: '!x', cursorOffset: 0, mode: 'bash' }), false);
  assert.equal(switchedToBash({ nextValue: 'x', value: 'x', cursorOffset: 0, mode: 'prompt' }), false);
});

test('source BEe: a queued command returns to the draft with its marker', () => {
  assert.equal(composerValue('ls', 'bash'), '!ls');
  assert.equal(composerValue('ls', 'prompt'), 'ls');
});

test('source uT: bash mode leads with ! and an NBSP, prompt mode with the session pointer', () => {
  assert.equal(composerPointer('bash', '> '), '!\xA0');
  assert.equal(composerPointer('prompt', '>'), '>\xA0');
  assert.equal(composerPointer('prompt', '>', 'reviewer'), 'reviewer\xA0');
  // `Pzt`'s 24-cell clip keeps the trailing NBSP.
  const clipped = composerPointer('prompt', '> ', 'a'.repeat(40));
  assert.equal(clipped.length, 24);
  assert.ok(clipped.endsWith('\xA0'));
});

test('source $t escapes exactly &, < and >', () => {
  assert.equal(escapeBashText('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  assert.equal(escapeBashText('"quotes" \'stay\''), '"quotes" \'stay\'');
});

test('source processBashCommand: the result row carries both tags in order', () => {
  const text = bashResultText('one', 'two');
  assert.equal(text, `<${BASH_STDOUT_TAG}>one</${BASH_STDOUT_TAG}><${BASH_STDERR_TAG}>two</${BASH_STDERR_TAG}>`);
  assert.deepEqual(readBashResult(text), { stdout: 'one', stderr: 'two' });
  assert.deepEqual(readBashResult(bashResultText('', '')), { stdout: '', stderr: '' });
  assert.deepEqual(readBashResult('plain text'), { stdout: '', stderr: '' });
});

test('the bash-input row round-trips through its tag', () => {
  assert.equal(bashInputText('echo hi'), `<${BASH_INPUT_TAG}>echo hi</${BASH_INPUT_TAG}>`);
  assert.equal(readBashInput(bashInputText('echo hi')), 'echo hi');
  assert.equal(readBashInput(` ${bashInputText('ls')} `), 'ls');
  assert.equal(readBashInput('ls'), null);
  assert.equal(readBashInput(`<${BASH_INPUT_TAG}>ls`), null);
});

test('the caveat row names this build and keeps the recovered sentence', () => {
  assert.ok(BASH_CAVEAT.startsWith('<local-command-caveat>'));
  assert.ok(BASH_CAVEAT.endsWith('</local-command-caveat>'));
  assert.ok(BASH_CAVEAT.includes('The command below was run directly in LiTcode'));
  assert.ok(BASH_CAVEAT.includes("recorded here as context for later messages"));
});

test('source fIe: the live row keeps five trailing lines and reports the drop', () => {
  assert.equal(BASH_PROGRESS_LINES, 5);
  const short = drainedShellTail('a\nb\nc', 80);
  assert.deepEqual(short, { text: 'a\nb\nc', clipped: false, dropped: 0 });
  const long = drainedShellTail('1\n2\n3\n4\n5\n6\n7', 80);
  assert.equal(long.text, '3\n4\n5\n6\n7');
  assert.equal(long.clipped, true);
  assert.equal(long.dropped, 2);
  // A wrapped line spends more than one of the five rows.
  const wrapped = drainedShellTail('abcdefghij\nxy', 6);
  assert.equal(wrapped.clipped, true);
  assert.ok(wrapped.text.endsWith('xy'));
  // Source `v` strips ANSI before it splits, so an escape never reaches the row.
  assert.equal(drainedShellTail('\x1b[31mred\x1b[0m', 80).text, 'red');
});

test('source Qt/rn/_ie: the row\'s byte and duration columns', () => {
  assert.equal(shellBytesText(512), '512 bytes');
  assert.equal(shellBytesText(2048), '2KB');
  assert.equal(shellBytesText(1024 * 1024), '1MB');
  assert.equal(shellDurationText(0), '0s');
  assert.equal(shellDurationText(12_000), '12s');
  assert.equal(shellDurationText(65_000), '1m 5s');
  assert.equal(shellDurationText(3_600_000), '1h 0m 0s');
  assert.equal(shellDurationText(3_600_000, { hideTrailingZeros: true }), '1h');
  assert.equal(shellElapsedText(undefined, undefined), null);
  assert.equal(shellElapsedText(undefined, 30_000), '(timeout 30s)');
  assert.equal(shellElapsedText(4, 30_000), '(4s · timeout 30s)');
  assert.equal(shellElapsedText(4, undefined), '(4s)');
});

test('source fIe: the row is Running until output, then the tail with its columns', () => {
  const empty = drainedShellRow({ output: '', fullOutput: '', elapsedTimeSeconds: 0,
    totalLines: 0, totalBytes: 0, timeoutMs: 30_000 }, 80);
  assert.equal(empty.running, true);
  assert.equal(empty.elapsed, '(0s · timeout 30s)');
  const output = Array.from({ length: 9 }, (_, index) => `line ${index + 1}`).join('\n');
  const row = drainedShellRow({ output, fullOutput: output, elapsedTimeSeconds: 3,
    totalLines: 9, totalBytes: 100 }, 80);
  assert.equal(row.running, false);
  assert.equal(row.text, 'line 5\nline 6\nline 7\nline 8\nline 9');
  // Nine lines in total, five shown: the count column names the four the tail dropped.
  assert.equal(row.count, '~9 lines');
  assert.equal(row.elapsed, '(3s)');
  assert.equal(row.bytes, '100 bytes');
  // Verbose (`fIe`'s `a?null:v(m,c)`) prints the whole output and no count column.
  const verbose = drainedShellRow({ output, fullOutput: output, totalLines: 9, totalBytes: 100,
    verbose: true }, 80);
  assert.equal(verbose.text, output);
  assert.equal(verbose.count, '~9 lines');
  // The collapse gate needs more than the five kept lines before the row is worth showing.
  assert.equal(drainedShellLineVisible(output, output, 80, 9), true);
  assert.equal(drainedShellLineVisible('a', 'a', 80, 1), false);
  assert.equal(drainedShellLineVisible('a', '   ', 80, 1), false);
});

test('source showDrainedShellLine: the row draws above the composer and clears on completion', async () => {
  const { TuiTerminal } = await import('../src/tui.js');
  class FakeInput extends PassThrough { isTTY = true; setRawMode(): this { return this; } }
  class FakeOutput extends Writable { isTTY = true; columns = 100; rows = 24; text = '';
    _write(chunk: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void { this.text = chunk.toString(); cb(); } }
  const input = new FakeInput(), output = new FakeOutput();
  const tui = new TuiTerminal({ input, output }).start();
  try {
    // The renderer repaints the whole frame per write, so the last chunk is the screen.
    const lines = () => output.text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').split('\n');
    tui.setDrainedShell({ output: '', fullOutput: '', elapsedTimeSeconds: 0, totalLines: 0,
      totalBytes: 0, timeoutMs: 30_000 });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(lines().some(row => row.includes('Running…')), 'the row starts as Running');
    tui.setDrainedShell({ output: 'one\ntwo\nthree', fullOutput: 'one\ntwo\nthree',
      elapsedTimeSeconds: 3, totalLines: 3, totalBytes: 14 });
    await new Promise(resolve => setTimeout(resolve, 30));
    const drawn = lines().join('\n');
    assert.ok(drawn.includes('three'), 'the tail of the output is on screen');
    assert.ok(drawn.includes('(3s)'), 'the elapsed column is on screen');
    assert.ok(drawn.includes('14 bytes'), 'the byte column is on screen');
    tui.setDrainedShell(undefined);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(!lines().join('\n').includes('14 bytes'), 'clearing removes the row');
  } finally { tui.close(); }
});

test('the terminal composer: ! enters bash, submit carries the mode, Backspace leaves it', () => {
  class FakeInput extends PassThrough { isTTY = true; isRaw = false;
    setRawMode(value: boolean): this { this.isRaw = value; return this; }
    key(value: string): void { this.emit('data', value); } }
  class FakeOutput extends Writable { isTTY = true; columns = 80; rows = 24; text = '';
    _write(chunk: Buffer, _e: BufferEncoding, cb: (e?: Error | null) => void): void { this.text += chunk.toString(); cb(); } }
  const input = new FakeInput(), output = new FakeOutput();
  const submitted: Array<{ text: string; mode?: string }> = [];
  const terminal = createTerminalInput({ input, output, onSubmit: (text, _attachment, mode) => submitted.push({ text, mode }) }).start();
  try {
    input.key('!');
    assert.equal(terminal.state.text, '', 'the marker never enters the value');
    input.key('echo hi');
    input.key('\r');
    assert.deepEqual(submitted, [{ text: 'echo hi', mode: 'bash' }]);
    input.key('hello\r');
    assert.deepEqual(submitted[1], { text: 'hello', mode: 'prompt' }, 'submit returns the composer to prompt mode');
    input.key('!\x7f');
    input.key('x\r');
    assert.deepEqual(submitted[2], { text: 'x', mode: 'prompt' }, 'Backspace on an empty bash composer drops the mode');
  } finally { terminal.close(); }
});
