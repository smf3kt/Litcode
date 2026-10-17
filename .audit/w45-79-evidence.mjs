// W45-79 evidence: the ui.press path — the link normalizer (`mxn`/`Rf`), the pressable-link guard
// (`nur`), the argument (`E_`), the dispatch (`BPn`), the terminal entry (`TIe`) and the settle
// wrapper (`Ohe`). Records the copied blocks, the cwd boundary, and the measured behaviour.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const files = {
  url: 'src/plugin-chain-press-url-source.ts',
  dispatch: 'src/plugin-chain-press-dispatch-source.ts',
};
const ledgers = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, readJson(path.replace(/\.ts$/, '-blocks.json'))]));
const totals = Object.fromEntries(Object.entries(ledgers).map(([name, ledger]) => [
  name,
  { blocks: ledger.blocks.length, units: ledger.blocks.reduce((sum, block) => sum + block.units, 0) },
]));
const unitTotal = Object.values(totals).reduce((sum, item) => sum + item.units, 0);
const blockTotal = Object.values(totals).reduce((sum, item) => sum + item.blocks, 0);
const sourceHashes = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, sha(fs.readFileSync(path, 'utf8'))]));
const empty = Object.entries(ledgers).flatMap(([name, ledger]) => ledger.blocks.filter((block) => block.units === 0).map((block) => `${name}:${block.range}`));
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);

const evidence = {
  schema: 'W45PressDispatchEvidence.v1',
  package: 'W45-79 — React layer partition 4: the ui.press dispatch and the link normalizer',
  date: '2026-10-17',
  question:
    'How does a held press become a ui.press dispatch? The terminal entry names a plugin and handle; the dispatch must find the held press, refuse a link the drawing did not declare, build the argument and run the plugin. What does the link comparison consider equal, and what does a miss answer?',
  answer:
    `${blockTotal} blocks are copied verbatim (${unitTotal.toLocaleString('en-US')} units) into two modules. The dispatch module carries \`Rf\` (normalize an href), \`nur\` (whether a link is one the drawing declared pressable), \`E_\` (the argument), \`Tf\` (the ui.press site), \`BPn\` (the dispatch), \`TIe\` (pressFromTerminal) and \`Ohe\` (settle quietly, logging a rejection). The URL module carries \`mxn\` and \`An\`/\`IF\` with the path-safety bodies they read: the UNC and extended-length tests \`Bn\`/\`zN\`/\`zt\`/\`Xt\`/\`lA\`, the posix danger parser \`tl\`/\`QPe\`/\`qa\`/\`GS\`/\`qO\`/\`Mt\`/\`C\`/\`YR\`/\`Lt\`/\`_m\`/\`fa\`/\`qP\`/\`aw\`, the traversal checks \`Cot\`/\`Yoo\`/\`vfr\`/\`Xoo\`/\`s\`/\`Koo\`/\`l\`, the patterns \`u\`/\`i\`/\`f\`/\`c\`/\`uG\`, and the parse cache \`Bt\`/\`Gt\`/\`I\`/\`k\`. \`BPn\` looks the press up by plugin, handle and optional element; a link names a Markdown press, and its normalized form must equal one of the drawing's \`pressableLinks\`; the argument goes through \`aP\` with the module press \`Yl\` under the ui.press site. \`TIe\` starts that dispatch without waiting and hands the promise to \`Ohe\`, which logs a rejection instead of letting it escape.`,
  measured: [
    '`Rf` answers `https://example.com/a` unchanged, `http://www.example.com/x` for `www.example.com/x`, `../x` for a relative href, `//server/share/x` for a UNC href, `file:///tmp/a%20b` for `/tmp/a b`, and `file:///tmp/x` for `file:///tmp/x`.',
    '`mxn` keeps the query and fragment (`/tmp/x?q=1#f` → `file:///tmp/x?q=1#f`), strips a localhost file host (`file://localhost/tmp/x` → `file:///tmp/x`), answers `file:///` for `/` and `""` for `""`.',
    '`mxn` resolves its input before the traversal checks, so a dot-dot path collapses rather than being refused: `/tmp/../etc/passwd` → `file:///etc/passwd` and `file:///tmp/%2e%2e/etc` → `file:///etc`.',
    '`Cot("../etc")`, `Cot("a/../b")` and `Yoo("file:///tmp/../x")` all answer false: the plain dot-dot path is not what those checks flag.',
    '`nur` answers true when the drawing declared no links; it accepts `https://example.com` against `https://example.com/`, `/tmp/a%20b` against `file:///tmp/a b`, and `file:///tmp/../etc` against `file:///etc`; it refuses `https://y` and `www.example.com/a` as differently normalized.',
    '`BPn` on a held Button runs the module press with the handle the drawing held and the argument `{plugin, element, component, requestId, surface}`; it answers `{element:"b1"}` and logs the settle line. A handle the store does not hold answers undefined and runs nothing — `BPn` has no full-key fallback. The log names the key only when the dispatch gave a non-empty element: `... held under handle -1 and the key the press names; nothing ran` versus `... held under handle -1; nothing ran`.',
    'A Markdown press runs when the link normalizes to a declared `pressableLinks` entry: `https://example.com/a` and `/tmp/a%20b` both pass against `["https://example.com/a", "/tmp/a b"]`, and the argument carries `link: {href}`. `https://y` answers undefined, runs nothing, and logs `ui.press: the Markdown <plugin> holds under handle <h> names that link none of its own; nothing ran`.',
    'A Markdown press dispatched with no link expects a Button and answers undefined (`no Button ... held`), running nothing.',
    '`BPn` for a held press whose plugin is not loaded rejects with `ui.press: <plugin>, which drew <element>, is not loaded`.',
    '`TIe` answers undefined immediately and the dispatch lands after it: a held Button runs the module press with the drawn handle and the same argument; a held press of an unloaded plugin logs `ui.press <plugin>: ui.press: <plugin>, which drew <element>, is not loaded` at error level through `Ohe`.',
    '`Ohe` passes a resolved value through (7 answers 7 with no record) and turns a rejection into `{"kind":"log","level":"error","message":"<label>: <message>"}` while answering undefined.',
    '`E_` answers `{plugin, element, component, requestId, surface}` and adds `link: {href}` when one is given.',
  ],
  partition: {
    slice: '4. The terminal press pipeline',
    state: 'in progress',
    packages: [
      { package: 'W45-78', units: 8476, note: 'the held-press store, the drawing walkers and the input/select dispatch' },
      { package: 'W45-79', bodies: ['Rf', 'nur', 'E_', 'Tf', 'BPn', 'TIe', 'Ohe', 'mxn', 'An', 'IF', 'Bn', 'zN', 'zt', 'Xt', 'lA', 'tl', 'fa', 'qP', 'aw', 'QPe', 'qa', 'GS', 'qO', 'Mt', 'C', 'YR', 'Lt', '_m', 'Bt', 'Gt', 'I', 'k', 'vfr', 'Cot', 'Yoo', 'Xoo', 's', 'Koo', 'l', 'c', 'f', 'i', 'u', 'uG'], units: unitTotal },
    ],
    remaining: 'The pipeline is complete with W45-79; W45-80 copies `Xt` Markdown, the last leaf. Then the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { totals, blocks: blockTotal, units: unitTotal, sources: ledgers },
  decisiveFact:
    '`BPn` and `Xl` are deliberately different lookups: `Xl` falls back to `AK.heldByKeyOf` when the handle misses, while `BPn` only calls `AK.heldPress(plugin, handle, element)` and answers a logged miss otherwise, so the terminal press depends on the handle alone. The link comparison is normalisation, not canonicalisation: `Rf` sends an href through `mxn`, which resolves a local path against `se()` *before* `IF` runs the traversal checks — so a dot-dot path collapses to its resolved target instead of being refused, and `Cot`/`Yoo` only flag the encoded and UNC shapes the posix parser reports, not a plain relative `..`. The one host boundary is `se()`: the source reads the session store cwd and falls back to the runtime cwd; this product has one process cwd, which is that fallback.',
  changes: [
    {
      file: files.url,
      change: 'thirty-three copied blocks: `IF`, `mxn`, `An` from chunk-j8hqhz0c.js; the UNC, posix-danger and parse-cache bodies from chunk-ae84tp6z.js; the traversal and percent-decoding bodies from chunk-d1ctn2b7.js; `uG` from chunk-ax7r0qj7.js',
      portSha256: sourceHashes.url,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: files.dispatch,
      change: 'seven copied blocks: `Rf`, `nur`, `E_`, `Tf`, `BPn` from chunk-n3ykh62m.js; `TIe` from chunk-kjfwbh4w.js; `Ohe` from chunk-sfn1dbxq.js',
      portSha256: sourceHashes.dispatch,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press-url-host.ts',
      change: 'the environment bindings: the path module and its `isAbsolute`/`resolve`/`posix`, `pathToFileURL`, and `se()` answering the process cwd (the source\'s fallback when no session cwd is installed)',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-press-dispatch.test.ts',
      change: 'sixteen tests: the normalizer and traversal answers, the pressable-link guard, the dispatch and its refusals and logs, the terminal entry, and the settle wrapper',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-79-plan-url.mjs, .audit/w45-79-plan-dispatch.mjs',
      change: 'the copy plans: 33 URL blocks and 7 dispatch blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-79-tsc.txt', 'utf8')) },
    undeclaredScan: {
      [files.url]: 'declared 52, unresolved 0',
      [files.dispatch]: 'declared 29, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '16/16 new; chain family 630/630; full 1,906/1,906 pass, 0 fail',
    sourceIndex: '64 chunks, 1,596/29,408 statements, 291,177/10,488,809 units (2.8%)',
    identity: '485a5dd1…',
  },
  next:
    'W45-80 copies `Xt` Markdown, the last leaf: it reads the drawn text, dims by context, and turns a Markdown link into a `TIe` press when the surface presses it. After that the partition leaves are done and the Client host and the site-tree walker `je` with the terminal glue remain.',
};

fs.writeFileSync('research/ports/W45-press-dispatch-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', blockTotal, 'blocks', unitTotal, 'units');
