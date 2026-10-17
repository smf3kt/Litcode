// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, Ae, Xe as e, Xe as r, s, n } from './plugin-chain-react-hooks.js';

// chunk-kjfwbh4w.js `ldn` — the clicked-press context [22992,23009) 17 units sha256 93407b63c21ded5b1e07dd72162598a254a592f08ec1035043411dc0db3f1c36
var ldn=qt(null);

// chunk-kjfwbh4w.js `udn` — the click adapter: allow the hyperlink default, run unless the activation was a stray or a window activation [23009,23128) 119 units sha256 31190fa76f05719349501f199b3f6b8abdcbc87f595ce03864382f889ee5030f
var udn=(o)=>(i)=>{let p=i.isWindowActivation||i.droppedAsStray;if(i.hyperlinkUrl!==void 0)i.allowDefault();if(!p)o()};

// chunk-kjfwbh4w.js `pdn` — the focused-node ref context [23132,23149) 17 units sha256 0a2dd0aa9ba3db1cbeef338836e710729b868477233431672e9d79c2faa3ecb8
var pdn=qt(null);

// chunk-kjfwbh4w.js `fdn` — the focused-press context [23153,23170) 17 units sha256 da4f992f7ed9d59545e4a46e079c190c9a4dba4be1998ce2809be9aed172cc8b
var fdn=qt(null);

// chunk-kjfwbh4w.js `xe` — the site-focus reader: focus flag, ref and click for one press [23170,23378) 208 units sha256 dc31bb82cf63069b27609673e3601b68d84bbab3288bd53d67aaa36542865c56
function xe(o){let{plugin:i,handle:p}=o,a=Ae(fdn),m=Ae(pdn),f=Ae(ldn),u=a!==null&&a.plugin===i&&a.handle===p;return{hasKeyboardFocus:u,ref:u?m??void 0:void 0,onClick:f?udn(()=>f({plugin:i,handle:p})):void 0}}

// chunk-kjfwbh4w.js `ht` — the visible option count [37183,37192) 9 units sha256 84f180a99a4bc45950f694c6c4d437f034869802dcc0ef01b4bb6dce7dc87904
var ht=8;

// chunk-kjfwbh4w.js `S3n` — the option window: first index, size, hidden count, rows [37192,37323) 131 units sha256 a87dbfae74f87e2156244bd7a9e0af5e1e1df117a1c34f3e00a2cb6c02e5532c
function S3n(o,i){let p=Math.max(0,i-ht+1),a=Math.max(0,Math.min(ht,o-p)),m=o-p-a;return{first:p,size:a,hidden:m,rows:a+(m>0?1:0)}}

// chunk-kjfwbh4w.js `gdn` — the select-fields context [37331,37348) 17 units sha256 19bdaf07ff3e413b93e5f2f3e2bba8df1fb6d2370ba6b2cfd31cd8b1cc65aaae
var gdn=qt(null);

// chunk-kjfwbh4w.js `sr` — the Select site component: the picked option, the open highlight window and the click [37348,38173) 825 units sha256 81fff593770f195b7d5ed5342522c38a3b0c3814bd4e7daaa02d38029022089c
function sr(o){let{plugin:i,handle:p,element:a,options:m}=o,f=xe({plugin:i,handle:p}),u=Ae(gdn),d=u?.pickedOf(i,a)??o.value,x=m.find((L)=>L.value===d),g=o.label===void 0?"":`${o.label}: `,{hasKeyboardFocus:h}=f,T=u?.open,S=T!==null&&T!==void 0&&T.plugin===i&&T.handle===p,k=S?T.highlight:0,{first:C,size:v,hidden:G}=S3n(S?m.length:0,k);return r(s,{ref:f.ref,flexDirection:"column",flexShrink:0,elementKey:a,elementPlugin:i,onClick:f.onClick,children:[r(n,{wrap:"truncate-end",children:[e(n,{bold:h,children:g}),x===void 0?e(n,{dimColor:!0,children:"none"}):e(n,{inverse:h&&!S,children:x.label??x.value}),e(n,{dimColor:!0,children:S?" \u25B4":" \u25BE"})]}),m.slice(C,C+v).map((L,H)=>e(n,{inverse:C+H===k,wrap:"truncate-end",children:`  ${L.label??L.value}`},L.value)),G>0&&e(n,{dimColor:!0,children:`  \u2026 ${G} more`})]})}


export { ht, S3n, gdn, fdn, pdn, ldn, udn, xe, sr };
