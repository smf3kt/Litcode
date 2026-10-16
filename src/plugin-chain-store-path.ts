// The `$` store's file layer (W45-48): where a plugin's store file lives, and how its name is made.
// The copied bodies live in ./plugin-chain-store-path-source.ts; this module is the host seam around
// them, and the data directory they build the path under is the bounded hook in
// ./plugin-chain-store-dir.ts.
//
// Source, all in chunk-tvdq3hrk.js, where the store layer sits between `NDe` and the dispatcher `Ce`:
//
//   var lt=/^[a-z0-9._-]+$/;                                                [15805,15829)  24 units
//   var nt=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;                  [15383,15436)  53 units
//   var me=64;                                                             [15436,15446)  10 units
//   var st=12;                                                             [15446,15456)  10 units
//   function ue(e){…}                                                      [15976,16204) 228 units
//   var S=(e)=>gt(bl(),"store",ue(e));                                     [16204,16238)  34 units
//   async function xe(e){let r=S(e);return await ht(kt(r),{…}),r}          [16238,16319)  81 units
//   async function St(e,r){…}                                              [16357,16491) 134 units
//
// What the ported bodies say, all measured from the source:
//  · `ue` names the file after the storage id. An id that is all lowercase letters, digits, dots,
//    underscores and dashes, is at most 64 characters, is not `.` or `..`, and is not a Windows
//    device name (`con`, `prn`, `aux`, `nul`, `com1`…`com9`, `lpt1`…`lpt9`, with or without an
//    extension) is used verbatim as `<id>.json`. Anything else is sanitized to word characters
//    (everything outside `[a-zA-Z0-9_-]` becomes `_`), cut to 64 characters, and given `-` plus the
//    first 12 hex digits of the id's sha256; an id whose sanitized form is empty contributes the
//    literal `plugin`. So `hook_agent` is `hook_agent.json`, and `My Plugin!` is
//    `My_Plugin_-<12 hex>.json`.
//  · `S` is the file's path: the data directory, then `store`, then that name.
//  · `xe` makes the file's directory (`recursive:true`, `mode:448` — 0700) and answers the file path.
//  · `St` touches the file (`utimes` with the same time twice) so a store file is not collected, and
//    on failure logs `$.store (${plugin}): could not touch ${file}: ${reason}` at warn level rather
//    than throwing.
//
// This package binds the file layer alone. The three pieces the `store.*` entries still wait on are
// recorded in next_package: the lockfile library (`Wa` → `lt()` → `ft()` in chunk-c6qwr3kc.js, 23,134
// bytes), the atomic writer (`vn` → `Ope` in chunk-1t033v1j.js, `Ope` alone 2,167 units) and the
// read/carry layer (`vt`/`he` over `mR`).
import { lt, nt, me, st, ue, S, xe, St } from './plugin-chain-store-path-source.js';
import { bindPluginDataDir, bl } from './plugin-chain-store-dir.js';

export { bindPluginDataDir };

/** The data directory the store is built under — source `bl`, over the bound hook. */
export function storeDataDir(): string {
  return bl();
}

/** Source `ue`: the store file's name for a storage id. */
export function storeFileName(storageId: string): string {
  return ue(storageId);
}

/** Source `S`: the store file's path for a storage id. */
export function storeFilePath(storageId: string): string {
  return S(storageId);
}

/** Source `xe`: make the store file's directory and answer its path. */
export function ensureStoreDir(storageId: string): Promise<string> {
  return xe(storageId);
}

/** Source `St`: touch the file, logging rather than throwing when the filesystem refuses. */
export function touchStoreFile(storageId: string, file: string): Promise<void> {
  return St(storageId, file) as Promise<void>;
}

/** Source `lt`: whether a storage id may be used verbatim as a name. */
export function isVerbatimStoreId(storageId: string): boolean {
  return lt.test(storageId) && !nt.test(storageId) && storageId.length <= me && storageId !== '.' && storageId !== '..';
}

/** Source `nt`: whether a storage id spells a Windows device name. */
export function isReservedStoreId(storageId: string): boolean {
  return nt.test(storageId);
}

/** Source `me` and `st`: the length a hashed name is cut to, and the hex digits it keeps. */
export const STORE_NAME_MAX_CHARS = me;
export const STORE_HASH_HEX_DIGITS = st;
