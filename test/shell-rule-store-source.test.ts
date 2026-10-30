import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { uNe } from '../src/plan-deny-source.js';
import { createShellRuleRecheck } from '../src/shell-rule-recheck-source.js';

const sourceOrder = ['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings',
  'cliArg', 'command', 'session', 'toolsNarrowing', 'mcpServerPolicy', 'hostCredential'];
type State = { alwaysAllowRules: Record<string, string[]>; alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]> };
const entries = (rules: unknown[]) => rules.map(rule => {
  assert.ok(rule && typeof rule === 'object' && 'source' in rule && 'ruleValue' in rule);
  assert.ok(rule.ruleValue && typeof rule.ruleValue === 'object' && 'ruleContent' in rule.ruleValue);
  return [rule.source, rule.ruleValue.ruleContent];
});

test('source rule store retains source order and the later duplicate rule', () => {
  const rules = Object.fromEntries([...sourceOrder].reverse().map(source => [source, ['Bash(printf:*)']]));
  const state: State = { alwaysAllowRules: {}, alwaysDenyRules: rules, alwaysAskRules: {} };
  let allowSelections = 0;
  const store = createShellRuleStore((value: State) => { allowSelections++; return uNe(value.alwaysAllowRules, 'allow'); });
  const expected = sourceOrder.map(source => [source, 'printf:*']);
  assert.deepEqual(entries(uNe(state.alwaysDenyRules, 'deny')), expected);
  const deny = store.Gre(state, { name: 'Bash' }, 'deny');
  assert.deepEqual([...deny].map(([content, rule]) => [content, rule.source]), [['printf:*', 'hostCredential']]);
  state.alwaysDenyRules = { userSettings: ['Bash(printf:*)', 'Bash(echo:*)'],
    projectSettings: ['Bash(printf:*)'] };
  assert.deepEqual([...store.Gre(state, { name: 'Bash' }, 'deny')].map(([content, rule]) => [content, rule.source]),
    [['printf:*', 'projectSettings'], ['echo:*', 'userSettings']]);
  assert.equal(store.Gre(state, { name: 'Read' }, 'deny').size, 0);
  assert.equal(store.Gre(state, { name: 'Bash' }, 'ask').size, 0);
  assert.equal(allowSelections, 0);
  assert.equal(store.Gre(state, { name: 'Bash' }, 'allow').size, 0);
  assert.equal(allowSelections, 1);
});

test('source rule store matches exact and prefix rules across all behaviors', () => {
  const state: State = { alwaysAllowRules: { userSettings: ['Bash(printf:*)', 'Bash(printf exact)'] },
    alwaysDenyRules: { userSettings: ['Bash(printf:*)', 'Bash(printf exact)'],
      toolsNarrowing: ['Bash(printf:*)'] },
    alwaysAskRules: { session: ['Bash(printf:*)', 'Bash(printf exact)'] } };
  const selected = uNe(state.alwaysAllowRules, 'allow');
  const store = createShellRuleStore((value: State) => { assert.equal(value, state); return selected; });
  const exact = store.dA({ command: 'printf exact' }, state, 'exact');
  assert.deepEqual(entries(exact.matchingDenyRules), [['userSettings', 'printf exact']]);
  assert.deepEqual(entries(exact.matchingAskRules), [['session', 'printf exact']]);
  assert.deepEqual(entries(exact.matchingAllowRules), [['userSettings', 'printf exact']]);
  assert.equal(exact.matchingAllowRules[0], selected[1]);
  for (const command of ['printf ok', 'command printf ok']) {
    const result = store.dA({ command }, state, 'prefix');
    assert.deepEqual(entries(result.matchingDenyRules), [['toolsNarrowing', 'printf:*']]);
    assert.deepEqual(entries(result.matchingAskRules), [['session', 'printf:*']]);
    assert.deepEqual(entries(result.matchingAllowRules), [['userSettings', 'printf:*']]);
    assert.equal(result.matchingAllowRules[0], selected[0]);
  }
  for (const command of ['env A=1 printf ok', 'printf exact; echo hi']) {
    const result = store.dA({ command }, state, 'prefix');
    assert.deepEqual(entries(result.matchingDenyRules), [['toolsNarrowing', 'printf:*']]);
    assert.deepEqual(entries(result.matchingAskRules), [['session', 'printf:*']]);
    assert.deepEqual(result.matchingAllowRules, []);
  }
  const filtered = createShellRuleStore(() => [selected[1]]);
  assert.deepEqual(filtered.dA({ command: 'printf ok' }, state, 'prefix').matchingAllowRules, []);
  assert.equal(filtered.dA({ command: 'printf exact' }, state, 'exact').matchingAllowRules[0], selected[1]);
  const recheck = createShellRuleRecheck(store.Gre, store.dA);
  const result = recheck({ behavior: 'ask', decisionReason: { type: 'other', reason: 'fixture' } },
    { command: 'echo ok; command printf ok' }, state);
  assert.equal(result.behavior, 'deny');
  assert.deepEqual(result.decisionReason.rule, { source: 'toolsNarrowing', ruleBehavior: 'deny',
    ruleValue: { toolName: 'Bash', ruleContent: 'printf:*' } });
});
