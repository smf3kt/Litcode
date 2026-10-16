// The `$` store's read and carry layer (W45-51): how the store reads its file, and what happens when
// the file is not there. The copied bodies live in ./plugin-chain-store-carry-source.ts; this module is
// the host seam around them. The one dependency whose own closure is a different subsystem — `wD`, the
// platform-id test inside the application's plugin table — is bounded in
// ./plugin-chain-store-carry-boundaries.ts.
//
// Source, the four bodies this seam names, in the store's own module and in the id table's:
//
//   async function ye(e){…}                                                [16724,16841) 117 units
//   async function he(e){…}                                                [16841,17404) 563 units
//   async function vt(e,r){…}                                              [17444,17609) 165 units
//   function mR(e){…}                                        chunk-nrk8z90j.js [9765,9853) 88 units
//
// What the ported bodies say, all measured from the source:
//  · `ye` reads the candidate's store file and answers `[id, text]`. A missing file answers undefined;
//    any other read failure is re-thrown.
//  · `mR` names the candidates: the id's base half — only when the half after the last `@` is a
//    platform the table canonicalizes to `builtin` — looked up in the short-name→package-id table,
//    each hit suffixed `@builtin`, most recent first. So the store of `cc-plugin-tips@builtin` is
//    carried from the store of its built-in twin `tips@builtin`, and an id that is not a builtin id
//    at all has no candidates.
//  · `he` is the carry. It reads the candidates in order until one has a store; parses the text with
//    `Y` and refuses (false) when the parsed value is not a plain object; writes the text to
//    `<file>.carry-<uuid>` with flag `wx`; links that file into the store's place; and copies it into
//    place (COPYFILE_EXCL) when the link is refused for any reason other than the target already
//    existing. An `EEXIST` from the link means another session carried the same store first: that is
//    logged at debug as `$.store (${id}): ${candidateId}'s store was carried by another session` and
//    answers true; any failure that is not an `EEXIST` — content that does not parse, a write the
//    filesystem refuses — is logged at warn as `$.store (${id}): could not carry ${candidateId}'s
//    store: ${reason}` and answers false. Content that parses to something other than a plain object
//    answers false with no log at all, because the shape test returns before any write is attempted.
//    The carry file is removed on every path.
//  · `vt` is the read the store calls: the file's text, or — when the file is missing and `he` carried
//    one — the text again. It answers undefined when the file is missing and the carry did not happen.
//
// Logging goes through the host's own `t` (source chunk-9w0044pz.js), so nothing in this package
// writes to a stream directly; the tests read the same records the store layer already records.
import { ye, he, vt, mR } from './plugin-chain-store-carry-source.js';

export { bindStoreCarryPlatformIdTable } from './plugin-chain-store-carry-boundaries.js';

/** Source `ye`: the candidate's store file as `[id, text]`, or undefined when it is not there. */
export function readStoreCandidate(storageId: string): Promise<readonly [string, string] | undefined> {
  return ye(storageId) as Promise<readonly [string, string] | undefined>;
}

/** Source `he`: carry the store from the first candidate that has one. True when the store was carried
 *  (or was already carried by another session), false when no candidate had a readable store, the
 *  content was not a plain object, or the write failed. */
export function carryStoreFile(storageId: string): Promise<boolean> {
  return he(storageId);
}

/** Source `vt`: the store file's text, carrying it from the plugin's built-in twin when it is missing. */
export function readStoreFile(storageId: string, file: string): Promise<string | undefined> {
  return vt(storageId, file) as Promise<string | undefined>;
}

/** Source `mR`: the store ids this id's content may be carried from, most recent first. */
export function builtinTwinIds(storageId: string): readonly string[] {
  return mR(storageId);
}
