import { EMOJI, EMOJI_ALIASES } from './tui-emoji-data.js';

/**
 * The `:name:` emoji typeahead, adapted from the recovered interactive application
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `H0e` [558112,558600)
 * builds the suggestions, `B0e` [558169,558203) resolves one name, `rse` 566121 is the
 * popup trigger, `KDt` 566153 the completed-shortcode trigger, `GDt` 566183 the guard on
 * the inline replacement, and `tE` 568396 the popup's accept. Coordinates are zero-based
 * UTF-16 offsets.
 */

/** Source `xDt`: the popup shows at most twenty rows. */
export const EMOJI_SUGGESTION_LIMIT = 20;

/**
 * Source `zre`: the short names first, then every alias that does not shadow one. The
 * order is the source's, and it decides the tie-break inside a name length.
 */
const GLYPHS: ReadonlyMap<string, string> = new Map([
  ...Object.entries(EMOJI),
  ...Object.entries(EMOJI_ALIASES)
    .filter(([alias, canonical]) => EMOJI[canonical] !== undefined && EMOJI[alias] === undefined)
    .map(([alias, canonical]) => [alias, EMOJI[canonical]!] as [string, string]),
]);

/** Source `RDt`: the names in table order, which the ranking keeps stable. */
const NAMES: readonly string[] = [...GLYPHS.keys()];

export interface EmojiSuggestion {
  readonly id: string;
  readonly displayText: string;
  readonly description: string;
  readonly name: string;
}

/** `H0e`: names containing the query, prefix matches first, then the shortest name. */
export function emojiSuggestions(query: string, limit = EMOJI_SUGGESTION_LIMIT): EmojiSuggestion[] {
  const needle = query.toLowerCase();
  const matches = NAMES.filter(name => name.includes(needle));
  const rank = (name: string) => (name.startsWith(needle) ? 0 : 1);
  matches.sort((left, right) => rank(left) - rank(right) || left.length - right.length);
  return matches.slice(0, limit).map(name => ({
    id: `emoji:${name}`,
    displayText: GLYPHS.get(name)!,
    description: `:${name}:`,
    name,
  }));
}

/** `B0e`: the glyph for one short name or alias. */
export function emojiGlyph(name: string): string | undefined {
  return GLYPHS.get(name);
}

/** `rse`: `:partial` at the end of the text before the cursor, at least two characters. */
export const EMOJI_QUERY = /(^|\s):([a-z0-9_+-]{2,})$/;
/** `KDt`: a completed `:name:` at the end of the text before the cursor. */
export const EMOJI_COMPLETED = /(^|\s):([a-z0-9_+-]+):$/;

/**
 * `tE`: the popup's accept replaces `:partial` with the glyph and a space. Returns
 * undefined when the draft no longer matches, which is what the source reports as false.
 */
export function acceptEmojiQuery(text: string, cursor: number, glyph: string): { text: string; cursor: number } | undefined {
  const match = text.slice(0, cursor).match(EMOJI_QUERY);
  if (!match || match.index === undefined) return undefined;
  const start = match.index + (match[1]?.length ?? 0);
  const before = text.slice(0, start);
  const next = `${before}${glyph} ${text.slice(cursor)}`;
  return { text: next, cursor: before.length + glyph.length + 1 };
}

/** `GDt`: the inline replacement only applies to the one edit that completed the shortcode. */
function acceptsInlineReplacement(text: string, previous: string | undefined, cursor: number): boolean {
  if (previous === undefined) return false;
  const removed = text.length - previous.length;
  if (removed <= 0) return false;
  const start = cursor - removed;
  if (start < 0) return false;
  return text.slice(0, start) + text.slice(cursor) === previous
    && /^[a-z0-9_+-]*:$/.test(text.slice(start, cursor));
}

/**
 * The inline half of the typeahead: typing the closing colon of a known `:name:` replaces
 * the whole shortcode with its glyph, without a trailing space. `previous` is the draft
 * from before the edit, which is what keeps the replacement to that single keystroke.
 */
export function inlineEmojiCompletion(text: string, previous: string | undefined,
  cursor: number): { text: string; cursor: number } | undefined {
  if (!acceptsInlineReplacement(text, previous, cursor)) return undefined;
  const match = text.slice(0, cursor).match(EMOJI_COMPLETED);
  if (!match || match.index === undefined) return undefined;
  const glyph = emojiGlyph(match[2]!);
  if (glyph === undefined) return undefined;
  const start = match.index + (match[1]?.length ?? 0);
  const before = text.slice(0, start);
  return { text: `${before}${glyph}${text.slice(cursor)}`, cursor: before.length + glyph.length };
}
