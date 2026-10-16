// BFS from one entry block; prints the shortest parent chain by which each module is first reached.
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
const start = byName.get(process.argv[3]);
const prev = new Map([[start, null]]);
const queue = [start];
const seenFiles = new Set();
while (queue.length) {
  const current = queue.shift();
  const block = byKey.get(current);
  if (!seenFiles.has(block.file) && block.file !== byKey.get(start).file) {
    seenFiles.add(block.file);
    const path = [];
    for (let k = current; k !== null; k = prev.get(k)) path.unshift(byKey.get(k));
    console.log(`\n${block.file} total ${closure.blocks.filter(b => b.file === block.file).reduce((s, b) => s + b.units, 0)} units`);
    for (const node of path) console.log(`   ${node.file}:${node.range[0]}[${node.units}]{${node.names.slice(0, 3).join(',')}}`);
  }
  for (const child of kids.get(current) ?? []) if (!prev.has(child)) { prev.set(child, current); queue.push(child); }
}
