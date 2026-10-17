# W93 — SessionEnd reason enum

## Source position

The SessionEnd schema fixes `reason` to `["clear", "resume", "logout",
"prompt_input_exit", "other"]` (`GK`, chunk-r2vtj1kh.js
[204799,204858)). The builder raises `{hook_event_name: "SessionEnd", reason}`
and uses the reason as the matcher query (chunk-sfn1dbxq.js offset 2943888).
The source ends a session with `clear` for /clear and `resume` when a
resumed transcript takes over (chunk-24k7d6mw.js offset 348193), and with
`prompt_input_exit` when prompt input ends.

## Port

`endSession` maps this runtime's own close causes onto that enum before the
raise: `clear`, `resume`, `logout` and `prompt_input_exit` pass through;
`session_switch` becomes `resume`; `exit` becomes `prompt_input_exit`; and
`fork`, `config_changed`, `config_reload`, `cwd_changed`, `rewind`,
`interrupt` and `other` become `other`.

## Correction

The product previously passed its internal reason text (`fork`,
`config_changed`, `session_switch`, `config_reload`, `cwd_changed`,
`rewind`, `interrupt`, `exit`) straight to the hook. Those values are not
in the recovered enum and broke reason matchers; the interactive test now
expects `other` where it previously observed `fork`.

## Verification

`agent-lifecycle` 35/35: six close causes produce the mapped reasons in
order. `interactive` 8/8: /clear, /fork and /exit produce
`clear`, `other`, `prompt_input_exit`. tsc 0; build 0; full 2,122/2,122;
chain 767/767; notices 0; source index unchanged; identity `11df4f85…`.
