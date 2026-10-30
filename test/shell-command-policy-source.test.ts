import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { vS } from '../src/bash-parser-source.js';
import { createShellCommandPolicy } from '../src/shell-command-policy-source.js';
import { createShellRuleStore } from '../src/shell-rule-store-source.js';
import { createShellRulePolicy } from '../src/shell-rule-policy-source.js';
import { TVt } from '../src/shell-rule-suggestions-source.js';
import { uNe } from '../src/plan-deny-source.js';
import { createShellSinglePolicy } from '../src/shell-single-policy-source.js';
import { createShellRuleRecheck } from '../src/shell-rule-recheck-source.js';
import { createShellVectorPolicy } from '../src/shell-vector-policy-source.js';
import { createReadingScheduler, createShellReadBlockProjection } from '../src/shell-reading-scheduler-source.js';
import { createShellSamplingScope } from '../src/shell-sampling-source.js';
import { createShellCompoundPolicy } from '../src/shell-compound-policy-source.js';
import { createPermissionEntry } from '../src/permission-entry-source.js';
import { createPermissionInputParser } from '../src/shell-input-parser-source.js';

type State = { alwaysAllowRules: Record<string, string[]>; alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]>; blockReadsOutsideWorkingDirectories?: boolean };
const state = (deny: string[] = []): State => ({ alwaysAllowRules: {}, alwaysDenyRules: { userSettings: deny }, alwaysAskRules: {} });
const message = (_name: string, reason?: { reason?: string }) => reason?.reason ?? 'fixture approval';
const store = createShellRuleStore((value: State) => uNe(value.alwaysAllowRules, 'allow'));
const rules = createShellRulePolicy(store.dA, message, TVt);
const passthrough = { behavior: 'passthrough' };
type Budget = { left: number; chars: number; judged: Map<unknown, unknown>; asked: Map<unknown, unknown> };
function fixture(options: { complexResult?: object | null; nestedResult?: object | null;
  single?: (...args: unknown[]) => unknown; compound?: (...args: unknown[]) => unknown;
  vector?: (...args: unknown[]) => unknown } = {}) {
  const calls: string[] = [];
  const nestedContexts: { depth: number; budget: Budget }[] = [];
  const policy = createShellCommandPolicy({
    $3e: () => null, A3e: () => { throw new Error('unexpected aggregate'); }, ATr: () => false,
    CTr: async () => true, CX: () => false, Cwe: () => false, Cy: () => false, Dcn: () => null,
    Dl: () => undefined, EX: () => false, Edo: () => 'fixture', Fwe: () => true,
    GTr: rules.GTr, MO: (value: string) => value, MTr: async () => { calls.push('complex'); return options.complexResult ?? null; },
    Mcn: () => passthrough, Mk: () => new Set(['/fixture']), N3e: () => null,
    Nwe: async (_command: string, nested: { depth: number; budget: Budget }) => {
      calls.push('nested'); nestedContexts.push(nested); return options.nestedResult ?? null;
    },
    O: () => 'linux', O3e: options.vector ?? (async () => { throw new Error('unexpected compound evaluation'); }),
    PTr: () => false, Q$: () => false, QHe: () => false, RTr: (texts: string[], commands: object[]) => ({ subcommands: texts, astCommandsByIdx: commands }),
    RX: () => false, Rcn: options.compound ?? (async () => { calls.push('compound'); return passthrough; }), Rl: message,
    Sun: () => false, TVt, Tv: () => false, Uwe: rules.Uwe,
    VW: (reason: string) => ({ behavior: 'ask', decisionReason: { type: 'safetyCheck', reason, circuitBreaker: 'outsideReadsBlocked' } }),
    X3: () => false, X5e: () => passthrough, XYt: () => [], Xcn: async () => null, Y5e: () => false,
    YTr: 'fixture', Ye: () => undefined, _Tr: () => null, _n: (value: unknown) => String(value),
    _un: () => {}, arn: () => ({ behavior: 'ask' }), bG: () => passthrough, bL: (value: string[]) => value,
    bwe: () => false, d: () => 'fixture', dO: () => {}, de: (value: State) => value,
    e$: () => undefined, ie: () => ({}), jcn: options.single ?? (() => ({ behavior: 'allow', decisionReason: { type: 'other', reason: 'fixture' } })),
    k: () => false, ki: { name: 'Bash' }, oTr: 100, pTr: () => false, pwe: (value: unknown) => value,
    qe: { isSandboxingEnabled: () => false, isAutoAllowBashIfSandboxedEnabled: () => false },
    se: () => '/fixture', to: (value: string) => value, u3e: () => false,
    vX: () => { calls.push('path'); return passthrough; }, wR: () => ({}), x3e: () => null,
    xTr: () => false, xwe: () => true, yo: (_fs: object, value: string) => ({ resolvedPath: value }), yw: () => false,
  });
  return { calls, nestedContexts, policy };
}
const invoke = (policy: ReturnType<typeof createShellCommandPolicy>, input: { command: string }, value: State,
  capture?: (count: number, keeps: boolean[]) => void) =>
  policy(input, value, undefined, undefined, undefined, undefined, capture);

test('source scheduler, vector and command policy retain wrapper denial under explicit fixture adapters', async () => {
  const scope = createShellSamplingScope(() => {});
  const single = createShellSinglePolicy({ ...rules, dA: store.dA, se: () => '/fixture',
    vX: () => passthrough, K5e: () => passthrough, PN: () => false, Acn: () => false,
    Cy: () => false, Tv: () => false, VW: () => { throw new Error('unexpected read block'); },
    hTr: () => { throw new Error('unexpected read block'); }, Ccn: () => passthrough, KF: () => undefined,
    wR: () => undefined, bwe: () => false, _cn: () => false, T3e: () => false, Awe: () => false,
    ppe: 'fixture', Rl: message, TVt, ki: { name: 'Bash', isReadOnly: () => true } });
  const compound = createShellCompoundPolicy({ cd: () => false, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: message });
  let vector: ReturnType<typeof createShellVectorPolicy>;
  const commandPolicy = fixture({ single: (...args: unknown[]) => Reflect.apply(single, undefined, args),
    compound: (...args: unknown[]) => Reflect.apply(compound.Rcn, undefined, args),
    vector: (...args: unknown[]) => Reflect.apply(vector, undefined, args) }).policy;
  const recheck = createShellRuleRecheck(store.Gre, store.dA);
  vector = createShellVectorPolicy(commandPolicy, (value: State) => value,
    (decision: unknown) => decision, recheck, scope.dO, message);
  const scheduler = createReadingScheduler(vector, (value: State) => value, () => false, scope.OAn);
  const denied = state(['Bash(printf:*)']);
  for (const command of ['printf denied', 'command printf denied', 'env CUSTOM=value printf denied']) {
    const result = await scheduler({ command }, denied, undefined, undefined);
    assert.equal(result.behavior, 'deny');
    assert.equal(result.decisionReason.type, 'subcommandResults');
    const nested = [...result.decisionReason.reasons.values()];
    assert.equal(nested.length, 1);
    assert.deepEqual(nested[0].decisionReason.rule, { source: 'userSettings', ruleBehavior: 'deny',
      ruleValue: { toolName: 'Bash', ruleContent: 'printf:*' } });
  }
  const control = await scheduler({ command: 'echo allowed' }, denied, undefined, undefined);
  assert.equal(control.behavior, 'allow');
  const pipeline = await scheduler({ command: 'echo allowed | command printf denied' }, denied, undefined, undefined);
  assert.equal(pipeline.behavior, 'deny');
  assert.equal(pipeline.decisionReason.reasons.get('command printf denied').behavior, 'deny');
  const group = await scheduler({ command: '(echo allowed)' }, denied, undefined, undefined);
  assert.equal(group.behavior, 'ask');
  assert.equal(group.decisionReason.bashMissKind, 'shell-operators');
  const variable = 'X=old; X=new export Y; echo "$X"';
  const sampled = await scheduler({ command: variable }, state(['Bash(echo new)']), undefined, undefined);
  assert.equal(sampled.behavior, 'deny');
  const samples = [...sampled.decisionReason.reasons.values()];
  assert.ok(samples.some(result => result.behavior === 'deny' && result.decisionReason.rule.ruleValue.ruleContent === 'echo new'));
});

test('source policy composition applies incomplete declaration readings at the outer entry', async () => {
  class Aborted extends Error {}
  class Interrupted extends Error {}
  const scope = createShellSamplingScope(() => {});
  const projection = createShellReadBlockProjection(() => false);
  const single = createShellSinglePolicy({ ...rules, dA: store.dA, se: () => '/fixture',
    vX: () => passthrough, K5e: () => passthrough, PN: () => false, Acn: () => false,
    Cy: () => false, Tv: () => false, VW: () => { throw new Error('unexpected read block'); },
    hTr: () => null, Ccn: () => passthrough, KF: () => undefined, wR: () => undefined,
    bwe: () => false, _cn: () => false, T3e: () => false, Awe: () => false,
    ppe: 'fixture', Rl: message, TVt, ki: { name: 'Bash', isReadOnly: () => false } });
  const compound = createShellCompoundPolicy({ cd: () => false, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: message });
  let vector: ReturnType<typeof createShellVectorPolicy>;
  const commandPolicy = fixture({ single: (...args: unknown[]) => Reflect.apply(single, undefined, args),
    compound: (...args: unknown[]) => Reflect.apply(compound.Rcn, undefined, args),
    vector: (...args: unknown[]) => Reflect.apply(vector, undefined, args) }).policy;
  const recheck = createShellRuleRecheck(store.Gre, store.dA);
  vector = createShellVectorPolicy(commandPolicy, (value: State) => value, projection, recheck, scope.dO, message);
  const scheduler = createReadingScheduler(vector, (value: State) => value, () => false, scope.OAn);
  const parser = createPermissionInputParser(() => true, () => false, () => {}, {
    Ye: Aborted, au: Interrupted, Uxr: () => false, WWn: 'missing cwd',
  });
  let wholeAllow = false;
  const entry = createPermissionEntry({ ...parser, Age: () => {}, BAn: 'fixture approval', Be: 'Bash', Cy: () => false,
    Eh: () => undefined, Epn: () => undefined, Gp: (tool: { name: string }) => tool.name, M1: () => false,
    M9e: () => undefined, N9: () => wholeAllow ? { ruleBehavior: 'allow', ruleValue: { toolName: 'Bash' } } : null,
    NVt: () => false, Nco: () => false, Npn: () => undefined, Opn: () => false, P9e: () => undefined,
    Qwe: () => undefined, RVt: () => false, Rl: message, Rnn: () => false, Rpn: () => undefined,
    Tge: () => false, Ure: () => false, Wx: () => undefined, Xk: (_tool: object, value: { mode: string }) => value.mode,
    Ye: Aborted, _: JSON.stringify, _V: () => false, a: {}, d: (value: unknown) => value,
    de: (value: { state: object }) => value.state, eEt: () => false, f0: (mode: string) => mode,
    hor: () => undefined, i: () => {}, jJ: () => undefined, k: () => false, lc: () => undefined,
    opn: () => undefined, p2e: () => undefined,
    qe: { isSandboxingEnabled: () => false, isAutoAllowBashIfSandboxedEnabled: () => false },
    sit: () => 'fixture denied', srn: 'fixture reroute', t: () => {}, x9e: () => false,
  });
  const tool = { name: 'Bash', inputSchema: z.object({ command: z.string() }).strict(),
    requiresUserInteraction: () => false,
    checkPermissions: (input: { command: string }, context: { state: State }) => scheduler(input, context.state, undefined, undefined) };
  const four = 'A=1 B=2 C=3 D=4 export X; printf ok > marker.txt';
  const three = 'A=1 B=2 C=3 export X; printf ok > marker.txt';
  const cases = [
    { command: three, mode: 'default', whole: false, block: false, expected: 'allow', reason: 'rule' },
    { command: four, mode: 'default', whole: false, block: false, expected: 'ask', reason: 'too-complex' },
    { command: four, mode: 'default', whole: true, block: false, expected: 'allow', reason: 'rule' },
    { command: four, mode: 'bypassPermissions', whole: false, block: false, expected: 'allow', reason: 'mode' },
    { command: four, mode: 'default', whole: true, block: true, expected: 'ask', reason: 'outsideReadsBlocked' },
    { command: four, mode: 'bypassPermissions', whole: false, block: true, expected: 'ask', reason: 'outsideReadsBlocked' },
  ];
  for (const current of cases) {
    wholeAllow = current.whole;
    const permissions = { ...state(['Bash(no-match:*)']), mode: current.mode, servedCall: false,
      isBypassPermissionsModeAvailable: false, blockReadsOutsideWorkingDirectories: current.block,
      alwaysAllowRules: { userSettings: [`Bash(${current.command})`] } };
    const context = { state: permissions, abortController: { signal: { aborted: false } }, options: {} };
    const result = await entry(tool, { command: current.command }, context, undefined, undefined, undefined);
    assert.equal(result.behavior, current.expected, JSON.stringify(current));
    assert.equal(result.decisionReason?.bashMissKind ?? result.decisionReason?.circuitBreaker ?? result.decisionReason?.type,
      current.reason, JSON.stringify(current));
  }
});

test('source scheduler propagates parser aborts as approval requests', async () => {
  const scope = createShellSamplingScope(() => {});
  const run = fixture();
  const recheck = createShellRuleRecheck(store.Gre, store.dA);
  const vector = createShellVectorPolicy(run.policy, (value: State) => value,
    (decision: unknown) => decision, recheck, scope.dO, message);
  const scheduler = createReadingScheduler(vector, (value: State) => value, () => false, scope.OAn);
  const assertAborted = async (command: string) => {
    const result = await scheduler({ command }, state(), undefined, undefined);
    assert.equal(result.behavior, 'ask');
    assert.equal(result.decisionReason.bashMissKind, 'too-complex');
    assert.equal(result.decisionReason.reason, 'Parser aborted (timeout, resource limit, or over-length)');
  };
  await assertAborted('x'.repeat(10001));
  const parser = vS();
  const parse = parser.parse;
  try {
    parser.parse = () => null;
    await assertAborted('echo parser-null');
    parser.parse = () => { throw new Error('fixture parse failure'); };
    await assertAborted('echo parser-error');
  } finally {
    parser.parse = parse;
  }
  assert.deepEqual(run.calls, ['complex', 'complex', 'complex']);
  assert.equal((await scheduler({ command: 'echo restored' }, state(), undefined, undefined)).behavior, 'allow');
});

test('source command policy captures declaration prefixes before complex decisions', async () => {
  const run = fixture();
  const positions: { count: number; keeps: boolean[] }[] = [];
  const result = await invoke(run.policy, { command: 'A=1 B=2 C=3 D=4 export X' }, state(),
    (count, keeps) => positions.push({ count, keeps }));
  assert.deepEqual(positions, [{ count: 4, keeps: [false, false, false, false] }]);
  assert.equal(result.behavior, 'allow');
  assert.deepEqual(run.calls, ['compound', 'path', 'nested']);
  const early = { behavior: 'deny', message: 'complex fixture' };
  const blocked = fixture({ complexResult: early });
  assert.equal(await invoke(blocked.policy, { command: 'echo $(printf x)' }, state()), early);
  const tooComplex = fixture();
  const unknown = await invoke(tooComplex.policy, { command: 'echo $(printf x)' }, state());
  assert.equal(unknown.behavior, 'ask');
  assert.equal(unknown.decisionReason.bashMissKind, 'too-complex');
  assert.deepEqual(tooComplex.calls, ['complex']);
});

test('source command policy rechecks denied rules before retaining a semantics ask', async () => {
  const input = { command: 'echo ok; find . -rm' };
  const denied = fixture();
  const result = await invoke(denied.policy, input, state(['Bash(find:*)']));
  assert.equal(result.behavior, 'deny');
  assert.equal(result.decisionReason.rule.ruleValue.ruleContent, 'find:*');
  assert.deepEqual(denied.calls, []);
  const allowed = fixture();
  const answer = await invoke(allowed.policy, input, state());
  assert.equal(answer.behavior, 'ask');
  assert.equal(answer.decisionReason.bashMissKind, 'semantics');
  assert.deepEqual(allowed.calls, ['nested']);
});

test('source command policy preserves nested result and per-call budget', async () => {
  const nested = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'nested', circuitBreaker: 'dangerousRemoval' } };
  const run = fixture({ nestedResult: nested });
  assert.equal(await invoke(run.policy, { command: 'echo ok; find . -rm' }, state()), nested);
  const probe = fixture();
  const input = { command: 'echo ok' };
  assert.equal((await invoke(probe.policy, input, state())).behavior, 'allow');
  assert.deepEqual(probe.calls, ['compound', 'path', 'nested']);
  assert.equal(probe.nestedContexts[0]?.depth, 0);
  assert.equal(probe.nestedContexts[0]?.budget.left, 32);
  assert.equal(probe.nestedContexts[0]?.budget.chars, 20000);
  assert.ok(probe.nestedContexts[0]?.budget.judged instanceof Map);
  assert.ok(probe.nestedContexts[0]?.budget.asked instanceof Map);
  const shared: Budget = { left: 3, chars: 50, judged: new Map(), asked: new Map() };
  await probe.policy(input, state(), undefined, undefined, { depth: 1, budget: shared }, undefined, undefined);
  assert.equal(probe.nestedContexts[1]?.depth, 1);
  assert.equal(probe.nestedContexts[1]?.budget, shared);
});
