// W45-50: measure the atomic writer's real behaviour before anything is asserted about it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeFileAtomically, writeFileWithAtomicOptions } from '../src/plugin-chain-atomic.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-50-probe-'));
const entries = () => fs.readdirSync(root).sort();
const step = async (label, run) => {
  try {
    const value = await run();
    console.log(`${label}: ok ->`, value === undefined ? 'undefined' : JSON.stringify(value));
  } catch (error) {
    console.log(`${label}: threw ->`, error?.name, error?.code, JSON.stringify(String(error?.message).slice(0, 120)));
  }
  console.log(`   entries: ${JSON.stringify(entries())}`);
};

const fresh = path.join(root, 'fresh.json');
await step('write a new file', () => writeFileAtomically(fresh, '{"a":1}\n', 0o600));
console.log('   contents:', JSON.stringify(fs.readFileSync(fresh, 'utf8')), 'mode', fs.statSync(fresh).mode.toString(8));

await step('overwrite it', () => writeFileAtomically(fresh, '{"a":2}\n', 0o600));
console.log('   contents:', JSON.stringify(fs.readFileSync(fresh, 'utf8')), 'mode', fs.statSync(fresh).mode.toString(8));

const plain = path.join(root, 'plain.json');
await step('write with no mode at all', () => writeFileAtomically(plain, 'plain\n'));
console.log('   mode', fs.statSync(plain).mode.toString(8));

const exact = path.join(root, 'exact.json');
fs.writeFileSync(exact, 'old\n', { mode: 0o644 });
await step('write with exactMode 0o600', () => writeFileWithAtomicOptions(exact, 'new\n', { exactMode: 0o600 }));
console.log('   contents:', JSON.stringify(fs.readFileSync(exact, 'utf8')), 'mode', fs.statSync(exact).mode.toString(8));

const flushed = path.join(root, 'flush.json');
await step('write with flush and exactMode', () => writeFileWithAtomicOptions(flushed, 'flushed\n', { exactMode: 0o600, flush: true }));
console.log('   contents:', JSON.stringify(fs.readFileSync(flushed, 'utf8')));

const refused = path.join(root, 'refused.json');
await step('beforePublish refuses (target exists)', () => writeFileWithAtomicOptions(refused, 'nope\n', { beforePublish: () => false }));
console.log('   exists:', fs.existsSync(refused));
const refusedNew = path.join(root, 'refused-new.json');
await step('beforePublish refuses (target absent)', () => writeFileWithAtomicOptions(refusedNew, 'nope\n', { beforePublish: () => false }));
console.log('   exists:', fs.existsSync(refusedNew));

const staging = path.join(root, 'staging');
fs.mkdirSync(staging);
const staged = path.join(root, 'staged.json');
await step('stagingDir', () => writeFileWithAtomicOptions(staged, 'staged\n', { stagingDir: staging }));
console.log('   contents:', JSON.stringify(fs.readFileSync(staged, 'utf8')), 'staging entries:', JSON.stringify(fs.readdirSync(staging)));
const badStaging = path.join(root, 'no-such-dir');
await step('stagingDir that does not exist', () => writeFileWithAtomicOptions(staged, 'x\n', { stagingDir: badStaging }));

const renamed = path.join(root, 'renamed.json');
await step('renameFn that works', () => writeFileWithAtomicOptions(renamed, 'renamed\n', {
  renameFn: async (from, to) => { fs.renameSync(from, to); },
}));
console.log('   contents:', JSON.stringify(fs.readFileSync(renamed, 'utf8')));

const failRename = path.join(root, 'fail-rename.json');
await step('renameFn that throws EIO (not retryable)', () => writeFileWithAtomicOptions(failRename, 'x\n', {
  renameFn: async () => { throw Object.assign(new Error('io'), { code: 'EIO' }); },
}));
console.log('   exists:', fs.existsSync(failRename));

const exdev = path.join(root, 'exdev.json');
fs.writeFileSync(exdev, 'before\n');
let renames = 0;
await step('renameFn that throws EXDEV (the in-place fallback)', () => writeFileWithAtomicOptions(exdev, 'after\n', {
  renameFn: async () => { renames += 1; throw Object.assign(new Error('cross-device'), { code: 'EXDEV' }); },
}));
console.log('   rename attempts:', renames, 'contents:', JSON.stringify(fs.readFileSync(exdev, 'utf8')));

const target = path.join(root, 'real.json');
const link = path.join(root, 'link.json');
fs.writeFileSync(target, 'real\n');
fs.symlinkSync(target, link);
await step('write through a symlink (default)', () => writeFileAtomically(link, 'through\n'));
console.log('   link is still a symlink:', fs.lstatSync(link).isSymbolicLink(), 'real:', JSON.stringify(fs.readFileSync(target, 'utf8')));

fs.rmSync(root, { recursive: true, force: true });
