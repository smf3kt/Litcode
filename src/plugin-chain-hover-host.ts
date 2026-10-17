// The host seam the hover-group bodies read (W45-83). The copied bodies live in
// ./plugin-chain-hover-source.ts; this module supplies the one host binding they ask for.
//
//   · `PU` — the store scheduler context `Re` reads. The source declares it in chunk-jne9dpdc.js
//     (`var PU=qt(null),JDr={deferred:(e)=>e(),paced:(e)=>e,flush:()=>{},isDeferring:()=>!1}`), and
//     `Re` (chunk-5b7mmg84.js) subscribes through `n?.paced(t.subscribe) ?? t.subscribe`. With no
//     provider the source subscribes directly, which is the default here: a host that batches store
//     updates mounts a scheduler under this context.
import { qt } from './plugin-chain-react-hooks.js';

/** The scheduler a host may mount: `paced` wraps a store's subscribe so notifications arrive at the
 *  host's pace. The source's own default table (`JDr`) returns the subscription unchanged. */
export interface StoreScheduler {
  paced(subscribe: (onChange: () => void) => () => void): (onChange: () => void) => () => void;
}

/** Source `PU` (chunk-jne9dpdc.js `var PU=qt(null)`): the store scheduler context. */
export const PU = qt<StoreScheduler | null>(null);
