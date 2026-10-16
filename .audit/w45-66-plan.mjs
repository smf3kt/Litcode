// W45-66 plan: the Button (the last site leaf) and the keybinding action tables its two checks read.
// The tables live in the keybinding module, whose own header reads the platform through the fs
// boundary's `O`; the two tiny helpers it needs (`nA`, `Yho`) come with them.
import fs from 'node:fs';

const keys = {
  imports: ["import { O } from './plugin-chain-fs-boundaries.js';"],
  exports: ['L', 'Ie', 'Me', 'Le', 'le', 'w1', 'ccs', 'ZDe', 'QOn', 'pe', 'dcs', 'QDe', 'Noo', 'Foo', 'pqe', 'Ge', 'Ye', 'ee', 'acs', 'nA', 'Yho'],
  blocks: [
    { file: 'chunk-6ccen3s8.js', range: [1764, 8839], note: 'the default binding sets, computed for this platform: the platform and its two derived keys (`Me` the paste binding, `le` the toggle binding) and `w1`, the array of `{ context, bindings }` the engine starts from — `Global` holds the interrupt and exit keys, and the rest are per context, each binding a normalised key to a name' },
    { file: 'chunk-6ccen3s8.js', range: [11563, 16491], note: 'the action names the engine knows (`ZDe`, the list `dcs` checks membership against) and `ccs`, the one-line description of each binding context' },
    { file: 'chunk-6ccen3s8.js', range: [16491, 16534], note: '`QOn`, the contexts a survey prompt may name, and `pe`, the membership set built from the action names' },
    { file: 'chunk-6ccen3s8.js', range: [16534, 16567], note: '`dcs` — is this name one of the engine\'s keybinding actions' },
    { file: 'chunk-6ccen3s8.js', range: [17524, 18783], note: '`QDe`, the reserved keys with the reason each cannot be rebound and its severity, plus `Noo` and `Foo`' },
    { file: 'chunk-6ccen3s8.js', range: [18864, 18952], note: '`pqe` — the key normaliser `acs` reads the reserved keys and the default bindings through, with the space key named as a word' },
    { file: 'chunk-6ccen3s8.js', range: [18952, 19125], note: '`Ge`, the key alias table the normaliser resolves a lone key through (esc, return, del, the four arrows, the three spellings of capslock)' },
    { file: 'chunk-6ccen3s8.js', range: [19125, 19541], note: '`Ye` — the modifier normaliser: each part lowercased, the four spellings of alt and the five of meta folded, the modifiers sorted, and the key resolved through the alias table' },
    { file: 'chunk-6ccen3s8.js', range: [19541, 19548], note: '`ee`, the slot `acs` memoises the engine-held action set in' },
    { file: 'chunk-6ccen3s8.js', range: [19548, 19738], note: '`acs` — the actions the engine holds alone: the reserved keys normalised into a set, then every default binding whose key is one of them' },
    { file: 'chunk-yvnhkg35.js', range: [1245, 1268], note: '`nA` — the probe the platform header reads before it compares a version at all; the source answers true' },
    { file: 'chunk-bk5ct2gw.js', range: [342203, 342254], note: '`Yho` — the version comparison the header runs on a Windows host, reaching the runtime\'s own semver' },
  ],
};
const button = {
  imports: [
    "import { L } from './plugin-chain-source.js';",
    "import { cN } from './plugin-chain-style-props-source.js';",
    "import { QT } from './plugin-chain-ui-blit-source.js';",
    "import { QAe } from './plugin-chain-raster-sites-source.js';",
    "import { TAt, wVe } from './plugin-chain-site-leaves-source.js';",
    "import { acs, dcs } from './plugin-chain-keys-source.js';",
  ],
  exports: ['Hto'],
  blocks: [
    { file: 'chunk-n3ykh62m.js', range: [234038, 235650], note: '`Hto` — the Button site check: the props shape and the two keys, then the five option shapes in the order the source names them, then the autoFocus problem, then the hotkey, then the action — refused when the engine does not know it and again when the engine holds it alone — then the label, the press and the children' },
  ],
};
for (const [name, plan] of [['W45-keybindings', keys], ['W45-button', button]]) {
  const path = `research/ports/${name}-blocks.plan.json`;
  fs.writeFileSync(path, JSON.stringify(plan, null, 1) + '\n');
  console.log(path, plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
}
