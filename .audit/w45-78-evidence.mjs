// W45-78 evidence: the held-press store (`b_`/`AK`), the drawing walkers (`XPt`/`Rto`/`SFs`/`FM`/
// `BM`), the terminal input/select dispatch (`Xl`/`x_`/`T_`/`UPn`/`jPn`/`ql`) and the three press
// sites (`ya`/`da`/`ha`). Records the copied blocks, the product seam the copied `Yl` required, and
// the measured behaviour.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const files = {
  press: 'src/plugin-chain-press-source.ts',
  sites: 'src/plugin-chain-press-sites-source.ts',
};
const ledgers = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, readJson(path.replace(/\.ts$/, '-blocks.json'))]));
const totals = Object.fromEntries(Object.entries(ledgers).map(([name, ledger]) => [
  name,
  { blocks: ledger.blocks.length, units: ledger.blocks.reduce((sum, block) => sum + block.units, 0) },
]));
const unitTotal = Object.values(totals).reduce((sum, item) => sum + item.units, 0);
const blockTotal = Object.values(totals).reduce((sum, item) => sum + item.blocks, 0);
const sourceHashes = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, sha(fs.readFileSync(path, 'utf8'))]));
const notFound = Object.entries(ledgers).flatMap(([name, ledger]) => ledger.blocks
  .filter((block) => block.units === 0)
  .map((block) => `${name}:${block.needle}`));
if (notFound.length > 0) throw new Error(`empty blocks: ${notFound.join(', ')}`);

const evidence = {
  schema: 'W45PressEvidence.v1',
  package: 'W45-78 — React layer partition 4: the held-press store and the terminal input/select dispatch',
  date: '2026-10-17',
  question:
    'A drawing holds a handle for every pressable element it drew, and the terminal turns an input or select event into a chain dispatch. How are those handles hosted, reused and released, how does the dispatch find the held element and the plugin that drew it, and what does each site accept?',
  answer:
    `${blockTotal} blocks are copied verbatim (${unitTotal.toLocaleString('en-US')} units): from chunk-n3ykh62m.js the per-plugin runner table \`m_\`/\`Hrt\`, the released-handle test \`g_\`, the dispatch handler \`Yl\`, the serial queue \`bo\`, the drawing key \`_f\`, the cross-drawing lookup \`bf\`, the handle space \`S_\`/\`__\`, the held-press store \`b_\`/\`AK\`, the release \`vAt\`, the hosting pass \`Rto\`, the input argument \`w_\`, the site queues and descriptors \`kf\`/\`Ef\`/\`Cf\`/\`vf\`, the held test \`k_\`, the replacement releases \`FM\`/\`BM\`, the dispatch \`Xl\`, the input and select entry points \`x_\`/\`R_\`/\`T_\`, the hold gate \`ql\`, and the terminal entry points \`UPn\`/\`jPn\`; from chunk-p16hdq43.js the drawing walkers \`_\`/\`I\`/\`ke\`/\`D\`, the option reader \`ve\`, the press collector \`XPt\`, the hover kinds \`M$n\`, the leaf and press tests \`q\`/\`z\`, the relabel pass \`je\`/\`K\`/\`le\`/\`SFs\`; and from chunk-nyce03br.js the surface table \`w3\`, the surface test \`vFe\`, the argument wrapper \`C\`, the shared/press, input and select checks \`ot\`/\`mn\`/\`Cn\`, the descriptor builder \`Lt\`, and the sites \`ya\`/\`da\`/\`ha\`. \`XPt\` reads a drawing and returns one entry per pressable element (Button, Input, Select, Markdown), with a Select's drawn option values. \`Rto\` files those entries in \`AK\` under a drawing key and rewrites every \`press.handle\` in the drawing; a later drawing of the same plugin reuses the handle it drew before. \`Xl\` finds the held entry by hosted handle, or by the full key (tag, plugin, element, surface, component, requestId) when the handle misses, then runs \`aP\` over the module press \`Yl\` with the site's \`check\` over the answer.`,
  measured: [
    '`XPt` on a Box holding a Button (handle 1, key b1), a nested Input (2, i1), a Select (3, s1, options `[{value:"a"},{value:"b"}]`), a Text and a Button of another plugin (7, b2) answers the five press entries in drawing order, the Select carrying `options: ["a", "b"]`; a Text and an element without a string `props.key` contribute nothing.',
    '`Rto(drawing, {component:"Fixture", requestId:"r1", surface:"terminal"})` answers a drawing whose five press handles are distinct hosted handles in `[0, 1073741824)`; the store holds five presses and `holdersOf` names the plugins `["probe-fixture", "other"]`.',
    '`_f("probe-fixture", identity)` is `"probe-fixture\\u0000Fixture\\u0000r1\\u0000terminal"`; `S_` is 1073741824; `__()` answers a number below it.',
    '`b_`: hosting `{tag:"Button", handle:5, element:"x"}` answers a hosted map `{5 → X}`; `heldPress("p", X, "x")` finds it, `heldPress("p", X, "y")` is undefined, and `heldPress` with an empty element answers the same entry. A second drawing of the same plugin with source handle 5 answers the same hosted handle; the store still holds one press, and `heldByKeyOf` for the second requestId finds it while the first requestId no longer does (the reused entry carries the newer request).',
    '`k_` is true for the hosted handle, true for another handle when the element has a hosted button (`hostedButtonsOf`), and false for an element the plugin does not hold.',
    '`x_` runs the held Input: the fixture press receives handle 2 (the handle the drawing held) and the argument `{plugin, element:"i1", component:"Fixture", requestId:"r1", surface:"terminal", kind:"text", value:"hello"}`; the dispatch answers `{element:"i1", value:"hello"}`.',
    '`T_` with `value:"a"` runs the held Select and answers `{element:"s1", value:"a"}` with the argument `{plugin, element, component, requestId, surface, value:"a"}`; `value:"z"` answers undefined and runs nothing.',
    'A dispatch with handle -1 still runs when the full key names one held Input; a dispatch for an element the plugin does not hold answers undefined and runs nothing.',
    '`UPn` and `jPn` answer through the plugin queue: `UPn` on the held Input answers `{element:"i1", value:"queued"}`, `jPn` on the held Select `{element:"s1", value:"b"}`, and an unheld element answers undefined.',
    'A matching-tag press for a plugin that is not loaded rejects with `ui.input: ghost, which drew g1, is not loaded`.',
    '`SFs(drawing, mapper)` rewrites only the handles the mapper names: `handle === 1 → 100` answers handles 100, 2, 3, 4, 7.',
    '`Rto(newDrawing)` releases the source handles the replacement dropped (`[1, 3, 4]`); `FM(old, new)` answers the same; `BM(new)` releases `[2]`. The store drops the stale entries when the new drawing is hosted, not in the release itself.',
    '`m_` numbers handles from -1; `runnerFor` answers the live runner and undefined after `release`; `g_` is true for a negative handle and false for 0.',
    'The sites are `ya.event = "ui.press"`, `da.event = "ui.input"`, `ha.event = "ui.select"`, and the rebuilt table `zd` holds exactly those three. `ot` answers undefined for a matching press and the source\'s own message for a wrong plugin, missing element/component, other requestId, unknown surface, a link on a press that had none, and a non-string link href; `mn` adds the kind and value checks, `Cn` the value check.',
  ],
  partition: {
    slice: '4. The terminal press pipeline',
    state: 'in progress',
    packages: [
      { package: 'W45-78', bodies: ['m_', 'g_', 'Hrt', 'Yl', 'bo', '_f', 'bf', 'S_', '__', 'b_', 'AK', 'vAt', 'Rto', 'w_', 'kf', 'Ef', 'k_', 'FM', 'BM', 'Xl', 'x_', 'R_', 'vf', 'T_', 'ql', 'UPn', 'Cf', 'jPn', 'XPt', 'SFs', 'w3', 'vFe', 'C', 'ot', 'mn', 'Cn', 'Lt', 'ya', 'da', 'ha'], units: unitTotal },
    ],
    remaining: 'The press dispatch `BPn`/`TIe` and the settle wrapper `Ohe` are next: `BPn` guards a held press against the link matcher `Rf`/`nur`, which pulls the URL normalizer `mxn` and its path/URL module graph (W45-79). Then `Xt` Markdown (W45-80), the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { totals, blocks: blockTotal, units: unitTotal, sources: ledgers },
  decisiveFact:
    'The copied `Yl` reads `it().loadedModules.find(...)` and calls `h.press(e.handle, s)` on the record, which is the record `tGe` builds with `press` and `releasePresses`. This product\'s in-process record factory did not carry those members, so the copied handler would have thrown on a held press; the record now routes `press(handle, argument)` to the module\'s own press and answers `releasePresses` as a no-op, because an in-process module holds no environment handles. The dispatch distinguishes two misses: a held entry whose tag differs from the dispatch tag answers undefined silently, while a matching-tag entry whose plugin is not loaded reaches `Yl` and throws. `Rto` is also the store\'s cleanup point: `holdDrawing` deletes the entries a new drawing no longer holds and reports them as released, while `FM`/`BM` only release module runners and hosted-button bookkeeping for the handles that survive that cleanup.',
  changes: [
    {
      file: files.press,
      change: 'forty-two copied blocks: `m_`, `g_`, `Hrt`, `Yl`, `bo`, `_f`, `bf`, `S_`, `__`, `b_`, `AK`, `vAt`, `Rto`, `w_`, `kf`, `Ef`, `k_`, `FM`, `BM`, `Xl`, `x_`, `R_`, `vf`, `T_`, `ql`, `UPn`, `Cf`, `jPn` from chunk-n3ykh62m.js; `_`, `I`, `ke`, `D`, `ve`, `XPt`, `QJt`, `M$n`, `q`, `z`, `je`, `K`, `le`, `SFs` from chunk-p16hdq43.js',
      portSha256: sourceHashes.press,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: files.sites,
      change: 'ten copied blocks: `w3`, `vFe`, `C`, `ot`, `mn`, `Cn`, `Lt`, `ya`, `da`, `ha` from chunk-nyce03br.js',
      portSha256: sourceHashes.sites,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press-sites.ts',
      change: 'the site-table seam: the three descriptors and their checks re-exported, and `zd` rebuilt with exactly the three events the terminal dispatch reads',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press.ts',
      change: 'the held-press seam: the store, the drawing passes and the dispatch re-exported under the name the leaf imports',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-store-entry-source.ts',
      change: '`NDe` exported: the press queue `bo` builds its serial queues from it',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-types.ts',
      change: 'the record carries the source `tGe` press pair (`press(handle, argument)`, `releasePresses(handles)`), and `ChainModule.press` names the handle a drawing held',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-module-record.ts',
      change: 'the in-process record answers `press` through the module\'s own press and `releasePresses` as a no-op',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-module-host.ts',
      change: 'the environment host\'s `press(environmentId, handle, argument)` keeps its own bookkeeping under the drawing handle',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-press.test.ts',
      change: 'twenty tests: the held-press store, the drawing walkers, the input/select dispatch and its refusals, the runner table, and the three site descriptors',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-78-plan.mjs, .audit/w45-78-sites-plan.mjs',
      change: 'the copy plans: 42 press blocks and 10 site blocks, with the `BPn`/`TIe`/`Ohe`/`mxn` bodies deferred to W45-79',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-78-tsc.txt', 'utf8')) },
    undeclaredScan: {
      [files.press]: 'declared 75, unresolved 0',
      [files.sites]: 'declared 16, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '20/20 new; chain family 614/614; full 1,890/1,890 pass, 0 fail',
    sourceIndex: '62 chunks, 1,557/29,141 statements, 286,430/10,439,416 units (2.7%)',
    identity: 'eb114e4a…',
  },
  next:
    'W45-79 is the press dispatch itself: `BPn` builds the ui.press argument and guards the link against `Rf`/`nur`, `TIe` wires `pressFromTerminal`, and `Ohe` settles the dispatch quietly. `BPn`\'s link guard calls `mxn`, whose module graph reaches node:path/node:url and the Windows UNC and encoded-path handling, so the URL graph is part of that package. Then W45-80 copies `Xt` Markdown, the last leaf.',
};

fs.writeFileSync('research/ports/W45-press-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', blockTotal, 'blocks', unitTotal, 'units');
