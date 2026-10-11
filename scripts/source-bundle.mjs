import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node scripts/source-bundle.mjs NEW_DIRECTORY');
const out = path.resolve(destination);
if (out === root || out.startsWith(path.join(root, 'src') + path.sep)) throw new Error('Source bundle output overlaps source');
if (fs.existsSync(out)) throw new Error('Source bundle output must be a new directory');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = [];
const add = relative => {
  const file = path.join(root, relative), stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`Source input is a symlink: ${relative}`);
  if (stat.isDirectory()) { for (const name of fs.readdirSync(file).sort()) add(path.posix.join(relative, name)); return; }
  if (!stat.isFile()) throw new Error(`Source input is not a regular file: ${relative}`);
  const bytes = fs.readFileSync(file);
  files.push({ path: relative, bytes: bytes.length, sha256: hash(bytes), mode: stat.mode & 0o777, data: bytes });
};
for (const name of ['src', 'bin', 'scripts', 'test', 'package.json', 'package-lock.json', 'tsconfig.json',
  'tsconfig.build.json', 'README.md', 'NOTICE.md', 'THIRD_PARTY_NOTICES.txt', 'research/ports/dependency-notices.json']) add(name);
files.sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync(out, { mode: 0o700 });
try {
  for (const item of files) {
    const file = path.join(out, item.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, item.data, { flag: 'wx', mode: item.mode });
  }
  const records = files.map(({ data, ...record }) => record);
  const manifest = { schema: 'LiTcodeSourceBundle.v1', sha256: hash(Buffer.from(JSON.stringify(records))), files: records,
    build: ['npm ci --ignore-scripts', 'npm run check', 'npm run build'],
    excluded: ['node_modules', 'dist', 'extracted samples', 'research inventories', 'session data', 'credentials'],
    projectLicense: 'UNLICENSED; private distribution pending owner licensing decision' };
  fs.writeFileSync(path.join(out, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ sourceBundle: out, files: records.length, sha256: manifest.sha256 }));
} catch (error) {
  // Keep the incomplete directory for inspection; never remove caller-owned paths.
  throw new Error(`Source bundle incomplete at ${out}: ${error instanceof Error ? error.message : String(error)}`);
}
