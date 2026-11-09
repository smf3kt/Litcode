// Read recovered modules as inert text. Never import a recovered entrypoint.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { parse } from 'acorn';

const [moduleName, ...selectors] = process.argv.slice(2);
assert(moduleName && selectors.length, 'usage: node .audit/w385-hook-source.mjs MODULE SYMBOL|@OFFSET ...');
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
assert(manifest.modules.some(entry => entry.path === moduleName), 'module absent from manifest');
const source = fs.readFileSync(`extracted-v2/modules/${moduleName}`, 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const moduleSha256 = hash(source);
assert.equal(moduleSha256, manifest.modules.find(entry => entry.path === moduleName).decodedSha256);
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const definitions = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclarator', 'MethodDefinition'].includes(node.type)) definitions.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
for (const selector of selectors) {
  // Imported bindings win over unrelated class methods with the same spelling.
  // For example D2r's `of` is imported, not the local class's `of(e)` method.
  const declaration = ast.body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === selector));
  if (declaration) {
    const specifier = declaration.specifiers.find(value => value.local.name === selector);
    console.log(JSON.stringify({ module: moduleName, moduleSha256, symbol: selector, importedFrom: declaration.source.value,
      importedName: specifier.imported?.name ?? specifier.imported?.value ?? specifier.type,
      range: [declaration.start, declaration.end], coordinates: 'zero-based half-open UTF-16', kind: 'import-reference-not-body' }));
    continue;
  }
  const matches = selector.startsWith('@')
    ? definitions.filter(node => node.start <= Number(selector.slice(1)) && node.end > Number(selector.slice(1))).sort((a, b) => (a.end - a.start) - (b.end - b.start)).slice(0, 1)
    : definitions.filter(node => (node.id?.name ?? node.key?.name) === selector);
  if (!matches.length) {
    assert.fail(`missing selector ${selector}`);
  }
  for (const node of matches) {
    const body = source.slice(node.start, node.end);
    console.log(JSON.stringify({ module: moduleName, moduleSha256, symbol: node.id?.name ?? node.key?.name, range: [node.start, node.end], coordinates: 'zero-based half-open UTF-16', bodySha256: hash(body) }));
    console.log(body);
  }
}
