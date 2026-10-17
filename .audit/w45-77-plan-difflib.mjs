// W45-77 plan, part 0: the `diff` package the word-level pairing runs on, copied whole from
// chunk-34bv7wfw.js. Its module scope holds many short names (`Z`, `_`, `U`), so it stays its own
// file; the renderers import `Zoo` from it.
import fs from 'node:fs';

const plan = {
  imports: [],
  exports: ['Zoo'],
  blocks: [
    { file: 'chunk-34bv7wfw.js', range: [615, 11040], note: 'the `diff` package: `Zoo` and the character/word diff classes it runs on' },
  ],
};

fs.writeFileSync('research/ports/W45-diff-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
