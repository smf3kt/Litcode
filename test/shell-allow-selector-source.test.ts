import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellAllowSelector } from '../src/shell-allow-selector-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';

const rules = {
  hostCredential: ['Bash(host:*)'],
  mcpServerPolicy: ['Bash(mcp:*)'],
  toolsNarrowing: ['Bash(narrow:*)'],
  session: ['Edit', 'Bash(session:*)'],
  command: ['Bash(command:*)'],
  cliArg: ['Edit', 'Read', 'Bash(cli:*)'],
  projectSettings: ['Bash(project:*)'],
  userSettings: ['Bash(safe:*)', 'Bash(danger:*)', 'Read', 'Edit'],
};
const state = (mode: string, servedCall = false) => ({ mode, servedCall, alwaysAllowRules: rules,
  alwaysDenyRules: {}, alwaysAskRules: {} });
const rows = (selected: { source: string; ruleValue: { toolName: string; ruleContent?: string } }[]) =>
  selected.map(({ source, ruleValue }) => [source, ruleValue.toolName, ruleValue.ruleContent ?? null]);
const expectedDefault = [
  ['userSettings', 'Bash', 'safe:*'], ['userSettings', 'Bash', 'danger:*'],
  ['projectSettings', 'Bash', 'project:*'], ['cliArg', 'Edit', null], ['cliArg', 'Read', null],
  ['cliArg', 'Bash', 'cli:*'], ['command', 'Bash', 'command:*'], ['session', 'Edit', null],
  ['session', 'Bash', 'session:*'], ['toolsNarrowing', 'Bash', 'narrow:*'],
  ['mcpServerPolicy', 'Bash', 'mcp:*'], ['hostCredential', 'Bash', 'host:*'],
];
const expectedAuto = [
  ['userSettings', 'Bash', 'safe:*'], ['projectSettings', 'Bash', 'project:*'],
  ['cliArg', 'Edit', null], ['cliArg', 'Bash', 'cli:*'], ['command', 'Bash', 'command:*'],
  ['session', 'Edit', null], ['session', 'Bash', 'session:*'], ['toolsNarrowing', 'Bash', 'narrow:*'],
  ['mcpServerPolicy', 'Bash', 'mcp:*'], ['hostCredential', 'Bash', 'host:*'],
];

function selector(active: boolean, confined: boolean) {
  return createShellAllowSelector(() => active,
    (name: string, content: string | undefined) => name === 'Bash' && content === 'danger:*',
    (name: string) => name === 'Read', (name: string) => name === 'Read' || name === 'Edit', confined);
}

test('source allow selector applies mode filters and source exceptions in source order', () => {
  const select = selector(true, false);
  const snapshot = structuredClone(rules);
  assert.deepEqual(rows(select(state('default'))), expectedDefault);
  assert.deepEqual(rows(select(state('auto'))), expectedAuto);
  assert.deepEqual(rows(select(state('plan'))), expectedAuto);
  assert.deepEqual(rows(select(state('plan', true))), expectedDefault);
  assert.deepEqual(rows(selector(false, false)(state('plan'))), expectedDefault);
  assert.deepEqual(rules, snapshot);

  let activeCalls = 0;
  const counted = createShellAllowSelector(() => { activeCalls++; return true; }, () => false,
    () => false, () => false, false);
  counted(state('auto'));
  counted(state('default'));
  counted(state('plan', true));
  assert.equal(activeCalls, 0);
  counted(state('plan'));
  assert.equal(activeCalls, 1);
});

test('source confinement keeps only cliArg and filters it in auto mode', () => {
  const confined = selector(true, true);
  const unrestricted = selector(true, false);
  assert.deepEqual(rows(confined(state('default'))), [
    ['cliArg', 'Edit', null], ['cliArg', 'Read', null], ['cliArg', 'Bash', 'cli:*'],
  ]);
  assert.deepEqual(rows(confined(state('auto'))), [['cliArg', 'Edit', null], ['cliArg', 'Bash', 'cli:*']]);
  assert.deepEqual(rows(unrestricted(state('auto'))), expectedAuto);
  assert.deepEqual(rows(confined(state('plan', true))), [
    ['cliArg', 'Edit', null], ['cliArg', 'Read', null], ['cliArg', 'Bash', 'cli:*'],
  ]);
  const empty = { ...state('auto'), alwaysAllowRules: { userSettings: ['Bash(safe:*)'] } };
  assert.deepEqual(confined(empty), []);
});

test('source rule store consumes selected allow rules without changing their identity', () => {
  const fixture = state('auto');
  const selected = selector(false, false)(fixture);
  const store = createShellRuleStore((value: typeof fixture) => { assert.equal(value, fixture); return selected; });
  const safe = store.dA({ command: 'safe arg' }, fixture, 'prefix');
  const dangerous = store.dA({ command: 'danger arg' }, fixture, 'prefix');
  assert.equal(safe.matchingAllowRules.length, 1);
  assert.deepEqual(safe.matchingAllowRules[0], {
    source: 'userSettings', ruleBehavior: 'allow', ruleValue: { toolName: 'Bash', ruleContent: 'safe:*' },
  });
  assert.equal(safe.matchingAllowRules[0], selected[0]);
  assert.deepEqual(dangerous.matchingAllowRules, []);
});
