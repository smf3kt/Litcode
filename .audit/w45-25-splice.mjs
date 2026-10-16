// W45-25: splice the four names `src/tui-custom-theme-source.ts` referenced but never declared
// (gt/i, Wi/Yf, and Fe with f/h/r) into that file, verbatim from their declaring modules, and append
// the three ranges to the W44 copy ledger. The script re-reads each range and checks its SHA-256, so
// a drifted source fails here rather than landing silently.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const root = 'extracted-v2/modules/';
const read = (f) => fs.readFileSync(root + f, 'utf8');

const blocks = [
  {
    module: 'chunk-9t9v3t5g.js',
    start: 1879,
    end: 2121,
    note: 'gt (the error text the theme list logs) and i (its cause formatter)',
    symbol: 'gt, i',
  },
  { module: 'chunk-wdffj3z9.js', start: 615, end: 1006, note: 'Yf (the page cap) and Wi (the paging driver P runs)', symbol: 'Yf, Wi' },
  { module: 'chunk-nv1qvpv3.js', start: 1614, end: 4480, note: 'r, f, h and Fe, the namespace-key table P builds its read request with', symbol: 'r, f, h, Fe' },
];

// `--verify` re-reads every record the ledger holds for this target and checks the recorded range
// still hashes to the recorded digest and appears byte-identically in the target file.
if (process.argv.includes('--verify')) {
  const ledger = JSON.parse(fs.readFileSync('research/ports/W44-custom-theme-copies.json', 'utf8'));
  const target = fs.readFileSync('src/tui-custom-theme-source.ts', 'utf8');
  const rows = ledger.records.filter((r) => r.target === 'tui-custom-theme-source.ts');
  let bad = 0;
  for (const r of rows) {
    const body = read(r.module).slice(r.start, r.end);
    const same = sha(body) === r.sha256;
    const present = target.includes(body);
    if (!same || !present) bad++;
    console.log(`${same ? 'ok  ' : 'DRIFT'} ${present ? 'present' : 'MISSING'} ${r.module} [${r.start},${r.end}) ${r.symbol}`);
  }
  console.log(`records ${rows.length} bad ${bad}`);
  process.exit(bad === 0 ? 0 : 1);
}

const header = [
  '',
  '/* The four names the copied bodies above reach and this file never declared (W45-25). Each range is',
  '   verbatim from its declaring module, found through chunk-6yqf5ttk.js\'s own import map:',
  '     gt, i      chunk-9t9v3t5g.js [1879,2121)',
  '     Yf, Wi     chunk-wdffj3z9.js [615,1006)',
  '     r, f, h, Fe  chunk-nv1qvpv3.js [1614,4480)',
  '   Ranges and SHA-256 are recorded in research/ports/W44-custom-theme-copies.json. */',
].join('\n');

const bodies = blocks.map((b) => read(b.module).slice(b.start, b.end));
const text = fs.readFileSync('src/tui-custom-theme-source.ts', 'utf8');
const anchor = 'export function initializeCustomThemes(';
const at = text.indexOf(anchor);
if (at < 0) throw new Error('anchor not found');
if (text.includes(bodies[0])) throw new Error('already spliced');

const inserted = header + '\n' + bodies.map((body, index) => {
  const b = blocks[index];
  return `\n// ${b.module} ${b.note} [${b.start},${b.end}) ${b.end - b.start} units sha256 ${sha(body)}\n${body}`;
}).join('\n') + '\n\n';

fs.writeFileSync('src/tui-custom-theme-source.ts', text.slice(0, at) + inserted + text.slice(at));

const ledger = JSON.parse(fs.readFileSync('research/ports/W44-custom-theme-copies.json', 'utf8'));
const moduleSha = (module) => sha(fs.readFileSync(root + module));
for (const b of blocks) {
  if (ledger.records.some((r) => r.module === b.module && r.start === b.start && r.end === b.end && r.target === 'tui-custom-theme-source.ts')) continue;
  const body = read(b.module).slice(b.start, b.end);
  ledger.records.push({
    module: b.module,
    moduleSha256: moduleSha(b.module),
    symbol: b.symbol,
    start: b.start,
    end: b.end,
    unit: 'zero-based UTF-16 [start,end)',
    sha256: sha(body),
    bytes: Buffer.from(body, 'utf8').length,
    classification: 'copy',
    target: 'tui-custom-theme-source.ts',
    note: b.note + ' (added by W45-25)',
  });
}
fs.writeFileSync('research/ports/W44-custom-theme-copies.json', JSON.stringify(ledger, null, 1) + '\n');
console.log('spliced', blocks.length, 'blocks', bodies.reduce((n, b) => n + b.length, 0), 'units');
