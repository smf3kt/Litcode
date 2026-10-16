// W45-51: measure the store carry layer's real behaviour before anything is asserted about it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bindPluginDataDir, storeFilePath } from '../src/plugin-chain-store-path.js';
import { bindStoreCarryPlatformIdTable } from '../src/plugin-chain-store-carry-boundaries.js';
import { carryStoreFile, builtinTwinIds, readStoreCandidate, readStoreFile } from '../src/plugin-chain-store-carry.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-51-probe-'));
bindPluginDataDir(() => root);
fs.mkdirSync(path.join(root, 'store'), { recursive: true });
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`);
const step = async (label, run) => {
  clearChainRecords();
  try { console.log(`${label}: ok ->`, JSON.stringify(await run())); }
  catch (error) { console.log(`${label}: threw ->`, error?.code, JSON.stringify(String(error?.message).slice(0, 90))); }
  const lines = logs();
  if (lines.length) console.log(`   logs: ${JSON.stringify(lines)}`);
};

console.log('candidates for the package id:', JSON.stringify(await builtinTwinIds('cc-plugin-tips@builtin')));
console.log('candidates for the short name:', JSON.stringify(await builtinTwinIds('tips@builtin')));
console.log('candidates for an unknown id:', JSON.stringify(await builtinTwinIds('nope@builtin')));
console.log('candidates with no platform suffix:', JSON.stringify(await builtinTwinIds('cc-plugin-tips')));
console.log('candidates for an uppercase suffix:', JSON.stringify(await builtinTwinIds('cc-plugin-tips@BUILTIN')));
bindStoreCarryPlatformIdTable((id) => id === 'builtin');
console.log('candidates for an uppercase suffix, table bound:', JSON.stringify(await builtinTwinIds('cc-plugin-tips@BUILTIN')));
bindStoreCarryPlatformIdTable(undefined);

const twin = storeFilePath('tips@builtin');
const target = storeFilePath('cc-plugin-tips@builtin');
console.log('twin path:', twin);
console.log('target path:', target);
fs.writeFileSync(twin, '{"carried":true}', 'utf8');

await step('read the twin itself', () => readStoreFile('tips@builtin', twin));
console.log('target exists after reading the twin:', fs.existsSync(target));
await step('read the missing target (carry)', () => readStoreFile('cc-plugin-tips@builtin', target));
console.log('target exists after carrying:', fs.existsSync(target), '| contents:', JSON.stringify(fs.readFileSync(target, 'utf8')));
console.log('carry files left:', JSON.stringify(fs.readdirSync(path.join(root, 'store')).filter((n) => n.includes('.carry-'))));
await step('read it again (the file is there now)', () => readStoreFile('cc-plugin-tips@builtin', target));

await step('candidate that is not a plain object', async () => {
  fs.writeFileSync(twin, '[1,2]', 'utf8');
  const carried = path.join(root, 'store', 'carry-probe.json');
  return [await carryStoreFile('cc-plugin-tips@builtin'), fs.existsSync(carried)];
});

await step('candidate whose file is missing', async () => {
  fs.rmSync(twin, { force: true });
  fs.rmSync(target, { force: true });
  return readStoreFile('cc-plugin-tips@builtin', target);
});
console.log('target exists:', fs.existsSync(target));

await step('a candidate read that finds nothing', () => readStoreCandidate('tips@builtin'));

// The failure branch: a target whose directory cannot be written.
const lockedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-51-locked-'));
bindPluginDataDir(() => lockedRoot);
fs.mkdirSync(path.join(lockedRoot, 'store'), { recursive: true });
fs.writeFileSync(storeFilePath('tips@builtin'), '{"carried":true}', 'utf8');
const lockedTarget = storeFilePath('cc-plugin-tips@builtin');
fs.mkdirSync(path.dirname(lockedTarget), { recursive: true });
fs.chmodSync(path.join(lockedRoot, 'store'), 0o500);
await step('carry into a read-only store directory', () => readStoreFile('cc-plugin-tips@builtin', lockedTarget));
fs.chmodSync(path.join(lockedRoot, 'store'), 0o700);

fs.rmSync(root, { recursive: true, force: true });
fs.rmSync(lockedRoot, { recursive: true, force: true });
