import fs from 'node:fs';
const file = 'extracted-v2/modules/chunk-kjfwbh4w.js';
const s = fs.readFileSync(file, 'utf8');
function endOf(at) {
  const bodyAt = s.indexOf('){', at) + 1;
  let i = bodyAt, depth = 0, quote = null;
  for (; i < s.length; i += 1) {
    const c = s[i];
    if (quote) { if (c === '\\') { i += 1; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return i;
}
let total = 0;
for (const needle of ['function je(', 'function yt(', 'function pr(', 'function ar(', 'function lr(', 'function mr(', 'function fr(', 'function ur(', 'var cr=', 'var dr=', 'function xr(', 'var $e=', 'function hdn(', 'var TU=', 'function VH(']) {
  const at = s.indexOf(needle);
  const end = needle.startsWith('var ') ? s.indexOf(';', at) + 1 : endOf(at);
  total += end - at;
  console.log(needle, `[${at},${end})`, end - at, JSON.stringify(s.slice(end, end + 25)));
}
console.log('total', total);
