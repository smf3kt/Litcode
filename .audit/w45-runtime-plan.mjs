// Derives a copy plan from the resolved runtime closure. Each module keeps the exact top-level
// blocks the closure selected, so the generated file reproduces the source text verbatim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const closure = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const output = process.argv[3];
const sourceRoot = 'extracted-v2/modules/';
const blocks = [];
for (const block of closure.blocks) {
  const text = fs.readFileSync(sourceRoot + block.file, 'utf8');
  const source = ts.createSourceFile(block.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const start = block.range[0], end = block.range[1];
  const statements = source.statements.filter(n => n.end <= end && n.getStart(source) >= start);
  const first = statements[0], last = statements.at(-1);
  assert.ok(first && last, `${block.file} ${start}`);
  assert.equal(first.getStart(source), start);
  assert.equal(last.end, end);
  // Multi-declarator statements bind several names at once; the closure records the requested
  // name and the range covers its statement, so only the boundaries are asserted here.
  blocks.push({file: block.file, range: [start, end], note: `names ${block.names.join(',')}`});
}
const plan = {imports: [], exports: [], blocks};
fs.writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({plan: output, modules: closure.modules.length, blocks: blocks.length,
  units: blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0)}));
