// W45-85 probe: the Client host, its acquisition hook, the terminal mount, the key binding, the
// clock adapter, the error boundary and the keybinding pre-dispatch hook. Values printed here
// belong in test/plugin-chain-client.test.ts.
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { Tc } from '../src/plugin-chain-react-hooks.js';
import { ee, Lc } from '../src/plugin-chain-press-button-source.js';
import { u } from '../src/plugin-chain-press-button-host.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import {
  XD, wo, To, Ro, bo, Co, So, Io, Ey,
} from '../src/plugin-chain-client-host-source.js';
import {
  Kje, $pn, W1o, c9, Ri, G1o, Zy, m4n, ot, VV, kAt, i5t, Qrt, iZr,
} from '../src/plugin-chain-client-host.js';

type Any = Record<string, unknown>;
const map = (entries: [unknown, unknown][]) => new Map(entries);

// The clock adapter.
const ticking: (() => void)[] = [];
let now = 0;
const clock = { now: () => now, subscribeKeepAlive: (fn: () => void) => { ticking.push(fn); return () => ticking.pop(); } };
let clockCalls = 0;
const every = Ro(clock).every(100, () => { clockCalls += 1; });
now = 50; ticking.forEach((fn) => fn());
console.log('clock early', clockCalls);
now = 100; ticking.forEach((fn) => fn());
console.log('clock due', clockCalls);
every();
let intervalCalls = 0;
const stop = Ro(null).every(1, () => { intervalCalls += 1; });
await new Promise((resolve) => setTimeout(resolve, 60));
stop();
console.log('interval fired', intervalCalls > 0);

// The two frozen shapes.
console.log('bo', JSON.stringify(bo), Object.isFrozen(bo));
console.log('Co', JSON.stringify({ id: Co.id, plugin: Co.plugin, module: Co.module, pointer: Co.acceptsPointer(), keys: Co.acceptsKeys(), snapshot: Co.getSnapshot() === bo, frozen: Object.isFrozen(Co) }));

// Acquire: request shape, release on unmount, default component and detached request id.
const requests: Any[] = [];
let released = 0;
const snap = { status: 'loading' };
const fake: Any = {
  id: 'client-1',
  subscribe: () => () => {},
  getSnapshot: () => snap,
  setProps: () => {},
  laidOut: () => {},
  resize: () => {},
  pointer: () => {},
  key: () => {},
  acceptsPointer: () => false,
  acceptsKeys: () => false,
  threw: () => {},
  drawnAgain: () => {},
  release: () => { released += 1; },
};
const originalAcquire = G1o.acquire;
G1o.acquire = (request) => { requests.push(request as unknown as Any); return fake as never; };
const acquired = runComponent(() => So({ plugin: 'p', elementKey: 'b1', props: { v: 1 }, module: 'm' }), {
  contexts: map([[ee, { component: 'Pane', requestId: 'r1' }]]),
});
console.log('acquire request', JSON.stringify({
  plugin: requests[0].plugin, component: requests[0].component, requestId: requests[0].requestId,
  surface: requests[0].surface, key: requests[0].key, module: requests[0].module,
  props: requests[0].props, clock: typeof (requests[0].clock as Any).every,
}), 'returns instance', acquired.result === fake);
acquired.unmount();
console.log('released', released);
const defaults = runComponent(() => So({ plugin: 'p', elementKey: 'b1' }), { contexts: new Map() });
console.log('acquire default', JSON.stringify({ component: requests[1].component, requestId: requests[1].requestId, module: requests[1].module, props: requests[1].props }));
defaults.unmount();

// Io: the boundary element, the fallback box and the mount child.
const io = runComponent(() => Io({ plugin: 'p', elementKey: 'b1', width: 10, height: 3, flexGrow: 1 }), { contexts: map([[ee, { component: 'Pane', requestId: 'r1' }]]) });
const boundary = io.result as Any;
const fallback = boundary.props.fallback as Any;
const mounted = boundary.props.children as Any;
console.log('io boundary', boundary.type === XD, 'resetKey is snapshot', boundary.props.resetKey === snap,
  'telemetry', (boundary.props.telemetryMessage as () => unknown)());
console.log('io fallback', fallback.type, fallback.props.flexShrink, fallback.props.width, fallback.props.height, fallback.props.flexGrow, fallback.props.overflow, fallback.children[0].type, JSON.stringify(fallback.children[0].children));
console.log('io mount', mounted.type === To, mounted.props.host.plugin, mounted.props.instance === fake, mounted.props.snapshot === snap);
io.unmount();

// To: the mount, layout effects, pointer mapping and the drawn/failed children.
const calls: unknown[] = [];
const preHandlers: ((key: string, event: Any, text: string) => boolean)[] = [];
const service = {
  bindings: [],
  registerHandler: () => () => {},
  registerPreDispatch: (options: { handler: (key: string, event: Any, text: string) => boolean }) => {
    preHandlers.push(options.handler);
    return () => {};
  },
};
const instance: Any = {
  ...fake,
  id: 'client-1',
  acceptsPointer: () => true,
  acceptsKeys: () => true,
  setProps: (props: Any) => calls.push(['setProps', props]),
  laidOut: () => calls.push(['laidOut']),
  resize: (w: number, h: number) => calls.push(['resize', w, h]),
  pointer: (event: Any) => calls.push(['pointer', event]),
  key: (binding: Any) => calls.push(['key', binding]),
  drawnAgain: () => calls.push(['drawnAgain']),
};
const host = {
  rebuild: (tree: unknown) => Tc('Drawn', { tree }),
  props: { v: 2 }, width: 12, height: 4, flexGrow: 1, plugin: 'p', elementKey: 'b1', drawn: false,
};
const mount = runComponent(() => To({ host, instance, snapshot: { status: 'drawn', tree: 'TREE' } }), {
  contexts: map([
    [Zy, { retainFinePointer: () => calls.push(['retain']) }],
    [u, service],
  ]),
});
const root = mount.result as Any;
console.log('mount root', root.type, JSON.stringify({
  direction: root.props.flexDirection, shrink: root.props.flexShrink, width: root.props.width,
  height: root.props.height, grow: root.props.flexGrow, overflow: root.props.overflow,
  key: root.props.elementKey, plugin: root.props.elementPlugin, refCurrent: root.props.ref.current !== null,
  pointer: typeof root.props.onPointer, enter: typeof root.props.onMouseEnter, leave: typeof root.props.onMouseLeave,
}));
console.log('mount child', root.children[0].type, JSON.stringify(root.children[0].props));
console.log('mount effects', JSON.stringify(calls));
console.log('pre allowed', preHandlers.length);
const handler = preHandlers[0];
$pn('client-1');
console.log('key focused', handler('a', {}, 'a'));
$pn('other');
console.log('key foreign', handler('a', {}, 'a'));
$pn('client-1');
console.log('key again', handler('a', {}, 'a'), JSON.stringify(calls.filter((call) => (call as unknown[])[0] === 'key')));
$pn('client-1');
console.log('key escape', handler('', { escape: true }, ''), Kje.getState().focusedId);
$pn('client-1');
console.log('key ctrl c', handler('c', { ctrl: true }, 'c'), Kje.getState().focusedId);
instance.acceptsKeys = () => false;
$pn('client-1');
console.log('key non-accepting', handler('b', {}, 'b'), Kje.getState().focusedId);
instance.acceptsKeys = () => true;
root.props.onPointer({ type: 'down', localCol: 2, localRow: 1, button: 2, fine: { col: 5, row: 6 }, shift: true, alt: true, ctrl: true });
console.log('pointer down', JSON.stringify(calls.filter((call) => (call as unknown[])[0] === 'pointer').at(-1)), 'focus', Kje.getState().focusedId);
root.props.onMouseEnter();
root.props.onMouseLeave();
console.log('pointer hover', JSON.stringify(calls.filter((call) => (call as unknown[])[0] === 'pointer').slice(-2)));
const failed = runComponent(() => To({ host, instance, snapshot: { status: 'failed', text: 'boom' } }), { contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service]]) });
console.log('failed child', (failed.result as Any).children.map((child: Any) => [child.type, JSON.stringify(child.props), JSON.stringify(child.children)]));
mount.unmount();

// A loading client with neither capability draws no handlers and no children.
const quiet: Any = { ...instance, acceptsPointer: () => false, acceptsKeys: () => false };
const quietRun = runComponent(() => To({ host, instance: quiet, snapshot: { status: 'loading' } }), { contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service]]) });
console.log('quiet handlers', typeof (quietRun.result as Any).props.onPointer, (quietRun.result as Any).children.length);
quietRun.unmount();

// wo: the click and focus path, and the pre-dispatch registration.
Ri().setState((state) => ({ ...state, open: [{ id: 'd1' }], focusedId: 'd1', shownId: null }));
Kje.setState(() => ({ focusedId: 'client-1' }));
const bound = runComponent(() => wo({ id: 'client-1', acceptsKeys: () => true, key: () => {} }), {
  contexts: map([[u, service]]),
});
console.log('wo ref', typeof (bound.result as Any).current);
console.log('wo focus clear', Kje.getState().focusedId);
bound.unmount();

// Ey: registration, the active gate and the unbind.
let binds = 0;
const eyService = {
  bindings: [],
  registerHandler: () => () => {},
  registerPreDispatch: () => { binds += 1; return () => { binds -= 1; }; },
};
const ey = runComponent(() => Ey(() => true), { contexts: map([[u, eyService]]) });
console.log('ey bound', binds);
ey.unmount();
console.log('ey unbound', binds);
const inactive = runComponent(() => Ey(() => true, { isActive: false }), { contexts: map([[u, eyService]]) });
console.log('ey inactive', binds);
inactive.unmount();

// XD: state transitions, the reported error and the fallback.
const boundaryInstance = new (XD as new (props: Any) => Any)({
  resetKey: 1, fallback: 'FALLBACK', children: 'CHILD', onError: (error: unknown) => calls.push(['onError', String(error)]),
});
console.log('boundary state', JSON.stringify(boundaryInstance.state));
console.log('boundary render', boundaryInstance.render());
boundaryInstance.state = { hasError: true, resetKey: 1 };
console.log('boundary fallback', boundaryInstance.render());
console.log('derived error', JSON.stringify(XD.getDerivedStateFromError()));
console.log('derived props same', XD.getDerivedStateFromProps({ resetKey: 1 }, { hasError: true, resetKey: 1 }));
console.log('derived props reset', JSON.stringify(XD.getDerivedStateFromProps({ resetKey: 2 }, { hasError: true, resetKey: 1 })));
const thrown = Error('boom');
console.log('reported without hook', boundaryInstance.reported(thrown) === thrown);
const withMessage = new (XD as new (props: Any) => Any)({ resetKey: 1, telemetryMessage: () => 'MSG', fallback: null, children: 'C', onError: (error: unknown) => calls.push(['onError', String(error)]) });
const attached = withMessage.reported(thrown);
console.log('reported attaches', attached === thrown, VV(attached));
const throwingMessage = new (XD as new (props: Any) => Any)({ resetKey: 1, telemetryMessage: () => { throw Error('x'); }, fallback: null, children: 'C' });
console.log('reported throwing', throwingMessage.reported(Error('y')).telemetryMessage);
const frozen = Object.freeze(Error('frozen'));
const pinned = new (XD as new (props: Any) => Any)({ resetKey: 1, telemetryMessage: () => 'F', fallback: null, children: 'C' });
const replaced = pinned.reported(frozen);
console.log('reported pinned', replaced !== frozen, VV(replaced));
withMessage.componentDidCatch(Error('z'), {});
withMessage.componentDidCatch(Error('w'), {});
console.log('onError calls', calls.filter((call) => (call as unknown[])[0] === 'onError').length);

// Host helpers.
console.log('kAt empty', JSON.stringify(kAt([])), 'one', JSON.stringify(kAt([{ name: 'a', environmentId: 'e' }])), 'two lead', JSON.stringify(kAt([{ name: 'a' }, { name: 'b' }])));
console.log('i5t', i5t('Client', { load: '', lead: 'hooks' }, 'Client'));
console.log('Qrt unknown', Qrt('nope'));
console.log('m4n default', (() => { const run = runComponent(() => { m4n(true); return null; }, { contexts: new Map() }); run.unmount(); return 'ok'; })());
const retained: string[] = [];
const m4nRun = runComponent(() => { m4n(true); return null; }, { contexts: map([[Zy, { retainFinePointer: () => retained.push('retain') }]]) });
console.log('m4n retained', retained.length);
m4nRun.unmount();
console.log('iZr base', new iZr({ a: 1 }).props.a);

// The focus store: set, clear-if-holder, clear-if-other.
$pn('a');
console.log('focus set', Kje.getState().focusedId);
W1o('b');
console.log('focus kept', Kje.getState().focusedId);
W1o('a');
console.log('focus cleared', Kje.getState().focusedId);
Ri().setState(() => ({ open: [{ id: 'x' }], focusedId: null, shownId: null, focusRequest: null }));
c9('x');
console.log('c9 open', JSON.stringify(Ri().getSnapshot()));
c9('y');
console.log('c9 closed id', JSON.stringify(Ri().getSnapshot()));
c9(null);
console.log('c9 null', JSON.stringify(Ri().getSnapshot()));

G1o.acquire = originalAcquire;
const inert = G1o.acquire({ plugin: 'p', component: 'Pane', requestId: 'r', surface: 'terminal', key: 'k', clock: {} });
console.log('inert acquire', inert.getSnapshot().status, inert.acceptsPointer(), inert.acceptsKeys(), inert.id === '');

