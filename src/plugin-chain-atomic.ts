// The atomic file writer the plugin store publishes through (W45-50). The copied bodies live in
// ./plugin-chain-atomic-source.ts — the writer's own closure, 33 statements of chunk-1t033v1j.js plus
// the telemetry-safe error the in-place refusal is raised in. This module is the host seam: it names
// the surface and narrows the types, it does not re-implement anything.
//
// Source, chunk-1t033v1j.js:
//
//   async function vn(e,t,n,r){return Ope(e,t,{mode:n,renameFn:r})}                        [8106,8169)   63 units
//   async function Ope(e,t,n){…}                                                           [8169,10336) 2167 units
//
// What the copied body says, read from the source:
//  · The write never touches the target first. It stages the contents beside it — the temp name is the
//    target plus `.tmp.` and four random hex bytes (`UR`), taken by exclusive create with up to three
//    attempts (`j`, `C`), in `stagingDir` when one is given (`De`, which validates the directory and
//    otherwise answers the target itself) — and then renames it into place (`ss`, the retrying rename).
//  · The rename retries on `EXDEV`, `EPERM`, `EEXIST` and `EBUSY` (`ST`), and if it still fails the
//    writer falls back to the in-place arm (`G`): it snapshots the file first (`Me`), opens it
//    `O_WRONLY|O_CREAT|O_NOFOLLOW`, refuses a non-regular target with `refusing the in-place arm on a
//    non-regular target` (code `ENXIO`), truncates, writes, and on failure restores the snapshot
//    (`Ye`) or removes the file — annotating the error with what it managed to leave behind.
//  · `beforePublish` is asked twice, before the temp is taken and again before the publish; a refusal
//    raises the writer's own `beforePublish refused the write; nothing was written` and leaves nothing
//    behind.
//  · `exactMode` or `flush` switches to the handle path (`Be`), which keeps the temp file open to
//    chmod and `fsync` it; otherwise the plain path (`RD`) is used. The sync failures that mean
//    "unsupported here" are ignored (`i1e`).
//  · `mode` is the create mode and `exactMode` the mode the file is left with; the test-and-set on a
//    symlink target is `followSymlinks` (with it, `O_NOFOLLOW` is dropped).
//  · The in-place arm is gated by `$Rr` (`GGn()` asks it for the unserved case), and in the copied
//    closure nothing turns that gate on: `te` is `!1` and only the module's own `AOs` sets it. So the
//    in-place arm is reached only through the rename fallback above, or when temp creation fails with
//    `EACCES`, the target already exists, and `inPlaceOnTempCreateRefused` is set.
//  · The store calls `vn(file, text, mode)` — no staging directory, no rename override, the state
//    directory's own modes.
import { Ope, vn } from './plugin-chain-atomic-source.js';

/** The options the writer takes, named as the source names them. */
export type AtomicWriteOptions = {
  /** The mode the temp file is created with. */
  mode?: number;
  /** The same, under the other name the source accepts. */
  createMode?: number;
  /** The mode the file is left with, applied through the handle and tolerated if unsupported. */
  exactMode?: number;
  /** `fsync` the file before it is published. */
  flush?: boolean;
  /** Follow a symlink target instead of refusing it: the in-place arm opens without `O_NOFOLLOW`
   *  and snapshots through the link. The publish itself is still a rename, so a symlink given as the
   *  file is replaced by the published file either way (measured). */
  followSymlinks?: boolean;
  /** Fall back to the in-place arm when the temp file cannot be created with `EACCES`. */
  inPlaceOnTempCreateRefused?: boolean;
  /** The directory the temp file is staged in; the target's own directory by default. */
  stagingDir?: string;
  /** The rename to publish with; `fs.rename` by default. */
  renameFn?: (from: string, to: string) => Promise<void>;
  /** Asked before the temp file is taken and again before the publish; `false` refuses the write. */
  beforePublish?: () => boolean;
};

/** Source `vn`: write `contents` to `file` atomically, created with `mode` and published by rename. */
export function writeFileAtomically(file: string, contents: string, mode?: number, renameFn?: AtomicWriteOptions['renameFn']): Promise<void> {
  return vn(file, contents, mode, renameFn) as Promise<void>;
}

/** Source `Ope`: the same write with the source's whole option set. */
export function writeFileWithAtomicOptions(file: string, contents: string, options: AtomicWriteOptions): Promise<void> {
  return Ope(file, contents, options) as Promise<void>;
}
