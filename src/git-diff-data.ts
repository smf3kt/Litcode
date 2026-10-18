// The recovered diff data effect is owned by one session controller. The prime store and
// constants are copied in ./git-diff-data-source.ts. Native components subscribe through their host.
//
// Source: chunk-xmvfy87k.js (sha256 fabe23b4…), zero-based UTF-16 half-open ranges. Constants `j`,
// `jKn`, `de`, `I` [1818,1883) set the 400-line truncation threshold, the 150ms refresh debounce,
// the 2000ms prime TTL and the empty hunk value. `z` [2290,2566) is the prime store. `K`
// [1883,2290) collects stats plus hunks; `Wcn` [2589,2736) primes the store; `WKn` [2736,3956)
// drives polling and builds the file view. `mkt` [24503,24523) and `Tns` [24607,25087) live in
// chunk-j8hqhz0c.js and are reached here through the W161/W162 collectors.
import type { GitDiffStats } from './git-diff-status.js';
import { readGitDiffHunks, type GitDiffHunk, type GitDiffHunks } from './git-diff-hunks.js';
import { j, jKn, de, I, z } from './git-diff-data-source.js';
import { uxn } from './git-diff-collector-source.js';
import { withDiffCollection } from './git-diff-collector-host.js';

export type GitDiffBaseMode = 'auto' | 'session' | 'uncommitted' | 'branch' | 'branch-point';

export interface GitDiffRawResult extends GitDiffStats {
  source: { kind: string; baseBranch?: string; baseRef?: string };
  noCommits?: boolean;
}

/** Source `K` answer: the diff result and its hunks, or null hunks when hunk collection failed. */
export interface GitDiffCollected {
  result: GitDiffRawResult;
  hunks: GitDiffHunks | null;
}

export interface GitDiffEntry {
  result: GitDiffRawResult;
  baseMode: string;
  hunks: GitDiffHunks;
}

export interface GitDiffFile {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  isBinary: boolean;
  isLargeFile: boolean;
  isTruncated: boolean;
  isUntracked: boolean;
  preSession?: boolean;
}

export interface GitDiffData {
  stats: GitDiffStats['stats'] | null;
  files: GitDiffFile[];
  hunks: Map<string, GitDiffHunk[]>;
  loading: boolean;
  source: { kind: string; baseBranch?: string; baseRef?: string };
  baseMode: string;
  noCommits?: boolean;
}

/** Source `j`: files whose added+removed count exceeds this are marked truncated. */
export const GIT_DIFF_TRUNCATION_LINE_COUNT = j;
/** Source `jKn`: debounce applied once data exists or a manual refresh was requested. */
export const GIT_DIFF_REFRESH_DEBOUNCE_MS = jKn;
/** Source `de`: how long a primed entry stays usable. */
export const GIT_DIFF_PRIME_TTL_MS = de;
/** Source `I`: the empty hunk value shared by the collector and the fallback path. */
export const EMPTY_GIT_DIFF_HUNKS = I as GitDiffHunks;

/** Source store `z`, under the product name. */
export class GitDiffPrimeStore extends z {}

/** Source `mkt`: the revision the hunk collector reads for one diff result. */
export function diffRevision(result: GitDiffRawResult): string {
  if (result.noCommits) return '--cached';
  if (result.source.kind === 'branch') return result.source.baseRef ?? 'HEAD';
  return 'HEAD';
}

/**
 * Source `K` adapted to the host collectors: stats first, then hunks for the same revision.
 * The copied `uxn` chooses session/branch/working-tree data; its process and session clock
 * boundaries are scoped to this collection so concurrent terminal sessions stay independent.
 * A throw and a failed collector both answer null, as in the source.
 */
export async function collectGitDiff(cwd: string, baseMode: GitDiffBaseMode | string,
  signal?: AbortSignal, sessionStart = 0): Promise<GitDiffCollected | null> {
  return withDiffCollection({ cwd, sessionStart }, async () => {
    try {
      const result = await uxn({}, signal, baseMode, cwd, {}) as GitDiffRawResult | null;
      if (signal?.aborted || result === null) return null;
      const hunks = result.stats.filesCount === 0
        ? EMPTY_GIT_DIFF_HUNKS
        : await readGitDiffHunks(cwd, diffRevision(result), signal);
      if (signal?.aborted) return null;
      return { result, hunks: hunks ?? null };
    } catch {
      return null;
    }
  });
}

/**
 * Source `Wcn`: collect once and prime the store for the next hook mount. An aborted collection
 * primes nothing; a failed one primes a null entry, which still counts as loaded for its key.
 */
export async function primeGitDiff(store: GitDiffPrimeStore, cwd: string,
  baseMode: GitDiffBaseMode | string, refreshKey: number, signal?: AbortSignal,
  collect = collectGitDiff, now: () => number = Date.now): Promise<void> {
  const collected = await collect(cwd, baseMode, signal);
  if (signal?.aborted) return;
  store.set(baseMode, refreshKey,
    collected && { result: collected.result, baseMode, hunks: collected.hunks ?? EMPTY_GIT_DIFF_HUNKS },
    now());
}

/**
 * Source `WKn`'s derived view: per-file rows sorted by path, with the oversized-hunk flag and the
 * 400-line truncation rule; an absent entry yields the empty working-tree view.
 */
export function buildGitDiffData(entry: GitDiffEntry | null,
  options: { loading: boolean; enabled: boolean; baseMode: string }): GitDiffData {
  if (entry === null) {
    return {
      stats: null, files: [], hunks: new Map(),
      loading: options.enabled && options.loading,
      source: { kind: 'working-tree' }, baseMode: options.baseMode,
    };
  }
  const { stats, perFileStats, source } = entry.result;
  const files: GitDiffFile[] = [];
  for (const [path, stat] of perFileStats) {
    const isLargeFile = entry.hunks.skippedLarge.has(path);
    const changed = stat.added + stat.removed;
    files.push({
      path,
      linesAdded: stat.added,
      linesRemoved: stat.removed,
      isBinary: stat.isBinary,
      isLargeFile,
      isTruncated: !isLargeFile && !stat.isBinary && changed > GIT_DIFF_TRUNCATION_LINE_COUNT,
      isUntracked: stat.isUntracked,
      preSession: (stat as { preSession?: boolean }).preSession,
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    stats, files, hunks: entry.hunks.hunks, loading: false,
    source, baseMode: entry.baseMode, noCommits: entry.result.noCommits,
  };
}

export interface GitDiffDataOptions {
  cwd: string;
  store?: GitDiffPrimeStore;
  enabled?: boolean;
  baseMode?: GitDiffBaseMode | string;
  refreshKey?: number;
  collect?: typeof collectGitDiff;
  now?: () => number;
  onChange?: (data: GitDiffData) => void;
}

/**
 * Source `WKn`'s effect, without the render loop. Mounting takes a primed entry once; a prime
 * carrying the current refresh key suppresses the redundant fetch; every later run aborts the
 * previous collection, debounces by 150ms once data exists (or when refreshKey is nonzero), and
 * keeps the previous hunks when collection failed for the same revision.
 */
export class GitDiffDataController {
  readonly #cwd: string;
  readonly #store: GitDiffPrimeStore;
  readonly #collect: typeof collectGitDiff;
  readonly #now: () => number;
  readonly #onChange?: (data: GitDiffData) => void;
  #enabled: boolean;
  #baseMode: GitDiffBaseMode | string;
  #refreshKey: number;
  #entry: GitDiffEntry | null = null;
  #hasLoaded: boolean;
  #skipNext: boolean;
  #loading: boolean;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #abort: AbortController | null = null;
  #generation = 0;
  #disposed = false;

  constructor(options: GitDiffDataOptions) {
    this.#cwd = options.cwd;
    this.#store = options.store ?? new GitDiffPrimeStore();
    this.#collect = options.collect ?? collectGitDiff;
    this.#now = options.now ?? Date.now;
    this.#onChange = options.onChange;
    this.#enabled = options.enabled ?? true;
    this.#baseMode = options.baseMode ?? 'auto';
    this.#refreshKey = options.refreshKey ?? 0;
    // Hook init: take() runs at most once, and the taken entry is the starting data.
    const taken = this.#enabled ? this.#store.take(this.#baseMode, this.#now()) : undefined;
    this.#entry = taken?.round ?? null;
    this.#hasLoaded = taken !== undefined;
    this.#loading = !this.#hasLoaded;
    this.#skipNext = taken !== undefined && taken.refreshKey === this.#refreshKey;
  }

  /** The derived view; source `WKn`'s return value. */
  get view(): GitDiffData {
    return buildGitDiffData(this.#entry, {
      loading: this.#loading, enabled: this.#enabled, baseMode: this.#baseMode,
    });
  }

  get loading(): boolean { return this.#enabled && this.#loading; }

  /** Runs the source effect for the current state and returns the view. */
  start(): GitDiffData {
    this.#runEffect();
    return this.view;
  }

  /** Source prop `t`: a changed key re-runs the effect; nonzero keys debounce like a manual refresh. */
  setRefreshKey(refreshKey: number): GitDiffData {
    this.#refreshKey = refreshKey;
    this.#runEffect();
    return this.view;
  }

  /** Source dep `r`. Turning it off aborts the in-flight collection, as the effect cleanup does. */
  setEnabled(enabled: boolean): GitDiffData {
    this.#enabled = enabled;
    this.#runEffect();
    return this.view;
  }

  setBaseMode(baseMode: GitDiffBaseMode | string): GitDiffData {
    this.#baseMode = baseMode;
    this.#runEffect();
    return this.view;
  }

  /** Explicit rerun, the source's `ae` counter bump. */
  refresh(): GitDiffData {
    this.#runEffect();
    return this.view;
  }

  dispose(): void {
    this.#disposed = true;
    this.#cleanup();
  }

  #runEffect(): void {
    this.#cleanup();
    if (!this.#enabled || this.#disposed) return;
    if (this.#skipNext) { this.#skipNext = false; return; }
    const controller = new AbortController();
    this.#abort = controller;
    const generation = ++this.#generation;
    const run = async (): Promise<void> => {
      const collected = await this.#collect(this.#cwd, this.#baseMode, controller.signal);
      if (this.#disposed || generation !== this.#generation) return;
      if (collected !== null) {
        const previous = this.#entry;
        const revision = diffRevision(collected.result);
        this.#entry = {
          result: collected.result,
          baseMode: String(this.#baseMode),
          // Source fallback: hunk collection failure keeps the previous hunks for the same revision.
          hunks: collected.hunks
            ?? (previous !== null && diffRevision(previous.result) === revision ? previous.hunks : EMPTY_GIT_DIFF_HUNKS),
        };
      }
      this.#hasLoaded = true;
      this.#loading = false;
      this.#onChange?.(this.view);
    };
    const delay = this.#hasLoaded || this.#refreshKey !== 0 ? GIT_DIFF_REFRESH_DEBOUNCE_MS : 0;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void run();
    }, delay);
  }

  #cleanup(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#generation++;
    this.#abort?.abort();
    this.#abort = null;
  }
}
