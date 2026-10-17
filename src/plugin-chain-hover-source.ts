// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-5b7mmg84.js sha256 05f8803b1d7dea53e80b234ff14f162653a7ea46e889dfe05d364b7d13e7646b
//   chunk-p16hdq43.js sha256 0876812e3099d9038f2c1c8eaf18b9f878583ce15621d5867f58b46e91050c38
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, Ae, R, P, y, Tc, Rt, s, n } from './plugin-chain-react-hooks.js';
import { it } from './plugin-chain-host.js';
import { PU } from './plugin-chain-hover-host.js';
import { Ckn } from './plugin-chain-decorations-source.js';

// chunk-kjfwbh4w.js `Fe` — the hover-group store accessor [21290,21318) 28 units sha256 5dd47c17e36de060b4fa83a21c82f5877f7f8e3ca616dd4fb84da684ffc279a3
var Fe=()=>it().hoverGroups;

// chunk-kjfwbh4w.js `mt` — adjust one key's hover count, dropping the key at zero [21318,21425) 107 units sha256 21dc635991ffa56338a67abc33dd8b58586b4aa143a12dfca008d52468f29847
var mt=(o,i)=>Fe().setState((p)=>{let a=(p.get(o)??0)+i,m=new Map(p);return a>0?m.set(o,a):m.delete(o),m});

// chunk-kjfwbh4w.js `_t` — one group member's enter/leave/regroup, counting at most one group at a time [21425,21619) 194 units sha256 ba8f7de68504ca0afb1b337faa86f76cedae9fffb30ccc6388990b15f9b84678
function _t(){let o;function i(a){if(a!==void 0&&o===void 0)o=a,mt(a,1)}function p(){let a=o;if(a!==void 0)o=void 0,mt(a,-1)}return{enter:i,leave:p,regroup:(a)=>{if(o!==void 0&&o!==a)p(),i(a)}}}

// chunk-kjfwbh4w.js `Bt` — the `{plugin, scope}` group key of a site [21619,21707) 88 units sha256 d3927efd43dc8bf7ae3bea91d6cb65ecc6f7a59cd557a1ba252ae537d563538c
function Bt(o,i){let p=i?.scope;return o!==void 0&&p!==void 0?{plugin:o,scope:p}:void 0}

// chunk-kjfwbh4w.js `ft` — the hover overrides with `scope` removed [21707,21751) 44 units sha256 52a8f395bfe3e69b872d8b807125021ff888834b020a30da12254ddfdd8b550b
function ft(o){let{scope:i,...p}=o;return p}

// chunk-kjfwbh4w.js `ut` — subscribe to one group key: `isHot` and the enter/leave handlers [21755,22010) 255 units sha256 281f07a8eb1d51a1a841d03ed941a4a34d78f4a230eadd76165be3e1d4fbf2af
function ut(o,i){let p=o&&Dbr(o),a=Re(p===void 0?null:Fe(),(u)=>p!==void 0&&(u.get(p)??0)>0)??!1,m=R(null);m.current??=_t();let f=m.current;return P(()=>{f.regroup(p)},[f,p]),P(()=>f.leave,[f,i]),{isHot:a,onMouseEnter:()=>f.enter(p),onMouseLeave:f.leave}}

// chunk-kjfwbh4w.js `Kt` — the three color props the overrides normalize [22014,22063) 49 units sha256 338ec5d36bddbe02ae3ef75a3e497f3e59a16761e4efbe174fe40a630433e398
var Kt=["color","backgroundColor","borderColor"];

// chunk-kjfwbh4w.js `De` — copy the props, mapping named colors to hex [22063,22203) 140 units sha256 a43a8248c9a009097df984fd57ac4e8d9e1e189774bfa8947302f11f1b101055
function De(o){if(!o)return null;let i={...o};for(let p of Kt){let a=i[p],m=typeof a==="string"?Ckn(a):void 0;if(m!==void 0)i[p]=m}return i}

// chunk-kjfwbh4w.js `_e` — the scope-hovered context [22207,22221) 14 units sha256 8dc5ca35524d6ef8f5e5c358c69d2bec303877b59a4efce5cb8e8f8c6e7663b1
var _e=qt(!1);

// chunk-kjfwbh4w.js `jt` — the overrides and handlers for one site: group hot, or the enclosing scope [22221,22436) 215 units sha256 938c29226208d0ed85a50af61c5f224bf9b4fd1a1fec1101824ee419641c53e9
function jt(o,i,p){let a=Ae(_e),m=ut(o,p),u=(o?m.isHot:a)&&i?De(ft(i))??{}:{};return o?{overrides:u,handlers:{onMouseEnter:m.onMouseEnter,onMouseLeave:m.onMouseLeave,hoverFollowsPaint:!0}}:{overrides:u,handlers:{}}}

// chunk-kjfwbh4w.js `$t` — HoverScope: own hover state, group subscription, provider and layout merge [22436,22764) 328 units sha256 a3f7a00eebe022b90fb1d4d7b0cd9c5b1b2f613ee25dab36b5c631cabf2a58d6
function $t({isLive:o,elementKey:i,layout:p,hover:a,group:m,children:f}){let[u,d]=y(!1),x=ut(m,"Box"),g=o&&u,T=a!==void 0&&(m?x.isHot:g)?{...p,...ft(a)}:p;return Tc(_e.Provider,{value:g},Tc(s,{...De(T),elementKey:i,hoverFollowsPaint:!0,onMouseEnter:()=>{d(!0),x.onMouseEnter()},onMouseLeave:()=>{d(!1),x.onMouseLeave()}},...f))}

// chunk-kjfwbh4w.js `Ut` — HoverStyled: a Text or Box carrying the resolved overrides and handlers [22768,22928) 160 units sha256 93944592108a840238a06dcd89759d009f7cbf21766c2a393d498f50f2806f1c
function Ut({isInline:o,props:i,hover:p,group:a,children:m}){let f=o?"Text":"Box",{overrides:u,handlers:d}=jt(a,p,f);return Tc(o?n:s,{...De(i),...u,...d},...m)}

// chunk-5b7mmg84.js `u4n`/`c` — the no-op subscribe and the constant `undefined` source `Re` falls back to [720,758) 38 units sha256 cf06a0ac58966759e97457fcf9ad0419eba14a038d4fa7a2b0d11245852d5f04
var u4n=()=>a,a=()=>{},c=()=>{return};

// chunk-5b7mmg84.js `Re` — the store selector hook over `getSnapshot`/`subscribe` [758,1288) 530 units sha256 d4649217ba34eb09e5bd80e2af2009b8e82122cecdfaaac0782e65b40d821183
function Re(t,i){let n=Ae(PU),r=R(null);if(r.current===null)r.current={select:i,last:null,source:null,get:c,notifier:n,subscribe:u4n};let e=r.current;if(e.select=i,e.source!==t||e.notifier!==n)e.notifier=n,e.subscribe=t?n?.paced(t.subscribe)??t.subscribe:u4n;if(e.source!==t)e.source=t,e.last=null,e.get=t?()=>{let s=t.getSnapshot(),o=e.select;if(!o)return s;let u=e.last;if(u!==null&&u.snapshot===s&&u.select===o)return u.selected;let l=o(s);return e.last={snapshot:s,select:o,selected:l},l}:c;return Rt(e.subscribe,e.get,e.get)}

// chunk-p16hdq43.js `Dbr` — the `plugin\0scope\0scope` store key [2431,2481) 50 units sha256 9539d585a63dc894b132cdb4ff4074807613a8e948b842814940317366d15f44
var Dbr=(e)=>`${e.plugin}\x00scope\x00${e.scope}`;


export { Fe, mt, _t, Bt, ft, ut, Kt, De, _e, jt, $t, Ut, Re, Dbr, u4n, c };
