// W45-80 plan: the Markdown leaf `Xt` with the link-scheme set it hands the markdown renderer, the
// two click timings, and the clock and selection hooks its body reads. The renderer `Ya` is the
// already-ported body in ./tui-markdown-components.ts; the host seam supplies the two contexts and
// the selection map.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { y, R, P, Z, Ae, Tc, s } from './plugin-chain-react-hooks.js';",
    "import { nur, TIe } from './plugin-chain-press-dispatch-source.js';",
    "import { Ya } from './tui-markdown-components.js';",
    "import { eE, Gfe, oi } from './plugin-chain-markdown-host.js';",
  ],
  exports: ['vje', 'tun', 'mdn', 'Xt', 'on', 'wC'],
  blocks: [
    { file: 'chunk-06azbynj.js', range: [135682, 135731], note: '`vje`/`tun` — the double-activation window and the press delay (the statement also declares an unused `S0`)' },
    { file: 'chunk-kjfwbh4w.js', range: [24313, 24354], note: '`mdn` — the link schemes the markdown renderer keeps pressable' },
    { file: 'chunk-kjfwbh4w.js', range: [24354, 25250], note: '`Xt` — the Markdown leaf: draw the text, and on a click over a declared link press once the selection settles' },
    { file: 'chunk-1r9zp6s1.js', range: [17969, 18071], note: '`on` — the clock hook the leaf reads `now` and `setTimeout` from' },
    { file: 'chunk-1r9zp6s1.js', range: [26659, 27318], note: '`wC` — the selection accessor the leaf subscribes to while a press waits' },
  ],
};

fs.writeFileSync('research/ports/W45-markdown-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
