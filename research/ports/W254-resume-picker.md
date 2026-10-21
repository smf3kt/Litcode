# W254 `/resume` picker

Date: 2026-10-22. Artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units over `extracted-v2/modules/`.

## Request

Part of the loop that ports the TUI surfaces behind the composer. `/resume` was a text command
with a numbered fallback; the recovered interactive CLI opens the `Jln` panel
(`chunk-er09v3xa.js` `f026decc…`), selected by the host's own command map
(`resume: () => import(chunk-14ept3y3.js)`, `chunk-24k7d6mw.js`).

## Recovered source

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-er09v3xa.js` | `f026decc1a34748d4ef11cab0a3116e299f2039f57757758f89137e50e051be9` | `Jln` 9331 | the picker: modes, focus, groups, guides |
| ↳ | | 16048 / 16185 | `Resume session`, `(i of n)`, `Refreshing…` |
| ↳ | | 16618 / 16873 | `No sessions match "<q>".` / `No conversations found in this project.` |
| ↳ | | 17035 / 17969 | `Rename session:` / `Press <key> again to exit` |
| ↳ | | `Lt` 8855, `Dt` 9186, `mo` 8234 | title clip, description, whitespace collapse |
| ↳ | | `wo` 19966 | fork grouping by session id, newest first |
| ↳ | | `kt` 13734 | list keys: up/down, left/right, `/`, typed search, Esc |
| `chunk-14ept3y3.js` | `55608d60f1de7b9b53982be176c3895b0fddbd171d115b30c891f6b4638ef303` | `ie` 23190, `Ue` 25441 | the panel wrapper and the command body |
| ↳ | | `X` 22590 | `sessionNotFound` / `multipleMatches` messages |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `non` 12412 | the `time · count · branch` description |
| `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` | `p4` | title precedence |

## Port

- `src/resume-picker.ts` (new): title/empty/no-match/exit strings, `resumeSessionName` (`p4`),
  `groupResumeSessions` (`wo`, rooted at the oldest ancestor because this host's fork parent is an
  intra-workspace id rather than the source's session id), `filterResumeSessions` (`nt` reduced to
  the fields this host keeps), `resumeRelativeTime` (`rw`/`non` with `Intl.RelativeTimeFormat`
  short), `resumeClip` (`mo`/`ct`), `resumeRowLabel` (`Lt` without sidechain/artifact tokens),
  `resumeRowDescription` (`Dt`), `resumePickerRows`, `resumePickerGuide`, and the `ResumePicker`
  state machine (list/search modes, focus, fork expansion, typed search, backspace, clear).
- `src/terminal.ts`: the `resumePicker` request input and the answer's `resume: { id }`.
- `src/tui.ts`: the panel owner on the dialog, a key handler (up/down, left/right expand, typing
  search, backspace, Escape clears search then cancels, Enter selects) and a renderer that paints
  the title, the search box, the two-line rows, the separator and the guide.
- `src/interactive.ts`: a bare `/resume` opens the panel in the interactive terminal. A non-empty
  argument keeps the source's direct-match path; a multi-match argument now prints the recovered
  `multipleMatches` sentence instead of the numbered prompt. The numbered prompt stays only for
  the piped interactive path, which has no modal surface.

## Adaptations and what stays out

- **Filters that need data this host does not keep.** The all-projects toggle, branch and worktree
  filters, background-session attach, PR/tag/agent/artifact tokens and sidechain markers are out;
  the local session summary has one workspace, no branch or worktree, and no such tokens. The
  fork suffix (`(+N other sessions)`) and left/right expansion are ported because the local
  parent chain carries that relation.
- **Preview and rename are out of this record.** `space`/`ctrl+v` preview and `ctrl+r` rename need
  host callbacks that do not exist yet (a session-body reader and the rename writer); the panel
  keeps the same two modes open for a later package. The `Rename session:` string and the
  `Press <key> again to exit` hint are recovered in the module but not reachable yet.
- **Single Escape cancels in list mode.** The source shares the global double-Escape exit hint;
  this host's dialog frame closes on one Escape, and the search arm clears first, which is the
  recovered `kt` order.
- **Description fields.** `non` prints `time · branch · count`; the local summary has only time,
  so a row shows the relative time. The panel therefore does not invent a message count.
- **Focus marker.** The product's dialog frame marks the focused row with `>`; the recovered tree
  list draws its own pointer glyph.

## Review fixes

- **Config-panel `permissionMode` kept the old owner.** The row replaced `session.config.permissions`
  with a new object, but `permissionOwners` is a `WeakMap` keyed by policy identity, so child agents,
  skills and the diff tools read the stale mode. The row now edits the policy in place and calls
  `bindPermissionOwner(session.config.permissions, session.permissionOwner)`; the merged value is
  still re-read through `loadProjectConfig` after the write.
- **Display-only test could not fail.** It called `drainEvents`, which only reads the owner record and
  never allocates one, so the "changed configuration" guard was unreachable. It now allocates with
  `backgroundWorkCount` and adds a `maxOutputBytes` negative control that must throw.
- **First-bind digest coverage.** `test/runtime-mcp-persistence.test.ts` now also proves that a
  changed `permissions.defaultMode` still binds while a changed live `permissions.mode` rejects.
- **Single `/effort` opener.** `test/effort-slider-opener.test.ts` drives a bare `/effort` through a
  terminal surface and asserts exactly one dialog request and a session-only skip (`s`), which the
  removed duplicate opener used to consume.

## Validation

- `src/resume-picker.ts` unit tests `test/resume-picker.test.ts`: 11/11 (title precedence,
  ancestor grouping, current-session filter, search, relative time, clip, fork suffix, empty and
  no-match text, expand/collapse, search mode, focus clamps).
- Review regressions: `effort-slider-opener` 1/1; runtime resources and MCP persistence 18/18.
- Focused interactive/TUI set: 38/38.
- Compiled `.audit/w254-resume-picker.mjs`: 10/10 at identity `c760cabe…`. A bare `/resume` opens
  the panel with the other named session and not the current one, the row carries its relative
  time and the guide, typing filters and shows the no-match text, the first Escape clears the
  query, the second closes with the cancellation notice, and a filtered Enter switches to the
  named session, which then runs a turn in its own log. `.audit/w231-effort-slider.mjs`: 18/18 at
  the same identity.
- Full suite: 3015 tests, 3014 pass; the single failure is the pre-existing CLI effort-flag
  divergence at HEAD.

## Remaining

Preview and rename submodes, and a mouse hit surface for the rows, are the next stage of this
package; the row hits are recorded on the dialog owner for that work.
