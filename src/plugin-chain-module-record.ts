// The product's stand-in for the source's hooks worker, which is what a copied module record
// dispatches into.
//
// In the source a module record carries a `hopKey` whose `dispatch(payload, beneath, signal)` talks
// to the hooks worker that runs the plugin's code, and the worker's `next`/`next.to` are answered
// there. This product has no worker: a module is an in-process object that installs one handler for
// an event, so this file builds the same record shape and answers the dispatch in process. The
// tier-restricted continuation (`next.to`) is not re-implemented here — it goes through the copied
// `us` from ./plugin-chain-source.ts, so the floors a handler may continue at are the source's.
import { Xt, ip, np, us } from './plugin-chain-source.js';
import { wGt } from './plugin-chain-install-source.js';
import type { ChainCallHandle, ChainHandler, ChainModule, ChainModuleRecord, ChainStreamLinksInput } from './plugin-chain-types.js';

/** The dispatch payload the copied `Q` builds, as far as this stand-in reads it. */
interface DispatchPayload {
  id?: string;
  event: string;
  payload: unknown;
  origin?: unknown;
  hookOrigin?: unknown;
  floors?: readonly { from: string; to: string; plugin: string }[];
  cutAt?: number;
  raise?: boolean;
}

/** What a dispatch answers: which environments it answered for, and the value the handler returned
 *  (`result` is what the copied `Rpr` unwraps; `unmatched` says the module did not answer). */
interface DispatchAnswer {
  answered: readonly string[];
  result?: unknown;
  unmatched?: boolean;
}

/** One call below the module's handler: `(input, signal?, floors?)`. */
type Beneath = (input: unknown, signal?: AbortSignal, floors?: readonly unknown[]) => Promise<unknown>;

export function chainModuleRecord(module: ChainModule): ChainModuleRecord {
  const tier = module.tier ?? 'user';
  // The hook surface: a module that declared patterns answers through the source's own `wGt` over
  // that declaration list — the same builder the source's installer wraps an environment in — so
  // `hooks`/`catches`/`matcherFor`/`hasCatch`/`registrationsFor`/`patterns` are source text. A
  // module with only a predicate (this product's older shape) keeps the predicate form.
  const declared = module.patterns;
  const surface: ChainModuleRecord | undefined = declared === undefined
    ? undefined
    : (wGt(declared, { isBuiltin: false }) as ChainModuleRecord);
  const dispatch = async (payload: DispatchPayload, beneath: Beneath, signal: AbortSignal): Promise<DispatchAnswer> => {
    const handler: ChainHandler | undefined = module.record(payload.event, payload.hookOrigin);
    if (handler === undefined) return { answered: [], unmatched: true };
    // The handle is the continuation itself, in the source's shape: `sO`/`vSe` (chunk-nyce03br.js
    // [111700,112338)) null-protype the call function and hang `to`/`signal`/`is`/`event`/`origin`/
    // `trace`/`budget` off it, so a module calls `next(e)` and `next.to(e, tiers)`. Null-prototyping
    // is what makes `next.call` a TypeError instead of `Function.prototype.call` invoked with the
    // wrong arguments.
    const handle = Object.setPrototypeOf(
      (input: unknown, _signal?: AbortSignal, floors?: readonly unknown[]) => beneath(input, undefined, floors),
      null,
    ) as ChainCallHandle;
    (handle as { to: unknown }).to = (input: unknown, tiers: readonly string[]) =>
      beneath(input, undefined, us([...(payload.floors ?? [])] as never, tiers, { plugin: module.name, tier }));
    (handle as { signal?: AbortSignal }).signal = signal;
    (handle as { is?: unknown }).is = undefined;
    (handle as { event?: string }).event = payload.event;
    (handle as { origin?: unknown }).origin = payload.origin;
    (handle as { trace?: unknown }).trace = () => [];
    (handle as { budget?: unknown }).budget = () => ({ ms: 0, remainingMs: Number.POSITIVE_INFINITY });
    // The budget the module declared for itself is the worker's own: in the source the worker
    // watches it and reports the skip back, so this stand-in watches it with the copied `Xt` and
    // reports through the copied `np` with the source's own effect text. An unanswered dispatch
    // leaves the hop's result undefined, which is what makes the chain fall through to what is
    // below the module.
    const budgetMs = handler.budgetMs ?? 0;
    const budget = budgetMs > 0 ? Xt(budgetMs, signal, payload.cutAt) : undefined;
    const running = handler.run(payload.payload, handle, { call: handle, floors: [...(payload.floors ?? [])], cutAt: payload.cutAt });
    if (budget !== undefined && budget.expired !== undefined) {
      // `expired` rejects with the source's own budget error, so both settlements mean the same
      // thing here: the module ran past the budget it declared for itself.
      const overran = await Promise.race([
        running.then(() => false, () => false),
        budget.expired.then(() => true, () => true),
      ]);
      if (overran) {
        np({
          error: new Error(`ran past its ${budgetMs}ms budget`),
          handler: { name: module.name, tier, isHop: false } as ChainHandler,
          site: { event: payload.event },
          effect: ip,
          cause: { expiredMs: budgetMs },
        });
        budget.clear();
        return { answered: [], unmatched: true };
      }
    }
    const result = await running;
    budget?.clear();
    return { answered: [module.name], result };
  };
  return {
    name: module.name,
    tier,
    label: module.name,
    args: { modulePath: module.modulePath },
    status: () => ({ kind: 'live' as const }),
    enter: () => {},
    leave: () => {},
    hooks: surface === undefined ? (event: string) => module.hooks(event) : surface.hooks,
    catches: surface === undefined ? (event: string) => module.hooks(event) : surface.catches,
    matcherFor: surface === undefined ? () => undefined : surface.matcherFor,
    registrationsFor: surface === undefined ? () => [] : surface.registrationsFor,
    hasCatch: surface === undefined ? () => false : surface.hasCatch,
    // Source `tGe`'s record: a press names the handle the drawing held, and runs the module's own
    // press in process (there is no worker to cross). A release has no environment to tell, since
    // this product's module holds no handles of its own.
    press: (handle: number, argument: unknown) => module.press?.(handle, argument),
    releasePresses: () => {},
    // A module that provides streams carries its own `streamLinks` into the record, which is where
    // the copied `_o` looks for it. Without it the module is collected as a hop instead.
    ...(module.streamLinks !== undefined && { streamLinks: (input: ChainStreamLinksInput) => module.streamLinks?.(input) ?? [] }),
    ...(surface?.patterns !== undefined && { patterns: surface.patterns }),
    // The record a plain module contributes: no link, so `rt` builds it through `tt`, and a hop key
    // whose dispatch is answered in process rather than by a worker. `nextDispatchId` is the
    // per-record dispatch counter the copied `Q` stamps onto a dispatch payload, and `replaced` is
    // absent: a worker that has not stopped has no replacement to ask.
    hopKey: {
      key: `hooks.${module.name}`,
      kind: 'worker',
      isDeclared: () => true,
      nextDispatchId: (() => {
        let id = 0;
        return () => ++id;
      })(),
      dispatch,
    },
  };
}
