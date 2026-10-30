import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TVt } from '../src/shell-rule-suggestions-source.js';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { uNe } from '../src/plan-deny-source.js';
import { permissionUpdateListSchema } from '../src/permissions.js';

test('source Shell suggestions preserve prefix and exact update shapes', () => {
  for (const [command, content] of [
    ['git status', 'git status *'],
    ['git status --short', 'git status *'],
    ['git status\necho hi', 'git status *'],
    ['git status <<EOF\nhello\nEOF', 'git status *'],
    ['printf <<EOF', 'printf *'],
    ['<<EOF', '<<EOF'],
    ['LANG=C git status', 'git status *'],
    ['command git status', 'command git status'],
    ['CUSTOM=1 git status', 'CUSTOM=1 git status'],
    ['printf "a b"', 'printf "a b"'],
    ['bash -c echo', 'bash -c echo'],
    ['', ''],
  ] as const) {
    const result = TVt(command);
    assert.deepEqual(result, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: content }],
      behavior: 'allow', destination: 'localSettings' }]);
    assert.equal(permissionUpdateListSchema.safeParse(result).success, true);
  }
});

test('source early-rule passthrough carries the generated suggestion', () => {
  const state = { alwaysAllowRules: {}, alwaysDenyRules: {}, alwaysAskRules: {} };
  const store = createShellRuleStore((value: typeof state) => uNe(value.alwaysAllowRules, 'allow'));
  const policy = createShellRulePolicy(store.dA, () => 'fixture approval', TVt);
  const result = policy.Uwe({ command: 'git status' }, state);
  assert.equal(result.behavior, 'passthrough');
  assert.deepEqual(result.suggestions, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'git status *' }],
    behavior: 'allow', destination: 'localSettings' }]);
});
