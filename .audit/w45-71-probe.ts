// W45-71 probe: the `ui.scroll` and `ui.focus` call entries measured through the copy — the two
// registries, the key, the ownership checks and the commit roads each call takes. Every assertion in the
// suite and the driver is written from this output.
import { XH, _z, ahe, bse, iL, IY, mse, PY, pyt, Uet, uyt, vse } from '../src/plugin-chain-scroll-focus-source.js';
import { it } from '../src/plugin-chain-host.js';

type Site = {
  owner?: string;
  commit(offset: unknown, origin: unknown): unknown;
  isHeldNow?: () => boolean;
  holderNow?: () => string | undefined;
};
const state = it() as unknown as { scrollSites: Map<string, Site>; focusSites: Map<string, Site> };
state.scrollSites = new Map();
state.focusSites = new Map();

const origin = (kind: string, name: string) => ({ kind, name });
const pluginOrigin = origin('plugin', 'p1');

console.log('key', _z('button', 'r1'), _z('a', 'b:c'), _z('', ''));
console.log('registries are the registry state', ahe() === state.scrollSites, Uet() === state.focusSites);
console.log('miss', JSON.stringify(mse({ component: 'x', requestId: 'y' })), JSON.stringify(iL({ component: 'x', requestId: 'y' })));

const scroll: Site = { owner: 'p1', commit: (offset, who) => ({ ok: true, offset, who }) };
state.scrollSites.set('button:r1', scroll);
console.log('scroll found', mse({ component: 'button', requestId: 'r1' }) === scroll);
console.log('scroll commit', JSON.stringify(PY({ component: 'button', requestId: 'r1', offset: 3, origin: pluginOrigin })));
const scrollDeny: Site = { owner: 'owner', commit: () => true };
state.scrollSites.set('button:r2', scrollDeny);
console.log('scroll other owner', JSON.stringify(PY({ component: 'button', requestId: 'r2', offset: 3, origin: pluginOrigin })));
const scrollNoOwner: Site = { commit: () => true };
state.scrollSites.set('button:r3', scrollNoOwner);
console.log('scroll no owner', JSON.stringify(PY({ component: 'button', requestId: 'r3', offset: 3, origin: pluginOrigin })));
const scrollOwnerKind: Site = { owner: 'p1', commit: () => true };
state.scrollSites.set('button:r4', scrollOwnerKind);
console.log('scroll editor origin, foreign owner', JSON.stringify(PY({ component: 'button', requestId: 'r4', offset: 3, origin: origin('editor', 'e1') })));
const scrollMoved: Site = { owner: 'p1', commit: () => false };
state.scrollSites.set('button:r5', scrollMoved);
console.log('scroll moved meanwhile', JSON.stringify(PY({ component: 'button', requestId: 'r5', offset: 3, origin: pluginOrigin })));

console.log('pyt', pyt({ owner: 'p1' } as Site, origin('plugin', 'p2')), pyt({ owner: 'p1' } as Site, origin('plugin', 'p1')), pyt({} as Site, origin('plugin', 'p2')), pyt({ owner: 'p1' } as Site, origin('editor', 'p2')));

const focus: Site = { owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => undefined };
state.focusSites.set('input:r1', focus);
console.log('focus commit', JSON.stringify(IY({ component: 'input', requestId: 'r1', plugin: 'p1', origin: pluginOrigin })));
const focusDeny: Site = { owner: 'owner', commit: () => undefined, isHeldNow: () => true, holderNow: () => undefined };
state.focusSites.set('input:r2', focusDeny);
console.log('focus other owner', JSON.stringify(IY({ component: 'input', requestId: 'r2', plugin: 'p1', origin: pluginOrigin })));
console.log('focus same owner plugin p1', JSON.stringify(IY({ component: 'input', requestId: 'r2', plugin: 'owner', origin: origin('plugin', 'owner') })));
const focusNotHeld: Site = { owner: 'p1', commit: () => undefined, isHeldNow: () => false, holderNow: () => undefined };
state.focusSites.set('input:r3', focusNotHeld);
console.log('focus not held', JSON.stringify(IY({ component: 'input', requestId: 'r3', plugin: 'p1', origin: pluginOrigin })));
const focusForeignHolder: Site = { owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => 'p2' };
state.focusSites.set('input:r4', focusForeignHolder);
console.log('focus foreign holder', JSON.stringify(IY({ component: 'input', requestId: 'r4', plugin: 'p1', origin: pluginOrigin })));
const focusRefuse: Site = { owner: 'p1', commit: () => 'the element refused', isHeldNow: () => true, holderNow: () => 'p1' };
state.focusSites.set('input:r5', focusRefuse);
console.log('focus refused by site', JSON.stringify(IY({ component: 'input', requestId: 'r5', plugin: 'p1', origin: pluginOrigin })));
const focusSameHolder: Site = { owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => 'p1' };
state.focusSites.set('input:r6', focusSameHolder);
console.log('focus holder is the origin', JSON.stringify(IY({ component: 'input', requestId: 'r6', plugin: 'p1', origin: pluginOrigin })));

console.log('uyt', uyt({ owner: 'p1' } as Site, { plugin: 'p2', origin: pluginOrigin }), uyt({ owner: 'p1' } as Site, { plugin: 'p2', origin: origin('editor', 'e') }), uyt({} as Site, { plugin: 'p2', origin: pluginOrigin }), uyt({ owner: 'p1' } as Site, { plugin: 'p1', origin: pluginOrigin }));
console.log('uyt forwarded', uyt({ owner: 'owner' } as Site, { plugin: 'p1', origin: origin('plugin', 'p2') }), uyt({ owner: 'p1' } as Site, { plugin: 'p1', origin: origin('plugin', 'p1') }), uyt({ owner: 'p2' } as Site, { plugin: 'p2', origin: origin('plugin', 'p2') }));
const focusForward: Site = { owner: 'owner', commit: () => undefined, isHeldNow: () => true, holderNow: () => undefined };
state.focusSites.set('input:r7', focusForward);
console.log('focus forwarded call', JSON.stringify(IY({ component: 'input', requestId: 'r7', plugin: 'p1', origin: origin('plugin', 'p2') })));
console.log('XH', XH({ holderNow: () => 'p2' } as Site, pluginOrigin), XH({ holderNow: () => 'p1' } as Site, pluginOrigin), XH({ holderNow: () => undefined } as Site, pluginOrigin), XH({ holderNow: () => 'p2' } as Site, origin('editor', 'e')));

console.log('entries', JSON.stringify(Object.keys(bse)), JSON.stringify(Object.keys(vse)));
console.log('entry sites', bse.site === (it() as unknown as { zd?: Record<string, unknown> }).zd?.['ui.scroll'] || 'zd not on the registry', vse.core.isCore, bse.core.name, bse.core.budgetMs);
console.log('entry body scroll', JSON.stringify(await bse.core.run({ component: 'button', requestId: 'r1', offset: 7, origin: pluginOrigin })));
console.log('entry body focus', JSON.stringify(await vse.core.run({ component: 'input', requestId: 'r1', plugin: 'p1', origin: pluginOrigin })));
console.log('entry body refuses like the body', JSON.stringify(await bse.core.run({ component: 'nope', requestId: 'nope', offset: 1, origin: pluginOrigin })));

const { Ci, wa, pr, Vr, ko, Po } = await import('../src/plugin-chain-scroll-focus-source.js');
console.log('sites', Ci.event, wa.event, JSON.stringify(ko), JSON.stringify(Po));
const focusArgs = { component: 'input', requestId: 'r1', plugin: 'p1', origin: pluginOrigin, element: 'el' };
console.log('focus checkArgument ok', JSON.stringify(Ci.checkArgument(focusArgs, focusArgs)));
console.log('focus checkArgument element', JSON.stringify(Ci.checkArgument({ ...focusArgs, element: 5 }, focusArgs)));
console.log('focus checkArgument stray', JSON.stringify(Ci.checkArgument({ ...focusArgs, junk: 1 }, focusArgs)));
console.log('focus checkArgument no prev', (() => {
  try { return JSON.stringify(Ci.checkArgument({ component: 'input' }, undefined)); }
  catch (error) { return `threw ${(error as Error).message}`; }
})());
console.log('focus checkArgument changed', JSON.stringify(Ci.checkArgument({ ...focusArgs, plugin: 'other' }, focusArgs)));
console.log('focus check answer', JSON.stringify(Ci.check({}, focusArgs, [])), JSON.stringify(Ci.check({ deny: '' }, focusArgs, [])), JSON.stringify(Ci.check({ deny: 'no' }, focusArgs, [])));
console.log('focus restore', JSON.stringify(Ci.restoreArgument({ ...focusArgs, junk: 1 }, {})));
const scrollArgs = { component: 'button', requestId: 'r1', by: 3, bodyRows: 10, contentRows: 20, origin: pluginOrigin, pointer: 1, offset: 2 };
console.log('scroll checkArgument ok', JSON.stringify(wa.checkArgument(scrollArgs, scrollArgs)));
console.log('scroll checkArgument offset', JSON.stringify(wa.checkArgument({ ...scrollArgs, offset: 1.5 }, scrollArgs)), JSON.stringify(wa.checkArgument({ ...scrollArgs, offset: -1 }, scrollArgs)));
console.log('scroll checkArgument stray', JSON.stringify(wa.checkArgument({ ...scrollArgs, junk: 1 }, scrollArgs)));
console.log('scroll check answer', JSON.stringify(wa.check({ deny: 5 }, scrollArgs, [])), JSON.stringify(wa.check(undefined, scrollArgs, [])));
console.log('scroll restore', JSON.stringify(wa.restoreArgument({ ...scrollArgs, offset: 9, junk: 1 }, {})));
console.log('pr direct', JSON.stringify(pr({})), JSON.stringify(pr({ deny: 'x' })), JSON.stringify(pr({ deny: '' })));
console.log('Vr', JSON.stringify(Vr('el', undefined)), JSON.stringify(Vr(undefined, 'el')), JSON.stringify(Vr(undefined, undefined)), JSON.stringify(Vr(5, 5)), JSON.stringify(Vr('', '')));
