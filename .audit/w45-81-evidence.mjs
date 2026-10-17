// W45-81 evidence: the Select site component `sr`, the option window `S3n`, the site-focus reader
// `xe` and the click adapter `udn`, with the four contexts they read.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-select-field-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const evidence = {
  schema: 'W45SelectFieldEvidence.v1',
  package: 'W45-81 — the Select site component and the site-focus reader',
  date: '2026-10-17',
  question:
    'How does the Select site draw its options and move the window, and how does a site learn that it holds keyboard focus, bind a ref and dispatch a click?',
  answer:
    `${ledger.blocks.length} blocks are copied verbatim (${units.toLocaleString('en-US')} units) into one module. \`sr\` draws the label, the picked option from the select-fields context \`gdn\` (falling back to the drawn value, and "none" when neither names one) and the ▾/▴ marker, then the visible options from \`S3n\`: with \`ht\` (8) rows, the first index keeps the open highlight inside the window, and a \`… N more\` row appears when options are cut. \`xe\` answers the focus flag only when the focused-press context names this plugin and handle, binds the focused-node ref only then, and always gives the click adapter \`udn\` the clicked-press handler: a hyperlink is left to the terminal, and the handler runs unless the event is a window activation or a dropped stray.`,
  measured: [
    '`S3n` with no options answers `{first:0,size:0,hidden:0,rows:0}`; three options answer `{first:0,size:3,hidden:0,rows:3}`; ten at 0 or 5 answer `{first:0,size:8,hidden:2,rows:9}`; ten at 9 answers `{first:2,size:8,hidden:0,rows:8}`.',
    '`udn` runs a plain click; over a hyperlink it calls `allowDefault` and still runs; a window activation and a dropped stray do not run, and a window activation with a hyperlink still calls `allowDefault`.',
    '`xe` without providers answers `hasKeyboardFocus:false`, `ref:undefined` and `onClick:undefined`.',
    '`xe` with the focused-press context naming its press answers `hasKeyboardFocus:true`, the focused-node ref, and a click that hands `{plugin,handle}` to the clicked-press handler; a different handle answers no focus and no ref but still carries the click.',
    'A closed Select draws a column Box with `elementKey`, `elementPlugin` and one header row: the `label + ": "` part (or empty), "none" when nothing is picked, and " ▾".',
    'A picked value draws its label when it has one and its value otherwise.',
    'An open Select (the context\'s `open` naming this plugin and handle) draws " ▴" and one `  <label>` row per visible option.',
    'Ten options with the highlight at 0 draw rows `  L0`…`  L7` and `  … 2 more`; with the highlight at 9 the window starts at `  L2` and ends at `  L9`.',
    'An `open` naming another press leaves the Select closed.',
  ],
  partition: {
    slice: '4. The terminal press pipeline, the leaves and the interactive elements',
    state: 'in progress',
    packages: [
      { package: 'W45-80', units: 1747, note: 'the Markdown leaf' },
      { package: 'W45-81', bodies: ['ht', 'S3n', 'gdn', 'fdn', 'pdn', 'ldn', 'udn', 'xe', 'sr'], units },
    ],
    remaining: 'The Button with its hover group and action keys, the Input field, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The Select component is pure over its contexts: the picked value and the open highlight come from `gdn`, and the component never mutates them — a click is the host\'s clicked-press handler, run through `udn`, which suppresses a window activation or a dropped stray and leaves a hyperlink to the terminal. The focus reader is gated on the exact press: the ref is bound only while `fdn` names this plugin and handle, and the window `S3n` always keeps the open highlight inside the eight visible rows.',
  changes: [
    {
      file: source,
      change: 'nine copied blocks from chunk-kjfwbh4w.js: the four contexts, `udn`, `xe`, `ht`, `S3n` and `sr`',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-select-field.ts',
      change: 'the seam: the component, the window, the focus reader, the click adapter and the contexts under their source names',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-select-field.test.ts',
      change: 'twelve tests: the option window, the click adapter, the focus reader and the Select render',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-81-plan.mjs',
      change: 'the copy plan: nine blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-81-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 34, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '12/12 new; chain family 656/656; full 1,932/1,932 pass, 0 fail',
    sourceIndex: '65 chunks, 1,610/29,974 statements, 294,284/10,849,097 units (2.7%)',
    identity: 'e367fd4d…',
  },
  next:
    'The Button with its hover group and action keys, the Input field, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-select-field-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
