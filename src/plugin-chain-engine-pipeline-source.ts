// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import './plugin-chain-engine-render-site.js';
import { ilt } from './plugin-chain-engine-render-site.js';
import { MF, SVe, Ioe, s_, renderEventName as vA } from './plugin-chain-render-keys.js';
import { kFe } from './plugin-chain-leaf-walkers.js';
import { ls } from './plugin-chain-host-call-source.js';
import { OL, jf } from './plugin-chain-notify-fold-source.js';
import { aP } from './plugin-chain-source.js';
import { P0, aJ } from './plugin-chain-records.js';
import { bVe, Lur, Vss, cce, CK } from './plugin-chain-terminal.js';
import { t, zd } from './plugin-chain-host.js';
import { Nss, qss, Bss, Uss, Wss, Gss, zss, JAe } from './plugin-chain-engine-budget-source.js';
import { nIn, dno, kur, vur } from './plugin-chain-engine-draw-source.js';
import { validateDrawnTree as Eur, DIALOG_COMPONENT as B3e } from './plugin-chain-engine-validate.js';
import { AK, vAt, XPt, FM, BM } from './plugin-chain-press.js';
import { Ci } from './plugin-chain-notify-store-runtime.js';
import { RFe } from './plugin-chain-tool-raise-source.js';
import { sIt, Ge } from './plugin-chain-source.js';
import { Oe } from './plugin-chain-registry-stores-source.js';
import { aCe } from './plugin-chain-records.js';

// chunk-n3ykh62m.js the ui.render engine pipeline [283212,284410) 1198 units sha256 5a6860301a5d71f6be05e58489f99955dbcf0b0c88823128a6c68cfd3a0d8c39
async function gno({input:e,signal:n,origin:r}){let s=RFe(),h=(re)=>Gss({input:e,clipped:re,origin:r}),y=Pto(s,(re)=>zss(re,e,{cut:h,own:(te)=>Wss({input:e,names:te,origin:r})})),b=sIt()?[]:[y],w=HD(MF(e),e,()=>SVe(e)),R=Mf({drawing:w}),T=[],P=await ls.run(R,()=>aP({e,handlers:[...P0(vA,r,{e}),...b],site:Ito,signal:n,origin:aJ(r),trace:(re)=>{T=re}})).finally(()=>{w.isInFlight=!1,R.isEnded=!0,R.values=void 0});if(e.requestId!==""&&!n.aborted)Pb(w);let z=ilt(P),N=e.component===B3e,V=0,X=Eur(z,e.component,{surface:e.surface,note:(re)=>t(`ui.render (${e.component}): ${cce(re)}`),...N&&{clientRows:(re)=>{let te=AAt.clientRows({requestId:e.requestId,plugin:re.client.plugin,key:re.props.key});return V+=te,te},measured:(re)=>AAt.recordOwn(e.requestId,re-V)}});if(X!==void 0)return t(`ui.render (${e.component}): a hook returned a tree that does not validate (${cce(X)}); drawing the engine's own`,{level:"warn"}),jss({input:e,problem:X,origin:r}),BM(z,e),Ioe;let Z=nIn(dno(z),(re)=>qss({input:e,style:re,origin:r})),ee=kur(Z,e.surface,(re)=>Bss({input:e,drawnPlain:re,origin:r})),le=vur(Nss(ee,h),(re)=>Uss({input:e,drawnPlain:re,origin:r}));return FM(z,le,e),bVe.set(le,s),Lur.set(s,Vss(T)),le}

// chunk-n3ykh62m.js the core handler that wraps the drawing function [231570,231688) 118 units sha256 9148ef4ad13115b063ca4a5302f5388699a2a1af7869783ecdc4ad242563c624
var Pto=(e,n)=>({name:"core",isCore:!0,budgetMs:0,run:(r)=>Promise.resolve({type:"engine",ref:e.keep(n(r),void 0)})});

// chunk-n3ykh62m.js the row metrics store [232412,232444) 32 units sha256 64609968523e95288051e0e812b098d3551e559b2f16d611fa6ae6ec9758630b
var AAt=Ge(M_(),(e)=>e.clear());

// chunk-n3ykh62m.js the drawing instance [232444,232604) 160 units sha256 7cd272b2fb6c9925fa419e4b7f6146b50ee72a251eac13124af23cbdd1a4de20
var HD=(e,{surface:n,component:r,requestId:s},h)=>({instanceKey:e,instance:{surface:n,component:r,requestId:s},pluginsOf:h,isInFlight:!0,versionsRead:new Map});

// chunk-n3ykh62m.js the dispatch lifecycle [232817,232852) 35 units sha256 3249b75c8e74c8a34e8c88c451992586108c047e98a594e3a2b666d653ff69e3
var Mf=(e={})=>({...e,isEnded:!1});

// chunk-n3ykh62m.js the ui.render site [232979,233003) 24 units sha256 439adff18e5d0f6701792b94fd409db834560bccdb7a2c825a56fae2f3a3ad0b
var Ito=zd["ui.render"];

// chunk-n3ykh62m.js flush the drawing's version reads [276273,276688) 415 units sha256 da63323c8e974d83da64db775058c15ab937520dbf78cb485b83d66b5467c92e
function Pb(e){let{instanceKey:n,instance:r,versionsRead:s}=e,h=s_();if(Ai(n),s.size===0)return;h.readers.set(n,{instance:r,plugins:e.pluginsOf(),reads:new Set(s.keys())});let y=h.values.getState(),b=!1;for(let[w,R]of s){let T=h.readersOf.get(w)??new Set;T.add(n),h.readersOf.set(w,T),b||=(y.get(w)?.version??0)!==R}for(let w of h.readers.keys()){if(h.readers.size<=Xf)break;if(!h.mounted.has(w))Yf(w)}if(b)Ci([n])}

// chunk-n3ykh62m.js note an invalid tree [279923,280080) 157 units sha256 25fde3e1ece864bc1c4df26c802ab2bd82210077426a29d57a73cb1fb46d1685
function jss({input:e,problem:n,origin:r}){if(!aCe())return;let{load:s,lead:h}=JAe(e,r);CK({key:[s,e.component,n].join(" "),lead:h,text:uno(e.component,n)})}

// chunk-n3ykh62m.js the row metrics store body [231733,232412) 679 units sha256 d4cb80d6cefd3538cbd98e6bec84291393da03ecc6b4ef74cedc818ed693ecc8
function M_(){let e=new Map,n=Oe();function r(h){let y=e.get(h),b=y??{own:0,clients:new Map};if(y===void 0){e.set(h,b);for(let w of e.keys()){if(e.size<=I_)break;e.delete(w)}}return b}function s(h,y,b){if(b<y)n.emit(h)}return{clientRows:(h)=>e.get(h.requestId)?.clients.get(ki(h))??1,recordOwn:(h,y)=>{let b=r(h),w=b.own;b.own=y,s(h,w,y)},fits:(h,y)=>{let b=r(h.requestId),w=ki(h),R=b.own+y;for(let[T,P]of b.clients)R+=T===w?0:P;return R<=kFe},recordClient:(h,y)=>{let{clients:b}=r(h.requestId),w=ki(h),R=b.get(w)??0;b.set(w,y),s(h.requestId,R,y)},dropClient:(h)=>{if(e.get(h.requestId)?.clients.delete(ki(h))===!0)n.emit(h.requestId)},onFreed:n.subscribe,clear:()=>{e.clear()}}}

// chunk-n3ykh62m.js client row key [231688,231723) 35 units sha256 fcfa7b7e90eb64b20819167cf2ba3c8988b2fc81b62840adfba7bff1eae8ff92
var ki=(e)=>`${e.plugin} ${e.key}`;

// chunk-n3ykh62m.js request entry cap [231723,231733) 10 units sha256 96dcf27cee2eb0bea5e9dd55448087b5d4d3e53654cd01e58ac2fd75a6e1e443
var I_=64;

// chunk-n3ykh62m.js detach an instance's readers [275983,276166) 183 units sha256 33a408b32f14d392dae0a55db976ed99cf098d8a7707a543190e8e0c702f35de
function Ai(e){let n=s_(),r=n.readers.get(e);if(r===void 0)return;for(let s of r.reads){let h=n.readersOf.get(s);if(h?.delete(e),h?.size===0)n.readersOf.delete(s)}n.readers.delete(e)}

// chunk-n3ykh62m.js drop an unmounted instance [276166,276261) 95 units sha256 389f65a05d064d79d57cf493848173c69b35f7f4a060eeeceaa69e56fe99a132
function Yf(e){let{folds:n}=s_();Ai(e),n.steady.stale.delete(e),n.live.stale.delete(e),Gf([e])}

// chunk-n3ykh62m.js reader count cap [276261,276273) 12 units sha256 160c6afe4029598cfee60e20f4197058a6cec503cb8b1cbb0ac90ba11e2033ab
var Xf=4000;

// chunk-n3ykh62m.js reset the instance's version reads [273149,273315) 166 units sha256 a458f981fef6959dd821c3672a51a5ea0d88be58a2493e8c6373e0f3a6ac34e5
function Gf(e){let n=OL(),r=e.map(jf).filter((s)=>n.getState().has(s));if(r.length===0)return;n.setState((s)=>{let h=new Map(s);for(let y of r)h.delete(y);return h})}

// chunk-n3ykh62m.js invalid tree problem text [279850,279923) 73 units sha256 e609b4c8cada1408a8a019345cf2e180d0372487635816fab5a7e7a1b4f70acf
var uno=(e,n)=>`ui.render (${e}) refused: ${n}; the engine drew its own`;


export { gno, Pto, AAt, HD, Mf, Ito, Pb, jss, M_, ki, I_, Ai, Yf, Gf, Xf, uno };
