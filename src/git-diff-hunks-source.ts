// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-j8hqhz0c.js sha256 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
const F = 50, Tcr = 1e6, F3t = 400; // source chunk-j8hqhz0c.js diff caps
import { RAe } from './git-diff-status-source.js';

// chunk-j8hqhz0c.js ZQr: parse a unified diff into per-file hunks, with the file cap, oversized-section set and per-hunk line cap [28189,29373) 1184 units sha256 dd10cc022f7f05e75cb47c958bd3de682475792b57b27328bdb13ff388b19c9c
function ZQr(e){let n=new Map,r=new Set;if(!e.trim())return{hunks:n,skippedLarge:r};let s=e.split(/^diff --git /m).filter(Boolean);for(let o of s){if(n.size+r.size>=F)break;let i=o.indexOf(`
`),u=i===-1?o:o.slice(0,i),p=u.match(/^a\/(.+) b\/\1$/),h=p??u.match(/^(?:"a\/((?:[^"\\]|\\.)*)"|a\/(.+?)) (?:"b\/((?:[^"\\]|\\.)*)"|b\/(.+))$/);if(!h)continue;let S=p?p[1]:h[3]!==void 0?RAe(h[3]):h[4]??(h[1]!==void 0?RAe(h[1]):h[2]??"");if(o.length>Tcr){r.add(S);continue}let T=o.split(`
`),b=[],R=null,y=0;for(let A=1;A<T.length;A++){let E=T[A]??"",P=E.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);if(P){if(R)b.push(R);R={oldStart:parseInt(P[1]??"0",10),oldLines:parseInt(P[2]??"1",10),newStart:parseInt(P[3]??"0",10),newLines:parseInt(P[4]??"1",10),lines:[]};continue}if(R===null&&(E.startsWith("index ")||E.startsWith("---")||E.startsWith("+++")||E.startsWith("new file")||E.startsWith("deleted file")||E.startsWith("old mode")||E.startsWith("new mode")||E.startsWith("Binary files")))continue;if(R&&(E.startsWith("+")||E.startsWith("-")||E.startsWith(" ")||E==="")){if(y>=F3t)continue;R.lines.push(""+E),y++}}if(R)b.push(R);if(b.length>0)n.set(S,b)}return{hunks:n,skippedLarge:r}}

// chunk-j8hqhz0c.js pxn: parse git --shortstat totals [32005,32259) 254 units sha256 b8cc9854a1350bdff4101f0d88babdbff1372853cdc5dcc8db1e9cabd536b652
function pxn(e){let n=e.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);if(!n)return null;return{filesCount:parseInt(n[1]??"0",10),linesAdded:parseInt(n[2]??"0",10),linesRemoved:parseInt(n[3]??"0",10)}}


export { ZQr, pxn };
