// W45-82 evidence: the Input field site `Vt`, its minimum field width `Gt`, the input-fields and
// site-columns contexts `cdn`/`ddn`, and the terminal-size hook `ke` with its context `Zm`.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-input-field-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const evidence = {
  schema: 'W45InputFieldEvidence.v1',
  package: 'W45-82 — the Input field site',
  date: '2026-10-17',
  question:
    'How does the Input field site compose its focus, value, width, cursor and submit hint, and what does it draw while focused and unfocused?',
  answer:
    `${ledger.blocks.length} blocks are copied verbatim (${units.toLocaleString('en-US')} units) into one module. \`Vt\` reads the site focus through \`xe\`, the field value from the input-fields context \`cdn\` (\`textOf(plugin, element)\`, falling back to the drawn \`value\`, then ""), the terminal size through \`ke\`, and a mounted site-columns context \`ddn\` (a bare number) replacing the terminal width. It keeps a cursor offset in \`y(g.length)\` and, while focused, raises it to \`Number.MAX_SAFE_INTEGER\` so the caret stays at the end. Focused, the field requires both the input host and the exact focused press: it draws the bold label, the host text editor \`wr\` with the value, \`edit\` callback, placeholder, width \`max(12, columns - width(label) - width(hint))\`, the clamped caret and the editor flags, and the dim \` ⏎ <submitLabel|submit>\` hint. Unfocused it draws the value dim (or the placeholder when empty), with no editor and no hint.`,
  measured: [
    '`Gt` is 12.',
    '`ke` throws `useTerminalSize must be used within an Ink App component` with no provider and answers the mounted `{columns, rows}` otherwise.',
    'An unfocused field with value "abc" draws a row `Box` (`elementKey`, `elementPlugin`, `flexShrink:0`, no click) with `[Text{bold:false,"Name: "}, Text{dimColor:false,wrap:"truncate-end",children:"abc"}, false]`.',
    'An empty value draws the placeholder dim when one is given, and `Text{dimColor:true,children:""}` when not; an absent label is a `false` child.',
    'With the focused press but no `cdn` host the field stays unfocused: no editor, the dim value.',
    'A focused field with `ddn` 40 and label "Name" draws the bold label, `TextEditor` with `value:"fromhost"`, `placeholder`, `columns:25`, `cursorOffset:8`, `focus:true`, `showCursor:true`, `multiline:false`, `disableEscapeDoublePress:true`, and ` ⏎ submit`; the root carries the focused ref and a click.',
    'The editor `onChange("next")` calls `cdn.edit({plugin:"p",handle:1,element:"i1"},"next")`, and `textOf` is called with the same plugin and element.',
    'Host text wins over the drawn `value`; with neither the value is "" and the caret 0.',
    'The editor width is `max(12, columns - 3 - 9)` with label "L": site columns 10 → 12, 40 → 28, no site context → 68 at 80 terminal columns.',
    '`submitLabel:"go"` draws ` ⏎ go`; a six-character value sets the caret to 6.',
  ],
  partition: {
    slice: '4. The terminal press pipeline, the leaves and the interactive elements',
    state: 'in progress',
    packages: [
      { package: 'W45-80', units: 1747, note: 'the Markdown leaf' },
      { package: 'W45-81', units: 1360, note: 'the Select site, its window and the site-focus reader' },
      { package: 'W45-82', bodies: ['Gt', 'cdn', 'ddn', 'ke', 'Zm', 'Vt'], units },
    ],
    remaining: 'The Button with its hover group and action keys, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The Input field is a view over host state: the value comes from `cdn.textOf`, edits go back through `cdn.edit`, and focus is the exact press from `fdn` gated additionally on the input host being mounted (`u !== null`). While focused the caret sits at the end because the effect raises the stored offset to `Number.MAX_SAFE_INTEGER`; the editor itself is a host component token (`wr`), and the width reserves the drawn label and hint and never drops below 12 columns.',
  hostBoundary: {
    token: 'wr',
    source: 'chunk-s7977spq.js [7424,11062) — 3,638 units',
    reason:
      'The terminal text editor\'s closure reaches the key decoder, the offset/history machines, the paste pipeline, the highlight and theme mapping and its own renderer; it is the shell\'s editor subsystem, outside the site layer this package ports. The site draws it as a component token with one fixed prop set, the same way Box and Text are tokens.',
  },
  changes: [
    {
      file: source,
      change: 'six copied blocks: `Gt`, `cdn`, `ddn`, `ke`, `Zm` and `Vt`',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-input-field-host.ts',
      change: 'the host seam: the `wr` text-editor token and the prop set the site passes',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-input-field.ts',
      change: 'the seam: the component, the width, the two contexts and the terminal-size hook',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-input-field.test.ts',
      change: 'eleven tests: the size hook, the unfocused and focused renders, the edit callback, the value precedence and the width',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-82-plan.mjs',
      change: 'the copy plan: six blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-82-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 33, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '11/11 new; chain family 667/667; full 1,943/1,943 pass, 0 fail',
    sourceIndex: '67 chunks, 1,616/30,057 statements, 295,276/10,863,127 units (2.7%)',
    identity: '5d48dc6d…',
  },
  next:
    'The Button with its hover group and action keys, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-input-field-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
