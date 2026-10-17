// The render-version and render-key layer (W45-87). Expected values were measured through the
// ported bodies (see .audit/w45-87-probe.txt): the render key, the props key, the version reader,
// the on-screen range, the hooks gates and the two stores the terminal glue reads.
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { it as registry } from '../src/plugin-chain-host.js';
import { bindRenderVersions } from '../src/plugin-chain-notify-fold.js';
import { OL, Rc, jf } from '../src/plugin-chain-notify-fold-source.js';
import {
  vA, oIn, MF, kVe, mIn, Tc as TcSource, $H, wc, kc, wH, kH, xc, Rb, sur, iur,
  j3e, Ioe, Omt, l9, Frt, LAt, WPn, SVe, GPn as GPnSource, $ur, blt, eA, at, yno,
} from '../src/plugin-chain-render-keys-source.js';
import {
  renderEventName, renderKeyOf, renderKey, renderVersion, propsKey, onScreenRange,
  drawsAnything, renderEventHooked, renderEventHookedFor,
} from '../src/plugin-chain-render-keys.js';

// Copied bodies declare every parameter position; the live callers omit the trailing ones.
const Tc = TcSource as (state: unknown, keys?: readonly string[], pace?: string) => string;
const GPn = GPnSource as (input: unknown, store?: unknown) => any[];

type Any = Record<string, any>;
const input = (over: Any = {}) => ({ surface: 'terminal', component: 'C', requestId: 'r', ...over });

let state: Map<string, number>;
let unbind: () => void;
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
afterEach(() => unbind());

describe('the keys', () => {
  it('names the render event and the viewport key', () => {
    assert.equal(vA, 'ui.render');
    assert.equal(oIn, 'ui.render viewport');
    assert.equal(renderEventName, vA);
  });

  it('builds the render key from surface, component and request id', () => {
    assert.equal(MF({ surface: 'terminal', component: 'C', requestId: 'r' }), 'terminal\u0000C\u0000r');
    assert.equal(renderKeyOf, MF);
    assert.equal(jf('K'), 'K' + Rc);
  });

  it('suffixes a key with its version only when one is stored', () => {
    state.set(jf(MF(input())), 11);
    assert.equal($H('KEY', state as never, MF(input())), 'KEY\u0000\u000011');
    assert.equal($H('KEY', state as never, MF(input({ requestId: 'none' }))), 'KEY');
  });

  it('keys the props by viewport columns, fullscreen and the props hash', () => {
    const key = mIn({ viewport: { columns: 80, isFullscreen: false }, props: { a: 1 } });
    const parts = key.split('\u0000');
    assert.deepEqual(parts.slice(0, 2), ['80', 'false']);
    assert.match(parts[2] as string, /^[0-9a-f]{64}$/);
    assert.equal(mIn({ viewport: { columns: 80, isFullscreen: false }, props: { a: 2 } }) === key, false);
    assert.equal(propsKey, mIn);
  });

  it('reads the event counter and every listed key version', () => {
    state.set(vA, 5);
    state.set('K', 2);
    state.set('K live', 3);
    assert.equal(Tc(state as never, ['K']), '5\u0000K\u00002');
    assert.equal(Tc(state as never, ['K'], 'live'), '5\u0000K\u00003');
    assert.equal(renderVersion, Tc);
  });

  it('skips the viewport and version keys when reading the visible map', () => {
    state.set(vA, 5);
    state.set(oIn, 9);
    state.set('K', 2);
    state.set('K live', 3);
    state.set('S' + Rc, 4);
    state.set('other', 7);
    assert.equal(Tc(state as never), 'ui.render\u00005\u0000K\u00002\u0000other\u00007\u0000');
  });

  it('computes the keyed render key from the store version', () => {
    state.set(vA, 5);
    state.set(jf(MF(input())), 11);
    assert.equal(kVe(state, input({ viewport: { columns: 80, isFullscreen: false }, props: {} })), '5\u0000\u000011');
    assert.equal(renderKey, kVe);
  });

  it('bumps one render-version key', () => {
    state.set('K', 2);
    wc('K');
    assert.equal(state.get('K'), 3);
    assert.equal(OL() === registry().renderVersions, true);
  });

  it('names the live and steady keys', () => {
    assert.equal(kc, ' live');
    assert.equal(wH('a live'), true);
    assert.equal(kH('a'), 'a live');
    assert.equal(xc('a', 'live'), 'a live');
    assert.equal(xc('a', 'steady'), 'a');
    assert.equal(Rb('a' + Rc), true);
  });
});

describe('the drawing tests', () => {
  it('sees a position or offset prop', () => {
    assert.equal(sur({ position: 'absolute' }), true);
    assert.equal(sur({ top: 1 }), true);
    assert.equal(sur({ color: 'red' }), false);
    assert.equal(sur(undefined), false);
  });

  it('decides whether a drawn value draws anything', () => {
    assert.equal(iur('s'), false);
    assert.equal(iur({ type: 'engine' }), false);
    assert.equal(iur({ type: 'Text' }), false);
    assert.equal(iur({ type: 'Text', props: { top: 1 } }), false);
    assert.equal(iur({ type: 'Box', props: { top: 1 } }), true);
    assert.equal(iur({ type: 'Box', children: [{ type: 'Box', props: { top: 1 } }] }), true);
    assert.equal(iur({ type: 'Link', props: {} }), false);
    assert.equal(drawsAnything, iur);
  });

  it('reads the on-screen range', () => {
    assert.deepEqual($ur({ props: { onScreen: { first: 1, last: 2, of: 3 } } }), { first: 1, last: 2, of: 3 });
    assert.equal($ur({ props: { onScreen: null } }), null);
    assert.equal($ur({ props: {} }), undefined);
    assert.equal($ur({ props: { onScreen: { first: 'x' } } }), undefined);
    assert.equal(onScreenRange, $ur);
  });
});

describe('the stores and sentinels', () => {
  it('carries the message types and the engine sentinel', () => {
    assert.deepEqual([...j3e], ['UserMessage', 'AssistantMessage', 'ToolUse', 'ToolResult', 'ToolGroup', 'CommandOutput', 'TurnDuration', 'InfoNotice']);
    assert.deepEqual(Ioe, { type: 'engine', ref: 0 });
  });

  it('starts the static-frame store false and the viewport store empty', () => {
    assert.equal(Omt.defaultValue, false);
    assert.equal(typeof (l9 as Any).get, 'function');
    assert.equal((l9 as Any).get(), undefined);
  });
});

describe('the hooks gates', () => {
  const records: Any[] = [];
  afterEach(() => {
    for (const record of records.splice(0)) {
      const at = registry().loadedModules.indexOf(record as never);
      if (at >= 0) registry().loadedModules.splice(at, 1);
    }
  });
  const install = (name: string, component: string) => {
    const record = { name, label: name, hooks: (event: string) => event === vA, matcherFor: () => ({ surface: 'terminal', component, requestId: 'r' }) };
    registry().loadedModules.push(record as never);
    records.push(record);
    return record;
  };

  it('lists the modules that hook the render event and match a component', () => {
    install('m1', 'C');
    install('m2', 'D');
    assert.deepEqual(WPn(input({ component: 'C' })).map((m) => m.name), ['m1']);
    assert.deepEqual(SVe(input({ component: 'D' })), ['m2']);
  });

  it('answers whether any module hooks the event, and whether one matches the component', () => {
    assert.equal(Frt('C'), false);
    install('m1', 'C');
    assert.equal(Frt('C'), true);
    assert.equal(LAt(input({ component: 'C' })), true);
    assert.equal(LAt(input({ component: 'E' })), false);
    assert.equal(renderEventHooked, Frt);
    assert.equal(renderEventHookedFor, LAt);
  });

  it('filters the render-event hooks by component', () => {
    install('m1', 'C');
    install('m2', 'D');
    assert.equal(GPn(input({ component: 'C' })).length, 1);
    assert.equal(GPn(input({ component: 'E' })).length, 0);
  });
});

describe('the hash helpers', () => {
  it('hashes text and bytes with sha256', () => {
    assert.equal(at('x'), '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');
    assert.equal(eA.test(at('x')), true);
    assert.equal(eA.test('x'), false);
  });

  it('memoizes the JSON id per object', () => {
    const value = { a: 1 };
    assert.equal(yno(value), yno(value));
    assert.equal(yno({ a: 1 }), yno({ a: 1 }));
  });

  it('checks one matcher field', () => {
    assert.equal(blt({ a: 1 }, 'a', 1), true);
    assert.equal(blt({ a: 2 }, 'a', 1), false);
    assert.equal(blt(undefined, 'a', 1), true);
  });
});
