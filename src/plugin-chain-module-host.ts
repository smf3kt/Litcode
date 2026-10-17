// The product's environment host: what the copied loader in ./plugin-chain-loader-source.ts drives
// in place of the source's same-thread, worker and native hosts.
//
// The source's `tGe` builds one record per loaded environment and hands that record a host to call
// back into, so the host is where a plugin's code actually lives. In the source the host is a VM
// context, a worker, or the app's own thread; here it is the module file the product imports, held
// in process. The contract is the one the copied code reads: `tGe` reads `load`, `unload`, `died`,
// `resolveTables`, `build`, `callInterface`, `press` and `releasePresses`, and the copied `Rpr`/`Q`
// reach the same object through the record's hop key for `dispatch`, `kind` and `nextDispatchId()`
// (plus the optional `isDeclared`/`replaced`, which only the source's worker host has). What the
// host answers with is the module's own member: its `patterns` for the registration check, its
// `interface` table for an interface call, its `press` for a press. Sources:
// research/ports/W45-chain-runner.md.
import { pathToFileURL } from 'node:url';
import { AK } from './plugin-chain-host.js';
import { chainModuleRecord } from './plugin-chain-module-record.js';
import { aP, hlt, Ooe } from './plugin-chain-source.js';
import type {
  ChainCallHandle,
  ChainDispatchPayload,
  ChainEnvironmentDescriptor,
  ChainEnvironmentHost,
  ChainHandler,
  ChainInterfaceCall,
  ChainModule,
  ChainModuleRecord,
  ChainPattern,
} from './plugin-chain-types.js';

/** What a plugin module file default-exports. This shape is the product's own: the format its
 *  plugin directory holds, not a port — the source has no file format here, it has a worker. */
export interface ChainModuleFileExports {
  name?: string;
  tier?: string;
  /** The events this module answers, and the handler for each. A handler receives the event and the
   *  continuation, which is callable the way a hooks module's `next` is: `next(e)` continues below
   *  it, `next.to(e, tiers)` continues at a named tier. */
  handlers?: Record<string, (input: unknown, next: ChainCallHandle) => unknown>;
  /** The hook patterns it registers; a module with none answers nothing. */
  patterns?: ChainModule['patterns'];
  /** The interfaces its environment answers `callInterface` with. */
  interface?: ChainModule['interface'];
  /** How it answers a `ui.press` on its environment. */
  press?: ChainModule['press'];
}

/** A module file, read: the module to load and the events its own scan sees. */
export interface LoadedChainModuleFile {
  module: ChainModule;
  /** The events the module declares a handler for — the scan `iWt` checks its patterns against. */
  hookEvents: readonly string[];
}

/** Source name: the module file's own, or its file name without the extension. */
function moduleNameOf(modulePath: string, exports: ChainModuleFileExports): string {
  if (exports.name !== undefined) return exports.name;
  const base = modulePath.slice(modulePath.lastIndexOf('/') + 1);
  return base.replace(/\.[^.]+$/, '');
}

/** Turns one module file's exports into the module the chain loads. A module's `hooks` predicate is
 *  its handler table and its `record` is that handler wrapped in the runner's handler shape. */
export function chainModuleFromFile(modulePath: string, exports: ChainModuleFileExports): LoadedChainModuleFile {
  const name = moduleNameOf(modulePath, exports);
  const handlers = exports.handlers ?? {};
  const hookEvents = Object.keys(handlers);
  const module: ChainModule = {
    name,
    tier: exports.tier,
    modulePath,
    patterns: exports.patterns,
    interface: exports.interface,
    press: exports.press,
    hooks: (event) => typeof handlers[event] === 'function',
    record: (event) => ({
      name,
      tier: exports.tier,
      budgetMs: 0,
      run: async (input: unknown, handle: unknown) => handlers[event]?.(input, handle as ChainCallHandle),
    }),
  };
  return { module, hookEvents };
}

/** Imports a product plugin module file and reads it. The caller owns the path: this resolves
 *  whatever it is given, so the plugin directory is the caller's boundary, not this module's. */
export async function loadChainModuleFile(modulePath: string): Promise<LoadedChainModuleFile> {
  const loaded = (await import(pathToFileURL(modulePath).href)) as { default?: ChainModuleFileExports } & ChainModuleFileExports;
  return chainModuleFromFile(modulePath, loaded.default ?? loaded);
}

/** One loaded environment: its module, the record that answers its dispatches, and what its patterns
 *  registered — the list the copied `wGt` then turns into the record's hook surface. */
interface LoadedEnvironment {
  module: ChainModule;
  record: ChainModuleRecord;
  registered: readonly ChainPattern[];
}

/** The module a load names: the one the descriptor already carries, or the file it points at. */
async function moduleFor(descriptor: ChainEnvironmentDescriptor): Promise<LoadedEnvironment> {
  const carried = descriptor.module as ChainModule | undefined;
  if (carried !== undefined) {
    return { module: carried, record: chainModuleRecord(carried), registered: carried.patterns ?? [] };
  }
  if (descriptor.modulePath === undefined) {
    throw new Error(`${descriptor.pluginName}: the load names no module and no module path`);
  }
  const { module } = await loadChainModuleFile(descriptor.modulePath);
  return { module, record: chainModuleRecord(module), registered: module.patterns ?? [] };
}

/**
 * The product's environment host. One instance holds every environment the chain has loaded; the
 * copied `lIo`/`dIo` keep one per chain and replace it when it dies.
 */
export function inProcessEnvironmentHost(): ChainEnvironmentHost {
  const environments = new Map<number, LoadedEnvironment>();
  let died: string | undefined;
  let dispatchCounter = 0;

  const environmentOf = (environmentId: number): LoadedEnvironment => {
    const held = environments.get(environmentId);
    if (held === undefined) throw new Error(`hooks environment ${environmentId} is not loaded`);
    return held;
  };

  /** One environment as an inner-chain handler. Source: `W(worker, {environmentId, event, ...})` in
   *  the worker's dispatch, which yields the environment's own handler for the event; here that is
   *  the module's handler, run with the handle the inner chain builds. */
  const environmentHandler = (held: LoadedEnvironment, event: string): ChainHandler => ({
    name: held.module.name,
    tier: held.module.tier,
    run: (input: unknown, handle: unknown) =>
      (held.module.record(event) as ChainHandler).run(input, handle as never, {} as never),
  });

  return {
    kind: 'in-process',
    get died() {
      return died;
    },

    /** Source `load(environmentId, descriptor)` in `vJt`: start the environment and report what it
     *  registered. Here the environment is the module itself, and what it registered is what its
     *  patterns declare — the same list the copied `wGt` then turns into the record's hook surface. */
    async load(environmentId: number, descriptor: ChainEnvironmentDescriptor) {
      if (died !== undefined) throw new Error(`hooks environment refused a load: ${died}`);
      if (environments.has(environmentId)) throw new Error(`hooks environment ${environmentId} is already loaded`);
      const held = await moduleFor(descriptor);
      environments.set(environmentId, held);
      return { registered: held.registered };
    },

    /** Source `unload(environmentId)` in `vJt`: stop the environment. The source's own unload does not
     *  touch the press registry — the loader's `terminate`/`retire` paths forget the plugin's presses —
     *  so neither does this one. */
    unload(environmentId: number) {
      environments.delete(environmentId);
    },

    /** Source `nextDispatchId()` in `vJt`: the counter a dispatch payload is stamped from. */
    nextDispatchId() {
      return ++dispatchCounter;
    },

    /** Source `dispatch(payload, next, signal)` in `vJt`, which hands the payload to the worker's own
     *  dispatcher (`async function v` inside `bgo`, chunk-p16hdq43.js [18214,18714)). That one folds
     *  *every* environment the payload names as an inner chain:
     *
     *    aP({e: payload.payload, handlers: environments.map((id) => W(worker, {environmentId: id,
     *    event})), site: Ooe(event, raise), signal, isHopFold: true, bottom: next, ...})
     *
     *  `Rpr` puts every member's environment id on the payload (`Q`), so a batch of plugins over one
     *  host is one dispatch that folds them in order, each environment's handler continuing into the
     *  next and the last into `next`. The worker's caught/ended bookkeeping (`caughtAnswered`,
     *  `endedReached`, the `ended.kept` answer) belongs to the worker's environment store, which this
     *  product does not carry; the fold and the continuation are what the chain observes. */
    async dispatch(payload: ChainDispatchPayload, next: unknown, signal: AbortSignal) {
      const ids = payload.environments ?? [];
      if (ids.length === 0) throw new Error('a dispatch names no environment');
      const answer = await aP({
        e: payload.payload,
        handlers: ids.map((id) => environmentHandler(environmentOf(id), payload.event)),
        site: Ooe(payload.event, payload.raise),
        signal,
        isHopFold: true,
        bottom: next,
        origin: payload.origin as never,
        floors: (payload.floors ?? hlt) as never,
        cutAt: payload.cutAt,
        trace: undefined as never,
      });
      return { result: answer };
    },

    /** Source `resolveTables(environmentId, tables)` resolves a module's tables inside its own
     *  environment. Port: the product's module has no separate table space — it is the process — so
     *  the tables are already what the caller asked for. */
    async resolveTables(environmentId: number, tables: unknown) {
      environmentOf(environmentId);
      return tables;
    },

    /** Source `build(environmentId, tables, argument)` runs the environment's build step. Port: an
     *  in-process module has none; the source's is a worker/VM protocol step. */
    async build(environmentId: number) {
      environmentOf(environmentId);
    },

    /** Source `callInterface(environmentId, {name, method, args})`: answer a call on the module's
     *  interface. The table is the module's own, so a method it did not declare is a call error. */
    async callInterface(environmentId: number, call: ChainInterfaceCall) {
      const { module } = environmentOf(environmentId);
      const method = module.interface?.[call.name]?.[call.method];
      if (typeof method !== 'function') {
        throw new Error(`$${call.name}.${call.method} is not an interface the module ${module.name} answers`);
      }
      return await method(...call.args);
    },

    /** Source `press(environmentId, handle, e)` in `vJt`: run the environment's press and hand back
     *  what it returned. The held handle is this product's own — the loader's teardown forgets a
     *  plugin's presses whole, and `releasePresses` drops the ones it names. */
    async press(environmentId: number, handle: number, argument: unknown) {
      const { module } = environmentOf(environmentId);
      AK.hold(module.name, { environmentId, name: handle, argument });
      return await module.press?.(handle, argument);
    },

    /** Source `releasePresses(environmentId, handles)`: drop the presses this environment handed out.
     *  The handles are the ones the caller took from `press`; a handle it does not hold is ignored. */
    releasePresses(environmentId: number, handles: readonly unknown[]) {
      const held = environments.get(environmentId);
      if (held !== undefined) AK.release(held.module.name, handles);
    },

    /** Source `terminate()` in `vJt`: mark the host gone with the same reason text the source uses,
     *  so a record built over it reports `dead` and a later load goes to a fresh host. */
    terminate() {
      died = 'the in-process runtime was replaced';
      environments.clear();
    },
  };
}
