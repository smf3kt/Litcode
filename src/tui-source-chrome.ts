// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { w } from './tui-react-memo.js'; import { s,n } from './tui-base-components.js';
import { Fragment as X,jsx as e,jsxs as r } from './tui-jsx.js'; import { Se } from './tui-footer-parts.js';
import { te } from './tui-symbols.js'; const Rzt=mode=>mode==='bash'?'bashBorder':'promptBorder'; const IP='\u2193';
var vde=`${IP} `;
function Tde(h){let he=w(11),{left:T,width:M,leading:L,leadingPressed:ee}=h,we;if(he[0]!==L||he[1]!==ee)we=L&&e(n,{dimColor:!ee,children:vde}),he[0]=L,he[1]=ee,he[2]=we;else we=he[2];let Te;if(he[3]!==T)Te=e(Se,{children:T}),he[3]=T,he[4]=Te;else Te=he[4];let Me;if(he[5]!==we||he[6]!==Te)Me=r(n,{wrap:"truncate-end",children:[we,Te]}),he[5]=we,he[6]=Te,he[7]=Me;else Me=he[7];let Le;if(he[8]!==Me||he[9]!==M)Le=e(s,{height:1,width:M,overflow:"hidden",children:Me}),he[8]=Me,he[9]=M,he[10]=Le;else Le=he[10];return Le}
function tH(h){let we=w(6),{isLoading:T,isScreenReader:M,themeColor:L}=h,he=L??void 0,Te;if(we[0]!==M)Te=M?e(X,{children:"$\xA0"}):r(X,{children:[te.pointer,"\xA0"]}),we[0]=M,we[1]=Te;else Te=we[1];let Me;if(we[2]!==he||we[3]!==T||we[4]!==Te)Me=e(n,{color:he,dimColor:T,children:Te}),we[2]=he,we[3]=T,we[4]=Te,we[5]=Me;else Me=we[5];return Me}
// `nP` (815017) and `uT` (815565): the composer pointer, which bash mode paints `!` in
// `bashBorder`. `Zxs` is chunk-3cynezh1.js 3948. The agent-chip arm of `uT` (an agent label
// clipped to `Pzt`) is not ported: this host has no composer agent chip, so the arm is unreachable.
const Zxs="\xA0";
function uT({mode:h}){return(h==="bash"?"!":te.pointer)+Zxs}
function nP(h){let ee=w(11),{mode:T}=h,he;if(ee[2]!==T)he=uT({mode:T}),ee[2]=T,ee[3]=he;else he=ee[3];let we=he;if(T==="bash"){let Te;if(ee[4]!==we)Te=e(n,{color:"bashBorder",children:we}),ee[4]=we,ee[5]=Te;else Te=ee[5];return Te}let Te;if(ee[9]!==we)Te=e(n,{dimColor:!0,children:we}),ee[9]=we,ee[10]=Te;else Te=ee[10];return Te}
function GE(h,T){if(T)return{};return{borderColor:Rzt(h),borderStyle:"round",borderLeft:!1,borderRight:!1,borderBottom:!0}}
export { GE,tH,nP,Tde };
