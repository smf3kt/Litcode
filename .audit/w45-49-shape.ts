// W45-49: the shape of the handle an acquisition answers, measured before the seam types it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquirePluginStoreLock } from '../src/plugin-chain-lockfile.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-49-shape-'));
const file = path.join(root, 's.json');
fs.writeFileSync(file, '{}');
const handle = await acquirePluginStoreLock(file) as unknown as Record<string | symbol, unknown> & (() => Promise<void>);
console.log('typeof handle', typeof handle);
console.log('own props', Object.getOwnPropertyNames(handle));
console.log('symbols', Object.getOwnPropertySymbols(handle).map(String));
console.log('release prop', typeof handle.release);
console.log('asyncDispose === handle', handle[Symbol.asyncDispose] === handle);
console.log('await handle() ->', await (handle as () => Promise<void>)());
console.log('dir after', fs.existsSync(`${file}.lock`));
fs.rmSync(root, { recursive: true, force: true });
