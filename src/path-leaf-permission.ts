import { Al, sNe } from './path-leaf-permission-source.js';
import type { PathPermissionObservation } from './path-permission-observation.js';
import type { PermissionDecision } from './permissions.js';

const FILE_READERS = new Set(['read_file', 'read_media', 'notebook_read', 'list_files', 'search']);
const FILE_WRITERS = new Set(['write_file', 'edit_file', 'notebook_edit']);

// xv/c_/sNe/Al, 2bcyxj9q [233474,238395)/[239532,239801), UTF-16.
export function filePathDecision(name: string, observation: PathPermissionObservation | undefined): PermissionDecision | undefined {
  if (observation === undefined) return;
  let verdict;
  if (observation.unresolved && (FILE_READERS.has(name) || FILE_WRITERS.has(name))) {
    verdict = Al(FILE_READERS.has(name) ? 'read from' : 'write to', observation.requested);
  } else if (FILE_WRITERS.has(name)) {
    verdict = sNe(observation.requested, observation);
  }
  return verdict == null ? undefined : { decision: 'deny', reason: verdict.message };
}
