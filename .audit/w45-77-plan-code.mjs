// W45-77 plan, part 1: the Code leaf component `lt` and the truncation helpers it reads, copied from
// chunk-kjfwbh4w.js. `Ob`/`tq` come from the two renderer copies; the layout read and the node
// measure are host seams.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { Xe as e, Ae, R, qt, w, b, s } from './plugin-chain-react-surface.js';",
    "import { kc, Ys } from './plugin-chain-code-host.js';",
    "import { vVe, J4t, Int, HN } from './plugin-chain-leaf-walkers.js';",
    "import { ct } from './plugin-chain-text-clamp-source.js';",
    "import { Ob } from './plugin-chain-code-block-source.js';",
    "import { tq } from './plugin-chain-code-diff-source.js';",
  ],
  exports: ['Oe', 'Te', 'et', 'tt', 'adn', 'rt', 'st', 'lt'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', needle: 'var Oe=', k: 'stmt', note: '`Oe` — truncate one line to a width through the text clamp' },
    { file: 'chunk-kjfwbh4w.js', needle: 'var Te=', k: 'stmt', note: '`Te` — re-highlight every diff line after its marker' },
    { file: 'chunk-kjfwbh4w.js', needle: 'var et=', k: 'stmt', note: '`et` — truncate the lines of every hunk to a width' },
    { file: 'chunk-kjfwbh4w.js', needle: 'function tt(', k: 'fn', note: '`tt` — truncate a source to a width with the gutter allowance' },
    { file: 'chunk-kjfwbh4w.js', needle: 'var adn=', k: 'stmt', note: '`adn` — the Code width override context' },
    { file: 'chunk-kjfwbh4w.js', needle: 'var rt=', k: 'stmt', note: '`rt` — the Code width default, 80' },
    { file: 'chunk-kjfwbh4w.js', needle: 'var st=', k: 'stmt', note: '`st` — the source label a Code block highlights under' },
    { file: 'chunk-kjfwbh4w.js', needle: 'function lt(', k: 'fn', note: '`lt` — the Code site component' },
  ],
};

fs.writeFileSync('research/ports/W45-code-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
