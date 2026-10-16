// @ts-nocheck
// Exact source components; provenance: research/ports/W44-statusline-copies.json.
import {w} from './tui-react-memo.js';
import {s,n,Do} from './tui-base-components.js';
import {jsx as e} from './tui-jsx.js';
import {bn} from './tui-bundle-runtime.js';
function WVt($e,je){return e(n,{dimColor:!0,wrap:"truncate",children:e(Do,{children:$e})},je)}
function jde(h){let M=w(11),{text:T}=h,L,ee,he,we;if(M[0]!==T){we=bn;He:{let Te=z$e(T);if(Te.length===1){const Me=e(Do,{children:T});let Le;if(M[5]!==Me)Le=e(n,{dimColor:!0,wrap:"truncate",children:Me}),M[5]=Me,M[6]=Le;else Le=M[6];we=Le;break He}L=s;ee="column";he=Te.map(WVt)}M[0]=T,M[1]=L,M[2]=ee,M[3]=he,M[4]=we}else L=M[1],ee=M[2],he=M[3],we=M[4];if(we!==bn)return we;let Me;if(M[7]!==L||M[8]!==ee||M[9]!==he)Me=e(L,{flexDirection:ee,children:he}),M[7]=L,M[8]=ee,M[9]=he,M[10]=Me;else Me=M[10];return Me}
var IVt=/\x1b\[[\d;]*m|\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
function z$e(h){let T=h.split(`
`);if(T.length===1)return T;let M=[T[0]],L="";for(let ee=1;ee<T.length;ee++)L+=(T[ee-1].match(IVt)??[]).join(""),M.push(L+T[ee]);return M}
export {jde};
