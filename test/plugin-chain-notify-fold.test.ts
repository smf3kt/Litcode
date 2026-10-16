// The plugin-state store's reactivity (W45-30): the fold scheduler `Ci` and the cluster it drives. The
// copied bodies are src/plugin-chain-notify-fold-source.ts (ranges and per-block digests in
// research/ports/W45-notify-fold-blocks.plan.json); the seam is src/plugin-chain-notify-fold.ts. These
// tests pin what the scheduler does to a store's readers and folds: which pace each reader lands in,
// when a fold runs at once and when it arms its timer, what it writes into the render-version store,
// what the stale listeners see, and how the throttle moves a reader back to steady.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import { FDn } from '../src/plugin-chain-notify-fold-source.js';
import type { PluginStateReader, PluginStateStore } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import {
  FOLD_INTERVAL_MS, INITIAL_PANES_STATE, READER_THROTTLE_MS, RENDER_VERSION_SUFFIX, STEADY_FOLD_INTERVAL_MS,
  abovePromptFlag, abovePromptReaderIsLive, bindPanes, bindRenderVersions, bumpRenderVersions,
  isReaderThrottled, panesStore, readerPace, readerThrottleTable, renderVersionKey, renderVersionsStore,
  runArmedFold, scheduleReaderFolds, throttleReaders,
} from '../src/plugin-chain-notify-fold.js';

const NOW = 1_000_000;
const KEY = 'engine\u0000bar-toasts';
const READER_ID = 'reader-1';

const reader = (over: Partial<PluginStateReader['instance']> = {}): PluginStateReader =>
  ({ plugins: ['fixture-p'], instance: { surface: 'terminal', component: 'PromptHint', requestId: 'r1', ...over } });

/** A store in the shape the source's own literal builds: the two pace queues, the readers, the stale
 *  listeners and the bump counter the scheduler touches. */
function store(readers: Map<string, PluginStateReader> = new Map(), foldLastAt = NOW - 1000) {
  const seen: PluginStateReader['instance'][][] = [];
  const value: PluginStateStore = {
    values: { getState: () => ({ get: () => undefined }), setState: () => {} },
    versionFloor: 0,
    readersOf: new Map(),
    readers,
    folds: {
      steady: { stale: new Set<string>(), pending: undefined, lastAt: foldLastAt },
      live: { stale: new Set<string>(), pending: undefined, lastAt: foldLastAt },
    },
    staleListeners: new Set([(instances) => { seen.push(instances); }]),
    bumps: 0,
  };
  return { value, seen };
}

/** A render-version store in the registry shape, counting what the bump writes. */
function versions() {
  const state = new Map<string, number>();
  return {
    state,
    store: {
      getState: () => state,
      setState: (update: (current: Map<string, number>) => Map<string, number>) => {
        for (const [key, version] of update(new Map(state))) state.set(key, version);
      },
    },
  };
}

test('the two paces and the throttle window are the source\'s numbers', () => {
  assert.deepEqual(FOLD_INTERVAL_MS, { steady: 100, live: 34 });
  assert.equal(STEADY_FOLD_INTERVAL_MS, 100);
  assert.equal(READER_THROTTLE_MS, 1000);
  assert.equal(RENDER_VERSION_SUFFIX, '\u0000state');
  assert.equal(renderVersionKey('k'), 'k\u0000state');
  assert.deepEqual(INITIAL_PANES_STATE, {
    open: [], unplaced: [], asked: [], shownId: null, focusedId: null, focusRequest: null, placements: 0, closing: [],
  });
});

test('a reader\'s pace comes from its instance', () => {
  const panes = { shownId: 'r1' };
  const offPanes = bindPanes({ getState: () => panes, setState: () => {} });
  try {
    // Live: a terminal instance that is a PromptHint, or the pane the store shows.
    assert.equal(readerPace({ surface: 'terminal', component: 'PromptHint', requestId: 'r1' }), 'live');
    assert.equal(readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r1' }), 'live');
    // Steady: the same pane when another request is the shown one, a non-terminal surface, another
    // component.
    assert.equal(readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r2' }), 'steady');
    assert.equal(readerPace({ surface: 'remote', component: 'PromptHint', requestId: 'r1' }), 'steady');
    assert.equal(readerPace({ surface: 'terminal', component: 'Status', requestId: 'r1' }), 'steady');
  } finally {
    offPanes();
  }

  // AbovePrompt is live exactly while the flag store does not hold `true`.
  assert.equal(abovePromptReaderIsLive(), true);
  abovePromptFlag.set(true);
  try {
    assert.equal(abovePromptReaderIsLive(), false);
    assert.equal(readerPace({ surface: 'terminal', component: 'AbovePrompt', requestId: 'r1' }), 'steady');
  } finally {
    abovePromptFlag.set(void 0);
  }
  assert.equal(readerPace({ surface: 'terminal', component: 'AbovePrompt', requestId: 'r1' }), 'live');
});

test('a changed key folds its readers at once when the pace is due', () => {
  const fixture = store(new Map([[READER_ID, reader()]]));
  fixture.value.readersOf!.set(KEY, new Set([READER_ID]));
  const off = bindPluginState(fixture.value);
  const versionsOut = versions();
  const offVersions = bindRenderVersions(versionsOut.store);
  try {
    // The reader is at a live pace and the live fold is well past its interval: it runs now.
    scheduleReaderFolds([READER_ID], () => NOW);
    assert.equal(fixture.value.folds!.live.lastAt, NOW, 'the live fold ran at the time it was given');
    assert.deepEqual([...fixture.value.folds!.live.stale], [], 'and its stale set was cleared');
    assert.equal(fixture.value.folds!.steady.lastAt, NOW - 1000, 'the other pace was not touched');
    assert.deepEqual([...versionsOut.state], [[renderVersionKey(READER_ID), 1]], 'the reader\'s render version was bumped');
    assert.equal(fixture.value.bumps, 1, 'one bump for one fold run');
    assert.deepEqual(fixture.seen, [[reader().instance]], 'the stale listeners saw the reader\'s instance');
  } finally {
    offVersions();
    off();
  }
});

test('a fold that ran just now arms its timer for the rest of the interval', () => {
  const fixture = store(new Map([[READER_ID, reader()]]));
  fixture.value.readersOf!.set(KEY, new Set([READER_ID]));
  fixture.value.folds!.live.lastAt = NOW - 10;
  const off = bindPluginState(fixture.value);
  const versionsOut = versions();
  const offVersions = bindRenderVersions(versionsOut.store);
  try {
    scheduleReaderFolds([READER_ID], () => NOW);
    // 24ms of the live interval were left, so the reader waits in the stale set with a timer armed.
    assert.deepEqual([...fixture.value.folds!.live.stale], [READER_ID]);
    assert.notEqual(fixture.value.folds!.live.pending, undefined);
    assert.equal(fixture.value.folds!.live.lastAt, NOW - 10, 'nothing ran yet');
    assert.equal(versionsOut.state.size, 0);

    runArmedFold('live', () => NOW + FOLD_INTERVAL_MS.live);
    assert.deepEqual([...fixture.value.folds!.live.stale], []);
    assert.equal(fixture.value.folds!.live.pending, undefined, 'the timer was dropped');
    assert.equal(fixture.value.folds!.live.lastAt, NOW + FOLD_INTERVAL_MS.live);
    assert.deepEqual([...versionsOut.state], [[renderVersionKey(READER_ID), 1]]);
    assert.deepEqual(fixture.seen, [[reader().instance]]);
  } finally {
    offVersions();
    off();
  }
});

test('a throttled reader folds steady, and the window is the source\'s', () => {
  throttleReaders(['fixture-p'], NOW);
  try {
    assert.equal(isReaderThrottled('fixture-p', NOW), true);
    assert.equal(isReaderThrottled('fixture-p', NOW + READER_THROTTLE_MS - 1), true);
    assert.equal(isReaderThrottled('fixture-p', NOW + READER_THROTTLE_MS), false, 'the stamp is exclusive');
    assert.equal(readerThrottleTable.size, 1);

    // The reader's instance is live, but its plugin is inside the window: it goes to steady.
    const fixture = store(new Map([[READER_ID, reader()]]));
    fixture.value.readersOf!.set(KEY, new Set([READER_ID]));
    const off = bindPluginState(fixture.value);
    const offVersions = bindRenderVersions(versions().store);
    try {
      scheduleReaderFolds([READER_ID], () => NOW);
      assert.equal(fixture.value.folds!.steady.lastAt, NOW, 'the steady fold ran');
      assert.equal(fixture.value.folds!.live.lastAt, NOW - 1000, 'the live fold did not');
    } finally {
      offVersions();
      off();
    }
  } finally {
    readerThrottleTable.clear();
  }
});

test('the bump writes one running counter per store under every key', () => {
  const fixture = store();
  const off = bindPluginState(fixture.value);
  const versionsOut = versions();
  const offVersions = bindRenderVersions(versionsOut.store);
  try {
    bumpRenderVersions(['x', 'y'], fixture.value);
    bumpRenderVersions(['z'], fixture.value);
    assert.deepEqual([...versionsOut.state], [['x\u0000state', 1], ['y\u0000state', 1], ['z\u0000state', 2]]);
    assert.equal(fixture.value.bumps, 2);
  } finally {
    offVersions();
    off();
  }
});

test('the two registry stores the scheduler reads are bound, and unbinding restores', () => {
  const versionsOut = versions();
  const panes = { shownId: null as string | null };
  const offVersions = bindRenderVersions(versionsOut.store);
  const offPanes = bindPanes({ getState: () => panes, setState: () => {} });
  try {
    assert.equal(renderVersionsStore(), versionsOut.store);
    assert.equal(panesStore()?.getState().shownId, null);
    panes.shownId = 'r9';
    assert.equal(panesStore()?.getState().shownId, 'r9');
  } finally {
    offPanes();
    offVersions();
  }
  // Unbinding restores the source's own stores (W45-35): `s()` builds both, so the registry is never
  // left without them — `renderVersions` reads an empty Map and `panes` the frozen empty value.
  assert.equal(typeof it().renderVersions?.setState, 'function');
  assert.deepEqual(it().renderVersions?.getState(), new Map());
  assert.equal(it().panes?.getState(), FDn);
});
