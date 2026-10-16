// Compare two tsc logs file by file.
//
// Totals hide regressions: a pass that clears 20 errors and opens 1 in a file it also touched is
// a pass that broke something, and the total alone cannot tell. This prints the files that got
// worse, the files that got better, the code counts, and the files touched by neither.
//
//   node .audit/tsc-diff.mjs <before.log> <after.log> [--top N]
import fs from 'node:fs';

const [before, after] = process.argv.slice(2);
const top = Number((process.argv.find((a) => a.startsWith('--top')) || '--top=20').split('=')[1] || 20);

const count = (log) => {
  const per = new Map();
  const codes = new Map();
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+):/);
    if (!m) continue;
    per.set(m[1], (per.get(m[1]) || 0) + 1);
    codes.set(m[4], (codes.get(m[4]) || 0) + 1);
  }
  return { per, codes };
};

const a = count(before);
const b = count(after);
const sum = (per) => [...per.values()].reduce((x, y) => x + y, 0);

const files = new Set([...a.per.keys(), ...b.per.keys()]);
const worse = [];
const better = [];
for (const f of files) {
  const d = (b.per.get(f) || 0) - (a.per.get(f) || 0);
  if (d > 0) worse.push([d, f, a.per.get(f) || 0, b.per.get(f) || 0]);
  else if (d < 0) better.push([d, f, a.per.get(f) || 0, b.per.get(f) || 0]);
}
worse.sort((x, y) => y[0] - x[0]);
better.sort((x, y) => x[0] - y[0]);

console.log(`errors  ${sum(a.per)} -> ${sum(b.per)}  (${sum(b.per) - sum(a.per)})`);
console.log(`files   ${a.per.size} -> ${b.per.size}`);
const codes = new Set([...a.codes.keys(), ...b.codes.keys()]);
console.log('\nby code');
for (const c of [...codes].sort()) {
  const x = a.codes.get(c) || 0;
  const y = b.codes.get(c) || 0;
  if (x !== y) console.log(`  ${c}  ${x} -> ${y}  (${y - x > 0 ? '+' : ''}${y - x})`);
}
console.log(`\nworse: ${worse.length}`);
for (const [d, f, x, y] of worse.slice(0, top)) console.log(`  +${d}  ${f}  ${x} -> ${y}`);
console.log(`\nbetter: ${better.length}`);
for (const [d, f, x, y] of better.slice(0, top)) console.log(`  ${d}  ${f}  ${x} -> ${y}`);
if (worse.length > top) console.log(`  ... ${worse.length - top} more worse`);
if (better.length > top) console.log(`  ... ${better.length - top} more better`);
