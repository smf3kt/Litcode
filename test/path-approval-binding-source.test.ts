import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createPathApprovalBinding } from '../src/path-approval-binding-source.js';
import { createPathApprovalConsumer } from '../src/path-approval-consumer-source.js';
import { lwe } from '../src/path-approval-decoder-source.js';
import { createPathIdentity } from '../src/path-approval-identity-source.js';
import { Be } from '../src/path-approval-stash-source.js';
import { createPathOpenCapability, createPathOpenPrimitives } from '../src/path-open-primitives-source.js';
import { createReadIdentity } from '../src/path-read-identity-source.js';

const MACOS = process.platform === 'darwin';
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();

async function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'approval-binding-')));
  const target = (name: string) => path.join(root, name);
  try {
    fs.mkdirSync(target('public')); fs.mkdirSync(target('protected'));
    fs.writeFileSync(target('public/file.txt'), 'PUBLIC'); fs.writeFileSync(target('protected/file.txt'), 'PROTECTED');
    fs.symlinkSync('public', target('alias'));
    const api = { cwd: () => root, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
      realpathSync: (file: string) => fs.realpathSync(file).normalize('NFC'),
      openDirNoFollowSync(file: string) {
        const fd = fs.openSync(file, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        fs.closeSync(fd);
      },
      async mkdir(file: string) { await fsp.mkdir(file, { recursive: true }); },
    };
    const identity = createPathIdentity({ ie: () => api, qpt: () => null });
    const ai = 16777216, zut = 536870912, state = { noFollowAny: 'untried' };
    const capability = createPathOpenCapability({ X: fsp.open, m: fs.constants, ai, zut, f: state,
      E: (error: unknown) => error instanceof Error && 'code' in error ? error.code : undefined });
    const opening = createPathOpenPrimitives({ Pe: fsp.open, T: fs.constants, ai, zut, wGn: capability.wGn });
    const binding = createPathApprovalBinding({ ie: () => api, ...identity, O: () => 'macos', ...opening, ai, zut, lwe,
      t: () => {},
    });
    const take = createPathApprovalConsumer(identity._o, () => {});
    const stash = new Be();
    const file = target('alias/file.txt');
    const save = (id: string, lane: 'read' | 'write') => stash.stash(id, file, identity.di(file).spellings, lane);
    const consume = (id: string, lane: 'read' | 'write') =>
      take({ session: { writePermissionStash: stash }, toolUseId: id }, file, lane);
    return { root, target, file, identity, binding, state, capability, save, consume };
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test('source open and pin bind file access to saved link spellings', { skip: !MACOS }, async t => {
  const f = await fixture();
  try {
    if (await f.capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const probe = await f.binding.vpe([f.target('public/file.txt')]);
    assert.ok(probe);
    f.save('read-stable', 'read');
    const read = await f.binding.eMt(f.file, f.consume('read-stable', 'read'), undefined, null);
    try { assert.equal(await read.handle.readFile('utf8'), 'PUBLIC'); } finally { await read.close(); }
    f.save('write-stable', 'write');
    const pin = await f.binding.US(f.file, f.consume('write-stable', 'write'), undefined);
    try {
      assert.deepEqual(await pin.readExisting(undefined), { content: 'PUBLIC', encoding: 'utf8', lineEndings: 'LF' });
      await assert.rejects(pin.readExisting(2), (error: NodeJS.ErrnoException) => error.code === 'ERR_FILE_TOO_LARGE');
      await pin.recheckBeforeWrite();
    } finally { await pin.close(); }
    assert.equal(f.state.noFollowAny, 'works');

    f.save('read-changed', 'read'); f.save('write-changed', 'write');
    fs.unlinkSync(f.target('alias')); fs.symlinkSync('protected', f.target('alias'));
    await assert.rejects(f.binding.eMt(f.file, f.consume('read-changed', 'read'), undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    await assert.rejects(f.binding.US(f.file, f.consume('write-changed', 'write'), undefined),
      (error: Error) => error.name === 'SymlinkWriteRefusedError');
    assert.equal(fs.readFileSync(f.target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');

    const encoded = f.target('public/encoded.txt');
    fs.writeFileSync(encoded, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('first\r\nsecond\r\n', 'utf16le')]));
    const encodedPin = await f.binding.US(encoded, f.identity.di(encoded).spellings, undefined);
    try {
      assert.deepEqual(await encodedPin.readExisting(undefined), { content: '﻿first\nsecond\n', encoding: 'utf16le', lineEndings: 'CRLF' });
    } finally { await encodedPin.close(); }
    const lossy = f.target('public/lossy.txt');
    fs.writeFileSync(lossy, Buffer.from([0x61, 0xff, 0x62]));
    const lossyPin = await f.binding.US(lossy, f.identity.di(lossy).spellings, undefined);
    try {
      assert.deepEqual(await lossyPin.readExisting(undefined), { content: 'a�b', encoding: 'utf8', lineEndings: 'LF', lossyDecode: true });
    } finally { await lossyPin.close(); }

    const newFile = f.target('new/dir/file.txt');
    const approved = f.identity.di(newFile).spellings;
    const created = await f.binding.US(newFile, approved, { createParents: true });
    try {
      assert.equal(await created.readExisting(undefined), null);
      await created.recheckBeforeWrite();
      assert.equal(fs.statSync(f.target('new/dir')).isDirectory(), true);
    } finally { await created.close(); }
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('source read identity fallback reopens an approved path only for the same inode', { skip: !MACOS }, async t => {
  const f = await fixture();
  try {
    if (await f.capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const initial = f.identity.di(f.file);
    const identities = createReadIdentity(f.binding.vpe);
    const { own: checked } = await identities.whn(f.file, initial.spellings);
    assert.ok(checked);
    fs.linkSync(f.target('public/file.txt'), f.target('protected/same.txt'));
    const direct = f.target('file-alias');
    fs.symlinkSync('public/file.txt', direct);
    const saved = f.identity.di(direct).spellings;
    fs.unlinkSync(direct); fs.symlinkSync('protected/same.txt', direct);
    const opened = await f.binding.eMt(direct, saved, undefined, checked);
    try {
      assert.equal(opened.canonicalPath, f.target('public/file.txt'));
      assert.equal(await opened.handle.readFile('utf8'), 'PUBLIC');
    } finally { await opened.close(); }
    const screenshot = f.target('public/Capture AM.png');
    const alternateScreenshot = f.target('public/Capture AM.png');
    fs.writeFileSync(screenshot, 'ORDINARY');
    fs.writeFileSync(alternateScreenshot, 'ALTERNATE');
    const screenshotNames = await identities.whn(screenshot, f.identity.di(screenshot).spellings);
    assert.ok(screenshotNames.alt);
    assert.equal(screenshotNames.alt.path, alternateScreenshot);
    assert.ok(screenshotNames.own);
    assert.ok(screenshotNames.alt.identity);
    assert.notDeepEqual(screenshotNames.own, screenshotNames.alt.identity);
    const alternateSpellings = identities.vhn(f.identity.di(screenshot).spellings, alternateScreenshot);
    const alternateRead = await f.binding.eMt(alternateScreenshot, alternateSpellings, undefined, screenshotNames.alt.identity);
    try { assert.equal(await alternateRead.handle.readFile('utf8'), 'ALTERNATE'); } finally { await alternateRead.close(); }
    fs.renameSync(alternateScreenshot, `${alternateScreenshot}.moved`);
    fs.symlinkSync('Capture AM.png', alternateScreenshot);
    await assert.rejects(f.binding.eMt(alternateScreenshot, alternateSpellings, undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    await assert.rejects(f.binding.eMt(direct, saved, undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    fs.unlinkSync(direct); fs.symlinkSync('protected/file.txt', direct);
    await assert.rejects(f.binding.eMt(direct, saved, undefined, checked),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    assert.equal(fs.readFileSync(f.target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
