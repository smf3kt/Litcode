import fs from 'node:fs';
import crypto from 'node:crypto';
import { topLevelIndex, extractFn, extent } from './source-copy-scan.mjs';

const [planPath, root, outPath] = process.argv.slice(2);
if (!planPath || !root || !outPath || process.argv.length !== 5 || !outPath.endsWith('.ts')) {
  throw new Error('Usage: node scripts/copy-module-regions.mjs PLAN MODULE_DIRECTORY/ OUTPUT.ts');
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
// A plan is either a bare block array (the original form) or an object with `blocks` plus the
// `imports`/`exports` lines this output file needs, so one generator can emit several files.
const planFile = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const plan = Array.isArray(planFile) ? planFile : planFile.blocks;
const planImports = Array.isArray(planFile) ? undefined : planFile.imports;
const planExports = Array.isArray(planFile) ? undefined : planFile.exports;

const modules = new Map();
const digests = new Map();
const load = (f) => {
  if (!modules.has(f)) {
    const text = fs.readFileSync(root + f, 'utf8');
    modules.set(f, text);
    digests.set(f, sha(fs.readFileSync(root + f)));
  }
  return modules.get(f);
};

// A range may name a body whose `async` keyword sits just before it; include it, or the copy is a
// function that uses `await` outside an async body.
const withAsync = (text, a) => {
  const before = text.slice(Math.max(0, a - 8), a);
  const m = /async\s*$/.exec(before);
  return m ? a - m[0].length : a;
};

const blocks = [];
for (const item of plan) {
  const text = load(item.file);
  if (item.range) {
    const [a0, b] = item.range;
    const a = withAsync(text, a0);
    const body = text.slice(a, b);
    blocks.push({ file: item.file, note: item.note, a, b, body, sha: sha(Buffer.from(body, 'utf8')) });
    continue;
  }
  const at = item.at !== undefined ? item.at : topLevelIndex(text, item.needle);
  if (at < 0) { blocks.push({ file: item.file, note: item.note, missing: true, needle: item.needle }); continue; }
  const [a, b] = item.k === 'stmt' ? extent(text, at) : extractFn(text, at);
  const body = text.slice(a, b);
  blocks.push({ file: item.file, note: item.note, a, b, body, sha: sha(Buffer.from(body, 'utf8')) });
}

const EXPORTS = planExports ?? ['He', 'Gde', 'Ye', 'Ke', 'l', 'ze', 'eRe', 'wlt', 'hlt', 'kSe', 'Dws', 'QPt', 'Syt', 'tht', 'ga', 'aP', 'jo', 'fx', 'CE', 'Xt', 'Zoe', 'Kdn', 'iOn', 'P0', 'jDe', 'aJ', 'M5t', 'qi', 'Mm', 'cze'];
// A block declares an exported name through a var/let/const/function/class, or through an import
// whose binding it renames (`import{randomUUID as UVn}from"crypto"` is how the source gets UVn).
// A declaration statement binds every declarator it lists (`var a=1,b=2`), so each declarator's
// leading identifier counts. Only depth-0 declarations are read: a `var` inside a function body
// declares nothing the copy exports.
const declarators = (body) => {
  const names = new Set();
  let depth = 0, quote = null, at = 0;
  const pattern = (start) => {
    const rest = body.slice(start);
    const identifier = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)/.exec(rest);
    if (identifier !== null) { names.add(identifier[1]); return; }
    const object = /^\s*\{([\s\S]*?)\}/.exec(rest);
    if (object !== null) for (const part of object[1].split(',')) {
      // `{key: bound}` binds `bound`; a bare `{key}` binds the key.
      const alias = /^\s*[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=[^=]*)?$/.exec(part);
      const bare = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=[^=]*)?$/.exec(part);
      if (alias !== null) names.add(alias[1]);
      else if (bare !== null) names.add(bare[1]);
    }
  };
  while (at < body.length) {
    const ch = body[at];
    if (quote !== null) {
      if (ch === '\\') at++;
      else if (ch === quote) quote = null;
      at++;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') { quote = ch; at++; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; at++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; at++; continue; }
    if (depth === 0&& (ch === 'v' || ch === 'l' || ch === 'c') && /^(?:var|let|const)\s/.test(body.slice(at))) {
      const keyword = /^(?:var|let|const)\s/.exec(body.slice(at))[0];
      let cursor = at + keyword.length;
      pattern(cursor);
      // Step to the end of the declaration, reading a declarator after each top-level comma.
      let inner = 0, tail = cursor;
      for (; tail < body.length; tail++) {
        const current = body[tail];
        if (current === '"' || current === '\'' || current === '`') { tail = skipString(body, tail); continue; }
        if (current === '(' || current === '[' || current === '{') { inner++; continue; }
        if (current === ')' || current === ']' || current === '}') { inner--; continue; }
        if (inner === 0 && current === ',') pattern(tail + 1);
        if (inner === 0 && current === ';') break;
      }
      at = tail + 1;
      continue;
    }
    at++;
  }
  return names;
};
const skipString = (body, start) => {
  const quote = body[start];
  for (let at = start + 1; at < body.length; at++) {
    if (body[at] === '\\') at++;
    else if (body[at] === quote) return at;
  }
  return body.length;
};
const declares = (body, n) => {
  const name = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `\b` would miss a name ending in `$` (`function m$(…)`): `$` is not a word character, so the
  // boundary between it and the next non-word character does not exist. The `*` arm is the
  // generator form (`async function*tRe(…)` in the streaming copy), where no space follows
  // `function`; without it a generator export reads as undeclared.
  const prefix = '(?:var|let|const|function|class|async\\s+function)(?:\\s+|\\*)';
  if (new RegExp(prefix + name + '(?![A-Za-z0-9_$])').test(body)) return true;
  if (declarators(body).has(n)) return true;
  return new RegExp('import\\s*\\{[^}]*\\bas\\s+' + name + '\\b[^}]*\\}\\s*from').test(body);
};
const declared = new Set(blocks.filter((b) => !b.missing).flatMap((b) => EXPORTS.filter((n) => declares(b.body, n))));
const missingExports = EXPORTS.filter((n) => !declared.has(n));
const missingBlocks = blocks.filter((b) => b.missing);
if (missingBlocks.length || missingExports.length) {
  throw new Error(`Incomplete source copy: ${JSON.stringify({
    blocks: missingBlocks.map((b) => `${b.file} ${b.needle}`), exports: missingExports,
  })}`);
}

const head = ['// @ts-nocheck', '// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.', '// Modules:'];
for (const [f, d] of digests) head.push(`//   ${f} sha256 ${d}`);
head.push('// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.',
  ...(planImports ?? [
    "import { isProxy as xo } from 'util/types';",
    "import { au,kn,Nl,glt,MFs,Wde,it,Aro,st,t,Ka,pwr,rt,Z,nt,kro,Ee,UVn,nre,rQt,zd,yyt,$be,TDe,mlt,kyt } from './plugin-chain-host.js';",
  ]), '');

const out = [...head];
for (const b of blocks) {
  if (b.missing) { out.push(`// MISSING ${b.file} ${b.needle}`); continue; }
  out.push(`// ${b.file} ${b.note} [${b.a},${b.b}) ${b.b - b.a} units sha256 ${b.sha}\n${b.body}\n`);
}
out.push(`\nexport { ${EXPORTS.filter((n) => declared.has(n)).join(', ')} };\n`);

fs.writeFileSync(outPath, out.join('\n'));
fs.writeFileSync(outPath.replace(/\.ts$/, '') + '-blocks.json', JSON.stringify({
  schema: 'W45ChainRunnerBlocks.v1',
  modules: [...digests].map(([module, sha256]) => ({ module, sha256 })),
  blocks: blocks.filter((b) => !b.missing).map((b) => ({ module: b.file, sha256: digests.get(b.file), range: [b.a, b.b], units: b.b - b.a, bodySha256: b.sha, note: b.note })),
  missing: blocks.filter((b) => b.missing).map((b) => `${b.file} ${b.needle}`),
}, null, 2));
console.log('blocks', blocks.length, 'missing', blocks.filter((b) => b.missing).length, 'units', blocks.reduce((n, b) => n + (b.body?.length ?? 0), 0));
for (const b of blocks.filter((x) => x.missing)) console.log('MISSING', b.file, b.needle);
if (missingExports.length) console.log('EXPORT MISSING', missingExports.join(','));
