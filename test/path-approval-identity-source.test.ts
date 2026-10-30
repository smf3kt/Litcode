import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createPathIdentity } from '../src/path-approval-identity-source.js';
import { createPathApprovalConsumer } from '../src/path-approval-consumer-source.js';
import { Be } from '../src/path-approval-stash-source.js';

test('source permission spellings follow the requested path to its observed landing', () => {
  const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'approval-identity-')));
  const api = { cwd: () => root, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
    realpathSync: (file: string) => fs.realpathSync(file).normalize('NFC'),
    openDirNoFollowSync(file: string) {
      const fd = fs.openSync(file, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      fs.closeSync(fd);
    } };
  const identity = createPathIdentity({ ie: () => api, qpt: () => null });
  const target = (name: string) => path.join(root, name);
  try {
    fs.mkdirSync(target('public'));
    fs.mkdirSync(target('other'));
    fs.writeFileSync(target('public/file.txt'), 'PUBLIC');
    fs.writeFileSync(target('other/file.txt'), 'OTHER');
    fs.symlinkSync('public', target('one'));
    fs.symlinkSync('one', target('two'));
    fs.symlinkSync('public/file.txt', target('leaf'));
    fs.symlinkSync('missing.txt', target('dangling'));
    fs.symlinkSync('loop', target('loop'));
    assert.deepEqual(identity.di(target('public/file.txt')), { unresolved: false, requested: target('public/file.txt'),
      spellings: [target('public/file.txt')], landing: target('public/file.txt'), leafIsSymlink: false });
    assert.deepEqual(identity.di(target('two/file.txt')), { unresolved: false, requested: target('two/file.txt'),
      spellings: [target('two/file.txt'), target('public/file.txt')], landing: target('public/file.txt'), leafIsSymlink: false });
    assert.deepEqual(identity.di(target('leaf')), { unresolved: false, requested: target('leaf'),
      spellings: [target('leaf'), target('public/file.txt')], landing: target('public/file.txt'), leafIsSymlink: true });
    assert.deepEqual(identity.di(target('dangling')), { unresolved: false, requested: target('dangling'),
      spellings: [target('dangling'), target('missing.txt')], landing: target('missing.txt'), leafIsSymlink: true });
    const loop = identity.di(target('loop'));
    assert.equal(loop.unresolved, true);
    assert.equal(loop.leafIsSymlink, true);
    assert.deepEqual(loop.spellings, [target('loop')]);

    const stash = new Be();
    const requested = target('two/file.txt');
    const first = identity.di(requested);
    stash.stash('changed', requested, first.spellings, 'read');
    fs.unlinkSync(target('one'));
    fs.symlinkSync('other', target('one'));
    const changed = identity.di(requested);
    stash.stash('changed', requested, changed.spellings, 'read');
    const take = createPathApprovalConsumer(identity._o, () => {});
    const approved = take({ session: { writePermissionStash: stash }, toolUseId: 'changed' }, requested, 'read');
    assert.deepEqual(approved, [requested]);
    assert.deepEqual(changed.spellings, [requested, target('other/file.txt')]);
    assert.equal(changed.spellings.every((spelling: string) => approved.includes(spelling)), false);
    assert.equal(fs.readFileSync(target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(target('other/file.txt'), 'utf8'), 'OTHER');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('source observations respond to link changes independently for each filesystem owner', () => {
  const first = '/fixture-one', second = '/fixture-two';
  const make = (cwd: string, link: string) => ({ cwd: () => cwd,
    lstatSync(file: string) {
      if (file === path.join(cwd, 'alias')) return { isSymbolicLink: () => true };
      return { isSymbolicLink: () => false };
    },
    readlinkSync: () => link,
    realpathSync: (file: string) => file,
    openDirNoFollowSync: () => {},
  });
  let firstLink = 'initial';
  const firstOwner = createPathIdentity({ ie: () => make(first, firstLink), qpt: () => null });
  const secondOwner = createPathIdentity({ ie: () => make(second, 'other'), qpt: () => null });
  assert.deepEqual(firstOwner.di(path.join(first, 'alias', 'file')).spellings,
    [path.join(first, 'alias', 'file'), path.join(first, 'initial', 'file')]);
  assert.deepEqual(secondOwner.di(path.join(second, 'alias', 'file')).spellings,
    [path.join(second, 'alias', 'file'), path.join(second, 'other', 'file')]);
  firstLink = 'changed';
  assert.deepEqual(firstOwner.di(path.join(first, 'alias', 'file')).spellings,
    [path.join(first, 'alias', 'file'), path.join(first, 'changed', 'file')]);
  assert.deepEqual(secondOwner.di(path.join(second, 'alias', 'file')).spellings,
    [path.join(second, 'alias', 'file'), path.join(second, 'other', 'file')]);
});
