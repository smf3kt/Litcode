// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-yn0pfn70.js sha256 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The raster surface engine (W45-61): the pass that admits a frame's keys, places them in the slot
// table, matches them against what is already there and answers each key's escape — with the row
// builder that drives it, the surface state and matcher it runs on, the SGR and colour builders its
// escapes are made of, and the CSI helper those are written with.
//
// Ten blocks, 4,374 units. Seven runs of chunk-n3ykh62m.js and the three statements of the CSI helper
// in chunk-yn0pfn70.js that `gc`/`hc` call. Everything else the engine reaches is already carried and
// imported rather than copied a second time: the bucket and the cell encoder from the W45-60 copy, the
// surface's cell stride and colour grammar from the W45-58 one, and `Ge` from the chain-runner copy.
import { Ge } from './plugin-chain-source.js';
import { it } from './plugin-chain-host.js';
import { $f, Gn, Lr, Sb, bc, dc, fb, gn, mb, mc, tb, yb, ys } from './plugin-chain-raster-cells-source.js';
import { gs, ko, xo } from './plugin-chain-ui-blit-source.js';

// chunk-n3ykh62m.js `nb` (64), the bound the engine's alias sweep walks within [248705,248715) 10 units sha256 bc5a139ef04bdec04010c1b00dcbac7382bd7bae8d489ea3e4b64e22e0c31139
var nb=64;

// chunk-n3ykh62m.js `fc`, one channel of a packed colour widened to the 0..255 the escape wants (`(c >> shift & 15) * 17`) — the sibling the grammar names after it [252200,252243) 43 units sha256 2bbf53c768c431deababf01a7208ffa1bbb6e914e849015ea38b319d0a6f04b0
var fc=(e,n)=>(e>>n&Gn.channelMax)*Gn.step;

// chunk-n3ykh62m.js the colour the escapes carry: `Ff`, which answers the sentinel unchanged and otherwise un-packs the three channels back to their own shifts, and `pc`, which packs two of them into one word — a pair is the foreground and the background [252256,252455) 199 units sha256 dad7b45e3955849c3a688a3ee9d483673a3e86013deeb01857ac4b746ff45212
function Ff(e){if(e===ko)return ys;let n=(r)=>Math.round((e>>r&gs.channelMask)/Gn.step);return n(gs.redShift)<<Gn.redShift|n(gs.greenShift)<<Gn.greenShift|n(0)}var pc=(e,n)=>Ff(e)|Ff(n)<<Lr.halfBits;

// chunk-n3ykh62m.js the SGR the surface measures its work in: `_s` the code table (38/48 set, 39/49 reset, 2 truecolor), `Hf` the parameter list for one side, `gc` the pair of sequences for a colour, `hc` the sequence a fresh paint starts from, and `Sc` (1024) the slot capacity [252481,252898) 417 units sha256 270fae76c961e2c9d57e864ce39b787602fc89a45bd175349957f91b2eb5b8e2
var _s={setForeground:38,setBackground:48,resetForeground:39,resetBackground:49,truecolor:2};function Hf(e,n){let r=n==="foreground";return e===ys?String(r?_s.resetForeground:_s.resetBackground):[r?_s.setForeground:_s.setBackground,_s.truecolor,fc(e,Gn.redShift),fc(e,Gn.greenShift),fc(e,0)].join(";")}var gc=(e)=>fl(`${Hf(mc(e),"foreground")}m`)+fl(`${Hf(dc(e),"background")}m`);var hc=()=>gc(pc(ko,ko));var Sc=1024;

// chunk-n3ykh62m.js the surface state and the matcher: `lb`, which builds the slots/held/table/probe/aliases row (including the `Uint8Array(Sc * gn.width)` cell table and its one-cell probe), `cb` the slots a paint has not touched, oldest first, `ub` (16384) the alias bound, and `db`, which scores every slot against the probe by squared channel distance — counting `Lr.defaultMismatch` where a default flag differs — and answers the closest [253057,253816) 759 units sha256 511f62408b4a1d8749c930a044722148add05c7e9d73db09129b709162edc908
var lb=()=>({slots:[],held:new Map,table:new Uint8Array(Sc*gn.width),probe:new Uint8Array(gn.width),aliases:new Map,admissions:0,paint:0,frame:new Set,evaluated:0,lastSgr:hc(),isStarved:!1,hasCarried:!1,netMatched:0,hasStale:!1});function cb(e){let n=[],r=(s)=>e.slots[s]?.lastPaint??0;return e.slots.forEach((s,h)=>{if(s.lastPaint<e.paint)n.push(h)}),n.toSorted((s,h)=>r(s)-r(h))}var ub=16384;function db(e,n,r){let s=-1,h=1/0;for(let y=0;y<n;y++){let b=y*gn.width,w=0;for(let R=0;R<gn.width;R+=gn.backgroundDefault){let T=(e[b+R]??0)===1,P=(r[R]??0)===1;if(T||P)w+=T===P?0:Lr.defaultMismatch;else{let M=(e[b+R+1]??0)-(r[R+1]??0),z=(e[b+R+2]??0)-(r[R+2]??0),N=(e[b+R+gn.foregroundBlue]??0)-(r[R+gn.foregroundBlue]??0);w+=M*M+z*z+N*N}}if(w<h)h=w,s=y}return s}

// chunk-n3ykh62m.js `gb` (1024) and `hb` (131072), the two numbers the engine spends and bounds its work with: the cost of reusing a slot, and the cap on what one paint may evaluate [253943,253969) 26 units sha256 ddb43b7ff4aa8438f5b9f6734c3b0e21dd18c3e0090ff2a5b4be4fbe8e66ff73
var gb=1024;var hb=131072;

// chunk-n3ykh62m.js the engine and the rows it writes: `gNs`, whose `beginPaint` admits the frame's keys (a free slot or the stalest one, each admitted through the token row), rewrites the table, and whose `sgrOf` answers a key's escape — reusing what the last paint placed, then a slot matched by `db`, and answering the held escape when neither applies — with `size()` and `standing()` beside it; `_b`, which turns a frame into the distinct colour runs a row is made of; and `Lss`, which walks the frame row by row, emitting an escape only when the colour changes and a character for every cell [254367,256690) 2323 units sha256 6f0a619dd91a56690db2ee8cbb17069319b93feb9bfc5abd9523c6247cbf3721
function gNs(e=Date.now,n=mb()){let r=lb(),s=(M)=>M!==void 0&&r.held.get(M.entry.key)===M.entry;function h(M,z){let N={key:z,sgr:gc(z),lastPaint:r.paint},V=r.slots[M];if(V!==void 0)r.held.delete(V.key);r.slots[M]=N,r.held.set(z,N),r.admissions+=1,$f(r.table,M,z)}function y(){let M=[];for(let V of r.frame){let X=r.held.get(V),Z=r.aliases.get(V);if(X!==void 0){X.lastPaint=r.paint;continue}if(M.push(V),Z!==void 0)r.aliases.delete(V),r.aliases.set(V,Z)}let z=cb(r),N=0;for(let V of M){let X=r.slots.length<Sc,Z=X?r.slots.length:z[N];if(Z===void 0)break;if(!Sb(n,e(),X?0:gb)){r.isStarved=!0;break}h(Z,V),N+=X?0:1}}let b=(M)=>!r.frame.has(M)||r.held.has(M)||!s(r.aliases.get(M));function w(){let M,z=0;for(let N of r.aliases.keys()){if(M??=N,b(N)){M=N;break}if(z+=1,z>=nb)break}if(M!==void 0)r.netMatched-=b(M)?0:1,r.aliases.delete(M)}function R(M,z){let N=!s(r.aliases.get(M));if(r.aliases.has(M))r.aliases.delete(M);else if(r.aliases.size>=ub)w();r.aliases.set(M,{entry:z,after:r.admissions}),r.netMatched+=N?1:0}function T(M){if(!(r.slots.length>0&&r.evaluated+r.slots.length<=hb))return;$f(r.probe,0,M),r.evaluated+=r.slots.length;let N=r.slots[db(r.table,r.slots.length,r.probe)];if(N!==void 0)R(M,N);return N}function P(M){let z=r.aliases.get(M),N=z!==void 0&&s(z);if(N&&z.after===r.admissions)return z.entry;let V=T(M);if(V===void 0&&N)return r.hasStale=!0,z.entry;return r.hasCarried||=V===void 0&&r.slots.length>0,V}return{beginPaint:(M)=>{r.paint+=1,r.frame=M,r.evaluated=0,r.lastSgr=hc(),r.isStarved=!1,r.hasCarried=!1,r.netMatched=0,r.hasStale=!1,y()},sgrOf:(M)=>(r.lastSgr=(r.held.get(M)??P(M))?.sgr??r.lastSgr,r.lastSgr),size:()=>r.held.size,standing:()=>(r.hasCarried&&r.netMatched>0||r.hasStale&&!r.isStarved)&&"progressing"||(r.isStarved?"waiting":"complete")}}function _b(e,n){let{columns:r,rows:s}=n,h=[],y=new Set;for(let b=0;b<s;b++){let w=-1,R=-1;for(let T=0;T<r;T++){let P=(b*r+T)*xo,M=e[P+1]??0,z=e[P+2]??0;if(M!==w||z!==R){let N=pc(M,z);h.push(N),y.add(N),w=M,R=z}}}return{keys:h,distinct:y}}function Lss(e,n,r){let{columns:s,rows:h}=n,y=_b(e,n),b=Array(h),w=0;r.beginPaint(y.distinct);for(let R=0;R<h;R++){let T="",P=-1,M=-1;for(let z=0;z<s;z++){let N=(R*s+z)*xo,V=e[N+1]??0,X=e[N+2]??0;if(V!==P||X!==M)T+=r.sgrOf(y.keys[w]??0),w+=1,P=V,M=X;T+=String.fromCharCode(e[N]??0)}b[R]=T}return b.join(`
`)}

// chunk-yn0pfn70.js the terminal grammar the CSI helper is written against: `xse` the C0 code points, `PH` the escape, `nG` the bell, `Y9e` the parameter separator, `fRr` the charset reset, and `CZ` the introducer bytes (CSI 91, OSC 93, DCS 80, APC 95, PM 94, SOS 88, ST 92) [935,1251) 316 units sha256 69349112aba6fa4d3aac4ee268ef2788fa8a753d6ff8ca5e11429414060f20b9
var xse={NUL:0,SOH:1,STX:2,ETX:3,EOT:4,ENQ:5,ACK:6,BEL:7,BS:8,HT:9,LF:10,VT:11,FF:12,CR:13,SO:14,SI:15,DLE:16,DC1:17,DC2:18,DC3:19,DC4:20,NAK:21,SYN:22,ETB:23,CAN:24,EM:25,SUB:26,ESC:27,FS:28,GS:29,RS:30,US:31,DEL:127},PH="\x1B",nG="\x07",Y9e=";",fRr="\x1B(B\x0F",CZ={CSI:91,OSC:93,DCS:80,APC:95,PM:94,SOS:88,ST:92};

// chunk-yn0pfn70.js `A`, the CSI introducer built from the grammar (esc plus the CSI byte), and `S`, the parameter/intermediate/final byte ranges [1286,1426) 140 units sha256 c3e5ff3b87596780a747797d123698c84ca59f7c5b34f65e0571695223954936
var A=PH+String.fromCharCode(CZ.CSI),S={PARAM_START:48,PARAM_END:63,INTERMEDIATE_START:32,INTERMEDIATE_END:47,FINAL_START:64,FINAL_END:126};

// chunk-yn0pfn70.js `fl`, the CSI helper the SGR builder writes every sequence with: no argument answers the bare introducer, one argument appends it, and more join all but the last with the separator and append the last [1602,1743) 141 units sha256 170e58f6012a41244bb2e73a9c56d30c2b424a249482127cd5a12f21e501a7c8
function fl(...e){if(e.length===0)return A;if(e.length===1)return`${A}${e[0]}`;let t=e.slice(0,-1),r=e.at(-1);return`${A}${t.join(Y9e)}${r}`}


export { nb, fc, Ff, pc, _s, Hf, gc, hc, Sc, lb, cb, ub, db, gb, hb, gNs, _b, Lss, xse, PH, nG, Y9e, fRr, CZ, A, S, fl };
