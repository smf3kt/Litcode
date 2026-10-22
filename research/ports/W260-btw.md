# W260 `/btw`

The composer's side-question panel: one tool-free call over the conversation, shown without joining the transcript. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `jco` 1120265 | `local-jsx` registration: `immediate`, `argumentHint:"[question]"`, thin-client dispatch |
| `chunk-d3s5r8h5.js` | `202506d3996b4fffe72418c623c884a93169f9352a17331ba6268b2e2eb4e2db` | `A` 1005 | the five companion strings: tool note, tool-history omission, truncation note, truncation omission, no-result placeholder |
| ↳ | | `kmt` 1289 | the side request: history flattening, reminder block, one call with tools denied, result unwrapping |
| ↳ | | `x` 3457 | the fork-context tool placeholder |
| ↳ | | `N` 4300 | the answer classifier: text plus notices, synthetic tool-call and API-error replies |
| `chunk-qskwh3r4.js` | `502871b1307a183388e1c2d295749e7a64d266b330b49fbe4e155e4e899ed588` | `we` 1877 | the panel: history window, `[`/`]`, Tab browse, `x`, `c`, `f`, Escape; the in-flight spinner |
| `chunk-5b2hxy2e.js` | `46d7f73a2b28fd9493ecf37d85abc89acd020f6de7e2bdb83efe621811f12656` | `Qd` 8863 | the written tool-call matcher, `NLr` at 9077 |
| `chunk-hb620t8k.js` | `061fd88ff51527cab1fc4edfd69ec3f67e019db4b83c608df4fe74e741318b07` | `Al` 12324 | the `API Error` prefix the synthetic reply strips |

## Behaviour

- **Question.** `/btw <question>` runs at once; the bare command waits for the question. The slash is recognized only at the start of the draft, which the composer already highlights (`d3n`, ported in `tui-input-highlights-source.js`).
- **Side call.** `kmt` flattens prior side exchanges into plain user/assistant text, replacing an answer that wrote tool calls or was cut off with its omission note. It then appends a `<system-reminder>` block plus the question, calls with `canUseTool` denying every tool, `maxTurns: 1`, `skipTranscript`, and `skipCacheWrite`. The reminder tells the model it is a separate instance with no tools and no follow-up turns. Nothing is appended to the conversation.
- **Answer.** `N` joins the text blocks; a tool-call-shaped answer keeps the text and gains the tool note, a cut-off answer gains the truncation note. With no text, a bare tool call or an API-error message becomes a synthetic reply that the panel shows but does not add to history.
- **Panel.** Rows show past questions (oldest beyond five collapse to `(+N earlier /btw)`), the current question, then the answer. `[`/`]` and shift+Tab browse history, `x` clears it, `c` copies, `f` forks the question into a background branch, Escape/Enter/Space close with `display:"skip"`.

## Host adaptations

- **Call.** `Agent.askSideQuestion` sends the session's own messages plus the side history and the reminder, with an empty tool set and `tool_choice:{type:"none"}`. The host's conversation is always paired, so the recovered fork-context placeholder (`x`, 3457) has nothing to repair and is not emitted. The recovered retry-progress events and refusal fallback are not surfaced: the host provider either returns a message or throws, and a thrown call ends the panel with the loop's usual error line.
- **Panel.** The modal surface has no scroll view or spinner, so the panel renders the question and answer as a read-only dialog; browsing and clearing re-open it with the chosen exchange. `c` writes the same OSC 52 payload as `/copy` and reports `Copied to clipboard` in the status line. The `f` fork action and the thin-client/remote dispatch are not ported.
- **Keys.** A read-only dialog with no rows now honours the request's `keys`, which gives the panel `[`, `]`, `x` and `c` without inventing a focus row.
- **History.** Exchanges live for the interactive session in memory, as the recovered state does; they never reach the journal. Piped sessions print the answer and add it to the same in-memory history, since the recovered command has no non-interactive twin.

## Validation

- `test/side-question.test.ts`: 8/8 (reminder blocks, detector, history substitution, text and synthetic classification, panel body, fixed lines).
- `test/btw-command.test.ts`: 3/3 (no tools and no transcript write, copy payload, bare text dialog, second exchange threading).
- Focused `tui`, `interactive`, `help-panel`, `tasks-*`: 157/157 after the suggestion-band test moved to `/co` so the new row keeps `/config` in the window; `tui` alone 80/80.
- Compiled `.audit/w260-btw.mjs`: 8/8 at identity `d8e66304…`. A fixture gateway answers only side calls; the panel shows the question and answer, `c` emits OSC 52, Escape returns to the composer, and the second call's request body carries the first exchange.
- Full suite 3068, 3067 pass, with only the known CLI-effort failure.
