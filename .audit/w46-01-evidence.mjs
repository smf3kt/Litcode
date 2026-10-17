// W46-01 evidence: the recovered scope-picker frame and row list, the limits and labels, and the
// host seams the product's terminal runtime supplies.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/tui-scope-picker-frame-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));
const hostHash = sha(fs.readFileSync('src/tui-scope-picker-frame-host.ts', 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module.',
  '`gLt` is the frame: it keeps the focus and window in one state slot, clamps the visible count to `max(2, min(visibleCount, rows - 10 - matchLabel))`, and slices the items to the window.',
  'The search hook supplies the query and cursor; the frame handles up/down (and ctrl+p/n), pageup/pagedown by the visible count, return to select the focused item, and tab to the tab action or select fallback, then passes every other key to the search hook.',
  'A query change reports the query, resets focus and window, and clears the hovered row; an item change clamps the focus and window; a reset key clears both.',
  'The preview sits right of the rows when its position is right and below them otherwise; on a terminal under 120 columns the enter hint collapses to the first word of the select action.',
  '`Vse` draws the row list: the empty state block, one clickable row per visible item with focus, cursor declaration and the scroll markers by direction, a stray-click guard, hover reporting, and a mouse-leave reset.',
  '`ad` is the clamp, `pHe` the first word of an action, `fo` the empty-state block with an optional hint, and `FLt` the no-op reset.',
].join(' ');

const evidence = {
  schema: 'W46ScopePickerFrameEvidence.v1',
  package: 'W46-01 — the scope-picker frame',
  date: '2026-10-17',
  question:
    'How does the recovered scope picker lay out and move — which rows are visible, how do the keys and the wheel move the focus and window, and what does the row list own?',
  answer,
  measured: [
    'Defaults: visible count 8, chrome 10, minimum 2, `FLt` answers undefined; `pHe("select item")` is "select" and `pHe("")` is "".',
    '`ad(-3,0,5)` is 0, `ad(9,0,5)` is 5, `ad(2,0,5)` is 2, and an omitted bound leaves the index alone.',
    'A 30-row frame with rows 30 and columns 200 shows `k0`..`k7`, height 9 (8 rows + match label), a row layout with gap 2, and the preview in the right column.',
    'Down moves focus 0→1→2→3; pageup clamps to 0; pagedown moves to 8 and the window to 1; return selects `k8`; a second down moves to 9, the window to 2; tab reports `k9`.',
    'The wheel moves the window by one and stops the event; a zero delta does neither. With direction up the wheel sign flips.',
    'The frame with a 12-row terminal clamps the visible count to 2; with rows 10 and a match label it also clamps to 2.',
    'A 100-column frame labels the movement hint "nav" and the select hint "select" for the action "select item".',
    'Typing "a" yields query "a" and reports "", "a"; backspace on "abc" yields "ab" at offset 2; home+delete yields "bc" at 0; left+backspace yields "ac" at 1; end+typing appends; paste inserts at the cursor.',
    'A query change resets the focus and window to 0: focus 3 becomes 0 on the next pass.',
    'The row list over 4 of 30 items starting at 2 marks the first row with scroll-up and the last with scroll-down, focuses index 3, and reverses the list and the markers for direction up.',
    'The first click within 300ms is dropped as stray; a click after the guard reports its item; hover true reports the item, hover false and the container leave report nothing.',
    'The declare-cursor context reaches every row; the empty list draws the empty-state block inside a fixed-height box.',
    '`fo` without a hint is one dim Text; with a hint it is a column of the text and the hint.',
  ],
  partition: {
    slice: 'C-2a. Scoped history selector',
    state: 'in-progress',
    landed: {
      package: 'W46-01',
      bodies: ['FLt', 'TBe', 'MBe', 'DBe', 'gLt', 'Vse', 'pHe', 'ad', 'fo'],
      units,
    },
    remaining:
      'Wire the product picker to the recovered frame: replace the replacement frame in src/tui-scope-picker-source.ts with gLt, confirm the terminal-size and render contexts, and rerun the picker entry tests. The fourth mount form already renders the host component; the missing piece was this frame body.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The frame keeps one state slot for focus and window and derives the visible slice from it; every movement is a clamped index change that shifts the window only when the focus leaves it. The row list owns no state: it draws the slice it is given, reports clicks and hover, and guards the first 300ms after mount so a window activation cannot select a row.',
  hostBoundary: {
    surfaces: ['ke', 'Qc', 'nt', '_y', 'aS', 'z', 'Se', 'es', 'rS', '_C'],
    reason:
      'The terminal runtime owns the terminal size (`ke`), the focus and cursor-declaration contexts (`Qc`, `nt`), the search input state (`_y`), the stray-click guard (`aS`) and the visual primitives (`z`, `Se`, `es`, `rS`, `_C`). The frame and the row list are copied verbatim; the host module supplies those seams and keeps the search hook injectable.',
  },
  hostCorrection: {
    symbol: 'y',
    reason:
      'The recovered frame calls the state setter with an updater function (`Vo((state) => ...)`); the hook seam assigned the function itself as the state, so every moved state read undefined. The setter now follows React semantics: a function argument is the updater and receives the previous value.',
    file: 'src/plugin-chain-react-hooks.ts',
  },
  changes: [
    {
      file: source,
      change: 'six copied blocks: the frame, the row list, the limits and reset stub, the chord label, the clamp and the empty-state block',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-frame-host.ts',
      change: 'the host seam: the search input hook, the terminal-focus and declare-cursor contexts, the stray-click guard and the visual tokens',
      portSha256: hostHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-frame.ts',
      change: 'the public seam: the source names plus the frame, row, chord, clamp and empty-state aliases',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-hooks.ts',
      change: 'the state setter takes the functional updater form the recovered frame uses',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/tui-scope-picker-frame.test.ts',
      change: 'twenty-five tests: the limits and labels, the layout, the movement, the search input, the row list and the hook seam',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w46-01-plan.mjs',
      change: 'the copy plan: six blocks',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w46-01-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 145, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '25/25 new; chain family 767/767; full 2,068/2,068 pass, 0 fail',
    sourceIndex: '75 chunks, 1,743/30,144 statements, 323,525/10,879,881 units (3.0%)',
    identity: 'ea5a3a687dc7…',
  },
  next: 'C-2a integration: mount the recovered frame in the product picker, then rerun picker-entry and scope-picker tests in both terminal modes.',
};

fs.writeFileSync('research/ports/W46-scope-picker-frame-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
