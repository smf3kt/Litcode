// W45-70 probe: the `$` call dispatcher measured through the copy — the name lists, the four gates, the
// two scan rules, the host check and its droppable notice, the raise/stamp/run order and both special
// roads. Every assertion in the suite and the driver is written from this output.
import {
  G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo,
} from '../src/plugin-chain-call-dispatch-source.js';

console.log('lists', JSON.stringify(Xt), JSON.stringify(Kt), Hp.length, iIt('ui.log'), iIt('env.get'));
console.log('tEs', tEs('env.get'), tEs('state.get'), 'nUn', nUn('state.get'), nUn('env.get'));
console.log('oRe', oRe('clock.now'), oRe('clock.every'), oRe('ui.log'));
console.log('tho', tho('ui.log'), tho('turn.step'), tho('fs.read'));
console.log('R3', R3('ui.log'), R3('plain'), 'kJt', kJt('interface.call', { name: 'srv', method: 'm' }), kJt('ui.log', {}));
console.log('Yo', Yo('plain'), Yo('a b'), 'ylt', ylt({ plugin: 'p', key: 'k' }), ylt({ plugin: 'a b', key: 'k' }));
console.log('rho', rho('ui.log', 'p'));
console.log('Xqo same value', Xqo({ a: 1 }).a, 'new object', Xqo({ a: 1 }) !== Xqo({ a: 1 }), 'non-object', JSON.stringify(Xqo(5)));
console.log('kme none', kme(undefined, 'ui.log'));
console.log('kme miss', kme({ calls: ['ui.toast', 'ui.status'] }, 'ui.log'));
console.log('kme none-declared', kme({ calls: [] }, 'ui.log'));
console.log('kme hit', kme({ calls: ['ui.log'] }, 'ui.log'));

const scan = {
  calls: ['state.get', 'env.get', 'test.op', 'ui.log', 'interface.call'],
  state: { reads: [{ plugin: 'p', key: 'k' }], writes: [{ plugin: 'p', key: 'k' }] },
  env: { reads: ['HOME'], writes: ['PATH'] },
};
const envget = (name: unknown) => ({ name });
console.log('nzt ok', nzt(scan, 'env.get', envget('HOME')));
console.log('nzt miss', nzt(scan, 'env.get', envget('PATH')));
console.log('nzt write', nzt(scan, 'env.set', envget('PATH')), '| miss', nzt(scan, 'env.set', envget('HOME')));
console.log('nzt no-literal', nzt(scan, 'env.get', 5), '| other op', nzt(scan, 'ui.log', envget('HOME')));
console.log('Qqo ok', Qqo(scan, 'state.get', { plugin: 'p', key: 'k' }));
console.log('Qqo miss', Qqo(scan, 'state.get', { plugin: 'p', key: 'other' }));
console.log('Qqo no-ref', Qqo(scan, 'state.set', 'nope'), '| other op', Qqo(scan, 'ui.log', { plugin: 'p', key: 'k' }));

const state = {
  knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]),
  refusalsLogged: new Set<string>(),
  crashedWithholders: new Map<string, Set<string>>([['other', new Set(['ui'])]]),
  staged: undefined as unknown,
  stagedBefore: undefined as unknown,
  building: [] as unknown[],
  withheld: { refuser: (_plugin: string, _first: string) => undefined as string | undefined },
  unadmitted: new Set<string>(),
  env: { reads: ['HOME'], writes: ['PATH'] },
};
const caller = { plugin: 'p', origin: {}, environmentId: 'env-1' };
const gate = (state_: unknown, spelling: string, isClock = false) => {
  try { Sme({ state: state_ } as never, { spelling, caller, isClock }); return 'no throw'; }
  catch (e) { return (e as Error).message; }
};
console.log('Sme ok', gate(state, 'ui.log'));
console.log('Sme no-scan', gate({ ...state, knownArgs: new Map() }, 'ui.log'));
console.log('Sme withheld', gate({ ...state, withheld: { refuser: () => 'p0' } }, 'ui.log'));
console.log('Sme unadmitted', gate({ ...state, unadmitted: new Set(['env-1']) }, 'ui.log'));
console.log('Sme unadmitted but clock', gate({ ...state, unadmitted: new Set(['env-1']) }, 'clock.now', true));
console.log('UGt', UGt(state as never, 'p', 'ui'), UGt(state as never, 'other', 'ui'), UGt(state as never, 'p', 'nope'));
console.log('jGt staged', jGt({ ...state, staged: { refuser: () => 'staged' }, building: [{ environmentId: 'env-1' }] } as never, caller as never, 'ui'));
console.log('jGt staged-before', jGt({ ...state, stagedBefore: { refuser: () => 'before' }, building: [{ environmentId: 'env-1' }] } as never, caller as never, 'ui'));
console.log('jGt crashed', jGt(state as never, { ...caller, environmentId: 'env-9' } as never, 'ui'));
const state2 = { ...state, refusalsLogged: new Set<string>() };
console.log('HGt', HGt(state2 as never, { plugin: 'p', spelling: 'ui.log', by: 'p0' }));
console.log('HGt again', HGt(state2 as never, { plugin: 'p', spelling: 'ui.log', by: 'p0' }), [...state2.refusalsLogged]);
console.log('H2e', H2e('p', 'ui.log', 'the text'));

const order: string[] = [];
const op = (name: string, extra: Record<string, unknown> = {}) => [name, {
  check: (args: unknown) => (args as { bad?: string })?.bad,
  raise: (caller_: unknown) => { order.push('raise'); return { raised: true, caller: caller_ }; },
  stamp: (args: unknown) => { order.push('stamp'); return args; },
  run: (args: unknown, caller_: unknown) => { order.push('run'); return { args, caller: caller_ }; },
  ...extra,
}];
const ops = Object.fromEntries([op('test.op'), op('ui.log'), op('env.get'), op('state.get')]);
const chain = { ops, state: { ...state, knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]) } };
const show = async (label: string, name: string, args: unknown) => {
  order.length = 0;
  try {
    const answer = await G2e(chain as never, { op: name, args, caller } as never);
    console.log(label, 'answered', JSON.stringify(answer), 'order', order.join('>'));
  } catch (e) {
    console.log(label, 'threw', (e as Error).message, 'order', order.join('>'));
  }
};
await show('plain', 'test.op', { a: 1 });
await show('state-copied', 'state.get', { plugin: 'p', key: 'k' });
await show('host-check', 'test.op', { bad: 'not allowed' });
await show('host-check-droppable', 'ui.log', { bad: 'not allowed' });
await show('scan-miss', 'env.get', envget('PATH'));
await show('scan-ok', 'env.get', envget('HOME'));
const stateArgs = { plugin: 'p', key: 'k' };
await show('args-copied', 'state.get', stateArgs);
console.log('caller args untouched', JSON.stringify(stateArgs));
await show('droppable-host-check', 'ui.log', { bad: 'nope' });
await show('funnel', 'ui.log', { text: 'x' });
await show('interface-road', 'interface.call', { name: 'srv', method: 'm', args: [{}] });
console.log('ops without run', await (async () => {
  const bare = { ops: { 'test.op': {} }, state: { ...state, knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]) }, ops2: null };
  try { return ['answered', await G2e(bare as never, { op: 'test.op', args: {}, caller } as never)]; }
  catch (e) { return ['threw', (e as Error).message]; }
})());
const clean = {
  ops, state: {
    ...state,
    crashedWithholders: new Map(),
    knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan }]]),
  },
};
const showClean = async (label: string, name: string, args: unknown) => {
  order.length = 0;
  try {
    const answer = await G2e(clean as never, { op: name, args, caller } as never);
    console.log(label, 'answered', JSON.stringify(answer)?.slice(0, 160), 'order', order.join('>'));
  } catch (e) { console.log(label, 'threw', (e as Error).message, 'order', order.join('>')); }
};
await showClean('clean-host-check', 'test.op', { bad: 'nope' });
await showClean('clean-droppable-check', 'ui.log', { bad: 'nope' });
await showClean('clean-funnel', 'ui.log', { text: 'x' });
await showClean('clean-interface', 'interface.call', { name: 'srv', method: 'm', args: [{}] });
console.log('records', JSON.stringify(chain && undefined));

const clockScan = { calls: ['clock.now', 'clock.every'], state: {}, env: {} };
const clockState = { ...state, unadmitted: new Set(['env-1']), knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan: clockScan }]]) };
console.log('Sme clock listed, unadmitted', gate(clockState, 'clock.now', true));
console.log('Sme clock listed, no exemption', gate(clockState, 'clock.now', false));
console.log('Sme clock listed, declared and admitted', gate({ ...clockState, unadmitted: new Set() }, 'clock.now', false));
console.log('Sme returns', JSON.stringify(Sme({ state: clockState } as never, { spelling: 'clock.now', caller, isClock: true })));

const deepScan = { calls: ['interface.call', 'srv.m'], state: {}, env: {} };
const deepState = { ...state, knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan: deepScan }]]) };
const deep = { ops: { 'interface.call': { run: (a: unknown, c: unknown) => ({ road: 'call table', a, c }) }, 'srv.m': { run: (a: unknown) => ({ road: 'floor', a }) } }, state: deepState };
order.length = 0;
try {
  const answer = await G2e(deep as never, { op: 'interface.call', args: { name: 'srv', method: 'm', args: [{ q: 1 }] }, caller } as never);
  console.log('interface-road declared answered', JSON.stringify(answer)?.slice(0, 200));
} catch (e) { console.log('interface-road declared threw', (e as Error).message); }
const shortName = { ops: deep.ops, state: { ...deepState, knownArgs: new Map([['p', { pluginName: 'p', pluginStorageId: 's@1', scan: { calls: ['interface.call', 'srv'], state: {}, env: {} } }]]) } };
try {
  const answer = await G2e(shortName as never, { op: 'interface.call', args: { name: 'srv', args: [] }, caller } as never);
  console.log('interface-road one segment answered', JSON.stringify(answer)?.slice(0, 160));
} catch (e) { console.log('interface-road one segment threw', (e as Error).message); }
