// W45-67 plan: the keybinding editor — the rest of the keybinding module. The key parser and the chord
// splitter, the legacy action names and the check that reads them, the context list and its check, the
// action-or-command check, the reserved-key list for this platform, and the two schemas a keybindings
// file is read through with the validator that asks them, over the lazy registry those schemas are built
// through. What is left of the module is the row reader (`Ace`/`ge`), which needs lodash's `mapValues`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { O } from './plugin-chain-fs-boundaries.js';",
    "import { Foo, Noo, pe, QDe, ZDe } from './plugin-chain-keys-source.js';",
    "import { A, Bm, o, u, U, ue, Ue } from './plugin-chain-schema-aliases.js';",
  ],
  exports: ['i', 'RTr', 'p', 'mJ', 'h9', 'Z', 'Re', 'Q', 'v9t', 'We', 'lcs', 'F', 'ze', 'Bn', 'fe', 'He', 'Ve', 'T'],
  blocks: [
    { file: 'chunk-fdwn5gdv.js', range: [615, 918], note: '`i` — the lazy registry the schemas are built through: a slot per builder, a resetter for each, and the accessor that builds a value once and remembers it' },
    { file: 'chunk-fdwn5gdv.js', range: [918, 932], note: '`RTr` — the one instance of that registry' },
    { file: 'chunk-fdwn5gdv.js', range: [932, 965], note: '`p` — the accessor a builder is filed through, which is how every schema in this module is written' },
    { file: 'chunk-6ccen3s8.js', range: [8839, 9463], note: '`mJ` — the key parser: split on `+`, fold each part to a modifier flag, resolve the four aliases and the four arrow glyphs, and answer the key with its modifier record' },
    { file: 'chunk-6ccen3s8.js', range: [9463, 9546], note: '`h9` — a chord split into the keys it is made of: the space key on its own, and anything else trimmed and split on whitespace before each part is parsed' },
    { file: 'chunk-6ccen3s8.js', range: [10621, 10997], note: '`Z` and `Re` — the six legacy action names the configuration still accepts and the name each one is read as' },
    { file: 'chunk-6ccen3s8.js', range: [10997, 11037], note: '`Q` — is this one of those legacy names' },
    { file: 'chunk-6ccen3s8.js', range: [11145, 11530], note: '`v9t` — the 29 binding contexts a keybindings file may name in a stable order — and `We`, the same list as a set' },
    { file: 'chunk-6ccen3s8.js', range: [11530, 11563], note: '`lcs` — is this string one of those contexts' },
    { file: 'chunk-6ccen3s8.js', range: [16567, 16624], note: '`F` — is this an action the engine knows, or a `command:` binding, which is the other thing an action field may hold' },
    { file: 'chunk-6ccen3s8.js', range: [16624, 17524], note: '`ze` and `Bn` — the schema a keybindings file is described by: a block of `context` and `bindings`, each binding an action name, a legacy name, a `command:` pattern or null to unbind, and the document that is an array of them under `$schema` and `$docs`' },
    { file: 'chunk-6ccen3s8.js', range: [18783, 18864], note: '`fe` — the reserved keys for the platform this build runs on: the table plus the platform\'s own additions' },
    { file: 'chunk-6ccen3s8.js', range: [19738, 19801], note: '`He` — the runtime schema for one binding block, weaker than the file\'s: its context is any string and its action any string or null, so the values that were checked when the file was read are not checked again' },
    { file: 'chunk-6ccen3s8.js', range: [19801, 19849], note: '`Ve` — does one block pass the runtime schema' },
    { file: 'chunk-6ccen3s8.js', range: [19849, 19900], note: '`T` — is this an array of blocks that each pass it, which is the whole document\'s check' },
  ],
};
const path = 'research/ports/W45-keybinding-editor-blocks.plan.json';
fs.writeFileSync(path, JSON.stringify(plan, null, 1) + '\n');
console.log(path, plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
