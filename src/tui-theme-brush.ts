// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { zye } from './tui-text-style.js'; import { S1 } from './tui-theme-colors.js';
function Wn(e,r,o="foreground"){return(t)=>{if(!e)return t;if(e.startsWith("rgb(")||e.startsWith("#")||e.startsWith("ansi256(")||e.startsWith("ansi:"))return zye(t,e,o);let i=typeof r==="string"?S1(r):r;return zye(t,i[e],o)}}

export { Wn };
