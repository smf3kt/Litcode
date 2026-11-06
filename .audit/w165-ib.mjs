import fs from 'node:fs';
const s = fs.readFileSync('extracted-v2/modules/chunk-a8pz28bf.js', 'utf8');
const quoteCodes = new Set([34, 39, 96]);
function endOf(fi) {
  let depth = 0, quote = null, escaped = false;
  for (let i = fi; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (quote !== null) {
      if (escaped) { escaped = false; continue; }
      if (code === 92) { escaped = true; continue; }
      if (code === quote) quote = null;
      continue;
    }
    if (quoteCodes.has(code)) { quote = code; continue; }
    if (code === 123) depth++;
    else if (code === 125 && --depth === 0) return i + 1;
  }
  return -1;
}
for (const name of ['function Ib(']) {
  const start = s.indexOf(name);
  const end = endOf(start);
  console.log(name, start, end, end - start);
  console.log(s.slice(start, end));
}
console.log('imports:', s.slice(0, s.indexOf(';N();') + 5).split('\n').slice(-2).join('\n'));
