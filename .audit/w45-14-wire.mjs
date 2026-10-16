// Cross-chunk alias wiring for the W45-14 copies (see the plan records). Each round: parse each
// generated copy, list the names it uses but neither declares nor imports, resolve each to the chunk
// that declares it (following that chunk's own imports when the name is re-exported), add the name to
// the owner plan's exports and to the consumer plan's import list, then regenerate. Stops when clean.
import fs from 'node:fs';
import * as acorn from 'acorn';
import { execFileSync } from 'node:child_process';

const PLANS = [
  { plan: 'research/ports/W45-chain-memoize-blocks.plan.json', out: 'src/plugin-chain-memoize-source.ts', module: 'chunk-ae84tp6z.js', spec: './plugin-chain-memoize-source.js', notes: [
    '// The chain memoize stack the product already carries: `V`/`po` and the helpers the lodash stack',
    '// copies read from it. Its extra exports exist for those copies, not for a product caller.',
  ] },
  { plan: 'research/ports/W45-lodash-internals-source-blocks.plan.json', out: 'src/plugin-chain-lodash-internals-source.ts', module: 'chunk-4bw62nzm.js', spec: './plugin-chain-lodash-internals-source.js', notes: [
    '// One module of the lodash stack the classic sites read, copied whole. Its free-module detection,',
    '// the memoize and the introspection helpers it reads come from the chunk the product already carries',
    '// as ./plugin-chain-memoize-source.ts, so they are imported rather than copied twice.',
  ] },
  { plan: 'research/ports/W45-lodash-memoize-source-blocks.plan.json', out: 'src/plugin-chain-lodash-memoize-source.ts', module: 'chunk-t2x9eyac.js', spec: './plugin-chain-lodash-memoize-source.js', notes: [
    '// One module of the lodash stack the classic sites read: the memoize `Eo` the classic settle builds',
    '// on. Every helper it closes over lives in the internals copy of the same stack.',
  ] },
  { plan: 'research/ports/W45-lodash-mapvalues-source-blocks.plan.json', out: 'src/plugin-chain-lodash-mapvalues-source.ts', module: 'chunk-3cynezh1.js', spec: './plugin-chain-lodash-mapvalues-source.js', notes: [
    '// The memoized map-values `ua` the classic settle calls, with the alias chain it is built from.',
  ] },
];
const BY_MODULE = new Map(PLANS.map((p) => [p.module, p]));
const EXTRA = { 'chunk-nyce03br.js': null };
const astCache = new Map();
const astOf = (mod) => {
  if (!astCache.has(mod)) astCache.set(mod, acorn.parse(fs.readFileSync('extracted-v2/modules/' + mod, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }));
  return astCache.get(mod);
};
function home(mod, name) {
  for (const n of astOf(mod).body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier' && d.id.name === name) return { mod, range: [n.start, n.end] };
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) return { mod, range: [n.start, n.end] };
    if (n.type === 'ImportDeclaration') for (const s of n.specifiers) if (s.local.name === name) return { importFrom: n.source.value.replace(/^.*\//, '') };
  }
  return null;
}
const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) for (const item of value) walk(item, fn);
    else if (value && typeof value.type === 'string') walk(value, fn);
  }
};
const GLOBALS = new Set(['Math', 'Number', 'String', 'Object', 'Array', 'Set', 'Map', 'JSON', 'Infinity', 'undefined', 'NaN', 'Boolean', 'RegExp', 'Symbol', 'BigInt', 'Intl', 'Date', 'Error', 'Promise', 'structuredClone', 'console', 'globalThis', 'process', 'isNaN', 'parseInt', 'parseFloat', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'Buffer', 'crypto', 'Object']);
function unresolved(out) {
  // The repo's own scanner is the authority for this: it knows property accesses and builtins.
  const report = execFileSync('node', ['scripts/source-undeclared-scan.mjs', out], { encoding: 'utf8' });
  const lines = report.split('\n');
  const at = lines.findIndex((l) => l.startsWith('unresolved '));
  if (at === -1) return [];
  const names = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+\(line \d+\)$/.exec(l);
    if (!m) break;
    names.push(m[1]);
  }
  return names.sort();
}
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, j) => fs.writeFileSync(p, JSON.stringify(j, null, 1) + '\n');

for (let round = 1; round <= 10; round++) {
  const want = new Map(); // consumer module -> Map(owner module -> Set(names))
  let stuck = 0;
  for (const entry of PLANS) {
    const names = unresolved(entry.out);
    if (!names.length) continue;
    for (const name of names) {
      let r = home(entry.module, name);
      let hops = 0;
      while (r && r.importFrom && hops++ < 5) r = home(r.importFrom, name);
      if (!r) { console.log('NO-DECLARATION ' + name + ' (for ' + entry.out + ')'); stuck++; continue; }
      const owner = BY_MODULE.get(r.mod);
      if (!owner) { console.log('NO-PLAN ' + name + ' in ' + r.mod + ' (for ' + entry.out + ')'); stuck++; continue; }
      if (!want.has(entry.module)) want.set(entry.module, new Map());
      const byOwner = want.get(entry.module);
      byOwner.set(owner.module, new Set([...(byOwner.get(owner.module) ?? []), name]));
    }
  }
  if (want.size === 0) { console.log('round ' + round + ': clean' + (stuck ? ' (' + stuck + ' unresolved)' : '')); break; }
  for (const [consumerMod, byOwner] of want) {
    const consumer = BY_MODULE.get(consumerMod);
    const cj = read(consumer.plan);
    const owners = [...byOwner.keys()].sort();
    const lines = owners.map((m) => {
      const owner = BY_MODULE.get(m);
      const names = [...byOwner.get(m)].sort();
      const oj = read(owner.plan);
      for (const n of names) if (!oj.exports.includes(n)) oj.exports.push(n);
      write(owner.plan, oj);
      return "import { " + names.join(', ') + " } from '" + owner.spec + "';";
    });
    // The import list is rebuilt from this round's resolution alone: a name the file already imported
    // and still uses reappears as unresolved once the stale line is gone, so the walk settles in two rounds.
    cj.imports = [...consumer.notes, ...lines];
    write(consumer.plan, cj);
    console.log('round ' + round + ': ' + consumer.out + ' <- ' + owners.map((m) => m + '(' + [...want.get(consumerMod).get(m)].join(',') + ')').join(' '));
  }
  for (const entry of PLANS) execFileSync('node', ['scripts/copy-module-regions.mjs', entry.plan, 'extracted-v2/modules/', entry.out], { stdio: 'pipe' });
}
for (const entry of PLANS) console.log(entry.out + ': ' + (unresolved(entry.out).join(' ') || 'clean'));
