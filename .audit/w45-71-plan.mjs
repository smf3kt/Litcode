// W45-71 plan: the `ui.scroll` and `ui.focus` call entries — the two site registries, the key a site is
// filed under, the ownership checks each call makes before it moves anything, and the two commit roads
// with the refusal sentences they answer.
import fs from 'node:fs';

const plan = {
  imports: [
    '// The entry builder is the entry seam\'s (it attaches the site out of the host seam\'s table and',
    '// the body as the core handler), the store wrapper and the registry getter come from the runner copy',
    '// and the host seam, and everything else this subsystem needs — the two registries, the key, the two',
    '// ownership checks and the two bodies — is below.',
    "import { C, Ge, h$, L, we } from './plugin-chain-source.js';",
    "import { et } from './plugin-chain-override-sites-source.js';",
    "import { re } from './plugin-chain-sites-source.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { Mm } from './plugin-chain-entry.js';",
  ],
  exports: ['XH', 'uyt', 'Uet', 'pyt', 'ahe', '_z', 'mse', 'PY', 'bse', 'iL', 'IY', 'vse',
    'pr', 'ro', 'Vr', 'ko', 'Ci', 'Po', 'wa'],
  blocks: [
    { file: 'chunk-sfn1dbxq.js', range: [475447, 475544], note: '`XH` — does another plugin\'s element hold the keyboard at this site' },
    { file: 'chunk-sfn1dbxq.js', range: [475544, 475653], note: '`uyt` — is the focus caller neither the site\'s owner nor the origin\'s plugin' },
    { file: 'chunk-sfn1dbxq.js', range: [475653, 475702], note: '`Uet` — the focus-site registry: `it().focusSites`, cleared through its own disposer' },
    { file: 'chunk-sfn1dbxq.js', range: [476009, 476078], note: '`pyt` — is the scroll caller a plugin that is not the site\'s owner' },
    { file: 'chunk-sfn1dbxq.js', range: [476191, 476241], note: '`ahe` — the scroll-site registry: `it().scrollSites`, cleared through its own disposer' },
    { file: 'chunk-sfn1dbxq.js', range: [476241, 476267], note: '`_z` — the key a site is filed under: `component:requestId`' },
    { file: 'chunk-sfn1dbxq.js', range: [476681, 476733], note: '`mse` — the scroll site a call names, out of the scroll registry' },
    { file: 'chunk-sfn1dbxq.js', range: [476733, 476926], note: '`PY` — `$.ui.scroll`: no such site, not this plugin\'s site, then the site\'s own commit' },
    { file: 'chunk-sfn1dbxq.js', range: [479578, 479605], note: '`bse` — the `ui.scroll` entry: `Mm("ui.scroll", PY)`' },
    { file: 'chunk-sfn1dbxq.js', range: [479605, 479656], note: '`iL` — the focus site a call names, out of the focus registry' },
    { file: 'chunk-sfn1dbxq.js', range: [479656, 479962], note: '`IY` — `$.ui.focus`: no such site, not this plugin\'s site, the site does not hold the keyboard, another plugin\'s element holds it, then the site\'s own commit' },
    { file: 'chunk-sfn1dbxq.js', range: [479962, 479988], note: '`vse` — the `ui.focus` entry: `Mm("ui.focus", IY)`' },
    { file: 'chunk-nyce03br.js', range: [15588, 15723], note: '`pr` — the check every `ui.*` site shares: a `deny` that is absent, or a non-empty string' },
    { file: 'chunk-nyce03br.js', range: [16084, 16200], note: '`ro` — the site builder: the restored argument list, the argument check and the answer check' },
    { file: 'chunk-nyce03br.js', range: [34850, 35160], note: '`Vr` — the element check: an element where the move named none, no element where it named one, an element that is not a non-empty string' },
    { file: 'chunk-nyce03br.js', range: [35160, 35211], note: '`ko` — the focus call\'s argument names' },
    { file: 'chunk-nyce03br.js', range: [35211, 35334], note: '`Ci` — the `ui.focus` site: its restored arguments, its argument check and the shared answer check' },
    { file: 'chunk-nyce03br.js', range: [94084, 94166], note: '`Po` — the scroll call\'s argument names' },
    { file: 'chunk-nyce03br.js', range: [94166, 94345], note: '`wa` — the `ui.scroll` site: the whole-row offset check, the argument check and the shared answer check' },
  ],
};
// Two copies, because the order they evaluate in is part of the behaviour: the site descriptors have to
// be in the host seam's table before the entries are built by `Mm`, so the entries' copy imports the
// sites' seam first and the descriptors cannot live in the same file as the entries.
const entryNames = ['XH', 'uyt', 'Uet', 'pyt', 'ahe', '_z', 'mse', 'PY', 'bse', 'iL', 'IY', 'vse'];
const siteNames = ['pr', 'ro', 'Vr', 'ko', 'Ci', 'Po', 'wa'];
const entries = {
  imports: [
    '// The entry builder is the entry seam\'s, the store wrapper and the registry getter come from the',
    '// runner copy and the host seam, and everything else this subsystem needs — the two registries, the',
    '// key, the two ownership checks and the two bodies — is below. The first import is the sites\' seam:',
    '// `Mm` reads `zd[name]` while this file is evaluated, so the two descriptors have to be registered',
    '// before that happens.',
    "import './plugin-chain-scroll-focus-sites.js';",
    "import { Ge } from './plugin-chain-source.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { Mm } from './plugin-chain-entry.js';",
  ],
  exports: entryNames,
  blocks: plan.blocks.filter((block) => block.file === 'chunk-sfn1dbxq.js'),
};
const sites = {
  imports: [
    '// The site descriptors themselves: what a `ui.scroll` or `ui.focus` call must carry, what a rewrite',
    '// of one may not change, and what the answer must look like. The shared check and the two builders',
    '// come from copies that already carry them.',
    "import { C, h$, L, we } from './plugin-chain-source.js';",
    "import { et } from './plugin-chain-override-sites-source.js';",
    "import { re } from './plugin-chain-sites-source.js';",
  ],
  exports: siteNames,
  blocks: plan.blocks.filter((block) => block.file === 'chunk-nyce03br.js'),
};
for (const [path, data] of [
  ['research/ports/W45-scroll-focus-blocks.plan.json', entries],
  ['research/ports/W45-scroll-focus-sites-blocks.plan.json', sites],
]) {
  fs.writeFileSync(path, JSON.stringify(data, null, 1) + '\n');
  console.log(path, data.blocks.length, 'blocks', data.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', data.exports.length, 'exports');
}
