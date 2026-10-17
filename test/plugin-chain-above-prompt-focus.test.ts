import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ABOVE_PROMPT_REQUEST_ID,
  FOCUS_ACT_QUEUE_LIMIT,
  actHandlers,
  clampScrollTop,
  focusSiteDrawStore,
  focusablesOf,
  useActiveContext,
  useFocusRing,
  type FocusRingInput,
} from '../src/plugin-chain-above-prompt-focus.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { Uet, _z } from '../src/plugin-chain-scroll-focus.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';

test('clampScrollTop keeps the window inside the viewport unless the top is above the offset', () => {
  assert.equal(clampScrollTop({ offset: 0, bodyRows: 5, top: 10, bottom: 100 }), 10);
  assert.equal(clampScrollTop({ offset: 10, bodyRows: 5, top: 0, bottom: 100 }), 0);
  assert.equal(clampScrollTop({ offset: 10, bodyRows: 5, top: 90, bottom: 100 }), 90);
  assert.equal(clampScrollTop({ offset: 0, bodyRows: 10, top: 95, bottom: 100 }), 90);
  assert.equal(clampScrollTop({ offset: 50, bodyRows: 10, top: 40, bottom: 100 }), 40);
  assert.equal(clampScrollTop({ offset: 0, bodyRows: 10, top: 0, bottom: 5 }), 0);
});

test('the request id and queue limit match the source literals', () => {
  assert.equal(ABOVE_PROMPT_REQUEST_ID, 'above-prompt');
  assert.equal(FOCUS_ACT_QUEUE_LIMIT, 64);
});

test('focusablesOf walks Buttons, Inputs and Selects and skips other nodes', () => {
  const tree = {
    type: 'Box',
    children: [
      'text',
      { type: 'engine', children: [] },
      {
        type: 'Button',
        press: { plugin: 'p', handle: 'h' },
        props: { key: 'k1', autoFocus: true },
      },
      {
        type: 'Input',
        press: { plugin: 'p', handle: 'h2' },
        props: { key: 'k2', value: 'v' },
      },
      {
        type: 'Select',
        press: { plugin: 'p', handle: 'h3' },
        props: { key: 'k3', value: 'v3', options: [{ value: 'o' }] },
      },
    ],
  };
  assert.deepEqual(focusablesOf(tree), [
    { tag: 'Button', plugin: 'p', handle: 'h', element: 'k1', isAutoFocus: true },
    { tag: 'Input', plugin: 'p', handle: 'h2', element: 'k2', isAutoFocus: false, value: 'v' },
    {
      tag: 'Select',
      plugin: 'p',
      handle: 'h3',
      element: 'k3',
      isAutoFocus: false,
      value: 'v3',
      options: [{ value: 'o' }],
    },
  ]);
  assert.deepEqual(focusablesOf(undefined), []);
  assert.deepEqual(focusablesOf('engine'), []);
});

test('actHandlers wraps every entry except the kept ids and routes through act', () => {
  const acts: unknown[] = [];
  const built = actHandlers(
    { act: (value) => { acts.push(value); } },
    { a: 1, b: 2 },
    ['b'],
  );
  assert.equal(typeof built.a, 'function');
  assert.equal(built.b, 2);
  assert.equal(acts.length, 0);
  assert.equal((built.a as () => unknown)(), undefined);
  assert.deepEqual(acts, [1]);
});

test('useActiveContext registers the context while mounted and active', () => {
  const calls: string[] = [];
  const service = {
    registerActiveContext: (name: string) => {
      calls.push(`register:${name}`);
      return () => calls.push(`unregister:${name}`);
    },
    unregisterActiveContext: (name: string) => calls.push(`unregister-direct:${name}`),
  };
  const run = runComponent(() => {
    useActiveContext('prompt');
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.deepEqual(calls, ['register:prompt']);
  run.unmount();
  assert.deepEqual(calls, ['register:prompt', 'unregister-direct:prompt']);
});

test('useActiveContext does nothing when inactive or without a service', () => {
  const calls: string[] = [];
  const service = {
    registerActiveContext: (name: string) => {
      calls.push(`register:${name}`);
      return () => {};
    },
    unregisterActiveContext: () => {},
  };
  runComponent(() => {
    useActiveContext('prompt', false);
  }, { contexts: new Map([[keybindingContext, service]]) });
  runComponent(() => {
    useActiveContext('prompt');
  });
  assert.deepEqual(calls, []);
});

test('useFocusRing registers its site, runs acts immediately when idle, and forgets on unmount', () => {
  const input: FocusRingInput = {
    component: 'Comp',
    requestId: 'req',
    focusables: [],
    isHeld: false,
    isHeldNow: () => false,
    indexNow: () => null,
    isEmptyNow: () => true,
    land: () => {},
  };
  const run = runComponent(() => useFocusRing(input));
  const ring = run.result;
  const key = _z('Comp', 'req') as string;
  const site = Uet().get(key) as {
    component: string;
    requestId: string;
    holderNow(): unknown;
    hasElement(plugin: string, element: string): boolean;
    commit(request: unknown): unknown;
  };
  assert.equal(site.component, 'Comp');
  assert.equal(site.requestId, 'req');
  assert.equal(site.holderNow(), undefined);
  assert.equal(site.hasElement('p', 'e'), false);
  assert.equal(site.commit({ origin: { kind: 'person' } }), 'the focus moved meanwhile');

  let acts = 0;
  ring.act(() => {
    acts += 1;
  });
  assert.equal(acts, 1);
  ring.forget();
  run.unmount();
  assert.equal(Uet().has(key), false);
});

test('the focus draw store exposes emit', () => {
  const store = focusSiteDrawStore();
  assert.equal(typeof store.emit, 'function');
  store.emit();
});
