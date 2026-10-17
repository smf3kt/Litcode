// The terminal host boundary for the rendered-surface glue (W45-88). The copied glue reads five
// objects it does not own: the render-answer cache `dce`, the engine render client `che`, the row
// accounting `g4n`, the render-version mount counter `Fss`, and the fullscreen reader `Mi`.
// Everything here mirrors the source contract the glue calls; the engine that answers a render
// stays outside this product and is injected.
import { MF, mIn, kVe, SVe, vA } from './plugin-chain-render-keys-source.js';
import { OL as renderVersions } from './plugin-chain-notify-fold-source.js';
import { Cpr } from './plugin-chain-records.js';

export { XD } from './plugin-chain-client-host-source.js';
export { i5t, kAt } from './plugin-chain-client-host.js';
export { t } from './plugin-chain-host.js';

/** Source `Mi`: whether the terminal draws fullscreen. The terminal mode belongs to the host;
 *  inline is the default, and `setFullscreen` moves it. */
let fullscreen = false;
export const Mi = (): boolean => fullscreen;
export function setFullscreen(on: boolean): void { fullscreen = on; }

/** Source `OL()` hands the registry store to `Re`, which reads `getSnapshot`/`subscribe`. The host
 *  store this product binds exposes `getState`; the adapter adds the two members the selector hook
 *  reads, cached per store so identity comparisons still hold. */
const storeAdapters = new WeakMap<object, any>();
export function OL(): any {
  const store = renderVersions() as any;
  if (store === null || store === undefined) return store;
  const cached = storeAdapters.get(store);
  if (cached !== undefined) return cached;
  const adapter = Object.assign(Object.create(Object.getPrototypeOf(store)), store, {
    getSnapshot: () => store.getState(),
    subscribe: (fn: () => void) => store.subscribe?.(fn) ?? (() => {}),
  });
  storeAdapters.set(store, adapter);
  return adapter;
}

/** Source `Uur` (chunk-n3ykh62m.js): the props key plus the origin. */
const propsAndOrigin = (input: any, origin: unknown): string => `${Cpr(origin)}\u0000${mIn(input)}`;

/** Source `Kss` shape: one settled evaluation slot. */
interface SettledSlot {
  propsKey: string;
  versions: unknown;
  engineVersion: number;
  version?: unknown;
  onScreen?: unknown;
  heldRows?: number;
  drawn?: Promise<unknown>;
  settled?: unknown;
}

/** Source `Yss`: the settled-evaluation map, cleared when either version moves. */
function createSlots() {
  let slots = new Map<string, SettledSlot>();
  let versions: unknown;
  let engineVersion = 0;
  let reused = 0;
  return {
    get: (key: string) => slots.get(key),
    set: (key: string, slot: SettledSlot) => {
      if (slot.versions !== versions || slot.engineVersion !== engineVersion) {
        slots.clear();
        versions = slot.versions;
        engineVersion = slot.engineVersion;
      }
      slots.delete(key);
      slots.set(key, slot);
      for (const oldest of slots.keys()) {
        if (slots.size <= 512) break;
        slots.delete(oldest);
      }
    },
    drop: (key: string, slot: SettledSlot) => {
      if (slots.get(key) === slot) slots.delete(key);
    },
    size: () => slots.size,
    reused: () => reused,
    countReuse: () => { reused += 1; },
  };
}

/** Source `Nur`: whether one slot still answers this props key at this version. */
const sameSlot = (slot: SettledSlot, propsKey: string, version: unknown): boolean =>
  slot.settled !== undefined && slot.propsKey === propsKey && slot.versions === renderVersions() && slot.version === version;

/** Source `Oye`: the version a render this input would read. */
const versionOf = (input: any): unknown => kVe((renderVersions()?.getState() ?? new Map()) as never, input);

/** The engine render service `che` asks: one answer per render input. */
export interface RenderAnswerHost {
  uiRender(input: any, options: { signal?: AbortSignal; origin?: unknown }): Promise<unknown>;
}

let answerHost: RenderAnswerHost | undefined;

/** Install the engine render service; the default answers undefined, meaning nothing was drawn. */
export function setRenderAnswerHost(host: RenderAnswerHost | undefined): void {
  answerHost = host;
}

/** Source `che({signal, origin}).ui.render(input)` — the engine render client. */
export function che(options: { signal?: AbortSignal; origin?: unknown } = {}) {
  const render = (input: any): Promise<unknown> =>
    answerHost === undefined
      ? Promise.resolve(undefined)
      : answerHost.uiRender(input, options);
  return { ui: { render }, uiRender: render };
}

/** Source `dce` (`Sno`): the settled-evaluation cache and its accounting methods. The copied glue
 *  calls five of them; `uiRender` delegates evaluation to the injected engine service. */
export const dce = (() => {
  const slots = createSlots();

  function uiRender(input: any, options: { signal?: AbortSignal; origin?: unknown } = {}): Promise<unknown> {
    if (input.requestId === '') return Promise.resolve(undefined);
    const slot: SettledSlot = {
      propsKey: propsAndOrigin(input, options.origin),
      versions: renderVersions(),
      engineVersion: (renderVersions()?.getState() as Map<string, number> | null)?.get(vA) ?? 0,
      version: versionOf(input),
      heldRows: undefined,
      drawn: undefined,
      settled: undefined,
    };
    slots.set(MF(input), slot);
    const answer = che(options).uiRender(input);
    answer.then(
      (drawn) => { slot.settled = drawn; },
      () => { /* the source logs the failure; the slot stays unsettled */ },
    );
    options.signal?.addEventListener('abort', () => {
      if (slot.settled === undefined) slots.drop(MF(input), slot);
    }, { once: true });
    return answer;
  }

  function settled(input: any, origin: unknown): unknown {
    if (input.requestId === '') return undefined;
    const slot = slots.get(MF(input));
    return slot !== undefined && slot.propsKey === propsAndOrigin(input, origin) && slot.versions === renderVersions()
      ? slot.settled
      : undefined;
  }

  function asked(input: any, origin: unknown): SettledSlot | undefined {
    const slot = slots.get(MF(input));
    if (input.requestId === '' || slot === undefined) return undefined;
    if (!sameSlot(slot, propsAndOrigin(input, origin), versionOf(input))) return undefined;
    const withOnScreen = propsAndOrigin(
      { viewport: input.viewport, props: { ...input.props, onScreen: slot.onScreen } },
      origin,
    );
    return slot.propsKey === withOnScreen ? slot : undefined;
  }

  return {
    uiRender,
    settled,
    held: (input: any) => slots.get(MF(input))?.settled,
    askedOnScreen: (input: any, origin: unknown) => asked(input, origin)?.onScreen,
    heldRowsOf: (input: any, origin: unknown) => asked(input, origin)?.heldRows,
    noteHeldRows: (input: any, rows: number) => {
      const slot = slots.get(MF(input));
      if (slot?.onScreen === null) slot.heldRows = rows;
    },
    noteThrown: (input: any, site: unknown) => {
      const slot = slots.get(MF(input));
      if (slot !== undefined && (slot.settled === undefined || slot.settled === site)) {
        slot.settled = { type: 'engine', ref: 0 };
        slot.drawn = Promise.resolve(slot.settled);
      }
    },
    reuseCount: slots.reused,
    sharedCount: slots.size,
  };
})();

/** Source `Fss`: the mount count behind the render-version store. The store's reader/writer graph
 *  is the engine's render subsystem; the mount count is local here. */
const mounted = new Map<string, number>();
export function Fss(key: string): () => void {
  mounted.set(key, (mounted.get(key) ?? 0) + 1);
  return () => {
    const count = (mounted.get(key) ?? 1) - 1;
    if (count > 0) { mounted.set(key, count); return; }
    mounted.delete(key);
  };
}

/** The row-accounting host `g4n`: [site, input, lastRows, contentRows] for one mounted frame. */
export interface RowAccountHost {
  rows(active: boolean, asked: unknown): [unknown, any, number | undefined, number | undefined];
}

let rowHost: RowAccountHost | undefined;

export function setRowAccountHost(host: RowAccountHost | undefined): void {
  rowHost = host;
}

/** Source `g4n(active, askedOnScreen)`: the frame-subscription rows of one rendered site. */
export function g4n(active: boolean, askedOnScreen: any): [unknown, any, number | undefined, number | undefined] {
  if (rowHost === undefined) return [undefined, undefined, undefined, undefined];
  return rowHost.rows(active, askedOnScreen);
}
