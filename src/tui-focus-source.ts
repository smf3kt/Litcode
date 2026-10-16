// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-focus-copies.json.
import { ge, QQ } from './tui-color.js';

export function initializeFocusSource({ba,mxo}) {
function sNr(e){if(e)ba.terminalFocusGainedAt=Date.now();if(!e&&ba.terminalFocus==="blurred")return;ba.terminalFocus=e?"focused":"blurred",mxo(e),ba.terminalFocusChanged.emit()}
function KIe(){return ba.terminalFocus!=="blurred"}
function oX(){return ba.terminalFocus}
function J$o(){return ba.terminalFocusGainedAt}
function REe(e){return ba.terminalFocusChanged.subscribe(e)}
return {set:sNr,focused:KIe,state:oX,gainedAt:J$o,subscribe:REe};
}

function Xt(we){return we}
function Yt($t){return $t}
export function inputInvert(i) {
const C=null,g=false; let S;
S=!i?Xt:C?()=>ge.hex(C.hex)(C.char):g?Yt:QQ;
return S;
}
