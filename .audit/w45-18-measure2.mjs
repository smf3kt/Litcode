import fs from 'node:fs';

const root = 'extracted-v2/modules/';
const read = (file) => fs.readFileSync(root + file, 'utf8');

function extent(file, marker) {
  const source = read(file);
  const at = source.indexOf(marker);
  if (at < 0) return console.log(`${file} ${marker} NOT FOUND`);
  let depth = 0;
  let i = source.indexOf('{', at);
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") { const quote = ch; i++; while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1; continue; }
    if (ch === '`') { i++; let nest = 0; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === '$' && source[i + 1] === '{') { nest++; i += 2; continue; } if (source[i] === '}' && nest > 0) { nest--; i++; continue; } if (source[i] === '`' && nest === 0) break; i++; } continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  console.log(`${file} ${marker.slice(0, 40)} [${at},${i}) ${i - at} units`);
}

const text = read('chunk-r2vtj1kh.js');
let at = -1;
const describe = 'duration_ms:v().optional().describe("Tool execution time in milliseconds. Excludes permission-prompt and hook time.")';
while ((at = text.indexOf(describe, at + 1)) >= 0) console.log(`chunk-r2vtj1kh.js duration_ms [${at},${at + describe.length}) ${describe.length} units`);

const sfn = read('chunk-sfn1dbxq.js');
for (const marker of ['async function*Okn(', 'async function*P9r(', 'async function*Hkn(']) extent('chunk-sfn1dbxq.js', marker);
