// W45-84: the pressable Button (`Zt`), the action-key store (`Yt`) and seat (`Qt`/`Jt`), the
// hotkey seat (`y3n`), the focus blur (`_3n`), the click subscriber (`wFt`), the key normalization
// (`go`/`ko`), the keybinding service (`Lc`), the dialog store (`aq`/`Ff`/`iv`/`kj`) and the default
// app context (`Pg`/`Zy`). Expected values were measured through the ported bodies (see
// .audit/w45-84-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { fdn, ldn, pdn } from '../src/plugin-chain-select-field-source.js';
import {
  co, xo, Yt, Ds, _s, ee, Qt, Jt, y3n, _3n, Zt, yo, wFt, go, ko,
  Ge, Lc, aq, Ff, iv, kj, Pg, Zy,
} from '../src/plugin-chain-press-button-source.js';
import { u, ix, KH, bindFocusManager } from '../src/plugin-chain-press-button-host.js';
import { PressButton, ActionKeysSeat, HotkeySeat, RenderInstance } from '../src/plugin-chain-press-button.js';

type Held = Record<string, unknown>;
type Element = { type: unknown; props: Held; children: Element[] };
const map = (entries: [unknown, unknown][]) => new Map(entries);
const dialog = (open: unknown[] = []) => ({ getState: () => ({ open }), subscribe: () => () => {} });
const base = { plugin: 'p', handle: 1, element: 'b1', label: 'OK', held: [] as unknown[] };
const focusedContexts = () => map([[fdn, { plugin: 'p', handle: 1 }], [pdn, { current: null }], [ldn, () => {}]]);

const renderButton = (props: Record<string, unknown>, contexts = new Map<unknown, unknown>()): Element =>
  runComponent(() => Zt(props as never), { contexts }).result as unknown as Element;
const actionBox = (element: Element): Element =>
  element.children.find((child) => child.type === KH)!;
const renderProp = (element: Element) =>
  (actionBox(element).props.children as (state: Held) => Element);
const label = (props: Record<string, unknown>, state: Held) => {
  const text = renderProp(renderButton({ ...base, ...props }))(state);
  // Round-trip so absent optional props (`color: undefined`) do not count as own keys.
  return JSON.parse(JSON.stringify({
    type: text.type,
    props: { ...text.props, children: undefined },
    children: text.children,
  }));
};

describe('the action-key store', () => {
  it('orders by rank then sequence, and removes and clears', () => {
    const store = xo();
    const a = { action: 'x', rank: 0, seq: 0 };
    const b = { action: 'x', rank: 1, seq: 0 };
    const c = { action: 'x', rank: 1, seq: 0 };
    store.add(a);
    store.add(b);
    assert.equal(store.winnerOf('x'), b);
    assert.equal(co({ rank: 2, seq: 0 }, { rank: 1, seq: 9 }), true);
    assert.equal(co({ rank: 1, seq: 0 }, { rank: 1, seq: 0 }), false);
    store.add(c);
    assert.equal(store.winnerOf('x'), c);
    store.remove(c);
    assert.equal(store.winnerOf('x'), b);
    assert.equal(store.winnerOf('z'), undefined);
    store.clear();
    assert.equal(store.held().length, 0);
  });

  it('keeps the registry store and the binding contexts', () => {
    assert.equal(typeof Yt.add, 'function');
    assert.equal(typeof Yt.winnerOf, 'function');
    assert.deepEqual(Ds('act', [
      { action: 'act', context: 'Pane' },
      { action: 'other', context: 'X' },
      { action: 'act', context: 'Global' },
      { action: 'act', context: 'Pane' },
    ]), ['Pane', 'Global']);
    assert.equal(_s('Pane'), 2);
    assert.equal(_s('AbovePrompt'), 1);
    assert.equal(_s('Chat'), 0);
    assert.equal(_s(undefined), 0);
    assert.equal(Ge('x', 1), 'x');
  });
});

describe('the key helpers', () => {
  it('names an alignment and a key binding', () => {
    assert.equal(yo(0), 'left');
    assert.equal(yo(1), 'middle');
    assert.equal(yo(2), 'right');
    assert.equal(yo(undefined), undefined);
    assert.deepEqual(ko(' ', {}), { key: 'space' });
    assert.deepEqual(ko('a', { return: true }), { key: 'return' });
    assert.deepEqual(ko('a', { ctrl: true, shift: false, meta: true }), { key: 'a', ctrl: true, meta: true });
    assert.equal(ko('a', { wheelUp: true }), undefined);
    assert.equal(ko('', {}), undefined);
    assert.deepEqual(go.slice(0, 3), [['upArrow', 'up'], ['downArrow', 'down'], ['leftArrow', 'left']]);
  });
});

describe('the keybinding service and the dialog store', () => {
  it('reads the service from its context and answers null without one', () => {
    assert.equal(Lc(), null);
    const service = { bindings: [], registerHandler: () => () => {} };
    assert.equal(runComponent(() => Lc(), { contexts: map([[u, service]]) }).result, service);
  });

  it('throws the source message outside a dialog provider and answers the open gate', () => {
    assert.throws(
      () => runComponent(() => Ff(), { contexts: new Map() }),
      /useDialogStore cannot be called outside of a DialogStoreContext provider \(mounted by <AppStateProvider \/>\)/,
    );
    assert.deepEqual(iv({ open: [{ kind: 'a', userInvoked: true }, { kind: 'b' }] }), { kind: 'b' });
    assert.equal(iv({ open: [] }), null);
    assert.equal(runComponent(() => kj(), { contexts: map([[aq, dialog([{ userInvoked: false }])]]) }).result, true);
    assert.equal(runComponent(() => kj(), { contexts: map([[aq, dialog()]]) }).result, false);
  });
});

describe('the action-key seat', () => {
  it('registers one handler per bound context and holds its descriptor', () => {
    Yt.clear();
    const registrations: Held[] = [];
    const service = {
      bindings: [{ action: 'act', context: 'Pane' }, { action: 'act', context: 'Global' }],
      registerHandler: (options: Held) => { registrations.push(options); return () => {}; },
    };
    const seat = runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), {
      contexts: map([[u, service], [ee, { component: 'Pane' }], [aq, dialog()]]),
    });
    assert.equal(registrations.length, 2);
    assert.deepEqual(registrations.map((options) => ({
      action: options.action, context: options.context, singleKey: options.singleKey, fallback: options.fallback, handler: typeof options.handler,
    })), [
      { action: 'act', context: 'Pane', singleKey: true, fallback: true, handler: 'function' },
      { action: 'act', context: 'Global', singleKey: true, fallback: true, handler: 'function' },
    ]);
    const held = Yt.held().filter((entry: unknown) => (entry as Held).action === 'act') as Held[];
    assert.equal(held.length, 1);
    assert.deepEqual(
      { action: held[0].action, rank: held[0].rank, plugin: held[0].plugin, handle: held[0].handle, seq: typeof held[0].seq },
      { action: 'act', rank: 2, plugin: 'p', handle: 1, seq: 'number' },
    );
    seat.unmount();
    assert.equal(Yt.held().filter((entry: unknown) => (entry as Held).action === 'act').length, 0);
    assert.equal((registrations[0].handler as () => boolean)(), false);
    assert.equal(runComponent(() => Jt({ plugin: 'p', handle: 1, action: 'act' }), { contexts: map([[aq, dialog()]]) }).result, null);
  });

  it('registers nothing while a dialog is open or without a service', () => {
    Yt.clear();
    let registrations = 0;
    const service = {
      bindings: [{ action: 'act', context: 'Pane' }],
      registerHandler: () => { registrations += 1; return () => {}; },
    };
    runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), {
      contexts: map([[u, service], [aq, dialog([{ userInvoked: false }])]]),
    });
    assert.equal(registrations, 0);
    runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), { contexts: map([[aq, dialog()]]) });
    assert.equal(registrations, 0);
    Yt.clear();
  });
});

describe('the Button', () => {
  it('draws the click box, the action seat and the focusable action box', () => {
    const focusRef = { current: null };
    const element = renderButton(base, map([[fdn, { plugin: 'p', handle: 1 }], [pdn, focusRef], [ldn, () => {}]]));
    assert.equal(element.type, 'Box');
    assert.equal(element.props.flexShrink, 0);
    assert.equal(element.props.alignSelf, 'flex-start');
    assert.equal(element.props.elementKey, 'b1');
    assert.equal(element.props.elementPlugin, 'p');
    assert.equal(typeof element.props.onClick, 'function');
    assert.deepEqual(element.children.map((child) => child.type), [KH]);
    const box = actionBox(element);
    assert.equal(box.props.tabIndex, -1);
    assert.equal(box.props.flexShrink, 0);
    assert.equal(box.props.alignSelf, 'flex-start');
    assert.equal(typeof box.props.onAction, 'function');
    assert.equal(box.props.ref, focusRef);
    const withAction = renderButton({ ...base, action: 'act' }, focusedContexts());
    assert.deepEqual(withAction.children.map((child) => (typeof child.type === 'function' ? 'Jt' : child.type)), ['Jt', KH]);
  });

  it('draws the label, its focus and hover state, the held labels and the variants', () => {
    assert.deepEqual(label({}, {}), { type: 'Text', props: { inverse: false, bold: true, dimColor: false }, children: ['[ OK ]'] });
    assert.deepEqual(label({}, { focused: true }).props, { inverse: true, bold: true, dimColor: false });
    assert.deepEqual(label({}, { hovered: true }).props, { inverse: true, bold: true, dimColor: false });
    assert.deepEqual(label({ plain: true }, {}), { type: 'Text', props: { inverse: false, dimColor: false }, children: ['', '', 'OK'] });
    const hotkey = label({ plain: true, hotkey: 'k' }, {});
    assert.deepEqual(hotkey.props, { inverse: false, dimColor: false });
    assert.deepEqual(hotkey.children.map((child: unknown) => (typeof child === 'string' ? child : {
      type: (child as Element).type, props: (child as Element).props,
    })), [
      { type: 'Text', props: { color: 'suggestion' } }, ': ', 'OK',
    ]);
    assert.deepEqual(label({ held: ['A', 'B'] }, {}).children, ['[ ', 'A', 'B', ' ]']);
    assert.deepEqual(label({ dimColor: true }, {}).props, { inverse: false, bold: true, dimColor: true });
    assert.deepEqual(label({ variant: 'primary' }, {}).props, { inverse: false, bold: true, dimColor: false, color: 'suggestion' });
  });

  it('blurs a focused descendant and stops the immediate propagation on a click', () => {
    const run = runComponent(() => Zt(base as never), { contexts: focusedContexts() });
    const element = run.result as unknown as Element;
    const manager = { activeElement: null as unknown, blurs: 0, blur() { this.blurs += 1; } };
    bindFocusManager(run.runtime.nodes[0], manager);
    const calls: string[] = [];
    (element.props.onClick as (event: Held) => void)({ stopImmediatePropagation: () => calls.push('stop') });
    assert.deepEqual([manager.blurs, calls], [0, ['stop']]);
    manager.activeElement = run.runtime.nodes[0].children[0];
    (element.props.onClick as (event: Held) => void)({ stopImmediatePropagation: () => calls.push('stop') });
    assert.equal(manager.blurs, 1);
    assert.equal(calls.length, 2);
    manager.activeElement = { parentNode: null };
    _3n(run.runtime.nodes[0]);
    assert.equal(manager.blurs, 1);
    assert.throws(() => ix({}), /no focus manager is bound to this node/);
  });

  it('registers the hotkey on the seat and unbinds on unmount', () => {
    const calls: unknown[] = [];
    const run = runComponent(() => Zt({ ...base, hotkey: 'k' } as never), {
      contexts: map([
        [y3n, (hotkey: string, ref: unknown) => { calls.push([hotkey, ref !== null]); return () => calls.push('unbind'); }],
        [fdn, { plugin: 'p', handle: 1 }], [pdn, { current: null }], [ldn, () => {}],
      ]),
    });
    assert.deepEqual(calls, [['k', true]]);
    run.unmount();
    assert.deepEqual(calls, [['k', true], 'unbind']);
  });
});

describe('the click subscriber', () => {
  it('fires outside its ref, ignores a window activation and a press inside', () => {
    const clicks: string[] = [];
    const box: { subscriber: ((node: unknown, meta?: unknown) => void) | null } = { subscriber: null };
    const context = {
      subscribeClicks: (fn: (node: unknown, meta?: unknown) => void) => {
        box.subscriber = fn;
        return () => { box.subscriber = null; };
      },
    };
    const run = runComponent(() => wFt(() => clicks.push('fired')), { contexts: map([[Zy, context]]) });
    assert.equal(typeof box.subscriber, 'function');
    box.subscriber?.(null);
    box.subscriber?.({}, { isWindowActivation: true });
    assert.equal(clicks.length, 1);
    (run.result as { current: unknown }).current = {};
    box.subscriber?.({ parentNode: (run.result as { current: unknown }).current });
    assert.equal(clicks.length, 1);
    const defaultRun = runComponent(() => wFt(() => clicks.push('default')), { contexts: new Map() });
    assert.equal(typeof defaultRun.result.current, 'object');
    assert.equal(clicks.length, 1);
    assert.equal(Zy, Pg);
    assert.equal(typeof Pg.defaultValue.subscribeClicks, 'function');
  });
});

describe('the seam names', () => {
  it('declares the button, the seats and the instance context under their source names', () => {
    assert.equal(PressButton, Zt);
    assert.equal(ActionKeysSeat, Jt);
    assert.equal(HotkeySeat, y3n);
    assert.equal(RenderInstance, ee);
  });
});
