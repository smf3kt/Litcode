// Builds research/ports/W45-client-markdown-link-blocks.plan.json: the three site leaves whose every
// dependency is now inside the product — the Client, the Markdown with its pressable-link list check, and
// the Link with the href encoder. Three runs of chunk-n3ykh62m.js, 7 statements, 2,785 units.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-n3ykh62m.js',
    range: [235982, 236808],
    note: '`Mto`, the Client leaf: key and module, a prop-bag that goes through the value budget, three numbers that go through the prop rules, a required stamp, and no children',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [247312, 248693],
    note: '`Lrt` (2048) and `pur` (256), the Link href and pressable-link limits, then `zto`, the pressable-links list check, and `Vto`, the Markdown leaf that calls it',
  },
  {
    file: 'chunk-n3ykh62m.js',
    range: [260226, 260804],
    note: '`Nrt`, the href encoder that repairs lone surrogates before percent-encoding, and `sno`, the Link leaf that measures the href as written and as encoded',
  },
];

const plan = {
  imports: [
    '// The three site leaves whose dependencies are all inside the product (W45-65): the Client, the',
    '// Markdown with its pressable-link list check, and the Link with the href encoder beside it.',
    '//',
    '// Three blocks, 2,785 units, 7 statements of chunk-n3ykh62m.js. Every name they reach is imported',
    '// rather than copied: `L` from the chain-runner copy, `cN`/`cQt`/`sQt` from the W45-64 style-prop',
    '// copy, `QT` from the W45-58 blit copy, `EVe`/`XPn`/`QAe`/`ace`/`IL` from the W45-62 leaf-problem',
    '// copy, `wVe`/`xAt`/`ZAe` from the W45-63 site-leaf copy, and `hf` from the W45-42 host-call copy —',
    '// the name this package was waiting on since W45-63.',
    "import { L } from './plugin-chain-source.js';",
    "import { cN, cQt, sQt } from './plugin-chain-style-props-source.js';",
    "import { QT } from './plugin-chain-ui-blit-source.js';",
    "import { ace, EVe, IL, QAe, XPn } from './plugin-chain-raster-sites-source.js';",
    "import { wVe, xAt, ZAe } from './plugin-chain-site-leaves-source.js';",
    "import { hf } from './plugin-chain-host-call-source.js';",
  ],
  exports: ['Mto', 'Lrt', 'pur', 'zto', 'Vto', 'Nrt', 'sno'],
  blocks,
};
const target = path.join(root, 'research/ports/W45-client-markdown-link-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units, ${plan.exports.length} exports`);
