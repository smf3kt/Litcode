import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadingScheduler } from '../src/shell-reading-scheduler-source.js';

type Decision = { behavior: string; message?: string; decisionReason?: { type: string; reason?: string; bashMissKind?: string; rule?: { ruleBehavior: string } } };
type Checker = (input: object, context: object, helper: object, parent: undefined, scope: undefined,
  vector: boolean[] | undefined, capture?: (count: number, keeps: boolean[]) => void) => Promise<Decision>;
const context = (blocked = false) => ({ permissions: { blockReadsOutsideWorkingDirectories: blocked } });
const project = (value: ReturnType<typeof context>) => value.permissions;
const identityScope = (run: () => Promise<Decision>) => run();
const noExemption = (_input: object) => false;
const makeScheduler = (check: Checker, exempt = noExemption, scope = identityScope) =>
  createReadingScheduler(check, project, exempt, scope);
const allow: Decision = { behavior: 'allow' };

test('scheduler observes every vector sequentially and downgrades an incomplete soft ask', async () => {
  const visited: string[] = [];
  let active = false;
  const input = { command: 'fixture' };
  const helper = {};
  const permissionContext = context();
  const checker: Checker = async (actualInput, actualContext, actualHelper, parent, scope, vector, capture) => {
    assert.equal(actualInput, input);
    assert.equal(actualContext, permissionContext);
    assert.equal(actualHelper, helper);
    assert.equal(parent, undefined);
    assert.equal(scope, undefined);
    assert.equal(active, false);
    active = true;
    visited.push(vector === undefined ? 'initial' : vector.map(Number).join(''));
    if (vector === undefined) {
      assert.equal(typeof capture, 'function');
      capture?.(4, [false, false, false, false]);
    } else assert.equal(capture, undefined);
    await Promise.resolve();
    active = false;
    return allow;
  };
  const projected: Decision[] = [];
  let scoped = 0;
  const schedule = makeScheduler(checker, noExemption, async run => { scoped++; return run(); });
  const result = await schedule(input, permissionContext, helper, (value: Decision) => { projected.push(value); return value; });
  assert.deepEqual(visited, ['initial', '0000', '1111', '1000', '0100', '0010', '0001']);
  assert.equal(scoped, 6);
  assert.equal(projected.length, 7);
  assert.ok(projected.every(value => value === allow));
  assert.deepEqual(result, { behavior: 'passthrough',
    message: "Variables set in front of a declaration in this command can't all be checked before it runs",
    decisionReason: { type: 'other', reason: "Variables set in front of a declaration in this command can't all be checked before it runs", bashMissKind: 'too-complex' } });
});

test('scheduler retains source decision identity, read-block projection and errors', async () => {
  const input = { command: 'fixture' };
  const helper = {};
  const hard: Decision = { behavior: 'ask', decisionReason: { type: 'rule' } };
  const deny: Decision = { behavior: 'deny' };
  const noPrefixes: Checker = async () => hard;
  assert.equal(await makeScheduler(noPrefixes)(input, context(), helper, undefined), hard);
  let count = 0;
  const denial: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(1, [false]);
    count++;
    return vector?.[0] === true ? deny : allow;
  };
  assert.equal(await makeScheduler(denial)(input, context(), helper, undefined), deny);
  assert.equal(count, 3);
  const soft: Decision = { behavior: 'ask', message: 'existing soft ask', decisionReason: { type: 'other', reason: 'existing soft ask' } };
  const primarySoft: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(1, [false]);
    return vector === undefined ? soft : allow;
  };
  assert.equal(await makeScheduler(primarySoft)(input, context(), helper, undefined), soft);
  const four: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(4, [false, false, false, false]);
    return allow;
  };
  const reason = "Variables set in front of a declaration in this command can't all be checked before it runs";
  const message = `${reason}; under the read block (permissions.blockReadsOutsideWorkingDirectories) a command the shell parser cannot analyze asks the person`;
  let exemptCalls = 0;
  let contextCalls = 0;
  const blockedContext = context(true);
  const scheduleBlocked = createReadingScheduler(four, (actual: ReturnType<typeof context>) => {
    assert.equal(actual, blockedContext);
    contextCalls++;
    return actual.permissions;
  }, (actual: object) => { assert.equal(actual, input); exemptCalls++; return false; }, identityScope);
  const held = await scheduleBlocked(input, blockedContext, helper, undefined);
  assert.equal(contextCalls, 1);
  assert.equal(exemptCalls, 1);
  assert.deepEqual(held, { behavior: 'ask', message, decisionReason: { type: 'safetyCheck', reason: message,
    classifierApprovable: false, circuitBreaker: 'outsideReadsBlocked' }, suggestions: [] });
  const exempted = await makeScheduler(four, actual => { assert.equal(actual, input); return true; })(input, context(true), helper, undefined);
  assert.equal(exempted.behavior, 'passthrough');
  const three: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(3, [false, false, false]);
    return allow;
  };
  assert.equal(await makeScheduler(three)(input, context(), helper, undefined), allow);
  const incomplete: Decision = { behavior: 'passthrough', message: 'baseline passthrough' };
  const initialPassthrough: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) { capture?.(4, [false, false, false, false]); return incomplete; }
    return allow;
  };
  assert.equal(await makeScheduler(initialPassthrough)(input, context(), helper, undefined), incomplete);
  const ruleAsk: Decision = { behavior: 'ask', decisionReason: { type: 'rule', rule: { ruleBehavior: 'ask' } } };
  const hardAlternate: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(1, [false]);
    return vector?.[0] ? ruleAsk : allow;
  };
  assert.equal(await makeScheduler(hardAlternate)(input, context(), helper, undefined), ruleAsk);
  const ruleWithMiss: Decision = { behavior: 'ask', message: 'rule ask',
    decisionReason: { type: 'rule', rule: { ruleBehavior: 'ask' }, bashMissKind: 'too-complex' } };
  const hardAlternateWithMiss: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(1, [false]);
    return vector?.[0] ? ruleWithMiss : allow;
  };
  assert.equal(await makeScheduler(hardAlternateWithMiss)(input, context(true), helper, undefined), ruleWithMiss);
  const semantics: Decision = { behavior: 'ask', message: 'semantics miss',
    decisionReason: { type: 'other', reason: 'semantics miss', bashMissKind: 'semantics' } };
  const allowedMiss: Decision = { behavior: 'ask', message: 'flag miss',
    decisionReason: { type: 'other', reason: 'flag miss', bashMissKind: 'flag-validation' } };
  const rawAsk: Decision = { behavior: 'ask', message: 'raw ask' };
  const withoutMiss: Decision = { behavior: 'ask', message: 'other ask', decisionReason: { type: 'other', reason: 'other ask' } };
  const oneAlternate = (alternate: Decision): Checker => async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) capture?.(1, [false]);
    return vector?.[0] ? alternate : allow;
  };
  const heldSemantics = await makeScheduler(oneAlternate(semantics))(input, context(true), helper, undefined);
  const semanticsMessage = 'semantics miss; under the read block (permissions.blockReadsOutsideWorkingDirectories) a command the shell parser cannot analyze asks the person';
  assert.deepEqual(heldSemantics, { behavior: 'ask', message: semanticsMessage,
    decisionReason: { type: 'safetyCheck', reason: semanticsMessage, classifierApprovable: false, circuitBreaker: 'outsideReadsBlocked' }, suggestions: [] });
  for (const alternate of [allowedMiss, rawAsk, withoutMiss]) {
    const result = await makeScheduler(oneAlternate(alternate))(input, context(true), helper, undefined);
    assert.deepEqual(result, { behavior: 'passthrough', message: alternate.message,
      ...(alternate.decisionReason ? { decisionReason: alternate.decisionReason } : {}) });
  }
  const projectionChecker: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) { capture?.(1, [false]); return allow; }
    return vector[0] ? { behavior: 'allow', message: 'project me' } : allow;
  };
  assert.equal(await makeScheduler(projectionChecker)(input, context(), helper,
    (value: Decision) => value.message === 'project me' ? deny : value), deny);
  const initial: Decision = { behavior: 'allow', message: 'initial projection' };
  const initialProjection: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    if (vector === undefined) { capture?.(1, [false]); return initial; }
    return allow;
  };
  assert.equal(await makeScheduler(initialProjection)(input, context(), helper,
    (value: Decision) => value === initial ? deny : value), deny);
  const fail = new Error('sample failed');
  let visited = 0;
  const failing: Checker = async (_input, _context, _helper, _parent, _scope, vector, capture) => {
    visited++;
    if (vector === undefined) capture?.(1, [false]);
    else throw fail;
    return allow;
  };
  await assert.rejects(makeScheduler(failing)(input, context(), helper, undefined), error => error === fail);
  assert.equal(visited, 2);
});

test('scheduler keeps overlapping calls and their captured vectors separate', async () => {
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const firstInput = { command: 'first' };
  const secondInput = { command: 'second' };
  const firstResult: Decision = { behavior: 'allow', message: 'first' };
  const secondResult: Decision = { behavior: 'allow', message: 'second' };
  const visited = { first: [] as string[], second: [] as string[] };
  const checker: Checker = async (input, _context, _helper, _parent, _scope, vector, capture) => {
    assert.ok(input === firstInput || input === secondInput);
    const first = input === firstInput;
    const key = first ? 'first' : 'second';
    visited[key].push(vector === undefined ? 'initial' : vector.map(Number).join(''));
    if (vector === undefined) {
      if (first) { capture?.(1, [false]); entered(); await waiting; }
      else capture?.(2, [false, false]);
    } else assert.equal(capture, undefined);
    return first ? firstResult : secondResult;
  };
  const schedule = makeScheduler(checker);
  const pending = schedule(firstInput, context(), {}, undefined);
  await started;
  assert.equal(await schedule(secondInput, context(), {}, undefined), secondResult);
  release();
  assert.equal(await pending, firstResult);
  assert.deepEqual(visited, { first: ['initial', '0', '1'], second: ['initial', '00', '10', '01', '11'] });
});
