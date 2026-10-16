import fs from 'node:fs';
const plan = {
  imports: [
    '// The classic PreToolUse raise point and the bridge that puts it on the tool call: the dispatcher',
    '// `$go`, the envelope the hook sees (`No`/`Da`), the record an answer is kept in (`RFe`/`CFe`), the',
    "// three bodies the source's own `tool.call` core is built from (`xe`/`ye`/`ke`) and `Mo`, the gate",
    '// that decides whether the tool call is wrapped at all. The shared rules come from the copies already',
    "// in the product, and `zd` is the host's registered site table, which is what the source's own `zd`",
    "// holds, so `$go`'s body is copied unchanged.",
    "import { zd } from './plugin-chain-host.js';",
    "import { aP, L, m$ } from './plugin-chain-source.js';",
    "import { Gn, Ude, j$n } from './plugin-chain-classic-sites-source.js';",
    "import { P0, aJ } from './plugin-chain-records.js';",
    "import { Jl } from './plugin-chain-relay-source.js';",
    "// Port: `Pet` is the source's text lookup (chunk-sfn1dbxq.js, still unported); the sentence's shape is",
    "// the source's and only the word is the host's, so it is the product's own word for a denied decision.",
    "var Pet = (key) => key === 'deny' ? 'denied' : key;",
  ],
  exports: ['Da', 'No', 'rIt', 'a8', 'CFe', 'RFe', '$go', 'xe', 'ye', 'ke', 'Mo'],
  blocks: [
    {file: 'chunk-nyce03br.js', range: [103321, 103443], note: 'declares Da'},
    {file: 'chunk-nyce03br.js', range: [103443, 103575], note: 'declares No'},
    {file: 'chunk-nyce03br.js', range: [103918, 103945], note: 'declares rIt'},
    {file: 'chunk-nyce03br.js', range: [111504, 111520], note: 'declares a8'},
    {file: 'chunk-nyce03br.js', range: [111520, 111567], note: 'declares CFe'},
    {file: 'chunk-nyce03br.js', range: [112820, 112985], note: 'declares RFe'},
    {file: 'chunk-nyce03br.js', range: [121822, 121896], note: 'declares $go'},
    {file: 'chunk-kwp08k6x.js', range: [17196, 17365], note: 'declares xe'},
    {file: 'chunk-kwp08k6x.js', range: [17365, 17439], note: 'declares ye'},
    {file: 'chunk-kwp08k6x.js', range: [17439, 17723], note: 'declares ke'},
    {file: 'chunk-kwp08k6x.js', range: [17723, 17793], note: 'declares Mo'},
  ],
};
fs.writeFileSync('research/ports/W45-tool-raise-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log('blocks', plan.blocks.length, 'units', plan.blocks.reduce((n, b) => n + b.range[1] - b.range[0], 0));
