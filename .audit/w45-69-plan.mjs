// W45-69 plan: the leaf table and the walkers that read it — how tall a leaf is, what text it
// contributes, whether its key is drawn twice — with the diff-hunk parser the Code leaf's height needs
// and the four one-statement helpers under them. Every leaf function the table names is imported from the
// copy that already carries it.
import fs from 'node:fs';

const plan = {
  imports: [
    '// The table names the nine leaf checks the site-table packages already ported, so they are imported',
    '// rather than copied again; the two string helpers and the error describer come from the chain copy,',
    '// and the diff reader from the normalize copy. What is below is the fresh half: the table itself, the',
    '// three walkers that read it, and the diff-hunk parser the tallest of them needs.',
    "import { L, l } from './plugin-chain-source.js';",
    "import { ae } from './plugin-chain-text-clamp-source.js';",
    "import { Epe } from './plugin-chain-normalize-source.js';",
    "import { eno, jto, Lto, PAt, Zto } from './plugin-chain-site-leaves-source.js';",
    "import { Bto, Jto } from './plugin-chain-raster-sites-source.js';",
    "import { Mto, Vto } from './plugin-chain-leaves-source.js';",
    "import { Hto } from './plugin-chain-button-source.js';",
  ],
  exports: ['tno', 'ono', 'rno', 'Q4t', 'ano', 'IAt', 'nno', 'tso', 'Dto', 'vVe', 'J4t', 'HN', 'Lt', 'Int', 'lQt', 'kFe'],
  blocks: [
    { file: 'chunk-n3ykh62m.js', range: [236820, 237297], note: '`Dto` — a unified diff read back into hunks: every hunk\'s no-newline marker lines (the ones that begin with a backslash) dropped, each header checked to be `@@ -a,b +c,d @@` with all four numbers safe integers in range, and a refusal that names the offending hunk otherwise' },
    { file: 'chunk-n3ykh62m.js', range: [237297, 237337], note: '`vVe` — the reader a Code leaf asks for by format: a diff when the format says diff, and nothing otherwise' },
    { file: 'chunk-n3ykh62m.js', range: [238357, 238438], note: '`J4t` — the text a leaf contributes with the bidi controls and directional marks replaced by the replacement character, which is what keeps a right-to-left override from moving the line around it' },
    { file: 'chunk-n3ykh62m.js', range: [238917, 239033], note: '`Q4t` — the strings under a list of children, flattened depth-first, a child object contributing its own children and a string contributing itself' },
    { file: 'chunk-n3ykh62m.js', range: [259180, 259284], note: '`tno` — the leaf table itself: the nine leaf types, each mapped to the check that refuses a bad one' },
    { file: 'chunk-n3ykh62m.js', range: [259284, 259432], note: '`nno` — text measured up to a budget, counting the escape a tab or a line break costs at the point it is found and stopping as soon as the budget is passed' },
    { file: 'chunk-n3ykh62m.js', range: [259432, 259514], note: '`IAt` — the emitted lines a string takes at a given width: its own line count while it is under the cap, and the wrapped count after it' },
    { file: 'chunk-n3ykh62m.js', range: [259514, 259714], note: '`rno` — the text a leaf contributes: a Svg\'s alt, a Button\'s children joined, a Button\'s or Input\'s label, and nothing for the rest' },
    { file: 'chunk-n3ykh62m.js', range: [259714, 260226], note: '`ono` — how tall a leaf is: a Raster\'s or Image\'s rows, a Markdown\'s lines, one line plus the wrapped text for everything else, and for a Code leaf the diff-aware answer — the source lines, the hunks when it is a diff, the gutter width when the line numbers are shown, and whether the result is truncated' },
    { file: 'chunk-n3ykh62m.js', range: [262308, 262627], note: '`ano` — is this keyed leaf drawn twice: the type and the key are held in a set as the tree is walked, and the second sighting is refused with the sentence that names the type and the key' },
    { file: 'chunk-34bv7wfw.js', range: [9299, 11040], note: '`tso` — the unified-diff parser behind the Code leaf\'s height: file headers, index lines and hunks, with each line\'s kind read off its first character' },
    { file: 'chunk-f606a53w.js', range: [7703, 7802], note: '`HN` — leading tabs expanded to two spaces each, which is the width a tab counts for once the text is measured' },
    { file: 'chunk-kcwp0ct0.js', range: [17539, 17627], note: '`Int` — the width of a hunk\'s `+ N ` line-number gutter, from the larger of the two sides\' last line' },
    { file: 'chunk-ax7r0qj7.js', range: [3561, 3652], note: '`Lt` — how many times a needle occurs in a string, which is how a line count is taken' },
    { file: 'chunk-nyce03br.js', range: [5956, 6041], note: '`lQt` and `kFe` — the width text is wrapped at and the line cap a Code or Markdown leaf is measured against — declared in the same statement as four constants this copy does not use, because the bundle declares them together' },
  ],
};
const path = 'research/ports/W45-leaf-walkers-blocks.plan.json';
fs.writeFileSync(path, JSON.stringify(plan, null, 1) + '\n');
console.log(path, plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
