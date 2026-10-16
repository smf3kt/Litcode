// Builds research/ports/W45-ui-blit-blocks.plan.json: the `$` table's ui.blit entry. The closure tool
// gives the statements; adjacent ones are merged into runs, and each run gets a note naming what it
// declares. The `$ne` statement is dropped from the first ImageSource run (see the prose below), and
// the three remaining free names come from their own seeds.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function closure(moduleName, ...seeds) {
  const child = spawnSync(process.execPath, [path.join(root, '.audit/w45-49-closure.mjs'), moduleName, ...seeds],
    { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (child.status !== 0) throw new Error(child.stderr || `closure failed for ${moduleName} ${seeds.join(',')}`);
  const statements = [];
  for (const line of child.stdout.split('\n')) {
    const match = /^\s*(\d+)u \[(\d+),(\d+)\) \w+ ([\w$,() ]+?)\s+<-/.exec(line);
    if (match) statements.push({ units: Number(match[1]), start: Number(match[2]), end: Number(match[3]), names: match[4] });
  }
  return statements;
}

const raster = closure('chunk-n3ykh62m.js', 'fNs', 'mNs', 'Mss');
if (raster.length !== 43) throw new Error(`expected 43 statements for the raster/image side, measured ${raster.length}`);

// `$ne`, the location policy, is the one statement this package does not copy: the product already
// answers it for `$.fs` through ./plugin-chain-fs-boundaries.ts (W45-46). Its body ends here.
const LOCATION_POLICY_END = 241740;
const locationPolicy = raster.find((statement) => statement.start === 241513);
if (!locationPolicy || locationPolicy.end !== LOCATION_POLICY_END) {
  throw new Error(`expected $ne at [241513,${LOCATION_POLICY_END}), measured ${JSON.stringify(locationPolicy)}`);
}

// Merge adjacent statements into runs, so the plan holds as few blocks as the module allows.
const runs = [];
for (const statement of [...raster].sort((a, b) => a.start - b.start)) {
  if (statement.start === 241513) continue;
  const last = runs.at(-1);
  if (last && last.end === statement.start) {
    last.end = statement.end;
    last.names.push(statement.names);
  } else {
    runs.push({ start: statement.start, end: statement.end, names: [statement.names] });
  }
}
// The run that follows `$ne` starts where the copied text starts, not where the removed statement did.
runs.find((run) => run.start === 241740).start = LOCATION_POLICY_END;

const notes = new Map([
  [241244, 'declares the base64 ratio table (`{bytes:3,characters:4}`) and `ds`, the decoder the cell check leans on: only the standard padded alphabet of whole characters is accepted'],
  [LOCATION_POLICY_END, 'declares the ImageSource shape scalars and shapers — `sc` (a generation), `Df`/`ic` (the file-path and pixel-side ceilings), `fs` (a width and height), `F_` (the `file` form) — each turning its input into the bytes the swap path paints'],
  [242947, 'declares the rest of the ImageSource machinery — `ps`/`uc`/`no`/`U_`/`G_`/`z_`/`K_`/`V_`/`Y_`/`X_`/`q_`/`J_` and `Mss`, the validator: a plain object carrying exactly one source form, with the refusal text `source must be { png }, { rgba, width, height }, { file, format } or { shm, format, width, height }` for every other shape'],
  [248812, 'declares the Raster side of the blit: the check `fNs` (a requestId and key, then exactly one of `cells` or `source`, then numeric columns/rows), the cell helpers `xi`/`rb`/`Un`/`ms`/`Nf`/`ob`/`sb`/`ko`/`gs`/`Lf`/`xo` and the decoder `fur` (base64 of `columns*rows` cells), the denial helper `xDe`, the mounted-raster accessor `hs`, the other-plugin test `ib`, the lookup key `e5t`, the per-second window `ZPn`/`ab` and its limiter `qto`, the refusal text `Kto`, and the run `mNs`'],
  [1868588, 'declares the Image side of the blit: `Yj` (the mounted-image accessor), `a2t` (the other-plugin test), the run `kFo` and its `bFo` predicate'],
  [2833, 'declares `QJt`, the separator the mounted-raster and mounted-image lookups join their key with'],
  [6302, 'declares `fpr`, the control-character pattern over the character classes `b3` (imported below, carried by ./plugin-chain-source.ts), and `QT`, the test `F_` runs on a `source.file`'],
]);

const blocks = [];
for (const run of runs) {
  const note = notes.get(run.start);
  if (!note) throw new Error(`no note for the run at ${run.start} (${run.names.join(', ')})`);
  blocks.push({ file: 'chunk-n3ykh62m.js', range: [run.start, run.end], note });
}
blocks.push({
  file: 'chunk-sfn1dbxq.js',
  range: [1868588, 1869519],
  note: notes.get(1868588),
});
blocks.push({
  file: 'chunk-p16hdq43.js',
  range: [2833, 2864],
  note: notes.get(2833),
});
blocks.push({
  file: 'chunk-tvdq3hrk.js',
  range: [6302, 6403],
  note: notes.get(6302),
});

const plan = {
  imports: [
    "import { isAbsolute as JN } from 'path';",
    '// The `$\' table\'s ui.blit entry (W45-58): the one floor that paints the mounted surface. A plugin',
    '// blits by naming the requestId and key of a site it mounted and handing one of two things — its',
    '// encoded `cells` for a Raster, or a `source` (an ImageSource) for an Image — and the entry paints',
    '// that site, refusing with a reason when the site is not mounted, is another plugin\'s, has a',
    '// different size, is asked for more than the per-second cap, or carries cells that are not the',
    '// base64 of exactly the cells the size needs.',
    '//',
    '// The blocks are the module\'s own text: forty-three statements of chunk-n3ykh62m.js, the two',
    '// Image-side bodies in chunk-sfn1dbxq.js, the separator in chunk-p16hdq43.js, and the pattern',
    '// `QT` the `file` form leans on, in chunk-tvdq3hrk.js.',
    '//',
    '// `$ne`, the location policy that opens the ImageSource run (chunk-n3ykh62m.js [241513,241740) 227',
    '// units), is the one statement this package does NOT copy: it is already answered for `$.fs` by',
    '// ./plugin-chain-fs-boundaries.ts (W45-46), whose record quotes the body and names the closure',
    '// this product does not carry (`lYe`/`gin`/`BH`/`ks`/`oie`/`qa`/`ree` in chunk-ae84tp6z.js and `_4`',
    '// in chunk-4bw62nzm.js — Bun\'s own namespace layer). The copied run starts where that statement',
    '// ends, and the import below wires the source\'s own name to that one boundary. `JN` is the source\'s',
    '// import of `isAbsolute` from `path`, bound to the node builtin exactly as',
    '// ./plugin-chain-fs-source.ts binds its path imports.',
    '//',
    '// `L` (the plain-object test), `Ge` (the memoizer), `h$` (the whole-number test, chunk-nyce03br.js',
    '// [38157,38216)) and `b3` (the control-character classes, chunk-nyce03br.js [5183,5322)) are bodies',
    '// ./plugin-chain-source.ts already carries; `ae` (the width of a string) is carried by',
    '// ./plugin-chain-text-clamp-source.ts, whose `Bun.stringWidth` binding this product already',
    '// provides; `it` (the host accessor the mounted caches hang off) is in ./plugin-chain-host.ts.',
    '// `h$` and `b3` were carried there without being exported; this package adds the two names to that',
    '// plan\'s export list so the bodies stay single-definition.',
    "import { Ge, L, b3, h$ } from './plugin-chain-source.js';",
    "import { ae } from './plugin-chain-text-clamp-source.js';",
    "import { it } from './plugin-chain-host.js';",
    "import { $ne } from './plugin-chain-fs-boundaries.js';",
  ],
  exports: [
    'wr', 'ds', 'sc', 'Df', 'ic', 'fs', 'F_', 'ps', 'uc', 'no', 'U_', 'G_', 'z_', 'K_', 'V_', 'Y_', 'X_', 'q_', 'J_',
    'Mss', 'fNs', 'xi', 'rb', 'Un', 'ms', 'Nf', 'ob', 'sb', 'ko', 'gs', 'Lf', 'xo', 'fur', 'xDe', 'hs', 'ib',
    'ZPn', 'e5t', 'ab', 'qto', 'Kto', 'mNs', 'Yj', 'a2t', 'kFo', 'bFo', 'QJt', 'fpr', 'QT',
  ],
  blocks,
};
const target = path.join(root, 'research/ports/W45-ui-blit-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units`);
for (const block of blocks) console.log(`  ${block.file} [${block.range}] ${block.range[1] - block.range[0]}u`);
