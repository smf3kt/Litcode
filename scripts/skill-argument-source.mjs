import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const check = args.includes('--check');
const at = args.indexOf('--output');
if (args.some((arg, index) => arg !== '--check' && arg !== '--output' && index !== at + 1))
  throw new Error('Usage: node scripts/skill-argument-source.mjs [--check] [--output NEW_DIRECTORY]');
const output = at === -1 ? path.join(root, 'src') : path.resolve(args[at + 1]);
if (at !== -1 && !check) {
  if (fs.existsSync(output)) throw new Error('Source output directory must be new');
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const modules = new Map();
function source(name, expected) {
  if (modules.has(name)) return modules.get(name);
  const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', name), 'utf8');
  assert.equal(hash(text), expected);
  assert.equal(manifest.modules.find(module => module.path === name)?.decodedSha256, expected);
  const value = { name, text, sha256: expected, ast: parse(text, { ecmaVersion: 'latest', sourceType: 'module' }) };
  modules.set(name, value);
  return value;
}
const parser = source('chunk-y59c9wzk.js', '6b51509a24e12a727cdf7e99b8a6e7e04921ea9b411eeeb0275d19db960a5ae2');
const words = source('chunk-zjewzgfh.js', '83180bcc6260cb73ac46b7d44d98a5a621a1dc03153582b929e8d717649149b3');
const command = source('chunk-m00pavz3.js', 'e4dcdda42fdf15ff719179977326a414b62ad13d5992832859839c9203c16a62');
const expansion = source('chunk-sfn1dbxq.js', '4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da');
const regex = source('chunk-ax7r0qj7.js', '8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e');
const records = [];
function block(module, start, end, symbol) {
  const node = module.ast.body.find(node => node.start === start && node.end === end);
  assert.ok(node, `${module.name} has no complete declaration at ${start}:${end}`);
  if (node.type === 'FunctionDeclaration') assert.equal(node.id.name, symbol);
  const text = module.text.slice(start, end);
  records.push({ module: module.name, moduleSha256: module.sha256, symbol, type: node.type,
    range: [start, end], coordinates: 'utf16', sha256: hash(text) });
  return `// ${module.name} ${symbol} [${start},${end}), UTF-16; sha256 ${hash(text)}\n${text}\n`;
}
const parserNodes = parser.ast.body.filter(node => node.type !== 'ExportNamedDeclaration');
assert.equal(parserNodes[0].start, 615);
assert.equal(parserNodes.at(-1).end, 61820);
assert.equal(parserNodes.filter(node => node.type === 'FunctionDeclaration').length, 88);
const header = '// @ts-nocheck\n// Exact recovered declarations. Regenerate or verify with scripts/skill-argument-source.mjs.\n';
const parserText = header + parserNodes.map(node => block(parser, node.start, node.end,
  node.id?.name ?? node.declarations.map(value => value.id.name).join(','))).join('\n') + '\nexport { vS, yyr };\n';
const d0 = command.ast.body.flatMap(node => node.declarations ?? []).find(node => node.id?.name === 'D0');
assert.equal(d0?.start, 1052);
assert.equal(d0?.end, 1058);
const d0Text = command.text.slice(d0.start, d0.end);
records.push({ module: command.name, moduleSha256: command.sha256, symbol: 'D0', type: 'VariableDeclarator',
  range: [d0.start, d0.end], coordinates: 'utf16', sha256: hash(d0Text) });
const wordsText = header + 'import { vS } from "./bash-parser-source.js";\n\n' +
  block(words, 818, 1068, '$e,ut,ft,ne,re') + '\n' +
  block(words, 1631, 2009, 'nde') + '\n' + block(words, 2205, 2790, 'DKe') + '\n' +
  block(words, 2790, 2878, 'G') + '\n' + block(words, 2878, 2986, 'pt') + '\n' +
  `// ${command.name} D0 [1052,1058), UTF-16; sha256 ${hash(d0Text)}\nvar ${d0Text};\n\n` +
  block(command, 4697, 4822, 'SE') + '\n' + block(expansion, 435128, 435233, 'i5r') + '\n' +
  block(expansion, 435100, 435128, 'zH,rY') + '\n' + block(regex, 677, 739, 'gl') + '\n' +
  block(expansion, 435534, 436487, 'uHe') + '\nexport { i5r };\n' +
  '\nexport function expandSourceSkill(body: string, args: string, append: boolean, names: readonly string[]): string {\n' +
  '  return uHe(body, args, append, names, undefined);\n}\n';
const files = { 'bash-parser-source.ts': parserText, 'skill-arguments-source.ts': wordsText };
for (const [name, text] of Object.entries(files)) {
  const javascript = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  parse(javascript, { ecmaVersion: 'latest', sourceType: 'module' });
  const file = path.join(output, name);
  if (check) assert.equal(fs.readFileSync(file, 'utf8'), text, `Recovered source differs: ${name}`);
  else fs.writeFileSync(file, text);
}
console.log(JSON.stringify({ sourceArguments: 'verified', mode: check ? 'check' : 'generate',
  modules: [...modules.values()].map(({ name, sha256 }) => ({ name, sha256 })),
  declarations: records.length, units: records.reduce((sum, record) => sum + record.range[1] - record.range[0], 0),
  files: Object.entries(files).map(([name, text]) => ({ path: path.join(output, name), sha256: hash(text) })), records }, null, 2));
