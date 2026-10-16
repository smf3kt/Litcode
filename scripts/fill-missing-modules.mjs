// Fill the modules the 2.1.88 dump omits from the 2.1.296 recovered tree.
//
//   node .audit/w47-fill-missing.mjs --tsc /tmp/cc-spike-tsc3.txt [--apply]
//
// The two artifacts do not share path names: the dump carries the original names, the recovered
// tree carries the decompiler's chunk names. They do share *export names*, which is what an import
// site needs, so a recovered chunk is matched by the set of names its importers ask for, with the
// module's own path tokens used as a tie-break. A fill is a re-export into the recovered chunk, so
// the body stays the shipped build's code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const acorn = require_('acorn');

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const RECOVERED = path.resolve('recovered');
const TSC_LOG = process.argv[process.argv.indexOf('--tsc') + 1] ?? '/tmp/cc-spike-tsc3.txt';
const APPLY = process.argv.includes('--apply');

const parse = (text) => acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true });

/* ---------------------------------------------------------------- the gap: what the dump omits */

// A specifier with a non-code extension is a bundler text/binary load, not a module: it is answered
// by a wildcard declaration and the asset itself, not by a re-export from code.
const isAsset = (specifier) => /\.[a-z0-9]+$/i.test(specifier) && !/\.(js|ts|json|node)$/i.test(specifier);

const wants = new Map();   // absolute target -> { specifier, importers: Map<file, Set<name>>, namespace:Set<file> }
const assetGaps = new Map();
for (const line of fs.readFileSync(TSC_LOG, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(].*?)\(\d+,\d+\): error TS2307: Cannot find module '([^']+)'/);
  if (!m) continue;
  const [, importer, specifier] = m;
  if (!specifier.startsWith('.') && !specifier.startsWith('src/')) continue;
  if (isAsset(specifier)) {
    const ext = specifier.slice(specifier.lastIndexOf('.'));
    if (!assetGaps.has(ext)) assetGaps.set(ext, { ext, count: 0, specifiers: new Set(), importers: new Set() });
    const gap = assetGaps.get(ext);
    gap.count++;
    gap.specifiers.add(specifier);
    gap.importers.add(importer);
    continue;
  }
  const target = path.resolve(HARNESS, path.dirname(importer), specifier).replace(/\.js$/, '.ts');
  if (!wants.has(target)) wants.set(target, { specifier, importers: new Map(), names: new Set(), starFiles: new Set() });
  wants.get(target).names.add(null); // placeholder so the entry exists before names are read
  wants.get(target).importers.set(importer, null);
}

// Read the importers so each gap carries the names its import sites ask for. Text rather than a
// parse: importers include .tsx files, and only the clause in front of the specifier matters.
const clauseBefore = (text, at) => {
  // Anchor on the statement that owns the specifier. A wide window walked back into whatever
  // statement came earlier and produced names like "async function call(".
  const head = text.slice(Math.max(0, at - 500), at);
  const keyword = /(?:^|[\n;}])\s*(import|export)\b/g;
  let last = null, m;
  while ((m = keyword.exec(head)) !== null) last = m;
  return last === null ? '' : head.slice(last.index + last[0].length);
};
// The gated form `feature('X') ? (require('./y.js')).Y : null` names the export after the specifier,
// and that is how most of these modules are reached.
const namesAfter = (text, at) => {
  const tail = text.slice(at, at + 260);
  const out = [];
  const member = tail.match(/\)\s*\.\s*([A-Za-z_$][\w$]*)/);
  if (member) out.push({ name: member[1], namespace: false });
  const destructured = tail.match(/^\s*\)\s*\)\s*:\s*\(?\s*\{([^}]*)\}/);
  if (destructured) {
    for (const part of destructured[1].split(',')) {
      const name = part.trim().split(/\s*:\s*/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) out.push({ name, namespace: false });
    }
  }
  return out;
};
const clauseNames = (clause) => {
  const out = [];
  let body = clause.trim().replace(/^type\s+/, '');
  if (body.startsWith('*')) { out.push({ name: '*', namespace: true }); return out; }
  if (body.startsWith('{')) body = body.slice(1, body.indexOf('}') < 0 ? undefined : body.indexOf('}'));
  for (const raw of body.split(',')) {
    const part = raw.trim().replace(/^type\s+/, '');
    if (part === '') continue;
    if (/^\*\s+as\s+/.test(part)) { out.push({ name: '*', namespace: true }); continue; }
    const named = part.split(/\s+as\s+/)[0].trim();
    // Require patterns reach the same specifier, so a clause read backwards out of code can carry
    // fragments; only identifiers are names.
    if (!/^[A-Za-z_$][\w$]*$/.test(named)) continue;
    out.push({ name: named, namespace: false });
  }
  if (out.length === 0 && /^[\w$]/.test(body)) out.push({ name: 'default', namespace: false });
  return out;
};

for (const entry of wants.values()) {
  for (const importer of [...entry.importers.keys()]) {
    const text = fs.readFileSync(path.join(HARNESS, importer), 'utf8');
    const names = new Set();
    for (const quote of ["'", '"']) {
      const needle = `${quote}${entry.specifier}${quote}`;
      let at = text.indexOf(needle);
      while (at >= 0) {
        for (const { name, namespace } of [...clauseNames(clauseBefore(text, at)), ...namesAfter(text, at + needle.length)]) {
          if (namespace) entry.starFiles.add(importer);
          else names.add(name);
        }
        at = text.indexOf(needle, at + 1);
      }
    }
    entry.importers.set(importer, names);
    for (const n of names) entry.names.add(n);
  }
  entry.names.delete(null);
}

/* ---------------------------------------------------------------- the source: the recovered tree */

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'assets' || e.name === 'index.json' || e.name === 'provenance.json') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
};

const index = [];
for (const file of walk(RECOVERED).sort()) {
  const text = fs.readFileSync(file, 'utf8');
  let tree;
  try { tree = parse(text); } catch { index.push({ file, exports: new Set(), literals: new Set(), parseError: true }); continue; }
  const exports = new Set();
  const literals = new Set();
  let star = false;
  for (const node of tree.body) {
    if (node.type === 'ExportNamedDeclaration') {
      for (const s of node.specifiers ?? []) {
        const name = s.exported?.name ?? s.exported?.value;
        if (name !== undefined) exports.add(name);
      }
      const d = node.declaration;
      if (d) {
        for (const decl of d.declarations ?? [d]) {
          if (decl.id?.name) exports.add(decl.id.name);
          if (decl.id?.properties) for (const p of decl.id.properties) if (p.value?.name) exports.add(p.value.name);
        }
      }
    } else if (node.type === 'ExportAllDeclaration') star = true;
    else if (node.type === 'ExportDefaultDeclaration') exports.add('default');
    for (const lit of collectLiterals(node)) literals.add(lit);
  }
  index.push({ file, exports, literals, star, parseError: false });
}

function collectLiterals(node, out = []) {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) { for (const n of node) collectLiterals(n, out); return out; }
  if (node.type === 'Literal' && typeof node.value === 'string' && node.value.length >= 4 && node.value.length <= 120) out.push(node.value);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    collectLiterals(node[k], out);
  }
  return out;
}

/* ---------------------------------------------------------------- match */

const tokens = (specifier) => specifier
  .replace(/^\.+\//, '').replace(/\.js$/, '')
  .split('/').filter((t) => t.length >= 4 && !['index', 'types', 'utils', 'services', 'tools', 'commands'].includes(t));

// Which recovered file declares each name, so a gap can name its own evidence rather than only a
// score: a fill is only honest when every name it re-exports exists in the chunk it points at.
const byExport = new Map();
for (const candidate of index) {
  for (const name of candidate.exports) {
    if (!byExport.has(name)) byExport.set(name, []);
    byExport.get(name).push(path.relative(RECOVERED, candidate.file));
  }
}

const results = [];
for (const [target, entry] of wants) {
  const need = [...entry.names].filter((n) => n !== null);
  // `default` is not evidence: nearly every chunk exports one, so a default-only match pointed
  // five unrelated gaps at the same native-addon wrapper.
  const evidence = need.filter((n) => n !== 'default');
  const hints = tokens(entry.specifier);
  let best = null;
  for (const candidate of index) {
    if (candidate.parseError) continue;
    const hit = evidence.filter((n) => candidate.exports.has(n)).length;
    const coverage = evidence.length === 0 ? 0 : hit / evidence.length;
    const literalHit = hints.filter((h) => [...candidate.literals].some((l) => l.includes(h))).length;
    const score = coverage * 100 + literalHit * 15 + (candidate.star ? 3 : 0);
    if (best === null || score > best.score) best = { ...candidate, score, hit, coverage, literalHit };
  }
  const found = need.filter((n) => byExport.has(n));
  results.push({
    target,
    relative: path.relative(HARNESS, target),
    specifier: entry.specifier,
    names: need,
    importers: entry.importers.size,
    importersList: [...entry.importers.keys()],
    namespaceImporters: entry.starFiles.size,
    survivors: found.map((n) => ({ name: n, in: [...new Set(byExport.get(n))].slice(0, 3) })),
    absent: need.filter((n) => !byExport.has(n)),
    match: best === null ? null : {
      file: path.relative(RECOVERED, best.file),
      hit: best.hit, coverage: Number(best.coverage.toFixed(2)),
      literalHit: best.literalHit, score: Number(best.score.toFixed(1)),
      missing: need.filter((n) => !best.exports.has(n)),
    },
  });
}

/* ---------------------------------------------------------------- fill */

const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

let applied = 0, strong = 0, weak = 0, none = 0;
const HEAD = '// Filled from the 2.1.296 shipped build: this module is absent from the 2.1.88 dump.';
for (const r of results) {
  if (r.match === null) { none++; continue; }
  // A fill has to carry real exports: a path-token hit alone matched markdown loaders to chunks,
  // and a namespace import with no named proof matched an unrelated chunk (it was the first one
  // scanned). Neither is evidence that the chunk implements this module.
  if (r.match.hit < 1) { none++; continue; }
  if (r.match.coverage >= 0.999) strong++; else weak++;
  if (!APPLY) continue;

  const source = path.join(HARNESS, 'recovered', r.match.file);
  const from = path.relative(path.dirname(r.target), source).split(path.sep).join('/');
  const exported = r.names.filter((n) => !r.match.missing.includes(n));
  const lines = [
    HEAD,
    `// Source: recovered/${r.match.file} (sha256 ${digest(source)}…, matched by ${r.match.hit}/${r.names.length} export names, ${r.match.literalHit} path tokens).`,
    '// Identifiers inside are the decompiler\'s; the body is the shipped build\'s code.',
  ];
  if (r.namespaceImporters > 0) lines.push(`export * from '${from.startsWith('.') ? from : `./${from}`}';`);
  if (exported.length > 0) lines.push(`export { ${exported.join(', ')} } from '${from.startsWith('.') ? from : `./${from}`}';`);
  if (r.match.missing.length > 0) lines.push(`// NOT in the matched chunk: ${r.match.missing.join(', ')}`);
  if (exported.length === 0 && r.namespaceImporters === 0) lines.push(`export * from '${from.startsWith('.') ? from : `./${from}`}';`);
  fs.mkdirSync(path.dirname(r.target), { recursive: true });
  fs.writeFileSync(r.target, lines.join('\n') + '\n');
  applied++;
}

/* ---------------------------------------------------------------- text assets */

// A bundler text load is answered by a wildcard declaration; the asset itself comes out of the
// recovered tree, which ships the same skills and templates zstd-compressed under assets/.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const assetFills = [];
if (assetGaps.size > 0) {
  const declarations = [...assetGaps.values()].map(({ ext }) =>
    `declare module '*${ext}' {\n  const text: string;\n  export default text;\n}`);
  if (APPLY) {
    fs.mkdirSync(path.join(HARNESS, 'types'), { recursive: true });
    fs.writeFileSync(path.join(HARNESS, 'types/assets.d.ts'),
      ['// Text assets the dump omits; the bundler inlines these as strings.', ...declarations].join('\n') + '\n');
  }
  const zstd = require_('node:zlib').zstdDecompressSync;
  const packed = fs.readdirSync(path.join(RECOVERED, 'assets')).filter((n) => n.endsWith('.zst'));
  for (const gap of assetGaps.values()) {
    for (const specifier of gap.specifiers) {
      const importer = [...gap.importers][0];
      const target = path.resolve(HARNESS, path.dirname(importer), specifier);
      const base = path.basename(specifier, gap.ext);
      const pattern = new RegExp(`^${escapeRe(base)}-[0-9a-f]{8}${escapeRe(gap.ext)}\\.zst$`);
      // A generic basename is not an identity: `SKILL.md` matched a Cowork plugin body, and every
      // `README.md` matched the first one packed. Restore only a distinctive name with exactly one
      // packed counterpart; the wildcard declaration resolves the rest without claiming content.
      const matches = packed.filter((n) => pattern.test(n));
      const distinctive = base.length >= 8 || /[A-Z0-9_-]/.test(base.slice(1));
      const asset = matches.length === 1 && distinctive ? matches[0] : null;
      let bytes = null;
      if (APPLY && asset !== null) {
        try {
          const text = zstd(fs.readFileSync(path.join(RECOVERED, 'assets', asset)));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, text);
          bytes = text.length;
        } catch { bytes = null; }
      }
      assetFills.push({ specifier, target: path.relative(HARNESS, target), asset, bytes });
    }
  }
}

const record = {
  schema: 'W47MissingModuleFills.v1',
  tscLog: TSC_LOG,
  gaps: results.length,
  strong, weak, unmatched: none, applied,
  assets: {
    extensions: [...assetGaps.values()].map(({ ext, count, specifiers }) => ({ ext, count, distinct: specifiers.size })),
    filled: assetFills.filter((a) => a.bytes !== null).length,
    withoutAsset: assetFills.filter((a) => a.bytes === null).map((a) => a.specifier),
    list: assetFills,
  },
  results: results.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1)),
};
fs.writeFileSync('.audit/w47-fills.json', JSON.stringify(record, null, 1) + '\n');

console.log(`code gaps ${results.length} | strong ${strong} | weak ${weak} | unmatched ${none} | ${APPLY ? `filled ${applied}` : 'report only'}`);
console.log(`asset gaps ${assetFills.length} | with a recovered asset ${assetFills.filter((a) => a.asset !== null).length} | extensions ${[...assetGaps.keys()].join(' ')}`);

const withSurvivors = results.filter((r) => r.survivors.length > 0).sort((a, b) => b.survivors.length / b.names.length - a.survivors.length / a.names.length);
console.log(`gaps with at least one surviving name: ${withSurvivors.length} / ${results.length}`);
for (const r of withSurvivors.slice(0, 30)) {
  console.log(`  ${String(r.survivors.length).padStart(2)}/${String(r.names.length).padEnd(2)} ${r.relative.padEnd(56)} ${r.survivors.slice(0, 4).map((s) => s.name).join(', ')}`);
}
console.log('top matches:');
for (const r of record.results.slice(0, 15)) {
  console.log(` ${String(r.match?.score ?? '-').padStart(6)}  ${r.relative.padEnd(58)} -> ${r.match?.file ?? 'NONE'}  ${r.match ? `${r.match.hit}/${r.names.length}` : ''}`);
}
console.log('unmatched:');
for (const r of record.results.filter((x) => !x.match || (x.match.coverage === 0 && x.match.literalHit === 0)).slice(0, 25)) console.log('  ', r.relative, '|', r.specifier, '| names', r.names.length);
