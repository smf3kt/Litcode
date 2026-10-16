// Resolve an imported name across chunks: read the providing chunk's own ESM export list to learn
// the local name it exports under the wanted name, then report that local declaration's span and
// body. Two chunks can export the same short name, so the export list is the only honest route.
import fs from 'node:fs';

const DIR = 'extracted-v2/modules';
const jobs = JSON.parse(process.argv[2]);

const balanced = (text, from) => {
  let depth = 0;
  let state = 'code';
  let i = from;
  for (; i < text.length; i += 1) {
    const c = text[i];
    const prev = text[i - 1];
    if (state === 'code') {
      if (c === '"' || c === "'" || c === '`') state = c;
      else if ('{[('.includes(c)) depth += 1;
      else if ('}])'.includes(c)) { depth -= 1; if (depth === 0) return i + 1; }
    } else if (state === c && prev !== '\\') state = 'code';
  }
  return i;
};

const rows = [];
for (const { chunk, name } of jobs) {
  const text = fs.readFileSync(`${DIR}/${chunk}`, 'utf8');
  const exportAt = text.lastIndexOf('export{');
  const list = text.slice(exportAt, text.indexOf('}', exportAt));
  const entries = list.slice('export{'.length).split(',').map((s) => s.trim());
  const entry = entries.find((s) => s === name || s.endsWith(` as ${name}`));
  const local = entry === undefined ? null : (entry.includes(' as ') ? entry.split(' as ')[0].trim() : entry);
  if (local === null) { rows.push({ chunk, name, exported: false, exports: entries.length }); continue; }
  let decl = null;
  for (const [re, kind] of [[new RegExp(`\\bfunction\\s+${local.replace(/\$/g, '\\$')}\\s*\\(`), 'function'],
    [new RegExp(`\\b(?:var|let|const)\\s+${local.replace(/\$/g, '\\$')}\\s*=`), 'var']]) {
    const m = re.exec(text);
    if (!m) continue;
    let end = m.index + m[0].length;
    if (kind === 'function') { const brace = text.indexOf('{', m.index); end = balanced(text, brace); }
    else { const start = text.indexOf('=', m.index) + 1; const e2 = balanced(text, start); end = e2 > start ? e2 : start; }
    decl = { kind, span: [m.index, end], units: end - m.index, text: text.slice(m.index, Math.min(end, m.index + 300)) };
    break;
  }
  rows.push({ chunk, name, exported: true, local, exports: entries.length, decl });
}
console.log(JSON.stringify({ schema: 'W45CrossResolve.v1', rows }, null, 1));
