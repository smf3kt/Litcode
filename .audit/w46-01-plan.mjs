// W46-01 plan: the scope-picker frame — the component `gLt`, its row list `Vse`, the limits
// `TBe`/`MBe`/`DBe` and the reset stub `FLt`, the chord label `pHe`, plus the two local helpers
// the frame reaches: the clamp `ad` and the empty-state block `fo`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { Xe as e, Tc as r, w, b, y, P, Z, R, le, s, n } from './plugin-chain-react-hooks.js';",
    "import { ke, Qc, _y, aS, nt, z, Se, es, rS, _C } from './tui-scope-picker-frame-host.js';",
  ],
  exports: ['FLt', 'TBe', 'MBe', 'DBe', 'gLt', 'Vse', 'pHe', 'ad', 'fo'],
  blocks: [
    { file: 'chunk-24k7d6mw.js', range: [605350, 605389], note: '`FLt` the empty reset handler and the frame limits `TBe`/`MBe`/`DBe`' },
    { file: 'chunk-24k7d6mw.js', range: [605389, 611517], note: '`gLt` the scope-picker frame: search input, windowed rows, keyboard and wheel movement, preview layout and the hint row' },
    { file: 'chunk-24k7d6mw.js', range: [611517, 613200], note: '`Vse` the row list: empty state, focus and cursor declaration, scroll markers, click and hover' },
    { file: 'chunk-24k7d6mw.js', range: [613200, 613266], note: '`pHe` the chord label: the first word of a select action' },
    { file: 'chunk-06azbynj.js', range: [200495, 200579], note: '`ad` the clamp used by the window and focus movement' },
    { file: 'chunk-x90vmw14.js', range: [757, 1166], note: '`fo` the empty-state block' },
  ],
};

fs.writeFileSync('research/ports/W46-scope-picker-frame.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
