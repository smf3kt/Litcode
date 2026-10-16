// Reproduce the leaked refresh timer in the lockfile driver block, in isolation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquirePluginStoreLock, checkPluginStoreLock, releasePluginStoreLock } from '../dist/plugin-chain-lockfile.js';

process.on('uncaughtException', (error) => {
  console.log('uncaught:', error.code, error.path);
  process.exit(9);
});
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-65-lock-'));
const staleFile = path.join(root, 'stale.json');
fs.writeFileSync(staleFile, '{}', 'utf8');
const holder = await acquirePluginStoreLock(staleFile, { stale: 2000, update: 60_000 });
const past = new Date(Date.now() - 60_000);
fs.utimesSync(`${staleFile}.lock`, past, past);
const taker = await acquirePluginStoreLock(staleFile, { stale: 2000 });
console.log('taken over:', await checkPluginStoreLock(staleFile));
await releasePluginStoreLock(holder, 'displaced');
await releasePluginStoreLock(taker, 'taker');
fs.rmSync(root, { recursive: true, force: true });
console.log('block done');
setTimeout(() => { console.log('still alive after 2s'); process.exit(0); }, 2000);
