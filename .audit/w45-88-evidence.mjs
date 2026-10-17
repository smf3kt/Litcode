// W45-88 evidence: the terminal glue that renders one site through row accounting, and the local
// helpers it reaches. The engine render answer, the settled-cache shell, the row frames, the mount
// counter and the fullscreen reader stay host seams.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-terminal-glue-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));
const hostHash = sha(fs.readFileSync('src/plugin-chain-terminal-host.ts', 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module.',
  'A terminal site is drawn by `yt`: the walker produces the tree, each drawn value answers through the plugin context built from component and request id, and the draw callback receives the input the drawn descriptor names (`uo`).',
  '`pr` wraps the tree in the error boundary unless the component is a Pane; the fallback redraws the engine sentinel tree, and a caught throw notes the site as thrown, files one render-failure note and hands the tree to `onThrown`.',
  '`ur` resolves the on-screen input only while the terminal is fullscreen and the site is hooked; it reads the held rows and the asked range from the render accounting, attaches `onScreen` to the props and keeps the last rows as a fallback.',
  '`xr` reads the settled answer for the current render version, subscribes to the engine render service while hooked, bumps the mount counter, and maps a thrown promise to the engine sentinel through `onThrown`.',
  '`hdn` composes the surface node: the Box carries the drawn site ref, the render event and component, the held-row height and the overflow decision; while hooked it draws the rendered tree under the boundary, and while pending its first frame draws the fallback text.',
  'The row helpers keep the held rows stable: a changed draw or a filled content clears them, turning off stores the last rows, and the first empty content restores them.',
  'The failure note is deduplicated by component and teller (`s5t`/`Iye`), and its module list is the plugins that contributed to the settled site, or every candidate when no site is recorded (`pIn`).',
].join(' ');

const evidence = {
  schema: 'W45TerminalGlueEvidence.v1',
  package: 'W45-88 — the terminal glue',
  date: '2026-10-17',
  question:
    'How does one plugin site become a terminal surface node — which rows are held, when is the engine answer read, and what does the boundary and the failure note do?',
  answer,
  measured: [
    '`cr(input, input)` is `C\\u0000r\\u000080\\u0000false\\u0000<sha256 of {}>` and `cr(null, input)` is the empty string; `dr` logs the failed site and answers undefined.',
    '`lr` clears the rows when the content fills them or the draw changes, and clears `wasOff` on a steady draw; `mr` turns off into the last rows, and an input change still turns off.',
    '`fr` answers undefined while on and the last rows while off.',
    '`ur` off answers the input untouched with no site and no rows; in fullscreen it answers the drawn site, the input with `onScreen`, last rows 4 and content rows 7 from the row host.',
    '`xr` with no hook answers undefined drawn; with a hosted answer and a matching origin it answers the settled tree; a hooked pending answer settles through the store, not the returned object.',
    '`$e` on an empty store is `"0"`; `VH` merges the props and the terminal store viewport into the terminal input.',
    '`yt` builds a context element whose only child is the walked tree; `pr` keeps a Pane bare and wraps every other component in `XD` with resetKey, fallback, telemetryMessage, onError and the tree child.',
    '`hdn` draws a Box with ref, flexDirection, renderEvent, renderComponent, drawPending, minHeight and overflow; without a matching hook its child is the drawn fallback, with one it is the `XD` boundary, and `hasThrown` is the predicate closure `le` returns.',
    '`TU` is the node of `hdn`; `ar(true)` is false and `ar(false)` is true; `uo` answers the third argument unless the drawn descriptor names the same component; `CAt` reads the descriptor input; `pIn` falls back to every candidate and answers the `kAt` descriptor.',
    'A Pane component bypasses the boundary; `GPn(input, [component])` lists the one installed module; `Fss` returns a release function per mount.',
    'Matcher/slice preconditions: the error-boundary component `XD`, the telemetry message stub `i5t`, the logger `t`, the control-character class `y$` and the notification sinks `aCe`/`zz` were already product-side.',
  ],
  partition: {
    slice: '6. Site-tree walker and terminal glue',
    state: 'complete',
    landed: {
      package: 'W45-88',
      bodies: [
        'yt', 'pr', 'ir', 'ar', 'lr', 'mr', 'fr', 'ur', 'cr', 'dr', 'xr', '$e', 'hdn', 'TU', 'VH',
        'uo', 'Oto', 'bVe', 'CAt', 'Vss', 'fno', 'Lur', 'pIn',
        'cIn', 'dIn', 'mno', 'uIn', 'cce', 'HM', 's5t', 'sIn', 'CK', 'Iye',
      ],
      units,
    },
    remaining: 'Partition 4 (the plugin chain runner) is complete through its terminal glue. The next ready item is C-1 (Magpie startup and recovery), with A-1 still a user action.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The terminal surface is one node per site, not a component tree walk at this layer: `hdn` decides the rows, the render version and the drawn answer, and hands the tree to the walker only while a hook matches. The held-row state survives off-screen draws because the row helpers keep the last measured height until the content changes; the engine answer is read through a versioned cache, so a redraw without a version bump reuses the settled tree.',
  hostBoundary: {
    surfaces: ['che', 'dce', 'g4n', 'Fss', 'Mi', 'XD', 'i5t', 't', 'OL adapter'],
    reason:
      'The engine that answers a render (`che`), its settled-evaluation cache (`dce`), the frame row accounting (`g4n`), the render-version mount counter (`Fss`) and the terminal mode (`Mi`) belong to the engine/host; the copied glue is the only caller. The host module mirrors the source contracts the glue reads and keeps the engine injectable. `dce.uiRender` delegates evaluation to the injected render service instead of copying the engine pipeline (`gno`) whose dependency closure is the next subsystem, not this package.',
  },
  changes: [
    {
      file: source,
      change: 'eight copied blocks: the terminal glue, the site input matcher, the render-descriptor WeakMap, the module filter and the render-failure notes',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-terminal-host.ts',
      change: 'the host seam: `che`, the `dce` settled cache, `g4n`, `Fss`, `Mi`, the `OL` store adapter, plus re-exports of `XD`/`i5t`/`kAt`/`t`',
      portSha256: hostHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-terminal.ts',
      change: 'the public seam: the source names plus `renderSiteNode`, `renderTree`, `settledRender`, `heldRows` and the rest',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-hooks.ts',
      change: '`N` — the source symbol-install call this runner keeps as a no-op',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-terminal.test.ts',
      change: 'nineteen tests: the row helpers, the on-screen input, the settled render, the tree and boundary, the surface node and the local helpers',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-88-plan.mjs',
      change: 'the copy plan: eight blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-88-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 101, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '19/19 new; chain family 767/767; full 2,043/2,043 pass, 0 fail',
    sourceIndex: '74 chunks, 1,736/30,139 statements, 315,116/10,878,702 units (2.9%)',
    identity: '76b9199cdd03…',
  },
  next: 'C-1: Magpie startup and recovery — the app-side startup configuration and rotation recovery, with A-1 (credential issuance) still a user action.',
};

fs.writeFileSync('research/ports/W45-terminal-glue-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
