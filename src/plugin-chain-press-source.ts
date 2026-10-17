// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-p16hdq43.js sha256 0876812e3099d9038f2c1c8eaf18b9f878583ce15621d5867f58b46e91050c38
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { t, it } from './plugin-chain-host.js';
import { He, aP, L, $A } from './plugin-chain-source.js';
import { P0 } from './plugin-chain-records.js';
import { NDe } from './plugin-chain-store-entry-source.js';
import { zd } from './plugin-chain-press-sites.js';

// chunk-n3ykh62m.js `m_` — the per-plugin press runner table [223903,224239) 336 units sha256 b070bd98d0e683940a87536251b0ac2c8857dba4e666f91c7aba6afb2cbc6335
function m_(){let e=new Map,n=0;return{hold(r,s){let h=-++n,y=e.get(r)??new Map;return y.set(h,s),e.set(r,y),h},runnerFor:(r,s)=>s<0?e.get(r)?.get(s):void 0,release(r,s){let h=e.get(r);if(h===void 0)return;for(let y of s)h.delete(y);if(h.size===0)e.delete(r)},forget(r){e.delete(r)},count:()=>[...e.values()].reduce((r,s)=>r+s.size,0)}}

// chunk-n3ykh62m.js `g_` — whether a handle marks a released press [224239,224255) 16 units sha256 6c59490c491ac8e5496cb2c49114339481f47203f606ec78d71c804cc2ca6a8a
var g_=(e)=>e<0;

// chunk-n3ykh62m.js `Hrt` — the runner table instance [224255,224268) 13 units sha256 1e3ff76eac1098f87839bb047a155c396ead18b1f988077f18c3526d28473501
var Hrt=m_();

// chunk-n3ykh62m.js `Yl` — the press handler a dispatch appends [224268,224602) 334 units sha256 514afcd0903a0a09327ffb87428431f5611e4b2d582f4f399b5e071705a9f8fd
var Yl=(e,n,r)=>({name:e.plugin,tier:"core",async run(s){let h=it().loadedModules.find((b)=>b.name===e.plugin);if(!h)throw new He(`${n}: ${e.plugin}, which drew ${s.element}, is not loaded`);let y=Hrt.runnerFor(e.plugin,e.handle);if(y!==void 0)return y(s),r(s);h.enter();try{await h.press(e.handle,s)}finally{h.leave()}return r(s)}});

// chunk-n3ykh62m.js `bo` — a per-name serial queue [224602,224704) 102 units sha256 6f57b246d1d3f5c6fa993e5d3bfbfbcfe7922e9e4782d6cd82d655abfab92b17
function bo(){let e=new Map;return(n)=>{let r=e.get(n);if(r)return r;let s=NDe();return e.set(n,s),s}}

// chunk-n3ykh62m.js `_f` — the drawing key a hosted press is filed under [224704,224777) 73 units sha256 5756418806cc657d897b13119bdf51d5a444f12fdf4e32a726617248900d36d8
var _f=(e,n)=>`${e}\x00${n.component}\x00${n.requestId}\x00${n.surface}`;

// chunk-n3ykh62m.js `bf` — a press held by another drawing of the same plugin [224777,224929) 152 units sha256 e53289a4062240aded201ada892429a2f8a939bf20f7b5926519830b3298b406
function bf({byDrawing:e,plugin:n,except:r,handle:s}){for(let[h,y]of e)if(h!==r&&h.startsWith(`${n}\x00`)){let b=y.get(s);if(b!==void 0)return b}return}

// chunk-n3ykh62m.js `S_` — the handle space [224929,224947) 18 units sha256 58d625f93ccddee268fc61e83a43b0e1ccdfd49c3bf4442a53596ad62782878d
var S_=1073741824;

// chunk-n3ykh62m.js `__` — the next random handle [224947,224987) 40 units sha256 7e2206b72c8232f6f376cd1663382c63d884ff4dee19a2be395585d21f8a9900
var __=()=>Math.floor(Math.random()*S_);

// chunk-n3ykh62m.js `b_` — the held-press store [224987,226254) 1267 units sha256 ab7eda4538911b81141c0febf5d2abb61c490549d8faa79bd40592172987ebf4
function b_(){let e=new Map,n=new Map,r=__();return{heldPress:(s,h,y)=>{let b=e.get(h);return b?.plugin===s&&(y===void 0||y===""||b.element===y)?b:void 0},holdDrawing(s,h,y){let b=_f(s,h),w=n.get(b)??new Map,R=new Map;for(let{tag:P,handle:M,element:z,pressableLinks:N,options:V}of y){let X=w.get(M)??bf({byDrawing:n,plugin:s,except:b,handle:M})??++r;R.set(M,X),e.set(X,{tag:P,plugin:s,handle:M,element:z,...N!==void 0&&{pressableLinks:N},...V!==void 0&&{options:V},...h})}let T=[];for(let[P,M]of w)if(!R.has(P)&&bf({byDrawing:n,plugin:s,except:b,handle:P})===void 0)e.delete(M),T.push(P);return R.size===0?n.delete(b):n.set(b,R),{hosted:R,released:T}},holdersOf:(s)=>Array.from(n.keys()).filter((h)=>h.endsWith(_f("",s))).map((h)=>h.slice(0,h.indexOf("\x00"))),forgetPresses(s){for(let[h,y]of e)if(y.plugin===s)e.delete(h);for(let h of n.keys())if(h.startsWith(`${s}\x00`))n.delete(h)},heldByKeyOf({tag:s,plugin:h,element:y,surface:b,component:w,requestId:R}){let T=[...e.values()].filter((M)=>M.tag===s&&M.plugin===h&&M.element===y&&M.surface===b&&M.component===w&&(R===void 0||M.requestId===R));return T.length===1?T[0]:void 0},hostedButtonsOf:(s,h)=>[...e].filter(([,y])=>y.plugin===s&&y.element===h).map(([y,b])=>({hosted:y,button:b})),heldPressCount:()=>e.size}}

// chunk-n3ykh62m.js `AK` — the held-press store instance [226254,226266) 12 units sha256 e0404be49cf5966db0229b80b4c480b7e7d72003347354f8fa895182329b6d9e
var AK=b_();

// chunk-n3ykh62m.js `vAt` — release the handles a new drawing no longer holds [226266,226550) 284 units sha256 dc16833982f3d45139365067a26b31397b11546517b6c4c25b4f953e8fc634b8
function vAt(e,n,r){Hrt.release(e,n.filter(g_));let s=n.filter((y)=>!g_(y));if(s.length===0)return;let h=it().loadedModules.find((y)=>y.name===e);if(!h){t(`ui.render (${r.component} ${r.requestId}): ${e} drew Buttons but is not loaded; nothing to release`);return}h.releasePresses(s)}

// chunk-n3ykh62m.js `Rto` — host a drawn press set and relabel its handles [226550,226974) 424 units sha256 20030149ba58b8dadd773e8316f2cd6965ff00341774d058ea99610b8de0bc0d
function Rto(e,n){let r=new Map;for(let h of XPt(e)){let{tag:y,plugin:b,handle:w,element:R,pressableLinks:T,options:P}=h;r.set(b,[...r.get(b)??[],{tag:y,handle:w,element:R,...T!==void 0&&{pressableLinks:T},...P!==void 0&&{options:P}}])}let s=new Map;for(let h of new Set([...AK.holdersOf(n),...r.keys()])){let{hosted:y,released:b}=AK.holdDrawing(h,n,r.get(h)??[]);s.set(h,y),vAt(h,b,n)}return SFs(e,(h,y)=>s.get(h)?.get(y))}

// chunk-n3ykh62m.js `w_` — the input argument a press carries [226974,227125) 151 units sha256 5cac33dac2029a516476b028130aeacb5cc1fc9f7df27ce97409ad0a78ca9d82
var w_=({held:e,surface:n,kind:r,value:s})=>({plugin:e.plugin,element:e.element,component:e.component,requestId:e.requestId,surface:n,kind:r,value:s});

// chunk-n3ykh62m.js `kf` — the input site queue [227125,227137) 12 units sha256 f764b6a698038d813937b819180a7ea759d01699af058446a14a5eac59649f02
var kf=bo();

// chunk-n3ykh62m.js `Ef` — the ui.input site [227137,227159) 22 units sha256 a75b0f97d4af5bc436e30a074deb32e71ace365c3478fc1b27b44b004f40f7a6
var Ef=zd["ui.input"];

// chunk-n3ykh62m.js `k_` — whether a plugin holds a press for a key [227159,227274) 115 units sha256 e31786762bbf234378a6b7e90272d5953c09373484d96a38167e8efd2c453045
var k_=({plugin:e,handle:n,element:r})=>AK.heldPress(e,n,r)!==void 0||r!==void 0&&AK.hostedButtonsOf(e,r).length>0;

// chunk-n3ykh62m.js `FM` — release the presses a replaced drawing dropped [227629,227931) 302 units sha256 254713894b47024ee2cc73a20c8d51f0dfe8c6f37f0b0f7cf8867736784717cc
function FM(e,n,r){if(e===n)return;let s=Map.groupBy(XPt(n),(h)=>h.plugin);for(let[h,y]of Map.groupBy(XPt(e),(b)=>b.plugin)){let b=new Set(s.get(h)?.map((w)=>w.handle));vAt(h,y.filter((w)=>!b.has(w.handle)&&!AK.hostedButtonsOf(h,w.element).some((R)=>R.button.handle===w.handle)).map((w)=>w.handle),r)}}

// chunk-n3ykh62m.js `BM` — release every press a drawing held [227931,228055) 124 units sha256 0671ea4e608ccde0e4a930e0fa6903e5cee298bbd549b3ec94ebcc7cb3f6bddf
function BM(e,n){let r=new Map;for(let{plugin:s,handle:h}of XPt(e))r.set(s,[...r.get(s)??[],h]);for(let[s,h]of r)vAt(s,h,n)}

// chunk-n3ykh62m.js `Xl` — dispatch one input/select [228055,228808) 753 units sha256 422a0190334246fda415cf194b213878eeaadf3270aed3d86c2359472150f5b7
async function Xl(e){let{event:n,tag:r,plugin:s,handle:h,element:y,component:b,surface:w}=e,{requestId:R}=e,P=y!==void 0&&b!==void 0?{tag:r,plugin:s,element:y,surface:w,component:b,...R!==void 0&&{requestId:R}}:void 0,M=AK.heldPress(s,h,y)??(P===void 0?void 0:AK.heldByKeyOf(P));if(M?.tag!==r){t(`${n}: no ${r} of ${s} is held under handle ${h}; nothing ran`);return}if(e.admits!==void 0&&!e.admits(M)){t(`${n}: the ${r} ${s}/${M.element} does not take that value; nothing ran`);return}let z=e.argumentOf(M),N=performance.now(),V=await aP({e:z,handlers:[...P0(n),Yl(M,n,(X)=>({element:X.element,value:X.value}))],site:e.site});return t(`${n} ${s}/${M.element}${e.detail} in ${M.component} from ${w}: settled in ${(performance.now()-N).toFixed(1)}ms`),V}

// chunk-n3ykh62m.js `x_` — the ui.input dispatch [228808,228967) 159 units sha256 d8cedc3598490bed9836e667208e484bea9d9baccf27134aeb4c58ddb764f188
var x_=({kind:e,value:n,...r})=>Xl({...r,event:"ui.input",tag:"Input",site:Ef,detail:` (${e})`,argumentOf:(s)=>w_({held:s,surface:r.surface,kind:e,value:n})});

// chunk-n3ykh62m.js `R_` — the select argument [228967,229104) 137 units sha256 5971b322ec23a81a36e6e564dabb6aad220a919e8f4398c9e3b389f3df172108
var R_=({held:e,surface:n,value:r})=>({plugin:e.plugin,element:e.element,component:e.component,requestId:e.requestId,surface:n,value:r});

// chunk-n3ykh62m.js `vf` — the ui.select site [229104,229127) 23 units sha256 070650d80c4d26f36b228cf8dde3ba004162441fba7520fdd6ed69e4e511d08f
var vf=zd["ui.select"];

// chunk-n3ykh62m.js `T_` — the ui.select dispatch [229127,229321) 194 units sha256 cfd28d3442283ccdde8bfe209421e5962fe9f3c80501a5ddd8226ac6d96184d5
var T_=({value:e,...n})=>Xl({...n,event:"ui.select",tag:"Select",site:vf,detail:"",argumentOf:(r)=>R_({held:r,surface:n.surface,value:e}),admits:(r)=>r.options===void 0||r.options.includes(e)});

// chunk-n3ykh62m.js `ql` — dispatch when the plugin holds the element [229321,229389) 68 units sha256 b289b668a970a4157474ae22bd71c86d06c1e52e3c6bbe590535c836bf008461
var ql=(e,n,r)=>k_(e)?n(e.plugin)(()=>r(e)):Promise.resolve(void 0);

// chunk-n3ykh62m.js `UPn` — inputFromTerminal [229389,229414) 25 units sha256 515657057b6d3208784f2555d26113a5678641835c36b5dd5f051ea05410ed08
var UPn=(e)=>ql(e,kf,x_);

// chunk-n3ykh62m.js `Cf` — the press site queue [230142,230154) 12 units sha256 af55e143617b59985c97330502df27736cb325b915f356d3a8d62a2f25b5ff8e
var Cf=bo();

// chunk-n3ykh62m.js `jPn` — selectFromTerminal [230154,230179) 25 units sha256 f630ecb2cb152222552916c91cd954f440802a5ee83e6b567b4b0d8fec8e84a6
var jPn=(e)=>ql(e,Cf,T_);

// chunk-p16hdq43.js `_` — whether a drawing element is the engine or an Svg [1064,1099) 35 units sha256 55f80860252116c960e65454a1d6e0002287772259269f0164f5aee35921213b
var _=(e)=>e==="engine"||e==="Svg";

// chunk-p16hdq43.js `I` — the four pressable element kinds [1099,1166) 67 units sha256 8a2c825cd3e4604ad14546926699ac81cbf13627a9349db5cbf9db287fafb4f4
var I=(e)=>e==="Button"||e==="Input"||e==="Select"||e==="Markdown";

// chunk-p16hdq43.js `ke` — whether an element kind holds children [1166,1246) 80 units sha256 04a5083d9a6a2d0c2b157ed0f33e97c95af818faaaaaac3156d5d1c5679592ee
var ke=(e)=>e==="Button"||!_(e)&&e!=="Client"&&e!=="Raster"&&e!=="Image"&&!I(e);

// chunk-p16hdq43.js `D` — walk an element's children [1246,1332) 86 units sha256 eafd7eaf69ada06f47d0a17dd7552aa7a7eee23c3d18c0d37443e94a20fdfa80
function D(e,t){let{children:r}=e;return Array.isArray(r)&&ke(e.type)?r.flatMap(t):[]}

// chunk-p16hdq43.js `ve` — the option values a Select drew [1623,1794) 171 units sha256 825943bfd0a70176d75164a34eccefca4f44888da52af7621bb614962f06698e
function ve(e){if(!Array.isArray(e))return;let t=e.map((o)=>typeof o==="object"&&o!==null&&("value"in o)?o.value:void 0);return t.every((o)=>typeof o==="string")?t:void 0}

// chunk-p16hdq43.js `XPt` — the presses a drawing holds [1794,2305) 511 units sha256 652c5ba1fa300e1806a03ab06d5d15a4d5846f0f51cf20c87850a0d0737df88d
function XPt(e){if(typeof e!=="object"||!e||Array.isArray(e))return[];let t=e,r=t.type,o=D(t,XPt);if(!I(r))return o;let{press:n,props:i}=t;if(!(typeof n==="object"&&n!==null))return o;let{plugin:m,handle:u}=n,c=i?.key;if(!(typeof m==="string"&&typeof u==="number"&&typeof c==="string"))return o;let x=i?.pressableLinks,H=Array.isArray(x)&&x.every((v)=>typeof v==="string"),a=r==="Select"?ve(i?.options):void 0;return[{tag:r,plugin:m,handle:u,element:c,...H&&{pressableLinks:x},...a!==void 0&&{options:a}},...o]}

// chunk-p16hdq43.js `QJt` — the drawing key separator [2833,2864) 31 units sha256 21d576c31d345548f93d69bc477aa317be0de32efbc3aad15f279e9df2823152
var QJt=String.fromCharCode(0);

// chunk-p16hdq43.js `M$n` — the element kinds a hover group names [2481,2516) 35 units sha256 772d7fb6d003d15cebd51b1eaf610ccfe20a802fdc54a799a610425a210163db
var M$n=(e)=>e==="Box"||e==="Text";

// chunk-p16hdq43.js `q` — whether an element is a leaf [3700,3742) 42 units sha256 29f9ab78bc27d25af1707cd4e47f7fb7671e0b8d73fec0949fb43d099e54e2c7
var q=(e)=>typeof e==="string"||_(e.type);

// chunk-p16hdq43.js `z` — whether an element carries a press [3742,3790) 48 units sha256 988497426a36ec9c8cff234c0a59c879548f03d06786d15a3d8568e9d6cfaa89
var z=(e)=>I(e.type)&&("press"in e)&&L(e.press);

// chunk-p16hdq43.js `je` — rewrite one element under a press handle [5382,5661) 279 units sha256 56261ba57ee5d514c63eaf9413e2abef8f682b84a2b2d8de8524499412cb5850
function je(e,t){let r={plugin:e.press.plugin,handle:t};switch(e.type){case"Button":return{...e,press:r};case"Input":return{type:"Input",props:e.props,press:r};case"Select":return{type:"Select",props:e.props,press:r};case"Markdown":return{type:"Markdown",props:e.props,press:r}}}

// chunk-p16hdq43.js `K` — map an element's children [5661,5771) 110 units sha256 602d2dac524256b6d8a3d66426f96490e1d105d60a3e9124032c6ca5c241acd6
function K(e,t){let r=e,o="children"in r?r.children:void 0;return Array.isArray(o)?{...e,children:o.map(t)}:e}

// chunk-p16hdq43.js `le` — rewrite every press handle in a drawing [5771,5906) 135 units sha256 90585036e573a1d2503dcdf868fc1645122b40fa042176097c74dc58ac8e1424
function le(e,t){if(q(e))return e;if(z(e)){let r=t(e.press.plugin,e.press.handle);return r===void 0?e:je(e,r)}return K(e,(r)=>le(r,t))}

// chunk-p16hdq43.js `SFs` — the drawing relabel entry [5906,5929) 23 units sha256 136dbc30ede6c0ce04da801ee59bc4e07c0406a6a98b7bab2c0642de9838780b
var SFs=(e,t)=>le(e,t);


export { m_, g_, Hrt, Yl, bo, _f, bf, S_, __, b_, AK, vAt, Rto, w_, kf, Ef, k_, FM, BM, Xl, x_, R_, vf, T_, ql, UPn, Cf, jPn, XPt, SFs };
