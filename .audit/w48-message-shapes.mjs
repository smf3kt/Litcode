// What does the tree itself pin about the message types? The declarations are gone from both
// artifacts (a bundle erases type-only modules), but the consumers compare `type` and `subtype`
// against literal values and read named fields. Those comparisons are evidence of the union's
// discriminators; anything not evidenced stays permissive.
//
//   node .audit/w48-message-shapes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const ts = createRequire(import.meta.url)('/tmp/w47-tools/node_modules/typescript');
const stubs = JSON.parse(fs.readFileSync('.audit/w48-stubs.json', 'utf8'));
const messageStub = stubs.find((s) => s.file === 'types/message.ts');

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'recovered', '.git', 'shims'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name) && !/\.w47[a-z0-9]*bak$/.test(e.name)) out.push(p);
  }
  return out;
};

// Every `X.type === 'lit'`, `X.subtype === 'lit'`, `case 'lit':` inside a switch on a message, and
// every `'field' in X` probe. Collected with the file and line so each pin can be cited.
const typeLits = new Map(); // literal -> [{file,line}]
const subtypeLits = new Map();
const inFields = new Map();
const add = (map, key, site) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(site);
};

for (const full of walk(HARNESS)) {
  const rel = path.relative(HARNESS, full);
  const text = fs.readFileSync(full, 'utf8');
  if (!/\.(type|subtype) === ['"]|' in \w/.test(text)) continue;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\.type === ['"]([a-z_]+)['"]/g)) add(typeLits, m[1], { file: rel, line: i + 1 });
    for (const m of line.matchAll(/\.subtype === ['"]([a-z_]+)['"]/g)) add(subtypeLits, m[1], { file: rel, line: i + 1 });
    for (const m of line.matchAll(/['"]([a-z_]+)['"] in \w+/g)) add(inFields, m[1], { file: rel, line: i + 1 });
  });
}

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const stripRole = (base) => {
  let b = base;
  for (const p of ['system_', 'sdk_', 'claude_', 'normalized_', 'user_', 'assistant_']) if (b.startsWith(p)) b = b.slice(p.length);
  for (const suf of ['_message', '_type', '_event', '_data', '_info', '_block', '_delta', '_group']) if (b.endsWith(suf)) b = b.slice(0, -suf.length);
  return b;
};

const rows = [];
for (const name of messageStub.names) {
  const cand = stripRole(snake(name));
  const t = typeLits.get(cand);
  const st = subtypeLits.get(cand);
  rows.push({
    name,
    candidate: cand,
    asType: t ? { count: t.length, first: t[0] } : null,
    asSubtype: st ? { count: st.length, first: st[0] } : null,
  });
}

const evidenced = rows.filter((r) => r.asType || r.asSubtype);
console.log(`types/message.ts: ${messageStub.names.length} names | discriminator evidenced for ${evidenced.length}`);
for (const r of rows) {
  const tag = r.asType ? `type="${r.candidate}" x${r.asType.count} (${r.asType.first.file}:${r.asType.first.line})`
    : r.asSubtype ? `subtype="${r.candidate}" x${r.asSubtype.count} (${r.asSubtype.first.file}:${r.asSubtype.first.line})`
    : '—';
  console.log(`  ${r.name.padEnd(40)} ${tag}`);
}
console.log(`\ndistinct type literals seen: ${typeLits.size}`);
console.log([...typeLits].sort((a, b) => b[1].length - a[1].length).slice(0, 25).map(([k, v]) => `${k}(${v.length})`).join(' '));
console.log(`\ndistinct subtype literals seen: ${subtypeLits.size}`);
console.log([...subtypeLits].sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `${k}(${v.length})`).join(' '));
fs.writeFileSync('.audit/w48-message-shapes.json', JSON.stringify({ rows, typeLits: Object.fromEntries([...typeLits].map(([k, v]) => [k, v.length])), subtypeLits: Object.fromEntries([...subtypeLits].map(([k, v]) => [k, v.length])) }, null, 1) + '\n');
