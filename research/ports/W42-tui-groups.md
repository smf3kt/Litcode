# W42 Grouped questions and the review page

Status: verified (limited). Date: 2026-10-13.
Entry: a multi-question `ask_user_question` request now runs as a sequence of questions followed by a review page, where the answers can be checked, edited and submitted as one.
Contract: the sequence, the review page's contents and its keys follow the recovered tabbed question flow; a cancelled request still aborts the tool call, and the answers keep their original order.

## Source

Verified by Acorn 8.15.0 parse of the recorded module; zero-based UTF-16, end exclusive, module header included.

| Module | SHA-256 | Bytes | Symbol | Range |
| --- | --- | --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | 1716741 | `b3` review page | [1159815,1161789) |
| chunk-24k7d6mw.js | same | same | `Ab` per-question step | [1143160,1145502) |
| chunk-24k7d6mw.js | same | same | `hwe` question flow host | [1168121,1177646) |

Observed source shapes:

- `hwe` renders the per-question step while answering, and `zr ? e(b3, …) : null` renders the review page once the flow reaches it; `onFinalResponse` receives `"submit"` or `"cancel"`.
- `b3` shows the title `Review your answers`, a `warning` notice when `allQuestionsAnswered` is false (`You have not answered all questions`), then each answered question with its value under `success` colour, then `Ready to submit your answers?` and a confirm pair labelled `Submit answers` / `Cancel`.
- The flow is tabbed: `currentQuestionIndex` is the tab, `onTabPrev`/`onTabNext` move it, and `hideSubmitTab` controls the review tab. `multiSelect` is per question.

## Ported and adapted

Copies: the sequence shape (questions, then review), the review page's four parts and their wording, the per-question `multiSelect` toggle, and the submit/cancel outcome split.

Adaptations, each with its reason:

1. `src/terminal.ts` — `TerminalPromptRequest` gains `groups`, `reviewTitle`, `submitLabel` and `cancelLabel`, and `TerminalPromptAnswer` gains `groups`. The recovered flow is a React component tree with its own tab state; this runtime's modal takes one typed request, so the grouping is expressed as data rather than as child components.
2. `src/tui.ts` — the dialog gains `step` and `answers`. A grouped request walks `step` from 0 to `groups.length`, and `step === groups.length` is the review page. `resetDialogStep` clears the editor, selection and scroll on every move, because the recovered tabs each own their input state.
3. `src/tui.ts` — `dialogStep(dialog)` resolves the active step once, and the key handler, submit path, multi-select toggle, Other branch and text limit all read it. Without this the grouped request has no choices of its own and every step would be treated as text entry.
4. `src/tui.ts` — Left/Right move between questions from **any** step, not only the review page, and Right on the last question opens the review page. This matches the recovered tab order.
5. `src/interactive.ts` — the ask callback sends one grouped request for the whole `ask_user_question` call instead of one modal per question, and maps the returned groups back to `questionIndex` order. The line-mode fallback keeps its per-question loop, because it has no review surface.

Not ported: preview panes and their markdown layout, image paste inside questions, and the AFK timeout. `hideSubmitTab` is now ported by [W175](W175-hide-submit-tab.md).

## Validation

- `npm run check` and `npm run build`: pass.
- `test/tui.test.ts`: 18/18, including two new cases. One walks two questions (single choice then multi-select) to the review page, asserts the title, both answered values, the unanswered notice's absence, the submit/cancel labels and the submit hint, and submits; the other steps back through questions with Left, reopens a question with its existing answer selected, changes it, reaches the review page with Right, submits, and separately cancels a grouped request with Escape.
- Full suite: 1168/1168, 0 failures.
- Compiled CLI chains: `--dialogs` (question → review → plan → permission, 5 local model requests), plain (mouse/selection/OSC52) and `--actions` (picker/thinking/stash/tasks) all pass. The `--dialogs` driver gained the review-page submit step; no existing assertion was relaxed.
- Content identity: inputs 135 files `90b108df…`, validation 94 files `0599d02b…`, build 74 files `c6379d81…`, combined `fd65fdce0bef5eba25114cfff768d7c072f87fbfb2e03ee5a8802c0189908ba7`; see `W42-tui-groups-identity.json`.

Local loopback SSE fixtures only; no paid upstream calls.
