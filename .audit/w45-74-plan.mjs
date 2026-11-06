// W45-74 plan: the Image source model — the shape predicates and the wire-source encoder. The Image
// component holds a plugin-supplied source in one of four shapes and hands it to the transmit as the
// `cFo` source; these bodies are the shape tests and that conversion. The validators and the decoded
// size reader around them were carried by W45-58 already, so only these two statements are copied.
import fs from 'node:fs';

const plan = {
  imports: [
    '// `B_` measures a source\'s decoded size with the base64 decoder the ui.blit copy already carries.',
    "import { ds } from './plugin-chain-ui-blit-source.js';",
  ],
  exports: ['ac', 'Z4t', 'B_', 'Uto', 'Dss'],
  blocks: [
    { file: 'chunk-n3ykh62m.js', range: [242804, 242947], note: '`ac`, `Z4t` and `B_` — the png and file/shm shape tests and the decoded byte size' },
    { file: 'chunk-n3ykh62m.js', range: [245185, 245596], note: '`Uto` and `Dss` — the shm test and the encoder from a source to the transmit shape' },
  ],
};

fs.writeFileSync('research/ports/W45-image-source-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
