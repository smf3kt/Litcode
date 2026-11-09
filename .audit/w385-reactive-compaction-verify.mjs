import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
const ledger = ['W385-reactive-compaction-source.json', 'W385-compaction-prompt-source.json']
  .flatMap(name => JSON.parse(fs.readFileSync(`research/ports/${name}`, 'utf8')));
const modules = new Map();
for (const row of ledger) {
  if (!modules.has(row.module)) {
    const source = fs.readFileSync(`extracted-v2/modules/${row.module}`, 'utf8');
    assert.equal(hash(source), manifest.modules.find(entry => entry.path === row.module)?.decodedSha256);
    modules.set(row.module, source);
  }
  const source = modules.get(row.module);
  assert.equal(hash(source), row.moduleSha256);
  assert.equal(row.coordinates, 'zero-based half-open UTF-16');
  const body = source.slice(...row.range);
  assert.equal(hash(body), row.bodySha256, row.symbol);
  const port = fs.readFileSync(row.portFile ?? 'src/reactive-compaction-source.ts', 'utf8');
  assert.ok(port.includes(body), `changed copied body: ${row.symbol}`);
}
console.log(JSON.stringify({ verifiedBodies: ledger.length, modules: modules.size, sourceEntryPointsExecuted: 0 }));
