import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LONGER_INPUT_MARKER,
  agentTaskSummary,
  hotkeyPresses,
  sessionDraftOf,
  settledBudgetStore,
  useHotkeyPresses,
  useLongerInputValue,
  useReleaseGoneHold,
  useReleaseOnEdit,
  useSessionDraftStore,
  useViewedAgentId,
  viewedAgentTaskId,
  type DraftStore,
} from '../src/plugin-chain-above-prompt-local.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { sessionContext, type SessionLike } from '../src/plugin-chain-session-context.js';
import { appStateContext } from '../src/plugin-chain-app-state.js';
import { u as keybindingContext } from '../src/plugin-chain-press-button-host.js';

function session(root: unknown): SessionLike {
  return {
    project: { root },
    host: {},
    root,
    subscribe: () => () => {},
  };
}

test('the session draft store is keyed by the session root and seeds the draft state', () => {
  const rootA = {};
  const rootB = {};
  const first = sessionDraftOf({ root: rootA });
  const again = sessionDraftOf({ root: rootA });
  const other = sessionDraftOf({ root: rootB });
  assert.equal(first, again);
  assert.notEqual(first, other);
  const state = first.getState();
  assert.equal(state.value, '');
  assert.equal(state.active, false);
  assert.equal(state.vimMode, 'INSERT');
  assert.equal(state.cameBack, false);
  assert.equal(state.launchWarning, null);
  assert.equal(state.submittedLinkPrefill, null);
  assert.equal(state.stash, null);
  assert.ok(state.linkSuppliedTexts instanceof Set);
  assert.equal(first.getSnapshot(), state);
});

test('useSessionDraftStore returns the store of the session in context', () => {
  const liveRoot = {};
  const live = session(liveRoot);
  let store: DraftStore | undefined;
  runComponent(() => {
    store = useSessionDraftStore();
  }, { contexts: new Map([[sessionContext, live]]) });
  assert.equal(store, sessionDraftOf({ root: liveRoot }));
});

test('useLongerInputValue returns the draft text or the longer-input marker', () => {
  const emptyRoot = {};
  sessionDraftOf({ root: emptyRoot });
  let empty: string | undefined;
  runComponent(() => {
    empty = useLongerInputValue();
  }, { contexts: new Map([[sessionContext, session(emptyRoot)]]) });
  assert.equal(empty, '');

  const oneRoot = {};
  sessionDraftOf({ root: oneRoot }).setState((state) => ({ ...state, value: 'x' }));
  let one: string | undefined;
  runComponent(() => {
    one = useLongerInputValue();
  }, { contexts: new Map([[sessionContext, session(oneRoot)]]) });
  assert.equal(one, 'x');

  const manyRoot = {};
  sessionDraftOf({ root: manyRoot }).setState((state) => ({ ...state, value: 'xyz' }));
  let many: string | undefined;
  runComponent(() => {
    many = useLongerInputValue();
  }, { contexts: new Map([[sessionContext, session(manyRoot)]]) });
  assert.equal(many, LONGER_INPUT_MARKER);
  assert.equal(LONGER_INPUT_MARKER, '[longer input]');
});

test('viewedAgentTaskId reads local agents and in-process teammates', () => {
  const local = {
    viewingAgentTaskId: 't1',
    tasks: { t1: { type: 'local_agent', agentId: 'a1', agentType: 'worker', parentAgentId: 'p' } },
  };
  assert.equal(viewedAgentTaskId(local), 'a1');
  const teammate = {
    viewingAgentTaskId: 't2',
    tasks: {
      t2: {
        type: 'in_process_teammate',
        identity: { agentId: 'a2', agentName: 'n' },
        spawnedWith: { description: 'd', agentType: 'teammate', parentAgentId: 'p2' },
      },
    },
  };
  assert.equal(viewedAgentTaskId(teammate), 'a2');
  assert.equal(viewedAgentTaskId({ viewingAgentTaskId: 'missing', tasks: {} }), undefined);
  assert.equal(viewedAgentTaskId({ viewingAgentTaskId: 't3', tasks: { t3: { type: 'other' } } }), undefined);
});

test('agentTaskSummary maps the two task kinds and rejects the rest', () => {
  assert.deepEqual(
    agentTaskSummary({ type: 'local_agent', agentId: 'a', description: 'd', agentType: 'w', parentAgentId: 'p' }),
    { id: 'a', teammateId: undefined, description: 'd', type: 'w', parentId: 'p', name: undefined },
  );
  assert.deepEqual(
    agentTaskSummary({
      type: 'in_process_teammate',
      identity: { resumableAgentId: 'r', agentId: 'a', agentName: 'n' },
      spawnedWith: { description: 'd', agentType: 'teammate', parentAgentId: 'p' },
    }),
    { id: 'r', teammateId: 'a', description: 'd', type: 'teammate', parentId: 'p', name: 'n' },
  );
  assert.equal(agentTaskSummary({ type: 'other' }), undefined);
});

test('useViewedAgentId answers a memoized agent id or an empty object', () => {
  const state = { viewingAgentTaskId: 't1', tasks: { t1: { type: 'local_agent', agentId: 'a1' } } };
  let withAgent: { agentId?: string } | undefined;
  runComponent(() => {
    withAgent = useViewedAgentId();
  }, {
    contexts: new Map([[
      appStateContext,
      { getSnapshot: () => state, subscribe: () => () => {} },
    ]]),
  });
  assert.deepEqual(withAgent, { agentId: 'a1' });

  const without = { viewingAgentTaskId: undefined, tasks: {} };
  let withoutAgent: { agentId?: string } | undefined;
  runComponent(() => {
    withoutAgent = useViewedAgentId();
  }, {
    contexts: new Map([[
      appStateContext,
      { getSnapshot: () => without, subscribe: () => () => {} },
    ]]),
  });
  assert.deepEqual(withoutAgent, {});
});

test('settledBudgetStore clears through set', () => {
  settledBudgetStore.set(12);
  assert.equal(settledBudgetStore.get(), 12);
  settledBudgetStore.set(undefined);
  assert.equal(settledBudgetStore.get(), undefined);
});

test('hotkeyPresses lowercases and normalizes text and requires every character', () => {
  const a = { action: 'a' };
  const b = { action: 'b' };
  const bindings = new Map<string, unknown>([['a', a], ['b', b]]);
  assert.deepEqual(hotkeyPresses('ab', {}, bindings), [a, b]);
  assert.deepEqual(hotkeyPresses('AB', {}, bindings), [a, b]);
  assert.deepEqual(hotkeyPresses('Ａ', {}, bindings), [a]);
  assert.deepEqual(hotkeyPresses('ac', {}, bindings), []);
  assert.deepEqual(hotkeyPresses('a', { ctrl: true }, bindings), []);
});

test('useHotkeyPresses registers a pre-dispatch handler while active', async () => {
  let handler: ((text: string, mods: Record<string, unknown>, fallback: string) => boolean) | undefined;
  let unregistered = 0;
  const service = {
    resolve: () => ({ type: 'no-match' as const }),
    registerPreDispatch: (entry: {
      handler: (text: string, mods: Record<string, unknown>, fallback: string) => boolean;
    }) => {
      handler = entry.handler;
      return () => {
        unregistered += 1;
        handler = undefined;
      };
    },
  };
  const bindings = new Map<string, unknown>([['a', { action: 'a' }], ['z', { action: 'z' }]]);
  const run = runComponent(() => {
    useHotkeyPresses(bindings, true);
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.notEqual(handler, undefined);
  assert.equal(handler!('a', {}, 'fallback'), true);
  assert.equal(handler!('x', {}, 'fallback'), false);
  assert.equal(handler!('', {}, 'z'), true);
  await Promise.resolve();
  run.unmount();
  assert.equal(unregistered, 1);
});

test('useHotkeyPresses stays out of the pre-dispatch table when inactive', () => {
  let registered = 0;
  const service = {
    resolve: () => ({ type: 'no-match' as const }),
    registerPreDispatch: () => {
      registered += 1;
      return () => {};
    },
  };
  runComponent(() => {
    useHotkeyPresses(new Map(), false);
  }, { contexts: new Map([[keybindingContext, service]]) });
  assert.equal(registered, 0);
});

test('useReleaseGoneHold releases only when a non-null index reaches the offset', () => {
  let releases = 0;
  const release = () => {
    releases += 1;
  };
  runComponent(() => {
    useReleaseGoneHold(3, 3, release);
  });
  assert.equal(releases, 1);
  runComponent(() => {
    useReleaseGoneHold(2, 3, release);
  });
  assert.equal(releases, 1);
  runComponent(() => {
    useReleaseGoneHold(null, 3, release);
  });
  assert.equal(releases, 1);
});

test('useReleaseOnEdit subscribes to the draft and releases when the text changes', () => {
  const listeners = new Set<() => void>();
  let value = 'start';
  let releases = 0;
  const store = {
    getState: () => ({ value }),
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  const run = runComponent(() => {
    useReleaseOnEdit(store as unknown as Pick<DraftStore, 'getState' | 'subscribe'>, 'key', () => {
      releases += 1;
    });
  });
  assert.equal(releases, 0);
  assert.equal(listeners.size, 1);
  value = 'start';
  for (const listener of listeners) listener();
  assert.equal(releases, 0);
  value = 'changed';
  for (const listener of listeners) listener();
  assert.equal(releases, 1);
  run.unmount();
  assert.equal(listeners.size, 0);
});

test('useReleaseOnEdit does nothing without a key', () => {
  const listeners = new Set<() => void>();
  runComponent(() => {
    useReleaseOnEdit({
      getState: () => ({ value: '' }),
      subscribe: (onChange: () => void) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    } as unknown as Pick<DraftStore, 'getState' | 'subscribe'>, null, () => {
      throw new Error('must not release');
    });
  });
  assert.equal(listeners.size, 0);
});
