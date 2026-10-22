# W273 effort slider ultracode

The `tab` toggle and the `ultracode [on|off]` argument arm on the effort surface. Offsets are
zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-0q6c90q6.js` | `97c49a70fcefc8407f6fc93c4b4c8d50a7b63ca8c6d3a3aba6627e91c761457b` | `wyt` 1313 | `dynamic workflows on every task` |
| ↳ | | `g` 1668 | the valid-options list |
| ↳ | | `yhn` 1351 | the usage text, with its ultracode paragraph |
| ↳ | | `V` 4505 | `auto` clears the level |
| ↳ | | `k` 5283 | the ultracode toggle and its two refusals |
| ↳ | | `A` 5896 | the `ultracode [on\|off]` parser |
| ↳ | | `P` 6037 | the argument dispatch: auto → ultracode → level |
| `chunk-76jkr621.js` | `09c383199652e7be3cc3b79215c6616e6653f6fa65c265ebe5e99e7dc43ae04e` | `Ce` 17497 | the accept that joins level and ultracode changes with ` · ` |
| ↳ | | `Lt` 30123 | the `Ultracode  on` / `Ultracode  off` row and its chord line |
| ↳ | | `It` 22174 | the slider body: `tab` flips the flag without closing |
| ↳ | | `Ut` 30750 | the select page whose sentinel row sends `ultracode on`/`ultracode off` |

## Behaviour

- **Gate.** `k` refuses `ultracode on` when dynamic workflows are off (`Ultracode needs dynamic
  workflows enabled (see /config).`) or the model does not support them (`Ultracode isn't available
  on <model>.`). Turning it off is always allowed.
- **Message.** On: `Ultracode on (this session only): dynamic workflows on every task. Effort stays
  <level>.` Off: `Ultracode off. Effort stays <level>.` The level is the session's, falling back to
  the model default.
- **Scope.** The flag rides the session, never the settings document.
- **Parser.** `A` accepts exactly `ultracode`, `ultracode on` and `ultracode off`; any other
  spelling falls through to the level parser, which reports it as invalid.
- **Usage.** With workflows on, `yhn` grows an `Ultracode (any effort level, …)` paragraph, the
  argument hint grows `|ultracode [on|off]`, and the valid-options list grows `ultracode`.
- **Slider.** `tab` flips the row and leaves the dialog open; the row reads `Ultracode  on` in the
  `effortUltra` colour, or a bold `Ultracode` and a dim `off`. While on, a dim
  `Ultracode: dynamic workflows on every task` line sits under the track.
- **Accept.** A changed flag and a changed level share one accept, and the two messages join with
  ` · `.

## Host adaptations

- **Gate.** `ZI()` is `config.features.workflow`, the same flag the workflow tools read.
- **Session field.** `SessionConfig.ultracode` is new; `effortCommand` reports it as
  `ultracode?: boolean` and the handler writes or deletes it.
- **Slider toggle.** `TerminalPromptAdjust.toggle` is a new optional field: the dialog host flips it
  on the declared key and re-renders, and the settled answer carries `toggled`. The recovered
  select page (`Ut`) has no local counterpart, so its sentinel row is not ported; the tab path
  covers the same transition.
- **Key decoding.** The decoder reports `tab` as a `key` action with an empty command, so the
  slider branch matches its sequence as well as the declared key.
- **Not ported.** The select page, the `tengu_effort_command` telemetry event and the
  model-support probe's remote lookup.

## Validation

Unit 17/17 (`test/effort-command.test.ts`) and 4/4 (`test/effort-slider.test.ts`); focused effort
and interactive 47/47; compiled 12/12 at identity `6ab5dabb…`; full suite 3151/3152 with the known
`cli-migration` effort failure.
