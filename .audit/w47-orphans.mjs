// The strip left 53 TS2304s: names whose binding a deletion removed. Attribute each one before
// touching it — an orphan caused by the strip is a use of a removed feature, but a name that was
// never imported in the backup either is a pre-existing gap and not this task's.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const LOG = process.argv[2] ?? '/tmp/w47-strip5.txt';

const rows = [];
for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)\((\d+),(\d+)\): error TS2304: Cannot find name '([^']+)'\.$/);
  if (!m) continue;
  const [, file, lineNo, col, name] = m;
  rows.push({ file, line: Number(lineNo), col: Number(col), name });
}

// Which strip touched this file? Either pass kept a backup.
const backupOf = (file) => {
  for (const ext of ['.w47bak', '.w47p2bak']) {
    const p = path.join(HARNESS, file + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const sourceLine = (file, lineNo) => {
  const lines = fs.readFileSync(path.join(HARNESS, file), 'utf8').split('\n');
  return (lines[lineNo - 1] ?? '').trim().slice(0, 120);
};

const bindingIn = (file, name) => {
  const full = path.join(HARNESS, file);
  const text = fs.readFileSync(full, 'utf8');
  // A binding form, not a use: `name,` / `name }` inside import braces, `{ name` destructuring,
  // `const name =`, `function name(`.
  const patterns = [
    new RegExp(`import[^;]*[{,\\s]${name}\\s*[,}]`, 's'),
    new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b`, 's'),
    new RegExp(`(?:const|let|var)\\s+${name}\\b`),
    new RegExp(`(?:interface|type|class|function|enum)\\s+${name}\\b`),
    new RegExp(`[{,]\\s*${name}\\s*[,}]`, 's'),
  ];
  const inText = patterns.some((p) => p.test(text));
  const backup = backupOf(file);
  const inBackup = backup === null ? null : patterns.some((p) => p.test(fs.readFileSync(backup, 'utf8')));
  return { inText, inBackup, backup: backup === null ? null : path.basename(backup) };
};

const out = rows.map((r) => ({ ...r, source: sourceLine(r.file, r.line), ...bindingIn(r.file, r.name) }));
const byName = {};
for (const r of out) byName[r.name] = (byName[r.name] ?? 0) + 1;

console.log(`TS2304 sites ${out.length} | distinct names ${Object.keys(byName).length}`);
const att = { stripped: 0, preexisting: 0, unknown: 0 };
for (const r of out) {
  if (r.inBackup === true && r.inText === false) att.stripped += 1;
  else if (r.inBackup === false) att.preexisting += 1;
  else att.unknown += 1;
}
console.log('attribution:', JSON.stringify(att), '(stripped = bound in backup, absent now)');
console.log('');
for (const [name, n] of Object.entries(byName).sort((a, b) => b[1] - a[1])) {
  console.log(`${name}  x${n}`);
  for (const r of out.filter((x) => x.name === name)) {
    const tag = r.inBackup === true && r.inText === false ? 'STRIPPED' : r.inBackup === false ? 'PRE' : '?';
    console.log(`    [${tag}] ${r.file}:${r.line}  ${r.source}`);
  }
}
fs.writeFileSync('.audit/w47-orphans.json', JSON.stringify({ rows: out }, null, 1) + '\n');
