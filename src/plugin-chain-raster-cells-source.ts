// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The raster cell encoder and the admission bucket a surface paints its frames through (W45-60).
// A site validates its key and size through `tF`/`Kbr`, mounts through the W45-59 writers, and paints
// a frame by encoding each cell with `$f` into the surface word table while `Sb` admits the frame
// against a refilling token row (`mb`, held in the host registry as `rasterAdmission`).
//
// Eleven blocks, 1,209 units. The pair and the constants are read from the same module as the mount
// writers; `Kbr` lives in the chain-runner module and needs only `h$`, which that copy carries and
// W45-58 exported. `Ge` is the chain-runner copy's own body — an identity in this build, so `mb` is
// the factory it was handed and the invalidator beside it is dropped by the source itself.
import { Ge, h$ } from './plugin-chain-source.js';
import { it } from './plugin-chain-host.js';

// chunk-n3ykh62m.js `tb`, the millisecond base the token bucket refills against (1000) — the sibling `nb` (64) belongs to the engine and is not copied [248693,248705) 12 units sha256 aadbcdf6cce5c82e0452ee8e28b2ecf5d9d3ebb91bac5c7fb7ff692d0ae370f7
var tb=1000;

// chunk-n3ykh62m.js the packed-colour half word: `Lr` (halfBits 16, halfMask 65535, defaultMismatch 4096) and `dc`, which takes the high half — with `mc`, the low half [248715,248812) 97 units sha256 27ece60a9038ef26d15ba9ab57b7e7eeee7b1593759cae5e38c27ed343f67d70
var Lr={halfBits:16,halfMask:65535,defaultMismatch:4096};var dc=(e)=>e>>>Lr.halfBits&Lr.halfMask;

// chunk-n3ykh62m.js `Gn`, the channel layout one colour is packed with: 4 bits per channel, max 15, step 17, green at shift 4 and red at shift 8 [252131,252200) 69 units sha256 d188ec14741d944108baed5b653d5951e95a3bae85713c844fd75d69b3db6aa4
var Gn={channelBits:4,channelMax:15,step:17,greenShift:4,redShift:8};

// chunk-n3ykh62m.js `ys`, the sentinel (32768, the high bit) that marks a channel as the surface default rather than a packed colour [252243,252256) 13 units sha256 2edf2d0515f37bd4884fa3c45a339f74ffd64b73fb0dd8a45509db07aacbc9b1
var ys=32768;

// chunk-n3ykh62m.js `mc`, the low half of the packed pair — the foreground half `$f` writes [252455,252481) 26 units sha256 f445468cdece24585d649e06eb8c8a98a36475d2fa0940132cde40e32846f316
var mc=(e)=>e&Lr.halfMask;

// chunk-n3ykh62m.js `gn`, the word layout of one painted cell: width 8, then foreground default/red/green/blue at 0..3 and background default/red/green/blue at 4..7 [252898,253057) 159 units sha256 0f21734b0af33bba0dcd8a55239aa25d0accc96e34b76854129caa8a40447fd1
var gn={width:8,foregroundDefault:0,foregroundRed:1,foregroundGreen:2,foregroundBlue:3,backgroundDefault:4,backgroundRed:5,backgroundGreen:6,backgroundBlue:7};

// chunk-n3ykh62m.js the admission bucket: `bc` its capacity (4096), `fb` the fresh row (`{tokens: bc, refilledAt: 0}`), and `mb` the memoized accessor that lazily writes the row into the host registry and clears it again [253816,253943) 127 units sha256 59c67400bfe5f2edb3d55fdaa7b15205b4efdb00ebc97e0177bd47d61f4ef679
var bc=4096;var fb=()=>({tokens:bc,refilledAt:0});var mb=Ge(()=>it().rasterAdmission??=fb(),()=>{it().rasterAdmission=void 0});

// chunk-n3ykh62m.js the refill and the encoder: `yb` the tokens per second (160), `Sb` which refills the row against the clock and spends one token per admitted frame, and `$f` which writes one cell — the default flag plus the three channels of the foreground and of the background — into the surface word table. The sibling constants `gb` (1024) and `hb` (131072) are the engine's costs, not this pair's [253969,254367) 398 units sha256 2c4af259dd2c6b7d55fbc7a1e3b582b50f1ce85bee9780c3a9b85a5c2dd4be90
var yb=160;function Sb(e,n,r){e.tokens=Math.min(bc,e.tokens+Math.max(0,n-e.refilledAt)*yb/tb),e.refilledAt=n;let s=e.tokens-r>=1;return e.tokens-=s?1:0,s}function $f(e,n,r){let{redShift:s,greenShift:h,channelMax:y}=Gn;function b(w,R){e[w]=R===ys?1:0,e[w+gn.foregroundRed]=R>>s&y,e[w+gn.foregroundGreen]=R>>h&y,e[w+gn.foregroundBlue]=R&y}b(n*gn.width,mc(r)),b(n*gn.width+gn.backgroundDefault,dc(r))}

// chunk-n3ykh62m.js `bb` and `wb`, the default raster size (512 by 256) the validating mount checks against [256690,256712) 22 units sha256 e88c86bcbbb9cb86182c972d3958c029e1651efdf0c363115e8e94fbe0e741b7
var bb=512;var wb=256;

// chunk-n3ykh62m.js the validating mount: `tF`, which checks a key and size against the defaults through `Kbr`, and `Xto`, the field list a site mount admits [257058,257143) 85 units sha256 366fa4671a716a6e9a22e82e72f66125eac2c25618aa725fa6a1c902c4522a43
var tF=(e,n)=>Kbr(e,n,{columns:bb,rows:wb});var Xto=["key","columns","rows","cells"];

// chunk-nyce03br.js `Kbr`, the whole-number check both sizes answer: a columns outside 1..the limit gets `columns must be a whole number from 1 to N`, and a rows gets the same sentence for `rows` [87140,87341) 201 units sha256 88bcdddbdca228e2f9f4dd33966ef4956beab38724f6f0dbfe1541acdc69b3d7
function Kbr(e,t,o){if(!(h$(e)&&e>=1&&e<=o.columns))return`columns must be a whole number from 1 to ${o.columns}`;return h$(t)&&t>=1&&t<=o.rows?void 0:`rows must be a whole number from 1 to ${o.rows}`}


export { tb, Lr, dc, Gn, ys, mc, gn, bc, fb, mb, yb, Sb, $f, bb, wb, tF, Xto, Kbr };
