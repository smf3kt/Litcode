// W45-49: measure the lockfile library's real behaviour before anything is asserted about it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquirePluginStoreLock, checkPluginStoreLock, releasePluginStoreLock } from '../src/plugin-chain-lockfile.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-49-probe-'));
const file = path.join(root, 'store.json');
fs.writeFileSync(file, '{}', 'utf8');
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`);
const step = async (label, run) => {
  clearChainRecords();
  try {
    const value = await run();
    console.log(`${label}: ok ->`, describe(value));
  } catch (error) {
    console.log(`${label}: threw ->`, error?.code ?? error?.constructor?.name, JSON.stringify(String(error?.message)));
  }
  const lines = logs();
  if (lines.length) console.log(`${label}: logs ->`, JSON.stringify(lines));
};
const describe = (value) => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).map((k) => `${k}:${typeof value[k]}`).join(', ')}} asyncDispose=${typeof value[Symbol.asyncDispose]}`;
  }
  return typeof value;
};

console.log('lock dir exists before:', fs.existsSync(`${file}.lock`));
let handle;
await step('acquire', async () => { handle = await acquirePluginStoreLock(file); return handle; });
console.log('lock dir exists after acquire:', fs.existsSync(`${file}.lock`));
console.log('lock dir mode:', fs.statSync(`${file}.lock`).mode.toString(8));
await step('check while held', () => checkPluginStoreLock(file));
await step('second acquire (default retries)', () => acquirePluginStoreLock(file));
await step('second acquire (retries 1, minTimeout 5)', () => acquirePluginStoreLock(file, { retries: 1, minTimeout: 5, maxTimeout: 5 }));
await step('release', () => releasePluginStoreLock(handle, 'probe'));
console.log('lock dir exists after release:', fs.existsSync(`${file}.lock`));
await step('check after release', () => checkPluginStoreLock(file));
await step('release twice', () => releasePluginStoreLock(handle, 'probe'));
await step('release undefined', () => releasePluginStoreLock(undefined, 'probe'));
await step('acquire missing file', () => acquirePluginStoreLock(path.join(root, 'absent.json')));
await step('check missing file', () => checkPluginStoreLock(path.join(root, 'absent.json')));
await step('check when never locked', () => checkPluginStoreLock(path.join(root, 'never.json')));

// A stale lock: take one, stop its updates by writing an old mtime on the lock directory, then take it.
const stale = path.join(root, 'stale.json');
fs.writeFileSync(stale, '{}', 'utf8');
const held = await acquirePluginStoreLock(stale, { stale: 2000, update: 60_000 });
const past = new Date(Date.now() - 60_000);
fs.utimesSync(`${stale}.lock`, past, past);
await step('acquire over a stale lock', () => acquirePluginStoreLock(stale, { stale: 2000 }));
await step('release the stale holder', () => releasePluginStoreLock(held, 'stale'));
console.log('stale lock dir exists:', fs.existsSync(`${stale}.lock`));

// The disposer, called directly: the same release path the runtime would take.
const disposed = path.join(root, 'disposed.json');
fs.writeFileSync(disposed, '{}', 'utf8');
const disposeHandle = await acquirePluginStoreLock(disposed);
await step('asyncDispose', () => disposeHandle[Symbol.asyncDispose]());
console.log('disposed lock dir exists:', fs.existsSync(`${disposed}.lock`));

// A lock path the library cannot create: a lockfile path inside a directory that does not exist.
await step('acquire with an unusable lockfilePath', () => acquirePluginStoreLock(file, { lockfilePath: path.join(root, 'absent-dir', 'x.lock') }));

fs.rmSync(root, { recursive: true, force: true });
