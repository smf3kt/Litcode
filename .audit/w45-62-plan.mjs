// Builds research/ports/W45-raster-sites-blocks.plan.json: the two raster leaf problems — `Jto` for a
// Raster and `Bto` for an Image — with the prop picker and the string/size/stamp checks they share.
// Eight runs of chunk-n3ykh62m.js, 14 statements, 1,980 units.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [233219, 233330],
    note: 'how a problem names the site it is about: `our` (40), the length a key is cut to, `IL`, which replaces what `y$\'s pattern matches and answers the text unchanged while it fits, and `RAt` (10000), the length a string check refuses past',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [233808, 233864],
    note: '`QAe`, the allowed-keys predicate: every own key of an object is one of the listed ones',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [235650, 235982],
    note: 'the checks both leaf problems run before their own: `EVe`, whether a leaf is stamped by a plugin of this chain (`plugin` a non-empty string), `xye`, a value that must be a string when given, within `RAt` characters and without a control character, and `XPn`, which sweeps a key list and answers the first problem it finds',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [237337, 237485],
    note: '`ace`, the same string check without the length cap — the one an alt or a label goes through, where `xye` is the one a key does',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [242738, 242804],
    note: '`H_` and `$_` (255 by 255), the size an Image is checked against, and `tL`, that check',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [245596, 246293],
    note: '`Bto`, the Image leaf problem: the props must be source/columns/rows/alt with a key when given, no children, and no other key at all — a leftover key is named in the message, because a press goes on an enclosing Button — then alt and key as strings, the size, the ImageSource shape `Mss`, and the stamp; the message is `Image "<key>" <problem>` or `Image <problem>`',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [247200, 247312],
    note: '`Gto`, the picker a Raster\'s props go through: an object whose `key` is a non-empty string and whose every other key is allowed, answered as a copy, or nothing at all',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [257143, 257601],
    note: '`Jto`, the Raster leaf problem: the props come from `Gto` against `Xto`, so a key and nothing else; no children; then the key sweep `XPn(["key"])`, the default size check `tF`, the cell decode `fur(cells, columns, rows)` — whose own problem is the message — and the stamp; the message is `Raster "<key>" <problem>`',
  },
];

const plan = {
  imports: [
    '// The raster leaf problems (W45-62): the two checks a Raster or an Image site is admitted by, and',
    '// the string, size and stamp checks both of them share.',
    '//',
    '// Eight blocks, 1,980 units, 14 statements of chunk-n3ykh62m.js. This is the reader of everything',
    '// ported since W45-58: `tF` and `Xto` are the mount W45-60 carried, `fur` the cell decoder and `Mss`',
    '// the ImageSource shape W45-58 carried, and `L`, `ne` and `y$` come from the chain-runner copy. The',
    '// one name in the closure that is neither is `$ne`, the location policy already owned by',
    '// ./plugin-chain-fs-boundaries.ts and imported there by the blit copy, so it is not copied again.',
    "import { L, ne, y$ } from './plugin-chain-source.js';",
    "import { Mss, QT, fur } from './plugin-chain-ui-blit-source.js';",
    "import { Kbr, Xto, tF } from './plugin-chain-raster-cells-source.js';",
  ],
  exports: [
    'our', 'IL', 'RAt', 'QAe', 'EVe', 'xye', 'XPn', 'ace', 'H_', '$_', 'tL', 'Bto', 'Gto', 'Jto',
  ],
  blocks,
};
const target = path.join(root, 'research/ports/W45-raster-sites-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units, ${plan.exports.length} exports`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
