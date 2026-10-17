# W101 — expansion raise before every skill execution mode

## Source position

Both command entry points call `at` before resolving and running the skill:
the main command path (chunk-htgmc2p1.js call at 33172) and the stacked-skill
loop (call at 35257). `at` [38703,39841) raises UserPromptExpansion first and
returns early with the blocking warning when the hooks return a blocking error
or a continuation stop, so execution-mode commands (fork, background, model or
effort routing, hooks, allowed tools) are gated exactly like plain expansions.
`Zge` (chunk-sfn1dbxq.js offset 564884) includes `UserPromptExpansion` in the
exit-2 blocking set, and the command help text (chunk-5s0t90hn.js offset 3461)
states that exit 2 blocks the expansion.

## Port

The interactive slash-command branch raises `UserPromptExpansion` through
`emitHook` before `runSkill` whenever the skill requires execution. A blocked
verdict writes the recovered prefix `UserPromptExpansion operation blocked by
hook: <reason>`, reports `hook_blocked`, and skips the skill. Skills that fall
through to a model turn receive the hook's additional context through a new
optional `Agent.run` context parameter, so the event is raised exactly once per
command. `UserPromptExpansion` joins the blocking-event set.

## Adaptation

A skill that ends in its own fork, background or terminal result has no parent
model turn, so its hook additional context has no turn to join and is dropped;
the block verdict still gates execution. The plain expansion path keeps raising
the hook inside `Agent.run`, which owns the turn that consumes the context.

## Verification

`interactive` asserts one raise per command with the scope, that both a fork
and a command-bearing skill execute, that the fallthrough turn carries the hook
context, and that a blocked hook prevents `runSkill`. `hooks` adds
UserPromptExpansion to the exit-2 gating matrix. Focused 102/102, tsc 0, build
0, full 2,133/2,133, chain 767/767, notices 0, identity `ef637462…`.
