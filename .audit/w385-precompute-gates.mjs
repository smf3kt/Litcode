// Execute only copied gate/entry declarations under owned, inert dependencies.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const specs = [
  ['chunk-14rnebpd.js', 'ef', 317949, 318021],
  ['chunk-14rnebpd.js', 'a$', 318416, 318489],
  ['chunk-4bw62nzm.js', 'B8e', 45582, 45615],
  ['chunk-sfn1dbxq.js', 'FI', 2605059, 2605197],
  ['chunk-sfn1dbxq.js', 'RSe', 2605227, 2605296],
  ['chunk-sfn1dbxq.js', 'rvt', 2606964, 2609133],
  ['chunk-sfn1dbxq.js', 'zXr', 2610739, 2611057],
  ['chunk-sfn1dbxq.js', 'VXr', 2611057, 2616191],
  ['chunk-sfn1dbxq.js', 'KXr', 2617938, 2620068],
];
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const sources = new Map();
const ledger = specs.map(([module, symbol, start, end]) => {
  if (!sources.has(module)) sources.set(module, fs.readFileSync(`extracted-v2/modules/${module}`, 'utf8'));
  const source = sources.get(module), moduleSha256 = hash(source);
  assert.equal(moduleSha256, manifest.modules.find(row => row.path === module)?.decodedSha256);
  return { module, symbol, moduleSha256, range: [start, end], coordinates: 'zero-based half-open UTF-16', bodySha256: hash(source.slice(start, end)) };
});
const code = ledger.map(row => sources.get(row.module).slice(...row.range)).join('\n');
function gates({ flags = {}, settings = {}, remote = false, connected = true } = {}) {
  const reads = [];
  const make = new Function('k', 'hs', 'Gm', 'a', 'bS', 'Fa', 'Te', 'yTn', 'ls', `${code};return {FI,RSe,rvt,zXr,VXr,KXr};`);
  const api = make((key, fallback) => { reads.push({ key, fallback }); return flags[key] ?? fallback; },
    (key, fallback) => ({ value: settings[key] ?? fallback }), () => false,
    { CLAUDE_CODE_REMOTE: remote }, { isOpen: () => connected }, () => false, () => false, () => false, value => value);
  return { ...api, reads };
}

const defaults = gates();
assert.equal(defaults.FI(), false);
assert.equal(defaults.RSe(), false);
assert.ok(defaults.reads.every(read => read.fallback === false));
const untouched = new Proxy({}, { get() { assert.fail('disabled gate accessed precompute state'); } });
const context = { session: { precompute: untouched } };
assert.equal(defaults.VXr({ messages: [], cacheSafeParams: { toolUseContext: context } }), false);
assert.equal(defaults.zXr({}), false);
defaults.rvt(untouched, 'main', 'interactive', [], 'fixture');
assert.deepEqual(await defaults.KXr({ toolUseContext: context, messages: [], trigger: 'threshold' }),
  { outcome: { kind: 'none' }, swap: undefined, emittedEarlyCompactStart: false });
assert.equal(gates({ settings: { precomputeCompactionEnabled: true } }).FI(), false);
const flags = { tengu_sepia_moth: true, tengu_amber_packet: true };
assert.equal(gates({ flags }).FI(), true);
assert.equal(gates({ flags }).RSe(), true);
assert.equal(gates({ flags, settings: { autoCompactEnabled: false } }).FI(), false);
assert.equal(gates({ flags, settings: { precomputeCompactionEnabled: false } }).FI(), false);
assert.equal(gates({ flags, remote: true, connected: false }).FI(), false);
assert.equal(gates({ flags: { tengu_sepia_moth: true } }).RSe(), false);
const file = '.audit/w385-precompute-gates-source.json';
if (process.argv.includes('--record')) fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
else assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), ledger);
console.log(JSON.stringify({ declarations: ledger.length, defaultEntries: 4, gates: 'passed', enabledProducer: 'not_exercised', sourceEntryPointsExecuted: 0 }));
