// For each name, say where it comes from: this module's contiguous ESM import header (with the
// chunk that provides it), or a declaration in the module itself. Names are matched as whole
// words, so a short name is never assumed to mean one body.
import fs from 'node:fs';

const FILE = process.env.W45_FILE ?? 'extracted-v2/modules/chunk-sfn1dbxq.js';
const text = fs.readFileSync(FILE, 'utf8');
const wanted = process.argv.slice(2);

// The header runs from byte 0 through the last import statement before the first other statement;
// take every import whose match begins before the first statement that is not an import.
const imports = new Map();
const re = /import\{([^}]*)\}from"([^"]+)";/g;
let m;
let lastEnd = 0;
while ((m = re.exec(text)) !== null) {
  const between = text.slice(lastEnd, m.index).replace(/\/\/[^\n]*\n?/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (between.trim() !== '') break;
  for (const n of m[1].split(',')) imports.set(n.trim(), m[2].split('/').pop());
  lastEnd = m.index + m[0].length;
  if (m.index > 400000) break;
}
const headerEnd = lastEnd;

const find = (name) => {
  const out = [];
  if (imports.has(name)) out.push({ kind: 'import', from: imports.get(name) });
  const body = text;
  const patterns = [
    [/function\s+/, 'function'],
    [/(?:^|[;{},])\s*(?:var|let|const)\s+/, 'var'],
  ];
  for (const [pre, kind] of patterns) {
    const at = body.indexOf(`${name}(`);
    let i = 0;
    while (i < body.length) {
      const j = body.indexOf(name, i);
      if (j < 0) break;
      i = j + name.length;
      const before = body.slice(Math.max(0, j - 24), j);
      const after = body.slice(j + name.length, j + name.length + 2);
      if (kind === 'function' && /function\s+$/.test(before)) out.push({ kind: 'function', at: j });
      else if (kind === 'var' && (after === '=' || body.slice(j + name.length, j + name.length + 3) === ' = ') && /(var|let|const)\s+$/.test(before)) out.push({ kind: 'var', at: j });
      if (at >= 0 && out.length > 4) break;
    }
  }
  return out;
};

const rows = wanted.map((name) => ({ name, sources: find(name) }));
console.log(JSON.stringify({ schema: 'W45NameBind.v1', file: FILE, headerEnd, imported: imports.size, rows }, null, 1));
