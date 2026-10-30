import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createPathOpenCapability, createPathOpenPrimitives } from '../src/path-open-primitives-source.js';

test('source macOS open detects a transient symlink ancestor', { skip: process.platform !== 'darwin' }, async t => {
  const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'open-primitives-')));
  const directory = path.join(root, 'public'), parked = path.join(root, 'parked');
  const file = path.join(directory, 'file.txt'), other = path.join(root, 'protected');
  let swapped = false;
  try {
    fs.mkdirSync(directory); fs.mkdirSync(other);
    fs.writeFileSync(file, 'PUBLIC_FIXTURE');
    fs.writeFileSync(path.join(other, 'file.txt'), 'PROTECTED_FIXTURE');
    const state = { noFollowAny: 'untried' }, ai = 16777216, zut = 536870912;
    const capability = createPathOpenCapability({ X: fsp.open, m: fs.constants, ai, zut, f: state,
      E: (error: unknown) => error instanceof Error && 'code' in error ? error.code : undefined });
    if (await capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const primitive = createPathOpenPrimitives({ Pe: fsp.open, T: fs.constants, ai, zut, wGn: capability.wGn });
    const stable = await primitive.QHt(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW, 'macos', true, undefined);
    try { assert.equal(await stable.readFile('utf8'), 'PUBLIC_FIXTURE'); } finally { await stable.close(); }
    fs.renameSync(directory, parked);
    fs.symlinkSync('protected', directory);
    swapped = true;
    await assert.rejects(primitive.QHt(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW, 'macos', true, undefined),
      (error: NodeJS.ErrnoException) => error.code === 'ELOOP');
    fs.unlinkSync(directory);
    fs.renameSync(parked, directory);
    swapped = false;
    assert.equal(fs.readFileSync(file, 'utf8'), 'PUBLIC_FIXTURE');
    assert.equal(fs.readFileSync(path.join(other, 'file.txt'), 'utf8'), 'PROTECTED_FIXTURE');
  } finally {
    if (swapped) { fs.unlinkSync(directory); fs.renameSync(parked, directory); }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
