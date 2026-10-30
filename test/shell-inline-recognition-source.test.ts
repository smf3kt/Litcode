import assert from 'node:assert/strict';
import { test } from 'node:test';
import { E6 } from '../src/shell-analyser-source.js';
import { w6 } from '../src/shell-command-clamp-source.js';
import { createShellInlineRecognition } from '../src/shell-inline-recognition-source.js';

test('source inline-shell recognition preserves arguments, unknown scripts and wrapper controls', async () => {
  const inline = createShellInlineRecognition(() => {});
  const examples = [
    [['sh', '-c', 'rm target'], { script: 'rm target', judged: 'rm target', homeWritten: false }],
    [['sh', '-c', 'alias z=rm; z target'], { script: 'alias z=rm; z target', judged: undefined, homeWritten: false }],
    [['bash', '-c', 'echo $1', 'runner', 'hello'], { script: 'echo $1', judged: 'echo hello', homeWritten: false }],
    [['bash', '-c', 'echo $1', 'runner', 'unsafe;thing'],
      { script: 'echo $1', judged: 'echo __INLINE_SHELL_VALUE__', homeWritten: false }],
    [['bash', '-x', '-c', 'echo hi'], { script: 'echo hi', judged: 'echo hi', homeWritten: false }],
    [['busybox', 'sh', '-c', 'echo hi'], { script: 'echo hi', judged: 'echo hi', homeWritten: false }],
    [['bash', '--unknown', '-c', 'echo hi'], { script: '--unknown -c echo hi', judged: undefined, homeWritten: false }],
    [['sh', '-c', 'x'.repeat(2001)], { script: 'x'.repeat(2001), judged: undefined, homeWritten: false }],
  ] as const;
  for (const [args, expected] of examples) assert.deepEqual(inline.FTr([...args]), expected);
  assert.equal(inline.FTr(['python', '-c', 'rm target']), undefined);
  for (const text of ['sh -c "rm target"', 'sh -c "alias z=rm; z target"']) {
    const parsed = E6(text, await w6(text));
    assert.equal(parsed.kind, 'simple');
    assert.equal(parsed.commands.length, 1);
    assert.equal(inline.FTr(parsed.commands[0].argv)?.script, text.slice(7, -1));
  }
});

test('source dangerous-removal recognition and safety decisions retain telemetry order', () => {
  const events: string[] = [];
  const inline = createShellInlineRecognition((name: string) => events.push(name));
  for (const text of ['rm target', 'command rm target', 'alias z=rm; z target', 'echo {rm,echo}']) {
    assert.equal(inline.Jcn(text), true);
    assert.equal(inline.Dwe(text), true);
  }
  for (const text of ['echo harmless', 'echo premium']) {
    assert.equal(inline.Jcn(text), false);
    assert.equal(inline.Dwe(text), false);
  }
  const unchecked = inline.Lwe(false, 0);
  assert.deepEqual(unchecked, { behavior: 'ask',
    message: 'This command passes a shell -c script that runs rm, and Claude Code could not check the script for dangerous removals. Approve only if you have read the script.',
    decisionReason: { type: 'safetyCheck', reason: 'This shell -c script runs rm and could not be checked',
      classifierApprovable: false, circuitBreaker: 'dangerousRemoval' }, suggestions: [] });
  assert.deepEqual(events, ['inline_shell_unchecked']);
  const denied = inline.Lwe(true, 1);
  assert.equal(denied.behavior, 'ask');
  assert.equal(denied.decisionReason.reason, 'A permission rule denies a command in this shell -c script');
  assert.equal(denied.decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.deepEqual(events, ['inline_shell_unchecked']);
});
