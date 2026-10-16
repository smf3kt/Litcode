// Builds research/ports/W45-settings-merge-blocks.plan.json from the measured closure of the merge
// seeds in chunk-3cynezh1.js. The closure tool prints one line per statement; this reads those lines
// rather than a hand-typed range list, so a plan can never disagree with the measurement.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawnSync(process.execPath, [path.join(root, '.audit/w45-49-closure.mjs'),
  'chunk-3cynezh1.js', 'MB', 'Y3'], {cwd: root, encoding: 'utf8'});
if (child.status !== 0) throw new Error(child.stderr || 'closure tool failed');
const statements = [];
for (const line of child.stdout.split('\n')) {
  const match = /^\s*(\d+)u \[(\d+),(\d+)\) \w+ ([\w$,]+)\s+<-/.exec(line);
  if (match) statements.push({units: Number(match[1]), start: Number(match[2]), end: Number(match[3]), names: match[4]});
}
if (statements.length !== 52) throw new Error(`expected 52 statements, measured ${statements.length}`);

const semantic = new Map([
  [343894, 'declares `Ml`, the assigner `Tf` is bound through, and `Pf`/`MB`: lodash `mergeWith` — the merge every settings source is folded with'],
  [428230, 'declares `CHt`, the one-level override the customizer uses for `extraKnownMarketplaces` and `managedMcpServers`'],
  [428266, 'declares `Y3`, the settings merge customizer: `modelPicker` (normalized), array fields (`fallbackModel` replaces, the rest concatenate and dedupe), and the two map fields (one-level override)'],
  [428518, 'declares `ic`, the `modelPicker` normalizer: the picker object spread with its `options` array elements spread in turn'],
]);
const blocks = statements.map(({units, start, end, names}) => ({
  file: 'chunk-3cynezh1.js',
  range: [start, end],
  note: semantic.get(start) ?? `declares ${names} (${units} units)`,
}));

const plan = {
  imports: [
    '// The settings merge layer: the lodash `mergeWith` a settings read folds its sources with, and',
    '// the customizer `Y3` that decides what "merge" means per key — `modelPicker` normalizes, array',
    '// fields replace (`fallbackModel`) or concatenate-and-dedupe, `extraKnownMarketplaces` and',
    '// `managedMcpServers` take a one-level override, and every other key falls through to lodash.',
    '// The closure is 49 lodash-merge statements plus `CHt`/`Y3`/`ic`, 52 statements and 4,033 units,',
    '// all in chunk-3cynezh1.js at measured ranges (the 60k-line chunk whose top-level map cannot be',
    '// walked reliably — the W45-51 limitation).',
    '//',
    '// Every helper the merge internals close over is already in the product: the dedupe `D` and the',
    '// plain-object test `L` from ./plugin-chain-source.js and ./plugin-chain-store-carry-source.js,',
    '// the lodash internals from ./plugin-chain-lodash-internals-source.js (whose plan this package',
    '// extends with `Lxr`, the `baseEach` the merge walks collections with, and with the exports the',
    '// closure reads), and the memoize/internals helpers from ./plugin-chain-memoize-source.js and',
    '// ./plugin-chain-lodash-memoize-source.js (whose plan this package extends with `e1e`/`don`/`e8e`).',
    '//',
    '// Port: the bundle wraps this lodash module in CommonJS, so the preamble below reads the module',
    '// namespace object as `Rn` (declared by the copied statement at [340392,340402)) and a second',
    '// module reference the minifier left free as `Cn`. `Cn` has no declaration anywhere in the chunk,',
    '// so the bundle takes the same false arm an ESM copy does: `fl`, `qm` and `hl` stay undefined and',
    '// `yl` — the safe-allocation helper — is undefined with them. The declaration below makes that',
    '// free name explicit rather than inventing a branch. Recorded in the W45-55 package record.',
    "import { D } from './plugin-chain-source.js';",
    "import { L } from './plugin-chain-store-carry-source.js';",
    "import { A1e, D8e, L8e, Lxr, U8e, YMt, Zon, k1e, nsn, osn, pG, wwe, zZ, zw } from './plugin-chain-lodash-internals-source.js';",
    "import { Hwe, TDt, _U, aA, nie } from './plugin-chain-memoize-source.js';",
    "import { don, e8e, e1e } from './plugin-chain-lodash-memoize-source.js';",
    'var Cn = undefined;',
  ],
  exports: ['MB', 'Y3', 'CHt', 'ic'],
  blocks,
};
const target = path.join(root, 'research/ports/W45-settings-merge-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units`);
