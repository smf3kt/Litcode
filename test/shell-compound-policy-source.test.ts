import assert from 'node:assert/strict';
import { test } from 'node:test';
import { w6 } from '../src/shell-command-clamp-source.js';
import { createShellCompoundPolicy } from '../src/shell-compound-policy-source.js';
import { vS } from '../src/bash-parser-source.js';

type Decision = { behavior: 'allow' | 'deny' | 'ask' | 'passthrough'; message?: string;
  decisionReason?: { type: string; reason?: string; circuitBreaker?: string }; suggestions?: string[] };
const context = { isNormalizedCdCommand: (text: string) => text.startsWith('cd '),
  isNormalizedGitCommand: (text: string) => text.startsWith('git ') };
function fixture(feature = false) {
  return createShellCompoundPolicy({ cd: () => feature, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: (_name: string, reason: { reason?: string }) => reason.reason ?? 'fixture approval' });
}

test('source compound policy preserves UTF-8 segment order, redirection stripping and denial', async () => {
  const compound = fixture();
  const input = { command: 'echo 雪 | cat > /fixture/out' };
  const visits: string[] = [];
  const allow: Decision = { behavior: 'allow', decisionReason: { type: 'other', reason: 'fixture' } };
  const deny: Decision = { behavior: 'deny', message: 'fixture deny' };
  const tree = await w6(input.command);
  const result = await compound.Rcn(input, async (value: { command: string }) => {
    visits.push(value.command); await Promise.resolve(); return value.command === 'cat' ? deny : allow;
  }, context, tree, undefined, undefined, undefined);
  assert.equal(result.behavior, 'deny');
  assert.equal(result.message, 'fixture deny');
  assert.deepEqual(visits, ['echo 雪', 'cat']);
  assert.equal(result.decisionReason.reasons.get('cat'), deny);
  visits.length = 0;
  const accepted = await compound.Rcn(input, async (value: { command: string }) => { visits.push(value.command); return allow; },
    context, tree, undefined, undefined, undefined);
  assert.equal(accepted.behavior, 'allow');
  assert.deepEqual(visits, ['echo 雪', 'cat']);
  assert.equal(accepted.updatedInput, input);
  const parsed = compound.z5e(input.command, tree);
  assert.deepEqual(parsed.getPipeSegments(), ['echo 雪', 'cat > /fixture/out']);
  assert.equal(parsed.withoutOutputRedirections(), 'echo 雪 | cat');
});

test('source compound policy retains group, incomplete and multiple-directory asks', async () => {
  const compound = fixture();
  const calls: string[] = [];
  const allow = async (value: { command: string }) => { calls.push(value.command); return { behavior: 'allow' }; };
  for (const command of ['(echo hi)', '{ echo hi; }']) {
    const answer = await compound.Rcn({ command }, allow, context, await w6(command), undefined, undefined, undefined);
    assert.equal(answer.behavior, 'ask');
    assert.equal(answer.decisionReason.bashMissKind, 'shell-operators');
  }
  assert.deepEqual(calls, []);
  const command = 'cd one | cd two';
  const result = await compound.Rcn({ command }, allow, context, await w6(command), undefined, undefined, undefined);
  assert.equal(result.behavior, 'ask');
  assert.equal(result.decisionReason.bashMissKind, 'multi-cd');
  assert.deepEqual(calls, ['cd one', 'cd two']);
  calls.length = 0;
  const noPipeline = await compound.Rcn({ command: 'echo ok; printf hi' }, allow, context,
    await w6('echo ok; printf hi'), undefined, undefined, undefined);
  assert.equal(noPipeline.behavior, 'passthrough');
  assert.deepEqual(calls, []);
  const failed = await compound.Rcn({ command: 'x'.repeat(10001) }, allow, context,
    await w6('x'.repeat(10001)), undefined, undefined, undefined);
  assert.equal(failed.behavior, 'passthrough');
  assert.equal(failed.message, 'Failed to parse command');
});

test('source compound policy preserves suggestion aggregation and duplicate segment identities', async () => {
  const compound = fixture(true);
  const command = 'echo hi | echo hi';
  const seen: string[] = [];
  const rule: Decision = { behavior: 'allow', decisionReason: { type: 'rule' } };
  const result = await compound.Rcn({ command }, async (input: { command: string }) => { seen.push(input.command); return rule; },
    context, await w6(command), undefined, undefined, undefined);
  assert.equal(result.behavior, 'allow');
  assert.deepEqual(seen, ['echo hi', 'echo hi']);
  assert.deepEqual([...result.decisionReason.reasons.keys()], ['echo hi', 'echo hi #2']);
  const pending = await fixture().Rcn({ command: 'echo hi | cat' }, async (input: { command: string }) =>
    input.command === 'cat' ? { behavior: 'ask', suggestions: ['fixture suggestion'] } : { behavior: 'allow' },
  context, await w6('echo hi | cat'), undefined, undefined, undefined);
  assert.equal(pending.behavior, 'ask');
  assert.deepEqual(pending.suggestions, ['fixture suggestion']);
});

test('fallback catches malformed trees and parser failures while supplied tree errors propagate', async () => {
  const compound = fixture();
  const parser = vS();
  const original = parser.parse;
  const allow = async () => ({ behavior: 'allow' });
  const malformed = { type: 'program', text: '', startIndex: 0, endIndex: 0, children: [undefined] };
  try {
    parser.parse = () => malformed;
    const fallback = await compound.Rcn({ command: 'malformed fixture' }, allow, context, undefined, undefined, undefined, undefined);
    assert.equal(fallback.behavior, 'passthrough');
    assert.equal(fallback.message, 'Failed to parse command');
    await assert.rejects(compound.Rcn({ command: 'supplied fixture' }, allow, context, malformed, undefined, undefined, undefined), TypeError);
    parser.parse = () => { throw new Error('actual parser failure'); };
    const failed = await compound.Rcn({ command: 'parser failure fixture' }, allow, context, undefined, undefined, undefined, undefined);
    assert.equal(failed.message, 'Failed to parse command');
  } finally {
    parser.parse = original;
  }
});

test('fallback handles failures while extracting assignment text', async () => {
  const parser = vS();
  const original = parser.parse;
  const assignment = { type: 'variable_assignment', children: [], get text(): string { throw new Error('fixture'); } };
  const command = { type: 'command', children: [assignment] };
  try {
    parser.parse = () => ({ type: 'program', text: '', startIndex: 0, endIndex: 0, children: [command] });
    const result = await fixture().Rcn({ command: 'assignment extraction fixture' }, async () => ({ behavior: 'allow' }),
      context, undefined, undefined, undefined, undefined);
    assert.equal(result.behavior, 'passthrough');
    assert.equal(result.message, 'Failed to parse command');
  } finally {
    parser.parse = original;
  }
});

test('concurrent fallback failures share the cached result until another command replaces it', async () => {
  const parser = vS();
  const original = parser.parse;
  const command = 'cache concurrency failure fixture';
  let parses = 0;
  try {
    parser.parse = (...args: Parameters<typeof original>) => {
      if (args[0] === command) {
        parses++;
        throw new Error('fixture parser failure');
      }
      return original(...args);
    };
    const run = (text: string) => fixture().Rcn({ command: text }, async () => ({ behavior: 'allow' }),
      context, undefined, undefined, undefined, undefined);
    const results = await Promise.all([run(command), run(command)]);
    assert.deepEqual(results.map((result: { message: string }) => result.message),
      ['Failed to parse command', 'Failed to parse command']);
    assert.equal(parses, 1);
    assert.equal((await run(command)).message, 'Failed to parse command');
    assert.equal(parses, 1);
    assert.equal((await run('printf cache-replacement')).message, 'No pipes found in command');
    assert.equal((await run(command)).message, 'Failed to parse command');
    assert.equal(parses, 2);
  } finally {
    parser.parse = original;
  }
});

test('repeated redirected pipeline segments share the last fallback parse across factories', async () => {
  const parser = vS();
  const original = parser.parse;
  const command = 'cat > cache-fixture | cat > cache-fixture';
  const tree = await w6(command);
  let parses = 0;
  try {
    parser.parse = (...args: Parameters<typeof original>) => {
      if (args[0] === 'cat > cache-fixture') parses++;
      return original(...args);
    };
    for (const compound of [fixture(), fixture()]) {
      const result = await compound.Rcn({ command }, async () => ({ behavior: 'allow' }), context, tree, undefined, undefined, undefined);
      assert.equal(result.behavior, 'allow');
    }
    assert.equal(parses, 1);
  } finally {
    parser.parse = original;
  }
});
