// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-sxm1dh4y.js sha256 4b99782cd2c85d7c09cfd155118e1b9d052d81501a83aa7d672cf8ed1111613e
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-wz8v981w.js sha256 c7add42e02a826600b00d2f4b850e50d8eaf2672df33b515fa5f914ee3801323
//   chunk-z7whhrje.js sha256 3dca9fb572e08c43b779dd32b44d21858a177e021557bacb2a126e4ed268a3ac
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
//   chunk-js2bhabe.js sha256 f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de
//   chunk-bk5ct2gw.js sha256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1
//   chunk-x0dc37w9.js sha256 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92
//   chunk-wtch2p0g.js sha256 00d29835d3b6ec21999ab2d38ae5086e7c798d82aa152e76a7e00cf5b0dc4b3b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, Xe as r, s, n, y, P, R, Z, le, en, Ae, Rt, hh, qt, w } from "./plugin-chain-react-hooks.js";
import { Ge, bs, CFe } from "./plugin-chain-source.js";
import { W1, xFe, kFe } from "./plugin-chain-above-prompt-parts-source.js";
import { Ohe, TIe } from "./plugin-chain-press-dispatch-source.js";
import { fd } from "./plugin-chain-above-prompt-select-keys-source.js";
import { Ey } from "./plugin-chain-client-host-source.js";
import { _z, ahe } from "./plugin-chain-scroll-focus-source.js";
import { N5t } from "./plugin-chain-classic-raise-source.js";
import { P0 } from "./plugin-chain-records.js";
import { k0 } from "./plugin-chain-above-prompt-select-keys-source.js";
import { Re } from "./plugin-chain-hover-source.js";
import { t } from "./plugin-chain-host.js";
import { V } from "./plugin-chain-app-state.js";
import { $r, v } from "./plugin-chain-session.js";
import { aJ } from "./plugin-chain-records.js";
import { aP, Ooe } from "./plugin-chain-source.js";
import { q } from "./plugin-chain-local-store-source.js";
import { gs } from "./plugin-chain-registry-stores-source.js";

// chunk-24k7d6mw.js session selector [299367,299397) 30 units sha256 81c03023ef635970a499e5abe038735dff1b3df598f81c82e8f466a8051669a7
function vp(){return oI($r())}

// chunk-24k7d6mw.js longer input value [299493,299598) 105 units sha256 20cafd91f3f8876148f958df3f86163e61edb9f7cb1709d324e1db58ef6dfc96
function IV(){let h=vp();return Rt(h.subscribe,()=>{let{value:T}=h.getState();return T.length<=1?T:KCt})}

// chunk-24k7d6mw.js measure rows [444845,444923) 78 units sha256 23987b1f2ac032d8a71bf32b4cd2228888158a644bd1d368e6f21074caf7fe7d
function _Fe(h,T){let M=AZ();return CFe(h,(L)=>M(L,performance.now()).rows,T)}

// chunk-24k7d6mw.js render host [444994,446987) 1993 units sha256 72d8e5b77f597f4f383d913be69064ab888934e4953f93717ad4bc03536a3163
function RFe(h){let{component:T,requestId:M,owner:L,content:ee}=h,{bodyRows:he,contentRows:we,maxOffset:Te}=h,[Me,Le,He]=fd(0),[$e,je,Je]=fd(!1),[at,_t]=hh((go)=>go+1,0),xt=R({bodyRows:he,contentRows:we,maxOffset:Te}),Ct=R(!1),Pt=R(void 0),Mt=R(!1),Ft=R(0),Et=R(void 0),Kt=R(!0),Xt=le(()=>Je()?xt.current.maxOffset:Math.min(He(),xt.current.maxOffset),[He,Je]),no=le((go)=>{let Mo=W1(go);if(Mo!==Xt())Mt.current=Ct.current,Ft.current=0,Et.current=void 0;je(!1),Le(Mo)},[Le,je,Xt]),io=le((go,Mo)=>{if(Mo.kind==="plugin")return no(go),!0;if(Mt.current)return!1;let ko=W1(go),Fo=Pt.current;if(!(Je()&&Fo!==void 0&&Fo.by>0&&ko===Fo.offset)&&ko!==Xt())je(!1),Le(ko);return!0},[Le,je,no,Xt,Je]),po=le((go)=>{let Mo=Xt(),ko=go();if(Xt()!==Mo)_t();return ko},[Xt]),co=le((go,Mo)=>{let ko=xt.current,Fo=Math.min(ko.maxOffset,W1(Xt()+go));Ct.current=!0,Pt.current={by:go,offset:Fo},Mt.current=!1,Ohe(`ui.scroll ${T} ${M}`,xwt({input:{component:T,requestId:M,offset:Fo,by:go,bodyRows:ko.bodyRows,contentRows:ko.contentRows,origin:{kind:"person"},...Mo!==void 0&&{pointer:Mo}}})).finally(()=>{Ct.current=!1,Pt.current=void 0;let Yo=Ft.current,Vo=Et.current;if(Ft.current=0,Et.current=void 0,Kt.current&&Yo!==0)co(Yo,Vo)})},[T,M,Xt]),_o=le((go)=>no(go(He())),[no,He]);function xo(go,Mo){if(go===0)return;if(Ct.current){Ft.current+=go,Et.current=Mo;return}co(go,Mo)}return en(()=>{xt.current={bodyRows:he,contentRows:we,maxOffset:Te}},[he,we,Te]),en(()=>{if($e&&He()!==Te)Le(Te)},[$e,Te,He,Le]),P(()=>{let go=_z(T,M);return ahe().set(go,{component:T,requestId:M,owner:L,bodyRows:he,contentRows:we,maxOffset:Te,offset:()=>Je()?Te:Math.min(He(),Te),keyRows:(Mo,ko)=>{let Fo=ee.current;return Fo?kFe(Fo,ko,Mo):void 0},commit:(Mo,ko)=>po(()=>io(Math.min(Te,Mo),ko)),followEnd:()=>po(()=>je(!0))}),()=>{ahe().delete(go)}},[T,M,L,he,we,Te,ee,io,po,He,Je,je]),P(()=>()=>{Kt.current=!1},[]),xFe({offset:$e?Te:Math.min(Me,Te),bodyRows:he,contentRows:we,maxOffset:Te,scrollBy:xo},{placed:$e?Te:Me,place:_o,raised:at})}

// chunk-24k7d6mw.js plugin context value [447223,447294) 71 units sha256 0dc06f1df6b49eaab0173a7ce22705553bafe8234ec0cc1ce1061bfe214b59db
function q1(){let h=V(AFe);return Z(()=>h===void 0?{}:{agentId:h},[h])}

// chunk-24k7d6mw.js settled budget store [450435,450470) 35 units sha256 3c62760e35cc4409ec7db76e1e6c26c2923c39ec8d16f5515a217c2a25be119b
var Z1=Ge(bs(),(h)=>h.set(void 0));

// chunk-24k7d6mw.js hotkey presses [450848,450963) 115 units sha256 3921f8e649c6cd7cdd354eeca19991a91791ff310d75b4955b4159263cdec507
var tK=(h,T)=>Ey((M,L,ee)=>{let we=Pne(M===""?ee:M,L,h);for(let Te of we)TIe(Te);return we.length>0},{isActive:T});

// chunk-24k7d6mw.js release on gone [453589,453644) 55 units sha256 ff4d8a070cc48e53c5eda8f869fe5e23345267b3b7f741a6384c0e25d9a7cbb7
var cK=(h,T,M)=>P(()=>{if(h!==null&&h>=T)M()},[h,T,M]);

// chunk-24k7d6mw.js release on edit [453648,453782) 134 units sha256 9477db88c8d0f85cae62788960ac25b97a42074d4d8b6b8d96ffc464aa6e14c5
var Ine=(h,T,M)=>P(()=>{if(T===null)return;let L=h.getState().value;return h.subscribe(()=>{if(h.getState().value!==L)M()})},[T,h,M]);

// chunk-24k7d6mw.js measure clock [126611,126843) 232 units sha256 80eec85b0e84642f42fc17f9373c5e09cd21acd79448f9772445fd208f8f4c7f
function AZ(){let h=R(null),T=R(null),{internal_jediTermInput:M}=QO();return(L,ee)=>{if(uq()!==T.current)T.current=uq(),h.current=null;h.current??=gbt(M),h.current.base=uq().base;let he=h.current;return{rows:pbt(he,L,ee),state:he}}}

// chunk-24k7d6mw.js longer input marker [299468,299493) 25 units sha256 fe9f915138daa219262d211ddab3e94ebadfa16461ffd67973701d8949046506
var KCt="[longer input]";

// chunk-24k7d6mw.js plugin context [447122,447223) 101 units sha256 0ff01b20a2579863533351ecf223df841613563fb5a2780fc21cf74f7347566b
function AFe(h){let T=h.viewingAgentTaskId,M=T===void 0?void 0:h.tasks[T];return M?Att(M)?.id:void 0}

// chunk-24k7d6mw.js hotkey press lookup [450686,450848) 162 units sha256 cd4bf2214784fbb4a8102163f57d6f4ee8a1fbae4f1e8c18e329b92b50c38370
function Pne(h,T,M){let L=k0(h,T)?[...h.normalize("NFKC").toLowerCase()].map((he)=>M.get(he)):[],ee=L.filter((he)=>he!==void 0);return ee.length===L.length?ee:[]}

// chunk-sxm1dh4y.js store read [887,917) 30 units sha256 7fffb45b97ad3fcace70ed702fc898ca2979c55023304b92bb3cfec92e67b5eb
function oI(n){return a.of(n)}

// chunk-sfn1dbxq.js scroll follow [476926,477331) 405 units sha256 2962f441652bec31cb733ec329f642020c015f95eff9f16a9b0b95d8dd099954
async function xwt(e){let{input:n,hookOrigin:r,signal:s}=e,h=N5t({event:"ui.scroll",e:n,origin:r},s);if(h!==void 0)return await h,xwt(e);let y=P0("ui.scroll",r),w=y.length===0?PY(n):await fse({event:"ui.scroll",input:n,handlers:y,hookOrigin:r,signal:s},PY);return t(`ui.scroll ${n.component} ${n.requestId} (${n.origin.kind}) by ${n.by} to ${n.offset}: `+(w.deny===void 0?"moved":`denied (${w.deny})`)),w}

// chunk-sfn1dbxq.js record list wrapper [1699480,1699936) 456 units sha256 a520c0ce5f63d6f2c4debd2e76ff86c8a118ea1c83cc3bebd8ca25a0f958fc22
function Att(e){switch(e.type){case"local_agent":return{id:e.agentId,teammateId:void 0,description:e.description,type:e.agentType,parentId:e.parentAgentId,name:void 0};case"in_process_teammate":return{id:e.identity.resumableAgentId??e.identity.agentId,teammateId:e.identity.agentId,description:e.spawnedWith.description??e.description,type:e.spawnedWith.agentType||"teammate",parentId:e.spawnedWith.parentAgentId,name:e.identity.agentName};default:return}}

// chunk-sfn1dbxq.js scroll site apply [476733,476926) 193 units sha256 a0f13e099aa306219e346864390b3688042a90855b968a14c3cc35e56bbcfab9
function PY(e){let n=mse(e);if(!n)return{deny:"no such site"};if(pyt(n,e.origin))return{deny:"not this plugin's site"};return n.commit(e.offset,e.origin)?{}:{deny:"the window moved meanwhile"}}

// chunk-sfn1dbxq.js above-prompt scroll state [476538,476681) 143 units sha256 5759557bb5193988e9602f4f04ec9c26e7fbd00bf1887a07fc0bbb4a97ebe407
var fse=(e,n)=>aP({e:e.input,handlers:e.handlers,site:Ooe(e.event),signal:e.signal,origin:aJ(e.hookOrigin),bottom:(r)=>Promise.resolve(n(r))});

// chunk-24k7d6mw.js wheel accel setup [126204,126611) 407 units sha256 41a265b321acdf484c32d7c0dc3a80cdc0cc3a2fff8f227bc1343a8803528f8f
function gbt(h){let T=uq(),M=hs("wheelScrollAccelerationEnabled",!0).value;return t(`wheel accel: ${T.useDecayCurve?"decay":"window (native)"} \xB7 base=${T.base} \xB7 platform=${T.platform} \xB7 TERM_PROGRAM=${T.termProgram}${T.wheelFlood?" \xB7 wheelFlood":""}${T.jediTerm?" \xB7 jediTerm":""}${mLr(h)?" \xB7 jbBugConfirmed":""}${M?"":" \xB7 accelDisabled"}`),fbt(T.useDecayCurve,T.base,T.wheelFlood,M,h)}

// chunk-24k7d6mw.js wheel accel step [124336,126011) 1675 units sha256 ee800913cbcdf4658b7bf798e04d061de035b2808acf547256939fef694f08be
function pbt(h,T,M){if(h.jediTerm.trackpadGesture){let Te=M-h.time;if(!h.jbBypass||Te>gLr)h.jbBypass=!0,h.frac=0,h.mult=1;else if(T!==h.dir)h.frac=0;h.dir=T,h.time=M;let Me=VNo(h.jediTerm);if(h.accelEnabled)h.mult=Math.min(mbt,h.mult+cbt+Me*ubt);h.frac+=dbt*h.mult;let Le=Math.floor(h.frac);return h.frac-=Le,Le}if(h.jbBypass)h.jbBypass=!1,h.pendingFlip=!1,h.wheelMode=!1,h.burstCount=0,h.frac=0,h.dir=0;if(!h.useDecayCurve){if(h.wheelFlood){let Me=M-h.time;return h.time=M,h.dir=T,h.mult=Me>QAe?h.base*JSt:h.base,Math.max(1,Math.floor(h.mult))}if(h.wheelMode&&M-h.time>obt)h.wheelMode=!1,h.burstCount=0,h.mult=h.base;if(h.pendingFlip){if(h.pendingFlip=!1,T!==h.dir||M-h.time>XSt)return h.dir=T,h.time=M,h.mult=h.base,Math.max(1,Math.floor(h.mult));h.wheelMode=!0}let Te=M-h.time;if(T!==h.dir&&h.dir!==0)return h.pendingFlip=!0,h.time=M,0;if(h.dir=T,h.time=M,h.wheelMode)if(Te<YAe)if(++h.burstCount>=5)h.wheelMode=!1,h.burstCount=0,h.mult=h.base;else return 1;else h.burstCount=0;if(h.wheelMode&&h.accelEnabled){let Me=Math.pow(0.5,Te/zAe),Le=Math.max(ebt*Math.min(h.base,1),h.base*2),He=1+(h.mult-1)*Me+ZSt*Me;return h.mult=Math.min(Le,He,h.mult+tbt),Math.max(1,Math.floor(h.mult))}if(Te>QAe||!h.accelEnabled)h.mult=h.base;else{let Me=Math.max(YSt*Math.min(h.base,1),h.base*2);h.mult=Math.min(Me,h.mult+zSt)}return Math.max(1,Math.floor(h.mult))}let L=M-h.time,ee=T===h.dir;if(h.time=M,h.dir=T,ee&&L<YAe)return 1;if(!h.accelEnabled)return Math.max(1,Math.floor(h.base));if(!ee||L>abt)h.mult=Math.max(2,h.base),h.frac=0;else{let Te=Math.pow(0.5,L/zAe),Me=L>=rbt?sbt:ibt;h.mult=Math.min(Me,1+(h.mult-1)*Te+nbt*Te)}let he=h.mult+h.frac,we=Math.floor(he);return h.frac=he-we,we}

// chunk-sxm1dh4y.js store factory [865,887) 22 units sha256 6508d58a75571e0bf0e728ecc2032fd26fe54af2ba3688e35a81b9febdb26cb6
var a=new lt(()=>p());

// chunk-wz8v981w.js app state context read [1438,1463) 25 units sha256 8283159965298e4ce8b87528db1b3e9b88874c228a5c81ec3512b29319786dc7
var Ee=()=>Ae(Gfe),QO=Ee;

// chunk-z7whhrje.js host mode read [2670,2712) 42 units sha256 5bdc8e20db03d7756e1e344bc1a49c3722f16428f903779202d3e8e8f70b9566
function uq(){return S.of(B().host).get()}

// chunk-24k7d6mw.js wheel constants [124024,124140) 116 units sha256 3742cd42c34dc0430db85f822807f955a42fb5d908e1847b4c00b4cb97483e24
var QAe=40,zSt=0.3,YSt=6,JSt=3,XSt=200,ZSt=15,ebt=15,tbt=3,obt=1500,zAe=150,nbt=7,YAe=5,rbt=80,sbt=3,ibt=36,abt=500;

// chunk-24k7d6mw.js wheel constants two [124299,124336) 37 units sha256 2f55656841db06e36ac4078b9828465a5b30107899a4f2f3767b19473ef222ef
var dbt=0.35,cbt=0.008,ubt=0.4,mbt=4;

// chunk-24k7d6mw.js wheel factory [126011,126204) 193 units sha256 f5f62ba17eae25543944b403d75549db8a0875d16a0118641d0ad2bc5c413614
function fbt(h=!1,T=1,M=!1,L=!0,ee=tgt()){return{time:0,mult:T,dir:0,useDecayCurve:h,frac:0,base:T,pendingFlip:!1,wheelMode:!1,burstCount:0,jbBypass:!1,jediTerm:ee,wheelFlood:M,accelEnabled:L}}

// chunk-4bw62nzm.js mode value [76502,76526) 24 units sha256 8101caece0673c2e4ff47568a2729b605fc86874551a8ff4ed04f3f407851f3b
function B(){return n()}

// chunk-z7whhrje.js app state token [10370,10380) 10 units sha256 44c545ef311639526cacf94dbb68c04872a08fe95e375cf4b2b32f70b04008f1
var Gfe=R;

// chunk-z7whhrje.js wheel threshold [9540,9565) 25 units sha256 62228de53d7959e20bd9eb73f177b2a5b3c933c8c800d378f1719aefd02fca5f
var de=75,pe=250,gLr=200;

// chunk-js2bhabe.js setting hook [1114,1499) 385 units sha256 a081d61ddd710bc32aaba9e4701b464d7cf0d5105d80eb22972e7e89a191d209
function hs(n,i){let o=Lo(),r=o.includes("userSettings")&&w_();for(let e=o.length-1;e>=0;e--){let t=o[e];if(t==="projectSettings"&&r)continue;let s=fe(t)?.[n];if(s!==void 0)return{value:s,source:t}}if(lSe.includes(n)){let e=n,t=ce()[e];if(t!==void 0&&t!==wR[e]){let s=ten(e)?DOt(e,t):lbe(e,t);if(s!==void 0)return{value:s,source:"legacyGlobalConfig"}}}return{value:i,source:"default"}}

// chunk-4bw62nzm.js store class [56759,56979) 220 units sha256 71140b7614d00e7847290494af5dbca0275f1d28da176332470877062387b41d
class lt{#e;#t=new WeakMap;constructor(e){this.#e=e}peek(e){return this.#t.get(e.root)}of(e){let t=e.root,o=this.#t.get(t);if(o!==void 0)return o;let r=this.#e();return this.#t.set(t,r),r}drop(e){this.#t.delete(e.root)}}

// chunk-z7whhrje.js wheel platform read [9339,9540) 201 units sha256 f47f7b68f07cb935907019b736ee5f3ae9bb8c1399408a9de7cb4891fb6b9e79
function mLr(r){if(r.bugConfirmed)return!0;if(process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED!==void 0||process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS!==void 0)return r.bugConfirmed=!0,!0;return!1}

// chunk-sfn1dbxq.js scroll site lookup [476681,476733) 52 units sha256 17d9e1c0c45c84ec1e0316cd7eb4333465438df78785270ee63f8dd66431cf94
var mse=(e)=>ahe().get(_z(e.component,e.requestId));

// chunk-sfn1dbxq.js scroll site check [476009,476078) 69 units sha256 02ff744581ab1602209a7ea808458619fd7b42601e1f6f7fe4a66cb39670e35c
var pyt=(e,n)=>n.kind==="plugin"&&e.owner!==void 0&&e.owner!==n.name;

// chunk-sxm1dh4y.js store initial [709,865) 156 units sha256 6c351c38d3d2b40495904296e5bc991c210cc221b971af9e6ad280c0d8e06ef2
function p(){return gs({value:"",active:!1,launchWarning:null,linkSuppliedTexts:new Set,submittedLinkPrefill:null,vimMode:"INSERT",stash:null,cameBack:!1})}

// chunk-z7whhrje.js store fac [2647,2670) 23 units sha256 dcaf9be086448dd7ae1ee58f1094fd42dda9a744812fd028cf2e7369b581bd65
var S=new q(()=>new E);

// chunk-z7whhrje.js wheel gesture read [9266,9339) 73 units sha256 b3731d3deb42c61c7937e0a352007362c621d9bc71386fcb719e9ac95c1c417b
function VNo(r){let n=r.pendingArrowBoost;return r.pendingArrowBoost=0,n}

// chunk-bk5ct2gw.js setting schema [576824,577000) 176 units sha256 78156d7b5078fb64bd7bb00ccd7ccbbe2de1e059f0ee4d4d308a9069675024f0
function ce(){let e=re();if(bn())return e.testGlobalConfig;let n=e.readCache();if(n)return n;if(!e.enableSettled)throw Error("Config accessed before allowed.");return Ai(Ze())}

// chunk-bk5ct2gw.js setting group [555601,555684) 83 units sha256 602eca0fc8c4a0a5aa55cde9903ae82230883ca14ffc2ac88b367c1e7a804130
function DOt(e,n){if(n===void 0)return;let r=yw(e,n);return bw(e,r!==void 0),r??!1}

// chunk-x0dc37w9.js setting value read [88486,88550) 64 units sha256 86c04fbb82f122e6816a1c7c1505980edbc297b3a76c485effada447a6e04b7b
function fe(e){if(CT()&&Tp.has(e))return null;return y9e(e,M())}

// chunk-bk5ct2gw.js setting entry [555522,555601) 79 units sha256 ec7e8344bb4e06c9e9d50f9c82db3561e41b2c28ada1dd0971477fb679685fa6
function lbe(e,n){if(n===void 0)return;let r=yw(e,n);return bw(e,r!==void 0),r}

// chunk-wtch2p0g.js settings provider [5585,5823) 238 units sha256 b27fc4f4f0cf0ff5f4bfc3375fb21152fee96905b76022767ad920d27b5f80b0
function Lo(){let e=L1e(),n=ji();if(n.enabledSources?.allowed===e)return n.enabledSources.result;let t=new Set(e);t.add("flagSettings"),t.add("policySettings");let o=ws.filter((i)=>t.has(i));return n.enabledSources={allowed:e,result:o},o}

// chunk-bk5ct2gw.js setting key [555458,555496) 38 units sha256 d02a27546ebd0a2a1626989b59668c4e597dfe4c05ced74bd804963ae7287038
function ten(e){return jB.includes(e)}

// chunk-x0dc37w9.js setting context [88256,88349) 93 units sha256 b900c37ae2b0f46104989f4830304f2e9e088e272028fb3679a0f26db8000539
function w_(){let e=yn("projectSettings"),n=yn("userSettings");return!!e&&!!n&&ye(e)===ye(n)}

// chunk-bk5ct2gw.js setting lookup [559209,559326) 117 units sha256 188ec2f536134e8132ab33587ec96a615c717d2f1e712becba53ac2c08174e42
var wR=Ze(),E$s=new q(()=>new gf({now:Date.now,testGlobalConfig:{...wR,autoUpdates:!1},testProjectConfig:{...bue}}));

// chunk-z7whhrje.js store shell [1978,2647) 669 units sha256 824bb75983b0420f4b61e15290d25d3c6d6c6ac79541a33dc5c230e8f1399003
class E{value=void 0;get(){let r=U1t(),n=Su(),o=n?.wheelFlood??fLr(),u=n?Fse.includes(n.terminal??""):Nx.isJetBrainsIdeTerminal(),i=n?.wtSession??!!a.WT_SESSION,p=jg(),s=this.value;if(s&&s.xtversion===(r??"(no reply)")&&s.wheelFlood===o&&s.jediTerm===u&&s.wtSession===i&&s.xtermJs===p)return s;let d="darwin";return this.value={useDecayCurve:!o&&(p||d==="win32"||i),useAdaptiveDrain:p,base:u?2:ie(p,o,i),xtermJs:p,wheelFlood:o,jediTerm:u,termProgram:a.TERM_PROGRAM??"unset",termProgramVersion:a.TERM_PROGRAM_VERSION??"unset",xtversion:r??"(no reply)",wtSession:i,scrollSpeedEnv:a.CLAUDE_CODE_SCROLL_SPEED??"unset",platform:d},this.value}invalidate(){this.value=void 0}}

// chunk-js2bhabe.js settings store [777,1114) 337 units sha256 354b42c6bd4aedf52465c0547e58abf6da170d87c821b9739e3a75d6f0766655
var lSe=["theme","editorMode","verbose","preferredNotifChannel","autoCompactEnabled","autoScrollEnabled","fileCheckpointingEnabled","showTurnDuration","showMessageTimestamps","terminalProgressBarEnabled","todoFeatureEnabled","teammateMode","remoteControlAtStartup","autoUploadSessions","inputNeededNotifEnabled","agentPushNotifEnabled"];


export { vp, IV, _Fe, RFe, q1, Z1, tK, cK, Ine };
