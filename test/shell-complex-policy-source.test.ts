import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vS } from '../src/bash-parser-source.js';
import { createShellComplexPolicy } from '../src/shell-complex-policy-source.js';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { TVt } from '../src/shell-rule-suggestions-source.js';
import { Yx, E6 } from '../src/shell-analyser-source.js';
import { w6 } from '../src/shell-command-clamp-source.js';
import { uNe } from '../src/plan-deny-source.js';

type State = { alwaysAllowRules: Record<string, string[]>; alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]> };
const state = (allow: string[] = [], deny: string[] = [], ask: string[] = []): State => ({
  alwaysAllowRules: { session: allow }, alwaysDenyRules: { userSettings: deny }, alwaysAskRules: { session: ask },
});
const store = createShellRuleStore((value: State) => uNe(value.alwaysAllowRules, 'allow'));
const rules = createShellRulePolicy(store.dA, () => 'fixture approval', TVt);

test('complex parse checks nested denial before read block and removal callbacks', async () => {
  const calls: string[] = [];
  const removal = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'removal' } };
  const blocked = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'read block' } };
  const danger = { target: 'fixture' };
  let removalInput: object | null = null;
  let nestedResult: object | null = null;
  const source = createShellComplexPolicy({ ...rules, ...store,
    $3e: () => { calls.push('danger'); return removalInput; },
    dO: (_event: string, detail: { kind: string }) => { calls.push(`telemetry:${detail.kind}`); },
    d: (kind: string) => kind, pwe: () => { calls.push('message'); return removal; },
    Xcn: async () => { calls.push('nested'); return nestedResult; },
    se: () => { calls.push('cwd'); return '/fixture'; },
    jcn: () => { throw new Error('unexpected single policy'); },
  });
  const invoke = (command: string, value: State, tree: unknown, gate?: () => object) =>
    source.MTr({ command }, value, tree, gate, undefined, false, undefined, undefined);
  const nested = 'echo $(printf denied)';
  const tree = await w6(nested);
  const deny = await invoke(nested, state([], ['Bash(printf:*)']), tree, () => { calls.push('read-block'); return blocked; });
  assert.equal(deny.behavior, 'deny');
  assert.equal(deny.decisionReason.rule.ruleValue.ruleContent, 'printf:*');
  assert.equal(calls.length, 0);
  assert.equal(await invoke(nested, state(), tree, () => { calls.push('read-block'); return blocked; }), blocked);
  assert.deepEqual(calls.splice(0), ['read-block']);
  removalInput = danger;
  assert.equal(await invoke(nested, state(), tree), removal);
  assert.deepEqual(calls.splice(0), ['danger', 'telemetry:emptyVariable', 'message']);
  removalInput = null;
  nestedResult = { kind: 'fixture-nested', result: removal };
  assert.equal(await invoke(nested, state(), tree), removal);
  assert.deepEqual(calls.splice(0), ['danger', 'cwd', 'nested', 'telemetry:fixture-nested']);
  nestedResult = null;
  const literal = { command: 'echo $(printf ok)' };
  const allowed = await source.MTr(literal, state(['Bash(echo $(printf ok))']), tree,
    undefined, undefined, false, undefined, undefined);
  assert.equal(allowed.behavior, 'allow');
  assert.equal(allowed.updatedInput, literal);
  assert.deepEqual(calls.splice(0), ['danger', 'cwd', 'nested']);
  assert.equal(await invoke(nested, state(['Bash(echo:*)']), Yx), null);
  assert.deepEqual(calls.splice(0), ['danger']);
  const parser = vS();
  const parse = parser.parse;
  try {
    parser.parse = () => { throw new Error('fixture parse failure'); };
    await assert.rejects(invoke('echo ok', state([], ['Bash(printf:*)']), Yx), /fixture parse failure/);
    assert.equal(calls.length, 0);
  } finally {
    parser.parse = parse;
  }
});

test('complex fallback preserves rule priority, single result and source suggestions', async () => {
  const calls: string[] = [];
  const single = { behavior: 'passthrough', message: 'single fixture' };
  let result: object = single;
  const source = createShellComplexPolicy({ ...rules, ...store,
    $3e: () => null, dO: () => {}, d: (kind: string) => kind, pwe: () => ({}),
    Xcn: async () => null, se: () => '/fixture',
    jcn: () => { calls.push('single'); return result; },
  });
  const input = { command: 'echo ok' };
  const invoke = (value: State, prefix?: { commandPrefix: string }) =>
    source.Mcn(input, value, prefix, false, undefined, '/fixture', [], undefined);
  const denied = await invoke(state([], ['Bash(echo ok)']));
  assert.equal(denied.behavior, 'deny');
  assert.deepEqual(calls, []);
  const asked = await invoke(state([], [], ['Bash(echo ok)']));
  assert.equal(asked.behavior, 'ask');
  assert.deepEqual(calls, []);
  const allow = { behavior: 'allow', updatedInput: input };
  result = allow;
  assert.equal(await invoke(state()), allow);
  assert.deepEqual(calls.splice(0), ['single']);
  result = single;
  const prefix = await invoke(state(), { commandPrefix: 'echo' });
  assert.deepEqual(prefix.suggestions, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'echo *' }],
    behavior: 'allow', destination: 'localSettings' }]);
  const fallback = await invoke(state());
  assert.deepEqual(fallback.suggestions, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'echo ok *' }],
    behavior: 'allow', destination: 'localSettings' }]);
  assert.deepEqual(calls, ['single', 'single']);
});

test('source cwd projection removes only a verified literal cd to the current directory', async () => {
  const source = createShellComplexPolicy({ ...rules, ...store,
    $3e: () => null, dO: () => {}, d: (kind: string) => kind, pwe: () => ({}),
    Xcn: async () => null, se: () => '/fixture', jcn: () => ({ behavior: 'passthrough' }),
  });
  const texts = ['cd /fixture', 'echo ok'];
  const parsed = E6(texts.join('; '), await w6(texts.join('; ')));
  assert.equal(parsed.kind, 'simple');
  const projected = source.RTr(texts, parsed.commands, '/fixture', '/other');
  assert.deepEqual(projected.subcommands, ['echo ok']);
  assert.equal(projected.astCommandsByIdx[0], parsed.commands[1]);
  const unsafe = source.RTr(['cd /fixture space', 'echo ok'], [{ ...parsed.commands[0], argv: ['cd', '/fixture space'] }, parsed.commands[1]], '/fixture space', '/other');
  assert.deepEqual(unsafe.subcommands, ['cd /fixture space', 'echo ok']);
  const redirected = source.RTr(texts, [{ ...parsed.commands[0], redirects: [{}] }, parsed.commands[1]], '/fixture', '/other');
  assert.deepEqual(redirected.subcommands, texts);
});
