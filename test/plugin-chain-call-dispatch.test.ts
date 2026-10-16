// W45-70: the `$` call dispatcher and the rules it enforces. Every expected value below was measured
// through the ported bodies before it was written (see .audit/w45-70-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DROPPED_CALLS, ENV_CALLS, STATE_CALLS, admittedCall, callSpelling, copyCallArgs, crashedHolder,
  dispatchCall, droppedCallNotice, firstSegment, isClockCall, isDroppableCall, isEnvCall, isFunnelCall,
  isStateCall, plainOrJsonName, removedByPlugin, scanAllowsCall, scanAllowsEnv, scanAllowsState,
  stateReference, withheldBy, withheldSentence,
} from '../src/plugin-chain-call-dispatch.js';
import type {
  PluginCallCaller, PluginCallChain, PluginCallHolder, PluginCallOp, PluginCallScan, PluginCallState,
} from '../src/plugin-chain-call-dispatch.js';

const scan: PluginCallScan = {
  calls: ['state.get', 'env.get', 'test.op', 'ui.log', 'interface.call'],
  state: { reads: [{ plugin: 'p', key: 'k' }], writes: [{ plugin: 'p', key: 'k' }] },
  env: { reads: ['HOME'], writes: ['PATH'] },
};

const holder = (plugin: string | undefined): PluginCallHolder => ({
  refuser: () => plugin,
});

const freshState = (over: Partial<PluginCallState> = {}): PluginCallState => ({
  knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]),
  refusalsLogged: new Set<string>(),
  crashedWithholders: new Map<string, Set<string>>(),
  building: [],
  withheld: holder(undefined),
  unadmitted: new Set<string>(),
  ...over,
});

const caller: PluginCallCaller = { plugin: 'p', origin: {}, environmentId: 'env-1' };

const withOrder = (): { ops: Record<string, PluginCallOp>; order: string[] } => {
  const order: string[] = [];
  const op = (extra: Partial<PluginCallOp> = {}): PluginCallOp => ({
    check: (args) => (args as { bad?: string } | undefined)?.bad,
    raise: (who) => { order.push('raise'); return { raised: true, who }; },
    stamp: (args) => { order.push('stamp'); return args; },
    run: (args, who) => { order.push('run'); return { args, who }; },
    ...extra,
  });
  return {
    order,
    ops: { 'test.op': op(), 'ui.log': op(), 'env.get': op(), 'state.get': op() },
  };
};

describe('the name lists and the predicates under them', () => {
  it('covers the two environment calls and the two state calls', () => {
    assert.deepEqual(ENV_CALLS, ['env.get', 'env.set']);
    assert.deepEqual(STATE_CALLS, ['state.get', 'state.set']);
    assert.equal(isEnvCall('env.get'), true);
    assert.equal(isEnvCall('state.get'), false);
    assert.equal(isStateCall('state.get'), true);
    assert.equal(isStateCall('env.get'), false);
  });

  it('holds five dropped calls, and ui.log is one while env.get is not', () => {
    assert.equal(DROPPED_CALLS.length, 5);
    assert.equal(isDroppableCall('ui.log'), true);
    assert.equal(isDroppableCall('env.get'), false);
  });

  it('reads four clock calls and three funnel calls', () => {
    assert.equal(isClockCall('clock.now'), true);
    assert.equal(isClockCall('clock.every'), true);
    assert.equal(isClockCall('ui.log'), false);
    assert.equal(isFunnelCall('ui.log'), true);
    assert.equal(isFunnelCall('turn.step'), false);
    assert.equal(isFunnelCall('fs.read'), true);
  });

  it('takes the first segment, and a name with no dot loses its last character', () => {
    assert.equal(firstSegment('ui.log'), 'ui');
    assert.equal(firstSegment('plain'), 'plai');
  });

  it('spells an interface call by its own name and method, every other call by its name', () => {
    assert.equal(callSpelling('interface.call', { name: 'srv', method: 'm' }), 'srv.m');
    assert.equal(callSpelling('ui.log', {}), 'ui.log');
  });

  it('writes a plain name as itself and anything else as JSON', () => {
    assert.equal(plainOrJsonName('plain'), 'plain');
    assert.equal(plainOrJsonName('a b'), '"a b"');
    assert.equal(stateReference({ plugin: 'p', key: 'k' }), 'p.k');
    assert.equal(stateReference({ plugin: 'a b', key: 'k' }), '"a b".k');
  });

  it('names the plugin that removed the call in the refusal sentence', () => {
    assert.equal(removedByPlugin('ui.log', 'p'), '$.ui.log: removed by plugin `p`');
  });
});

describe('the scan rules over what a hooks module declared', () => {
  it('refuses a call the module never declared, and names what it did', () => {
    assert.equal(scanAllowsCall(undefined, 'ui.log'),
      'no hooks module of that name is loaded, so there is no scan to allow it (host rule)');
    assert.equal(scanAllowsCall({ calls: ['ui.toast', 'ui.status'] }, 'ui.log'),
      'its hooks module does not call it (host rule; the scan lists $.ui.toast, $.ui.status)');
    assert.equal(scanAllowsCall({ calls: [] }, 'ui.log'),
      'its hooks module does not call it (host rule; the scan lists no calls)');
    assert.equal(scanAllowsCall({ calls: ['ui.log'] }, 'ui.log'), undefined);
  });

  it('holds an environment call to the variable it names, reads for a read and writes for a write', () => {
    assert.equal(scanAllowsEnv(scan, 'env.get', { name: 'HOME' }), undefined);
    assert.equal(scanAllowsEnv(scan, 'env.get', { name: 'PATH' }),
      'its hooks module does not name PATH in a $.env.get("<name>") call (host rule; the scan lists reads of HOME)');
    assert.equal(scanAllowsEnv(scan, 'env.set', { name: 'PATH' }), undefined);
    assert.equal(scanAllowsEnv(scan, 'env.set', { name: 'HOME' }),
      'its hooks module does not name HOME in a $.env.set("<name>") call (host rule; the scan lists writes of PATH)');
    assert.equal(scanAllowsEnv(scan, 'env.get', 5),
      'it carries no variable name a $.env.get("<name>") call passes');
    assert.equal(scanAllowsEnv(scan, 'ui.log', { name: 'HOME' }), undefined);
  });

  it('holds a state call to the reference it names, and never to a reference it does not carry', () => {
    assert.equal(scanAllowsState(scan, 'state.get', { plugin: 'p', key: 'k' }), undefined);
    assert.equal(scanAllowsState(scan, 'state.get', { plugin: 'p', key: 'other' }),
      'its hooks module does not refer to p.other in a $.state.get({ plugin, key }) call (host rule; the scan lists reads of p.k)');
    assert.equal(scanAllowsState(scan, 'state.set', 'nope'),
      'it carries no reference a $.state.set({ plugin, key }) call passes');
    assert.equal(scanAllowsState(scan, 'ui.log', { plugin: 'p', key: 'k' }), undefined);
  });
});

describe('the gate', () => {
  it('answers the module known args when the call is declared', () => {
    const known = admittedCall(freshState(), { spelling: 'ui.log', caller, isClock: false }) as
      { pluginName: string; pluginStorageId: string; scan: PluginCallScan };
    assert.equal(known.pluginName, 'p');
    assert.equal(known.pluginStorageId, 's@1');
    assert.deepEqual(known.scan.calls, scan.calls);
  });

  it('refuses a call from a plugin whose hooks module is not loaded', () => {
    assert.throws(() => admittedCall(freshState({ knownArgs: new Map() }), { spelling: 'ui.log', caller, isClock: false }),
      { message: 'p: $.ui.log refused: no hooks module of that name is loaded, so there is no scan to allow it (host rule)' });
  });

  it('refuses a withheld call with the sentence naming the plugin that withheld it', () => {
    assert.throws(() => admittedCall(freshState({ withheld: holder('p0') }), { spelling: 'ui.log', caller, isClock: false }),
      { message: '$.ui.log: removed by plugin `p0`' });
  });

  it('refuses a call from an environment no hooks module was admitted for, unless the call is a clock call', () => {
    const clockScan: PluginCallScan = { calls: ['clock.now'], state: {}, env: {} };
    const state = freshState({
      unadmitted: new Set(['env-1']),
      knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan: clockScan }]]),
    });
    assert.equal(admittedCall(state, { spelling: 'clock.now', caller, isClock: true }) === undefined, false);
    assert.throws(() => admittedCall(state, { spelling: 'clock.now', caller, isClock: false }),
      { message: 'p: $.clock.now refused: a hooks module behind the call is not admitted (plugin.register runs once the set is built)' });
  });
});

describe('who withholds a call, and how often the plugin is told', () => {
  it('reads the holders in order: staged, staged before, the live set, then a crashed module', () => {
    const state = freshState({
      staged: holder('staged'),
      stagedBefore: holder('before'),
      crashedWithholders: new Map([['other', new Set(['ui'])]]),
      building: [{ environmentId: 'env-1' }],
    });
    assert.equal(withheldBy(state, caller, 'ui'), 'staged');
    assert.equal(withheldBy({ ...state, staged: undefined }, caller, 'ui'), 'before');
    assert.equal(withheldBy(freshState({ crashedWithholders: new Map([['other', new Set(['ui'])]]) }), caller, 'ui'), 'other');
  });

  it('offers a staged holder only to a call from an engine being created', () => {
    const state = freshState({ staged: holder('staged'), building: [{ environmentId: 'env-9' }] });
    assert.equal(withheldBy(state, caller, 'ui'), undefined);
  });

  it('names another module that crashed while withholding the same first segment', () => {
    const state = freshState({ crashedWithholders: new Map([['other', new Set(['ui'])]]) });
    assert.equal(crashedHolder(state, 'p', 'ui'), 'other');
    assert.equal(crashedHolder(state, 'other', 'ui'), undefined);
    assert.equal(crashedHolder(state, 'p', 'nope'), undefined);
  });

  it('tells the plugin once per first segment', () => {
    const state = freshState();
    const sentence = withheldSentence(state, { plugin: 'p', spelling: 'ui.log', by: 'p0' });
    assert.equal(sentence, '$.ui.log: removed by plugin `p0`');
    assert.equal(withheldSentence(state, { plugin: 'p', spelling: 'ui.log', by: 'p0' }), sentence);
    assert.deepEqual([...state.refusalsLogged], ['p:ui']);
  });
});

describe('the argument copy and the dropped-call notice', () => {
  it('hands a state call a copy, and passes a non-object through as it is', () => {
    const args = { plugin: 'p', key: 'k' };
    const copy = copyCallArgs(args) as { plugin: string; key: string };
    assert.deepEqual(copy, args);
    assert.notEqual(copy, args);
    assert.equal(copyCallArgs(5), 5);
  });

  it('leaves no answer from the dropped-call notice, which only logs and records', () => {
    assert.equal(droppedCallNotice('p', 'ui.log', 'the text'), undefined);
  });
});

describe('the dispatcher', () => {
  it('runs the raise, then the stamp, then the call, and hands the caller its known args', async () => {
    const { ops, order } = withOrder();
    const answer = await dispatchCall({ ops, state: freshState() }, { op: 'test.op', args: { a: 1 }, caller }) as
      { args: unknown; who: PluginCallCaller };
    assert.deepEqual(order, ['raise', 'stamp', 'run']);
    assert.deepEqual(answer.args, { a: 1 });
    assert.equal(answer.who.admitted?.pluginName, 'p');
  });

  it('hands a state call a copy, leaving the object the plugin still holds untouched', async () => {
    const { ops } = withOrder();
    const args = { plugin: 'p', key: 'k' };
    const answer = await dispatchCall({ ops, state: freshState() }, { op: 'state.get', args, caller }) as
      { args: { plugin: string; key: string } };
    assert.notEqual(answer.args, args);
    assert.deepEqual(args, { plugin: 'p', key: 'k' });
  });

  it('refuses at the host check with the text the check answered, and runs nothing', async () => {
    const { ops, order } = withOrder();
    await assert.rejects(
      dispatchCall({ ops, state: freshState() }, { op: 'test.op', args: { bad: 'not allowed' }, caller }),
      { message: 'p: test.op: not allowed (host check)' });
    assert.deepEqual(order, []);
  });

  it('refuses a dropped call at the host check the same way', async () => {
    const { ops, order } = withOrder();
    await assert.rejects(
      dispatchCall({ ops, state: freshState() }, { op: 'ui.log', args: { bad: 'nope' }, caller }),
      { message: 'p: ui.log: nope (host check)' });
    assert.deepEqual(order, []);
  });

  it('refuses a call the module did not declare before the host check sees it', async () => {
    const { ops } = withOrder();
    await assert.rejects(
      dispatchCall({ ops, state: freshState() }, { op: 'env.get', args: { name: 'PATH' }, caller }),
      { message: 'p: $.env.get refused: its hooks module does not name PATH in a $.env.get("<name>") call (host rule; the scan lists reads of HOME)' });
  });

  it('takes the funnel road for a catalog call, with the same three steps', async () => {
    const { ops, order } = withOrder();
    const answer = await dispatchCall({ ops, state: freshState() }, { op: 'ui.log', args: { text: 'x' }, caller }) as
      { args: { text: string } };
    assert.deepEqual(order, ['raise', 'stamp', 'run']);
    assert.deepEqual(answer.args, { text: 'x' });
  });

  it('takes interface.call into the call table when the spelled name is declared', async () => {
    const deepScan: PluginCallScan = { calls: ['interface.call', 'srv.m'], state: {}, env: {} };
    const state = freshState({
      knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan: deepScan }]]),
    });
    const ops: Record<string, PluginCallOp> = {
      'interface.call': { run: (args) => ({ road: 'call table', args }) },
      'srv.m': { run: () => ({ road: 'floor' }) },
    };
    const answer = await dispatchCall({ ops, state },
      { op: 'interface.call', args: { name: 'srv', method: 'm', args: [{ q: 1 }] }, caller }) as { road: string };
    assert.equal(answer.road, 'call table');
  });

  it('refuses an interface call whose spelled name the module did not declare', async () => {
    const { ops } = withOrder();
    await assert.rejects(
      dispatchCall({ ops, state: freshState() },
        { op: 'interface.call', args: { name: 'srv', method: 'm', args: [{}] }, caller }),
      { message: 'p: $.srv.m refused: its hooks module does not call it (host rule; the scan lists $.state.get, $.env.get, $.test.op, $.ui.log, $.interface.call)' });
  });

  it('cannot answer a table entry that carries no call of its own', async () => {
    const state = freshState();
    await assert.rejects(
      dispatchCall({ ops: { 'test.op': {} as PluginCallOp }, state }, { op: 'test.op', args: {}, caller }),
      { message: 'h.run is not a function' });
  });
});
