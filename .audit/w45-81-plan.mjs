// W45-81 plan: the Select site component `sr` with the list window `S3n`, the site-focus reader `xe`,
// the click adapter `udn` and the four contexts they read. Button, Input, hover and the Client host
// are later packages.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { qt, Ae, Xe as e, Xe as r, s, n } from './plugin-chain-react-hooks.js';",
  ],
  exports: ['ht', 'S3n', 'gdn', 'fdn', 'pdn', 'ldn', 'udn', 'xe', 'sr'],
  blocks: [
    { file: 'chunk-kjfwbh4w.js', range: [22992, 23009], note: '`ldn` — the clicked-press context' },
    { file: 'chunk-kjfwbh4w.js', range: [23009, 23128], note: '`udn` — the click adapter: allow the hyperlink default, run unless the activation was a stray or a window activation' },
    { file: 'chunk-kjfwbh4w.js', range: [23132, 23149], note: '`pdn` — the focused-node ref context' },
    { file: 'chunk-kjfwbh4w.js', range: [23153, 23170], note: '`fdn` — the focused-press context' },
    { file: 'chunk-kjfwbh4w.js', range: [23170, 23378], note: '`xe` — the site-focus reader: focus flag, ref and click for one press' },
    { file: 'chunk-kjfwbh4w.js', range: [37183, 37192], note: '`ht` — the visible option count' },
    { file: 'chunk-kjfwbh4w.js', range: [37192, 37323], note: '`S3n` — the option window: first index, size, hidden count, rows' },
    { file: 'chunk-kjfwbh4w.js', range: [37331, 37348], note: '`gdn` — the select-fields context' },
    { file: 'chunk-kjfwbh4w.js', range: [37348, 38173], note: '`sr` — the Select site component: the picked option, the open highlight window and the click' },
  ],
};

fs.writeFileSync('research/ports/W45-select-field-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
