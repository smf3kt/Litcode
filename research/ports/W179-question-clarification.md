# W179 question clarification

Status: verified. Date: 2026-10-18. C-11.

The local user selects Chat about this on a question. The dialog returns the recovered deny/feedback result, including every question, its existing answer and any preview-question notes. The next model request receives that feedback. Ordinary answers retain their current admission contract.

Source identity is extracted-v2/modules/chunk-24k7d6mw.js, SHA-256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31, matched against the extraction manifest. All ranges below are zero-based UTF-16 [start,end).

| Symbol | Range | Body SHA-256 | Mode |
| --- | --- | --- | --- |
| Qet | [1179279,1179811) | 3da61c4098307af9102bad420a06e11a3d7abb42c5bb80ba6554f776af7f5e5d | Adapt the exact feedback template and deny outcome. Image blocks are deferred to the dialog media package. |
| nmo | [1179811,1180104) | 4d3738033b47d7348d6d684aa1207d0301971104f00eab703eac5b531d3d0472 | Copy the complete question/answer/notes formatter. |
| zet | [1180104,1180182) | 1666681dad47d5d944d49736413ca84ffb20d3c1303825e9ffd05566c092d01c | Copy the preview single-select gate. |
| a3 chat keys | [1148202,1148389) | 5f3ad1e03d56ebf9db9c57e04c376e70d712e3481bbc001aeba4654ff229ed52 | Adapt Up/Enter/Escape on the chat action. |
| a3 down-to-chat | [1148527,1148636) | ced3c533aff828c308ef18f6fb9d6dbc0d11beda998564519c444084f7946f33 | Adapt the final navigation row. |
| f3 multi-select onChange | [1158935,1159164) | d040038077c2dabbca49c18160b0b6d1c70292df949d8dbb946045dda07fdd02 | Preserve live choices and Other before submit. |
| response callback | [1171218,1171656) | 90b8d0daeb5346c3ffeb817caf5719eb089692b8992415ba47810bff63318ff9 | Local synchronous dialog settlement supplies the one-shot owner. |

The data shape adds a host clarification outcome to TerminalPromptAnswer and a strict deny/feedback result to InteractionCallbacks.ask. The successful AskUserQuestionAnswer remains unchanged. A request flag exposes the action only in grouped user questions. Other dialogs keep their current rows. The host retains its Other text row; the chat action follows it. Source w3 keys questions by full question text, so the interactive grouped host uses that identity instead of the display header.

Validation: focused dialog/tool tests 89/89 and full suite 2595/2595. Content identity b5422aa9ed832bc9dcfcc6a64e867b64dc7060eab27b0fdb6425d7ca4e367093, inputs 687, validation 230, build 472. `npm run check`, `npm run build`, and `npm run notices:check` exit 0. `node scripts/source-undeclared-scan.mjs src/question-clarification-source.ts` reports unresolved 0. Both copied ranges match their body digests and original text, 371 UTF-16 units total.

The compiled CLI driver passes `--clarification`, `--dialogs` and `--preview`. The clarification chain runs at 40 columns and 10 rows, asks three questions sharing a header, takes B on the first, leaves notes on the second, selects A and types Other text on the current multi-select third question, and verifies all three in the next model request. Both rejected file writes stay absent. The CLI restores terminal modes and releases session locks. Owned loopback SSE only, zero paid upstream calls. Recovered application entrypoints were never executed.

The first narrow CLI pass exposed a focus offset on the blank line before the chat action. It now names the action row. The new regression resizes through the existing stream resize event. The old driver assumptions about the W175 review page and W176 annotation were updated. See research/question.md, W179 incident.

S-1 through S-7 are recorded in research/coding-standard.md. Image blocks and external-editor support remain separate C-11 work. Independent review was retried through a fork after the first workflow reviewer hit its provider allowance. That review reproduced a missing live multi-select answer. The source f3 onChange boundary now updates the shared answer map on selection and accepted Other edits. The reviewer re-ran choice-only, choice-plus-Other, and cleared-Other inputs and found no remaining problem in the specified scope.
