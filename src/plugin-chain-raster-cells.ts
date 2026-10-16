// The raster cell encoder and the admission bucket (W45-60). The copied bodies live in
// ./plugin-chain-raster-cells-source.ts; this module is the host seam around them, and it is the other
// half of the raster surface W45-59's mount writers and W45-58's ui.blit entry sit between.
//
// Source, chunk-n3ykh62m.js — the constants and the layout one painted cell is written in:
//
//   var tb=1000;  (the refill base, in ms)
//   var Lr={halfBits:16,halfMask:65535,defaultMismatch:4096};var dc=(e)=>e>>>Lr.halfBits&Lr.halfMask;
//   var Gn={channelBits:4,channelMax:15,step:17,greenShift:4,redShift:8};
//   var ys=32768;
//   var mc=(e)=>e&Lr.halfMask;
//   var gn={width:8,foregroundDefault:0,foregroundRed:1,foregroundGreen:2,foregroundBlue:3,backgroundDefault:4,backgroundRed:5,backgroundGreen:6,backgroundBlue:7};
//
// [248693,248812) 109 units, [252131,252200) 69, [252243,252256) 13, [252455,252481) 26 and
// [252898,253057) 159 — the encoder's closures. The bucket and the encoder themselves:
//
//   var bc=4096;var fb=()=>({tokens:bc,refilledAt:0});var mb=Ge(()=>it().rasterAdmission??=fb(),()=>{it().rasterAdmission=void 0});
//   var yb=160;
//   function Sb(e,n,r){e.tokens=Math.min(bc,e.tokens+Math.max(0,n-e.refilledAt)*yb/tb),e.refilledAt=n;let s=e.tokens-r>=1;return e.tokens-=s?1:0,s}function $f(e,n,r){let{redShift:s,greenShift:h,channelMax:y}=Gn;function b(w,R){e[w]=R===ys?1:0,e[w+gn.foregroundRed]=R>>s&y,e[w+gn.foregroundGreen]=R>>h&y,e[w+gn.foregroundBlue]=R&y}b(n*gn.width,mc(r)),b(n*gn.width+gn.backgroundDefault,dc(r))}
//
// [253816,253943) 127 units and [253969,254367) 398. `Ge` — the chain-runner copy's own body
// (chunk-ae84tp6z.js [5355,5381) 26 units, sha256 19b806bd…) — is `function Ge(t,e){return t}`: an
// identity in this build, so `mb` *is* the factory it was handed and the invalidator beside it is
// dropped by the source itself. `mb()` therefore lazily creates the row on the first read and there is
// no reset through it; a caller that wants the row gone clears the registry field.
//
// The validating mount, chunk-n3ykh62m.js [256690,256712) 22 and [257058,257143) 85:
//
//   var bb=512;var wb=256;
//   var tF=(e,n)=>Kbr(e,n,{columns:bb,rows:wb});var Xto=["key","columns","rows","cells"];
//
// and its check, `Kbr`, in the chain-runner module (chunk-nyce03br.js [87140,87341) 201 units), which
// needs only `h$` — a body that copy already carries and W45-58 exported:
//
//   function Kbr(e,t,o){if(!(h$(e)&&e>=1&&e<=o.columns))return`columns must be a whole number from 1 to ${o.columns}`;return h$(t)&&t>=1&&t<=o.rows?void 0:`rows must be a whole number from 1 to ${o.rows}`}
//
// What a cell *is* is the source's own distinction, kept as it is: `$f` writes eight words per cell —
// a default flag plus three channels for the foreground, then the same four for the background — into
// a surface's word table, and each colour is a packed pair whose low half is the foreground and whose
// high half is the background (`mc`/`dc` over `Lr`). That is the surface's own frame layout, not the
// wire shape `$.ui.blit` reads: the blit's `cells` are three words per cell and its `decodeBlitCells`
// unpacks them, so the two encodings meet only at the paint a site hands over.
import type { RasterAdmission } from './plugin-chain-registry-state.js';
import { $f, Gn, Kbr, Lr, Sb, Xto, bb, bc, dc, fb, gn, mc, mb, tF, tb, wb, yb, ys } from './plugin-chain-raster-cells-source.js';

/** One painted cell is eight words (`gn.width`): a flag and three channels for the foreground, then the
 *  same four for the background. The offsets the encoder writes are the source's own field names. */
export const CELL_WORDS = gn as {
  width: number;
  foregroundDefault: number;
  foregroundRed: number;
  foregroundGreen: number;
  foregroundBlue: number;
  backgroundDefault: number;
  backgroundRed: number;
  backgroundGreen: number;
  backgroundBlue: number;
};

/** The channel packing every colour goes through (`Gn`): four bits a channel, green at shift 4, red at 8. */
export const CHANNEL_LAYOUT = Gn;
/** The sentinel a channel carries when it is the surface default rather than a packed colour (`ys`). */
export const DEFAULT_CHANNEL = ys;
/** The packed-pair halves (`Lr`, with `mc` and `dc`): one word holds the foreground and the background. */
export const COLOUR_HALVES = Lr;
/** A token row's capacity, tokens a second, and the millisecond base they refill against (`bc`, `yb`, `tb`). */
export const RASTER_ADMISSION_CAPACITY = bc;
export const RASTER_TOKENS_PER_SECOND = yb;
export const RASTER_REFILL_MS = tb;
/** The default raster size the validating mount checks against (`bb`, `wb`) — 512 by 256. */
export const DEFAULT_RASTER_COLUMNS = bb;
export const DEFAULT_RASTER_ROWS = wb;
/** The fields a site mount admits (`Xto`). */
export const SITE_MOUNT_FIELDS: readonly string[] = Xto;

/** Source `fb`: a fresh admission row at full capacity, never refilled. */
export function freshRasterAdmission(): RasterAdmission {
  return (fb as () => RasterAdmission)();
}

/** Source `mb`: the admission row in the host registry, created on the first read (`??=`). The source
 *  hands `Ge` a factory and an invalidator, but `Ge` is an identity in this build, so the row is the
 *  factory's and there is no reset through this accessor. */
export function rasterAdmission(): RasterAdmission {
  return (mb as () => RasterAdmission)();
}

/** Source `Sb`: refill the row against a clock and spend `cost` tokens on one frame, answering whether
 *  the frame is admitted. The refill is capped at the capacity and never runs backwards; a frame is
 *  admitted only when a whole token is available, and a refused frame spends nothing. */
export function admitRasterFrame(row: RasterAdmission, nowMs: number, cost: number): boolean {
  return (Sb as (row: RasterAdmission, nowMs: number, cost: number) => boolean)(row, nowMs, cost);
}

/** Source `$f`: write cell `index` of `table` from one packed colour pair — the foreground in the low
 *  half, the background in the high half — marking a channel as the default when it is the sentinel.
 *  The source writes into the surface's own cell table, which is a byte array: every word is a flag or
 *  a four-bit channel. */
export function encodeCell(table: Uint8Array | Uint32Array, index: number, colour: number): void {
  (($f as unknown) as (table: Uint8Array | Uint32Array, index: number, colour: number) => void)(table, index, colour);
}

/** Source `mc` and `dc`: the low and high halves of a packed pair, the foreground and the background. */
export function foregroundHalf(colour: number): number {
  return (mc as (colour: number) => number)(colour);
}
export function backgroundHalf(colour: number): number {
  return (dc as (colour: number) => number)(colour);
}

/** Source `Kbr`: check one size against a limit, answering the sentence that names the field and the
 *  limit, or `undefined` when the value is a whole number in `1..limit`. */
export function validateRasterSize(columns: number, rows: number, limits: { columns: number; rows: number }): string | undefined {
  return (Kbr as (columns: number, rows: number, limits: { columns: number; rows: number }) => string | undefined)(columns, rows, limits);
}

/** Source `tF`: the same check against the default size, `DEFAULT_RASTER_COLUMNS` by `DEFAULT_RASTER_ROWS`. */
export function validateDefaultRasterSize(columns: number, rows: number): string | undefined {
  return (tF as (columns: number, rows: number) => string | undefined)(columns, rows);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  surface with the text. The seam's own names above are the ones a surface calls. */
export { $f, Kbr, Lr, Sb, Xto, bb, bc, dc, fb, gn, Gn, mc, mb, tF, tb, wb, yb, ys } from './plugin-chain-raster-cells-source.js';
