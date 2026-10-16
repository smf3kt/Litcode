// W45-49: the two timing behaviours the tests will assert — a waiting acquire that wins once the
// holder releases inside its retry window, and a displaced holder's release.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquirePluginStoreLock, checkPluginStoreLock, releasePluginStoreLock } from '../src/plugin-chain-lockfile.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-49-timing-'));
const file = path.join(root, 's.json');
fs.writeFileSync(file, '{}');

const first = await acquirePluginStoreLock(file);
clearChainRecords();
const started = Date.now();
const waiting = acquirePluginStoreLock(file, { retries: { retries: 50, minTimeout: 20, maxTimeout: 20 } });
setTimeout(() => { first().then(() => console.log('first released at', Date.now() - started, 'ms')); }, 60);
try {
  const second = await waiting;
  console.log('waiting acquire won after', Date.now() - started, 'ms');
  console.log('check after win', await checkPluginStoreLock(file));
  await releasePluginStoreLock(second, 'probe');
  console.log('dir after releasing the winner', fs.existsSync(`${file}.lock`));
} catch (error) {
  console.log('waiting acquire failed', error?.code, error?.message);
}
console.log('logs', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => r.message)));

// A displaced holder: take a lock, let it go stale, let someone else take it, then release the first.
const stale = path.join(root, 'stale.json');
fs.writeFileSync(stale, '{}');
const holder = await acquirePluginStoreLock(stale, { stale: 2000, update: 60_000 });
const past = new Date(Date.now() - 60_000);
fs.utimesSync(`${stale}.lock`, past, past);
const taker = await acquirePluginStoreLock(stale, { stale: 2000 });
console.log('taker holds', await checkPluginStoreLock(stale));
clearChainRecords();
await releasePluginStoreLock(holder, 'displaced');
console.log('displaced release logs', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => r.message)));
console.log('dir after displaced release', fs.existsSync(`${stale}.lock`), '| taker check', await checkPluginStoreLock(stale));
await releasePluginStoreLock(taker, 'taker');
console.log('dir after taker release', fs.existsSync(`${stale}.lock`));

// The release wrapper's two other branches, with handles that are not the library's.
clearChainRecords();
await releasePluginStoreLock((async () => { throw Object.assign(new Error('boom'), { code: 'EACCES' }); }) as never, 'custom');
console.log('custom-failure logs', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`)));
clearChainRecords();
await releasePluginStoreLock((async () => { throw { get code() { throw new Error('unreadable'); } }; }) as never, 'custom');
console.log('undescribable logs', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`)));
clearChainRecords();
await releasePluginStoreLock((async () => { throw 'a bare string'; }) as never, 'custom');
console.log('string-failure logs', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`)));

fs.rmSync(root, { recursive: true, force: true });
