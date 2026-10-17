// Readable seam over the recovered git diff-list parser. The bodies are copied verbatim in
// ./git-diff-status-source.ts; this module only gives them names and contracts the product can use.
//
// Source: chunk-j8hqhz0c.js (sha256 484244ab…), zero-based UTF-16 half-open ranges. `gkt`
// [25545,26152) parses the combined `git diff --raw --numstat` stream, `Kt` [26206,26496) pairs a
// raw status line with its numstat path, `re` [26496,26671) rejects unsafe or hidden paths, `xcr`
// [26671,26824) guards a rename inside the checkout root, and `Yt` [26824,27662) splits a rename
// display path. `N3t` [19028,19070) is the hidden-character test `re` relies on.
import { execFile } from 'node:child_process';
import { gkt, Kt, re, xcr, Yt, N3t } from './git-diff-status-source.js';

export type GitDiffFileStatus = 'added' | 'removed' | 'renamed' | 'copied' | 'modified';
export type GitDiffPathScope = 'all' | 'within-root';

export interface GitDiffFileStat {
  added: number;
  removed: number;
  isBinary: boolean;
  isUntracked: boolean;
  status?: GitDiffFileStatus;
  previousPath?: string;
  newPath?: string;
}

export interface GitDiffStats {
  stats: { filesCount: number; linesAdded: number; linesRemoved: number };
  perFileStats: Map<string, GitDiffFileStat>;
}

/** Source `F=50`: the parser keeps at most this many per-file entries. */
export const GIT_DIFF_FILE_LIMIT = 50;

/** The source `Cn`+`dxn`+`LCo`+`Z_` prefix every diff command carries. */
export const GIT_DIFF_BASE_ARGS = [
  '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=',
  '--no-optional-locks', '-c', 'diff.relative=false', 'diff',
  '--no-color', '--src-prefix=a/', '--dst-prefix=b/', '--submodule=short',
  '--ignore-submodules=dirty',
] as const;

/** The Git environment both collectors share: inherited routing and config are shut out. */
export function gitDiffEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_REFERENCE_BACKEND: 'files', GIT_OPTIONAL_LOCKS: '0',
  });
  return env;
}

/** Source `gkt`: parse `git diff --raw --numstat` output into totals and per-file stats. */
export function parseGitDiffStats(output: string, limit = GIT_DIFF_FILE_LIMIT,
  scope: GitDiffPathScope = 'all'): GitDiffStats {
  return gkt(output, limit, scope) as GitDiffStats;
}

/**
 * Source `He` [23228,23475): run the diff collector with `dxn`, which is the source's
 * `--no-optional-locks -c diff.relative=false diff` plus `LCo` (`--no-color`, `a/`/`b/` prefixes,
 * `--submodule=short`) and `--ignore-submodules=dirty`, then parse the combined stream with no
 * per-file limit and the within-root scope. `Cn` supplies the hook and fsmonitor shutdown that the
 * source runner prepends. This host only adapts the process call: the recovered runner `st`
 * and repository environment `$t` are replaced by `execFile` with bounded output and the same
 * Git isolation, and a nonzero exit still answers null.
 */
export async function readGitDiffStats(cwd: string, signal?: AbortSignal): Promise<GitDiffStats | null> {
  const env = gitDiffEnvironment();
  const args = [...GIT_DIFF_BASE_ARGS, '--raw', '--numstat'];
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile('git', args, {
        cwd, env, signal, timeout: 5_000, maxBuffer: 4 * 1024 * 1024,
        encoding: 'utf8', windowsHide: true,
      }, (error, out) => error ? reject(error) : resolve(out));
    });
    return parseGitDiffStats(stdout, Number.POSITIVE_INFINITY, 'within-root');
  } catch (error) {
    // A nonzero git exit is the source's null; a spawn or abort failure stays observable.
    if (typeof (error as { code?: unknown }).code === 'number') return null;
    throw error;
  }
}

/** Source `Kt`: read one `--raw` status line, optionally with its numstat path. */
export function parseGitChangedPath(line: string, seen = false): GitDiffFileStat {
  return Kt(line, seen) as GitDiffFileStat;
}

/** Source `re`: return the path when it is relative, safe and visible; otherwise undefined. */
export function sanitizeGitDiffPath(path: string): string | undefined {
  return re(path) as string | undefined;
}

/** Source `xcr`: true when every path in a rename display stays inside the checkout root. */
export function isGitDiffPathWithinRoot(path: string): boolean {
  return xcr(path) as boolean;
}

/** Source `Yt`: split a rename/copy display path into its old and new sides. */
export function splitGitRenamePaths(path: string): string[] | null {
  return Yt(path) as string[] | null;
}

/** Source `N3t`: true when a path holds hidden characters or a lone surrogate. */
export function hasHiddenGitDiffPathCharacters(path: string): boolean {
  return N3t(path) as boolean;
}
