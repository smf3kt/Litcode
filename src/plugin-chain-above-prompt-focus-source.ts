// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-bwyexfny.js sha256 35fae44d02574c1e366e2c50484d2ce75e87a0b017d91b0e5a8a6ca4bc8ff647
//   chunk-6ejn7q9s.js sha256 e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { R, le, en, P, Z, w } from "./plugin-chain-react-hooks.js";
import { Ihe } from "./plugin-chain-above-prompt-select-keys-source.js";
import { Lc } from "./plugin-chain-press-button.js";
import { Ohe } from "./plugin-chain-press-dispatch-source.js";
import { _z, Uet } from "./plugin-chain-scroll-focus-source.js";
import { Di as oo } from "./plugin-chain-keys-rows-source.js";
import { Ge } from "./plugin-chain-source.js";
import { IY } from "./plugin-chain-scroll-focus-source.js";
import { N5t } from "./plugin-chain-classic-raise-source.js";
import { P0 } from "./plugin-chain-records.js";
import { it, t } from "./plugin-chain-host.js";
import { aP, Ooe } from "./plugin-chain-source.js";
import { aJ } from "./plugin-chain-records.js";

// chunk-sfn1dbxq.js scroll window clamp [475702,475813) 111 units sha256 3802556f57275112b8eb126b8f3e55b073ab5f9c8b018ba8df379d219a5ceebe
function A9r(e){let{offset:n,bodyRows:r,top:s,bottom:h}=e,b=h>n+r?Math.max(0,Math.min(s,h-r)):n;return s<n?s:b}

// chunk-sfn1dbxq.js above-prompt request tag [476169,476191) 22 units sha256 a0373bda888b261768a42e8f130ed47346537a5283d95c5c2862327b9029e706
var Xq="above-prompt";

// chunk-sfn1dbxq.js act wrapper [2336000,2336062) 62 units sha256 f32a3a056f4e21ebc4ecb24646a59d8fb539a483561424953786164e6c2c6c96
var sZo=(e,n,r=[])=>oo(n,(s,h)=>r.includes(h)?s:()=>e.act(s));

// chunk-sfn1dbxq.js focus ring hook [2336190,2338444) 2254 units sha256 887ebe6a8016b9376bf2466bd5398445a60c37c6b3f00092ae8dc1480549661b
function iZo(e){let{component:n,requestId:r,owner:s,focusables:h,isHeld:y}=e,{isHeldNow:b,indexNow:w,isEmptyNow:M,land:z}=e,V=R(void 0),X=R([]),he=R(!1),_e=R(!0),ke=le(()=>{while(V.current===void 0&&X.current.length>0){let[Je,...nt]=X.current;X.current=nt,Je?.()}},[]),Se=le(()=>{V.current?.abort.abort(),V.current=void 0,X.current=[]},[]),Re=le((Je,nt)=>{let ut={...nt,abort:new AbortController};V.current=ut;let Ze=Lqt({input:Je,signal:ut.abort.signal});function pt(){let Et=V.current===ut;if(Et)V.current=void 0;if(Et&&_e.current)ke()}return Ze instanceof Promise?void Ohe(`ui.focus ${r}`,Ze).finally(pt):pt()},[r,ke]),Ae=le((Je)=>{let nt=Ihe(h,Je.index);if(Je.index!==null&&nt===null)return;he.current=!0,Re({component:n,requestId:r,...nt&&{plugin:nt.plugin,element:nt.element},origin:{kind:"person"}},{expected:w(),move:Je})},[n,r,h,w,Re]),Pe=le((Je)=>{if(!(V.current!==void 0||X.current.length>0))Je();else if(X.current.length<GQt)X.current=[...X.current,Je]},[]),Me=le((Je,nt)=>h.findIndex((ut)=>ut.plugin===Je&&ut.element===nt),[h]),$e=le((Je)=>{let nt=V.current,ut=Je.element===void 0;if(Je.origin.kind==="person"){let Et=nt?.move;if(nt===void 0||Et===void 0||w()!==nt.expected)return"the focus moved meanwhile";let Pt=Ihe(h,Et.index);if(ut||Pt!==null&&Pt.plugin===Je.plugin&&Pt.element===Je.element){Et.apply();return}}let Ze=nt?.auto;if(Ze!==void 0&&Je.plugin===Ze.plugin&&Je.element===Ze.element&&w()!==nt?.expected)return"the focus moved meanwhile";let Rt=Me(Je.plugin,Je.element);if(Rt<0)return ut?"no element named":`no element of ${Je.plugin} is drawn under that key`;he.current=!0,z(Rt);return},[h,w,z,Me]);en(()=>{let Je=_z(n,r);return Uet().set(Je,{component:n,requestId:r,owner:s,isHeldNow:b,holderNow:()=>Ihe(h,w())?.plugin,hasElement:(nt,ut)=>Me(nt,ut)>=0,commit:$e}),Nqt().emit(),()=>{Uet().delete(Je)}},[n,r,s,h,b,w,Me,$e]);let Ve=Z(()=>h.find((Je)=>Je.isAutoFocus),[h]);return P(()=>{if(!y){he.current=!1,Se();return}if(!(he.current||V.current!==void 0||Ve===void 0||!M()))he.current=!0,Re({component:n,requestId:r,plugin:Ve.plugin,element:Ve.element,origin:{kind:"plugin",name:Ve.plugin}},{expected:w(),auto:Ve})},[y,Ve,M,w,n,r,Re,Se]),P(()=>()=>{_e.current=!1,Se()},[Se]),Z(()=>({act:Pe,moveByPerson:Ae,forget:Se}),[Pe,Ae,Se])}

// chunk-bwyexfny.js active context hook [3579,3835) 256 units sha256 0fed1529c2b34e7472de2661466f76c814a210bf4ae323ace507db32622da603
function ZD(n,t){let h=w(5),i=t===void 0?!0:t,r=Lc(),c,p;if(h[0]!==n||h[1]!==i||h[2]!==r)c=()=>{if(!r||!i){return}return r.registerActiveContext(n),()=>{r.unregisterActiveContext(n)}},p=[n,r,i],h[0]=n,h[1]=i,h[2]=r,h[3]=c,h[4]=p;else c=h[3],p=h[4];en(c,p)}

// chunk-6ejn7q9s.js focusables of [108086,108477) 391 units sha256 f948d199c409ced06c5c5eb9346fa77f2c0406a3673ab6fe1890f768311eb6b9
function PYe(e){if(e===void 0||typeof e==="string"||e.type==="engine")return[];if(e.type==="Button"||e.type==="Input"||e.type==="Select"){let{plugin:s,handle:h}=e.press;return[{tag:e.type,plugin:s,handle:h,element:e.props.key,isAutoFocus:e.props.autoFocus===!0,...e.type!=="Button"&&{value:e.props.value},...e.type==="Select"&&{options:e.props.options}}]}return(e.children??[]).flatMap(PYe)}

// chunk-sfn1dbxq.js focus request [2334533,2335070) 537 units sha256 9adccae15bb109311fcd96cf9c02ea2485ad1334d7d2493df756dbc7ce18f046
function Lqt(e){let{input:n,hookOrigin:r,signal:s}=e,h=N5t({event:"ui.focus",e:n,origin:r},s);if(h!==void 0)return h.then(()=>Lqt(e));let y=P0("ui.focus",r);function b(M){let V=n.element===void 0?"the engine's stop":`${n.plugin}'s ${n.element}`;return t(`ui.focus ${n.component} ${n.requestId} (${n.origin.kind}) onto ${V}: `+(M.deny===void 0?"moved":`denied (${M.deny})`)),M}return y.length===0?b(IY(n)):fse({event:"ui.focus",input:n,handlers:y,hookOrigin:r,signal:s},(M)=>s?.aborted===!0?{deny:"the move was abandoned"}:IY(M)).then(b)}

// chunk-sfn1dbxq.js focus draw clears [2335070,2335123) 53 units sha256 69e8e1bebf1b37abbff68b919f20a8799179ec460b8549a67b9160035da90c2b
var Nqt=Ge(()=>it().focusSiteDraws,(e)=>e().clear());

// chunk-sfn1dbxq.js focus queue limit [2336062,2336073) 11 units sha256 aaddc1ee3aabcfeafb6c531f7ebd2fb7827f268671da02c4d15b7f0396dce28b
var GQt=64;

// chunk-sfn1dbxq.js above-prompt focus handler [476538,476681) 143 units sha256 5759557bb5193988e9602f4f04ec9c26e7fbd00bf1887a07fc0bbb4a97ebe407
var fse=(e,n)=>aP({e:e.input,handlers:e.handlers,site:Ooe(e.event),signal:e.signal,origin:aJ(e.hookOrigin),bottom:(r)=>Promise.resolve(n(r))});


export { A9r, Xq, sZo, iZo, ZD, PYe, Lqt, Nqt, GQt, fse };
