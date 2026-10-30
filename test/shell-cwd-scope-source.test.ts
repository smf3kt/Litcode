import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellCwdScope } from '../src/shell-cwd-scope-source.js';
import { createShellSinglePolicy } from '../src/shell-single-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { uNe } from '../src/plan-deny-source.js';

test('source cwd scope preserves nested values and normalizes scoped writes', async () => {
  let ambient = '/ambient';
  const writes: string[] = [];
  const scope = createShellCwdScope(() => ambient, (value: string) => { ambient = value; writes.push(value); }, () => '/original');
  assert.equal(scope.MZ(), false);
  assert.equal(scope.se(), '/ambient');
  scope.kon('/outside');
  assert.equal(scope.se(), '/outside');
  assert.deepEqual(writes, ['/outside']);
  const run = scope.Wm('/café', async () => {
    assert.equal(scope.MZ(), true);
    assert.equal(scope.Aon(), '/café');
    scope.kon('/naïve');
    assert.equal(scope.se(), '/naïve');
    const nested = scope.bPe(undefined, async () => {
      assert.equal(scope.se(), '/naïve');
      scope.kon('/nested');
      await Promise.resolve();
      return scope.se();
    });
    assert.ok(nested instanceof Promise);
    assert.equal(await nested, '/nested');
    assert.equal(scope.se(), '/naïve');
    return scope.se();
  });
  assert.ok(run instanceof Promise);
  assert.equal(await run, '/naïve');
  assert.equal(scope.se(), '/outside');
  assert.deepEqual(writes, ['/outside']);
});

test('source cwd reaches single-command path checks in nested scopes', () => {
  const scope = createShellCwdScope(() => '/ambient', () => {}, () => '/original');
  const state = { alwaysAllowRules: {}, alwaysDenyRules: {}, alwaysAskRules: {} };
  const store = createShellRuleStore((value: typeof state) => uNe(value.alwaysAllowRules, 'allow'));
  const rules = createShellRulePolicy(store.dA, () => 'fixture approval', () => []);
  const paths: string[] = [];
  const single = createShellSinglePolicy({ ...rules, dA: store.dA, se: scope.se,
    vX: (_input: unknown, cwd: string) => { paths.push(cwd); return { behavior: 'passthrough' }; },
    K5e: () => ({ behavior: 'passthrough' }), Ccn: () => ({ behavior: 'passthrough' }),
    KF: () => undefined, wR: () => undefined, bwe: () => false, _cn: () => false,
    T3e: () => false, Awe: () => false, Acn: () => false,
    PN: () => false, Cy: () => false, Tv: () => false, VW: () => { throw new Error('unexpected read block'); },
    hTr: () => { throw new Error('unexpected read block'); }, ki: { name: 'Bash', isReadOnly: () => false },
    ppe: 'fixture', Rl: () => 'fixture approval', TVt: () => [] });
  const check = () => Reflect.apply(single, undefined, [{ command: 'echo ok' }, state, false, undefined]);
  scope.Wm('/outer', () => {
    assert.equal(check().behavior, 'passthrough');
    scope.Wm('/inner', () => { assert.equal(check().behavior, 'passthrough'); });
    assert.equal(check().behavior, 'passthrough');
  });
  assert.deepEqual(paths, ['/outer', '/inner', '/outer']);
});

test('source cwd scopes isolate concurrent calls and retain ambient fallback semantics', async () => {
  const scope = createShellCwdScope(() => { throw new Error('ambient unavailable'); }, () => {}, () => '/original');
  assert.throws(() => scope.Aon(), /ambient unavailable/);
  assert.equal(scope.se(), '/original');
  const inherited = scope.bPe(undefined, () => scope.se());
  assert.equal(inherited, '/original');
  let enterA!: () => void;
  const readyA = new Promise<void>(resolve => { enterA = resolve; });
  let releaseA!: () => void;
  const gate = new Promise<void>(resolve => { releaseA = resolve; });
  const a = scope.Wm('/first', async () => {
    scope.kon('/first-next');
    enterA();
    await gate;
    return scope.se();
  });
  assert.ok(a instanceof Promise);
  await readyA;
  const b = scope.Wm('/second', async () => {
    await Promise.resolve();
    scope.kon('/second-next');
    return scope.se();
  });
  assert.ok(b instanceof Promise);
  assert.equal(await b, '/second-next');
  releaseA();
  assert.equal(await a, '/first-next');
  assert.equal(scope.se(), '/original');
  const failure = new Error('cwd task failed');
  const failed = scope.Wm('/failed', async () => { throw failure; });
  assert.ok(failed instanceof Promise);
  await assert.rejects(failed, error => error === failure);
  assert.equal(scope.se(), '/original');
});
