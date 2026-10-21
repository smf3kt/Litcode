# W255 `/resume` preview and rename

The interactive `/resume` panel's two remaining modes. Every string, key and write below is
recovered; offsets are zero-based UTF-16 code units into the named module, half-open where a
range is given.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-er09v3xa.js` | `f026decc1a34748d4ef11cab0a3116e299f2039f57757758f89137e50e051be9` | `Jln` 9331 | picker state machine |
| ↳ | | 14629 | list-mode keys: ctrl+r rename, space/ctrl+v preview |
| ↳ | | 15806 | preview branch `C==="preview"&&Je` |
| ↳ | | `Ct` 2632 | preview page: load, transcript, footer |
| ↳ | | 13235 | `bt`, the rename submit |
| ↳ | | 17035 | `Rename session:` form with `p4(I,"Enter new session name")` |
| ↳ | | 18012 / 19009 | rename and list/preview guide lines |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `mAe` 4662194 | load a row's stored transcript |
| ↳ | | `Tne` 4662127 | "summary has no messages" gate |
| ↳ | | `Pz` 4644259 | append the custom title to a target session |

## Behaviour

- **Preview.** Space on the focused row, or ctrl+v anywhere in list mode, opens `Ct`. The page
  loads the target transcript when the row summary carries no messages (`Tne`), renders them
  through the transcript surface, and shows the footer `time · N messages` (`rw`) plus
  `enter resume / esc cancel`. Enter resumes the previewed session, Escape returns to the list.
- **Rename.** ctrl+r enters the rename form with an empty value (`te("")`) and the current title
  as the placeholder (`p4(I, "Enter new session name")`). Enter runs `bt`: an empty trimmed value
  only returns to the list; otherwise `Pz` appends `{ type: "custom-title", customTitle,
  sessionId }` to the target transcript, refreshes the row and returns to the list. Escape is the
  rename-scoped `confirm:no` and drops the value. While renaming, the picker's `kt` returns
  immediately, so the input owns typing, backspace, Enter and Escape.
- **Guide lines.** Rename shows `Enter save / Esc cancel`; preview shows `Enter resume / Esc
  cancel`; the list and search guides are unchanged from W254.

## Host adaptations

- **Preview rendering.** `Ct` renders with the vendor transcript component (`gie`,
  `screen:"transcript"`, `history:"all"`). This host has a transcript surface only for the live
  session, so the preview lays the same stored messages out as plain rows: `> ` for user text,
  two-space indent for assistant text, wrapped to the panel width. The loaded data, footer and
  keys are recovered.
- **Stored transcript reader.** `mAe` parses the vendor's transcript file via its storage layer.
  `src/sessions.ts` reads the local `.agent/<id>.jsonl`, keeps only complete records, and keeps
  only `message` events with text content. A record whose `message.content` has no text blocks
  (a tool result only) contributes nothing. Reader failure leaves the page empty, matching `mAe`'s
  fallback to the summary.
- **Rename writer.** `Pz` appends through the vendor storage/aliases layer; locally the session
  index is derived from `kind:"title"` records, so `renameStoredSession` appends one such record
  under `O_APPEND|O_NOFOLLOW` and fsyncs it. A target whose `.lock` exists belongs to another live
  process and is refused (`Session is active in another process`); the source's writer does not
  expose that local lock, and this host must not write a live journal.
- **Rename failure UI.** The recovered `Pz` logs a transcript-append failure of its retryable class
  and throws otherwise; the dialog has no status channel, so a writer failure keeps the form open
  and prints the message under it. The form still returns to the list on the next Enter or Escape.
- **Branch token.** The preview footer prints `time · N messages`; the local summary has no git
  branch, which the source appends when present.
- **Mouse and load-more.** The row hit map stays on the dialog owner; the source tree list's
  click-select and the load-more paging remain out (no local paging source).

## Validation

- `test/session-preview.test.ts`: 3/3 (reader returns user/assistant text only; rename appends the
  title and the list reflects it, invalid title rejected; a locked journal is not rewritten).
- `test/resume-picker.test.ts`: preview open/close and load-failure fallback, rename submit and
  empty-value return, writer-failure form; 18/18 for the file.
- Focused interactive/TUI/preview set: 124/124.
- Compiled `.audit/w255-resume-preview-rename.mjs`: 8/8 at identity `edb62c56…`. Space opens the
  stored Alpha conversation with `response 1` and `2 messages`; Escape returns to the list; ctrl+r
  shows the rename form with `Alpha session` as placeholder; Enter writes `"title":"Gamma session"`
  into the Alpha journal and the row updates; Escape closes; `/resume` + `gamma` resumes the renamed
  session, which runs another turn. The prior `.audit/w254-resume-picker.mjs` (10/10) and
  `.audit/w231-effort-slider.mjs` (18/18) pass at the same identity.
- Full suite: 3022 tests, 3021 pass; the single failure is the pre-existing CLI effort-flag
  divergence.
