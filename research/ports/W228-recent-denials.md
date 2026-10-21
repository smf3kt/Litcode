# W228 `/permissions`, the `recent` tab

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part three of the `/permissions` port. The `recent` tab lists the auto-mode classifier's refusals;
Enter marks a row approved, `r` marks it for retry, and Esc applies the marks. Unlike the two rule
surfaces this is a behavioural package: the list is fed by a store the classifier writes at its
refusal, and a retry appends a grant to the conversation and starts a turn.

## What was there

`src/agent.ts`'s `authorize()` already reached the auto-mode branch and produced the
`automode-blocked` outcome; `terminal.prompt` already carried request-declared `keys` and reported
the pressed key in the answer (`src/tui.ts:1944`), so the two per-row marks needed no protocol
change; `session.append` already carried a `classifier` origin, and `classifierTranscript` renders a
human-origin message as `{user: …}`.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-frj2b06g.js` | sha256 `1f4f2bc8200dcb30a20f5dfea1c04546696e503b3adf71412ec65c98a119f00e`, 2696 | the provider `pEe`: `getDenials` / `recordDenial` / `removeDenial`, list cap `$e` = 20, newest first |
| `chunk-fxx7hh8y.js` | sha256 `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`, `Rn` 29218 | the empty state |
| ↳ | `Wr` 29950 | the list: header, rows, Enter and `r` |
| ↳ | `di` 72643 | the shell: `initialTab ?? (denials.length > 0 ? "recent" : "allow")` |
| ↳ | 61300 | the tab guide in the wide-terminal arm |
| ↳ | `bu` 76102 | the Esc apply |
| ↳ | `wu` 77137 | the fallback exit text |
| ↳ | `gR` 91624 | the command body and `onRetryDenials` |
| `chunk-hyx1j919.js` | `ut` 275 (`Ufe`) | the status icons: `success` -> `te.tick`, `error` -> `te.cross`, `withSpace` |
| `chunk-24k7d6mw.js` | 1506012 | the record write at the classifier's refusal |
| ↳ | 1504867 (`B4`) | the input key: shell tools key on the command alone |
| `chunk-qq2mgstr.js` | sha256 `84f8f93155c8c7dcf287306959a002f20e09b31cfe97bd68e2ae14048f290e6f`, `Ci` 15827 / `Bi` 12567 / `PJt` 8861 / `Kb` 8897 / `N6` 8806 | the one-line display text, its 2000-unit cut, the 200000-unit row budget |
| ↳ | `OJt` 15891 | the rows over `nB`'s dedup |
| `chunk-sfn1dbxq.js` | `Ets` 4502383 | the appended grant message |

The recovered semantics, read off those units:

```js
// record  = {toolName, display, inputKey, reason} at the classifier's own deny only
//           (decisionReason.classifier === "auto-mode" && !noVerdict)
// store   = [new, ...old.slice(0, 19)]; removeDenial filters by identity
// open    = initialTab ?? (denials.length > 0 ? "recent" : "allow")
// row     = status(approved?"success":"error") + display + (retry ? " (retry)" : "")
//           description = reason with Ci/U+FFFD and the whitespace fold
// Enter   = toggle approved (withheld rows skipped; withheld is unreachable at Kb = 200000)
// r       = toggle retry, and add the row to approved
// Esc     = retry set non-empty -> onRetryDenials(labels) + exit {shouldQuery:true, metaMessages}
//           else approved set non-empty -> removeDenial each, exit "Approved <labels>" + metaMessages
//           else "Permissions dialog dismissed"
// grant   = applyMessageOp({type:"append", messages:[Ets(labels)]}) with "Allowed <labels>"
```

## Port

- `src/permission-denials.ts` (new): the record shape, `AUTO_MODE_DENIAL_LIMIT` (20),
  `AutoModeDenialStore` (`record` prepends and cuts, `remove` filters by identity),
  `autoModeDenialInputKey` (`B4`), `autoModeDenialDisplay`, `denialDisplayText` (`Ci` + `Bi`'s
  replacement), `denialReasonText` (`sc`), and `permissionRetryMessage` (`Ets`'s body).
- `src/session.ts`: `autoModeDenials` on the session (the local counterpart of the provider mounted
  by `AppStateProvider`) and `appendPermissionRetry(labels)`, which appends the grant as a user
  message marked human.
- `src/agent.ts`: the `automode-blocked` arm computes the outcome first and records the denial
  before the `PermissionDenied` hooks, so the record exists even when a hook lets the call retry.
- `src/permissions-panel.ts`: the `recent` tab — its header, empty state, guide, rows and choices,
  the `r` key declaration, the two report strings, and the `recent` arms of the `browsePermissions`
  machine (the opening tab, the marks state, the per-row Enter/`r` handling, the Esc apply).
- `src/interactive.ts`: `permissionPanelInput` carries the store's denials; the `/permissions`
  branch passes `removeDenial` and `onRetryDenials`, and a retry runs `agent().run(undefined, signal)`
  after appending the grant, the same call `/continue` makes.

## Adaptations and what stays out

- **`display` is the tool's classifier input.** The recovered calls `await tool.description(input)`,
  which this build's `ToolDefinition` does not carry. The ported counterpart is
  `toAutoClassifierInput(input) ?? JSON.stringify(input)` rendered as text — the tool's own naming of
  the call, which is what `description` supplies in the source.
- **`vUt` is the identity.** The recovered maps its agent tool to a public name; this build's
  registry already uses the public name.
- **The `withheld` branch is not ported.** `OJt`'s unit budget is `Kb` = 200000, above any label, so
  no row is ever withheld and the `(#n)` marker and the Enter skip have no reachable case.
- **The grant is a user message.** `Ets` returns a `system` record and `gR` appends it through
  `applyMessageOp`. This build's conversation holds `Anthropic.MessageParam`s and its classifier
  reads a human-origin message as `{user: …}`, so `appendPermissionRetry` appends
  `{role:'user', content:'Allowed <labels>'}` with `classifier: {origin:{kind:'human'}}`. That is what
  makes the re-issued call pass: any other origin would reach the classifier as non-user content.
- **The approved arm reports in the source's order** (`[..."Approved <labels>", ...panelReports]`)
  and then adds the grant line, which the recovered carries as `metaMessages` rather than in the
  exit text. `browsePermissions` returns one string, so the grant joins the block.
- **The marks live in the loop, not a component.** The recovered holds `approved`/`retry` in the
  list component's state; this host's dialog resolves and closes on each answer, so
  `browsePermissions` keeps the two sets and re-renders the request with them.
- **The retry turn is local.** `shouldQuery: true` is `agent().run(undefined, signal)`, exactly what
  `/continue` does. The recovered's `tengu_auto_mode_subsequent_approval` telemetry and its
  `msSinceDeny` are not emitted.
- **Out:** the `automode` tab (W229).

## Verification

- `test/permissions-panel.test.ts` grew to 30 tests: the store's newest-first cap and identity
  removal, the shell-versus-whole-input key, the display and reason normalisation, the rows' marks
  and dedup, the tab's header/empty state/guide/`r` key, the opening tab, the approved Esc apply
  (both marks toggled and withdrawn), the retry Esc apply (labels handed back, store untouched) and
  the unmarked dismissal.
- `test/agent-lifecycle.test.ts`: the existing five-outcome auto-mode loop now asserts that only the
  classifier's `block` outcome records a denial, with the exact `{toolName, display, inputKey,
  reason}`; a new test asserts that `appendPermissionRetry` leaves `awaitingResponse` set and that
  the classifier transcript carries the grant as `{user: …}` with no non-user marker.
- Full suite 2942/2942 (118 suites) after the two new tests, `npx tsc --noEmit` and `npm run build`
  clean.
- Compiled probe `.audit/w228-recent.mjs` passes 3 checks over the real CLI: the tab strip offers
  `Recently denied` ahead of the rule tabs, the tab draws the recovered header and empty state with
  its guide, and an unmarked Esc still dismisses. The populated list cannot be reached through the
  probe because there is no model to refuse a call; that path is the unit and agent-harness evidence
  above.
- `.audit/w226-permissions.mjs` was re-navigated for the extra tab row (12/12); `.audit/w227-workspace.mjs`
  is unchanged and still 7/7.
