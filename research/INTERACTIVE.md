# Interactive runtime inventory

Updated 2026-10-10. Bounded static inspection of Claude Code 2.1.296 decoded modules under `extracted-v2/modules/`. Coordinates below are zero-based UTF-16 indices into complete decoded module text. They are not executable offsets. No recovered application code, personal credentials, historical sessions, network or model requests were used. REA full application analysis timed out without returning graph Evidence; these are direct source observations, with module digests preserved in the extraction manifest.

## Command registry and handlers

The selected descriptor registry starts at `chunk-sfn1dbxq.js` index 1663300. Conditional variants depend on launch mode, account/provider, policy and feature gates.

| Surface | Descriptor in chunk-sfn1dbxq.js | Handler / observed behavior |
| --- | ---: | --- |
| clear/reset/new | 1121000 | chunk-cd23rnc0.js 14659 -> chunk-6qspdjt4.js 2567: new UUID, messages/read cache/file snapshots/session caches reset; transcript retained; some task state selectively preserved |
| resume/continue | 1165457 | chunk-14ept3y3.js 25377 filter, 25441 handler: exclude sidechains/current session, resolve ID/title or picker, live holder attach/notice, cross-directory launch surface |
| rename/name | 1165001, 1165204 | Interactive/headless title changes |
| branch | 1638156 | chunk-8a6bg1at.js 14524: copy current main chain, exclude sidechains, rewrite sessionId/parentUuid/forkedFrom; 20188 resumes branch with return-to-original ID |
| fork | 1638349, 1638560 | chunk-0krtqd6x.js 15000: directive required, first turn required, coordinator uses branch; background variants gated |
| subtask | 1638732 | Full-context child result surface |
| tasks/bashes | 1167398 | Background work UI |
| cd/add-dir | 1120874 / 972858, 973117 | Working-directory relocation/additional roots |
| export/copy | 1650360 / 1121839 | Transcript export or clipboard response selection |
| exit/quit | 1647438 | Normal exit; attached background sessions may detach |
| model | 1650522, 1650747 | chunk-naxwgf3s.js 14320: state/picker, 15s model availability check, switch decision, usage-credit consent branch |
| effort/fast | 1659308, 1659500 / 1637004, 1637213 | Effort and gated fast-mode selection |
| permissions/allowed-tools | 1636651 | chunk-fxx7hh8y.js local rules UI or remote read surface |
| plan | 1636839 | chunk-fsrffwma.js 15879: enter plan, description may request query, local editor or cloud get_plan |
| compact | 1132126 | chunk-qy8qtapj.js 14113,15263: real summary path, cancellation/empty/insufficient reduction/media errors; optional precomputed summary with custom-instruction exclusions |
| autocompact | 1132455,1132679 | Automatic compaction window control |
| context | 1134155,1134343 | chunk-0ffaqb39.js 3550,4242,4424: capacity/usage/categories/detailed contributions |
| usage/cost/stats | 1635441,1635634 | Local metrics at 407734 and formatting 411191; account/gateway usage branches chunk-zyb58qg2.js 15420 require provider data |
| status | 1167209 | chunk-2bzwahw5.js 20950: version/model/account/connectivity/tools Status tab |
| diff | 1134551 | chunk-8256f27w.js 5320 panel/dialog; chunk-twzxjzbk.js 26119 HEAD/branch/per-turn sources, binary/oversize states |
| rewind/checkpoint/undo | 1640413 | chunk-dat740yf.js 621 selector; chunk-24k7d6mw.js 382609 code+conversation, conversation-only, code-only or summarization choices |

No `/sessions` descriptor was observed in this bounded registry/router inspection. The independent `/sessions` command is an extension. Original `/session` at 1166567 aliases `/remote` and displays a cloud URL/QR. Independent `/fork` currently means a completed-history branch, closer to the original `/branch` than its background `/fork`.

Permission enum in `chunk-a60ee1ne.js` near 679: acceptEdits, auto, bypassPermissions, default, dontAsk, plan. External manual normalizes to default. This inventory does not establish complete enforcement for every tool.

Background/stop descriptors: `chunk-qp49xdq6.js` 639 and `chunk-1cdj73bv.js` 4586,4718. Original clear selectively preserves background task state; independent clear/fork currently cancels old-session jobs and schedules as an explicit ownership choice.

## Headless launch and I/O

Parser `chunk-1dhzexv1.js`:

| Flag | UTF-16 | Surface |
| --- | ---: | --- |
| print | 47406 | Print response and exit |
| output-format | 49197 | text/json/stream-json |
| json-schema | 49405 | Structured response schema |
| include-partial-messages | 49733 | Streaming partial frames |
| input-format | 50586 | text/stream-json |
| max-turns / max-budget-usd | 51903 / 52129 | Headless turn / positive API spend bounds |
| replay-user-messages | 52619 | Streaming acknowledgement frames |
| permission-prompts | 54582 | host/none |
| permission-mode | 57208 | Session mode |
| continue / resume / fork-session | 57481 / 57578 / 57712 | Latest cwd session / ID-picker / new ID on resume |
| no-session-persistence | 59144 | Print-only ephemeral history |
| resume-session-at / resume-drops-turn | 59305 / 59573 | Inclusive chain truncation / discarded-turn verification |
| rewind-files | 60207 | Restore files and exit with resume |
| model / effort / fallback-model | 60345 / 60513 / 60890 | Model, effort, ordered fallback with primary retried each user turn |
| file | 63955 | Provider file-ID startup downloads |
| worktree / tmux | 65360 / 65467 | Git worktree and terminal integration |

`chunk-9shw4xrd.js` 123261 validates print + stream output for stream input; 124817 validates both streaming formats for replay. Text stdin collection at 21607 is bounded. Detailed streaming frame schemas remain unresolved.

Worktree creation: `chunk-sfn1dbxq.js` 1749050-1751257 selects HEAD/PR/MR/remote-default with an observed fetch-failure local fallback. At 1751257 builds worktree add, optional no-checkout, no-track -B; layout identity checks reject redirected/unverifiable Git layouts. No Git fetch/worktree operations were executed during inspection.

## Terminal and media

`chunk-24k7d6mw.js` 778802 describes ! shell, / commands, @ file paths and image paste. Transcript toggles 135877, cancellation 434897, background shortcut 908743; these UI contracts exceed the independent readline REPL.

`chunk-8s56nf7t.js`: Bun.Image clipboard 3590; OS command fallback declarations 1655-3481; image extensions 5485; pasted path/WSL translation/magic validation/resize/reencode 5992; binary heuristic 6877. User image blocks/paste IDs: `chunk-er0mj94r.js` 46228/37276. PDF base64 document shape `chunk-sfn1dbxq.js` 2138086 alone does not prove the full user-input flow.

Voice descriptor `chunk-sfn1dbxq.js` 1164531; `chunk-gnpz58ga.js` 4905/7204 validates hold/tap/off and requires a Claude.ai account. Native capture/transcription/platform coverage remains unverified. Cloud command declarations (/session, /teleport, /remote-control, /remote-env, /ultraplan, /ultrareview, /schedule, /autofix-pr, /artifacts, /workflows, /desktop) require external provider services for their execution paths.

## Principal module identities

| Module | SHA-256 |
| --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da |
| chunk-1dhzexv1.js | bd0b184583b7ed75cbcd56c65bb3c5175dfeb7f94d6a35754b988df573ebfff9 |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 |
| chunk-8s56nf7t.js | 7fc34a2aa3076cceb825a0094eece20ccf89346ea895c7731bbd2760000c5cc7 |

Remaining gaps: complete graph, permission enforcement, stream frame schemas, voice backend, PDF intake, runtime availability and behavior equivalence. See FEATURES.md for migration status.
