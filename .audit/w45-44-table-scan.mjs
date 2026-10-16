// Enumerate the `$` plugin-method table `Iqo(state)` entry by entry: each top-level key with its
// exact [start,end) span in chunk-sfn1dbxq.js, plus the identifiers its `run`/`check` bodies name.
// The scan is structural (brace/bracket/quote depth), not a guess from the text's shape.
import fs from 'node:fs';

const FILE = process.argv[2] ?? 'extracted-v2/modules/chunk-sfn1dbxq.js';
const text = fs.readFileSync(FILE, 'utf8');
const head = text.indexOf('var Iqo=(e)=>szt({');
if (head < 0) throw new Error('the table head was not found');
const open = head + 'var Iqo=(e)=>szt('.length - 1;
const end = head + 'var Iqo=(e)=>szt({'.length;
let depth = 1;
let i = end;
let state = 'code';
while (i < text.length && depth > 0) {
  const c = text[i];
  const prev = text[i - 1];
  if (state === 'code') {
    if (c === '"' || c === "'" || c === '`') state = c;
    else if (c === '/' && text[i + 1] === '/') { state = 'line'; i += 1; }
    else if (c === '/' && text[i + 1] === '*') { state = 'block'; i += 1; }
    else if ('{[('.includes(c)) depth += 1;
    else if ('}])'.includes(c)) depth -= 1;
  } else if (state === 'line') {
    if (c === '\n') state = 'code';
  } else if (state === 'block') {
    if (c === '*' && text[i + 1] === '/') { state = 'code'; i += 1; }
  } else if (state === c && prev !== '\\') {
    state = 'code';
  }
  i += 1;
}
const tableEnd = i;
const body = text.slice(end, tableEnd - 1);

const entries = [];
let d = 0;
let start = 0;
let st = 'code';
const push = (from, to) => {
  const chunk = body.slice(from, to);
  const key = /^[\s,]*"([^"]+)"\s*:/.exec(chunk);
  if (!key) return;
  const names = [...new Set((chunk.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []))]
    .filter((n) => n !== key[1] && !['run', 'check', 'async', 'await', 'return', 'typeof', 'void',
      'let', 'var', 'const', 'function', 'new', 'if', 'else', 'Promise', 'resolve', 'string',
      'number', 'boolean', 'true', 'false', 'undefined', 'null', 'e', 'n', 'r', 's', 'this'].includes(n));
  entries.push({ key: key[1], span: [end + from, end + to], names });
};
for (let k = 0; k < body.length; k += 1) {
  const c = body[k];
  const prev = body[k - 1];
  if (st === 'code') {
    if (c === '"' || c === "'" || c === '`') st = c;
    else if ('{[('.includes(c)) d += 1;
    else if ('}])'.includes(c)) {
      d -= 1;
      if (d === 0) { push(start, k + 1); start = k + 1; }
    }
  } else if (st === c && prev !== '\\') st = 'code';
}
console.log(JSON.stringify({
  schema: 'W45TableScan.v1',
  file: FILE,
  table: [head, tableEnd],
  entries: entries.map((x) => ({ ...x, units: x.span[1] - x.span[0] })),
}, null, 1));
