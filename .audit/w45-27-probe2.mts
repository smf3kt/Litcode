import '../src/plugin-chain-registry.js';
import { keptToasts, laidOutTexts, runningSlot, ageOneTick, isToastCutShort, managedFirst } from '../src/plugin-chain-notify.js';
import { aLs } from '../src/plugin-chain-notify-source.js';
const toast = (key: string, leftMs: number, extra: any = {}) => ({
  key, plugin: 'p', text: key, isManaged: false, leftMs, wasShown: false, lentMs: 0, untoldMs: 0, ...extra,
});
console.log('laidOutTexts', JSON.stringify([...laidOutTexts([toast('a', 1), { ...toast('b', 1) }], [{ text: 'x' }])]));
console.log('runningSlot  ', JSON.stringify(runningSlot(toast('k1', 1), 4000, 'k1')), JSON.stringify(runningSlot(undefined, 4000, undefined)));
console.log('keptToasts   ', JSON.stringify(keptToasts([toast('a', 1), toast('b', 2)], [{ key: 'b' }], new Set(['b']))));
console.log('ageOneTick   ', JSON.stringify(ageOneTick({ toasts: [toast('a', 1000)], at: 100, slot: { key: 'a', endsAt: 1100 } }, { current: { key: 'a' }, waiting: [] }, 200)));
console.log('cutShort false', isToastCutShort({ toasts: [toast('k1', 1)] }, 'k1', false), isToastCutShort({ toasts: [{ ...toast('k1', 1), wasShown: true }] }, 'k1', false));
console.log('managedFirst ', JSON.stringify(managedFirst([toast('a', 1), toast('b', 1, { isManaged: true })]).map((x: any) => x.key)));
const q = { isHeld: false, isHidden: false, current: { key: 'k1', ms: 4000 }, waiting: [] };
const t0 = aLs({ toasts: [toast('k1', 4000)], at: 0, slot: void 0 }, q, 0);
console.log('tick t0      ', JSON.stringify(t0));
