// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-yygmb66g.js sha256 93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { y, P, R, Z, le } from "./plugin-chain-react-hooks.js";
import { Lc } from "./plugin-chain-press-button.js";
import { Ey } from "./plugin-chain-client.js";
import { A5t, C5t, Xrt, nDr, qAt, KAt } from "./plugin-chain-above-prompt-select-source.js";
import { cje, v0 } from "./plugin-chain-above-prompt-seats-source.js";
import { Ohe } from "./plugin-chain-press-dispatch-source.js";
import { jPn } from "./plugin-chain-press-source.js";
import { b3 } from "./plugin-chain-source.js";

// chunk-tvdq3hrk.js typed-text regex [6302,6379) 77 units sha256 e8bc67b0b32e1e7d8099f5981f91919a476c779ce6a9eba9d058f6f90e40b890
var fpr=new RegExp(`[${b3.escape}${b3.loneSurrogate}${b3.placeholder}]`,"u");

// chunk-tvdq3hrk.js typed-text test [6379,6403) 24 units sha256 45866e299d7206b1edebec9ad0a0ba68ca25d4c16611269195ee4500071b0ca0
var QT=(e)=>fpr.test(e);

// chunk-24k7d6mw.js isTypedText [450586,450686) 100 units sha256 76e84c52f55de5fb7c667b49fcdc463c40e560d35fdc218459c657d668e6250c
var k0=(h,T)=>!T.ctrl&&!T.meta&&!T.super&&!T.escape&&!T.tab&&!T.return&&/^[^\p{C}\p{Z}]+$/u.test(h);

// chunk-24k7d6mw.js useSiteFields [451414,451598) 184 units sha256 449dbde890d7d3b5a8c87bdc7d306445f3472e1a60c36ccf88cb02e661dd9e59
function C0(h,T,M){let L=qAt(T,M),[ee]=y(()=>KAt(T,M)),he=y(()=>h.get()?.get(L)??new Map),[we]=he;return P(()=>{if(KAt(T,M)===ee)h.set(new Map(h.get()).set(L,we))},[h,T,M,ee,L,we]),he}

// chunk-24k7d6mw.js useInputFields [451598,452484) 886 units sha256 841c2f5cd0b349814b949410e29fa9676d2d7943e6fafcddfe608fc88e449e5b
function nK(h,T,M){let[L,ee]=C0(A5t,T,M),he=R(new Map(L)),we=R(new Set);return v0(h,"Input",(Me)=>{for(let Le of Me)he.current.delete(Le);ee((Le)=>Xrt(Le,Me))}),{fields:Z(()=>({textOf:(Me,Le)=>L.get(cje(Me,Le)),edit({plugin:Me,handle:Le,element:He},$e){let je=cje(Me,He);he.current.set(je,$e),ee((Je)=>new Map(Je).set(je,$e)),nDr({plugin:Me,handle:Le,element:He,component:T,kind:"change",value:$e})}}),[L,T]),textNow:({plugin:Me,element:Le,value:He})=>{let $e=cje(Me,Le);return he.current.get($e)??L.get($e)??He??""},submit({plugin:Me,handle:Le,element:He,value:$e}){let je=cje(Me,He),Je=he.current.get(je)??L.get(je)??$e??"";if(we.current.has(je))return;we.current.add(je),nDr({plugin:Me,handle:Le,element:He,component:T,kind:"submit",value:Je}).then((at)=>{if(we.current.delete(je),at!==void 0&&(he.current.get(je)??Je)===Je)he.current.set(je,""),ee((xt)=>new Map(xt).set(je,""))})}}}

// chunk-24k7d6mw.js isFieldOwnKey [452484,452663) 179 units sha256 a27abc4f73a77f3bda1ef8f1256b4a192d5302b73a426c5afa5b4649feff5c9d
var rK=(h,T)=>T.leftArrow||T.rightArrow||T.home||T.end||T.delete||T.pageUp||T.pageDown||h.length===1&&T.ctrl&&"abdefhknpuwy".includes(h)||h.length===1&&T.meta&&"bdfy".includes(h);

// chunk-24k7d6mw.js isFieldText [452663,452750) 87 units sha256 9f26ab57ee144c9ee5298696e158bf660077cf5383aaf7a3f1854dbd07dfeb20
var sK=(h,T)=>h!==""&&!T.ctrl&&!T.meta&&!T.super&&!T.tab&&!T.return&&!T.escape&&!QT(h);

// chunk-24k7d6mw.js useKeysAheadOfRender [452750,453585) 835 units sha256 2e924c85bd2be001c007d1458cbaad758c65933f19ae7910e8f1662a0f48b362
function lK(h){let T=Lc();Ey((M,L,ee)=>{let he=h.contextNow();if(T===null||he===null)return!1;if(L.wheelUp||L.wheelDown)return!1;if(!h.isAhead())return!1;let we=T.resolve(M,L,[he]);if(we.type==="match"){let Je=h.handlers[he]?.[we.action];if(Je!==void 0)return Je(),!0}let Te=h.focusedNow();if(Te?.tag==="Select"&&h.selectKeys(M,L))return!0;if(T.resolve(M,L,["Global"]).type==="match")return!1;let Me=M===""?ee:M;if(Te?.tag==="Input"){let Je=h.inputs.textNow(Te);if(L.backspace)return h.inputs.fields.edit(Te,[...Je].slice(0,-1).join("")),!0;if(sK(Me,L))return h.inputs.fields.edit(Te,Je+Me),!0;if(rK(M,L))return!0}let Le=h.contextRendered();if(Le===null)return!1;let He=T.resolve(M,L,[Le]),$e=He.type==="match"&&h.handlers[Le]?.[He.action]!==void 0,je=L.backspace||sK(Me,L)||rK(M,L);return $e||h.focusedRendered()?.tag==="Input"&&je})}

// chunk-24k7d6mw.js optionText [453782,453812) 30 units sha256 2f993924f101083b7f89a7ef7414e15872c3460f99cbc57fcdbc660fbd6349fa
var Ene=(h)=>h.label??h.value;

// chunk-24k7d6mw.js select key handlers [453812,453946) 134 units sha256 d9f3909d7fc93f50a858c1596b947c4fb3a5c7423bab58f98f7af60016d7f637
var Nne=(h)=>({"abovePrompt:highlightNext":()=>h.move(1),"abovePrompt:highlightPrevious":()=>h.move(-1),"abovePrompt:press":h.press});

// chunk-24k7d6mw.js useSelectFields [453950,456049) 2099 units sha256 565230dadea493602fe92d62eb95731248ca9e21ebce9f2f65cf6f4e3c4bdd88
function uK(h){let{focusables:T,focusIndex:M,focusIndexNow:L,setFocusIndex:ee,working:he,component:we,requestId:Te}=h,Me=Pt(M),[Le,He]=C0(C5t,we,Te),[$e,je,Je]=fd(()=>Ft(null));if(v0(T,"Select",(io)=>He((po)=>Xrt(po,io))),$e.key!==Mt(Me))je(Ft(Me));let at=Me?.options?.length??0,_t=Me!==null&&$e.isOpen,xt=Math.min($e.highlight,Math.max(0,at-1)),Ct=Z(()=>({pickedOf:(io,po)=>Le.get(cje(io,po)),open:_t?{plugin:Me.plugin,handle:Me.handle,highlight:xt}:null}),[Le,Me,_t,xt]);function Pt(io){let po=Ihe(T,io);return po?.tag==="Select"?po:null}function Mt(io){return io===null?null:cje(io.plugin,io.element)}function Ft(io){let po=Mt(io),co=po===null?void 0:Le.get(po)??io?.value;return{key:po,isOpen:io!==null,highlight:Math.max(0,(io?.options??[]).findIndex((_o)=>_o.value===co))}}function Et(io){let po=Je();if(po.key===Mt(io))return po;let co=Ft(io);return je(co),co}function Kt(io){let po=Pt(L());if(po===null)return;let co=Et(po),_o=po.options?.length??0,xo=Math.min(co.highlight,Math.max(0,_o-1));je(co.isOpen?{...co,highlight:(xo+io+_o)%Math.max(1,_o)}:{...co,isOpen:!0})}function Xt(){let io=Pt(L());if(io===null)return;let po=cje(io.plugin,io.element),co=Et(io),_o=io.options??[],xo=_o[Math.min(co.highlight,_o.length-1)];if(!co.isOpen||xo===void 0){je({...co,isOpen:!0});return}He((go)=>new Map(go).set(po,xo.value)),je({...co,isOpen:!1}),kNo({plugin:io.plugin,handle:io.handle,element:io.element,component:we,value:xo.value}).then((go)=>He((Mo)=>go!==void 0&&Mo.get(po)===xo.value?new Map(Mo).set(po,go.value):Mo))}function no(io,po){let co=Et(io),_o=io.options??[],xo=_o.length,go=co.isOpen?Math.min(co.highlight,xo-1):-1,Mo=_o.map((ko,Fo)=>(go+1+Fo)%xo).find((ko)=>{let Fo=_o[ko];return Fo!==void 0&&Ene(Fo).toLowerCase().startsWith(po)});if(Mo!==void 0)je({...co,highlight:Mo,isOpen:!0})}return{fields:Ct,handlers:Nne({move:Kt,press:Xt}),intercept(io,po){let co=Pt(L()),_o=po.ctrl&&io==="c",xo=k0(io,po)&&[...io].length===1;if(co===null||_o&&he)return!1;let go=Et(co);if(_o&&go.isOpen)return je({...go,isOpen:!1}),!0;if(_o)return ee(()=>null),!0;if(xo)no(co,io.toLowerCase());return xo}}}

// chunk-kjfwbh4w.js selectFromTerminal [45639,45712) 73 units sha256 58ff7f54b4084fb987573a043d0c5920c4c409a722e02b4bcf7d1f2102538990
var kNo=(o)=>Ohe(`ui.select ${o.plugin}`,jPn({...o,surface:"terminal"}));

// chunk-sfn1dbxq.js focusableAt [2336077,2336117) 40 units sha256 6b0f20891fae1a29db9ef536e51a5e4752dd6c95f1a3f00775fac9859aa3aec2
var Ihe=(e,n)=>n===null?null:e[n]??null;

// chunk-yygmb66g.js useControlledState [23446,23642) 196 units sha256 a15599ef64585e91266f39fca7bc4b750a69e1767d97d272ba49e16f7dade9ff
function fd(o){let[t]=y(()=>({value:kd(o)?o():o})),[i,a]=y(t.value),l=le((c)=>{let u=Md(c)?c(t.value):c;if(Object.is(u,t.value))return;t.value=u,a(()=>u)},[t]),f=le(()=>t.value,[t]);return[i,l,f]}

// chunk-yygmb66g.js function test [23642,23686) 44 units sha256 c94d07cc00bdbbd8d2f9e3dfbe4cf6bdb3db4a13f958c2f7173c534777e9aae0
function kd(o){return typeof o==="function"}

// chunk-yygmb66g.js function test (updater) [23686,23730) 44 units sha256 5646f2409cf94018b4328118e51c56e437cf0d4b7c374ec361f714495cde63b8
function Md(o){return typeof o==="function"}


export { fpr, QT, k0, C0, nK, rK, sK, lK, Ene, Nne, uK, kNo, Ihe, fd, kd, Md };
