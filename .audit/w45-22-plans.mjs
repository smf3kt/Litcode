// W45-22 layout, by the source's own module graph: chunk-sfn1dbxq.js imports `has` from
// chunk-2kdsvp3x.js, which imports `tRe` from chunk-nyce03br.js. The product keeps that order (three
// files, no cycle), so each `Q` user sits in the file whose module declares the `Q` it calls.
import fs from 'node:fs';

const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');

// 1. chunk-nyce03br.js + the clock it imports from chunk-yjc18bey.js.
const sourcePlan = {
  imports: [
    "// The streaming dispatch family of chunk-nyce03br.js, with the clock (`mIr`, `nS`, `Q`) the",
    "// stream relay waits on. `Q` here is the clock's abortable sleep: chunk-nyce03br.js imports it",
    "// from chunk-yjc18bey.js, and the records copy declares its own different `Q`, which is why the",
    "// two never share a file.",
    "import { Bde } from './plugin-chain-classic-raise-source.js';",
    "import { He, Gde, l, hlt, D, Ooe, ze, Fgo, kSe, CFe, Gt, jo, ce, We, TFe, cs, Ve, Bo, rwr, ss, Ja, ys, lt, ae, gt, ps, fp, fs, ap, xt, Uo, Kg, tp, dEs, CE, Xt, eRe, ip, np, us } from './plugin-chain-source.js';",
    "import { Nl } from './plugin-chain-host.js';",
  ],
  exports: ['$6', 'wt', 'tRe', 'Ep', 'bp', 'Sp', 'Ts', 'Jx', 'vp', 'Ap', 'Rp', 'iwr', 'mIr', 'nS', 'Q'],
  blocks: [
    { file: 'chunk-nyce03br.js', range: [147445, 156519], note: 'the streaming dispatch family: $6, wt, tRe, Ep, bp, Sp, Ts, Jx, vp, Ap, Rp, iwr' },
    { file: 'chunk-yjc18bey.js', range: [940, 1503], note: 'the clock mIr, its default instance nS, and Q, the abortable clock sleep the stream relay waits on' },
  ],
};
write('research/ports/W45-stream-blocks.plan.json', sourcePlan);

// 2. chunk-sfn1dbxq.js: the withheld-result texts, the await-then-stream retry, and the raise entry.
const callPlan = {
  imports: [
    "// The raise entry of the streaming half: `aGe` waits on the same gate as the value events' `Hze`,",
    "// collects the streaming handlers with `has` (the records copy, which is chunk-2kdsvp3x.js), and",
    "// runs the stage `iwr` from the chunk-nyce03br.js copy.",
    "import { N5t } from './plugin-chain-classic-raise-source.js';",
    "import { iwr, tRe } from './plugin-chain-stream-source.js';",
    "import { has, aJ } from './plugin-chain-records.js';",
    "import { He, Ooe } from './plugin-chain-source.js';",
    "import { Nl } from './plugin-chain-host.js';",
  ],
  exports: ['tzt', 'ezt', 'aGe'],
  blocks: [
    { file: 'chunk-sfn1dbxq.js', range: [1843388, 1844317], note: 'the withheld-result texts, the await-then-stream retry, and aGe' },
  ],
};
write('research/ports/W45-stream-call-blocks.plan.json', callPlan);

// 3. The records copy gains the streaming record family and the one import it needs from the module above.
const recordsPath = 'research/ports/W45-chain-records-blocks.plan.json';
const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8'));
if (!records.imports.some((line) => line.includes("./plugin-chain-stream-source.js"))) {
  records.imports.push("import { tRe } from './plugin-chain-stream-source.js';");
}
write(recordsPath, records);

// The bad-loop leftovers: the loop wrote the 5-block streaming plan into the call file's name.
for (const stray of ['src/plugin-chain-stream-call.ts', 'src/plugin-chain-stream-call-blocks.json']) {
  if (fs.existsSync(stray)) { fs.rmSync(stray); console.log('removed', stray); }
}
console.log('stream-source blocks', sourcePlan.blocks.length, 'exports', sourcePlan.exports.length);
console.log('stream-call blocks', callPlan.blocks.length, 'exports', callPlan.exports.length);
console.log('records imports', records.imports.length);
