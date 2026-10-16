// W45-51 probe 2: the carry's two remaining branches — a store already carried by another session, and
// content the parse refuses.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bindPluginDataDir, storeFilePath } from '../src/plugin-chain-store-path.js';
import { carryStoreFile, builtinTwinIds, readStoreFile } from '../src/plugin-chain-store-carry.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-51-probe2-'));
bindPluginDataDir(() => root);
fs.mkdirSync(path.join(root, 'store'), { recursive: true });
const twin = storeFilePath('tips@builtin');
const target = storeFilePath('cc-plugin-tips@builtin');
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`);
const store = path.join(root, 'store');

fs.writeFileSync(twin, '{"carried":1}', 'utf8');
clearChainRecords();
console.log('carry with no store present:', await carryStoreFile('cc-plugin-tips@builtin'), '| target:', fs.existsSync(target), '| logs:', JSON.stringify(logs()));
clearChainRecords();
console.log('carry again, target now present:', await carryStoreFile('cc-plugin-tips@builtin'), '| logs:', JSON.stringify(logs()));
console.log('target still the first carry:', JSON.stringify(fs.readFileSync(target, 'utf8')), '| carry files:', JSON.stringify(fs.readdirSync(store).filter((n) => n.includes('.carry-'))));

fs.rmSync(target, { force: true });
fs.writeFileSync(twin, '{"carried":2}', 'utf8');
clearChainRecords();
console.log('carry after the target is removed:', await carryStoreFile('cc-plugin-tips@builtin'), '| contents:', JSON.stringify(fs.readFileSync(target, 'utf8')), '| logs:', JSON.stringify(logs()));

fs.rmSync(target, { force: true });
fs.writeFileSync(twin, '{not json', 'utf8');
clearChainRecords();
console.log('carry with unparseable content:', await carryStoreFile('cc-plugin-tips@builtin'), '| target:', fs.existsSync(target), '| logs:', JSON.stringify(logs()));
console.log('read with unparseable content:', await readStoreFile('cc-plugin-tips@builtin', target), '| target:', fs.existsSync(target));

fs.writeFileSync(twin, 'null', 'utf8');
clearChainRecords();
console.log('carry with null content:', await carryStoreFile('cc-plugin-tips@builtin'), '| target:', fs.existsSync(target), '| logs:', JSON.stringify(logs()));

fs.writeFileSync(twin, '{"carried":3}', 'utf8');
console.log('twin ids, unbound then bound:', JSON.stringify(builtinTwinIds('cc-plugin-tips@builtin')));
console.log('store files now:', JSON.stringify(fs.readdirSync(store).sort()));

fs.rmSync(root, { recursive: true, force: true });
