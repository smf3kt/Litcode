import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  GIT_DIFF_HUNK_FILE_LIMIT, GIT_DIFF_HUNK_LINE_LIMIT,
  parseGitDiffHunks, parseGitShortStat, readGitDiffHunks,
} from '../src/git-diff-hunks.js';

test('shortstat totals handle plural, singular and missing sides', () => {
  assert.deepEqual(parseGitShortStat(' 3 files changed, 12 insertions(+), 4 deletions(-)'),
    { filesCount: 3, linesAdded: 12, linesRemoved: 4 });
  assert.deepEqual(parseGitShortStat(' 1 file changed, 1 insertion(+)'),
    { filesCount: 1, linesAdded: 1, linesRemoved: 0 });
  assert.deepEqual(parseGitShortStat(' 2 files changed, 5 deletions(-)'),
    { filesCount: 2, linesAdded: 0, linesRemoved: 5 });
  assert.equal(parseGitShortStat('nothing to compare'), null);
});

test('a unified diff splits into per-file hunks with coordinates and marked lines', () => {
  const patch = [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 1111111..2222222 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -1,2 +1,3 @@',
    ' one',
    '+two',
    ' three',
    '@@ -10 +11,0 @@',
    '-gone',
    '',
  ].join('\n');
  const parsed = parseGitDiffHunks(patch);
  assert.deepEqual([...parsed.hunks.keys()], ['src/a.ts']);
  assert.deepEqual(parsed.hunks.get('src/a.ts'), [
    { oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' one', '+two', ' three'] },
    { oldStart: 10, oldLines: 1, newStart: 11, newLines: 0, lines: ['-gone', ''] },
  ]);
  assert.equal(parsed.skippedLarge.size, 0);
});

test('quoted diff headers decode and rename forms resolve to the new path', () => {
  const patch = [
    'diff --git "a/a\\303\\251.ts" "b/a\\303\\251.ts"',
    '@@ -1 +1 @@',
    '-old',
    '+new',
    '',
  ].join('\n');
  const parsed = parseGitDiffHunks(patch);
  assert.deepEqual([...parsed.hunks.keys()], ['aé.ts']);
  assert.deepEqual(parsed.hunks.get('aé.ts')?.[0]?.lines, ['-old', '+new', '']);
});

test('the hunk line cap stops at the source limit', () => {
  const body = Array.from({ length: GIT_DIFF_HUNK_LINE_LIMIT + 1 }, () => ' x').join('\n');
  const patch = `diff --git a/a.ts b/a.ts\n@@ -1,401 +1,401 @@\n${body}\n`;
  const parsed = parseGitDiffHunks(patch);
  assert.equal(parsed.hunks.get('a.ts')?.[0]?.lines.length, GIT_DIFF_HUNK_LINE_LIMIT);
});

test('the file cap stops adding files but counts none of the excess', () => {
  const sections = Array.from({ length: GIT_DIFF_HUNK_FILE_LIMIT + 1 }, (_, index) =>
    `diff --git a/f${index}.ts b/f${index}.ts\n@@ -1 +1 @@\n-a\n+b`).join('\n');
  const parsed = parseGitDiffHunks(sections);
  assert.equal(parsed.hunks.size, GIT_DIFF_HUNK_FILE_LIMIT);
  assert.equal(parsed.skippedLarge.size, 0);
  assert.equal(parsed.hunks.has('f49.ts'), true);
  assert.equal(parsed.hunks.has('f50.ts'), false);
});

test('an oversized file section is reported as skipped instead of parsed', () => {
  const patch = `diff --git a/big.ts b/big.ts\n@@ -1 +1 @@\n+${'x'.repeat(1_000_001)}\n`;
  const parsed = parseGitDiffHunks(patch);
  assert.deepEqual([...parsed.skippedLarge], ['big.ts']);
  assert.equal(parsed.hunks.has('big.ts'), false);
});

test('the host reader collects hunks from a real repository and drops unstaged paths from --cached', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-hunks-'));
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init', '-q');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'user.name', 'Fixture');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'one\ntwo\n');
    git('add', 'a.ts');
    git('commit', '-qm', 'initial');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'one\nTWO\n');

    const working = await readGitDiffHunks(dir);
    assert.ok(working);
    assert.deepEqual([...working.hunks.keys()], ['a.ts']);
    assert.deepEqual(working.hunks.get('a.ts')?.[0]?.lines, [' one', '-two', '+TWO', '']);

    git('add', 'a.ts');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'one\nTWO\nTHREE\n');
    const staged = await readGitDiffHunks(dir, '--cached');
    assert.ok(staged);
    assert.equal(staged.hunks.size, 0, 'the same path still has unstaged changes');

    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-hunks-plain-'));
    try { assert.equal(await readGitDiffHunks(outside), null); }
    finally { fs.rmSync(outside, { recursive: true, force: true }); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
