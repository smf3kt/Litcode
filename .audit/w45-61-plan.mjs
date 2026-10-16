// Builds research/ports/W45-raster-surface-blocks.plan.json: the surface engine `gNs` — the pass that
// admits a frame's keys, places them in the slot table, matches them against what is already there and
// answers each key's escape — with the row builder that drives it, the surface state and matcher it
// runs on, the SGR and colour builders its escapes come from, and the CSI helper those are written
// with. Seven runs of chunk-n3ykh62m.js and the three statements of the CSI helper they need.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [248705, 248715],
    note: '`nb` (64), the bound the engine\'s alias sweep walks within',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252200, 252243],
    note: '`fc`, one channel of a packed colour widened to the 0..255 the escape wants (`(c >> shift & 15) * 17`) — the sibling the grammar names after it',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252256, 252455],
    note: 'the colour the escapes carry: `Ff`, which answers the sentinel unchanged and otherwise un-packs the three channels back to their own shifts, and `pc`, which packs two of them into one word — a pair is the foreground and the background',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252481, 252898],
    note: 'the SGR the surface measures its work in: `_s` the code table (38/48 set, 39/49 reset, 2 truecolor), `Hf` the parameter list for one side, `gc` the pair of sequences for a colour, `hc` the sequence a fresh paint starts from, and `Sc` (1024) the slot capacity',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [253057, 253816],
    note: 'the surface state and the matcher: `lb`, which builds the slots/held/table/probe/aliases row (including the `Uint8Array(Sc * gn.width)` cell table and its one-cell probe), `cb` the slots a paint has not touched, oldest first, `ub` (16384) the alias bound, and `db`, which scores every slot against the probe by squared channel distance — counting `Lr.defaultMismatch` where a default flag differs — and answers the closest',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [253943, 253969],
    note: '`gb` (1024) and `hb` (131072), the two numbers the engine spends and bounds its work with: the cost of reusing a slot, and the cap on what one paint may evaluate',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [254367, 256690],
    note: 'the engine and the rows it writes: `gNs`, whose `beginPaint` admits the frame\'s keys (a free slot or the stalest one, each admitted through the token row), rewrites the table, and whose `sgrOf` answers a key\'s escape — reusing what the last paint placed, then a slot matched by `db`, and answering the held escape when neither applies — with `size()` and `standing()` beside it; `_b`, which turns a frame into the distinct colour runs a row is made of; and `Lss`, which walks the frame row by row, emitting an escape only when the colour changes and a character for every cell',
  },
  {
    file: 'chunk-yn0pfn70.js',
    range: [935, 1251],
    note: 'the terminal grammar the CSI helper is written against: `xse` the C0 code points, `PH` the escape, `nG` the bell, `Y9e` the parameter separator, `fRr` the charset reset, and `CZ` the introducer bytes (CSI 91, OSC 93, DCS 80, APC 95, PM 94, SOS 88, ST 92)',
  },
  {
    file: 'chunk-yn0pfn70.js',
    range: [1286, 1426],
    note: '`A`, the CSI introducer built from the grammar (esc plus the CSI byte), and `S`, the parameter/intermediate/final byte ranges',
  },
  {
    file: 'chunk-yn0pfn70.js',
    range: [1602, 1743],
    note: '`fl`, the CSI helper the SGR builder writes every sequence with: no argument answers the bare introducer, one argument appends it, and more join all but the last with the separator and append the last',
  },
];

const plan = {
  imports: [
    '// The raster surface engine (W45-61): the pass that admits a frame\'s keys, places them in the slot',
    '// table, matches them against what is already there and answers each key\'s escape — with the row',
    '// builder that drives it, the surface state and matcher it runs on, the SGR and colour builders its',
    '// escapes are made of, and the CSI helper those are written with.',
    '//',
    '// Ten blocks, 4,374 units. Seven runs of chunk-n3ykh62m.js and the three statements of the CSI helper',
    '// in chunk-yn0pfn70.js that `gc`/`hc` call. Everything else the engine reaches is already carried and',
    '// imported rather than copied a second time: the bucket and the cell encoder from the W45-60 copy, the',
    '// surface\'s cell stride and colour grammar from the W45-58 one, and `Ge` from the chain-runner copy.',
    "import { Ge } from './plugin-chain-source.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { $f, Gn, Lr, Sb, bc, dc, fb, gn, mb, mc, tb, yb, ys } from './plugin-chain-raster-cells-source.js';",
    "import { gs, ko, xo } from './plugin-chain-ui-blit-source.js';",
  ],
  exports: [
    'nb', 'fc', 'Ff', 'pc', '_s', 'Hf', 'gc', 'hc', 'Sc', 'lb', 'cb', 'ub', 'db', 'gb', 'hb', 'gNs', '_b', 'Lss',
    'xse', 'PH', 'nG', 'Y9e', 'fRr', 'CZ', 'A', 'S', 'fl',
  ],
  blocks,
};
const target = path.join(root, 'research/ports/W45-raster-surface-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units, ${plan.exports.length} exports`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
