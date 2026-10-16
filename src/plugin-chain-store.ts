// The `$` store's entry and dispatcher (W45-52): what `store.get`, `store.set`, `store.delete` and
// `store.keys` reach. The copied bodies live in ./plugin-chain-store-entry-source.ts; this module is
// the host seam around them, and the four table entries — fragments of the plugin-method table's
// literal, not top-level statements — are ported here verbatim with their spans quoted, the way the
// ui entries were in W45-24.
//
// Source: the four entries of the plugin-method table's literal (chunk-sfn1dbxq.js, whose table is
// built by `Iqo(e)` — `e` is the dispatch context every entry closes over):
//
//   "store.get":{check:ppr,run:(n,r)=>JAt({event:"get",key:n.key},fW(e,r.plugin))}        [2353939,2354017)  78 units
//   "store.set":{check:xNs,run:(n,r)=>JAt({event:"set",key:n.key,value:n.value},fW(e,r.plugin)).then(()=>{return})}   [2354018,2354129) 111 units
//   "store.delete":{check:ppr,run:(n,r)=>JAt({event:"delete",key:n.key},fW(e,r.plugin)).then(()=>{return})}           [2354130,2354233) 103 units
//   "store.keys":{run:(n,r)=>JAt({event:"keys"},fW(e,r.plugin))}                          [2354234,2354294)  60 units
//
// and the bodies behind them, all in the store's own module chunk-tvdq3hrk.js:
//
//   function _ro(e){…}                                                     [10939,11214) 275 units
//   function ppr(e){…}                                                     [11214,11283)  69 units
//   var xNs=(e)=>ppr(e)??_ro(e?.value);                                    [13344,13379)  35 units
//   var pt={realpath:!1,retries:{retries:10,minTimeout:5,maxTimeout:100},onCompromised:…}  [15456,15601) 145 units
//   var de=(e)=>e.catch(()=>{return});                                     [15601,15635)  34 units
//   function NDe(){…}                                                      [15635,15722)  87 units
//   function le(){…}                                                       [15722,15805)  83 units
//   var ct=le();                                                           [15829,15841)  12 units
//   var Se={async read(e){…},write:…,async lock(e){…}};                    [17609,18093) 484 units
//   function Pe(){…} var Dt=Pe(); var Ae=()=>Dt.backendOverride()??Se;      [18093,18213) 120 units
//   var Z=256;                                                             [18213,18223)  10 units
//   async function Ce(e,r){…}                                              [18223,19056) 833 units
//   var JAt=(e,r)=>ct(r)(()=>Ce(e,r));                                     [19056,19090)  34 units
//   var jde=4194304;                                       chunk-nyce03br.js [212618,212634) 16 units
//   function bs(){let t;return{set:(e)=>{t=e},get:()=>t}}  chunk-c9vsmdqj.js [615,668)      53 units
//   var fW=(e,n)=>e.knownArgs.get(n)?.pluginStorageId??n;   chunk-sfn1dbxq.js [2342617,2342670) 53 units
//
// What the ported bodies say, all measured from the source:
//  · The entries are the store's whole surface. `get` and `delete` carry `ppr` (the call must name a
//    string key); `set` carries `xNs` (`ppr` first, then `_ro`: the value must serialize as JSON, be
//    a string, and be no longer than `jde`); `keys` carries none. Every `run` names the store id
//    through `fW(e, r.plugin)` — the id the dispatch context holds for the plugin, else the plugin's
//    own name — and set and delete answer `undefined` once their write landed.
//  · `JAt` puts the dispatcher behind a per-id queue: `ct` is `le()`, one serial chain per storage id,
//    so two writes to the same plugin store cannot interleave, while a rejection does not stop the
//    next caller (`de` swallows the settled promise the queue hands on).
//  · `Ce` is the dispatcher. Every event but `keys` refuses a key longer than `Z` (256). A `get`
//    answers the stored value when the store has the key (its own `hasOwn`, so an inherited name is
//    not a key) and `undefined` otherwise; `keys` answers the store's own keys; `set` merges the value
//    into the store and refuses the write when the whole store would pass `jde`, then writes and logs
//    `$.store.set (plugin): key`; `delete` removes the key only when the store has it. Set and delete
//    take the store's lock first and release it through `Um` whatever happens. Anything the backend
//    throws is wrapped in the hooks error class as `${id}: $.store.${event} failed: ${reason}`; the
//    dispatcher's own refusals are already that class and pass through unchanged.
//  · `Se` is the store entry. `read` reads through the W45-51 layer (the carry when the file is
//    missing), parses with the source's own `Y`, refuses unreadable or malformed content with the
//    hooks error class, answers `{}` for a store that is not there, touches the file (W45-48) and
//    answers the parsed object. `write` publishes through the W45-50 writer at 0600, making the
//    directory first (W45-48), with the text from `_` (two-space JSON plus a newline). `lock` takes
//    the W45-49 lock beside the store file (`<file>.lock`) with `pt`.
//  · `Ae` is the backend in force: whatever `Dt`'s slot holds, else `Se`. `Dt` is one slot built by
//    `Pe` over `bs`, so `setStoreBackend` replaces the store for the whole product and
//    `setStoreBackend(undefined)` restores it (the source's own `?? Se`), which is how this product's
//    host will point the store at its own storage.
//  · `pt` is the lock contract every store lock is taken with: `realpath:false` (the lock sits beside
//    the file the store just resolved), ten retries from 5ms to 100ms, and a compromised lock logged
//    at warn as `$.store lock compromised: ${reason}` rather than thrown.
//
// The dispatch context. The source's entries close over `e` and read `e.knownArgs.get(plugin)
// ?.pluginStorageId` — the plugin interface dispatcher's own map. This product has no `$` object, so
// the seam keeps the map itself: `bindStoreStorageId(plugin, id)` fills it and the entries fall back
// to the plugin's name when it holds nothing, which is exactly `fW`'s own `?? n`. Nothing is
// defaulted: an unbound plugin runs against its name, the way the source runs a plugin the dispatcher
// has no id for.
import { Ae, Dt, JAt, Z, _ro, bs, ct, jde, ppr, pt, Se, xNs } from './plugin-chain-store-entry-source.js';
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';
import type { PluginStoreLockHandle } from './plugin-chain-lockfile.js';

export type { HostCallCaller };

/** The four names the table's store entries answer. */
export type StoreCallEvent = 'store.get' | 'store.set' | 'store.delete' | 'store.keys';

/** One table entry as `Hze` reads it: `check` answers the refusal text for an argument, `run` is the
 *  chain's floor — `JAt` behind the per-id queue. */
export type StoreCallEntry = HostCallBottom;

/** The store ids the dispatch context holds, by plugin name. This is the source's `knownArgs` map,
 *  kept by the seam because this product has no plugin interface dispatcher to build one. */
const knownStorageIds = new Map<string, string>();

/** Source `fW`: the storage id an entry runs against — the id the context holds for the plugin, else
 *  the plugin's own name. */
function storageIdFor(plugin: string): string {
  return knownStorageIds.get(plugin) ?? plugin;
}

/** Hold this plugin's storage id for the store entries. Binding `undefined` drops it, which puts the
 *  plugin back on its own name — the source's own fallback. */
export function bindStoreStorageId(plugin: string, id: string | undefined): void {
  if (id === undefined) knownStorageIds.delete(plugin);
  else knownStorageIds.set(plugin, id);
}

/** The four entries, exactly as the table's literal spells them: each `run` names its event and the
 *  store id from the bound context, and carries the check the source gives that name. */
export function storeCallTable(): Record<StoreCallEvent, StoreCallEntry> {
  return {
    'store.get': { check: ppr, run: (n: any, r: HostCallCaller) => JAt({ event: 'get', key: n.key }, storageIdFor(r.plugin)) },
    'store.set': {
      check: xNs,
      run: (n: any, r: HostCallCaller) =>
        JAt({ event: 'set', key: n.key, value: n.value }, storageIdFor(r.plugin)).then(() => {}),
    },
    'store.delete': {
      check: ppr,
      run: (n: any, r: HostCallCaller) =>
        JAt({ event: 'delete', key: n.key }, storageIdFor(r.plugin)).then(() => {}),
    },
    'store.keys': { run: (_n: any, r: HostCallCaller) => JAt({ event: 'keys' }, storageIdFor(r.plugin)) },
  };
}

/** Raise one `$` store call the way the plugin-method dispatcher does: the table entry for the name
 *  is the chain's floor, so a plugin's hooks may answer first and `next()` reaches the floor. */
export async function raiseStoreCall(request: {
  event: StoreCallEvent;
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: storeCallTable()[request.event],
    raise: request.raise,
  });
}

/** Source `Se`: the store entry the dispatcher reads, writes and locks through. */
export const storeEntry = Se as {
  read(id: string): Promise<Record<string, string>>;
  write(id: string, data: unknown): Promise<void>;
  lock(id: string): Promise<PluginStoreLockHandle>;
};

/** Source `Ae`: the backend in force — the slot's value when one is bound, else the store entry. */
export function storeBackend(): typeof storeEntry {
  return Ae() as typeof storeEntry;
}

/** Source `Dt` over `Pe`/`bs`: bind this product's own store. Binding `undefined` restores the store
 *  entry, the source's own fallback. */
export function setStoreBackend(backend: typeof storeEntry | undefined): void {
  (Dt as { setBackend: (value: unknown) => void }).setBackend(backend);
}

/** Source `Z`: the key-length limit every event but `keys` refuses at. */
export const STORE_KEY_MAX_CHARS = Z;

/** Source `jde`: the character limit one stored value and the whole store are both held to. */
export const STORE_CHAR_LIMIT = jde;

/** Source `pt`: the options every store lock is taken with. */
export const storeLockOptions = pt;

/** Source `ct` over `le`/`NDe`: the per-storage-id queue the write and delete paths run behind. */
export const storeQueue = ct as <T>(id: string) => (task: () => Promise<T>) => Promise<T>;

/** Source `_ro`: the value check `store.set` carries — the value's JSON text, or the refusal. */
export const checkStoreValue = _ro as (value: unknown) => string | undefined;

/** Source `ppr`: the key check `store.get` and `store.delete` carry. */
export const checkStoreKey = ppr as (args: unknown) => string | undefined;

/** Source `xNs`: the `store.set` check — the key first, then the value. */
export const checkStoreSet = xNs as (args: unknown) => string | undefined;

/** Source `bs` over `Pe`: one backend slot, for a host that needs its own. */
export const createStoreBackendSlot: () => { set: (value: unknown) => void; get: () => unknown } = bs as never;
