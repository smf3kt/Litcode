// Prints the exact source text of a named top-level declaration from the extracted bundle modules,
// so a port can be written against the real body instead of a remembered shape. Bounded output.
//   node .audit/w45-body.mjs [FILE:]NAME [FILE:NAME...]
// Minified modules reuse short names, so a bare name can hit an unrelated declaration; pass the
// module the closure recorded for the name whenever its identity matters.
import fs from 'node:fs';

const root = 'extracted-v2/modules/';
const requests = process.argv.slice(2).map((argument) => {
  const at = argument.indexOf(':');
  return at < 0 ? {name: argument, file: null} : {name: argument.slice(at + 1), file: argument.slice(0, at)};
});

function endOfBody(text, from) {
  let depth = 0, i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { const quote = ch; i++; while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1; i++; continue; }
    if (ch === '`') { i++; let nest = 0; while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i] === '$' && text[i + 1] === '{') { nest++; i += 2; continue; } if (text[i] === '}' && nest > 0) { nest--; i++; continue; } if (text[i] === '`' && nest === 0) break; i++; } i++; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0 && ch === '}') return i + 1; if (depth < 0) return i; }
    else if (depth === 0 && (ch === ';' || ch === ',')) return i;
    i++;
  }
  return text.length;
}

for (const {name, file: only} of requests) {
  let found = false;
  for (const file of only === null ? fs.readdirSync(root) : [only]) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(root + file, 'utf8');
    const patterns = [
      new RegExp(`(?:^|[;}\\s])((?:async\\s+)?function\\s+${name}\\s*\\()`),
      new RegExp(`(?:^|[;}\\s])((?:var|let|const)\\s+${name}\\s*=)`),
      new RegExp(`(?:^|[;}\\s])(class\\s+${name}[\\s{])`),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match === null) continue;
      const start = match.index + (match[0].length - match[1].length);
      const end = endOfBody(text, start);
      const body = text.slice(start, end);
      console.log(`${name} ${file} [${start},${end}) ${end - start} units`);
      console.log(body.length > 900 ? body.slice(0, 900) + '…' : body);
      console.log('');
      found = true;
      break;
    }
    if (found) break;
  }
  if (!found) console.log(`${name} NOT FOUND\n`);
}
