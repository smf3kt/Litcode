// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-2kdsvp3x.js sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
//   chunk-mven2c2x.js sha256 e2f58e7f95f30e10bd73c8047084a1ba104ae00ebf4cbd223b5466085d79c170
//   chunk-nrk8z90j.js sha256 5650fa172647083d24e2d83889060a8915ecb0b4cf46154bbef490e700187ad3
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { He, Ge, hlt } from './plugin-chain-source.js';
import { Rpr, zz } from './plugin-chain-records.js';
import { bGt, wGt, w3 } from './plugin-chain-install-source.js';
import { wQt } from './plugin-chain-matchers.js';
import { Awr, Q3e, Z$n, eEs, lIt, mlt, it, Te, Tpe, c, h3, rWt, lIo, dIo, AK, pce, Fv } from './plugin-chain-host.js';

// chunk-2kdsvp3x.js names D5t [27198,27288) 90 units sha256 8826e31dcc20a5c153551ef2ebef587bb61007c290c33eb0eb82a19ad37c9b9f
function D5t({pluginName:e,pluginStorageId:r}){return r.startsWith(`${e}@`)?r:`${r}+${e}`}

// chunk-m4qpskd4.js names th [76157,76200) 43 units sha256 48af86c5af325ac96ebfe0d597dd05b02639907aadf6e6b0aba788f5074a3409
function th(e){return e.endsWith(`@${Pi}`)}

// chunk-mven2c2x.js names uRe,xQt [615,667) 52 units sha256 1e611e36ebcb103e215fa24a34cd49444c9b5cb07c63b4fcbb764198c3e68912
var uRe=["anthropic-skills"],xQt="anthropic-skills";

// chunk-nrk8z90j.js names A,I [8301,8728) 427 units sha256 865c5849b2265346be88a2675eeec026dc11ba164b2e34d73a5ea051e0152df7
var A=new Map,I=()=>{let e=A.get("external")??new Map([["responsive-mode","cc-plugin-responsive-mode"],["tips","cc-plugin-tips"],["mermaid","cc-plugin-mermaid"],["claude-test","cc-plugin-claude-test"],["agents-md","cc-plugin-agents-md"],["diff","cc-plugin-diff"],["telemetry","cc-plugin-telemetry"],["plugin-authoring","cc-plugin-plugin-authoring"],["sec-default","cc-plugin-sec-default"],...[]]);return A.set("external",e),e};

// chunk-nrk8z90j.js names m [8728,8742) 14 units sha256 33cc92322ff0d56e848ac4a31f77db3ee840d430a636f05f8687e28e928ae25b
var m=()=>I();

// chunk-nrk8z90j.js names g [8769,8820) 51 units sha256 a28564e116f99a4264042cbf948d6467c2757c1f72c012931b45d54b46bebce4
var g=(e)=>[...m()].flatMap(([n,t])=>t===e?[n]:[]);

// chunk-nrk8z90j.js names w [8820,8842) 22 units sha256 8e09e16b60464cd4db20fad2761fa2cf1675c1cf2dd2b5ec7e4d186b0c108f80
var w=(e)=>g(e)[0]??e;

// chunk-nrk8z90j.js names _d,CQt,hu,ha,Pi [8941,9017) 76 units sha256 17c3f0b8bef50fe9de68ad4b42ce17db8c64c5bf589b45fce55c73b280e38101
var _d="inline",CQt=`${xQt}@${_d}`,hu="skills-dir",ha="synced",Pi="builtin";

// chunk-nrk8z90j.js names nH [9493,9554) 61 units sha256 bbf2a9b2f2d6d7f94746072cd49bffab4bf2ab388471f69a270cc5ee46da7b38
function nH(e,n){return n.endsWith(`@${Pi}`)?h(e)[0]??w(e):e}

// chunk-nrk8z90j.js names h [9853,9907) 54 units sha256 b00054d278d4d6d8bdcc284d3d2bd21ac505dc685bab96cc4a988d1d5009ce5b
function h(e){let n=g(e);return n.length>0?n:g(_r(e))}

// chunk-nrk8z90j.js names _r [12751,12806) 55 units sha256 4a8fe78c350094291c9340e4bab68ae76f4650199d03f97b4886303614f2e5cc
function _r(e){return e.normalize("NFC").toLowerCase()}

// chunk-sfn1dbxq.js names rht [449855,450049) 194 units sha256 8bfb17fb72611057560fa43a378c7a6d027dd1cdbde3066f63a43647c6b7293d
function rht(){let e,n=new Set;return{bind:(r)=>{e=r;let s=[...n];if(n.clear(),!r)return;for(let h of s)h(r)},release:(r)=>{if(e===r)e=void 0},current:()=>e,whenBound:(r)=>e?r(e):void n.add(r)}}

// chunk-sfn1dbxq.js names DT [450049,450086) 37 units sha256 b972c9b79a0b172be271c28edf6f31ad211adb9889cb7032f1e827c42dfac0e8
var DT=Ge(rht(),(e)=>e.bind(void 0));

// chunk-sfn1dbxq.js names bI [450137,450155) 18 units sha256 4e3259363e446f92384ea021cc16274c45c14be6a679bafa04c113811ebed9e2
var bI=DT.current;

// chunk-sfn1dbxq.js names wOe [456262,456588) 326 units sha256 bd3dff02c3c8baacb90ca48a3a93d2f3908f4ddd8df86a0ba374aea82d825f3c
function wOe(){let e=new Map,n=new Map,r=new Set;return{list:(s)=>[...e.get(s)?.values()??[]],own:(s)=>{let h=e.get(s)??new Map;return e.set(s,h),h},serverKey:(s)=>n.get(s),ownerOfKey:(s)=>[...n.entries()].find(([,h])=>h===s)?.[0],keyed:(s,h)=>{n.set(s,h),r.add(h)},minted:(s)=>r.has(s),forget:(s)=>{e.delete(s),n.delete(s)}}}

// chunk-sfn1dbxq.js names jg [456588,456601) 13 units sha256 4b30ca1bcdadf00b5e004ef35e52bca04d4753efb53727c9d7c3e746acef7316
var jg=wOe();

// chunk-sfn1dbxq.js names pY [456601,456690) 89 units sha256 039a612b60bf4df28941097bbfe94e8aec26671042f1caf1cd7e82488ef3bc68
function pY(e){let n=jg.serverKey(e);if(jg.forget(e),n!==void 0)bI()?.removeMcpServer(n)}

// chunk-sfn1dbxq.js names KWe [1683229,1683297) 68 units sha256 dd49946d1942a203e5cf28e3bbdc193a10ef920419fbf3b051d28b8a3e2b8f12
var KWe=(e)=>(e.startsWith("!")?e.slice(1):e).startsWith(`${wQt}.`);

// chunk-sfn1dbxq.js names tWt [1683297,1683468) 171 units sha256 99d365e569c4a9fedb8e7d934f97b2682c34ce5809936e15dadf55d7a174b081
function tWt(e,n){for(let r of new Set(n.map((s)=>s.pattern)))if(KWe(r)&&!r.startsWith("!"))zz(e,`registered ${r}; that name cannot be a noun, so this hook is never run`)}

// chunk-sfn1dbxq.js names iWt [1684913,1685296) 383 units sha256 3f73ce671c2b1488e9c5d423a62d2c8ad1b0f02e22ade47b8433303a74b9c752
function iWt(e,n,r){for(let s of r){let h=Awr(s);if(h!==void 0)throw new He(`${e}: registered ${h}`);let y=mlt(s),b=eEs(s);if(b!==void 0&&!mlt(b)&&!Z$n(b))throw new He(`${e}: registered "${s}", which is not an event`);if(!n.hooks.some((z)=>z===s||y&&Q3e(z)&&lIt(z,s,{isBuiltin:!1})))throw new He(`${e}: registered ${s}, which the scan of its hooks module did not see (host check)`)}}

// chunk-sfn1dbxq.js names bpe [1687657,1687754) 97 units sha256 bab62b2e8ae98ecc18f6c6572110f77812b275f134d5494916dc7d3b4a5a505a
var bpe="no hooks module loads in a claude-code-server tenant, whose process serves many people";

// chunk-sfn1dbxq.js names bN [1687754,1687812) 58 units sha256 a9fafe238336cede5749215a484c01da931637d12fe304bbd4c1a4dadab40412
class bN extends He{constructor(e){super(`${e}: ${bpe}`)}}

// chunk-sfn1dbxq.js names ZWe [1688587,1688642) 55 units sha256 1f4a3f92d81496a657ba578e482f78b310771242b845fcb15aff2bd1285a110e
var ZWe=(e)=>`${nH(e.plugin,e.pluginId)}:`+e.spec.name;

// chunk-sfn1dbxq.js names hWt [1688642,1688866) 224 units sha256 b8c81db7b5145ad7bd3b5887006a409f41555d5f7eb00d22ebd35768fe32870c
function hWt(e){return{list:()=>[...e().values()],held:(n)=>e().get(n),register:(n)=>{e().set(ZWe(n),n)},forget:(n)=>{let r=e(),s=[...r.values()].filter((h)=>h.plugin===n);for(let h of s)r.delete(ZWe(h));return s.length>0}}}

// chunk-sfn1dbxq.js names e1e [1688866,1688905) 39 units sha256 55646b65bdfcdff1c992d8aa994f01b5c9237ead5872c0fa6a8fbe4ce8b4ae58
var e1e=hWt(()=>it().registeredAgents);

// chunk-sfn1dbxq.js names hx [1688905,1688960) 55 units sha256 bba1efc2eb3e58368e71410a57f3446d46e48e9eabddd2ec90495e3eaf1c50b3
function hx(e){if(e1e.forget(e))Tpe().catch((n)=>c(n))}

// chunk-sfn1dbxq.js names gGt [1824740,1825042) 302 units sha256 f6c30e2782f2882d82ea5799942ce796d693b55c3d66c3ad8ae456495a2e8699
function gGt(){let e=new Map,n=new Map;return{join:(r,s)=>{let h=e.get(r);if(h!==void 0)return h;let y=s().finally(()=>e.delete(r));return e.set(r,y),y},own:(r,s)=>{let h=n.get(r)??new Set;h.add(s),n.set(r,h)},forget:(r)=>{let s=[...n.get(r)??[]];return n.delete(r),s},clear:()=>{e.clear(),n.clear()}}}

// chunk-sfn1dbxq.js names _3 [1825042,1825076) 34 units sha256 f36946b95f5f9b67772aa61cd6ab7ac03c54a0e6073fc59a3275d27188639cc0
var _3=Ge(gGt(),(e)=>{e.clear()});

// chunk-sfn1dbxq.js names dme [1825076,1825143) 67 units sha256 d737b2cf0f315d04bc29c21d80f23537343e62e49c9e0be19e61c0bc9a29c4d5
function dme(e){for(let n of _3.forget(e))bI()?.removeMcpServer(n)}

// chunk-sfn1dbxq.js names IN [1826839,1826971) 132 units sha256 ee646dd2512e15fe685b4d0d0beb605169179db0e99b7f9f79fc7a58277e92e0
function IN(e){if(!th(e.pluginStorageId))return;let n=Fv(e.pluginName)?.hooksModule;return n!==void 0&&"module"in n?n.module:void 0}

// chunk-sfn1dbxq.js names tGe [1829702,1831394) 1692 units sha256 9f5cacb36d569a3f4b4dddf85bdcd95f63af396eaab33b358d3381eadda823a8
async function tGe(e,n){if(Te())throw new bN(n.pluginName);let s=IN(n)!==void 0?dIo(e):void 0,h=s??lIo(e),y=++e.state.environmentCounter,b=await h.load(y,n);try{iWt(n.pluginName,n.scan,b.registered.map((ke)=>ke.pattern))}catch(ke){throw h.unload(y),ke}let w=D5t(n);rWt(w,b.registered),tWt(n.pluginName,b.registered),it().moduleSeats.set(n.pluginName,n.tier),e.state.environmentArgs.set(y,n);let M={kind:"live"},z=0,V=`hooks module ${w} unloaded`;function X(){if(M.kind==="live"||M.kind==="retiring")M={kind:"unloaded",retired:M.kind==="retiring"},e.state.environmentArgs.delete(y),h.unload(y)}function he(){let ke=h.died;return ke!==void 0&&M.kind!=="unloaded"?{kind:"dead",reason:ke}:M}let _e=bGt({name:n.pluginName,label:w,tier:n.tier,...wGt(b.registered,{isBuiltin:pce(n.pluginStorageId)}),args:n,environmentId:y,hopKey:h,...s!==void 0&&{link:(ke)=>s.link(y,ke),streamLinks:(ke)=>s.linkStreams(y,ke)},status:he,enter:()=>{z+=1},leave(){if(z-=1,M.kind==="retiring"&&z===0)X()},dispatch:(ke,Se,Re)=>Rpr({members:[_e],event:ke,e:Se,call:Re,signal:Re.signal,hookOrigin:void 0,origin:Re.origin,floors:hlt}),terminate(){pY(n.pluginName),dme(n.pluginName),h3(n.pluginName),hx(n.pluginName),AK.forgetPresses(n.pluginName),X()},discard:X,retire(){if(h3(n.pluginName),hx(n.pluginName),e.state.environmentArgs.delete(y),AK.forgetPresses(n.pluginName),M.kind==="live")M={kind:"retiring"};if(z===0)X()},resolveTables:(ke)=>w3(()=>M,V,()=>h.resolveTables(y,ke)),build:(ke,Se)=>w3(()=>M,V,()=>h.build(y,ke,Se)),callInterface:(ke,Se)=>w3(()=>M,V,()=>h.callInterface(y,ke,Se)),press:(ke,Se)=>w3(()=>M,V,()=>h.press(y,ke,Se)),releasePresses:(ke)=>{if(M.kind!=="unloaded")h.releasePresses(y,ke)}});return _e}


export { D5t, th, uRe, xQt, A, I, m, g, w, _d, CQt, hu, ha, Pi, nH, h, _r, rht, DT, bI, wOe, jg, pY, KWe, tWt, iWt, bpe, bN, ZWe, hWt, e1e, hx, gGt, _3, dme, IN, tGe };
