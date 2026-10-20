import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { ADD_DIR_USAGE, addedForSessionMessage, addedToSettingsFailedMessage,
  addedToSettingsMessage, addDirectoryMessage, expandDirectoryPath, isNetworkPath,
  validateAddDirectory, withinDirectory } from '../src/add-dir-command.js';

const roots: string[] = [];
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-add-dir-')));
  roots.push(dir); return dir;
}
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

const directory = () => ({ isDirectory: () => true });
const file = () => ({ isDirectory: () => false });

test('a path expands from the home directory and resolves against the cwd', () => {
  assert.equal(expandDirectoryPath('~', '/tmp'), os.homedir());
  assert.equal(expandDirectoryPath('~/notes', '/tmp'), path.join(os.homedir(), 'notes'));
  assert.equal(expandDirectoryPath('sub/dir', '/tmp'), path.resolve('/tmp', 'sub/dir'));
  assert.equal(expandDirectoryPath('/abs/path', '/tmp'), path.resolve('/tmp', '/abs/path'));
});

test('containment covers the directory itself and everything under it', () => {
  assert.equal(withinDirectory('/a/b', '/a/b'), true);
  assert.equal(withinDirectory('/a/b/c', '/a/b'), true);
  assert.equal(withinDirectory('/a/bc', '/a/b'), false);
  assert.equal(withinDirectory('/a', '/a/b'), false);
});

test('a UNC spelling is the network path this build can still catch', () => {
  assert.equal(isNetworkPath('\\\\server\\share'), true);
  assert.equal(isNetworkPath('//server/share'), true);
  assert.equal(isNetworkPath('/mnt/share'), false);
});

test('the validator walks the recovered checks in order', () => {
  const base = { workingDirectories: ['/extra'], cwd: '/workspace' };
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '' }), { kind: 'emptyPath' });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: 'bad\0path' }),
    { kind: 'invalidPath', directoryPath: 'bad\0path', containsNullByte: true });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '\\\\server\\share' }),
    { kind: 'networkPath', directoryPath: '\\\\server\\share', absolutePath: path.resolve('/workspace', '\\\\server\\share') });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/missing', stat: () => undefined }),
    { kind: 'pathNotFound', directoryPath: '/missing', absolutePath: '/missing' });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/a/file', stat: file }),
    { kind: 'notADirectory', directoryPath: '/a/file', absolutePath: '/a/file' });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/new', stat: directory }),
    { kind: 'success', absolutePath: '/new' });
});

test('a path already inside a reachable root says which root it is', () => {
  const base = { workingDirectories: ['/extra'], cwd: '/workspace', stat: directory };
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/workspace' }),
    { kind: 'alreadyInWorkingDirectory', directoryPath: '/workspace', absolutePath: '/workspace',
      workingDir: '/workspace', isExactMatch: true, isOriginalCwd: true });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/extra' }),
    { kind: 'alreadyInWorkingDirectory', directoryPath: '/extra', absolutePath: '/extra',
      workingDir: '/extra', isExactMatch: true, isOriginalCwd: false });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/extra/deep' }),
    { kind: 'alreadyInWorkingDirectory', directoryPath: '/extra/deep', absolutePath: '/extra/deep',
      workingDir: '/extra', isExactMatch: false, isOriginalCwd: false });
  assert.deepEqual(validateAddDirectory({ ...base, directoryPath: '/workspace/deep' }),
    { kind: 'alreadyInWorkingDirectory', directoryPath: '/workspace/deep', absolutePath: '/workspace/deep',
      workingDir: '/workspace', isExactMatch: false, isOriginalCwd: true });
});

test('a real directory outside every root validates and is added', () => {
  const dir = temp();
  const nested = path.join(dir, 'nested');
  fs.mkdirSync(nested);
  assert.deepEqual(validateAddDirectory({ directoryPath: nested, workingDirectories: [], cwd: dir }),
    { kind: 'alreadyInWorkingDirectory', directoryPath: nested, absolutePath: nested, workingDir: dir,
      isExactMatch: false, isOriginalCwd: true });
  assert.deepEqual(validateAddDirectory({ directoryPath: nested, workingDirectories: [], cwd: temp() }),
    { kind: 'success', absolutePath: nested });
});

test('every result kind has its recovered message', () => {
  assert.equal(addDirectoryMessage({ kind: 'emptyPath' }), 'Please provide a directory path.');
  assert.equal(addDirectoryMessage({ kind: 'invalidPath', directoryPath: '/p', containsNullByte: true }),
    "Path /p contains a null character, so it can't be used as a working directory. "
    + 'Remove the null character from the path or from the settings entry that lists it.');
  assert.equal(addDirectoryMessage({ kind: 'invalidPath', directoryPath: '/p', containsNullByte: false }),
    "Path /p couldn't be resolved, so it can't be used as a working directory. "
    + 'Check the path or the settings entry that lists it.');
  assert.equal(addDirectoryMessage({ kind: 'networkPath', directoryPath: '\\\\s\\share', absolutePath: 'x' }),
    '\\\\s\\share is a network path, which cannot be added as a working directory. '
    + 'On Windows, map the share to a drive letter and pass it at launch with --add-dir '
    + '(a drive letter added mid-session does not yet carry remote-read trust).');
  assert.equal(addDirectoryMessage({ kind: 'pathNotFound', directoryPath: '/p', absolutePath: '/p' }),
    'Path /p was not found.');
  assert.equal(addDirectoryMessage({ kind: 'notADirectory', directoryPath: '/a/file', absolutePath: '/a/file' }),
    '/a/file is not a directory. Did you mean to add the parent directory /a?');
  assert.equal(addDirectoryMessage({ kind: 'alreadyInWorkingDirectory', directoryPath: '/w',
    absolutePath: '/w', workingDir: '/w', isExactMatch: true, isOriginalCwd: true }),
    '/w is already the current working directory.');
  assert.equal(addDirectoryMessage({ kind: 'alreadyInWorkingDirectory', directoryPath: '/e',
    absolutePath: '/e', workingDir: '/e', isExactMatch: true, isOriginalCwd: false }),
    '/e is already added as a working directory.');
  assert.equal(addDirectoryMessage({ kind: 'alreadyInWorkingDirectory', directoryPath: '/e/d',
    absolutePath: '/e/d', workingDir: '/e', isExactMatch: false, isOriginalCwd: false }),
    '/e/d is already accessible within the additional working directory /e.');
  assert.equal(addDirectoryMessage({ kind: 'alreadyInWorkingDirectory', directoryPath: '/w/d',
    absolutePath: '/w/d', workingDir: '/w', isExactMatch: false, isOriginalCwd: true }),
    '/w/d is already accessible within the current working directory /w.');
  assert.equal(addDirectoryMessage({ kind: 'success', absolutePath: '/new' }),
    'Added /new as a working directory.');
});

test('the three apply reports are the recovered ones', () => {
  assert.equal(ADD_DIR_USAGE, 'Usage: /add-dir <path>');
  assert.equal(addedForSessionMessage('/new'), 'Added /new as a working directory for this session');
  assert.equal(addedToSettingsMessage('/new'), 'Added /new as a working directory and saved to local settings');
  assert.equal(addedToSettingsFailedMessage('/new', 'disk full'),
    'Added /new as a working directory. Failed to save to local settings: disk full');
});
