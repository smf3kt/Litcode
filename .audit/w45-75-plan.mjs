// W45-75 plan: the terminal capability and image-file probe stores the Image component reads. The
// Image resolver asks whether the terminal draws kitty graphics and whether it reads files on this
// machine; both answers live in two small state machines. They are copied whole from
// chunk-mvsmkx6d.js, the only body of which is a signal emitter the chain already carries.
import fs from 'node:fs';

const plan = {
  imports: [
    '// The two stores emit through the signal the registry copy already carries.',
    "import { Oe } from './plugin-chain-registry-stores-source.js';",
  ],
  exports: ['i', 'o', 's', 'Q8n'],
  blocks: [
    { file: 'chunk-mvsmkx6d.js', range: [947, 2782], note: '`i` the image-file probe store, `s`/`Q8n` the capability defaults and names, `o` the capability readings store' },
  ],
};

fs.writeFileSync('research/ports/W45-terminal-capabilities-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
