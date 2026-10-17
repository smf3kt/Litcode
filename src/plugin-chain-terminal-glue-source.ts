// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, Tc, s, n, Z, R, y, P, le, Ae, N } from './plugin-chain-react-hooks.js';
import { Cpr, aCe, zz } from './plugin-chain-records.js';
import { Ge, y$, He, l, a8 } from './plugin-chain-source.js';
import { De, Re } from './plugin-chain-hover-source.js';
import { ee } from './plugin-chain-press-button-source.js';
import { je } from './plugin-chain-walker-host-source.js';
import { vA, oIn, MF, mIn, kVe, $ur, iur, Frt, LAt, j3e, Ioe, Omt, l9, GPn } from './plugin-chain-render-keys-source.js';
import { kAt } from './plugin-chain-client-host.js';
import { dce, che, g4n, Fss, Mi, XD, i5t, t, OL } from './plugin-chain-terminal-host.js';

// chunk-kjfwbh4w.js the terminal glue: `yt` renders one tree through the draw callback, `pr` adds the boundary, the row helpers keep the held rows, `ur` resolves the on-screen input, `xr` reads the settled answer, `hdn`/`TU` assemble the surface node, `VH` names the terminal input [40655,44099) 3444 units sha256 8d492f431f10a8275f2081efe61093de35a05b418d760e703f87d791a67a47ff
function yt({tree:o,input:i,draw:p}){let{component:a,requestId:m}=i;return Tc(ee,{value:Z(()=>({component:a,requestId:m}),[a,m])},je(o,(f)=>p(uo(o,f,i))))}var ir=new Set(["Pane"]);function pr({tree:o,input:i,draw:p,submittedBy:a,onThrown:m}){let{component:f}=i,u=e(yt,{tree:o,input:i,draw:p}),d,x=()=>d??=pIn(GPn(i,a===void 0?void 0:[a]),o);return ir.has(f)?u:e(XD,{resetKey:o,fallback:e(yt,{tree:Ioe,input:i,draw:p}),telemetryMessage:()=>i5t(f,x(),"answer"),onError:(g)=>{m(o),dce.noteThrown(i,o),uIn({component:f,teller:x(),error:g})},children:u})}N();N();function ar(o){let i=R(!1);if(!o)i.current=!0;return i.current}function lr(o,i){let{input:p,drawn:a,contentRows:m,isFallback:f}=i;return o.rows!==void 0&&(f||o.drawn!==a||m!==void 0&&m>=o.rows)?{rows:void 0,wasOff:!1,input:p,drawn:a}:o.wasOff?{...o,wasOff:!1}:o}function mr(o,i){let{input:p,drawn:a,lastRows:m,contentRows:f}=i,u=f===0,d=!o.wasOff,x=o.input!==p,g=u&&o.rows===void 0;return d?{rows:m,wasOff:!0,input:p,drawn:a}:x?{rows:u?m:void 0,wasOff:!0,input:p,drawn:a}:g?{...o,rows:m,drawn:a}:{...o,drawn:a}}N();function fr(o){let{isOff:i,input:p,drawn:a,lastRows:m}=o,[f,u]=y(()=>({rows:i?m:void 0,wasOff:i,input:p,drawn:a})),d=i?mr(f,o):lr(f,o);if(d.rows!==f.rows||d.wasOff!==f.wasOff||d.input!==f.input||d.drawn!==f.drawn)u(d);return d.rows}N();function ur(o,i,p){let a=Mi()&&i,m=p===void 0?void 0:[p],[f]=y(()=>a?dce.heldRowsOf(o,m):void 0),[u,d,x,g]=g4n(a,y(()=>a?dce.askedOnScreen(o,m):void 0)[0]);return Z(()=>({site:u,input:d===void 0?o:{...o,props:{...o.props,onScreen:d}},lastRows:x??f,contentRows:g}),[o,d,u,x,g,f])}N();var cr=(o,i)=>o?`${i.component}\x00${i.requestId}\x00`+mIn(i):"";var dr=(o,i)=>t(`ui.render (${o.component} ${o.requestId}): site failed: ${l(i)}`,{level:"error"});function xr(o,i,{version:p,staticFrame:a,submittedBy:m}){let f=m===void 0?void 0:[m],[u,d]=y(()=>o?dce.settled(i,f):void 0),x=cr(o,i),h=o&&i.requestId!==""?MF(i):void 0;P(()=>h!==void 0?Fss(h):void 0,[h]),P(()=>{if(!o){d(void 0);return}if(a)return;let S=new AbortController;return che({signal:S.signal,origin:f}).ui.render(i).then((k)=>{if(!S.signal.aborted)d(k)},(k)=>{if(dr(i,k),!S.signal.aborted)d(Ioe)}),()=>{S.abort(new He("ui.render: superseded"))}},[x,p,o,m,a]);let T=le((S)=>d((k)=>k===S?Ioe:k),[]);return{drawn:u,onThrown:T}}var $e=(o)=>Re(OL(),(i)=>kVe(i,o));function hdn(o,i,p){let a=$e(o),m=Ae(Omt),{input:f,site:u,lastRows:d,contentRows:x}=ur(o,!m&&j3e.has(o.component)&&Frt(o.component),p),g=Z(()=>LAt(f),[f,a]),{drawn:h,onThrown:T}=xr(g,f,{version:a,staticFrame:m,submittedBy:p}),S=R(void 0),k=le((A)=>A!==void 0&&S.current===A,[]),C=ar(g)||m,v=fr({isOff:g&&$ur(f)===null,input:g?mIn(o):void 0,drawn:h,isFallback:h===Ioe,lastRows:d,contentRows:x});P(()=>{if(v!==void 0)dce.noteHeldRows(f,v)},[v,h,f]);let G=Mi(),L=Z(()=>(m||!G)&&h!==void 0&&iur(h),[m,G,h]);return{node:Tc(s,{ref:u,flexDirection:"column",renderEvent:vA,renderComponent:o.component,drawPending:g&&!h&&!C||void 0,minHeight:v,overflow:L?"hidden":void 0},g?h?pr({tree:h,input:f,draw:i,submittedBy:p,onThrown:(A)=>{S.current=A,T(A)}}):C?i(f):null:i(f)),drawn:h,hasThrown:k}}var TU=(o,i,p)=>hdn(o,i,p).node;N();function VH(o,i,p){let a=Z(i,p),m=$e({surface:"terminal",component:o,requestId:a.requestId}),f=Re(OL(),(d)=>d.get(oIn)??0),u=Mi();return Z(()=>{let d=l9.get();return{surface:"terminal",component:o,...d!==void 0&&{viewport:{columns:d.conversationColumns,rows:d.rows,isFullscreen:u}},...a}},[o,a,m,f,u])}

// chunk-kjfwbh4w.js `uo` — the input a drawn site answers when its descriptor names the same component [21203,21286) 83 units sha256 6a3f38edb11bc7105c32c111f58957557d432b0cd365cd729eb501298b02f281
function uo(o,i,p){let a=CAt(o,i);return a!==void 0&&a.component===p.component?a:p}

// chunk-n3ykh62m.js `bVe` — the WeakMap from a drawn site to its render descriptor, with `CAt` reading one input [233003,233140) 137 units sha256 0b894f4dd33cb2256118e028e8497002da1146022eeb4e51deafe64f40b07758
function Oto(){let e=new WeakMap;return{get:(n)=>e.get(n),set:(n,r)=>{e.set(n,r)}}}var bVe=Oto();var CAt=(e,n)=>bVe.get(e)?.of(n)?.input;

// chunk-n3ykh62m.js `cce`/`HM`/`s5t`/`sIn`/`CK`/`Iye` — the render-failure note: dedupe slot, warning log and notification [278989,279366) 377 units sha256 03afa7792c6f1586cc885ed17e4adb8932db1ad0fc1b505e5c95ed0d96bb0eb9
var cce=(e)=>e.replace(y$,"?");var HM=Ge(new Set,(e)=>e.clear());var s5t=(e)=>HM.has(`noted ${e}`)&&(HM.has(e)||!aCe());var sIn=(e,n)=>`ui.render (${e}): ${n}`;function CK({key:e,lead:n,text:r}){if(!aCe()||HM.has(e))return;HM.add(e),zz(n,r)}function Iye({key:e,lead:n,text:r}){let s=`noted ${e}`;if(!HM.has(s))HM.add(s),t(`${n}: ${r}`,{level:"warn"});CK({key:e,lead:n,text:r})}

// chunk-n3ykh62m.js `cIn`/`dIn` — the failure-note key and the thrown-while-drawn label [281622,281762) 140 units sha256 dd312aed000bcd4ba263fa7cb54858ac121f381addaf7277bd2effe985476b5f
var cIn=Object.freeze({AbovePrompt:"nothing was drawn",Pane:"the pane was closed"});var dIn=(e,n)=>[n.load,e,"threw while drawn"].join(" ");

// chunk-n3ykh62m.js `fno`/`Lur`/`Vss` — the module list behind one settled site, filtered to the plugins that contributed [282221,282478) 257 units sha256 008722cb4bf10cb1087fe2afdef9437f457631c61fb8964741b4aaebfaa02d29
var fno=()=>new WeakMap;var Lur=fno();import{isDeepStrictEqual as q$}from"util";var Vss=(e)=>e.filter((n,r)=>{let s=e[r+1],h=s!==void 0&&s.received===n.received&&q$(n.returned,s.returned);return n.plugin!==a8&&n.outcome!=="skipped"&&!h}).map((n)=>n.plugin);

// chunk-n3ykh62m.js `mno`/`uIn` — the failure text and the one note per component/teller key [282478,282706) 228 units sha256 5f6be11443d7d065c2c1eae86db6b72641cc540ff43f7f69590a586abf971419
var mno=(e,n)=>`ui.render (${e}) threw while drawn: ${n}; `+(cIn[e]??"the engine drew its own");function uIn({component:e,teller:n,error:r}){let s=dIn(e,n);if(s5t(s))return;Iye({key:s,lead:n.lead,text:mno(e,cce(String(l(r))))})}

// chunk-n3ykh62m.js `pIn` — the modules a render-failure note names: the settled site contributing plugins, or every candidate [282706,282863) 157 units sha256 07349bee2a70fe59b7dc5a86d8ce41823e703bc7a118c985820e8c7184d7502e
function pIn(e,n){let r=n&&bVe.get(n),s=(r&&Lur.get(r))?.flatMap((y)=>[y,...y.split("+")]),h=e.filter((y)=>s?.includes(y.name));return kAt(h.length===0?e:h)}


export { yt, pr, ir, ar, lr, mr, fr, ur, cr, dr, xr, $e, hdn, TU, VH, uo, Oto, bVe, CAt, Vss, fno, Lur, pIn, cIn, dIn, mno, uIn, cce, HM, s5t, sIn, CK, Iye };
