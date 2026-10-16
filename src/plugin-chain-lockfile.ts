// The lockfile library the plugin store acquires through (W45-49). The copied bodies live in
// ./plugin-chain-lockfile-source.ts — the module's whole closure, 16 statements of one chunk: the
// vendored dependencies (graceful-fs, retry, signal-exit) and proper-lockfile itself, plus the three
// wrappers the store calls. This module is the host seam: it names the surface and narrows the types,
// it does not re-implement anything.
//
// Source, chunk-c6qwr3kc.js, the tail of the module:
//
//   function lt(){return ft()}                                                                  [22559,22585)  26 units
//   async function Wa(e,r){let n=await lt().lock(e,r);return Object.assign(n,{[Symbol.asyncDispose]:n})}
//                                                                                               [22585,22685) 100 units
//   function VPs(e,r){return lt().check(e,r)}                                                    [22685,22726)  41 units
//   async function Um(e,r){if(!e)return;try{await e()}catch(n){…t(`${r}: ${i}`,{level:"warn"})}}  [22726,23114) 388 units
//
// What the copied bodies say, all read from the source:
//  · `lt()` is the lockfile library itself — the memoized proper-lockfile entry `ft()`, whose surface
//    is `lock`/`unlock`/`lockSync`/`unlockSync`/`check`/`checkSync`.
//  · `Wa(file, options)` takes the lock and attaches `Symbol.asyncDispose` to the handle it answers,
//    so the same handle works with `await using` and with an explicit release.
//  · `VPs(file, options)` answers whether the lock is currently held.
//  · `Um(handle, label)` releases and never throws: no handle is a no-op, a lock that was already
//    released or never acquired is logged as `lock was no longer held at release (CODE); the locked
//    section may have run without exclusivity`, and any other failure as `lock directory could not be
//    removed and is left to go stale: <message>` — both at warn level under the caller's label.
//
// The lock is a directory beside the file (`<file>.lock`, chunk-c6qwr3kc.js `ne`), its staleness is
// read from second-precision mtimes, and an acquisition that finds a live lock retries on the retry
// schedule with `retries` (default 0) and `stale` (default 10,000 ms, floored at 2,000) as the
// takeover window. The synchronous forms refuse `retries` with `ESYNC` (chunk-c6qwr3kc.js `Yt`).
import { Um, VPs, Wa } from './plugin-chain-lockfile-source.js';

/** The lock options the library accepts — the store passes its own `lock` options through. */
export type PluginStoreLockOptions = {
  /** Milliseconds after which a lock whose mtime stopped moving is taken over. Floored at 2,000. */
  stale?: number;
  /** Milliseconds between mtime updates while the lock is held; defaults to half of `stale`. */
  update?: number;
  /** Retries before an acquisition that finds a live lock fails, or a retry options object. */
  retries?: number | { retries?: number; factor?: number; minTimeout?: number; maxTimeout?: number; randomize?: boolean };
  /** Whether the lock resolves symlinks against the file's real path (default true). */
  realpath?: boolean;
  /** The fs implementation the lock runs on; defaults to the bundled graceful-fs. */
  fs?: unknown;
  /** The lock path itself; defaults to `<file>.lock`. */
  lockfilePath?: string;
};

/** The handle an acquisition answers: the library's own release, with the disposer `Wa` attaches.
 *  Measured: it is the release function itself — calling it unlocks, and `Symbol.asyncDispose` is the
 *  same function, so `await using` and an explicit `await handle()` take the same path. */
export type PluginStoreLockHandle = (() => Promise<void>) & {
  [Symbol.asyncDispose]: () => Promise<void>;
};

/** Source `Wa`: take the lock on `file`, answering the handle with its `Symbol.asyncDispose`. */
export function acquirePluginStoreLock(file: string, options?: PluginStoreLockOptions): Promise<PluginStoreLockHandle> {
  return Wa(file, options) as Promise<PluginStoreLockHandle>;
}

/** Source `VPs`: whether the lock on `file` is currently held. */
export function checkPluginStoreLock(file: string, options?: PluginStoreLockOptions): Promise<boolean> {
  return VPs(file, options) as Promise<boolean>;
}

/** Source `Um`: release the handle, logging under `label` rather than throwing when it is gone. */
export function releasePluginStoreLock(
  handle: PluginStoreLockHandle | undefined,
  label: string,
): Promise<void> {
  return Um(handle, label) as Promise<void>;
}
