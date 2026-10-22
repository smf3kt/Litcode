# W287 external editor hint

Status: verified locally on 2026-10-23. Independent review correction rechecked, with no remaining confirmed defect. Local UI only.

## Task card

- Entry: a composer draft gaining or losing an explicit newline, then the external editor chord.
- Outcome: the recovered editor key hint appears for 5000 ms on each multiline eligibility transition.
- Source: WR's external-editor-hint effect, Ire, hx and the Ub display-name closure.
- Targets: external-editor, copied label source, TuiTerminal feedback owner and focused fixtures.
- Shape: cached editor command, last eligibility key and optional active text/timer.
- Mode: copy source label bodies and adapt the effect to the owned terminal timer and footer.
- Validation: newline versus visual wrap, expiry/dedup, editor names and real compiled editor handoff.
- Done: affected checks, check/build, compiled CLI, source identity, records and local commit.

## Source preflight

Sample 2.1.296 SHA-256: `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Ranges are zero-based UTF-16 code units, half-open, parsed with Acorn 8.15.0.

| Module | SHA-256 | Body |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Ire [481135,481165), WR effect [722518,722821) |
| chunk-7tnkhv2k.js | 9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9 | C [2499,2801), P/hx through 2908, XG [2908,2988), Zie [3072,3957) |
| chunk-n3ykh62m.js | 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac | capitalization [372823,373983), editor table/Ub [374016,377371) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | Vh [347360,347512), EHt alias [347512,347523) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | Gpe [23589,23600), existing string conversion closure |
| chunk-ax7r0qj7.js | 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | Qe [3224,3289) |
| chunk-nh8hd3rr.js | 5194b7a0a1b3c5beeae642f9b337330dabb12d436085c4aa52a1cf5ff81d1794 | pt [800,1044) |
| chunk-0qkpwgr4.js | 470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6 | z [3890,4537), nonterse separator ` to ` |

Ire is `h.value.includes("\n")`, not a measured layout-line count. A 120-column live TUI probe
with `first` + Shift+Enter + `second` holds `first\nsecond` and currently shows no editor hint.
The source range hash is `789fe9641600cf12bba416ab76cbc622672fc78759843205c1bce85f652667d1`.

WR resolves hx once at mount. Its Uo gate requires Ire, no token warning, a nonmissing/noninvalid
API verification state and a defined editor command. The effect requires Uo and a truthy command.
It adds key `external-editor-hint`, kind `hint`, priority `immediate`, timeout 5000. The dim JSX
contains pt(action chat:externalEditor, context Chat, fallback ctrl+g, description edit in Ub(yo)).
The false arm removes the key. Dependencies [Uo,yo,po,co] leave an unchanged multiline draft expired.
Effect hash: `85491d470c72712637ad1ed0a6c7f2b4ae8cefda8e8e35af17c5fd7a438164ec`.

Ub resolves known IDE ids and executable aliases, otherwise lowercases the basename and applies
the copied Unicode-aware upper-first helper. The existing editor resolver already handles VISUAL,
EDITOR and PATH defaults. The host exposes its resolved command without executing it and
uses that same resolver implementation for actual handoff. Gpe is reused from the existing copied lodash file
by adding an export; the small Vh/EHt and capitalization/name bodies are copied whole.

The source consumer `Mt=Re(ee,Ire)` is [864462,864475). The fullscreen WR receives that value
at D9 [906888,907115), so every input-store value mutation reaches the selector. The host's
existing `replaceDraft` is the subscription adapter. Reducer, Vim, queue pull, gesture clear and
autocomplete text writes now pass through that adapter; history-metadata/cursor-only writes do
not change Ire. The initial implementation missed direct reducer writes, observed by a real-key probe.

## Host adaptation

There is no local API-verification/token-warning notification owner. Those two vendor gates have
no input in this host and stay outside this package. Newline presence and editor availability are
the local eligibility inputs. The cached command belongs to the terminal instance. The existing
chord registry supplies its actual local display string, as other copied key hints already do.

An active editor hint temporarily takes the existing right notification slot ahead of effort.
Existing status notices retain their current precedence. Stash remains a separate right marker.
The existing suggestion/search/diff visibility gates apply. Timers run while hidden, matching the
documented W285 timer adapter rather than introducing general notification queue/pause accounting.
Each eligibility edge clears the previous timer. Expiry retains the key; close cancels the timer.
Actual editor suspend/resume, draft refolding, failure and child cleanup remain the existing owner.

Independent review reproduced a cached-command mismatch. `C`/`P`/`hx` at chunk-7tnkhv2k.js
[2499,2908) share one host-owned resolver; `Zie` [3072,3957) reads that same `hx` for launch.
The initial host cached only the hint and created a fresh resolver for each handoff. A direct
probe displayed True but launched false after VISUAL changed. The source adapter now accepts
an optional resolver binding. TuiTerminal passes its cached selection, including absent,
to both draft and existing-file handoffs. Direct line-mode calls keep their per-call resolver.
This is one dependency injection into the copied hx binding; C, Zie and the refold body stay
unchanged. Existing TUI editor fixtures must configure their command before mount, while
changing the contents of the same fixture executable still exercises success and failure.

## Throughput checkpoint

- Blocking first steps: source gates, cached resolver, label dependency closure and reset owners.
- Independent workstreams: one bounded read-only review after the owned implementation is verifiable.
- Shared mutable state: one writer, in place, retaining unrelated dirty paths.
- Smallest safe decomposition: one editor-hint package and its complete existing editor usage chain.

## Validation

- `npm run check` and `npm run build` exit 0.
- Affected suites pass 154/154 in `tui`, `external-editor`, `tui-stash`, `tui-model-picker`,
  `effort-command`, `terminal` and `vim`. Three new groups cover newline versus visual wrapping,
  5000 ms expiry, same-value dedup, single-line reset, close, editor resolution and absent-editor
  mount caching. Stash, history, search, brief, Vim, queue and gesture consumers exercise real keys.
  The resolver group also changes VISUAL after mount and confirms draft and existing-file opens
  keep the cached command. An initially absent command remains absent after VISUAL becomes set.
  Existing TUI and Vim success/failure fixtures configure the command before mounting.
- `W287_RESULT=<path> node .audit/w287-external-editor-hint.mjs` exits 0. It verifies each module
  against the manifest, compares all four copied ranges byte-for-byte and by compiled AST, and
  compares 17 compiled editor-name cases with the isolated source closure. The original WR
  effect's true and false arms are executed in isolation with inert JSX and notification bindings.
  No recovered application entrypoint runs.
  The full C class is unchanged. Zie differs only by its existing async declaration and two await
  insertions. The new cached-selection binding is verified beside those exact source bodies.
- Compiled PTY acceptance passes 26 checks. The hint shows the actual host binding
  `ctrl+x ctrl+e to edit in Vim`, takes priority over effort, shares the row with stash and
  uses inactive RGB `0x999999`. It expires on its original five-second deadline despite editing,
  stays expired until eligibility changes and survives search cancellation. The 40-column
  terminal distinguishes visual wrapping from explicit newlines and truncates within the row.
- The displayed chord opens an owned editor fixture through the compiled CLI. Success replaces
  the draft and clears newline eligibility. Exit 7 preserves the exact multiline draft, which
  reaches the owned loopback provider after the terminal returns. Both paths release raw mode
  and alternate screen for the editor, restore them afterwards, wait for the launcher and its
  inherited-stdio descendant to exit, then remove the 0600 file and 0700 directory. Both CLI
  processes exit zero and release history and session locks. Journals omit the fixture credential.
- Existing W286 compiled acceptance passes 19/19 at the same identity. The W287 driver makes
  one explicit owned loopback SSE request. UI and editor actions make zero additional requests.
  Paid upstream calls are zero.
- Independent review found the cached-command mismatch above. An independent correction check
  used both public editor entries for present-to-changed, absent-to-present and failing-to-valid
  VISUAL changes. Mounted selection stayed fixed in every case. Cancellation settled launcher
  and descendant, restored input and preserved the draft. Four focused cleanup/Vim regressions
  passed independently, and AST comparison retained every pre-existing assertion. No remaining
  confirmed scoped finding. The bounded comment review found no actionable comment/suppression.
- The full suite is not repeated. Its last result remains W283's 3201/3202 with the existing
  `cli-migration.test.ts:87` effort mismatch.

Content identity: `2e4874ae634e0e3c60d44f12302ca307e0111377e284aecb3a565176a41009de`.
Inputs: `872f1592d523ac885d247095565f6fd7e23c3d2f3a002e4d1e1b732ab01062bb`.
Validation: `fde70f357a5979407da11596e3c67d674fd72c8949370f5bb507fcfcb3b639ac`.
Build: `a6528761b46c2a897e26c354cda1aa5fda344218399ee1df69a0f794050bceea`.
Logs under the job temporary directory are `w287-focused.log`, `w287-check.log`, `w287-build.log`,
`w287-cli.log`, `w287-cli-result.json`, `w287-stash-cli.log` and `w287-delivery-identity.json`.

## Coding-standard check

S-1 uses the source and a real Shift+Enter probe before implementation. S-2 preserves existing
terminal and editor assertions. S-3 keeps the hint out of the draft and provider request. S-4
keeps command discovery, eligibility and timer on the terminal, cancels the timer on close and
checks actual launcher/descendant liveness before handoff completes. S-5 uses decoded frames,
the explicit newline and exact submitted draft. S-6 routes all text-changing writers through
the existing draft adapter. S-7 copies the complete name closure and documents the local timer,
plain-key-hint and omitted vendor-gate adapters. Rework is recorded in `research/question.md`.
The existing seven rules cover these causes.

Model the Domain keeps the hint's eligibility and clock beside the existing footer owner.
Prove It Works selects compiled PTY interaction and direct process probes for the delivery proof.
