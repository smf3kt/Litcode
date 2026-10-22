# W280 queued shell command pull

A queued `!` command now pulls back into the composer. The composer refuses the pull while the
draft is non-empty, reports the source's notice, and puts the composer in bash mode when the pull
succeeds. The batch pull keeps shell entries out of a non-empty draft. Offsets are zero-based
UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 218170 | `Kp`: an editable, non-meta, person-origin entry |
| ↳ | | 218238 | `zMe(e,n)`: `Kp(e) && (n \|\| e.mode !== "bash")` |
| ↳ | | 235258 | `pi` / `popAllEditable`: the batch pull and its `mode` |
| ↳ | | 236078 | `dl` / `popEditableAt`: the single pull and its `mode` |
| ↳ | | 237546 | the queue's exported `popEditableAt: dl` |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 872404 | `queue-pull-needs-empty-input`: `Clear the input to edit this queued shell command`, 2000 ms |
| ↳ | | 872579 | `bash_needs_empty_draft`: the reason recorded with it |
| ↳ | | 872614 | `Er.popEditableAt(uS, nx, ...)` after the gate |
| ↳ | | 872786 | `po(_c.mode)`: the pulled entry's mode becomes the composer's |
| ↳ | | 832728 | `Yn.popAllEditable(M.value, ...)` and its `Qn(Sp.mode)` |

## Behaviour

- **Pullability.** `Kp` admits an entry with a pullable mode, not a meta entry, a person origin,
  and no exclusion. A shell entry is pullable; the only extra rule is `zMe`'s empty draft.
- **The single pull.** `dl(index, value, cursor, pasted)` looks the entry up in the `Kp`-filtered
  list. When `zMe` refuses it the pull returns nothing, and the caller paints the notice. On
  success it removes the entry and returns `mode: To.mode === "bash" ? "bash" : "prompt"`.
- **The notice.** The caller reads the entry itself and gates on `zMe(uw, nx === "")` before it
  calls `popEditableAt`. A refused shell pull paints `queue-pull-needs-empty-input` as an
  `immediate` feedback row for 2000 ms, records `input_queue_pop_to_edit` with
  `bash_needs_empty_draft`, clears the selection, and consumes the key.
- **The composer mode.** On a successful pull the caller applies `po(_c.mode)`, so a pulled shell
  command leaves the composer in bash mode and a pulled prompt leaves it in prompt mode.
- **The batch pull.** `pi` keeps only the entries `zMe` admits for the current draft
  (`Li = value === ""`). The batch's mode is `bash` only when every admitted entry is one, and in
  that case the whole batch is the shell set; otherwise the prompt entries alone are pulled. A
  non-empty draft therefore never takes a shell entry in the batch path.

## Host adaptations

- **Modes come from the queue.** This host's queue rows carry `bashMode` (W278's submit path), so
  `promptQueue.modes()` projects `bashMode === true` to `'bash'`; the composer reads the mode at
  the selected index before it pops. The type is `TerminalQueuedPrompt['mode']`, so a mode-less
  queue binding keeps working.
- **The refusal is the same notice owner.** The host's `showStatusNotice` already paints and
  expires a status row; the call uses the recovered owner id and the recovered 2000 ms, so a later
  notice replaces it the same way the source's feedback store does.
- **The pull sets the mode explicitly.** `setComposerMode` is the host's `po`; the queue pull
  calls it before it writes the draft, and `replaceDraftFromQueue` then repaints. A prompt entry
  pulled from a bash composer therefore leaves prompt mode, which the source's `po` also does.
- **Not ported.** `input_queue_pop_to_edit` telemetry, `markCameBack` (`unpassed` has no host
  writer), the Vim NORMAL caret mapping (`Mf`), `returnIdeSelection` beyond the existing
  attachment restore, and the image splice (`nne`; this host has no queued images).

## Validation

Unit: `test/tui.test.ts` 85/85, including the new pair. A queued shell command refuses a pull
into a typed draft with `Clear the input to edit this queued shell`, leaves the draft and the queue
alone, then pulls into the cleared draft and leaves `shell mode` on screen. The batch test keeps
the shell entry out of a non-empty batch and takes it into an empty one. Focused 67/67
(`test/terminal.test.ts`, `test/tui-bash-mode.test.ts`, `test/interactive.test.ts`). Full suite
3198/3199 with the known `cli-migration` effort failure only. Compiled 11/11 at identity
`32877cf3…`: while a turn runs, a queued `!` command's pull into a typed draft reports the notice
and sends nothing; the same pull into the cleared draft lands the command in bash mode.
