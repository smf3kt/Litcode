import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { createReadIdentity } from '../src/path-read-identity-source.js';

const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : process.cwd();

test('read identity keeps source primary and screenshot alternate observations distinct', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'read-identity-')));
  try {
    const original = path.join(root, 'Capture AM.png');
    const alternate = path.join(root, 'Capture AM.png');
    const first = path.join(root, 'first', 'Capture AM.png');
    fs.mkdirSync(path.dirname(first));
    fs.writeFileSync(original, 'original');
    fs.writeFileSync(alternate, 'alternate');
    fs.linkSync(original, first);
    const calls: string[][] = [];
    const identify = async (spellings: string[]) => {
      calls.push([...spellings]);
      for (const file of [...spellings].reverse()) {
        try {
          const stat = fs.statSync(file, { bigint: true });
          if (stat.isFile()) return { dev: stat.dev, ino: stat.ino };
        } catch { /* Try the next saved spelling. */ }
      }
      return null;
    };
    const identity = createReadIdentity(identify);
    const primaryStat = fs.statSync(original, { bigint: true });
    const alternateStat = fs.statSync(alternate, { bigint: true });
    assert.deepEqual(await identity.whn(original, [first, original]), {
      own: { dev: primaryStat.dev, ino: primaryStat.ino },
      alt: { path: alternate, identity: { dev: alternateStat.dev, ino: alternateStat.ino } },
    });
    assert.deepEqual(calls, [[first, original], [path.join(root, 'first', 'Capture AM.png'), alternate]]);
    calls.length = 0;
    const ordinary = path.join(root, 'ordinary.txt');
    assert.deepEqual(await identity.whn(ordinary, [ordinary]), { own: null, alt: undefined });
    assert.deepEqual(calls, [[ordinary]]);
    assert.equal(identity.fXe(path.join(root, 'Capture PM.png')), path.join(root, 'Capture PM.png'));
    assert.equal(identity.fXe(path.join(root, 'Capture AM.PNG')), undefined);
    assert.equal(identity.fXe(path.join(root, 'parent AM.png', 'leaf AM.png')),
      path.join(root, 'parent AM.png', 'leaf AM.png'));
    const noAlternate = createReadIdentity(async (spellings: string[]) =>
      spellings[0] === original ? { dev: primaryStat.dev, ino: primaryStat.ino } : null);
    assert.deepEqual(await noAlternate.whn(original, [original]), {
      own: { dev: primaryStat.dev, ino: primaryStat.ino }, alt: { path: alternate, identity: null },
    });
    const failure = new Error('identity failed');
    const rejected = createReadIdentity(async () => { throw failure; });
    await assert.rejects(rejected.whn(original, [original]), error => error === failure);
    const rejectedAlternate = createReadIdentity(async (spellings: string[]) => {
      if (spellings[0] === original) return { dev: primaryStat.dev, ino: primaryStat.ino };
      throw failure;
    });
    await assert.rejects(rejectedAlternate.whn(original, [original]), error => error === failure);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
