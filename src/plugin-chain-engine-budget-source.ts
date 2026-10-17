// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { ZAe } from './plugin-chain-site-leaves.js';
import { IL } from './plugin-chain-raster-sites.js';
import { Nrt } from './plugin-chain-leaves.js';
import { y$ } from './plugin-chain-walker.js';
import { Q4t } from './plugin-chain-leaf-walkers.js';
import { cN, rQt, ESe, Ro, Dt, B } from './plugin-chain-style-props.js';
import { $A, ne } from './plugin-chain-source.js';
import { it } from './plugin-chain-host.js';
import { GPn, j3e } from './plugin-chain-render-keys.js';
import { kAt } from './plugin-chain-client-host.js';
import { Iye, s5t, sIn } from './plugin-chain-terminal.js';

// chunk-n3ykh62m.js string budget for one value in aIn/lIn [280596,280608) 12 units sha256 59ce12983fd6509dc5f40244ae103baecfe3cebab34f70558091e2409807f8b4
var Mur=256;

// chunk-n3ykh62m.js problem text limit for Sur/wur [261047,261059) 12 units sha256 29cf3015209616dcb6afc38c9ffb77ac8aa95c418c3297cdfb28f6978626ec54
var t5t=200;

// chunk-n3ykh62m.js drawn-character budget for one ui.render answer [270363,270375) 12 units sha256 c75630ffcff69820cf7937df9daabcd87828efb76ab9d02402b8dbd5ea320280
var OAt=1e5;

// chunk-n3ykh62m.js the tail a cut string reports [268419,268479) 60 units sha256 1e2e85c04cfea064524c181ea916caf18ec07668079b7fc3eb8810e544006bd6
var Aur=(e,n)=>`${n}\u2026 ${e} more characters, not drawn`;

// chunk-n3ykh62m.js drawn budget state [270375,270825) 450 units sha256 f88905bdb6f78e9f817662ed3747a85adbac1052089f84a83ac3eca470d80c40
function Rur(){let e=OAt,n=OAt,r=0,s=0,h=!1,y=!1;return{written:()=>r,drawn:()=>s,isCut:()=>y,isHeld:(b)=>{let w=b<=e;return r+=b,s+=w?b:0,e=w?e-b:0,y||=!w,w},markOf:(b)=>{let w=!h;return h=!0,w?Aur(b,""):""},field:(b)=>{let w=ne(b,n);return r+=b.length,s+=w.length,n-=w.length,y||=w!==b,w},shown:(b,w)=>{if(r+=b.length,b.length<=e)return e-=b.length,s+=b.length,b;let R=ne(b,e),T=!h;return s+=R.length,e=0,h=!0,y=!0,T?R+Aur(b.length-R.length,w):R}}}

// chunk-n3ykh62m.js clip a tree to the drawn budget [268980,270363) 1383 units sha256 5a87ac724b0439a3cc976f37d41e462822a15aeac724e2e0426dc04d78647b74
function Tur(e,n){if(e.type==="Code"){let{format:M,startLine:z,...N}=e.props,V=n.shown(N.source,`
`);return V===N.source?e:{...e,props:{...N,source:V}}}if(e.type==="Markdown"){let M=n.shown(e.props.text,`
`),z=n.isHeld((e.props.pressableLinks??[]).reduce((V,X)=>V+X.length,0));return M===e.props.text&&z?e:{...e,props:{...e.props,text:M,...!z&&{pressableLinks:[]}}}}if(e.type==="Client"){let{props:M}=e;return n.isHeld(M.key.length+M.module.length+Iws(M.props??null))?e:{type:"Text",children:[]}}if(e.type==="Button"){let M=Q4t(e.children??[]),z=e.props.label!==M.join("");return Cur(e,z?[e.props.label,...M]:M,n)}if(e.type==="Svg"||e.type==="Image")return lno(e,["alt"],n);if(e.type==="Input"){let M=n5t(e.props,["label","placeholder","submitLabel"],n),z=n.field(M.value??""),V=z===(M.value??"")?M:{...M,value:z};return V===e.props?e:{...e,props:V}}if(e.type==="Select")return Cur(e,[e.props.label??"",...e.props.options.map((M)=>M.label??M.value)],n);if(!(e.type==="Box"||e.type==="Text"||e.type==="Link"))return e;if(e.type==="Link"&&ZAe(e.props.href)&&!n.isHeld(Nrt(e.props.href).length))return{type:"Text",children:[]};let y=e.type==="Box"?cno(e,n):e,w=y.type==="Link"?{...y,props:n5t(y.props,["label"],n)}:y,{children:R}=e,T=(R??[]).map((M)=>typeof M==="string"?n.shown(M,`
`):Tur(M,n));return w.props===e.props&&T.every((M,z)=>M===R?.[z])?e:{...w,...R!==void 0&&{children:T}}}

// chunk-n3ykh62m.js run the budget over a tree and report cuts [270825,270929) 104 units sha256 6c46be29a8db830b9a63ff86ae6d71751d304a54526ec94f9cec7e2f4d6cbef1
function Nss(e,n){let r=Rur(),s=Tur(e,r);if(r.isCut())n({written:r.written(),drawn:r.drawn()});return s}

// chunk-n3ykh62m.js Text fallback when a leaf's strings do not fit [268839,268980) 141 units sha256 d1b830753b9520bd598eeed66f2f0ead53e284a6f2bb634674892c1199eaf78f
function Cur(e,n,r){let s=n.reduce((y,b)=>y+b.length,0);if(r.isHeld(s))return e;let h=r.markOf(s);return{type:"Text",children:h===""?[]:[h]}}

// chunk-n3ykh62m.js clip named string props [268651,268730) 79 units sha256 5174e487974ee8f17602c08915f064f1d8fda974e64b89927d9463caec485b77
function lno(e,n,r){let s=n5t(e.props,n,r);return s===e.props?e:{...e,props:s}}

// chunk-n3ykh62m.js clip selected props through the budget [268479,268651) 172 units sha256 d94496aecd64b8f4d84e65e51b9ba10fb28cb99badc552b5539da7f0affb7cd2
function n5t(e,n,r){let s=n.flatMap((h)=>{let y=e[h],b=typeof y==="string"?r.shown(y," "):y;return b===y?[]:[[h,b]]});return s.length===0?e:{...e,...Object.fromEntries(s)}}

// chunk-n3ykh62m.js drop a Box key that does not fit [268730,268839) 109 units sha256 9a8bfd43a268ab1fcb041873a14edf066899ca361a604bba4f4f8dec1498cddf
function cno(e,n){let{key:r,...s}=e.props??{};return r===void 0||n.isHeld(String(r).length)?e:{...e,props:s}}

// chunk-n3ykh62m.js plain Code problem lead [261002,261047) 45 units sha256 e17d40b4672ae13fdc0fcb2befe6d05df0ee32cce5779569da02c79f71c15bb5
var _ur=(e)=>`Code ${e.ordinal} drawn plain`;

// chunk-n3ykh62m.js plain Code problem text [261059,261272) 213 units sha256 9b57020b7d2c22d84f61d17c60b3da26e2a6a70063c20f83cb1113663161ac16
function Sur({ordinal:e,path:n,problem:r}){let s=n===void 0?"":` (path "${n}")`,y=r.length>t5t?`${ne(r,t5t)}...`:r;return`Code ${e}${s} is drawn as plain code, its source not a unified diff: ${y}`.replace(y$,"?")}

// chunk-n3ykh62m.js plain Link problem lead [261272,261319) 47 units sha256 87c4ad2d87a2d4e6fe1317f35a69466961088a16c332040756cc8ebcb2e46eee
var bur=([e])=>`Link ${e.ordinal} drawn plain`;

// chunk-n3ykh62m.js plain Link problem text [261319,261557) 238 units sha256 530fa17cd0c7d314dd25bf1d6fd7405780e2baad6637252db6b663a1b92fdd2b
function wur(e){let[{ordinal:n,problem:r},...s]=e,y=r.length>t5t?`${ne(r,t5t)}...`:r,w=s.length>0?`; ${s.length} more of its tree as well`:"";return`Link ${n} is drawn as plain text, no link made of it: its href ${y}${w}`.replace(y$,"?")}

// chunk-n3ykh62m.js noted-warning dedupe key [279366,279544) 178 units sha256 3831f1244794b2f8da3d7a1c41e076b25c55e8871f7a57a5a8ec812fbd85eac0
function DAt(e,n){let r=j3e.has(e.component);return[it().loadedModules.map((s)=>`${s.name}#${s.environmentId}`).join(),r?e.component:`${e.component} ${e.requestId}`,n].join(" ")}

// chunk-n3ykh62m.js module descriptor for an input [231541,231570) 29 units sha256 bb2606ac401270facecdaaca50677a5073aee0584a62373c7a5057ff23de1c53
var JAe=(e,n)=>kAt(GPn(e,n));

// chunk-n3ykh62m.js noted warning entry [280080,280198) 118 units sha256 3bdcdba9389ccc87953b4c350d0810a55853d3393eb6945358aaccf4da87bbe7
function iIn({input:e,origin:n},r,s){let{load:h,lead:y}=JAe(e,n);Iye({key:[h,e.component,r].join(" "),lead:y,text:s})}

// chunk-n3ykh62m.js text-cut problem text [280198,280306) 108 units sha256 947e7cb8663f8442517b6853d9538f22a5dea217abe503ebc91b87f2f515dc43
var pno=(e,{written:n,drawn:r})=>`ui.render (${e}): ${n} characters of text are drawn up to the first ${r}`;

// chunk-n3ykh62m.js own-props rewrite problem [280306,280532) 226 units sha256 4ecc7a1d96a07902ec8464fb0f13cbd2a07f582fcc43733d8895817bc17d2132
var Wss=(e)=>iIn(e,"own props",`ui.render (${e.input.component}): props.${e.names.join(", props.")} rewritten with more than ${OAt} characters of keys and short strings, or nested past ${ESe} deep; the engine's own is drawn`);

// chunk-n3ykh62m.js text-cut problem [280532,280596) 64 units sha256 63edf83e417c0600041ddcdad12f2ddab240fc421d553f2f28f8e1c4264a8789
var Gss=(e)=>iIn(e,"text cut",pno(e.input.component,e.clipped));

// chunk-n3ykh62m.js characters under a value [281152,281200) 48 units sha256 148cb03903b5632b4ea7ed5df8005a16a44d418b53611039159e2a0073d5b643
var Dur=(e)=>eIt(e).reduce((n,r)=>n+r.length,0);

// chunk-n3ykh62m.js cost of own props [280608,280843) 235 units sha256 5622ef81634011f7017f9ab74ea5ff6b0283944cb6c8ce7eea86b36529b28b94
function aIn(e,n){if(typeof e==="string")return e.length<=Mur?e.length:0;let r=Array.isArray(e);if(!r&&!$A(e))return 0;return n>ESe?1/0:r?iD(e).reduce((h,y)=>h+aIn(y,n+1),0):Object.entries(e).reduce((h,[y,b])=>h+y.length+aIn(b,n+1),0)}

// chunk-n3ykh62m.js clip own props through the budget [280843,281152) 309 units sha256 0482208d05ce68ad0fb1fa3e0b0937b418878d657fc4712ec15d5ee6cc64cc16
function lIn(e,n){if(typeof e==="string")return e.length<=Mur?e:n.shown(e," ");if(Array.isArray(e)){let y=iD(e),b=y.map((R)=>lIn(R,n));return b.every((R,T)=>R===y[T])?e:b}if(!$A(e))return e;let r=Object.entries(e),s=r.map(([y,b])=>[y,lIn(b,n)]);return s.every(([,y],b)=>y===r[b]?.[1])?e:Object.fromEntries(s)}

// chunk-n3ykh62m.js borderStyle problem text [282863,283066) 203 units sha256 b1d58b6676d080e928d705a568e623588db3ea21aa7eeb4a18b649c1b7f42bb5
function fIn(e){return`Box borderStyle ${typeof e==="string"?`"${IL(e)}" is not a border style`:`is ${cN(e)}, not a style name`} (the styles are ${[...rQt].join(", ")}); the Box is drawn with no border`}

// chunk-n3ykh62m.js clip drawn props and report own rewrites [281200,281622) 422 units sha256 f8fe495ab3194cdc10e3242b3642c31c952ea2363aee0887229c2e204bb33ea7
function zss(e,n,r){let s=n.props,h=Rur(),y=Object.entries(e.props).flatMap(([R,T])=>{if(T===s[R]||Dur(T)<=Dur(s[R]))return[];let M=aIn(T,0)>OAt,z=M?s[R]:lIn(T,h);return z===T?[]:[{key:R,drawn:z,isOwn:M}]}),b=y.filter((R)=>R.isOwn).map((R)=>R.key);if(h.isCut())r.cut({written:h.written(),drawn:OAt});if(b.length>0)r.own(b);return y.length===0?e:{...e,props:{...e.props,...Object.fromEntries(y.map((R)=>[R.key,R.drawn]))}}}

// chunk-n3ykh62m.js borderStyle handler [283066,283212) 146 units sha256 cf34334a36dad2dc61c917f2b4a94eb1f01b1b29b84e2c0c01b016512e0cbac9
function qss({input:e,style:n,origin:r}){let s=DAt(e,"borderStyle");if(s5t(s))return;Iye({key:s,lead:JAe(e,r).lead,text:sIn(e.component,fIn(n))})}

// chunk-n3ykh62m.js plain Code handler [279544,279688) 144 units sha256 7e6ee6498627506632298ef14d5805cd8a77d8e4a3a1d7e374b484adcfbe070f
function Uss({input:e,drawnPlain:n,origin:r}){let s=DAt(e,_ur(n));if(s5t(s))return;Iye({key:s,lead:JAe(e,r).lead,text:sIn(e.component,Sur(n))})}

// chunk-n3ykh62m.js plain Link handler [279688,279850) 162 units sha256 afd5f993218bef7855d5d414db3a970f2ca4cc54ad937e4a9fd8bdc0c0b5a3c8
function Bss({input:e,drawnPlain:n,origin:r}){let s=DAt(e,`${e.surface} ${bur(n)}`);if(s5t(s))return;Iye({key:s,lead:JAe(e,r).lead,text:sIn(e.component,wur(n))})}

// chunk-nyce03br.js copy a list through its own indices [6678,6770) 92 units sha256 ff058a725b75b5486de57808fddb172f011a77af9f17e0d5acbd9879698f8976
function iD(e){let t=B(e),o=[];o.length=t;for(let r=0;r<t;r+=1)if(r in e)o[r]=e[r];return o}

// chunk-nyce03br.js strings and keys under a value [43074,43275) 201 units sha256 869ef2fdad064eeeeb96dd22c43dbe05ebfe348a781e34733639c1f74827c737
function eIt(e){switch(typeof e){case"string":return[e];case"object":if(e===null)return[];return Array.isArray(e)?iD(e).flatMap(eIt):Object.entries(e).flatMap(([t,o])=>[t,...eIt(o)]);default:return[]}}

// chunk-nyce03br.js characters a Client props value costs [88707,88772) 65 units sha256 7b0474ab84c331b5b09860a62e259ecd35c2529209d58609e9f097578dae86b4
function Iws(e){let t=Ro();return Dt(e,0,t)===void 0?t.chars:1/0}


export { Tur, Rur, Nss, zss, Wss, Gss, qss, Uss, Bss, DAt, JAe, _ur, Sur, bur, wur, iIn, pno, Dur, aIn, lIn, fIn, Cur, lno, n5t, cno, Aur, OAt, Mur, t5t, iD, eIt, Iws };
