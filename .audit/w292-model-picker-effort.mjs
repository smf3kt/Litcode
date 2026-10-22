import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const source = file => {
  const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.modules.find(row => row.path === file).decodedSha256);
  return bytes.toString('utf8');
};
const main = source('chunk-24k7d6mw.js'), glyphs = source('chunk-3cynezh1.js');
const bool = source('chunk-fdxhcr6b.js'), gate = source('chunk-9vcaezw1.js');
const env = source('chunk-yvnhkg35.js'), parser = source('chunk-phz47asr.js'), chords = source('chunk-0qkpwgr4.js');
const target = fs.readFileSync(path.join(root, 'src/model-picker-effort-source.ts'), 'utf8');
const emitted = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext } }).outputText;
const ast = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const canonical = value => JSON.parse(JSON.stringify(value, (key, item) => {
  if (['start', 'end', 'raw'].includes(key)) return undefined;
  if (item?.type === 'CallExpression' && item.callee?.name === 'e' && item.arguments.length === 3
    && item.arguments[2].type === 'Identifier' && item.arguments[2].name === 'undefined')
    return { ...item, arguments: item.arguments.slice(0, 2) };
  return item;
}));
const expected = `var ${glyphs.slice(65823, 65887)},${glyphs.slice(66012, 66023)};\n`
  + main.slice(153407, 153563) + '\n' + main.slice(624680, 624931) + '\n' + bool.slice(615, 757);
assert.deepEqual(canonical(ast(emitted).filter(node => node.type !== 'ImportDeclaration'
  && node.type !== 'ExportNamedDeclaration')), canonical(ast(expected)));
assert.equal(gate.slice(4151, 4235), 'function fde(){return a.CLAUDE_CODE_MAX_EFFORT_REMINDER??k("tengu_proud_clover",!1)}');
assert.equal(env.slice(61530, 61568), 'CLAUDE_CODE_MAX_EFFORT_REMINDER:()=>MU');
assert.equal(env.slice(62378, 62392), 'MU=M.triBool()');
assert.equal(parser.slice(893, 947), 's=i((n)=>{if(Ne(n))return!0;if(Es(n))return!1;return})');
assert.equal(bool.slice(757, 908), 'function Es(e){if(e===void 0)return!1;if(typeof e==="boolean")return!e;let n=String(e).toLowerCase().trim();return["0","false","no","off"].includes(n)}');
const chrome = fs.readFileSync(path.join(root, 'src/diff-dialog-chrome-source.ts'), 'utf8');
assert.ok(chrome.includes(chords.slice(904, 4861)));
const view = main.slice(622928, 623491);
for (const arm of ['nr!==void 0&&!$n', 'e(Z0,{effort:qr})', 'color:"subtle"', 'chord:["left","right"]',
  'qr==="max"?fde()?', 'color:"warning",children:[ay," ",V$]', 'e(n,{color:"subtle",children:V$})']) assert.ok(view.includes(arm), arm);
console.log('PASS source digests, erased glyph/component/predicate ASTs, chord closure and max reminder gate');
if (process.env.W292_RESULT_DIR) {
  const file = 'src/model-picker.ts', text = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let method;
  const visit = node => {
    if (ts.isMethodDeclaration(node) && node.name?.getText(tree) === 'footer') {
      assert.equal(method, undefined); method = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(method);
  const port = text.slice(method.getStart(tree), method.end), output = process.env.W292_RESULT_DIR;
  const left = path.join(output, 'w292-source-effort.txt'), right = path.join(output, 'w292-port-effort.txt');
  fs.writeFileSync(left, view); fs.writeFileSync(right, port);
  const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--word-diff=porcelain', '--word-diff-regex=.', left, right],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.ok(diff.status === 0 || diff.status === 1, diff.stderr);
  fs.writeFileSync(path.join(output, 'w292-character-diff-effort.txt'), diff.stdout);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(output, 'w292-source-compare.json'), JSON.stringify({
    source: { module: 'chunk-24k7d6mw.js', range: [622928, 623491], unit: 'utf16', sha256: sha(view) },
    target: { file, range: [method.getStart(tree), method.end], unit: 'utf16', sha256: sha(port) },
    diff: { sha256: sha(diff.stdout), bytes: Buffer.byteLength(diff.stdout) },
  }, null, 2));
  console.log('PASS adapted effort subtree character comparison recorded');
}
for (const reminder of process.env.W292_COMPARE_ONLY === '1' ? [] : ['0', '1']) {
  const child = spawn(process.execPath, [path.join(root, '.audit/w281-model-picker-ultracode.mjs')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, LITCODE_MAX_EFFORT_REMINDER: reminder, W292_VIEW: '1',
      ...(process.env.W292_RESULT_DIR ? { W281_RESULT: path.join(process.env.W292_RESULT_DIR, `w292-view-${reminder}.json`) } : {}) },
  });
  const code = await new Promise(resolve => child.once('close', resolve));
  assert.equal(code, 0, `compiled model effort view, reminder=${reminder}`);
}
