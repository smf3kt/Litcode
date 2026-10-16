// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-6ccen3s8.js sha256 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The keybinding editor carries the chord splitter the row reader calls and the legacy names it
// rewrites; this chunk's lodash `mapValues` is three statements, and every helper under it is
// already carried by the internals copy rather than copied a second time.
import { h9, Q, Re } from './plugin-chain-keys-editor-source.js';
import { Lxr, uU, Wpe, zZ } from './plugin-chain-lodash-internals-source.js';

// chunk-6ccen3s8.js `Ace` — one row per binding: the chord split into the keys it is made of, the action as the file wrote it, and the context the block named [10481,10621) 140 units sha256 2e65a6af84bf5b3087b4fde7e0608dbd030d1a19cf546f2d1c709225fdc70898
function Ace(e){let r=[];for(let n of e)for(let[s,c]of Object.entries(n.bindings))r.push({chord:h9(s),action:c,context:n.context});return r}

// chunk-6ccen3s8.js `ge` — the blocks as the runtime reads them: each binding map is mapped value-wise, and a value that is one of the legacy action names is replaced by the name it is read as [11037,11145) 108 units sha256 64c7274aba1695ec19729ed009560e86bede7506769493f7a17b9295e7bc0377
function ge(e){return e.map((r)=>({context:r.context,bindings:oo(r.bindings,(n)=>n!==null&&Q(n)?Re[n]:n)}))}

// chunk-4bw62nzm.js `Yr` — the own-key walk this chunk's `mapValues` iterates with — and `JMt`, the name it calls it by [21687,21738) 51 units sha256 11f2fefbd779b9b0a242028e95591d0de8a7b267165b92b975d68bf6c7e5c9e1
function Yr(e,t){return e&&Lxr(e,t,Wpe)}var JMt=Yr;

// chunk-4bw62nzm.js `Di` — this chunk's `mapValues`: the iteratee folded to arity three, the object walked by its own keys, and each value replaced by the result [24850,24936) 86 units sha256 3ce61daec88280223b4d47d2a1b14308733371d76ba89810937f3cd940ab6565
function Di(e,t){var o={};return t=uU(t,3),JMt(e,function(r,i,s){zZ(o,i,t(r,i,s))}),o}

// chunk-4bw62nzm.js `oo` — the name the keybinding chunk reaches that map-values by, which is why the mapper above can be copied before it [24936,24946) 10 units sha256 818c9f775a01351cb6db5140bfd9be59971cf8c3042b0fad00fea1b8f03d2878
var oo=Di;


export { Ace, ge, Di, oo };
