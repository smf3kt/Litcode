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
import { He, qi } from './plugin-chain-source.js';
import { Mm, cze } from './plugin-chain-entry.js';
import { Fre, ise, Joe, kre, lse, ose, Rre, vre, xre, YH, cse, _re } from './plugin-chain-cores-source.js';
import { registerChainCore, registerChainSite, setChainErrorClass, setChainEnvironmentHostFactory, setChainRecordFactory, t } from './plugin-chain-host.js';
import { chainModuleRecord } from './plugin-chain-module-record.js';
import { inProcessEnvironmentHost } from './plugin-chain-module-host.js';
import { createChainRun, loadChainModuleFileInto } from './plugin-chain-loader.js';
// The record factory: a module installed through the host becomes the record shape the copied
// collection reads (./plugin-chain-module-record.ts explains the hooks-worker stand-in).
setChainRecordFactory(chainModuleRecord);
// The environment host the copied loader loads into. The source picks one host per chain by
// isolation kind; this product has one kind, in process
// (./plugin-chain-module-host.ts explains what it stands in for).
setChainEnvironmentHostFactory(() => inProcessEnvironmentHost());
// One hooks error class for both sides: the copied bodies throw it and the host's pattern parser
// throws it, so `ze`/`eRe` classify it the same way the source does.
setChainErrorClass(He);
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
const defaultCoreChains = [
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
for (const [name, chain] of defaultCoreChains)
    registerChainCore(name, chain.core);
/** The chain a plugin module loads into. The source keeps one per chain and the installer counts the
 *  environments in it; this product has one chain running at a time, so this is it. */
const chainRun = createChainRun();
const adopted = new Map();
let pending = Promise.resolve();
/** The plugins whose modules are loaded right now. */
export function adoptedPluginHooksModules() {
    return [...adopted.keys()];
}
/**
 * Brings the chain's loaded plugin modules in line with what the store discovered: a plugin that
 * declares a module now is registered and loaded, one whose declaration changed is reloaded, and one
 * that disappeared is unloaded. Loading runs the plugin's own file, so it is deferred — this call
 * registers the declaration and hands back a promise for the loads it started, which a caller that
 * needs the chain ready (a run, a test) can await.
 */
export function adoptPluginHooksModules(declarations) {
    const seen = new Set(declarations.map((declaration) => declaration.name));
    const leaving = [];
    for (const [name, held] of [...adopted]) {
        if (seen.has(name))
            continue;
        leaving.push(held.loaded.record.label ?? name);
        held.loaded.unload();
        adopted.delete(name);
    }
    // The source's removal reconciler `CVo` (chunk-sfn1dbxq.js [2394700,2395092)) drops the plugin from
    // its state and unloads it with this sentence, which is the line a person sees.
    if (leaving.length > 0)
        t(`hooks modules unloaded: ${leaving.join(', ')} (plugin disabled or uninstalled)`);
    const starts = [];
    for (const declaration of declarations) {
        const held = adopted.get(declaration.name);
        if (held !== undefined && held.modulePath === declaration.modulePath)
            continue;
        if (held !== undefined) {
            held.loaded.unload();
            adopted.delete(declaration.name);
        }
        starts.push(loadChainModuleFileInto(chainRun, {
            pluginName: declaration.name,
            modulePath: declaration.modulePath,
            ...(declaration.path === undefined ? {} : { storageId: declaration.path }),
            ...(declaration.tier === undefined ? {} : { tier: declaration.tier }),
        }).then((loaded) => {
            adopted.set(declaration.name, { modulePath: declaration.modulePath, loaded });
        }));
    }
    const started = Promise.all(starts).then(() => undefined);
    pending = Promise.all([pending, started]).then(() => undefined);
    return started;
}
/** Settles the loads this module has started, so a caller can dispatch with every declaration live. A
 *  load started while this wait is already in flight replaces `pending`, so the wait repeats until it
 *  stops moving; one call therefore covers every adoption recorded before it returns. */
export async function pluginHooksModulesSettled() {
    let waited;
    while (waited !== pending) {
        waited = pending;
        await waited;
    }
}
