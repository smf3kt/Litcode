// Z0/z$/glyphs/Ne, exact erased bodies and module digests: research/ports/W292-model-picker-effort-view.md.
import type { EffortLevel } from './effort-command.js';
import { w } from './tui-react-memo.js';
import { n } from './tui-base-components.js';
import { jsx as e } from './tui-jsx.js';

var Xxs="○",Enn="◐",Ivo="●",Jxs="◉",Qxs="◈",ay="⚠";
function z$(h: EffortLevel | undefined){switch(h){case"low":return Xxs;case"medium":return Enn;case"high":return Ivo;case"xhigh":return Jxs;case"max":return Qxs;default:return Ivo}}
function Z0(h: { effort?: EffortLevel }){let ee=w(5),{effort:T}=h;const M=T?"claude":"subtle",L=T??"low";let he;if(ee[0]!==L)he=z$(L),ee[0]=L,ee[1]=he;else he=ee[1];let we;if(ee[2]!==M||ee[3]!==he)we=e(n,{color:M,children:he},undefined),ee[2]=M,ee[3]=he,ee[4]=we;else we=ee[4];return we}
function Ne(e: unknown){if(!e)return!1;if(typeof e==="boolean")return e;let n=String(e).toLowerCase().trim();return["1","true","yes","on"].includes(n)}

export { Z0, z$, ay, Ne };
