# W279 live drained-shell row

The progress row a drained `!` command owns while it runs: `Running… ` before its first poll, then
the clipped tail of its output with a count, an elapsed/timeout and a byte column. W278 ported the
rows a drained command leaves behind and recorded this live row as not ported; this package adds
it. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 1368887 | `y4 = "drained-shell-line"`: the fixed id |
| ↳ | | 1372743 | `emitToolProgress`: a new `bash_mode_progress` clears the old `y4` entry first |
| ↳ | | 1372925 | `showDrainedShellLine`: publishes the row and returns its disposer |
| ↳ | | 1376160 | `reset()`'s `clearToolProgress()`, the whole-store clear |
| ↳ | | 1521987 | `tTe`: the `<bash-input>` line above the row, then `fIe` |
| ↳ | | 1523589 | `nTo`: which progress kinds the region draws (`bash_mode_progress: true`) |
| ↳ | | 1524370 | `Y4`: the progress region over every store entry |
| `chunk-3yqee67r.js` | `df651f4891a511f06dca4337632f3641ae3307800138064be0818eaab1e352ec` | 1136 | `x=5`, `G=5`: the five kept rows and the gutter |
| ↳ | | 1148 | `fIe`: the row's four parts and its `Running… ` arm |
| ↳ | | 2503 | `UHr`: the collapse gate |
| ↳ | | 2609 | `v`: the tail clip, its ANSI strip and its dropped-line count |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 4322055 | `hOn = 2000`: the shell poll interval |
| ↳ | | 4340642 | `Czr`'s `bash_progress` frame: `output`, `fullOutput`, `elapsedTimeSeconds`, `totalLines`, `totalBytes`, `timeoutMs` |
| ↳ | | 4352191 | the poll loop's `yield {type:"progress"}` |
| `chunk-w79px1ss.js` | `dddc2e68d8a7ae860270520bcfe5c1aaea5e0898b88c3f6d06f2f46c89ce0f30` | 14067 | `processBashCommand`'s opening `emitToolProgress` |
| `chunk-w174g2nz.js` | `1486005572e09edd852887141cfd61b8808279f9c3a39d1cb1e567f2d9e990e6` | 956 | `_ie`: the dim `(12s · timeout 30s)` column |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | 9654 | `rn`: the duration grammar |
| `chunk-5sxzysbh.js` | `f011c32103b7ae04033cdff3555774f413ee90c5b1bc0d0ae7a725a33a1ff162` | 615 | `Qt`: the byte column |
| `chunk-gyf58rwf.js` | `7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad` | 9160 | `$N`: the per-run ANSI strip |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` | 3561 | `Lt`: the newline count |

## Behaviour

- **One row, one id.** `showDrainedShellLine(input, verbose)` publishes
  `{kind:'bash_mode_progress', toolUseId: y4, input, progress: null, verbose}` and hands back a
  disposer that clears the row only if the store still holds that same object. `emitToolProgress`
  clears the previous `y4` entry on every `bash_mode_progress` publish, so a second command
  replaces the first one's row rather than stacking a new one.
- **When it runs.** `processBashCommand` calls `emitToolProgress` before the shell starts, so the
  row exists from the first frame; the call's own result replaces it. The region draws it only
  when the store holds a `bash_mode_progress` entry (`nTo`).
- **The row.** `fIe` takes `{output, fullOutput, elapsedTimeSeconds, totalLines, totalBytes,
  timeoutMs, verbose}`. With no body it prints `Running… ` plus `_ie`'s elapsed column; with a body
  it prints the body dim, then a row of the count column, `_ie`'s elapsed column and `Qt`'s byte
  column, gap 1.
- **The body.** `v` strips ANSI from the whole output, normalises CRLF, drops empty lines, and
  walks backwards keeping whole lines until five rows are spent. A line that does not fit keeps
  its own tail and reports the lines dropped so far. Verbose skips the clip entirely and shows the
  whole output (`fIe`'s `a ? null : v(m,c)`).
- **The count.** `fIe` prefers `~${totalLines} lines` when it has both a byte count and a line
  count, and otherwise prints `+${dropped} lines`, where the dropped count is the lines past the
  shown ones plus the clip's own drop.
- **The collapse gate.** `UHr` shows the row only once `fullOutput` has content and the line total
  exceeds the five kept rows or the clip dropped something; `tTe` passes `verbose || hovered` so
  the row expands on hover.
- **The cadence.** The shell polls its own output every `hOn` = 2000 ms and yields one progress
  frame per poll with the running totals.

## Host adaptations

- **The frame comes from the pipe, not a task store.** This host's `run_command` has no task
  output file to poll, so `runShell` takes an optional `onProgress` and emits the same snapshot on
  the source's own 2000 ms cadence (`SHELL_PROGRESS_INTERVAL_MS`). `output` and `fullOutput` are
  both the retained tail, since the host keeps only that tail; `totalLines` counts newlines as
  they arrive and `totalBytes` counts every byte.
- **`tTe`'s first line is already in the transcript.** The source draws the `<bash-input>` row and
  `fIe` together. This host appends the `<bash-input>` row at submit (W278), so the live row is
  only `fIe`'s body and columns; drawing the input line again would duplicate it.
- **The row lives in the progress region.** `renderProgress` prepends it to the agent's progress
  rows, which is where `Y4` puts every store entry. With no agent progress running the region
  holds only this row.
- **`verbose` follows the live switch.** `setVerbose` already repaints; `renderDrainedShell` reads
  `this.verbose` at paint time, so the row expands with the rest of the transcript.
- **The disposer is a `finally`.** `runBashCommand` publishes the empty row before the call and
  clears it in `finally`, so an abort or a thrown tool never leaves the row behind.
- **Not ported.** The hover expansion (`tTe`'s `he` state, which has no mouse hover in this host's
  progress region), the `background_hint` and `agent_progress` siblings of `nTo`, and the
  `reset()` store clear (the session's own teardown closes the terminal).

## Validation

Unit 13/13 (`test/tui-bash-mode.test.ts`): the earlier ten plus the byte/duration/elapsed columns,
the `Running… ` arm, the clipped tail with its count, the verbose arm, the collapse gate, and a
real `TuiTerminal` run where the row draws `Running… `, then the tail with `(3s)` and
`14 bytes`, then clears. `test/tools.test.ts` 32/32 with the new cadence test: a 2.4 s command
yields exactly one frame at 2 s carrying its first line. Focused 112/112
(`test/tui.test.ts`, `test/terminal.test.ts`). Full suite 3196/3197 with the known
`cli-migration` effort failure only. Compiled 9/9 at identity `cdb8e734…`: a 2.6 s drained
command's first line appears while it runs, the row carries an elapsed column, the finished output
lands, the model is asked about it, and the row is gone afterwards.
