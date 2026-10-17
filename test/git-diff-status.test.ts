import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  GIT_DIFF_FILE_LIMIT, hasHiddenGitDiffPathCharacters, isGitDiffPathWithinRoot,
  parseGitChangedPath, parseGitDiffStats, readGitDiffStats, sanitizeGitDiffPath, splitGitRenamePaths,
} from '../src/git-diff-status.js';

test('git raw and numstat lines pair into totals and per-file status', () => {
  const output = [
    ':100644 100644 aaa bbb M\tsrc/app.ts', '5\t2\tsrc/app.ts',
    ':000000 100644 000 ccc A\tsrc/new.ts', '7\t0\tsrc/new.ts',
    ':100644 100644 ddd eee D\tsrc/gone.ts', '0\t4\tsrc/gone.ts',
    ':100644 100644 fff 000 M\tassets/logo.png', '-\t-\tassets/logo.png',
  ].join('\n');
  const parsed = parseGitDiffStats(output);
  assert.deepEqual(parsed.stats, { filesCount: 4, linesAdded: 12, linesRemoved: 6 });
  assert.deepEqual(parsed.perFileStats.get('src/app.ts'),
    { added: 5, removed: 2, isBinary: false, isUntracked: false, status: 'modified' });
  assert.equal(parsed.perFileStats.get('src/new.ts')?.status, 'added');
  assert.equal(parsed.perFileStats.get('src/gone.ts')?.status, 'removed');
  assert.deepEqual(parsed.perFileStats.get('assets/logo.png'),
    { added: 0, removed: 0, isBinary: true, isUntracked: false, status: 'modified' });
});

test('unpaired numstat lines keep their counts without raw status metadata', () => {
  const parsed = parseGitDiffStats('3\t1\tnotes.md\n');
  assert.deepEqual(parsed.stats, { filesCount: 1, linesAdded: 3, linesRemoved: 1 });
  assert.deepEqual(parsed.perFileStats.get('notes.md'),
    { added: 3, removed: 1, isBinary: false, isUntracked: false });
});

test('the per-file map stops at the source limit while the totals keep counting', () => {
  const output = Array.from({ length: 60 }, (_, index) => `1\t0\tfile-${index}.ts`).join('\n');
  const parsed = parseGitDiffStats(output);
  assert.equal(parsed.stats.filesCount, 60);
  assert.equal(parsed.stats.linesAdded, 60);
  assert.equal(parsed.perFileStats.size, GIT_DIFF_FILE_LIMIT);
  assert.equal(parsed.perFileStats.has('file-49.ts'), true);
  assert.equal(parsed.perFileStats.has('file-50.ts'), false);
});

test('the within-root scope drops escaping paths before they count', () => {
  const output = ['2\t0\tsrc/inside.ts', '1\t0\t../outside.ts', '1\t0\tsrc/../inside.ts'].join('\n');
  const parsed = parseGitDiffStats(output, GIT_DIFF_FILE_LIMIT, 'within-root');
  assert.deepEqual(parsed.stats, { filesCount: 1, linesAdded: 2, linesRemoved: 0 });
  assert.deepEqual([...parsed.perFileStats.keys()], ['src/inside.ts']);
});

test('a raw rename line carries both sides and a seen rename drops the old side', () => {
  const line = ':100644 100644 aaa bbb R100\told.ts\tnew.ts';
  assert.deepEqual(parseGitChangedPath(line),
    { status: 'renamed', previousPath: 'old.ts', newPath: 'new.ts' });
  assert.deepEqual(parseGitChangedPath(line, true), { status: 'renamed' });
  assert.deepEqual(parseGitChangedPath(':000000 100644 000 ccc A\tnew.ts'), { status: 'added' });
});

test('diff paths reject absolute, drive, escaping and hidden forms', () => {
  assert.equal(sanitizeGitDiffPath('src/app.ts'), 'src/app.ts');
  assert.equal(sanitizeGitDiffPath('/etc/passwd'), undefined);
  assert.equal(sanitizeGitDiffPath('C:\\temp\\a.ts'), undefined);
  assert.equal(sanitizeGitDiffPath('a/../b.ts'), undefined);
  assert.equal(sanitizeGitDiffPath('a/.. /b.ts'), undefined);
  assert.equal(sanitizeGitDiffPath('a/b\u200bc.ts'), undefined);
  assert.equal(sanitizeGitDiffPath('a/b\u0000c.ts'), undefined);
});

test('rename displays split both plain and brace forms, decoding C-quoted paths', () => {
  assert.deepEqual(splitGitRenamePaths('old.ts => new.ts'), ['old.ts', 'new.ts']);
  assert.deepEqual(splitGitRenamePaths('src/{old => new}/file.ts'),
    ['src/{old', 'new}/file.ts', 'src/old/file.ts', 'src/new/file.ts']);
  assert.deepEqual(splitGitRenamePaths('"a\\303\\251.ts"'), ['aé.ts']);
  assert.equal(splitGitRenamePaths('"unterminated'), null);
  assert.equal(splitGitRenamePaths('a => b => c'), null);
});

test('the within-root guard rejects absolute, drive and dot-dot segments', () => {
  assert.equal(isGitDiffPathWithinRoot('src/{a => b}/file.ts'), true);
  assert.equal(isGitDiffPathWithinRoot('/tmp/file.ts'), false);
  assert.equal(isGitDiffPathWithinRoot('C:\\file.ts'), false);
  assert.equal(isGitDiffPathWithinRoot('src/{../a => ../b}/file.ts'), false);
});

test('hidden characters include format characters, separators and lone surrogates', () => {
  assert.equal(hasHiddenGitDiffPathCharacters('src/app.ts'), false);
  assert.equal(hasHiddenGitDiffPathCharacters('src/\u200bapp.ts'), true);
  assert.equal(hasHiddenGitDiffPathCharacters('src/\u2028app.ts'), true);
  assert.equal(hasHiddenGitDiffPathCharacters('src/\ud800app.ts'), true);
});

test('the host reader collects a real working-tree diff and ignores untracked files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-status-'));
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init', '-q');
    git('config', 'user.email', 'fixture@example.test');
    git('config', 'user.name', 'Fixture');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'one\ntwo\n');
    fs.writeFileSync(path.join(dir, 'b.ts'), 'bye\n');
    git('add', 'a.ts', 'b.ts');
    git('commit', '-qm', 'initial');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'one\nTWO\nthree\n');
    fs.rmSync(path.join(dir, 'b.ts'));
    fs.writeFileSync(path.join(dir, 'c.ts'), 'new\n');
    git('add', '-N', 'c.ts');
    fs.writeFileSync(path.join(dir, 'u.ts'), 'untracked\n');

    const parsed = await readGitDiffStats(dir);
    assert.ok(parsed);
    assert.deepEqual(parsed.stats, { filesCount: 3, linesAdded: 3, linesRemoved: 2 });
    assert.deepEqual(parsed.perFileStats.get('a.ts'),
      { added: 2, removed: 1, isBinary: false, isUntracked: false, status: 'modified' });
    assert.deepEqual(parsed.perFileStats.get('b.ts'),
      { added: 0, removed: 1, isBinary: false, isUntracked: false, status: 'removed' });
    assert.deepEqual(parsed.perFileStats.get('c.ts'),
      { added: 1, removed: 0, isBinary: false, isUntracked: false, status: 'added' });
    assert.equal(parsed.perFileStats.has('u.ts'), false);

    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-diff-plain-'));
    try { assert.equal(await readGitDiffStats(outside), null); }
    finally { fs.rmSync(outside, { recursive: true, force: true }); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
