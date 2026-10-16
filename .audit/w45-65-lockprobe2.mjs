// Which handle leaks its refresh timer? Each variant runs one sequence and waits 1.5s.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquirePluginStoreLock, releasePluginStoreLock } from '../dist/plugin-chain-lockfile.js';

const mode = process.argv[2];
process.on('uncaughtException', (error) => { console.log(mode, 'uncaught:', error.code); process.exit(9); });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-65-lock-'));
const file = path.join(root, 'x.json');
fs.writeFileSync(file, '{}', 'utf8');

if (mode === 'plain') {
  const handle = await acquirePluginStoreLock(file, { stale: 2000, update: 60_000 });
  await releasePluginStoreLock(handle, 'plain');
} else if (mode === 'takeover-taker-only') {
  const holder = await acquirePluginStoreLock(file, { stale: 2000, update: 60_000 });
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(`${file}.lock`, past, past);
  const taker = await acquirePluginStoreLock(file, { stale: 2000 });
  await releasePluginStoreLock(taker, 'taker');
  console.log(mode, 'holder still held');
} else if (mode === 'takeover-both') {
  const holder = await acquirePluginStoreLock(file, { stale: 2000, update: 60_000 });
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(`${file}.lock`, past, past);
  const taker = await acquirePluginStoreLock(file, { stale: 2000 });
  await releasePluginStoreLock(holder, 'displaced');
  await releasePluginStoreLock(taker, 'taker');
}
fs.rmSync(root, { recursive: true, force: true });
setTimeout(() => { console.log(mode, 'alive, no complaint'); process.exit(0); }, 1500);
