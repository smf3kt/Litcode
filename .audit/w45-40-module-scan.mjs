// The completeness check for one module: every top-level declaration must lie inside a range some copy
// or ledger records, or inside a recorded host boundary; the only statements outside may be the
// module's own imports and its export list. W45-40 used it for chunk-3ph567jx.js (boundary
// [3650,3763)); it takes any module and boundary pairs as arguments, and the W45-41 record calls it
// for chunk-qm4226vk.js (boundary [3438,3497)).
import fs from 'node:fs';
import * as acorn from 'acorn';

const [, , moduleArg, ...boundaryArgs] = process.argv;
const module_ = moduleArg ?? 'chunk-3ph567jx.js';
const text = fs.readFileSync(`extracted-v2/modules/${module_}`, 'utf8');
const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const pairs = boundaryArgs.length ? boundaryArgs.map(Number) : [3650, 3763];
const boundary = [];
for (let index = 0; index < pairs.length; index += 2) {
  boundary.push({ ledger: 'host boundary', range: [pairs[index], pairs[index + 1]] });
}
const records = [];
for (const name of fs.readdirSync('src').filter((entry) => entry.endsWith('-blocks.json'))) {
  const ledger = JSON.parse(fs.readFileSync(`src/${name}`, 'utf8'));
  for (const block of ledger.blocks) if (block.module === module_) records.push({ ledger: name, range: block.range });
}
const covered = [...boundary, ...records];
const outside = ast.body
  .filter((node) => !covered.some(({ range }) => node.start >= range[0] && node.end <= range[1]))
  .map((node) => ({ type: node.type, range: [node.start, node.end] }));
const boundaryText = boundary.map(({ range }) => text.slice(range[0], range[1])).join('|');
const headerQuote = 'class n{registry=s()}var r=new q(()=>new n);function a(){return r.of(B().host)}function it(){return a().registry}';
const wiring = outside.every((node) => node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration');

console.log(JSON.stringify({
  schema: 'W45RegistryResetModuleCoverage.v1',
  module: module_,
  topLevelStatements: ast.body.length,
  coveredRanges: covered.map(({ ledger, range }) => ({ ledger, range })),
  declarationsOutside: outside.filter((node) => node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration'),
  wiringOutside: outside,
  everyDeclarationCovered: outside.every((node) => node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration'),
  boundaryRange: boundary.map(({ range }) => range),
  boundaryText,
  boundaryMatchesSeamHeader: boundaryText === headerQuote,
}, null, 1));
