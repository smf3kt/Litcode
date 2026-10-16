// Resolve minified names in one recovered module to their declaration site: the byte span of the
// declaration (function body or initialiser expression, balanced), and the identifiers it names.
// A name is reported per occurrence, because the same short name means different bodies in
// different chunks and occasionally twice in one chunk.
import fs from 'node:fs';

const FILE = process.env.W45_FILE ?? 'extracted-v2/modules/chunk-sfn1dbxq.js';
const text = fs.readFileSync(FILE, 'utf8');
const names = process.argv.slice(2);
if (!names.length) throw new Error('usage: w45-44-resolve.mjs NAME…');

/** End of a balanced expression starting at `from` (which must hold an opener). */
const balanced = (from) => {
  let depth = 0;
  let state = 'code';
  let i = from;
  for (; i < text.length; i += 1) {
    const c = text[i];
    const prev = text[i - 1];
    if (state === 'code') {
      if (c === '"' || c === "'" || c === '`') state = c;
      else if ('{[('.includes(c)) depth += 1;
      else if ('}])'.includes(c)) {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    } else if (state === c && prev !== '\\') state = 'code';
  }
  return i;
};

const rows = [];
for (const name of names) {
  const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
  let m;
  let hits = 0;
  while ((m = re.exec(text)) !== null) {
    const at = m.index;
    const before = text.slice(Math.max(0, at - 24), at);
    let kind = null;
    let start = at;
    let end = at + name.length;
    if (/\bfunction\s+$/.test(before)) {
      kind = 'function';
      const brace = text.indexOf('{', at);
      end = balanced(brace);
    } else if (/\b(class)\s+$/.test(before)) {
      kind = 'class';
      const brace = text.indexOf('{', at);
      end = balanced(brace);
    } else if (/(^|[;{}(,]|\bvar |\blet |\bconst )\s*$/.test(before) && text[at + name.length] === '=') {
      kind = 'var';
      const expr = text.indexOf('=', at) + 1;
      end = balanced(expr) > expr ? balanced(expr) : expr;
      start = at;
    } else {
      hits += 1;
      if (hits > 6) continue;
      kind = 'reference';
    }
    const body = text.slice(start, end);
    const ids = [...new Set(body.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [])]
      .filter((n) => n !== name && n.length > 1)
      .slice(0, 26);
    rows.push({ name, kind, span: [start, end], units: end - start,
      text: kind === 'reference' ? text.slice(at - 30, at + 40) : body.length > 240 ? body.slice(0, 240) + '…' : body,
      names: ids });
    hits += 1;
    if (hits > 8) break;
  }
}
console.log(JSON.stringify({ schema: 'W45NameResolve.v1', file: FILE, rows }, null, 1));
