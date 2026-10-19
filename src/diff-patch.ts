// Typed seam over the recovered structured-patch engine. The bodies are copied verbatim in
// ./diff-patch-core-source.ts (chunk-34bv7wfw.js) and ./diff-patch-apply-source.ts
// (chunk-kcwp0ct0.js, chunk-f606a53w.js, chunk-4qh9ecjv.js, chunk-r2vtj1kh.js); ranges, unit
// counts and body digests are in the sibling `-blocks.json` files and research/ports/W188-turn-diff.md.
//
// `Fle` is the post-effect seam: both recovered write producers hand it the content that was
// actually on disk and the content that was actually applied, so a lint or normalization rewrite
// shows up in the patch. Its own flags keep their source meanings: `rawText` bypasses the
// sentinel and tab conversion, `singleHunk` widens the context to 100000, and a timed-out diff
// returns no hunks at all — an empty patch is not evidence that the two contents match.
import { Fle, P3t, BQr, yK } from './diff-patch-apply-source.js';

export interface StructuredPatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface StructuredPatchOptions {
  ignoreWhitespace?: boolean;
  singleHunk?: boolean;
  convertTabs?: boolean;
  rawText?: boolean;
}

export interface EditApplication {
  /** Text edits in the recovered shape: literal `old_string` replaced by literal `new_string`. */
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/** Source `Fle` (chunk-kcwp0ct0.js [14673,15003)): the structured patch between two contents. */
export function structuredPatch(filePath: string, oldContent: string, newContent: string,
    options: StructuredPatchOptions = {}): StructuredPatchHunk[] {
  return Fle({ filePath, oldContent, newContent, ...options }) as StructuredPatchHunk[];
}

/**
 * Source `yK` (chunk-kcwp0ct0.js [15003,15409)): the patch of a list of string edits applied to
 * `fileContents`. The edits are not applied to the caller's file here; this is the patch alone.
 */
export function editsPatch(filePath: string, fileContents: string, edits: readonly EditApplication[],
    ignoreWhitespace = false): StructuredPatchHunk[] {
  return yK({ filePath, fileContents, edits, ignoreWhitespace }) as StructuredPatchHunk[];
}

/** Source `P3t` (chunk-4qh9ecjv.js [5685,5857)): one old/new string edit. */
export function applyEdit(filePath: string, fileContents: string, oldString: string, newString: string,
    replaceAll = false): { patch: StructuredPatchHunk[]; updatedFile: string } {
  return P3t({ filePath, fileContents, oldString, newString, replaceAll }) as {
    patch: StructuredPatchHunk[]; updatedFile: string;
  };
}

/** Source `BQr` (chunk-4qh9ecjv.js [5857,6122)): apply a list of edits and report both results. */
export function applyEdits(filePath: string, fileContents: string, edits: readonly EditApplication[]):
    { patch: StructuredPatchHunk[]; updatedFile: string } {
  return BQr({ filePath, fileContents, edits }) as { patch: StructuredPatchHunk[]; updatedFile: string };
}

/** The copied bodies under their source names, for callers that need the exact source shape. */
export const SOURCE_BODIES = { Fle, P3t, BQr, yK };
