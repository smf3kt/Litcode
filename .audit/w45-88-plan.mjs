// W45-88 plan: the terminal glue that renders one site through row accounting (`yt`, `pr`, the row
// helpers, `ur`, the key/thrown helpers, `xr`, `$e`, `hdn`, `TU`, `VH`) and the local helpers it
// reaches that were not yet in the product (the site input matcher `uo`, the render-descriptor
// WeakMap `bVe`/`CAt`, the settled-list reader `Vss`/`Lur`, the module filter `pIn`, and the
// render-failure notes `cIn`/`dIn`/`mno`/`uIn` with their dedupe).
import fs from 'node:fs';

const plan = {
  imports: [
    "import { Xe as e, Tc, s, n, Z, R, y, P, le, Ae, N } from './plugin-chain-react-hooks.js';",
    "import { Cpr, aCe, zz } from './plugin-chain-records.js';",
    "import { Ge, y$, He, l, a8 } from './plugin-chain-source.js';",
    "import { De, Re } from './plugin-chain-hover-source.js';",
    "import { ee } from './plugin-chain-press-button-source.js';",
    "import { je } from './plugin-chain-walker-host-source.js';",
    "import { vA, oIn, MF, mIn, kVe, $ur, iur, Frt, LAt, j3e, Ioe, Omt, l9, GPn } from './plugin-chain-render-keys-source.js';",
    "import { kAt } from './plugin-chain-client-host.js';",
    "import { dce, che, g4n, Fss, Mi, XD, i5t, t, OL } from './plugin-chain-terminal-host.js';",
  ],
  exports: [
    'yt', 'pr', 'ir', 'ar', 'lr', 'mr', 'fr', 'ur', 'cr', 'dr', 'xr', '$e', 'hdn', 'TU', 'VH',
    'uo', 'Oto', 'bVe', 'CAt', 'Vss', 'fno', 'Lur', 'pIn',
    'cIn', 'dIn', 'mno', 'uIn', 'cce', 'HM', 's5t', 'sIn', 'CK', 'Iye',
  ],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [40655, 44099], note: 'the terminal glue: `yt` renders one tree through the draw callback, `pr` adds the boundary, the row helpers keep the held rows, `ur` resolves the on-screen input, `xr` reads the settled answer, `hdn`/`TU` assemble the surface node, `VH` names the terminal input' },
    { file: 'chunk-kjfwbh4w.js', range: [21203, 21286], note: '`uo` — the input a drawn site answers when its descriptor names the same component' },
    { file: 'chunk-n3ykh62m.js', range: [233003, 233140], note: '`bVe` — the WeakMap from a drawn site to its render descriptor, with `CAt` reading one input' },
    { file: 'chunk-n3ykh62m.js', range: [278989, 279366], note: '`cce`/`HM`/`s5t`/`sIn`/`CK`/`Iye` — the render-failure note: dedupe slot, warning log and notification' },
    { file: 'chunk-n3ykh62m.js', range: [281622, 281762], note: '`cIn`/`dIn` — the failure-note key and the thrown-while-drawn label' },
    { file: 'chunk-n3ykh62m.js', range: [282221, 282478], note: '`fno`/`Lur`/`Vss` — the module list behind one settled site, filtered to the plugins that contributed' },
    { file: 'chunk-n3ykh62m.js', range: [282478, 282706], note: '`mno`/`uIn` — the failure text and the one note per component/teller key' },
    { file: 'chunk-n3ykh62m.js', range: [282706, 282863], note: '`pIn` — the modules a render-failure note names: the settled site contributing plugins, or every candidate' },
  ],
};

fs.writeFileSync('research/ports/W45-terminal-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
