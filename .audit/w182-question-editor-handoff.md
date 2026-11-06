# W182 question notes external editor handoff

Status: active implementation. W181 committed 9caf843; exclusive handoff accepted by peer uds:/tmp/cc-socks/65735.sock, whose worker abdfe1550882fb072 is the sole product writer. User's standing goal is all local C-area completion. No external publication, push, amend, attribution or paid upstream calls.

## Ground

Read research/CURRENT.md first, WORKFLOW.md, coding-standard S1-S7 and .audit/c11-question-editor-source.md. Inspect available skills/tools and load matching implementation/TypeScript/driver/review skills. Verify source digests and exact inert ranges before code edits. Source report is evidence pointers, not permission to invent missing behavior.

## Scope and ownership

Deliver external editing for preview single-choice notes and ordinary single/multi-choice Other inputs, using each source widget's actual external-editor action. Preserve question selection, root draft, per-question notes, clarification and final annotation. Reuse owned low-level editExternal and terminal handoff, with a separate question result callback. Capture active dialog identity, full question key, old text and cancellation owner. Late results must not enter another question/dialog. Suspend AFK/input while handed off; cancellation/close waits descendants and removes temporary files before terminal restoration.

Exclusive product candidates: src/tui.ts, src/external-editor.ts only if shared handoff needs a source-backed adaptation, relevant existing test/tui.test.ts, existing scripts/smoke-tui-mouse.mjs/editor driver. Expand only for complete usage chain after recording why. Other sessions hold writes. No image implementation in this package. Do not overwrite W181 catalog changes or unrelated .audit work.

## Source

chunk-24k7d6mw.js SHA256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 a3 [1145502,1153542), decisive callback/gate [1146770,1147260), Qet [1179279,1179811), all zero-based UTF16 half-open. Before and after editor await, source checks wouldTakeAnswer. Apply only nonnull changed content to question textInputValue, without changing selectedValue or submitting. Ordinary f3 [1153793,1159815), callback window [1154985,1155625), calls lower-widget Qn(content) before He(questionKey,{textInputValue:content},multiSelect??false); both single Ve and multi Xf receive onOpenEditor at [1159089,1159815). Include this owner and the live clarification update. Callback windows need exact declaration acquisition before copying. Lower Other row gEe is in chunk-yygmb66g.js, SHA256 93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0, approximately UTF16 25020 onward; around 26204 the externalEditor binding is active only when isFocused and onOpenEditor exists, invoking onOpenEditor(inputValue,onInputChange). Acquire exact AST bounds before any copy. Preserve this focused-row gate.

chunk-7tnkhv2k.js SHA256 9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9 hx [2859,2908), $j [4816,5237). Question call passes notes only, without root paste/cursor. Remove one trailing newline per source; compare normalization order directly. Existing 8192-char/32-KiB product boundary must remain.

## Verify and deliver

At most three new essential regression groups: correct notes/draft/selection owner and stale result; cancellation/descendant cleanup; final annotation and clarification forwarding. Extend actual compiled PTY driver with private VISUAL fixture, notes edit and exact provider payload. Run check/build and affected regressions. Independent reviewer must reproduce original scenarios after any findings are fixed. Record commands, exit codes, source/adaptation differences, cleanup, content identity in one W182 port record/evidence, update current feature rows and incident log. Main inspects and commits exact paths after review. All-C completion remains open until exit checklist is satisfied.
