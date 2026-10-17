// W45-84 probe: the pressable Button `Zt`, the action-key store and seats, the click subscriber,
// the key normalization, the focus blur, the keybinding context, the dialog store and the default
// app context. Values printed here belong in test/plugin-chain-press-button.test.ts.
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { fdn, ldn, pdn } from '../src/plugin-chain-select-field-source.js';
import {
  co, xo, Yt, Ds, _s, ee, Qt, Jt, y3n, _3n, Zt, yo, wFt, go, ko,
  Ge, Lc, aq, Ff, iv, kj, Pg, Zy,
} from '../src/plugin-chain-press-button-source.js';
import { u, ix, KH, bindFocusManager } from '../src/plugin-chain-press-button-host.js';

type Held = Record<string, unknown>;
const contexts = (entries: [unknown, unknown][]) => new Map(entries);

console.log('Ge', Ge('x', 1), co({ rank: 1, seq: 1 }, { rank: 1, seq: 2 }), co({ rank: 2, seq: 0 }, { rank: 1, seq: 9 }), co({ rank: 1, seq: 0 }, { rank: 1, seq: 0 }));
const store = xo();
const a = { action: 'x', rank: 0, seq: 0 };
const b = { action: 'x', rank: 1, seq: 0 };
const c = { action: 'x', rank: 1, seq: 0 };
store.add(a); store.add(b);
console.log('winner rank', store.winnerOf('x') === b);
store.add(c);
console.log('winner seq', store.winnerOf('x') === c, 'held', store.held().length);
store.remove(c);
console.log('after remove', store.winnerOf('x') === b);
const a2 = { action: 'x', rank: 1, seq: 0 };
store.add(a2);
console.log('later same-rank wins', store.winnerOf('x') === a2);
console.log('unknown action', store.winnerOf('z'));
store.clear();
console.log('cleared', store.held().length);
console.log('Yt is store', typeof Yt.add, typeof Yt.winnerOf);
console.log('Ds', JSON.stringify(Ds('act', [
  { action: 'act', context: 'Pane' }, { action: 'other', context: 'X' }, { action: 'act', context: 'Global' }, { action: 'act', context: 'Pane' },
])));
console.log('_s', _s('Pane'), _s('AbovePrompt'), _s('Chat'), _s(undefined));
console.log('yo', JSON.stringify([yo(0), yo(1), yo(2), yo(undefined)]));
console.log('ko space', JSON.stringify(ko(' ', {})), 'named', JSON.stringify(ko('a', { return: true })), 'ctrl', JSON.stringify(ko('a', { ctrl: true, shift: false, meta: true })), 'wheel', ko('a', { wheelUp: true }), 'empty', ko('', {}));
console.log('go named', JSON.stringify(go.slice(0, 3)));

console.log('Lc empty', Lc(undefined as never));
const service = { bindings: [{ action: 'act', context: 'Pane' }], registerHandler: () => () => {} };
console.log('Lc mounted', runComponent(() => Lc(), { contexts: contexts([[u, service]]) }).result === service);

const dialog = { getState: () => ({ open: [{ userInvoked: false }] }), subscribe: () => () => {} };
console.log('Ff empty', (() => { try { runComponent(() => Ff(), { contexts: new Map() }); return 'no-throw'; } catch (error) { return String(error); } })());
console.log('iv', JSON.stringify(iv({ open: [{ kind: 'a', userInvoked: true }, { kind: 'b' }] })), JSON.stringify(iv({ open: [] })));
console.log('kj open', runComponent(() => kj(), { contexts: contexts([[aq, dialog]]) }).result);
console.log('kj closed', runComponent(() => kj(), { contexts: contexts([[aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }]]) }).result);

// Action-key seat: registration per bound context.
const registrations: unknown[] = [];
const binds = {
  bindings: [{ action: 'act', context: 'Pane' }, { action: 'act', context: 'Global' }],
  registerHandler: (options: unknown) => { registrations.push(options); return () => {}; },
};
const seat = runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), {
  contexts: contexts([[u, binds], [ee, { component: 'Pane' }], [aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }]]),
});
console.log('registrations', registrations.length, JSON.stringify(registrations.map((r) => {
  const o = r as Held;
  return { action: o.action, context: o.context, singleKey: o.singleKey, fallback: o.fallback, handler: typeof o.handler };
})));
console.log('held entry', JSON.stringify(Yt.held().filter((entry) => (entry as Held).action === 'act').map((entry) => {
  const e = entry as Held;
  return { action: e.action, rank: e.rank, plugin: e.plugin, handle: e.handle, seqType: typeof e.seq };
})));
seat.unmount();
const noWinner = (registrations[0] as Held).handler as () => boolean;
console.log('handler no winner', noWinner());
console.log('held after unmount', Yt.held().filter((entry) => (entry as Held).action === 'act').length);
registrations.length = 0;
runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), { contexts: contexts([[u, binds], [ee, { component: 'Pane' }], [aq, { getState: () => ({ open: [{ userInvoked: false }] }), subscribe: () => () => {} }]]) });
console.log('dialog open registrations', registrations.length);
runComponent(() => Qt({ plugin: 'p', handle: 1, action: 'act' }), { contexts: contexts([[aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }]]) });
console.log('no service registrations', registrations.length);
console.log('Jt returns', JSON.stringify(runComponent(() => Jt({ plugin: 'p', handle: 1, action: 'act' }), { contexts: contexts([[aq, { getState: () => ({ open: [] }), subscribe: () => () => {} }]]) }).result));

// The Button.
const focusRef = { current: null };
const buttonContexts = contexts([
  [fdn, { plugin: 'p', handle: 1 }], [pdn, focusRef], [ldn, () => {}],
]);
const base = { plugin: 'p', handle: 1, element: 'b1', label: 'OK', held: [] as unknown[] };
const renderButton = (props: Record<string, unknown>, ctx = new Map<unknown, unknown>()) =>
  runComponent(() => Zt(props), { contexts: ctx }).result as UnknownElement;
const renderProp = (element: UnknownElement) => {
  const box = (element.children as UnknownElement[]).find((child) => child.type === KH)!;
  return (box.props as Held).children as (state: Held) => UnknownElement;
};
const labelOf = (state: Held, props: Record<string, unknown> = {}) => {
  const element = renderProp(renderButton({ ...base, ...props }));
  const label = element(state);
  return { type: label.type, props: { ...label.props, children: undefined }, children: (label.children as unknown[]).map((child) => typeof child === 'string' ? child : { type: (child as UnknownElement).type, props: (child as UnknownElement).props }) };
};
const button = runComponent(() => Zt(base), { contexts: buttonContexts });
const element = button.result as UnknownElement;
const props = element.props as Held;
console.log('button root', element.type, JSON.stringify({ flexShrink: props.flexShrink, alignSelf: props.alignSelf, elementKey: props.elementKey, elementPlugin: props.elementPlugin, click: typeof props.onClick }));
console.log('button children types', JSON.stringify((element.children as UnknownElement[]).map((child) => child.type)));
const box = (element.children as UnknownElement[]).find((child) => child.type === KH)!;
console.log('action box', JSON.stringify({ tabIndex: (box.props as Held).tabIndex, flexShrink: (box.props as Held).flexShrink, alignSelf: (box.props as Held).alignSelf, action: typeof (box.props as Held).onAction, ref: (box.props as Held).ref === focusRef }));
console.log('label idle', JSON.stringify(labelOf({})));
console.log('label focused', JSON.stringify(labelOf({}, { }).props), JSON.stringify(labelOf({}, { }).children), 'focused state', JSON.stringify(labelOf({ focused: true }).props));
console.log('label hovered', JSON.stringify(labelOf({ hovered: true }).props));
console.log('label plain', JSON.stringify(labelOf({}, { plain: true })));
console.log('label plain hotkey', JSON.stringify(labelOf({}, { plain: true, hotkey: 'k' })));
console.log('label held', JSON.stringify(labelOf({}, { held: ['A', 'B'] })));
console.log('label dim', JSON.stringify(labelOf({}, { dimColor: true })));
console.log('label primary', JSON.stringify(labelOf({}, { variant: 'primary' })));
const focusedButton = runComponent(() => Zt(base), { contexts: buttonContexts });
console.log('focused root inverse', JSON.stringify((( (focusedButton.result as UnknownElement).children.find((child) => child.type === KH)!.props as Held).children as (state: Held) => UnknownElement)({}).props));
const actionButton = runComponent(() => Zt({ ...base, action: 'act' }), { contexts: buttonContexts });
console.log('action child', JSON.stringify((actionButton.result as UnknownElement).children.map((child) => typeof child.type === 'function' ? 'Jt' : child.type)));

// Click: blur a focused descendant and stop the immediate propagation.
const manager = { activeElement: null as unknown, blurs: 0, blur() { this.blurs += 1; } };
bindFocusManager(button.runtime.nodes[0], manager);
const calls: string[] = [];
props.onClick?.({ stopImmediatePropagation: () => calls.push('stop') });
console.log('click without active', manager.blurs, calls.join(','));
manager.activeElement = button.runtime.nodes[0].children[0];
props.onClick?.({ stopImmediatePropagation: () => calls.push('stop') });
console.log('click with active child', manager.blurs, calls.length);
manager.activeElement = { parentNode: null };
console.log('_3n outside', (() => { try { _3n(button.runtime.nodes[0]); return manager.blurs; } catch (error) { return String(error); } })());
console.log('ix unbound', (() => { try { ix({}); return 'no-throw'; } catch (error) { return String(error); } })());

// Hotkey seat.
const hotkeys: unknown[] = [];
const hotkeyRun = runComponent(() => Zt({ ...base, hotkey: 'k' }), {
  contexts: contexts([[y3n, (hotkey: string, ref: unknown) => { hotkeys.push([hotkey, ref !== null]); return () => hotkeys.push('unbind'); }], [fdn, { plugin: 'p', handle: 1 }], [pdn, focusRef], [ldn, () => {}]]),
});
console.log('hotkey calls', JSON.stringify(hotkeys));
hotkeyRun.unmount();
console.log('hotkey after unmount', JSON.stringify(hotkeys));

// Click subscriber.
const clicks: string[] = [];
let subscriber: ((node: unknown, meta?: unknown) => void) | null = null;
const clickContext = { subscribeClicks: (fn: (node: unknown, meta?: unknown) => void) => { subscriber = fn; return () => { subscriber = null; }; } };
const subRun = runComponent(() => wFt(() => clicks.push('fired')), { contexts: contexts([[Zy, clickContext]]) });
console.log('subscribed', typeof subscriber);
subscriber?.(null);
subscriber?.({}, { isWindowActivation: true });
console.log('outside + activation', clicks.length);
const attached = {};
subRun.result.current = attached;
subscriber?.({ parentNode: attached });
console.log('inside', clicks.length, 'ref type', typeof subRun.result.current);
const noContextRun = runComponent(() => wFt(() => clicks.push('default')), { contexts: new Map() });
console.log('default subscribe', typeof noContextRun.result.current, clicks.length);

console.log('Pg default', Zy === Pg, typeof Pg.defaultValue.subscribeClicks);

interface UnknownElement { type: unknown; props: unknown; children: UnknownElement[] }
