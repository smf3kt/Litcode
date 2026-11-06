# C5 permission destination persistence investigation

Date: 2026-10-18. Static observations returned by workflow wf_34debf65-0a7. No product edits, runtime acceptance or external calls. Direct source reads remain required before implementation.

## Source identity

All ranges are zero-based UTF-16 half-open; investigator verified module decoded SHA-256 against extracted-v2/manifest.json.

- chunk-2bcyxj9q.js fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0. sf [195269,197020), KI [197487,197681), hKe [197681,197767), L9 [197767,197873), af [197873,199668), O1 [199668,199720), wco [194801,194953), jd [194953,195242), Do [191671,194364), ys [71522,71991). Managed gate wh [63831,63911), loader kd [67462,67956).
- chunk-x0dc37w9.js 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92. An [102209,102253), ta [102253,102464), settings writer us [102833,105519), legacy revoke hr [106115,107544).
- chunk-z6p21rxk.js 2e9c002da378e738a825dbd5c30f9a6341a9cf2c1d7022d4e1bbec2dfacf72dd. Un [3012,3238), _n [3238,3340).
- chunk-3cynezh1.js c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3. Ynn [398204,398553), GW [400882,401146), TO [401146,401294), Y3 [428266,428518).
- chunk-fyhzvvp0.js 1392b254e378432c7206e82a258512a740c26ce57263941ba3be4eb279675d19. CUt [3459,3835).

## Source contract

Memory retains mode, bypass availability, three destination-to-rule-array tables (allow/deny/ask), and additionalWorkingDirectories Map keyed by path with path/source values. addRules appends serialized rules without memory dedup; replace/remove affect only one behavior/source bucket. _n serializes Tool(content), empty content as Tool; Un normalizes Tool(*) to bare Tool. Directories add replaces source at same path; memory directory removal ignores destination. setMode bypass is ignored when unavailable. KI invalidates caches and applies jd/Do/sf in order, clearing existing startupModeDecidedByProactivityLevel when mode changes. Do validates widening updates as a whole, filters invalid tightening rules, validates nonblank/NUL-free directory additions. jd also filters Desktop Edit allow.

Public destinations are userSettings/projectSettings/localSettings/session/cliArg. Only the first three persist. Source files are user settings, project .claude/settings.json, and canonical project .claude/settings.local.json; product paths must be neutralized. Bypass never writes defaultMode. File structure permissions.allow/deny/ask/defaultMode/additionalDirectories. Adds compare normalized serialized old rules but preserve old strings; append new items absent from old list (same-batch duplicates can remain). Arrays in writer patches replace old arrays. Object patches deep-merge; undefined removes keys. File-path queue serializes updates. Parent creation, atomic write and config cache refresh occur. Bad JSON returns error and preserves original file. Unknown fields can survive raw-object fallback. Local migration may revoke legacy local file and update gitignore after canonical write.

CUt updates memory first then schedules O1 persistence asynchronously. O1 awaits sequentially, but af ignores returned writer errors and ys can log false. No all-or-nothing or disk-before-tool claim is supported. Managed-only gate affects rule loading and ys, not every sf/af branch.

## Product gap and consumers

Current permissions.ts collapses destinations, deduplicates and lacks directory/content/mode representation. Session updates are not journaled and restart empty. Managed settings override authored configuration as a whole, but later session allow/mode can participate. Current permission schema uses mode rather than source defaultMode and omits additionalDirectories. Display settings writer is user-only and lacks per-destination queues.

Consumers to synchronize: agent.ts plugin/MCP gate, tool gate, updatedInput recheck and both PermissionRequest paths; hooks.ts update protocol validation; diff-panel.ts effective permission view; interactive.ts, skill-runtime.ts, auto-memory.ts and agent-registry.ts config-only reads; CLI startup/reload/watch/resume/config forks and child inheritance. Preserve layer identity before flattening. Additional directory support must reach tools.ts actual path boundary, not merely settings persistence.

## Mode and restore follow-up

Peer bounded source verification on 2026-10-18 distinguishes these paths. Direct body reads remain mandatory before implementation. All coordinates UTF-16 zero-based half-open.

chunk-sfn1dbxq.js SHA256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da axr [3321472,3349548): dontAsk first preserves ordinary allow/deny, then converts ask to deny at3322821 except existing Chrome origin-consent special authorization. It is neither blanket deny nor bypass. auto sends eligible ask decisions through classifier gates, preserving ask rules, organization ceilings and user-interaction exclusions. Classifier source bhe [1108432,1113618), gze [1113867,1114161), lco [1096896,1104081), OLt [1106686,1107369), B0e [1105290,1105951) issues model inference using transcript/tool action, credentials/model/messages, fast/thinking stages and auto_mode query source. Vendor account/remote policy integration stays excluded; model inference itself needs an explicit Magpie provider adaptation and owned fixture rather than default allow.

chunk-jhr6hg8z.js SHA256 1918ec4c2b9982edfb9d71019038ac9ee74fa4d61bf1f1bb3bfc4cc74304cb7e b [3760,4100) restores internal.session_allow_rules only, filters nonstrings/mcp__, validates Wgs, skips managed-only, keeps existing bucket on empty result and replaces session allow on nonempty result. Cdn [4167,8639) emits metadata only on session allow reference changes; deny/ask/dirs/cliArg are not included. ONo [4100,4167) combines b with external mode restore L [2968,3760).

chunk-rx2nah4x.js SHA256 cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51 dH [676692,687879) invokes ONo at681597 only inside sdkUrl/restoredWorkerState branch. Ordinary print resume loads local transcript without this call; no local JSONL session_allow_rules field was found. Interactive UI restore remains unclosed and must not be generalized from print behavior. Preserve separate SDK-worker, print and interactive provenance.

## Proposed validation

A private user/project fixture invokes PermissionRequest updates for all three file destinations plus session/cliArg; verifies current and later tools, exact files and unrelated fields, reload/new-process/resume separation and shutdown writer draining. At most three new regression groups: bucket isolation and restart; concurrency/bad JSON/write failure with memory-first behavior; managed priority/bypass nonpersistence/directory consumers. All remain unimplemented and unverified.
