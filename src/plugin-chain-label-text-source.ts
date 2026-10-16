// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-qq2mgstr.js sha256 84f8f93155c8c7dcf287306959a002f20e09b31cfe97bd68e2ae14048f290e6f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The sanitise pass a plugin label goes through before the bar draws it (W45-36). The chain is
// `Mde` → `O` → `Y` → `Zs` → the grapheme-budget preview, with `dn`/`R`/`Ae`/`mn`/`V`/`g3`/`ke`/
// `xg` as the stages inside it. `ae` is the width primitive, whose host call is this product's own
// `Bun` seam in ./tui-render-host.ts, `ra` is the grapheme segmenter it and `dn` read, `Ar`/`jo` are
// the first-line cut and the clamp, `$8` is the identity, `Zs` is the normalise pass
// (./plugin-chain-normalize-source.js) and `ne` the grapheme-safe cut the chain copy already
// carries. Only the tab and ESC-sequence expander under `Zs` is still a boundary, and
// ./plugin-chain-text-ansi.ts is where that boundary names itself.
import { $8, Ar, ae, jo, ra } from './plugin-chain-text-clamp-source.js';
import { Zs } from './plugin-chain-normalize-source.js';
import { ne } from './plugin-chain-source.js';

// chunk-qq2mgstr.js declares on and an, the two ignore classes: Default_Ignorable_Code_Point and the format category [8024,8080) 56 units sha256 aa78f230888df2d334bb47595a3c7d6e4364d6efc98b7213fd85e3e839ed6fe8
var on=/\p{Default_Ignorable_Code_Point}/u,an=/\p{Cf}/u;

// chunk-qq2mgstr.js declares L, is this character invisible: an ignorable, a line or paragraph separator, a braille blank, a surrogate, U+10EFEE, or a format character [8178,8299) 121 units sha256 3acf3bc1e90e8bba081a78dbe9decd67aff6cfc1fa1dddd94c9281cb0dc1c74b
function L(e,n){return on.test(e)||e==="\u2028"||e==="\u2029"||e==="\u2800"||n>=55296&&n<=57343||n===1109742||an.test(e)}

// chunk-qq2mgstr.js declares dn, the replacer: the predicate is asked about each character with both neighbours' code points in hand, and an accepted character becomes U+FFFD [8503,8706) 203 units sha256 2a4d687d2b4b0de7ca99d8b925bbb5cd4c5fa664005071160ecb4267f6564a91
function dn(e,n){let i=Array.from(e),r="";for(let s=0;s<i.length;s++){let c=i[s]??"";r+=n(c,c.codePointAt(0)??0,i[s-1]?.codePointAt(0)??Number.NaN,i[s+1]?.codePointAt(0)??Number.NaN)?"\uFFFD":c}return r}

// chunk-qq2mgstr.js declares R, does anything visible remain once the variation selectors and the braille blank are stripped (width above zero) [9076,9162) 86 units sha256 a49c2cd37ce3a1791a5990b6df1c5c531fb315820fee6b7c4cb4172dafc08fb0
function R(e){return ae(e.replace(/[\uFE0E\uFE0F\u180B-\u180F\u2800]/gu,"").trim())>0}

// chunk-qq2mgstr.js declares Ae, the same question with only the variation selectors stripped, so a braille blank still counts as visible [9225,9299) 74 units sha256 157a19540b9a098436170a73bca4606a69b5033747d502aa40d4e8a4e1e8eb70
function Ae(e){return ae(e.replace(/[\uFE0E\uFE0F\u180B-\u180F]/gu,""))>0}

// chunk-qq2mgstr.js declares fn and hn, the combining-mark budget (eight) and the mark class the budget is spent on [9299,9320) 21 units sha256 a54e4484b2cde383a19b55ef26398e735369bfa783b232e4ba266a22b904803a
var fn=8,hn=/\p{M}/u;

// chunk-qq2mgstr.js declares hmo, a combining mark or nothing visible [9320,9362) 42 units sha256 35f93cb3fa77e695688a248610adee01290e1b08d70fad94c2d4d5f3e269effa
function hmo(e){return hn.test(e)||!Ae(e)}

// chunk-qq2mgstr.js declares xg, the mark collapser: a mark run longer than the budget becomes one U+FFFD, the count resetting at a line feed [9362,9571) 209 units sha256 946e4b38584f648b665e93f757f992a2f8817b7738cf8547c20b5d7d14b81f53
function xg(e){let n="",i=0,r=!1;for(let s of e){if(s===`
`){if(r)n+="\uFFFD",r=!1;n+=s,i=0;continue}if(!hmo(s)){if(r)n+="\uFFFD",r=!1;n+=s,i=0;continue}if(i<fn){n+=s,i++;continue}r=!0}return r?`${n}\uFFFD`:n}

// chunk-qq2mgstr.js declares Y, collapse the mark runs and trim the result [9571,9602) 31 units sha256 78623e9819f8af4b1dde6ba967e8a4b16693766b33ade94ade1bd5d6c717cdaa
function Y(e){return Zs(xg(e))}

// chunk-qq2mgstr.js declares mn, trim the leading and trailing characters nothing visible is left of [9602,9739) 137 units sha256 2287c4524042506d0a096d1c1b77e0eb2918b923512e721e64cf81a468462c8a
function mn(e){let n=Array.from(e),i=0,r=n.length;while(i<r&&!R(n[i]??""))i++;while(r>i&&!R(n[r-1]??""))r--;return n.slice(i,r).join("")}

// chunk-qq2mgstr.js declares V, the first character of the trimmed text, or the last one when asked for the end [9739,9810) 71 units sha256 6f4045f0c98436d400f99ca056c2639d872345098b0670c91973c5f8a5634252
function V(e,n){let i=Array.from(mn(e));return n==="end"?i.at(-1):i[0]}

// chunk-qq2mgstr.js declares ke, does the text end in an ellipsis [9810,9854) 44 units sha256 9611a747d6143cde5991803fc5a3469ba0bc6dbf4cb43e2a698a19d7de752bce
function ke(e){return V(e,"end")==="\u2026"}

// chunk-qq2mgstr.js declares g3, does visible content remain once a leading run of invisibles and the replacement character after it is dropped [10024,10184) 160 units sha256 1c156ba69d86cac92dbc0a0181069f9049e1aa237a7a55edcae51064e9739942
function g3(e){let n=[],i=!1;for(let r of Array.from(e)){if(r!==`
`&&!R(r)){i=!0;continue}if(r==="\uFFFD"&&i){i=!1;continue}i=!1,n.push(r)}return R(n.join(""))}

// chunk-qq2mgstr.js declares O, the sanitiser: the code-point rules that let a variation selector, a zero-width joiner or a Mongolian selector live only in the context that needs it, then the normalise pass [10264,10453) 189 units sha256 82925b31bc41e22426abdd19cc6de2c5d4a764f2bd9ff26e6e316b61c4484b8e
function O(e){return Y(Zs(dn(e,(n,i,r,s)=>{if(i===65038||i===65039)return!(r>127||s===8419);if(i===8204||i===8205)return!(r>127&&s>127);if(i>=6155&&i<=6159)return!(r>127);return L(n,i)})))}

// chunk-qq2mgstr.js declares aN, the label length cap (256), beside the 48-unit sibling this pass does not read [10576,10594) 18 units sha256 6b8308d1582194f22429da245128977eb2c34cc0648b8bac157fef0ed1f536dc
var R3e=48,aN=256;

// chunk-qq2mgstr.js declares Mde, the label sanitiser: a non-string is null, the text is cut to the cap, sanitised, its tabs become spaces, and what is left without visible content or already elided is rejected before the 24-column clamp on the first line [16350,16512) 162 units sha256 9c96c68d937461d9f40dd938c84433adc2b283ac14dda88115a4a242c28268df
function Mde(e){if(typeof e!=="string")return null;let n=O(ne(e,aN)).replace(/\t/g," ");if(!g3(Ar(n)))return null;if(ke(Ar(n)))return null;return $8(jo(n,24,!0))}


export { on, an, L, dn, R, Ae, fn, hn, hmo, xg, Y, mn, V, ke, g3, O, R3e, aN, Mde };
