// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The raster leaf problems (W45-62): the two checks a Raster or an Image site is admitted by, and
// the string, size and stamp checks both of them share.
//
// Eight blocks, 1,980 units, 14 statements of chunk-n3ykh62m.js. This is the reader of everything
// ported since W45-58: `tF` and `Xto` are the mount W45-60 carried, `fur` the cell decoder and `Mss`
// the ImageSource shape W45-58 carried, and `L`, `ne` and `y$` come from the chain-runner copy. The
// one name in the closure that is neither is `$ne`, the location policy already owned by
// ./plugin-chain-fs-boundaries.ts and imported there by the blit copy, so it is not copied again.
import { L, ne, y$ } from './plugin-chain-source.js';
import { Mss, QT, fur } from './plugin-chain-ui-blit-source.js';
import { Kbr, Xto, tF } from './plugin-chain-raster-cells-source.js';

// chunk-n3ykh62m.js how a problem names the site it is about: `our` (40), the length a key is cut to, `IL`, which replaces what `y$'s pattern matches and answers the text unchanged while it fits, and `RAt` (10000), the length a string check refuses past [233219,233330) 111 units sha256 2dbeb4a3c5f1b2a497d7c999adb80ca2971a8981e4e93b4fa5ca9d713bb62deb
var our=40;function IL(e){let n=String(e).replace(y$,"?");return n.length<=our?n:`${ne(n,our)}...`}var RAt=1e4;

// chunk-n3ykh62m.js `QAe`, the allowed-keys predicate: every own key of an object is one of the listed ones [233808,233864) 56 units sha256 40ef2447d61162a0b2da9c5738c88c2ffa2a07a18d40a026e818aac284cb9f85
var QAe=(e,n)=>Object.keys(e).every((r)=>n.includes(r));

// chunk-n3ykh62m.js the checks both leaf problems run before their own: `EVe`, whether a leaf is stamped by a plugin of this chain (`plugin` a non-empty string), `xye`, a value that must be a string when given, within `RAt` characters and without a control character, and `XPn`, which sweeps a key list and answers the first problem it finds [235650,235982) 332 units sha256 8d857b7cac8938eb68d15720536b5ceb4e337483a138bc82abf4d4460b456888
var EVe=(e)=>L(e)&&typeof e.plugin==="string"&&e.plugin!=="";function xye(e,n){let r=typeof n==="string";if(n!==void 0&&!r)return`${e} must be a string`;if(r&&n.length>RAt)return`${e} longer than ${RAt} characters`;return r&&QT(n)?`${e} holds a control character`:void 0}var XPn=(e,n)=>e.map((r)=>xye(r,n[r])).find((r)=>r!==void 0);

// chunk-n3ykh62m.js `ace`, the same string check without the length cap — the one an alt or a label goes through, where `xye` is the one a key does [237337,237485) 148 units sha256 3939dbcfeb49c4b98c5f9dd6c3736cd2f9e9c20e0755fde7ea44ee58f3dec9b0
function ace(e,n){let r=typeof n==="string";if(n!==void 0&&!r)return`${e} must be a string`;return r&&QT(n)?`${e} holds a control character`:void 0}

// chunk-n3ykh62m.js `H_` and `$_` (255 by 255), the size an Image is checked against, and `tL`, that check [242738,242804) 66 units sha256 9872fca3365ca8a29e9f989ea26c39c1ebcb6b7c955fb218808395ff78b68485
var H_=255;var $_=255;var tL=(e,n)=>Kbr(e,n,{columns:H_,rows:$_});

// chunk-n3ykh62m.js `Bto`, the Image leaf problem: the props must be source/columns/rows/alt with a key when given, no children, and no other key at all — a leftover key is named in the message, because a press goes on an enclosing Button — then alt and key as strings, the size, the ImageSource shape `Mss`, and the stamp; the message is `Image "<key>" <problem>` or `Image <problem>` [245596,246293) 697 units sha256 ff7b4fc479066dcfa00ea032d62af9f7fccb6cb211be2d3565f488d2d6874318
function Bto(e){let{props:n,children:r,image:s}=e;if(!L(n))return"Image props must be { source, columns, rows, alt }";if(r!==void 0)return"Image takes no children";let{source:h,columns:y,rows:b,alt:w,key:R,...T}=n,[P]=Object.keys(T);if(P!==void 0)return`Image prop "${P}" is not allowed (no hover or onPress; a press goes on an enclosing Button)`;if(typeof w!=="string")return"Image alt must be a string";if(R!==void 0&&(typeof R!=="string"||R===""))return"Image key must be a non-empty string when given";let M=R===void 0?"Image":`Image "${IL(R)}"`,z=ace("alt",n.alt)??xye("key",R)??tL(y,b)??Mss(h)??(EVe(s)?void 0:"is not stamped by a plugin of this chain");return z===void 0?void 0:`${M} ${z}`}

// chunk-n3ykh62m.js `Gto`, the picker a Raster's props go through: an object whose `key` is a non-empty string and whose every other key is allowed, answered as a copy, or nothing at all [247200,247312) 112 units sha256 53c61d2c1b9482a82ec68059b9ebb85dd185f5c04e019696d1c5916f174bb75d
function Gto(e,n){if(!L(e))return;let{key:r}=e;return typeof r==="string"&&r!==""&&QAe(e,n)?{...e,key:r}:void 0}

// chunk-n3ykh62m.js `Jto`, the Raster leaf problem: the props come from `Gto` against `Xto`, so a key and nothing else; no children; then the key sweep `XPn(["key"])`, the default size check `tF`, the cell decode `fur(cells, columns, rows)` — whose own problem is the message — and the stamp; the message is `Raster "<key>" <problem>` [257143,257601) 458 units sha256 a81c26dc61070cb9e2e683fc3b6bd64f88fe5d9fd8689eef9bab9f3680cd40fb
function Jto(e){let{raster:n,children:r}=e,s=Gto(e.props,Xto);if(s===void 0)return"Raster props must be { key, columns, rows, cells }, key a non-empty string, and nothing else (no hover or onPress yet)";if(r!==void 0)return"Raster takes no children";let{key:h,columns:y,rows:b}=s,w=XPn(["key"],s)??tF(y,b)??fur(s.cells,Number(y),Number(b)).problem??(EVe(n)?void 0:"is not stamped by a plugin of this chain");return w===void 0?void 0:`Raster "${IL(h)}" ${w}`}


export { our, IL, RAt, QAe, EVe, xye, XPn, ace, H_, $_, tL, Bto, Gto, Jto };
