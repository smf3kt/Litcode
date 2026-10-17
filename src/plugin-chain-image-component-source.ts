// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
//   chunk-fzk4rpqy.js sha256 bb2b14f95b2e509e9a2992709435d6e6e6841de2e5782960061c3721d61b38ae
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { unlink as ci, writeFile as di } from 'node:fs/promises';
// The component reads the wire layer, the source model, the mount writers and the host seam.
import { cFo, lFo } from './plugin-chain-image-wire.js';
import { Z4t, Uto, Dss } from './plugin-chain-image-model.js';
import { ELs, vLs } from './plugin-chain-raster-mount.js';
import { Ae, Ce, ee, en, le, n, P, R, s, Tc, y, Z } from './plugin-chain-react-surface.js';
import { er, y$ } from './plugin-chain-source.js';
import { t } from './plugin-chain-host.js';
import { LT, Z8n, aWo, $1t, bC, QO, ge, lPe } from './plugin-chain-image-host.js';
// `uFo` is the wire layer's probe query; it reads the same four bodies the wire copy carries.
import { u, b, k, d, v } from './plugin-chain-image-wire-source.js';

// chunk-886tf6ja.js `E` — the error code reader the probe reports [4814,4913) 99 units sha256 a84ab0a2488aed5689416393c679dde4e7f4b29aa980e121bd56b25ab3e7b5e4
function E(n){if(n&&typeof n==="object"&&"code"in n&&typeof n.code==="string")return n.code;return}

// chunk-fzk4rpqy.js `uFo` — the file-read probe query [7397,7472) 75 units sha256 08a5b7ba9931666f2bd4e2ec0b6d696cefd7c1c10696740748eb405149da2762
function uFo(e,n){return u(e,b),k(n),d(`i=${e},s=1,v=1,a=q,t=f,f=32`,v(n))}

// chunk-kjfwbh4w.js `Eo` — why the Image draws its alt instead of the source [30935,31632) 697 units sha256 07f81816c1b724107909c891ebef9d4825b31f7c765403afc9036f18b7c14d30
function Eo(o){let{hasRoot:i,placeholders:p,hasId:a,isReference:m,files:f}=o,u=p.state==="settled"&&p.value,d=!m||f.state==="settled"&&f.value,x=!d&&f.state!=="settled",g=f.state==="settled"?f.source:"";if(!i)return"the Image is not drawn under a terminal root";if(!u)return`the Image draws its alt here: the terminal draws no placeholder images (${p.source})`;if(!a)return"the Image draws its alt here: every 8-bit image id is in use";return x?"the terminal has not yet said whether it reads files on this machine; asked now, blit again":d?void 0:`the Image draws its alt here: this terminal cannot read files on this machine (${g}); a { file } or { shm } source shows nothing, bytes still draw`}

// chunk-kjfwbh4w.js the probe constants, `Lo`, `tr`, `rr`, `dt`, `or`, `Po`, `Ho` and the tracker `xt` [31686,33428) 1742 units sha256 38ea03a0d915394f37ee8e726accabd8c476f54707e4160c5234f75e374ab8d5
var xi=24,hi=4,yi=384,gi=new Set(["EAGAIN","EBUSY","EINTR","EMFILE","ENFILE","ENOSPC"]);async function Lo(o,i){let p=i.allocate(xi);if(p===void 0)return rr("probe: no image id to ask under");let a;try{a=lPe("tty-graphics-protocol",".rgba"),await di(a,Buffer.alloc(hi),{mode:yi});let[m,f]=await Promise.all([o.send({request:uFo(p,a),match:(u)=>u.type==="kittyGraphics"&&u.id===p}),o.flush()]);return m!==void 0?tr({value:m.message==="OK",source:`probe: file query answered ${m.message}`}):f?tr({value:!1,source:"probe: no reply to the file query"}):rr("probe: the query was dropped")}catch(m){let f=E(m)??"error",u=`probe: could not write its file (${f})`;return gi.has(f)?rr(u):tr({value:!1,source:u})}finally{if(i.free(p),a!==void 0)await ci(a).catch(()=>{})}}function tr(o){return{kind:"answered",answer:o}}function rr(o){return{kind:"inconclusive",source:o}}function dt(o,i){let p=$1t();if(!(o!==null&&i!==null&&Z8n()&&p.begin()))return;Lo(o,i).then((m)=>{let f=(m.kind==="inconclusive"?m.source:m.answer.source).replace(y$,"?");if(m.kind==="inconclusive"){t(`Terminal image files: not known yet (${f}); asked again when next needed`),p.unask();return}let u=m.answer.value?"yes":"no";t(`Terminal image files: ${u} (${f})`),p.answer({value:m.answer.value,source:f})}).catch((m)=>t(`Terminal image files: a listener threw (${m})`,{level:"warn"}))}var or=(o)=>(i)=>cFo({id:i,source:Dss(o.source),columns:o.columns,rows:o.rows});var Po=5000;function Ho(o){let{plugin:i,requestId:p,key:a}=o,m=a===void 0?"Image":`Image "${a}"`,f="",u=-1/0;return(d)=>{let x=Date.now();if(d===f&&x-u<Po)return;f=d,u=x,t(`${m} (${i}) in ${p}: the terminal refused its source: `+d.replace(y$,"?"),{level:"warn"})}}var xt={reactKey:void 0,source:void 0,box:void 0};

// chunk-kjfwbh4w.js `Ke` — the image id widths by capability level [33432,33644) 212 units sha256 ec10b57bd0fb71a5078831895b5b4af326829e7df5914d8e13f8930688904c78
var Ke={indexed:2,truecolor:3,smallIdWidth:8,wideIdWidth:24};function vo(){let[o,i]=y(Z8n);P(()=>aWo(i),[]);let p=!o||ge.level<Ke.indexed,a=ge.level>=Ke.truecolor;return p?void 0:a?Ke.wideIdWidth:Ke.smallIdWidth}

// chunk-kjfwbh4w.js `Mo` — the mount writer the alt answer registers through [33648,33834) 186 units sha256 1e3189080c5e6a6df9462b6283f8ed0830aed6dfcf716f3de563dd9a38b68d34
function Mo(o,i,p){let{plugin:a,requestId:m,key:f}=o,{columns:u,rows:d}=i;en(()=>{if(f===void 0)return;return ELs(vLs({plugin:a,requestId:m,key:f},{columns:u,rows:d},p))},[a,m,f,u,d,p])}

// chunk-kjfwbh4w.js `Oo` — the file-read answer the resolver subscribes to [33838,34038) 200 units sha256 fc0ec59d878a3076c3b1ac6d0a50bb55b1ebeabdd607b945012229ef8be1bea1
function Oo(o){let{terminalImages:i}=bC(),{internal_querier:p}=QO(),a=$1t(),[m,f]=y(()=>a.get());return P(()=>(f(a.get()),a.onSettle(()=>f(a.get()))),[a]),P(()=>{if(o)dt(p,i),f(a.get())},[o,p,i,a]),m}

// chunk-kjfwbh4w.js `Ao` — the resolver: allocate, transmit, track, register the alt [34038,35448) 1410 units sha256 d450cefbaddff32c3d86dc4ba57f3f6e1b986974f5e8d183cfa2791e0477973b
function Ao(o){let{plugin:i,elementKey:p,source:a,columns:m,rows:f}=o,{terminalImages:u}=bC(),{internal_querier:d}=QO(),g=Ae(ee)?.requestId??Ce,h=vo(),T=Z4t(a),S=Oo(T&&h!==void 0),k=!T||S.state==="settled"&&S.value,[C,v]=y(),[G,L]=y(),H=R(xt);return en(()=>{let K=u===null||h===void 0?void 0:u.allocate(h,Ho({plugin:i,requestId:g,key:p}));if(u===null||K===void 0)return;return v({id:K,images:u}),()=>{u.free(K),H.current=xt,v(void 0),L(void 0)}},[u,h,i,g,p]),en(()=>{if(C===void 0)return;if(!k){H.current=xt,L(void 0);return}let A=er(a),K=`${m}x${f}`,W=A!==H.current.reactKey,F=W?a:H.current.source??a,_=!W&&K===H.current.box,q=!W&&Uto(F);if(_||q)return;let V=C.images.transmit(C.id,or({source:F,columns:m,rows:f}),{resend:!Uto(F)});H.current={reactKey:A,source:F,box:K},L(V?C.id:void 0)},[C,a,k,m,f]),Mo({plugin:i,requestId:g,key:p},{columns:m,rows:f},le((A)=>{let K=Z4t(A);if(K)dt(d,u);let W=Eo({hasRoot:u!==null,placeholders:LT().get("kittyGraphics"),hasId:C!==void 0,isReference:K,files:$1t().get()});if(W!==void 0||C===void 0)return W;let F=Uto(A);if(F&&C.images.isBackedUp(C.id))return"the surface has not written its last frames (paused or busy); the object was not sent, unlink it and blit again later";if(!C.images.transmit(C.id,or({source:A,columns:m,rows:f}),{resend:!F}))return"the terminal sink refused the source";H.current={...H.current,source:A,box:`${m}x${f}`},L(C.id);return},[d,u,C,m,f])),G}

// chunk-kjfwbh4w.js `No` — the Image site component [35448,35771) 323 units sha256 fe3eeeaba43b046cc0ab4994e3e85f11b806883a833754ffcf7bbcd275d56278
function No(o){let{plugin:i,elementKey:p,columns:a,rows:m,alt:f}=o,u=Ao(o),d=Z(()=>u===void 0?"":lFo(u,a,m),[u,a,m]);if(u===void 0)return Tc(n,{dimColor:!0},f);return Tc(s,{flexShrink:0,width:a,height:m,overflow:"hidden",...p!==void 0&&{elementKey:p,elementPlugin:i}},Tc("ink-raw-ansi",{rawText:d,rawWidth:a,rawHeight:m}))}


export { E, uFo, Eo, Lo, tr, rr, dt, or, Po, Ho, xt, Ke, vo, Mo, Oo, Ao, No, xi, hi, yi, gi };
