// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-z9nv3z8k.js sha256 80a7eda1db7332eb0f201204442b37faab0dbd9fe0157f77f24a380f2208fed6
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The React layer is a seam in this build: no React runtime is carried. The hook functions are
// the adapter's (`Ae`, `R`, `Tc`, `Z`, `en`, `n`, `qt`, `s`, `tI`, `y`, `ZFt`), and the
// raster side is imported from the packages that already carry it (`gNs`/`Lss` from W45-61,
// `hNs` from W45-59, `fur` from W45-58).
import { Ae, R, Tc, Z, en, n, qt, s, tI, y, ZFt } from './plugin-chain-react-hooks.js';
import { gNs, Lss } from './plugin-chain-raster-surface.js';
import { hNs } from './plugin-chain-raster-mount.js';
import { fur } from './plugin-chain-ui-blit-source.js';

// chunk-kjfwbh4w.js `ee` — the focus/request context a site component reads its requestId from [25725,25741) 16 units sha256 7badedaa3d787f83cfb981e6288ee361aea2d6aa619cb07a725ddbd067feced3
var ee=qt(null);

// chunk-kjfwbh4w.js `Ce` — the requestId a component outside a focused site reports [30201,30219) 18 units sha256 bc2234a5ce128e6f2578768d723e161dbaadd253c9de948144d8845e99ee9c21
var Ce="detached";

// chunk-kjfwbh4w.js `Fo` — the paint scheduler: coalesce a paint within a frame, a max delay, and cancel [35779,36211) 432 units sha256 a749818623e23f017c46ca4abb92a111fe95abe5367f30a5259639ea8807a7bd
function Fo(o){let i=-1/0,p=null,a=null,m=1/0;function f(){if(a=null,m=1/0,p!==null){let x=p;p=null,i=Date.now(),o(x)}}function u(x){let g=Date.now()+x;if(a!==null&&m<=g)return;if(a!==null)clearTimeout(a);m=g,a=setTimeout(f,x)}function d(x,g){let h=Math.max(g,i+eg-Date.now());if(p=x,h<=0){if(a!==null)clearTimeout(a);f()}else u(h)}return{paint:(x)=>{d(x,0)},schedule:d,cancel:()=>{if(a!==null)clearTimeout(a);a=null,m=1/0,p=null}}}

// chunk-kjfwbh4w.js `Wo` — the mount object a surface hook registers: its props, its frame size and its paint [36211,36249) 38 units sha256 069cb2a271e1802611a6ade7425bf497c0907f8edd72e864dc45f316bed8f241
var Wo=(o,i,p)=>({...o,...i,paint:p});

// chunk-kjfwbh4w.js `_o` — write a painted frame to the node's raw text and mark it dirty [36249,36347) 98 units sha256 1b09f790de38ba732e3fc1a119eabab566779661fed68ae702baaa90cef91ef1
function _o(o,i){if(o===null||o.attributes.rawText===i)return;o.attributes.rawText=i,tI(o),ZFt(o)}

// chunk-kjfwbh4w.js `Bo` — the settle delay a waiting surface paints at [36347,36358) 11 units sha256 5f75149e30105ff70ebdd85ad064ff9f22484c125796cd3e34056e257a2833bd
var Bo=250;

// chunk-kjfwbh4w.js `nr` — schedule the next paint only while the surface is not complete [36358,36453) 95 units sha256 6867c9f35c7159bea6910119f70c0e2cbc567d5182af4b7e19725717190ce686
function nr(o,i,p){let a=i.standing();if(a!=="complete")o?.schedule(p,a==="progressing"?eg:Bo)}

// chunk-kjfwbh4w.js `Ko` — the surface hook: register the mount, paint through its scheduler, repaint on a frame change, unregister on unmount [36453,36835) 382 units sha256 b1ae756d1086030cec762655d23dde8fa3d88778c3ca6fd840edaf6f03c3c1ea
function Ko(o,i,p){let{plugin:a,elementKey:m,columns:f,rows:u}=o,d=Ae(ee),x=R(null),g=R(null);return en(()=>{let h={columns:f,rows:u},T=Fo((k)=>{_o(x.current,Lss(k,h,i)),nr(g.current,i,k)}),S=hNs(Wo({plugin:a,requestId:d?.requestId??Ce,key:m},h,T.paint));return g.current=T,()=>{S(),T.cancel(),g.current=null}},[a,m,f,u,d,i]),en(()=>{g.current?.cancel(),nr(g.current,i,p)},[p,i]),x}

// chunk-kjfwbh4w.js `jo` — the Raster site component: a raw-ansi element sized to the frame, driven by `Ko` [36835,37183) 348 units sha256 7f5a6e7b991fcea43bdf11a6416ed836de3afb0d656730ef905b424a04432882
function jo(o){let{plugin:i,elementKey:p,columns:a,rows:m,cells:f}=o,[u]=y(()=>gNs()),d=Z(()=>fur(f,a,m).words??new Uint32Array,[f,a,m]),x=Ko(o,u,d),g=Z(()=>Lss(d,{columns:a,rows:m},u),[d,a,m,u]);return Tc(s,{flexShrink:0,width:a,height:m,overflow:"hidden",elementKey:p,elementPlugin:i},Tc("ink-raw-ansi",{ref:x,rawText:g,rawWidth:a,rawHeight:m}))}

// chunk-z9nv3z8k.js `eg` — the frame interval the scheduler and `nr` wait by [615,656) 41 units sha256 b15fa736085c3f2f3507fe48c935d2b2d977597573f985f524b57d4b6f96ad4d
var eg=16,z1o=50,V1o=4,q1o=16384,CFr=250;


export { ee, Ce, Fo, Wo, _o, Bo, nr, Ko, jo, eg };
