// Size the remaining `$` table entries' bodies: which chunk provides each name, and how big the
// declaration there is. The binding comes from the table module's own import header, so a short
// name is never assumed to mean one body.
import fs from 'node:fs';

const TABLE = 'extracted-v2/modules/chunk-sfn1dbxq.js';
const DIR = 'extracted-v2/modules/';
const table = fs.readFileSync(TABLE, 'utf8');

const imports = new Map();
{
  const re = /import\{([^}]*)\}from"([^"]+)";/g;
  let m; let last = 0;
  while ((m = re.exec(table)) !== null) {
    const between = table.slice(last, m.index).replace(/\/\/[^\n]*\n?/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (between.trim() !== '') break;
    for (const n of m[1].split(',')) imports.set(n.trim(), m[2].split('/').pop());
    last = m.index + m[0].length;
  }
}

const balanced = (text, from) => {
  let depth = 0; let state = 'code'; let i = from;
  for (; i < text.length; i += 1) {
    const c = text[i]; const prev = text[i - 1];
    if (state === 'code') {
      if (c === '"' || c === "'" || c === '`') state = c;
      else if ('{[('.includes(c)) depth += 1;
      else if ('}])'.includes(c)) { depth -= 1; if (depth === 0) return i + 1; }
    } else if (state === c && prev !== '\\') state = 'code';
  }
  return i;
};

/** The declaration of `name` in `text`, or null: a top-level function or a `var` initialiser. */
const declare = (text, name) => {
  const esc = name.replace(/\$/g, '\\$');
  const fn = new RegExp(`(?:^|[;}{,)\\n])(async\\s+)?function\\s+${esc}\\s*\\(`).exec(text);
  if (fn) {
    const at = fn[0].startsWith('async') ? fn.index : fn.index + fn[0].indexOf('function');
    return { kind: 'function', span: [at, balanced(text, text.indexOf('{', at))] };
  }
  const v = new RegExp(`(?:^|[;}\\n,])var\\s+${esc}\\s*=`).exec(text)
    ?? new RegExp(`(?:^|[;}{])var\\s+[A-Za-z_$][A-Za-z0-9_$]*(?:,[A-Za-z_$][A-Za-z0-9_$]*)*,${esc}\\s*=`).exec(text);
  if (v) {
    const at = v.index + v[0].indexOf('var');
    const eq = text.indexOf('=', at) + 1;
    let end = balanced(text, eq);
    while (end > eq && /^\s*=>/.test(text.slice(end, end + 8))) {
      const body = text.slice(end).search(/\S/);
      end = balanced(text, end + body);
    }
    return { kind: 'var', span: [at, end > eq ? end : eq] };
  }
  return null;
};

const names = JSON.parse(process.argv[2]);
const cache = new Map();
const load = (chunk) => {
  if (!cache.has(chunk)) cache.set(chunk, fs.readFileSync(DIR + chunk, 'utf8'));
  return cache.get(chunk);
};
const rows = [];
for (const name of names) {
  const chunk = imports.get(name) ?? TABLE.split('/').pop();
  const text = load(chunk);
  const decl = declare(text, name);
  rows.push({ name, chunk, kind: decl?.kind ?? null, span: decl?.span ?? null,
    units: decl ? decl.span[1] - decl.span[0] : null,
    text: decl ? text.slice(decl.span[0], Math.min(decl.span[1], decl.span[0] + 120)) : null });
}
console.log(JSON.stringify({ schema: 'W45BodySize.v1', rows }, null, 1));
