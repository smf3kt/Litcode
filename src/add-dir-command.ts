/**
 * `/add-dir`. Recovered from `chunk-dzt2d3te.js` (sha256 below), whose `d` is the command body:
 * an empty argument answers `Usage: /add-dir <path>`, otherwise `gge` validates the path,
 * `hge` turns a non-success result into its message (with `iGt`'s note first for the
 * already-added case), and `lwn` applies the directory and reports.
 *
 * - `chunk-dzt2d3te.js` sha256
 *   `1936b91632b264d2051cd791d435fd3ab5c2bdfa41d525152188f1ffd88c8cce` (barrel): `d` at 14026.
 * - `chunk-8f8e39h5.js` sha256
 *   `e11fb72ae3ce145c111421083890229a5e6a7d4606465f14116347815e894282`: the validator `gge` at 1097
 *   and the message table `hge` at 2073.
 * - `chunk-340rde3k.js` sha256
 *   `00e3e7e5f62654d3f814557eb2399ff7787f3592377deed4a2d4b0eec5924727`: the apply-and-report `lwn`
 *   at 1608 and the loading note `iGt` at 3062.
 * Offsets are zero-based UTF-16 code units.
 *
 * The recovered apply is `setToolPermissionContext(i => jd(i, {type:"addDirectories",
 * directories:[abs], destination:"session"}))`. This host has the same reducer behind
 * `Session.adoptPermissionUpdates`, which also observes the new root and persists it, so the local
 * command calls that instead of a context setter.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ADD_DIR_USAGE = 'Usage: /add-dir <path>';

/** Source `gge`'s result kinds, in the order its checks run. */
export type AddDirectoryResult =
  | { readonly kind: 'emptyPath' }
  | { readonly kind: 'invalidPath'; readonly directoryPath: string; readonly containsNullByte: boolean }
  | { readonly kind: 'networkPath'; readonly directoryPath: string; readonly absolutePath: string }
  | { readonly kind: 'pathNotFound'; readonly directoryPath: string; readonly absolutePath: string }
  | { readonly kind: 'notADirectory'; readonly directoryPath: string; readonly absolutePath: string }
  | { readonly kind: 'alreadyInWorkingDirectory'; readonly directoryPath: string; readonly absolutePath: string;
      readonly workingDir: string; readonly isExactMatch: boolean; readonly isOriginalCwd: boolean }
  | { readonly kind: 'success'; readonly absolutePath: string };

/** Source `ks`: the UNC spellings the recovered refuses as a working directory. */
export function isNetworkPath(candidate: string): boolean {
  return /^\\\\/.test(candidate) || /^\/\/[^/]/.test(candidate);
}

/** Source `et`: `~` expansion, then a resolve against the process's working directory. */
export function expandDirectoryPath(candidate: string, cwd: string = process.cwd()): string {
  const home = os.homedir();
  const expanded = candidate === '~' ? home
    : candidate.startsWith('~/') || candidate.startsWith(`~${path.sep}`) ? path.join(home, candidate.slice(2))
      : candidate;
  return path.resolve(cwd, expanded);
}

export interface AddDirectoryContext {
  readonly directoryPath: string;
  /** The directories the session already reaches, as `Session.workingDirectories` reports them. */
  readonly workingDirectories: readonly string[];
  /** Source `Ee()`: the process's own working directory, which is one of the reachable roots. */
  readonly cwd: string;
  /** Injected so the validator stays testable without touching the filesystem. */
  readonly stat?: (candidate: string) => { isDirectory(): boolean } | undefined;
}

/** Source `Wd(a, b, {caseFold:false})`: whether `candidate` is `root` or sits inside it. */
export function withinDirectory(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  return candidate.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

/**
 * Source `gge`: validate one path against the session's reachable directories. The recovered also
 * asks whether the path sits on a network mount (`hwe`); that probe is not ported, so only the
 * UNC spelling is caught here.
 */
export function validateAddDirectory(context: AddDirectoryContext): AddDirectoryResult {
  const directoryPath = context.directoryPath;
  if (!directoryPath) return { kind: 'emptyPath' };
  if (directoryPath.includes('\0')) return { kind: 'invalidPath', directoryPath, containsNullByte: true };
  let absolutePath: string;
  try { absolutePath = expandDirectoryPath(directoryPath, context.cwd); }
  catch { return { kind: 'invalidPath', directoryPath, containsNullByte: false }; }
  if (isNetworkPath(directoryPath)) return { kind: 'networkPath', directoryPath, absolutePath };
  const stat = context.stat ?? (candidate => { try { return fs.statSync(candidate); } catch { return undefined; } });
  const stats = stat(absolutePath);
  if (stats === undefined) return { kind: 'pathNotFound', directoryPath, absolutePath };
  if (!stats.isDirectory()) return { kind: 'notADirectory', directoryPath, absolutePath };
  const roots = [context.cwd, ...context.workingDirectories];
  for (const root of roots) {
    if (withinDirectory(absolutePath, root)) {
      return { kind: 'alreadyInWorkingDirectory', directoryPath, absolutePath, workingDir: root,
        isExactMatch: absolutePath === root, isOriginalCwd: root === context.cwd };
    }
  }
  return { kind: 'success', absolutePath };
}

/** Source `hge`: the message for every non-success result. */
export function addDirectoryMessage(result: AddDirectoryResult): string {
  switch (result.kind) {
    case 'emptyPath': return 'Please provide a directory path.';
    case 'invalidPath':
      return result.containsNullByte
        ? `Path ${result.directoryPath} contains a null character, so it can't be used as a working directory. Remove the null character from the path or from the settings entry that lists it.`
        : `Path ${result.directoryPath} couldn't be resolved, so it can't be used as a working directory. Check the path or the settings entry that lists it.`;
    case 'networkPath':
      return `${result.directoryPath} is a network path, which cannot be added as a working directory. `
        + 'On Windows, map the share to a drive letter and pass it at launch with --add-dir '
        + '(a drive letter added mid-session does not yet carry remote-read trust).';
    case 'pathNotFound': return `Path ${result.absolutePath} was not found.`;
    case 'notADirectory':
      return `${result.directoryPath} is not a directory. Did you mean to add the parent directory `
        + `${path.dirname(result.absolutePath)}?`;
    case 'alreadyInWorkingDirectory': {
      if (result.isExactMatch) {
        return result.isOriginalCwd
          ? `${result.directoryPath} is already the current working directory.`
          : `${result.directoryPath} is already added as a working directory.`;
      }
      const root = result.isOriginalCwd ? 'the current working directory' : 'the additional working directory';
      return `${result.directoryPath} is already accessible within ${root} ${result.workingDir}.`;
    }
    case 'success': return `Added ${result.absolutePath} as a working directory.`;
  }
}

/** Source `lwn`'s session arm: what a successful add reports. */
export function addedForSessionMessage(absolutePath: string): string {
  return `Added ${absolutePath} as a working directory for this session`;
}

/** Source `lwn`'s local-settings arm, whose save can fail after the add already happened. */
export function addedToSettingsMessage(absolutePath: string): string {
  return `Added ${absolutePath} as a working directory and saved to local settings`;
}

export function addedToSettingsFailedMessage(absolutePath: string, reason: string): string {
  return `Added ${absolutePath} as a working directory. Failed to save to local settings: ${reason}`;
}
