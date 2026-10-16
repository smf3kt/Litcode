// W45-65: the transitive closure across modules, so a package that drags foreign names is sized from
// the source's own import edges rather than from one hop. It drives .audit/w45-49-closure.mjs once per
// module and follows the imports that report names, keeping the union of statements per module.
// Usage: node .audit/w45-65-recon.mjs <module.js> <name> [name...]
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [moduleName, ...seeds] = process.argv.slice(2);
if (!moduleName || seeds.length === 0) {
  console.error('Usage: node .audit/w45-65-recon.mjs <module.js> <name> [name...]');
  process.exit(2);
}

const pending = [{ module: moduleName, seeds }];
const seen = new Map();      // module -> Set of seed names already followed
const statements = new Map(); // module -> Map(start -> {units, names})
const hosts = new Map();     // host specifier -> Set of imported names
const unresolved = new Map();
while (pending.length > 0) {
  const { module, seeds: names } = pending.shift();
  const known = seen.get(module) ?? new Set();
  const wanted = names.filter((name) => !known.has(name));
  if (wanted.length === 0) continue;
  for (const name of wanted) known.add(name);
  seen.set(module, known);
  const out = execFileSync(process.execPath, ['.audit/w45-49-closure.mjs', module, ...wanted],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const line of out.split('\n')) {
    const statement = /^\s*(\d+)u \[(\d+),(\d+)\) (\w+) (.+?)\s+<- (.*)$/.exec(line);
    if (statement) {
      const [, units, start, end, type, declared, seed] = statement;
      const at = statements.get(module) ?? new Map();
      const held = at.get(Number(start)) ?? { units: Number(units), names: new Set(), type, declared };
      held.names.add(seed.trim());
      at.set(Number(start), held);
      statements.set(module, at);
      continue;
    }
    if (line.startsWith('# imports:')) {
      const list = line.slice('# imports:'.length).trim();
      if (list === '') continue;
      for (const entry of list.split(' | ')) {
        const m = /^(.*?) <- (.*?) of (.+)$/.exec(entry.trim());
        if (!m) continue;
        const [, , imported, target] = m;
        if (target.startsWith('/$bunfs/root/')) {
          const next = path.basename(target);
          const queue = pending.find((item) => item.module === next);
          if (queue) queue.seeds.push(imported);
          else pending.push({ module: next, seeds: [imported] });
        } else {
          const set = hosts.get(target) ?? new Set();
          set.add(imported);
          hosts.set(target, set);
        }
      }
      continue;
    }
    if (line.startsWith('# unresolved:')) {
      unresolved.set(module, line.slice('# unresolved:'.length).trim());
    }
  }
}

let totalStatements = 0;
let totalUnits = 0;
const rows = [...statements.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
for (const [module, at] of rows) {
  const units = [...at.values()].reduce((sum, held) => sum + held.units, 0);
  totalStatements += at.size;
  totalUnits += units;
  console.log(`# ${module}: ${at.size} statements, ${units} units`);
  for (const [start, held] of [...at.entries()].sort((a, b) => a[0] - b[0])) {
    const end = start + held.units;
    console.log(`  ${String(held.units).padStart(6)}u [${start},${end}) ${held.type} ${[...held.names].join(',')}`);
  }
}
console.log(`# total: ${totalStatements} statements, ${totalUnits} units across ${rows.length} modules`);
for (const [module, text] of unresolved) console.log(`# unresolved (${module}): ${text}`);
for (const [host, names] of hosts) console.log(`# host: ${host} <- ${[...names].join(', ')}`);
