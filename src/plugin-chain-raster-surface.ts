// The raster surface engine (W45-61). The copied bodies live in ./plugin-chain-raster-surface-source.ts;
// this module is the host seam around them. It is the last piece of the raster surface: W45-60's encoder
// and bucket, W45-59's mount writers, W45-58's ui.blit entry, and here the pass that admits a frame's
// colours, places them in a slot table, matches each one against what the surface already holds, and
// answers the escape that draws it.
//
// Source, chunk-n3ykh62m.js — the grammar the escapes are written in:
//
//   var nb=64;
//   var fc=(e,n)=>(e>>n&Gn.channelMax)*Gn.step;
//   function Ff(e){if(e===ko)return ys;let n=(r)=>Math.round((e>>r&gs.channelMask)/Gn.step);return n(gs.redShift)<<Gn.redShift|n(gs.greenShift)<<Gn.greenShift|n(0)}var pc=(e,n)=>Ff(e)|Ff(n)<<Lr.halfBits;
//   var _s={setForeground:38,setBackground:48,resetForeground:39,resetBackground:49,truecolor:2};function Hf(e,n){let r=n==="foreground";return e===ys?String(r?_s.resetForeground:_s.resetBackground):[r?_s.setForeground:_s.setBackground,_s.truecolor,fc(e,Gn.redShift),fc(e,Gn.greenShift),fc(e,0)].join(";")}var gc=(e)=>fl(`${Hf(mc(e),"foreground")}m`)+fl(`${Hf(dc(e),"background")}m`);var hc=()=>gc(pc(ko,ko));var Sc=1024;
//
// [248705,248715) 10, [252200,252243) 43, [252256,252455) 199 and [252481,252898) 417 — `nb`, `fc`, the
// colour pair, and the SGR builder. `mc`/`dc` above are W45-60's, imported. The state and the matcher:
//
//   var lb=()=>({slots:[],held:new Map,table:new Uint8Array(Sc*gn.width),probe:new Uint8Array(gn.width),aliases:new Map,admissions:0,paint:0,frame:new Set,evaluated:0,lastSgr:hc(),isStarved:!1,hasCarried:!1,netMatched:0,hasStale:!1});function cb(e){let n=[],r=(s)=>e.slots[s]?.lastPaint??0;return e.slots.forEach((s,h)=>{if(s.lastPaint<e.paint)n.push(h)}),n.toSorted((s,h)=>r(s)-r(h))}var ub=16384;function db(e,n,r){let s=-1,h=1/0;for(let y=0;y<n;y++){let b=y*gn.width,w=0;for(let R=0;R<gn.width;R+=gn.backgroundDefault){let T=(e[b+R]??0)===1,P=(r[R]??0)===1;if(T||P)w+=T===P?0:Lr.defaultMismatch;else{let M=(e[b+R+1]??0)-(r[R+1]??0),z=(e[b+R+2]??0)-(r[R+2]??0),N=(e[b+R+gn.foregroundBlue]??0)-(r[R+gn.foregroundBlue]??0);w+=M*M+z*z+N*N}}if(w<h)h=w,s=y}return s}
//
// [253057,253816) 759. `db` walks every slot and every cell of it in steps of `gn.backgroundDefault`,
// scoring a default-flag difference at `Lr.defaultMismatch` and otherwise the squared channel distance,
// and answers the closest slot — the first one wins a tie, because the comparison is strict. The two
// numbers the engine spends with:
//
//   var gb=1024;var hb=131072;
//
// [253943,253969) 26 — the cost of reusing a slot, and the cap on what one paint may evaluate. Then the
// engine itself, chunk-n3ykh62m.js [254367,256690) 2,323 units, whose entry and answer are:
//
//   function gNs(e=Date.now,n=mb()){let r=lb(),s=(M)=>M!==void 0&&r.held.get(M.entry.key)===M.entry; …
//   return{beginPaint:(M)=>{…},sgrOf:(M)=>(r.lastSgr=(r.held.get(M)??P(M))?.sgr??r.lastSgr,r.lastSgr),size:()=>r.held.size,standing:()=>(r.hasCarried&&r.netMatched>0||r.hasStale&&!r.isStarved)&&"progressing"||(r.isStarved?"waiting":"complete")}}
//
// `_b` ([256143,256382) 239) turns a frame into the colour runs a row is made of, and `Lss`
// ([256382,256690) 308) walks it row by row, emitting an escape only where the colour changes:
//
//   function _b(e,n){let{columns:r,rows:s}=n,h=[],y=new Set;for(let b=0;b<s;b++){ …
//   function Lss(e,n,r){let{columns:s,rows:h}=n,y=_b(e,n),b=Array(h),w=0;r.beginPaint(y.distinct); …
//
// The CSI helper the SGR builder is written with, chunk-yn0pfn70.js — the grammar at [935,1251) 316:
//
//   var xse={NUL:0,SOH:1,STX:2,ETX:3,EOT:4,ENQ:5,ACK:6,BEL:7,BS:8,HT:9,LF:10,VT:11,FF:12,CR:13,SO:14,SI:15,DLE:16,DC1:17,DC2:18,DC3:19,DC4:20,NAK:21,SYN:22,ETB:23,CAN:24,EM:25,SUB:26,ESC:27,FS:28,GS:29,RS:30,US:31,DEL:127},PH="\x1B",nG="\x07",Y9e=";",fRr="\x1B(B\x0F",CZ={CSI:91,OSC:93,DCS:80,APC:95,PM:94,SOS:88,ST:92};
//
// the introducer at [1286,1426) 140 and the helper at [1602,1743) 141:
//
//   var A=PH+String.fromCharCode(CZ.CSI),S={PARAM_START:48,PARAM_END:63,INTERMEDIATE_START:32,INTERMEDIATE_END:47,FINAL_START:64,FINAL_END:126};
//   function fl(...e){if(e.length===0)return A;if(e.length===1)return`${A}${e[0]}`;let t=e.slice(0,-1),r=e.at(-1);return`${A}${t.join(Y9e)}${r}`}
//
// What the engine does with a frame is its own and is kept as it is. `beginPaint` increments the paint
// counter, records the frame, resets `evaluated` and the four status flags, sets `lastSgr` back to the
// reset sequence, then walks the frame: a key the surface already holds only has its `lastPaint` touched,
// while anything else takes a free slot or the stalest one, and each of those is admitted through the
// token row W45-60 ported — a fresh slot for nothing, a reused one for `REUSE_COST`. `sgrOf` answers a
// key's escape: what the surface holds, else what `db` matched (a colour the surface can draw with a slot
// it already has, recorded as an alias), else the last escape it emitted. `standing()` reports
// `progressing` when a paint carried colours and matched some, `waiting` when the row refused a frame,
// and `complete` otherwise.
import type {
  RasterAdmission, RasterSurface, RasterSurfaceState, RasterSurfaceStanding,
} from './plugin-chain-registry-state.js';
import {
  _b, _s, A, cb, CZ, db, fc, Ff, fl, gb, gNs, gc, hb, Hf, hc, lb, Lss, nG, nb, pc, PH, S, Sc, ub, xse, Y9e, fRr,
} from './plugin-chain-raster-surface-source.js';

/** One cell of a frame is `CELL_STRIDE` entries: the code point, the foreground and the background, each
 *  colour a 24-bit word (`gs`) whose channels the packer narrows to four bits. */
export const CELL_STRIDE = 3;
/** The slot capacity (`Sc`), the alias bound (`ub`) and the alias sweep (`nb`). */
export const SLOT_CAPACITY = Sc;
export const ALIAS_LIMIT = ub;
export const ALIAS_SWEEP = nb;
/** What one reused slot costs the token row (`gb`), and how much one paint may evaluate (`hb`). */
export const REUSE_COST = gb;
export const EVALUATION_BUDGET = hb;
/** The SGR codes the escapes are built from (`_s`), and the control codes beside them (`xse`). */
export const SGR_CODES = _s;
export const CONTROL_CODES = xse;
/** The C0/CSI bytes (`CZ`), the escape (`PH`), the bell (`nG`), the parameter separator (`Y9e`), the
 *  charset reset (`fRr`), the CSI introducer (`A`) and the parameter byte ranges (`S`). */
export const CSI_BYTES = CZ;
export const ESCAPE = PH;
export const BELL = nG;
export const PARAMETER_SEPARATOR = Y9e;
export const CHARSET_RESET = fRr;
export const CSI = A;
export const PARAMETER_BYTE_RANGES = S;

/** Source `fl`: the CSI sequence — the bare introducer with no argument, the introducer and one value
 *  with one, and every argument but the last joined with the separator before the last. */
export function csi(...parts: Array<string | number>): string {
  return (fl as (...parts: Array<string | number>) => string)(...parts);
}

/** Source `fc`: one channel of a packed colour widened from its four bits to 0..255. */
export function channelByte(colour: number, shift: number): number {
  return (fc as (colour: number, shift: number) => number)(colour, shift);
}

/** Source `Ff`: a 24-bit colour narrowed to the four-bits-a-channel form the escapes carry, with the
 *  no-colour sentinel answering the default marker unchanged. */
export function toPackedColour(colour: number): number {
  return (Ff as (colour: number) => number)(colour);
}

/** Source `pc`: one word holding a foreground and a background — the pair a frame's colour key is. */
export function packColourPair(foreground: number, background: number): number {
  return (pc as (foreground: number, background: number) => number)(foreground, background);
}

/** Source `Hf`: the SGR parameter list for one side of a colour, or that side's reset code when the
 *  colour is the default marker. */
export function sgrSide(colour: number, side: 'foreground' | 'background'): string {
  return (Hf as (colour: number, side: string) => string)(colour, side);
}

/** Source `gc`: the two sequences a colour is drawn with, foreground then background. */
export function sgrPair(colour: number): string {
  return (gc as (colour: number) => string)(colour);
}

/** Source `hc`: the sequence a paint starts from — both sides reset. */
export function resetSgr(): string {
  return (hc as () => string)();
}

/** Source `lb`: a fresh surface row — no slots, an empty cell table and probe, no aliases, and the
 *  status flags a paint resets. */
export function freshSurfaceState(): RasterSurfaceState {
  return (lb as () => RasterSurfaceState)();
}

/** Source `cb`: the slots a paint has not touched, oldest first. */
export function staleSlots(state: RasterSurfaceState): number[] {
  return (cb as (state: RasterSurfaceState) => number[])(state);
}

/** Source `db`: the slot whose cell is closest to the probe, by squared channel distance with
 *  `Lr.defaultMismatch` counted for a differing default flag; -1 when there is nothing to compare. */
export function nearestSlot(table: Uint8Array, count: number, probe: Uint8Array): number {
  return (db as (table: Uint8Array, count: number, probe: Uint8Array) => number)(table, count, probe);
}

/** Source `gNs`: the surface engine. `beginPaint` admits a frame's colours, `sgrOf` answers one key's
 *  escape, `size()` is how many the surface holds, and `standing()` reports the paint's progress. */
export function createRasterSurface(now?: () => number, admission?: { tokens: number; refilledAt: number }): RasterSurface {
  return (gNs as (now?: () => number, admission?: unknown) => RasterSurface)(now, admission);
}

/** Source `_b`: the colour keys a frame is made of, in cell order, and the distinct set of them. */
export function frameRuns(frame: ArrayLike<number>, size: { columns: number; rows: number }): { keys: number[]; distinct: Set<number> } {
  return (_b as (frame: ArrayLike<number>, size: { columns: number; rows: number }) => { keys: number[]; distinct: Set<number> })(frame, size);
}

/** Source `Lss`: the frame drawn as text — one line a row, an escape emitted only where the colour
 *  changes, and a character for every cell. */
export function renderRows(frame: ArrayLike<number>, size: { columns: number; rows: number }, surface: RasterSurface): string {
  return (Lss as (frame: ArrayLike<number>, size: { columns: number; rows: number }, surface: RasterSurface) => string)(frame, size, surface);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  surface with the text. The seam's own names above are the ones a surface calls. */
export { _b, _s, A, cb, CZ, db, fc, Ff, fl, gb, gNs, gc, hb, Hf, hc, lb, Lss, nG, nb, pc, PH, S, Sc, ub, xse, Y9e, fRr };
