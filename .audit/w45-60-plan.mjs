// Builds research/ports/W45-raster-cells-blocks.plan.json: the raster cell encoder and the admission
// bucket a surface paints its frames through — the pieces between the registries W45-59 fills and the
// engine that drives them. Every block is a whole top-level statement run; neighbours that only the
// engine uses (nb, fc, Ff, pc, Sc, gb, hb) are deliberately left out and named in the record.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [248693, 248705],
    note: '`tb`, the millisecond base the token bucket refills against (1000) — the sibling `nb` (64) belongs to the engine and is not copied',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [248715, 248812],
    note: 'the packed-colour half word: `Lr` (halfBits 16, halfMask 65535, defaultMismatch 4096) and `dc`, which takes the high half — with `mc`, the low half',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252131, 252200],
    note: '`Gn`, the channel layout one colour is packed with: 4 bits per channel, max 15, step 17, green at shift 4 and red at shift 8',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252243, 252256],
    note: '`ys`, the sentinel (32768, the high bit) that marks a channel as the surface default rather than a packed colour',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252455, 252481],
    note: '`mc`, the low half of the packed pair — the foreground half `$f` writes',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [252898, 253057],
    note: '`gn`, the word layout of one painted cell: width 8, then foreground default/red/green/blue at 0..3 and background default/red/green/blue at 4..7',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [253816, 253943],
    note: 'the admission bucket: `bc` its capacity (4096), `fb` the fresh row (`{tokens: bc, refilledAt: 0}`), and `mb` the memoized accessor that lazily writes the row into the host registry and clears it again',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [253969, 254367],
    note: 'the refill and the encoder: `yb` the tokens per second (160), `Sb` which refills the row against the clock and spends one token per admitted frame, and `$f` which writes one cell — the default flag plus the three channels of the foreground and of the background — into the surface word table. The sibling constants `gb` (1024) and `hb` (131072) are the engine\'s costs, not this pair\'s',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [256690, 256712],
    note: '`bb` and `wb`, the default raster size (512 by 256) the validating mount checks against',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [257058, 257143],
    note: 'the validating mount: `tF`, which checks a key and size against the defaults through `Kbr`, and `Xto`, the field list a site mount admits',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87140, 87341],
    note: '`Kbr`, the whole-number check both sizes answer: a columns outside 1..the limit gets `columns must be a whole number from 1 to N`, and a rows gets the same sentence for `rows`',
  },
];

const plan = {
  imports: [
    '// The raster cell encoder and the admission bucket a surface paints its frames through (W45-60).',
    '// A site validates its key and size through `tF`/`Kbr`, mounts through the W45-59 writers, and paints',
    '// a frame by encoding each cell with `$f` into the surface word table while `Sb` admits the frame',
    '// against a refilling token row (`mb`, held in the host registry as `rasterAdmission`).',
    '//',
    '// Eleven blocks, 1,209 units. The pair and the constants are read from the same module as the mount',
    '// writers; `Kbr` lives in the chain-runner module and needs only `h$`, which that copy carries and',
    '// W45-58 exported. `Ge` is the chain-runner copy\'s own body — an identity in this build, so `mb` is',
    '// the factory it was handed and the invalidator beside it is dropped by the source itself.',
    "import { Ge, h$ } from './plugin-chain-source.js';",
    "import { it } from './plugin-chain-host.js';",
  ],
  exports: ['tb', 'Lr', 'dc', 'Gn', 'ys', 'mc', 'gn', 'bc', 'fb', 'mb', 'yb', 'Sb', '$f', 'bb', 'wb', 'tF', 'Xto', 'Kbr'],
  blocks,
};
const target = path.join(root, 'research/ports/W45-raster-cells-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
