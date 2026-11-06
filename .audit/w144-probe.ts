// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-n3ykh62m.js gno [283212,284410) 1198 units sha256 5a6860301a5d71f6be05e58489f99955dbcf0b0c88823128a6c68cfd3a0d8c39
async function gno({input:e,signal:n,origin:r}){let s=RFe(),h=(re)=>Gss({input:e,clipped:re,origin:r}),y=Pto(s,(re)=>zss(re,e,{cut:h,own:(te)=>Wss({input:e,names:te,origin:r})})),b=sIt()?[]:[y],w=HD(MF(e),e,()=>SVe(e)),R=Mf({drawing:w}),T=[],P=await ls.run(R,()=>aP({e,handlers:[...P0(vA,r,{e}),...b],site:Ito,signal:n,origin:aJ(r),trace:(re)=>{T=re}})).finally(()=>{w.isInFlight=!1,R.isEnded=!0,R.values=void 0});if(e.requestId!==""&&!n.aborted)Pb(w);let z=ilt(P),N=e.component===B3e,V=0,X=Eur(z,e.component,{surface:e.surface,note:(re)=>t(`ui.render (${e.component}): ${cce(re)}`),...N&&{clientRows:(re)=>{let te=AAt.clientRows({requestId:e.requestId,plugin:re.client.plugin,key:re.props.key});return V+=te,te},measured:(re)=>AAt.recordOwn(e.requestId,re-V)}});if(X!==void 0)return t(`ui.render (${e.component}): a hook returned a tree that does not validate (${cce(X)}); drawing the engine's own`,{level:"warn"}),jss({input:e,problem:X,origin:r}),BM(z,e),Ioe;let Z=nIn(dno(z),(re)=>qss({input:e,style:re,origin:r})),ee=kur(Z,e.surface,(re)=>Bss({input:e,drawnPlain:re,origin:r})),le=vur(Nss(ee,h),(re)=>Uss({input:e,drawnPlain:re,origin:r}));return FM(z,le,e),bVe.set(le,s),Lur.set(s,Vss(T)),le}

// chunk-n3ykh62m.js core handler [231570,231688) 118 units sha256 9148ef4ad13115b063ca4a5302f5388699a2a1af7869783ecdc4ad242563c624
var Pto=(e,n)=>({name:"core",isCore:!0,budgetMs:0,run:(r)=>Promise.resolve({type:"engine",ref:e.keep(n(r),void 0)})});

// chunk-n3ykh62m.js metrics [232412,232444) 32 units sha256 64609968523e95288051e0e812b098d3551e559b2f16d611fa6ae6ec9758630b
var AAt=Ge(M_(),(e)=>e.clear());

// chunk-n3ykh62m.js draw instance [232444,232604) 160 units sha256 7cd272b2fb6c9925fa419e4b7f6146b50ee72a251eac13124af23cbdd1a4de20
var HD=(e,{surface:n,component:r,requestId:s},h)=>({instanceKey:e,instance:{surface:n,component:r,requestId:s},pluginsOf:h,isInFlight:!0,versionsRead:new Map});

// chunk-n3ykh62m.js scheduler [232741,232755) 14 units sha256 ae6915b933d0aeefb26ff4d3366cb73cb24b2d7e1756d40ab89c9965507a3d98
var ls=new jD;

// chunk-n3ykh62m.js lifecycle [232817,232852) 35 units sha256 3249b75c8e74c8a34e8c88c451992586108c047e98a594e3a2b666d653ff69e3
var Mf=(e={})=>({...e,isEnded:!1});

// chunk-n3ykh62m.js site [232979,233003) 24 units sha256 439adff18e5d0f6701792b94fd409db834560bccdb7a2c825a56fae2f3a3ad0b
var Ito=zd["ui.render"];

// chunk-n3ykh62m.js flush [276273,276688) 415 units sha256 da63323c8e974d83da64db775058c15ab937520dbf78cb485b83d66b5467c92e
function Pb(e){let{instanceKey:n,instance:r,versionsRead:s}=e,h=s_();if(Ai(n),s.size===0)return;h.readers.set(n,{instance:r,plugins:e.pluginsOf(),reads:new Set(s.keys())});let y=h.values.getState(),b=!1;for(let[w,R]of s){let T=h.readersOf.get(w)??new Set;T.add(n),h.readersOf.set(w,T),b||=(y.get(w)?.version??0)!==R}for(let w of h.readers.keys()){if(h.readers.size<=Xf)break;if(!h.mounted.has(w))Yf(w)}if(b)Ci([n])}

// chunk-n3ykh62m.js invalid tree note [279923,280080) 157 units sha256 25fde3e1ece864bc1c4df26c802ab2bd82210077426a29d57a73cb1fb46d1685
function jss({input:e,problem:n,origin:r}){if(!aCe())return;let{load:s,lead:h}=JAe(e,r);CK({key:[s,e.component,n].join(" "),lead:h,text:uno(e.component,n)})}

// chunk-n3ykh62m.js drop buttons [227931,228055) 124 units sha256 0671ea4e608ccde0e4a930e0fa6903e5cee298bbd549b3ec94ebcc7cb3f6bddf
function BM(e,n){let r=new Map;for(let{plugin:s,handle:h}of XPt(e))r.set(s,[...r.get(s)??[],h]);for(let[s,h]of r)vAt(s,h,n)}

// chunk-n3ykh62m.js diff buttons [227629,227931) 302 units sha256 254713894b47024ee2cc73a20c8d51f0dfe8c6f37f0b0f7cf8867736784717cc
function FM(e,n,r){if(e===n)return;let s=Map.groupBy(XPt(n),(h)=>h.plugin);for(let[h,y]of Map.groupBy(XPt(e),(b)=>b.plugin)){let b=new Set(s.get(h)?.map((w)=>w.handle));vAt(h,y.filter((w)=>!b.has(w.handle)&&!AK.hostedButtonsOf(h,w.element).some((R)=>R.button.handle===w.handle)).map((w)=>w.handle),r)}}

// chunk-n3ykh62m.js metrics store [231733,232412) 679 units sha256 d4cb80d6cefd3538cbd98e6bec84291393da03ecc6b4ef74cedc818ed693ecc8
function M_(){let e=new Map,n=Oe();function r(h){let y=e.get(h),b=y??{own:0,clients:new Map};if(y===void 0){e.set(h,b);for(let w of e.keys()){if(e.size<=I_)break;e.delete(w)}}return b}function s(h,y,b){if(b<y)n.emit(h)}return{clientRows:(h)=>e.get(h.requestId)?.clients.get(ki(h))??1,recordOwn:(h,y)=>{let b=r(h),w=b.own;b.own=y,s(h,w,y)},fits:(h,y)=>{let b=r(h.requestId),w=ki(h),R=b.own+y;for(let[T,P]of b.clients)R+=T===w?0:P;return R<=kFe},recordClient:(h,y)=>{let{clients:b}=r(h.requestId),w=ki(h),R=b.get(w)??0;b.set(w,y),s(h.requestId,R,y)},dropClient:(h)=>{if(e.get(h.requestId)?.clients.delete(ki(h))===!0)n.emit(h.requestId)},onFreed:n.subscribe,clear:()=>{e.clear()}}}


export { gno };
