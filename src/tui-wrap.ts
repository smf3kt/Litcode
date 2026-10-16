import wrapAnsi from 'wrap-ansi';
import { cellWidth } from './terminal.js';
import { tokenizeAnsi } from './tui-ansi-tokenizer.js';

/**
 * Adapted from re/M in chunk-yn0pfn70.js [6721,7581), zero-based UTF-16.
 * Module SHA-256: 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f.
 * Keep the source mask -> wrap -> restore and literal-collision order. Node's
 * wrapper normalizes NFC, so protect changing single code points too and use
 * an NFC-stable wide placeholder. Bun width/wrap remain host adaptations.
 */
const narrowPlaceholder = '\u{F0000}';
const widePlaceholder = '\u{20000}';
const placeholders = /[\u{F0000}\u{20000}]/gu;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function wrapMessageText(text: string, columns: number,
  options: { hard?: boolean; trim?: boolean; wordWrap?: boolean } = { hard: true, trim: false }): string {
  if (!(columns > 0)) return text;
  const originals: string[] = [];
  const parts: string[] = [];
  let masked = false;
  const collisions = text.search(placeholders) !== -1;
  const append = (value: string) => {
    if (!value) return;
    if (collisions) originals.push(...value.match(placeholders) ?? []);
    parts.push(value);
  };
  for (const token of tokenizeAnsi(text)) {
    const value: string = token.value;
    if (token.type === 'sequence') { parts.push(value); continue; }
    let start = 0;
    for (const { segment, index } of segmenter.segment(value)) {
      const codePointLength = segment.codePointAt(0)! > 0xffff ? 2 : 1;
      if (segment.length === codePointLength && segment === segment.normalize()) continue;
      const width = cellWidth(segment);
      if (width !== 1 && width !== 2) continue;
      append(value.slice(start, index));
      originals.push(segment);
      parts.push(width === 1 ? narrowPlaceholder : widePlaceholder);
      masked = true;
      start = index + segment.length;
    }
    append(value.slice(start));
  }
  if (!masked) return wrapAnsi(text, columns, options);
  let next = 0;
  let result = '';
  for (const token of tokenizeAnsi(wrapAnsi(parts.join(''), columns, options))) {
    result += token.type === 'sequence' ? token.value
      : token.value.replace(placeholders, (placeholder: string) => originals[next++] ?? placeholder);
  }
  return result;
}
