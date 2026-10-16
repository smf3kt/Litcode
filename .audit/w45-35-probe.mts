// W45-35 measurements before any assertion: the registry the source's own factory builds, the two
// stores it installs, and the two change helpers underneath them.
import { it } from '../src/plugin-chain-host.js';
import { FDn } from '../src/plugin-chain-notify-fold-source.js';
import { gs, Oe } from '../src/plugin-chain-registry-stores-source.js';
import { createPluginRegistryState, createPluginStateStore, createToastClock } from '../src/plugin-chain-registry-state.js';

const brief = (value: unknown) => JSON.stringify(value, (_key, item) => (item instanceof Map
  ? `Map(${item.size})` : item instanceof Set ? `Set(${item.size})` : item === undefined ? '<undefined>' : item));

// the state the factory builds
const state = createPluginRegistryState();
console.log('keys', Object.keys(state).length);
console.log('pluginState keys', Object.keys(state.pluginState!).join(','));
console.log('pluginState values', brief(state.pluginState!.values.getState()));
console.log('pluginState versionFloor', brief(state.pluginState!.versionFloor), 'bumps', brief(state.pluginState!.bumps));
console.log('folds', brief(state.pluginState!.folds));
console.log('toastClock keys', Object.keys(state.toastClock!), brief(state.toastClock));
console.log('panes state is FDn:', (state.panes!.getState() as unknown) === FDn, '| frozen:', Object.isFrozen(state.panes!.getState()));
console.log('renderVersions state', brief(state.renderVersions!.getState()));
console.log('hooksRespawns', brief(state.hooksRespawns), '| is a Set:', state.hooksRespawns instanceof Set, '| size:', (state.hooksRespawns as unknown as { size?: unknown }).size);
console.log('uiLogSink', brief(state.uiLogSink), '| pendingUiLog', brief(state.pendingUiLog));
const signals = Object.entries(state).filter(([, value]) => value !== null && typeof value === 'object' && typeof (value as { emit?: unknown }).emit === 'function');
console.log('change signals', signals.map(([key]) => key).join(','));
console.log('store-valued fields', Object.entries(state).filter(([, value]) => value !== null && typeof value === 'object' && typeof (value as { setState?: unknown }).setState === 'function').map(([key]) => key).join(','));

// two factories are two registries: every fresh container is its own
const other = createPluginRegistryState();
console.log('distinct registries:',
  state !== other,
  state.loadedModules !== other.loadedModules,
  state.pluginState !== other.pluginState,
  state.moduleSeats !== other.moduleSeats,
  state.panes !== other.panes,
  '| panes state the same frozen value:', state.panes!.getState() === other.panes!.getState());

// the store factory on its own
const store = createPluginStateStore();
console.log('fresh store values', brief(store.values.getState()), '| readers', brief(store.readers), '| mounted', brief((store as Record<string, unknown>).mounted));
console.log('fresh clock', brief(createToastClock()), '| keys present:', Object.keys(createToastClock()).join(','));

// gs: Object.is no-op, change callback, then subscribers
const seen: string[] = [];
const ref = gs({ n: 0 }, (change: unknown) => seen.push('change ' + brief(change)));
const stops: string[] = [];
ref.subscribe(() => stops.push('a'));
ref.subscribe(() => stops.push('b'));
console.log('getSnapshot === getState:', ref.getSnapshot === ref.getState);
ref.setState((current: { n: number }) => current);
console.log('same value: state', brief(ref.getState()), '| calls', brief(seen), brief(stops));
ref.setState((current: { n: number }) => ({ n: current.n + 1 }));
console.log('new value: state', brief(ref.getState()), '| calls', brief(seen), brief(stops));
const off = ref.subscribe(() => stops.push('c'));
off();
ref.setState(() => ({ n: 9 }));
console.log('after unsubscribe: calls', brief(stops));

// Oe: a throwing listener is rethrown alone, several are aggregated, clear drops them
const signal = Oe();
const heard: unknown[] = [];
const stopFirst = signal.subscribe((...args: unknown[]) => heard.push(args));
signal.subscribe(() => { throw new Error('second'); });
signal.subscribe(() => { throw new RangeError('third'); });
try { signal.emit('one'); console.log('emit delivered', brief(heard)); }
catch (error) { console.log('emit delivered', brief(heard), '| then threw', (error as Error).constructor.name); }
try { signal.emit('two'); } catch (error) {
  console.log('emit threw', (error as Error).constructor.name, '| errors:', (error as AggregateError).errors?.map((each) => each.constructor.name));
}
stopFirst();
signal.clear();
console.log('after clear, emit throws:', (() => { try { signal.emit('three'); return 'no'; } catch { return 'yes'; } })());
const lone = Oe();
lone.subscribe(() => { throw new TypeError('only'); });
try { lone.emit(); } catch (error) { console.log('one throwing listener throws', (error as Error).constructor.name, (error as Error).message); }

// the registry the host seam hands back
console.log('it() pluginState is a store:', typeof it().pluginState?.values.getState === 'function');
console.log('it() toastClock', brief(it().toastClock), '| panes state is FDn:', it().panes!.getState() === FDn);
console.log('it() renderVersions state', brief(it().renderVersions!.getState()));
console.log('it() stable across calls:', it() === it());
