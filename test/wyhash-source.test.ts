import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { sourceBunHashString, sourceWyhash } from '../src/wyhash-source.js';

test('Wyhash agrees with the local Bun runtime across lengths and seeds', (t) => {
  const bun = process.env.BUN_ORACLE ?? '/Users/mant1ssa/.cache/magpie/bun/1.4.4/magpie-bun';
  if (!existsSync(bun)) return t.skip('Bun oracle is not installed');
  const lengths = [0, 1, 2, 3, 4, 7, 8, 15, 16, 17, 31, 32, 47, 48, 49, 63, 64, 95, 96, 97, 255, 1024, 65536];
  const cases = lengths.flatMap(length => [0, 1, 4294967295].map(seed => ({
    hex: Buffer.from(Array.from({ length }, (_, i) => (i * 37 + length) % 256)).toString('hex'), seed,
  })));
  const strings = ['', 'abc', '中文', '😀', '\ud800', 'a\r\nb'];
  const script = `let s=""; for await (const c of Bun.stdin.stream()) s+=new TextDecoder().decode(c); const x=JSON.parse(s); console.log(JSON.stringify({bytes:x.cases.map(v=>Bun.hash.wyhash(Buffer.from(v.hex,"hex"),BigInt(v.seed)).toString()),strings:x.strings.map(v=>Bun.hash(v).toString(36))}));`;
  const run = spawnSync(bun, ['-e', script], { input: JSON.stringify({ cases, strings }), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const actual: { bytes: string[]; strings: string[] } = JSON.parse(run.stdout);
  assert.deepEqual(cases.map(v => sourceWyhash(Buffer.from(v.hex, 'hex'), BigInt(v.seed)).toString()), actual.bytes);
  assert.deepEqual(strings.map(sourceBunHashString), actual.strings);
});
