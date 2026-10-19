// The typed host result a file-effecting tool returns beside its text output, and the storage
// projection applied before it reaches the session journal.
//
// Source: `uno` (chunk-sfn1dbxq.js [739599,743280)) for `write_file` and `sjr`
// ([4167188,4171835)) for `edit_file`; the host envelope that carries the value as a sibling of the
// API tool result is `xe` ([4380701,4382470)); the storage projection is `TRn`
// ([4500463,4501738)). The value is a diff-producing structure, not the model text: the source maps
// the API result separately (`ui` through `GVe`/`uCe`), so the two never share a field.
//
// This runtime's writers hand the effect over after the write has landed, using the content that
// was actually on disk and the content that was actually applied — the same seam the source's
// `Fle` call sites use, so a normalization or lint rewrite on the effect path shows in the patch
// rather than being inferred from the requested edit.
import { structuredPatch, type StructuredPatchHunk } from './diff-patch.js';

/** What `write_file` captures at the effect boundary, in the recovered `uno` shape. */
export interface WriteEffectResult {
  type: 'create' | 'update';
  filePath: string;
  content: string;
  structuredPatch: StructuredPatchHunk[];
  originalFile: string | null;
}

/** What `edit_file` captures at the effect boundary, in the recovered `sjr` shape. */
export interface EditEffectResult {
  filePath: string;
  oldString: string;
  newString: string;
  originalFile: string | null;
  structuredPatch: StructuredPatchHunk[];
  replaceAll: boolean;
}

export type ToolUseResult = WriteEffectResult | EditEffectResult;

/**
 * The stored row: the source's storage projection. A write keeps its content only in the create
 * branch, where that content is the only body a created file has; an edit keeps the fields the turn
 * view reads. The original file is dropped in both cases.
 */
export type StoredToolUseResult =
  | { type: 'create'; filePath: string; content: string; structuredPatch: StructuredPatchHunk[] }
  | { type: 'update'; filePath: string; structuredPatch: StructuredPatchHunk[] }
  | { filePath: string; oldString: string; newString: string; structuredPatch: StructuredPatchHunk[]; replaceAll: boolean };

/**
 * Source `uno`'s data payload for a write that has landed. The source branches on the prior
 * content being truthy rather than on the file existing, so a file that exists but is empty takes
 * the create branch: a full-content row with no patch.
 *
 * The source skips the patch and nulls the original file when the prior content exceeds a size
 * bound this acquisition could not read; the bound's exact value is unrecorded, and the storage
 * projection drops the original file regardless, so no threshold is invented here.
 */
export function writeEffectResult(filePath: string, previous: string, applied: string): WriteEffectResult {
  if (!previous) {
    return { type: 'create', filePath, content: applied, structuredPatch: [], originalFile: null };
  }
  return { type: 'update', filePath, content: applied,
    structuredPatch: structuredPatch(filePath, previous, applied, { convertTabs: true }), originalFile: previous };
}

/**
 * Source `sjr`'s data payload for an edit that has landed. The patch is computed from the content
 * the file held before the write and the content that was applied, so an edit that also normalised
 * the file — or that was adjusted before landing — is reported as it landed. The source carries no
 * `type` on this payload, and its consumer accepts a non-empty patch without one.
 */
export function editEffectResult(filePath: string, previous: string, applied: string,
    oldString: string, newString: string, replaceAll: boolean): EditEffectResult {
  return { filePath, oldString, newString, originalFile: previous,
    structuredPatch: structuredPatch(filePath, previous, applied, { convertTabs: true }), replaceAll };
}

/** Source `TRn`: the row that is written to the transcript. */
export function projectToolUseResult(value: ToolUseResult): StoredToolUseResult {
  if (!('type' in value)) {
    return { filePath: value.filePath, oldString: value.oldString, newString: value.newString,
      structuredPatch: value.structuredPatch, replaceAll: value.replaceAll };
  }
  return value.type === 'create'
    ? { type: 'create', filePath: value.filePath, content: value.content, structuredPatch: value.structuredPatch }
    : { type: 'update', filePath: value.filePath, structuredPatch: value.structuredPatch };
}
