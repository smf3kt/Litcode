// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-9pedrxny.js sha256 fcabe4b83433a1de48b7eead9aff55c63c79666e930152fa81a7a6c19722aeb0
//   chunk-am9mebpw.js sha256 5f299ffd418fdb1dc31123d44ad13270aa6fcbb68e0686709982292c7a1e3f14
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { R, P, le, To, y, Z } from './plugin-chain-react-hooks.js';
import { on } from './plugin-chain-markdown-source.js';
import { us } from './plugin-chain-above-prompt-host-glue-source.js';
import { focusExit as bC, keyboardCohesion as ik, now as Xa } from './diff-dialog-frame-host.js';

// chunk-9pedrxny.js Dmt and its c helper: the interrupt and exit entries, the pinned key names, and the pending exit state [1035,1612) 577 units sha256 7b508663ca9864f6dbf99ff29b1b22029418d070b2f56f77968c26e5e33dc76a
function Dmt(i,r,e=!0){let{handleInterrupt:n,handleExit:t,exitState:o}=c(r,i);return{entries:Z(()=>e?[{action:"app:interrupt",run:n},{action:"app:exit",run:t}]:[],[e,n,t]),exitState:o}}function c(i,r){let{exit:e}=bC(),[n,t]=y({pending:!1,keyName:null}),o=Z(()=>r??e,[r,e]),a=ik(),l=us("app:interrupt","Global","Ctrl-C"),p=us("app:exit","Global","Ctrl-D"),d=a&&l?l:"Ctrl-C",m=a&&p?p:"Ctrl-D",u=iq((s)=>t({pending:s,keyName:d}),o),x=iq((s)=>t({pending:s,keyName:m}),o),b=le(()=>{if(i?.())return;u()},[u,i]),C=le(()=>{x()},[x]);return{handleInterrupt:b,handleExit:C,exitState:n}}


// chunk-am9mebpw.js iq: the two-press gesture within 800 ms, with the pending flag, confirm callback and timeout cleanup [1553,1918) 365 units sha256 5e7676ce900161925dee84aaeee90ac24a2134ef44b92f3fca5ec30a4dbb8a1b
var a=800;function iq(e,o,r,t=a){let s=on(),n=Xa(),i=R(0),c=R(void 0),u=To(()=>e(!1)),l=le(()=>{if(c.current)c.current(),c.current=void 0},[]);return P(()=>()=>{if(c.current)l(),u()},[l]),le(()=>{let d=n();if(d-i.current<=t&&c.current!==void 0)l(),e(!1),o();else r?.(),e(!0),l(),c.current=s.setTimeout(()=>{e(!1),c.current=void 0},t);i.current=d},[e,o,r,l,s,n,t])}



export { Dmt, iq };
