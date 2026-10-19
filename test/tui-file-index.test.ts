import assert from 'node:assert/strict';
import test from 'node:test';
import { FileIndex } from '../src/tui-file-index.js';

function index(paths: readonly string[]): FileIndex {
  const built = new FileIndex();
  built.loadFromFileList(paths);
  return built;
}

test('a basename prefix outranks a match buried in a directory name', () => {
  const files = index(['src/rocket/launch.ts', 'src/model/rocket.ts', 'docs/rocket.md']);
  const ranked = files.search('rocket', 3).map(match => match.path);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0], 'docs/rocket.md', 'the shortest path with the match in its name leads');
  assert.ok(ranked.includes('src/model/rocket.ts'));
});

test('a boundary and a camel hump both score above a match mid-word', () => {
  const files = index(['a/bcdef.ts', 'a/b-cdef.ts']);
  const ranked = files.search('cd', 2).map(match => match.path);
  assert.equal(ranked[0], 'a/b-cdef.ts', 'the hyphen makes the match a boundary');
  const camel = index(['src/httpclient.ts', 'src/httpClient.ts']).search('hc', 2);
  assert.equal(camel[0]?.path, 'src/httpClient.ts', 'the hump beats the plain run');
});

test('positions come back as offsets into the original path', () => {
  const files = index(['src/Rocket.ts']);
  const [match] = files.search('rocket', 1);
  assert.ok(match);
  assert.equal(match.path, 'src/Rocket.ts');
  assert.deepEqual([...match.positions], [4, 5, 6, 7, 8, 9]);
});

test('the query prefilter drops a path that lacks a letter', () => {
  const files = index(['src/a.ts', 'src/b.ts']);
  assert.deepEqual(files.search('z', 5), []);
  assert.equal(files.search('a', 5).length, 1);
});

test('an empty query lists the shallowest distinct directories, shortest name first', () => {
  const files = index(['src/a.ts', 'src/b.ts', 'docs/c.md', 'lib/deep/d.md']);
  assert.deepEqual(files.search('', 10).map(match => match.path), ['lib', 'src', 'docs']);
  assert.deepEqual(files.search('', 2).map(match => match.path), ['lib', 'src']);
  for (const match of files.search('', 10)) assert.deepEqual([...match.positions], []);
});

test('a path mentioning test is lifted, and the score falls with the rank', () => {
  const files = index(['src/alpha.ts', 'src/alphabet.ts', 'test/alpha.spec.ts']);
  const ranked = files.search('alpha', 3);
  assert.equal(ranked.length, 3);
  for (const match of ranked) assert.ok(match.score >= 0 && match.score <= 1, String(match.score));
  const lifted = ranked.find(match => match.path.startsWith('test/'));
  assert.ok(lifted, 'the test path is in the list');
  assert.ok(lifted.score > ranked.find(match => match.path === 'src/alphabet.ts')!.score
    || ranked.indexOf(lifted) === 0, 'the lift keeps it near the top');
});

test('the list is deduplicated and empty entries are dropped', () => {
  const files = index(['src/a.ts', 'src/a.ts', '', 'src/b.ts']);
  assert.equal(files.size, 2);
  assert.equal(files.search('a', 10).length, 1);
});

test('the limit is honoured and an empty index answers nothing', () => {
  const files = index(['src/a1.ts', 'src/a2.ts', 'src/a3.ts']);
  assert.equal(files.search('a', 2).length, 2);
  assert.deepEqual(index([]).search('a', 5), []);
  assert.deepEqual(files.search('a', 0), []);
});
