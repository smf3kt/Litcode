// Recovered preview sanitizer. Bodies follow chunk-qq2mgstr.js (UTF-16 ranges):
// ln [8080,8178), L [8178,8299), cn [8375,8414), Ce [8414,8503),
// pc [8706,8741), nD [15431,15484), Ee [15517,15549).
// Zs and zp come from the existing source copies; ZSo is identity, so Gat = pc.
import { L, xg } from './plugin-chain-label-text-source.js';
import { Zs, rPe } from './plugin-chain-normalize-source.js';

/** Recovered `ln`: code points `cn` keeps in place (default-ignorable set). */
function ln(code: number): boolean {
  return code >= 8204 && code <= 8207 || code === 1564 || code >= 65024 && code <= 65039 || code >= 6155 && code <= 6159 || code === 10240;
}
/** Recovered `cn`: replace a character when `L` holds and the code is not in `ln`. */
function cn(char: string, code: number): boolean {
  return L(char, code) && !ln(code);
}
/** Recovered `Ce`: replace matching code points with U+FFFD, iterating code points. */
function Ce(value: string, predicate: (char: string, code: number) => boolean): string {
  let out = '';
  for (const char of value) out += predicate(char, char.codePointAt(0) ?? 0) ? '�' : char;
  return out;
}
/** Recovered `pc`: the preview sanitise pass. */
export function previewSanitized(value: string): string {
  return Zs(Ce(value, cn));
}
/** Recovered `Ee`: the text still changes under the mark collapser. */
export function previewRewritten(value: string): boolean {
  return xg(value) !== value;
}
/** Recovered `nD`: sanitised text carries a truncation marker or is rewritten. */
export function previewUnstableInput(value: string): boolean {
  const normalized = previewSanitized(value);
  return rPe.test(normalized) || previewRewritten(normalized);
}
/** The recovered display check after sanitising and tab replacement. */
export function previewUnstableText(value: string): boolean {
  return rPe.test(value) || previewRewritten(value);
}
