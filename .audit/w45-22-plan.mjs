import fs from 'node:fs';
const plan = {
  imports: [
    '// The streaming half of the module-to-host call path: a plugin\'s streaming method call funnels',
    '// into `aGe`, the twin of `Hze` (W45-20). Same wait gate and handler collection, a streaming',
    '// dispatch (`iwr` over the stage `Jx`), and a floor that relays the stream (`bottom.stream`) while',
    '// noting whether a plugin withheld the result (`tzt`). The record layer both halves read is already',
    '// carried, so it is imported, not copied again.',
    "import { N5t } from './plugin-chain-classic-raise-source.js';",
    "import { He, Gde, l, hlt, D, Ooe, ze, Fgo, kSe, CFe, Gt, jo, ce } from './plugin-chain-source.js';",
    "import { Nl } from './plugin-chain-host.js';",
  ],
  exports: ['tzt', 'ezt', 'aGe', '$6', 'wt', 'tRe', 'Ep', 'bp', 'Sp', 'Ts', 'Jx', 'vp', 'Ap', 'Rp', 'iwr', 'et', 'ft', 'ct', 'has'],
  blocks: [
    {file: 'chunk-sfn1dbxq.js', range: [1843388, 1844317], note: 'the withheld-result texts, the await-then-stream retry, and aGe'},
    {file: 'chunk-nyce03br.js', range: [147445, 156519], note: 'the streaming dispatch family: $6, wt, tRe, Ep, bp, Sp, Ts, Jx, vp, Ap, Rp, iwr'},
    {file: 'chunk-2kdsvp3x.js', range: [35397, 35875], note: 'declares et'},
    {file: 'chunk-2kdsvp3x.js', range: [39309, 39328], note: 'declares ft, the streamLinks branch'},
    {file: 'chunk-2kdsvp3x.js', range: [39563, 40188], note: 'declares ct and has, the streaming record and its collector'},
  ],
};
fs.writeFileSync('research/ports/W45-stream-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log('blocks', plan.blocks.length, 'units', plan.blocks.reduce((n, b) => n + b.range[1] - b.range[0], 0));
