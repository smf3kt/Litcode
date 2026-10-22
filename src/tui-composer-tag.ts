// @ts-nocheck
// Exact source bodies: research/ports/W283-composer-ultracode-tag.md.
import { ge } from './tui-color.js';

/** The composer's top-border tag. `XZ`, `mVn`, `vkt` and `$Ie` are chunk-24k7d6mw.js 154093. */
var XZ = 'ultracode', mVn = '#d0b4ff', vkt = XZ.length + 2, $Ie = 120;

/**
 * `tee` (chunk-24k7d6mw.js [153563,153841)): the word painted in the `effortUltra` slot, with the
 * reveal index carrying a `#d0b4ff` bold shimmer and its two neighbours bold. `h` is the gate and
 * `T` the index `oee` hands back; `undefined` is the finished tag.
 *
 * The source builds `L` from `Wn("effortUltra", hs("theme","dark").value)`; the host supplies the
 * same slot painter as `paint`, because its palette lookup lives on the terminal owner.
 */
export function ultracodeTagText(h, T, paint) {
  if (h) {
    if (T === void 0) return paint(XZ);
    return [...XZ].map((ee, he) => he === T ? ge.hex(mVn).bold(ee) : he === T - 1 || he === T + 1 ? ge.bold(paint(ee)) : paint(ee)).join('');
  }
  return;
}

/**
 * `oee`'s arithmetic without its React wrapper: `ee.current` is the reveal's start clock,
 * `we = floor((he-ee.current)/$Ie)` the frame, and the index is `we-1` until `we` reaches `vkt`,
 * after which the hook clears its own flag and the tag stays plain.
 */
export function ultracodeRevealIndex(startedAt, now) {
  if (startedAt === void 0) return;
  const we = Math.floor((now - startedAt) / $Ie), Te = we >= vkt;
  if (Te) return;
  return we - 1;
}

/** True once the reveal has run its `vkt` frames, the point `oee` stops its clock. */
export function ultracodeRevealDone(startedAt, now) {
  return startedAt !== void 0 && Math.floor((now - startedAt) / $Ie) >= vkt;
}

/**
 * `nee` (chunk-24k7d6mw.js [154093,154307)): the parts the composer's top border carries, joined
 * with two spaces and padded with one on each side. An empty list draws no border text.
 */
export function topBorderText(h: readonly (string | undefined)[]):
  { content: string; position: 'top'; align: 'end'; offset: number } | undefined {
  let T = h.filter(Boolean).join('  ') || void 0;
  return T ? {content:` ${T} `,position:'top',align:'end',offset:0} : void 0;
}

export { XZ, mVn, vkt, $Ie };
export const ULTRA_TAG_FRAME = $Ie;
