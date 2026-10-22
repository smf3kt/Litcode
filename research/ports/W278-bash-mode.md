# W278 composer bash mode

The `!` entry that turns the draft into a shell command, the pointer and border it paints, the
footer label, and the rows a drained command leaves. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-k0f477m1.js` | `2c89d198bcc1bc7db4efcd69212bc5fddb7c440bc1472156041b639182da01a9` | 615 | `BEe`: a queued command keeps the `!` its mode needs |
| ↳ | | 686 | `x_`: a value beginning with `!` reads as bash |
| ↳ | | 727 | `sI`: bash mode's value is the draft without its `!` |
| ↳ | | 797 | `Jgt`: the bare `!` check |
| ↳ | | 833 | `J1o`: the mode-switch detector (caret 0, mode change, one-character growth or empty previous value) |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 84305 | `bZ`: the entry handler |
| ↳ | | 84746 | `Me.setBash=!1,M.setMode("prompt")`: the backspace unwind |
| ↳ | | 84909 | `M.setMode("bash"),Me.setBash=!0`: the empty-composer `!` arm, with `gSt` (85305) as its printable gate |
| ↳ | | 754674 | `Sce`: the dense footer's `shell mode`, dim and italic |
| ↳ | | 764095 | `LVe`: the sparse hint's `! for shell mode` in `bashBorder` |
| ↳ | | 814893 | `Rzt`: the composer border slot (`bashBorder` in bash mode) |
| ↳ | | 815001 | `Pzt = 24`: the agent-chip clip width |
| ↳ | | 815556 | `uT`: the pointer, `!` in bash mode |
| ↳ | | 815713 | `QE`: the escape/delete/backspace/ctrl+u exit at caret 0 |
| ↳ | | 1310609 | the user row's `<bash-input>` wrap |
| ↳ | | 1368887 | `y4 = "drained-shell-line"`: the live row's fixed tool id |
| ↳ | | 1372925 | `showDrainedShellLine`: the live progress row |
| ↳ | | 1492848 | the submit path's `setMode("prompt")`, skipped for a `diff` source |
| ↳ | | 1522655 | `umt`'s `<bash-input>` transcript row |
| `chunk-w79px1ss.js` | `dddc2e68d8a7ae860270520bcfe5c1aaea5e0898b88c3f6d06f2f46c89ce0f30` | 14067 | `processBashCommand` `V`: the `<bash-input>` row, the shell call, the `<bash-stdout>`/`<bash-stderr>` result and `shouldQuery` |
| `chunk-ts42ykgs.js` | `d8b5f9ef6550b5e71556d694a6f054baf30aaaedd82983b1c169c3b3523eed33` | 24080 | `$t`: the `&`/`<`/`>` escaping |
| `chunk-3yqee67r.js` | `df651f4891a511f06dca4337632f3641ae3307800138064be0818eaab1e352ec` | 1120 | `fIe`'s `x=5`/`G=5` bounds |
| ↳ | | 1148 | `fIe`: the live drained row |
| ↳ | | 2503 | `UHr`: the collapse gate |
| `chunk-phg89898.js` | `b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3` | 109053 | `umt`: the `<bash-input>` transcript row |
| ↳ | | 109547 | `hXe`: the result-row test |
| ↳ | | 109629 | `wp`: the stdout/stderr split |
| `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` | 8822 | `fwe`/`Dpe`/`lG`: the `bash-input`/`bash-stdout`/`bash-stderr` names |
| ↳ | | 8947 | `cG`: `local-command-caveat` |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | 66130 | `Zxs = "\xA0"`: the pointer's trailing NBSP |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 4357386 | `Mle`: the `<bash-input>` reader |
| ↳ | | 4382813 | `tye()`: the `local-command-caveat` meta row |
| `chunk-crw1fpdp.js` | `c1e44f5fadbcdf86180d66b7ada6c9bd66d08ca8fe5fa2df323d502135d6f147` | 3923 | `wXe`: the result block's stdout/stderr bodies |
| `chunk-g8ycwp9n.js` | `2a0835fdb92089660fff9327688f2a5b96a08b1ed5ab3e6866dd3756a3dd4089` | 662 | `Cs`: the tag extractor `wp` uses |

## Behaviour

- **The entry.** `bZ` reads a printable key (`gSt`), and when the composer is empty and in
  prompt mode, a value starting with `!` sets the mode to bash and strips the marker before the
  insert. `J1o` covers the prepend case: the caret at 0, a value that now reads as bash, a mode
  that did not, and a one-character growth (or an empty previous value).
- **The exit.** `QE` leaves bash mode when the caret is at 0 and the key is escape, delete, or
  backspace/ctrl+u; backspace also consumes the key so the emptied command does not type into a
  prompt composer. Backspace on an empty bash composer unwinds the mode through `Me.setBash=!1`
  without deleting anything.
- **The pointer and border.** `uT` gives bash mode `!` plus `Zxs`; `nP` paints it in
  `bashBorder`. `Rzt` is the composer's border slot, `bashBorder` in bash mode.
- **The footer.** `Sce` is the dense footer's `shell mode` (dim and italic); `LVe` is the sparse
  hint's `! for shell mode` in `bashBorder`. `nv()` picks between the two layouts.
- **The submit.** The submit path resets the composer to prompt mode (`1492848`) unless the
  source is a `diff`, so a bash submit leaves no `shell mode` row behind. The user row is the
  command wrapped in `<bash-input>` (1310609); `tTe`'s transcript row reads it back through
  `Mle` and paints `! ` in `bashBorder` over `bashMessageBackgroundColor` (`umt`).
- **The drain.** `processBashCommand` appends the `<bash-input>` row, runs the shell tool, and
  appends `<bash-stdout>…</bash-stdout><bash-stderr>…</bash-stderr>` with `$t`'s three escapes.
  `shouldQuery = respond && !interrupted && !backgroundTaskId && !aborted`, where `respond` is
  `ft().respondToBashCommands ?? true`. When it is false the result carries `tye()`'s
  `local-command-caveat` meta row first.
- **The live row.** `y4`/`showDrainedShellLine` publish one progress row under the fixed
  `drained-shell-line` id; `fIe` keeps its five trailing lines and `UHr` decides whether the row
  is shown at all.

## Host adaptations

- **The shell lane is `run_command`.** The recovered body calls the shell tool's `call`
  directly with `dangerouslyDisableSandbox: true` and no permission decision; this host's lane is
  already unconfined inside the user's permissions, and `allowShell` is the switch that gates it.
  The call reuses the existing tool rather than spawning a second shell, so the process group,
  timeout and abort behaviour are the ones the product already has.
- **The result note is the stderr side.** `run_command` ends its text with
  `[run_command: exit code N]` (or the timeout/abort note); the port splits that note off and
  passes it as the `<bash-stderr>` body, which is the closest local counterpart of the source's
  own stderr block. A timeout is treated as an interruption for `shouldQuery`.
- **`respondToBashCommands` is a setting.** It rides the same four mapping points as the other
  display settings (`session.ts` schema and type, `runtime.ts`, `cli.ts`, `reload.ts`), defaulting
  to true. When false the turn ends with `turn_end: bash_command` so the session does not stay
  awaiting a response.
- **The composer mode lives on both surfaces.** `TuiTerminal` and the line-mode `TerminalInput`
  each carry the mode; the line mode echoes `<bash-input>` on submit and renders the `!` pointer
  through `composerPointer`.
- **One footer row.** This host's footer is a single row, so the `Sce` dense label is painted in
  `bashBorder` rather than dim italic; the text is the source's.
- **The transcript row is painted, not parsed by markdown.** `bashEntryRows` reads the two tags
  back out and paints the blocks with the theme's `bashMessageBackgroundColor`, the source's own
  background slot. The `<bash-input>` tag is not shown to the person; the model still receives it.
- **Not ported.** The live drained-shell progress row (`y4`/`fIe`/`UHr`) has no producer here
  because `run_command` reports only on completion; the PowerShell arm; `backgroundTaskId`; the
  IDE-selection handoff; the `diff`-source exemption in the submit reset.

## Validation

Unit 10/10 (`test/tui-bash-mode.test.ts`): the mode readers, the switch detector's five
cases, the queued-command marker, the pointer and its 24-cell clip, the three escapes, the
result row's two tags and their read-back, the input row's round trip, the caveat's product
name, the five-line tail, and a real `TerminalInput` run: `!` enters bash without entering the
value, submit carries the mode and returns to prompt, and backspace on an empty bash composer
drops the mode. Full suite 3192/3193 with the known `cli-migration` effort failure only.
Compiled 10/10 at identity `b6aa68f4…`: the footer reads `shell mode` after `!`, the draft
stays empty, the command's output lands, the transcript row is `! echo hello-from-bash`, the
provider request carries the `<bash-input>` row and the output, the answer follows, the composer
is back in prompt mode, and `/exit` returns 0.
