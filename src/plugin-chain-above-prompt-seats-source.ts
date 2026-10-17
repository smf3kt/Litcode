// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { N, P, R, Z, le } from "./plugin-chain-react-hooks.js";
import { TIe } from "./plugin-chain-press-dispatch-source.js";

// chunk-24k7d6mw.js key handler builder [450068,450435) 367 units sha256 23577632153927a67bbeab3e78f42f6cc85d4b67b003e94b8cc4b910747d72bd
function X1(h){let{focusables:T,focusIndexNow:M,focusByPerson:L,submit:ee}=h,he=T.length;return{"abovePrompt:next":()=>{if(he>0)L(((M()??-1)+1)%he)},"abovePrompt:previous":()=>{if(he>0)L(((M()??0)-1+he)%he)},"abovePrompt:press":()=>{let we=M(),Te=we===null?null:T[we]??null;if(Te?.tag==="Button")TIe(Te);else if(Te?.tag==="Input")ee(Te)},"abovePrompt:leave":h.leave}}

// chunk-24k7d6mw.js seat identity memo [450474,450586) 112 units sha256 06d249ba524ff31e51d1d5d0d2c0548aeeb12272f880817550bae18afd3289fa
var eK=(h,T)=>le((M)=>{let L=h.findIndex((ee)=>ee.plugin===M.plugin&&ee.handle===M.handle);if(L>=0)T(L)},[h,T]);

// chunk-24k7d6mw.js seat map [450967,451163) 196 units sha256 d16685589cf17a2aefe97661a7a02977271fbf9b07282a277c969623782fbd82
function Ane(){let h=R(new Map);return Z(()=>({reportSeat:(T,M)=>{let L=h.current.get(T)??new Set;return L.add(M),h.current.set(T,L),()=>{L.delete(M)}},seatsOf:(T)=>h.current.get(T)}),[])}N();N();

// chunk-24k7d6mw.js seat scans [451163,451414) 251 units sha256 ee9c3075d8b0401df2b0c43062956434ea064adab60b2b9a2b9cd52b80836230
function v0(h,T,M){let L=R(new Map);P(()=>{let ee=[];for(let he of h){if(he.tag!==T)continue;let we=cje(he.plugin,he.element);if(L.current.has(we)&&L.current.get(we)!==he.value)ee.push(we);L.current.set(we,he.value)}if(ee.length>0)M(ee)},[h,T,M])}N();

// chunk-kjfwbh4w.js seat key [45537,45567) 30 units sha256 d6568dab8d7483a9de1be60a15f6eedb1a329a7de0d0054a00883d7ad5b3b323
var cje=(o,i)=>`${o}\x00${i}`;


export { X1, eK, Ane, v0, cje };
