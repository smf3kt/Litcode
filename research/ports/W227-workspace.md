# W227 `/permissions`, the Workspace tab

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part two of the `/permissions` port (W226 was the rule tabs). The Workspace tab lists the session's
additional working directories, adds one from a path, and removes one behind a confirm.

## What was there

`/add-dir` already carried the validator `validateAddDirectory`, its message table `addDirectoryMessage`
and the session-scope apply. The permission state already held `additionalWorkingDirectories` as a
`Map<path, {path, source}>`, and `adoptPermissionUpdates` already applied `addDirectories` /
`removeDirectories` and skipped persistence for `destination: 'session'`.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-fxx7hh8y.js` | sha256 `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`, `wn` 33390 | the tab body: the original-directory row, the list, the add row last |
| ↳ | `Mc` 33269 / `Pc` 33329 / `kc` 33360 | the per-entry shape, its path accessor and the label formatter |
| ↳ | `Ac` 33231 | `originalCwd` |
| ↳ | `xn` 32367 | the removal confirm and its session-scope `removeDirectories` |
| ↳ | 86659 / 87072 | the two report lines |
| ↳ | 89342 | the tab's intro line (in the shell) |
| `chunk-k65ya3x7.js` | sha256 `ba76569c9bb35d13cdab5907534863174c7e0ba60fe3d0ac3cea099edf22e171`, `TXe` 3186 | the add surface |
| ↳ | `O` 1720 | its header line |
| ↳ | `Y` 2140 | its input: `Enter the path to the directory:`, the `Directory path…` placeholder |
| ↳ | `W` (module var, 1587) | the already-accessible options: `Yes, for this session` / `Yes, and remember this directory` / `No` |
| `chunk-2bcyxj9q.js` | sha256 `fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0`, `Fn` 166973 | the display text a path is drawn with |
| `chunk-qq2mgstr.js` | sha256 `84f8f93155c8c7dcf287306959a002f20e09b31cfe97bd68e2ae14048f290e6f`, `nB` 15775 | `uFe` over `Fn`, the label dedup |

The recovered flow, read off `wn`/`xn`/`TXe` and the shell's add handler:

```js
// rows      = directories (insertion order, Fn labels) then "Add directory…"
// Esc       = onExit("Workspace dialog dismissed", {display:"system"})
// add       = validate -> success: {type:"addDirectories", directories:[abs], destination: remember?"localSettings":"session"}
//              -> report "Added directory <Fn(abs)> to workspace" + (remember ? " and saved to local settings" : " for this session")
//              -> rejection: the input stays open with hge's line
// remove    = {type:"removeDirectories", directories:[path], destination:"session"} -> report "Removed directory <path> from workspace"
```

## Port

- `src/permissions-panel.ts`: `workspaceDisplayText` (`Fn`), `workspaceDirectoryRows` (`nB`, add row
  last), `workspaceTabLines`, `workspaceAddedReport`/`workspaceRemovedReport`, `workspaceAddRequest`
  (`TXe`'s input arm with its error line), `workspaceRemoveRequest` (`xn`), the `addDirectory` /
  `removeDirectory` modes in the `browsePermissions` machine, and the workspace arm of
  `permissionsPanelRequest`. `permissionRuleLabels` was split so the workspace list and the rule list
  share one dedup (`permissionDisplayLabels`).
- `src/interactive.ts`: `permissionPanelInput` now carries `directories` (the raw map keys, as `wn`
  reads them) and `originalCwd` (`session.config.workspace`).
- The tab strip now offers `workspace`; `PERMISSION_OFFERED_TABS` is the list the panel draws
  (`allow`, `ask`, `deny`, `workspace`), in `PERMISSION_TABS`' order.

## Adaptations and what stays out

- **The add surface is a text prompt, not a suggestion list.** `TXe` completes directory names with
  Tab over a debounced listing. This host's dialog takes text only, so `workspaceAddRequest` asks for
  the path and `validateAddDirectory` handles it. The `Directory path…` placeholder and the Tab
  binding have no local surface.
- **The already-accessible confirm is unreachable, so it is not ported.** `TXe` asks session-or-
  remember only when `gge` reports `alreadyInWorkingDirectory` and the caller passed
  `onAlreadyAccessible`; the recovered panel's own call site passes no such prop, so the path falls
  through to `hge`'s message. The local flow does the same.
- **`Fn`'s coercion arm is dropped.** The recovered starts with `pn(e)` and appends U+FFFD when that
  changed the value; the local parameter is already a `string`, so only the replacement and the NFC
  normalisation remain.
- **Both reports run through `Fn`.** The recovered applies it to the add report only and prints the
  raw path on removal; a raw path can carry control characters into the transcript, so both use it.
- **The apply outcome is discarded**, as the recovered's add handler and `lwn` both do: the report
  says the directory was added even when the reducer blocked it. A user-visible failure arm would be
  a deviation, not a port.
- **Out:** the `recent` and `automode` tabs (W228/W229), the directory listing that feeds the
  suggestion list, and the `isDeletable` flag — the recovered `Mc` hard-codes `true`, so every row is
  removable here too.

## Verification

- `test/permissions-panel.test.ts` grew to 22 tests: the workspace body and its choice list (add row
  last, no empty-state line, `defaultIndex` on the tab row), the `Fn` replacement of control and
  separator code points, the dedup over paths (identical folds keep their raw form; only non-ASCII is
  escaped), the add flow with a rejection and an empty submission before the valid path, the removal
  confirm with a cancelled arm and a confirmed one, both dismissal messages, and the two request
  surfaces' recovered wording.
- Full suite 2934/2934 (118 suites), `npx tsc --noEmit` and `npm run build` clean.
- Compiled probe `.audit/w227-workspace.mjs` passes 7 checks over the real CLI against a user
  settings file declaring one additional directory: the tab draws its intro, the original-directory
  row and the seeded directory; the row opens `Remove directory from workspace?` with its note; Yes
  removes it and the exit reports `Removed directory <path> from workspace`; the reopened list no
  longer holds it; the add row opens the path input; a missing path keeps the input open with
  `was not found`; and Esc from the tab answers `Workspace dialog dismissed`.
