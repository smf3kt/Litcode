# W225 `/focus`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/focus` is the
brief transcript — `Toggle focus view: just your prompt, summary, and response` — and the first
package in the loop whose effect is in the renderer rather than in one command's own output.

## What was there

No command and no setting. The two pieces the fold needs did exist: `TuiTerminal.paintAssistantPreview`
draws the in-flight streaming block, and `ProgressMode` already carries a `tool-use` phase.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-sfn1dbxq.js` | sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, `bEo` 1659965 | the `local-jsx` registration and its `call` |
| ↳ | `PWe` | the `local` twin (`argumentHint:"[on|off]"`, `supportsNonInteractive:!0`) |
| ↳ | `iQo` 4209226 | "the last assistant message carries a `tool_use`" |
| `chunk-4jr9rxry.js` | sha256 `48124b0b95bafa326126fe7b0d1a214eb73ac4ad0a2a1f8315d0bf51e424bb00`, `r` [4693,5262) | the text twin's body |
| `chunk-2bcyxj9q.js` | sha256 `fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0`, `iTe` 43499, `VTt` 43580, `VLe` 43662, `XMn` 43708 | the effective read, the gate, the label, the write |
| `chunk-3gz7s57c.js` | sha256 `9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b`, `THr` 9197, `vNt` 9299 | the preview visibility switch and the fold |
| `chunk-xrjhyksm.js` | sha256 `8c426459e3b62c20041beb8c0cd44943aac373bad15744d92b060e79d68a9d12`, `bot` 1603, `UF` 1512 | the local-stdin gate |
| `chunk-nqc6v990.js` | sha256 `261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738` | the store's `briefTranscript` default |

The two registrations share the name and split the work: `bEo` (the panel, `immediate: true`) clears
the persisted flag, checks the presentation and toggles the live one; `PWe` (the text twin) takes
`[on|off]`. The text twin's body:

```js
async function r(n, o) {
  if (bot(o)) return { type: "text", value: "/focus isn't available here yet" };
  let t = n.trim().toLowerCase(), e;
  if (t === "on") e = !0;
  else if (t === "off") e = !1;
  else if (t === "") e = !VTt();
  else return { type: "text", value: `Unknown argument "${t}". Use: /focus [on|off]` };
  XMn(e ? "focus" : "default"),
  o.onQueryEvent?.({ type: "apply_flag_settings", settings: { briefTranscript: e } });
  let s = VTt();
  if (s !== e) return { type: "text", value: `Focus view is set by a managed "viewMode" setting — it stays ${s ? "on" : "off"}` };
  return { type: "text", value: e ? "Focus view enabled" : "Focus view disabled" };
}
```

The renderer half is `vNt`'s
`focusFoldHoldsPreview = loading && briefTranscript && screen !== "transcript" && fullscreen && (tailBlank || streamingToolUses > 0 || iQo(messages))`,
whose result gates `Ue = D && _ && hasDisplayedStreamingText && !fold` — the block that renders the
streaming text. So the fold does not merely skip the next paint: while it holds, the already-painted
streaming block comes off screen, and the completed message still commits.

## Port

- `src/focus-command.ts`: `parseFocusArgument` (the grammar), `focusUnknownArgument`, `focusReport`,
  `focusModeFor`, `briefTranscriptEnabled` (`iTe`'s effective read over this host's single config)
  and `saveViewModeSetting` (`XMn`'s write, into the user settings file).
- `src/interactive.ts`: the `/focus` branch — parse, write, apply live, report; `COMMAND_HELP`, the
  autocomplete row (lane `config`) and the README line.
- `src/session.ts`, `src/runtime.ts`, `src/cli.ts`, `src/reload.ts`: the `viewMode` setting
  (`default | verbose | focus`) through parse, apply and reload, the same path `showMessageTimestamps`
  takes.
- `src/terminal.ts`, `src/tui.ts`: `setBriefTranscript`, the private live flag, `holdsFocusPreview`
  and `hideStreamingPreview`, plus `ThinkingProgress.hasActiveTools`.

## Adaptations and what stays out

- **The fold's three source terms map onto two local signals.** `turn.isLoading` is `this.running`;
  `streamingToolUses > 0` is `progress.hasActiveTools()` (the `tool-use` phase, which the agent sets
  when a tool starts and the next assistant text chunk ends — the same window); `tailBlank` (`sc`) is
  `derived.hideTrailingLine && !derived.displayedHasNewline`, the local run of the same three flag
  bits. `iQo(messages)` has no separate local reading, so it is folded into the tool term: a
  completed assistant message whose tools are still running is exactly the phase.
- **The preview is taken off screen, not merely skipped.** `paintAssistantPreview` refuses to paint
  while the fold holds, and a phase change that starts holding removes the streaming entry the
  earlier paint added; `assistantMessage.source` keeps the text, so the paint that ends the fold
  re-appends it. `endAssistantMessage` is never held, so a finished message always lands.
- **The two-source read collapses.** The recovered `iTe` reads flag settings first and the store
  second; this host has one config, so `/focus` writes `viewMode` and the same value is what the
  renderer reads. The `apply_flag_settings` event has no separate subscriber to wake.
- **Out: the non-fullscreen arm.** `bEo` answers a non-fullscreen presentation with the
  `/tui fullscreen` message. This host always draws the fullscreen renderer, so the arm cannot be
  reached; a piped session has no renderer at all and takes the text twin's own report instead.
- **Out: the managed-override arm.** `VTt()` re-reads the flag settings after the write and reports
  `Focus view is set by a managed "viewMode" setting` when they disagree. This host has no managed
  `viewMode` key, so the write always wins.
- **Out: the local-stdin refusal.** `bot(o)` is `submittedOnLocalStdin === true && !UF(o)`, where
  `UF` is the bridge or Slack dispatch flag; this host has no such submission channel.
- **Out: the panel's clear.** `bEo` calls `XMn(null)` first, which removes the `viewMode` key; the
  text twin always writes a value. The local command follows the text twin, and `default` and an
  absent key have the same effect.
- **Out: the remote suffix.** `Ijt` appends `(applied locally — this remote transport can't update
  the remote session)` when a remote transport exists; this host has none, so it returns null.
- **`verbose` is accepted and has no local effect.** The setting carries the source's three values
  for schema parity; only `focus` changes a render.
- **A save failure is reported, not thrown.** `XMn` would throw; the local command catches and
  prints `Couldn't save focus view: …`, the convention `/scroll-speed` set.

## Verification

- `test/focus-command.test.ts` (6 tests): the grammar including case and whitespace, the invalid
  line, the two reports and the two written modes, the effective read across all three view modes and
  an absent key, the write creating the file and preserving `theme`/`env`, and a non-object settings
  file being refused without being rewritten.
- `test/tui.test.ts` (3 new tests): focus takes the painted streaming preview off screen when the
  tool-use phase starts and the finished text still lands as one message; without focus the same
  phase leaves it on screen, and turning focus on mid-turn folds it; neither a non-tool phase nor a
  turn that is not running folds anything.
- Full suite 2912/2912 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w225-focus.mjs` passes 6 checks over the real CLI: with
  `{"viewMode":"focus","theme":"dark"}` in the user settings, a bare `/focus` reports
  `Focus view disabled` and writes `viewMode: "default"` while keeping `theme`; `/focus on` reports
  and persists `focus`; `/focus maybe` prints the recovered invalid line and changes nothing; and
  `/focus off` reports and persists `default`.
