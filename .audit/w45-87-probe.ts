// W45-87 probe: the render-version and render-key helpers. Values printed here belong in
// test/plugin-chain-render-keys.test.ts.
import crypto from 'node:crypto';
import { it } from '../src/plugin-chain-host.js';
import { bindRenderVersions } from '../src/plugin-chain-notify-fold.js';
import { OL, Rc, jf } from '../src/plugin-chain-notify-fold-source.js';
import {
  vA, oIn, MF, kVe, mIn, Tc, $H, wc, kc, wH, kH, xc, Rb, sur, iur,
  j3e, Ioe, Omt, l9, Frt, LAt, WPn, SVe, GPn, $ur, blt, eA, at, hno, yno,
} from '../src/plugin-chain-render-keys-source.js';
import {
  renderEventName, renderKeyOf, renderKey, renderVersion, propsKey, onScreenRange,
  drawsAnything, renderEventHooked, renderEventHookedFor,
} from '../src/plugin-chain-render-keys.js';

type Any = Record<string, any>;

const state = new Map<string, number>();
const store = {
  getState: () => state,
  setState: (fn: (current: Map<string, number>) => Map<string, number>) => {
    const next = fn(new Map(state));
    state.clear();
    for (const [key, version] of next) state.set(key, version);
  },
};
const unbind = bindRenderVersions(store as never);

const VKEY = MF({ surface: 'terminal', component: 'C', requestId: 'r' });
state.set(vA, 5);
state.set(oIn, 9);
state.set('K', 2);
state.set('K live', 3);
state.set('S\0state', 4);
state.set('other', 7);
state.set(jf(VKEY), 11);

console.log('names', vA, oIn, MF({ surface: 'terminal', component: 'C', requestId: 'r' }));
console.log('kVe', JSON.stringify(kVe(store.getState(), { surface: 'terminal', component: 'C', requestId: 'r', viewport: { columns: 80, isFullscreen: false }, props: {} })));
console.log('mIn', JSON.stringify(mIn({ viewport: { columns: 80, isFullscreen: false }, props: { a: 1 } })));
console.log('mIn shape', JSON.stringify(mIn({ viewport: { columns: 80, isFullscreen: false }, props: { a: 1 } }).split('\0').map((part) => part.length)));
console.log('$H', JSON.stringify($H('KEY', state as never, MF({ surface: 'terminal', component: 'C', requestId: 'r' }))));
console.log('Tc all', JSON.stringify(Tc(state as never)));
console.log('Tc keys', JSON.stringify(Tc(state as never, ['K'])), JSON.stringify(Tc(state as never, ['K'], 'live')));
console.log('keys', kc, wH('a live'), kH('a'), xc('a', 'live'), xc('a', 'steady'), Rb('a' + Rc), jf('a'));
console.log('wc before', JSON.stringify([...state]));
wc('K');
console.log('wc after', JSON.stringify([...state]));
console.log('sur', sur({ position: 'absolute' }), sur({ top: 1 }), sur({ color: 'red' }), sur(undefined));
console.log('iur', iur('s'), iur({ type: 'engine' }), iur({ type: 'Text' }), iur({ type: 'Text', props: { top: 1 } }), iur({ type: 'Box', children: [{ type: 'Text', props: { top: 1 } }] }), iur({ type: 'Link', props: {} }));
console.log('j3e', JSON.stringify([...j3e]), 'Ioe', JSON.stringify(Ioe));
console.log('Omt', Omt.defaultValue, 'l9', typeof (l9 as Any).get, JSON.stringify((l9 as Any).get()));
const rec = { name: 'm1', label: 'm1', hooks: (e: string) => e === vA, matcherFor: () => ({ surface: 'terminal', component: 'C', requestId: 'r' }) };
const rec2 = { name: 'm2', label: 'm2', hooks: (e: string) => e === vA, matcherFor: () => ({ surface: 'terminal', component: 'D', requestId: 'r' }) };
it().loadedModules.push(rec as never, rec2 as never);
console.log('WPn', WPn({ surface: 'terminal', component: 'C', requestId: 'r' }).map((m) => m.name), 'SVe', JSON.stringify(SVe({ surface: 'terminal', component: 'C', requestId: 'r' })));
console.log('Frt', Frt('C'), Frt('D'), 'LAt', LAt({ surface: 'terminal', component: 'C', requestId: 'r' }), LAt({ surface: 'terminal', component: 'D', requestId: 'r' }));
console.log('GPn C', GPn({ surface: 'terminal', component: 'C', requestId: 'r' }).length, 'GPn D', GPn({ surface: 'terminal', component: 'D', requestId: 'r' }).length);
it().loadedModules.splice(it().loadedModules.indexOf(rec as never), 1);
it().loadedModules.splice(it().loadedModules.indexOf(rec2 as never), 1);
console.log('$ur', JSON.stringify($ur({ props: { onScreen: { first: 1, last: 2, of: 3 } } })), $ur({ props: { onScreen: null } }), $ur({ props: {} }), $ur({ props: { onScreen: { first: 'x' } } }));
console.log('blt', blt({ a: 1 }, 'a', 1), blt({ a: 2 }, 'a', 1), blt(undefined, 'a', 1));
console.log('at', at('x'), crypto.createHash('sha256').update('x').digest('hex'), 'eA', eA.test(at('x')));
const obj = { a: 1 };
console.log('hno', hno(obj) === hno(obj), hno({ a: 1 }) === hno({ a: 1 }), yno({ a: 1 }));
console.log('aliases', renderEventName === vA, renderKeyOf === MF, renderKey === kVe, renderVersion === Tc, propsKey === mIn, onScreenRange === $ur, drawsAnything === iur, renderEventHooked === Frt, renderEventHookedFor === LAt);
console.log('OL', typeof OL().getState, OL() === it().renderVersions);
unbind();
import { jDe } from '../src/plugin-chain-records.js';
const recA = { name: 'm1', label: 'm1', hooks: (e: string) => e === vA, matcherFor: () => ({ surface: 'terminal', component: 'C', requestId: 'r' }) };
it().loadedModules.push(recA as never);
console.log('jDe', jDe(vA, undefined, { e: { component: 'C' } } as never).length, jDe(vA, undefined, {} as never).length, typeof (jDe(vA, undefined, {} as never)[0] as Any)?.matcherFor);
it().loadedModules.splice(it().loadedModules.indexOf(recA as never), 1);
