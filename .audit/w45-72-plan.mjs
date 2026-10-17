// W45-72 plan: partition 1 of the React layer — the Raster site component, the paint scheduler and
// the surface hook that binds a mounted raster to the node it draws into. The rest of the layer (the
// Image component with its source/decode bodies, the leaf components, the site-tree walker `je`, the
// hooks and terminal glue) is partitioned in the package record.
import fs from 'node:fs';

const plan = {
  imports: [
    "// The React layer is a seam in this build: no React runtime is carried. The hook functions are",
    "// the adapter's (`Ae`, `R`, `Tc`, `Z`, `en`, `n`, `qt`, `s`, `tI`, `y`, `ZFt`), and the",
    "// raster side is imported from the packages that already carry it (`gNs`/`Lss` from W45-61,",
    "// `hNs` from W45-59, `fur` from W45-58).",
    "import { Ae, R, Tc, Z, en, n, qt, s, tI, y, ZFt } from './plugin-chain-react-hooks.js';",
    "import { gNs, Lss } from './plugin-chain-raster-surface.js';",
    "import { hNs } from './plugin-chain-raster-mount.js';",
    "import { fur } from './plugin-chain-ui-blit-source.js';",
  ],
  exports: ['ee', 'Ce', 'Fo', 'Wo', '_o', 'Bo', 'nr', 'Ko', 'jo', 'eg'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [25725, 25741], note: '`ee` — the focus/request context a site component reads its requestId from' },
    { file: 'chunk-kjfwbh4w.js', range: [30201, 30219], note: '`Ce` — the requestId a component outside a focused site reports' },
    { file: 'chunk-kjfwbh4w.js', range: [35779, 36211], note: '`Fo` — the paint scheduler: coalesce a paint within a frame, a max delay, and cancel' },
    { file: 'chunk-kjfwbh4w.js', range: [36211, 36249], note: '`Wo` — the mount object a surface hook registers: its props, its frame size and its paint' },
    { file: 'chunk-kjfwbh4w.js', range: [36249, 36347], note: '`_o` — write a painted frame to the node\'s raw text and mark it dirty' },
    { file: 'chunk-kjfwbh4w.js', range: [36347, 36358], note: '`Bo` — the settle delay a waiting surface paints at' },
    { file: 'chunk-kjfwbh4w.js', range: [36358, 36453], note: '`nr` — schedule the next paint only while the surface is not complete' },
    { file: 'chunk-kjfwbh4w.js', range: [36453, 36835], note: '`Ko` — the surface hook: register the mount, paint through its scheduler, repaint on a frame change, unregister on unmount' },
    { file: 'chunk-kjfwbh4w.js', range: [36835, 37183], note: '`jo` — the Raster site component: a raw-ansi element sized to the frame, driven by `Ko`' },
    { file: 'chunk-z9nv3z8k.js', range: [615, 656], note: '`eg` — the frame interval the scheduler and `nr` wait by' },
  ],
};

fs.writeFileSync('research/ports/W45-react-surface-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
