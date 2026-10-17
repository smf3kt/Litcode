// W45-78 plan: the held-press store and the terminal input/select dispatch — partition 4's core.
// Copies the press cluster of chunk-n3ykh62m.js and the drawn-press walkers of chunk-p16hdq43.js.
// The ui.press dispatch `BPn` is deferred: its link guard pulls the path/URL normalizer `mxn`, whose
// module graph is its own package. `TIe` comes with `BPn`.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { t, it } from './plugin-chain-host.js';",
    "import { He, aP, L, $A } from './plugin-chain-source.js';",
    "import { P0 } from './plugin-chain-records.js';",
    "import { NDe } from './plugin-chain-store-entry-source.js';",
    "import { zd } from './plugin-chain-press-sites.js';",
  ],
  exports: [
    'm_', 'g_', 'Hrt', 'Yl', 'bo', '_f', 'bf', 'S_', '__', 'b_', 'AK', 'vAt', 'Rto', 'w_', 'kf',
    'Ef', 'k_', 'FM', 'BM', 'Xl', 'x_', 'R_', 'vf', 'T_', 'ql', 'UPn', 'Cf', 'jPn', 'XPt', 'SFs',
  ],
  blocks: [
    { file: 'chunk-n3ykh62m.js', needle: 'function m_(', k: 'fn', note: '`m_` — the per-plugin press runner table' },
    { file: 'chunk-n3ykh62m.js', needle: 'var g_=', k: 'stmt', note: '`g_` — whether a handle marks a released press' },
    { file: 'chunk-n3ykh62m.js', needle: 'var Hrt=', k: 'stmt', note: '`Hrt` — the runner table instance' },
    { file: 'chunk-n3ykh62m.js', needle: 'var Yl=', k: 'stmt', note: '`Yl` — the press handler a dispatch appends' },
    { file: 'chunk-n3ykh62m.js', needle: 'function bo(', k: 'fn', note: '`bo` — a per-name serial queue' },
    { file: 'chunk-n3ykh62m.js', needle: 'var _f=', k: 'stmt', note: '`_f` — the drawing key a hosted press is filed under' },
    { file: 'chunk-n3ykh62m.js', needle: 'function bf(', k: 'fn', note: '`bf` — a press held by another drawing of the same plugin' },
    { file: 'chunk-n3ykh62m.js', needle: 'var S_=', k: 'stmt', note: '`S_` — the handle space' },
    { file: 'chunk-n3ykh62m.js', needle: 'var __=', k: 'stmt', note: '`__` — the next random handle' },
    { file: 'chunk-n3ykh62m.js', needle: 'function b_(', k: 'fn', note: '`b_` — the held-press store' },
    { file: 'chunk-n3ykh62m.js', needle: 'var AK=', k: 'stmt', note: '`AK` — the held-press store instance' },
    { file: 'chunk-n3ykh62m.js', needle: 'function vAt(', k: 'fn', note: '`vAt` — release the handles a new drawing no longer holds' },
    { file: 'chunk-n3ykh62m.js', needle: 'function Rto(', k: 'fn', note: '`Rto` — host a drawn press set and relabel its handles' },
    { file: 'chunk-n3ykh62m.js', needle: 'var w_=', k: 'stmt', note: '`w_` — the input argument a press carries' },
    { file: 'chunk-n3ykh62m.js', needle: 'var kf=', k: 'stmt', note: '`kf` — the input site queue' },
    { file: 'chunk-n3ykh62m.js', needle: 'var Ef=', k: 'stmt', note: '`Ef` — the ui.input site' },
    { file: 'chunk-n3ykh62m.js', needle: 'var k_=', k: 'stmt', note: '`k_` — whether a plugin holds a press for a key' },
    { file: 'chunk-n3ykh62m.js', needle: 'function FM(', k: 'fn', note: '`FM` — release the presses a replaced drawing dropped' },
    { file: 'chunk-n3ykh62m.js', needle: 'function BM(', k: 'fn', note: '`BM` — release every press a drawing held' },
    { file: 'chunk-n3ykh62m.js', needle: 'async function Xl(', k: 'fn', note: '`Xl` — dispatch one input/select' },
    { file: 'chunk-n3ykh62m.js', needle: 'var x_=', k: 'stmt', note: '`x_` — the ui.input dispatch' },
    { file: 'chunk-n3ykh62m.js', needle: 'var R_=', k: 'stmt', note: '`R_` — the select argument' },
    { file: 'chunk-n3ykh62m.js', needle: 'var vf=', k: 'stmt', note: '`vf` — the ui.select site' },
    { file: 'chunk-n3ykh62m.js', needle: 'var T_=', k: 'stmt', note: '`T_` — the ui.select dispatch' },
    { file: 'chunk-n3ykh62m.js', needle: 'var ql=', k: 'stmt', note: '`ql` — dispatch when the plugin holds the element' },
    { file: 'chunk-n3ykh62m.js', needle: 'var UPn=', k: 'stmt', note: '`UPn` — inputFromTerminal' },
    { file: 'chunk-n3ykh62m.js', needle: 'var Cf=', k: 'stmt', note: '`Cf` — the press site queue' },
    { file: 'chunk-n3ykh62m.js', needle: 'var jPn=', k: 'stmt', note: '`jPn` — selectFromTerminal' },
    { file: 'chunk-p16hdq43.js', needle: 'var _=', k: 'stmt', note: '`_` — whether a drawing element is the engine or an Svg' },
    { file: 'chunk-p16hdq43.js', needle: 'var I=', k: 'stmt', note: '`I` — the four pressable element kinds' },
    { file: 'chunk-p16hdq43.js', needle: 'var ke=', k: 'stmt', note: '`ke` — whether an element kind holds children' },
    { file: 'chunk-p16hdq43.js', needle: 'function D(', k: 'fn', note: '`D` — walk an element\'s children' },
    { file: 'chunk-p16hdq43.js', needle: 'function ve(', k: 'fn', note: '`ve` — the option values a Select drew' },
    { file: 'chunk-p16hdq43.js', needle: 'function XPt(', k: 'fn', note: '`XPt` — the presses a drawing holds' },
    { file: 'chunk-p16hdq43.js', needle: 'var QJt=', k: 'stmt', note: '`QJt` — the drawing key separator' },
    { file: 'chunk-p16hdq43.js', needle: 'var M$n=', k: 'stmt', note: '`M$n` — the element kinds a hover group names' },
    { file: 'chunk-p16hdq43.js', needle: 'var q=', k: 'stmt', note: '`q` — whether an element is a leaf' },
    { file: 'chunk-p16hdq43.js', needle: 'var z=', k: 'stmt', note: '`z` — whether an element carries a press' },
    { file: 'chunk-p16hdq43.js', needle: 'function je(', k: 'fn', note: '`je` — rewrite one element under a press handle' },
    { file: 'chunk-p16hdq43.js', needle: 'function K(', k: 'fn', note: '`K` — map an element\'s children' },
    { file: 'chunk-p16hdq43.js', needle: 'function le(', k: 'fn', note: '`le` — rewrite every press handle in a drawing' },
    { file: 'chunk-p16hdq43.js', needle: 'var SFs=', k: 'stmt', note: '`SFs` — the drawing relabel entry' },
  ],
};

fs.writeFileSync('research/ports/W45-press-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
