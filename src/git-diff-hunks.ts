// Readable seam over the recovered unified-diff hunk parser and the shortstat totals. The bodies
// are copied verbatim in ./git-diff-hunks-source.ts.
//
// Source: chunk-j8hqhz0c.js (sha256 484244ab…), zero-based UTF-16 half-open ranges. `ZQr`
// [28189,29373) splits a unified diff into per-file hunks; `pxn` [32005,32259) reads
// `git --shortstat`. `readGitDiffHunks` is the host side of `Tns` [24607,25087): shortstat first,
// the 500-file bail-out, then `oMt` (`--no-ext-diff --no-textconv`) plus the revision, and the
// `--cached` cleanup that drops paths still carrying unstaged changes.
import { execFile } from 'node:child_process';
import { GIT_DIFF_BASE_ARGS, gitDiffEnvironment, readGitDiffStats } from './git-diff-status.js';
import { ZQr, pxn } from './git-diff-hunks-source.js';

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Diff lines as emitted, each retaining its ` `, `+` or `-` marker. */
  lines: string[];
}

export interface GitDiffHunks {
  hunks: Map<string, GitDiffHunk[]>;
  /** Files whose diff section exceeded the source 1,000,000-unit cap. */
  skippedLarge: Set<string>;
}

/** Source `F`: files kept per diff. */
export const GIT_DIFF_HUNK_FILE_LIMIT = 50;
/** Source `F3t`: lines kept per hunk. */
export const GIT_DIFF_HUNK_LINE_LIMIT = 400;
/** Source `L`: a shortstat above this many files skips hunk collection. */
export const GIT_DIFF_LARGE_FILE_COUNT = 500;

/** Source `ZQr`: parse a unified diff into per-file hunks. */
export function parseGitDiffHunks(patch: string): GitDiffHunks {
  return ZQr(patch) as GitDiffHunks;
}

/** Source `pxn`: read `git --shortstat` totals, or null when the text does not match. */
export function parseGitShortStat(output: string): { filesCount: number; linesAdded: number; linesRemoved: number } | null {
  return pxn(output) as { filesCount: number; linesAdded: number; linesRemoved: number } | null;
}

interface GitRun { code: number; stdout: string }

function runGit(args: readonly string[], cwd: string, signal?: AbortSignal): Promise<GitRun> {
  return new Promise((resolve, reject) => {
    execFile('git', [...args], {
      cwd, env: gitDiffEnvironment(), signal, timeout: 5_000, maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8', windowsHide: true,
    }, (error, stdout) => {
      if (error === null) { resolve({ code: 0, stdout }); return; }
      const code = (error as { code?: unknown }).code;
      // A numeric code is git's own exit; anything else is a spawn or abort failure.
      if (typeof code === 'number') { resolve({ code, stdout: typeof stdout === 'string' ? stdout : '' }); return; }
      reject(error);
    });
  });
}

/**
 * Source `Tns`: collect unified hunks for one revision. The source's process runner and repo
 * checks are host services; this reads via `execFile` with the source arguments, 5s timeout and
 * within-root path rules. A nonzero diff exit answers null.
 */
export async function readGitDiffHunks(cwd: string, revision = 'HEAD',
  signal?: AbortSignal): Promise<GitDiffHunks | null> {
  const shortstat = await runGit([...GIT_DIFF_BASE_ARGS, revision, '--shortstat'], cwd, signal);
  if (shortstat.code === 0) {
    const totals = parseGitShortStat(shortstat.stdout);
    if (totals !== null && totals.filesCount > GIT_DIFF_LARGE_FILE_COUNT) {
      return { hunks: new Map(), skippedLarge: new Set() };
    }
  }
  const patch = await runGit([...GIT_DIFF_BASE_ARGS, '--no-ext-diff', '--no-textconv', revision], cwd, signal);
  if (patch.code !== 0) return null;
  const parsed = parseGitDiffHunks(patch.stdout);
  if (revision === '--cached' && parsed.hunks.size > 0) {
    // Source: staged hunks drop every path that still has unstaged changes, so the two views do
    // not both claim the same working-tree edit.
    const unstaged = await readGitDiffStats(cwd, signal);
    if (unstaged === null) return null;
    for (const path of unstaged.perFileStats.keys()) parsed.hunks.delete(path);
  }
  return parsed;
}
