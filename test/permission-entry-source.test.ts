import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createPermissionEntry } from '../src/permission-entry-source.js';
import { createPermissionInputParser } from '../src/shell-input-parser-source.js';
import { createReadingScheduler, createShellReadBlockProjection } from '../src/shell-reading-scheduler-source.js';
import { createShellVectorPolicy } from '../src/shell-vector-policy-source.js';

class Aborted extends Error {}
class Interrupted extends Error {}
type Result = { behavior: 'allow' | 'deny' | 'ask' | 'passthrough'; decisionReason?: object; [key: string]: unknown };
type Options = { deny?: object; ask?: object; wholeAllow?: object; mode?: string; allowBypass?: boolean; interaction?: boolean };
function fixture(options: Options = {}) {
  const calls: string[] = [];
  const state = { mode: options.mode ?? 'default', servedCall: false, blockReadsOutsideWorkingDirectories: false,
    isBypassPermissionsModeAvailable: options.allowBypass ?? false };
  const context = { abortController: { signal: { aborted: false } }, state };
  const inputParser = createPermissionInputParser(() => true, () => false, () => {}, {
    Ye: Aborted, au: Interrupted, Uxr: () => false, WWn: 'missing cwd',
  });
  const entry = createPermissionEntry({ ...inputParser, Age: () => { calls.push('record'); },
    BAn: 'fixture approval', Be: 'Bash', Cy: () => false,
    Eh: (_state: object, _tool: object, _input: unknown, behavior: string) => behavior === 'deny' ? options.deny : options.ask,
    Epn: () => undefined, Gp: (tool: { name: string }) => tool.name, M1: () => false,
    M9e: () => undefined, N9: () => options.wholeAllow ?? null, NVt: () => false, Nco: () => false,
    Npn: () => undefined, Opn: () => false, P9e: () => undefined, Qwe: () => undefined,
    RVt: () => false, Rl: (_name: string, reason?: { reason?: string }) => reason?.reason ?? 'fixture approval',
    Rnn: () => false, Rpn: () => undefined, Tge: () => false, Ure: () => false, Wx: () => undefined,
    Xk: () => state.mode, Ye: Aborted, _: JSON.stringify, _V: () => false, a: {}, d: (value: unknown) => value,
    de: () => state, eEt: () => false, f0: (mode: string) => mode, hor: () => undefined, i: () => {},
    jJ: () => undefined, k: () => false, lc: () => options.ask, opn: () => undefined,
    p2e: () => undefined, qe: { isSandboxingEnabled: () => false, isAutoAllowBashIfSandboxedEnabled: () => false },
    sit: () => 'fixture denied', srn: 'fixture reroute', t: () => {}, x9e: () => false,
  });
  let policy: Result = { behavior: 'passthrough' };
  const inputSchema = z.object({ command: z.string() }).strict();
  const tool = { name: 'Bash', inputSchema, requiresUserInteraction: () => options.interaction === true,
    async checkPermissions(input: unknown) { calls.push('policy'); return { ...policy, checkedInput: input }; } };
  const run = (input: unknown = { command: 'echo ok' }, flags?: { crashIsObjection: boolean }) =>
    entry(tool, input, context, undefined, undefined, flags);
  return { run, calls, context, tool, setResult: (value: Result) => { policy = value; } };
}

test('outer permission entry preserves denials and whole-tool ask precedence', async () => {
  const deniedRule = { ruleBehavior: 'deny', ruleValue: { toolName: 'Bash' } };
  const denied = fixture({ deny: deniedRule });
  const denial = await denied.run();
  assert.equal(denial.behavior, 'deny');
  assert.equal(denial.decisionReason.rule, deniedRule);
  assert.deepEqual(denied.calls, []);
  const askRule = { ruleBehavior: 'ask', ruleValue: { toolName: 'Bash' } };
  const held = fixture({ ask: askRule });
  held.setResult({ behavior: 'deny', message: 'tool denial' });
  assert.equal((await held.run()).behavior, 'deny');
  held.setResult({ behavior: 'ask', message: 'tool question', suggestions: ['fixture'] });
  const question = await held.run();
  assert.equal(question.behavior, 'ask');
  assert.equal(question.matchedAskRule, askRule);
  assert.equal('suggestions' in question, false);
  held.setResult({ behavior: 'allow' });
  const ask = await held.run();
  assert.equal(ask.behavior, 'ask');
  assert.equal(ask.decisionReason.rule, askRule);
  assert.deepEqual(held.calls, ['policy', 'record', 'policy', 'record', 'policy', 'record']);
});

test('outer permission entry keeps parsed input, incomplete checks and failure posture', async () => {
  const run = fixture();
  const input = { command: 'echo ok', extra: 'discard' };
  const updated = { command: 'echo normalized' };
  run.setResult({ behavior: 'allow', updatedInput: updated });
  const incomplete = await run.run(input);
  assert.equal(incomplete.behavior, 'ask');
  assert.equal(incomplete.checkIncomplete, true);
  assert.deepEqual(input, { command: 'echo ok', extra: 'discard' });
  run.setResult({ behavior: 'deny', message: 'parsed denial' });
  const denied = await run.run(input);
  assert.equal(denied.behavior, 'deny');
  assert.deepEqual(denied.checkedInput, { command: 'echo ok' });
  assert.equal('checkIncomplete' in denied, false);
  assert.deepEqual(run.calls, ['policy', 'record', 'policy', 'record']);
  const wholeAllow = fixture({ wholeAllow: { ruleBehavior: 'allow', ruleValue: { toolName: 'Bash' } } });
  wholeAllow.setResult({ behavior: 'allow', updatedInput: updated });
  const allowed = await wholeAllow.run();
  assert.equal(allowed.behavior, 'allow');
  assert.equal(allowed.updatedInput, updated);
  const parseFailure = fixture();
  parseFailure.setResult({ behavior: 'allow' });
  assert.equal((await parseFailure.run({ command: 42 })).checkIncomplete, true);
  assert.deepEqual(parseFailure.calls, []);
  const failing = fixture();
  failing.tool.checkPermissions = async () => { throw new Error('fixture failure'); };
  assert.equal((await failing.run()).checkIncomplete, true);
  const objection = await failing.run(undefined, { crashIsObjection: true });
  assert.equal(objection.behavior, 'ask');
  assert.equal(objection.decisionReason.reason, 'permission_check_crashed');
  Object.assign(failing.tool, { permissionCheckFailureDecision: () => ({ behavior: 'deny', message: 'failure posture' }) });
  const closed = await failing.run();
  assert.equal(closed.behavior, 'deny');
  assert.equal(closed.message, 'failure posture');
  const hard = fixture({ mode: 'bypassPermissions', allowBypass: true });
  hard.tool.checkPermissions = async () => { throw new Error('fixture failure'); };
  Object.assign(hard.tool, { permissionCheckFailureDecision: () => ({ behavior: 'deny', message: 'failure posture' }) });
  assert.equal((await hard.run()).behavior, 'deny');
  const cancelled = fixture();
  cancelled.context.abortController.signal.aborted = true;
  await assert.rejects(cancelled.run(), Aborted);
  assert.deepEqual(cancelled.calls, []);
  const nonExhaustive = fixture();
  const checked = { behavior: 'allow', decisionReason: { type: 'other', reason: 'fixture reading' } };
  const scheduler = createReadingScheduler(async (_input: object, _context: object, _helper: unknown,
    _parent: unknown, _scope: unknown, vector: boolean[] | undefined, capture?: (count: number, keeps: boolean[]) => void) => {
    if (vector === undefined) capture?.(4, [false, false, false, false]);
    return checked;
  }, () => nonExhaustive.context.state, () => false, (run: () => Promise<unknown>) => run());
  nonExhaustive.tool.checkPermissions = input => scheduler(input, nonExhaustive.context, undefined, undefined);
  const result = await nonExhaustive.run();
  assert.equal(result.behavior, 'ask');
  assert.equal(result.decisionReason.bashMissKind, 'too-complex');
  assert.equal(result.decisionReason.reason, "Variables set in front of a declaration in this command can't all be checked before it runs");
});

test('outer permission entry keeps protected asks in bypass mode', async () => {
  const bypass = fixture({ mode: 'bypassPermissions', allowBypass: true });
  const input = { command: 'echo ok' };
  const protectedReason = { type: 'safetyCheck', reason: 'outside read', circuitBreaker: 'outsideReadsBlocked' };
  bypass.setResult({ behavior: 'ask', decisionReason: protectedReason });
  const protectedAsk = await bypass.run(input);
  assert.equal(protectedAsk.behavior, 'ask');
  assert.equal(protectedAsk.decisionReason, protectedReason);
  bypass.setResult({ behavior: 'ask', decisionReason: { type: 'other', reason: 'ordinary ask' } });
  const ordinary = await bypass.run(input);
  assert.equal(ordinary.behavior, 'allow');
  assert.equal(ordinary.updatedInput, input);
  assert.equal(ordinary.decisionReason.mode, 'bypassPermissions');
  const sandbox = { type: 'sandboxOverride', reason: 'sandbox override' };
  bypass.context.state.blockReadsOutsideWorkingDirectories = true;
  bypass.setResult({ behavior: 'ask', decisionReason: sandbox });
  const sandboxAsk = await bypass.run(input);
  assert.equal(sandboxAsk.behavior, 'ask');
  assert.equal(sandboxAsk.decisionReason, sandbox);
  const raw = { behavior: 'ask', message: 'cannot parse',
    decisionReason: { type: 'other', reason: 'cannot parse', bashMissKind: 'too-complex' } };
  const projection = createShellReadBlockProjection(() => false);
  const vector = createShellVectorPolicy(async () => raw, () => bypass.context.state,
    projection, (result: Result) => result, () => {}, () => 'fixture');
  const scheduler = createReadingScheduler(vector, () => bypass.context.state, () => false, (run: () => Promise<unknown>) => run());
  bypass.tool.checkPermissions = input => scheduler(input, bypass.context, undefined, undefined);
  const blocked = await bypass.run(input);
  assert.equal(blocked.behavior, 'ask');
  assert.equal(blocked.decisionReason.type, 'safetyCheck');
  assert.equal(blocked.decisionReason.circuitBreaker, 'outsideReadsBlocked');
  assert.equal(blocked.decisionReason.classifierApprovable, false);
  assert.match(blocked.message, /under the read block/);
  const exempted = createShellReadBlockProjection(() => true);
  assert.equal(exempted(raw, input, bypass.context.state), raw);
  const interactive = fixture({ mode: 'bypassPermissions', allowBypass: true, interaction: true });
  interactive.setResult({ behavior: 'allow' });
  const question = await interactive.run(input);
  assert.equal(question.behavior, 'ask');
  assert.equal(question.decisionReason.reason, 'requiresUserInteraction');
});
