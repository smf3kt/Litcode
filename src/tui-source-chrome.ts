// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { w } from './tui-react-memo.js'; import { s,n } from './tui-base-components.js';
import { Fragment as X,jsx as e,jsxs as r } from './tui-jsx.js'; import { Se } from './tui-footer-parts.js';
import { te } from './tui-symbols.js'; const Rzt=mode=>mode==='bash'?'bashBorder':'promptBorder'; const IP='\u2193';
var vde=`${IP} `;
function Tde(h){let he=w(11),{left:T,width:M,leading:L,leadingPressed:ee}=h,we;if(he[0]!==L||he[1]!==ee)we=L&&e(n,{dimColor:!ee,children:vde}),he[0]=L,he[1]=ee,he[2]=we;else we=he[2];let Te;if(he[3]!==T)Te=e(Se,{children:T}),he[3]=T,he[4]=Te;else Te=he[4];let Me;if(he[5]!==we||he[6]!==Te)Me=r(n,{wrap:"truncate-end",children:[we,Te]}),he[5]=we,he[6]=Te,he[7]=Me;else Me=he[7];let Le;if(he[8]!==Me||he[9]!==M)Le=e(s,{height:1,width:M,overflow:"hidden",children:Me}),he[8]=Me,he[9]=M,he[10]=Le;else Le=he[10];return Le}
function tH(h){let we=w(6),{isLoading:T,isScreenReader:M,themeColor:L}=h,he=L??void 0,Te;if(we[0]!==M)Te=M?e(X,{children:"$\xA0"}):r(X,{children:[te.pointer,"\xA0"]}),we[0]=M,we[1]=Te;else Te=we[1];let Me;if(we[2]!==he||we[3]!==T||we[4]!==Te)Me=e(n,{color:he,dimColor:T,children:Te}),we[2]=he,we[3]=T,we[4]=Te,we[5]=Me;else Me=we[5];return Me}
function GE(h,T){if(T)return{};return{borderColor:Rzt(h),borderStyle:"round",borderLeft:!1,borderRight:!1,borderBottom:!0}}
export { GE,tH,Tde };
