// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-am9mebpw.js sha256 5f299ffd418fdb1dc31123d44ad13270aa6fcbb68e0686709982292c7a1e3f14
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-k1caxvem.js sha256 0486ac30af93e1201282a5264304b0c84a83f55ba2f901a884fbff45fbe6f3a5
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { y, en, P, Ae, R, le, Rt, Z } from "./plugin-chain-react-hooks.js";
import { Lc } from "./plugin-chain-press-button.js";
import { Ri, c9 } from "./plugin-chain-client-host.js";
import { eE } from "./plugin-chain-markdown-host.js";

// chunk-am9mebpw.js useKeybinding hook [777,1015) 238 units sha256 2f1bddbba01dba99ba91596c973b9037ef5dc246e074ecd45cd6526d4161a95d
function Ze(e,o,r={}){let{context:t="Global",isActive:s=!0}=r,n=Lc(),[i]=y(()=>({handler:o}));en(()=>{i.handler=o}),P(()=>{if(!n||!s)return;return n.registerHandler({action:e,context:t,handler:()=>i.handler(),singleKey:!0})},[e,t,n,s,i])}

// chunk-am9mebpw.js useKeybindings hook [1015,1357) 342 units sha256 146a82e2931b05060b200536418d2800fe2a7e1957ef5009d5344bf612cf3b24
function nn(e,o={}){let{context:r="Global",isActive:t=!0}=o,s=Lc(),[n]=y(()=>({handlers:e})),i=Object.keys(e).sort().join("|");en(()=>{n.handlers=e}),P(()=>{if(!s||!t)return;let c=Object.keys(n.handlers).map((u)=>s.registerHandler({action:u,context:r,handler:()=>n.handlers[u]?.(),singleKey:!0}));return()=>{for(let u of c)u()}},[r,i,s,t,n])}

// chunk-tvdq3hrk.js next open pane id [7723,7816) 93 units sha256 4b24bc3d622ff64c6def8f3f9193c8b1ac368ac585ab8262b1227d17a18651e6
function hro(e){let r=e.open.findIndex((n)=>n.id===e.focusedId);return e.open[r+1]?.id??null}

// chunk-tvdq3hrk.js consume focus request [15201,15327) 126 units sha256 2049e5293f29bebdb47cf046a53d16738aacfb60f8e3a2dfab9c9017badf0302
function gpr(e){let{focusRequest:r}=Ri().getState();if(r===null)return;e?c9(r):Ri().setState((n)=>({...n,focusRequest:null}))}

// chunk-k1caxvem.js default timer and external-store no-ops [1405,1497) 92 units sha256 3e98659749cfda985b18da83d1564f251055caef00b938934bc36a2864f87f33
var nI=(c,r)=>{let t=setTimeout(c,r);return()=>clearTimeout(t)},Cje=()=>()=>{},T4n=()=>null;

// chunk-1r9zp6s1.js debounced callback [23386,23672) 286 units sha256 32b0b631b6d55f0fca8959e65c1d27136e6e873a8baf0ed02bd93e40908496cc
function HG(o,r){let l=Ae(eE),u=R(o);u.current=o;let c=R(null),p=le((C)=>()=>c.current?.(),[]);Rt(p,T4n);let m=l?.setTimeout??nI;return Z(()=>{let C=(...v)=>{c.current?.(),c.current=m(()=>{c.current=null,u.current(...v)},r)};return C.cancel=()=>{c.current?.(),c.current=null},C},[m,r])}


export { Ze, nn, hro, gpr, HG };
