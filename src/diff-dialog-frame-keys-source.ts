// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-6ccen3s8.js sha256 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Ke, V } from './diff-dialog-keyhint-source.js';

// chunk-6ccen3s8.js Boo lists an action's chords in a context, e0n picks the best chord (bound first, then a printable key, then the longest), and yn names the keys that rank above printable characters [35388,35924) 536 units sha256 1e435e31d38ecf3e5f28395ef6cb35c21dba563ec36ca161fd900b41b8b016f3
function Boo(e,r,n){let s=[];return n.forEach((c,y)=>{if(c.context===r&&c.action===e&&!Ke(n,y))s.push(c.chord)}),s}function e0n(e,r,n,s){let c,y=-1;for(let b of Boo(e,r,n)){let w=s.some((P)=>P.context===r&&P.action===e&&V(P.chord,b)),h=b.length===1?b[0]:void 0,v=h!==void 0&&!h.ctrl&&!h.alt&&!h.meta&&!h.super,x=0;if(v&&yn.has(h.key))x=2;else if(v&&h.key.length===1)x=1;let _=(w?0:3)+x;if(_>y)c=b,y=_}return c}var yn=new Set(["up","down","left","right","enter","escape","tab"," ","pageup","pagedown","home","end","backspace","delete"]);


export { Boo, e0n, yn };
