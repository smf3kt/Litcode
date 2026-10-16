// W45-46: resolve a free name inside one module the way the module's own ESM scope does.
// Minified names collide across chunks, so a name must always be resolved against the module
// that reads it, never against the corpus.
// Usage: node .audit/w45-46-free.mjs <module.js> <name> [name...]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const modules = path.join(root, 'extracted-v2/modules');
const [moduleName, ...names] = process.argv.slice(2);
if (!moduleName || names.length === 0) {
  console.error('Usage: node .audit/w45-46-free.mjs <module.js> <name> [name...]');
  process.exit(1);
}
const source = fs.readFileSync(path.join(modules, moduleName), 'utf8');

// Every import statement, parsed as (local name -> source module). Statements are read with a
// bracket-balanced scan so an `import{` inside a string literal cannot swallow the next statement.
const bindings = new Map();
for (let i = 0; i < source.length;) {
  const at = source.indexOf('import', i);
  if (at < 0) break;
  const before = source[at - 1];
  if (before !== undefined && /[\w$.'"`)\]]/.test(before)) { i = at + 6; continue; }
  const open = source.indexOf('{', at);
  const closed = source.indexOf('}', open);
  const from = source.indexOf('from', closed);
  const quote = source.indexOf('"', from);
  const endQuote = source.indexOf('"', quote + 1);
  if (open < 0 || closed < 0 || from < 0 || quote < 0 || endQuote < 0 || open - at > 2000) { i = at + 6; continue; }
  const header = source.slice(at, source.indexOf(';', endQuote) + 1);
  const specifier = source.slice(quote + 1, endQuote);
  if (!/^import\s*\{/.test(header)) {
    // default or namespace import: `import X from "…"` / `import * as X from "…"`
    const namespace = /^import\s+\*\s+as\s+([\w$]+)/.exec(header);
    const plain = /^import\s+([\w$]+)\s/.exec(header);
    if (namespace) bindings.set(namespace[1], { specifier, imported: '*' });
    else if (plain) bindings.set(plain[1], { specifier, imported: 'default' });
    i = endQuote + 1;
    continue;
  }
  for (const clause of source.slice(open + 1, closed).split(',')) {
    const trimmed = clause.trim();
    if (!trimmed) continue;
    const [imported, local] = trimmed.split(/\s+as\s+/).map(part => part.trim());
    bindings.set(local ?? imported, { specifier, imported });
  }
  i = endQuote + 1;
}

const spanOf = (name, at) => {
  const head = new RegExp(`(?:async\\s+)?function\\s+${name.replace(/\$/g, '\\$')}\\b|\\b(?:var|let|const)\\s+${name.replace(/\$/g, '\\$')}\\s*=`, 'g');
  head.lastIndex = at;
  const match = head.exec(source);
  if (!match) return null;
  if (/function/.test(match[0])) {
    // balanced braces from the body's opening brace
    let depth = 0;
    for (let i = source.indexOf('{', match.index); i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}' && --depth === 0) return [match.index, i + 1];
    }
    return null;
  }
  // an initializer: walk to the end of its balanced expression, honouring arrows
  let depth = 0;
  const start = source.indexOf('=', match.index) + 1;
  let arrow = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) return [match.index, i]; depth--; }
    else if (ch === '=' && source[i + 1] === '>') { arrow = true; i++; }
    else if (ch === ';' && depth === 0 && (!arrow || source[i - 1] === '}')) return [match.index, i];
    else if (ch === '\n' && depth === 0 && arrow && source[i - 1] !== ',') return [match.index, i];
  }
  return null;
};

for (const name of names) {
  const escaped = name.replace(/\$/g, '\\$');
  const local = new RegExp(`(?:^|[;,{}])\\s*(?:async\\s+)?function\\s+${escaped}\\b|(?:^|[;,{}])\\s*(?:var|let|const)\\s+${escaped}\\s*=`, 'm').exec(source);
  const binding = bindings.get(name);
  if (local) {
    const span = spanOf(name, local.index);
    console.log(JSON.stringify({ name, from: moduleName, kind: 'local', at: local.index, span,
      units: span ? span[1] - span[0] : null, text: span ? source.slice(span[0], span[1]) : null }));
  } else if (binding) {
    console.log(JSON.stringify({ name, from: moduleName, kind: 'import',
      module: binding.specifier.replace('/$bunfs/root/', ''), imported: binding.imported }));
  } else {
    console.log(JSON.stringify({ name, from: moduleName, kind: 'unresolved' }));
  }
}
