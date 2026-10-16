// The recovered-source index: every chunk of the extracted bundle, the statements the product carries
// out of it, and the statements still missing — so the bundle's own layout, not the package layout, is
// what the port is measured against, and a chunk can be reassembled from the copies to prove it.
//
// Usage: node scripts/source-index.mjs [out.json]
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as acorn from 'acorn';

const modulesDirectory = 'extracted-v2/modules';
const out = process.argv[2] ?? 'research/ports/W45-source-index.json';

const statementsOf = (text) => {
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' }); }
  return tree.body;
};
// `var a=1;var b=2;` on one line is two statements, so a statement's unit count is its own span.
const nameOf = (text, node) => {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  if (node.type === 'ClassDeclaration' && node.id) return node.id.name;
  if (node.type === 'VariableDeclaration') {
    return node.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : '?')).join(',');
  }
  if (node.type === 'ExportNamedDeclaration' && node.declaration) return nameOf(text, node.declaration);
  return node.type;
};

const covered = new Map();
for (const file of fs.readdirSync('src').filter((name) => name.endsWith('-source-blocks.json'))) {
  const ledger = JSON.parse(fs.readFileSync(`src/${file}`, 'utf8'));
  for (const block of ledger.blocks) {
    if (!covered.has(block.module)) covered.set(block.module, []);
    covered.get(block.module).push({
      start: block.range[0],
      end: block.range[1],
      product: `src/${file.replace(/-blocks\.json$/, '.ts')}`,
    });
  }
}

const chunks = [];
let portedUnits = 0;
let portedStatements = 0;
let bundleUnits = 0;
let bundleStatements = 0;
for (const name of [...covered.keys()].sort()) {
  const path = `${modulesDirectory}/${name}`;
  if (!fs.existsSync(path)) throw new Error(`${name} is in a ledger but not in ${modulesDirectory}`);
  const text = fs.readFileSync(path, 'utf8');
  const body = statementsOf(text);
  const spans = covered.get(name).sort((a, b) => a.start - b.start);
  // Merge the packages' blocks into the statement slots they cover, so a statement two packages both
  // name (they should not, but a plan can overlap by design) counts once.
  const merged = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  const ported = [];
  const missing = [];
  for (const node of body) {
    const hit = merged.find((span) => node.start >= span.start && node.end <= span.end);
    const record = {
      range: [node.start, node.end],
      units: node.end - node.start,
      name: nameOf(text, node),
    };
    if (hit) ported.push({ ...record, product: hit.product });
    else missing.push(record);
  }
  const portedBytes = ported.reduce((sum, s) => sum + s.units, 0);
  // The reassembly proof: the covered statements' own bytes, in the source's own order, digest to this,
  // so a chunk can be rebuilt from the copies and compared with the module it came out of.
  const digestOf = (parts) => crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex');
  chunks.push({
    module: name,
    bytes: Buffer.byteLength(text, 'utf8'),
    statements: body.length,
    portedStatements: ported.length,
    portedUnits: portedBytes,
    missingStatements: missing.length,
    missingUnits: missing.reduce((sum, s) => sum + s.units, 0),
    sourceSha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    portedSha256: digestOf(ported.map((s) => text.slice(s.range[0], s.range[1]))),
    ported: ported.map((s) => ({ range: s.range, units: s.units, name: s.name, product: s.product })),
    missing: missing.map((s) => ({ range: s.range, units: s.units, name: s.name })),
  });
  portedUnits += portedBytes;
  portedStatements += ported.length;
  bundleUnits += Buffer.byteLength(text, 'utf8');
  bundleStatements += body.length;
}

const bundleFiles = fs.readdirSync(modulesDirectory);
const bundleBytes = bundleFiles.reduce((sum, name) => sum + fs.statSync(`${modulesDirectory}/${name}`).size, 0);
const report = {
  schema: 'W45SourceIndex.v1',
  note: 'Per chunk of the extracted bundle: the statements the product carries (with the copy that carries them) and the statements still missing. `portedSha256` digests the covered statements in the source\'s own order, so reassembling a chunk from the copies is checkable.',
  totals: {
    chunks: chunks.length,
    bytes: bundleUnits,
    statements: bundleStatements,
    portedStatements,
    portedUnits,
    missingStatements: bundleStatements - portedStatements,
    missingUnits: bundleUnits - portedUnits,
    bundleModules: bundleFiles.length,
    bundleBytes,
  },
  chunks,
};
fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
const { totals } = report;
console.log(`${out}: ${totals.chunks} chunks, ${totals.portedStatements}/${totals.statements} statements, ` +
  `${totals.portedUnits}/${totals.bytes} units (${((100 * totals.portedUnits) / totals.bytes).toFixed(1)}%)`);
