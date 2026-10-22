# W286 stashed draft footer

Status: verified locally on 2026-10-23. Independent review found no confirmed defect. Local UI only.

## Task card

- Entry: Ctrl+S stash, swap, pop and automatic restore after submit or local dispatch.
- Outcome: the source dim `pointerSmall + " stashed"` marker reflects the actual stash slot.
- Source: `WR`'s `yn` branch, its `Pre` presence selector and the existing stash owner bodies.
- Targets: `tui-stash.ts`, `tui-renderer.ts`, `tui.ts`, focused tests and a compiled driver.
- Shape: footer right column holds optional feedback and a derived stash-presence flag.
- Mode: copy the `yn` expression, adapt the slot selector to the existing `stashedDraft` owner.
- Validation: source identity, real keys, feedback separator, focus/suggestions and restore cleanup.
- Done: check/build, compiled CLI, affected regressions, compact records and local commit.

## Source preflight

Sample 2.1.296 SHA-256 is `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All source coordinates below are zero-based UTF-16 code units with half-open ranges.

`chunk-24k7d6mw.js` matches its manifest SHA-256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`.
Acorn locates `Pre=(h)=>h.stashedPrompt!==void 0` at [481073,481106), consumed as
`Et=Re(ee,Pre)` at [864489,864502). Both normal footer and fullscreen WR receive `hasStash:Et`.
`WR` [721497,724516) derives `Io` from visible notifications and the vendor status surfaces.
The copied `yn` expression is [723972,724107), SHA-256
`c2b8ea04094669c3e5833673e66f99be8c42e701629cbbc8542653d70f26147e`.

```js
$e&&r(s,{flexShrink:0,children:[e(n,{dimColor:!0,children:Io?" \xB7 ":" "}),r(n,{dimColor:!0,children:[te.pointerSmall," stashed"]})]})
```

`te` comes from `chunk-04v7vxqn.js`, manifest SHA-256
`8cb167b9ed25629bf15c7ef87c1fcb95da00328c65013321480cbd386dd3d4d6`.
Its existing copied local symbol table provides `pointerSmall`, U+203A on this macOS terminal.
The typed local JSX factory requires the key argument. The only expression adaptation adds
`undefined` as the third argument of each of its three `e`/`r` calls.
The source keeps the stash marker at `flexShrink:0` after the notification column and uses
`" · "` only when that column is present. Fullscreen mount D9 [906888,907115) hides both during
suggestions. Unlike Hfe's notification, the stash marker has no diff-panel hold gate or brief gate.

## Adaptation

The existing stash owner already repaints after swap, pop and automatic restore, and clears the
slot on close. A direct key probe measured no marker after a successful stash. The new flag is
derived from that slot rather than separately tracked. No stash persistence or new timer is added.
The right footer shape reserves the nonshrinking marker before truncating feedback. Existing
left-side status and navigation layout receives its remaining width first, preserving W285.
Local dialog footer placement remains W285's adapter. Search/transcript and suggestions hide the
chat marker. Vendor account/token/goal/voice status surfaces remain outside this package.

## Throughput checkpoint

- Blocking first steps: verify source identity, exact indicator body and slot/reset owners.
- Independent workstreams: none before implementation; one bounded read-only review after checks.
- Shared mutable state: one writer uses the current checkout and preserves unrelated changes.
- Smallest safe decomposition: one coupled footer package, existing stash state and renderer.

## Validation

- `npm run check` and `npm run build` exit 0.
- Affected suites pass 148/148 in `tui`, `tui-stash`, `tui-model-picker`, `effort-command`,
  `terminal` and `vim`. One new TUI group drives real stash, swap, pop, submit and command restore.
  It checks dim color, feedback separators, expiry, brief mode, history search, suggestions,
  40/80/120-column layout and the interrupt hint. The existing diff-sidebar group now checks
  that the marker remains visible while notifications are held, then clears on pop.
- `W286_RESULT=<path> node .audit/w286-stashed-footer.mjs` exits 0. Source preflight verifies
  the manifest and exact expression hash, compares the target AST after removing only the three
  declared key arguments, and compares all four compiled indicator branches with the isolated
  source expression. No recovered application entrypoint runs.
- Compiled PTY acceptance passes 19 checks. The marker follows stash, swap, pop, submit restore
  and local-command restore. Feedback expiry removes its separator without dropping stash status.
  Suggestions and history search hide it, cancellation restores it, and brief mode retains it.
  The 40-column footer keeps the complete marker. A fresh CLI has an empty stash. Both processes
  exit zero and release history/session locks. Journals omit the fixture credential.
- Existing compiled W285 effort chain passes 26/26 at the same identity. The W286 driver makes
  one explicit owned loopback SSE request. UI-only actions make zero extra model calls.
- Independent read-only review confirms exact expression fidelity, both footer callers, slot
  reset ownership and rendering at 20, 24, 40, 80 and 120 columns. No confirmed scoped finding.
- Full suite is not repeated. The last full result remains W283's 3201/3202 with the existing
  `cli-migration.test.ts:87` effort mismatch.

Content identity: `b1eaf3df829462be994b7502c2d401ffffedbfc5333c0224ed3c5b285d79e410`.
Inputs: `42f178ecba00bba2f67860e7a47500c8254b88ec5589c543645bb78fb666b7b9`.
Validation: `00f6dfa1edc635ca97b0d727263c9e2f31d12e6ff18dee2ccdcb7d191a09b1b2`.
Build: `b09988bcb4718a5cb7f9ab09faaf92d44207e1b3e8c61c88541ef77473d493c9`.
Logs are under the job temporary directory: `w286-focused.log`, `w286-vim.log`, `w286-check.log`,
`w286-build.log`, `w286-cli.log`, `w286-cli-result.json`, `w286-effort-cli.log` and `w286-identity.json`.

## Coding-standard check

S-1: source identity and the missing-marker key probe precede edits. S-2: existing stash and
effort expectations remain. S-3: the marker never joins draft, request or saved text. S-4: the
existing slot owns reset and close, with no added timer/state. S-5: the compiled suggestion wait
uses the measured first visible row. S-6: both footer paths use FooterStatus. S-7: the copied
expression and the three JSX key adaptations are compared mechanically. Patch/JSX and fixture
corrections are retained in the existing local ignored `research/question.md`.
