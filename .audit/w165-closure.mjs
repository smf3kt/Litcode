import fs from 'node:fs';
const targets = [
  ['chunk-qr9z1wer.js', 'Ht', 'function Ht('],
  ['chunk-6j27z6m4.js', 'Ffe', 'function Ffe('],
  ['chunk-x90vmw14.js', 'fo', 'function fo('],
  ['chunk-fz2251t0.js', 'Se', 'function Se('],
  ['chunk-0qkpwgr4.js', 'z', 'function z('],
  ['chunk-nh8hd3rr.js', 'pt', 'function pt('],
  ['chunk-vew7ssxx.js', 'Mr', 'function Mr('],
  ['chunk-g6j4g5k0.js', '_e', 'function _e('],
  ['chunk-3dnyxzpb.js', 'sS', 'function sS('],
  ['chunk-3dnyxzpb.js', 'Na', 'function Na('],
  ['chunk-0wtqg4zf.js', 'Tl', 'var Tl='],
  ['chunk-0wtqg4zf.js', 'rx', 'function rx('],
  ['chunk-24k7d6mw.js', 'Uwe', 'function Uwe('],
  ['chunk-24k7d6mw.js', 'pBe', 'function pBe('],
  ['chunk-24k7d6mw.js', 'pee', 'function pee('],
];
const quoteCodes = new Set([34, 39, 96]);
function endOf(s, fi) {
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
for (const [file, name, needle] of targets) {
  const s = fs.readFileSync(`extracted-v2/modules/${file}`, 'utf8');
  const start = s.indexOf(needle);
  const end = needle.startsWith('var ') ? s.indexOf(';', start) + 1 : endOf(s, start);
  console.log(`${file} ${name} [${start},${end}) ${end - start}`);
}
