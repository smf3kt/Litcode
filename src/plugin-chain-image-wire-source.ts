// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-fzk4rpqy.js sha256 bb2b14f95b2e509e9a2992709435d6e6e6841de2e5782960061c3721d61b38ae
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The wire layer is the source's own text; the CSI builder and its two constants come from the
// raster surface copy that already carries them.
import { CZ, PH, fl } from './plugin-chain-raster-surface.js';
// chunk-kexg5hxg.js `hxn` (the one body of this wire layer that lives in another chunk and is
// only re-exported by it): `var hxn=PH+"\\"`, the string terminator `d` appends. Ported here,
// not copied, because its module is not one of this package's; the expression is the source's.
const hxn = PH + "\\";

// chunk-fzk4rpqy.js the SGR builders and the colour/border name tables; `hun` is the row suffix `lFo` uses [918,1345) 427 units sha256 64b62b81fd1f3910b162201b091037a54c53117ae800e68a3a7a3bf6e4783f4d
var tFo=fl(0,"m"),mun=fl(1,"m"),x4n=fl(2,"m"),nFo=fl(4,"m"),rFo=fl(7,"m"),oFo=fl(33,"m"),P4n=fl(22,"m"),gun=fl(24,"m"),g$t=fl(27,"m"),sFo=fl(29,"m"),hun=fl(39,"m"),I4n=fl(49,"m"),iFo=fl(55,"m"),h=["black","red","green","yellow","blue","magenta","cyan","white","brightBlack","brightRed","brightGreen","brightYellow","brightBlue","brightMagenta","brightCyan","brightWhite"],_=["none","single","double","curly","dotted","dashed"];

// chunk-fzk4rpqy.js the wire constants: the APC introducer, the chunk size, the codepoint table `y`, the colour masks and the payload cap `L` [3919,5640) 1721 units sha256 b920f180346930584365b86e73d4361d694e07d9a531047d93923600b7ff7739
var P=PH+String.fromCharCode(CZ.APC),G=`${P}G`,m=4096,K=1109742,N=String.fromCodePoint(K),h$t=256,b=4294967295,R=1e4,f={mask:255,redShift:16,greenShift:8},y=[773,781,782,784,786,829,830,831,838,842,843,844,848,849,850,855,859,867,868,869,870,871,872,873,874,875,876,877,878,879,1155,1156,1157,1158,1159,1426,1427,1428,1429,1431,1432,1433,1436,1437,1438,1439,1440,1441,1448,1449,1451,1452,1455,1476,1552,1553,1554,1555,1556,1557,1558,1559,1623,1624,1625,1626,1627,1629,1630,1750,1751,1752,1753,1754,1755,1756,1759,1760,1761,1762,1764,1767,1768,1771,1772,1840,1842,1843,1845,1846,1850,1853,1855,1856,1857,1859,1861,1863,1865,1866,2027,2028,2029,2030,2031,2032,2033,2035,2070,2071,2072,2073,2075,2076,2077,2078,2079,2080,2081,2082,2083,2085,2086,2087,2089,2090,2091,2092,2093,2385,2387,2388,3970,3971,3974,3975,4957,4958,4959,6109,6458,6679,6773,6774,6775,6776,6777,6778,6779,6780,7019,7021,7022,7023,7024,7025,7026,7027,7376,7377,7378,7386,7387,7392,7616,7617,7619,7620,7621,7622,7623,7624,7625,7627,7628,7633,7634,7635,7636,7637,7638,7639,7640,7641,7642,7643,7644,7645,7646,7647,7648,7649,7650,7651,7652,7653,7654,7678,8400,8401,8404,8405,8406,8407,8411,8412,8417,8423,8425,8432,11503,11504,11505,11744,11745,11746,11747,11748,11749,11750,11751,11752,11753,11754,11755,11756,11757,11758,11759,11760,11761,11762,11763,11764,11765,11766,11767,11768,11769,11770,11771,11772,11773,11774,11775,42607,42620,42621,42736,42737,43232,43233,43234,43235,43236,43237,43238,43239,43240,43241,43242,43243,43244,43245,43246,43247,43248,43249,43696,43698,43699,43703,43704,43710,43711,43713,65056,65057,65058,65059,65060,65061,65062,68111,68152,119173,119174,119175,119176,119177,119210,119211,119212,119213,119362,119363,119364],L=m/4*3;

// chunk-fzk4rpqy.js `u` — a positive-integer range check [5640,5801) 161 units sha256 0370b4a8616999d4e8578b4c4f728e5988f17371da97c548bd6f48f1eeddc747
function u(e,n){if(!Number.isInteger(e)||e<1||e>n)throw TypeError("kitty graphics: an id, cell count or pixel size must be a positive integer within its range")}

// chunk-fzk4rpqy.js `D` — the base64 payload check [5801,5960) 159 units sha256 39c97f2a4fe73f9bd2f6400a1739bc492bc034a2659fe6354049c9d6827075f2
function D(e){if(typeof e!=="string"||!/^[A-Za-z0-9+/]*={0,2}$/.test(e))throw TypeError("kitty graphics: payload must be standard base64 (A-Z a-z 0-9 + / =)")}

// chunk-fzk4rpqy.js `k` — the file/shm name check: non-empty, no NUL, at most 3072 bytes [5960,6187) 227 units sha256 e2962bfbbf80aa7df6469b4d25dd8a9a52b5e63f27a4806a58a11429f333ee68
function k(e){if(!(typeof e==="string"&&e!==""&&!e.includes("\x00")&&Buffer.byteLength(e,"utf8")<=L))throw TypeError("kitty graphics: a file path or shared-memory name must be a non-empty string of at most 3072 bytes, no NUL")}

// chunk-fzk4rpqy.js `v` — UTF-8 to base64 [6187,6239) 52 units sha256 d834ae0faf7fb742d5e49c23dd346eb07c5ec756c247409bc1be672469487ec6
var v=(e)=>Buffer.from(e,"utf8").toString("base64");

// chunk-fzk4rpqy.js `O` — the colour sequence: 256-colour below 256, truecolor otherwise [6239,6382) 143 units sha256 f207b129890c5e64377da217de1fce1b793f05b14e7a8829c78fd6c227466e7d
function O(e){u(e,b);let n=e<h$t,o=e>>>f.redShift&f.mask,t=e>>>f.greenShift&f.mask,i=e&f.mask;return fl(n?`38;5;${e}m`:`38;2;${o};${t};${i}m`)}

// chunk-fzk4rpqy.js `S` — the first n codepoints of the placeholder table [6382,6440) 58 units sha256 c9a1bdb872ef813a7036a8eee520c6f4938f4859460daa8411114eb040b2f9cb
var S=(e)=>y.slice(0,e).map((n)=>String.fromCodePoint(n));

// chunk-fzk4rpqy.js `lFo` — the alt: the colour sequence and one placeholder per row [6440,6571) 131 units sha256 17ff2d299b4283ba386ebaa61c9be6d927455a6bcc7199a0cbffb50278025f4e
function lFo(e,n,o){u(n,y.length),u(o,y.length);let t=O(e),i=S(n);return S(o).map((s)=>t+i.map((r)=>N+s+r).join("")+hun).join(`
`)}

// chunk-fzk4rpqy.js `d` — one framed wire message: the introducer, the body and the suffix [6571,6642) 71 units sha256 4f9e7ff0bbfd585650e9e76037a2f52ef037382c1377a719484e7b5e9f2054c7
function d(e,n){let o=n===void 0?"":`;${n}`;return`${G}${e}${o}${hxn}`}

// chunk-fzk4rpqy.js `Y`/`M` — the format and medium codes [6642,6710) 68 units sha256 4cac6d9dd33527e9580c2f6d6259af7f3d3cd644728234fe31713d1b3a5684d4
var Y={png:"f=100",rgba:"f=32",rgb:"f=24"},M={file:"t=f",shm:"t=s"};

// chunk-fzk4rpqy.js `cFo` — the transmit: header codes, file/shm medium, the base64 payload split at the chunk size [6710,7275) 565 units sha256 2529e90104b3ad80f666d963c7f4ff1c79ebb52345b57f5ecffa6eb219df6390
function cFo(e){let{id:n,source:o,columns:t,rows:i}=e;if(u(n,b),u(t,y.length),u(i,y.length),o.format!=="png")u(o.width,R),u(o.height,R);let r=o.format!=="png"?`,s=${o.width},v=${o.height}`:"",a=`${Y[o.format]}${r}`,c=`i=${n},c=${t},r=${i}`;if("medium"in o){k(o.name);let x=M[o.medium];return d(`a=T,U=1,q=1,${a},${x},${c}`,v(o.name))}D(o.base64);let l=`a=T,U=1,q=2,${a},${c}`,{base64:p}=o;if(p.length<=m)return d(l,p);let g=[];for(let x=0;x<p.length;x+=m){let T=x+m>=p.length?"m=0":"m=1",q=x===0?`${l},${T}`:`${T},q=2`;g.push(d(q,p.slice(x,x+m)))}return g.join("")}


export { u, D, k, v, O, S, lFo, d, Y, M, cFo, hun, G, N, h$t, b, R, f, y, m, L };
