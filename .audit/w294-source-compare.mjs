import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = process.env.W294_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const records = [], modules = new Map();
for (const name of ['qh0w98pn', 'nybcbd9t', '24k7d6mw', '06azbynj', '1r9zp6s1', 'kexg5hxg',
  'eb9r2hbv', 'bk5ct2gw', 'yvnhkg35', '5dxmnnh1', '6ccen3s8']) {
  const file = `chunk-${name}.js`, bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  const digest = sha(bytes); assert.equal(digest, manifest.modules.find(item => item.path === file)?.decodedSha256, file);
  modules.set(name, bytes.toString('utf8')); records.push({ file, sha256: digest });
}
function functions(text) {
  const result = new Map();
  walk.simple(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { if (!result.has(node.id.name)) result.set(node.id.name, node); },
  });
  return result;
}
const target = fs.readFileSync(path.join(root, 'src/tui-selection-copy.ts'), 'utf8');
const emitted = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const actual = functions(emitted);
const canonical = node => JSON.parse(JSON.stringify(node, (key, value) => {
  if (['start', 'end', 'raw'].includes(key)) return undefined;
  if (value?.type === 'UnaryExpression' && value.operator === '!' && [0, 1].includes(value.argument.value))
    return { type: 'Literal', value: !value.argument.value };
  return value;
}));
const copies = [];
for (const [name, module] of [['QLt', 'qh0w98pn'], ['lbt', '24k7d6mw'], ['AZ', 'eb9r2hbv'],
  ['ITo', 'yvnhkg35'], ['xt', 'yvnhkg35'], ['Z', 'yvnhkg35']]) {
  const original = functions(modules.get(module)).get(name), port = actual.get(name);
  assert.ok(original && port, name); assert.deepEqual(canonical(original.body), canonical(port.body), name);
  copies.push({ name, module, range: [original.start, original.end], unit: 'utf16', sha256: sha(modules.get(module).slice(original.start, original.end)) });
}
const originalHook = functions(modules.get('qh0w98pn')).get('xBe');
let before, after;
walk.simple(originalHook, { CallExpression(node) {
  if (node.callee.type === 'MemberExpression' && node.callee.property.name === 'subscribe') before = node.arguments[0];
} });
walk.simple(actual.get('selectionAutoCopy'), { VariableDeclarator(node) { if (node.id.name === 'change') after = node.init; } });
const callback = canonical(before.body);
const last = callback.body.at(-1);
assert.equal(last.type, 'ExpressionStatement');
assert.equal(last.expression.type, 'SequenceExpression');
assert.equal(last.expression.expressions[2].callee.name, 'g');
last.expression.expressions.splice(2, 1);
assert.deepEqual(callback, canonical(after.body), 'xBe callback except excluded telemetry');
copies.push({ name: 'xBe subscription callback', module: 'qh0w98pn', range: [before.start, before.end], unit: 'utf16', sha256: sha(modules.get('qh0w98pn').slice(before.start, before.end)), adaptation: 'remove clipboard_write telemetry only' });
const row = modules.get('nybcbd9t').slice(23905, 24064);
assert.match(row, /id:"copyOnSelect"/); assert.match(row, /value:s.copyOnSelect\?\?!0/);
assert.match(modules.get('nybcbd9t').slice(37501, 38693), /inAppSelection:!0/);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compare = [
  ['observer-feedback', modules.get('qh0w98pn').slice(3815, 5833) + modules.get('kexg5hxg').slice(7479, 8411)
    + modules.get('kexg5hxg').slice(10057, 10253), target],
  ['physical-key', modules.get('24k7d6mw').slice(124140, 124299) + modules.get('24k7d6mw').slice(126888, 130997) + modules.get('24k7d6mw').slice(141280, 142056), read('src/tui.ts')],
  ['native-copy', modules.get('06azbynj').slice(343861, 344249) + modules.get('1r9zp6s1').slice(26659, 27318), read('src/tui-renderer.ts')],
  ['config-row', row + modules.get('nybcbd9t').slice(8266, 8318), read('src/config-panel.ts') + read('src/theme-settings.ts') + read('src/config-panel-input.ts')],
  ['settings-consumers', row + modules.get('nybcbd9t').slice(8266, 8318), ['src/config.ts', 'src/runtime.ts', 'src/session.ts', 'src/cli.ts', 'src/reload.ts', 'src/interactive.ts', 'src/terminal.ts'].map(read).join('\n')],
  ['footer', modules.get('24k7d6mw').slice(768900, 768948) + modules.get('24k7d6mw').slice(769064, 769330), read('src/tui.ts')],
];
const diffs = [];
for (const [name, source, port] of compare) {
  const left = path.join(output, `w294-source-${name}.txt`), right = path.join(output, `w294-port-${name}.txt`);
  fs.writeFileSync(left, source); fs.writeFileSync(right, port);
  const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--word-diff=porcelain', '--word-diff-regex=.', left, right],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ok(diff.status === 0 || diff.status === 1, diff.stderr);
  fs.writeFileSync(path.join(output, `w294-diff-${name}.txt`), diff.stdout);
  diffs.push({ name, sourceSha256: sha(source), targetSha256: sha(port), diffSha256: sha(diff.stdout), bytes: Buffer.byteLength(diff.stdout) });
}
fs.writeFileSync(path.join(output, 'w294-source-comparison.json'), JSON.stringify({ modules: records, copies, diffs }, null, 2));
console.log(`PASS ${records.length} module digests, ${copies.length} copied AST bodies, literal Config gate and ${diffs.length} adapted character comparisons`);
