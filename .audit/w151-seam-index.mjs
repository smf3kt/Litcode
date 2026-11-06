// Indexes product seam block ledgers by source module/range and lists each seam's exported names,
// so an unresolved probe name can be matched to a body already ported into the product.
import fs from 'node:fs';
import path from 'node:path';

const srcDir = 'src';
const ledgers = fs.readdirSync(srcDir).filter((n) => n.endsWith('-blocks.json'));
const seams = [];
for (const name of ledgers) {
  const seam = name.replace(/-blocks\.json$/, '.ts');
  const seamPath = path.join(srcDir, seam);
  if (!fs.existsSync(seamPath)) continue;
  const text = fs.readFileSync(seamPath, 'utf8');
  const exports = new Set();
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop();
      if (n) exports.add(n);
    }
  }
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) exports.add(m[1]);
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(path.join(srcDir, name), 'utf8')); } catch { continue; }
  for (const b of ledger.blocks ?? []) seams.push({ seam, module: b.module, start: b.range[0], end: b.range[1], exports });
}

export function match(module, start, end) {
  return seams.filter((s) => s.module === module && s.start <= start && s.end >= end);
}

if (process.argv[2]) {
  const rows = process.argv.slice(2);
  for (const row of rows) {
    const [name, module, start, end] = row.split(':');
    const hits = match(module, Number(start), Number(end));
    const owning = hits.filter((h) => h.exports.has(name)).map((h) => h.seam);
    const covering = hits.map((h) => `${h.seam}[${h.start},${h.end})`);
    console.log(`${name}\t${owning.length ? 'EXPORTED:' + [...new Set(owning)].join(',') : 'NOT-EXPORTED'}\t${covering.join(' ') || 'NO-BLOCK'}`);
  }
}
