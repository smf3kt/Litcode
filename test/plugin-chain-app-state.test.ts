import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appStateContext,
  appStateSessionContext,
  mcpConnectionsContext,
  useAppState,
  useAppStateSelector,
} from '../src/plugin-chain-app-state.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';

test('the app-state contexts are distinct tokens', () => {
  assert.notEqual(appStateContext, appStateSessionContext);
  assert.notEqual(appStateContext, mcpConnectionsContext);
  assert.notEqual(appStateSessionContext, mcpConnectionsContext);
});

function storeOf(state: unknown) {
  return { getSnapshot: () => state, subscribe: () => () => {} };
}

test('useAppState reads the whole context store', () => {
  const state = { viewingAgentTaskId: 'task-1', tasks: {} };
  const store = storeOf(state);
  let read: unknown;
  runComponent(() => {
    read = useAppState();
  }, { contexts: new Map([[appStateContext, store]]) });
  assert.equal(read, store);
});

test('useAppStateSelector reads the selected slice', () => {
  const state = { viewingAgentTaskId: 'task-1', tasks: { 'task-1': { id: 'a' } } };
  let selected: unknown;
  runComponent(() => {
    selected = useAppStateSelector((value: any) => value.tasks[value.viewingAgentTaskId].id);
  }, { contexts: new Map([[appStateContext, storeOf(state)]]) });
  assert.equal(selected, 'a');
});

test('both hooks throw outside an AppStateProvider', () => {
  assert.throws(() => runComponent(() => useAppState()), /useAppState/);
  assert.throws(
    () => runComponent(() => useAppStateSelector((value: any) => value)),
    /useAppState/,
  );
});
