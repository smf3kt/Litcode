// W45-88 probe: the terminal glue shapes. Values printed here belong in
// test/plugin-chain-terminal.test.ts.
import {
  runComponent, Tc, Xe, s, n,
} from '../src/plugin-chain-react-hooks.js';
import { it } from '../src/plugin-chain-host.js';
import { bindRenderVersions } from '../src/plugin-chain-notify-fold.js';
import { OL, MF } from '../src/plugin-chain-render-keys-source.js';
import { Ioe } from '../src/plugin-chain-render-keys-source.js';
import {
  cr, dr, lr, mr, fr, ur, VH, yt, pr, xr, $e, hdn, TU, ar, uo, pIn, CAt, bVe,
} from '../src/plugin-chain-terminal-glue-source.js';
import { GPn } from '../src/plugin-chain-render-keys-source.js';
import { setRenderAnswerHost, setRowAccountHost, dce, setFullscreen, Fss } from '../src/plugin-chain-terminal-host.js';

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

const input = { surface: 'terminal', component: 'C', requestId: 'r', viewport: { columns: 80, isFullscreen: false }, props: {} };
const run = <T,>(fn: () => T) => runComponent(fn).result;
const typeName = (type: any): string =>
  typeof type === 'string' ? type : typeof type === 'function' ? type.name || 'fn' : typeof type;
const show = (value: any): any => {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(show);
  if ('type' in value) {
    return {
      type: typeName((value as Any).type),
      props: Object.keys((value as Any).props ?? {}),
      children: ((value as Any).children ?? []).map(show),
    };
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, show(v)]));
};

console.log('cr', JSON.stringify(cr(input, input)), JSON.stringify(cr(undefined as never, input)));
console.log('dr', JSON.stringify(dr(input, new Error('boom'))));
console.log('lr off', JSON.stringify(lr({ rows: 3, wasOff: false, input, drawn: 'd' }, { input, drawn: 'd', contentRows: 5 })));
console.log('lr rows', JSON.stringify(lr({ rows: 3, wasOff: false, input, drawn: 'd' }, { input, drawn: 'e', contentRows: undefined })));
console.log('mr starting', JSON.stringify(mr({ rows: undefined, wasOff: false, input, drawn: undefined }, { input, drawn: 'd', lastRows: 4, contentRows: 0 })));
console.log('mr other input', JSON.stringify(mr({ rows: 3, wasOff: false, input: { ...input, requestId: 'x' }, drawn: 'd' }, { input, drawn: 'd', lastRows: 4, contentRows: 2 })));
console.log('fr on', run(() => fr({ isOff: false, input, drawn: 'd', lastRows: 4 })));
console.log('fr off', run(() => fr({ isOff: true, input, drawn: 'd', lastRows: 4 })));

setRowAccountHost({ rows: (active, asked) => active ? [{ tree: 's' }, { ...input, props: { onScreen: asked } }, 4, 7] : [undefined, undefined, undefined, undefined] });
console.log('ur off', JSON.stringify(run(() => ur(input, false, undefined))));
setFullscreen(true);
console.log('ur on', JSON.stringify(run(() => ur(input, true, undefined))));
setFullscreen(false);

setRenderAnswerHost({ uiRender: async () => ({ type: 'Text', props: {}, children: ['drawn'] }) });
console.log('xr none', JSON.stringify(run(() => xr(false, input, { version: 1, staticFrame: false, submittedBy: undefined }))));
const pending = run(() => xr(true, input, { version: 1, staticFrame: false, submittedBy: undefined }));
await Promise.resolve(); await Promise.resolve();
console.log('xr pending', JSON.stringify(pending));
await (dce as Any).uiRender(input, { origin: ['C'] });
console.log('xr seeded', JSON.stringify(run(() => xr(true, input, { version: 1, staticFrame: false, submittedBy: 'C' }))));
console.log('VH', JSON.stringify(run(() => VH('C', () => ({ requestId: 'r', props: { a: 1 } }), ['C']))));

const draw = (site: Any) => Tc(n, null, String(site?.label ?? 'drawn'));
const tree = { type: 'Text', props: {}, children: ['t'] };
console.log('yt', JSON.stringify(show(run(() => yt({ tree, input, draw })))));
console.log('pr pane', JSON.stringify(show(run(() => pr({ tree, input: { ...input, component: 'Pane' }, draw, submittedBy: undefined, onThrown: () => {} })))));
console.log('pr boundary', JSON.stringify(show(run(() => pr({ tree, input, draw, submittedBy: undefined, onThrown: () => {} })))));
const node = run(() => hdn(input, draw, 'C'));
console.log('hdn', JSON.stringify(show({ drawn: node.drawn, hasThrown: node.hasThrown, node: node.node })));
console.log('TU', JSON.stringify(show(run(() => TU(input, draw, 'C')))));
console.log('$e', JSON.stringify(run(() => $e(input))));
console.log('uo', JSON.stringify(uo(tree, input, input)), JSON.stringify(uo(tree, input, { ...input, component: 'D' })));
console.log('pIn', JSON.stringify(pIn([{ name: 'a' }, { name: 'b' }], tree)));
bVe.set(tree as never, { of: (x: Any) => ({ input: { ...input, props: { seen: x } } }) });
console.log('CAt', JSON.stringify(CAt(tree, { k: 1 })));
console.log('ar', JSON.stringify(run(() => ar(true))), JSON.stringify(run(() => ar(false))));
const mod = { name: 'm1', label: 'm1', hooks: (ev: string) => ev === 'ui.render', matcherFor: () => ({ surface: 'terminal', component: 'C', requestId: 'r' }), registrationsFor: () => [] };
it().loadedModules.push(mod as never);
const hooked = run(() => hdn(input, draw, 'C'));
console.log('hdn hooked', JSON.stringify(show({ drawn: hooked.drawn, node: hooked.node })));
console.log('GPn submitted', JSON.stringify(GPn(input, [input.component]).length), JSON.stringify(GPn(input, undefined).length));
it().loadedModules.splice(it().loadedModules.indexOf(mod as never), 1);
console.log('Fss release', typeof Fss('K'), typeof Fss('K'));
console.log('dce thrown', (dce as Any).noteThrown instanceof Function, (dce as Any).heldRowsOf(input, undefined));
unbind();
