# W183 local classifier provenance seam

Read-only coordinator preparation on 2026-10-18. Product implementation remains queued after shared-child acceptance and ordinary fork repair. This file records observed current producers; it is not a completed auto port.

Source module chunk-sfn1dbxq.js SHA256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da was verified immediately before reading complete zLt [1068726,1078920), zero-based UTF-16 half-open. zLt projects origin/attachment records, skips invisible meta messages, wraps summaries separately, admits question-answer text from successful question tool results, excludes ordinary tool result content from human intent, and retains pending assistant prose only when a later relevant user turn consumes it. Optional remote/project attribution branches require real matching provenance. These branches must remain absent when the local host has no corresponding producer.

Current local producer observations, line numbers observed at bc709f63 build:

- Agent.run [1138,1225] receives a prompt, optional expansion and hook context. It merges the prompt, media and hook/memory text into one user message at1223. Only diff selection at1224 carries isMeta. Source roles alone do not distinguish these blocks.
- Interactive event queue [642,658] distinguishes item.source=event before calling the same Agent.run(prompt,signal) as human input. This caller is a required provenance boundary for scheduled/task/peer notifications.
- Direct child launch subagents.ts [244,252] copies parent messages then calls Agent.run(args.prompt). Registry mailbox agent-registry.ts [557,561] passes each mailbox string to the same API. Preserve task/peer origin rather than treating these strings as direct human instructions.
- Skill runtime [316] runs expanded skill body. CLI [761] runs inline skill output. Interactive [1190,1194] runs skill result or expansion. Retain the actual user invocation separately from generated command/hook context.
- Agent tool batch [932,938] combines tool results with hook context and appends retry metadata separately without isMeta. PostToolBatch context [970,971], recovery startup context [1233,1236], and stop continuation [1119,1121] are additional generated producers.
- Agent.compact [1021,1050] stores a distinct compact event and builds a summary prefix. A compact summary must retain source summary framing; its prose is not a new human request.
- SessionEvent message currently has message/response/isMeta fields at115; strict message schema at246 accepts these only. A source-backed origin/block projection therefore needs typed fields and all copy/schema consumers, rather than inference from text prefixes. Existing historical records without provenance need an explicit conservative compatibility disposition.

Complete axr [3321476,3349547) was also hash-verified and read in contiguous windows. Ordinary allow/deny returns before classification. Its local ask path preserves explicit ask/subcommand rules, hookAskFloor, host re-ask, safety checks, outside-read and plan floors, interaction and workflow consent. Classification receives same-turn prior tool uses plus pending action. It rechecks live mode/auto-active and ask level after awaiting the classifier. Local source failures distinguish unavailable, malformed/noVerdict, refusal and policy block; no-input classifierOnly tools deny. Vendor server arbiter/billing/telemetry and absent remote/browser paths are separate excluded host branches, not reasons to silently permit a local action.

Complete local gate helpers read from the same module: utt/m0/jAn/WAn/NVt [3354561,3355106), vor [3355350,3355478), Dl [3365554,3365753), and uxr [3350680,3351390). utt recursively recognizes explicit ask reasons; m0 also recognizes matchedAskRule. NVt is exactly mode=plan, and Dl recursively finds safetyCheck reasons. uxr returns classifier denial, marking noVerdict only when failureMode is present. Imported predicates still require mapping to actual local tool/context producers before porting.

Trusted override merge was additionally directly read in x0 SHA2560b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92 [109856,111138): sZ accepts legacy deny, PR ignores that legacy field and concatenates four rule/context arrays in user/flag/policy order. XXt/S/Jgs/Jdo in chunk-7ah5c51p.js SHA256f0cf1631a25068c3f788d8b82dca713bc1c4d88221f9d55bf9c355ddc74a3dd5 [634,2363) were directly read; empty arrays retain default slots, nonempty arrays replace, and $defaults expands original content once at its actual position. These source contracts are final actual request-verification inputs.

Additional exact source bodies verified and read in the same pass:

- I9r [3063491,3063858) raises native PermissionDenied with reason/tool/call fields when registered.
- Caller [2288685,2289127) raises it only for decisionReason.type=classifier and classifier=auto-mode, and appends retry metadata only if retry and noVerdict is false.
- mze [1006956,1007251) distinguishes automode-unavailable, automode-parsing-error, automode-blocked and ordinary permission-rule outcomes.
- tBe/j0e [1095066,1095467) reject conflicting raw block tags, strip complete and unfinished thinking blocks, then accept one yes/no verdict with optional closing tag.
- CLt/xLt/ALt/ico [1095895,1096384) extract first sanitized reason, exactly one valid category and optional thinking. Missing reason/category does not imply allow.

Native schema fragments directly read in the same pass: chunk-n3ykh62m.js SHA256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac [395412,395472) contains hookEventName=PermissionDenied and optional boolean retry; chunk-r2vtj1kh.js SHA256 2b13302b83beea3fe54e83316b9d855c43e2298af6d0041b009cec563bbc1515 [193916,194055) contains the base input intersection with hook_event_name, tool_name, tool_input, tool_use_id, reason and optional mcp_server. These are fragment coordinates, not complete declarations; acquire complete AST declarations before copying. Current hooks.ts [1128,1130] already consumes retry=true, while classic raise remains gated out pending classifier implementation.

These bodies complement .audit/w183-auto-source-handoff.md and the complete independent source-seam report. Read exact origin/frame helper dependencies before implementation. No product edits, tests, build, recovered entrypoint execution, external calls or paid inference occurred in this preparation.
