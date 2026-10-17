// W46-02 evidence: the W46-01 frame bound to the product TUI runtime and mounted by the scoped
// picker, with the host seams the document renderer requires.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/tui-scope-picker-frame-tui-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));
const hostHash = sha(fs.readFileSync('src/tui-scope-picker-frame-tui-host.ts', 'utf8'));
const pickerHash = sha(fs.readFileSync('src/tui-scope-picker-source.ts', 'utf8'));

const evidence = {
  schema: 'W46ScopePickerTuiEvidence.v1',
  package: 'W46-02 — the scope-picker frame mounted in the product TUI',
  date: '2026-10-17',
  question:
    'Can the recovered frame render inside the product document tree, and what does the host have to supply so the picker shows the source layout?',
  answer:
    'Yes. The same six source blocks are generated a second time against the TUI runtime: the document renderer supplies the hooks, Box and Text; a host module supplies the memo cache, terminal size, focus and cursor contexts, the search hook and the visual primitives. The scoped picker calls the frame from its host component, so the frame hooks live in the document tree and the picker projects the rendered rows to text. The document tree has no focus manager, so interaction props are dropped at the host element boundary and the picker keeps routing keys itself.',
  measured: [
    'The generated frame renders: title, two visible rows in direction-up order, the focused marker, the search line and the hint row. At 60x12 the hints read `Up/Down nav  Enter select  Esc cancel  Ctrl+S scope`.',
    'At 40 columns the hint row is clipped after the escape hint, so the movement hint collapses to `↕` and the row fits the scope hint within 40 cells.',
    'The preview height follows the row budget (`min(8, rows - 5)`), so a ten-row projection keeps the hint row visible instead of letting the bordered preview push it off.',
    'The host search hook controls the search line: an injected `query` renders in place of the placeholder.',
    'The scoped picker test renders the frame through `pick()`/`frame()` at 40x10: the title, the rows, `Enter select` and `Ctrl+S scope` all appear, and the empty query keeps the picker open.',
    'The focus-manager guard fired on interaction props (`onMouseLeave`, `onWheel`, `onClick`) because the document renderer has no focus manager; the host element wrappers drop those props and the render is clean.',
  ],
  hostBoundary: {
    surfaces: ['s', 'n', 'w', 'b', 'ke', 'Qc', 'nt', '_y', 'aS', 'z', 'Se', 'es', 'rS', '_C'],
    reason:
      'The product TUI runtime owns hooks and elements; the document renderer has no focus manager, so the host draws Box/Text without interaction props and the picker routes keys and clicks itself. The search hook is injected per render from the picker query, the terminal size from the picker budget, and the memo cache is one `useMemo` slot per call site with the React sentinel.',
  },
  changes: [
    {
      file: source,
      change: 'the same six copied blocks, generated against the TUI runtime and the TUI host seam',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-frame-tui-host.ts',
      change: 'the TUI host seam: memo cache, terminal size, focus and cursor contexts, search hook, stray-click guard and the Box/Text-backed visual primitives',
      portSha256: hostHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-source.ts',
      change: 'the replacement frame is gone: the picker props call the recovered frame, the query seeds it, and the scope hint and select label follow the source consumer',
      portSha256: pickerHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker.ts',
      change: 'the picker sets the frame size and search state before the host render mounts the frame',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/tui-scope-picker-frame-tui.test.ts',
      change: 'five tests: layout, row order, empty state, injected query and the ten-row projection',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w46-02-tsc.txt', 'utf8')) },
    undeclaredScan: {
      [source]: 'declared 145, unresolved 0',
      'src/tui-scope-picker-source.ts': 'declared 98, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '5/5 new; scope-picker 2/2; chain family 767/767; full 2,073/2,073 pass, 0 fail',
    sourceIndex: '75 chunks, 1,743/30,144 statements, 323,525/10,879,881 units (3.0%)',
    identity: '6e8c48dfaf30…',
  },
  next: 'C-2a is mounted: the recovered frame is the picker frame in both the TUI and text projections; keyboard routing stays with the picker.',
};

fs.writeFileSync('research/ports/W46-scope-picker-tui-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
