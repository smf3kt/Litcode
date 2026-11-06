// W366 closure walker: reads the current SourceCopyPlan.v1 ledgers, then reports the
// bodies a seed set still needs. Same rules as .audit/w45-13-closure.mjs.
import fs from 'node:fs';
import * as acorn from 'acorn';

const emitAt = process.argv.indexOf('--emit-plan');
const seedArgs = process.argv.slice(2).filter((s, i) => /\d+-\d+$/.test(s) && !(emitAt !== -1 && i === emitAt - 1));
const seeds = seedArgs.map((s) => {
  const m = /^([^:]+):(\d+)-(\d+)$/.exec(s);
  if (!m) throw new Error('Usage: node w366-closure.mjs MODULE:START-END ...');
  return { module: m[1], range: [Number(m[2]), Number(m[3])] };
});
if (seeds.length === 0) throw new Error('Usage: node w366-closure.mjs MODULE:START-END ...');

const texts = new Map(), asts = new Map();
const text = (mod) => { if (!texts.has(mod)) texts.set(mod, fs.readFileSync(`extracted-v2/modules/${mod}`, 'utf8')); return texts.get(mod); };
const ast = (mod) => { if (!asts.has(mod)) asts.set(mod, acorn.parse(text(mod), { ecmaVersion: 'latest', sourceType: 'module' })); return asts.get(mod); };
const walk = (node, fn) => {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) for (const item of value) walk(item, fn);
    else if (value && typeof value.type === 'string') walk(value, fn);
  }
};

const copied = [];
for (const file of fs.readdirSync('src')) {
  if (!file.endsWith('-source-blocks.json')) continue;
  const ledger = JSON.parse(fs.readFileSync('src/' + file, 'utf8'));
  const rows = ledger.records ?? ledger.blocks;
  for (const block of rows) copied.push([block.module, block.range[0], block.range[1]]);
}

const globals = new Set(['Math', 'Number', 'String', 'Object', 'Array', 'Set', 'Map', 'JSON', 'Infinity', 'undefined', 'NaN',
  'Boolean', 'RegExp', 'Symbol', 'BigInt', 'Intl', 'Date', 'Error', 'Promise', 'structuredClone', 'console', 'globalThis',
  'process', 'isNaN', 'parseInt', 'parseFloat', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'fetch',
  'AbortController', 'AbortSignal', 'performance', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Buffer']);

function missing(ranges) {
  const byModule = new Map();
  for (const { module, range } of ranges) { if (!byModule.has(module)) byModule.set(module, []); byModule.get(module).push(range); }
  const out = { blocks: [], imports: [], notInModule: [] };
  for (const [mod, modRanges] of byModule) {
    const inside = (node) => modRanges.some(([a, b]) => node.start >= a && node.end <= b);
    const declared = new Set(), used = new Map();
    for (const node of ast(mod).body) {
      if (!inside(node)) continue;
      walk(node, (n) => {
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') declared.add(n.id.name);
        if (n.type === 'FunctionDeclaration' && n.id) declared.add(n.id.name);
        if (n.type === 'ClassDeclaration' && n.id) declared.add(n.id.name);
        if (n.type === 'Identifier') used.set(n.name, n.start);
      });
    }
    for (const node of ast(mod).body) {
      if (!inside(node)) continue;
      walk(node, (n) => {
        if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration') {
          for (const p of n.params) walk(p, (q) => { if (q.type === 'Identifier') declared.add(q.name); });
        }
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') declared.add(n.id.name);
        if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') {
          if (n.id) declared.add(n.id.name);
          for (const m of n.body.body) walk(m, (q) => {
            if (q.type === 'PropertyDefinition' && q.key.type === 'Identifier') declared.add(q.key.name);
            if (q.type === 'MethodDefinition' && q.key.type === 'Identifier') declared.add(q.key.name);
          });
        }
        if (n.type === 'CatchClause' && n.param?.type === 'Identifier') declared.add(n.param.name);
      });
    }
    const topLevel = new Map(), importOf = new Map();
    for (const node of ast(mod).body) {
      if (inside(node)) continue;
      if (node.type === 'VariableDeclaration') for (const d of node.declarations) if (d.id.type === 'Identifier') topLevel.set(d.id.name, node.start);
      if (node.type === 'FunctionDeclaration' && node.id) topLevel.set(node.id.name, node.start);
      if (node.type === 'ClassDeclaration' && node.id) topLevel.set(node.id.name, node.start);
      if (node.type === 'ImportDeclaration') for (const s of node.specifiers) importOf.set(s.local.name, node.source.value);
    }
    for (const name of [...new Set([...used.keys()])].sort()) {
      if (declared.has(name) || globals.has(name)) continue;
      const at = topLevel.get(name);
      if (at === undefined) { out.notInModule.push(mod + ':' + name); continue; }
      if (importOf.has(name)) { out.imports.push(name + ' from ' + importOf.get(name)); continue; }
      if (copied.some(([cm, a, b]) => cm === mod && at >= a && at < b)) continue;
      const node = ast(mod).body.find((n) => n.start === at);
      out.blocks.push({ module: mod, range: [at, node.end], name, units: node.end - at });
    }
  }
  return out;
}

let ranges = seeds.map((s) => ({ module: s.module, range: s.range }));
let total = ranges.reduce((n, r) => n + (r.range[1] - r.range[0]), 0);
console.log('pass 0\tblocks ' + ranges.length + '\tunits ' + total);
for (let pass = 1; pass <= 40; pass++) {
  const found = missing(ranges);
  const fresh = found.blocks.filter((b) => !ranges.some((r) => r.module === b.module && r.range[0] === b.range[0]));
  for (const b of fresh) ranges.push({ module: b.module, range: b.range });
  total += fresh.reduce((n, b) => n + b.units, 0);
  console.log('pass ' + pass + '\t+' + fresh.length + '\tblocks ' + ranges.length + '\tunits ' + total + (fresh.length ? '' : '  converged'));
  for (const b of fresh) console.log('\t' + b.name + '\t' + b.module + ' [' + b.range[0] + ',' + b.range[1] + ')\t' + b.units);
  if (found.imports.length) for (const i of new Set(found.imports)) console.log('\tIMPORT ' + i);
  if (found.notInModule.length) console.log('\tNOT-IN-MODULE ' + [...new Set(found.notInModule)].join(' '));
  if (fresh.length === 0) break;
}
console.log('blocks by module:');
const byModule = new Map();
for (const r of ranges) byModule.set(r.module, [...(byModule.get(r.module) ?? []), r.range]);
for (const [mod, list] of byModule) console.log('  ' + mod + '\t' + list.length + ' blocks\t' + list.reduce((n, [a, b]) => n + (b - a), 0) + ' units');
const distinct = new Map();
for (const r of ranges) distinct.set(r.module + ':' + r.range[0], r);
const ordered = [...distinct.values()].sort((a, b) => (a.module === b.module ? a.range[0] - b.range[0] : a.module.localeCompare(b.module)));
const plan = ordered.map((r) => ({ file: r.module, range: r.range, note: '' }));
console.log('PLAN ' + plan.length + ' blocks');
if (emitAt !== -1) {
  const out = process.argv[emitAt + 1];
  fs.writeFileSync(out, JSON.stringify({ imports: [], exports: [], blocks: plan }, null, 1) + '\n');
  console.log('wrote ' + out);
}
