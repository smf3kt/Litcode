# W207 the unavailable-paste notice

Status: implemented locally on `work/w43-choice-preview`. Follows W206. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: 「W207 unavailable-paste UI and native storage V5 / transformed
producers.」 Scouting split the item. The paste half is a displayed composer state and is ported
here; the storage half is a durable-storage service with no display surface and is queued as W208.

## What was there

The composer already had the placeholder grammar (`[Pasted text #n +m lines]`), the content-hash
paste store under `<userDir>/paste-cache`, and the expansion used at submit
(`expandPastedText` → source `sce`). `sce` keeps an `unavailable` placeholder as literal typed
text, so submitting a recalled draft whose stored paste no longer resolved sent
`[Pasted text #1 +59 lines]` to the model. The history binding made it worse by dropping the
record entirely: `InputHistory.read` filtered every paste with `content === ''`, which is exactly
how an unavailable paste resolves, so the submit strip could not recognise the placeholder.

## Recovered source

- `chunk-n3ykh62m.js`, sha256
  `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac`:
  `hW` [464432,464509), the strip `jE` [464509,464881), its alias `kPn` [464881,464922), the
  notice `Fdr` [465087,465276), the remote-only message `pss` [465276,465449), the label join
  `GE` [465449,465520).
- `chunk-24k7d6mw.js`, sha256
  `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`:
  the local submit branch at 1345194.
- `chunk-356hrhz3.js`, sha256
  `0c821efb255e53af566480e6263c87c8be068ed1a7dae3205b2964f0f0c9076a`:
  the notification store's default timeout `S = 8000` and the `immediate` preemption rule
  [1800,2700).

Coordinates are zero-based UTF-16 offsets.

**The strip** (`jE`):

```js
function jE(e,n,r,s){
  let h=Jd(e), y=[], b=e;
  for (let R=h.length-1;R>=0;R--){ let T=h[R];
    if(!T.match.startsWith("[Image") && n[T.id]?.unavailable===true)
      b=b.slice(0,T.index)+b.slice(T.index+T.match.length),
      y.unshift({id:T.id,label:T.match.startsWith("[...Truncated text")?"Truncated text":"Pasted text"});
  }
  let w=UE(BE(e,h,n,!0,r),s,r,VAe(n));
  return {stripped:b, expanded:w, removed:y};
}
```

**The submit branch** (local path): `{stripped, expanded, removed} = kPn(text, contents)`; when
`removed.length > 0` it posts `addNotification({key:"pasted-text-unavailable", kind:"feedback",
text:Fdr(removed), priority:"immediate"})`, and when the stripped text is blank or the draft is a
slash command it hands the prompt back with the caret at the end instead of sending. Otherwise
the prompt goes out as `expanded`, without the gone placeholders.

**The notice** (`Fdr` over `GE`): `Pasted text #1 is no longer available and was removed from the
prompt`, or the plural `… are no longer available and were removed from the prompt`.

## Port

`src/tui-input-paste-source.ts` now carries the one copy of `jE`/`kPn`/`Fdr` (with `GE`) and
exports `jE`/`Fdr`; `src/tui-input-history-source.ts` imports `jE` instead of keeping a second
copy, and its `hW`/`addEntry` paths are unchanged. `src/tui-input-paste.ts` exposes
`stripGonePastes` and `pasteGoneNotice` as the product-facing names.

`src/terminal.ts` gains the `pasteGone` editor effect and the source's submit branch:
`stripGonePastes` runs on every submit, a removal posts the notice, and a prompt that would be
left blank or is a slash command keeps its draft with the caret moved to the end. A prompt with
text left over is sent from `stripped.expanded`. `TerminalInput` emits `pasteGone` for its
callers, next to `pasteRejected`.

`src/tui.ts` renders the notice on the status row through a shared owner: the existing workflow
notice and the new paste notice now go through `showStatusNotice(owner, text, timeoutMs)`, so
whichever is current can be cleared without touching the other. The paste notice uses the
source's default 8000 ms.

`src/tui-input-history.ts` keeps an unavailable text paste in the bound history
(`content === '' || unavailable === true`) so the marker reaches the editor; the comment cites
why, because dropping it is what made the placeholder sendable.

## Verification

- `test/terminal.test.ts` gains 「a submit drops placeholders whose paste record is gone and hands
  the prompt back」: the placeholder-only draft produces one `pasteGone` effect, keeps its text
  and moves the caret to the end; a slash-command draft does the same; `hello [Pasted text #1]`
  produces the notice plus `submit` with `hello `; a live record still expands; two gone pastes
  are listed together and the image placeholder is never stripped.
- `test/tui.test.ts` gains 「a submit whose paste record is gone announces it and hands the prompt
  back」: a real bracketed paste creates `[Pasted text #1 +3 lines]`, the record is marked
  unavailable as a lost history record would be, Enter shows the sentence in the footer, nothing
  is submitted and the draft stays; typing text before Enter sends it without the placeholder.
- Both tests fail on the pre-port sources (`git stash` of the five changed files: 2 failures) and
  pass after.
- Compiled two-process probe `.audit/w207-paste.mjs`: run the built CLI with a temp user dir,
  paste 60 lines, submit, confirm `<userDir>/paste-cache/<hash>.txt` and the `contentHash` history
  entry; delete the paste file; restart; press Up; the composer recalls
  `[Pasted text #1 +59 lines]`; Enter leaves that draft in place, shows
  `Pasted text #1 is …` in the footer and adds no user row. Before the history-binding fix the
  same probe sent the placeholder (`user row sent: true`).
- 66/66 `test/tui.test.ts`, 29/29 `test/terminal.test.ts`, full suite 2746/2746 (118 suites),
  `npm run check` and `npm run build` clean.

## Adaptations and what stays out

- The notification queue itself is not ported. This terminal has one status row, so `immediate`
  becomes "overwrite the current notice" and the owner key replaces the queue's `key`; the source's
  diff-panel hold and priority ordering have no analogue.
- The remote submit path and its `pss` transcript message are excluded with the account/remote
  work; the local path is the one that runs here.
- The source's `io === "bash"` cancel condition has no counterpart because this product has no
  bash composer mode (W204 scoped the `!` switch out); the blank and slash-command conditions are
  ported.
- Image placeholders are deliberately never stripped: the source skips `[Image` matches, so an
  unavailable image stays in the prompt text. That is the recovered behaviour, not an omission.
- The second half of the item, native storage V5 and transformed session-storage producers, is a
  durable-storage service (`src/diff-panel-source.ts`, `src/permission-settings.ts`,
  `src/tui-history-search-source.ts`, `src/tui-scope-picker-source.ts` keep its branches inert)
  with no TUI display; it is queued as W208 rather than claimed here.
