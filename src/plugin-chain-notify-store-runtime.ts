// The three things the store's write path takes from its environment (W45-29). Each is a binding with
// the source it stands for recorded, because the source body is either not obtainable in this product
// or belongs to a subsystem ported elsewhere.
//
// `ls` — the source imports Node's own AsyncLocalStorage and makes one instance for the whole bundle:
//
//   import{AsyncLocalStorage as jD}from"async_hooks";var ls=new jD;   // chunk-n3ykh62m.js [232720,…)
//
// `o5t` runs the store's write inside `ls.exit(() => …)`, outside whatever scope the caller is in.
// Binding it to a fresh instance of Node's own AsyncLocalStorage is the source's own construction; nothing
// else in this product sets a store on it, which is the same "no ambient scope" the source's exit gives.
//
// `_` and `Y` — the JSON wrappers `o5t` round-trips the value through (chunk-gyf58rwf.js):
//
//   var ih=Qs;function _(e,n,r){using s=ih`JSON.stringify(${Pe(e)})`;return JSON.stringify(e,n,r)}
//   var Y=(e,n)=>{using r=ih`JSON.parse(${Pe(e)})`;return typeof n>"u"?JSON.parse(e):JSON.parse(e,n)};
//
// Each carries one statement beyond the JSON call: an instrumentation span (`ih`, aliased from `Qs`)
// whose provider is a tracing subsystem this product does not have (no tracer, span or `Disposable`
// facility exists in src/). The span has no observable effect on the value, so the binding is the JSON
// call, copied with the same arguments, and the span is the recorded omission.
//
// `Ci` — the fold scheduler `vb` ends with — is no longer bound here. W45-30 ported it whole
// (`src/plugin-chain-notify-fold-source.ts`, chunk-n3ykh62m.js [274539,274916) with the cluster it
// drives: `Wf`/`zf`/`MAt`/`vc`/`vi`/`A_`/`Of` and the throttle), so this module re-exports that body
// and the write-side copy imports it unchanged.
import { AsyncLocalStorage } from 'node:async_hooks';

/** The source's own `new AsyncLocalStorage` instance (`ls`), the scope `o5t` exits before writing. */
export const ls = new AsyncLocalStorage();

/** Source `_`: `JSON.stringify(e,n,r)`. The instrumented span around it has no provider here. */
export function _(value: unknown, replacer?: unknown, space?: unknown): unknown {
  return JSON.stringify(value, replacer as never, space as never);
}

/** Source `Y`: `typeof n>"u" ? JSON.parse(e) : JSON.parse(e,n)`. The span is the recorded omission. */
export function Y(text: string, reviver?: unknown): unknown {
  return reviver === undefined ? JSON.parse(text) : JSON.parse(text, reviver as never);
}

/** Source `Ci`, the fold scheduler, as ported in W45-30 — the body, not a binding. */
export { Ci } from './plugin-chain-notify-fold-source.js';
