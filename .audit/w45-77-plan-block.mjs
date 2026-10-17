// W45-77 plan, part 2: the code block renderer `Ob` and the source-line components it draws,
// copied from chunk-yfhs3yf4.js. `MXe` is already carried (tui-highlight-cache.ts) and is imported
// rather than copied again.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { extname as bt } from 'node:path';",
    "import { Xe as e, Xe as r, P, R, w, y, n as Do, n, s, km } from './plugin-chain-react-surface.js';",
    "import { b, bn } from './tui-bundle-runtime.js';",
    "import { MXe } from './tui-highlight-cache.js';",
    "import { RU } from './tui-component-host.js';",
    "import { kAe } from './tui-highlight-manager.js';",
    "import { hr, Tj, Mi, Kl, Ys, rDr } from './plugin-chain-code-host.js';",
    "import { pn, Lt } from './tui-markdown-host.js';",
    "import { HN } from './plugin-chain-leaf-walkers.js';",
    "import { ge } from './tui-color.js';",
    "import { t } from './plugin-chain-host.js';",
    "import { ydn, DXe, dje, uu } from './plugin-chain-code-diff-source.js';",
  ],
  exports: ['Ob', 'B', 'nt'],
  blocks: [
    { file: 'chunk-yfhs3yf4.js', needle: 'function j(', k: 'fn', note: '`j` — split a source into lines and remember where each was truncated' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function H(', k: 'fn', note: '`H` — append the truncation marker to the line it belongs to' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function B(', k: 'fn', note: '`B` — draw a whole source: highlight it, or the uncoloured text when the terminal skips colour' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function nt(', k: 'fn', note: '`nt` — highlight one source through the render cache, falling back to markdown' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function he(', k: 'fn', note: '`he` — wrap one line of a rendered source as Text' },
    { file: 'chunk-yfhs3yf4.js', needle: 'var Wt=80,Ob=', k: 'stmt', note: '`Wt` and `Ob` — the default width and the Code block renderer' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function K(', k: 'fn', note: '`K` — how many lines a source holds, without counting the final newline' },
    { file: 'chunk-yfhs3yf4.js', needle: 'function gt(', k: 'fn', note: '`gt` — one source line beside its gutter' },
  ],
};

fs.writeFileSync('research/ports/W45-code-block-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
