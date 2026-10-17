# W100 — remove the invented updatedPrompt rewrite

## Source position

The only UserPromptExpansion consumer, `at` (chunk-htgmc2p1.js
[38703,39841)), reads four results: `blockingError` (terminal block),
`preventContinuation` (terminal stop), `additionalContexts` (context blocks)
and `message` (messages to append). The command help text
(chunk-5s0t90hn.js offset 3461) documents the same contract: exit code 2 blocks
the expansion and stderr is shown; exit code 0 stdout is shown to Claude.

`updatedPrompt` does not occur anywhere in the extracted modules (0 matches
across every chunk), while the fields that do exist — `updatedInput`,
`updatedPermissions`, `updatedToolOutput` — each appear dozens of times. The
product carried a field mapping that rewrote the submitted or expanded prompt
from hook JSON; that behavior was invented and contradicted the recovered
consumer.

## Port

Remove `HookResult.updatedPrompt`, its `hookSpecificOutput` parse branch, and
both consumer assignments in `Agent.run`. Blocking and additional context are
unchanged. A hook output that names `updatedPrompt` is retained as an opaque
`hookSpecificOutput` entry and has no effect on the prompt.

## Verification

`hooks` asserts the parsed result has no `updatedPrompt` even when the output
names it. `agent-lifecycle` asserts the model sees the expanded prompt text and
not the fixture's rewritten text, while the additional context still arrives.
Focused 103/103, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0,
identity `f4fc4704…`.
