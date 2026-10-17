# W87 — PreCompact custom instructions

## Source position

`rAe` (chunk-sfn1dbxq.js, UTF-16 [2931620,2932807)) sends PreCompact
`{trigger, custom_instructions}`, where `custom_instructions` is nullable
(schema in chunk-r2vtj1kh.js). Its output processing takes every successful,
non-blocked hook's trimmed stdout, joins them with `\n\n` and returns
`newCustomInstructions`; the compaction prompt appends
`Additional Instructions:\n<...>` (`wnn` offset 2504123). Manual compaction
prefixes the user's `/compact` arguments with `User context: ` and composes
hook instructions first (`ztt` offset 2565187; manual site at offset 2572138).

## Port

PreCompact now carries `custom_instructions` (the user's `/compact` text, or
null). `HookResult.newCustomInstructions` collects the same trimmed stdout that
already enters `additionalContext`; `compact` joins it with `\n\n`, composes
`<hook instructions>\n\nUser context: <user instructions>` and appends the
`Additional Instructions:` block to the summary request. The raw-stdout entries
are excluded from the separate `Hook context:` block so the same text is not
sent twice; other PreCompact context still travels there. `/compact` accepts
trailing instructions and forwards them through `compactContext`.

## Adaptation

PreCompact stdout still also remains in `additionalContext` for every other
consumer; only the compaction prompt de-duplicates it. The product's summary
prompt body is its own sentence, so the source's instruction block is appended
to that body rather than replacing it.

## Verification

`agent-lifecycle` 31/31: a PreCompact hook receives
`trigger: "manual"` and `custom_instructions: "user instruction"`, prints
`hook instruction`, and the summary request contains
`Additional Instructions:\nhook instruction\n\nUser context: user instruction`;
the compact event records the summary. tsc 0; build 0; full 2,116/2,116; chain
767/767; notices 0; source index unchanged; identity `e3257471…`.
