import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = process.env.W296_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const modules = new Map(), identities = [];
for (const name of ['c283tj3z', '0wtqg4zf', 'nybcbd9t', 'bk5ct2gw', '2bcyxj9q', 'sfn1dbxq', 'x3k1646w',
  'n3ykh62m', 'ax7r0qj7', 'yn0pfn70', 'am9mebpw', '9pedrxny', 'kexg5hxg', '70nf72b4', '06azbynj']) {
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
function canonical(node, aliases = {}) {
  return JSON.parse(JSON.stringify(node, (key, value) => {
    if (['start', 'end', 'raw'].includes(key)) return;
    if (value?.type === 'Identifier' && aliases[value.name]) return { type: 'Identifier', name: aliases[value.name] };
    if (value?.type === 'TemplateLiteral' && value.expressions.length === 0)
      return { type: 'Literal', value: value.quasis[0].value.cooked };
    if (value?.type === 'UnaryExpression' && value.operator === 'void' && value.argument.value === 0)
      return { type: 'Identifier', name: 'undefined' };
    return value;
  }));
}
const emit = file => ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const files = new Map(['src/copy-command.ts', 'src/copy-picker.ts', 'src/tui-markdown-host.ts'].map(file => [file, functions(emit(file))]));
const copies = [];
for (const [module, name, file, target, aliases] of [
  ['c283tj3z', 'Je', 'src/copy-command.ts', 'copyBlocks', {}],
  ['c283tj3z', 'ke', 'src/copy-command.ts', 'ke', {}],
  ['c283tj3z', 'Ve', 'src/copy-command.ts', 'Ve', {}],
  ['c283tj3z', 'Ge', 'src/copy-command.ts', 'Ge', {}],
  ['ax7r0qj7', 'Nr', 'src/copy-picker.ts', 'Nr', {}],
  ['70nf72b4', 'l', 'src/copy-picker.ts', 'l', {}],
  ['70nf72b4', 'c', 'src/copy-picker.ts', 'c', {}],
  ['2bcyxj9q', 'zh', 'src/tui-markdown-host.ts', 'zh', { memoryTagPattern: 'Sn' }],
]) {
  const before = functions(modules.get(module)).get(name), after = files.get(file).get(target);
  assert.ok(before && after, name);
  assert.deepEqual(canonical(after.body, aliases), canonical(before.body), name);
  copies.push({ module, name, file, target, range: [before.start, before.end], unit: 'utf16', sha256: sha(modules.get(module).slice(before.start, before.end)) });
}
const row = modules.get('nybcbd9t').slice(23698, 23897);
assert.match(row, /copyFullResponse/); assert.match(row, /G\(\(o\)=>\(\{\.\.\.o,copyFullResponse:e\}\)\)/);
assert.equal(modules.get('bk5ct2gw').slice(559188, 559207), 'copyFullResponse:!1');
const comparisons = [
  ['command', modules.get('c283tj3z').slice(16131, 22896), read('src/copy-command.ts') + read('src/interactive.ts')],
  ['picker', modules.get('c283tj3z').slice(18528, 22085) + modules.get('0wtqg4zf').slice(7642, 12509)
    + modules.get('0wtqg4zf').slice(15880, 23330), read('src/copy-picker.ts') + read('src/config-panel.ts')],
  ['pointer', modules.get('70nf72b4').slice(903, 1422) + modules.get('0wtqg4zf').slice(2924, 3232)
    + modules.get('06azbynj').slice(237674, 238371) + modules.get('06azbynj').slice(242075, 244661),
  read('src/copy-picker.ts') + read('src/tui.ts')],
  ['settings', row + modules.get('nybcbd9t').slice(8266, 8318),
    ['config', 'config-panel', 'config-panel-input', 'theme-settings', 'runtime', 'session', 'cli', 'reload', 'interactive'].map(name => read(`src/${name}.ts`)).join('\n')],
];
const diffs = [];
for (const [name, before, after] of comparisons) {
  const left = path.join(output, `w296-source-${name}.txt`), right = path.join(output, `w296-port-${name}.txt`);
  fs.writeFileSync(left, before); fs.writeFileSync(right, after);
  const result = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--word-diff=porcelain', '--word-diff-regex=.', left, right],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  fs.writeFileSync(path.join(output, `w296-diff-${name}.txt`), result.stdout);
  diffs.push({ name, sourceSha256: sha(before), targetSha256: sha(after), diffSha256: sha(result.stdout), bytes: Buffer.byteLength(result.stdout) });
}
fs.writeFileSync(path.join(output, 'w296-source-comparison.json'), JSON.stringify({ modules: identities, copies, diffs }, null, 2));
console.log(`PASS ${identities.length} module digests, ${copies.length} copied AST bodies, literal default/global write and ${diffs.length} adapted comparisons`);
