// Shortest block-level paths from each requested entry to named targets, using the closure's
// recorded parent keys. Prints the referrer chain so boundary placement is source-grounded.
import fs from 'node:fs';
const closure = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const key = block => `${block.file}:${block.range[0]}`;
const byKey = new Map();
const byName = new Map();
for (const block of closure.blocks) {
  byKey.set(key(block), block);
  for (const name of block.names) byName.set(`${block.file}:${name}`, key(block));
}
const kids = new Map();
for (const block of closure.blocks) {
  if (block.parent === null) continue;
  if (!kids.has(block.parent)) kids.set(block.parent, []);
  kids.get(block.parent).push(key(block));
}
const sizes = new Map();
for (const block of closure.blocks) sizes.set(block.file, (sizes.get(block.file) ?? 0) + block.units);
const targets = new Set(process.argv.slice(4));
for (const entry of process.argv.slice(3, 4)) {
  const start = byName.get(entry);
  if (!start) { console.log('ENTRY MISSING', entry); continue; }
  const prev = new Map([[start, null]]);
  const queue = [start];
  const pending = new Set(targets);
  while (queue.length && pending.size) {
    const current = queue.shift();
    const block = byKey.get(current);
    if (pending.delete(block.file)) {
      const path = [];
      for (let k = current; k !== null; k = prev.get(k)) {
        const node = byKey.get(k);
        path.unshift(`${node.file}:${node.range[0]}[${node.units}]{${node.names.join(',')}}`);
      }
      console.log(`\n${entry} -> ${block.file} (${sizes.get(block.file)} units) depth ${path.length}`);
      for (const step of path) console.log('   ' + step);
    }
    for (const child of kids.get(current) ?? []) if (!prev.has(child)) { prev.set(child, current); queue.push(child); }
  }
  if (pending.size) console.log(`\n${entry} unreachable: ${[...pending].join(' ')}`);
}
