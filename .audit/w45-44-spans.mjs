// Exact spans for the W45-44 blocks: the declaration start includes its own keywords (`async
// function `, `var `), and the end is the balanced closer, so a copied range is a whole statement.
import fs from 'node:fs';

const DIR = 'extracted-v2/modules';
const jobs = JSON.parse(process.argv[2]);
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
const rows = [];
for (const { chunk, name } of jobs) {
  const text = fs.readFileSync(`${DIR}/${chunk}`, 'utf8');
  const esc = name.replace(/\$/g, '\\$');
  const fn = new RegExp(`async\\s+function\\s+${esc}\\s*\\(|(?:^|[;}\\n])function\\s+${esc}\\s*\\(`);
  const v = new RegExp(`(?:^|[;}\\n])var\\s+${esc}\\s*=`);
  let span = null; let kind = null;
  let m = fn.exec(text);
  if (m) {
    const at = m[0].startsWith('async') ? m.index : m.index + m[0].indexOf('function');
    const brace = text.indexOf('{', at);
    span = [at, balanced(text, brace)]; kind = 'function';
  } else if ((m = v.exec(text))) {
    const at = m.index + m[0].indexOf('var');
    const eq = text.indexOf('=', at) + 1;
    let end = balanced(text, eq);
    // `var x=(a)=>body` closes its parameter list at depth zero before the body: keep going while
    // the next non-space characters are the arrow, so the range covers the whole initialiser.
    while (end > eq && /^\s*=>/.test(text.slice(end, end + 8))) {
      const body = text.slice(end).search(/\S/);
      end = balanced(text, end + body);
    }
    span = [at, end > eq ? end : eq]; kind = 'var';
  }
  rows.push({ chunk, name, kind, span, units: span ? span[1] - span[0] : 0,
    text: span ? text.slice(span[0], Math.min(span[1], span[0] + 200)) : null });
}
console.log(JSON.stringify({ schema: 'W45SpanScan.v1', rows }, null, 1));
