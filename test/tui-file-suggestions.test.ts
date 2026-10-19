import assert from 'node:assert/strict';
import test from 'node:test';
import { atPartial, atQuery, atToken, applyFileSuggestion, commonPrefix, directorySuggestionRows,
  fileSuggestionRows, isExplicitPath, shapeAtDisplayText, FILE_SUGGESTION_LIMIT,
  DIRECTORY_SUGGESTION_LIMIT } from '../src/tui-file-suggestions.js';
import { FileIndex } from '../src/tui-file-index.js';

test('an @ token is read from the draft, and a bare path is not one', () => {
  assert.deepEqual(atToken('@src/a', 6), { token: '@src/a', startPos: 0, isQuoted: false });
  assert.deepEqual(atToken('look at @src', 12), { token: '@src', startPos: 8, isQuoted: false });
  assert.equal(atQuery('plain/path', 10), undefined, 'a token without an @ is not a file query');
  // Source `WDt`: a path run keeps an `@` it finds inside it, so the token starts there.
  assert.deepEqual(atToken('foo@bar', 7), { token: '@bar', startPos: 3, isQuoted: false });
  // The token continues past the cursor, so a cursor inside a path still resolves it.
  assert.deepEqual(atToken('@src/alpha.ts', 4), { token: '@src/alpha.ts', startPos: 0, isQuoted: false });
});

test('a quoted token keeps its quotes and its partial is the inner text', () => {
  const quoted = atToken('@"my file', 9);
  assert.deepEqual(quoted, { token: '@"my file', startPos: 0, isQuoted: true });
  assert.equal(quoted && atPartial(quoted), 'my file');
  assert.equal(atPartial({ token: '@src/a', startPos: 0, isQuoted: false }), 'src/a');
});

test('an explicit path lists a directory instead of searching the index', () => {
  assert.equal(isExplicitPath('~/x'), true);
  assert.equal(isExplicitPath('/etc'), true);
  assert.equal(isExplicitPath('./src'), true);
  assert.equal(isExplicitPath('../src'), true);
  assert.equal(isExplicitPath('..'), true);
  assert.equal(isExplicitPath('src'), false);
  assert.equal(isExplicitPath('~user/x'), false);
});

test('the query gate needs the @ at the end of the text before the cursor', () => {
  assert.equal(atQuery('@ro', 3)?.partial, 'ro');
  assert.equal(atQuery('@ro', 3)?.explicit, false);
  assert.equal(atQuery('@./sr', 5)?.explicit, true);
  assert.equal(atQuery('/model', 6), undefined);
  assert.equal(atQuery('@src ', 5), undefined, 'a space closes the token');
});

test('the file rows come from the index, limited and shaped as file- ids', () => {
  const index = new FileIndex();
  index.loadFromFileList(['src/alpha.ts', 'src/beta.ts', 'docs/gamma.md']);
  const rows = fileSuggestionRows(query => index.search(query, FILE_SUGGESTION_LIMIT),
    'alpha', '/tmp', () => []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, 'file-src/alpha.ts');
  assert.equal(rows[0]?.displayText, 'src/alpha.ts');
  assert.equal(rows[0]?.score, 0);
});

test('a ./ head is stripped before the search, and ~ expands', () => {
  const seen: string[] = [];
  fileSuggestionRows(query => { seen.push(query); return []; }, './src', '/tmp', () => []);
  assert.deepEqual(seen, ['src']);
  fileSuggestionRows(query => { seen.push(query); return []; }, '~', '/tmp', () => []);
  assert.equal(seen[1], process.env.HOME ?? seen[1]);
});

test('an empty partial lists the working directory and keeps its trailing separator', () => {
  const rows = fileSuggestionRows(() => [], '', '/tmp', () => ['src/', 'a.ts']);
  assert.deepEqual(rows.map(row => row.id), ['file-src/', 'file-a.ts']);
  assert.deepEqual(rows.map(row => row.score), [0, 0.5]);
});

test('an explicit listing puts directories first and filters by the typed prefix', () => {
  const readdir = (directory: string) => directory === '/base/sub'
    ? [{ name: 'alpha', isDirectory: true }, { name: 'beta.txt', isDirectory: false },
       { name: '.hidden', isDirectory: false }]
    : [];
  const rows = directorySuggestionRows('./sub/al', '/base', readdir);
  assert.deepEqual(rows, [{ id: 'sub/alpha', displayText: 'sub/alpha/' }]);
  const all = directorySuggestionRows('./sub/', '/base', readdir);
  assert.deepEqual(all.map(row => row.displayText), ['sub/alpha/', 'sub/beta.txt']);
  assert.equal(all.length <= DIRECTORY_SUGGESTION_LIMIT, true);
});

test('the longest common prefix is what Tab fills first', () => {
  assert.equal(commonPrefix(['src/alpha.ts', 'src/alpine.ts']), 'src/alp');
  assert.equal(commonPrefix(['a', 'b']), '');
  assert.equal(commonPrefix([]), '');
  assert.equal(commonPrefix(['only']), 'only');
});

test('an accepted path keeps its @, gains quotes when it has a space, and completes with one', () => {
  assert.equal(shapeAtDisplayText('src/a.ts', { hasAtPrefix: true, isQuoted: false, isComplete: true }),
    '@src/a.ts ');
  assert.equal(shapeAtDisplayText('src/alp', { hasAtPrefix: true, isQuoted: false, isComplete: false }),
    '@src/alp');
  assert.equal(shapeAtDisplayText('my file.ts', { hasAtPrefix: true, isQuoted: false, isComplete: true,
    needsQuotes: true }), '@"my file.ts" ');
  assert.equal(shapeAtDisplayText('src/a.ts', { hasAtPrefix: false, isQuoted: true, isComplete: true }),
    '@"src/a.ts" ');
});

test('the splice replaces the whole token and leaves the cursor after the text', () => {
  const applied = applyFileSuggestion('see @src/al now', { token: '@src/al', startPos: 4, isQuoted: false },
    '@src/alpha.ts ');
  assert.deepEqual(applied, { text: 'see @src/alpha.ts  now', cursor: 18 });
});
