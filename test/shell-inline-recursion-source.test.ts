import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellInlineRecursion } from '../src/shell-inline-recursion-source.js';
import { createShellInlineRecognition } from '../src/shell-inline-recognition-source.js';
import { createShellSamplingScope } from '../src/shell-sampling-source.js';
import { createShellCwdScope } from '../src/shell-cwd-scope-source.js';

type Decision = { behavior: 'allow' | 'deny' | 'ask'; message?: string;
  decisionReason?: { type: string; reason?: string; circuitBreaker?: string; classifierApprovable?: boolean } };
type Budget = { left: number; chars: number; judged: Map<string, Decision>; asked: Map<string, Decision | null> };
const budget = (left = 10, chars = 10000): Budget => ({ left, chars, judged: new Map(), asked: new Map() });
const callContext = (command: string, shared = budget(), depth = 0) => ({ input: { command }, context: {}, depth, budget: shared });

function fixture(outcome: Decision = { behavior: 'allow' }, enabled = true) {
  const visits: { command: string; cwd: string; depth: number }[] = [];
  const events: string[] = [];
  const sample = createShellSamplingScope((name: string) => events.push(name));
  const cwd = createShellCwdScope(() => '/ambient', () => {}, () => '/original');
  const recognition = createShellInlineRecognition(sample.dO);
  const policy = createShellInlineRecursion({ recognition, se: cwd.se, Wm: cwd.Wm, OAn: sample.OAn,
    D3e: async (input: { command: string }, _context: object, _helper: unknown, _parent: unknown,
      nested: { depth: number }) => {
      visits.push({ command: input.command, cwd: cwd.se(), depth: nested.depth });
      sample.dO('nested-policy');
      await Promise.resolve();
      return outcome;
    },
    de: (value: object) => value,
    sR: (value: string, current: string) => ({ allowed: true, resolvedPath: value.startsWith('/') ? value : `${current}/${value}` }),
    Yg: () => true, O: () => 'linux', wX: () => enabled, ZF: sample.dO,
    Rl: (_tool: string, reason: { reason: string }) => reason.reason, disableInline: false });
  return { policy, visits, events, cwd };
}

test('source recursion checks judged scripts, propagates denial and memoizes results', async () => {
  const allowed = fixture();
  const command = 'sh -c "rm target"';
  const context = callContext(command);
  assert.equal(await allowed.policy.Nwe(command, context, [], []), null);
  assert.deepEqual(allowed.visits, [{ command: 'rm target', cwd: '/ambient', depth: 1 }]);
  assert.deepEqual(allowed.events, []);
  assert.equal(context.budget.left, 9);
  assert.equal(context.budget.chars, 9991);
  assert.equal(await allowed.policy.Nwe(command, context, [], []), null);
  assert.equal(allowed.visits.length, 1);
  const denied = fixture({ behavior: 'deny' });
  const decision = await denied.policy.Nwe(command, callContext(command), [], []);
  assert.equal(decision.behavior, 'ask');
  assert.equal(decision.decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.equal(decision.decisionReason.reason, 'A permission rule denies a command in this shell -c script');
  assert.deepEqual(denied.events, ['inline_shell_unchecked']);
  assert.deepEqual(denied.visits, [{ command: 'rm target', cwd: '/ambient', depth: 1 }]);
  const safety: Decision = { behavior: 'ask', message: 'danger __INLINE_SHELL_VALUE__',
    decisionReason: { type: 'safetyCheck', reason: 'danger __INLINE_SHELL_VALUE__', circuitBreaker: 'dangerousRemoval',
      classifierApprovable: false } };
  const safetyRun = fixture(safety);
  const held = await safetyRun.policy.Nwe(command, callContext(command), [], []);
  assert.equal(held.behavior, 'ask');
  assert.equal(held.decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.match(held.message, /target is built from a variable/);
  assert.deepEqual(safetyRun.events, ['inline_shell_script']);
});

test('source recursion retains depth, budget, unknown-script and harmless controls', async () => {
  for (const [text, depth, left, expectedCalls] of [
    ['sh -c "rm target"', 2, 10, 0],
    ['sh -c "rm target"', 0, 0, 0],
    ['sh -c "alias z=rm; z target"', 0, 10, 0],
  ] as const) {
    const run = fixture();
    const result = await run.policy.Nwe(text, callContext(text, budget(left), depth), [], []);
    assert.equal(result.behavior, 'ask');
    assert.equal(result.decisionReason.circuitBreaker, 'dangerousRemoval');
    assert.equal(run.visits.length, expectedCalls);
  }
  for (const text of ['sh -c "echo harmless"', 'echo harmless']) {
    const run = fixture();
    assert.equal(await run.policy.Nwe(text, callContext(text), [], []), null);
    assert.deepEqual(run.visits, []);
  }
  const text = 'sh -c "rm target"';
  const charLimited = fixture();
  const charContext = callContext(text, budget(10, 8));
  assert.equal((await charLimited.policy.Nwe(text, charContext, [], [])).decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.deepEqual(charLimited.visits, []);
  assert.equal(charContext.budget.left, 10);
  assert.equal(charContext.budget.chars, 8);
  const disabled = fixture({ behavior: 'deny' }, false);
  assert.equal(await disabled.policy.Nwe(text, callContext(text), [], []), null);
  assert.deepEqual(disabled.visits, []);
});

test('source recursion passes scoped cwd and preserves wrapped shell scripts', async () => {
  const run = fixture({ behavior: 'deny' });
  const text = 'env LANG=C sh -c "rm target"';
  const result = run.cwd.Wm('/workspace', () => run.policy.Nwe(text, callContext(text), [], []));
  assert.ok(result instanceof Promise);
  const decision = await result;
  assert.equal(decision.behavior, 'ask');
  assert.equal(decision.decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.deepEqual(run.visits, [{ command: 'export LANG=C && rm target', cwd: '/workspace', depth: 1 }]);
  assert.deepEqual(run.events, ['inline_shell_unchecked']);
  assert.equal(run.cwd.se(), '/ambient');

  const changed = fixture({ behavior: 'deny' });
  const changedText = 'cd ./sub && sh -c "rm target"';
  const changedResult = changed.cwd.Wm('/workspace', () => changed.policy.Nwe(changedText, callContext(changedText), [], []));
  assert.ok(changedResult instanceof Promise);
  assert.equal((await changedResult).decisionReason.circuitBreaker, 'dangerousRemoval');
  assert.deepEqual(changed.visits, [{ command: 'rm target', cwd: '/workspace/./sub', depth: 1 }]);
  assert.equal(changed.cwd.se(), '/ambient');
});

test('source recursion samples declaration readings and propagates nested failures', async () => {
  const scope = createShellSamplingScope(() => {});
  const cwd = createShellCwdScope(() => '/fixture', () => {}, () => '/fixture');
  const visited: string[] = [];
  const marker: Decision = { behavior: 'ask', message: 'nested approval',
    decisionReason: { type: 'safetyCheck', reason: 'nested approval', circuitBreaker: 'dangerousRemoval', classifierApprovable: false } };
  let failure: Error | undefined;
  const recursive = createShellInlineRecursion({ recognition: createShellInlineRecognition(scope.dO), se: cwd.se,
    Wm: cwd.Wm, OAn: scope.OAn, D3e: async (_input: object, _context: object, _helper: unknown, _parent: unknown,
      _nested: object, vector: boolean[] | undefined, capture?: (count: number, keeps: boolean[]) => void) => {
      if (failure) throw failure;
      visited.push(vector === undefined ? 'initial' : vector.map(Number).join(''));
      if (vector === undefined) { capture?.(1, [false]); return { behavior: 'allow' }; }
      return vector[0] ? marker : { behavior: 'allow' };
    }, de: (value: object) => value, sR: () => ({ allowed: false }), Yg: () => false, O: () => 'linux',
    wX: () => true, ZF: scope.dO, Rl: (_name: string, reason: { reason: string }) => reason.reason, disableInline: false });
  const text = 'sh -c "rm target"';
  const context = callContext(text);
  assert.equal(await recursive.Nwe(text, context, [], []), marker);
  assert.deepEqual(visited, ['initial', '0', '1']);
  assert.equal(context.budget.left, 7);
  assert.equal(await recursive.Nwe(text, context, [], []), marker);
  assert.deepEqual(visited, ['initial', '0', '1']);
  failure = new Error('nested policy failed');
  const failed = callContext(text);
  await assert.rejects(recursive.Nwe(text, failed, [], []), error => error === failure);
  assert.equal(failed.budget.asked.size, 0);
  assert.equal(failed.budget.judged.size, 0);
});

test('source cwd reconstruction requires a validated first cd and an all-and command chain', async () => {
  const { policy } = fixture();
  const prior = { text: 'cd ./sub', cd: true, names: [], exports: false };
  const context = {};
  assert.equal(await policy.BTr('cd ./sub && sh -c "rm target"', prior, [], context), '/ambient/./sub');
  for (const text of ['cd ./sub; sh -c "rm target"', 'cd ./sub || sh -c "rm target"',
    'echo first && cd ./sub && sh -c "rm target"']) {
    assert.equal(await policy.BTr(text, prior, [], context), undefined);
  }
  assert.equal(await policy.BTr('cd ./sub && sh -c "rm target"', prior, [], { forRemoteExecution: true }), undefined);
  assert.equal(await policy.BTr('cd ./sub && sh -c "rm target"', prior, ['sudo', '-u', 'other'], context), '/ambient/./sub');
  assert.equal(await policy.BTr('cd ./sub && sh -c "rm target"', prior, ['sudo', '--chdir=/outside'], context), undefined);
  assert.equal(policy.N3e({ argv: ['cd', '../outside'], envVars: [], redirects: [] }, '/ambient', context), null);
  assert.equal(policy.N3e({ argv: ['cd', './sub'], envVars: [{ name: 'X', value: '1' }], redirects: [] }, '/ambient', context), null);
  assert.equal(policy.N3e({ argv: ['cd', './sub*'], envVars: [], redirects: [] }, '/ambient', context), null);
});
