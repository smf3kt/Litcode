import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindPrevFrameInvalidator,
  keyDisplayText,
  useActiveOverlay,
} from '../src/plugin-chain-above-prompt-host-glue.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

function appStateStore(activeOverlays: Set<string> = new Set()) {
  const state = { activeOverlays, marker: 'kept' };
  return {
    state,
    setState(update: (previous: typeof state) => typeof state) {
      Object.assign(state, update(state));
    },
  };
}

test('useActiveOverlay adds the overlay while active, removes it and invalidates the frame on unmount', () => {
  const store = appStateStore();
  let invalidated = 0;
  const unbind = bindPrevFrameInvalidator(() => { invalidated += 1; });
  const run = runComponent(() => useActiveOverlay('background-tasks-dialog'), {
    contexts: new Map([[appStateContext, store]]),
  });
  assert.deepEqual([...store.state.activeOverlays], ['background-tasks-dialog']);
  assert.equal(store.state.marker, 'kept');
  assert.equal(invalidated, 0);
  run.unmount();
  assert.deepEqual([...store.state.activeOverlays], []);
  assert.equal(invalidated, 1);
  unbind();
});

test('useActiveOverlay does nothing while inactive or without app state', () => {
  const store = appStateStore();
  let invalidated = 0;
  const unbind = bindPrevFrameInvalidator(() => { invalidated += 1; });
  const run = runComponent(() => useActiveOverlay('dialog', false), {
    contexts: new Map([[appStateContext, store]]),
  });
  assert.deepEqual([...store.state.activeOverlays], []);
  assert.equal(invalidated, 0);
  run.unmount();
  runComponent(() => useActiveOverlay('dialog', true));
  assert.equal(invalidated, 0);
  unbind();
});

test('keyDisplayText answers the service text and the keyless empty string', () => {
  const service = {
    getDisplayText(action: string, context: string) {
      if (action === 'chat:submit' && context === 'Chat') return 'Ctrl+S';
      return null;
    },
  };
  runComponent(() => {
    assert.equal(keyDisplayText('chat:submit', 'Chat', 'fallback'), 'Ctrl+S');
    assert.equal(keyDisplayText('other:action', 'Chat', 'fallback'), '');
  }, { contexts: new Map([[keybindingContext, service]]) });
});

test('keyDisplayText falls back without a service and reports the event once', () => {
  clearChainRecords();
  runComponent(() => {
    assert.equal(keyDisplayText('chat:submit', 'Chat', 'Ctrl+Enter'), 'Ctrl+Enter');
  });
  const events = chainRecords().filter((record) => record.message === 'feature tengu_keybinding_fallback_used');
  assert.equal(events.length, 1);
  const event = events[0] as unknown as Record<string, unknown>;
  assert.equal(event.reason, 'no_context');
  assert.equal(event.action, 'chat:submit');
  assert.equal(event.context, 'Chat');
  assert.equal(event.fallback, 'Ctrl+Enter');
});

test('keyDisplayText names action_not_found when the service lacks the action', () => {
  clearChainRecords();
  const service = { getDisplayText: () => undefined };
  runComponent(() => {
    assert.equal(keyDisplayText('missing:action', 'Chat', 'hint'), 'hint');
  }, { contexts: new Map([[keybindingContext, service]]) });
  const events = chainRecords().filter((record) => record.message === 'feature tengu_keybinding_fallback_used');
  assert.equal(events.length, 1);
  assert.equal((events[0] as unknown as Record<string, unknown>).reason, 'action_not_found');
});
