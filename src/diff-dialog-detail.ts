// The DiffDialog detail view (W168). Copied bodies live in ./diff-dialog-detail-source.ts:
//
//   - chunk-24k7d6mw.js [1657226,1657289)   63 units — `Uwe`, a path sanitized and joined to one line;
//   - chunk-24k7d6mw.js [1657326,1657515)  189 units — `Sj`, the parenthesized dim badge;
//   - chunk-24k7d6mw.js [1657515,1657527)   12 units — `ypt`, the 1 MB read limit;
//   - chunk-24k7d6mw.js [1657527,1661848) 4,321 units — `pBe`, the detail view;
//   - chunk-rwv4cv93.js [902,2099)        1,197 units — `Ol`, the divider row;
//   - chunk-1r9zp6s1.js [19763,19829)        66 units — `XN`, children or the screen-reader fallback;
//   - chunk-3cynezh1.js [66071,66113)        42 units — `yV`, the divider character.
//
// Total 7 blocks, 5,890 UTF-16 units. The sanitizer closure `__e` lives in
// ./diff-detail-sanitize-source.ts (one block, 5,880 units). The bounded file read and the remote-session
// test are host bindings in ./diff-dialog-detail-host.ts.
import { Ol, Sj, Uwe, XN, pBe, yV } from './diff-dialog-detail-source.js';
import { __e } from './diff-detail-sanitize-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

/** One file's structured diff. `patch` entries are unified hunks. */
export interface DiffFileDetailProps {
  filePath: string;
  hunks: readonly string[];
  isLargeFile?: boolean;
  isBinary?: boolean;
  isTruncated?: boolean;
  isUntracked?: boolean;
  isRestricted?: boolean;
  width?: number;
}

export interface DiffDividerProps {
  width?: number;
  color?: string;
  char?: string;
  padding?: number;
  title?: string;
  titleAlign?: 'start' | 'center';
}

export interface SanitizedText {
  text: string;
  removedTotal: number;
  removedByClass: {
    tags: number;
    bidi: number;
    zeroWidth: number;
    selectors: number;
    other: number;
  };
  keptConditional: number;
}

/** Source `pBe`: the detail view for one file — header, divider, hunks, and the state notes for
 *  restricted, untracked, binary, large, truncated, and missing-content cases. */
export function DiffFileDetail(props: DiffFileDetailProps): SurfaceElement {
  return pBe(props as never) as SurfaceElement;
}

/** Source `Ol`: a divider row with an optional centered title. */
export function DiffDivider(props: DiffDividerProps): SurfaceElement {
  return Ol(props as never) as SurfaceElement;
}

/** Source `Uwe`: the file path corrected for display, control characters stripped and whitespace
 *  runs collapsed to one space. */
export function detailHeading(filePath: string): string {
  return Uwe(filePath) as string;
}

/** Source `__e`: the text sanitizer's report — the kept text and the counts removed by class. */
export function sanitizeText(text: string): SanitizedText {
  return __e(text) as SanitizedText;
}

/** The copied bodies under their source names. */
export const SOURCE_BODIES = { Uwe, Sj, pBe, Ol, XN, yV, __e };
