// W46-02 plan: the same six frame blocks bound to the product TUI runtime (document renderer hooks
// and Box/Text elements), so the picker mounts the recovered frame in the host tree.
import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync('research/ports/W46-scope-picker-frame.plan.json', 'utf8'));
plan.imports = [
  "import { y, P, Z, R, le } from './tui-react-runtime.js';",
  "import { jsx as e, jsxs as r } from './tui-jsx.js';",
  "import { w, b, ke, Qc, _y, aS, nt, z, Se, es, rS, _C, s, n } from './tui-scope-picker-frame-tui-host.js';",
];
fs.writeFileSync('research/ports/W46-scope-picker-frame-tui.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
