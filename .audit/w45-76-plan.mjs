// W45-76 plan: partition 2b-ii, the Image site component and its resolver. The component asks the
// terminal to draw a plugin image: it allocates an id, transmits the source, asks whether the terminal
// reads files, and falls back to alt text. The bodies are copied whole from chunk-kjfwbh4w.js, plus
// the probe query `uFo` from the wire chunk and the error-code helper `E` it reads.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { unlink as ci, writeFile as di } from 'node:fs/promises';",
    '// The component reads the wire layer, the source model, the mount writers and the host seam.',
    "import { cFo, lFo } from './plugin-chain-image-wire.js';",
    "import { Z4t, Uto, Dss } from './plugin-chain-image-model.js';",
    "import { ELs, vLs } from './plugin-chain-raster-mount.js';",
    "import { Ae, Ce, ee, en, le, n, P, R, s, Tc, y, Z } from './plugin-chain-react-surface.js';",
    "import { er, y$ } from './plugin-chain-source.js';",
    "import { t } from './plugin-chain-host.js';",
    "import { LT, Z8n, aWo, $1t, bC, QO, ge, lPe } from './plugin-chain-image-host.js';",
    '// `uFo` is the wire layer\'s probe query; it reads the same four bodies the wire copy carries.',
    "import { u, b, k, d, v } from './plugin-chain-image-wire-source.js';",
  ],
  exports: [
    'E', 'uFo', 'Eo', 'Lo', 'tr', 'rr', 'dt', 'or', 'Po', 'Ho', 'xt', 'Ke', 'vo', 'Mo', 'Oo', 'Ao', 'No',
    'xi', 'hi', 'yi', 'gi',
  ],
  blocks: [
    { file: 'chunk-886tf6ja.js', range: [4814, 4913], note: '`E` — the error code reader the probe reports' },
    { file: 'chunk-fzk4rpqy.js', range: [7397, 7472], note: '`uFo` — the file-read probe query' },
    { file: 'chunk-kjfwbh4w.js', range: [30935, 31632], note: '`Eo` — why the Image draws its alt instead of the source' },
    { file: 'chunk-kjfwbh4w.js', range: [31686, 33428], note: 'the probe constants, `Lo`, `tr`, `rr`, `dt`, `or`, `Po`, `Ho` and the tracker `xt`' },
    { file: 'chunk-kjfwbh4w.js', range: [33432, 33644], note: '`Ke` — the image id widths by capability level' },
    { file: 'chunk-kjfwbh4w.js', range: [33648, 33834], note: '`Mo` — the mount writer the alt answer registers through' },
    { file: 'chunk-kjfwbh4w.js', range: [33838, 34038], note: '`Oo` — the file-read answer the resolver subscribes to' },
    { file: 'chunk-kjfwbh4w.js', range: [34038, 35448], note: '`Ao` — the resolver: allocate, transmit, track, register the alt' },
    { file: 'chunk-kjfwbh4w.js', range: [35448, 35771], note: '`No` — the Image site component' },
  ],
};

fs.writeFileSync('research/ports/W45-image-component-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
