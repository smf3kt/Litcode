// W45-79 dispatch plan: `BPn`, `TIe` and `Ohe` — the ui.press dispatch, its terminal entry and the
// settle wrapper — with the link guard `Rf`/`nur` and the argument `E_`, over the site `Tf`.
// `mxn` comes from ./plugin-chain-press-url-source.ts.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { t } from './plugin-chain-host.js';",
    "import { l, aP } from './plugin-chain-source.js';",
    "import { P0 } from './plugin-chain-records.js';",
    "import { AK, Yl } from './plugin-chain-press.js';",
    "import { zd } from './plugin-chain-press-sites.js';",
    "import { mxn } from './plugin-chain-press-url-source.js';",
  ],
  exports: ['Rf', 'nur', 'E_', 'Tf', 'BPn', 'TIe', 'Ohe'],
  blocks: [
    { file: 'chunk-n3ykh62m.js', range: [227274, 227380], note: '`Rf` — normalize an href for comparison' },
    { file: 'chunk-n3ykh62m.js', range: [227380, 227463], note: '`nur` — whether a link is one the drawing declared pressable' },
    { file: 'chunk-n3ykh62m.js', range: [227463, 227607], note: '`E_` — the ui.press argument' },
    { file: 'chunk-n3ykh62m.js', range: [227607, 227629], note: '`Tf` — the ui.press site' },
    { file: 'chunk-n3ykh62m.js', range: [229414, 230142], note: '`BPn` — dispatch one held press' },
    { file: 'chunk-kjfwbh4w.js', range: [24200, 24313], note: '`TIe` — pressFromTerminal' },
    { file: 'chunk-sfn1dbxq.js', range: [2336117, 2336190], note: '`Ohe` — settle a dispatch quietly, logging a rejection' },
  ],
};

fs.writeFileSync('research/ports/W45-press-dispatch-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
