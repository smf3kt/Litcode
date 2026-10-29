import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellRuleRecheck } from '../src/shell-rule-recheck-source.js';
import { xX } from '../src/shell-rule-matcher-source.js';

type Behavior = 'allow' | 'ask' | 'deny';
type Rule = { source: string; ruleBehavior: Behavior; ruleValue: { toolName: string; ruleContent: string } };
type Context = { allow: Map<string, Rule>; ask: Map<string, Rule>; deny: Map<string, Rule> };
type Input = { command: string; marker?: string };
const rule = (behavior: Behavior, content: string): Rule => ({ source: 'session', ruleBehavior: behavior,
  ruleValue: { toolName: 'Bash', ruleContent: content } });
const context = (ask: Rule[] = [], deny: Rule[] = []): Context => ({ allow: new Map(),
  ask: new Map(ask.map(value => [value.ruleValue.ruleContent, value])),
  deny: new Map(deny.map(value => [value.ruleValue.ruleContent, value])) });
const gre = (state: Context, tool: { name: string }, behavior: 'ask' | 'deny') => {
  assert.equal(tool.name, 'Bash');
  return state[behavior];
};
const dA = (input: Input, state: Context, mode: 'prefix') => {
  const denyOptions = { stripAllEnvVars: true, skipCompoundCheck: true, ruleBehavior: 'deny' };
  const askOptions = { stripAllEnvVars: true, skipCompoundCheck: true, ruleBehavior: 'ask' };
  return { matchingDenyRules: xX(input, state.deny, mode, denyOptions),
    matchingAskRules: xX(input, state.ask, mode, askOptions) };
};
const recheck = createShellRuleRecheck(gre, dA);

test('source recheck preserves hard decisions and upgrades a soft ask on a matching deny', () => {
  const ask = rule('ask', 'echo:*');
  const deny = rule('deny', 'rm:*');
  const state = context([ask], [deny]);
  const input = { command: 'echo ok; timeout 2s rm target', marker: 'unchanged' };
  for (const decision of [
    { behavior: 'allow' },
    { behavior: 'deny' },
    { behavior: 'passthrough' },
    { behavior: 'ask', decisionReason: { type: 'rule', rule: ask } },
    { behavior: 'ask', matchedAskRule: ask },
    { behavior: 'ask', decisionReason: { type: 'subcommandResults', reasons: new Map([
      ['echo ok', { behavior: 'ask', decisionReason: { type: 'rule', rule: ask } }],
    ]) } },
  ]) assert.equal(recheck(decision, input, state), decision);
  const soft = { behavior: 'ask', message: 'fixture', decisionReason: { type: 'other', reason: 'fixture' } };
  const result = recheck(soft, input, state);
  assert.deepEqual(result, { behavior: 'deny', message: `Permission to use Bash with command ${input.command} has been denied.`,
    decisionReason: { type: 'rule', rule: deny } });
  assert.equal(result.decisionReason.rule, deny);
  assert.deepEqual(input, { command: 'echo ok; timeout 2s rm target', marker: 'unchanged' });
  assert.deepEqual(soft, { behavior: 'ask', message: 'fixture', decisionReason: { type: 'other', reason: 'fixture' } });
  assert.equal(recheck(soft, { command: 'echo ok' }, context()), soft);
  assert.equal(recheck(soft, { command: 'printf ok' }, state), soft);
  const matched = recheck(soft, { command: 'echo ok' }, context([ask]));
  assert.equal(matched.behavior, 'ask');
  assert.equal(matched.matchedAskRule, ask);
  assert.equal(matched.decisionReason, soft.decisionReason);
  const earlier = rule('ask', 'echo:*');
  const later = rule('ask', 'printf:*');
  const multipleState = context([earlier, later]);
  const candidates: string[] = [];
  const multipleRecheck = createShellRuleRecheck(gre, (candidate: Input, actual: Context, mode: 'prefix') => {
    const result = dA(candidate, actual, mode);
    if (result.matchingAskRules.length) candidates.push(candidate.command);
    return result;
  });
  const multiple = multipleRecheck(soft, { command: 'echo ok; printf later' }, multipleState);
  assert.deepEqual(candidates, ['echo ok; printf later', 'echo ok', 'printf later']);
  assert.equal(multiple.matchedAskRule, earlier);
  const stronger = recheck(soft, { command: 'echo ok; printf later; rm target' }, context([earlier, later], [deny]));
  assert.equal(stronger.behavior, 'deny');
  assert.equal(stronger.decisionReason.rule, deny);
});

test('source recheck visits nested and recorded candidates in order within the source budget', () => {
  const ask = rule('ask', 'echo:*');
  const deny = rule('deny', 'rm:*');
  const state = context([ask], [deny]);
  const soft = { behavior: 'ask', decisionReason: { type: 'other', reason: 'fixture' } };
  const nested = recheck(soft, { command: 'echo $(rm target)' }, state);
  assert.equal(nested.behavior, 'deny');
  assert.equal(nested.decisionReason.rule, deny);
  const calls: string[] = [];
  const observe = createShellRuleRecheck(gre, (input: Input, actual: Context, mode: 'prefix') => {
    assert.equal(actual, state);
    assert.equal(mode, 'prefix');
    assert.equal(input.marker, 'fixture');
    calls.push(input.command);
    return { matchingDenyRules: [], matchingAskRules: [] };
  });
  const recorded = { behavior: 'ask', decisionReason: { type: 'subcommandResults', reasons: new Map([
    ['printf recorded', { behavior: 'allow' }],
  ]) } };
  assert.equal(observe(recorded, { command: 'echo $(rm target)', marker: 'fixture' }, state), recorded);
  assert.deepEqual(calls, ['echo $(rm target)', 'printf recorded', 'rm target']);
  for (const [command, candidates] of [
    ['echo ${ | rm target; }', ['echo ${ | rm target; }', 'rm target']],
    ['echo ${ | rm target', ['echo ${ | rm target', 'rm target']],
    ['echo ok > target; printf hi', ['echo ok > target; printf hi', 'echo ok', 'printf hi']],
  ] as const) {
    calls.length = 0;
    assert.equal(observe(soft, { command, marker: 'fixture' }, state), soft);
    assert.deepEqual(calls, candidates);
  }
  for (const length of [10000, 10001]) {
    const command = ' '.repeat(length - 8) + 'echo end';
    calls.length = 0;
    assert.equal(observe(soft, { command, marker: 'fixture' }, state), soft);
    assert.deepEqual(calls, length === 10000 ? [command, 'echo end'] : [command]);
  }
  for (const depth of [16, 17]) {
    let command = 'rm target';
    for (let index = 0; index < depth; index++) command = 'echo ${ ' + command + '; }';
    calls.length = 0;
    assert.equal(observe(soft, { command, marker: 'fixture' }, state), soft);
    assert.equal(calls.includes('rm target'), depth === 16);
    assert.equal(calls.length, depth === 16 ? 17 : 1);
  }
  for (const length of [2034, 2035]) {
    const inner = 'a'.repeat(length);
    let command = inner;
    for (let index = 0; index < 15; index++) command = 'echo ${ ' + command + '; }';
    calls.length = 0;
    assert.equal(observe(soft, { command, marker: 'fixture' }, state), soft);
    assert.equal(calls.includes(inner), length === 2034);
    assert.equal(calls.length, length === 2034 ? 16 : 1);
  }
});
