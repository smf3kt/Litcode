import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.audit/w385-async-journal-draft.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const draft = process.argv.includes('--draft');
if (process.argv.slice(2).some(arg => arg !== '--draft')) throw new Error('Usage: node .audit/w385-async-journal-draft.verify.mjs [--draft]');
if (hash(fs.readFileSync(path.join(root, manifest.patch))) !== manifest.patchSha256) throw new Error('Draft patch digest changed');
for (const file of manifest.files) {
  const absolute = path.join(root, file.path), expected = draft ? file.after : file.before;
  const actual = fs.existsSync(absolute) ? hash(fs.readFileSync(absolute)) : null;
  if (actual !== expected) throw new Error(`Changed ${draft ? 'draft' : 'base'} file: ${file.path}`);
}
const check = spawnSync('git', ['apply', '--check', ...(draft ? ['--reverse'] : []), manifest.patch], { cwd: root, encoding: 'utf8' });
if (check.status !== 0) throw new Error(check.stderr);
console.log(JSON.stringify({ schema: manifest.schema, state: draft ? 'draft' : 'base', paths: manifest.files.length,
  patchSha256: manifest.patchSha256, applicable: true, activated: false }));
