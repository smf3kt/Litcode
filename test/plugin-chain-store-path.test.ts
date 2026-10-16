// The `$` store's file layer (W45-48). The copied bodies are src/plugin-chain-store-path-source.ts and
// the seam is src/plugin-chain-store-path.ts; the data directory they build under is the bounded hook
// in src/plugin-chain-store-dir.ts (chunk-s9zkj3fw.js [7352,7440) `bl`, quoted verbatim there). These
// tests bind the naming rule the source spells out — verbatim ids, sanitized-and-hashed ids, the
// Windows device names, `.`/`..`, the 64-character cut and the 12 hash digits — and the three file
// operations: the path, the directory made at 0700, and the touch that logs instead of throwing.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  bindPluginDataDir,
  ensureStoreDir,
  isReservedStoreId,
  isVerbatimStoreId,
  STORE_HASH_HEX_DIGITS,
  STORE_NAME_MAX_CHARS,
  storeDataDir,
  storeFileName,
  storeFilePath,
  touchStoreFile,
} from '../src/plugin-chain-store-path.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-'));
const logs = (): string[] => chainRecords().filter((record) => record.kind === 'log').map((record) => record.message);

after(() => {
  bindPluginDataDir(undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a safe storage id is used verbatim, with the .json suffix', () => {
  assert.equal(storeFileName('hook_agent'), 'hook_agent.json');
  assert.equal(storeFileName('a.b-c_d'), 'a.b-c_d.json');
  assert.equal(storeFileName('0'), '0.json');
  assert.equal(isVerbatimStoreId('hook_agent'), true);
  assert.equal(STORE_NAME_MAX_CHARS, 64);
});

test('anything else is sanitized, cut and hashed — and Windows device names are never verbatim', () => {
  const hashOf = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, STORE_HASH_HEX_DIGITS);
  assert.equal(storeFileName('My Plugin!'), `My_Plugin_-${hashOf('My Plugin!')}.json`);
  assert.equal(storeFileName('a/b'), `a_b-${hashOf('a/b')}.json`);
  assert.equal(storeFileName('UPPER'), `UPPER-${hashOf('UPPER')}.json`);
  assert.equal(storeFileName('.'), `_-${hashOf('.')}.json`, 'a dot is sanitized to one underscore, so the name keeps it');
  assert.equal(storeFileName('..'), `__-${hashOf('..')}.json`, 'and two dots to two');
  assert.equal(storeFileName(''), `plugin-${hashOf('')}.json`, 'an id with nothing to sanitize contributes the literal `plugin`');
  assert.equal(storeFileName('???'), `___-${hashOf('???')}.json`, 'a sanitized character becomes an underscore, and it is kept');
  const long = 'a'.repeat(65);
  assert.equal(storeFileName(long), `${'a'.repeat(64)}-${hashOf(long)}.json`, 'a long id is cut to 64 characters before the dash and the hash');
  const longer = 'c' + 'a'.repeat(80);
  assert.equal(storeFileName(longer), `${'c' + 'a'.repeat(63)}-${hashOf(longer)}.json`);

  assert.equal(isReservedStoreId('con'), true);
  assert.equal(isReservedStoreId('com1'), true);
  assert.equal(isReservedStoreId('LPT9'), true);
  assert.equal(isReservedStoreId('con.txt'), true);
  assert.equal(isReservedStoreId('console'), false);
  assert.equal(isVerbatimStoreId('con'), false, 'a device name is hashed even though it passes the safe-name rule');
  assert.equal(storeFileName('con'), `con-${hashOf('con')}.json`);
});

test('the file path is the data directory, the store subdirectory and the name', () => {
  bindPluginDataDir(() => '/data/plugins');
  try {
    assert.equal(storeDataDir(), '/data/plugins');
    assert.equal(storeFilePath('hook_agent'), path.join('/data/plugins', 'store', 'hook_agent.json'));
    assert.equal(storeFilePath('My Plugin!'), path.join('/data/plugins', 'store', storeFileName('My Plugin!')));
  } finally {
    bindPluginDataDir(undefined);
  }
});

test('with no data directory bound, the boundary refuses instead of guessing a path', () => {
  bindPluginDataDir(undefined);
  assert.throws(() => storeDataDir(), /the plugin data directory is not bound; bindPluginDataDir\(\) installs one/);
  assert.throws(() => storeFilePath('hook_agent'), /the plugin data directory is not bound/);
});

test('ensureStoreDir makes the store directory and answers the file path', async () => {
  bindPluginDataDir(() => root);
  try {
    const file = await ensureStoreDir('hook_agent');
    assert.equal(file, path.join(root, 'store', 'hook_agent.json'));
    assert.equal(fs.statSync(path.join(root, 'store')).isDirectory(), true);
    // A second call is the same path and does not fail on the directory that is already there.
    assert.equal(await ensureStoreDir('hook_agent'), file);
    // The deeper case: the data directory itself need not exist yet.
    const nested = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-parent-'));
    fs.rmdirSync(nested);
    bindPluginDataDir(() => nested);
    const nestedFile = await ensureStoreDir('deep');
    assert.equal(nestedFile, path.join(nested, 'store', 'deep.json'));
    assert.equal(fs.statSync(path.join(nested, 'store')).isDirectory(), true);
    fs.rmSync(nested, { recursive: true, force: true });
  } finally {
    bindPluginDataDir(() => root);
  }
});

test('the touch moves the file\'s times, and a refused touch is logged rather than thrown', async () => {
  bindPluginDataDir(() => root);
  const file = await ensureStoreDir('touch_me');
  fs.writeFileSync(file, '{}', 'utf8');
  const before = fs.statSync(file);
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(file, past, past);
  assert.ok(fs.statSync(file).mtimeMs < before.mtimeMs);

  clearChainRecords();
  await touchStoreFile('touch_me', file);
  assert.ok(fs.statSync(file).mtimeMs > past.getTime(), 'the touch set both times to now');
  assert.deepEqual(logs(), [], 'a touch that worked says nothing');

  // The source warns and answers rather than throwing: a path that cannot be touched at all.
  clearChainRecords();
  await touchStoreFile('touch_me', path.join(root, 'absent', 'file.json'));
  assert.equal(logs().length, 1);
  assert.match(logs()[0], /^\$\.store \(touch_me\): could not touch .*absent\/file\.json: /);
});
