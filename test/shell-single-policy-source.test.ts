import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellSinglePolicy } from '../src/shell-single-policy-source.js';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { TVt } from '../src/shell-rule-suggestions-source.js';
import { uNe } from '../src/plan-deny-source.js';
import { E6 } from '../src/shell-analyser-source.js';
import { w6 } from '../src/shell-command-clamp-source.js';

const state = (allow: string[] = [], deny: string[] = [], ask: string[] = [], readBlock = false) => ({
  alwaysAllowRules: { session: allow }, alwaysDenyRules: { userSettings: deny },
  alwaysAskRules: { projectSettings: ask }, blockReadsOutsideWorkingDirectories: readBlock,
});
type State = ReturnType<typeof state>;
type Outcome = { behavior: 'allow' | 'deny' | 'ask' | 'passthrough';
  decisionReason?: { type: string; reason?: string }; bashAllowRuleOverridable?: boolean; message?: string };
type Fixture = {
  path?: Outcome; safety?: Outcome; mode?: Outcome; nested?: Outcome; unsafeEnv?: boolean;
  readOnly?: boolean; exemption?: boolean; outsideRead?: boolean; cwd?: string;
  skipReadOnly?: boolean; readOnlyCommand?: boolean; transformed?: boolean; unsafeAssignment?: boolean;
};
const passthrough: Outcome = { behavior: 'passthrough' };
const approval = () => 'fixture approval';
const store = createShellRuleStore((value: State) => uNe(value.alwaysAllowRules, 'allow'));
const rules = createShellRulePolicy(store.dA, approval, TVt);

function fixture(options: Fixture = {}) {
  const calls: string[] = [];
  const pathArgs: unknown[][] = [];
  const nestedArgs: unknown[][] = [];
  const select = createShellSinglePolicy({
    Uwe: rules.Uwe, dA: store.dA,
    se: () => { calls.push('cwd'); return options.cwd ?? '/fixture'; },
    vX: (...args: unknown[]) => { calls.push('path'); pathArgs.push(args); assert.equal(args[1], options.cwd ?? '/fixture'); return options.path ?? passthrough; },
    K5e: () => { calls.push('safety'); return options.safety ?? passthrough; },
    PN: () => options.outsideRead === true,
    Acn: () => { calls.push('environment'); return options.unsafeEnv === true; },
    Cy: () => options.exemption === true, Tv: () => true,
    VW: (reason: string) => ({ behavior: 'ask', message: reason,
      decisionReason: { type: 'safetyCheck', reason, circuitBreaker: 'outsideReadsBlocked' } }),
    hTr: (...args: unknown[]) => { calls.push('nested-read'); nestedArgs.push(args); return options.nested; },
    Ccn: () => { calls.push('mode'); return options.mode ?? passthrough; },
    KF: () => undefined, wR: () => undefined,
    bwe: () => options.skipReadOnly === true, _cn: () => options.readOnlyCommand ?? options.skipReadOnly === true,
    T3e: () => options.transformed === true, Awe: () => options.unsafeAssignment === true,
    ppe: 'fixture read only', Rl: approval, TVt, ki: { name: 'Bash', isReadOnly: () => options.readOnly === true },
  });
  // The copied JavaScript's empty-array default is inferred as never[].
  return { calls, pathArgs, nestedArgs, select: (input: { command: string }, value: State, multipleDirectories: boolean,
    parsed: unknown, cwd?: string, assignments: string[] = [], pathContext?: unknown, toolContext?: unknown) =>
    Reflect.apply(select, undefined, [input, value, multipleDirectories, parsed, cwd, assignments, pathContext, toolContext]) };
}

async function command(text: string) {
  const result = E6(text, await w6(text));
  assert.equal(result.kind, 'simple');
  assert.equal(result.commands.length, 1);
  return result.commands[0];
}

test('single-command policy keeps exact and wrapper-rule precedence', async () => {
  const parsed = await command('command printf denied');
  const input = { command: 'command printf denied' };
  const exactAsk = fixture();
  const asked = exactAsk.select(input, state([], ['Bash(printf:*)'], ['Bash(command printf denied)']), false, parsed);
  assert.equal(asked.behavior, 'ask');
  assert.equal(asked.decisionReason.rule.ruleValue.ruleContent, 'command printf denied');
  assert.deepEqual(exactAsk.calls, ['cwd']);
  const prefixDeny = fixture();
  const denied = prefixDeny.select(input, state(['Bash(command printf denied)'], ['Bash(printf:*)']), false, parsed);
  assert.equal(denied.behavior, 'deny');
  assert.deepEqual(denied.decisionReason.rule, { source: 'userSettings', ruleBehavior: 'deny',
    ruleValue: { toolName: 'Bash', ruleContent: 'printf:*' } });
  assert.deepEqual(prefixDeny.calls, ['cwd']);
  const prefixAsk = fixture();
  const question = prefixAsk.select(input, state(['Bash(command printf denied)'], [], ['Bash(printf:*)']), false, parsed);
  assert.equal(question.behavior, 'ask');
  assert.equal(question.decisionReason.rule.ruleValue.ruleContent, 'printf:*');
  assert.deepEqual(prefixAsk.calls, ['cwd']);
});

test('single-command policy checks path and read block before rule allows', async () => {
  const parsed = await command('echo ok');
  const input = { command: 'echo ok' };
  const allow = state(['Bash(echo ok)']);
  const hardPath: Outcome = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'path' } };
  const first = fixture({ path: hardPath });
  assert.equal(first.select(input, allow, false, parsed), hardPath);
  assert.deepEqual(first.calls, ['cwd', 'path']);
  const softPath: Outcome = { behavior: 'ask', bashAllowRuleOverridable: true };
  const second = fixture({ path: softPath });
  const allowed = second.select(input, allow, false, parsed);
  assert.equal(allowed.behavior, 'allow');
  assert.equal(allowed.updatedInput, input);
  assert.deepEqual(second.calls, ['cwd', 'path']);
  const blocked = fixture({ unsafeEnv: true });
  const ask = blocked.select(input, state(['Bash(echo ok)'], [], [], true), false, parsed);
  assert.equal(ask.behavior, 'ask');
  assert.equal(ask.decisionReason.circuitBreaker, 'outsideReadsBlocked');
  assert.deepEqual(blocked.calls, ['cwd', 'path', 'safety', 'environment']);
  const exempt = fixture({ unsafeEnv: true, exemption: true });
  assert.equal(exempt.select(input, state(['Bash(echo ok)'], [], [], true), false, parsed).behavior, 'allow');
  assert.deepEqual(exempt.calls, ['cwd', 'path', 'safety', 'environment', 'nested-read']);
  const nested: Outcome = { behavior: 'deny', message: 'nested read denied' };
  const nestedFixture = fixture({ nested });
  assert.equal(nestedFixture.select(input, state(['Bash(echo ok)'], [], [], true), false, parsed), nested);
  const safety: Outcome = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'outside' } };
  const safetyFixture = fixture({ safety, outsideRead: true });
  assert.equal(safetyFixture.select(input, state(['Bash(echo ok)'], [], [], true), false, parsed), safety);
  assert.deepEqual(safetyFixture.calls, ['cwd', 'path', 'safety']);
  const prefix = fixture({ path: softPath });
  const prefixResult = prefix.select(input, state(['Bash(echo:*)']), false, parsed);
  assert.equal(prefixResult.behavior, 'allow');
  assert.equal(prefixResult.decisionReason.rule.ruleValue.ruleContent, 'echo:*');
  assert.deepEqual(prefix.calls, ['cwd', 'path']);

  const redirectedInput = { command: 'echo ok < input.txt' };
  const redirected = await command(redirectedInput.command);
  const readPolicy = state([], [], [], true);
  const pathContext = { fixture: 'path-context' };
  const forwarding = fixture({ exemption: true, cwd: '/fixture/work' });
  const forwarded = forwarding.select(redirectedInput, readPolicy, true, redirected, undefined, [], pathContext);
  assert.equal(forwarded.behavior, 'passthrough');
  assert.deepEqual(forwarding.pathArgs, [[redirectedInput, '/fixture/work', readPolicy, true,
    [{ op: '<', fd: undefined, target: 'input.txt', targetSourceLiteral: true }], [redirected], pathContext]]);
  assert.deepEqual(forwarding.nestedArgs, [[redirected, '/fixture/work', readPolicy, true, true]]);
});

test('single-command policy preserves fallback safety, read-only and suggestion decisions', async () => {
  const parsed = await command('git status');
  const input = { command: 'git status' };
  const noRules = state();
  const softPath: Outcome = { behavior: 'ask', bashAllowRuleOverridable: true };
  const soft = fixture({ path: softPath });
  assert.equal(soft.select(input, noRules, false, parsed), softPath);
  const modeAsk: Outcome = { behavior: 'ask', message: 'mode approval' };
  const mode = fixture({ mode: modeAsk, readOnly: true });
  assert.equal(mode.select(input, noRules, false, parsed), modeAsk);
  const readOnly = fixture({ readOnly: true });
  const allowed = readOnly.select(input, noRules, false, parsed);
  assert.equal(allowed.behavior, 'allow');
  assert.equal(allowed.updatedInput, input);
  assert.equal(allowed.decisionReason.reason, 'fixture read only');
  for (const [gate, commandMatch, expected] of [[false, false, 'allow'], [false, true, 'allow'],
    [true, false, 'allow'], [true, true, 'passthrough']] as const) {
    const candidate = fixture({ readOnly: true, skipReadOnly: gate, readOnlyCommand: commandMatch });
    assert.equal(candidate.select(input, noRules, false, parsed).behavior, expected);
  }
  for (const options of [{ unsafeEnv: true }, { skipReadOnly: true }, { transformed: true }, { unsafeAssignment: true }]) {
    const blocked = fixture({ ...options, readOnly: true });
    const result = blocked.select(input, noRules, false, parsed, '/fixture', ['X']);
    assert.equal(result.behavior, 'passthrough');
    assert.deepEqual(result.suggestions, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'git status *' }],
      behavior: 'allow', destination: 'localSettings' }]);
  }
});
