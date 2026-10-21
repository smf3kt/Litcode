import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..'), require = createRequire(path.join(root, 'package.json'));
const { parse } = require('acorn'), ts = require('typescript');
const output = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w234-source-'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sources = new Map();
function source(module, ranges) {
  if (!sources.has(module)) {
    const text = fs.readFileSync(path.join(root, 'extracted-v2/modules', module), 'utf8');
    assert.equal(sha(text), manifest.modules.find(row => row.path === module).decodedSha256);
    const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), nodes = new Set();
    function walk(node) {
      nodes.add(`${node.start}:${node.end}`);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') walk(child); }
        else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value);
      }
    }
    walk(ast); sources.set(module, { text, nodes });
  }
  const item = sources.get(module);
  for (const [start, end] of ranges) assert.ok(item.nodes.has(`${start}:${end}`), `AST ${module} ${start}:${end}`);
  return { module, sha256: sha(item.text), ranges, coordinates: 'utf16',
    text: ranges.map(([start, end]) => item.text.slice(start, end)).join('\n') };
}
function target(file, symbol) {
  const text = fs.readFileSync(path.join(root, file), 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = [];
  function walk(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer))
      && node.name?.getText(ast) === symbol) found.push(node);
    ts.forEachChild(node, walk);
  }
  walk(ast); assert.equal(found.length, 1, `${file} ${symbol}`);
  return { file, symbol, start: found[0].getStart(ast), end: found[0].end,
    text: text.slice(found[0].getStart(ast), found[0].end) };
}
function slice(file, first, after) {
  const text = fs.readFileSync(path.join(root, file), 'utf8'), start = text.indexOf(first), end = text.indexOf(after, start);
  assert.ok(start >= 0 && end > start, `${file} ${first}`);
  return { file, start, end, text: text.slice(start, end) };
}
const pairs = [
  ['row', [source('chunk-nybcbd9t.js', [[12034,12244],[5051,6113],[6113,6155]]), source('chunk-bk5ct2gw.js', [[558575,558596]])],
    [target('src/config-panel.ts', 'rows'), target('src/config-panel-input.ts', 'configPanelInput')]],
  ['persistence', [source('chunk-nybcbd9t.js', [[8208,8266]]), source('chunk-js2bhabe.js', [[1114,1499],[1499,1554]])],
    [target('src/theme-settings.ts', 'saveConfigPanelSetting'), slice('src/interactive.ts', "                    case 'autoCompact':", "                    case 'reduceMotion':")]],
  ['admission', [source('chunk-nybcbd9t.js', [[5051,6113],[6113,6155]])],
    [target('src/runtime.ts', 'parseSettings'), target('src/reload.ts', 'reloadConfig'), target('src/session.ts', 'SessionConfig'),
      slice('src/session.ts', '  compactAt: z.number()', '  stopHookBlockCap:'),
      slice('src/cli.ts', '  config.compactAt =', '  config.maxOutputBytes =')]],
  ['environment', [source('chunk-fdxhcr6b.js', [[615,757]]), source('chunk-14rnebpd.js', [[317863,317949],[317949,318021]]),
      source('chunk-sfn1dbxq.js', [[1132121,1132437]])],
    ['enabledFlag','manualCompactionEnabled','automaticCompactionEnabled'].map(symbol => target('src/compaction-policy.ts', symbol))],
  ['automatic-gates', [source('chunk-sfn1dbxq.js', [[2593055,2593868],[859411,859734],[863158,863237]]),
      source('chunk-5b2hxy2e.js', [[147582,148075],[125441,126326]])],
    [target('src/compaction-policy.ts', 'contextBlockingLimit'), slice('src/agent.ts', '        if (media) {', "        this.session.append({ kind: 'message', message, classifier:"),
      slice('src/agent.ts', '        const tokens = await this.provider.count(this.request(), signal);', '        const request = this.request();')]],
  ['manual', [source('chunk-sfn1dbxq.js', [[1132121,1132437]]), source('chunk-qy8qtapj.js', [[14510,15263]])],
    [target('src/agent.ts', 'compactContext'), target('src/agent.ts', 'compact')]],
  ['threshold-apply', [source('chunk-agx4redd.js', [[1968,3167]])],
    [slice('src/interactive.ts', '          const result = applyAutoCompactWindow(argument, { model, limit });', "        if (prompt === '/keybindings')")]],
  ['captions', [source('chunk-agx4redd.js', [[1174,1968]]), source('chunk-c27zz9xr.js', [[15808,19858]])],
    [target('src/autocompact-command.ts', 'autoCompactStatus'), target('src/autocompact-command.ts', 'autoCompactDialogMessage'),
      slice('src/interactive.ts', "        if (prompt === '/autocompact'", "        if (prompt === '/keybindings')")]],
];
const records = [];
for (const [name, originals, ports] of pairs) {
  const left = originals.map(item => item.text).join('\n'), right = ports.map(item => item.text).join('\n');
  const a = path.join(output, `${name}-source.txt`), b = path.join(output, `${name}-port.txt`);
  fs.writeFileSync(a, left); fs.writeFileSync(b, right);
  const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--word-diff=porcelain', '--word-diff-regex=.', a, b],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.ok(diff.status === 0 || diff.status === 1, diff.stderr);
  fs.writeFileSync(path.join(output, `${name}-diff.txt`), diff.stdout);
  records.push({ name, source: originals.map(({ text, ...item }) => item),
    target: ports.map(({ text, start, end, ...item }) => ({ ...item, range: [start, end], coordinates: 'utf16', sha256: sha(text) })),
    diff: { sha256: sha(diff.stdout), bytes: Buffer.byteLength(diff.stdout) } });
}
const evidence = { schema: 'W234SourceComparison.v1', artifact: manifest.sha256, groups: records };
fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output, groups: records.length, diffBytes: records.reduce((sum, row) => sum + row.diff.bytes, 0),
  evidence: sha(JSON.stringify(evidence, null, 2) + '\n') }));
