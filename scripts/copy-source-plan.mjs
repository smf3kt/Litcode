import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [planPath, moduleDirectory, outputDirectory] = process.argv.slice(2);
if (!planPath || !moduleDirectory || !outputDirectory || process.argv.length !== 5)
  throw new Error('Usage: node scripts/copy-source-plan.mjs PLAN MODULE_DIRECTORY OUTPUT_DIRECTORY');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const modules = new Map(), records = [], outputs = [];
for (const output of plan.outputs) {
  assert.equal(path.basename(output.path), output.path);
  let text = '';
  for (const chunk of output.chunks) {
    if (typeof chunk === 'string') { text += chunk; continue; }
    if (!modules.has(chunk.module)) {
      assert.equal(path.basename(chunk.module), chunk.module);
      const source = fs.readFileSync(path.join(moduleDirectory, chunk.module), 'utf8');
      assert.equal(hash(source), chunk.moduleSha256, chunk.module);
      modules.set(chunk.module, source);
    }
    const body = modules.get(chunk.module).slice(...chunk.range);
    assert.equal(hash(body), chunk.bodySha256, chunk.symbol);
    text += `// ${chunk.module} ${chunk.symbol} [${chunk.range.join(',')}), UTF-16; sha256 ${chunk.bodySha256}\n`;
    if (chunk.declarator) text += 'var ';
    const start = text.length;
    text += body;
    records.push({ ...chunk, output: output.path, outputRange: [start, text.length], coordinates: 'zero-based half-open UTF16 code units' });
    if (chunk.declarator) text += ';';
    text += '\n';
  }
  outputs.push({ path: output.path, text });
}
const ledger = { schema: plan.schema, artifactSha256: plan.artifactSha256, records };
for (const output of outputs) fs.writeFileSync(path.join(outputDirectory, output.path), output.text);
assert.equal(path.basename(plan.ledger), plan.ledger);
fs.writeFileSync(path.join(outputDirectory, plan.ledger), JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({ outputs: outputs.map(output => ({ path: output.path, sha256: hash(output.text) })), records: records.length }));
