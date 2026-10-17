// W45-86 plan: the site-tree walker `je` and the three helpers it reaches that were not yet in the
// product — the display href encoder `Mrt` with its control/bidi regexes (`y$`, `zDe`/`zpr`/`pot`)
// and the Box-key scope check `X4t`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { Tc, s, n } from './plugin-chain-react-hooks.js';",
    "import { b3 } from './plugin-chain-source.js';",
    "import { hf } from './plugin-chain-host-call-source.js';",
    "import { xAt } from './plugin-chain-site-leaves-source.js';",
    "import { IL } from './plugin-chain-raster-sites-source.js';",
    "import { Nrt } from './plugin-chain-leaves-source.js';",
    "import { Bt, De, Ut, $t } from './plugin-chain-hover-source.js';",
    "import { Zt } from './plugin-chain-press-button-source.js';",
    "import { Vt } from './plugin-chain-input-field-source.js';",
    "import { sr } from './plugin-chain-select-field-source.js';",
    "import { lt } from './plugin-chain-code-source.js';",
    "import { Xt } from './plugin-chain-markdown-source.js';",
    "import { Io } from './plugin-chain-client-host-source.js';",
    "import { No } from './plugin-chain-image-component-source.js';",
    "import { jo } from './plugin-chain-react-surface-source.js';",
    "import { Wt } from './plugin-chain-walker-host.js';",
  ],
  exports: ['je', 'Mrt', 'y$', 'zDe', 'zpr', 'pot', 'X4t'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [38173, 40655], note: '`je` — the site-tree walker: every node type to its component, hover groups, link text and the inline/block split' },
    { file: 'chunk-n3ykh62m.js', range: [238267, 238357], note: '`Mrt` — the display href encoder: unsafe characters percent-encoded, controls and bidi marks replaced' },
    { file: 'chunk-nyce03br.js', range: [112643, 112741], note: '`y$` — the control-character class the display encoder strips' },
    { file: 'chunk-t58kj6z7.js', range: [615, 799], note: '`zDe`/`zpr`/`pot` — the bidi-mark table and the regex the display encoder replaces' },
    { file: 'chunk-n3ykh62m.js', range: [233611, 233808], note: '`X4t` — the Box-key scope check: a usable key names one hover scope per parent, reported once' },
  ],
};

fs.writeFileSync('research/ports/W45-walker-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
