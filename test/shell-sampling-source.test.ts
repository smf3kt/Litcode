import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellSamplingScope } from '../src/shell-sampling-source.js';
import { createReadingScheduler } from '../src/shell-reading-scheduler-source.js';
import { createShellVectorPolicy } from '../src/shell-vector-policy-source.js';

test('sample scope suppresses nested telemetry across awaits without leaking between concurrent callers', async () => {
  const events: string[] = [];
  const scope = createShellSamplingScope((name: string) => events.push(name));
  const other = createShellSamplingScope((name: string) => events.push(`other:${name}`));
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  scope.dO('before');
  const pending = scope.OAn(async () => {
    scope.dO('sample-start');
    other.dO('independent');
    entered();
    await gate;
    await scope.OAn(async () => { await Promise.resolve(); scope.dO('nested'); });
    scope.dO('sample-end');
    return 42;
  });
  await ready;
  scope.dO('outside-while-pending');
  release();
  assert.equal(await pending, 42);
  scope.dO('after');
  assert.deepEqual(events, ['before', 'other:independent', 'outside-while-pending', 'after']);
  const failure = new Error('sample failed');
  const failed = scope.OAn(async () => { throw failure; });
  assert.ok(failed instanceof Promise);
  await assert.rejects(failed, error => error === failure);
  scope.dO('after-failure');
  assert.equal(events.at(-1), 'after-failure');
});

test('scheduler and vector wrapper share the sampled telemetry scope', async () => {
  const events: string[] = [];
  const scope = createShellSamplingScope((name: string) => events.push(name));
  const context = { bashCommandClamps: [['Bash(echo:*)']], permissions: {} };
  const visits: string[] = [];
  const policy = createShellVectorPolicy(async (_input: { command: string }, _ctx: typeof context, _helper: unknown,
    _parent: unknown, _scope: unknown, vector: boolean[] | undefined, capture?: (count: number, keeps: boolean[]) => void) => {
    visits.push(vector === undefined ? 'initial' : vector.map(Number).join(''));
    scope.dO(vector === undefined ? 'initial' : 'sample');
    if (vector === undefined) capture?.(1, [false]);
    return { behavior: 'allow' };
  }, (value: typeof context) => value, (decision: unknown) => decision, (decision: unknown) => decision,
  scope.dO, () => 'fixture');
  const schedule = createReadingScheduler(policy, (value: typeof context) => value.permissions, () => false, scope.OAn);
  const result = await schedule({ command: 'echo ok' }, context, {}, undefined);
  assert.equal(result.behavior, 'allow');
  assert.deepEqual(visits, ['initial', '0', '1']);
  assert.deepEqual(events, ['initial']);
  assert.equal((await policy({ command: 'printf nope' }, context, undefined, undefined, undefined, undefined, undefined)).behavior, 'deny');
  assert.deepEqual(events, ['initial', 'tengu_bash_command_clamp_denied']);
  const sampled = scope.OAn(() => policy({ command: 'printf nope' }, context,
    undefined, undefined, undefined, undefined, undefined));
  assert.ok(sampled instanceof Promise);
  assert.equal((await sampled).behavior, 'deny');
  assert.deepEqual(events, ['initial', 'tengu_bash_command_clamp_denied']);
});
