# C6 async hook adoption source investigation

Date: 2026-10-18. Read-only peer investigation. Reported observations require direct source reads before implementation. No product changes in this investigation.

## Source identity and ranges

All ranges are zero-based UTF-16 half-open.

- chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da. UF [2969279,2980094), m5e [2955889,2958184), kbt [625629,626248). Investigator verified against extracted manifest.
- chunk-n3ykh62m.js SHA-256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac. vye [396651,396699) checks `"async" in e && e.async===!0`.
- chunk-ax7r0qj7.js SHA-256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e. Ar [3529,3561), Qe [3224,3289), first-line extraction.

## Observed source contract

UF starts one process, constructs shared shell owner Do=wee(vo,w,nn,No), writes original stdin once. Configured async and dynamic stdout handoff use that same owner. Ur accumulates stdout and examines Ar(ts).trim(). When first-line text contains `}`, it permanently marks Rr=true before JSON parsing. A valid async response with forceSync false transfers Do through m5e. On success fo=true, foreground stdout/stderr listeners detach and foreground resolves status 0/backgrounded. Finally stops progress; Do.cleanup runs only when fo is false. Failed registration retains synchronous ownership.

Qe returns the entire text before any newline, so a valid JSON header can transfer immediately upon `}` without a newline. A malformed first parse is never retried. A nonasync first line prevents later lines triggering transfer. kbt reports asyncTimeout or 15000 but its observed body installs no timeout and proves no timer reset.

## Current product gap

src/hooks.ts runHookCommand owns spawn, buffers, timeout, turn abort and group termination. It returns only a final RawHookResult. runHooks routes configured async before spawn, while its synchronous call waits for final completion. AsyncHookRegistry.start launches another runHooks call with async false and has no adoption API. Runtime owns registry by owner/generation and gates completion delivery against that scope; releaseSession closes hooks after workflows/agents.

## Proposed implementation boundary

An owned command handle needs a final result promise, bounded output, kill/cleanup and one-time transfer capability. Foreground and registry must share that handle. Registry adoption detaches per-call abort only after successful registration and retains runtime lifetime ownership. Follow-up exact source acquisition in wf_68500a69-d44 found Axe.background() clears the original timeout and foreground abort listener through #C(); kbt's asyncTimeout || 15000 is logged without installing a replacement timer. Preserving the original deadline would therefore be an explicit host adaptation, not a copied source contract. Completion interpretation must reuse the existing process result, settle once and avoid header recapture through forceSync. Failed adoption leaves foreground ownership intact. Preserve already-read header bytes under the final output policy. W89 script hooks remain unexecuted.

Coordinator additional direct reads on2026-10-18 verified the same sfn digest and complete Cxe[82462,82919), Axe[82919,87427), wee[87427,87504), m5e[2955889,2958184), UF[2969279,2980094), gbt[622557,622798), WLe/Sbt[626248,627570). Axe.background clears the foreground timeout/abort listener; UF creates one wee handle, writes stdin once, detaches foreground listeners only on successful m5e and skips cleanup only for that transfer. gbt tries joined non-header text before individual lines. These reads add source verification only, no C6 product implementation or acceptance.

## Required validation

Reuse scripts/smoke-hook-terminal-cli.mjs where possible. A fixture appends its PID/spawn marker once, emits split JSON async header, and stays alive behind a controlled signal/file. The model proceeds before completion, then receives exactly one journaled completion. Assert one spawn and unchanged PID, malformed/nonasync first-line foreground behavior, valid header without newline, turn cancellation after handoff retaining the job, and owner release terminating process group/descendants and releasing locks. Limit new regressions to transfer, parser boundaries and cancellation/cleanup. No implementation or acceptance claim yet.

Follow-up source closure is retained in wf_68500a69-d44 journal.jsonl. Additional verified source in chunk-sfn1dbxq.js: Cxe [82462,82919), Axe [82919,87427), wee [87427,87504), qit [87810,87891), Kit [87891,88072), Nkt [565055,565349). Owned process teardown helpers are in chunk-25vrbr0v.js SHA256 30b526b2b8573161c4d1ec0f5b720701820375443a0e3d84c336cff9d839537e: Mw [943,1065), h [1065,1256), aAr [1256,1376), k0t [1376,1543), S [1543,1867), lwo [1867,2567), b [2567,2876). Coordinates are zero-based UTF-16 half-open. Coordinator subsequently verified sfn digest and directly read m5e [2955889,2958184) and UF tail windows [2974500,2977300), [2977300,2980094). UF transfers the same wee handle, detaches foreground stdout/stderr only after successful m5e, resolves backgrounded, and skips Do.cleanup only for successful transfer; forceSync retains foreground. m5e asyncRewake reads final stdout/stderr from the same handle and skips async header lines when finding plugin metrics; normal path backgrounds then calls kbt. Peer subsequently acquired the normal final interpreter closure in /Users/mant1ssa/.claude/jobs/c9c17d97/tmp/c6-normal-final-output-source.txt, read by coordinator. gbt [622557,622798) tries joined tail when first object has any async property, otherwise joined full output, then each original trimmed line; accepts first valid object with no async property, including multiline final payload. Sbt [626520,627570) interprets/filters via ybt/dbt, marks sent and awaits WLe [626248,626520) before returning attachment. WLe cleans and gc [621218,621853) emits hook_response event before conversation consumption, but its synchronous Qi call does not prove durable fsync ordering. Product journal-before-effect remains an explicit owned contract. kZe async case near4490200 injects only systemMessage/additionalContext, not raw stdout. Parent async completion currently reaches notifications rather than an independent async hook_result journal row; validate actual journal-before-effect paths separately from child completion.
