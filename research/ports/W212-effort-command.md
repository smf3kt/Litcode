# W212 the `/effort` command

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

The user reported that `/effort` was still not done. It accepted five bare words, threw on anything
else, and printed nothing on success, so the level was set invisibly and no other argument form
worked.

## What was there

`src/interactive.ts` carried a single branch:

```ts
const effort = prompt.slice(8).trim();
if (!['low','medium','high','xhigh','max'].includes(effort)) throw new Error('Use /effort low|medium|high|xhigh|max');
config.effort = effort as NonNullable<typeof config.effort>;
```

The plumbing under it was sound: `config.effort` reaches the request as `output_config.effort`
(`src/agent.ts:184`, `src/mcp-host.ts:208`), and `src/cli.ts:284` reads `settings.effort` back on
the next start. The gap was the command surface.

## Recovered source

Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-tf9zceev.js` | `ca7616f7ec5d200996ce7390e7c178b231760acfa088b6d655af8b132574e4cb` | `u` [4922,5480) | the non-interactive handler |
| `chunk-0q6c90q6.js` | `97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b` | `F` 1011, `wyt` 1313, `yhn` 1351, `g` 1668, `djr` 1763 | the usage table, the ultracode sentence, the usage builder, the option list, the parser |
| ↳ | | `D` 2541, `v` 4018, `VBt` 4189, `V` 4505, `k` 5283, `A` 5896, `P` 6037, `MOe` 6286 | the level setter, the override reader, the status builder, the auto setter, ultracode, the argument dispatch, the applier |
| `chunk-9vcaezw1.js` | `eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0` | `ZI` 5771, `VC` 5819, `CS` 6206, `NNe` 7175, `mde` 7571, `Y9` 7619 | the workflow gate, the ultracode predicate, the level test, the organization default, the offered levels, the cap clamp |
| ↳ | | `re` 8196, `VJ` 8408, `qJ` 8440, `Z_e` 8999, `Y0` 9148, `Git` 9384, `Qre` 9529 | the alias map, the display, the parser, the persistable set, the env override, the effort values |
| ↳ | | `RNn` 11760, `kE` 12972, `we` 13897, `X9` 13965, `qC` 14204, `De` 14578, `Nuo` 15007 | the settings read, the effective level, the settings write, the save gate, the fallback, the descriptions |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | `Ia` @29926, `V$` @29967 | the level list, the excessive-token note |
| ↳ | | 65823 | `Xxs`/`Enn`/`Ivo`/`Jxs`/`Qxs` = `○ ◐ ● ◉ ◈` |
| `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` | `UP` @10522 | `["help","-h","--help"]` |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `eee` @153296, `z$` @153407 | the level-change notice and its glyph selector |
| ↳ | | 894081 | the notice call site, key `DS = "effort-level"`, `kind:"feedback"`, `timeoutMs: 1e4` |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `Mjt` @1659192, `local-jsx` @1659314, `local` @1659513 | the argument-hint builder and the two `effort` registrations |

The handler's shape, read from the bundle:

```js
async function u(s,t){
  let e=s.trim(), o=t.getAppState(), r=Dt(o.mainLoopModelForSession??o.mainLoopModel??q_());
  if(UP.includes(e))return{type:"text",value:yhn()};
  if(e==="current"||e==="status"){let{message:a}=VBt(Xh(t),r,o.ultracode);return{type:"text",value:a}}
  if(!e)return{type:"text",value:`Usage: /effort <${mde(r).join("|")}|auto${ZI(r)?"|ultracode [on|off]":""}>`};
  return{type:"text",value:(await MOe(e,{effort:Xh(t),ultracode:o.ultracode,route:"noninteractive"},
    t.setAppState,!t.options.isNonInteractiveSession,t.storageV5)).message}
}
```

Two consequences drive the port. A bare argument returns the **short** hint, while the full `yhn`
block is only the `UP` answer. And the returned value is `{type:"text"}`, which the dispatcher
prints as text; the `eee` notice is a separate status-row surface raised from an effect that
watches the effective level.

## Port

- `src/effort-command.ts` (new) carries the vocabulary: `EFFORT_LEVELS` (`Ia`), `EFFORT_ALIASES`
  (`re`), the `USAGE_DESCRIPTIONS` table (`F`), `effortDescription` (`De` through `Nuo`),
  `effortGlyph` (`z$`), `isEffortLevel` (`CS`), `parseEffortLevel` (`qJ`), `persistableEffort`
  (`Z_e`), `effortUsage` (`yhn`), `effortArgumentHint` (`Mjt` with `<`/`>`), `effortStatus`
  (`VBt`), `effortIndicator` (`eee`), `effortOverride` (`Y0`) and `effortCommand` (`P`, with
  `setLevel`/`setAuto` for `D`/`V`).
- `src/theme-settings.ts` gains `saveEffortSetting`: the same synchronous, mode-preserving,
  size-bounded write the theme and editor-mode setters use. `saveDisplaySetting` now treats an
  `undefined` value as the removal `X9(undefined, …)` performs, which is what `auto` means.
- `src/interactive.ts`: the `/effort` branch calls `effortCommand`, answers a read-only result on
  the output stream and `continue`s, otherwise applies the level, writes the settings and prints
  the answer after `applyConfig`, with the `eee` notice on the status stream.
- `src/tui-autocomplete.ts` and `COMMAND_HELP` take the recovered description
  `Set effort level for model usage`.
- A bare `/effort` on a terminal opens the `Effort` chooser before the argument grammar runs; the
  non-terminal path keeps the short hint.

## Adaptations and what stays out

- **The per-model cap is out.** `E7t`/`w_r` and the `Y9` clamp at 7619 read a model-capability
  table this host has no source for, so `mde` offers every level and `D`'s "exceeds the cap for
  `<model>`" branch is unreachable. `DEFAULT_EFFORT` is the `high` fallback `qC` at 14204 returns
  when `kE` finds nothing, which is also the `src/cli.ts` default.
- **Ultracode is out.** `ZI`/`VC`/`k`/`A` need the session-wide workflow opt-in and its
  system-reminder; `ZI` is false here, so `yhn` and `g` render the `ZI` false form, a state the
  recovered product also produces.
- **The remote transport is out.** `vr`, `R`/`O`, the `is_remote` telemetry and the "this remote
  transport can't change the remote session's settings" suffix have no local counterpart.
- **The env override is `LLM_EFFORT`.** `Y0` reads `CLAUDE_CODE_EFFORT_LEVEL`; this host's flag,
  environment and settings chain is `--effort` → `LLM_EFFORT` → `settings.effort` in
  `src/cli.ts:284`, so the override reads the same variable the launcher does and the messages
  name it. The raw string is interpolated, as `D` does with `a.CLAUDE_CODE_EFFORT_LEVEL`.
- **`max` writes nothing.** The recovered `X9` gate is `r && (e===void 0 || f!==void 0)` with
  `f = Z_e(e)`; for `max` both clauses are false, so the store is left untouched rather than
  cleared. The port models that as an absent `saved`, distinct from `auto`'s `null`.
- **The answer goes to the transcript, the notice to the status row.** The recovered `u` returns
  `{type:"text", value}` and `eee` is a `feedback` notice. The local status row clips to about
  half the terminal, so the long answers would be cut; writing them to the output stream keeps
  the recovered split and the full text.
- **No 10-second expiry.** The recovered notice carries `timeoutMs: 1e4`; this host's status
  stream is a plain writable with no timeout form, so the notice stands until the next status
  write, as `/model` and `/thinking` already do.
- **The slider is a chooser.** The `local-jsx` registration at `chunk-sfn1dbxq.js` 1659314 opens
  `EffortSlider` (`chunk-76jkr621.js` [18600,27000)): a 42-cell `─` track, triangle positions
  `[1,10,20,30,40]`, spacers `[5,5,5,6]`, the `Faster … Smarter` caption, and left/right stepping
  plus `s` for this-session-only. The local dialog host has choices, not keyed adjustment, so a
  bare `/effort` on a terminal opens the same `Effort` title and caption as a five-row chooser with
  the current level preselected, each row carrying its glyph and the `De` description; picking one
  runs `/effort <level>`. The track, the triangle, the `s` binding and the rainbow `max` styling
  are out. `MAX_EFFORT_NOTE` and the descriptions are the same strings the slider's `Nt` shows.
  Superseded by [W231](W231-effort-slider.md): the standalone source slider, styles, keys and save
  scopes are now ported. Its AST-verified ranges replace the reconnaissance range above.

## Verification

- `test/effort-command.test.ts` (new, 13 tests): the level order and the `med` alias; the
  persistable set; the glyph string; the exact usage block; the `max` note; the short hint versus
  the help block; the invalid-argument answer; the saved-scope answer; `max` leaving the store
  alone; `auto` clearing it; both status forms; the indicator; and `LLM_EFFORT` overriding,
  including the session-only refusal and the `auto` message.
- `test/interactive.test.ts` (+1 test): a live session runs every argument form, asserts the
  settings file holds `high` after the change, still holds `high` after `max`, and has no `effort`
  key after `auto`; the answers land on the output stream and the `eee` notices on the status
  stream, with no notice for `auto`.
- The existing bare-command test changed: `/effort` now answers with its usage instead of the old
  error, which is the recovered behaviour.
- Full suite 2784/2784 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w212-effort.mjs` passes 14 checks over the real CLI: the chooser with its
  preselected level, every glyph and description, and Escape leaving the level alone; the full help
  block; `auto (currently high)`; the set answer with its scope; the `● high · /effort` notice; the
  `high` write; `max` as session-only with the store intact; the invalid-argument answer; `auto`
  removing the key; and `output_config.effort: "low"` on the next request.
