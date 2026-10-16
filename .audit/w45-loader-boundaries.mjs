// Adds a boundary for every closure name whose *source module and range* an existing generated copy
// already carries. Matching by bare name alone is unsafe: minified modules reuse short names, so a
// name that exists elsewhere in src/ says nothing about the same symbol in this module. The pairing
// comes from each copy's own ledger, which records the source module and range of every block.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const closure = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const requestPath = process.argv[3];
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
const excluded = new Set(process.argv.slice(4));
const root = 'extracted-v2/modules/';

function namesIn(module, start, end) {
  const text = fs.readFileSync(root + module, 'utf8');
  const source = ts.createSourceFile(module, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = new Set();
  const bind = name => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else if (ts.isObjectBindingPattern(name)) for (const element of name.elements)
      if (ts.isBindingElement(element)) bind(element.name);
  };
  for (const node of source.statements) {
    if (node.getStart(source) < start || node.end > end) continue;
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) bind(declaration.name);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause))
      for (const binding of node.exportClause.elements) names.add(binding.name.text);
  }
  return names;
}

const carries = new Map();
for (const file of fs.readdirSync('src')) {
  if (!/^plugin-chain-.*\.ts$/.test(file) || excluded.has(file)) continue;
  const ledgerPath = path.join('src', file.replace(/\.ts$/, '-blocks.json'));
  if (!fs.existsSync(ledgerPath)) continue;
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  for (const block of ledger.blocks ?? []) {
    const module = block.module ?? block.file;
    if (module === undefined || !Array.isArray(block.range)) continue;
    for (const name of namesIn(module, block.range[0], block.range[1])) carries.set(`${module}:${name}`, file);
  }
}

let added = 0;
for (const block of closure.blocks) {
  for (const name of block.names) {
    const key = `${block.file}:${name}`;
    const holder = carries.get(key);
    if (holder === undefined || request.boundaries[key] !== undefined) continue;
    request.boundaries[key] = `Reuse the same source block, already copied in src/${holder}.`;
    added++;
  }
}
fs.writeFileSync(requestPath, JSON.stringify(request, null, 2) + '\n');
console.log(JSON.stringify({carried: carries.size, added, boundaries: Object.keys(request.boundaries).length}));
