import assert from 'node:assert/strict';
import { test } from 'node:test';
import { w6 } from '../src/shell-command-clamp-source.js';
import { createShellCompoundPolicy } from '../src/shell-compound-policy-source.js';

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
