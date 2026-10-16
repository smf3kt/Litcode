// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
//   chunk-c9vsmdqj.js sha256 59124c8f7d581be40e14655f028069ec67ba561a3395db94c65ede3aee264fb5
//   chunk-3ph567jx.js sha256 281868632c24f04e8dca6677ab734f29299f78b6933693a9148d7dbaf698a11b
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// W45-30: the fold scheduler `Ci` and the cluster it drives — the readers' paces (the live/steady
// intervals `nc`/`HAt`, the throttle `ec`/`A_` over `Zl`/`P_`), the pace classifier `Of` over a
// reader's instance, the two folds' one-shot run `MAt`/`zf`, the stale/reader fan-out `vc`, the
// render-version bump `vi`/`jf`/`Rc`, and the two facades `OL`/`Ri` into the host registry.
//
// `Ge` (the batch's identity marker around a store, `function Ge(t,e){return t}`), `bs` (the tiny
// flag store behind `Ql`) and `FDn` (the frozen initial panes state) are ported verbatim so the
// copied bodies keep their own words; `it` is the host registry and `s_` is the plugin-state store
// the chain already reads.
import { it } from './plugin-chain-host.js';
import { s_ } from './plugin-chain-notify-store-source.js';

// chunk-ae84tp6z.js `Ge`, the batch's marker around a store — in the shipped bundle it is the identity function, so `Zl` is a plain `Map` and `Y4t` is `bs()` [5355,5381) 26 units sha256 19b806bd3a5d4fe86648ae7621ec8e85d8be7064bd1d0fa8af9c627de5f30f90
function Ge(t,e){return t}

// chunk-c9vsmdqj.js `bs`: the one-value flag store (`set`/`get` over a closure slot) that `Y4t` and `Ql` are built on [615,668) 53 units sha256 2ad3005c8632df99918a325c2432212c9a8d159137a3e9b8ad521d4224c17aae
function bs(){let t;return{set:(e)=>{t=e},get:()=>t}}

// chunk-3ph567jx.js `FDn`: the frozen initial panes state (`open`/`unplaced`/`asked`/`shownId`/`focusedId`/`focusRequest`/`placements`/`closing`), the value `Ri`'s disposer restores [757,941) 184 units sha256 df793d243518db1d518a65c4af88857ecf5d7376afe5bc4b1d8dc706f61af57c
var FDn=Object.freeze({open:Object.freeze([]),unplaced:Object.freeze([]),asked:Object.freeze([]),shownId:null,focusedId:null,focusRequest:null,placements:0,closing:Object.freeze([])});

// chunk-tvdq3hrk.js `Ri`: the panes store facade, `Ge(() => it().panes, …)` — what `Of` reads a reader's `requestId` against [2862,2915) 53 units sha256 efa5b9e3939e7acef9bf39a43b8a7d06195c96f9f69a492374972affc3f1cd0f
var Ri=Ge(()=>it().panes,(e)=>e().setState(()=>FDn));

// chunk-n3ykh62m.js `Y4t`: the flag store behind `Ql`, disposer `set(void 0)` [230179,230215) 36 units sha256 45f46336bcf7859686423e54a5c09dff52ea5c3caea109fb69919a3e60fac9c4
var Y4t=Ge(bs(),(e)=>e.set(void 0));

// chunk-n3ykh62m.js `Ql`: `Y4t.get() !== true` — whether the AbovePrompt reader counts as live [230215,230241) 26 units sha256 aec450b331a043b78b1fb4461b09beafc61a8cdd94546a2f581142ca2b0a90c5
var Ql=()=>Y4t.get()!==!0;

// chunk-n3ykh62m.js `Zl`: the throttle table, `Ge(new Map, clear)` — a plain Map in the bundle [230769,230803) 34 units sha256 62328bf83a0d87bf7a2b122fe6a101144ec4521f1814107c0860e0826a437e02
var Zl=Ge(new Map,(e)=>e.clear());

// chunk-n3ykh62m.js `P_` = 1000 (the throttle window) with `ec`, which stamps every reader it is given until then [230803,230873) 70 units sha256 bdb6dfa52549ba992475458cddd20e73ff97a02c2e21b6f6c3aeb756eec300ca
var P_=1000;function ec(e,n=Date.now()){for(let r of e)Zl.set(r,n+P_)}

// chunk-n3ykh62m.js `A_`: whether a reader is inside its throttle window at a given time [230873,230929) 56 units sha256 152dde7e2e8f198d3e77249da5ee60887ec90e0eccfcd9ec523ac7ac20bf55fa
function A_(e,n){let r=Zl.get(e);return r!==void 0&&n<r}

// chunk-n3ykh62m.js `nc` = 34, the live pace interval in ms [230929,230939) 10 units sha256 7aad696ed518652a4e113a01ccb1ac0fea97f111b858cb64b2212643e3d12eaf
var nc=34;

// chunk-n3ykh62m.js `Of`: a reader's pace — live only when its surface is terminal and its instance is AbovePrompt (`Ql`), PromptHint, or the pane the store shows (`Ri`) [231041,231248) 207 units sha256 3d12fd0325e6babeb40e872bcc9a5e764ea57f740454cf6779bc51ae11c194ed
function Of(e){let n=e.surface==="terminal",r=e.component==="AbovePrompt"&&Ql(),s=e.component==="PromptHint",h=e.component==="Pane"&&Ri().getState().shownId===e.requestId;return n&&(r||s||h)?"live":"steady"}

// chunk-n3ykh62m.js `OL`: the render-version store facade over the host registry [271940,271971) 31 units sha256 252d9d0f87db6c6c69f2a8fcb669ddfceacf8998ed5b162cde848b12734b0f2a
var OL=()=>it().renderVersions;

// chunk-n3ykh62m.js `HAt` = 100, the steady pace interval in ms [272717,272729) 12 units sha256 be322a16f0e4e8106111b138f0be64d887197dc0d1ac541188add0f80cd068ef
var HAt=100;

// chunk-n3ykh62m.js `Rc` = "\x00state", the render-version key suffix, with `jf` [272928,272964) 36 units sha256 bebe69d14659b4c8693784af88869b5809dd292f3be2a2fa2e652536d83ccc0c
var Rc="\x00state";var jf=(e)=>e+Rc;

// chunk-n3ykh62m.js `vi`: the bump — one running counter per store, written as `jf(key)` into every render-version key it is given [273791,273934) 143 units sha256 aab4828d8f4f2789f383bc85b9bb9b05b587ad7dde64a3ac8438cf14fa8cb342
function vi(e,n){if(e.length===0)return;n.bumps+=1;let r=n.bumps;OL().setState((s)=>{let h=new Map(s);for(let y of e)h.set(jf(y),r);return h})}

// chunk-n3ykh62m.js `vc`: fan a fold's readers out — bump their keys, then hand every instance to the stale listeners [274111,274247) 136 units sha256 f9f052c9f595d3fe5fa854096d8eea2b083e26f8e6cd3b6e897ba12d8cfdd506
function vc(e,n){if(e.size===0)return;vi([...e.keys()],n);let r=[...e.values()].map((s)=>s.instance);for(let s of n.staleListeners)s(r)}

// chunk-n3ykh62m.js `MAt`: run one fold — drop its pending timer, stamp `lastAt`, resolve the stale set to readers, clear it, fan out [274247,274483) 236 units sha256 a740374bb1740557385fbd73e4ccca883053ca0913dccedf495f3287bf018aaa
function MAt(e,n){let r=s_(),s=r.folds[e];if(s.pending!==void 0)clearTimeout(s.pending);s.pending=void 0,s.lastAt=n;let h=new Map([...s.stale].flatMap((y)=>{let b=r.readers.get(y);return b===void 0?[]:[[y,b]]}));s.stale.clear(),vc(h,r)}

// chunk-n3ykh62m.js `zf`: the timer callback, `MAt(fold, now())` [274483,274511) 28 units sha256 a80c016f74b9c5b738c19583a69555cbcbdeef83ae9220a21844de838a94e3ce
function zf(e,n){MAt(e,n())}

// chunk-n3ykh62m.js `Wf`: the two paces' intervals — steady 100ms, live 34ms [274511,274538) 27 units sha256 ee939c770e3e38e00052f29b1c2b33ddf2f3a7bf8925d98d4451ddd2576c242d
var Wf={steady:HAt,live:nc}

// chunk-n3ykh62m.js `Ci`: the door `vb` opens — each key's reader goes stale in its pace's fold (throttled readers forced to steady), then each touched fold runs at once or arms its timer for the remainder of its interval [274539,274916) 377 units sha256 34b27bfdc3cbff232d517e8110cf50c9e7c9d4c5bfb03963c1a3aeb35a510229
function Ci(e,n=Date.now){let r=s_(),s=new Set;for(let h of e){let y=r.readers.get(h);if(y!==void 0){let b=n(),R=y.plugins.some((T)=>A_(T,b))?"steady":Of(y.instance);r.folds[R].stale.add(h),s.add(R)}}for(let h of s){let y=r.folds[h];if(y.pending!==void 0)continue;let b=n(),w=Wf[h]-Math.max(0,b-y.lastAt);if(w<=0)MAt(h,b);else y.pending=setTimeout(zf,w,h,n),y.pending.unref()}}


export { Ge, bs, FDn, Ri, Y4t, Ql, Zl, P_, ec, A_, nc, Of, OL, HAt, Rc, jf, vi, vc, MAt, zf, Wf, Ci };
