// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-24k7d6mw.js key handler builder [450068,450435) 367 units sha256 23577632153927a67bbeab3e78f42f6cc85d4b67b003e94b8cc4b910747d72bd
function X1(h){let{focusables:T,focusIndexNow:M,focusByPerson:L,submit:ee}=h,he=T.length;return{"abovePrompt:next":()=>{if(he>0)L(((M()??-1)+1)%he)},"abovePrompt:previous":()=>{if(he>0)L(((M()??0)-1+he)%he)},"abovePrompt:press":()=>{let we=M(),Te=we===null?null:T[we]??null;if(Te?.tag==="Button")TIe(Te);else if(Te?.tag==="Input")ee(Te)},"abovePrompt:leave":h.leave}}

// chunk-24k7d6mw.js seat identity memo [450474,450586) 112 units sha256 06d249ba524ff31e51d1d5d0d2c0548aeeb12272f880817550bae18afd3289fa
var eK=(h,T)=>le((M)=>{let L=h.findIndex((ee)=>ee.plugin===M.plugin&&ee.handle===M.handle);if(L>=0)T(L)},[h,T]);

// chunk-24k7d6mw.js seat map, seat scans, select keyboard [450967,452484) 1517 units sha256 b16b805ab56b081fcf2b71391874670dd67a51db683e7920e6a2b9024cda2e57
function Ane(){let h=R(new Map);return Z(()=>({reportSeat:(T,M)=>{let L=h.current.get(T)??new Set;return L.add(M),h.current.set(T,L),()=>{L.delete(M)}},seatsOf:(T)=>h.current.get(T)}),[])}N();N();function v0(h,T,M){let L=R(new Map);P(()=>{let ee=[];for(let he of h){if(he.tag!==T)continue;let we=cje(he.plugin,he.element);if(L.current.has(we)&&L.current.get(we)!==he.value)ee.push(we);L.current.set(we,he.value)}if(ee.length>0)M(ee)},[h,T,M])}N();function C0(h,T,M){let L=qAt(T,M),[ee]=y(()=>KAt(T,M)),he=y(()=>h.get()?.get(L)??new Map),[we]=he;return P(()=>{if(KAt(T,M)===ee)h.set(new Map(h.get()).set(L,we))},[h,T,M,ee,L,we]),he}function nK(h,T,M){let[L,ee]=C0(A5t,T,M),he=R(new Map(L)),we=R(new Set);return v0(h,"Input",(Me)=>{for(let Le of Me)he.current.delete(Le);ee((Le)=>Xrt(Le,Me))}),{fields:Z(()=>({textOf:(Me,Le)=>L.get(cje(Me,Le)),edit({plugin:Me,handle:Le,element:He},$e){let je=cje(Me,He);he.current.set(je,$e),ee((Je)=>new Map(Je).set(je,$e)),nDr({plugin:Me,handle:Le,element:He,component:T,kind:"change",value:$e})}}),[L,T]),textNow:({plugin:Me,element:Le,value:He})=>{let $e=cje(Me,Le);return he.current.get($e)??L.get($e)??He??""},submit({plugin:Me,handle:Le,element:He,value:$e}){let je=cje(Me,He),Je=he.current.get(je)??L.get(je)??$e??"";if(we.current.has(je))return;we.current.add(je),nDr({plugin:Me,handle:Le,element:He,component:T,kind:"submit",value:Je}).then((at)=>{if(we.current.delete(je),at!==void 0&&(he.current.get(je)??Je)===Je)he.current.set(je,""),ee((xt)=>new Map(xt).set(je,""))})}}}


export { X1, eK, Ane, v0, C0, nK };
