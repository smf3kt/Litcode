import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = process.env.W297_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const modules = new Map(), identities = [], asts = new Map();
for (const name of ['nybcbd9t', 'ppsy9aeg', 'js2bhabe', 'bk5ct2gw', 'sfn1dbxq', '24k7d6mw', '1r9zp6s1', '4bw62nzm',
  'm18zhdb2', 'z7whhrje', 'kexg5hxg', '8e9fdjt4', 'yvnhkg35', 'fyhzvvp0', '3cynezh1', '06azbynj', 'x0dc37w9']) {
  const file = `chunk-${name}.js`, bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  const digest = sha(bytes); assert.equal(digest, manifest.modules.find(item => item.path === file)?.decodedSha256, file);
  modules.set(name, bytes.toString('utf8')); identities.push({ file, sha256: digest });
}
function functions(text) {
  const nodes = new Map();
  walk.simple(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { if (!nodes.has(node.id.name)) nodes.set(node.id.name, node); },
  });
  return nodes;
}
function canonical(node) {
  return JSON.parse(JSON.stringify(node, (key, value) => {
    if (['start', 'end', 'raw'].includes(key)) return;
    if (value?.type === 'TemplateLiteral' && value.expressions.length === 0) return { type: 'Literal', value: value.quasis[0].value.cooked };
    if (value?.type === 'UnaryExpression' && value.operator === 'void' && value.argument.value === 0) return { type: 'Identifier', name: 'undefined' };
    return value;
  }));
}
const emit = file => ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const targetFiles = new Map(['src/notification-plist.ts', 'src/terminal-notifications.ts'].map(file => [file, functions(emit(file))]));
const copies = [];
for (const [module, name, file] of [
  ...['a', 'ipn', 's', 'f', 'o', 'l', 'p', 'g'].map(name => ['8e9fdjt4', name, 'src/notification-plist.ts']),
  ['z7whhrje', 'm', 'src/terminal-notifications.ts'],
  ...['K3t', 'gh', 'OI'].map(name => ['kexg5hxg', name, 'src/terminal-notifications.ts']),
  ...['A', 'E'].map(name => ['m18zhdb2', name, 'src/terminal-notifications.ts']),
  ['24k7d6mw', 'Awo', 'src/terminal-notifications.ts'],
]) {
  if (!asts.has(module)) asts.set(module, functions(modules.get(module)));
  const before = asts.get(module).get(name), after = targetFiles.get(file).get(name);
  assert.ok(before && after, name); assert.deepEqual(canonical(after.body), canonical(before.body), name);
  copies.push({ module, name, file, range: [before.start, before.end], unit: 'utf16', sha256: sha(modules.get(module).slice(before.start, before.end)) });
}
assert.equal(modules.get('ppsy9aeg').slice(619,717), 'tY=["auto","iterm2","terminal_bell","iterm2_with_bell","kitty","ghostty","notifications_disabled"]');
assert.equal(modules.get('bk5ct2gw').slice(558515,558543), 'preferredNotifChannel:"auto"');
assert.match(modules.get('3cynezh1').slice(272538,272680), /U\(tY\)\.optional\(\)\.catch\(void 0\)/);
assert.match(modules.get('nybcbd9t').slice(11635,11752), /label:"Local notifications"/);
assert.match(modules.get('nybcbd9t').slice(9662,9747), /W\("preferredNotifChannel",e\)/);
assert.match(modules.get('sfn1dbxq').slice(1133554,1133604), /!1/);
assert.equal(modules.get('06azbynj').slice(239213,239367), 'function Id(n){switch(n.kind){case"response":case"focus":return!1;case"paste":return!0;case"mouse":return!Yd(n.button);case"key":return n.name!=="mouse"}}');
assert.equal(modules.get('06azbynj').slice(241153,241196), 'function Yd(n){return(n&32)!==0&&(n&3)===3}');
const comparisons = [
  ['sender', modules.get('m18zhdb2').slice(2366,4544) + modules.get('z7whhrje').slice(7839,9007) + modules.get('kexg5hxg').slice(7526,7656), read('src/terminal-notifications.ts')],
  ['clock', modules.get('24k7d6mw').slice(1318654,1318983) + modules.get('1r9zp6s1').slice(24622,24997) + modules.get('06azbynj').slice(239213,239825) + modules.get('4bw62nzm').slice(85445,85505), read('src/terminal-notifications.ts') + read('src/tui.ts')],
  ['settings', modules.get('nybcbd9t').slice(5051,6155) + modules.get('nybcbd9t').slice(9662,9747) + modules.get('nybcbd9t').slice(11635,11752) + modules.get('js2bhabe').slice(1114,1554) + modules.get('3cynezh1').slice(395555,396291), ['config', 'config-panel', 'config-panel-input', 'theme-settings', 'session', 'runtime', 'reload', 'cli'].map(name => read(`src/${name}.ts`)).join('\n')],
  ['permission', modules.get('24k7d6mw').slice(1324254,1324664) + modules.get('m18zhdb2').slice(2366,2893) + modules.get('fyhzvvp0').slice(4925,5231) + modules.get('sfn1dbxq').slice(2941895,2942206), read('src/interactive.ts')],
];
const diffs = [];
for (const [name,before,after] of comparisons) {
  const left = path.join(output, `w297-source-${name}.txt`), right = path.join(output, `w297-port-${name}.txt`);
  fs.writeFileSync(left,before); fs.writeFileSync(right,after);
  const result = spawnSync('git', ['diff','--no-index','--no-ext-diff','--word-diff=porcelain','--word-diff-regex=.',left,right], {encoding:'utf8',maxBuffer:16*1024*1024});
  assert.ok(result.status===0||result.status===1,result.stderr); fs.writeFileSync(path.join(output,`w297-diff-${name}.txt`),result.stdout);
  diffs.push({name,sourceSha256:sha(before),targetSha256:sha(after),diffSha256:sha(result.stdout),bytes:Buffer.byteLength(result.stdout)});
}
fs.writeFileSync(path.join(output,'w297-source-comparison.json'),JSON.stringify({modules:identities,copies,diffs},null,2));
console.log(`PASS ${identities.length} module digests, ${copies.length} copied AST bodies, literal default/schema/local row/input gate and ${diffs.length} adapted comparisons`);
