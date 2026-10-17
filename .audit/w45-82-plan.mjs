// W45-82 plan: the Input field site `Vt` with its minimum width `Gt`, the input-fields context
// `cdn`, the site-columns context `ddn`, and the terminal-size hook `ke` with its context `Zm`.
// The text editor `wr` it draws while focused is supplied by the host seam (chunk-s7977spq, 3,638
// units with its decoder/history/paste closure); Button, hover and the Client host are later.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { qt, y, P, Ae, Xe as e, Xe as r, s, n } from './plugin-chain-react-hooks.js';",
    "import { xe } from './plugin-chain-select-field-source.js';",
    "import { ae } from './plugin-chain-text-clamp-source.js';",
    "import { wr } from './plugin-chain-input-field-host.js';",
  ],
  exports: ['Gt', 'cdn', 'ddn', 'ke', 'Zm', 'Vt'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [22928, 22938], note: '`Gt` — the minimum field width (12)' },
    { file: 'chunk-kjfwbh4w.js', range: [22946, 22963], note: '`cdn` — the input-fields context: `textOf(plugin, element)` and `edit(site, value)`' },
    { file: 'chunk-kjfwbh4w.js', range: [22967, 22984], note: '`ddn` — the site-columns context' },
    { file: 'chunk-tz1x0g31.js', range: [715, 829], note: '`ke` — the terminal-size hook; throws outside a provider' },
    { file: 'chunk-z7whhrje.js', range: [10384, 10400], note: '`Zm` — the terminal-size context the hook reads' },
    { file: 'chunk-kjfwbh4w.js', range: [23378, 24196], note: '`Vt` — the Input field site: focus, value/cursor state, label, editor or dim text, and the submit hint' },
  ],
};

fs.writeFileSync('research/ports/W45-input-field-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
