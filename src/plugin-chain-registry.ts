// The product's chain catalog: which chain names exist, what each one's core is, and which event
// site answers for it.
//
// The copied runner asks three questions — `yyt()[name]` (the installed core), `$be()[name]` (the
// site), and `Syt` (the names whose dispatch may wait on a hooks respawn). `Syt` is computed once
// when ./plugin-chain-source.ts is evaluated, so the supported names are seeded in the host's
// `SUPPORTED` set; cores and sites are registered here, in the order the runner reads them.
// This import must stay first among the chain copies: its module body registers the twelve sites,
// and ./plugin-chain-cores-source.js builds its chains from `zd[name]` at module scope.
import './plugin-chain-sites-registration.js';
import './plugin-chain-scroll-focus-sites.js';
import { He, l, qi } from './plugin-chain-source.js';
import { Mm, cze } from './plugin-chain-entry.js';
import { FOCUS_ENTRY, SCROLL_ENTRY } from './plugin-chain-scroll-focus.js';
import { Fre, ise, Joe, kre, lse, ose, Rre, vre, xre, YH, cse, _re } from './plugin-chain-cores-source.js';
import { modulesChanged, registerChainCore, registerChainSite, setChainErrorClass, setChainEnvironmentHostFactory, setChainRecordFactory, t } from './plugin-chain-host.js';
import { chainModuleRecord } from './plugin-chain-module-record.js';
import { inProcessEnvironmentHost } from './plugin-chain-module-host.js';
import { createChainRun, loadChainModuleFileInto, type LoadedChainModule } from './plugin-chain-loader.js';
import { D5t } from './plugin-chain-loader-source.js';
import { NDe } from './plugin-chain-store-entry-source.js';
import type { ChainHandler } from './plugin-chain-types.js';

// The record factory: a module installed through the host becomes the record shape the copied
// collection reads (./plugin-chain-module-record.ts explains the hooks-worker stand-in).
setChainRecordFactory(chainModuleRecord);

// The environment host the copied loader loads into. The source picks one host per chain by
// isolation kind; this product has one kind, in process
// (./plugin-chain-module-host.ts explains what it stands in for).
setChainEnvironmentHostFactory(() => inProcessEnvironmentHost());

// One hooks error class for both sides: the copied bodies throw it and the host's pattern parser
// throws it, so `ze`/`eRe` classify it the same way the source does.
setChainErrorClass(He as unknown as new (message: string) => Error);

// `Mm(name, run)` (chunk-sfn1dbxq.js [459384,459480)) pairs the event's site with
// `{name:'core', isCore:true, budgetMs:0, run}`; `cze` (chunk-sfn1dbxq.js [460409,460606)) is the
// prompt.edit rewrite the composer's relay calls: it splices `inputText` over `[start,end)` and
// puts the cursor after it.
registerChainSite('prompt.edit', qi);

/** The `prompt.edit` chain, exactly as the source builds it: the composer's rewrite as its core. */
export const promptEditChain = Mm('prompt.edit', cze);

registerChainCore('prompt.edit', promptEditChain.core);

// The twelve chains whose core is the source's own default answer, each paired with its site by the
// source's own builder: `Mm` for the five text answers and the three projections, `HT` for the five
// whose core hands the request back. The sites were registered when
// ./plugin-chain-sites-registration.ts evaluated, one import above.
const defaultCoreChains: ReadonlyArray<readonly [string, { core: ChainHandler }]> = [
  ['agent.offer', Joe],
  ['command.describe', kre],
  ['config.describe', YH],
  ['tool.describe', cse],
  ['prompt.autocomplete', Rre],
  ['telemetry.mark', lse],
  ['prompt.context', xre],
  ['prompt.section', Fre],
  ['prompt.attachment', vre],
  ['skill.prompt', ise],
  ['attribution.text', _re],
  ['session.receive', ose],
];

for (const [name, chain] of defaultCoreChains) registerChainCore(name, chain.core);

// The two `$` call entries this product carries out of the plugin-facing call table (W45-71): a plugin
// that scrolls a site or asks one to take the keyboard. Their sites are registered one import above
// (`./plugin-chain-scroll-focus-sites.js`), which is what `Mm` read when the entries were built.
registerChainCore('ui.scroll', SCROLL_ENTRY.core as ChainHandler);
registerChainCore('ui.focus', FOCUS_ENTRY.core as ChainHandler);

// ---------------------------------------------------------------- the plugins that declare a module

/** One declaration, as the plugin store reports it: the plugin's name, the module file its hooks file
 *  names in `modules`, and the plugin folder the source's environment descriptor calls `path`. */
export interface PluginHooksModuleDeclaration {
  name: string;
  modulePath: string;
  /** The plugin's install directory: the descriptor's `path`, which `D5t` composes the label from. */
  path?: string;
  tier?: string;
}

/** The chain a plugin module loads into. The source keeps one per chain and the installer counts the
 *  environments in it; this product has one chain running at a time, so this is it. */
const chainRun = createChainRun();

interface AdoptedModule {
  modulePath: string;
  loaded: LoadedChainModule;
}

// `Pe` commits its set marker after `Xye` (chunk-sfn1dbxq.js [2386573,2387113), UTF-16).
let inventoryNotification: 'pending' | 'notifying' | 'complete' = 'complete';
let inventoryChangedDuringNotification = false;

function flushInventoryNotification(): void {
  while (inventoryNotification === 'pending') {
    inventoryNotification = 'notifying';
    inventoryChangedDuringNotification = false;
    try {
      modulesChanged();
      inventoryNotification = inventoryChangedDuringNotification ? 'pending' : 'complete';
    } catch (error) {
      inventoryNotification = 'pending';
      throw error;
    }
  }
}

function notifyInventoryChange(): void {
  if (inventoryNotification === 'notifying') {
    inventoryChangedDuringNotification = true;
    return;
  }
  inventoryNotification = 'pending';
  flushInventoryNotification();
}

const adopted = new Map<string, AdoptedModule>();
// `uen`/`NDe`, chunk-sfn1dbxq.js [2425242,2425917), chunk-tvdq3hrk.js [15601,15722), UTF-16.
const queue: (task: () => Promise<void>) => Promise<void> = NDe();
let pending: Promise<void> = Promise.resolve();
let pendingLoads: Promise<void> = Promise.resolve();

/** The plugins whose modules are loaded right now. */
export function adoptedPluginHooksModules(): readonly string[] {
  return [...adopted.keys()];
}

/**
 * Brings the chain's loaded plugin modules in line with what the store discovered: a plugin that
 * declares a module now is registered and loaded, one whose declaration changed is reloaded, and one
 * that disappeared is unloaded. Each request follows earlier reconciliation, and its returned promise
 * reports that request's load or notification error.
 */
export function adoptPluginHooksModules(declarations: readonly PluginHooksModuleDeclaration[]): Promise<void> {
  const snapshot = declarations.map(declaration => ({ ...declaration }));
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const result = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
  const operation = queue(async () => {
    let resultSettled: Promise<void>;
    try {
      resultSettled = reconcilePluginHooksModules(snapshot).then(resolve, reject);
    } catch (error) {
      reject(error);
      resultSettled = Promise.resolve();
    }
    await resultSettled;
    await pendingLoads;
  });
  pending = operation.then(() => undefined, () => undefined);
  return result;
}

function reconcilePluginHooksModules(declarations: readonly PluginHooksModuleDeclaration[]): Promise<void> {
  const seen = new Set<string>();
  for (const declaration of declarations) {
    if (seen.has(declaration.name)) throw new Error(`Duplicate hooks module declaration: ${declaration.name}`);
    seen.add(declaration.name);
  }
  const leaving = [...adopted].filter(([name]) => !seen.has(name));
  if (leaving.length > 0) {
    // `CVo`/`iF`, chunk-sfn1dbxq.js [2394754,2395107)/[2390383,2390919), UTF-16.
    let changed = false;
    for (const [name, held] of leaving) {
      adopted.delete(name);
      held.loaded.unload(() => { changed = true; });
    }
    if (changed) notifyInventoryChange();
    t(`hooks modules unloaded: ${leaving.map(([name, held]) => held.loaded.record.label ?? name).join(', ')} (plugin disabled or uninstalled)`);
  }
  const starts: Promise<void>[] = [];
  try {
    for (const declaration of declarations) {
      const held = adopted.get(declaration.name);
      if (held !== undefined && held.modulePath === declaration.modulePath) {
        flushInventoryNotification();
        continue;
      }
      if (held !== undefined) {
        adopted.delete(declaration.name);
        held.loaded.unload();
      }
      starts.push(loadChainModuleFileInto(chainRun, {
        pluginName: declaration.name,
        modulePath: declaration.modulePath,
        ...(declaration.path === undefined ? {} : { storageId: declaration.path }),
        ...(declaration.tier === undefined ? {} : { tier: declaration.tier }),
      }, (loaded) => {
        adopted.set(declaration.name, { modulePath: declaration.modulePath, loaded });
      }, notifyInventoryChange).then(() => undefined, (error: unknown) => {
        // `a_e`/`JWe` report failures; `vVe` rethrows the original error on direct reload
        // (chunk-sfn1dbxq.js [2385002,2389680)/[1688430,1688508)/[2391116,2393895), UTF-16).
        try {
          const label = D5t({ pluginName: declaration.name, pluginStorageId: declaration.path ?? declaration.modulePath.slice(0, declaration.modulePath.lastIndexOf('/')) });
          const cause = error instanceof Error && typeof error.cause === 'string' ? ` (${error.cause})` : '';
          t(`hooks module ${label} failed to load: ${l(error)}${cause}`, { level: 'error' });
        } finally {
          throw error;
        }
      }));
    }
    flushInventoryNotification();
    return Promise.all(starts).then(() => undefined);
  } finally {
    // `gas`/`iOn` and `a_e` finally, chunk-2kdsvp3x.js [39441,39563)/[38557,38835),
    // chunk-sfn1dbxq.js [2389608,2389680), UTF-16.
    const settled = Promise.allSettled(starts).then(() => undefined);
    pendingLoads = Promise.all([pendingLoads, settled]).then(() => undefined);
  }
}

/** Wait for queued reconciliations and every load they started. A request submitted during a wait
 *  replaces `pending`, so the wait repeats until the queue's tail stops moving. */
export async function pluginHooksModulesSettled(): Promise<void> {
  let waited: Promise<void> | undefined;
  while (waited !== pending) {
    waited = pending;
    await waited;
  }
}
