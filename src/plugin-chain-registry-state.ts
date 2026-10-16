// The plugin-state registry (W45-35). The source builds one registry per host in its own factory
// (`s()`, chunk-3ph567jx.js [1283,3650)) and hands it back from `it()`; this product has a single
// host for the process, so ./plugin-chain-host.ts builds the source's own literal once and returns
// it. The state itself — every field with the default the source gives it — is the source's, copied
// verbatim into ./plugin-chain-registry-source.ts; what this file adds is the typing for the fields
// this product's ported code reaches, so the seam reads them by name instead of through a stand-in.

import type { ZodTypeAny } from 'zod';

import type { PluginStateFold, PluginStateReader, PluginUiLogSink } from './plugin-chain-host.js';
import type { ChainModuleRecord } from './plugin-chain-types.js';
import { Zco, edo, s } from './plugin-chain-registry-source.js';

/** A registry store in the shape the source's own literal builds with `gs(...)`: a value read through
 *  `getState()` and replaced through `setState(update)`, where an update that returns the same value
 *  is a no-op. `renderVersions`, `panes`, `notices` and `hoverGroups` are the four the source's
 *  literal installs; `getSnapshot` and `subscribe` are the store's own extra members, named here so
 *  a reader that needs them does not have to widen the type again. */
export interface RegistryStore<State> {
  getSnapshot?: () => State;
  getState: () => State;
  setState: (update: (state: State) => State) => void;
  subscribe?: (listener: () => void) => () => void;
}

/** The plugin-state store the registry carries (`pluginState: Zco()` in the source's own literal,
 *  chunk-3ph567jx.js [941,1236)). `s_()` in the chain reads it as `it().pluginState`; the bar reaches
 *  its stored ledger through it (W45-28) and the fold scheduler runs over its readers and folds
 *  (W45-30). The shape is the store the source's own literal builds: `values` (a store over the
 *  ledger Map), `readers`, `readersOf`, `mounted`, the two fold queues, `staleListeners`, `faultRuns`,
 *  `bumps` and `versionFloor`. */
export interface PluginStateStore {
  values: {
    getSnapshot?: () => { get: (key: string) => { value?: unknown; version?: number } | undefined };
    getState: () => { get: (key: string) => { value?: unknown; version?: number } | undefined };
    setState: (update: (state: Map<string, { value: unknown; version: number }>) => Map<string, { value: unknown; version: number }>) => void;
    subscribe?: (listener: () => void) => () => void;
  };
  versionFloor?: number;
  /** The readers each key changed under (`readersOf` in the store's own literal), read by `vb`. */
  readersOf?: Map<string, Set<unknown>>;
  /** Every reader the store knows, by the key it reads (`readers`), read by `Ci` and `MAt`. */
  readers?: Map<string, PluginStateReader>;
  /** The two pace queues (`folds`), read and written by `Ci`/`MAt`. */
  folds?: Record<'steady' | 'live', PluginStateFold>;
  /** The listeners a fold fans its readers' instances out to (`staleListeners`, `Cb`). */
  staleListeners?: Set<(instances: PluginStateReader['instance'][]) => void>;
  /** The running bump counter `vi` writes render versions from (`bumps`). */
  bumps?: number;
}

/** The toast clock (`toastClock: edo()` in the source's own literal, chunk-3ph567jx.js [1236,1283)):
 *  the handle the host toast path arms its timer on and reads `pausedAt` from. Both fields are
 *  present and undefined on a fresh clock — `edo` writes them into the literal rather than leaving
 *  them off. */
export interface ToastClockHandle {
  pending?: { unref?: () => void };
  pausedAt?: number;
}

/** One mounted Raster site (`hNs` in chunk-n3ykh62m.js [256991,…) builds it through `Yto`): the
 *  elements mounted under one `plugin\0requestId\0key`, the window the blit rate is counted in, and
 *  the count itself. `$.ui.blit` reads all three; a paint lands on every element whose `columns` and
 *  `rows` are the blitted size. */
export interface MountedRasterSite {
  rasters: Set<{ requestId: string; key: string; plugin: string; columns: number; rows: number; paint: (words: Uint32Array) => unknown }>;
  windowStart: number;
  blits: number;
}

/** One mounted Image site (`ELs` in chunk-sfn1dbxq.js [1869596,…)): the same row with `images`, whose
 *  elements answer `swap(source)` — the answer is what a refused swap reports. */
export interface MountedImageSite {
  images: Set<{ requestId: string; key: string; plugin: string; columns: number; rows: number; swap: (source: unknown) => unknown }>;
  windowStart: number;
  blits: number;
}

/** One admission row (`fb` in chunk-n3ykh62m.js [253828,253866) builds it): the tokens a surface may
 *  still spend, and when they were last refilled. `Sb` refills it against a clock and spends one token
 *  per admitted frame; the capacity and the refill rate are the source's own constants. */
export interface RasterAdmission {
  tokens: number;
  refilledAt: number;
}

/** One slot of a surface's table (`gNs`'s own entry): the colour key it holds, the escape that draws it,
 *  and the paint that last touched it. */
export interface RasterSurfaceEntry {
  key: number;
  sgr: string;
  lastPaint: number;
}

/** What a paint reports of itself. `progressing` means the paint carried colours and matched some,
 *  `waiting` that the token row refused a frame, and `complete` neither. */
export type RasterSurfaceStanding = 'progressing' | 'waiting' | 'complete';

/** The surface row `lb` builds: the slots and their keys, the cell table the matcher reads (one
 *  `gn.width`-word cell per slot) and its one-cell probe, the aliases a matched colour is recorded
 *  under, and the counters and flags one paint resets. */
export interface RasterSurfaceState {
  slots: RasterSurfaceEntry[];
  held: Map<number, RasterSurfaceEntry>;
  table: Uint8Array;
  probe: Uint8Array;
  aliases: Map<number, { entry: RasterSurfaceEntry; after: number }>;
  admissions: number;
  paint: number;
  frame: Set<number>;
  evaluated: number;
  lastSgr: string;
  isStarved: boolean;
  hasCarried: boolean;
  netMatched: number;
  hasStale: boolean;
}

/** What `gNs` answers: the four operations a paint and its reader use. */
export interface RasterSurface {
  beginPaint(frame: Set<number>): void;
  sgrOf(key: number): string;
  size(): number;
  standing(): RasterSurfaceStanding;
}

/** A leaf problem is a sentence about the leaf, or nothing at all when the leaf is admitted. The
 *  source's own table (`tno`, chunk-n3ykh62m.js 259180) holds one function per site type with exactly
 *  this shape, and the tree walker reads it as `tno[type](leaf) ?? ano(...) ?? lur(...)`. */
export type LeafProblem = string | undefined;

/** What a Raster leaf problem is handed (`Jto(e)`, chunk-n3ykh62m.js [257143,257601)): the site's own
 *  props, its children, and the mounted raster record the walker resolved for it. */
export interface RasterLeafInput {
  props?: unknown;
  children?: unknown;
  raster?: unknown;
}

/** What an Image leaf problem is handed (`Bto(e)`, chunk-n3ykh62m.js [245596,246293)): the props, the
 *  children, and the mounted image record. */
export interface ImageLeafInput {
  props?: unknown;
  children?: unknown;
  image?: unknown;
}

/** What a leaf problem that reads only its props and children is handed — Code and Svg, whose checks
 *  reach nothing else (`Lto` [237485,238267) and `eno` [258506,259180)). */
export interface LeafInput {
  props?: unknown;
  children?: unknown;
}

/** What a leaf problem that also reads a press is handed — Input and Select, whose last check before
 *  children is whether the press is held by a plugin of this chain (`jto` [246347,246804) and `Zto`
 *  [257937,258491)). */
export interface PressableLeafInput extends LeafInput {
  press?: unknown;
}

/** What the Client leaf problem is handed (`Mto(e)`, chunk-n3ykh62m.js [235982,236808)): the props, the
 *  mounted client record it must be stamped by, and its children. */
export interface ClientLeafInput extends LeafInput {
  client?: unknown;
}

/** What the Button leaf problem is handed (`Hto(e)`, chunk-n3ykh62m.js [234038,235650)): the props, the
 *  press it answers, and its children — the same shape a pressable leaf reads, kept under its own name
 *  because the Button is also the only leaf that reads the keybinding tables, through `dcs` and `acs`. */
export interface ButtonLeafInput extends LeafInput {
  press?: unknown;
}

/** A key taken apart into the record a binding is stored as (`mJ(e)`, chunk-6ccen3s8.js [8839,9463)):
 *  the key itself — one character, or one of the four arrow glyphs' names — and the five modifier flags
 *  the parser sets as it walks the parts of the key. */
export interface KeyBindingRecord {
  key?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  super?: boolean;
}

/** The schema for one block of a keybindings file (`ze()`) or one block as the runtime reads it
 *  (`He()`), both built through the lazy registry `p` files them in. The two are deliberately different
 *  schemas — see ./plugin-chain-keys-editor.ts — so they share this one type rather than a shape. */
export type KeyBindingBlock = ZodTypeAny;

/** The schema for a whole keybindings document (`Bn()`): an optional `$schema` and `$docs` for editor
 *  validation, and an array of binding blocks under `bindings`. */
export type KeyBindingInput = ZodTypeAny;

/** One block of a keybindings document as data rather than as a schema: the context its bindings apply
 *  to, and a map of chord to action — an action name, one of the six legacy names, or null for a binding
 *  the file unbound. `Ace` reads rows out of these and `ge` rewrites the legacy names in them, both in
 *  ./plugin-chain-keys-rows.ts. */
export interface KeyBindingsBlockInput {
  context: string;
  bindings: Record<string, string | null>;
}

/** One row of a keybindings table (`Ace`, chunk-6ccen3s8.js [10481,10621)): the chord already split into
 *  the keys it is made of, the action as the file wrote it, and the context the block named. */
export interface KeyBindingRow {
  chord: KeyBindingRecord[];
  action: string | null;
  context: string;
}

/** A leaf as the walkers in ./plugin-chain-leaf-walkers.ts read it: the type that decides which check and
 *  which measurement apply, the props the leaf carries, and its children when it has any. The walkers ask
 *  for nothing else, and the type is optional because a leaf object reaches them before it is validated. */
export interface LeafLike {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown;
}

/** The leaf table (`tno`, chunk-n3ykh62m.js [259180,259284)): the nine leaf types, each mapped to the
 *  check that refuses a bad one. Every value is a body the site-table packages ported. */
export type LeafTable = Record<string, (leaf: LeafLike) => string | undefined>;

/** One hunk as the diff parser reads it (`tso`, chunk-34bv7wfw.js [9299,11040)) and the reader hands it
 *  on (`Dto`, chunk-n3ykh62m.js [236820,237297)): the four header numbers and the hunk's own lines. */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** What the diff reader answers (`Dto`): the hunks it read, or the refusal that names the header that
 *  failed. The refusal is a value rather than an error, which is why the two arms are both ordinary. */
export type DiffRead = { kind: 'hunks'; hunks: DiffHunk[] } | { kind: 'refused'; problem: string };

/** The budget the value walk spends against (`Ro()`, chunk-nyce03br.js [87483,87576)): how many values
 *  it has visited, how many characters they serialize to, the path it is on for a cycle, and the cost
 *  already measured for a value it has seen before. `Dt` reads and writes all four, so the caller hands
 *  in one fresh budget per walk (`cQt` is `Dt(value, 0, Ro())`). */
export interface WalkBudget {
  nodes: number;
  chars: number;
  path: Set<unknown>;
  done: Map<unknown, { nodes: number; chars: number }>;
}

/** The registry state the source's own factory builds. Only the fields this product's ported code
 *  touches are named here; the source's literal carries the rest (the hook registry, the command
 *  producers, the marketplaces, the raster caches) with the same defaults, reachable by their source
 *  names when their own packages are ported. Three of them are the *same* containers the host seam
 *  holds references to (see the literal there); every other field is the one `s()` builds. */
export interface PluginRegistryState {
  pluginState: PluginStateStore | null;
  toastClock: ToastClockHandle | null;
  renderVersions: RegistryStore<Map<string, number>> | null;
  panes: RegistryStore<{ shownId?: string | null }> | null;
  loadedModules: ChainModuleRecord[];
  moduleSeats: Map<string, string>;
  registeredAgents: Map<string, unknown>;
  /** The promises a hook respawn has in flight (`hooksRespawns: new Set` in the source's literal),
   *  which the ported `N5t` gates the respawn hop on by `.size`. This seam held it as an array, so
   *  that `.size` was always `undefined` and the hop never fired; the source's Set is the field now. */
  hooksRespawns: Set<Promise<unknown>>;
  uiLogSink: PluginUiLogSink;
  pendingUiLog: { plugin: string; text: string }[];
  /** The mounted Raster sites (`mountedRasters: new Map` in the source's literal, chunk-3ph567jx.js):
   *  what `$.ui.blit` paints through, keyed by `e5t`'s NUL-joined key. */
  mountedRasters: Map<string, MountedRasterSite>;
  /** The mounted Image sites (`mountedImages: new Map`), the same key; `$.ui.blit` swaps through them. */
  mountedImages: Map<string, MountedImageSite>;
  /** The one token row a surface admits its frames against (`rasterAdmission: void 0` in the source's
   *  literal, chunk-3ph567jx.js): `mb` builds it on the first read and `Sb` refills and spends it.
   *  Undefined until something asks, which is what the source's own `??=` does. */
  rasterAdmission?: RasterAdmission;
}

/** `Zco()` — a fresh plugin-state store, the field the registry literal installs as `pluginState`. */
export function createPluginStateStore(): PluginStateStore {
  return Zco() as PluginStateStore;
}

/** `edo()` — a fresh toast clock, the field the registry literal installs as `toastClock`. */
export function createToastClock(): ToastClockHandle {
  return edo() as ToastClockHandle;
}

/** `s()` — the registry literal itself, every field with the source's default. */
export function createPluginRegistryState(): PluginRegistryState {
  return s() as PluginRegistryState;
}

/** One `{plugin, key}` reference a hooks module declares in its scan (`Qqo` reads `state.reads` and
 *  `state.writes` as lists of these, and writes each back with `ylt` when it refuses a call). */
export interface PluginCallRef {
  plugin: string;
  key: string;
}

/** What a hooks module declared when it was admitted (`kme` reads `calls`, `nzt` reads `env`, `Qqo`
 *  reads `state`), which is what the `$` dispatcher holds every call to. */
export interface PluginCallScan {
  calls: string[];
  state?: { reads?: PluginCallRef[]; writes?: PluginCallRef[] };
  env?: { reads?: string[]; writes?: string[] };
}

/** The known args the gate answers and the dispatcher spreads into the caller (`knownArgs` holds one
 *  per loaded plugin, keyed by plugin name). */
export interface PluginCallKnownArgs {
  pluginName: string;
  pluginStorageId: string;
  scan?: PluginCallScan;
}

/** A holder that can refuse a call (`withheld.refuser` in the source's literal, and the same shape
 *  `staged` and `stagedBefore` carry while an engine is being created). */
export interface PluginCallHolder {
  refuser(plugin: string, first: string): string | undefined;
}

/** The call state the dispatcher's rules read: the known args per plugin, the refusals already told,
 *  the holders a call may be withheld by, and the environments no hooks module was admitted for. */
export interface PluginCallState {
  knownArgs: Map<string, PluginCallKnownArgs>;
  refusalsLogged: Set<string>;
  crashedWithholders: Map<string, Set<string>>;
  staged?: PluginCallHolder;
  stagedBefore?: PluginCallHolder;
  /** The engines being created right now (`building` in the source's literal): only a call from one of
   *  their environments is offered the staged holders, which is why a staged holder cannot refuse a
   *  call from an engine that is already up. */
  building?: { environmentId?: string }[];
  withheld: PluginCallHolder;
  unadmitted: Set<string>;
}

/** Who made a `$` call: the plugin that owns the hooks module, the origin object, the environment the
 *  call is made under, and the environments behind it that were already unadmitted. The dispatcher adds
 *  `admitted` (the known args the gate answered) before the call table sees the caller. */
export interface PluginCallCaller {
  plugin: string;
  origin: unknown;
  environmentId?: string;
  callers?: (string | undefined)[];
  admitted?: PluginCallKnownArgs;
}

/** One `$` call table entry, as the dispatcher uses it: the host check, the raise that turns the call
 *  into an overridden answer, the stamp that marks the arguments, and the call itself. Only `run` is
 *  required — a table entry with nothing else is a call with no check, no raise and no stamp. */
export interface PluginCallOp {
  check?(args: unknown, caller: PluginCallCaller): string | undefined;
  raise?(caller: PluginCallCaller): unknown;
  stamp?(args: unknown, caller: PluginCallCaller): unknown;
  run(args: unknown, caller: PluginCallCaller): unknown;
}

/** What `G2e` is handed: the `$` call table under the registry's state. */
export interface PluginCallChain {
  ops: Record<string, PluginCallOp>;
  state: PluginCallState;
}

/** A scroll site the UI side registers for a plugin element (`scrollSites` in the source's literal,
 *  chunk-3ph567jx.js), filed under `component:requestId`: the plugin that owns it when it has one, and
 *  the commit the `$.ui.scroll` call ends in. `commit` answers whether the window moved. */
export interface PluginScrollSite {
  owner?: string;
  commit(offset: unknown, origin: unknown): boolean;
}

/** A focus site the UI side registers (`focusSites`, the same literal): who owns it, whether it holds
 *  the keyboard now, which plugin's element holds it, and the commit the `$.ui.focus` call ends in —
 *  whose own sentence is the refusal when it refuses. */
export interface PluginFocusSite {
  owner?: string;
  isHeldNow(): boolean;
  holderNow(): string | undefined;
  commit(call: unknown): string | undefined;
}
