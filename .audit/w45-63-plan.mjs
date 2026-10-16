// Builds research/ports/W45-site-leaves-blocks.plan.json: the leaves of the site tree whose checks need
// nothing but what is already carried — Code, Input, Select with its option check, and Svg — with the
// small predicates and limits they share. Eight runs of chunk-n3ykh62m.js, 15 statements, 3,557 units.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [233140, 233219],
    note: '`TAt`, the autoFocus check three leaves run: absent or exactly `true`, and anything else answers the sentence',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [233330, 233611],
    note: '`xAt`, the hover-scope key check: a non-empty string of at most `RAt`, without a control character, and each refusal says what happens instead — the key is dropped and names no scope',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [233864, 234038],
    note: '`wVe`, the press check: the leaf must be held by a plugin of this chain, which for a press means a plugin name and a whole-number handle',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [236808, 236820],
    note: '`PAt` (1e9), the line a Code block may start at',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [237485, 238267],
    note: '`Lto`, the Code leaf problem: props are `{ source }` and any of language, path, startLine, format, wrap, with no other key and no children; source by `ace`, language and path by `xye`, then startLine as a positive safe integer within `PAt`, format one of source or diff, and wrap one of wrap or truncate-end — every sentence prefixed with `Code`',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [246293, 246804],
    note: '`cur`, the four fields an Input admits beside `key` and `autoFocus`, and `jto`, the Input leaf problem: the props are checked by an every-key sweep rather than a picker, then the four fields in list order, then autoFocus, then the press — and children last, so `Input "<key>" takes no children` is the one sentence with no field name in it',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [246992, 247131],
    note: 'the checks an Input and a Select share: `ZAe`, a string that is not blank once trimmed, `JPn` (4096), the pixel bound an Svg side is measured against, and `uur`, which admits an absent side and otherwise a finite positive number within `JPn`',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [257601, 259180],
    note: 'the Select and the Svg: `mur` (64), how many options a Select may hold; `Qto`, the option check — `{ value, label? }` and nothing else, a value that is a string and unique within the Set the caller threads through, a label by `ace` — whose sentence is `option "<value>" <problem>`; `Zto`, the Select leaf problem, which checks the key list, the label, the value, then the options through `Qto`, then autoFocus, the press and finally children; `gur` (131072), how long an Svg source may be; and `eno`, the Svg leaf problem — source, alt, width and height, with the size pair checked together against `JPn` and `isInteractive` last',
  },
];

const plan = {
  imports: [
    '// The site leaves (W45-63): the four leaf problems whose checks need nothing but what this product',
    '// already carries — Code, Input, Select with its option check, and Svg — and the predicates and',
    '// limits they share.',
    '//',
    '// Eight blocks, 3,557 units, 15 statements of chunk-n3ykh62m.js. The predicates are the W45-62',
    '// leaf-problem copy\'s (`IL`, `RAt`, `QAe`, `ace`, `xye`), the control pattern is the W45-58 blit',
    '// copy\'s `QT`, and `L` and the plan\'s four leaves are the chain-runner copy\'s. Three leaves of the',
    '// same table are deliberately not here: they drag the path boundary or the error formatter in with',
    '// them, and are recorded as the next package rather than half-carried.',
    "import { L } from './plugin-chain-source.js';",
    "import { QT } from './plugin-chain-ui-blit-source.js';",
    "import { ace, IL, QAe, RAt, xye } from './plugin-chain-raster-sites-source.js';",
  ],
  exports: [
    'TAt', 'xAt', 'wVe', 'PAt', 'Lto', 'cur', 'jto', 'ZAe', 'JPn', 'uur', 'mur', 'Qto', 'Zto', 'gur', 'eno',
  ],
  blocks,
};
const target = path.join(root, 'research/ports/W45-site-leaves-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units, ${plan.exports.length} exports`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
