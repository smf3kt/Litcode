// W45-48: enumerate a module's top-level declarations with their spans, so a large closure can be
// planned by name instead of hunted range by range.
// Usage: node .audit/w45-48-enum.mjs <module.js> [prefix]
import fs from 'node:fs';
import path from 'node:path';
import { extent, extractFn } from '../scripts/source-copy-scan.mjs';

const root = path.resolve(import.meta.dirname, '..');
const [moduleName, prefix] = process.argv.slice(2);
const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', moduleName), 'utf8');

const head = /(?:^|[;}])\s*(?:async\s+)?(function|class|var|let|const)\s+([A-Za-z_$][\w$]*)/g;
let total = 0;
for (let match = head.exec(text); match; match = head.exec(text)) {
  const start = match.index + match[0].length - (match[1].length + match[2].length) - 1;
  const at = text.indexOf(match[2], match.index);
  const [a, b] = match[1] === 'function' || match[1] === 'class' ? extractFn(text, at) : extent(text, at);
  if (prefix && !match[2].startsWith(prefix)) continue;
  total += b - a;
  console.log(`${String(b - a).padStart(6)}u [${a},${b}) ${match[1]} ${match[2]}`);
}
console.log(`# ${moduleName}: ${total} units over the listed declarations`);
