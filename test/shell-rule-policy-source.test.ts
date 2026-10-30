import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { uNe } from '../src/plan-deny-source.js';
import { E6 } from '../src/shell-analyser-source.js';
import { w6 } from '../src/shell-command-clamp-source.js';

type State = { alwaysAllowRules: Record<string, string[]>; alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]> };
const state = (allow: string[] = [], deny: string[] = [], ask: string[] = []): State => ({
  alwaysAllowRules: { session: allow }, alwaysDenyRules: { userSettings: deny }, alwaysAskRules: { session: ask },
});
const store = createShellRuleStore((value: State) => uNe(value.alwaysAllowRules, 'allow'));
const policy = createShellRulePolicy(store.dA, () => 'fixture approval', (command: string) => [command]);
async function commands(command: string) {
  const parsed = E6(command, await w6(command));
  assert.equal(parsed.kind, 'simple');
  return parsed.commands;
}

test('source early rule checks preserve exact and prefix priority', async () => {
  const input = { command: 'printf exact' };
  const exactAsk = state([], ['Bash(printf:*)'], ['Bash(printf exact)']);
  const exact = policy.Uwe(input, exactAsk);
  assert.equal(exact.behavior, 'ask');
  assert.ok('rule' in exact.decisionReason);
  assert.deepEqual(exact.decisionReason.rule, { source: 'session', ruleBehavior: 'ask',
    ruleValue: { toolName: 'Bash', ruleContent: 'printf exact' } });
  const prefix = policy.Vcn(input, exactAsk);
  assert.ok(prefix);
  assert.equal(prefix.behavior, 'deny');
  assert.ok('rule' in prefix.decisionReason);
  assert.equal(prefix.decisionReason.rule.ruleValue.ruleContent, 'printf:*');
  assert.equal(policy.GTr(input, exactAsk, await commands(input.command))?.behavior, 'deny');
  const inputAllow = { command: 'echo ok' };
  const allow = state(['Bash(echo ok)']);
  for (const result of [policy.Uwe(inputAllow, allow), policy.Vcn(inputAllow, allow),
    policy.GTr(inputAllow, allow, await commands(inputAllow.command))]) {
    assert.ok(result);
    assert.equal(result.behavior, 'allow');
    assert.equal(result.updatedInput, inputAllow);
    assert.ok('rule' in result.decisionReason);
    assert.equal(result.decisionReason.rule.source, 'session');
  }
  const ask = policy.Vcn(inputAllow, state([], [], ['Bash(echo:*)']));
  assert.ok(ask);
  assert.equal(ask.behavior, 'ask');
  assert.ok('rule' in ask.decisionReason);
  assert.equal(ask.decisionReason.rule.ruleValue.ruleContent, 'echo:*');
  assert.equal(policy.GTr(inputAllow, state([], [], ['Bash(echo:*)']), await commands(inputAllow.command))?.behavior, 'ask');
  const none = policy.Uwe(inputAllow, state());
  assert.equal(none.behavior, 'passthrough');
  assert.deepEqual(none.suggestions, ['echo ok']);
  assert.equal(policy.Vcn(inputAllow, state()), null);
  assert.equal(policy.GTr(inputAllow, state(['Bash(echo:*)']), await commands(inputAllow.command)), null);
  assert.equal(policy.Vcn(inputAllow, state(['Bash(echo:*)'])), null);

  for (const [askRules, expectedPrefix] of [
    [['Bash(echo ok)', 'Bash(echo:*)'], 'echo ok'],
    [['Bash(echo:*)', 'Bash(echo ok)'], 'echo:*'],
  ] as const) {
    const bothAsks = state([], [], [...askRules]);
    const exactFirst = policy.Uwe(inputAllow, bothAsks);
    const prefixFirst = policy.Vcn(inputAllow, bothAsks);
    assert.ok('rule' in exactFirst.decisionReason);
    assert.ok(prefixFirst && 'rule' in prefixFirst.decisionReason);
    assert.equal(exactFirst.decisionReason.rule.ruleValue.ruleContent, 'echo ok');
    assert.equal(prefixFirst.decisionReason.rule.ruleValue.ruleContent, expectedPrefix);
  }

  const selected = store.dA(inputAllow, allow, 'exact').matchingAllowRules[0];
  const identityPolicy = createShellRulePolicy(() => ({ matchingDenyRules: [], matchingAskRules: [],
    matchingAllowRules: [selected] }), () => 'fixture approval', () => []);
  const identity = identityPolicy.Uwe(inputAllow, allow);
  assert.ok('rule' in identity.decisionReason);
  assert.equal(identity.decisionReason.rule, selected);
});

test('source semantic recheck retains analysed subcommand deny over an exact line allow', async () => {
  const input = { command: 'echo ok; printf x' };
  const rules = state(['Bash(echo ok; printf x)'], ['Bash(printf:*)']);
  const analysed = await commands(input.command);
  assert.equal(policy.Uwe(input, rules).behavior, 'allow');
  assert.equal(policy.Vcn(input, rules)?.behavior, 'allow');
  const result = policy.GTr(input, rules, analysed);
  assert.ok(result);
  assert.equal(result.behavior, 'deny');
  assert.ok('rule' in result.decisionReason);
  assert.deepEqual(result.decisionReason.rule, { source: 'userSettings', ruleBehavior: 'deny',
    ruleValue: { toolName: 'Bash', ruleContent: 'printf:*' } });
  assert.equal(result.message, `Permission to use Bash with command ${input.command} has been denied.`);
  const spaced = { command: '  echo ok; printf x  ' };
  const askRules = state([], ['Bash(printf:*)'], ['Bash(echo ok; printf x)']);
  assert.equal(policy.Uwe(spaced, askRules).behavior, 'ask');
  const denied = policy.GTr(spaced, askRules, await commands(spaced.command));
  assert.ok(denied);
  assert.equal(denied.behavior, 'deny');
  assert.equal(denied.message, 'Permission to use Bash with command   echo ok; printf x   has been denied.');
});
