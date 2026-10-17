// Readable seam over the diff dialog's chord formatter and dim hint text. The bodies are copied
// verbatim in ./diff-dialog-chrome-source.ts.
//
// Source: chunk-0qkpwgr4.js (sha256…), `[904,4862)`: `L`/`D` format defaults, `t4n` chord
// formatting, the key/modifier tables, `z` chord hint, `JD` action text, `v` platform and `P`
// tokenizing. chunk-x90vmw14.js `fo` [757,1166) is the dim empty text with an optional hint line.
// Zero-based UTF-16 half-open ranges. `BF` is host glue in ./diff-dialog-chord-host.ts.
import { fo, t4n, z, JD, P, v } from './diff-dialog-chrome-source.js';

export interface ChordFormat {
  style?: 'default' | 'compact' | 'symbol';
  keyCase?: 'title' | 'lower' | 'glyph';
  modCase?: 'lower' | 'title' | 'glyph';
  caretCtrl?: boolean;
  modSep?: string;
  arrowSep?: string;
  chordSep?: string;
  shiftAsCase?: boolean;
  charCase?: 'preserve' | 'upper';
  platform?: string;
}

export interface ChordHintProps {
  chord: string | string[];
  action: string;
  format?: ChordFormat;
  parens?: boolean;
  bold?: boolean;
  terse?: boolean;
}

/** Source `P` with the host platform: format one chord or an array of chords for display. */
export function formatChord(chord: string | string[], format: ChordFormat = {}): string {
  return P(chord, format, v()) as string;
}

/** Source `t4n`: the token-level formatter behind `formatChord`. */
export function formatChordTokens(tokens: unknown, format: ChordFormat = {}): string {
  return t4n(tokens, format) as string;
}

/** Source `JD`: a chord plus its action as one hint string, optionally parenthesized. */
export function formatActionHint(props: ChordHintProps): string {
  return JD({ ...props, format: props.format ?? {} }) as string;
}

/** Source `z`: the chord hint component; an empty or unknown chord renders nothing. */
export function ChordHint(props: ChordHintProps): unknown {
  return z(props as never);
}

export interface HintTextProps {
  children?: unknown;
  hint?: unknown;
}

/** Source `fo`: dim text, with a second dim line when a hint is present. */
export function HintText(props: HintTextProps): unknown {
  return fo(props as never);
}

/** The copied bodies under their source names. */
export const SOURCE_BODIES = { fo, t4n, z, JD, P, v };
