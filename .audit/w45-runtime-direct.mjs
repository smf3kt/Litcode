// Prints each entry block's direct references with the size of the subtree each one carries,
// using the closure's block-level parent links.
import fs from 'node:fs';
const closure = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const key = block => `${block.file}:${block.range[0]}`;
const byKey = new Map(), byName = new Map();
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
function subtree(start) {
  if (sizes.has(start)) return sizes.get(start);
  const seen = new Set(), stack = [start];
  let units = 0;
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const block = byKey.get(current);
    if (!block) continue;
    units += block.units;
    for (const child of kids.get(current) ?? []) stack.push(child);
  }
  sizes.set(start, units);
  return units;
}
for (const entry of process.argv.slice(3)) {
  const start = byName.get(entry);
  if (!start) { console.log('ENTRY MISSING', entry); continue; }
  const block = byKey.get(start);
  console.log(`\n=== ${entry} self ${block.units} subtree ${subtree(start)}`);
  const rows = [];
  for (const child of kids.get(start) ?? []) rows.push(child);
  for (const child of rows) {
    const node = byKey.get(child);
    console.log(`   ${node.file}:${node.names.slice(0, 3).join(',')}  ${node.units}  subtree ${subtree(child)}`);
  }
}
