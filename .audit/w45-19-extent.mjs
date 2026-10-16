import fs from 'node:fs';

const file = process.argv[2];
const text = fs.readFileSync(`extracted-v2/modules/${file}`, 'utf8');
for (const marker of process.argv.slice(3)) {
  const at = text.indexOf(marker);
  if (at < 0) { console.log(`${marker} not found in ${file}`); continue; }
  let depth = 0;
  let i = text.indexOf('{', at);
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { const quote = ch; i++; while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1; continue; }
    if (ch === '`') { i++; let nest = 0; while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i] === '$' && text[i + 1] === '{') { nest++; i += 2; continue; } if (text[i] === '}' && nest > 0) { nest--; i++; continue; } if (text[i] === '`' && nest === 0) break; i++; } continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  console.log(`${file} ${marker} [${at},${i}) ${i - at} units`);
}
