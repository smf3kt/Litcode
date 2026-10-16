// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-356hrhz3.js sha256 0c821efb255e53af566480e6263c87c8be068ed1a7dae3205b2964f0f0c9076a
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// W45-31: the notification bar's clock driver `TK` — the tick a surface runs on its own clock: split
// the store's toast queue, tick the stored ledger against it, write the ledger back, report the time
// the bar lost, refresh the queue's texts, and arm the next tick for the delay `dLs` gives.
//
// `Cj` (chunk-356hrhz3.js) is the hidden test the split takes: the bar counts as hidden while a diff
// panel is visible or the pane holds toasts. Every other name is a body ported earlier — the ledger
// core (W45-27), the stored read (W45-28) and write (W45-29) and the toast split with its default
// timeout (W45-26).
import { aLs, cLs, dLs, pLs, uLs } from './plugin-chain-notify-source.js';
import { SEt } from './plugin-chain-notify-store-source.js';
import { xYr } from './plugin-chain-notify-write-source.js';
import { sLs, Sqt } from './plugin-chain-toast-source.js';

// chunk-356hrhz3.js `Cj`: whether the bar counts as hidden — `diffPanelVisible || paneHoldsToasts`, the second argument `sLs` takes [1299,1359) 60 units sha256 99f3a86bcad3d650f41c04b113d1602af2bd7f4e9068e561c4d2d6fbfce0debf
function Cj(o){return o.diffPanelVisible||o.paneHoldsToasts}

// chunk-24k7d6mw.js `TK`: the clock driver — `{clock, store, pending, last}` in, one tick out: `sLs(notifications, Cj(state), Sqt)` then `aLs(cLs(last.current, SEt()), split, clock.now())`; cancel the pending timer, write the ledger (`xYr`), remember it, report `lost` (`uLs`), refresh the queue's texts (`pLs`) through `store.setState`, and arm the next tick at `dLs`-derived delays through `clock.setTimeout`, keeping only the first canceller [478764,479204) 440 units sha256 b6947ba89bc38ded7d305ccfdd3d79a28c66c32c41dcfde9c32d1bb4f8613d92
function TK(h){let{clock:T,store:M,pending:L,last:ee}=h,he=sLs(M.getState().notifications,Cj(M.getState()),Sqt),we=aLs(cLs(ee.current,SEt()),he,T.now());L.current?.(),xYr(we.ledger),ee.current=we.ledger,we.lost.forEach(uLs),M.setState((Te)=>{let Me=pLs(Te.notifications,we.texts);return Me===Te.notifications?Te:{...Te,notifications:Me}}),L.current=[dLs(we.ledger)].flatMap((Te)=>Te??[]).map((Te)=>T.setTimeout(()=>TK(h),Te-T.now())).at(0)}


export { Cj, TK };
