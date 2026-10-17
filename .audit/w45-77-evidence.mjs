// W45-77 evidence: the Code leaf (`lt`), the code block renderer (`Ob`/`B`/`nt`) and the unified-diff
// renderer (`tq`/`H4`) with the `diff` package and the line helpers they read. Records the copied
// blocks, the host seam, the jsx-runtime element seam the compiled bodies needed, and the measured
// behaviour.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const files = {
  code: 'src/plugin-chain-code-source.ts',
  block: 'src/plugin-chain-code-block-source.ts',
  diff: 'src/plugin-chain-code-diff-source.ts',
  library: 'src/plugin-chain-diff-source.ts',
};
const ledgerOf = (name) => readJson(files[name].replace(/\.ts$/, '-blocks.json'));
const ledgers = Object.fromEntries(Object.keys(files).map((name) => [name, ledgerOf(name)]));
const totals = Object.fromEntries(Object.entries(ledgers).map(([name, ledger]) => [
  name,
  { blocks: ledger.blocks.length, units: ledger.blocks.reduce((sum, block) => sum + block.units, 0) },
]));
const unitTotal = Object.values(totals).reduce((sum, item) => sum + item.units, 0);
const blockTotal = Object.values(totals).reduce((sum, item) => sum + item.blocks, 0);
const sourceHashes = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, sha(fs.readFileSync(path, 'utf8'))]));

const evidence = {
  schema: 'W45CodeLeafEvidence.v1',
  package: 'W45-77 — React layer partition 3: the Code leaf, the code block renderer and the diff renderer',
  date: '2026-10-17',
  question:
    'How does a plugin Code site draw its content? The leaf must measure its own width, pick the source or diff path, truncate when the wrap mode says so, and hand the content to a highlighter. Which bodies do that, and what host state do they read?',
  answer:
    `${blockTotal} blocks are copied verbatim (${unitTotal.toLocaleString('en-US')} units): the Code leaf \`lt\` with the truncation helpers \`Oe\`/\`Te\`/\`et\`/\`tt\`, the width contexts \`adn\`/\`rt\` and the label \`st\`; the code block renderer \`Ob\` with \`B\`, \`nt\`, \`he\`, the line splitter \`j\`, the marker appender \`H\`, the line counter \`K\` and the gutter row \`gt\`; the unified-diff renderer \`tq\` with \`H4\`, the plain hunk body \`_\`, the line-kind reader \`fe\`, the removed/added pairing \`le\`, the word diff \`ue\`, the word-diff line \`he\`, the hunk layout \`U\` and its numbering \`me\`, the theme slot picker \`X\`, the cached structured diff \`I\`, the tab expander \`ee\`, the share constant \`ie\`, the hunk separator \`uwe\`, the left-edge shell \`uu\`, the raw-ANSI line element \`DIe\`, the long-line truncator \`DXe\`, its marker sentence \`dje\` and the limit \`ydn\`; and the \`diff\` package body that \`Zoo\` exposes. \`lt\` reads its width from a ref measured through \`Ys\` (zero until laid out) or the \`adn\` context, defaults to 80, and renders \`tq\` for a diff or \`Ob\` for source text. \`Ob\` draws a gutter when the start line is beyond the first, asks the render settings for syntax highlighting, and delegates each source to \`B\`, which highlights through \`nt\` unless colour is skipped. \`H4\` draws the plain hunk through \`_\` whenever the structured highlighter answers null.`,
  measured: [
    '`Oe` clamps one line: `Oe("abcdefghij", 5)` answers `"abcd…"`, `Oe("abcdef", 2)` `"a…"`, `Oe("abc", 5)` `"abc"`.',
    '`tt` clamps every line, allowing for the line-number gutter only when a start line is given: `tt("abcdefghij\\nklmnop", 5)` answers `"abcd…\\nklmn…"`; `tt("abcdef\\nghij", 5, 9)` answers `"…\\n…"`.',
    '`et` keeps each hunk line marker and clamps the rest: a hunk `["-abcdef", "+ghijkl", " mnopqr"]` at width 4 and at width 5 answers `["-…", "+…", " …"]`.',
    '`lt` answers a column Box holding `Ob` with `{ code, filePath: "", width: 80, lineNumbers: false }` for source text; a mounted `adn` of 33 makes the width 33; `language: "ts"` makes the label `"source.ts"`.',
    '`lt` on a diff answers a column Box holding `tq` with the parsed hunks, `dim: false`, `width: 80`, `filePath: ""` and `firstLine: null`; `wrap: "truncate-end"` at width 4 answers the lines `["-…", "+…", " …"]`.',
    '`Ob` on a start line beyond the first draws a dim Text `"… from line " 5` before the source body; on line 1 it draws the body alone.',
    '`B` under `/a.js` draws a Text holding `nt` with `language: "js"`; with `skipColoring` it draws the code text directly; a 2,005-character line is cut to 2,000 and ends with `" … [+5 chars]"`, 2,013 characters in all.',
    '`nt` on an unsupported language reports `Language not supported while highlighting code, falling back to markdown: zzz` and answers the plain text.',
    '`tq` over one hunk answers one column Box keyed `hunk-0` holding `H4` with the hunk, `dim`, and the width; over two hunks it answers `hunk-0`, an `uu` ellipsis keyed `ellipsis-1` holding the dim Text `"..."`, and `hunk-1`.',
    '`H4` with no structured diff answers a Box holding `_` with the patch, `dim` and `width`.',
    '`DXe("x".repeat(2100), 0)` answers 2,000 characters with `truncatedChars: 100`; `dje(37)` answers `" … [+37 chars]"`.',
    '`Zoo("abc", "abd")` answers the removed `"abc"` and the added `"abd"`, and `Zoo("abc", "abc")` one unchanged run; the compiled diff package is carried as is.',
    '`uu` without `fromLeftEdge` answers `{ noSelect: true }`; with it, `{ alignSelf: "stretch", noSelect: "from-left-edge" }`.',
    '`DIe` draws one `ink-raw-ansi` element whose height is the line count and whose width is the given width; an empty line list answers null.',
  ],
  partition: {
    slice: '3. Leaf components',
    state: 'in progress',
    packages: [
      { package: 'W45-77', bodies: ['Oe', 'Te', 'et', 'tt', 'adn', 'rt', 'st', 'lt', 'j', 'H', 'B', 'nt', 'he', 'Wt', 'Ob', 'K', 'gt', 'uwe', 'ydn', 'DXe', 'dje', 'uu', 'DIe', 'pe', 'ie', '_', 'fe', 'le', 'ue', 'U', 'me', 'oe', 'X', 'I', 'ee', 'H4', 'tq', 'Zoo'], units: unitTotal },
    ],
    remaining: 'The text/link leaf group next; `Xt` Markdown waits for the ui.press/held-press pipeline (partition 4). Then the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { totals, blocks: blockTotal, units: unitTotal, sources: ledgers },
  decisiveFact:
    'The compiled site chunks create elements through `react/jsx-runtime`: children travel in `props.children` and the third argument is the key, while the Image component\'s createElement bodies pass children as trailing arguments. One factory could not serve both, so the hook seam now carries `Tc` (createElement) and `Xe` (jsx/jsxs); the three renderer plans import `Xe as e` and `Xe as r`. The host seam `./plugin-chain-code-host.ts` reads the product contexts through `_currentValue` (this runner does not install the TUI dispatcher), serves `kc` over a no-op layout subscription, answers `Mi` false because this host draws inline, and answers `rDr`/`CNo` null because the structured highlighters are gated by `CLAUDE_CODE_SYNTAX_HIGHLIGHT`, which this host does not expose — exactly the source\'s own answer when the flag is unset, so the copied renderers take their non-structured path.',
  changes: [
    {
      file: files.code,
      change: 'eight copied blocks: `Oe`, `Te`, `et`, `tt`, `adn`, `rt`, `st`, `lt` from chunk-kjfwbh4w.js',
      portSha256: sourceHashes.code,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: files.block,
      change: 'eight copied blocks: `j`, `H`, `B`, `nt`, `he`, `Wt`/`Ob`, `K`, `gt` from chunk-yfhs3yf4.js',
      portSha256: sourceHashes.block,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: files.diff,
      change: 'twenty-one copied blocks: `uwe` from chunk-3qabb19b.js; `ydn`, `DXe`, `dje` from chunk-04m6g9sr.js; `uu`, `DIe` from chunk-1r9zp6s1.js; the unified-diff renderer from chunk-nnwag7zt.js',
      portSha256: sourceHashes.diff,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: files.library,
      change: 'one copied block: the `diff` package body `Zoo`, chunk-34bv7wfw.js [615,11040)',
      portSha256: sourceHashes.library,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-code-host.ts',
      change: 'the host boundary: `kc` over a no-op layout subscription, `Ys`, `Mi`, `Tj`, `nt`, `hr`, `Qdn`, `Kl`, and the null structured highlighters `rDr`/`CNo`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-hooks.ts',
      change: '`Xe` (jsx/jsxs) beside `Tc` (createElement); `SurfaceElement` carries the jsx key',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-code.test.ts',
      change: 'twenty-four tests: the Code leaf source/diff paths and truncation, the code block gutter, the source line renderer and its language fallback, the hunk renderer and separator, the truncation helpers, the diff package, and the raw shell helpers; two more tests in the surface suite pin the two element factories',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-77-tsc.txt', 'utf8')) },
    undeclaredScan: {
      'src/plugin-chain-code-source.ts': 'declared 47, unresolved 0',
      'src/plugin-chain-code-block-source.ts': 'declared 88, unresolved 0',
      'src/plugin-chain-code-diff-source.ts': 'declared 76, unresolved 0',
      'src/plugin-chain-diff-source.ts': 'declared 55, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '24/24 new plus 2 element-factory tests; chain family 594/594; full 1,870/1,870 pass, 0 fail',
    sourceIndex: '62 chunks, 1,507/29,141 statements, 278,059/10,439,416 units (2.7%)',
    identity: '0baf2436…',
  },
  next:
    'Partition 3 continues with the text/link leaf group; `Xt` Markdown needs the ui.press/held-press pipeline and waits for partition 4. Then the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-code-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', blockTotal, 'blocks', unitTotal, 'units');
