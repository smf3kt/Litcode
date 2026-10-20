# W226 `/permissions`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/permissions`
is the rule editor: the allow/ask/deny tabs, the add-rule flow with its save-scope picker, and the
per-rule detail pane that deletes a rule. The `recent`, `workspace` and `automode` tabs, and the
remote arm, stay out (W227/W228).

## What was there

`/permissions MODE` already existed as a session-mode setter. The rule state existed too:
`SessionPermissionUpdates` carries per-source buckets, `session.permissionOwner.state()` exposes
`alwaysAllowRules`/`alwaysAskRules`/`alwaysDenyRules`, and `/add-dir` already writes through
`session.adoptPermissionUpdates` + `session.drainPermissionWrites`. There was no editor surface.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-fxx7hh8y.js` | sha256 `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`, `gR` 91405 | the panel component |
| ↳ | `di` 72643 | the panel body: tabs, intro, rule rows, empty states, guide |
| ↳ | `Jt` 71615 | the row builder over one behaviour's rules |
| ↳ | `Pr` 19132 | `No additional working directories` (the Workspace tab's empty state) |
| ↳ | `sd` 23270 / `dn` 23351 / `Te` 43114 | the shadow analysis: the deny pass, the ask pass, the Bash sandbox exemption |
| ↳ | `mn` 25734 / `el` 25370 | the save-scope table (`Bbe` order) and its three descriptions |
| ↳ | `pn` 27432 | the add-rule input surface |
| ↳ | `ai` 67512 | the rule detail pane and its three read-only arms |
| ↳ | `Fr` 24223 / `ld` 23975 / `id` 23651 / `Zi` 23380 | the decomposition, the warning lines, the delete confirm |
| ↳ | 75586 / 75770 | `Added ${ruleBehavior} rule ${…}` and the `${warning} Warning: … is blocked\|shadowed` block |
| ↳ | 77766 / 77840 | `Deleted ${ruleBehavior} rule ${…}` and `Could not delete ${…} — the rule is unchanged` |
| ↳ | 72911 | `[B, M] = y(k)`: the dialog's own report list and its appender |
| ↳ | 77137–77175 | the exit handler `wu`: `B.length > 0 ? i(B.join('\n')) : i('Permissions dialog dismissed', {display:'system'})` |
| `chunk-qq2mgstr.js` | sha256 `84f8f93155c8c7dcf287306959a002f20e09b31cfe97bd68e2ae14048f290e6f`, `jSr` 15549 | the display-text fold |
| ↳ | `uFe` 10928 / `N6` 2000 | the label dedup, its escape form and the 2000-unit cap |
| `chunk-es5g07ss.js` | sha256 `0682db0c81c53e0a942ac9f7fd3db54c5075fe898954cfb554415b1a1cb0afcf`, `iNt` 662 | the four decomposition arms |
| `chunk-wtch2p0g.js` | sha256 `00d29835d3b6ec21999ab2d38ae5086e7c798d82aa152e76a7e00cf5b0dc4b3b`, `fT` 6070 | the source-name table |
| `chunk-sfn1dbxq.js` | sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, `kor` 3364311 | the delete switch; `bTo` 1636668 the `local-jsx` registration |
| `chunk-gyf58rwf.js` | sha256 `7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2a`, `_` 59764 | `JSON.stringify`, the dedup key |

The exit rule, read off `wu`: the dialog returns **its accumulated report lines joined by newlines**
as the command's result, and only falls back to `Permissions dialog dismissed` when no action
reported anything. The lines are not streamed while the panel is open.

## Port

- `src/permissions-panel.ts`: the display fold (`jSr`) with the invisible-character strip, the label
  builder (`uFe`/`N6`), the decomposition (`iNt`), the source table (`fT`), the save-scope table and
  its descriptions (`mn`/`el`), the tab table, the row builder (`Jt`), the panel body (`di`), the
  add-rule input (`pn`), the save request, the detail pane (`ai`), the shadow analysis (`sd`/`dn`/
  `Te`) with `Fr`'s warning lines, the four report strings, and the `browsePermissions` driver.
- `src/interactive.ts`: the `/permissions` branch, `permissionPanelInput` (reads the live state's
  buckets plus `permissionSettingsPaths`) and `applyPermissionPanelUpdate` (drains, adopts, drains
  again and reports the first write failure).
- `src/terminal.ts` / `src/tui.ts`: `writeNotice?(text)` on the surface, implemented by the fullscreen
  terminal as one `system` transcript entry. The recovered result text carries `display: "system"`,
  and the host's status row keeps only its newest line, so a multi-line block needs the transcript.
- `src/tui-autocomplete.ts`, `COMMAND_HELP` and `README.md`: the command row with the recovered
  description, in the `config` lane.

## Adaptations and what stays out

- **The source buckets are the host's own.** The recovered panel reads `U0`/`Bc`/`xm` for a rule's
  origin; this host reads `permissionOwner.state()`'s three per-source buckets, which are the same
  partition keyed by the same seven source names.
- **The add flow applies through the live write path.** The recovered `kor` switch writes one file
  layer directly; here `applyPermissionPanelUpdate` adopts the update into the session and drains the
  pending writes, so a rejected destination surfaces as `permissionDeleteFailedReport`.
- **`session` is the destination for a live-source delete.** `saveDestinationFor` maps the two live
  scopes and anything outside the three file layers to `session`, matching the recovered switch.
- **Reports are returned, not streamed.** The dialog accumulates them exactly as `M` does and hands
  the block back on exit. The host renders that block as a `system` entry; the recovered
  `display: "system"` is the same presentation.
- **Out with the surfaces that need absent state:** the `recent` tab and its denial list (`Rn`/`wn`),
  the `workspace` tab (`Bn`/`Hn`), the `automode` tab (`Op`/`Yn`) with `Added auto mode ${…} rule`,
  the `zi`/`Dr` remote arm, and the in-dialog `/` query editor (`_y`). Those are W227/W228 scope.
- **No `/permissions` piped form.** The recovered registration is `local-jsx` with `immediate: true`
  and no `load`; the bare command exists only where a modal surface does, so a piped session falls
  through to the `MODE` form.

## Verification

- `test/permissions-panel.test.ts` (16 tests): the display fold with the invisible strip, the four
  decomposition arms, the label dedup/escape/suffix rules with an over-limit pair, the source table,
  the save scopes, the tab table, the row builder with its sort and query filter, the panel body and
  its empty state, the three read-only pane arms, the shadow analysis (deny first, the sandbox
  exemption, a content-less allow rule), the report strings, the add flow returning its line, the
  delete flow with a failed write, an empty add submission, the bucket flattening, and the save
  request.
- Full suite 2928/2928 (118 suites), `npx tsc --noEmit` and `npm run build` clean.
- Compiled probe `.audit/w226-permissions.mjs` passes 12 checks over the real CLI against a user
  settings file seeded with `{"allow":["Read"],"deny":["Bash"]}`: the panel opens with its tab row and
  intro, `Esc` dismisses it, the add row opens the input with its example, the input opens the
  save-scope picker, the pick lands `Bash(ls *)` in the settings file, the exit reports the add and
  the three-line deny warning, the deny tab lists `Bash`, selecting a rule asks before deleting it,
  the confirm removes `Read` from the file, the exit reports the delete, and the refreshed list has
  one rule row.
