// @ts-nocheck
// Exact UTF-16 bodies and bindings: research/ports/W290-background-footer-click.md.
import { w } from './tui-react-memo.js';
import { b } from './tui-bundle-runtime.js';
import { y } from './tui-react-runtime.js';
import { s, n } from './tui-base-components.js';
import { jsx as e } from './tui-jsx.js';
function Vde(h){let Te=w(8),{selected:T,onClick:M,children:L}=h,[ee,he]=y(!1);const we=T||ee;let Me;if(Te[0]!==L||Te[1]!==we)Me=e(n,{color:"background",inverse:we,children:L}),Te[0]=L,Te[1]=we,Te[2]=Me;else Me=Te[2];let Le=Me;if(!M){return Le}let He,$e;if(Te[3]===b)He=()=>he(!0),$e=()=>he(!1),Te[3]=He,Te[4]=$e;else He=Te[3],$e=Te[4];let je;if(Te[5]!==Le||Te[6]!==M)je=e(s,{onClick:M,onMouseEnter:He,onMouseLeave:$e,children:Le}),Te[5]=Le,Te[6]=M,Te[7]=je;else je=Te[7];return je}
export { Vde };
