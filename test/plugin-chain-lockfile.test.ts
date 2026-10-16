// The lockfile library the plugin store acquires through (W45-49). The copied bodies are
// src/plugin-chain-lockfile-source.ts — the whole closure of chunk-c6qwr3kc.js, the vendored
// graceful-fs, retry and signal-exit included — and the seam is src/plugin-chain-lockfile.ts, whose
// `Le` (the bundle's own require) is bound in src/plugin-chain-bundle-require.ts. These tests call the
// seam the way the store will and assert what the library really does: the lock is a directory beside
// the file, the handle is the release itself with `Symbol.asyncDispose` attached, a live lock is not
// stolen, a stale one is taken over, and a release that has nothing to remove is logged rather than
// thrown.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  acquirePluginStoreLock,
  checkPluginStoreLock,
  releasePluginStoreLock,
} from '../src/plugin-chain-lockfile.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-lockfile-'));
const logs = (): string[] =>
  chainRecords().filter((record) => record.kind === 'log').map((record) => `${record.level}: ${record.message}`);

/** A file the lock can sit beside — the library stats it before it takes anything. */
const fileWith = (name: string): string => {
  const file = path.join(root, name);
  fs.writeFileSync(file, '{}', 'utf8');
  return file;
};

after(() => fs.rmSync(root, { recursive: true, force: true }));

test('an acquisition answers the release itself, and the lock is a directory beside the file', async () => {
  const file = fileWith('roundtrip.json');
  assert.equal(fs.existsSync(`${file}.lock`), false);

  const handle = await acquirePluginStoreLock(file);
  assert.equal(typeof handle, 'function', 'the handle is the release the library answers with');
  assert.equal(handle[Symbol.asyncDispose], handle, 'and the disposer `Wa` attaches is that same handle');
  assert.equal(fs.statSync(`${file}.lock`).isDirectory(), true, 'the lock is a directory beside the file');
  assert.equal(await checkPluginStoreLock(file), true);

  assert.equal(await handle(), undefined);
  assert.equal(fs.existsSync(`${file}.lock`), false);
  assert.equal(await checkPluginStoreLock(file), false);
});

test('a held lock is not stolen, and a waiter wins when the holder releases inside its retry window', async () => {
  const file = fileWith('contended.json');
  const holder = await acquirePluginStoreLock(file);

  // No retries by default, so the attempt fails with the library's own refusal.
  await assert.rejects(acquirePluginStoreLock(file), (error: NodeJS.ErrnoException) => {
    assert.equal(error.code, 'ELOCKED');
    assert.equal(error.message, 'Lock file is already being held');
    return true;
  });

  // The retry schedule is what makes a waiter win: it is still waiting when the holder lets go.
  const waiting = acquirePluginStoreLock(file, { retries: { retries: 50, minTimeout: 20, maxTimeout: 20 } });
  await new Promise((resolve) => setTimeout(resolve, 60));
  await holder();
  const waiter = await waiting;
  assert.equal(await checkPluginStoreLock(file), true, 'the waiter holds the lock the holder gave up');

  await releasePluginStoreLock(waiter, 'waiter');
  assert.equal(fs.existsSync(`${file}.lock`), false);
});

test('release never throws: a second release warns with the source\'s own text, and no handle is a no-op', async () => {
  const file = fileWith('released.json');
  const handle = await acquirePluginStoreLock(file);

  clearChainRecords();
  assert.equal(await releasePluginStoreLock(handle, 'store'), undefined);
  assert.equal(logs().length, 0, 'a release that removed the lock says nothing');

  await releasePluginStoreLock(handle, 'store');
  assert.deepEqual(logs(), [
    'warn: store: lock was no longer held at release (ERELEASED); the locked section may have run without exclusivity',
  ]);

  clearChainRecords();
  assert.equal(await releasePluginStoreLock(undefined, 'store'), undefined);
  assert.deepEqual(logs(), [], 'there is nothing to log when there was no handle at all');
});

test('a lock has to sit beside a file that exists', async () => {
  const absent = path.join(root, 'absent.json');
  await assert.rejects(acquirePluginStoreLock(absent), (error: NodeJS.ErrnoException) => {
    assert.equal(error.code, 'ENOENT');
    return true;
  });
  await assert.rejects(checkPluginStoreLock(absent), (error: NodeJS.ErrnoException) => {
    assert.equal(error.code, 'ENOENT');
    return true;
  });
});

test('a stale lock is taken over, and the holder it displaced can still release without throwing', async () => {
  const file = fileWith('stale.json');
  const holder = await acquirePluginStoreLock(file, { stale: 2000, update: 60_000 });
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(`${file}.lock`, past, past);

  const taker = await acquirePluginStoreLock(file, { stale: 2000 });
  assert.equal(await checkPluginStoreLock(file), true, 'the taker holds the lock the stale holder left');

  clearChainRecords();
  await releasePluginStoreLock(holder, 'displaced');
  assert.deepEqual(logs(), [], 'the displaced holder releases without a word');
  // Measured: the release removes the lock path it finds, so the taker's lock goes with it. That is the
  // library's own behaviour and the reason the store treats a stale takeover as a lost section.
  assert.equal(fs.existsSync(`${file}.lock`), false);
  assert.equal(await checkPluginStoreLock(file), false);

  await releasePluginStoreLock(taker, 'taker');
  assert.equal(fs.existsSync(`${file}.lock`), false);
});

test('the release wrapper describes whatever it is handed', async () => {
  clearChainRecords();
  await releasePluginStoreLock((async () => {
    throw Object.assign(new Error('boom'), { code: 'EACCES' });
  }) as never, 'custom');
  assert.deepEqual(logs(), ['warn: custom: lock directory could not be removed and is left to go stale: boom']);

  clearChainRecords();
  await releasePluginStoreLock((async () => {
    throw { get code() { throw new Error('unreadable'); } };
  }) as never, 'custom');
  assert.deepEqual(logs(), ['warn: custom: lock release rejected with a value that cannot be described']);

  clearChainRecords();
  await releasePluginStoreLock((async () => { throw 'a bare string'; }) as never, 'custom');
  assert.deepEqual(logs(), ['warn: custom: lock directory could not be removed and is left to go stale: a bare string']);
});
