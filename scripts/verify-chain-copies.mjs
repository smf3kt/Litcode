import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as acorn from 'acorn';

const root = fileURLToPath(new URL('..', import.meta.url));
const generator = path.join(root, 'scripts/copy-module-regions.mjs');
const moduleRoot = path.join(root, 'extracted-v2/modules') + path.sep;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = relative => fs.readFileSync(path.join(root, relative));
const files = [
  ['W45-chain-runner', 'plugin-chain-source'],
  ['W45-chain-matchers', 'plugin-chain-matchers'],
  ['W45-chain-records', 'plugin-chain-records'],
  ['W45-chain-entry', 'plugin-chain-entry'],
  ['W45-chain-relay', 'plugin-chain-relay-source'],
  ['W45-chain-install', 'plugin-chain-install-source'],
  ['W45-chain-memoize', 'plugin-chain-memoize-source'],
  ['W45-loader', 'plugin-chain-loader-source'],
  ['W45-chain-decorations', 'plugin-chain-decorations-source'],
  ['W45-sgr-tokens', 'tui-sgr-tokens-source'],
  ['W45-highlights-producers', 'tui-input-highlights-source'],
  ['W45-chain-sites', 'plugin-chain-sites-source'],
  ['W45-chain-cores', 'plugin-chain-cores-source'],
  ['W45-chain-classic', 'plugin-chain-classic-source'],
  ['W45-chain-override-sites', 'plugin-chain-override-sites-source'],
  ['W45-lodash-memoize-source', 'plugin-chain-lodash-memoize-source'],
  ['W45-lodash-internals-source', 'plugin-chain-lodash-internals-source'],
  ['W45-lodash-mapvalues-source', 'plugin-chain-lodash-mapvalues-source'],
  ['W45-classic-sites', 'plugin-chain-classic-sites-source'],
  ['W45-tool-raise', 'plugin-chain-tool-raise-source'],
  ['W45-classic-raise', 'plugin-chain-classic-raise-source'],
  ['W45-host-call', 'plugin-chain-host-call-source'],
  ['W45-stream', 'plugin-chain-stream-source'],
  ['W45-stream-call', 'plugin-chain-stream-call-source'],
  ['W45-ui', 'plugin-chain-ui-source'],
  ['W45-toast', 'plugin-chain-toast-source'],
  ['W45-notify', 'plugin-chain-notify-source'],
  ['W45-notify-store', 'plugin-chain-notify-store-source'],
  ['W45-notify-write', 'plugin-chain-notify-write-source'],
  ['W45-notify-fold', 'plugin-chain-notify-fold-source'],
  ['W45-notify-clock', 'plugin-chain-notify-clock-source'],
  ['W45-notify-stack', 'plugin-chain-notify-stack-source'],
  ['W45-notify-verbs', 'plugin-chain-notify-verbs-source'],
  ['W45-registry', 'plugin-chain-registry-source'],
  ['W45-registry-stores', 'plugin-chain-registry-stores-source'],
  ['W45-text-clamp', 'plugin-chain-text-clamp-source'],
  ['W45-normalize', 'plugin-chain-normalize-source'],
  ['W45-label-text', 'plugin-chain-label-text-source'],
  ['W45-bar-mount', 'plugin-chain-bar-mount-source'],
  ['W45-notify-queue', 'plugin-chain-notify-queue-source'],
  ['W45-registry-reset', 'plugin-chain-registry-reset-source'],
  ['W45-sources-registry', 'plugin-chain-sources-registry-source'],
  ['W45-invalidate', 'plugin-chain-invalidate-source'],
  ['W45-session', 'plugin-chain-session-source'],
  ['W45-clock-env', 'plugin-chain-clock-env-source'],
  ['W45-fs', 'plugin-chain-fs-source'],
  ['W45-store-path', 'plugin-chain-store-path-source'],
  ['W45-lockfile', 'plugin-chain-lockfile-source'],
  ['W45-atomic-writer', 'plugin-chain-atomic-source'],
  ['W45-store-carry', 'plugin-chain-store-carry-source'],
  ['W45-store-entry', 'plugin-chain-store-entry-source'],
  ['W45-settings-read', 'plugin-chain-settings-read-source'],
  ['W45-local-store-probes', 'plugin-chain-local-store-probes-source'],
  ['W45-settings-source', 'plugin-chain-settings-source-source'],
  ['W45-settings-merge', 'plugin-chain-settings-merge-source'],
  ['W45-local-store', 'plugin-chain-local-store-source'],
  ['W45-ui-blit', 'plugin-chain-ui-blit-source'],
  ['W45-raster-mount', 'plugin-chain-raster-mount-source'],
  ['W45-raster-cells', 'plugin-chain-raster-cells-source'],
  ['W45-raster-surface', 'plugin-chain-raster-surface-source'],
  ['W45-raster-sites', 'plugin-chain-raster-sites-source'],
  ['W45-site-leaves', 'plugin-chain-site-leaves-source'],
  ['W45-style-props', 'plugin-chain-style-props-source'],
  ['W45-client-markdown-link', 'plugin-chain-leaves-source'],
  ['W45-keybindings', 'plugin-chain-keys-source'],
  ['W45-button', 'plugin-chain-button-source'],
  ['W45-keybinding-editor', 'plugin-chain-keys-editor-source'],
  ['W45-keybinding-rows', 'plugin-chain-keys-rows-source'],
  ['W45-leaf-walkers', 'plugin-chain-leaf-walkers-source'],
  ['W45-call-dispatch', 'plugin-chain-call-dispatch-source'],
  ['W45-scroll-focus', 'plugin-chain-scroll-focus-source'],
  ['W45-scroll-focus-sites', 'plugin-chain-scroll-focus-sites-source'],
];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-copy-check-'));
const verifiedModules = new Map();
const records = [];
try {
  for (const [name, output] of files) {
    const planPath = `research/ports/${name}-blocks.plan.json`;
    const ledgerPath = `src/${output}-blocks.json`;
    const plan = JSON.parse(read(planPath));
    const ledger = JSON.parse(read(ledgerPath));
    const product = read(`src/${output}.ts`).toString('utf8');
    assert.deepEqual(ledger.missing, [], `${output} has no missing source blocks`);
    for (const block of ledger.blocks) {
      const bytes = fs.readFileSync(path.join(moduleRoot, block.module));
      const expected = manifest.modules.find(entry => entry.path === block.module)?.decodedSha256;
      assert.ok(expected, `${block.module} has a manifest record`);
      assert.equal(hash(bytes), expected, `${block.module} matches the manifest`);
      assert.equal(block.sha256, expected, `${output} records the module digest`);
      const [start, end] = block.range;
      const text = bytes.toString('utf8');
      assert.ok(start >= 0 && end > start && end <= text.length, `${output} has bounded source coordinates`);
      assert.equal(end - start, block.units);
      assert.equal(hash(text.slice(start, end)), block.bodySha256, `${output} records the source body digest`);
      assert.ok(product.includes(text.slice(start, end)), `${output} contains the recorded source body`);
      verifiedModules.set(block.module, expected);
    }
    const generated = path.join(directory, `${output}.ts`);
    const child = spawnSync(process.execPath, [generator, path.join(root, planPath), moduleRoot, generated], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(child.status, 0, child.error?.message ?? child.stderr);
    assert.equal(fs.readFileSync(generated).equals(read(`src/${output}.ts`)), true, `${output} regenerates exactly`);
    assert.equal(fs.readFileSync(generated.replace(/\.ts$/, '-blocks.json')).equals(read(ledgerPath)), true,
      `${output} ledger regenerates exactly`);
    records.push({plan: planPath, product: `src/${output}.ts`, sha256: hash(read(`src/${output}.ts`)),
      blocks: ledger.blocks.length, units: ledger.blocks.reduce((sum, block) => sum + block.units, 0)});
    assert.equal(plan.blocks.length, ledger.blocks.length);
  }

  const memoPlan = JSON.parse(read('research/ports/W45-chain-memoize-blocks.plan.json'));
  const memoLedger = JSON.parse(read('src/plugin-chain-memoize-source-blocks.json'));
  const requiredRanges = [[707, 2367], [2367, 5355]];
  assert.deepEqual(memoPlan.blocks.map(block => [block.file, block.range]),
    requiredRanges.map(range => ['chunk-ae84tp6z.js', range]));
  assert.deepEqual(memoLedger.blocks.map(block => [block.module, block.range]),
    requiredRanges.map(range => ['chunk-ae84tp6z.js', range]));
  // `V` and `po` are the chain's own; the rest are the helpers the W45-14 lodash copies read out of this
  // module rather than copying a second time. The copy itself stays import-free.
  assert.deepEqual(memoPlan.exports, ['V', 'po', 'nie', 'rie', 'nIr', '_U', 'aA', 'bG', 'iYe', 'Hwe', 'Qpt', 'RDt', 'TDt', 'Zpt']);
  assert.deepEqual(memoPlan.imports, []);
  const source = fs.readFileSync(path.join(moduleRoot, 'chunk-ae84tp6z.js'), 'utf8');
  const statements = acorn.parse(source, {ecmaVersion: 'latest', sourceType: 'module'}).body;
  for (const [start, end] of [[707, 2367], [2367, 5355]]) {
    const selected = statements.filter(node => node.start >= start && node.end <= end);
    assert.equal(selected[0].start, start);
    assert.equal(selected.at(-1).end, end);
    assert.equal(selected.some(node => node.type === 'ImportDeclaration'), false);
    for (let index = 1; index < selected.length; index++) assert.equal(selected[index - 1].end, selected[index].start);
  }
  const memoSource = read('src/plugin-chain-memoize-source.ts').toString('utf8');
  const memoAst = acorn.parse(memoSource, {ecmaVersion: 'latest', sourceType: 'module'});
  assert.equal(memoAst.body.some(node => node.type === 'ImportDeclaration'), false);
  // The file exports exactly what the plan pins, in the plan's order; the literal pin is the one above.
  assert.deepEqual(memoAst.body.filter(node => node.type === 'ExportNamedDeclaration')
    .flatMap(node => node.specifiers.map(specifier => specifier.exported.name)), memoPlan.exports);

  // Exercise the missing-output failure in an owned directory, never against the product tree.
  fs.mkdirSync(path.join(directory, 'src'));
  const sentinel = path.join(directory, 'src/plugin-chain-source.ts');
  fs.writeFileSync(sentinel, 'keep this output\n');
  const invalid = spawnSync(process.execPath, [generator,
    path.join(root, 'research/ports/W45-chain-memoize-blocks.plan.json'), moduleRoot], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage: node scripts\/copy-module-regions\.mjs PLAN MODULE_DIRECTORY\/ OUTPUT\.ts/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep this output\n');
  assert.equal(fs.existsSync(path.join(directory, 'src/plugin-chain-source-blocks.json')), false);
  const incompletePlan = path.join(directory, 'incomplete-plan.json');
  const incompleteOutput = path.join(directory, 'incomplete.ts');
  const rejectedPlans = [
    {...memoPlan, blocks: memoPlan.blocks.slice(0, 1)},
    {...memoPlan, blocks: [...memoPlan.blocks, {file: 'chunk-ae84tp6z.js', needle: 'function absentW45Fixture(', k: 'fn'}]},
  ];
  for (const rejected of rejectedPlans) {
    fs.writeFileSync(incompletePlan, JSON.stringify(rejected));
    fs.writeFileSync(incompleteOutput, 'keep incomplete output\n');
    const result = spawnSync(process.execPath, [generator, incompletePlan, moduleRoot, incompleteOutput], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Incomplete source copy/);
    assert.equal(fs.readFileSync(incompleteOutput, 'utf8'), 'keep incomplete output\n');
    assert.equal(fs.existsSync(path.join(directory, 'incomplete-blocks.json')), false);
  }

  console.log(JSON.stringify({schema: 'W45ChainCopyVerification.v1', passed: true, files: records,
    byteIdenticalFiles: records.length * 2, modules: Object.fromEntries(verifiedModules),
    memoizeClosure: {ranges: memoLedger.blocks.map(block => block.range),
      units: memoLedger.blocks.reduce((sum, block) => sum + block.units, 0), coordinates: 'zero-based UTF-16 [start,end)',
      completeTopLevelStatements: true, applicationImports: 0, exports: memoPlan.exports},
    missingOutputLeavesFilesUnchanged: true, incompletePlanLeavesFilesUnchanged: true,
    recoveredApplicationEntrypointsExecuted: false}, null, 2));
} finally {
  fs.rmSync(directory, {recursive: true, force: true});
}
