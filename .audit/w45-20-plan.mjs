import fs from 'node:fs';
const plan = {
  imports: [
    '// The module-to-host call path: a plugin method call funnels into `Hze`, which asks the chain its',
    '// handlers, waits out a module whose hooks are still loading, and falls back to the call table\'s own',
    '// action (`bottom`) — with a defensive copy of the arguments for the twelve names in `Cme`.',
    '// `tIt` is that copier, with `U$n` (the well-formed-string normalizer) and its two budget constants;',
    '// `TDe` is the copier as the entry path calls it; `ls`/`YPn` are the async-local store the call runs',
    '// inside. `Yc`/`hf` measure and repair lone surrogates the way the runtime\'s own String methods do.',
    "import { N5t } from './plugin-chain-classic-raise-source.js';",
    "import { He, L, Ooe, aP, $A } from './plugin-chain-source.js';",
    "import { P0, aJ } from './plugin-chain-records.js';",
    "import { Z$n } from './plugin-chain-host.js';",
    "import { iD } from './plugin-chain-sites-source.js';",
    "import { AsyncLocalStorage as jD } from 'node:async_hooks';",
    '// Port: `ls` is a second `AsyncLocalStorage` instance, as it is in the source (chunk-n3ykh62m.js',
    '// imports its own `jD` from `async_hooks`); the runner copy carries another one (`Ve`) for the',
    '// dispatch pause, which is a different job.',
  ],
  exports: ['Cme', 'Hze', 'ESe', 'AFe', '$$n', 'm', 'a', 'l', 'g', 'Yc', 'hf', 'U$n', 'tIt', 'ls', 'YPn', 'TDe'],
  blocks: [
    {file: 'chunk-sfn1dbxq.js', range: [1842414, 1842591], note: 'the twelve names whose answer is copied before the default action'},
    {file: 'chunk-sfn1dbxq.js', range: [1842591, 1843388], note: 'declares Hze, the module-to-host call raiser'},
    {file: 'chunk-nyce03br.js', range: [6016, 6041], note: 'the copier depth and node budgets'},
    {file: 'chunk-nyce03br.js', range: [6303, 6313], note: 'the copier budget multiplier'},
    {file: 'chunk-nyce03br.js', range: [6313, 6340], note: 'declares U$n, the well-formed-string normalizer'},
    {file: 'chunk-nyce03br.js', range: [6770, 7275], note: 'declares tIt, the structural copier'},
    {file: 'chunk-ax7r0qj7.js', range: [1850, 2243], note: 'the lone-surrogate patterns and the native String bindings'},
    {file: 'chunk-ax7r0qj7.js', range: [2243, 2353], note: 'declares Yc and hf, the well-formed test and repair'},
    {file: 'chunk-n3ykh62m.js', range: [232741, 232755], note: 'the call path\'s async-local store'},
    {file: 'chunk-n3ykh62m.js', range: [232946, 232979], note: 'declares YPn, running a call inside that store'},
    {file: 'chunk-n3ykh62m.js', range: [266967, 267031], note: 'declares TDe, the copier as the entry path calls it'},
  ],
};
fs.writeFileSync('research/ports/W45-host-call-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log('blocks', plan.blocks.length, 'units', plan.blocks.reduce((n, b) => n + b.range[1] - b.range[0], 0));
