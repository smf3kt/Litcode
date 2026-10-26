import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const records = [];
function module(name, expected) {
  const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', name), 'utf8');
  assert.equal(hash(text), expected);
  assert.equal(manifest.modules.find(row => row.path === name)?.decodedSha256, expected);
  return { name, text, sha256: expected, ast: parse(text, { ecmaVersion: 'latest', sourceType: 'module' }) };
}
function copy(source, start, end, symbol) {
  let found;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.start === start && node.end === end) found = node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(source.ast);
  assert.ok(found, `Missing complete source node ${symbol}`);
  const text = source.text.slice(start, end);
  records.push({ module: source.name, moduleSha256: source.sha256, symbol, range: [start, end], coordinates: 'utf16', sha256: hash(text) });
  return `// ${source.name} ${symbol} [${start},${end}), UTF-16; sha256 ${hash(text)}\n` +
    (found.type === 'VariableDeclarator' ? `var ${text};` : text) + '\n';
}
const runner = module('chunk-kxgzv2t8.js', 'b2055cc237853b1b23905a53b3996dcc372bc9a5bc74fc2a5061f79efe620d78');
const prompt = module('chunk-btcaa7nx.js', 'bd6433a1d0f3e3132f7826fcd967f1dc97ed0f19990ea0f865822d4af6e030e3');
const tools = module('chunk-nannv282.js', '6905ada72432376732d784dfb7d416c7a874a006d008ca3dd987b6f1af944651');
const text = '// @ts-nocheck\n' +
  copy(runner, 1969, 4291, 'le,de') + copy(prompt, 805, 868, 'Iu,dN,Moe,Iwr,cRe,Doe') +
  copy(prompt, 1150, 1421, 'MFe,Owr') + copy(tools, 619, 635, 'wS') + copy(tools, 636, 652, 'Pm') + copy(tools, 653, 670, 'yd') +
  copy(runner, 4291, 7234, 'Q') +
  '\nexport function sourceConsolidationPrompt(memoryDirectory: string, transcriptDirectory: string, context: string): string {\n' +
  '  return Q(memoryDirectory, transcriptDirectory, context, false, false, false);\n}\n' +
  '\nexport function sourceConsolidationThresholds(options: { minHours?: number; minSessions?: number } = {}): { minHours: number; minSessions: number } {\n' +
  '  const k = () => options;\n  const se = { minHours: 24, minSessions: 5 };\n' +
  copy(runner, 8435, 8719, 'fe') + '  return fe();\n}\n';
parse(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText,
  { ecmaVersion: 'latest', sourceType: 'module' });
const output = path.join(root, 'src/memory-consolidation-source.ts');
if (check) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text);
console.log(JSON.stringify({ output, sha256: hash(text), records }));
