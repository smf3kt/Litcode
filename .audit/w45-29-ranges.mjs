// Range picker for the W45-29 blocks: given a start index, walk forward until the statement's own
// braces and parens balance, then print the slice so each range can be eyeballed before it is copied.
import fs from 'node:fs';

const dir = 'extracted-v2/modules/';
const cases = [
  ['chunk-2kdsvp3x.js', 37034, 'Ee + sOn'],
  ['chunk-m4qpskd4.js', 48497, 'Zws'],
  ['chunk-ed7zyzrn.js', 3160, 'cho + OFe'],
  ['chunk-ed7zyzrn.js', 2885, 'O'],
  ['chunk-nyce03br.js', 212618, 'jde'],
  ['chunk-nwffn64n.js', null, 'PQt'],
  ['chunk-sfn1dbxq.js', 1692719, 'xYr'],
  ['chunk-sfn1dbxq.js', 1694273, 'lLs'],
  ['chunk-n3ykh62m.js', 275644, 'o5t'],
  ['chunk-n3ykh62m.js', 274916, 'vb'],
];

for (const [file, start, label] of cases) {
  const text = fs.readFileSync(dir + file, 'utf8');
  if (start === null) {
    const at = text.indexOf('PQt=');
    console.log(`\n=== ${label} (${file}) @${at}\n${text.slice(Math.max(0, at - 30), at + 40)}`);
    continue;
  }
  let depth = 0, end = start, seen = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') { depth++; seen = true; }
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    if (seen && depth === 0 && (ch === '}' || ch === ';')) { end = i + 1; break; }
  }
  console.log(`\n=== ${label} ${file} [${start},${end}) units ${end - start}\n${text.slice(start, end)}`);
}
