// Restore the W45-70 C-12 row that the W45-71 record script overwrote before its insert was fixed.
// The prose is the literal from .audit/w45-70-records.mjs, taken from the file rather than retyped, and
// the values it interpolates are the ones that package's own verification row recorded
// (.audit/w45-runtime.tsv, 2026-10-17T14:04:00Z): 70 plans, seam sweep 76/76, family 471/471, full
// 1747/1747, 15 drivers with 44 shared markers and 55 in all, smoke 315 files, identity 5d38f513.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);

const source = read('.audit/w45-70-records.mjs');
const literal = source.match(/const row = `([\s\S]*?)`;\nconst anchor/);
if (!literal) throw new Error('the W45-70 row literal was not found in its record script');

const values = {
  chain: 'passed true, 70 plans',
  seamSweep: { passed: 76, tests: 76 },
  family: { passed: 471, tests: 471 },
  fullLine: '1747 tests / 1747 pass / 0 fail on the frozen tree',
  drivers: { length: 15 },
  sharedMarkers: { length: 44 },
  allMarkers: 55,
  smoke: 'pack 315 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0',
  short: '5d38f513',
  identity: { inputs: { files: 444 }, validation: { files: 166 }, build: { files: 307 } },
};
const row = new Function(...Object.keys(values), `return \`${literal[1]}\`;`)(...Object.values(values));
if (!row.startsWith('| C-12 |') || !row.includes('W45-70 **收口')) throw new Error('the restored row is not the W45-70 row');
if (row.includes('${')) throw new Error('the restored row still carries an interpolation');

const current = read('research/CURRENT.md');
if (current.includes('W45-70 **收口')) {
  console.log('the W45-70 row is already in CURRENT.md; nothing to do');
} else {
  const lines = current.split('\n');
  const own = lines.findIndex((line) => line.startsWith('| C-12 |') && line.includes('W45-71 **收口'));
  if (own < 0) throw new Error('the W45-71 row is not in CURRENT.md, so the restored row has no place to go');
  lines.splice(own + 1, 0, row);
  write('research/CURRENT.md', lines.join('\n'));
  console.log('restored the W45-70 C-12 row directly below the W45-71 row');
}

const ids = read('research/CURRENT.md').split('\n').filter((line) => line.startsWith('| C-12 |'))
  .map((line) => (line.match(/W45-\d+/) ?? ['?'])[0]);
const order = ids.slice(0, 4).join(' ');
console.log(`C-12 rows ${ids.length}, distinct ${new Set(ids).size}, head: ${order}`);
if (!order.startsWith('W45-71 W45-70 W45-69')) throw new Error('the C-12 rows are out of order');
if (!ids.includes('W45-70')) throw new Error('W45-70 is still missing');
