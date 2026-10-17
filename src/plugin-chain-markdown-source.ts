// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-06azbynj.js sha256 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { y, R, P, Z, Ae, Tc, s } from './plugin-chain-react-hooks.js';
import { nur, TIe } from './plugin-chain-press-dispatch-source.js';
import { Ya } from './tui-markdown-components.js';
import { eE, Gfe, oi } from './plugin-chain-markdown-host.js';

// chunk-06azbynj.js `vje`/`tun` — the double-activation window and the press delay (the statement also declares an unused `S0`) [135682,135731) 49 units sha256 7f061d92c230a5b845065acca4e8e7da664e597d42f164ce641baf518b26e03c
var S0={shift:!1,alt:!1,ctrl:!1},vje=300,tun=500;

// chunk-kjfwbh4w.js `mdn` — the link schemes the markdown renderer keeps pressable [24313,24354) 41 units sha256 9de0d3ab281e527a5b66230e0dbc52640a60f9607bd8c2fa8ec977a53468f93a
var mdn=new Set(["https","http","file"]);

// chunk-kjfwbh4w.js `Xt` — the Markdown leaf: draw the text, and on a click over a declared link press once the selection settles [24354,25250) 896 units sha256 5f7f230d84674a8f22ce63a1bee65689c77f74f74d0e98fb21128298c86ba911
function Xt({text:o,dimColor:i,press:p,elementKey:a,pressableLinks:m}){let f=on(),u=wC(),[d]=y(()=>f.now()),x=R(null),g=R({press:p,pressableLinks:m}),h=Tc(Ya,{dimColor:i,linkSchemes:mdn,stripPromptTags:!1,children:o});if(g.current={press:p,pressableLinks:m},P(()=>()=>x.current?.(),[]),p===void 0)return a===void 0?h:Tc(s,{flexDirection:"column",elementKey:a},h);return Tc(s,{flexDirection:"column",elementKey:a,elementPlugin:p.plugin,onClick:(T)=>{let S=T.hyperlinkUrl;if(!(S!==void 0&&!(T.mods.ctrl||T.mods.alt)&&nur(S,m))){T.allowDefault();return}if(T.isWindowActivation||f.now()-d<vje){T.dropAsStray();return}T.stopImmediatePropagation(),x.current?.();let v=u.subscribe(()=>{if(u.hasSelection())x.current?.()}),G=f.setTimeout(()=>{x.current=null,v();let L=g.current;if(L.press!==void 0&&nur(S,L.pressableLinks)&&L.press)TIe(L.press,{href:S})},tun);x.current=()=>{x.current=null,v(),G()}}},h)}

// chunk-1r9zp6s1.js `on` — the clock hook the leaf reads `now` and `setTimeout` from [17969,18071) 102 units sha256 6febe578af91003e9eef27bbca78ae26034c4e7b601a8fcaaff9096195636872
function on(){let o=Ae(eE);if(!o)throw Error("useClock must be used within a ClockProvider");return o}

// chunk-1r9zp6s1.js `wC` — the selection accessor the leaf subscribes to while a press waits [26659,27318) 659 units sha256 c68229fe24a2e90767fa0ae80262628aedb1339d2a6912f9b53b1fd044b26ecf
function wC(){Ae(Gfe);let o=oi().get(process.stdout);return Z(()=>{if(!o)return{copySelection:()=>"",copySelectionNoClear:()=>"",getSelectedText:()=>"",clearSelection:()=>{},hasSelection:()=>!1,getState:()=>null,subscribe:()=>()=>{},moveFocus:()=>{},setSelectionBgColor:()=>{}};return{copySelection:()=>o.copySelection(),copySelectionNoClear:()=>o.copySelectionNoClear(),getSelectedText:()=>o.getSelectedText(),clearSelection:()=>o.clearTextSelection(),hasSelection:()=>o.hasTextSelection(),getState:()=>o.selection,subscribe:(r)=>o.subscribeToSelectionChange(r),moveFocus:(r)=>o.moveSelectionFocus(r),setSelectionBgColor:(r)=>o.setSelectionBgColor(r)}},[o])}


export { vje, tun, mdn, Xt, on, wC };
