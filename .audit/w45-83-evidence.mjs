// W45-83 evidence: the hover group — store accessor `Fe`, count adjuster `mt`, member handle `_t`,
// group key `Bt`/`Dbr`, override split `ft`, subscription hook `ut`, color props `Kt`, normalizer
// `De`, scope context `_e`, resolver `jt`, components `$t`/`Ut` and selector hook `Re`.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-hover-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const evidence = {
  schema: 'W45HoverEvidence.v1',
  package: 'W45-83 — the hover group',
  date: '2026-10-17',
  question:
    'How do the recovered sites count themselves into a hover group, resolve the overrides that follow a hover, and draw a scope and a styled element?',
  answer:
    `${ledger.blocks.length} blocks are copied verbatim (${units.toLocaleString('en-US')} units) into one module. The registry's \`hoverGroups\` Map store is the one source of truth (\`Fe\`), keyed \`plugin\\0scope\\0scope\` (\`Dbr\`). \`mt\` adjusts a key's count and drops it at zero; \`_t\` is one member's enter/leave/regroup, counting in at most one group at a time; \`ut\` subscribes a component to one key (\`isHot\` plus the enter/leave handlers) through the selector hook \`Re\`. \`Bt\` builds the group from a plugin and a scope, \`ft\` strips \`scope\` from the hover block, and \`De\` copies props mapping the three color props through the named-color table. \`jt\` resolves a site's overrides to the group's own hot state when it belongs to one and to the enclosing \`_e\` scope otherwise. \`$t\` (HoverScope) keeps its own hover state for a live scope, subscribes to its group, and provides its state to the subtree while merging the hover overrides into the layout; \`Ut\` (HoverStyled) draws a Text or Box with the resolved overrides and handlers.`,
  measured: [
    '`Dbr({plugin:"p",scope:"s"})` is `p\\0scope\\0s`; `Bt` answers `{plugin,scope}` only when both are given (undefined for no scope, no plugin, or an empty scope block).',
    '`ft({scope:"s",color:"red",bold:true})` is `{color:"red",bold:true}`; `De` maps `red`→`#e5484d`, `blue`→`#3e63dd`, leaves `bogus` and `#abc` unchanged, and answers null for null/undefined; `Kt` is the three color props.',
    '`mt("k",1)` sets `k` to 1 and `mt("k",-1)` removes the key; `_t().enter("a")` counts `a`, a second `enter("b")` is ignored while `a` is held, `leave()` clears, and `regroup("b")` moves the count from `a` to `b`.',
    '`ut` cold answers `isHot:false` with both handlers; after `onMouseEnter` the key is 1 and a fresh render answers `isHot:true`; enter twice reaches 2 and unmounting one mount decrements to 1; a missing group key answers false.',
    '`jt` without a group and a cold scope answers `{overrides:{},handlers:{}}`; with `_e` true the overrides are the mapped hover block; with a hot group the overrides apply and the handlers carry `onMouseEnter`, `onMouseLeave` and `hoverFollowsPaint:true`; a cold group keeps the handlers and no overrides.',
    'A hot HoverScope draws an element of the context type with `{value:false}`, whose child Box merges the layout (`flexDirection:"row"`) with the mapped hover block (`color:"#e5484d"`, `bold:true`), keeps `elementKey`, sets `hoverFollowsPaint:true` and both handlers; a cold one keeps the layout color `#3e63dd`.',
    'A hot HoverStyled draws a Box with the hover color `#46a758`, the handlers and `hoverFollowsPaint:true`; `isInline` draws a Text instead.',
    '`Re` selects through a fake store (`1`), calls the mounted scheduler\'s `paced` once, and a store update marks the render runtime dirty.',
  ],
  partition: {
    slice: '4. The terminal press pipeline, the leaves and the interactive elements',
    state: 'in progress',
    packages: [
      { package: 'W45-80', units: 1747, note: 'the Markdown leaf' },
      { package: 'W45-81', units: 1360, note: 'the Select site, its window and the site-focus reader' },
      { package: 'W45-82', units: 992, note: 'the Input field site' },
      { package: 'W45-83', bodies: ['Fe', 'mt', '_t', 'Bt', 'ft', 'ut', 'Kt', 'De', '_e', 'jt', '$t', 'Ut', 'Re', 'Dbr', 'u4n', 'c'], units },
    ],
    remaining: 'The Button with its action keys, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The hover group is a count store, not a boolean: every member increments and decrements its `plugin\\0scope\\0scope` key, and a component is hot while any member is counted in. The override resolver prefers the group\'s own hot state for a grouped site and falls back to the enclosing scope context for an ungrouped one; the scope provider carries its own local hover state, and every drawn color passes through the named-color table. The selector hook `Re` caches on the snapshot and selector identities and subscribes through the host scheduler when one is mounted.',
  hostBoundary: {
    token: 'PU',
    source: 'chunk-jne9dpdc.js — `var PU=qt(null)` beside the default scheduler `JDr`',
    reason:
      'The scheduler is host state: with no provider `Re` subscribes directly (the source default), and a host that batches store updates mounts its own `paced` wrapper.',
  },
  seamChange: {
    file: 'src/plugin-chain-react-hooks.ts',
    change:
      '`qt` now carries `Provider` pointing at the context itself, the source\'s own shape (`e.Provider=e`), so copied bodies that write `X.Provider` build the source element; the runner still resolves a value from the render\'s `contexts` map.',
  },
  changes: [
    {
      file: source,
      change: 'fifteen copied blocks: the hover cluster, `Re` with its two helpers and `Dbr`',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-hover-host.ts',
      change: 'the host seam: the `PU` store-scheduler context',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-hover.ts',
      change: 'the seam: the store, the members, the resolver, the components and their source aliases',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-registry-state.ts',
      change: 'the registry type gains the `hoverGroups` store the source literal already builds',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-hover.test.ts',
      change: 'ten tests: the key and overrides, the store and members, the subscription, the resolver, the two components and the selector',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-83-plan.mjs',
      change: 'the copy plan: fifteen blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-83-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 43, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '10/10 new; chain family 677/677; full 1,953/1,953 pass, 0 fail',
    sourceIndex: '68 chunks, 1,631/30,063 statements, 297,516/10,864,432 units (2.7%)',
    identity: '92f69502…',
  },
  next:
    'The Button with its action keys, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-hover-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
