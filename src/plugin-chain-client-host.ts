// The host seam the Client host bodies read (W45-85). The copied bodies live in
// ./plugin-chain-client-host-source.ts; this module supplies the host state they ask for.
//
//   · `Kje`/`$pn`/`W1o` — the site-focus store and its two setters. Source `Kje` is a store over
//     `{focusedId}`, `$pn` focuses a request id, `W1o` clears it if it is the focused one. The
//     source builds the store through its own factory (`gs`); this seam carries the same three
//     operations over a minimal store because focus is host state.
//   · `Ri`/`c9` — the pane focus store and its setter. `c9` is copied verbatim (with its source
//     range) because its policy is what the pointer path runs; `Ri()` is the host pane store.
//   · `G1o` — the plugin client registry. Source `G1o=AFr()` owns the whole client lifecycle; this
//     build has no plugin client runtime, so the registry is a host boundary whose default
//     `acquire` answers the same inert shape as the copied `Co` (loading snapshot, no events).
//     A host with a client runtime replaces `G1o.acquire`.
//   · `Qrt`/`kAt` — the telemetry descriptor and its loaded-module mapping. Both are copied
//     verbatim from the source; only the reporting sink (`i5t`, below) is a boundary.
//   · `i5t` — the deduplicated telemetry report. This build has no telemetry sink, so it answers
//     null (the source's own "already reported / nothing to say" answer). The message builder is
//     still called with the real descriptor.
//   · `Zy`/`m4n` — the layout context and the fine-pointer retention the terminal mount declares.
//     The context defaults to a no-op retainer; `m4n` is copied verbatim.
//   · `iZr`, `ot`, `VV`, `c`, `t` — the error-boundary base, the telemetry-message attach and read
//     helpers, and the capture/log sinks. `ot` and `VV` are copied verbatim; the sinks are no-ops.
import { qt, Ae, P } from './plugin-chain-react-hooks.js';
import { it } from './plugin-chain-host.js';

/** One focus snapshot. */
export interface FocusState {
  focusedId: string | null;
}

interface Store<T> {
  getState(): T;
  getSnapshot(): T;
  setState(updater: (state: T) => T): void;
  subscribe(listener: () => void): () => void;
}

function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    getSnapshot: () => state,
    setState: (updater) => {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Source `Kje` (chunk-3xcmvqfg.js): the site-focus store. */
export const Kje = createStore<FocusState>({ focusedId: null });

/** Source `$pn` (chunk-3xcmvqfg.js): focus a request id. */
export const $pn = (requestId: string | null) =>
  Kje.setState((state) => state.focusedId === requestId ? state : { focusedId: requestId });

/** Source `W1o` (chunk-3xcmvqfg.js): clear the focus if this request id holds it. */
export const W1o = (requestId: string | null) =>
  Kje.setState((state) => state.focusedId === requestId ? { focusedId: null } : state);

/** One open dialog, as far as focus is concerned. */
export interface OpenDialog {
  id: string;
  [key: string]: unknown;
}

/** The pane focus snapshot `c9` edits. */
export interface PaneFocusState {
  open: OpenDialog[];
  focusedId: string | null;
  shownId: string | null;
  focusRequest: unknown;
}

/** Source `Ri` (chunk-tvdq3hrk.js): the pane store getter `c9` and `wo` read. Host state. */
const paneStore = createStore<PaneFocusState>({
  open: [],
  focusedId: null,
  shownId: null,
  focusRequest: null,
});

/** Source `Ri`: the source wraps the registry's pane store in a getter; this harness binds the
 *  getter to the host pane store above. */
export const Ri = () => paneStore;

/** Source `c9` (chunk-tvdq3hrk.js [6071,6330)): focus an open pane, or clear the focus when the id
 *  is null or not open. Copied verbatim; the store above is the host binding. */
export const c9 = (requestId: string | null) =>
  Ri().setState((state) => {
    const isOpen = requestId === null || state.open.some((dialog) => dialog.id === requestId);
    const focusedId = isOpen ? requestId : state.focusedId;
    const shownId = isOpen && requestId !== null ? requestId : state.shownId;
    return state.focusedId === focusedId && state.shownId === shownId && state.focusRequest === null
      ? state
      : { ...state, focusedId, shownId, focusRequest: null };
  });

/** One client-acquire request, as `So` builds it. */
export interface ChainClientRequest {
  plugin: string;
  component: string;
  requestId: string;
  surface: string;
  key: string;
  module?: string;
  props?: unknown;
  clock: unknown;
}

/** One client snapshot (`loading`, `drawn` with a tree, or `failed` with text). */
export interface ChainClientSnapshot {
  status: 'loading' | 'drawn' | 'failed';
  tree?: unknown;
  text?: string;
}

/** The plugin client instance `To` binds. */
export interface ChainClientInstance {
  id: string;
  subscribe(listener: () => void): () => void;
  getSnapshot(): ChainClientSnapshot;
  setProps(props: unknown): void;
  laidOut(): void;
  resize(width: number, height: number): void;
  pointer(event: Record<string, unknown>): void;
  key(binding: Record<string, unknown>): void;
  acceptsPointer(): boolean;
  acceptsKeys(): boolean;
  threw(error: unknown): void;
  drawnAgain(): void;
  release(): void;
}

const LOADING_SNAPSHOT: ChainClientSnapshot = Object.freeze({ status: 'loading' });

/** The inert instance: the same shape as the copied `Co` with a loading snapshot. */
function inactiveClient(): ChainClientInstance {
  return {
    id: '',
    subscribe: () => () => {},
    getSnapshot: () => LOADING_SNAPSHOT,
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
  };
}

/** Source `G1o` (chunk-3xcmvqfg.js `var G1o=AFr()`): the plugin client registry. A host with a
 *  client runtime replaces `acquire`; the default answers the inert client above. */
export const G1o = {
  acquire(_request: ChainClientRequest): ChainClientInstance {
    return inactiveClient();
  },
};

/** Source `Qrt` (chunk-wzat8kak.js): the loaded module declared by a plugin name. */
export const Qrt = (plugin: string) =>
  it().loadedModules.find((module) => module.name === plugin);

/** Source `VPn` (chunk-n3ykh62m.js): the loaded-module descriptor key. */
const VPn = (modules: { name: string; environmentId?: string }[]) =>
  modules.map((module) => `${module.name}#${module.environmentId}`).join();

/** Source `zPn` (chunk-n3ykh62m.js): the descriptor lead — the single name, or `hooks`. */
const zPn = (names: string[]) => {
  const [first, ...rest] = names;
  return first !== undefined && rest.length === 0 ? first : 'hooks';
};

/** Source `kAt` (chunk-n3ykh62m.js): the loaded-module descriptor. */
export const kAt = (modules: { name: string; environmentId?: string }[]) => ({
  load: VPn(modules),
  lead: zPn(modules.map((module) => module.name)),
});

/** Source `i5t` (chunk-n3ykh62m.js): the deduplicated telemetry report. This build has no sink,
 *  so it answers null; the descriptor is still built by `kAt` at the call site. */
export const i5t = (
  _component: string,
  _modules: { load: string; lead: string },
  _kind: string,
): string | null => null;

/** Source `Zy` (chunk-1r9zp6s1.js): the layout context. Only `retainFinePointer` is read here. */
export interface ClientLayout {
  retainFinePointer(): void;
}

/** The layout context with the source's no-pointer default. */
export const Zy = qt<ClientLayout>({ retainFinePointer: () => {} });

/** Source `m4n` (chunk-1r9zp6s1.js [25124,25247)): retain the fine pointer while a mounted
 *  surface accepts it. Copied verbatim; `Zy` above is the host binding. */
export function m4n(active: boolean): void {
  const { retainFinePointer: retain } = Ae(Zy);
  P(() => active ? retain() : void 0, [active, retain]);
}

/** Source `iZr` (chunk-kexg5hxg.js): the React component base the boundary extends. This build's
 *  runner does not instantiate class components, so the base carries the state surface the copied
 *  boundary reads and nothing else. */
export class iZr {
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
    this.state = {};
  }
}

/** Source `ot` (chunk-886tf6ja.js): attach a telemetry message to a thrown value. Copied
 *  verbatim. */
export const ot = <T>(value: T, message: string): T => {
  try {
    if (value !== null && typeof value === 'object' && !('telemetryMessage' in value) && Object.isExtensible(value)) {
      Object.assign(value, { telemetryMessage: message });
    }
  } catch {}
  return value;
};

/** Source `VV` (chunk-886tf6ja.js): read a telemetry message off a thrown value. Copied
 *  verbatim. */
export function VV(value: unknown): string | undefined {
  try {
    if (value !== null && typeof value === 'object' && 'telemetryMessage' in value
      && typeof (value as { telemetryMessage?: unknown }).telemetryMessage === 'string') {
      return (value as { telemetryMessage: string }).telemetryMessage;
    }
  } catch {}
  return undefined;
}

/** Source `c` (chunk-gsnbskq4.js): the error capture sink. No sink in this build. */
export const c = (_error: unknown, _context?: unknown): void => {};

/** Source `t` (chunk-gyf58rwf.js): the logger. No sink in this build. */
export const t = (_message: string, _options?: unknown): void => {};
