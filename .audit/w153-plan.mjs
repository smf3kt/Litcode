import fs from 'node:fs';
const plan = {
  imports: [
    'import { R, le, en, P, Z, w } from "./plugin-chain-react-hooks.js";',
    'import { Ihe } from "./plugin-chain-above-prompt-select-keys-source.js";',
    'import { Lc } from "./plugin-chain-press-button.js";',
    'import { Ohe } from "./plugin-chain-press-dispatch-source.js";',
    'import { _z, Uet } from "./plugin-chain-scroll-focus-source.js";',
    'import { Di as oo } from "./plugin-chain-keys-rows-source.js";',
  ],
  exports: ['A9r', 'Xq', 'sZo', 'iZo', 'ZD', 'PYe'],
  blocks: [
    ['chunk-sfn1dbxq.js', 475702, 475813, 'scroll window clamp'],
    ['chunk-sfn1dbxq.js', 476169, 476191, 'above-prompt request tag'],
    ['chunk-sfn1dbxq.js', 2336000, 2336062, 'act wrapper'],
    ['chunk-sfn1dbxq.js', 2336190, 2338444, 'focus ring hook'],
    ['chunk-bwyexfny.js', 3579, 3835, 'active context hook'],
    ['chunk-6ejn7q9s.js', 108086, 108477, 'focusables of'],
  ].map(([file, a, b, note]) => ({ file, range: [a, b], note })),
};
fs.writeFileSync('.audit/w153-probe.plan.json', JSON.stringify(plan));
console.log('blocks', plan.blocks.length);
