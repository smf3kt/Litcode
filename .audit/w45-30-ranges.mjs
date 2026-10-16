// Range picker for the W45-30 blocks: find each declaration by its own text, then walk forward until
// the statement's braces and parens balance, so every range is measured rather than hand-counted.
import fs from 'node:fs';

const dir = 'extracted-v2/modules/';
const cases = [
  ['chunk-ae84tp6z.js', /function Ge\(t,e\)\{return t\}/, 'Ge'],
  ['chunk-c9vsmdqj.js', /function bs\(\)\{let t;return\{set:/, 'bs'],
  ['chunk-n3ykh62m.js', /var Y4t=Ge\(bs\(\),/, 'Y4t'],
  ['chunk-n3ykh62m.js', /var Ql=\(\)=>Y4t\.get\(\)/, 'Ql'],
  ['chunk-n3ykh62m.js', /var Zl=Ge\(new Map,/, 'Zl'],
  ['chunk-n3ykh62m.js', /var P_=1000;/, 'P_'],
  ['chunk-n3ykh62m.js', /function ec\(e,n=Date\.now\(\)\)/, 'ec'],
  ['chunk-n3ykh62m.js', /function A_\(e,n\)\{let r=Zl\.get/, 'A_'],
  ['chunk-n3ykh62m.js', /var nc=34;/, 'nc'],
  ['chunk-n3ykh62m.js', /function Of\(e\)\{let n=e\.surface/, 'Of'],
  ['chunk-n3ykh62m.js', /var OL=\(\)=>it\(\)\.renderVersions;/, 'OL'],
  ['chunk-n3ykh62m.js', /var Rc="\\x00state";/, 'Rc'],
  ['chunk-n3ykh62m.js', /var jf=\(e\)=>e\+Rc;/, 'jf'],
  ['chunk-n3ykh62m.js', /var HAt=100;/, 'HAt'],
  ['chunk-n3ykh62m.js', /function vi\(e,n\)\{if\(e\.length===0\)/, 'vi'],
  ['chunk-n3ykh62m.js', /function vc\(e,n\)\{if\(e\.size===0\)/, 'vc'],
  ['chunk-n3ykh62m.js', /function MAt\(e,n\)\{let r=s_\(\),s=r\.folds\[e\]/, 'MAt'],
  ['chunk-n3ykh62m.js', /function zf\(e,n\)\{MAt\(e,n\(\)\)\}/, 'zf'],
  ['chunk-n3ykh62m.js', /var Wf=\{steady:HAt,live:nc\};/, 'Wf'],
  ['chunk-n3ykh62m.js', /function Ci\(e,n=Date\.now\)\{/, 'Ci'],
];

let total = 0;
for (const [file, re, label] of cases) {
  const text = fs.readFileSync(dir + file, 'utf8');
  const m = re.exec(text);
  if (!m) { console.log(`\n=== ${label} ${file} NOT FOUND`); continue; }
  const start = m.index;
  let depth = 0, end = start, seen = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') { depth++; seen = true; }
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    if (seen && depth === 0 && (ch === '}' || ch === ';')) { end = i + 1; break; }
  }
  total += end - start;
  console.log(`\n=== ${label} ${file} [${start},${end}) units ${end - start}\n${text.slice(start, end)}`);
}
console.log(`\nTOTAL units ${total}`);
