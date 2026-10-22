import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import { createTerminalInput } from '../src/terminal.js';
import { BASH_CAVEAT, BASH_INPUT_TAG, BASH_PROGRESS_LINES, BASH_STDERR_TAG, BASH_STDOUT_TAG,
  bashCommand, bashInputText, bashResultText, composerMode, composerPointer, composerValue,
  drainedShellTail, escapeBashText, isBareBashSigil, readBashInput, readBashResult,
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
