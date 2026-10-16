import fs from 'node:fs';
import * as acorn from 'acorn';
const dir = 'extracted-v2/modules/';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const parses = new Map();
const topLevel = (file) => {
  if (!parses.has(file)) {
    const text = fs.readFileSync(dir + file, 'utf8');
    let ast;
    try { ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch { parses.set(file, { text, decls: [] }); return parses.get(file); }
    const decls = [];
    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration' && node.name) decls.push({ name: node.name, start: node.start, end: node.end });
      else if (node.type === 'VariableDeclaration') {
        for (const d of node.declarations) if (d.id?.name) decls.push({ name: d.id.name, start: node.start, end: node.end });
      } else if (node.type === 'ClassDeclaration' && node.id) decls.push({ name: node.id.name, start: node.start, end: node.end });
    }
    parses.set(file, { text, decls });
  }
  return parses.get(file);
};
const locate = (name) => {
  const hits = [];
  for (const file of files) {
    const { text, decls } = topLevel(file);
    for (const decl of decls) if (decl.name === name) hits.push({ file, ...decl, text: text.slice(decl.start, decl.end) });
  }
  return hits;
};
const names = process.argv.slice(2);
for (const name of names) {
  const hits = locate(name);
  const local = hits.filter((h) => h.file === 'chunk-sfn1dbxq.js');
  const chosen = local.length ? local : hits;
  if (!chosen.length) { console.log(`\n${name}: ABSENT as a top-level declaration in every module`); continue; }
  for (const hit of chosen.slice(0, 2)) {
    console.log(`\n== ${name} ${hit.file} [${hit.start},${hit.end}) ${hit.end - hit.start}u`);
    console.log(hit.text.length > 700 ? hit.text.slice(0, 700) + ' …' : hit.text);
  }
  if (hits.length > chosen.length) console.log(`   (also declared in ${hits.length - chosen.length} other module(s): ${hits.filter((h) => !chosen.includes(h)).map((h) => h.file).slice(0, 4).join(', ')})`);
}
