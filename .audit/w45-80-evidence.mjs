// W45-80 evidence: the Markdown leaf `Xt` — its render shapes, the click guard, the delayed press
// and the selection cancel — with the clock hook `on`, the selection accessor `wC`, the link-scheme
// set and the two click timings. Records the copied blocks, the reused renderer and the host seam.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-markdown-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const evidence = {
  schema: 'W45MarkdownEvidence.v1',
  package: 'W45-80 — the Markdown leaf and its click press',
  date: '2026-10-17',
  question:
    'The Markdown leaf draws text that may hold links. When a click over one of those links runs the plugin\'s press, and when is the click left to the terminal? What does the selection have to do with it, and what does the leaf read from the host?',
  answer:
    `${ledger.blocks.length} blocks are copied verbatim (${units.toLocaleString('en-US')} units) into one module. \`Xt\` draws the text through the markdown renderer \`Ya\` with \`mdn\`'s three schemes, and when the drawing holds a press wraps it in a Box whose click handler stops the terminal's own activation only for a hyperlink the drawing declared pressable; it then subscribes to the selection, waits \`tun\` (500 ms) and runs \`TIe\` with \`{href}\` — unless a selection appeared, which cancels. A click with no link, with ctrl or alt, over an undeclared link, a window activation, or one inside \`vje\` (300 ms) of the drawing is left to the terminal. \`on\` is the clock hook (\`now\` for the window, \`setTimeout\` for the delay); \`wC\` is the selection accessor, which answers the terminal instance's readers or a fixed no-selection object when no instance is bound.`,
  measured: [
    '`mdn` holds `https`, `http`, `file`; `vje` is 300 and `tun` is 500.',
    '`on()` outside a render throws the source sentence `useClock must be used within a ClockProvider`; with `eE` mounted through the hook seam\'s `contexts` map it answers the mounted clock.',
    '`wC()` with no instance answers `copySelection:""`, `copySelectionNoClear:""`, `getSelectedText:""`, `getState:null`, `hasSelection:false`, a no-op `subscribe`, a no-op `moveFocus` and a no-op `setSelectionBgColor`.',
    '`wC()` with an instance bound under `process.stdout` delegates to it, and after the unbind the map is empty again.',
    '`Xt({text:"plain"})` answers the renderer element with `children:"plain"`, `stripPromptTags:false` and `linkSchemes` the `mdn` set; adding `elementKey` wraps it in a Box with `flexDirection:"column"` and the key.',
    '`Xt` with a press wraps the renderer in a Box with `elementPlugin`, the key and an `onClick`.',
    'A click with no hyperlink, with `mods.ctrl`, with `mods.alt` or over a link the drawing did not declare calls `allowDefault` and schedules nothing.',
    'A window activation, and a click less than 300 ms after the drawing, call `dropAsStray` and schedule nothing.',
    'A declared link clicked 500 ms after the drawing calls `stopImmediatePropagation`, subscribes once and schedules one 500 ms timer; the timer runs the module press with the handle the drawing held and `{plugin, element, component, requestId, surface:"terminal", link:{href}}`.',
    'A selection appearing while the timer waits unsubscribes, calls the timer\'s cancel token and presses nothing; clicking again cancels the previous pending timer the same way.',
  ],
  partition: {
    slice: '4. The terminal press pipeline and the leaves',
    state: 'leaves complete',
    packages: [
      { package: 'W45-77', units: 24196, note: 'the Code leaf and the code block and diff renderers' },
      { package: 'W45-78', units: 8476, note: 'the held-press store and the input/select dispatch' },
      { package: 'W45-79', units: 4897, note: 'the ui.press dispatch and the link normalizer' },
      { package: 'W45-80', bodies: ['vje', 'tun', 'mdn', 'Xt', 'on', 'wC'], units },
    ],
    remaining: 'All nine leaf types are ported. The Client host and the site-tree walker `je` with the terminal glue remain in partition 4; after that the C packages (Magpie startup, MCP lifecycle, sessions, workflow engine and the rest).',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The leaf presses a link only under a hyperlink the drawing itself declared pressable: the guard `nur` runs before anything is stopped, the press waits `tun` (500 ms) while a selection subscription is live, and a selection appearing during the wait cancels both the subscription and the timer — so a click that turns into a text selection never presses. The 300 ms window after the drawing drops a click as a stray window activation. The renderer `Ya` is not copied again: this product already carries the same recovered body in `tui-markdown-components.ts`, so the seam re-exports it; the two contexts and the selection map are the host boundary in `plugin-chain-markdown-host.ts`.',
  changes: [
    {
      file: source,
      change: 'five copied blocks: `vje`/`tun` from chunk-06azbynj.js; `mdn` and `Xt` from chunk-kjfwbh4w.js; `on` and `wC` from chunk-1r9zp6s1.js',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-markdown-host.ts',
      change: 'the host bindings: the clock context `eE`, the selection context `Gfe`, the instance map `oi` with its bind/unbind, and the system clock',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-markdown.ts',
      change: 'the seam: the leaf and its constants, re-exported under the names a caller reads them by',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-markdown.test.ts',
      change: 'fourteen tests: the constants, the clock hook, the selection accessor, the three render shapes, and the five click paths',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-80-plan.mjs',
      change: 'the copy plan: five blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-80-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 37, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '14/14 new; chain family 644/644; full 1,920/1,920 pass, 0 fail',
    sourceIndex: '65 chunks, 1,601/29,974 statements, 292,924/10,849,097 units (2.7%)',
    identity: 'da9ff72e…',
  },
  next:
    'The nine leaf types are complete. The Client host and the site-tree walker `je` with the terminal glue remain, then the C packages.',
};

fs.writeFileSync('research/ports/W45-markdown-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
