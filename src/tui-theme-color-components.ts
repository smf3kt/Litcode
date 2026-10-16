// @ts-nocheck
// Exact source bodies: research/ports/W44-theme-color-copies.json.
import { w } from "./tui-react-memo.js";
import { jsx as e, jsxs as r } from "./tui-jsx.js";
import { s, n } from "./tui-base-components.js";
var Lvo="\u2588";
function lo(xo){return xo}
function fo(Oo){return`No color named "${Oo}"`}
var It=Lvo+Lvo;
function Y(ue){let L=w(2),{value:a}=ue,d;if(L[0]!==a)d=e(n,{color:a,children:It}),L[0]=a,L[1]=d;else d=L[1];return d}
function Sj(h){let ee=w(2),{children:T,when:M}=h;if(!(M===void 0?!0:M)){return null}let he;if(ee[0]!==T)he=r(n,{dimColor:!0,children:[" (",T,")"]}),ee[0]=T,ee[1]=he;else he=ee[1];return he}
export function createThemeColorComponents(i, f) {
  const A = key => i[key] ?? f[key];
  const renderItem = (Yt,$o)=>{let Eo=i[Yt]!==void 0;return r(s,{children:[e(Y,{value:A(Yt)}),e(n,{children:" "}),e(n,{color:$o?"suggestion":void 0,children:Yt}),e(Sj,{when:Eo,children:"custom"})]})};
  const renderPreview = (Ge)=>r(s,{flexDirection:"column",children:[r(n,{children:["current: ",e(Y,{value:A(Ge)})," ",A(Ge)]}),i[Ge]!==void 0&&r(n,{dimColor:!0,children:["preset: ",e(Y,{value:f[Ge]})," ",f[Ge]]})]});
  return { renderItem, renderPreview, Swatch: Y, empty: fo };
}
export { Y, Sj, lo, fo };
