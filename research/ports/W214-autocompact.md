# W214 the `/autocompact` command

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/autocompact`
is the window the auto-summariser fires at: the input bar had no way to see or change it, and the
recovered command has both a text grammar and its own dialog.

## What was there

The window itself, but nothing that could report or set it. `src/cli.ts` resolves
`config.compactAt = min(settings.compactAt ?? default, contextTokens - maxTokens - 8192)`, the
session schema requires a positive `compactAt`, and `src/agent.ts` compacts at that number. The
user settings key `compactAt` was readable only through the CLI flag. `COMMAND_HELP`, the composer's
command table and the loop's dispatch had no `autocompact` row.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-agx4redd.js` | `cab9f4f64094d99c72ce9e0ba08b19e54674d00ab32ffaca90dfd9667af6a6de` | 1005 | `g`, the source-label table |
| ↳ | | 1174 / 1968 / 3167 | `w` the status block, `$2t` the setter, `m2s` the empty-argument dispatch |
| `chunk-cj162a3d.js` | `59dc1de21ddf4f1e0c6756edeabdede1e2f3bebcb5b02699807004998801a62a` | 615 | the `local` registration's loader; the body is imports only |
| `chunk-c27zz9xr.js` | `c53fa3e31a80e202f6222f8a2fce021df73abf4d53961da47286de0a6472e94d` | 15738 / 15782 | `Fe` the setting reader; `C = 1e5`, `v = 1e5`, `x = 1e6`, `t = 0` |
| ↳ | | 15808 / 19858 | `ue` the dialog; `io` the `local-jsx` `call` |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 406553 | `Xd`, whose `settingsKey` the captions name |
| ↳ | | 859792 / 860242 / 861173 / 862752 | `pVt` the stored value, `fVt` the parser, `aE` the resolver, `Mwt` the override test |
| ↳ | | 1132446 / 1132674 | the `local-jsx` and `local` registrations |
| `chunk-ppsy9aeg.js` | `465947c512c63aa3df813d9f08b9abb0a1ae82d32b05de3ea872eed55094f756` | 1374 | `vD = 1e5` and `xN = 1e6` |
| `chunk-bk5ct2gw.js` | `efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1` | 386338 / 393400 | `qo` the display name; `SW = 200000` |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | 10967 | `Lr`, the compact token count |

The two handlers:

```js
function fVt(e){let n=e.trim().toLowerCase();if(n==="auto")return"auto";let r;
  if(n.endsWith("m"))r=parseFloat(n)*1e6;else if(n.endsWith("k"))r=parseFloat(n)*1000;
  else{let s=Dd(n);r=s>=100&&s<=1000?s*1000:s}
  if(!Number.isFinite(r)||r<vD||r>xN)return;return Math.round(r)}
function Mwt(e){return e==="env"||e==="settings"}
var m2s = async (a,n) => { let o = a.trim();
  if (!o) return { type:"text", value: w(n.options.mainLoopModel, n.options.autoCompactWindow) };
  return { type:"text", value: await $2t(o, n) } };
var io = async (P, l, m) => { let D = m?.trim() || "";
  if (D) { let o = await $2t(D, l); return P(o), null }
  return i("tengu_autocompact_dialog_opened",{source:S("dialog")}), e(ue,{onDone:P,caller:l}) };
```

`Lr` lowercases through `Bs`, so `1e6` renders as `1m`, not `1M`.

## Port

- `src/autocompact-command.ts` (new): `parseAutoCompactWindow` (`fVt`), `formatTokens` (`Lr`),
  `autoCompactLimit`, `resolveAutoCompactWindow` (`aE`, two sources), `autoCompactWindowText`
  (`w`'s `d` and the dialog's `h`), `autoCompactStatus` (`w`), `autoCompactDialogMessage`,
  `autoCompactChoices`, `autoCompactSelection`/`autoCompactSelectionValue` (`ue`'s `me` and the
  ring), `autoCompactUnchangedMessage`, and `applyAutoCompactWindow` (`$2t`).
- `src/theme-settings.ts`: `saveAutoCompactSetting` (writes `userSettings.compactAt`; `auto`
  deletes the key) and `readAutoCompactSetting` (the dialog needs the authored value, because
  `auto` and `default for this model` are different states with the same effective window).
  `SETTING_LABELS` and the value union gain `compactAt` and `number`.
- `src/interactive.ts`: a `/autocompact` branch beside `/copy`. A bare name opens the dialog when
  the terminal has a prompt surface and prints the status block otherwise, which is the
  `local-jsx` `io` and the `local` `m2s` split. An argument goes straight to `$2t`'s grammar. The
  accept writes the setting and sets `session.config.compactAt` to the ceiling-clamped window,
  the local stand-in for the recovered `apply_flag_settings`.
- `COMMAND_HELP`, `src/tui-autocomplete.ts` and the README take the `local-jsx` description
  `Set how full the context gets before auto-summarizing`.

## Adaptations and what stays out

- **The environment source is out.** `CLAUDE_CODE_AUTO_COMPACT_WINDOW` has no local counterpart,
  so `$2t`'s first branch, the dialog's lock line and `g`'s `env` label are unreachable, and `Mwt`
  reduces to "is the source settings". `--compact-at` is resolved at launch like the env var, but
  it is a CLI flag rather than a process variable, and the recovered tests the variable.
- **`experiment` and `clientdata` are out.** `F$e`, `Gso` and `zso` read model catalogues and a
  desktop entrypoint this host has no source for.
- **The enable toggle is out.** `ef()` reads `autoCompactEnabled`, which this host has no key for,
  so the "Auto-compact is currently disabled (see /config)" line never renders.
- **One window, not a per-model table.** The recovered `Duo` writes
  `userSettings.modelSettings[<key>].autoCompactWindow`; this host has a single `compactAt`, and
  `qo(settingsKey)` is the model id (`tui-statusline.ts` already sets `display_name: config.model`).
- **The ceiling is the launch-time limit.** `aE` clamps to the model's context window; this host
  clamps to `contextTokens - maxTokens - 8192`, which is the expression `src/cli.ts` already uses.
  The stored value keeps what was asked for, so the `capped` suffix still means what it does in the
  recovered code, and the next load re-clamps. The probe confirms 1m stores `1000000` and runs at
  `975424`.
- **The dialog warning reflects the opening state.** The recovered line follows the selection
  (`a !== t`). A `readDialog` body is fixed when it opens, and `TerminalPromptChoice.description`
  renders for every row, so the line cannot follow a move. Both opening states match: a stored
  window opens on its own row with the warning, an unset one opens on auto without it.
- **The adjust ring is a list.** `ue` steps by `C` with `left`/`right` and wraps at both ends onto
  auto. The chooser lists the same eleven values, auto first, so the reachable set is identical
  without the wrap.
- **Telemetry dropped.** `tengu_autocompact_command` and `tengu_autocompact_dialog_opened` are not
  ported.

## Verification

- `test/autocompact-command.test.ts` (new, 13 tests): every multiplier and the thousand shorthand,
  the `100k` floor and `1m` ceiling with the values just outside them, the compact count including
  `975.4k`, the two sources and the ceiling clamp, both captions, the status block with and without
  the override line, the dialog body, the eleven choices, the rounded and clamped initial row, the
  set / cap / auto / alias / unparseable arms, and the unchanged caption.
- `test/interactive.test.ts` (+1 test): a live session takes `/autocompact`, `300k`, `1m`, `reset`
  and `2m`, asserting the status block, the stored value, the live `session.config.compactAt` after
  the ceiling clamp, the deleted key, and each recovered sentence.
- Full suite 2808/2808 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w214-autocompact.mjs` passes 14 checks over the real CLI: the dialog opens
  on auto with the source caption and both paragraphs, Escape prints the unchanged caption, five
  steps reach the 500k row, the accept writes `500000` and reports it, a stored window reopens on
  its own row with the source and the warning, `300k` stores `300000`, `1m` reports the cap and
  keeps `1000000`, `reset` clears the key, and `2m` repeats the recovered sentence.
