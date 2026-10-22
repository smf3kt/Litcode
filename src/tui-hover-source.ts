// @ts-nocheck
// Exact UTF-16 bodies and bindings: research/ports/W290-background-footer-click.md.
import { cq } from './tui-native-input-source.js';
function I1(n,u){let f=u<<1;return(n.cells[f]|n.cells[f|1])===0}function mo(n,u,f){if(u<0||f<0||u>=n.width||f>=n.height)return!0;return I1(n,f*n.width+u)}
function rv(n,u,f,m,y=!1){let g=new Set,C=cq(n,u,f),M=typeof y==="boolean"?y:Hs(n,y,C,u,f),_=C??void 0;while(_){if(qd(_,M))g.add(_);_=_.parentNode}for(let A of m)if(!g.has(A)){if(m.delete(A),A.parentNode)A._eventHandlers?.onMouseLeave?.()}for(let A of g)if(!m.has(A))m.add(A),A._eventHandlers?.onMouseEnter?.()}
function Hs(n,u,f,m,y){if(!mo(u,m,y))return!1;let C=f?.nodeName==="ink-text"||f?.nodeName==="ink-raw-ansi"?f.cachedLayout:void 0;if(!C)return!0;let M=iv(u,y,m,Math.floor(C.x)-1,-1),_=iv(u,y,m,Math.ceil(C.x+C.width),1);return!(M!==void 0&&_!==void 0&&cq(n,M,y)===f&&cq(n,_,y)===f)}function iv(n,u,f,m,y){for(let g=f+y;g!==m;g+=y)if(!mo(n,g,u))return g;return}function qd(n,u){let f=n._eventHandlers;return Boolean(f?.onMouseEnter||f?.onMouseLeave)&&!(u&&n.attributes.hoverIgnoresBlankCells)}
export { rv };
