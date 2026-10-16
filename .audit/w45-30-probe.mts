// W45-30 measurements before any assertion: what a changed key's readers do — which pace each reader
// lands in, when the fold runs at once and when it arms a timer, what the fold writes into the
// render-version store, what the stale listeners see, and how the throttle moves a reader's pace.
import { it } from '../src/plugin-chain-host.js';
import type { PluginStateReader, PluginStateStore } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import {
  FOLD_INTERVAL_MS, INITIAL_PANES_STATE, READER_THROTTLE_MS, RENDER_VERSION_SUFFIX, STEADY_FOLD_INTERVAL_MS,
  abovePromptFlag, abovePromptReaderIsLive, bindPanes, bindRenderVersions, bumpRenderVersions,
  isReaderThrottled, panesStore, readerPace, readerThrottleTable, renderVersionKey, renderVersionsStore,
  runArmedFold, scheduleReaderFolds, throttleReaders,
} from '../src/plugin-chain-notify-fold.js';
import { notifyStateReaders } from '../src/plugin-chain-notify-write.js';

const READER_ID = 'reader-1';
const reader = (over: Partial<PluginStateReader['instance']> = {}): PluginStateReader =>
  ({ plugins: ['fixture-p'], instance: { surface: 'terminal', component: 'PromptHint', requestId: 'r1', ...over } });
const paces = (store: PluginStateStore) => JSON.stringify(['steady', 'live'].map((p) => {
  const fold = store.folds![p as 'steady'];
  return { p, stale: [...fold.stale], pending: fold.pending !== undefined, lastAt: fold.lastAt === Number.NEGATIVE_INFINITY ? '-inf' : fold.lastAt };
}));

function makeStore(readers: Map<string, PluginStateReader>, now = 0) {
  const stale: string[] = [];
  const store: PluginStateStore = {
    values: { getState: () => ({ get: () => undefined }), setState: () => {} },
    versionFloor: 0,
    readersOf: new Map(),
    readers,
    folds: {
      steady: { stale: new Set<string>(), pending: undefined, lastAt: now - 1000 },
      live: { stale: new Set<string>(), pending: undefined, lastAt: now - 1000 },
    },
    staleListeners: new Set([(instances) => stale.push(JSON.stringify(instances))]),
    bumps: 0,
  };
  return { store, stale };
}

const versions = new Map<string, number>();
const panes = { shownId: null as string | null };
const offVersions = bindRenderVersions({
  getState: () => versions,
  setState: (update) => { for (const [k, v] of update(new Map(versions))) versions.set(k, v); },
});
const offPanes = bindPanes({ getState: () => panes, setState: () => {} });

const KEY = 'engine\u0000bar-toasts';
const now = 1_000_000;

console.log('intervals:', JSON.stringify(FOLD_INTERVAL_MS), 'steady', STEADY_FOLD_INTERVAL_MS, 'throttle', READER_THROTTLE_MS, 'suffix', JSON.stringify(RENDER_VERSION_SUFFIX));
console.log('key shape:', JSON.stringify(renderVersionKey('k')), '| panes initial:', JSON.stringify(INITIAL_PANES_STATE));
console.log('abovePrompt live by default:', abovePromptReaderIsLive(), '| after set(true):', (abovePromptFlag.set(true), abovePromptReaderIsLive()), '| after set(void 0):', (abovePromptFlag.set(void 0), abovePromptReaderIsLive()));
console.log('renderVersionsStore bound:', renderVersionsStore() !== null, '| panesStore bound:', panesStore() !== null, '| shownId:', JSON.stringify(panesStore()?.getState().shownId));

for (const instance of [
  { surface: 'terminal', component: 'PromptHint', requestId: 'r1' },
  { surface: 'terminal', component: 'Pane', requestId: 'r1' },
  { surface: 'terminal', component: 'AbovePrompt', requestId: 'r1' },
  { surface: 'remote', component: 'PromptHint', requestId: 'r1' },
  { surface: 'terminal', component: 'Status', requestId: 'r1' },
]) console.log('pace', JSON.stringify(instance), '->', readerPace(instance));
panes.shownId = 'r1';
console.log('pace Pane with shownId matching:', readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r1' }), '| other requestId:', readerPace({ surface: 'terminal', component: 'Pane', requestId: 'r2' }));

// A changed key whose reader is at a live pace and whose fold is well past its interval: runs at once.
const a = makeStore(new Map([[READER_ID, reader()]]), now);
a.store.readersOf!.set(KEY, new Set([READER_ID]));
const offA = bindPluginState(a.store);
versions.clear();
notifyStateReaders(KEY);
console.log('run-now: queues after', paces(a.store));
console.log('run-now: versions', JSON.stringify([...versions]), 'bumps', a.store.bumps, 'staleListeners saw', JSON.stringify(a.stale));
offA();

// The fold ran just now, so the next change arms its own pace's timer instead of running.
const b = makeStore(new Map([[READER_ID, reader()]]), now);
b.store.readersOf!.set(KEY, new Set([READER_ID]));
b.store.folds!.live.lastAt = now - 10;
const offB = bindPluginState(b.store);
versions.clear();
scheduleReaderFolds([READER_ID], () => now);
console.log('armed: queues after', paces(b.store), 'versions', JSON.stringify([...versions]));
runArmedFold('live', () => now + FOLD_INTERVAL_MS.live);
console.log('armed: after the timer — queues', paces(b.store), 'versions', JSON.stringify([...versions]), 'staleListeners saw', JSON.stringify(b.stale));
offB();

// A throttled reader is forced back to steady even though its instance is live.
throttleReaders(['fixture-p'], now);
console.log('throttled at now:', isReaderThrottled('fixture-p', now), 'one ms before the window ends:', isReaderThrottled('fixture-p', now + READER_THROTTLE_MS - 1), 'at the end:', isReaderThrottled('fixture-p', now + READER_THROTTLE_MS), 'table size', readerThrottleTable.size);
const c = makeStore(new Map([[READER_ID, reader()]]), now);
c.store.readersOf!.set(KEY, new Set([READER_ID]));
const offC = bindPluginState(c.store);
versions.clear();
scheduleReaderFolds([READER_ID], () => now);
console.log('throttled reader ran in:', JSON.stringify([...versions]), 'queues', paces(c.store));
offC();

// The bump writes one running counter per store under every key it is given.
const d = makeStore(new Map(), now);
const offD = bindPluginState(d.store);
versions.clear();
bumpRenderVersions(['x', 'y'], d.store);
bumpRenderVersions(['z'], d.store);
console.log('bump: versions', JSON.stringify([...versions]), 'bumps', d.store.bumps);
offD();

// A store with no reader for the key: nothing at all.
const e = makeStore(new Map(), now);
const offE = bindPluginState(e.store);
versions.clear();
notifyStateReaders(KEY);
console.log('no readers: versions', JSON.stringify([...versions]), 'queues', paces(e.store));
offE();

console.log('registry fields:', JSON.stringify([it().renderVersions !== null, it().panes !== null]));
offVersions(); offPanes();
console.log('after unbind:', JSON.stringify([it().renderVersions, it().panes]));
