// Builds research/ports/W45-raster-mount-blocks.plan.json: the mount side of the `$` table's raster
// surface — the site register helper and the two row writers that fill the registries W45-58's ui.blit
// reads. The two pairs are adjacent statements in their modules, so the plan is two blocks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [256712, 257058],
    note: 'declares the Raster side of the mount: `Yto`, the register helper (one site key, one row built on demand, the mount added to the row\'s own set, and the unregister that drops the key once its set empties and the map still holds that same row), and `hNs`, which calls it against `hs()` — the mounted-raster registry — with the row `{rasters:new Set,windowStart:0,blits:0}`',
  },
  {
    file: 'chunk-sfn1dbxq.js',
    range: [1869519, 1869714],
    note: 'declares the Image side: `ELs`, the same register against `Yj()` with the row `{images:new Set,windowStart:0,blits:0}`, and `vLs`, the builder an Image site passes its element and props through to gain its `swap`',
  },
];

const plan = {
  imports: [
    '// The mount side of the `$` table\'s raster surface (W45-59): what fills the two registries the',
    '// ui.blit entry reads. A plugin\'s site calls `hNs` when it mounts a Raster element and `ELs` when it',
    '// mounts an Image one; both go through `Yto`, which keys the site (`e5t`: plugin, requestId, key',
    '// joined with the NUL `QJt`), builds the row on the first mount and hands back the unregister that',
    '// drops the key once its set empties. `vLs` is the builder an Image site spreads its element and',
    '// props through to gain the `swap` the blit calls.',
    '//',
    '// Two blocks, 541 units: the two pairs are adjacent statements in their modules. The row shape is the',
    '// one W45-58 measured (`{rasters:new Set,windowStart:0,blits:0}` / `{images:new Set,…}`), and both',
    '// registries plus the site key `e5t` are bodies the blit copy already carries, so they are imports',
    '// rather than copies.',
    "import { e5t, hs, Yj } from './plugin-chain-ui-blit-source.js';",
  ],
  exports: ['Yto', 'hNs', 'ELs', 'vLs'],
  blocks,
};
const target = path.join(root, 'research/ports/W45-raster-mount-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
