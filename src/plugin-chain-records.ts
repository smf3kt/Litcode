// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-2kdsvp3x.js sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { AsyncLocalStorage as Zo } from 'async_hooks';
import { resolve as Xe, resolve as he } from 'node:path';
import { Nl, it, G, t, a, ve, sA, mU } from './plugin-chain-host.js';
import { po } from './plugin-chain-memoize-source.js';
import { $A, He, l, Ge, Ooe, Xgo, ne, tT, bs, CFe, Ka, pwr } from './plugin-chain-source.js';
import { iRe, aUn, lUn, Slt, EQt, dho, uho } from './plugin-chain-matchers.js';
import { tRe } from './plugin-chain-stream-source.js';

// chunk-2kdsvp3x.js origin chain of a record list [27458,27621) 163 units sha256 211d8584d85a32ce637c7cbbb8c5d4b9c465ff22fc93c21e95aee55a4f048b32
function se(e,r){let n=new Set;for(let s of e??[]){if(M5t(s)!==r)continue;if(typeof s==="string")return"every";n.add(s.registration)}return[...n].sort((s,i)=>s-i)}

// chunk-2kdsvp3x.js split caller/above at the last seat [27621,27720) 99 units sha256 dc3e8097f33b379abffbf409b4a0de32ecc89087109febeee0890ea1ea8390f1
function Gt(e,r){let n=e??[],s=n.length-1;return{caller:se(n.slice(s),r),above:se(n.slice(0,s),r)}}

// chunk-2kdsvp3x.js seat store [27720,27748) 28 units sha256 ff41ceeaa5d922484ff4c3ab2a486cda105772df20718e69cb7788c1aa74c744
var oOn=po(()=>new WeakMap);

// chunk-2kdsvp3x.js tier chain text of an origin list [27748,27789) 41 units sha256 50baf1542326e1b3d273791e5d72ae06e81f0d98bfa390708b3136059fb21074
var Cpr=(e)=>(e??[]).map(We).join(" > ");

// chunk-2kdsvp3x.js re-entry wrapper (lent/held seats, leftOut/told/causes) [27789,29001) 1212 units sha256 5089082677aaf01624d8339be6ab6125242f7c91feebba29d979751df5665c75
function Z(e,r,n){if(!n||n.length===0)return e;let s=oOn().get(n)??[],i=Date.now(),f=(b)=>s[b]?.isLent!==!0||s[b].isHeld===!0,{caller:m,above:d}=Gt(n.filter((b,P)=>f(P)||i<(s[P]?.until??0)),e.name),g=(b,P)=>b==="every"||b.includes(P),h=se(n.slice(0,-1).filter((b,P)=>f(P)),e.name),k=e.registrationsFor(r),w=k.filter((b)=>g(d,b)&&!g(m,b)&&e.hasCatch(b)),y=k.filter((b)=>!w.includes(b)&&(g(m,b)||g(h,b)));if(y.length===0&&w.length===0)return e;let T=`origin ${Cpr(n)}`;if(!e.hooks(r,y)){let b=m==="every"||d==="every";t(`hooks module ${e.label} ${r} skipped: re-entry (`+(b?`the plugin's own code raised it; ${T})`:`its own frame is being dispatched; ${T})`));return}let H=w.length>0,C=y.length>0;t(`hooks module ${e.label} ${r}: `+[...C?[`hooks ${y.join(", ")} left out for re-entry`]:[],...H?[`hooks ${w.join(", ")} not run for re-entry, .catch asked`]:[]].join("; ")+` (${T})`);let M=se(n.slice(0,-1).filter((b,P)=>s[P]?.isLent!==!0),e.name),S=w.filter((b)=>!g(M,b)),L=Object.fromEntries(S.map((b)=>[b,"lent"]));return{...e,leftOut:y,...H&&{told:w},...S.length>0&&{causes:L},hooks:(b,P=[])=>e.hooks(b,[...y,...P]),catches:(b,P=[],U)=>e.catches(b,[...y,...P],U),matcherFor:(b,P=[])=>e.matcherFor(b,[...y,...P])}}

// chunk-2kdsvp3x.js per-record counter store [29180,29214) 34 units sha256 04023f87676f434b4bf5d1c99f69bfd59fa033ab6833f4505b3ae8772ce65dbd
var Fe=Ge(new Map,(e)=>e.clear());

// chunk-2kdsvp3x.js re-entry counter [29248,29490) 242 units sha256 0d4f47cd39d9902149135acb417dbedf01d2b740cf6210bd56d61cf1a42ac9a9
function q(e,r,n){let s=`${e.name}#${e.environmentId} ${r}`,i=Fe.get(s)??0;if(i>=uho)return;Fe.set(s,i+1);let f=EQt(e.matcherFor(r),n);if(f===void 0)return;let m=`${s} ${f.path}`;if(Re.has(m))return;Re.add(m),Nl().log(dho(e.name,r,f),"warn")}

// chunk-2kdsvp3x.js seat gate (worker hops take the other matcher) [29490,29645) 155 units sha256 07ba95ddfc6e54d1c7f13795971a28062e77c2f6b4030ad91ac8b7efa9d0ab58
function Apr(e,r,n){let s=e.matcherFor(r),i=e.hopKey.kind==="worker";if(s===void 0)return!0;let f=iRe(r),m=i?aUn(s,n,f):Slt(s,n,f);if(!m)q(e,r,n);return m}

// chunk-2kdsvp3x.js record for a name, from the first seat on [29645,29727) 82 units sha256 8e1897eca29cce83b70868e3c96f81fffa5f0bf06a32c7c9c40d3b5d6808695b
function xe(e,r,n){let s=e.findIndex((f)=>Apr(f,r,n));return s===-1?[]:e.slice(s)}

// chunk-2kdsvp3x.js catch question for pinned keys [29727,29904) 177 units sha256 cee67c1a7ba1a2aa5137a92a93d2bd346679594418701cd9ab90d3fce12d1277
function le(e,r,n){let s=$A(n)?Object.fromEntries((Ooe(r).pinnedKeys??[]).filter((i)=>Object.hasOwn(n,i)).map((i)=>[i,n[i]])):{};return e.catches(r,void 0,(i)=>lUn(i,s,iRe(r)))}

// chunk-2kdsvp3x.js non-native record runner [33818,34569) 751 units sha256 6d6c8f1c51678b80c7c87ac528804b8cba91b8c19d4d11def0de6885317837d9
async function Rpr(e){let{event:r,e:n,call:s,signal:i,floors:f}=e,m=ke(e.members,r,n),d=m[0]?.hopKey;if(!d)return s(n,void 0,f);let g,h=(C,M,S)=>(g=s(C,M,S),g),k=Q({...e,members:m,kind:""}),w=performance.now();for(let C of m)C.enter();let y;try{y=await d.dispatch({...k,caughtBy:m.filter((C)=>le(C,r,n)).map((C)=>C.environmentId)},h,i)}catch(C){let M=await Ye({hop:e,dispatchId:k.id,members:m,error:C,called:()=>g!==void 0,beneath:(S,L,b)=>g??h(S,L,b)});if(M===void 0)throw C;y=M}finally{for(let C of m)C.leave()}let H=typeof n==="object"&&"requestId"in n&&typeof n.requestId==="string"?` key=${n.requestId}`:"";return t(`hooks module ${tCt(m)} ${r} settled in ${(performance.now()-w).toFixed(1)}ms (${d.kind} hop, next() included)${H}`),Qe(y.result)}

// chunk-2kdsvp3x.js leave/measure of a record run [34569,34712) 143 units sha256 53e927ea4e8f71bc9008bb10bc6f3bed564efcf9114f565545f8b5ebedb33fc3
function we(e,r,n){e.leave(),t(`hooks module ${e.label} ${r} settled in ${(performance.now()-n).toFixed(1)}ms (native link, next() included)`)}

// chunk-2kdsvp3x.js re-entry question of a linked record [34712,34872) 160 units sha256 04f8330a4920e9500412c37c46c8f44b94c5697dfbd4efab59876e78176da161
function be({loaded:e,event:r,origin:n},s){let i=J([e],r).length===1&&Apr(e,r,s);if(i&&n)t(`hooks module ${e.label} (native): ${r} nested in `+Cpr(n));return i}

// chunk-2kdsvp3x.js linked (native) record to handler [34872,35397) 525 units sha256 4e234a08bd7ced4c00b4e12d5e3fdca1b8e0926af4f12b9cf13a712db2fa21f8
function $o(e){let{loaded:r,event:n,origin:s}=e;if(r.link===void 0)throw new He(`${r.name}: ${n}: not a native module; it runs in a hop`);let i=r.link({event:n,leftOut:r.leftOut,told:r.told,causes:r.causes,hookOrigin:s}),f=i.catch;async function m(h){let k=performance.now();r.enter();try{return await h()}finally{we(r,n,k)}}async function d(h,k){r.enter();try{return await f?.(h,k)}finally{r.leave()}}let g=(h,k,w)=>be({loaded:r,event:n,origin:s},h)?m(()=>i.run(h,k,w)):k(h);return Do({...i,run:g,...f!==void 0&&{catch:d}})}

// chunk-2kdsvp3x.js plain loaded record to handler [36530,36977) 447 units sha256 64fa04636ea935676b84bfbdccca84dad9ff9c1d26c2b2776542d73b9431ae01
var tt=({loaded:e,event:r,origin:n,raise:s,owners:i})=>({name:e.name,tier:e.tier,...Xgo(e.args.modulePath)&&{answersForEngine:!0},run:(f,m,{call:d,floors:g,cutAt:h})=>Rpr({members:[e],event:r,e:f,call:d,signal:m.signal,hookOrigin:n,raise:s,origin:m.origin,floors:g,cutAt:h}),hop:{key:e.hopKey,run:(f)=>Rpr({members:Se(f.members,i,r),event:r,e:f.e,call:f.call,signal:f.signal,hookOrigin:n,raise:s,origin:f.origin,floors:f.floors,cutAt:f.cutAt})}});

// chunk-2kdsvp3x.js record to handler: linked or plain [36977,37034) 57 units sha256 2dd558b35ef0a65aaa3ded8dab2da154ff8465a207fed063e77331c1581f7a81
function rt(e){return e.loaded.link!==void 0?$o(e):tt(e)}

// chunk-2kdsvp3x.js plugin name of a record, seat table fallback [37034,37144) 110 units sha256 28634df61216cb887a0e3c5c5c9981e522bb23248501463e30b0b07685b94b6e
function Ee(e){let{loadedModules:r,moduleSeats:n}=it();return r.find((s)=>s.name===e)?.tier??n.get(e)??"user"}

// chunk-2kdsvp3x.js from/e seat filter [37182,37411) 229 units sha256 e2fd04b5ba9276b9720578bd7e43e984326180dc95836186a38c868802f70fa0
function kro(e,r,n){let s=e.matcherFor(r);if(s===void 0)return!0;try{if(Slt(s,n,iRe(r)))return!0}catch(i){return t(`hooks module ${e.label}: on('${r}') matcher threw on the host (${l(i)}); the hop decides`),!0}return q(e,r,n),!1}

// chunk-2kdsvp3x.js pinned-keys filter [37411,37704) 293 units sha256 75ab4e384707ea0a3d7426124176e735e75d1a509cfa17641043d35cbf13f8c4
function nt(e,r,{keys:n,e:s}){let i=e.matcherFor(r);if(i===void 0||!$A(s))return!1;try{let m=iRe(r),d=n.some((g)=>Object.hasOwn(s,g)&&!lUn(i,{[g]:s[g]},m));if(d)q(e,r,s);return d}catch(m){return t(`hooks module ${e.label}: on('${r}') matcher threw on the host (${l(m)}); the hop decides`),!1}}

// chunk-2kdsvp3x.js refusal when the hooks worker is being replaced [37996,38339) 343 units sha256 b79a4839c34bf496dda4118c4dee758126143d98895bfa9a1d939e9a453f3038
function st({event:e,e:r,origin:n,only:s}){let i=xe(jDe(e,n,{only:s}),e,r).filter((m)=>m.link===void 0&&m.hopKey.isDeclared?.(m.name)!==!1&&le(m,e,r)).map((m)=>m.name);return i.length===0?void 0:new He(`${e} refused: the hooks worker is being replaced, and a hook on it with a .catch (${i.join(", ")}) cannot be asked until the reload is in`)}

// chunk-2kdsvp3x.js async-context store [38388,38403) 15 units sha256 eb9e2020ae78fcffa194b796dd7e99bea3af8855518f35c52284b9fc5e92c296
var L5t=new Zo;

// chunk-2kdsvp3x.js store value builder [38403,38517) 114 units sha256 d057292e2a966bfa0b9110a555049db0d46fe5dfa8d023211fafeae4aec0a70a
function xpr(e,r){let n={isOver:!1},s=e.run(n,r),i=()=>{n.isOver=!0};return s.then(i,i),s}var UNs=(e)=>xpr(L5t,e);

// chunk-2kdsvp3x.js inside a run whose isOver is false [38517,38557) 40 units sha256 01204a3ce5929d37b61f7461503b21ac583c2d228307dbc4a1f2dd8d78108f64
var Aro=()=>L5t.getStore()?.isOver===!1;

// chunk-2kdsvp3x.js tier of a record [27348,27414) 66 units sha256 ebf459eec9e8822a45c40d7dfc64e2d4c948dbc661b5ab2558e873ba5556eed3
var We=(e)=>typeof e==="string"?e:`${e.plugin}#${e.registration}`;

// chunk-2kdsvp3x.js record counter of a run [29214,29248) 34 units sha256 66aeb89ba30e2a33c6f25d6a0df4ab321461dc623b131521f6899f406871ccce
var Re=Ge(new Set,(e)=>e.clear());

// chunk-2kdsvp3x.js seat chain of one record [29904,30290) 386 units sha256 c9dd0c2c4d654da00507e417fcb77e0cd8197622fc3cfe4518c356b78a30a9ae
function J(e,r){let n=[];for(let s of e){let i=s.status();if(i.kind!=="live"){let f=i.kind==="retiring"||i.kind==="unloaded"&&i.retired,m=i.kind==="unloaded";t(`hooks module ${f?`${s.label}: its environment was retired by a reload during ${r}`:m?`${s.label}: its environment was unloaded (during ${r})`:`${s.label}: ${i.reason} (during ${r})`}; passing on`);continue}n.push(s)}return n}

// chunk-2kdsvp3x.js record run state [30290,30321) 31 units sha256 18bfffd4ccfbd817bfaa93ef440bd75ddf4250a0a1318454b8fe69793ebc7e83
var ke=(e,r,n)=>xe(J(e,r),r,n);

// chunk-2kdsvp3x.js hop key of a record [31234,31278) 44 units sha256 aa8bf5e4a53fdc7cd8ad66352e847982ac81f00fee81e8a7d26b5f7ecdab0c9f
var tCt=(e)=>e.map((r)=>r.label).join(", ");

// chunk-2kdsvp3x.js record run (engine side) [31395,31950) 555 units sha256 de707b5ded94092e243fdb75d4616dfdb11a28dae033687b41c3cd10e1af7fe3
function Q({members:e,event:r,e:n,hookOrigin:s,origin:i,raise:f,floors:m,cutAt:d,kind:g}){let[h]=e;if(s)t(`hooks module ${tCt(e)}: ${r}${g} nested in ${Cpr(s)}`);let k=e.flatMap((w)=>{let y=[...w.leftOut??[]],{environmentId:T,told:H,causes:C}=w;return y.length>0||H!==void 0?[{environmentId:T,registrations:y,...H&&{told:[...H]},...C&&{causes:{...C}}}]:[]});return{id:h?h.hopKey.nextDispatchId():0,event:r,payload:n,environments:e.map((w)=>w.environmentId),leftOut:k.length===0?void 0:k,origin:i,hookOrigin:s,raise:f,floors:m.length===0?void 0:m,cutAt:d}}

// chunk-2kdsvp3x.js record run (plain side) [32505,33818) 1313 units sha256 42dace51674f37da08958149089a637c7fbefe9f0c8a23cfd66a4053cf38f9c1
async function Ye({hop:e,dispatchId:r,members:n,error:s,called:i,beneath:f}){let{event:m,e:d,signal:g}=e,h=(H)=>H.filter((C)=>le(C,m,d)),k=l(s),w=_e(h(n),k),y=w[0]?.hopKey,T=y?.kept;while(w.length>0&&!g.aborted){let H=h(J(await Je({...e,members:w}),m)),C=H[0]?.hopKey,M=H.find((S)=>S.name===T?.plugin);if(C===void 0||g.aborted)break;t(`hooks module ${tCt(H)}: .catch asked in the replacement after the hooks worker ended during ${m}`);for(let S of H)S.enter();try{let S=await C.dispatch({...Q({...e,members:H,kind:""}),ended:{reason:k,called:i(),...M!==void 0&&{kept:M.environmentId}}},f,g),L=M!==void 0&&T!==void 0&&y?.isKeptVerdict?.(r,S.unmatched!==!0)===!0;for(let b of H)if(S.answered?.includes(b.environmentId)===!0)zz(b.name,`the hooks worker was replaced during ${m}; ${b.name}'s .catch answered in place of its hook`);if(L)C.unloadCrashed?.(M.environmentId,T);return S}catch(S){k=l(S),w=_e(H,k),t(`hooks module ${tCt(H)}: .catch not heard after the hooks worker ended during ${m}: ${k}`+(w.length>0?"; asked again of whoever stands":""),{level:"error"})}finally{for(let S of H)S.leave()}}if(w.length>0)t(`hooks module ${tCt(w)}: no .catch is asked after the hooks worker ended during ${m}: `+(g.aborted?"its caller is gone":"no replacement that may be waited for holds its hook"),{level:"error"});return}

// chunk-2kdsvp3x.js record link table [36398,36530) 132 units sha256 83711b6a4e4162dac7481effffe27a3ffdcfb26bdc22afb026909d8bf2fb8708
var Se=(e,r,n)=>e.map((s)=>{let i=r.get(s);if(i===void 0)throw new He(`${n}: a hop member is not one of these handlers`);return i});

// chunk-2kdsvp3x.js cut marker [39281,39295) 14 units sha256 49fc71c9cf6ef3389f0254c75aa51b795dda4cdc708eda3ebb55a4dd7cc15f47
var Qe=(e)=>e;

// chunk-2kdsvp3x.js duration text [39295,39309) 14 units sha256 f44b4117e4b432a2ee809bf8cea3ca1bed33098bc84ccef3a29b0d8974b9b824
var Do=(e)=>e;

// chunk-2kdsvp3x.js record run state helper [30930,31024) 94 units sha256 94a6e22dcb162963122d748250779f2fa3e84876ee797aa5319d0e76a5be31ea
function zz(e,r,n="again"){if(aCe()){mce(e,ne(r,tT),n);return}t(`${e}: ${r}`,{level:"error"})}

// chunk-2kdsvp3x.js record run state table [31024,31109) 85 units sha256 77409b04a4a14f42d3c3a80c48c02f9c9c883f5d78fc0aed51c19016f3f1d52c
var _e=(e,r)=>e.filter((n)=>{let s=n.status();return s.kind==="dead"&&s.reason===r});

// chunk-2kdsvp3x.js record run (hop side) [31950,32505) 555 units sha256 745ce54138e7a33e32ae644bce26029b4160d52736f236c7c7599803d3f3bc71
async function Je({members:e,event:r,hookOrigin:n,signal:s}){let i=e.find((f)=>f.status().kind==="dead")?.hopKey.replaced?.();if(i===void 0)return e;return t(`hooks module ${e.map((f)=>f.label).join(", ")}: ${r} waits for the hooks worker's replacement`),await new Promise((f)=>{s.addEventListener("abort",()=>f(),{once:!0}),i.then(f,f)}),e.flatMap((f)=>{let m=it().loadedModules.find((h)=>h.name===f.name);if(!(f.status().kind!=="live"&&m!==void 0&&m.environmentId!==f.environmentId))return[f];let g=m.hooks(r)?Z(m,r,n):void 0;return g===void 0?[]:[g]})}

// chunk-2kdsvp3x.js watched plugin dirs holder [26970,27006) 36 units sha256 eee239e389dd0ae8a24ba209d4433e053ce8f958bcba5182f0e7250c5802b30f
var zne=Ge(bs(),(e)=>e.set(void 0));

// chunk-2kdsvp3x.js configured plugin seats [27042,27198) 156 units sha256 a497de8b17a0b8c4e5ed104f5e8623cf80e5678664959db7e53cbffab02e79e1
function Epr(e){let r=new Set((zne.get()??[]).map((s)=>he(s))),n=new Set((eCt.get()??[]).map((s)=>he(s)));return e.filter((s)=>r.has(he(s))||!n.has(he(s)))}

// chunk-2kdsvp3x.js whether the plugin dir is watched [30321,30381) 60 units sha256 12ba3b9ff6e3c1ad4791ca3cf5410d5272638748bded2f351c14ef90f725e275
function Ero(){return a.CLAUDE_CODE_PLUGIN_DIR_WATCH??!ve()}

// chunk-2kdsvp3x.js seat list for the current project [30413,30573) 160 units sha256 ce5ff2a343ef991eeb65e74b20f5b9038b04e019f2f8d3a2c64ea64c50572a93
function vpr(e){if(Ero())return Epr(e);let r=new Set((zne.get()??[]).map((s)=>Xe(s)));return a.CLAUDE_CODE_PLUGIN_DIR_WATCH===!1?[]:e.filter((s)=>r.has(Xe(s)))}

// chunk-2kdsvp3x.js every plugin source [30573,30603) 30 units sha256 6e4588171b3f6f844aa47f91c493c0994c5d61389a9605271a47364c8940dc42
var kpr=()=>[...sA(),...mU()];

// chunk-2kdsvp3x.js whether a seat chain is raised [30603,30635) 32 units sha256 0ba5aee965d4534ee12cea0327df4f6a2322aa5a1b42678a29f8413bd776228d
var aCe=()=>vpr(kpr()).length>0;

// chunk-2kdsvp3x.js seat list cache age [30635,30647) 12 units sha256 1e1ec5da84d8fdf99972b8d40da8098006a52f96c59665b93075b33560987824
var rOn=1e4;

// chunk-2kdsvp3x.js log line trimming [30647,30707) 60 units sha256 916ae4665f6fdf0616b0dd51c87e4b118a4011629480536d5accfe45299efa61
function BDe(e){return e.length<=rOn?e:`${ne(e,rOn)}\u2026`}

// chunk-2kdsvp3x.js module log throttle [30707,30718) 11 units sha256 959a5617bcf6e3ffa21cc5466a3c94587b31fbaf80ad6a23443186e75c4d3e0b
var Ze=100;

// chunk-2kdsvp3x.js module log line [30718,30930) 212 units sha256 0b56afa637faea50226e9a7da2fa1cdd46e3e05cd29f6a79838c309c06e6a427
function mce(e,r,n="again"){let s=BDe(r),i=it();if(t(`[${e}] $.ui.log: ${s}`),i.uiLogSink){i.uiLogSink({plugin:e,text:s},n);return}if(i.pendingUiLog.length<Ze)i.pendingUiLog=[...i.pendingUiLog,{plugin:e,text:s}]}

// chunk-2kdsvp3x.js hooks respawn hop [38557,38835) 278 units sha256 5c4d16200dc29bb16c1b77a11c1ecfdc1527a36e53f5d7b5c6614de920433c05
function iOn(e,r){let n=[...it().hooksRespawns],s=n.length>0&&Aro(),i=s?st(e):void 0;if(i!==void 0)return t(i.message,{level:"error"}),Promise.reject(i);if(n.length===0||s)return;let f=Promise.all(n).then(()=>{return});return(r!==void 0?Ka(f,r,()=>pwr(r)):f).then(()=>iOn(e,r))}

// chunk-2kdsvp3x.js handler collection [39124,39281) 157 units sha256 5836a7e79a4a0e14764e9936bfd21b8d40efaa0ce35efbda5a2a9f3ec7056b51
function P0(e,r,n={}){let s=[],i=new Map;for(let f of jDe(e,r,n)){let m=rt({loaded:f,event:e,origin:r,raise:n.raise,owners:i});i.set(m,f),s.push(m)}return s}

// chunk-2kdsvp3x.js pinned/only filter [37704,37996) 292 units sha256 50239f52372bdd9e60abcb82ae9f7863152c8fbdfac2516cd6856413fadedab0
function jDe(e,r,{only:n,e:s,among:i,pinned:f}={}){let m=(i??it().loadedModules).flatMap((g)=>{if(!g.hooks(e)||g.name!==(n??g.name))return[];let h=Z(g,e,r);return h===void 0||f!==void 0&&nt(h,e,f)?[]:[h]});if(s===void 0)return m;let d=m.findIndex((g)=>kro(g,e,s));return d===-1?[]:m.slice(d)}

// chunk-2kdsvp3x.js origin descriptor [39328,39441) 113 units sha256 3958612d435bbd30998eaedd172346e1f4ba6031a68337a13d9f1c2195d7551b
function aJ(e){let r=e?.at(-1);if(r===void 0)return CFe;let n=M5t(r);return Object.freeze({plugin:n,tier:Ee(n)})}

// chunk-2kdsvp3x.js plugin name of a record [27414,27458) 44 units sha256 a938b8e845ad1f587dac28ab70f816eb9f68117b38f87b3267c8661b6ee357ad
var M5t=(e)=>typeof e==="string"?e:e.plugin;

// chunk-2kdsvp3x.js config plugin dirs holder [27006,27042) 36 units sha256 17ae28bfc844bd62ea44ebdc12f4b8def5b0c4eafc60cc10cab5cd95ab09edd3
var eCt=Ge(bs(),(e)=>e.set(void 0));

// chunk-2kdsvp3x.js declares et, the streaming hop dispatch [35397,35875) 478 units sha256 371e29fcf866a42ebcea16c577970263bab6e301a2b1bd0bafe21072b5f7f538
function et(e){let{event:r,e:n,open:s,signal:i,floors:f}=e,m=ke(e.members,r,n),d=m[0]?.hopKey;if(!d)return s(n,void 0,f);let g=(w,y,T)=>tRe(s(w,y,T)),h=performance.now();for(let w of m)w.enter();let k=d.dispatchStream(Q({...e,members:m,kind:" stream"}),g,i);return async function*(){try{let w=yield*tRe(k);return Qe(w)}finally{for(let w of m)w.leave();t(`hooks module ${tCt(m)} ${r} stream settled in ${(performance.now()-h).toFixed(1)}ms (${d.kind} hop, next() included)`)}}()}

// chunk-2kdsvp3x.js declares _o, the streaming record builder (the twin of rt) [35875,36398) 523 units sha256 0fc57c6f202a90532529efbd39d7a672246dd534f248fa2f54e226324fd3944b
function _o(e){let{loaded:r,event:n,origin:s}=e;if(r.streamLinks===void 0)throw new He(`${r.name}: ${n}: not a native module; it runs in a hop`);function i(f){let m=performance.now();return r.enter(),async function*(){try{return yield*f}finally{we(r,n,m)}}()}return r.streamLinks({event:n,leftOut:r.leftOut,told:r.told,causes:r.causes,hookOrigin:s}).map((f)=>{let m=f.catch;return{...f,run:async(d,g,h)=>be({loaded:r,event:n,origin:s},d)?i(await f.run(d,g,h)):g(d),...m!==void 0&&{catch:async(d,g,h)=>i(await m(d,g,h))}}})}

// chunk-2kdsvp3x.js declares ft, the streamLinks branch [39309,39328) 19 units sha256 9018c9d9f0798aa03787f226cd3c2c41779eb233b89657d901c13f3762620639
var ft=(e)=>[...e];

// chunk-2kdsvp3x.js declares ct and has, the streaming handler and its collector [39563,40188) 625 units sha256 816665a9a36fff1de4800ae4d74a173b2c31aa66e0c026b14344d45836eb3df5
var ct=(e,r)=>({name:e.loaded.name,tier:e.loaded.tier,run:(n,s,{open:i,floors:f})=>et({members:[e.loaded],event:e.event,e:n,open:i,signal:s.signal,hookOrigin:e.origin,raise:e.raise,origin:s.origin,floors:f}),hop:{key:e.loaded.hopKey,run:({members:n,e:s,open:i,signal:f,origin:m,floors:d})=>et({members:Se(n,r,e.event),event:e.event,e:s,open:i,signal:f,hookOrigin:e.origin,raise:e.raise,origin:m,floors:d})}});function has(e,r,n={}){let s=new Map;return jDe(e,r,n).flatMap((i)=>{if(i.streamLinks!==void 0)return ft(_o({loaded:i,event:e,origin:r}));let f=ct({loaded:i,event:e,origin:r,raise:n.raise},s);return s.set(f,i),[f]})}


export { se, Gt, oOn, Cpr, Z, Fe, q, Apr, xe, le, Rpr, we, be, $o, tt, rt, Ee, kro, nt, st, L5t, xpr, Aro, We, Re, J, ke, tCt, Q, Ye, Se, Qe, Do, Je, _e, zz, vpr, kpr, aCe, rOn, BDe, Ze, mce, Ero, Epr, zne, iOn, P0, jDe, aJ, M5t, eCt, et, _o, ft, ct, has };
