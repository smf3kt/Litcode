// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The toast module's remaining verbs (W45-33): the four public calls beside the stack W45-32
// ported. Every free name they read is already ported — `bu`, `cI`, `bh`, `MF` (W45-32) and the
// toast clock accessor `TC` — which the closure check recorded in the package's evidence.
import { MF, TC, bh, bu, cI } from './plugin-chain-notify-stack-source.js';

// chunk-24k7d6mw.js declares IEe, dismissToast: drop the id from the stack, remember it in cI so it is not reported undrawn, and write [172257,172364) 107 units sha256 459de8299ddad1fff7b7f5e2808f13c2cd2648dcc76cbb5ee1e72ee04462566b
function IEe(h,T=Date.now){let M=bu(),L=M.filter((ee)=>ee.id!==h);if(L.length!==M.length)cI.add(h),bh(L,T)}

// chunk-24k7d6mw.js declares pvt, expireToasts: fold the stack now and write it [172364,172396) 32 units sha256 46f4b7d7ef03b1b055ce8d3d3065f79c85f31d2cf10d8f7b5d72049d76b2c745
var pvt=(h)=>bh(MF(bu(),h()),h);

// chunk-24k7d6mw.js declares dV, holdToast: hold the entry (phase shown, heldAt stamped) or release it (drop heldAt, add the held time to leavesAt), writing only when something changed [172396,172675) 279 units sha256 6dc9df040101b6bad182a0d2200ae5ac991663c86da793fa5e5bf330a87a0ab8
function dV(h,T=Date.now){let M=T(),L=bu(),ee=L.map((we)=>{if(we.id!==h.id||we.heldAt!==void 0===h.isHeld)return we;if(h.isHeld)return{...we,phase:"shown",heldAt:M};let{heldAt:Me,...Le}=we;return{...Le,leavesAt:we.leavesAt+(M-(Me??M))}});if(ee.some((we,Te)=>we!==L[Te]))bh(ee,T)}

// chunk-24k7d6mw.js declares bee, pauseToasts: flip the clock's pausedAt and shift every deadline (and heldAt) by the time that passed while paused [172675,172938) 263 units sha256 8950c1c9e91fd77a9c153326b5e30677a471e071dd2fd67326c55b441be0f059
function bee(h,T=Date.now){let M=TC(),{pausedAt:L}=M;if(h.isPaused===(L!==void 0))return;let ee=T();M.pausedAt=h.isPaused?ee:void 0;let he=ee-(L??ee);bh(he===0?bu():bu().map((Te)=>({...Te,leavesAt:Te.leavesAt+he,...Te.heldAt!==void 0&&{heldAt:Te.heldAt+he}})),T)}


export { IEe, pvt, dV, bee };
