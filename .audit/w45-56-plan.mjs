// Builds research/ports/W45-local-store-blocks.plan.json from the measured closure of the local
// settings store: the ten statements of `Ixr`'s closure that no other copy holds, plus the pin flag
// `j` and its state. The eighty-eight statements the closure already carries are imported rather
// than copied a second time.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawnSync(process.execPath, [path.join(root, '.audit/w45-49-closure.mjs'),
  'chunk-4bw62nzm.js', 'Ixr'], {cwd: root, encoding: 'utf8'});
if (child.status !== 0) throw new Error(child.stderr || 'closure tool failed');
const statements = [];
for (const line of child.stdout.split('\n')) {
  const match = /^\s*(\d+)u \[(\d+),(\d+)\) \w+ ([\w$,() ]+?)\s+<-/.exec(line);
  if (match) statements.push({units: Number(match[1]), start: Number(match[2]), end: Number(match[3]), names: match[4]});
}
if (statements.length !== 98) throw new Error(`expected 98 statements, measured ${statements.length}`);

// The blocks no other copy holds, with the note each one carries: what the statement declares and
// what it is for, read from the body itself.
const notes = new Map([
  [9915, 'declares `Nr`: a pass-through to the equality helper the settings diff compares two wrapped source entries with'],
  [9946, 'declares `Vn`: the alias that equality is reached by'],
  [10003, 'declares `q`: the per-host instance cache. `of(host)` answers the host\'s instance, building it through the factory on first ask and remembering it in a `WeakMap` — this is the class `Ixr` is built from'],
  [10256, 'declares `oe`: the walk cache — the folders a policy walk has visited, whether each is a link, the managed MCP document, `noteWalked(key, thunk)` memoizing by key, and `all()`'],
  [10514, 'declares `re`: the repository tier with its holders, baseline and lingering tier — the object a store keeps so a tier stays frozen while something still holds it'],
  [11767, 'declares `XMt`: the empty-settings normalize — a null or empty object answers null'],
  [11833, 'declares `Et`: the source snapshot `{...entry, settings: XMt(settings), unfiltered: XMt(unfiltered), …legacy` — what the settings diff compares'],
  [11960, 'declares `Gr`: the changed-source diff — the keys of both maps, filtered to the entries whose wrapped snapshots are not equal'],
  [12107, 'declares `F8e`: the local settings store itself — `mergedSettings`, `perSource`, the parsed-file and managed-read caches, `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, the epoch, the walk and listing caches, and the methods that load, seed, invalidate and diff them'],
  [16862, 'declares `Ixr`: the store, one per host — `new q(() => new F8e)`'],
  [1148, 'declares the pin state `t` that `j()` reads'],
  [1154, 'declares `j`: whether the policy setting is pinned — the flag the store consults before it walks'],
  [1181, 'declares `nHs`: the pin setter — `true`/`false` pins the flag and answers "pinned" the first time, "unchanged" when the value is already the one asked for, and "conflict" (leaving the flag alone) when it disagrees'],
]);
const fresh4 = statements.filter((statement) => notes.has(statement.start));
const blocks = [
  ...statements.filter((statement) => notes.has(statement.start)).map((statement) => ({
    file: 'chunk-4bw62nzm.js',
    range: [statement.start, statement.end],
    note: notes.get(statement.start),
  })),
  {
    file: 'chunk-k1419ccf.js',
    range: [1148, 1154],
    note: notes.get(1148),
  },
  {
    file: 'chunk-k1419ccf.js',
    range: [1154, 1181],
    note: notes.get(1154),
  },
  {
    file: 'chunk-k1419ccf.js',
    range: [1181, 1280],
    note: notes.get(1181),
  },
];

const plan = {
  imports: [
    '// The local settings store (W45-56): the store itself, one instance per host, and the state it',
    '// keeps — the merged settings and the per-source map a settings read mutates, the parsed-file and',
    '// managed-read caches, the repository tier the store freezes while something holds it, the policy',
    '// walk cache, and the pin flag the walk consults. `Ixr.of(host)` is the entry every settings path',
    '// goes through, and `localStoreProbes` — the field the W45-54 ownership gate reads — is a field of',
    '// this store, so that package\'s handle stops being a seam and becomes the real thing.',
    '//',
    '// The closure is 98 statements and 13,825 units in chunk-4bw62nzm.js, but 88 of those statements',
    '// (7,556 units) are the lodash internals this product already carries, so they are imported rather',
    '// than copied a second time: 12 blocks and 6,302 units are new, ten statements from that module and',
    '// the pin flag with its state from chunk-k1419ccf.js.',
    '//',
    '// `Ht` — the probe cache W45-54 copied on its own — is a dependency of the store, so it is imported',
    '// from ./plugin-chain-local-store-probes-source.js instead of copied twice (same module, same range,',
    '// the rule this chain has followed since W45-51). `Oe` comes from ./plugin-chain-registry-stores-source.js,',
    '// and `dirname`/`basename` are the module\'s own path imports.',
    "import { dirname as Dt, basename as Vr } from 'path';",
    "import { M } from './plugin-chain-lodash-internals-source.js';",
    "import { Ht } from './plugin-chain-local-store-probes-source.js';",
    "import { Oe } from './plugin-chain-registry-stores-source.js';",
  ],
  exports: ['Ixr', 'F8e', 'q', 'oe', 're', 'XMt', 'Et', 'Gr', 'Nr', 'Vn', 'j', 'nHs'],
  blocks,
};
const target = path.join(root, 'research/ports/W45-local-store-blocks.plan.json');
fs.writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`);
const units = blocks.reduce((sum, block) => sum + block.range[1] - block.range[0], 0);
if (fresh4.length !== 10) throw new Error(`expected 10 fresh statements in the store module, measured ${fresh4.length}`);
console.log(`wrote ${path.relative(root, target)}: ${blocks.length} blocks, ${units} units`);
