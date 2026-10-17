// W46-03 evidence: the recovered frame becomes the ScopedPicker frame in both terminal hosts, with
// the frame owning focus/window and the picker mirroring it through onFocus.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const raw = (path) => sha(fs.readFileSync(path, 'utf8'));
const log = (path) => sha(fs.readFileSync(path, 'utf8'));

const evidence = {
  schema: 'W46ScopePickerIntegrationEvidence.v1',
  package: 'W46-03 — the recovered frame becomes the scoped picker frame',
  date: '2026-10-17',
  question:
    'The W46-02 frame was mounted only in the test-facing ScopePicker; can the frame be the ScopedPicker frame that both terminal hosts actually use, without losing the source key semantics?',
  answer:
    'Yes. ScopedPicker renders the recovered gLt/Vse element through its persistent document tree and projects the rows to text and ANSI for the TUI and line painters. The frame owns focus and window state. The frame has no focus manager, so the host captures the search field\'s onKeyDown during render and the picker dispatches the frame\'s own key events; onFocus reports the focused row back, so the picker cursor and the drawn selection are one state. The host element key includes the scope and query, which remounts the component on a query change, the host-tree equivalent of the source query handler resetting focus and window. A fresh item slice per render is required because the frame memo compares items by identity while the scan mutates its row array in place.',
  measured: [
    'The probe (`.audit/w46-03-probe.ts`, output `.audit/w46-03-probe.txt`) drove a persistent tree with a captured key handler: direction up draws `row 3`/`row 2`/`row 1`/`row 0` bottom-anchored with `>>` on the focus, the hint row reads `↕ Enter select Esc cancel Ctrl+S scope`, pageup/pagedown move by the visible count and clamp, and a resetKey/remount change restores focus to the first row.',
    'The live TUI at 40x10 shows the frame with a two-row window (rows - 10, at least two), the `^` scroll marker above the focus, the title, the search line and the hint row; the focused line carries `>`.',
    'The real-CLI smoke `--search-chain` walks the frame focus (visibility alone is not focus, because the window shows the row above), accepts the folded paste row with tab, appends a 3-line paste, and submits the rebased payload. The run also covers scope cycling, case-insensitive filtering, no-match enter swallowing, cancel restoring the draft, and the cross-process restart: exit 0, 6 model calls, pending search exit 130.',
    'test/picker-entry.test.ts exercises both terminal modes against the real frame: the hint row, the draft-seeded query and caret, session/project scopes, movement revealing the older earlier-session row, filtering, accept-without-submit and cancel keeping the accepted row.',
    'test/tui-scope-picker-frame-scoped.test.ts pins the integration: bottom-anchored layout and hint, onFocus cursor sync, query reset, clamping and paging by the visible count, the empty state, and accepting the focused row.',
  ],
  changes: [
    {
      file: 'src/tui-scope-picker.ts',
      change: 'ScopedPicker renders the recovered frame: per-render item slice, frame size and search hook injection, the remount key from scope and query, onFocus cursor sync, clamped movement and page, frame()/styled() projections and the close-time hook reset',
      portSha256: raw('src/tui-scope-picker.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-source.ts',
      change: 'the consumer props builder is hoisted to module scope so the picker can call it with its own adapters; the source constants move with it',
      portSha256: raw('src/tui-scope-picker-source.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui-scope-picker-frame-tui-host.ts',
      change: 'the search field captures the frame key handler during render; dispatchFrameKey lets the picker drive movement without a focus manager',
      portSha256: raw('src/tui-scope-picker-frame-tui-host.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/tui.ts',
      change: 'the picker keys follow the source direction-up mapping: up is focus+1, down is focus-1, and pageup/pagedown use the frame visible count',
      portSha256: raw('src/tui.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/terminal.ts',
      change: 'the same direction-up key mapping and paging in line mode',
      portSha256: raw('src/terminal.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/picker-entry.test.ts',
      change: 'expectations move to the recovered frame: hint labels, the draft-seeded search line, and the two-row window with movement revealing the older row',
      portSha256: raw('test/picker-entry.test.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/tui-scope-picker-frame-scoped.test.ts',
      change: 'five integration tests: layout and hints, onFocus sync and query reset, clamping and paging, the empty state, and accept',
      portSha256: raw('test/tui-scope-picker-frame-scoped.test.ts'),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'scripts/smoke-input-history.mjs',
      change: 'openPicker waits for the cleared query, and walkTo walks the frame focus instead of accepting a merely visible row',
      portSha256: raw('scripts/smoke-input-history.mjs'),
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, logSha256: log('.audit/w46-03-tsc.txt') },
    undeclaredScan: {
      'src/tui-scope-picker-source.ts': 'declared 105, unresolved 0',
      'src/tui-scope-picker-frame-tui-source.ts': 'declared 145, unresolved 0',
    },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: 'new frame-scoped 5/5; picker entry 2/2; chain family 767/767; full 2,078/2,078 pass, 0 fail',
    smoke: 'scripts/smoke-input-history.mjs --search-chain exit 0 in TUI and --line modes; 6 model calls; pending search exit 130',
    build: 'npm run build exits 0',
    sourceIndex: '75 chunks, 1,743/30,144 statements, 323,525/10,879,881 units (3.0%)',
    identity: 'e8177e8408bf91fb02b234ad90151021f4652372b9cc2e539d655e6835544fe5',
  },
  next: 'C-2a is the delivered frame in both hosts. The remaining C items are C-3 (MCP lifecycle) and the later C rows.',
};

fs.writeFileSync('research/ports/W46-scope-picker-integration-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written');
