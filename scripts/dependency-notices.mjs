import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const records = [], sections = ['LiTcode third-party dependency notices', '',
  'Generated from exact locked, locally installed packages. Dependency licenses',
  'apply to those dependencies; this file grants no project-wide license.', ''];
for (const [relative, record] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!relative || !relative.startsWith('node_modules/')) continue;
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) {
    if (!record.optional) throw new Error(`Required dependency missing: ${relative}`);
    records.push({ path: relative, version: record.version, license: record.license, state: 'optional-not-installed' });
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.version !== record.version) throw new Error(`Dependency version mismatch: ${relative}`);
  const filenames = fs.readdirSync(directory).filter(name => /^licen[sc]e(?:\.|$)|^notice(?:\.|$)|^copying(?:\.|$)/i.test(name));
  const texts = [];
  for (const name of filenames.sort()) {
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error(`Invalid license text: ${relative}/${name}`);
    const bytes = fs.readFileSync(file);
    texts.push({ path: name, sha256: hash(bytes), bytes: bytes.length });
    sections.push(`--- ${manifest.name}@${manifest.version} (${record.license ?? 'undeclared'}) / ${name} ---`, bytes.toString('utf8'), '');
  }
  if (!texts.length) sections.push(`--- ${manifest.name}@${manifest.version} ---`,
    `Package declares ${record.license ?? 'undeclared'}; installed package contains no root license text.`,
    `Repository metadata: ${JSON.stringify(manifest.repository ?? null)}`, '');
  records.push({ path: relative, name: manifest.name, version: manifest.version, license: record.license,
    development: record.dev === true, state: texts.length ? 'text-retained' : 'text-missing', texts });
}
const text = sections.join('\n');
const inventory = { schema: 'DependencyNotices.v1', lockSha256: hash(fs.readFileSync(path.join(root, 'package-lock.json'))),
  noticesSha256: hash(Buffer.from(text)), packages: records };
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path.join(root, 'THIRD_PARTY_NOTICES.txt'), 'utf8') !== text ||
      fs.readFileSync(path.join(root, 'research/ports/dependency-notices.json'), 'utf8') !== JSON.stringify(inventory, null, 2) + '\n') throw new Error('Dependency notices are stale');
} else {
  fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.txt'), text);
  fs.writeFileSync(path.join(root, 'research/ports/dependency-notices.json'), JSON.stringify(inventory, null, 2) + '\n');
}
console.log(JSON.stringify({ installed: records.filter(r => r.state !== 'optional-not-installed').length,
  missingText: records.filter(r => r.state === 'text-missing').map(r => r.name), sha256: inventory.noticesSha256 }));
