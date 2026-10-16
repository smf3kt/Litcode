// Builds research/ports/W45-style-props-blocks.plan.json: the style-prop validators a plugin's props are
// checked by (`sQt` and the prop-name sets it reads) and the value describer beside them (`cN`, `Dt` and
// the walk budget they share). Seventeen runs of chunk-nyce03br.js, 24 statements, 3,794 units.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const blocks = [
  {
    file: 'chunk-nyce03br.js',
    range: [2097, 2198],
    note: '`Ubr`, the text-style prop names (dimColor, bold, italic, underline, strikethrough, inverse, borderDimColor). `Ago` (2) sits between this and the next block and is referenced by nothing here, so the run is split rather than taken whole.',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [2208, 2288],
    note: '`rQt`, the border prop names (`new Set(PFs)` — the border table the W44 tui copy already carries) and `Cgo`, the colour ones (color, backgroundColor, borderColor)',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [2523, 2815],
    note: '`Rgo`, the flex and spacing prop names, and `olt`, the four sides',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [2815, 3407],
    note: '`xgo`, the per-prop validator table `sQt` looks a name up in — the largest single body of this package',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [4004, 4075],
    note: '`slt` (10000), the tolerance a number is compared with, and `oQt`, the size prop names (width, height, minWidth, minHeight)',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [4140, 4987],
    note: '`sQt`, the prop validator: a name looked up in `xgo`, whose answer is either a sentence or a predicate that is run against the value — the table holds both, which is why the name is checked before the value',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [5978, 5990],
    note: '`Ybr` (1e5), how many characters a described value may serialize to. `B3e` ("AskUserQuestion") sits between this and the next block and is referenced by nothing here.',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [6016, 6041],
    note: '`ESe` (32), how deep the describer walks, and `AFe` (20000), how many values it may visit',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [6041, 6172],
    note: '`cN`, the short description of a value — null, an array, an object, or `a <typeof>` — which is the sentence a leaf drops into its own when a prop had the wrong shape',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [6340, 6358],
    note: '`Vs`, the largest length a plugin\'s list may claim',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [6358, 6591],
    note: '`B`, the list length a plugin declares, which throws `He` rather than answering when the claim is not a length any list has — the one body here that refuses instead of describing',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87341, 87483],
    note: '`fa`, the generator the describer walks with: an array yields each element under the key length one, an object yields its own keys at their own length plus four (`"key":` and the comma)',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87483, 87576],
    note: 'the budget and its three bounds: `F$n` (1e5 characters), `Xbr` (32 deep), `Jbr` (20000 values), and `Ro`, a fresh walk budget — a path Set for cycles and a done Map for values already seen',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87576, 87714],
    note: '`ca`, the budget check: more than 20000 values answers `holds more than 20000 values`, more than 1e5 characters answers `serializes to more than 100000 characters`, and otherwise nothing',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87714, 87871],
    note: '`un`, what a scalar costs the budget: a boolean is 5 (`false`), a string its length plus two quotes, a number the length of its text, and null 5 — anything else answers nothing and is walked instead',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [87871, 88707],
    note: '`Dt`, the describer itself: it walks the value against the budget, spending `un` on scalars and recursing through `fa`, tracking the path to cut a cycle and the done Map to cut a repeat, and answers either the serialized text or the budget sentence',
  },
  {
    file: 'chunk-nyce03br.js',
    range: [88772, 88798],
    note: '`cQt`, the describer at its entry: `Dt(value, 0, Ro())` — depth zero and a fresh budget',
  },
];

const plan = {
  imports: [
    '// The style-prop validators and the value describer (W45-64): what a plugin\'s props are checked by',
    '// (`sQt` and the prop-name sets beside it) and how a value that failed is described in the sentence.',
    '//',
    '// Seventeen blocks, 3,794 units, 24 statements of chunk-nyce03br.js. Two names are imported rather',
    '// than copied: `He`, the error a list length is refused with, and `PFs`, the border prop names — both',
    '// already carried, by the chain-runner copy and the W44 tui border copy. Two statements of the same',
    '// module sit inside this package\'s span and are referenced by nothing in it (`Ago` and `B3e`), so the',
    '// spans are split around them rather than carrying them for free.',
    "import { He } from './plugin-chain-source.js';",
    "import { PFs } from './tui-border.js';",
  ],
  exports: [
    'Ubr', 'rQt', 'Cgo', 'Rgo', 'olt', 'xgo', 'slt', 'oQt', 'sQt', 'Ybr', 'ESe', 'AFe', 'cN', 'Vs', 'B',
    'fa', 'F$n', 'Xbr', 'Jbr', 'Ro', 'ca', 'un', 'Dt', 'cQt',
  ],
  blocks,
};
const target = path.join(root, 'research/ports/W45-style-props-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units, ${plan.exports.length} exports`);
