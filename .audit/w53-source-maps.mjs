// Census the inline source maps the dump carries.
//
// Every module in the 2.1.88 tree ends with
//   //# sourceMappingURL=data:application/json;charset=utf-8;base64,<...>
// and the map's `sourcesContent` holds the *original* TypeScript for that file — annotations,
// generics, destructured parameters, all of it. The decompiled text above it is the build output.
// So the honest base is the map's content, not a reconstruction of it.
//
//   node .audit/w53-source-maps.mjs            census
//   node .audit/w53-source-maps.mjs --sample   print one decoded map's header
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Users/mant1ssa/Projects/cc-base-2188';
const SKIP = new Set(['node_modules', 'recovered', '.git', 'dist']);
const RE = /\/\/# sourceMappingURL=data:application\/json[^,]*,(.*)$/;

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || /\.w\d+bak$/.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(BASE);

const rows = [];
let withMap = 0;
let withContent = 0;
let contentBytes = 0;
const encodedBytes = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(RE);
  if (!m) continue;
  withMap++;
  let map;
  try {
    map = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
  } catch {
    rows.push([file, 'map does not decode']);
    continue;
  }
  const contents = map.sourcesContent ?? [];
  const src = map.sources ?? [];
  if (!contents.length || contents.every((c) => c == null)) {
    rows.push([file, `no sourcesContent (${src.length} sources)`]);
    continue;
  }
  withContent++;
  const bytes = contents.reduce((n, c) => n + (c ? c.length : 0), 0);
  contentBytes += bytes;
  encodedBytes.push([file, src, contents]);
}

console.log(`modules: ${files.length}`);
console.log(`  with an inline map:      ${withMap}`);
console.log(`  with sourcesContent:     ${withContent}`);
console.log(`  original source carried: ${(contentBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  without usable content:  ${rows.length}`);
for (const [f, why] of rows.slice(0, 10)) console.log(`    ${path.relative(BASE, f)}: ${why}`);
if (rows.length > 10) console.log(`    ... ${rows.length - 10} more`);

// How many sources does a map usually hold, and is the first one this file?
const shapes = new Map();
for (const [file, src, contents] of encodedBytes) {
  const key = `${src.length} source(s)`;
  shapes.set(key, (shapes.get(key) ?? 0) + 1);
}
console.log('\nsources per map');
for (const [k, v] of [...shapes].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${k}: ${v}`);

// Does the map's one source belong to this file? A bundler can emit a chunk's map under another
// name, and a wrong map would replace a module with an unrelated one, so identity is checked before
// anything is written.
const root = (p) => path.basename(p).replace(/\.[jt]sx?$/, '').toLowerCase();
let sameName = 0;
const mismatched = [];
for (const [file, src, contents] of encodedBytes) {
  if (root(file) === root(src[0])) sameName++;
  else mismatched.push([path.relative(BASE, file), src[0], contents[0].length]);
}
console.log(`\nmap source names the file: ${sameName} / ${encodedBytes.length}`);
for (const [f, s, n] of mismatched.slice(0, 10)) console.log(`  ${f}  <-  ${s} (${n} chars)`);
if (mismatched.length > 10) console.log(`  ... ${mismatched.length - 10} more`);

if (process.argv.includes('--sample')) {
  const [file, src, contents] = encodedBytes[0];
  console.log(`\n${path.relative(BASE, file)}`);
  console.log(`  sources: ${JSON.stringify(src)}`);
  console.log(`  first 25 lines of sourcesContent[0]:`);
  console.log(contents[0].split('\n').slice(0, 25).map((l) => `    ${l}`).join('\n'));
}
