// Build the recovered source tree the product can be read against: take the Wakaru unpack of the
// sample's embedded segment, rewrite Bun's virtual specifiers (`/$bunfs/root/<module>`) to the
// relative paths of the recovered files they name, export the side assets the JS pass does not carry,
// and write the index that binds every recovered file back to the module it came from.
//
//   node scripts/recovered-tree.mjs [--from <wakaru-out>] [--to <tree>] [--check]
//
// `--check` reports what would change without writing. The rewrite is done on acorn's own source
// offsets, so a specifier is replaced exactly where it sits and nowhere else.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const acorn = require_('acorn');

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const FROM = path.resolve(arg('--from', '/tmp/wakaru-probe/out-exe'));
const TO = path.resolve(arg('--to', 'recovered'));
const CHECK = process.argv.includes('--check');
const REWRITE_LITERALS = process.argv.includes('--literals');
const MANIFEST = 'extracted-v2/manifest.json';
const ASSET_SOURCE = 'extracted-v2/modules';

const read = (p) => fs.readFileSync(p, 'utf8');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/* ------------------------------------------------------------------ the recovered tree as Wakaru left it */

const walk = (dir) => {
  const found = [];
  const visit = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.js')) found.push(full);
    }
  };
  visit(dir);
  return found.sort();
};

const sources = walk(FROM);
const relative = (file) => path.relative(FROM, file).split(path.sep).join('/');

// Every module the sample embeds, by the virtual path the bundle imports it as.
const manifest = JSON.parse(read(MANIFEST));
const byVirtualPath = new Map(manifest.modules.map((module) => [module.originalName, module]));

// A recovered file answers for the module whose virtual path is `/$bunfs/root/<its own path>`; a
// module that was split keeps its entry file, so the mapping is by recovered path, with the
// extension-less virtual paths (`/$bunfs/root/cli`) falling back to `<path>.js`.
const answersFor = new Map();
for (const file of sources) {
  const rel = relative(file);
  answersFor.set(rel, file);
  answersFor.set(rel.replace(/\.js$/, ''), file);
}
const targetOf = (specifier) => {
  const prefix = '/$bunfs/root/';
  if (!specifier.startsWith(prefix)) return undefined;
  const name = specifier.slice(prefix.length);
  return answersFor.get(name) ?? answersFor.get(name.replace(/\.js$/, ''));
};

/* ------------------------------------------------------------------ the rewrite, on acorn offsets */

const visitNodes = (node, visit) => {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) visitNodes(item, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    visitNodes(node[key], visit);
  }
};

const specifierSites = (tree) => {
  const sites = [];
  visitNodes(tree, (node) => {
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration') && node.source) {
      sites.push({ node: node.source, form: node.type === 'ImportDeclaration' ? 'import' : 'export' });
    } else if (node.type === 'ImportExpression') {
      sites.push({ node: node.source, form: 'import()' });
    } else if (node.type === 'CallExpression' && node.arguments.length === 1 &&
      node.arguments[0]?.type === 'Literal' &&
      ((node.callee?.type === 'Identifier' && node.callee.name === 'require') ||
        // Bun hands the CommonJS require to ESM through `import.meta.require`, which is how the
        // bundle pulls in a module that has no ESM form.
        (node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'require'))) {
      sites.push({ node: node.arguments[0], form: 'require()' });
    }
  });
  return sites;
};

const unresolved = [];
const counts = { import: 0, export: 0, 'import()': 0, 'require()': 0 };
const rewritten = new Map();

// The bundle also carries its virtual paths as plain strings and hands them to loaders at runtime
// (`import.meta.require(path)`, a worker file, an asset read). Those cannot become relative imports,
// so they are pointed at the file the string names, under the tree root.
const literalTarget = (specifier) => {
  const prefix = '/$bunfs/root/';
  if (!specifier.startsWith(prefix)) return undefined;
  const name = specifier.slice(prefix.length);
  const asset = path.join(TO, 'assets', name);
  if (fs.existsSync(path.join(ASSET_SOURCE, name))) return asset;
  const file = answersFor.get(name) ?? answersFor.get(name.replace(/\.js$/, ''));
  if (file !== undefined) return path.join(TO, relative(file));
  return undefined;
};

for (const file of sources) {
  const text = read(file);
  const tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const edits = [];
  const handled = new Set();
  for (const site of specifierSites(tree)) {
    const specifier = site.node.value;
    if (typeof specifier !== 'string' || !specifier.startsWith('/')) continue;
    const target = targetOf(specifier);
    if (target === undefined) {
      unresolved.push({ file: relative(file), specifier, form: site.form });
      continue;
    }
    let next = path.relative(path.dirname(file), target).split(path.sep).join('/');
    if (!next.startsWith('.')) next = `./${next}`;
    edits.push({ start: site.node.start, end: site.node.end, next, form: site.form, specifier });
    handled.add(site.node.start);
  }
  if (REWRITE_LITERALS) {
    visitNodes(tree, (node) => {
      if (node.type !== 'Literal' || typeof node.value !== 'string' || !node.value.startsWith('/$bunfs/root/')) return;
      if (handled.has(node.start)) return;
      const target = literalTarget(node.value);
      if (target === undefined) {
        unresolved.push({ file: relative(file), specifier: node.value, form: 'string' });
        return;
      }
      edits.push({ start: node.start, end: node.end, next: target, form: 'string', specifier: node.value });
    });
  }
  if (edits.length === 0) continue;
  edits.sort((a, b) => b.start - a.start);
  let updated = text;
  for (const edit of edits) {
    updated = `${updated.slice(0, edit.start)}"${edit.next}"${updated.slice(edit.end)}`;
    counts[edit.form] = (counts[edit.form] ?? 0) + 1;
  }
  rewritten.set(file, { updated, edits: edits.length });
}

/* ------------------------------------------------------------------ the side assets the JS pass drops */

// The segment also carries files the bundle loads by path rather than by import: three native
// addons, minified libraries and the markdown skills and templates. They are not in the recovered
// tree, so the tree is not runnable without them. `extracted-v2/modules` holds them under the
// manifest's own `path`, which is where this copies them from.
const sideModules = manifest.modules.filter((module) => !module.path.endsWith('.js') || module.side === 1);
const assets = [];
for (const module of sideModules) {
  const origin = path.join(ASSET_SOURCE, module.path);
  assets.push({
    originalName: module.originalName,
    path: module.path,
    encoding: module.encoding,
    loader: module.loader,
    bytes: module.contentBytes,
    present: fs.existsSync(origin),
  });
}

/* ------------------------------------------------------------------ write */

if (CHECK) {
  console.log(`recovered files ${sources.length} | would rewrite ${[...rewritten.values()].reduce((n, r) => n + r.edits, 0)} specifiers`,
    JSON.stringify(counts), `| unresolved ${unresolved.length}`);
  console.log(`side assets ${assets.length} (${assets.filter((a) => !a.present).length} not in ${ASSET_SOURCE})`);
  if (unresolved.length > 0) console.log(JSON.stringify(unresolved.slice(0, 10), null, 1));
  process.exit(unresolved.length === 0 ? 0 : 1);
}

fs.rmSync(TO, { recursive: true, force: true });
for (const file of sources) {
  const target = path.join(TO, relative(file));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const entry = rewritten.get(file);
  fs.writeFileSync(target, entry ? entry.updated : read(file));
}
for (const asset of assets) {
  if (!asset.present) continue;
  const target = path.join(TO, 'assets', asset.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ASSET_SOURCE, asset.path), target);
}
fs.copyFileSync(path.join(FROM, 'provenance.json'), path.join(TO, 'provenance.json'));

// The tree digest binds the record to the bytes on disk.
const files = [];
for (const file of sources) {
  const target = path.join(TO, relative(file));
  const buffer = fs.readFileSync(target);
  files.push({ path: relative(file), bytes: buffer.length, sha256: sha256(buffer) });
}
const treeSha256 = sha256(files.map((f) => `${f.path}\u0000${f.sha256}`).join('\n'));
const index = {
  schema: 'RecoveredSourceTree.v1',
  sample: { path: manifest.input, sha256: manifest.sha256, segmentBytes: manifest.segment.size, modules: manifest.moduleCount },
  producedBy: { tool: 'wakaru (npm wakaru@1.14.0)', command: `wakaru --unpack --provenance -o <out> ${manifest.input}`, from: FROM },
  rewrite: {
    what: 'Bun virtual specifiers (/$bunfs/root/<module>) rewritten to relative paths',
    specifiers: counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    unresolved: unresolved.length,
  },
  files,
  treeSha256,
  assets: {
    count: assets.length,
    missingFromExtraction: assets.filter((a) => !a.present).map((a) => a.path),
    list: assets,
  },
  knownGaps: [
    'Identifiers are rule-renamed by the decompiler; original names, types and comments are not in the sample (sourceMaps: 0).',
    'Assets are copied byte-for-byte from the extraction; the JS pass did not recover them.',
    'The chunk files the recovered tree also contains beyond the app segment are Bun runtime internals, not application code.',
  ],
};
fs.writeFileSync(path.join(TO, 'index.json'), JSON.stringify(index, null, 1) + '\n');

console.log(`recovered tree written to ${TO}`);
console.log(`files ${files.length} | rewritten ${index.rewrite.total} specifiers ${JSON.stringify(counts)} | unresolved ${unresolved.length}`);
console.log(`assets ${assets.length} copied, ${index.assets.missingFromExtraction.length} missing; tree sha256 ${treeSha256.slice(0, 16)}…`);
if (unresolved.length > 0) {
  console.log('unresolved:', JSON.stringify(unresolved.slice(0, 10)));
  process.exitCode = 1;
}
