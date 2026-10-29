import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellVectorPolicy } from '../src/shell-vector-policy-source.js';
import { createReadingScheduler } from '../src/shell-reading-scheduler-source.js';
import { createShellRuleRecheck } from '../src/shell-rule-recheck-source.js';
import { xX } from '../src/shell-rule-matcher-source.js';

type Decision = { behavior: 'allow' | 'deny' | 'ask' | 'passthrough'; message?: string;
  decisionReason?: { type: string; reason?: string; classifierApprovable?: boolean; circuitBreaker?: string } };
type Input = { command: string };
type Context = { bashCommandClamps?: string[][] };
const identity = (decision: Decision) => decision;
const message = (_name: string, reason: { reason: string }) => reason.reason;

test('source vector policy applies clamp before the injected command policy', async () => {
  const context: Context = { bashCommandClamps: [['Bash(echo:*)']] };
  const allowed: Decision = { behavior: 'allow' };
  const events: { name: string; groupCount: number }[] = [];
  const visited: string[] = [];
  const policy = createShellVectorPolicy(async (input: Input) => { visited.push(input.command); return allowed; },
    (value: Context) => value, identity, identity,
    (name: string, data: { groupCount: number }) => events.push({ name, groupCount: data.groupCount }), message);
  const unmatched = await policy({ command: 'printf nope' }, context, undefined, undefined, undefined, undefined, undefined);
  assert.deepEqual(unmatched, { behavior: 'deny',
    message: `Permission to use Bash with command printf nope has been denied: this agent's Bash use is clamped to a fixed set of command forms (per-spawn bashCommandClamp), and the span "printf nope" matches none of them. Allowed forms: Bash(echo:*)`,
    decisionReason: { type: 'other', reason: 'bashCommandClamp: no clamp rule matches this command' } });
  assert.deepEqual(visited, []);
  assert.deepEqual(events, [{ name: 'tengu_bash_command_clamp_denied', groupCount: 1 }]);
  const unverifiable = await policy({ command: 'echo $(printf nope)' }, context, undefined, undefined, undefined, undefined, undefined);
  assert.equal(unverifiable.behavior, 'deny');
  assert.match(unverifiable.message, /the command has structure the clamp cannot verify/);
  assert.deepEqual(visited, []);
  assert.equal(await policy({ command: 'command echo ok' }, context, undefined, undefined, undefined, undefined, undefined), allowed);
  assert.deepEqual(visited, ['command echo ok']);
  const groups: Context = { bashCommandClamps: [['Bash(echo:*)'], ['Bash(printf:*)']] };
  const secondGroup = await policy({ command: 'echo ok' }, groups, undefined, undefined, undefined, undefined, undefined);
  assert.equal(secondGroup.behavior, 'deny');
  assert.match(secondGroup.message, /Allowed forms: Bash\(printf:\*\)/);
  assert.deepEqual(events.at(-1), { name: 'tengu_bash_command_clamp_denied', groupCount: 2 });
  assert.deepEqual(visited, ['command echo ok']);
});

test('source vector policy preserves projection, rechecks and background-operator branches', async () => {
  let decision: Decision = { behavior: 'allow' };
  let projected = decision;
  const denied: Decision = { behavior: 'deny', message: 'rechecked' };
  const calls: string[] = [];
  const context: Context = {};
  const helper = {}, parent = {}, scope = {}, vector = [true], capture = () => {};
  const policy = createShellVectorPolicy(async (input: Input, actual: Context, h: object, p: object, s: object, v: boolean[], c: () => void) => {
    calls.push('D3e'); assert.equal(actual, context); assert.equal(h, helper); assert.equal(p, parent);
    assert.equal(s, scope); assert.equal(v, vector); assert.equal(c, capture); assert.ok(input.command);
    return decision;
  }, (actual: Context) => { assert.equal(actual, context); calls.push('context'); return actual; },
  (value: Decision, input: Input, actual: Context) => {
    assert.equal(value, decision); assert.ok(input.command); assert.equal(actual, context); calls.push('project'); return projected;
  }, (value: Decision, input: Input, actual: Context) => {
    assert.ok(input.command); assert.equal(actual, context); calls.push('recheck');
    return value.behavior === 'ask' ? denied : value;
  }, () => { throw new Error('unexpected clamp telemetry'); }, message);
  const run = async (command: string) => policy({ command }, context, helper, parent, scope, vector, capture);
  assert.equal(await run('echo ok'), decision);
  assert.deepEqual(calls, ['context', 'D3e', 'context', 'project', 'context', 'recheck']);
  calls.length = 0;
  decision = { behavior: 'ask', message: 'soft' }; projected = decision;
  assert.equal(await run('echo ok'), denied);
  assert.deepEqual(calls, ['context', 'D3e', 'context', 'project', 'context', 'recheck']);
  calls.length = 0;
  decision = { behavior: 'allow' }; projected = { behavior: 'ask', message: 'projection' };
  assert.equal(await run('echo ok'), denied);
  assert.deepEqual(calls, ['context', 'D3e', 'context', 'project', 'context', 'recheck']);
  decision = { behavior: 'allow' }; projected = decision;
  for (const command of ['echo hi && echo bye', 'echo $((1 & 2))']) {
    calls.length = 0; assert.equal(await run(command), decision);
    assert.deepEqual(calls, ['context', 'D3e', 'context', 'project']);
  }
  const backgroundDecision: Decision = { behavior: 'allow', decisionReason: {
    type: 'other', reason: 'Auto-allowed with sandbox (autoAllowBashIfSandboxed enabled)' } };
  decision = backgroundDecision; projected = decision; calls.length = 0;
  assert.equal(await run('echo hi &'), backgroundDecision);
  assert.deepEqual(calls, ['context', 'D3e', 'context', 'project']);
  decision = { behavior: 'allow' }; projected = decision;
  for (const command of ['echo hi &', 'echo hi & )', 'x'.repeat(10001) + ' &']) {
    calls.length = 0; assert.equal(await run(command), denied);
    assert.deepEqual(calls, ['context', 'D3e', 'context', 'project', 'context', 'recheck']);
  }
  const pass = createShellVectorPolicy(async () => ({ behavior: 'allow' }), (value: Context) => value,
    identity, identity, () => {}, message);
  const background = await pass({ command: 'echo hi &' }, context, undefined, undefined, undefined, undefined, undefined);
  assert.equal(background.behavior, 'ask');
  assert.deepEqual(background.decisionReason, { type: 'safetyCheck',
    reason: 'This command uses the `&` background operator, which defers execution past approval-time safety checks. Approve only if you trust it.',
    classifierApprovable: false, circuitBreaker: 'backgroundOperator' });
  assert.equal(background.message, background.decisionReason.reason);
  const failure = new Error('fixture policy failure');
  const failed = createShellVectorPolicy(async () => { throw failure; }, (value: Context) => value,
    () => { throw new Error('unexpected projection'); }, () => { throw new Error('unexpected recheck'); }, () => {}, message);
  await assert.rejects(failed({ command: 'echo ok' }, context, undefined, undefined, undefined, undefined, undefined),
    error => error === failure);
});

test('source scheduler and vector wrapper retain an injected recheck denial', async () => {
  const deny = { source: 'session', ruleBehavior: 'deny', ruleValue: { toolName: 'Bash', ruleContent: 'rm:*' } };
  const rules = { deny: new Map([['rm:*', deny]]), ask: new Map(), allow: new Map() };
  const gre = (state: typeof rules, _tool: unknown, behavior: 'ask' | 'deny') => state[behavior];
  const dA = (input: Input, state: typeof rules, mode: 'prefix') => {
    const denyOptions = { stripAllEnvVars: true, skipCompoundCheck: true, ruleBehavior: 'deny' };
    const askOptions = { stripAllEnvVars: true, skipCompoundCheck: true, ruleBehavior: 'ask' };
    return { matchingDenyRules: xX(input, state.deny, mode, denyOptions),
      matchingAskRules: xX(input, state.ask, mode, askOptions) };
  };
  const recheck = createShellRuleRecheck(gre, dA);
  const context = { rules, bashCommandClamps: [], permissions: { blockReadsOutsideWorkingDirectories: false } };
  const visits: string[] = [];
  const policy = createShellVectorPolicy(async (_input: Input, _context: typeof context, _helper: object,
    _parent: undefined, _scope: undefined, vector: boolean[] | undefined, capture?: (count: number, keeps: boolean[]) => void) => {
    visits.push(vector === undefined ? 'initial' : vector.map(Number).join(''));
    if (vector === undefined) { capture?.(1, [false]); return { behavior: 'allow' }; }
    return { behavior: 'ask', message: 'candidate', decisionReason: { type: 'other', reason: 'candidate' } };
  }, (value: typeof context) => value, identity,
  (decision: Decision, input: Input, value: typeof context) => recheck(decision, input, value.rules), () => {}, message);
  const scheduler = createReadingScheduler(policy, (value: typeof context) => value.permissions, () => false,
    (run: () => Promise<Decision>) => run());
  const result = await scheduler({ command: 'echo $(rm target)' }, context, {}, undefined);
  assert.deepEqual(visits, ['initial', '0', '1']);
  assert.equal(result.behavior, 'deny');
  assert.equal(result.decisionReason.rule, deny);
  visits.length = 0;
  const control = await scheduler({ command: 'echo $(echo harmless)' }, context, {}, undefined);
  assert.deepEqual(visits, ['initial', '0', '1']);
  assert.equal(control.behavior, 'passthrough');
});
