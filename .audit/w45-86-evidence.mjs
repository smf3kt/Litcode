// W45-86 evidence: the site-tree walker `je`, the display href encoder `Mrt`, the Box-key scope
// check `X4t` and the control/bidi patterns they use (`y$`, `zDe`/`zpr`/`pot`).
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-walker-host-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module.',
  '`je` walks one plugin tree value: strings become Text children; an `engine` node hands its ref to the draw callback; Button/Input/Select/Code/Markdown/Client/Svg/Image/Raster each become their component with the press handle and the props the source passes (the Client rebuild recurses into `je` with a null draw); a Link resolves `Mrt(href)` for its display text and `Nrt(href)` for its URL and draws the host link component `Wt`.',
  'Containers split inline and block: inline types keep string children, block types walk them into Text; a keyed Box becomes a HoverScope whose key must be a usable address and unique under its parent (`X4t`), a Box or Text carrying a hover block draws through `Ut` with the group `Bt(group.plugin, hover)`, and everything else draws a Text or Box with `De(props)`.',
  '`Mrt` percent-encodes control characters and replaces bidi marks; `X4t` reports a dropped key or a repeated one exactly once.',
].join(' ');

const evidence = {
  schema: 'W45WalkerEvidence.v1',
  package: 'W45-86 — the site-tree walker',
  date: '2026-10-17',
  question:
    'How does the recovered renderer turn one plugin tree value into the surface elements the chain draws, and which keys decide a hover scope?',
  answer,
  measured: [
    'A string draws `Text` with the string as its child; an `engine` node answers the draw callback result for its ref.',
    'Button maps `{plugin,handle}` from `press`, `element` from `props.key`, and passes label/hotkey/action/plain/dimColor/variant/role/hover, with `held` mapping string children raw and other children through the walker.',
    'Input and Select pass their own prop sets and the press handle; Code passes `props` through unchanged; Markdown always carries `press` (undefined without one), `elementKey` and `pressableLinks`.',
    'Client draws `Io` keyed `client:<plugin>:<key>` with module, the prop bag, `drawn` equal to the whole props object, and width/height/flexGrow; its rebuild recurses with a null draw (a string rebuilds to Text).',
    'Svg draws a dim Text with the alt; Image and Raster add `image:`/`raster:` keys only when the element key exists; both map plugin, element key, dimensions and payload.',
    'A Link with label and no children draws `Wt` with the URL, a fallback Text of the label, a space and the dim display href, and the label as its child; without a label and children the fallback is undefined and the display href is the child.',
    'A keyed Box draws `$t` with `key`/`isLive:true`/`elementKey`, the layout without the key, the hover block and the group `{plugin,scope}` when the hover block names a scope; a plain Box draws `Box` with the props unchanged; a hovered Text draws `Ut` with `isInline:true` (false for a Box).',
    'Under one parent the first drawn key is live and keyed; a repeat is drawn with `isLive:false` and no `key`; block string children become Text while inline string children stay strings.',
    '`X4t` admits a usable key once, then answers `Box "k" is drawn twice under one parent; only the first is a hover scope`; an empty/non-string/over-long key answers `Box key "…" is not a string of 1 to 10000 characters; it is dropped and names no hover scope`, and a control character answers `Box "a?" key holds a control character; it is dropped and names no hover scope`.',
    '`Mrt` leaves spaces and printable Unicode alone, percent-encodes tab/newline/control characters, and encodes bidi marks (`a‮b` → `a%E2%80%AEb`); `y$`/`pot` are the control and bidi RegExps and `zDe` is `[[1564,1564],[8234,8238],[8294,8297]]`.',
  ],
  partition: {
    slice: '6. Site-tree walker and terminal glue',
    state: 'partial',
    landed: {
      package: 'W45-86',
      bodies: ['je', 'Mrt', 'y$', 'zDe', 'zpr', 'pot', 'X4t'],
      units,
    },
    remaining:
      'The terminal glue that renders a site through row accounting: `yt`, `pr`, the row helpers `lr`/`mr`/`fr`, `ur`, `cr`/`dr`, `xr`, `ar`, `$e`, `hdn`, `TU` and `VH`, with their imported row/draw accounting (`dce`, `g4n`, `GPn`, `pIn`, `uIn`, `LAt`, `MF`, `Fss`, `che`, `Ioe`, `iur`, `$ur`, `mIn`, `kVe`, `OL`, `oIn`, `j3e`, `Frt`, `l9`, `Omt`).',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The walker is one recursive dispatch on `type`, not a component table: every site type is constructed with the press handle the node carries, and the only local state is the per-parent set of Box keys that decides which of two same-key Boxes is a live hover scope. Links have two encodings: `Nrt` makes the URL well formed, while `Mrt` only escapes the characters a terminal cannot show safely (controls and bidi marks), leaving printable text readable.',
  hostBoundary: {
    token: 'Wt',
    source: 'chunk-1r9zp6s1.js — `function Wt(o)`',
    reason:
      'The link component decides whether the terminal can draw a real hyperlink, draws an `ink-link` element when it can and the fallback text otherwise. That decision belongs to the renderer that owns the terminal, so the seam exposes the link token the way the action box is exposed (`KH`); the host renderer resolves it and keeps the fallback child.',
  },
  changes: [
    {
      file: source,
      change: 'five copied blocks: the walker, the display encoder, its two patterns and the Box-key scope check',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-walker-host.ts',
      change: 'the host seam: the link component token `Wt`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-walker.ts',
      change: 'the seam: the source names plus `renderSiteTree`, `encodeDisplayHref` and `hoverScopeProblem`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-walker.test.ts',
      change: 'thirteen tests: the node types, the containers, the scope check, the encoder and the aliases',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-86-plan.mjs',
      change: 'the copy plan: five blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-86-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 44, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '13/13 new; chain family 723/723; full 1,999/1,999 pass, 0 fail',
    sourceIndex: '72 chunks, 1,666/30,120 statements, 307,819/10,876,094 units (2.8%)',
    identity: '14255a2d…',
  },
  next: 'The terminal glue: row accounting, the rendered-site fallback and the terminal surface seams (`yt`, `pr`, `ur`, `xr`, `hdn`, `VH` and their helpers).',
};

fs.writeFileSync('research/ports/W45-walker-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
