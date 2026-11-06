// Resolves unresolved names in a generated probe against the import table of the module each block
// was copied from. Reads the scan output (name + line) and the block ledger.
import fs from 'node:fs';
import * as acorn from 'acorn';

const probePath = process.argv[2];
const ledgerPath = process.argv[3];
const scanPath = process.argv[4];
const dir = 'extracted-v2/modules';

const probeLines = fs.readFileSync(probePath, 'utf8').split('\n');
const blocks = [];
for (let i = 0; i < probeLines.length; i++) {
  const m = probeLines[i].match(/^\/\/ (\S+) .*\[(\d+),(\d+)\)/);
  if (m) blocks.push({ line: i + 1, module: m[1].replace(/^.*\//, ''), start: Number(m[2]), end: Number(m[3]) });
}
blocks.sort((a, b) => a.line - b.line);

const parsed = new Map();
function load(file) {
  if (!parsed.has(file)) {
    const t = fs.readFileSync(`${dir}/${file}`, 'utf8');
    parsed.set(file, { t, ast: acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'module' }) });
  }
  return parsed.get(file);
}

function importsOf(file) {
  const { ast } = load(file);
  const map = new Map();
  for (const n of ast.body) {
    if (n.type !== 'ImportDeclaration') continue;
    const mod = n.source.value.replace('/$bunfs/root/', '');
    for (const sp of n.specifiers) map.set(sp.local.name, { mod, imported: sp.imported?.name ?? 'default' });
  }
  return map;
}

function decl(file, name) {
  const { ast } = load(file);
  for (const n of ast.body) {
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id?.name === name) return [n.start, n.end];
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) if (d.id.type === 'Identifier' && d.id.name === name) return [n.start, n.end];
    }
  }
  return null;
}

const scan = fs.readFileSync(scanPath, 'utf8').split('\n');
for (const line of scan) {
  const m = line.match(/^  (\S+)  \(line (\d+)\)$/);
  if (!m) continue;
  const [, name, lineNo] = m;
  const at = Number(lineNo);
  let block;
  for (const b of blocks) if (b.line <= at) block = b;
  if (!block) continue;
  const imp = importsOf(block.module).get(name);
  if (!imp) {
    console.log(`${name}\tblock=${block.module}\tLOCAL-DECL`);
    continue;
  }
  const r = imp.mod.endsWith('.js') ? decl(imp.mod, imp.imported) : null;
  console.log(`${name}\tblock=${block.module}\t${imp.mod}${r ? `:${r[0]}-${r[1]}(${r[1] - r[0]})` : ':NO-DECL'}`);
}
