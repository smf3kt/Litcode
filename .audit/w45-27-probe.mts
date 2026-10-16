import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { aLs, cLs, dLs, pLs, uLs, RYr, CWt, Fpe, EWt, OWt, MWt } from '../src/plugin-chain-notify-source.js';

const toast = (key: string, leftMs: number, extra: any = {}) => ({
  key, plugin: 'p', text: key, isManaged: false, leftMs, wasShown: false, lentMs: 0, untoldMs: 0, ...extra,
});
const slot = { key: 'k1', endsAt: 4000, shown: 'k1' };
console.log('dLs equal     ', dLs({ toasts: [toast('k1', 3000)], at: 1000, slot }));
console.log('dLs tight     ', dLs({ toasts: [toast('k1', 2000)], at: 1000, slot }));
console.log('dLs no slot   ', dLs({ toasts: [toast('k1', 3000)], at: 1000, slot: void 0 }));
console.log('EWt shown     ', JSON.stringify(EWt(toast('k1', 3000), slot, 1000)));
console.log('EWt lent      ', JSON.stringify(EWt(toast('k2', 3000), slot, 1000)));
console.log('CWt keeps     ', JSON.stringify(CWt(Fpe([toast('a', 4000), toast('b', 1000)]), 1000)));
console.log('CWt loses     ', JSON.stringify(CWt(Fpe([toast('a', 4000), toast('b', 1000)]), 0)));
console.log('CWt untold    ', JSON.stringify(CWt(Fpe([toast('a', 5, { untoldMs: 100 })]), 0)));
console.log('OWt           ', JSON.stringify(OWt([toast('a', 1000), toast('b', 1000)], [1500, 2500])));
console.log('MWt           ', JSON.stringify([...MWt([toast('a', 1), { ...toast('b', 1), text: 'B' }], [undefined, 'x'])]));
const state = { isHeld: false, current: { key: 'k1', timeoutMs: 4000, text: 'old' }, queue: [] as any[] };
console.log('pLs changed   ', JSON.stringify(pLs(state, new Map([['k1', 'new']]))));
console.log('pLs same      ', pLs(state, new Map([['k1', 'old']])) === state);
clearChainRecords();
uLs({ key: 'kx', plugin: 'p', leftMs: 7 });
console.log('uLs           ', JSON.stringify(chainRecords().map((r: any) => r.message)));
