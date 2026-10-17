// W45-85: the Client host (`Io`), its acquisition hook (`So`), the terminal mount (`To`), the key
// binding (`wo`), the clock adapter (`Ro`), the loading snapshot (`bo`), the inert client (`Co`),
// the error boundary (`XD`) and the keybinding pre-dispatch hook (`Ey`), with the host bindings they
// read. Expected values were measured through the ported bodies (see .audit/w45-85-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { runComponent, Tc } from '../src/plugin-chain-react-hooks.js';
import { ee } from '../src/plugin-chain-press-button-source.js';
import { u } from '../src/plugin-chain-press-button-host.js';
import { XD, wo, To, Ro, bo, Co, So, Io, Ey } from '../src/plugin-chain-client-host-source.js';
import { Kje, $pn, W1o, c9, Ri, G1o, Zy, m4n, ot, VV, kAt, i5t, Qrt } from '../src/plugin-chain-client-host.js';
import {
  ClientHost, ClientMount, acquireClient, useClientInput, ErrorBoundary,
  usePreDispatch, clockEvery, CLIENT_LOADING_SNAPSHOT, INERT_CLIENT,
} from '../src/plugin-chain-client.js';

type Any = Record<string, any>;
type Element = { type: unknown; props: Any; children: Element[] };
const map = (entries: [unknown, unknown][]) => new Map(entries);
const Boundary = XD as unknown as new (props: Any) => Any;
const resetFocus = () => {
  Kje.setState(() => ({ focusedId: null }));
  Ri().setState(() => ({ open: [], focusedId: null, shownId: null, focusRequest: null }));
};

function fakeClient(overrides: Any = {}): Any {
  return {
    id: 'client-1',
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'loading' }),
    setProps: () => {},
    laidOut: () => {},
    resize: () => {},
    pointer: () => {},
    key: () => {},
    acceptsPointer: () => false,
    acceptsKeys: () => false,
    threw: () => {},
    drawnAgain: () => {},
    release: () => {},
    ...overrides,
  };
}

function service(calls: unknown[]): Any {
  return {
    bindings: [],
    registerHandler: () => () => {},
    registerPreDispatch: (options: { handler: unknown }) => {
      calls.push(options.handler);
      return () => calls.push('pre-unbind');
    },
  };
}

describe('the clock adapter', () => {
  it('waits for the clock to advance and unsubscribes on stop', () => {
    let now = 0;
    let alive = true;
    const ticks: (() => void)[] = [];
    const clock = {
      now: () => now,
      subscribeKeepAlive: (fn: () => void) => { ticks.push(fn); return () => { alive = false; }; },
    };
    let calls = 0;
    const stop = Ro(clock).every(100, () => { calls += 1; });
    now = 50;
    ticks.forEach((fn) => fn());
    assert.equal(calls, 0);
    now = 100;
    ticks.forEach((fn) => fn());
    assert.equal(calls, 1);
    now = 190;
    ticks.forEach((fn) => fn());
    assert.equal(calls, 1);
    stop();
    assert.equal(alive, false);
  });

  it('falls back to an interval of at least one frame', async () => {
    let calls = 0;
    const stop = Ro(null).every(1, () => { calls += 1; });
    await new Promise((resolve) => setTimeout(resolve, 60));
    stop();
    assert.ok(calls > 0);
    const settled = calls;
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls, settled);
  });
});

describe('the frozen client shapes', () => {
  it('exposes the loading snapshot and the inert instance', () => {
    assert.deepEqual(bo, { status: 'loading' });
    assert.equal(Object.isFrozen(bo), true);
    assert.deepEqual(
      { id: Co.id, plugin: Co.plugin, module: Co.module, pointer: Co.acceptsPointer(), keys: Co.acceptsKeys(), sameSnapshot: Co.getSnapshot() === bo, frozen: Object.isFrozen(Co) },
      { id: '', plugin: '', module: '', pointer: false, keys: false, sameSnapshot: true, frozen: true },
    );
  });
});

describe('the client acquisition', () => {
  it('acquires for the element and releases on unmount', () => {
    resetFocus();
    const requests: Any[] = [];
    const client = fakeClient();
    let released = 0;
    client.release = () => { released += 1; };
    const original = G1o.acquire;
    G1o.acquire = (request: Any) => { requests.push(request); return client as never; };
    try {
      const run = runComponent(() => So({ plugin: 'p', elementKey: 'b1', props: { v: 1 }, module: 'm' }), {
        contexts: map([[ee, { component: 'Pane', requestId: 'r1' }]]),
      });
      assert.equal(run.result, client);
      assert.deepEqual({
        plugin: requests[0].plugin, component: requests[0].component, requestId: requests[0].requestId,
        surface: requests[0].surface, key: requests[0].key, module: requests[0].module, props: requests[0].props,
        clock: typeof requests[0].clock.every,
      }, {
        plugin: 'p', component: 'Pane', requestId: 'r1', surface: 'terminal', key: 'b1', module: 'm',
        props: { v: 1 }, clock: 'function',
      });
      run.unmount();
      assert.equal(released, 1);
    } finally {
      G1o.acquire = original;
    }
  });

  it('defaults to the above-prompt component and the detached request id', () => {
    resetFocus();
    const requests: Any[] = [];
    const original = G1o.acquire;
    G1o.acquire = (request: Any) => { requests.push(request); return fakeClient() as never; };
    try {
      const run = runComponent(() => So({ plugin: 'p', elementKey: 'b1' }), { contexts: new Map() });
      assert.equal(requests[0].component, 'AbovePrompt');
      assert.equal(requests[0].requestId, 'detached');
      assert.equal(requests[0].module, undefined);
      assert.equal(requests[0].props, undefined);
      run.unmount();
    } finally {
      G1o.acquire = original;
    }
  });
});

describe('the Client host component', () => {
  it('draws the boundary, the fallback box and the terminal mount', () => {
    resetFocus();
    const snapshot = { status: 'loading' };
    const client = fakeClient({ getSnapshot: () => snapshot });
    const original = G1o.acquire;
    G1o.acquire = () => client as never;
    try {
      const run = runComponent(() => Io({ plugin: 'p', elementKey: 'b1', width: 10, height: 3, flexGrow: 1 }), {
        contexts: map([[ee, { component: 'Pane', requestId: 'r1' }]]),
      });
      const boundary = run.result as unknown as Element;
      const fallback = boundary.props.fallback as Element;
      const mounted = boundary.props.children as Element;
      assert.equal(boundary.type, XD);
      assert.equal(boundary.props.resetKey, snapshot);
      assert.equal((boundary.props.telemetryMessage as () => unknown)(), null);
      assert.equal(fallback.type, 'Box');
      assert.deepEqual(
        { shrink: fallback.props.flexShrink, width: fallback.props.width, height: fallback.props.height, grow: fallback.props.flexGrow, overflow: fallback.props.overflow },
        { shrink: 0, width: 10, height: 3, grow: 1, overflow: 'hidden' },
      );
      assert.equal(fallback.children[0].type, 'Text');
      assert.deepEqual(fallback.children[0].children, [' ']);
      assert.equal(mounted.type, To);
      assert.equal(mounted.props.host.plugin, 'p');
      assert.equal(mounted.props.instance, client);
      assert.equal(mounted.props.snapshot, snapshot);
      run.unmount();
    } finally {
      G1o.acquire = original;
    }
  });
});

describe('the terminal mount', () => {
  const host = () => ({
    rebuild: (tree: unknown) => Tc('Drawn', { tree }),
    props: { v: 2 }, width: 12, height: 4, flexGrow: 1, plugin: 'p', elementKey: 'b1', drawn: false,
  });

  it('lays out, forwards effects and draws the rebuilt tree', () => {
    resetFocus();
    const calls: unknown[] = [];
    const handlers: unknown[] = [];
    const instance = fakeClient({
      acceptsPointer: () => true,
      acceptsKeys: () => true,
      setProps: (props: Any) => calls.push(['setProps', props]),
      laidOut: () => calls.push(['laidOut']),
      resize: (width: number, height: number) => calls.push(['resize', width, height]),
      drawnAgain: () => calls.push(['drawnAgain']),
    });
    const run = runComponent(() => To({ host: host(), instance, snapshot: { status: 'drawn', tree: 'TREE' } }), {
      contexts: map([
        [Zy, { retainFinePointer: () => calls.push(['retain']) }],
        [u, service(handlers)],
      ]),
    });
    const root = run.result as unknown as Element;
    assert.equal(root.type, 'Box');
    assert.deepEqual(
      {
        direction: root.props.flexDirection, shrink: root.props.flexShrink, width: root.props.width,
        height: root.props.height, grow: root.props.flexGrow, overflow: root.props.overflow,
        key: root.props.elementKey, plugin: root.props.elementPlugin, ref: root.props.ref.current !== null,
        pointer: typeof root.props.onPointer, enter: typeof root.props.onMouseEnter, leave: typeof root.props.onMouseLeave,
      },
      {
        direction: 'column', shrink: 0, width: 12, height: 4, grow: 1, overflow: 'hidden',
        key: 'b1', plugin: 'p', ref: true, pointer: 'function', enter: 'function', leave: 'function',
      },
    );
    assert.deepEqual({ type: root.children[0].type, props: root.children[0].props }, { type: 'Drawn', props: { tree: 'TREE' } });
    assert.deepEqual(calls, [['setProps', { v: 2 }], ['drawnAgain'], ['laidOut'], ['resize', 0, 0], ['retain']]);
    assert.equal(handlers.length, 1);
    run.unmount();
  });

  it('maps pointer events, focuses the client and blurs the pane focus', () => {
    resetFocus();
    const calls: unknown[] = [];
    const instance = fakeClient({
      acceptsPointer: () => true,
      acceptsKeys: () => true,
      pointer: (event: Any) => calls.push(['pointer', event]),
    });
    const run = runComponent(() => To({ host: host(), instance, snapshot: { status: 'drawn', tree: 'T' } }), {
      contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service([])]]),
    });
    const root = run.result as unknown as Element;
    root.props.onPointer({ type: 'down', localCol: 2, localRow: 1, button: 2, fine: { col: 5, row: 6 }, shift: true, alt: true, ctrl: true });
    assert.deepEqual(calls.at(-1), ['pointer', { type: 'down', x: 2, y: 1, fine: { x: 5, y: 6 }, button: 'right', shift: true, alt: true, ctrl: true }]);
    assert.equal(Kje.getState().focusedId, 'client-1');
    root.props.onMouseEnter();
    root.props.onMouseLeave();
    assert.deepEqual(calls.slice(-2), [['pointer', { type: 'enter', x: 2, y: 1 }], ['pointer', { type: 'leave', x: 2, y: 1 }]]);
    run.unmount();
  });

  it('draws the failure text and attaches no handlers to a loading client', () => {
    resetFocus();
    const instance = fakeClient();
    const failed = runComponent(() => To({ host: host(), instance, snapshot: { status: 'failed', text: 'boom' } }), {
      contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service([])]]),
    });
    const failedRoot = failed.result as unknown as Element;
    assert.deepEqual(
      failedRoot.children.map((child) => [child.type, child.props, child.children]),
      [['Text', { dimColor: true, wrap: 'truncate-end' }, ['boom']]],
    );
    failed.unmount();
    const quiet = runComponent(() => To({ host: host(), instance, snapshot: { status: 'loading' } }), {
      contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service([])]]),
    });
    const quietRoot = quiet.result as unknown as Element;
    assert.equal(quietRoot.props.onPointer, undefined);
    assert.equal(quietRoot.props.onMouseEnter, undefined);
    assert.equal(quietRoot.children.length, 0);
    quiet.unmount();
  });
});

describe('the hosted client input', () => {
  it('clears a focused client when a pane takes focus', () => {
    resetFocus();
    Ri().setState((state) => ({ ...state, open: [{ id: 'd1' }], focusedId: 'd1', shownId: null }));
    Kje.setState(() => ({ focusedId: 'client-1' }));
    const run = runComponent(() => wo({ id: 'client-1', acceptsKeys: () => true, key: () => {} }), {
      contexts: map([[u, service([])]]),
    });
    assert.deepEqual({ ref: typeof (run.result as Any).current, focus: Kje.getState().focusedId }, { ref: 'object', focus: null });
    run.unmount();
  });

  it('consumes keys only for the focused client and maps the escape/ctrl paths', () => {
    resetFocus();
    const calls: unknown[] = [];
    const handlers: unknown[] = [];
    const pressed: Any[] = [];
    const instance = fakeClient({
      acceptsPointer: () => true,
      acceptsKeys: () => true,
      pointer: (event: Any) => calls.push(event),
      key: (binding: Any) => pressed.push(binding),
    });
    const run = runComponent(() => To({ host: { rebuild: () => null, props: {}, width: 1, height: 1, flexGrow: 0, plugin: 'p', elementKey: 'b1', drawn: false }, instance, snapshot: { status: 'drawn', tree: 'T' } }), {
      contexts: map([[Zy, { retainFinePointer: () => {} }], [u, service(handlers)]]),
    });
    const handler = handlers[0] as (key: string, event: Any, text: string) => unknown;
    $pn('client-1');
    assert.equal(handler('a', {}, 'a'), true);
    assert.deepEqual(pressed, [{ key: 'a' }]);
    $pn('other');
    assert.equal(handler('a', {}, 'a'), false);
    $pn('client-1');
    assert.equal(handler('', { escape: true }, ''), true);
    assert.equal(Kje.getState().focusedId, null);
    $pn('client-1');
    assert.equal(handler('c', { ctrl: true }, 'c'), undefined);
    assert.equal(Kje.getState().focusedId, null);
    instance.acceptsKeys = () => false;
    $pn('client-1');
    assert.equal(handler('b', {}, 'b'), false);
    assert.equal(Kje.getState().focusedId, null);
    run.unmount();
  });
});

describe('the pre-dispatch hook', () => {
  it('registers while active and unbinds on unmount', () => {
    const calls: unknown[] = [];
    const active = runComponent(() => Ey(() => true, {}), { contexts: map([[u, service(calls)]]) });
    assert.equal(calls.length, 1);
    assert.equal(typeof calls[0], 'function');
    active.unmount();
    assert.equal(calls.at(-1), 'pre-unbind');
    calls.length = 0;
    const inactive = runComponent(() => Ey(() => true, { isActive: false }), { contexts: map([[u, service(calls)]]) });
    assert.equal(calls.length, 0);
    inactive.unmount();
  });
});

describe('the error boundary', () => {
  it('resets on a new key and draws the fallback while caught', () => {
    const onError: unknown[] = [];
    const boundary = new Boundary({ resetKey: 1, fallback: 'FALLBACK', children: 'CHILD', onError: (error: unknown) => onError.push(error) });
    assert.deepEqual(boundary.state, { hasError: false, resetKey: 1 });
    assert.equal(boundary.render(), 'CHILD');
    boundary.state = { hasError: true, resetKey: 1 };
    assert.equal(boundary.render(), 'FALLBACK');
    assert.deepEqual(XD.getDerivedStateFromError(), { hasError: true });
    assert.equal(XD.getDerivedStateFromProps({ resetKey: 1 }, { hasError: true, resetKey: 1 }), null);
    assert.deepEqual(XD.getDerivedStateFromProps({ resetKey: 2 }, { hasError: true, resetKey: 1 }), { hasError: false, resetKey: 2 });
    boundary.componentDidCatch(Error('boom'), {});
    boundary.componentDidCatch(Error('again'), {});
    assert.equal(onError.length, 2);
  });

  it('attaches a telemetry message once and replaces a value that refuses one', () => {
    const plain = new Boundary({ resetKey: 1, fallback: null, children: 'C' });
    const thrown = Error('boom');
    assert.equal(plain.reported(thrown), thrown);
    assert.equal(VV(thrown), undefined);
    const silent = new Boundary({ resetKey: 1, telemetryMessage: () => null, fallback: null, children: 'C' });
    assert.equal(silent.reported(Error('x')), null);
    const throwing = new Boundary({ resetKey: 1, telemetryMessage: () => { throw Error('x'); }, fallback: null, children: 'C' });
    assert.equal(throwing.reported(Error('y')).telemetryMessage, 'a boundary caught a throw (message not reported)');
    const withMessage = new Boundary({ resetKey: 1, telemetryMessage: () => 'MSG', fallback: null, children: 'C' });
    const reported = withMessage.reported(thrown);
    assert.equal(reported, thrown);
    assert.equal(VV(reported), 'MSG');
    const frozen = Object.freeze(Error('frozen'));
    const replaced = withMessage.reported(frozen);
    assert.notEqual(replaced, frozen);
    assert.equal(VV(replaced), 'MSG');
    assert.equal((ot({}, 'M') as { telemetryMessage?: string }).telemetryMessage, 'M');
  });
});

describe('the host bindings', () => {
  it('keeps one focus store with its two setters', () => {
    resetFocus();
    $pn('a');
    assert.equal(Kje.getState().focusedId, 'a');
    W1o('b');
    assert.equal(Kje.getState().focusedId, 'a');
    W1o('a');
    assert.equal(Kje.getState().focusedId, null);
  });

  it('focuses an open pane and clears without opening', () => {
    Ri().setState(() => ({ open: [{ id: 'x' }], focusedId: null, shownId: null, focusRequest: null }));
    c9('x');
    assert.deepEqual(Ri().getSnapshot(), { open: [{ id: 'x' }], focusedId: 'x', shownId: 'x', focusRequest: null });
    c9('y');
    assert.deepEqual(Ri().getSnapshot(), { open: [{ id: 'x' }], focusedId: 'x', shownId: 'x', focusRequest: null });
    c9(null);
    assert.deepEqual(Ri().getSnapshot(), { open: [{ id: 'x' }], focusedId: null, shownId: 'x', focusRequest: null });
  });

  it('answers the inert client when no client runtime is bound', () => {
    const inert = G1o.acquire({ plugin: 'p', component: 'Pane', requestId: 'r', surface: 'terminal', key: 'k', clock: {} });
    assert.equal(inert.getSnapshot().status, 'loading');
    assert.equal(inert.acceptsPointer(), false);
    assert.equal(inert.acceptsKeys(), false);
    assert.equal(inert.id, '');
  });

  it('builds the telemetry descriptor and has no sink', () => {
    assert.deepEqual(kAt([]), { load: '', lead: 'hooks' });
    assert.deepEqual(kAt([{ name: 'a', environmentId: 'e' }]), { load: 'a#e', lead: 'a' });
    assert.deepEqual(kAt([{ name: 'a' }, { name: 'b' }]), { load: 'a#undefined,b#undefined', lead: 'hooks' });
    assert.equal(i5t('Client', { load: '', lead: 'hooks' }, 'Client'), null);
    assert.equal(Qrt('nope'), undefined);
  });

  it('retains the fine pointer through the layout context', () => {
    const retained: string[] = [];
    const run = runComponent(() => { m4n(true); return null; }, { contexts: map([[Zy, { retainFinePointer: () => retained.push('retain') }]]) });
    assert.deepEqual(retained, ['retain']);
    run.unmount();
    const silent = runComponent(() => { m4n(true); return null; }, { contexts: new Map() });
    silent.unmount();
  });
});

describe('the seam names', () => {
  it('declares the host, the mount and the boundary under their source aliases', () => {
    assert.equal(ClientHost, Io);
    assert.equal(acquireClient, So);
    assert.equal(ClientMount, To);
    assert.equal(useClientInput, wo);
    assert.equal(ErrorBoundary, XD);
    assert.equal(usePreDispatch, Ey);
    assert.equal(clockEvery, Ro);
    assert.equal(CLIENT_LOADING_SNAPSHOT, bo);
    assert.equal(INERT_CLIENT, Co);
  });
});
