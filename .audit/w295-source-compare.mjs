import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = process.env.W295_RESULT_DIR ?? path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const modules = new Map(), identities = [];
for (const name of ['24k7d6mw', 'nybcbd9t', 'js2bhabe', 'bk5ct2gw', '3cynezh1', 'sfn1dbxq',
  '3gz7s57c', '6x3scwgf', '06azbynj', '3c5vzz43', 'ax7r0qj7', 'phg89898', 'd65c1ax2']) {
  const file = `chunk-${name}.js`, bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  const digest = sha(bytes);
  assert.equal(digest, manifest.modules.find(item => item.path === file)?.decodedSha256, file);
  modules.set(name, bytes.toString('utf8')); identities.push({ file, sha256: digest });
}
function functions(text) {
  const nodes = new Map();
  walk.simple(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { if (!nodes.has(node.id.name)) nodes.set(node.id.name, node); },
  });
  return nodes;
}
const canonical = node => JSON.parse(JSON.stringify(node, (key, value) => {
  if (['start', 'end', 'raw'].includes(key)) return;
  if (value?.type === 'UnaryExpression' && value.operator === '!' && [0, 1].includes(value.argument.value))
    return { type: 'Literal', value: !value.argument.value };
  return value;
}));
const target = read('src/tui-scroll.ts');
const emitted = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const actual = functions(emitted), copies = [];
for (const [name, module] of [['rMe', '24k7d6mw'], ['pee', '24k7d6mw'], ['ybt', '24k7d6mw'],
  ['Sbt', '24k7d6mw'], ['bbt', '24k7d6mw'], ['Dv', '3gz7s57c'], ['Av', '3gz7s57c']]) {
  const original = functions(modules.get(module)).get(name), port = actual.get(name);
  assert.ok(original && port, name);
  assert.deepEqual(canonical(original.body), canonical(port.body), name);
  copies.push({ name, module, range: [original.start, original.end], unit: 'utf16',
    sha256: sha(modules.get(module).slice(original.start, original.end)) });
}
const source = modules.get('nybcbd9t'), row = source.slice(24065, 24243);
assert.match(row, /id:"autoScroll"/);
assert.match(row, /W\("autoScrollEnabled",e\)/);
assert.match(source.slice(37501, 38693), /inAppSelection:!0/);
assert.match(modules.get('sfn1dbxq').slice(1133554, 1133604), /tengu_maple_sundial",!1/);
assert.match(modules.get('bk5ct2gw').slice(558575, 558660), /autoScrollEnabled:!0/);
const compare = [
  ['growth-owner', modules.get('6x3scwgf').slice(1537, 2871) + modules.get('06azbynj').slice(286619, 287950), target],
  ['repin-divider', modules.get('24k7d6mw').slice(1333944, 1336535)
    + modules.get('3gz7s57c').slice(28427, 29232), target],
  ['pill', modules.get('3gz7s57c').slice(31126, 32600) + modules.get('3gz7s57c').slice(41715, 43141)
    + modules.get('3c5vzz43').slice(753, 1088), read('src/tui-scroll-pill.ts') + read('src/tui-renderer.ts')],
  ['terminal', modules.get('24k7d6mw').slice(126888, 132084) + modules.get('24k7d6mw').slice(1333944, 1336535), read('src/tui.ts')],
  ['settings', row + modules.get('js2bhabe').slice(1114, 1554),
    ['src/config-panel.ts', 'src/config-panel-input.ts', 'src/theme-settings.ts', 'src/runtime.ts',
      'src/session.ts', 'src/cli.ts', 'src/reload.ts', 'src/interactive.ts', 'src/terminal.ts'].map(read).join('\n')],
];
const diffs = [];
for (const [name, before, after] of compare) {
  const left = path.join(output, `w295-source-${name}.txt`), right = path.join(output, `w295-port-${name}.txt`);
  fs.writeFileSync(left, before); fs.writeFileSync(right, after);
  const result = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--word-diff=porcelain', '--word-diff-regex=.', left, right],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  fs.writeFileSync(path.join(output, `w295-diff-${name}.txt`), result.stdout);
  diffs.push({ name, sourceSha256: sha(before), targetSha256: sha(after), diffSha256: sha(result.stdout), bytes: Buffer.byteLength(result.stdout) });
}
fs.writeFileSync(path.join(output, 'w295-source-comparison.json'), JSON.stringify({ modules: identities, copies, diffs }, null, 2));
console.log(`PASS ${identities.length} module digests, ${copies.length} copied AST bodies, literal gate/default and ${diffs.length} adapted character comparisons`);
