import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consumeFocusRequest,
  nextOpenId,
  useDebouncedCallback,
  useKeybinding,
  useKeybindings,
} from '../src/plugin-chain-above-prompt-keybinding.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import { Ri } from '../src/plugin-chain-client-host.js';
import { eE, type MarkdownClock } from '../src/plugin-chain-markdown-host.js';

interface Registration {
  action: string;
  context: string;
  handler: () => unknown;
  singleKey: boolean;
}

function fakeService() {
  const registered: Registration[] = [];
  const unregistered: string[] = [];
  return {
    registered,
    unregistered,
    registerHandler(registration: Registration) {
      registered.push(registration);
      return () => unregistered.push(registration.action);
    },
  };
}

test('useKeybinding registers one action with the current handler and unregisters on unmount', () => {
  const service = fakeService();
  const handler = () => 'answer';
  const run = runComponent(() => {
    useKeybinding('prompt:submit', handler, { context: 'Chat' });
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.equal(service.registered.length, 1);
  assert.equal(service.registered[0].action, 'prompt:submit');
  assert.equal(service.registered[0].context, 'Chat');
  assert.equal(service.registered[0].singleKey, true);
  assert.equal(service.registered[0].handler(), 'answer');
  run.unmount();
  assert.deepEqual(service.unregistered, ['prompt:submit']);
});

test('useKeybinding defaults to the Global context and does nothing while inactive', () => {
  const service = fakeService();
  const run = runComponent(() => {
    useKeybinding('a', () => true);
    useKeybinding('b', () => true, { isActive: false });
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.deepEqual(service.registered.map((entry) => entry.action), ['a']);
  assert.equal(service.registered[0].context, 'Global');
  run.unmount();
});

test('useKeybindings registers every key and removes all of them on unmount', () => {
  const service = fakeService();
  const run = runComponent(() => {
    useKeybindings({ b: () => 'b', a: () => 'a' }, { context: 'Prompt' });
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.deepEqual(service.registered.map((entry) => entry.action), ['b', 'a']);
  assert.ok(service.registered.every((entry) => entry.context === 'Prompt' && entry.singleKey));
  assert.equal(service.registered[1].handler(), 'a');
  run.unmount();
  assert.deepEqual(service.unregistered.sort(), ['a', 'b']);
});

test('nextOpenId walks past the focused pane and answers null at the end', () => {
  const open = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.equal(nextOpenId({ open, focusedId: 'one' }), 'two');
  assert.equal(nextOpenId({ open, focusedId: 'three' }), null);
  assert.equal(nextOpenId({ open, focusedId: 'missing' }), 'one');
  assert.equal(nextOpenId({ open: [], focusedId: null }), null);
});

test('consumeFocusRequest accepts through c9 and clears on refusal', () => {
  Ri().setState(() => ({
    open: [{ id: 'pane-2' }],
    focusedId: null,
    shownId: null,
    focusRequest: 'pane-2',
  }));
  consumeFocusRequest(true);
  let state = Ri().getState();
  assert.equal(state.focusedId, 'pane-2');
  assert.equal(state.shownId, 'pane-2');
  assert.equal(state.focusRequest, null);

  Ri().setState((previous) => ({ ...previous, focusRequest: 'pane-2' }));
  consumeFocusRequest(false);
  state = Ri().getState();
  assert.equal(state.focusedId, 'pane-2');
  assert.equal(state.focusRequest, null);

  const untouched = state;
  consumeFocusRequest(true);
  assert.equal(Ri().getState(), untouched);
});

test('useDebouncedCallback keeps only the last call and cancel drops it', () => {
  const pending: { fn: () => void; ms: number }[] = [];
  const clock: MarkdownClock = {
    now: () => 0,
    setTimeout: (fn, ms) => {
      pending.push({ fn, ms });
      return () => {
        const at = pending.findIndex((entry) => entry.fn === fn);
        if (at >= 0) pending.splice(at, 1);
      };
    },
  };
  const calls: string[] = [];
  const run = runComponent(() => useDebouncedCallback((value: string) => { calls.push(value); }, 50), {
    contexts: new Map([[eE, clock]]),
  });
  const debounced = run.result;
  debounced('first');
  debounced('second');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].ms, 50);
  pending.shift()!.fn();
  assert.deepEqual(calls, ['second']);

  debounced('third');
  debounced.cancel();
  assert.deepEqual(calls, ['second']);
  assert.equal(pending.length, 0);
  run.unmount();
});

test('unmount cancels a pending debounced call', () => {
  const pending: { fn: () => void }[] = [];
  const clock: MarkdownClock = {
    now: () => 0,
    setTimeout: (fn) => {
      pending.push({ fn });
      return () => {
        const at = pending.findIndex((entry) => entry.fn === fn);
        if (at >= 0) pending.splice(at, 1);
      };
    },
  };
  const calls: string[] = [];
  const run = runComponent(() => useDebouncedCallback((value: string) => { calls.push(value); }, 10), {
    contexts: new Map([[eE, clock]]),
  });
  run.result('late');
  assert.equal(pending.length, 1);
  run.unmount();
  assert.equal(pending.length, 0);
  assert.deepEqual(calls, []);
});
