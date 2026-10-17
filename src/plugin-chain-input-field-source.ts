// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-tz1x0g31.js sha256 10751c84c86c36b891f188a164550476851171023694b1eec9ac94c3a9206657
//   chunk-z7whhrje.js sha256 3dca9fb572e08c43b779dd32b44d21858a177e021557bacb2a126e4ed268a3ac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { qt, y, P, Ae, Xe as e, Xe as r, s, n } from './plugin-chain-react-hooks.js';
import { xe } from './plugin-chain-select-field-source.js';
import { ae } from './plugin-chain-text-clamp-source.js';
import { wr } from './plugin-chain-input-field-host.js';

// chunk-kjfwbh4w.js `Gt` — the minimum field width (12) [22928,22938) 10 units sha256 4f141cff1a748f4aa809aaedb72de2a4cded5f35f727171bc0ba490bba844b8e
var Gt=12;

// chunk-kjfwbh4w.js `cdn` — the input-fields context: `textOf(plugin, element)` and `edit(site, value)` [22946,22963) 17 units sha256 fe4395b3a61c46d2e3082ada041542f0345d7bca3c09aed74a7da5705bf67828
var cdn=qt(null);

// chunk-kjfwbh4w.js `ddn` — the site-columns context [22967,22984) 17 units sha256 03119db9d7c00198a8978bc4b034ae1b32ca32176c524f846554673d0fa29923
var ddn=qt(null);

// chunk-tz1x0g31.js `ke` — the terminal-size hook; throws outside a provider [715,829) 114 units sha256 23d7fafa3a01951f86bc8e07ca1315b0fdd6751ca378d8c918f1af8188979650
function ke(){let e=Ae(Zm);if(!e)throw Error("useTerminalSize must be used within an Ink App component");return e}

// chunk-z7whhrje.js `Zm` — the terminal-size context the hook reads [10384,10400) 16 units sha256 06f627c83413d40f7687537d23297e571a637dedbb78d87fa61ef2da4700e293
var Zm=qt(null);

// chunk-kjfwbh4w.js `Vt` — the Input field site: focus, value/cursor state, label, editor or dim text, and the submit hint [23378,24196) 818 units sha256 2433c50b67a7afec1c186401e66b5decc451faa2ae9c837d7f4621a23dfa534e
function Vt(o){let{plugin:i,handle:p,element:a,placeholder:m}=o,f=xe({plugin:i,handle:p}),u=Ae(cdn),d=ke(),x=Ae(ddn)??d.columns,g=u?.textOf(i,a)??o.value??"",[h,T]=y(g.length),S=o.label===void 0?"":`${o.label}: `,k=` \u23CE ${o.submitLabel??"submit"}`,C=u!==null&&f.hasKeyboardFocus;return P(()=>{if(C)T(Number.MAX_SAFE_INTEGER)},[C]),r(s,{ref:f.ref,flexDirection:"row",flexShrink:0,elementKey:a,elementPlugin:i,onClick:f.onClick,children:[S!==""&&e(n,{bold:C,children:S}),C?e(wr,{value:g,onChange:(v)=>u.edit({plugin:i,handle:p,element:a},v),placeholder:m,columns:Math.max(Gt,x-ae(S)-ae(k)),cursorOffset:Math.min(h,g.length),onChangeCursorOffset:T,focus:!0,showCursor:!0,multiline:!1,disableEscapeDoublePress:!0}):e(n,{dimColor:g==="",wrap:"truncate-end",children:g===""?m??"":g}),C&&e(n,{dimColor:!0,children:k})]})}


export { Gt, cdn, ddn, ke, Zm, Vt };
