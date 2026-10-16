// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-bk5ct2gw.js sha256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-d3s5r8h5.js sha256 202506d3996b4fffe72418c623c884a93169f9352a17331ba6268b2e2eb4e2db
//   chunk-eb9r2hbv.js sha256 3b1f83a5d1fcec7a1aa8a7d0adf139d8643ace6755985b79f19ddc1e7de22abe
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { ra } from './tui-graphemes.js';

// chunk-bk5ct2gw.js the ultrathink matcher (`aZt` tests, `YIt` collects), the rainbow palette pairs (`LF` base, `UF` shimmer) and the wrap-around palette pick `fB` [399661,400220) 559 units sha256 ef56142453117ff9b873e696e9b74ad472ddf4e5f790ebef627854a486dbfbf9
function aZt(e){return/\bultrathink\b/i.test(e)}function YIt(e){let n=[],r=e.matchAll(/\bultrathink\b/gi);for(let s of r)if(s.index!==void 0)n.push({word:s[0],start:s.index,end:s.index+s[0].length});return n}var LF=["rainbow_red","rainbow_orange","rainbow_yellow","rainbow_green","rainbow_blue","rainbow_indigo","rainbow_violet"],UF=["rainbow_red_shimmer","rainbow_orange_shimmer","rainbow_yellow_shimmer","rainbow_green_shimmer","rainbow_blue_shimmer","rainbow_indigo_shimmer","rainbow_violet_shimmer"];function fB(e,n=!1){let r=n?UF:LF;return r[e%r.length]}

// chunk-n3ykh62m.js the keyword matcher `Qp` over the quote/bracket map `IE`: skips quoted and bracketed runs, rejects slash/dash/backslash boundaries and trailing `?` or `.word`, plus its `ultraplan`/`ultrareview`/`ultracode` entry points [453609,454576) 967 units sha256 b5d343e8a5cbb61dd85136dd428268277b8a9f6482164f9d0df9e3a3c3e30f12
var IE={"`":"`",'"':'"',"<":">","{":"}","[":"]","(":")","'":"'"};function Qp(e,n){if(!new RegExp(n,"i").test(e))return[];if(e.startsWith("/"))return[];let s=[],h=null,y=0,b=(P)=>!!P&&/[\p{L}\p{N}_]/u.test(P);for(let P=0;P<e.length;P++){let M=e[P];if(h){if(h==="["&&M==="["){y=P;continue}if(M!==IE[h])continue;if(h==="'"&&b(e[P+1]))continue;s.push({start:y,end:P+1}),h=null}else if(M==="<"&&P+1<e.length&&/[a-zA-Z/]/.test(e[P+1])||M==="'"&&!b(e[P-1])||M!=="<"&&M!=="'"&&M in IE)h=M,y=P}let w=[],R=new RegExp(`\\b${n}\\b`,"gi"),T=e.matchAll(R);for(let P of T){if(P.index===void 0)continue;let M=P.index,z=M+P[0].length;if(s.some((X)=>M>=X.start&&M<X.end))continue;let N=e[M-1],V=e[z];if(N==="/"||N==="\\"||N==="-")continue;if(V==="/"||V==="\\"||V==="-"||V==="?")continue;if(V==="."&&b(e[z+1]))continue;w.push({word:P[0],start:M,end:z})}return w}function Zp(e){return Qp(e,"ultraplan")}function uto(e){return Qp(e,"ultrareview")}function Art(e){return Qp(e,"ultracode")}

// chunk-n3ykh62m.js the half-open range-overlap test `mW` the suggestion merge uses [462993,463045) 52 units sha256 507dc46dec9bfa859c52baa2bdfdbafb30bf85e1b9cf31fcb54bd663ef7df656
function mW(e,n,r){return r.some(([s,h])=>e<h&&n>s)}

// chunk-d3s5r8h5.js the slash-command matcher `d3n` with its `/^\/btw\b/gi` pattern `A`, and the companion reply strings of the same top-level declaration [1005,1698) 693 units sha256 af9e10a85f300043f296550057c1162f7f41c3385ee3fb418fccecf22d910a52
var A=/^\/btw\b/gi,M="_/btw can't run tools: any tool calls or tool output shown above were not executed and may not reflect your actual files or data. Ask in the main conversation to check._",_="(That answer wrote tool calls as text. Nothing was executed, so it is omitted here.)",b="_(This answer was cut off before it finished. Ask again to retry.)_",E="(That answer was cut off before it finished, so it is omitted here.)",k="[No result yet \u2014 this call is still in progress in the main conversation (running, awaiting approval, or queued)]";function d3n(o){let n=[],i=o.matchAll(A);for(let s of i)if(s.index!==void 0)n.push({word:s[0],start:s.index,end:s.index+s[0].length});return n}

// chunk-eb9r2hbv.js `ewe`: the first grapheme of a slice, the caret highlight's width unit [803,902) 99 units sha256 285d1334c1b9ba0c2a5da93a0074e6053faac7f8ac73653cc15ae3e0cc5d47e8
function ewe(e){if(!e)return"";return ra().segment(e)[Symbol.iterator]().next().value?.segment??""}

// chunk-24k7d6mw.js the mark merge `pue`: base spans kept, marks appended only where they overlap nothing already kept [805913,806052) 139 units sha256 cfe68965fe682d92b11111a6135a7d2614a93fd891e5efcdcd89ea2d7d66373e
function pue(h,T){if(T.length===0)return h;let M=[...h];for(let L of T)if(!h.some((ee)=>L.start<ee.end&&L.end>ee.start))M.push(L);return M}

// chunk-sfn1dbxq.js the slash-command run matcher `vMe`: a `/name` after start or a separator, trailing dots trimmed [3604158,3604403) 245 units sha256 0fda31d7dc331c4ad080e39a907e2d8665085926ba190cc1c1677b09e9fce10c
function vMe(e){let n=[],r=/(^|[\s\u3002\u3001\uFF1F\uFF01])(\/[a-zA-Z][a-zA-Z0-9.:\-_]*)/g,s=null;while((s=r.exec(e))!==null){let h=s[1]??"",y=s[2]??"",b=y.length;while(y[b-1]===".")b--;let w=s.index+h.length;n.push({start:w,end:w+b})}return n}

// chunk-sfn1dbxq.js `j5r`, the spread-highlights producer of this build: an optional call on a null literal, so the composer spreads nothing [405289,405350) 61 units sha256 48338fe115ee98820ad31fa7c7bcf8e3d7d7860c706aed1a977a522454a594d3
function j5r(e){return null?.setupGuideChipHighlights(e)??[]}


export { aZt, YIt, LF, UF, fB, IE, Qp, Zp, uto, Art, mW, A, d3n, ewe, pue, vMe, j5r };
