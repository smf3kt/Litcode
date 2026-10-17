// The terminal glue (W45-88). Expected values were measured through the copied bodies (see
// .audit/w45-88-probe.txt): the row helpers, the on-screen input, the settled render, the surface
// node, the boundary and the failure-note helpers.
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { it as registry } from '../src/plugin-chain-host.js';
import { bindRenderVersions } from '../src/plugin-chain-notify-fold.js';
import { Tc, n } from '../src/plugin-chain-react-hooks.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { Ioe, GPn } from '../src/plugin-chain-render-keys-source.js';
import {
  cr, dr, lr, mr, fr, ur, VH, yt, pr, xr, $e, hdn, TU, ar, uo, pIn, CAt, bVe, uIn, s5t, dIn,
} from '../src/plugin-chain-terminal-glue-source.js';
import {
  dce, setRenderAnswerHost, setRowAccountHost, setFullscreen, Fss,
} from '../src/plugin-chain-terminal-host.js';
import {
  renderSiteNode, renderTreeGuarded, firstRunRef, steadyRows, offRows, heldRows,
  onScreenInput, renderKeyFor, settledRender, renderVersionOf,
} from '../src/plugin-chain-terminal.js';

type Any = Record<string, any>;
const input = (over: Any = {}) => ({
  surface: 'terminal', component: 'C', requestId: 'r',
  viewport: { columns: 80, isFullscreen: false }, props: {}, ...over,
});
const run = <T,>(fn: () => T): T => runComponent(fn).result;
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

let state: Map<string, number>;
let unbind: () => void;
const draw = (site: Any) => Tc(n, null, String(site?.label ?? 'drawn'));

beforeEach(() => {
  state = new Map();
  unbind = bindRenderVersions({
    getState: () => state,
    setState: (fn: (current: Map<string, number>) => Map<string, number>) => {
      const next = fn(new Map(state));
      state.clear();
      for (const [key, version] of next) state.set(key, version);
    },
  } as never);
});
afterEach(() => {
  unbind();
  setRenderAnswerHost(undefined);
  setRowAccountHost(undefined);
  setFullscreen(false);
  registry().loadedModules.splice(0);
});

describe('the row helpers', () => {
  it('builds the render key and logs a failed site', () => {
    assert.equal(
      cr(input(), input()),
      'C\u0000r\u000080\u0000false\u000044136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
    assert.equal(cr(null as never, input()), '');
    assert.equal(dr(input(), new Error('boom')), undefined);
    assert.equal(renderKeyFor, cr);
  });

  it('clears the held rows when the content fills them or the draw changes', () => {
    const base = { rows: 3, wasOff: false, input: input(), drawn: 'd' };
    assert.deepEqual(lr(base, { input: input(), drawn: 'd', contentRows: 5 }), {
      rows: undefined, wasOff: false, input: input(), drawn: 'd',
    });
    assert.deepEqual(lr(base, { input: input(), drawn: 'e', contentRows: undefined }), {
      rows: undefined, wasOff: false, input: input(), drawn: 'e',
    });
    assert.deepEqual(lr({ ...base, rows: undefined, wasOff: true }, { input: input(), drawn: 'd', contentRows: 1 }), {
      rows: undefined, wasOff: false, input: input(), drawn: 'd',
    });
    assert.equal(steadyRows, lr);
  });

  it('turns off into the last rows and back on for the first empty content', () => {
    const off = mr({ rows: undefined, wasOff: false, input: input(), drawn: undefined }, {
      input: input(), drawn: 'd', lastRows: 4, contentRows: 0,
    });
    assert.deepEqual(off, { rows: 4, wasOff: true, input: input(), drawn: 'd' });
    const other = mr({ rows: 3, wasOff: false, input: input({ requestId: 'x' }), drawn: 'd' }, {
      input: input(), drawn: 'd', lastRows: 4, contentRows: 2,
    });
    assert.deepEqual(other, { rows: 4, wasOff: true, input: input(), drawn: 'd' });
    assert.equal(offRows, mr);
  });

  it('keeps the held rows across renders', () => {
    assert.equal(run(() => fr({ isOff: false, input: input(), drawn: 'd', lastRows: 4 })), undefined);
    assert.equal(run(() => fr({ isOff: true, input: input(), drawn: 'd', lastRows: 4 })), 4);
    assert.equal(heldRows, fr);
  });
});

describe('the on-screen input', () => {
  it('passes the input unchanged while not fullscreen', () => {
    const result = run(() => ur(input(), false, undefined)) as Any;
    assert.deepEqual(result.input, input());
    assert.equal(result.site, undefined);
    assert.equal(result.lastRows, undefined);
    assert.equal(result.contentRows, undefined);
    assert.equal(onScreenInput, ur);
  });

  it('attaches the on-screen range and the frame rows in fullscreen', () => {
    setFullscreen(true);
    setRowAccountHost({
      rows: (active, onScreen) => active
        ? [{ tree: 's' }, { ...input(), props: { onScreen } }, 4, 7]
        : [undefined, undefined, undefined, undefined],
    });
    const result = run(() => ur(input(), true, undefined)) as Any;
    assert.deepEqual(result.site, { tree: 's' });
    assert.deepEqual(result.input.props, { onScreen: { ...input(), props: { onScreen: undefined } } });
    assert.equal(result.lastRows, 4);
    assert.equal(result.contentRows, 7);
  });
});

describe('the settled render', () => {
  it('subscribes only for a hooked input and returns the settled answer once cached', async () => {
    const off = run(() => xr(false, input(), { version: 1, staticFrame: false, submittedBy: undefined })) as Any;
    assert.equal(off.drawn, undefined);
    assert.equal(typeof off.onThrown, 'function');
    setRenderAnswerHost({ uiRender: async () => ({ type: 'Text', props: {}, children: ['drawn'] }) });
    const pending = run(() => xr(true, input(), { version: 1, staticFrame: false, submittedBy: undefined })) as Any;
    assert.equal(pending.drawn, undefined);
    assert.equal(typeof pending.onThrown, 'function');
    await (dce as Any).uiRender(input(), { origin: ['C'] });
    const seeded = run(() => xr(true, input(), { version: 1, staticFrame: false, submittedBy: 'C' }));
    assert.deepEqual(seeded.drawn, { type: 'Text', props: {}, children: ['drawn'] });
    assert.equal(settledRender, xr);
  });

  it('reads the render version of the terminal surface', () => {
    assert.equal(run(() => $e(input())), '0');
    assert.equal(renderVersionOf, $e);
  });

  it('merges the viewport store into the terminal input', () => {
    const result = run(() => VH('C', () => ({ requestId: 'r', props: { a: 1 } }), ['C']));
    assert.deepEqual(result, { surface: 'terminal', component: 'C', requestId: 'r', props: { a: 1 } });
  });
});

describe('the tree and the boundary', () => {
  it('wraps the walker in the render context', () => {
    const element = run(() => yt({ tree: { type: 'Text', props: {}, children: ['t'] }, input: input(), draw })) as Any;
    assert.deepEqual(show(element), {
      type: 'object', props: ['value'], children: [{ type: 'Text', props: [], children: ['t'] }],
    });
  });

  it('draws Pane without a boundary and everything else under it', () => {
    const pane = run(() => pr({
      tree: { type: 'Text', props: {}, children: ['t'] },
      input: input({ component: 'Pane' }), draw, submittedBy: undefined, onThrown: () => {},
    }));
    assert.equal(typeName((pane as Any).type), 'yt');
    const guarded = run(() => pr({
      tree: { type: 'Text', props: {}, children: ['t'] },
      input: input(), draw, submittedBy: undefined, onThrown: () => {},
    }));
    assert.deepEqual(show(guarded), {
      type: 'XD',
      props: ['resetKey', 'fallback', 'telemetryMessage', 'onError', 'children'],
      children: [{ type: 'yt', props: ['tree', 'input', 'draw'], children: [] }],
    });
    assert.equal(renderTreeGuarded, pr);
  });
});

describe('the surface node', () => {
  it('draws the fallback while no hook matches the component', () => {
    const result = run(() => hdn(input(), draw, 'C')) as Any;
    assert.equal(result.drawn, undefined);
    assert.equal(typeof result.hasThrown, 'function');
    assert.deepEqual(show(result.node), {
      type: 'Box',
      props: ['ref', 'flexDirection', 'renderEvent', 'renderComponent', 'drawPending', 'minHeight', 'overflow'],
      children: [{ type: 'Text', props: [], children: ['drawn'] }],
    });
    assert.deepEqual(show(run(() => TU(input(), draw, 'C'))), show(result.node));
    assert.equal(renderSiteNode, TU);
  });

  it('draws the settled tree under the boundary once a hook matches', async () => {
    setRenderAnswerHost({ uiRender: async () => ({ type: 'Text', props: {}, children: ['drawn'] }) });
    await (dce as Any).uiRender(input(), { origin: ['C'] });
    const mod = {
      name: 'm1', label: 'm1',
      hooks: (event: string) => event === 'ui.render',
      matcherFor: () => ({ surface: 'terminal', component: 'C', requestId: 'r' }),
      registrationsFor: () => [],
    };
    registry().loadedModules.push(mod as never);
    const result = run(() => hdn(input(), draw, 'C')) as Any;
    assert.deepEqual(result.drawn, { type: 'Text', props: {}, children: ['drawn'] });
    assert.deepEqual(show(result.node.children), [{
      type: 'XD',
      props: ['resetKey', 'fallback', 'telemetryMessage', 'onError', 'children'],
      children: [{ type: 'yt', props: ['tree', 'input', 'draw'], children: [] }],
    }]);
  });

  it('keeps the first-run ref for one mount', () => {
    assert.equal(run(() => ar(true)), false);
    assert.equal(run(() => ar(false)), true);
    assert.equal(firstRunRef, ar);
  });
});

describe('the local helpers', () => {
  it('answers the descriptor input only for the same component', () => {
    const tree = { type: 'Text', props: {}, children: [] };
    assert.deepEqual(uo(tree, input(), input()), input());
    assert.deepEqual(uo(tree, input(), input({ component: 'D' })), input({ component: 'D' }));
    bVe.set(tree as never, { of: (seen: Any) => ({ input: { ...input(), props: { seen } } }) });
    assert.deepEqual(CAt(tree, { k: 1 }), { ...input(), props: { seen: { k: 1 } } });
  });

  it('lists the candidate modules when no settled site is recorded', () => {
    const tree = { type: 'Text', props: {}, children: [] };
    assert.deepEqual(pIn([{ name: 'a' }, { name: 'b' }], tree), { load: 'a#undefined,b#undefined', lead: 'hooks' });
  });

  it('holds one render-version mount per key and releases it', () => {
    const release = Fss('K');
    assert.equal(typeof release, 'function');
    assert.equal(typeof Fss('K'), 'function');
    release();
  });

  it('notes a thrown render and formats the failure text', () => {
    assert.equal(typeof (dce as Any).noteThrown, 'function');
    assert.equal((dce as Any).heldRowsOf(input(), undefined), undefined);
    assert.equal(dIn('C', { load: 'm1#x', lead: 'm1' }), 'm1#x C threw while drawn');
    assert.equal(s5t('never noted'), false);
    assert.equal(typeof uIn, 'function');
  });

  it('keeps the aliases on the source names', () => {
    assert.equal(renderKeyFor, cr);
    assert.equal(renderVersionOf, $e);
    assert.equal(firstRunRef, ar);
    assert.equal(steadyRows, lr);
    assert.equal(offRows, mr);
    assert.equal(heldRows, fr);
    assert.equal(onScreenInput, ur);
    assert.equal(settledRender, xr);
    assert.equal(renderSiteNode, TU);
    assert.equal(GPn(input(), undefined).length, 0);
    assert.equal(Ioe.type, 'engine');
  });
});
