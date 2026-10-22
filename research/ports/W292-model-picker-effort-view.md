# W292 model picker effort view

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: standalone /model, live model chord, and Config's model child.
- Outcome: source-colored effort glyph, dim level/default text, subtle arrow chord, and gated max warning.
- Shape: existing modal-owned effort state returns styled source elements rather than plain strings.
- Method: copy Z0/z$ and glyph declarators with erased TypeScript annotations; adapt uBe's effort subtree.
- Targets: model-picker-effort-source.ts, model-picker.ts, tui.ts, existing regression and CLI drivers.
- CLI: actual model chooser, effort steps, max reminder off/on, empty list, cancel/draft and settings/request preservation.
- Done: source/AST comparison, related checks, check/build, compiled CLI, independent review, evidence and local commit.
- Constraints: no catalog/capability/account/bootstrap network; original recovered entrypoints remain inert.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All coordinates are zero-based UTF-16 code units, half-open. Each module digest matches manifest.

| Module | SHA-256 | Source ranges |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | uBe [617998,624627), effort subtree [622928,623491), Z0 [624680,624931), z$ [153407,153563) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | Xxs/Enn/Ivo/Jxs/Qxs declarators [65823,65887), ay [66012,66023), V$ [29967,30083) |
| chunk-0qkpwgr4.js | 470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6 | copied chord closure [904,4862), z [3890,4537), P [4736,4861) |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | fde [4151,4235) |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | reminder env field [61530,61568), MU triBool [62378,62392), TPe [68428,68762) |
| chunk-phz47asr.js | 3d37bfa1a457f1e45fa115ea9002376a2549517043763e9cdb0d29e09e8d967d | triBool parser s [893,947) and M [1032,1168) |
| chunk-fdxhcr6b.js | 3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b | Ne [615,757), Es [757,908) |

Z0 reads the already owned React memo cache, n text component, and z$ glyph switch. Glyph
constants are copied declarators assembled under one var declaration. Type annotations erase;
no new type suppression is needed. Z0 supplies an explicit undefined JSX key because the
owned jsx function requires three arguments; the source verifier removes only that inert argument.
The existing ChordHint wrapper uses the plugin SurfaceElement runtime, so it is not a native
renderer element. Reuse the same closure's pure JD [4537,4685) via formatActionHint and put
its string under native n. Its native output is `←/→ to adjust`.

uBe renders effort only for a focused enabled row. Local options contain no disabled entries;
no focused option therefore returns no footer rows. All local effort levels retain W212's
capability adaptation and DEFAULT_EFFORT=high. The max note is always present at max; fde only
selects warning color with ay versus subtle color without an icon.

The source environment triBool accepts 1/true/yes/on and 0/false/no/off, case-insensitive and
trimmed. Unknown/unset falls through to a remote feature flag whose default is false. The host
uses the neutral LITCODE_MAX_EFFORT_REMINDER key and the false fallback; it introduces no remote
flag reader. With that fixed fallback, the copied Ne predicate gives the same boolean result.
Source warning icon ay is the literal U+26A0, independent of platform symbol substitutions.

Existing implicit/adjusted state, accept/save/hook flow and modal lifetime are reused. Rendering
creates no new subscriptions or timers. Theme re-render and terminal resize use the same owner.
The plain text footer consumer in TuiTerminal and existing text assertions/CLI driver all migrate
in the same package. Required arrow wording is compared to the copied chord formatter.

## Throughput and remaining candidates

The lead owns the coupled product/fixture chain. One independent read-only reader established
that custom spinner Tips and Show tips have a local path, correcting the old blanket exclusion.
That larger content/settings/selection/lifetime package is queued after W292. A bounded independent
correctness/comment review follows this implementation. The critical path is source subtree,
real rendered cells, compiled CLI, review, evidence and commit.

## Comparison and validation

The copied glyph declarators, Z0, z$ and Ne match the source AST after TypeScript erasure and
removing only the inert third JSX argument. The existing chord closure also matches its source.
The adapted footer has a character-level comparison to [622928,623491). Source subtree SHA-256
is ee7bde80c1458bb50228996d317f52c6db809b53db29046735637152ca56bcdc;
target method [12974,13784) SHA-256 is 8cdfb63e3325e20fdc4a41680b544c9cf69094bf13a277b2787e965b4cb7a0b6.
The 2106-byte comparison digest is d0bd7fbfb8a19e850ede3e5590786d2f12117cb65a2dc866f9d5a21abc371c61.
Host adaptations are the existing local capabilities/high default, absent-row guard, neutral
environment with remote false, pure JD under native n, and the existing modal's measured spacing.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | 0 | TypeScript clean |
| `npm run build` | 0 | Actual CLI built |
| `node --import tsx --test test/model-picker.test.ts test/tui-model-picker.test.ts test/config-panel.test.ts test/effort-command.test.ts test/effort-slider.test.ts test/thinking-dialog.test.ts test/tui.test.ts test/interactive.test.ts test/diff-dialog-chrome.test.ts` | 0 | 167/167 passed |
| `node .audit/w292-model-picker-effort.mjs` | 0 | Copied AST and gate checks, compiled reminder-off 14/14 and reminder-on 14/14 |
| `node .audit/w232-model-picker.mjs` | 0 | 23/23 compiled model/list/effort/hook/persistence/narrow-click checks |
| `node .audit/w243-model-picker.mjs` | 0 | 9/9 compiled live-turn model switches |
| `W292_COMPARE_ONLY=1 W292_RESULT_DIR=$CLAUDE_JOB_DIR/tmp node .audit/w292-model-picker-effort.mjs` | 0 | Source verification and adapted character comparison, no repeated CLI |
| `git diff --check` | 0 | Patch whitespace clean |

One new regression group drives actual terminal cells through dark/light/ANSI themes, true/false/
invalid reminder strings, max-to-xhigh transition, empty options and retained draft. Existing
ultracode assertions now render native elements instead of assuming strings. Old W232/W281
compiled assertions migrate the exact arrow wording while keeping their previous behavior checks.

Independent read-only review passed the nine model tests plus 16 direct-terminal cases covering
all gate strings, 20/24/100 columns, acceptance, resize and exact draft/model/effort results.
It found no confirmed scoped defect. Source AST and module digests passed independently.
Comment review found only source/adapter comments and no new type suppression.

Compiled reminder-off and reminder-on each make one owned loopback request. They preserve
ultracode toggle behavior, paint real foreground cells, and exit zero. W232 verifies five CLI
processes at 90/20/24 columns, settings bytes, switch hooks, real request fields and released locks.
W243 verifies the picker during a held request and the model on its subsequent tool turn. A process
check found no remaining fixture CLI after completion. Paid upstream calls are 0. Live Magpie
and package smoke were not run. Full suite was not rerun; W283's known CLI effort mismatch remains.

All final compiled results bind the same content identity.

- all: `9dec2debf6bb58452f48bb35bcfcf04cfee64433401bbdd6e12e4b1ec12af451`
- inputs: `96125311571133d18e25cbade8e028564406335fc583f70fdd71ea3333d20a89`
- tests: `cdc40d5057a9472bee65b72f7d8684a0cbf80c0353720f00fd57e371e6e5ee89`
- build: `48135385cb3103c2ad3b2ebc98bd4f39aa942af8d0fdebc6c254ded4cba4ecb2`

Evidence in `$CLAUDE_JOB_DIR/tmp`: w292-affected.log, w292-check.log, w292-build.log,
w292-cli.log, w292-view-0.json, w292-view-1.json, w292-picker-final.log,
w292-live-picker.log, w292-identity.json, w292-source-compare.json and
w292-character-diff-effort.txt. W232 result is w232-cli-gBUia2/result.json.

## Coding-standard check

S-1/S-7 complete source ranges and dependencies precede product edits; exact copies and the
adapted subtree are compared. S-2 existing draft, settings, hooks, request and narrow-click
assertions remain. S-3 styled elements are distinct from plain labels. S-4 the modal retains
its sole state and cleanup owner; copied React elements use the renderer runtime. S-5 real
foreground cells and persistent/request facts verify output. S-6 migrates the footer type,
renderer, tests and compiled wording consumers together. Rework, including the plugin/native
runtime mismatch and stale driver wording, is in question.md. Existing seven rules cover it.

The TUI family remains Partial. Capability/account catalogs and remote feature flags remain
excluded. Next ready candidate is the custom spinner Tips chain and Show tips local setting;
its source reader findings are recorded in the remaining-work list for a fresh package preflight.
