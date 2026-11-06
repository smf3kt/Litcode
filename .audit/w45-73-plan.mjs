// W45-73 plan: partition 2a of the React layer — the kitty image wire layer. The source's Image
// component asks the terminal to transmit a source and draws the alt text; the wire layer is what
// builds those sequences: the codepoint placeholders, the colour/SGR helpers, the base64 payload
// chunks and the two encoders (`lFo` for the alt, `cFo` for the transmit).
import fs from 'node:fs';

const plan = {
  imports: [
    '// The wire layer is the source\'s own text; the CSI builder and its two constants come from the',
    '// raster surface copy that already carries them.',
    "import { CZ, PH, fl } from './plugin-chain-raster-surface.js';",
    '// chunk-kexg5hxg.js `hxn` (the one body of this wire layer that lives in another chunk and is',
    '// only re-exported by it): `var hxn=PH+"\\\\"`, the string terminator `d` appends. Ported here,',
    '// not copied, because its module is not one of this package\'s; the expression is the source\'s.',
    'const hxn = PH + "\\\\";',
  ],
  exports: ['u', 'D', 'k', 'v', 'O', 'S', 'lFo', 'd', 'Y', 'M', 'cFo', 'hun', 'G', 'N', 'h$t', 'b', 'R', 'f', 'y', 'm', 'L'],
  blocks: [
    { file: 'chunk-fzk4rpqy.js', range: [918, 1345], note: 'the SGR builders and the colour/border name tables; `hun` is the row suffix `lFo` uses' },
    { file: 'chunk-fzk4rpqy.js', range: [3919, 5640], note: 'the wire constants: the APC introducer, the chunk size, the codepoint table `y`, the colour masks and the payload cap `L`' },
    { file: 'chunk-fzk4rpqy.js', range: [5640, 5801], note: '`u` — a positive-integer range check' },
    { file: 'chunk-fzk4rpqy.js', range: [5801, 5960], note: '`D` — the base64 payload check' },
    { file: 'chunk-fzk4rpqy.js', range: [5960, 6187], note: '`k` — the file/shm name check: non-empty, no NUL, at most 3072 bytes' },
    { file: 'chunk-fzk4rpqy.js', range: [6187, 6239], note: '`v` — UTF-8 to base64' },
    { file: 'chunk-fzk4rpqy.js', range: [6239, 6382], note: '`O` — the colour sequence: 256-colour below 256, truecolor otherwise' },
    { file: 'chunk-fzk4rpqy.js', range: [6382, 6440], note: '`S` — the first n codepoints of the placeholder table' },
    { file: 'chunk-fzk4rpqy.js', range: [6440, 6571], note: '`lFo` — the alt: the colour sequence and one placeholder per row' },
    { file: 'chunk-fzk4rpqy.js', range: [6571, 6642], note: '`d` — one framed wire message: the introducer, the body and the suffix' },
    { file: 'chunk-fzk4rpqy.js', range: [6642, 6710], note: '`Y`/`M` — the format and medium codes' },
    { file: 'chunk-fzk4rpqy.js', range: [6710, 7275], note: '`cFo` — the transmit: header codes, file/shm medium, the base64 payload split at the chunk size' },
  ],
};

fs.writeFileSync('research/ports/W45-image-wire-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks', plan.blocks.reduce((sum, b) => sum + b.range[1] - b.range[0], 0), 'units', plan.exports.length, 'exports');
