import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShellSedRecognition } from '../src/shell-sed-recognition-source.js';

const source = createShellSedRecognition(() => false, () => 'linux');

test('source sed recognition preserves literal substitutions and option forms', () => {
  for (const command of ['sed -i s/a/b/g file.txt', 'sed -i .bak s/a/b/g file.txt',
    "sed --in-place -e 's/a/b/g' file.txt"]) {
    assert.deepEqual(source.KMe(command), { filePath: 'file.txt', pattern: 'a', replacement: 'b',
      flags: 'g', extendedRegex: false });
  }
  assert.deepEqual(source.KMe('sed -E -i -e s/a/b/i file.txt'),
    { filePath: 'file.txt', pattern: 'a', replacement: 'b', flags: 'i', extendedRegex: true });
  assert.deepEqual(source.KMe("sed -i 's/a\\/b/x\\/y/2g' file.txt"),
    { filePath: 'file.txt', pattern: 'a\\/b', replacement: 'x\\/y', flags: '2g', extendedRegex: false });
});

test('source sed recognition excludes ambiguous or incomplete commands', () => {
  for (const command of ['sed s/a/b/g file.txt', 'sed -i s/a/b/g a b', 'sed -i s/a/b/e file.txt',
    'sed -i s/a/b/g file.txt; echo ok', 'sed -i s/a/b/g "$X"', 'sed -i -e s/a/b/g -e s/c/d/g file.txt',
    'sed -i s/a/b/g file*.txt', 'sed -i s/a/b/g file.txt > out', 'x'.repeat(10001)]) {
    assert.equal(source.KMe(command), null, command.slice(0, 80));
  }
  const paths: unknown[][] = [];
  const filtered = createShellSedRecognition((...args: unknown[]) => { paths.push(args); return true; }, () => 'linux');
  assert.equal(filtered.KMe('sed -i s/a/b/g file.txt'), null);
  assert.deepEqual(paths, [['file.txt', true]]);
  const windows = createShellSedRecognition(() => false, () => 'windows');
  assert.equal(windows.KMe('sed -i s/a/b/g //server/share'), null);
});
