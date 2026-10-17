// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-hyshef1z.js sha256 285b14e1859d23bdcd2835074dfdf24fee85ae4d31b641900bb11dc96e14e7d4
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { a } from './diff-dialog-spinner-host.js';

// chunk-hyshef1z.js the three spinner frame sets, their reversed cycles, Vdn and HIe, which pick the xterm-ghostty set from the terminal environment [661,1031) 370 units sha256 8369e57feaac30731bb0cd19f56ef0c578b3f815f0717ed91a00690b5ab3f212
var l=["\xB7","\u2722","\u2733","\u2736","\u273B","\u273B"],p=["\xB7","\u2722","\u2733","\u2736","\u273B","\u273D"],T=["\xB7","\u2722","*","\u2736","\u273B","\u273D"],d=[...l,...l.toReversed()],f=[...p,...p.toReversed()],y=[...T,...T.toReversed()];function Vdn(){if(a.TERM==="xterm-ghostty")return l;return p}function HIe(){if(a.TERM==="xterm-ghostty")return d;return f}


export { l, p, T, d, f, y, Vdn, HIe };
