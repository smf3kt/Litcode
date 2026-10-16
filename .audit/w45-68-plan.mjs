// W45-68 plan: the keybinding module's row reader — the blocks a caller shows and the legacy names
// rewritten as they are read, with the three statements of this chunk's lodash `mapValues` the mapper
// calls. Everything under that map-values is already carried by the internals copy, so it is imported.
import fs from 'node:fs';

const plan = {
  imports: [
    '// The keybinding editor carries the chord splitter the row reader calls and the legacy names it',
    '// rewrites; this chunk\'s lodash `mapValues` is three statements, and every helper under it is',
    '// already carried by the internals copy rather than copied a second time.',
    "import { h9, Q, Re } from './plugin-chain-keys-editor-source.js';",
    "import { Lxr, uU, Wpe, zZ } from './plugin-chain-lodash-internals-source.js';",
  ],
  exports: ['Ace', 'ge', 'Di', 'oo'],
  blocks: [
    { file: 'chunk-6ccen3s8.js', range: [10481, 10621], note: '`Ace` — one row per binding: the chord split into the keys it is made of, the action as the file wrote it, and the context the block named' },
    { file: 'chunk-6ccen3s8.js', range: [11037, 11145], note: '`ge` — the blocks as the runtime reads them: each binding map is mapped value-wise, and a value that is one of the legacy action names is replaced by the name it is read as' },
    { file: 'chunk-4bw62nzm.js', range: [21687, 21738], note: '`Yr` — the own-key walk this chunk\'s `mapValues` iterates with — and `JMt`, the name it calls it by' },
    { file: 'chunk-4bw62nzm.js', range: [24850, 24936], note: '`Di` — this chunk\'s `mapValues`: the iteratee folded to arity three, the object walked by its own keys, and each value replaced by the result' },
    { file: 'chunk-4bw62nzm.js', range: [24936, 24946], note: '`oo` — the name the keybinding chunk reaches that map-values by, which is why the mapper above can be copied before it' },
  ],
};
const path = 'research/ports/W45-keybinding-rows-blocks.plan.json';
fs.writeFileSync(path, JSON.stringify(plan, null, 1) + '\n');
console.log(path, plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
