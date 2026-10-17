// W45-78 sites plan: the three press-site descriptors (`ui.press`, `ui.input`, `ui.select`) and the
// argument checkers they name, from chunk-nyce03br.js. The site table `zd` in the source holds every
// event; this package builds it with the three entries it needs in the hand-written seam.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { L } from './plugin-chain-source.js';",
  ],
  exports: ['w3', 'vFe', 'C', 'ot', 'mn', 'Cn', 'Lt', 'ya', 'da', 'ha'],
  blocks: [
    { file: 'chunk-nyce03br.js', needle: 'var w3=', k: 'stmt', note: '`w3` — the element names each surface offers' },
    { file: 'chunk-nyce03br.js', needle: 'var vFe=', k: 'stmt', note: '`vFe` — whether a name is a surface' },
    { file: 'chunk-nyce03br.js', needle: 'var C=', k: 'stmt', note: '`C` — wrap an argument check so a non-object result is refused first' },
    { file: 'chunk-nyce03br.js', needle: 'function ot(', k: 'fn', note: '`ot` — the press argument check shared by input and select' },
    { file: 'chunk-nyce03br.js', needle: 'function mn(', k: 'fn', note: '`mn` — the input argument check' },
    { file: 'chunk-nyce03br.js', needle: 'function Cn(', k: 'fn', note: '`Cn` — the select argument check' },
    { file: 'chunk-nyce03br.js', needle: 'var Lt=', k: 'stmt', note: '`Lt` — build an input/select site descriptor' },
    { file: 'chunk-nyce03br.js', needle: 'var ya=', k: 'stmt', note: '`ya` — the ui.press site' },
    { file: 'chunk-nyce03br.js', needle: 'var da=', k: 'stmt', note: '`da` — the ui.input site' },
    { file: 'chunk-nyce03br.js', needle: 'var ha=', k: 'stmt', note: '`ha` — the ui.select site' },
  ],
};

fs.writeFileSync('research/ports/W45-press-sites-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
