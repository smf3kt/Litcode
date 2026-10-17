// W45-85 plan: the Client host `Io`, its acquisition hook `So`, the terminal mount `To`, the key
// binding `wo`, the clock adapter `Ro`, the loading snapshot `bo`, the inert client `Co`, the error
// boundary `XD` and the keybinding hook `Ey`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { Ae, R, P, y, en, le, Rt, Tc, s, n } from './plugin-chain-react-hooks.js';",
    "import { Ce, eg } from './plugin-chain-react-surface-source.js';",
    "import { kc, Ys } from './plugin-chain-code-host.js';",
    "import { eE } from './plugin-chain-markdown-host.js';",
    "import { Re } from './plugin-chain-hover-source.js';",
    "import { wFt, yo, ko, Lc, ee } from './plugin-chain-press-button-source.js';",
    "import { Kje, $pn, W1o, c9, Ri, G1o, Qrt, i5t, kAt, m4n, iZr, ot, VV, c, t } from './plugin-chain-client-host.js';",
  ],
  exports: ['XD', 'wo', 'To', 'Ro', 'bo', 'Co', 'So', 'Io', 'Ey'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [3241, 4161], note: '`Vo`+`XD` — the boundary message and the error boundary: reset on a new key, report a throw once, draw the fallback' },
    { file: 'chunk-kjfwbh4w.js', range: [28121, 28534], note: '`wo` — the hosted client: its ref, click subscription, focus effects and key dispatch' },
    { file: 'chunk-kjfwbh4w.js', range: [28534, 29637], note: '`To` — the terminal mount: props, layout, redraw, resize, pointer and key events, the drawn tree' },
    { file: 'chunk-kjfwbh4w.js', range: [29641, 29858], note: '`Ro` — the clock adapter: interval fallback or the clock keep-alive subscription' },
    { file: 'chunk-kjfwbh4w.js', range: [29858, 29899], note: '`bo` — the loading snapshot' },
    { file: 'chunk-kjfwbh4w.js', range: [29899, 30201], note: '`Co` — the inert client instance (the source no-client default)' },
    { file: 'chunk-kjfwbh4w.js', range: [30219, 30538], note: '`So` — acquire the plugin client for the element and release it on unmount' },
    { file: 'chunk-kjfwbh4w.js', range: [30538, 30927], note: '`Io` — the Client host: acquire, subscribe to the snapshot and mount `To` under the boundary' },
    { file: 'chunk-am9mebpw.js', range: [1357, 1549], note: '`Ey` — register a pre-dispatch key handler while mounted and active' },
  ],
};

fs.writeFileSync('research/ports/W45-client-host-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
