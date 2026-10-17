// Shapes of the copied chain runner in ./plugin-chain-source.ts.
//
// The copied bodies are untyped (`// @ts-nocheck`), so these declarations exist for the host
// surface in ./plugin-chain-host.ts and for the product wiring that calls the runner. Field names
// follow the source: a handler is what the runner folds, a site is what an event answers with, and
// a module is one loaded plugin that the dispatcher consults (`it().loadedModules`).

/** What the runner reports through `Nl()`: a plain log line or a hook-failure record. */
export type ChainLogRecord =
  | { kind: 'log'; level: string; message: string }
  | ({ kind: 'hookFailed' } & Record<string, unknown>);

/** One entry of the trail the runner keeps per settled handler (`lt` writes it, `jo` reads it back). */
export interface ChainTrailEntry {
  index: number;
  plugin: string;
  tier: string;
  event: string;
  outcome: string;
  ms: number;
  received: unknown;
  returned: unknown;
  reason?: string;
}

/** What a handler receives from the runner (`Ko` builds it, `dx` passes it to `handler.run`). The
 *  handle *is* the continuation: the source null-prototypes the call function, so `next(input)` is
 *  the call and `next.call` is deliberately nothing (not `Function.prototype.call`). */
export interface ChainCallHandle {
  (e?: unknown, signal?: AbortSignal, floors?: readonly unknown[]): Promise<unknown>;
  to: (e: unknown, tiers: readonly string[]) => Promise<unknown>;
  signal: AbortSignal;
  is: (name: string, mode?: string) => boolean;
  event: string;
  origin: unknown;
  trace: () => readonly ChainTrailEntry[];
  budget: () => { ms: number; remainingMs: number };
  caught?: unknown;
}

/** One handler in a chain: the unit the executor folds with `reduceRight`. */
export interface ChainHandler {
  name: string;
  tier?: string;
  isCore?: boolean;
  isManaged?: boolean;
  isHop?: boolean;
  budgetMs?: number;
  answersForEngine?: boolean;
  catch?: (e: unknown, handle: ChainCallHandle) => Promise<unknown> | unknown;
  run: (e: unknown, handle: ChainCallHandle, rest: { call: unknown; floors: unknown[]; cutAt?: number }) => Promise<unknown>;
  tiers?: readonly string[];
}

/** One event's site: what the runner may do to a handler's answer for that event. */
export interface ChainSite {
  event: string;
  budgetMs?: number;
  pinnedKeys?: readonly string[];
  settle?: (answer: unknown) => unknown;
  restoreResult?: (answer: unknown, fromBelow: readonly unknown[], e: unknown) => unknown;
  stripResult?: (answer: unknown, fromBelow: readonly unknown[]) => unknown;
  check?: (answer: unknown, e: unknown, fromBelow: readonly unknown[]) => string | undefined;
  raiseArgument?: (e: unknown) => unknown;
  carry?: (answer: unknown, raised: unknown, e: unknown) => unknown;
  keptResult?: (answer: unknown, e: unknown, fromBelow: readonly unknown[]) => { kept: unknown; why: string } | undefined;
  isLateRefusal?: (answer: unknown, fromBelow: readonly unknown[]) => boolean;
  checkArgument?: (next: unknown, e: unknown) => string | undefined;
  restoreArgument?: (next: unknown, e: unknown) => unknown;
  unappliedArgument?: (next: unknown, e: unknown) => string | undefined;
  measureArgument?: (next: unknown, e: unknown) => number | undefined;
  measure?: (answer: unknown, e: unknown, fromBelow: readonly unknown[]) => number | undefined;
}

/** One loaded plugin module, as the product installs it. */
/** One declared hook pattern, as `wGt` reads it: the pattern, the optional matcher it carries, and
 *  whether it is a catch (`caught`) rather than a handler. */
export interface ChainPattern {
  pattern: string;
  matcher?: unknown;
  caught?: boolean;
}

export interface ChainModule {
  name: string;
  /** The tier this module answers at; `Ee` falls back to the host's seat table, then to `user`. */
  tier?: string;
  /** The module path the record carries; `tt` tags a resolvable path as answering for the engine. */
  modulePath?: string;
  /** The interfaces this module answers `callInterface` with: `interface[name][method](...args)`. */
  interface?: ChainInterfaceTable;
  /** How this module answers a `ui.press` on its environment: the handle the drawing held. */
  press?: (handle: number, argument: unknown) => unknown;
  /**
   * The patterns this module declared. When present the record's hook surface is the source's own
   * `wGt` over these declarations; when absent the module is asked through its `hooks` predicate.
   */
  patterns?: readonly ChainPattern[];
  /**
   * The streams this module links for an event: the native-provider half of a module. The copied
   * `_o` (src/plugin-chain-records.ts) reads this and folds the handlers it returns into the
   * streaming chain, each run kept only when `be` accepts the argument. A module without it is not a
   * provider: the streaming collector `has` records it as a hop (`ct`) instead, which opens the layer
   * below rather than producing chunks itself.
   */
  streamLinks?: (input: ChainStreamLinksInput) => readonly ChainHandler[];
  /** Whether this module installs a handler for the event. */
  hooks(event: string): boolean;
  /** The record this module contributes for the event; the host turns it into a handler (). */
  record(event: string, origin?: unknown): ChainHandler;
}

/** What the copied `_o` hands a module's `streamLinks`: the event and the record's own re-entry
 *  state, which a provider passes on to the streams it links. */
export interface ChainStreamLinksInput {
  event: string;
  leftOut?: readonly string[];
  told?: readonly string[];
  causes?: Record<string, string>;
  hookOrigin?: unknown;
}

/** One module record, as the copied collection reads it (`rt`/`Z`/`st`). */
export interface ChainModuleRecord {
  name: string;
  tier?: string;
  label: string;
  args: { modulePath?: string };
  /** Absent for a plain module: a record with no hop key answers through `Rpr`'s direct call. */
  hopKey?: {
    key: string;
    kind?: string;
    isDeclared?: (name: string) => boolean;
    /** The per-record dispatch counter the copied `Q` stamps onto a dispatch payload. */
    nextDispatchId?: () => number;
    /** Present only while a stopped worker has a replacement to ask. */
    replaced?: () => unknown[];
    dispatch?: unknown;
  };
  link?: unknown;
  /** The module's own `streamLinks`, carried through so `_o` can read it. */
  streamLinks?: (input: ChainStreamLinksInput) => readonly ChainHandler[];
  leftOut?: readonly string[];
  told?: readonly string[];
  causes?: Record<string, string>;
  enter?: () => void;
  leave?: () => void;
  hooks: (event: string, keys?: readonly string[]) => boolean;
  catches: (event: string, keys?: readonly string[], test?: (e: unknown) => boolean) => boolean;
  matcherFor: (event: string, keys?: readonly string[]) => unknown;
  registrationsFor: (event: string) => readonly unknown[];
  hasCatch: (key: string) => boolean;
  /** The declared patterns, deduped, as `wGt` reports them. */
  patterns?: readonly string[];
  /** The hooks worker's state for this module:  while it answers,  once it stopped. */
  status: () => { kind: 'live' | 'dead' };
  /** The environment this record answers for. */
  environmentId?: string | number;
  /** Source `tGe`'s record: run the environment's press and hand back what it returned. */
  press?: (handle: number, argument: unknown) => unknown;
  /** Source `tGe`'s record: drop the press handles the environment no longer holds. */
  releasePresses?: (handles: readonly unknown[]) => void;
}

/** One module's interface table: what a `$.name.method` call reaches inside its environment. */
export interface ChainInterfaceTable {
  [name: string]: { [method: string]: (...args: readonly unknown[]) => unknown };
}

/** One interface call on an environment, as the copied `tGe` passes it to the host. */
export interface ChainInterfaceCall {
  owner: string;
  name: string;
  method: string;
  args: readonly unknown[];
}

/** What one module load is asked for: the descriptor the copied `tGe` takes as `n`. */
export interface ChainEnvironmentDescriptor {
  pluginName: string;
  pluginStorageId: string;
  tier?: string;
  /** The plugin spec, whose `name` the copied `ZWe` composes the module label from. */
  spec: { name: string };
  /** The scan of the module's own source that `iWt` checks the registered patterns against. */
  scan?: { hooks?: readonly string[] };
  /** The module file this descriptor loads, for the product's file-backed environments. */
  modulePath?: string;
  [key: string]: unknown;
}

/**
 * The environment host the copied `tGe` drives: what `load` answers with, what the record built
 * from it calls back into, and what the teardown paths reach. The source has one host per isolation
 * kind (`same-thread`, `worker`, `native`); this product has one, in process
 * (./plugin-chain-module-host.ts). Field names are the source's, read off `vJt`'s return.
 */
export interface ChainEnvironmentHost {
  kind: string;
  /** Set once the host is gone; the copied `tGe` reads it for the record's status. */
  readonly died?: string;
  load(environmentId: number, descriptor: ChainEnvironmentDescriptor): Promise<{ registered: readonly ChainPattern[] }>;
  unload(environmentId: number): void;
  /** The stamp a dispatch payload carries, as the source's same-thread host counts them. */
  nextDispatchId(): number;
  /** What a record's `hopKey.dispatch` reaches (`Rpr` calls it with the payload, the continuation
   *  below, and the signal). The payload names the environment the dispatch answers for. */
  dispatch(payload: ChainDispatchPayload, next: unknown, signal: AbortSignal): Promise<Record<string, unknown>>;
  resolveTables(environmentId: number, tables: unknown): Promise<unknown>;
  build(environmentId: number, tables: unknown, argument: unknown): Promise<void>;
  callInterface(environmentId: number, call: ChainInterfaceCall, options?: { callers?: readonly unknown[]; lent?: readonly unknown[] }): Promise<unknown>;
  press(environmentId: number, handle: number, argument: unknown): Promise<unknown>;
  releasePresses(environmentId: number, handles: readonly unknown[]): void;
  terminate?(): void;
}

/** The payload a dispatch carries, as far as the host reads it: `Q` builds it and `Rpr` adds
 *  `caughtBy`, the environment ids of the members that catch the event. `environments` is every
 *  member the dispatch is for, which is what the worker's own dispatcher folds. */
export interface ChainDispatchPayload {
  id?: number;
  event: string;
  payload?: unknown;
  origin?: unknown;
  hookOrigin?: unknown;
  raise?: unknown;
  environments?: readonly number[];
  caughtBy?: readonly number[];
  floors?: readonly unknown[];
  cutAt?: number;
}

/** What a chain run holds while environments come and go: the copied loader's `e`. */
export interface ChainRun {
  state: {
    environmentCounter: number;
    environmentArgs: Map<number, ChainEnvironmentDescriptor>;
    environmentHost?: ChainEnvironmentHost;
    nativeHost?: ChainEnvironmentHost;
    [key: string]: unknown;
  };
}

/** The key event a composer edit is relayed under. `Xo` takes a single printable character as `key`,
 *  any other key by its `name`, and reads the modifier flags off the same object. */
export interface ChainRelayKey {
  key: string;
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/** One composer edit as the relay records it: the draft before and after one key, and the key event
 *  that made the change (`Jo` puts it on the chain event as `{key, name, ctrl?, shift?, meta?}`). */
export interface ChainRelayEdit {
  before: { text: string; cursor: number };
  after: { text: string; cursor: number };
  key?: ChainRelayKey;
}

/** What the relay asks the composer for (`YHo`'s `e`): the draft, how to commit a box, and the two
 *  optional hooks the composer may supply. */
export interface ChainRelayHost {
  /** The default raise is the copied `XOr`, which dispatches this event through the `prompt.edit` chain. */
  raise?: (edit: ChainRelayEdit, signal: AbortSignal) => Promise<{ text: string; cursor: number; decorations?: unknown }>;
  /** The default is `queueMicrotask`: a batch settles after the current key. */
  later?: (settle: () => void) => void;
  /** Where a refusal or a failure is reported; the default is the module log line. */
  report?: (message: string) => void;
  read(): { text: string; cursor: number };
  commit(box: { text: string; cursor: number }): void;
  paint?(decorations: unknown, text: string): void;
  carry?(edit: ChainRelayEdit): void;
}

/** The relay `cue` returns: record edits, say whether it is hooked, dispose on close. */
export interface ComposerEditRelay {
  isRecording(): boolean;
  record(edit: ChainRelayEdit): void;
  setHooked(hooked: boolean): void;
  dispose(): void;
}

/** What a call site may pass to `ga(name, ctx)`. */
export interface ChainContext {
  signal?: AbortSignal;
  /** The origin chain: the handlers this call is nested under, oldest first. `Z` reads it to pick
   *  the seat a module answers at and to keep a module from re-entering its own frame. */
  origin?: readonly unknown[];
  only?: string;
  cutAt?: number;
  trace?: (trail: readonly ChainTrailEntry[]) => void;
  withoutModuleHandlers?: boolean;
  core?: Record<string, ChainHandler | undefined>;
  managed?: Record<string, readonly ChainHandler[] | undefined>;
  withheldCore?: Record<string, ChainHandler | undefined>;
  withheldFloor?: Record<string, (e: unknown) => unknown>;
}
