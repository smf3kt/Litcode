// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-24k7d6mw.js scroll key handlers [444350,444563) 213 units sha256 20e50bd1c8d2aaae80a95da0d0611321fc13a138d75a1485d211068e436c23b3
function vFe(h){let{bodyRows:T,contentRows:M,scrollBy:L}=h;return{"pane:scrollUp":()=>L(-1),"pane:scrollDown":()=>L(1),"pane:pageUp":()=>L(-T),"pane:pageDown":()=>L(T),"pane:top":()=>L(-M),"pane:bottom":()=>L(M)}}

// chunk-24k7d6mw.js pane key merge [447294,447421) 127 units sha256 0d480a9c4a6794c371282dd8389c5e23fbe04219e803e800940bcd829333806e
var pne=(h,T,M)=>({...h,...vFe(T),...!M&&{"pane:scrollUp":h["abovePrompt:previous"],"pane:scrollDown":h["abovePrompt:next"]}});

// chunk-24k7d6mw.js window/cue computation [447421,447615) 194 units sha256 4c81a2eded2373cd5cdd48b5917a045ca1e9d9acf986618b3a64206830cc4695
function yne(h){let{budget:T,settledBudget:M,treeRows:L}=h,ee=Math.max(0,T),he=L>ee,we=he?Math.max(0,ee-1):ee;return{windowRows:we,hasCue:he,maxOffset:Math.max(0,L-we),bodyRows:Math.max(0,M-1)}}

// chunk-24k7d6mw.js collapse handle columns [448285,448295) 10 units sha256 0d591bba4a3f21bb8d290a1e09261076b99aa782ff85658e637ab11221ccca9f
var wne=5;

// chunk-24k7d6mw.js autofocus index [448698,448795) 97 units sha256 1c6f9954a68a20003b78c1db68ef4eefaa0f28d8ed9d9651e635fef7e7937a93
function kne(h){let T=h.length===0,M=h.findIndex((L)=>L.isAutoFocus);return T?null:Math.max(0,M)}

// chunk-24k7d6mw.js input/select context name [448795,448921) 126 units sha256 23379a426d33cf9a605e535dc088f917db52c5c136c1f8290268da6986be8017
function NI(h,T){switch(h?.tag){case"Input":return"AbovePromptInput";case"Select":return"AbovePromptSelect";default:return T}}

// chunk-24k7d6mw.js row settle debounce [448921,448933) 12 units sha256 6b186ecff64fc484925456e7a24f5b4865f35959a90f141925c514f231eacc1e
var vne=150;

// chunk-24k7d6mw.js hotkey map [448933,449175) 242 units sha256 d089fdd8e1c86965bdef48867b5dd3b82f30e52a81c697e173760f7f74072da6
function G1(h){let T=new Map;function M(L){if(typeof L==="string")return;if(L.type==="Button"){let{hotkey:ee}=L.props;if(ee!==void 0)T.set(ee,L.press);return}if(L.type!=="engine")for(let ee of L.children??[])M(ee)}if(h!==void 0)M(h);return T}

// chunk-24k7d6mw.js cue fully laid out check [449175,449420) 245 units sha256 f2dfe2ad06253cd1b0be82558e0229832ccda7f62ad0d27596fb560977f13747
function Tne(h,T){let{hasCue:M,content:L,offset:ee,windowRows:he}=h;if(!M)return!0;if(L===null||T===void 0||T.size===0)return!1;return[...T].every((we)=>{let Te=F4(we,L),Me=we.yogaNode?.getComputedHeight()??0;return Me>0&&Te>=ee&&Te+Me<=ee+he})}

// chunk-24k7d6mw.js plugin overlap check [449420,449506) 86 units sha256 77438696d389800c45d34fcfa3850021d0874dd7fdac09ef288370f4845a9265
var _ne=(h,T)=>h.length>0&&T.length>0&&!T.some((M)=>h.some((L)=>L.plugin===M.plugin));

// chunk-1r9zp6s1.js yoga absolute top [28549,28670) 121 units sha256 f3cd3d0549af9039786cf616cab8230e7848113496a5720f548548f83286ae71
function F4(o,r){let l=0,u=o;while(u!==void 0&&u!==r)l+=u.yogaNode?.getComputedTop()??0,u=u.parentNode;return u===r?l:-1}


export { pne, yne, wne, kne, NI, vne, G1, Tne, _ne, vFe, F4 };
