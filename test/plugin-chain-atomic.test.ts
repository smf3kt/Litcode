// The atomic file writer the plugin store publishes through (W45-50). The copied bodies are
// src/plugin-chain-atomic-source.ts — the writer's closure from chunk-1t033v1j.js plus the
// telemetry-safe error the in-place refusal is raised in — and the seam is src/plugin-chain-atomic.ts.
// These tests call the seam the way the store does (`vn(file, text, 0o600)`) and assert the behaviour
// the source really has: the target is never touched until the staged file is published, the temp is
// cleaned up on every path, the publish is a rename, a non-retryable failure publishes nothing, a
// cross-device rename falls back to the in-place arm, and the in-place arm is what a refused temp
// creation falls back to when it is allowed.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { writeFileAtomically, writeFileWithAtomicOptions } from '../src/plugin-chain-atomic.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-atomic-'));
const entries = (of = root): string[] => fs.readdirSync(of).sort();

after(() => fs.rmSync(root, { recursive: true, force: true }));

test('the publish leaves the file and nothing else', async () => {
  const file = path.join(root, 'fresh.json');
  assert.equal(await writeFileAtomically(file, '{"a":1}\n', 0o600), undefined);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"a":1}\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(entries(), ['fresh.json'], 'the staged file is gone once it is published');

  await writeFileAtomically(file, '{"a":2}\n', 0o600);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"a":2}\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'the mode the call names is the mode it leaves');
  assert.deepEqual(entries(), ['fresh.json']);
});

test('without a mode the file is created with the platform default', async () => {
  const file = path.join(root, 'default.json');
  await writeFileAtomically(file, 'plain\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'plain\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);
});

test('exactMode fixes the mode through the handle, and flush syncs what it wrote', async () => {
  const file = path.join(root, 'exact.json');
  fs.writeFileSync(file, 'old\n', { mode: 0o644 });
  await writeFileWithAtomicOptions(file, 'new\n', { exactMode: 0o600, flush: true });
  assert.equal(fs.readFileSync(file, 'utf8'), 'new\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(entries().some((name) => name.includes('.tmp.')), false, 'the handle path cleans up too');
});

test('a refused publish raises the source\'s own error and leaves nothing behind', async () => {
  const existing = path.join(root, 'refused.json');
  fs.writeFileSync(existing, 'kept\n');
  await assert.rejects(writeFileWithAtomicOptions(existing, 'nope\n', { beforePublish: () => false }), (error: Error) => {
    assert.equal(error.name, 'PublishRefusedError');
    assert.equal(error.message, 'beforePublish refused the write; nothing was published');
    return true;
  });
  assert.equal(fs.readFileSync(existing, 'utf8'), 'kept\n', 'the file that was there is untouched');
  assert.equal(entries().some((name) => name.includes('.tmp.')), false, 'and no staged file is left');

  const absent = path.join(root, 'refused-new.json');
  await assert.rejects(writeFileWithAtomicOptions(absent, 'nope\n', { beforePublish: () => false }));
  assert.equal(fs.existsSync(absent), false, 'a refused write does not create the file either');
});

test('the staged file lives in the staging directory when there is one', async () => {
  const staging = path.join(root, 'staging');
  fs.mkdirSync(staging);
  const file = path.join(root, 'staged.json');
  await writeFileWithAtomicOptions(file, 'staged\n', { stagingDir: staging });
  assert.equal(fs.readFileSync(file, 'utf8'), 'staged\n');
  assert.deepEqual(fs.readdirSync(staging), [], 'the staged file left the staging directory with the publish');

  // A staging directory that is not there is not an error: the entry answers the target's own
  // directory, and the write goes through as usual.
  await writeFileWithAtomicOptions(file, 'again\n', { stagingDir: path.join(root, 'no-such-dir') });
  assert.equal(fs.readFileSync(file, 'utf8'), 'again\n');
});

test('a rename that fails without a retryable code publishes nothing', async () => {
  const file = path.join(root, 'never.json');
  let attempts = 0;
  await assert.rejects(writeFileWithAtomicOptions(file, 'x\n', {
    renameFn: async () => { attempts += 1; throw Object.assign(new Error('io'), { code: 'EIO' }); },
  }), (error: NodeJS.ErrnoException) => error.code === 'EIO');
  assert.equal(attempts, 1, 'this build\'s retry helper answers false, so the rename is attempted once');
  assert.equal(fs.existsSync(file), false);
  assert.equal(entries().some((name) => name.startsWith('never.json.tmp.')), false, 'the staged file was cleaned up');
});

test('a cross-device rename falls back to the in-place arm and still writes the file', async () => {
  const file = path.join(root, 'in-place.json');
  fs.writeFileSync(file, 'before\n');
  let renames = 0;
  await writeFileWithAtomicOptions(file, 'after\n', {
    renameFn: async () => { renames += 1; throw Object.assign(new Error('cross-device'), { code: 'EXDEV' }); },
  });
  assert.equal(renames, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'after\n', 'the in-place arm wrote the target the rename could not publish');
});

test('the publish is a rename, so a symlink target is replaced rather than followed', async () => {
  const real = path.join(root, 'real.json');
  const link = path.join(root, 'link.json');
  fs.writeFileSync(real, 'real\n');
  fs.symlinkSync(real, link);
  await writeFileAtomically(link, 'through\n');
  assert.equal(fs.lstatSync(link).isSymbolicLink(), false, 'the link itself was replaced by the published file');
  assert.equal(fs.readFileSync(link, 'utf8'), 'through\n');
  assert.equal(fs.readFileSync(real, 'utf8'), 'real\n', 'the file it pointed at is not what was written');
});

test('a refused staging write falls back to the in-place arm only when it is allowed to', async () => {
  const locked = path.join(root, 'read-only');
  fs.mkdirSync(locked);
  const file = path.join(locked, 'inside.json');
  fs.writeFileSync(file, 'before\n');
  fs.chmodSync(locked, 0o500);
  try {
    await assert.rejects(writeFileAtomically(file, 'after\n'), (error: NodeJS.ErrnoException) => error.code === 'EACCES');
    assert.equal(fs.readFileSync(file, 'utf8'), 'before\n', 'nothing was written when the staged file could not be created');

    await writeFileWithAtomicOptions(file, 'in-place\n', { inPlaceOnTempCreateRefused: true });
    assert.equal(fs.readFileSync(file, 'utf8'), 'in-place\n', 'the allowed fallback rewrote the target where it lies');
    assert.deepEqual(fs.readdirSync(locked), ['inside.json']);
  } finally {
    fs.chmodSync(locked, 0o700);
  }
});
