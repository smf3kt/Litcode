// The composer edit relay: the copied `cue` hook, the hook host that stands in for React, and the
// host interface `YHo` expects from the composer.
//
// `YHo` itself (the relay) and every body it calls are copied into ./plugin-chain-relay-source.ts.
// What lives here is the one body that cannot: `cue` is a React hook, and this product has no React,
// so its body is carried with the host's TypeScript annotations and its four hook names are supplied
// by the host below — the same idiom ./tui-input-undo.ts uses for the undo hook.
//
// Sources: research/ports/W45-chain-runner.md#slice-3, ledger research/ports/W45-chain-relay-blocks.json.
//
// The catalog is imported for its registration: the relay raises through the `prompt.edit` site and
// core, and the composer is the surface that needs them, so it is this module that carries them.
import './plugin-chain-registry.js';
import { t, onChainModulesChanged } from './plugin-chain-host.js';
import { Jl, XOr, YHo } from './plugin-chain-relay-source.js';
import { pluginHooksModulesSettled } from './plugin-chain-registry.js';
import type { ChainRelayEdit, ChainRelayHost, ComposerEditRelay, ChainRelayKey } from './plugin-chain-types.js';

/* ------------------------------------------------------- the hook host (owned port) */

/** Source `OL()` is the store the composer's selection reads (`Re(OL(), () => Jl("prompt.edit"))`);
 *  here it is the loaded-module inventory, which installChainModule notifies. */
interface ModuleStore {
  subscribe: (listener: () => void) => () => void;
}

function moduleStore(): ModuleStore {
  return { subscribe: (listener) => onChainModulesChanged(listener) };
}

/** The hook host: `y` is `useMemo`, `Re(store, select)` is `useSyncExternalStore`, and `P(effect,
 *  deps)` is `useEffect`. Re-rendering — re-running the component body — is what keeps `cue`'s own
 *  body authoritative: this product never decides for itself whether the relay is hooked, it re-runs
 *  the source's effect with the source's selector when the loaded-module inventory changes. */
interface HookHost {
  y: <T>(factory: () => T) => [T, (value: T) => void];
  Re: <T>(store: ModuleStore, select: () => T) => T;
  P: (effect: () => void | (() => void), deps: readonly unknown[]) => void;
  OL: () => ModuleStore;
}

/** One committed effect: the dependencies it last ran with, and the disposer it returned. */
interface EffectSlot {
  deps: readonly unknown[];
  dispose?: (() => void) | undefined;
}

/** Mount `component` against a fresh hook host and return the first render's value. */
function hookHost<T>(component: (hooks: HookHost) => T): T {
  const store = moduleStore();
  let memoised: { value: unknown } | undefined;
  let select: (() => unknown) | undefined;
  let selection: unknown;
  let slots: readonly EffectSlot[] = [];
  let pending: { effect: () => void | (() => void); deps: readonly unknown[] }[] = [];
  let rendered = false;
  let value: T | undefined;
  const sameDeps = (a: readonly unknown[], b: readonly unknown[]): boolean =>
    a.length === b.length && a.every((entry, index) => Object.is(entry, b[index]));
  const hooks: HookHost = {
    y: <T>(factory: () => T): [T, (value: T) => void] => {
      if (memoised === undefined) memoised = { value: factory() };
      const slot = memoised;
      return [slot.value as T, (next: T) => { slot.value = next; }];
    },
    Re: <T>(target: ModuleStore, selector: () => T): T => {
      void target;
      select = selector as () => unknown;
      selection = selector();
      return selection as T;
    },
    P: (effect, deps) => { pending.push({ effect, deps }); },
    OL: () => store,
  };
  /** One render pass: run the body, then commit the effects it declared — disposing and re-running
   *  only the slots whose dependencies changed, in the order React commits them. */
  const render = (): void => {
    pending = [];
    const produced = component(hooks);
    if (!rendered) { rendered = true; value = produced; }
    const declared = pending;
    pending = [];
    const previous = slots;
    const next: EffectSlot[] = [];
    declared.forEach((declaration, index) => {
      const slot = previous[index];
      if (slot !== undefined && sameDeps(slot.deps, declaration.deps)) { next.push(slot); return; }
      slot?.dispose?.();
      next.push({ deps: declaration.deps, dispose: declaration.effect() ?? undefined });
    });
    for (let index = declared.length; index < previous.length; index += 1) {
      previous[index]?.dispose?.();
    }
    slots = next;
  };
  store.subscribe(() => {
    // The store changed: re-read the selector, and re-render only when the selected value moved.
    if (select === undefined || Object.is(select(), selection)) return;
    render();
  });
  render();
  return value as T;
}

/* ------------------------------------------------------------- the copied hook (copy) */

// chunk-24k7d6mw.js `function cue(h){…}` [797251,797511) 260 units, body sha256
// aea5495c0649b27a8e42b83f241c2adbf23148dcd80ea8aa6ae584f4a1cff636. Carried with the host's
// TypeScript annotations; identifiers, literals and calls are the source's.
function cue(h: ChainRelayHost, hooks: HookHost): ComposerEditRelay {
  const [T] = hooks.y(() => YHo(h) as ComposerEditRelay);
  // `Jl(name, args, modules)`: no arguments in this call, so the gate is "some loaded module hooks
  // prompt.edit" and the third parameter keeps the source's own `it().loadedModules` default.
  const M = hooks.Re(hooks.OL(), () => Jl('prompt.edit', undefined, undefined));
  hooks.P(() => {
    T.setHooked(M);
    t(M ? 'prompt.edit: hooked; the composer relays its edits to the chain' : 'prompt.edit: unhooked; the composer relays nothing');
  }, [T, M]);
  hooks.P(() => () => T.dispose(), [T]);
  return T;
}

/** The product's relay: `cue`'s own body, with the composer's host interface supplied by the caller.
 *
 *  The one product rule added here is the default `raise`: a plugin's chain module loads when the
 *  plugin store declares it, which discovery does in the background because a module is code, so the
 *  first raise waits for those loads to settle before dispatching. A declared module therefore answers
 *  the person's first keystroke rather than whichever one lands after its import finished. */
export function composerEditRelay(host: ChainRelayHost): ComposerEditRelay {
  return hookHost((hooks) => cue({
    ...host,
    raise: host.raise ?? (async (edit, signal) => {
      await pluginHooksModulesSettled();
      return await XOr(edit, signal);
    }),
  }, hooks));
}

/** Whether any loaded module hooks this chain name and matches the arguments, through the copied `Jl`. */
export function chainHooked(name: string, args?: unknown): boolean {
  return Boolean(Jl(name, args, undefined));
}

export type { ChainRelayEdit, ChainRelayHost, ComposerEditRelay, ChainRelayKey } from './plugin-chain-types.js';
