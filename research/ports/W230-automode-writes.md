# W230 Auto mode rule editing

Status: implemented and verified locally on `work/w43-choice-preview`. No push or paid upstream calls.

## Task card

- Entry: `/permissions` -> Auto mode -> add, edit, delete, built-ins or environment document.
- Outcome: save to user settings, redraw the panel and apply rules to subsequent calls; cancel preserves disk.
- Source: the writer/validators below and the recovered qn/Yn/Nn/Hn/Kn/di UI chain.
- Hosts: the existing per-file permission-settings queue, atomic writes, modal input and external editor.
- Method: adapt recovered bodies, retain their validation and optimistic row/document comparison.
- CLI acceptance: create, edit, toggle, delete, document save/cancel, reopen and restart; owned fixtures only.
- Checks: 0-3 regression groups, affected existing tests, check/build, compiled PTY and content identity.
- Excluded: remote/account paths and telemetry. No push or paid upstream requests.

## Source identity

Coordinates are zero-based UTF-16, half-open. Ranges were verified with Acorn against the inert files.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| `chunk-fxx7hh8y.js` | `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78` | `qr` [35679,36021), `Yr` [36021,36161), `wl` [36197,36420), `Xr` [37516,38115), `El` [38115,38244), `Ho` [38346,39924), `jt` [39924,39952), `co` [39952,40050), `Gr` [40050,40564), `Tc` [40646,40903), `Dc` [40996,41354), `Fc` [41443,41824) |
| `chunk-fmjcnmvh.js` | `0dfc46c5f3c0822f45053671401c3f2a32bac207794ac05f3bb8fe49908c8d48` | `IVr` [58992,59109), `JWt` [59109,59377), `oZe` [60463,61301), `sz` [61347,61386); entry count 200 and character limit 10000 at 55017/55025 |
| `chunk-7ah5c51p.js` | `f0cf1631a25068c3f788d8b82dca713bc1c4d88221f9d55bf9c355ddc74a3dd5` | `Rit` [4449,4584), invisible-character regexp [4584,4684), `xit` [4684,4717), `Pit` [4717,4930); `$defaults` and four slot names |
| `chunk-x0dc37w9.js` | `0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92` | `ta` [102253,102464), `sZ` schema (allow, soft_deny, hard_deny, deny, environment); local queue host already ported in `permission-settings.ts` |

UI source in the same verified `chunk-fxx7hh8y.js`: `Nn` [52375,57128), `Hn` [57192,61328),
`Kn` [61328,62613), descriptions `pa` [62927,63340), editor round trip `Ms` [63340,63987),
section picker `qn` [63987,64476), input `Yn` [64476,66637), environment owner [78011,79476),
first-confirm/problem states [79936,81747), input/builtin/details/delete handlers [81747,85560).
`Gl` [49877,50106) exports built-ins for viewing. The local external-editor host already adapts
`Zie`, `chunk-7tnkhv2k.js` [3072,3957), SHA-256
`9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9`.

## Contracts and adaptations

`Ho` reads the latest settings inside a per-file queue and patches only `autoMode[section]`. Its
mutation result distinguishes a replacement array, a refusal, and a missing/stale row. Adds to an
empty rule section prepend `$defaults`. Edit/delete compare the exact original array index and value.
The environment writer compares the whole loaded user document and prunes empty section headers.
The built-in toggle removes all sentinels and reinserts one when enabled; it refuses to leave an
empty off section. The constant-true `rne` branch is retained as the live document semantics.

The local `autoPolicySchema` also declares `classifyAllShell`; it is the settings reader's authoritative
shape and the writer preserves that field and `deny`. The recovered schema also contains `deny`,
correcting the earlier reconnaissance note. Unknown top-level settings are preserved. Node's existing
bounded regular-file/atomic-write host replaces `By`/`ta` storage facades. User-visible product names
are neutral. Telemetry wrappers `Zr`/`No` have no local consumer.

## Port and local host adaptations

- `src/auto-mode-rules.ts` adapts Ho/Tc/Dc/Fc/Xr/qr and their text validators. The update is a tagged
  union, distinct from tool permission rules. It shares the existing settings file queue, preserves
  unrelated JSON fields and mode bits, and returns the updated policy only after atomic persistence.
- `src/auto-mode-editor.ts` owns the recovered section/input/details/delete/builtin/environment states.
  Invalid input retains its draft, edit cancel returns to details, delete defaults to No, and the
  environment's first replacement also defaults to No. Unchanged/invalid editor results offer Reopen.
- `src/auto-mode-panel.ts` restores the add row, editable user-rule actions and user-owned builtin
  toggle. Managed/flag/header rows remain read-only. Environment labels now say enter to edit.
- `src/permissions-panel.ts` hands automode rows to that state machine while retaining the existing
  tab and denial-mark owner. `src/terminal.ts`/`src/tui.ts` carry Yn's initial text with an end cursor.
- `src/interactive.ts` supplies private 0700/0600 working files through the existing editor handoff.
  Environment files are removed after the owned editor settles; builtin exports remain for viewing
  and never write back. On panel close, the existing configuration branch/reload path pins the saved
  rules into the live classifier and retains session grants. No runtime fingerprint exception.

The host uses awaited saves rather than the recovered React callbacks' background promises. Its
single modal returns to the tab after completion. Rule validation errors appear on resubmission;
the general terminal input guide/line budget is retained. Configured editor names are resolved by the
same copied resolver as the existing editor bridge. Exact native React color/gutter decoration,
search mode, legacy-deny editing, account setup and telemetry stay outside this package.

## Validation

- `npm run check` and `npm run build`: exit 0.
- Focused `auto-mode-editor` plus `permissions-panel`: 48/48, including three new regression groups.
  Tests preserve unrelated settings, permission writes, file modes and classifier text after reload;
  stale/invalid/oversized writes, immutable failed documents, add/edit/delete cancellation and editor
  recovery are covered. Existing W229 assertions now follow the restored add/action/editor states.
- Initial related `tui`, `interactive`, `agent-lifecycle`: 156/156. After review repairs, writer/panel/
  permissions/reload/external-editor/interactive 101/101 and tui/agent-lifecycle 131/131 pass.
  Full suite not repeated for this local slice.
- `.audit/w230-automode.mjs`: 20 compiled CLI checks, exit 0. Drives four-section picker, reserved input,
  add, prefilled edit, both builtin toggles, default-No delete/cancel/confirm, default-No environment
  replacement, external-editor save/working-file cleanup, subsequent classified file write, fresh
  process read and unchanged-editor recovery. Adds a live denial -> rule save -> preserved Recent row,
  external edit -> stale-save error -> refreshed row, and panel reopen with config watching off.
  The provider is an owned loopback SSE fixture; no
  upstream model or Magpie claim.
- Existing compiled probes: W226 12/12, W227 7/7, W228 live 9/9, W229 adapted 6/6,
  effort 14/14, model picker 11/11. No failures. W229 keeps its count/card/dismissal checks and drives
  an unchanged external editor instead of the superseded read-only environment card.
- Sample SHA-256: `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
- Final identity: `1132d700d724f1886eb3643a0c54945edcbeb20618b19ba57477c3e305841673`.
  Inputs `c0b326bd024946a8c9b837ed27cdcda0de019521f5cb889e08a001dd2539d566`;
  validation `947ad96d44778ad21a0578b530041655eed8f6257a2e3a80ec2e9428c3ec1093`;
  build `ae9e71320cdadcedb10b89fa01a914ac6cfee86d8689542399e03a786ddfe13f`.
  Recomputed with the shared `scripts/identity.mjs`, matching the compiled driver.
- Independent review found two host defects: failed writes retained stale rows, and the configuration
  branch dropped recent denials. Fixed by rereading the user policy on open/after either outcome and
  carrying denial records through the existing branch in reverse record order. Source Y/pEe in
  `chunk-frj2b06g.js` [2565,3111), sha256
  `1f4f2bc8200dcb30a20f5dfea1c04546696e503b3adf71412ec65c98a119f00e`, keeps that provider alive.
  Independent follow-up accepted both repaired paths with no remaining concrete finding.
  Retained runtime evidence: `.audit/w230-automode.mjs`; temporary logs/result under
  `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/w230-cli-K2cZPo/`.

S-1 through S-7 were checked. Source ranges are AST-verified; input text remains separate from display
folding; the state machine owns drafts and returns; editor cleanup precedes TTY restoration;
shared persistence is serialized; all request consumers and affected drivers are updated. The
question log records the regexp transport correction and the obsolete W229 expectations.
