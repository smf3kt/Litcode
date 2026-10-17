// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-sxm1dh4y.js sha256 4b99782cd2c85d7c09cfd155118e1b9d052d81501a83aa7d672cf8ed1111613e
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { P, R, Z, Rt } from "./plugin-chain-react-hooks.js";
import { Ge, bs } from "./plugin-chain-source.js";
import { Ey } from "./plugin-chain-client-host-source.js";
import { TIe } from "./plugin-chain-press-dispatch-source.js";
import { $r } from "./plugin-chain-session-context.js";
import { V } from "./plugin-chain-app-state.js";
import { gs } from "./plugin-chain-registry-stores-source.js";
import { k0 } from "./plugin-chain-above-prompt-select-keys-source.js";

// chunk-4bw62nzm.js store class [56759,56979) 220 units sha256 71140b7614d00e7847290494af5dbca0275f1d28da176332470877062387b41d
class lt{#e;#t=new WeakMap;constructor(e){this.#e=e}peek(e){return this.#t.get(e.root)}of(e){let t=e.root,o=this.#t.get(t);if(o!==void 0)return o;let r=this.#e();return this.#t.set(t,r),r}drop(e){this.#t.delete(e.root)}}

// chunk-24k7d6mw.js session selector [299367,299397) 30 units sha256 81c03023ef635970a499e5abe038735dff1b3df598f81c82e8f466a8051669a7
function vp(){return oI($r())}

// chunk-24k7d6mw.js longer input value [299493,299598) 105 units sha256 20cafd91f3f8876148f958df3f86163e61edb9f7cb1709d324e1db58ef6dfc96
function IV(){let h=vp();return Rt(h.subscribe,()=>{let{value:T}=h.getState();return T.length<=1?T:KCt})}

// chunk-24k7d6mw.js plugin context value [447223,447294) 71 units sha256 0dc06f1df6b49eaab0173a7ce22705553bafe8234ec0cc1ce1061bfe214b59db
function q1(){let h=V(AFe);return Z(()=>h===void 0?{}:{agentId:h},[h])}

// chunk-24k7d6mw.js hotkey presses [450848,450963) 115 units sha256 3921f8e649c6cd7cdd354eeca19991a91791ff310d75b4955b4159263cdec507
var tK=(h,T)=>Ey((M,L,ee)=>{let we=Pne(M===""?ee:M,L,h);for(let Te of we)TIe(Te);return we.length>0},{isActive:T});

// chunk-24k7d6mw.js release on gone [453589,453644) 55 units sha256 ff4d8a070cc48e53c5eda8f869fe5e23345267b3b7f741a6384c0e25d9a7cbb7
var cK=(h,T,M)=>P(()=>{if(h!==null&&h>=T)M()},[h,T,M]);

// chunk-24k7d6mw.js release on edit [453648,453782) 134 units sha256 9477db88c8d0f85cae62788960ac25b97a42074d4d8b6b8d96ffc464aa6e14c5
var Ine=(h,T,M)=>P(()=>{if(T===null)return;let L=h.getState().value;return h.subscribe(()=>{if(h.getState().value!==L)M()})},[T,h,M]);

// chunk-24k7d6mw.js settled budget store [450435,450470) 35 units sha256 3c62760e35cc4409ec7db76e1e6c26c2923c39ec8d16f5515a217c2a25be119b
var Z1=Ge(bs(),(h)=>h.set(void 0));

// chunk-24k7d6mw.js longer input marker [299468,299493) 25 units sha256 fe9f915138daa219262d211ddab3e94ebadfa16461ffd67973701d8949046506
var KCt="[longer input]";

// chunk-24k7d6mw.js plugin context [447122,447223) 101 units sha256 0ff01b20a2579863533351ecf223df841613563fb5a2780fc21cf74f7347566b
function AFe(h){let T=h.viewingAgentTaskId,M=T===void 0?void 0:h.tasks[T];return M?Att(M)?.id:void 0}

// chunk-24k7d6mw.js hotkey press lookup [450686,450848) 162 units sha256 cd4bf2214784fbb4a8102163f57d6f4ee8a1fbae4f1e8c18e329b92b50c38370
function Pne(h,T,M){let L=k0(h,T)?[...h.normalize("NFKC").toLowerCase()].map((he)=>M.get(he)):[],ee=L.filter((he)=>he!==void 0);return ee.length===L.length?ee:[]}

// chunk-sxm1dh4y.js store read [887,917) 30 units sha256 7fffb45b97ad3fcace70ed702fc898ca2979c55023304b92bb3cfec92e67b5eb
function oI(n){return a.of(n)}

// chunk-sxm1dh4y.js store factory [865,887) 22 units sha256 6508d58a75571e0bf0e728ecc2032fd26fe54af2ba3688e35a81b9febdb26cb6
var a=new lt(()=>p());

// chunk-sxm1dh4y.js store initial [709,865) 156 units sha256 6c351c38d3d2b40495904296e5bc991c210cc221b971af9e6ad280c0d8e06ef2
function p(){return gs({value:"",active:!1,launchWarning:null,linkSuppliedTexts:new Set,submittedLinkPrefill:null,vimMode:"INSERT",stash:null,cameBack:!1})}

// chunk-sfn1dbxq.js record list wrapper [1699480,1699936) 456 units sha256 a520c0ce5f63d6f2c4debd2e76ff86c8a118ea1c83cc3bebd8ca25a0f958fc22
function Att(e){switch(e.type){case"local_agent":return{id:e.agentId,teammateId:void 0,description:e.description,type:e.agentType,parentId:e.parentAgentId,name:void 0};case"in_process_teammate":return{id:e.identity.resumableAgentId??e.identity.agentId,teammateId:e.identity.agentId,description:e.spawnedWith.description??e.description,type:e.spawnedWith.agentType||"teammate",parentId:e.spawnedWith.parentAgentId,name:e.identity.agentName};default:return}}


export { vp, IV, q1, tK, cK, Ine, Z1, oI, KCt, Pne, AFe, Att };
