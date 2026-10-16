// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { w } from './tui-react-memo.js'; import { n } from './tui-base-components.js';
import { xy,Zc,em,N } from './tui-react-runtime.js'; import { Fragment as X,jsx as e,jsxs as r } from './tui-jsx.js';
import { bn } from './tui-bundle-runtime.js'; N();
function y(s){return s!==""}
function C(o,a){return r(Zc,{children:[a>0&&e(n,{dimColor:!0,children:" \xB7 "}),o]},em(o)?o.key??a:a)}
function Se(g){let m=w(5),{children:l}=g,i,c;if(m[0]!==l){c=bn;q:{let R=xy.toArray(l).filter(y);if(R.length===0){c=null;break q}i=R.map(C)}m[0]=l,m[1]=i,m[2]=c}else i=m[1],c=m[2];if(c!==bn)return c;let f;if(m[3]!==i)f=e(X,{children:i}),m[3]=i,m[4]=f;else f=m[4];return f}
export { Se };
