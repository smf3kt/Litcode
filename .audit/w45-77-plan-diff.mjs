// W45-77 plan, part 3: the unified-diff renderer `tq` and its hunk component `H4`, the `diff`
// package the word-level pairing runs on, and the line helpers shared with the code block. Copied
// from chunk-nnwag7zt.js, chunk-34bv7wfw.js, chunk-1r9zp6s1.js, chunk-04m6g9sr.js and
// chunk-3qabb19b.js.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { ge } from './tui-color.js';",
    "import { Xe as e, Xe as r, w, s, s as ld, n, km } from './plugin-chain-react-surface.js';",
    "import { ne } from './plugin-chain-source.js';",
    "import { Mi, nt, Tj, hr, Qdn, Kl, CNo } from './plugin-chain-code-host.js';",
    "import { Epe } from './plugin-chain-normalize-source.js';",
    "import { ae } from './tui-render-host.js';",
    "import { vu } from './tui-render-engine.js';",
    "import { Int } from './plugin-chain-leaf-walkers.js';",
    "import { Zoo } from './plugin-chain-diff-source.js';",
  ],
  exports: ['uu', 'DIe', 'ydn', 'DXe', 'dje', 'uwe', 'H4', 'tq'],
  blocks: [
    { file: 'chunk-3qabb19b.js', needle: 'function uwe(', k: 'fn', note: '`uwe` — interleave a separator between hunks' },
    { file: 'chunk-04m6g9sr.js', needle: 'var ydn=', k: 'stmt', note: '`ydn` — the longest line shown before it is truncated' },
    { file: 'chunk-04m6g9sr.js', needle: 'function DXe(', k: 'fn', note: '`DXe` — truncate a long line and count the characters dropped' },
    { file: 'chunk-04m6g9sr.js', needle: 'function dje(', k: 'fn', note: '`dje` — the sentence that says how many characters were dropped' },
    { file: 'chunk-1r9zp6s1.js', needle: 'function uu(', k: 'fn', note: '`uu` — a column that may reach the left edge of the screen' },
    { file: 'chunk-1r9zp6s1.js', needle: 'function DIe(', k: 'fn', note: '`DIe` — pre-rendered lines drawn as one raw ANSI element' },
    { file: 'chunk-nnwag7zt.js', needle: 'function pe(', k: 'fn', note: '`pe` — wrap one rendered line as a Box child' },
    { file: 'chunk-nnwag7zt.js', needle: 'var ie=', k: 'stmt', note: '`ie` — the share of changed characters above which a word diff is not drawn' },
    { file: 'chunk-nnwag7zt.js', needle: 'function _(', k: 'fn', note: '`_` — draw a whole hunk without the structured diff' },
    { file: 'chunk-nnwag7zt.js', needle: 'function fe(', k: 'fn', note: '`fe` — read each hunk line\'s kind off its marker' },
    { file: 'chunk-nnwag7zt.js', needle: 'function le(', k: 'fn', note: '`le` — pair removed lines with the added lines that replaced them' },
    { file: 'chunk-nnwag7zt.js', needle: 'function ue(', k: 'fn', note: '`ue` — the word diff between a removed and an added line' },
    { file: 'chunk-nnwag7zt.js', needle: 'function he(', k: 'fn', note: '`he` — draw one word-diffed line' },
    { file: 'chunk-nnwag7zt.js', needle: 'function U(', k: 'fn', note: '`U` — lay out a hunk: line numbers, markers and the wrapped text' },
    { file: 'chunk-nnwag7zt.js', needle: 'function me(', k: 'fn', note: '`me` — number the hunk lines, keeping removed lines on one number' },
    { file: 'chunk-nnwag7zt.js', needle: 'var oe=', k: 'stmt', note: '`oe` — the six theme slots a structured diff reads' },
    { file: 'chunk-nnwag7zt.js', needle: 'function X(', k: 'fn', note: '`X` — pick the theme slots a structured diff was given' },
    { file: 'chunk-nnwag7zt.js', needle: 'function I(', k: 'fn', note: '`I` — the structured diff, cached by file, width and theme' },
    { file: 'chunk-nnwag7zt.js', needle: 'function ee(', k: 'fn', note: '`ee` — expand tabs in every line of a hunk before layout' },
    { file: 'chunk-nnwag7zt.js', needle: 'var H4=', k: 'stmt', note: '`H4` — one hunk: structured when the highlighter answers, the plain layout otherwise' },
    { file: 'chunk-nnwag7zt.js', needle: 'function tq(', k: 'fn', note: '`tq` — the Code block\'s diff renderer' },
  ],
};

fs.writeFileSync('research/ports/W45-code-diff-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
