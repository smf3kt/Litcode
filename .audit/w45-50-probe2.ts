// W45-50: the two writer behaviours the first probe did not reach — following a symlink target, and
// the in-place fallback when the temp file cannot be created.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeFileAtomically, writeFileWithAtomicOptions } from '../src/plugin-chain-atomic.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-50-probe2-'));
const step = async (label, run) => {
  try {
    console.log(`${label}: ok ->`, JSON.stringify(await run()));
  } catch (error) {
    console.log(`${label}: threw ->`, error?.name, error?.code, JSON.stringify(String(error?.message).slice(0, 120)));
  }
};

const real = path.join(root, 'real.json');
const link = path.join(root, 'link.json');
fs.writeFileSync(real, 'real\n');
fs.symlinkSync(real, link);
await step('write through a symlink with followSymlinks', () => writeFileWithAtomicOptions(link, 'followed\n', { followSymlinks: true }));
console.log('   link is a symlink:', fs.lstatSync(link).isSymbolicLink(), '| link contents:', JSON.stringify(fs.readFileSync(link, 'utf8')), '| real:', JSON.stringify(fs.readFileSync(real, 'utf8')));

const locked = path.join(root, 'read-only-dir');
fs.mkdirSync(locked);
const inside = path.join(locked, 'inside.json');
fs.writeFileSync(inside, 'before\n');
fs.chmodSync(locked, 0o500);
await step('write in a read-only directory (no fallback)', () => writeFileAtomically(inside, 'after\n'));
console.log('   inside:', JSON.stringify(fs.readFileSync(inside, 'utf8')));
await step('write in a read-only directory with inPlaceOnTempCreateRefused', () => writeFileWithAtomicOptions(inside, 'in-place\n', { inPlaceOnTempCreateRefused: true }));
console.log('   inside:', JSON.stringify(fs.readFileSync(inside, 'utf8')), '| entries:', JSON.stringify(fs.readdirSync(locked)));
fs.chmodSync(locked, 0o700);

fs.rmSync(root, { recursive: true, force: true });
