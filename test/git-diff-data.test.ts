import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GIT_DIFF_PRIME_TTL_MS, GIT_DIFF_REFRESH_DEBOUNCE_MS, GIT_DIFF_TRUNCATION_LINE_COUNT,
  GitDiffDataController, GitDiffPrimeStore, buildGitDiffData, collectGitDiff, diffRevision,
  primeGitDiff, type GitDiffCollected, type GitDiffRawResult,
} from '../src/git-diff-data.js';
import type { GitDiffFileStat } from '../src/git-diff-status.js';
import type { GitDiffHunks } from '../src/git-diff-hunks.js';

function rawResult(files: Array<[string, Partial<GitDiffFileStat>]>,
  extra: Partial<GitDiffRawResult> = {}): GitDiffRawResult {
  const perFileStats = new Map<string, GitDiffFileStat>(files.map(([path, stat]) => [path, {
    added: 0, removed: 0, isBinary: false, isUntracked: false, ...stat,
  }]));
  return {
    stats: { filesCount: perFileStats.size, linesAdded: 0, linesRemoved: 0 },
    perFileStats, source: { kind: 'working-tree' }, ...extra,
  };
}

const hunksWith = (skipped: string[] = []): GitDiffHunks => ({
  hunks: new Map(), skippedLarge: new Set(skipped),
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('the revision follows noCommits and the branch source', () => {
  assert.equal(diffRevision(rawResult([], { noCommits: true })), '--cached');
  assert.equal(diffRevision(rawResult([], { source: { kind: 'branch', baseRef: 'abc123' } })), 'abc123');
  assert.equal(diffRevision(rawResult([], { source: { kind: 'branch' } })), 'HEAD');
  assert.equal(diffRevision(rawResult([])), 'HEAD');
});

test('an absent entry yields the empty working-tree view', () => {
  const loading = buildGitDiffData(null, { loading: true, enabled: true, baseMode: 'session' });
  assert.deepEqual(loading, {
    stats: null, files: [], hunks: new Map(),
    loading: true, source: { kind: 'working-tree' }, baseMode: 'session',
  });
  const disabled = buildGitDiffData(null, { loading: true, enabled: false, baseMode: 'auto' });
  assert.equal(disabled.loading, false);
});

test('file rows sort by path and apply the large, truncation, binary and untracked rules', () => {
  const result = rawResult([
    ['z.ts', { added: GIT_DIFF_TRUNCATION_LINE_COUNT + 1, removed: 0, isUntracked: true }],
    ['a.ts', { added: 1, removed: 1 }],
    ['big.ts', { added: 900, removed: 0 }],
    ['bin.dat', { added: 900, removed: 0, isBinary: true }],
  ]);
  const data = buildGitDiffData(
    { result, baseMode: 'auto', hunks: hunksWith(['big.ts']) },
    { loading: true, enabled: true, baseMode: 'auto' },
  );
  assert.deepEqual(data.files.map((file) => file.path), ['a.ts', 'big.ts', 'bin.dat', 'z.ts']);
  assert.deepEqual(data.files.find((file) => file.path === 'z.ts'), {
    path: 'z.ts', linesAdded: GIT_DIFF_TRUNCATION_LINE_COUNT + 1, linesRemoved: 0,
    isBinary: false, isLargeFile: false, isTruncated: true, isUntracked: true, preSession: undefined,
  });
  const large = data.files.find((file) => file.path === 'big.ts');
  assert.equal(large?.isLargeFile, true);
  assert.equal(large?.isTruncated, false);
  assert.equal(data.files.find((file) => file.path === 'bin.dat')?.isTruncated, false);
  assert.equal(data.loading, false);
});

test('the prime store expires after its TTL and keeps a mismatched entry', () => {
  const store = new GitDiffPrimeStore();
  const entry = { result: rawResult([]), baseMode: 'auto', hunks: hunksWith() };
  store.set('auto', 3, entry, 1000);
  assert.equal(store.isPrimed, true);
  assert.equal(store.take('session', 1000), undefined);
  assert.equal(store.isPrimed, true, 'a base-mode mismatch leaves the entry in place');
  assert.deepEqual(store.take('auto', 1000 + GIT_DIFF_PRIME_TTL_MS), { round: entry, refreshKey: 3 });
  assert.equal(store.isPrimed, false, 'take consumes the entry');
  assert.equal(store.take('auto', 1000 + GIT_DIFF_PRIME_TTL_MS + 1), undefined);
});

test('an expired prime entry is dropped on take', () => {
  const store = new GitDiffPrimeStore();
  store.set('auto', 0, null, 0);
  assert.equal(store.take('auto', GIT_DIFF_PRIME_TTL_MS + 1), undefined);
  assert.equal(store.isPrimed, false);
});

test('priming stores the collected entry and skips an aborted collection', async () => {
  const store = new GitDiffPrimeStore();
  const collected: GitDiffCollected = { result: rawResult([['a.ts', {}]]), hunks: hunksWith() };
  await primeGitDiff(store, '/repo', 'auto', 5, undefined, async () => collected, () => 42);
  const taken = store.take('auto', 42);
  assert.deepEqual(taken, {
    round: { result: collected.result, baseMode: 'auto', hunks: collected.hunks }, refreshKey: 5,
  });

  const aborted = new AbortController();
  aborted.abort();
  await primeGitDiff(store, '/repo', 'auto', 6, aborted.signal, async () => collected, () => 42);
  assert.equal(store.isPrimed, false);
});

test('a failed prime stores a null entry that still counts as loaded', async () => {
  const store = new GitDiffPrimeStore();
  await primeGitDiff(store, '/repo', 'auto', 1, undefined, async () => null, () => 0);
  assert.deepEqual(store.take('auto', 0), { round: null, refreshKey: 1 });
});

test('the controller collects immediately when no prime exists and reports the view', async () => {
  let calls = 0;
  const collected: GitDiffCollected = {
    result: rawResult([['a.ts', { added: 2 }]]), hunks: hunksWith(),
  };
  const views: string[] = [];
  const controller = new GitDiffDataController({
    cwd: '/repo',
    collect: async () => { calls++; return collected; },
    onChange: (data) => views.push(data.files.map((file) => file.path).join(',')),
  });
  const initial = controller.start();
  assert.equal(initial.loading, true);
  assert.equal(calls, 0, 'the effect schedules the run on the timer');
  await wait(10);
  assert.equal(calls, 1);
  assert.equal(controller.view.loading, false);
  assert.deepEqual(controller.view.files.map((file) => file.path), ['a.ts']);
  assert.deepEqual(views, ['a.ts']);
});

test('a prime for the current refresh key suppresses the mount fetch', async () => {
  const store = new GitDiffPrimeStore();
  store.set('auto', 7, { result: rawResult([['p.ts', {}]]), baseMode: 'auto', hunks: hunksWith() }, 0);
  let calls = 0;
  const controller = new GitDiffDataController({
    cwd: '/repo', store, refreshKey: 7, now: () => 0,
    collect: async () => { calls++; return null; },
  });
  controller.start();
  await wait(10);
  assert.equal(calls, 0);
  assert.deepEqual(controller.view.files.map((file) => file.path), ['p.ts']);
  assert.equal(controller.view.loading, false);
});

test('a manual refresh debounces once data exists', async () => {
  let calls = 0;
  const controller = new GitDiffDataController({
    cwd: '/repo',
    collect: async () => { calls++; return { result: rawResult([['a.ts', {}]]), hunks: hunksWith() }; },
  });
  controller.start();
  await wait(10);
  assert.equal(calls, 1);
  controller.refresh();
  assert.equal(calls, 1, 'the refresh is debounced');
  await wait(30);
  assert.equal(calls, 1, 'still inside the debounce window');
  await wait(GIT_DIFF_REFRESH_DEBOUNCE_MS);
  assert.equal(calls, 2);
});

test('a failed hunk collection keeps the previous hunks for the same revision', async () => {
  const firstHunks = hunksWith(['big.ts']);
  firstHunks.hunks.set('a.ts', [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [' x'] }]);
  let round = 0;
  const controller = new GitDiffDataController({
    cwd: '/repo',
    collect: async () => {
      round++;
      return round === 1
        ? { result: rawResult([['a.ts', {}]]), hunks: firstHunks }
        : { result: rawResult([['a.ts', {}]]), hunks: null };
    },
  });
  controller.start();
  await wait(10);
  controller.refresh();
  await wait(GIT_DIFF_REFRESH_DEBOUNCE_MS + 20);
  assert.equal(round, 2);
  assert.equal(controller.view.hunks.get('a.ts')?.length, 1);
});

test('a stale collection is discarded and disabling aborts the in-flight one', async () => {
  const signals: AbortSignal[] = [];
  let calls = 0;
  const controller = new GitDiffDataController({
    cwd: '/repo',
    collect: async (_cwd, _mode, signal) => {
      calls++;
      if (signal !== undefined) signals.push(signal);
      await wait(calls === 1 ? 40 : 0);
      return { result: rawResult([[calls === 1 ? 'old.ts' : 'new.ts', {}]]), hunks: hunksWith() };
    },
  });
  controller.start();
  await wait(5);
  controller.refresh();
  await wait(200);
  assert.equal(calls, 2);
  assert.equal(signals[0]?.aborted, true, 'the first run was cleaned up');
  assert.deepEqual(controller.view.files.map((file) => file.path), ['new.ts']);

  controller.refresh();
  await wait(10);
  const before = calls;
  controller.setEnabled(false);
  await wait(200);
  assert.equal(calls, before, 'a disabled controller runs nothing new');
  assert.equal(signals.at(-1)?.aborted, true);
});

test('the default collector answers null outside a repository', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-data-'));
  try {
    assert.equal(await collectGitDiff(dir, 'auto'), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
