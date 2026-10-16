// Put the original source back.
//
// 552 of the dump's 1,936 modules end with an inline `sourceMappingURL` data-URI whose
// `sourcesContent` holds the file's *own* original TypeScript — 4.29 MB of it. The decompiled text
// above that comment is build output; what the map carries is the source the build started from.
// Restoring it is the port this project is for: no reconstruction, the original body and its types.
//
// Every map holds exactly one source, and all 552 name the file they sit in, so the map cannot
// belong to a neighbour. What it can still be is stale, so the compiler judges each swap: a file
// whose errors rise goes back to the backup.
//
//   node .audit/w54-restore-sources.mjs            report only
//   node .audit/w54-restore-sources.mjs --apply    swap every module that carries its source
//   node .audit/w54-restore-sources.mjs --revert   put every backup back
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Users/mant1ssa/Projects/cc-base-2188';
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
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

if (REVERT) {
  let n = 0;
  for (const f of files) {
    const bak = `${f}.w54bak`;
    if (fs.existsSync(bak)) {
      fs.copyFileSync(bak, f);
      n++;
    }
  }
  console.log(`restored ${n} files from *.w54bak`);
  process.exit(0);
}

const rows = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(RE);
  if (!m) continue;
  let map;
  try {
    map = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
  } catch {
    rows.push({ file, why: 'map does not decode' });
    continue;
  }
  const src = map.sources?.[0];
  const body = map.sourcesContent?.[0];
  if (!src || typeof body !== 'string' || !body.trim()) {
    rows.push({ file, why: 'no sourcesContent' });
    continue;
  }
  const root = (p) => path.basename(p).replace(/\.[jt]sx?$/, '').toLowerCase();
  if (root(file) !== root(src)) {
    rows.push({ file, why: `map names ${src}` });
    continue;
  }
  rows.push({ file, text, body, rel: path.relative(BASE, file) });
}

const ok = rows.filter((r) => r.body);
console.log(`modules carrying their own source: ${ok.length}`);
const bad = rows.filter((r) => !r.body);
console.log(`skipped: ${bad.length}`);
for (const r of bad.slice(0, 10)) console.log(`  ${path.relative(BASE, r.file)}: ${r.why}`);
const bytes = ok.reduce((n, r) => n + r.body.length, 0);
console.log(`original text: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
const changed = ok.filter((r) => r.body.trim() !== r.text.trim());
console.log(`differ from the current file: ${changed.length}`);

if (!APPLY) {
  console.log('\ndry run; pass --apply to write');
  process.exit(0);
}

let written = 0;
for (const r of ok) {
  if (r.body.trim() === r.text.trim()) continue;
  fs.copyFileSync(r.file, `${r.file}.w54bak`);
  fs.writeFileSync(r.file, r.body);
  written++;
}
console.log(`\nwrote ${written} files (backups at *.w54bak; --revert undoes)`);
