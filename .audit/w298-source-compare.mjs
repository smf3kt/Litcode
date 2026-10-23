import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = process.env.W298_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const modules = new Map(), identities = [], nodes = new Map();
for (const module of ['24k7d6mw', '1r9zp6s1', 'kexg5hxg', 'sfn1dbxq', '3cynezh1', 'k1caxvem', 'mvsmkx6d', 'gyf58rwf', '8zgs1qmk', 'ny55yhge']) {
  const file = `chunk-${module}.js`, bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file)), digest = sha(bytes);
  assert.equal(digest, manifest.modules.find(item => item.path === file)?.decodedSha256, file);
  modules.set(module, bytes.toString('utf8')); identities.push({ file, sha256: digest });
}
function functions(text) {
  const found = new Map();
  walk.simple(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { if (!found.has(node.id.name)) found.set(node.id.name, node); },
  });
  return found;
}
function canonical(node, aliases = {}) {
  return JSON.parse(JSON.stringify(node, (key, value) => {
    if (['start', 'end', 'raw'].includes(key)) return;
    if (value?.type === 'Identifier' && aliases[value.name]) return { type: 'Identifier', name: aliases[value.name] };
    if (value?.type === 'UnaryExpression' && value.operator === 'void' && value.argument.value === 0) return { type: 'Identifier', name: 'undefined' };
    if (value?.type === 'UnaryExpression' && value.operator === '!' && [0, 1].includes(value.argument.value)) return { type: 'Literal', value: !value.argument.value };
    if (value?.type === 'TemplateLiteral' && value.expressions.length === 0) return { type: 'Literal', value: value.quasis[0].value.cooked };
    if (value?.type === 'BlockStatement') return { ...value, body: value.body.flatMap(statement => statement.type === 'ExpressionStatement' && statement.expression.type === 'SequenceExpression'
      ? statement.expression.expressions.map(expression => ({ type: 'ExpressionStatement', expression })) : [statement]) };
    return value;
  }));
}
const target = read('src/terminal-title.ts'), emitted = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const after = functions(emitted), copies = [];
for (const [module, name, aliases] of [['24k7d6mw', 'eve', {}], ['24k7d6mw', 'Ryo', {}], ['24k7d6mw', 'Hyo', {}], ['1r9zp6s1', 'SEe', {}], ['kexg5hxg', 'gh', {}], ['kexg5hxg', 'K3t', { process: 'process' }]]) {
  if (!nodes.has(module)) nodes.set(module, functions(modules.get(module)));
  const before = nodes.get(module).get(name), actual = after.get(name); assert.ok(before && actual, name);
  if (name === 'K3t') {
    const sourceText = modules.get(module).slice(before.body.start, before.body.end).replaceAll('a.TMUX', 'process.env.TMUX').replaceAll('a.STY', 'process.env.STY').replaceAll('a.ZELLIJ', 'process.env.ZELLIJ');
    assert.deepEqual(canonical(actual.body), canonical(functions(`function K3t()${sourceText}`).get('K3t').body), name);
  } else assert.deepEqual(canonical(actual.body, aliases), canonical(before.body), name);
  copies.push({ module, name, file: 'src/terminal-title.ts', range: [before.start, before.end], unit: 'utf16', sha256: sha(modules.get(module).slice(before.start, before.end)) });
}
const source = modules.get('24k7d6mw');
assert.equal(source.slice(1292996,1293018), 'C6=["\\u25D0","\\u25D1"]');
assert.equal(source.slice(1293019,1293030), 'T6="\\u2733"');
assert.equal(source.slice(1293031,1293038), 'Ost=960');
assert.match(source.slice(1293039,1293366), /he\|\|L\|\|Te\|\|!M\|\|!we\?null:Ost/);
assert.match(source.slice(1293039,1293366), /tengu_static_title_under_mux",!0/);
assert.match(source.slice(164141,164215), /terminalTitleFromRename!==!1/);
assert.match(source.slice(164310,165246), /terminalTitle:ee\?\?he\?\?Te\?\?we\?\?Wkt/);
assert.match(modules.get('1r9zp6s1').slice(27985,28095), /r\(gh\(Yp.SET_TITLE_AND_ICON,l\)\)/);
assert.equal(source.slice(164123,164140), 'Wkt="Claude Code"');
assert.equal(source.slice(1689977,1690022), 'disabled:a.CLAUDE_CODE_DISABLE_TERMINAL_TITLE');
assert.equal(modules.get('gyf58rwf').slice(9076,9115), 'function pn(e){return Bun.stripANSI(e)}');
assert.match(modules.get('ny55yhge').slice(765,953), /^Eg=Ko\(\{kind:"local_jsx",.*userInvoked:!0,hideWhile:\[\]\}\)$/);
assert.equal(modules.get('8zgs1qmk').slice(911,976), 'function iv(o){return o.open.findLast((e)=>!e.userInvoked)??null}');
assert.match(source.slice(897000,897690), /if\(!pi\).*children:e\(uBe,/);
assert.match(source.slice(871500,871990), /tengu_help_toggled/);
assert.match(source.slice(881930,882430), /thinking-always-on/);
const modalOriginSource = modules.get('ny55yhge').slice(765,953) + modules.get('8zgs1qmk').slice(911,976)
  + source.slice(897000,897690) + source.slice(871500,871990) + source.slice(881930,882430);
const groups = [
  ['owner', source.slice(1292875,1293366) + source.slice(164141,165246) + modules.get('1r9zp6s1').slice(24622,24997), target],
  ['activity', source.slice(1292353,1292871) + source.slice(1301960,1304882) + modules.get('k1caxvem').slice(1265,1319) + modalOriginSource, read('src/tui.ts') + read('src/interactive.ts')],
  ['session', modules.get('sfn1dbxq').slice(4651858,4651990) + modules.get('sfn1dbxq').slice(4658174,4658235), read('src/session.ts') + read('src/tui.ts')],
  ['settings', modules.get('3cynezh1').slice(256681,256873) + source.slice(164141,164215) + source.slice(1689760,1690120), ['session','runtime','reload','cli'].map(name => read(`src/${name}.ts`)).join('\n')],
];
const diffs = [];
for (const [name,before,after] of groups) {
  const left = path.join(output, `w298-source-${name}.txt`), right = path.join(output, `w298-port-${name}.txt`);
  fs.writeFileSync(left,before); fs.writeFileSync(right,after);
  const result = spawnSync('git', ['diff','--no-index','--no-ext-diff','--word-diff=porcelain','--word-diff-regex=.',left,right], {encoding:'utf8',maxBuffer:16*1024*1024});
  assert.ok(result.status === 0 || result.status === 1,result.stderr); fs.writeFileSync(path.join(output,`w298-diff-${name}.txt`),result.stdout);
  diffs.push({name,sourceSha256:sha(before),targetSha256:sha(after),diffSha256:sha(result.stdout),bytes:Buffer.byteLength(result.stdout)});
}
fs.writeFileSync(path.join(output,'w298-source-comparison.json'),JSON.stringify({modules:identities,copies,diffs},null,2));
console.log(`PASS ${identities.length} module digests, ${copies.length} copied AST bodies, literal prefix/960ms/default/precedence/direct-OSC facts and ${diffs.length} adapted comparisons`);
