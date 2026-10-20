# W215 model selection

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands, and the second
surface the loop request names. `/model` already opened a chooser, but it was the local one: a flat
row list with an Other input, no effort axis, no default persistence, and a caption written here.

## What was there

`src/interactive.ts` built the rows from the current model plus the models declared by agent types,
skills and recent sessions, titled the dialog `Model`, captioned it `Current: X` plus
`Choose a local model or enter another gateway model ID.`, and applied the pick through
`prompt = /model <id>`. Nothing was written to the user settings, so a pick never became the default
for a new session, and there was no way to set the effort while choosing.

The dialog host had one axis: up/down moved the selection. Left and right were unbound outside the
grouped question flow, and there was no way for a request to name a key of its own.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 617964 / 617998 | `Dy` the no-preference sentinel, `uBe` the picker |
| ↳ | | 620947 | the three `modelPicker:` actions |
| ↳ | | 622189 / 622237 | the title and the caption |
| ↳ | | 622880 | `No models match "<q>"` |
| ↳ | | 623104 / 623444 | the `effort` word and `Effort not supported` |
| ↳ | | 624054 / 624441 | `set as default` and `use this session only` |
| ↳ | | `KHe` 624931, `yG` 625236 | the stepper and the per-model effort record |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | 7848 | `ModelPicker`: `left`/`right` step the effort, `s` accepts session-only |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `bWe` 1650764 | the `local-jsx` registration, description `Set the AI model … (currently <model>)` |
| `chunk-naxwgf3s.js` | `7ab116f8d6a266f3bc1b0e3d9d3e82bb5c60825a6ffa08c59cf1ad5925219c1d` | 14224 | the non-interactive handler, which saves the default unless it is non-interactive |

The two arms that decide the accept:

```js
function KHe(h,T,M,L,ee){let he=M.filter((Le)=>(Le!=="max"||L)&&(Le!=="xhigh"||ee)),
  we=h==="max"&&!L||h==="xhigh"&&!ee?"high":h,Te=he.indexOf(we),
  Me=Te!==-1?Te:he.length-1;
  if(T==="right")return he[Math.min(Me+1,he.length-1)];else return he[Math.max(Me-1,0)]}
// accept
let as = Er && ar !== void 0 ? Y9(ar, Er) : ar;   // ar = the adjusted value
let ws = ds && Er && Vb(Er) ? as : void 0;        // ds = the axis was touched
M(Xn, ws)
```

and the two accept paths, which differ only in the default write:

```js
function Pr(Xn){if(L)L(Xn===Dy?null:Xn);dr(Xn)}   // enter and row click: set as default
"modelPicker:thisSessionOnly":()=>{ … dr(Er.value) }   // s: session only
```

## Port

- `src/terminal.ts`: `TerminalPromptRequest.adjust` (the arrow axis, with its formatter and guide)
  and `.keys` (keys that resolve the dialog and are reported in the answer), plus
  `TerminalPromptAnswer.adjusted` and `.key`.
- `src/tui.ts`: the axis position on the dialog state, left/right handling that runs before the
  list navigation and only while a row holds the focus, the keyed accept, the axis line drawn under
  the selection, the guide override, and `adjusted` attached in `advanceDialog`. The request
  snapshot clones the plain fields and carries `adjust` by reference, because `structuredClone`
  cannot copy its formatter.
- `src/model-picker.ts` (new): `MODEL_PICKER_TITLE`, `modelPickerCaption`, `modelPickerGuide`,
  `modelPickerEffortStep` (`KHe`), `modelPickerEffortLine`, `modelPickerRowDescription` and
  `modelPickerEffortFor` (the `ws` gate).
- `src/theme-settings.ts`: `saveModelSetting` writes `userSettings.model`, which `src/cli.ts`
  already reads ahead of the inherited model.
- `src/interactive.ts`: the `/model` chooser takes the recovered title, caption, row description,
  effort axis and `s` key; the accept writes the default and carries the adjusted effort into
  `config.effort`. An accept on the row already in use passes the effort straight to the live
  session, because the request builder reads `session.config.effort` on every call.

## Adaptations and what stays out

- **The catalogue is out.** `Ypo` and the account-gated option sources fill the recovered rows with
  vendor families, pricing and notices. The rows stay this host's own model set, so the search
  guides (`Type to search`, `Type to filter`) and `No models match "<q>"` are unreachable: the
  local text row is an Other answer, not a filter.
- **The capability table is out.** `yG`'s `Vb`/`Jre`/`Bit`/`mde`/`w_r` read a per-model record
  this host has no source for, so every model offers every level, `KHe`'s fold of an unsupported
  `max`/`xhigh` down to `high` never fires, and `Effort not supported` never renders.
- **The caption drops the vendor name.** The recovered line opens `Switch between Claude models`;
  this host talks to a gateway with arbitrary model ids, so it reads `Switch between models` and
  the rest is verbatim.
- **One axis per dialog, not per row.** The recovered resets the adjusted value when the focused
  row changes (`ys`); the local axis is a single value for the dialog, so a move carries to
  whichever row is accepted.
- **The session-override line is out.** `Currently using X for this session only (base model: Y)`
  needs a session-override state kept apart from the live model; this host has only the live model.
- **The default write needs a user directory.** `userSettings.model` is what a new session reads,
  so a session built without `configSources.userDir` (the embedded and test hosts) skips the write
  instead of falling back to the home directory.
- **The `(currently <model>)` description is out of the composer.** The registration's description
  is a getter over the live model; the local composer row keeps its static description.
- **Telemetry dropped.** `tengu_model_command_menu_effort` and `tengu_model_picker_search` are not
  ported.

## Verification

- `test/model-picker.test.ts` (new, 5 tests): the title, caption and guide; the step at both ends
  and in the middle; the effort line with and without the default mark and the `xHigh` spelling;
  the synthesized row description; and the touched-only effort gate.
- `test/interactive.test.ts` (+1 test): a live session takes `/model second-model` twice, asserting
  the settings file holds the pick and the status row reports each switch.
- Full suite 2814/2814 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w215-model-picker.mjs` passes 11 checks over the real CLI: the picker
  opens with the recovered title, caption, row description and guide, two right presses reach
  `xHigh` then `max` without moving the selection, enter switches to the focused row and writes
  `settings.model`, the adjusted effort arrives as `output_config.effort: "max"` on the next
  request, the reopened picker marks the new current row, and `s` switches the model while leaving
  the stored default alone.
