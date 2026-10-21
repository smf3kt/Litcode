# W229 `/permissions`, the `automode` tab

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part four of the `/permissions` port. The `automode` tab lists the auto-mode classifier's own rules:
a built-in block and the user's additions per section, an environment document, and a detail card
for each row. This package ports the list and both read-only cards; the writes are W230.

## What was there

`src/permissions-panel.ts` already carried `automode` in `PERMISSION_TABS` (with the title
`Auto mode`) but not in `PERMISSION_OFFERED_TABS`, so the tab was never drawn. `PermissionLayer`
carried `autoMode` from `permissionLayerSchema`, and `src/config.ts` populates it per layer for
user, project, local and flag settings (1186-1195) and for managed settings (1215-1219);
`config.permissions.layers` keeps those layers (`src/cli.ts:408`), while `effectivePermissionPolicy`
rebuilds `layers` without `autoMode`. `src/auto-classifier-rules-source.ts` carries the built-in
rules document with its four `<user_*_to_replace>` slots, and `seedPermissionUpdates` already folds
the same three sources for the classifier.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-fxx7hh8y.js` | sha256 `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`, `Bn` 44266 | the tab body: intro at 48286, row list at 46900, dispatch at 48450, `visibleOptionCount` |
| ↳ | `ve` 35310 | the entry reader over `aUe`'s three layers |
| ↳ | `me` 36535 | the builtins state per section |
| ↳ | 35249 | `Ke` — the section table |
| ↳ | `ie` 42811 / `Ie` 42889 / `Te` 42889 | the section titles, their colour slots, the source labels |
| ↳ | `En` 42850, `Re` 42930, `Ml` 43840, `An` 43849, `Pl` 43996 | the source tags, the 20-cell column, the document's 5-line budget, the cuts |
| ↳ | `En`/`gt` 43457, `Vm` 42306, `$t` 47106 | the row value and the two row shapes |
| ↳ | `hi` 46500 | the environment document row |
| ↳ | `Hn` 56850, `Jm` 56846 | the builtins card and its 3200-character budget |
| ↳ | `Nn` 52375, `Le` 51291, `co` 39952 | the entry card, the entry display, the uneditable-rule check |
| ↳ | tab registrations 87975-89496 | the `br` order: recent, allow, ask, deny, automode, workspace |
| `chunk-sfn1dbxq.js` | `Rue` 1065708, `SL` 1065805, `rne` (constant true) | the built-in rules per slot, and the gate that makes the internal-template arm unreachable |
| `chunk-7ah5c51p.js` | 2452 | `xu` = `$defaults` |
| `chunk-x0dc37w9.js` | — | `aUe` = `userSettings`, `flagSettings`, `policySettings` |
| `chunk-qq2mgstr.js` | `Ci` 15827 / `Bi` 12567 | the display text |

The recovered semantics, read off those units:

```js
// entries  = for source of [userSettings, flagSettings, policySettings]
//              for section of [allow, soft_deny, hard_deny, environment]:
//                text === "$defaults" -> skipped
//                environment && text.startsWith("### ") -> {structure: true}
// builtins = per section: no owner -> {enabled: true, control: "empty"}
//            environment -> $defaults in any owner ? {enabled: true, otherSource, that source}
//                                                : {enabled: false, otherSource, first owner}
//            else foreign $defaults -> {enabled: true, otherSource}
//                 user values       -> {enabled: values.includes("$defaults"), control: "user"}
//                 else              -> {enabled: false, otherSource, first owner}
// row      = section.padEnd(20) + (tag ? " · tag".padEnd(20 - title.length) : "") + text
// builtin  = section.padEnd(20) + "[x]"/"[ ]" + " Built-in rules" + " · count" + (off ? " · off" : "")
//            + (control not user/empty ? " · from " + sourceLabel : "")
// list     = [add-new-rule, ...per section: environment -> [document], else [builtin?, ...entries]]
// document = entries ? "Extends|Replaces the built-in default · from <sources> · enter to ..."
//                    : "Built-in default document · kept by <source>? · enter to ..."
// card     = "Built-in rules": "<section> · N built-in rules · in effect|switched off", the rules
//            as "- rule" (3200-char budget), the empty/foreign note, the toggle/editor/cancel rows
//            "Rule details": the text, " rule|section header for the auto mode classifier · From
//            <source>", the arm's note, Edit/Delete/Cancel
```

## Port

- `src/auto-mode-panel.ts` (new): the section and source tables, `autoModeBuiltinRules` (`SL`/`Rue`
  over the local `AUTO_RULES`), `autoModeBuiltinCounts` (`hs`), `autoModeEntries` (`ve`),
  `autoModeBuiltins` (`me`), `autoModeShowsBuiltin` (`tn`), `autoModeBuiltinRow` (`$t`),
  `autoModeEntryRow` (`Vm`), `autoModeEntryValue` (`gt`), `autoModeRows` (`Bn`'s non-search list),
  `autoModeDocumentNote` (`hi`), `autoModeBuiltinsPaneRequest` (`Hn`),
  `autoModeEntryPaneRequest` (`Nn`) and `autoModeDocumentPaneRequest` (the row's own reading).
- `src/permissions.ts`: `PermissionLayer`, derived from `PermissionPolicy['layers']`.
- `src/permissions-panel.ts`: `automode` joined `PERMISSION_OFFERED_TABS` in the recovered order;
  `PermissionPanelInput.autoModeLayers`; the `automode` branch of `permissionsPanelRequest`; the
  `builtins`/`autoEntry`/`autoDocument` modes and their dispatch in `browsePermissions`.
- `src/interactive.ts`: `permissionPanelInput` passes `session.config.permissions?.layers`, the
  config-loaded layers that keep their `autoMode` blocks.

## Adaptations and what stays out

- **The internal-template arm is dead in the source too.** `me`'s first branch is gated on
  `rne()`, which returns the constant `{value: true, src: "default"}`. The local port therefore
  drops the `internalTemplate` state entirely, and `tn`'s environment arm (which tested it) always
  answers false, so the environment section never draws a builtins row — it draws its document
  row, exactly as `Bn` does on the live path.
- **The counts are real.** `SL()` reads the built-in rules out of the classifier document's
  `- ` bullets, and the local document carries the same four slots, so the row prints 17, 72 and 1
  rather than a number this host invented.
- **The add row is not drawn.** `Bn`'s list leads with `Add a new rule…`, whose resolved row calls
  `onAddNew` into `Jr`'s settings-document writer. This build has no such writer, so W229 leaves
  the row out rather than printing a row that does nothing; it returns with W230.
- **The environment editor is a reader.** `hi`'s note ends `enter to edit`, `enter to edit your
  entries` or `enter to add your own`; locally it ends `enter to view` / `enter to view your
  entries`, and Enter opens `autoModeDocumentPaneRequest`, which prints the document the row stands
  for — the declared entries, or the built-in default when there are none.
- **The cards keep only their reading rows.** `Hn`'s toggle row, `View in editor` and `Nn`'s
  Edit/Delete rows all write the settings file (`Xr`, `qr`, `ts`, `os`); the local cards show the
  recovered text and a `Back` row.
- **The legacy arm is out.** `Nn` describes a `legacy` entry as one "the classifier still enforces
  as a soft deny". This build's `classifierSystem` passes only `allow`/`soft_deny`/`hard_deny`/
  `environment` to `Jdo`, and `ve` never produces a legacy entry, so porting the arm would describe
  enforcement that does not happen. Recorded as a residual unknown rather than invented.
- **One row per line.** `hi` draws up to `Ml` = 5 document lines inside its own row and `mi` wraps
  an entry to three; this host's rows are single lines, so the document row carries its note and
  its first line (`description`), and the card carries the rest.
- **The dialog re-draws the rows as choices.** The existing panel idiom (W226): the body lists the
  rows for reading, the choices make them selectable.
- **Out:** the writes above (W230). No `/auto-mode-setup` hint (`sne()`), no search mode.

## Verification

- `test/permissions-panel.test.ts` grew from 30 to 45 tests: the section/source tables, the
  built-in rule extraction and its counts, the entry reader (sentinel, structure, layer order,
  project layers ignored), the builtins state in all five shapes, the row's visibility rule, both
  row texts, the list order and the environment collapse, the document note in its three shapes,
  the tab body, both cards, the document card, the pane navigation (builtins → Back → tab, entry →
  Back, document → Back) and an unknown row value.
- The three existing probes were re-navigated for the extra tab row: `.audit/w226-permissions.mjs`
  12/12 (`down(4)`→`down(5)`, `down(6)`→`down(7)`), `.audit/w227-workspace.mjs` 7/7 (`down(3)`→
  `down(4)`, and its first check no longer looks for the add row, which the extra tab row pushed
  below the fold; the later check still opens it), `.audit/w228-recent.mjs` 3/3 unchanged.
- New `.audit/w229-automode.mjs` passes 6 checks over the compiled CLI: the tab strip order, the
  intro with the builtins counts, the entry row and the environment note, the builtins card with
  its count line and rules, its Back row returning to the tab, the document card, and the tab's
  dismissal.
- Full suite 2958/2958 (118 suites), `npx tsc --noEmit` and `npm run build` clean.
