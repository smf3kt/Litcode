import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vS } from '../src/bash-parser-source.js';
import { E6 } from '../src/shell-analyser-source.js';
import { gyr } from '../src/shell-semantics-source.js';

function semantics(command: string) {
  const tree = vS().parse(command, undefined);
  assert.ok(tree);
  const analysis = E6(command, tree);
  assert.equal(analysis.kind, 'simple');
  return gyr(analysis.commands, { sourceGlobRecord: true });
}

test('source semantics evaluates parsed wrappers and shell command forms', () => {
  assert.deepEqual(semantics('echo hello'), { ok: true });
  assert.deepEqual(semantics('timeout 2s echo hello'), { ok: true });
  assert.deepEqual(semantics('timeout oops echo hello'),
    { ok: false, reason: "timeout duration 'oops' can't be checked before it runs" });
  assert.deepEqual(semantics('find . -rm'),
    { ok: false, reason: "find with '-rm' executes commands or modifies files — cannot be auto-allowed by a Bash(find:*) prefix rule" });
  assert.deepEqual(semantics('xargs find .'),
    { ok: false, reason: "What xargs adds to find can't be checked before it runs" });
});

test('source semantics retains newline-hash evidence and immediate failure precedence', () => {
  const command = (argv: string[], envVars: { name: string; value: string }[] = [], redirects: { target: string; op: string }[] = []) =>
    ({ argv, envVars, redirects, text: argv.join(' ') });
  const arg = command(['printf', 'x\n#y']);
  const env = command(['echo'], [{ name: 'A', value: 'x\n#y' }]);
  const redirect = command(['echo'], [], [{ target: 'x\n#y', op: '>' }]);
  assert.deepEqual(gyr([arg], { sourceGlobRecord: true }), { ok: false, kind: 'newline-hash',
    reason: 'Newline followed by # inside a quoted argument can hide arguments from path validation' });
  assert.deepEqual(gyr([env], { sourceGlobRecord: true }), { ok: false, kind: 'newline-hash',
    reason: 'Newline followed by # inside an env var value can hide arguments from path validation' });
  assert.deepEqual(gyr([redirect], { sourceGlobRecord: true }), { ok: false, kind: 'newline-hash',
    reason: 'Newline followed by # inside a redirect target can hide arguments from path validation' });
  assert.deepEqual(gyr([arg, command(['timeout', 'oops', 'echo'])], { sourceGlobRecord: true }),
    { ok: false, reason: "timeout duration 'oops' can't be checked before it runs" });
  const globReason = 'find contains unquoted glob characters — could glob-expand to a dangerous action before find runs';
  const globTree = vS().parse('find . -name *.txt', undefined);
  assert.ok(globTree);
  const globAnalysis = E6('find . -name *.txt', globTree);
  assert.equal(globAnalysis.kind, 'simple');
  assert.equal(globAnalysis.commands[0].hasUnquotedGlob, true);
  assert.deepEqual(globAnalysis.commands[0].argvUnquotedGlob, [false, false, false, true]);
  for (const sourceGlobRecord of [true, false]) {
    assert.deepEqual(gyr(globAnalysis.commands, { sourceGlobRecord }), { ok: false, reason: globReason });
  }
  assert.deepEqual(semantics('find . -name "*.txt"'), { ok: true });
  // This synthetic command isolates the per-argument sourceGlobRecord branch.
  const syntheticGlob = { ...globAnalysis.commands[0], hasUnquotedGlob: false };
  assert.deepEqual(gyr([syntheticGlob], { sourceGlobRecord: true }), { ok: false, reason: globReason });
  assert.deepEqual(gyr([syntheticGlob], { sourceGlobRecord: false }), { ok: true });
});
