// W45-57 recon: how much of a closure is already carried by the product's copies. Runs the closure
// tool for a module and its seeds, then classifies every statement as covered (inside a copied block
// of some ledger) or fresh, and prints the fresh statements with their units and the ledger each
// covered one lives in.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [moduleName, ...seeds] = process.argv.slice(2);

const child = spawnSync(process.execPath, [path.join(root, '.audit/w45-49-closure.mjs'), moduleName, ...seeds],
  { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
if (child.status !== 0) throw new Error(child.stderr || 'closure tool failed');
const statements = [];
for (const line of child.stdout.split('\n')) {
  const match = /^\s*(\d+)u \[(\d+),(\d+)\) \w+ ([\w$,() ]+?)\s+<-/.exec(line);
  if (match) statements.push({ units: Number(match[1]), start: Number(match[2]), end: Number(match[3]), names: match[4] });
}
const summary = /^# (\S+): (\d+) statements, (\d+) units$/m.exec(child.stdout);
if (!summary) throw new Error('the closure tool printed no summary');

// Every block of every copy, as module → ranges.
const blocksByModule = new Map();
for (const name of fs.readdirSync(path.join(root, 'src'))) {
  if (!name.endsWith('-blocks.json')) continue;
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'src', name), 'utf8'));
  for (const block of ledger.blocks) {
    const list = blocksByModule.get(block.module) ?? [];
    list.push({ range: block.range, ledger: name });
    blocksByModule.set(block.module, list);
  }
}
const covered = [];
const fresh = [];
for (const statement of statements) {
  const list = blocksByModule.get(moduleName) ?? [];
  const hit = list.find((block) => statement.start >= block.range[0] && statement.end <= block.range[1]);
  (hit ? covered : fresh).push(hit ? { ...statement, ledger: hit.ledger } : statement);
}
const units = (list) => list.reduce((sum, statement) => sum + statement.units, 0);
console.log(`# ${moduleName} seeds ${seeds.join(',')} — ${summary[2]} statements, ${summary[3]} units`);
console.log(`covered ${covered.length} statements / ${units(covered)} units; fresh ${fresh.length} statements / ${units(fresh)} units`);
const byLedger = new Map();
for (const statement of covered) byLedger.set(statement.ledger, (byLedger.get(statement.ledger) ?? 0) + 1);
for (const [ledger, count] of [...byLedger].sort((a, b) => b[1] - a[1])) {
  console.log(`  covered by ${ledger}: ${count}`);
}
console.log('--- fresh statements (module order) ---');
for (const statement of [...fresh].sort((a, b) => a.start - b.start)) {
  console.log(`  ${String(statement.units).padStart(6)}u [${statement.start},${statement.end}) ${statement.names}`);
}
// The imports the closure names, so the fresh part's boundary is visible without a second run.
const imports = child.stdout.split('\n').filter((line) => line.startsWith('# imports: '));
if (imports.length) console.log(`# imports: ${(imports[0].match(/ \| /g) ?? []).length + 1} names`);
