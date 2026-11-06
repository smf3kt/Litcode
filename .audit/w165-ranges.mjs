import fs from 'node:fs';
const s = fs.readFileSync('extracted-v2/modules/chunk-twzxjzbk.js', 'utf8');
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
for (const name of ['function Vt(', 'var ve=7', 'function K(', 'function oe(', 'function le(', 'function Et(', 'function si(']) {
  const start = s.indexOf(name);
  const end = name.startsWith('var ') ? s.indexOf(';', start) + 1 : endOf(start);
  console.log(`${name} ${start} ${end} ${end - start}`);
}
