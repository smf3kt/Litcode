// W45-87 evidence: the render-version and render-key layer (`vA`, `MF`, `kVe`, `mIn`, `Tc`,
// `$H`, `wc`, the live/steady key helpers, the drawing tests and the two stores the terminal
// glue reads), plus the matcher-runner defect the package exposed.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-render-keys-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));
const matchersHash = sha(fs.readFileSync('src/plugin-chain-matchers.ts', 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module; the matcher runner gains seven verbatim blocks that restore its recovered semantics.',
  'A render key is `surface\\0component\\0requestId` (`MF`); the props key is `columns\\0fullscreen\\0sha256(props)` (`mIn`); the versioned key is `key\\0\\0<version>` only when the store holds the version of the versioned key (`jf(key)`, `$H`).',
  '`kVe` composes the two: it starts from the event counter `ui.render` and appends the version of the request key for this surface/component/request under the given viewport and props. `Tc` reads the whole render-version map (skipping the viewport key and the live/steady duplicates) or a listed set of keys under either pace.',
  '`wc` bumps one render version through the shared store; `Rc` is the state suffix, `kc` the live suffix, `wH`/`kH`/`xc` the live/steady key helpers and `Rb` the state-key test.',
  '`sur` sees a position or offset prop; `iur` draws a Box with one and recurses into Box children, but never for Text, Link or engine values; `$ur` reads a well-typed on-screen range or answers null/undefined.',
].join(' ');

const evidence = {
  schema: 'W45RenderKeysEvidence.v1',
  package: 'W45-87 — the render-version and render-key layer',
  date: '2026-10-17',
  question:
    'Which keys decide whether a surface re-renders, how does a component learn the current render version, and what does it mean for a drawn value to draw anything?',
  answer,
  measured: [
    '`MF({surface,component,requestId})` is `surface\\u0000component\\u0000requestId`; `vA` is `ui.render` and `oIn` is `ui.render viewport`.',
    '`$H(key, state, renderKey)` answers `KEY\\u0000\\u000011` when the store holds `jf(MF(input)) = 11` and the bare `KEY` when it does not; `jf` is `key + Rc` with `Rc = "\\u0000state"`.',
    '`mIn` splits into `["80","false",<64 hex>]` for viewport 80 columns, not fullscreen and props `{a:1}`; different props change the digest.',
    '`Tc(state)` yields `ui.render\\u00005\\u0000K\\u00002\\u0000other\\u00007\\u0000` for the map with `ui.render=5`, the viewport key, `K=2`, `K live=3`, `S\\0state=4` and `other=7`: the viewport key, every live key and every state-suffixed key are skipped.',
    '`Tc(state, ["K"])` is `5\\u0000K\\u00002`; `Tc(state, ["K"], "live")` is `5\\u0000K\\u00003`.',
    '`kVe(state, input)` is `5\\u0000\\u000011`; `wc("K")` moves K from 2 to 3 and touches no other key.',
    '`sur({position})` and `sur({top:1})` are true, `sur({color})` and `sur(undefined)` false; `iur` is false for a string, an engine, a Text (with or without a `top` prop) and a Link, true for a Box with `top` and for a Box with a drawn Box child.',
    '`$ur` returns `{first:1,last:2,of:3}`, null for an explicit null, and undefined for a missing or malformed range.',
    '`j3e` is the eight message types; `Ioe` is `{type:"engine",ref:0}`; `Omt.defaultValue` is false; `l9.get()` is undefined before a viewport is written.',
    '`WPn(input)` lists the modules that hook `ui.render` and match the component; `SVe` names them; `Frt(component)` answers whether any module hooks the event; `LAt` and `GPn` filter by an input.',
    '`at` is sha256 hex and `eA` is its 64-hex test; `yno` memoizes the JSON id per object (equal objects share the id); `blt(undefined, ...)` is true (an absent matcher passes).',
    'Matcher runner: `aUn(1,1)` true, `aUn(2,1)` false, objects match partially and recursively, aliases expand on either side (`Agent`↔`Task` via the names table), `Slt(/^x/,"x")` true and `Slt(/^x/,"y")` false; `b(undefined, ...)` is true.',
  ],
  partition: {
    slice: '6. Site-tree walker and terminal glue',
    state: 'partial',
    landed: {
      package: 'W45-87',
      bodies: [
        'vA', 'oIn', 'MF', 's_', 'kVe', 'mIn', 'Tc', '$H', 'wc',
        'kc', 'wH', 'kH', 'xc', 'Rb', 'sur', 'iur', '$ur',
        'j3e', 'Ioe', 'Omt', 'l9', 'Frt', 'LAt', 'WPn', 'SVe', 'GPn',
        'at', 'eA', 'yno', 'hno', 'blt', 'hno table', 'render event helpers',
      ],
      units,
      matcherCore: ['l', 'In', 'c/Bl/gpe/_Z/qW', 'Twr', 'I', 'W', 'S', 'K/C', 'F', 'z', 'G'],
    },
    remaining:
      'The terminal glue that renders a site through row accounting: `yt`, `pr`, the row helpers `lr`/`mr`/`fr`, `ur`, `cr`/`dr`, `xr`, `ar`, `$e`, `hdn`, `TU` and `VH`, with their imported row/draw accounting (`dce`, `g4n`, `pIn`, `uIn`, `Fss`, `che`, `Ioe`, `iur`, `$ur`, `mIn`, `kVe`, `OL`, `oIn`, `j3e`, `Frt`, `l9`, `Omt`).',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'A render is versioned by the pair (event counter, per-request version entry): the counter says the surface changed at all, the request entry says this component must redraw, and the component key is stable across redraws. `Tc` deliberately drops the viewport key and every live/state-suffixed duplicate so the visible map is versioned by the steady keys alone. The package also proved the seam had resolved `l` to the wrong body: `aUn`/`Slt` answer through the recovered runner, which tests literal aliases through the names table and only matches an object matcher partially, so the previous mapping made every scalar matcher pass.',
  hostBoundary: {
    surface: 'the shared render-version store and the module registry',
    reason:
      'The store is owned by the host (`it().renderVersions`, bound through `bindRenderVersions`) and read by name from the copied bodies; the registry supplies the hook list `Frt`/`LAt`/`WPn`/`SVe`/`GPn` filter. Both stay host seams; the copied bodies are the only readers.',
  },
  changes: [
    {
      file: source,
      change: 'twenty-two copied blocks: the render event, the keys, the version readers, the drawing tests and the terminals of the render subsystem',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-render-keys.ts',
      change: 'the seam: the source names plus `renderEventName`, `renderKeyOf`, `renderKey`, `renderVersion`, `propsKey`, `onScreenRange`, `drawsAnything`, `renderEventHooked`, `renderEventHookedFor`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-matchers.ts',
      change: 'seven copied blocks restore the recovered matcher runner and its alias table; `l` now resolves to the runner instead of the seam helper',
      portSha256: matchersHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-render-keys.test.ts',
      change: 'twenty tests: the keys, the drawing tests, the stores and sentinels, the hooks gates and the hash helpers',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-matchers.test.ts',
      change: 'five regression tests: scalar equality, partial object matching, alias expansion, regex matching and the absent-matcher pass',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-87-plan.mjs',
      change: 'the copy plan: twenty-two blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-87-tsc.txt', 'utf8')) },
    undeclaredScan: {
      [source]: 'declared 55, unresolved 0',
      'src/plugin-chain-matchers.ts': 'declared 54, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '25/25 new; chain family 748/748; full 2,024/2,024 pass, 0 fail',
    sourceIndex: '74 chunks, 1,698/30,139 statements, 310,408/10,878,702 units (2.9%)',
    identity: 'f1522ee47cfa…',
  },
  next: 'The terminal glue: row accounting, the rendered-site fallback and the terminal surface seams (`yt`, `pr`, `ur`, `xr`, `hdn`, `VH` and their helpers).',
};

fs.writeFileSync('research/ports/W45-render-keys-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
