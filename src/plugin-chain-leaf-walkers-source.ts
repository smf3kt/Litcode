// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-34bv7wfw.js sha256 3c54cf84149d490f331f6c45a0d54ac7f471c7962b5a359f2a6880189b94f27d
//   chunk-f606a53w.js sha256 dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
//   chunk-kcwp0ct0.js sha256 6e2a2f6d72577f973cdd9fa83e5b5801f6b05499f69792052b6070b20cb91bda
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The table names the nine leaf checks the site-table packages already ported, so they are imported
// rather than copied again; the two string helpers and the error describer come from the chain copy,
// and the diff reader from the normalize copy. What is below is the fresh half: the table itself, the
// three walkers that read it, and the diff-hunk parser the tallest of them needs.
import { L, l } from './plugin-chain-source.js';
import { ae } from './plugin-chain-text-clamp-source.js';
import { Epe } from './plugin-chain-normalize-source.js';
import { eno, jto, Lto, PAt, Zto } from './plugin-chain-site-leaves-source.js';
import { Bto, Jto } from './plugin-chain-raster-sites-source.js';
import { Mto, Vto } from './plugin-chain-leaves-source.js';
import { Hto } from './plugin-chain-button-source.js';

// chunk-n3ykh62m.js `Dto` — a unified diff read back into hunks: every hunk's no-newline marker lines (the ones that begin with a backslash) dropped, each header checked to be `@@ -a,b +c,d @@` with all four numbers safe integers in range, and a refusal that names the offending hunk otherwise [236820,237297) 477 units sha256 41ff39c00a72e0855b358328861855524244c218545058ff6eb420083dfaffeb
function Dto(e){let n;try{n=tso(e)}catch(w){return{kind:"refused",problem:l(w)}}let r=n.flatMap((w)=>w.hunks).map((w)=>({...w,lines:w.lines.filter((R)=>!R.startsWith("\\"))})),s=r.findIndex(({oldStart:w,oldLines:R,newStart:T,newLines:P})=>![w,R,T,P].every((M)=>Number.isSafeInteger(M)&&M>=0&&M<=PAt)),h=r.length===0,y=h?"no @@ hunk header found":`hunk ${s+1} header is not @@ -a,b +c,d @@ within ${PAt} lines`;return h||s!==-1?{kind:"refused",problem:y}:{kind:"hunks",hunks:r}}

// chunk-n3ykh62m.js `vVe` — the reader a Code leaf asks for by format: a diff when the format says diff, and nothing otherwise [237297,237337) 40 units sha256 b67281830d7725b5b3bc0e65c9945d1fda47b10dbc77ed89ba009bb67759cd48
var vVe=(e,n)=>n==="diff"?Dto(e):void 0;

// chunk-n3ykh62m.js `J4t` — the text a leaf contributes with the bidi controls and directional marks replaced by the replacement character, which is what keeps a right-to-left override from moving the line around it [238357,238438) 81 units sha256 8c40fd8b19a91c5e48b1276bcb19877b77cf5ba47a2f7c5b502b26667fe681f0
var J4t=(e)=>Epe(HN(e)).replace(/[\u061c\u202a-\u202e\u2066-\u2069]/gu,"\uFFFD");

// chunk-n3ykh62m.js `Q4t` — the strings under a list of children, flattened depth-first, a child object contributing its own children and a string contributing itself [238917,239033) 116 units sha256 df62ad717231f2e26329535440a42312c7bbe039be1fd048daf07a55a190979f
var Q4t=(e)=>e.flatMap((n)=>{let r=typeof n==="string",s=!r&&"children"in n?n.children??[]:[];return r?[n]:Q4t(s)});

// chunk-n3ykh62m.js `tno` — the leaf table itself: the nine leaf types, each mapped to the check that refuses a bad one [259180,259284) 104 units sha256 8caf22ef42c2b96f5dd9f9524c40e8b7ed52a2a5d5c4cbeec8070fccda4c4386
var tno={Button:Hto,Client:Mto,Code:Lto,Image:Bto,Input:jto,Markdown:Vto,Raster:Jto,Select:Zto,Svg:eno};

// chunk-n3ykh62m.js `nno` — text measured up to a budget, counting the escape a tab or a line break costs at the point it is found and stopping as soon as the budget is passed [259284,259432) 148 units sha256 9b7b1d5487bbcf0e9ded48d05f80972c8d55e1294c1e7fa015e6a3065dee516a
function nno(e,n){let r=0,s=0;for(let{index:h}of e.matchAll(/[\t\n\r]/gu))if(r+=h===s?0:ae(e.slice(s,h)),s=h+1,r>n)return r;return r+ae(e.slice(s))}

// chunk-n3ykh62m.js `IAt` — the emitted lines a string takes at a given width: its own line count while it is under the cap, and the wrapped count after it [259432,259514) 82 units sha256 49e958cf2f1026fd7cc414d2d28d57501751dc4cc7c768af1151d3a69a6ec36f
function IAt(e,n){let r=Lt(e,`
`);return r>kFe?r:r+Math.floor(nno(e,n*(kFe+1))/n)}

// chunk-n3ykh62m.js `rno` — the text a leaf contributes: a Svg's alt, a Button's children joined, a Button's or Input's label, and nothing for the rest [259514,259714) 200 units sha256 7b2a5e9b748f44ee27eee2613779ecd6d6751567174f19028430d81036ca7d63
function rno(e){if(e.type==="Svg")return[e.props.alt];let n=e.type==="Button"?e.children??[]:[];if(n.length>0)return[Q4t(n).join("")];return e.type==="Button"||e.type==="Input"?[e.props.label??""]:[]}

// chunk-n3ykh62m.js `ono` — how tall a leaf is: a Raster's or Image's rows, a Markdown's lines, one line plus the wrapped text for everything else, and for a Code leaf the diff-aware answer — the source lines, the hunks when it is a diff, the gutter width when the line numbers are shown, and whether the result is truncated [259714,260226) 512 units sha256 4f25a0b3bec8c103da3225a486c41ba24c988ceb538cb49b37e5e95ce207f605
function ono(e){if(e.type==="Raster"||e.type==="Image")return e.props.rows;if(e.type==="Markdown")return Lt(e.props.text,`
`)+1;if(e.type!=="Code")return 1+IAt(rno(e).join(" "),lQt);let{source:n,startLine:r,format:s,wrap:h}=e.props,y=Lt(n,`
`)+1;if(y>kFe)return y;let b=vVe(n,s),w=b?.kind==="hunks"?b.hunks:[],R=Math.max(0,w.length-1);if(h==="truncate-end")return y+R;let P=r===void 0||b?.kind==="refused"?0:r+y-1,M=P===0?0:String(P).length+2,z=w.reduce((N,V)=>Math.max(N,Int(V)),M);return 1+R+IAt(J4t(n),lQt-z)}

// chunk-n3ykh62m.js `ano` — is this keyed leaf drawn twice: the type and the key are held in a set as the tree is walked, and the second sighting is refused with the sentence that names the type and the key [262308,262627) 319 units sha256 5cc8a4eba50e2103273fa46950387a69362e1e3a4c0ced59dcc88bb3702e56c5
function ano(e,n){let{props:r}=e,h=(e.type==="Input"||e.type==="Select"||e.type==="Markdown"||e.type==="Client"||e.type==="Raster"||e.type==="Image")&&L(r)?r.key:void 0;if(typeof h!=="string")return;let y=`${e.type}\x00${h}`,b=n.has(y);return n.add(y),b?`${e.type} "${h}" is drawn twice; each takes its own key`:void 0}

// chunk-34bv7wfw.js `tso` — the unified-diff parser behind the Code leaf's height: file headers, index lines and hunks, with each line's kind read off its first character [9299,11040) 1741 units sha256 c2e67e709a9585ce7f0be20eefff9f34c0ba2df2d5485ec84cad6f7fc1f945bd
function tso(n){let e=n.split(/\n/),t=[],i=0;function l(){let o={};t.push(o);while(i<e.length){let f=e[i];if(/^(---|\+\+\+|@@)\s/.test(f))break;let u=/^(?:Index:|diff(?: -r \w+)+)\s+/.exec(f);if(u)o.index=f.substring(u[0].length).trim();i++}r(o),r(o),o.hunks=[];while(i<e.length){let f=e[i];if(/^(Index:\s|diff\s|---\s|\+\+\+\s|===================================================================)/.test(f))break;else if(/^@@/.test(f))o.hunks.push(s());else if(f)throw Error("Unknown line "+(i+1)+" "+JSON.stringify(f));else i++}}function r(o){let f=/^(---|\+\+\+)\s+/.exec(e[i]);if(f){let u=f[1],h=e[i].substring(3).trim().split("\t",2),c=(h[1]||"").trim(),a=h[0].replace(/\\\\/g,"\\");if(a.startsWith('"')&&a.endsWith('"'))a=a.substr(1,a.length-2);if(u==="---")o.oldFileName=a,o.oldHeader=c;else o.newFileName=a,o.newHeader=c;i++}}function s(){var o;let f=i,u=e[i++],h=u.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/),c={oldStart:+h[1],oldLines:typeof h[2]>"u"?1:+h[2],newStart:+h[3],newLines:typeof h[4]>"u"?1:+h[4],lines:[]};if(c.oldLines===0)c.oldStart+=1;if(c.newLines===0)c.newStart+=1;let a=0,g=0;for(;i<e.length&&(g<c.oldLines||a<c.newLines||((o=e[i])===null||o===void 0?void 0:o.startsWith("\\")));i++){let w=e[i].length==0&&i!=e.length-1?" ":e[i][0];if(w==="+"||w==="-"||w===" "||w==="\\"){if(c.lines.push(e[i]),w==="+")a++;else if(w==="-")g++;else if(w===" ")a++,g++}else throw Error(`Hunk at line ${f+1} contained invalid line ${e[i]}`)}if(!a&&c.newLines===1)c.newLines=0;if(!g&&c.oldLines===1)c.oldLines=0;if(a!==c.newLines)throw Error("Added line count did not match for hunk at line "+(f+1));if(g!==c.oldLines)throw Error("Removed line count did not match for hunk at line "+(f+1));return c}while(i<e.length)l();return t}

// chunk-f606a53w.js `HN` — leading tabs expanded to two spaces each, which is the width a tab counts for once the text is measured [7703,7802) 99 units sha256 b23ca733c5b3a66a3f7bd6d6127d1f3eec7051452786079c0be887eb5d53437b
function HN(e){if(!e.includes("\t"))return e;return e.replace(/^\t+/gm,(n)=>"  ".repeat(n.length))}

// chunk-kcwp0ct0.js `Int` — the width of a hunk's `+ N ` line-number gutter, from the larger of the two sides' last line [17539,17627) 88 units sha256 9483213f5043cdfdbe9b4368f408bd958451addc3c9e46a5fd0d0828451eec7b
var Int=(e)=>`+ ${Math.max(e.oldStart+e.oldLines-1,e.newStart+e.newLines-1,1)} `.length;

// chunk-ax7r0qj7.js `Lt` — how many times a needle occurs in a string, which is how a line count is taken [3561,3652) 91 units sha256 f2d166a2dc29276ed4cfdc6420711b6f00ff1b565d208f3693098bcfc55c7714
function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}

// chunk-nyce03br.js `lQt` and `kFe` — the width text is wrapped at and the line cap a Code or Markdown leaf is measured against — declared in the same statement as four constants this copy does not use, because the bundle declares them together [5956,6041) 85 units sha256 2d9ec1bf8d2562d83b8c29b221af6cbd0cc854758449e023dfb302e32dd47e6c
var lQt=40;var kFe=12;var Ybr=1e5;var B3e="AskUserQuestion";var ESe=32;var AFe=20000;


export { tno, ono, rno, Q4t, ano, IAt, nno, tso, Dto, vVe, J4t, HN, Lt, Int, lQt, kFe };
