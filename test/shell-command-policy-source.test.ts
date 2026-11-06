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
import { Ye } from '../src/plugin-chain-source.js';
import { E6 } from '../src/shell-analyser-source.js';
import { w6 } from '../src/shell-command-clamp-source.js';
import { createShellComplexPolicy } from '../src/shell-complex-policy-source.js';

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
  vector?: (...args: unknown[]) => unknown; fallback?: (...args: unknown[]) => unknown;
  Dl?: (reason: { type?: string } | undefined) => unknown;
  projection?: { RTr: (...args: unknown[]) => unknown;
    CX: () => boolean; A3e: (...args: unknown[]) => unknown } } = {}) {
  const calls: string[] = [];
  const nestedContexts: { depth: number; budget: Budget }[] = [];
  const policy = createShellCommandPolicy({
    $3e: () => null, A3e: () => { throw new Error('unexpected aggregate'); }, ATr: () => false,
    CTr: async () => true, CX: () => false, Cwe: () => false, Cy: () => false, Dcn: () => null,
    Dl: options.Dl ?? (() => undefined), EX: () => false, Edo: () => 'fixture', Fwe: () => true,
    GTr: rules.GTr, MO: (value: string) => value, MTr: async () => { calls.push('complex'); return options.complexResult ?? null; },
    Mcn: options.fallback ?? (() => passthrough), Mk: () => new Set(['/fixture']), N3e: () => null,
    Nwe: async (_command: string, nested: { depth: number; budget: Budget }) => {
      calls.push('nested'); nestedContexts.push(nested); return options.nestedResult ?? null;
    },
    O: () => 'linux', O3e: options.vector ?? (async () => { throw new Error('unexpected compound evaluation'); }),
    PTr: () => false, Q$: () => false, QHe: () => false, RTr: (texts: string[], commands: object[]) => ({ subcommands: texts, astCommandsByIdx: commands }),
    RX: () => false, Rcn: options.compound ?? (async () => { calls.push('compound'); return passthrough; }), Rl: message,
    Sun: () => false, TVt, Tv: () => false, Uwe: rules.Uwe,
    VW: (reason: string) => ({ behavior: 'ask', decisionReason: { type: 'safetyCheck', reason, circuitBreaker: 'outsideReadsBlocked' } }),
    X3: () => false, X5e: () => passthrough, XYt: () => [], Xcn: async () => null, Y5e: () => false,
    YTr: 'fixture', Ye, _Tr: () => null, _n: (value: unknown) => String(value),
    _un: () => {}, arn: () => ({ behavior: 'ask' }), bG: () => passthrough, bL: (value: string[]) => value,
    bwe: () => false, d: () => 'fixture', dO: () => {}, de: (value: State) => value,
    e$: () => undefined, ie: () => ({}), jcn: options.single ?? (() => ({ behavior: 'allow', decisionReason: { type: 'other', reason: 'fixture' } })),
    k: () => false, ki: { name: 'Bash' }, oTr: 100, pTr: () => false, pwe: (value: unknown) => value,
    qe: { isSandboxingEnabled: () => false, isAutoAllowBashIfSandboxedEnabled: () => false },
    ...options.projection,
    se: () => '/fixture', to: (value: string) => value, u3e: () => false,
    vX: () => { calls.push('path'); return passthrough; }, wR: () => ({}), x3e: () => null,
    xTr: () => false, xwe: () => true, yo: (_fs: object, value: string) => ({ resolvedPath: value }), yw: () => false,
  });
  return { calls, nestedContexts, policy };
}
const invoke = (policy: ReturnType<typeof createShellCommandPolicy>, input: { command: string }, value: State,
  capture?: (count: number, keeps: boolean[]) => void) =>
  policy(input, value, undefined, undefined, undefined, undefined, capture);

test('copied parser and command aggregation retain outer shell keys under injected feature state', async () => {
  const command = 'bash -c "printf hello"';
  const parsed = E6(command, await w6(command));
  assert.equal(parsed.kind, 'simple');
  assert.deepEqual(parsed.commands.map((item: { argv: string[] }) => item.argv), [['bash', '-c', 'printf hello']]);
  const unused = () => { throw new Error('unexpected complex-policy dependency'); };
  const complex = createShellComplexPolicy({ ...rules, ...store, $3e: unused, dO: unused, d: unused,
    pwe: unused, Xcn: unused, se: unused, jcn: unused });
  const texts = parsed.commands.map((item: { text: string }) => item.text);
  const projected = complex.RTr(texts, parsed.commands, '/fixture', '/other');
  assert.deepEqual(projected.subcommands, [command]);
  assert.equal(projected.astCommandsByIdx[0], parsed.commands[0]);

  for (const enabled of [false, true]) {
    const featureCalls: unknown[][] = [];
    const compound = createShellCompoundPolicy({ cd: (...args: unknown[]) => { featureCalls.push(args); return enabled; },
      Cwe: () => false, EX: () => false, se: () => '/fixture', Rl: message });
    for (const behavior of ['allow', 'deny'] as const) {
      const decision = { behavior, decisionReason: { type: 'other', reason: 'fixture' } };
      const run = fixture({ single: () => decision,
        projection: { RTr: complex.RTr, CX: compound.CX, A3e: compound.A3e } });
      const result = await invoke(run.policy, { command }, state());
      assert.equal(result.behavior, behavior);
      assert.deepEqual([...result.decisionReason.reasons.keys()], [command]);
      assert.equal(result.decisionReason.reasons.get(command), decision);
    }
    const repeated = 'printf hi > a; printf hi; printf hi';
    for (const behavior of ['allow', 'deny'] as const) {
      const decision = { behavior, decisionReason: { type: 'other', reason: 'fixture' } };
      const run = fixture({ single: () => decision,
        projection: { RTr: complex.RTr, CX: compound.CX, A3e: compound.A3e } });
      const result = await invoke(run.policy, { command: repeated }, state());
      assert.equal(result.behavior, behavior);
      assert.deepEqual([...result.decisionReason.reasons.keys()], enabled
        ? ['printf hi > a', 'printf hi', 'printf hi #2'] : ['printf hi']);
    }
    assert.deepEqual(featureCalls, Array.from({ length: 4 }, () =>
      ['tengu_moonlit_kettle', { safe: true }]));
    const decisions = [{ behavior: 'allow' }, { behavior: 'deny' }, { behavior: 'allow' }];
    const duplicateKeys = compound.A3e(['printf hi', 'printf hi', 'printf hi'],
      [{ redirects: [{ fd: 2, op: '>', target: 'a' }] }, { redirects: [] }, { redirects: [] }], decisions);
    assert.deepEqual([...duplicateKeys.keys()], ['printf hi 2> a', 'printf hi', 'printf hi #2']);
    assert.deepEqual([...duplicateKeys.values()], decisions);
  }
});

test('D3e aggregates mixed Mcn decisions after the initial early-return gates', async () => {
  const command = 'printf hi > a; printf hi; printf hi; echo end';
  const initialAsk = { behavior: 'ask', decisionReason: { type: 'other', reason: 'initial' } };
  const initialPass = { behavior: 'passthrough' };
  const later = [
    { behavior: 'allow' },
    { behavior: 'deny', message: 'later denial' },
    { behavior: 'ask', decisionReason: { type: 'rule' } },
    { behavior: 'allow' },
  ];
  for (const hasInitialAsk of [false, true]) {
    let singleCalls = 0;
    let fallbackCalls = 0;
    const seen: string[] = [];
    const single = (input: unknown) => {
      const item = input as { command: string };
      singleCalls++;
      if (singleCalls <= 4) return hasInitialAsk && singleCalls === 1 ? initialAsk : initialPass;
      seen.push(item.command);
      return later[fallbackCalls++];
    };
    const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
      d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
    const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
      se: () => '/fixture', Rl: message });
    const run = fixture({ single, fallback: (...args: unknown[]) => Reflect.apply(complex.Mcn, undefined, args),
      projection: { RTr: complex.RTr, CX: compound.CX, A3e: compound.A3e } });
    const result = await invoke(run.policy, { command }, state());
    assert.equal(singleCalls, 8);
    assert.deepEqual(seen, ['printf hi', 'printf hi', 'printf hi', 'echo end']);
    assert.equal(result.behavior, hasInitialAsk ? 'ask' : 'passthrough');
    assert.deepEqual([...result.decisionReason.reasons.entries()], [
      ['printf hi', later[1]], ['echo end', later[3]],
    ]);
  }
});

test('D3e replaces an equal-priority result when only the newcomer has a safety-check reason', async () => {
  const command = 'printf hi > a; printf hi; printf hi; echo end';
  const plain = { behavior: 'ask', decisionReason: { type: 'other', reason: 'plain' } };
  const safety = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'safety', circuitBreaker: 'fixture' } };
  const allow = { behavior: 'allow' };
  const later = [plain, safety, safety, allow];
  let fallbackCalls = 0;
  const seen: string[] = [];
  const single = () => ({ behavior: 'passthrough' });
  const fallback = (input: unknown) => {
    const item = input as { command: string };
    seen.push(item.command);
    return later[fallbackCalls++];
  };
  const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
    d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
  const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: message });
  const run = fixture({ single, fallback,
    Dl: (reason) => reason?.type === 'safetyCheck' ? reason : undefined,
    projection: { RTr: complex.RTr, CX: compound.CX, A3e: compound.A3e } });
  const result = await invoke(run.policy, { command }, state());
  assert.deepEqual(seen, ['printf hi', 'printf hi', 'printf hi', 'echo end']);
  assert.equal(result.behavior, 'passthrough');
  assert.equal(result.decisionReason.reasons.get('printf hi'), safety);
  assert.notEqual(result.decisionReason.reasons.get('printf hi'), plain);
});

test('D3e replaces an equal-priority Mcn result only when the newcomer alone has a Dl reason', async () => {
  const command = 'printf hi; printf hi; echo end';
  const withoutReason = { behavior: 'ask', decisionReason: { type: 'other', reason: 'without' } };
  const withReason = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'with', circuitBreaker: 'fixture' } };
  const priorWithReason = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'prior', circuitBreaker: 'fixture' } };
  const allow = { behavior: 'allow' };
  const sequences = {
    replace: [withoutReason, withReason, allow],
    keep: [priorWithReason, withoutReason, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    let fallbackCalls = 0;
    const seen: string[] = [];
    const single = () => ({ behavior: 'passthrough' });
    const fallback = (input: unknown) => {
      const item = input as { command: string };
      seen.push(item.command);
      return later[fallbackCalls++];
    };
    const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
      d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
    const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
      se: () => '/fixture', Rl: message });
    const run = fixture({ single, fallback, Dl,
      projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
    const result = await invoke(run.policy, { command }, state());
    assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
    assert.equal(result.behavior, 'passthrough');
    const kept = result.decisionReason.reasons.get('printf hi');
    assert.equal(kept, name === 'keep' ? priorWithReason : withReason);
    assert.notEqual(kept, name === 'keep' ? withoutReason : withoutReason);
  }
});

test('D3e replaces a same-key result by behavior rank even when only the lower rank has a Dl reason', async () => {
  const command = 'printf hi; printf hi; echo end';
  const lowWithReason = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'low', circuitBreaker: 'fixture' } };
  const highWithoutReason = { behavior: 'deny', message: 'higher rank' };
  const lowNewcomerWithReason = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'lower newcomer', circuitBreaker: 'fixture' } };
  const allow = { behavior: 'allow' };
  const sequences = {
    upgrade: [lowWithReason, highWithoutReason, allow],
    downgrade: [highWithoutReason, lowNewcomerWithReason, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    let fallbackCalls = 0;
    const seen: string[] = [];
    const single = () => ({ behavior: 'passthrough' });
    const fallback = (input: unknown) => {
      const item = input as { command: string };
      seen.push(item.command);
      return later[fallbackCalls++];
    };
    const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
      d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
    const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
      se: () => '/fixture', Rl: message });
    const run = fixture({ single, fallback, Dl,
      projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
    const result = await invoke(run.policy, { command }, state());
    assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
    assert.equal(result.behavior, 'passthrough');
    const kept = result.decisionReason.reasons.get('printf hi');
    assert.equal(kept, highWithoutReason);
    assert.notEqual(kept, name === 'upgrade' ? lowWithReason : lowNewcomerWithReason);
    assert.equal(result.decisionReason.reasons.get('echo end'), allow);
  }
});

test('D3e replaces a same-key result by the next adjacent behavior rank and keeps the prior object when the newcomer is lower', async () => {
  const command = 'printf hi; printf hi; echo end';
  const passthroughWithReason = { behavior: 'passthrough', decisionReason: { type: 'safetyCheck', reason: 'pass', circuitBreaker: 'fixture' } };
  const askWithoutReason = { behavior: 'ask', decisionReason: { type: 'other', reason: 'ask' } };
  const askWithReason = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'ask', circuitBreaker: 'fixture' } };
  const denyWithoutReason = { behavior: 'deny', message: 'deny' };
  const allow = { behavior: 'allow' };
  const sequences = {
    'passthrough-to-ask': [passthroughWithReason, askWithoutReason, allow],
    'ask-to-deny': [askWithReason, denyWithoutReason, allow],
  };
  const reverse = {
    'passthrough-to-ask': [askWithoutReason, passthroughWithReason, allow],
    'ask-to-deny': [denyWithoutReason, askWithReason, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    for (const direction of ['upgrade', 'downgrade'] as const) {
      let fallbackCalls = 0;
      const seen: string[] = [];
      const injected = direction === 'upgrade' ? later : reverse[name as keyof typeof reverse];
      const single = () => ({ behavior: 'passthrough' });
      const fallback = (input: unknown) => {
        const item = input as { command: string };
        seen.push(item.command);
        return injected[fallbackCalls++];
      };
      const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
        d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
      const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
        se: () => '/fixture', Rl: message });
      const run = fixture({ single, fallback, Dl,
        projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
      const result = await invoke(run.policy, { command }, state());
      assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
      assert.equal(result.behavior, 'passthrough');
      const kept = result.decisionReason.reasons.get('printf hi');
      const first = injected[0];
      const second = injected[1];
      // Do>fo stores the higher-ranked object regardless of arrival order.
      assert.equal(kept, direction === 'upgrade' ? second : first);
      assert.notEqual(kept, direction === 'upgrade' ? first : second);
      assert.equal(result.decisionReason.reasons.get('echo end'), allow);
    }
  }
});

test('D3e keeps the higher-ranked same-key object across passthrough/deny and allow/passthrough even when only the lower rank has a Dl reason', async () => {
  const command = 'printf hi; printf hi; echo end';
  const passthroughWithReason = { behavior: 'passthrough', decisionReason: { type: 'safetyCheck', reason: 'pass', circuitBreaker: 'fixture' } };
  const denyWithoutReason = { behavior: 'deny', message: 'deny' };
  const allowWithReason = { behavior: 'allow', decisionReason: { type: 'safetyCheck', reason: 'allow', circuitBreaker: 'fixture' } };
  const passthroughWithoutReason = { behavior: 'passthrough', decisionReason: { type: 'other', reason: 'pass' } };
  const allow = { behavior: 'allow' };
  const sequences = {
    'passthrough-to-deny': [passthroughWithReason, denyWithoutReason, allow],
    'allow-to-passthrough': [allowWithReason, passthroughWithoutReason, allow],
  };
  const reverse = {
    'passthrough-to-deny': [denyWithoutReason, passthroughWithReason, allow],
    'allow-to-passthrough': [passthroughWithoutReason, allowWithReason, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    for (const direction of ['upgrade', 'downgrade'] as const) {
      let fallbackCalls = 0;
      const seen: string[] = [];
      const injected = direction === 'upgrade' ? later : reverse[name as keyof typeof reverse];
      const single = () => ({ behavior: 'passthrough' });
      const fallback = (input: unknown) => {
        const item = input as { command: string };
        seen.push(item.command);
        return injected[fallbackCalls++];
      };
      const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
        d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
      const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
        se: () => '/fixture', Rl: message });
      const run = fixture({ single, fallback, Dl,
        projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
      const result = await invoke(run.policy, { command }, state());
      assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
      assert.equal(result.behavior, 'passthrough');
      const kept = result.decisionReason.reasons.get('printf hi');
      const first = injected[0];
      const second = injected[1];
      // Do>fo stores the later higher-ranked object; a lower newcomer keeps the earlier one.
      assert.equal(kept, direction === 'upgrade' ? second : first);
      assert.notEqual(kept, direction === 'upgrade' ? first : second);
      assert.equal(result.decisionReason.reasons.get('echo end'), allow);
    }
  }
});

test('D3e keeps the higher-ranked same-key object across allow/ask and allow/deny even when only the lower rank has a Dl reason', async () => {
  const command = 'printf hi; printf hi; echo end';
  const allowWithReason = { behavior: 'allow', decisionReason: { type: 'safetyCheck', reason: 'allow', circuitBreaker: 'fixture' } };
  const askWithoutReason = { behavior: 'ask', message: 'ask' };
  const denyWithoutReason = { behavior: 'deny', message: 'deny' };
  const askWithReason = { behavior: 'ask', message: 'ask', decisionReason: { type: 'safetyCheck', reason: 'ask', circuitBreaker: 'fixture' } };
  const denyWithReason = { behavior: 'deny', message: 'deny', decisionReason: { type: 'safetyCheck', reason: 'deny', circuitBreaker: 'fixture' } };
  const allowWithoutReason = { behavior: 'allow', decisionReason: { type: 'other', reason: 'allow' } };
  const allow = { behavior: 'allow' };
  const sequences = {
    'allow-to-ask': [allowWithReason, askWithoutReason, allow],
    'allow-to-deny': [allowWithReason, denyWithoutReason, allow],
  };
  const reverse = {
    'allow-to-ask': [askWithReason, allowWithoutReason, allow],
    'allow-to-deny': [denyWithReason, allowWithoutReason, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    for (const direction of ['upgrade', 'downgrade'] as const) {
      let fallbackCalls = 0;
      const seen: string[] = [];
      const injected = direction === 'upgrade' ? later : reverse[name as keyof typeof reverse];
      const single = () => ({ behavior: 'passthrough' });
      const fallback = (input: unknown) => {
        const item = input as { command: string };
        seen.push(item.command);
        return injected[fallbackCalls++];
      };
      const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
        d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
      const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
        se: () => '/fixture', Rl: message });
      const run = fixture({ single, fallback, Dl,
        projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
      const result = await invoke(run.policy, { command }, state());
      assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
      assert.equal(result.behavior, 'passthrough');
      const kept = result.decisionReason.reasons.get('printf hi');
      const first = injected[0];
      const second = injected[1];
      // Do>fo stores the later higher-ranked object; a lower newcomer keeps the earlier one.
      assert.equal(kept, direction === 'upgrade' ? second : first);
      assert.notEqual(kept, direction === 'upgrade' ? first : second);
      assert.equal(result.decisionReason.reasons.get('echo end'), allow);
    }
  }
});

test('D3e keeps the earlier equal-rank object when injected Dl rejects the later safetyCheck', async () => {
  const command = 'printf hi; printf hi; echo end';
  const prior = { behavior: 'ask', decisionReason: { type: 'other', reason: 'prior' } };
  const laterSafety = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'rejected', circuitBreaker: 'fixture' } };
  const allow = { behavior: 'allow' };
  const injected = [prior, laterSafety, allow];
  let fallbackCalls = 0;
  const seen: string[] = [];
  const single = () => ({ behavior: 'passthrough' });
  const fallback = (input: unknown) => {
    const item = input as { command: string };
    seen.push(item.command);
    return injected[fallbackCalls++];
  };
  const accept = () => false;
  const Dl = (reason: { type?: string; reasons?: Map<string, { decisionReason?: unknown }> } | undefined): unknown => {
    if (!reason) return;
    if (reason.type === 'safetyCheck') return accept() ? reason : undefined;
    if (reason.type === 'subcommandResults') {
      for (const item of reason.reasons?.values() ?? []) {
        const found = Dl(item.decisionReason as typeof reason);
        if (found) return found;
      }
    }
  };
  const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
    d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
  const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: message });
  const run = fixture({ single, fallback, Dl,
    projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
  const result = await invoke(run.policy, { command }, state());
  assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
  assert.equal(result.behavior, 'passthrough');
  const kept = result.decisionReason.reasons.get('printf hi');
  // Equal rank and the predicate rejects the newcomer, so the stored object stays.
  assert.equal(kept, prior);
  assert.notEqual(kept, laterSafety);
  assert.equal(result.decisionReason.reasons.get('echo end'), allow);
});

test('D3e stores two different non-allow keys independently and does not let one replace the other', async () => {
  const command = 'printf hi; echo end';
  const askHi = { behavior: 'ask', message: 'ask-hi', decisionReason: { type: 'safetyCheck', reason: 'hi', circuitBreaker: 'fixture' } };
  const denyEnd = { behavior: 'deny', message: 'deny-end' };
  const injected = [askHi, denyEnd];
  let fallbackCalls = 0;
  const seen: string[] = [];
  const single = () => ({ behavior: 'passthrough' });
  const fallback = (input: unknown) => {
    const item = input as { command: string };
    seen.push(item.command);
    return injected[fallbackCalls++];
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
    d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
  const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
    se: () => '/fixture', Rl: message });
  const run = fixture({ single, fallback, Dl,
    projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
  const result = await invoke(run.policy, { command }, state());
  assert.deepEqual(seen, ['printf hi', 'echo end']);
  assert.equal(result.behavior, 'passthrough');
  const reasons = result.decisionReason.reasons;
  assert.equal(reasons.get('printf hi'), askHi);
  assert.equal(reasons.get('echo end'), denyEnd);
  assert.equal(reasons.size, 2);
});

test('D3e uses a nested subcommandResults safety check at equal priority and keeps the prior result when recursion finds none', async () => {
  const command = 'printf hi; printf hi; echo end';
  const nestedSafety = { type: 'safetyCheck', reason: 'nested', circuitBreaker: 'fixture' };
  const outerWithout = { behavior: 'ask', decisionReason: { type: 'other', reason: 'outer' } };
  const nestedWith = {
    behavior: 'ask',
    decisionReason: {
      type: 'subcommandResults',
      reasons: new Map([['inner', { behavior: 'ask', decisionReason: nestedSafety }]]),
    },
  };
  const nestedWithout = {
    behavior: 'ask',
    decisionReason: {
      type: 'subcommandResults',
      reasons: new Map([['inner', { behavior: 'ask', decisionReason: { type: 'other', reason: 'inner' } }]]),
    },
  };
  const allow = { behavior: 'allow' };
  const sequences = {
    replace: [outerWithout, nestedWith, allow],
    keep: [nestedWith, nestedWithout, allow],
  };
  const Dl = (reason: { type?: string; reasons?: Map<string, { decisionReason?: unknown }> } | undefined,
    accept: (value: { type?: string }) => boolean = () => true): unknown => {
    if (!reason) return;
    if (reason.type === 'safetyCheck') return accept(reason) ? reason : undefined;
    if (reason.type === 'subcommandResults') {
      for (const item of reason.reasons?.values() ?? []) {
        const found = Dl(item.decisionReason as typeof reason, accept);
        if (found) return found;
      }
    }
  };
  for (const [name, later] of Object.entries(sequences)) {
    let fallbackCalls = 0;
    const seen: string[] = [];
    const single = () => ({ behavior: 'passthrough' });
    const fallback = (input: unknown) => {
      const item = input as { command: string };
      seen.push(item.command);
      return later[fallbackCalls++];
    };
    const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
      d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
    const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
      se: () => '/fixture', Rl: message });
    const run = fixture({ single, fallback, Dl,
      projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
    const result = await invoke(run.policy, { command }, state());
    assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
    assert.equal(result.behavior, 'passthrough');
    const kept = result.decisionReason.reasons.get('printf hi');
    assert.equal(kept, nestedWith);
    assert.notEqual(kept, name === 'replace' ? outerWithout : nestedWithout);
  }
});

test('D3e keeps the stored object when equal-priority Dl results are both present or both absent', async () => {
  const command = 'printf hi; printf hi; echo end';
  const firstWith = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'first', circuitBreaker: 'fixture' } };
  const secondWith = { behavior: 'ask', decisionReason: { type: 'safetyCheck', reason: 'second', circuitBreaker: 'fixture' } };
  const firstWithout = { behavior: 'ask', decisionReason: { type: 'other', reason: 'first' } };
  const secondWithout = { behavior: 'ask', decisionReason: { type: 'other', reason: 'second' } };
  const allow = { behavior: 'allow' };
  const sequences = {
    both: [firstWith, secondWith, allow],
    neither: [firstWithout, secondWithout, allow],
  };
  const Dl = (reason: { type?: string } | undefined) => reason?.type === 'safetyCheck' ? reason : undefined;
  for (const [name, later] of Object.entries(sequences)) {
    let fallbackCalls = 0;
    const seen: string[] = [];
    const single = () => ({ behavior: 'passthrough' });
    const fallback = (input: unknown) => {
      const item = input as { command: string };
      seen.push(item.command);
      return later[fallbackCalls++];
    };
    const complex = createShellComplexPolicy({ ...rules, ...store, $3e: () => null, dO: () => {},
      d: (value: string) => value, pwe: () => ({}), Xcn: async () => null, se: () => '/fixture', jcn: single });
    const compound = createShellCompoundPolicy({ cd: () => true, Cwe: () => false, EX: () => false,
      se: () => '/fixture', Rl: message });
    const run = fixture({ single, fallback, Dl,
      projection: { RTr: complex.RTr, CX: () => false, A3e: compound.A3e } });
    const result = await invoke(run.policy, { command }, state());
    assert.deepEqual(seen, ['printf hi', 'printf hi', 'echo end']);
    assert.equal(result.behavior, 'passthrough');
    const kept = result.decisionReason.reasons.get('printf hi');
    assert.equal(kept, name === 'both' ? firstWith : firstWithout);
    assert.notEqual(kept, name === 'both' ? secondWith : secondWithout);
    assert.equal(result.decisionReason.reasons.get('echo end'), allow);
  }
});

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

test('source command policy throws the cancellation error after the classifier aborts', async () => {
  const run = fixture({ single: () => passthrough });
  const abortController = new AbortController();
  const context = { ...state(), abortController, options: { isNonInteractiveSession: false } };
  let calls = 0;
  await assert.rejects(run.policy({ command: 'echo cancel' }, context, async (command: string, signal: AbortSignal, nonInteractive: boolean) => {
    calls++;
    assert.equal(command, 'echo cancel');
    assert.equal(signal, abortController.signal);
    assert.equal(nonInteractive, false);
    abortController.abort();
    return null;
  }, undefined, undefined, undefined, undefined), Ye);
  assert.equal(calls, 1);
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
