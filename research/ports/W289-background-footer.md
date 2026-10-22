# W289 local background task footer

Status: verified locally on 2026-10-23. Independent review found no confirmed scoped defect.

## Task card

- Entry: run a background shell, monitor or local child, then keep using the composer.
- Outcome: the footer names live work by kind and clears after completion or stop.
- Source: Fz -> LVe -> pz/Vde -> Tfe/Vg -> Sjr/vyt/i.
- Targets: task-label source/adapter, terminal surface, interactive subscription and job snapshots.
- Shape: an optional live BackgroundTaskSnapshot reader; no second task store or count.
- Mode: copy the label closure; adapt its store subscription to the existing runtime owner.
- Existing differences: one local footer; /tasks owns management; no remote/account task store.
- CLI chain: shell/monitor/child start, natural exit/stop, draft, resize, rebind and cleanup.
- Done: affected checks, check/build, compiled CLI, independent review and local commit.

## Source preflight

Sample 2.1.296 SHA-256 is c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All ranges are zero-based UTF-16 code units, half-open. Module hashes match decodedSha256.

| Module | SHA-256 | Obtained bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | pz [740155,740694), Vde [740694,741175), Fz [757600,762144), LVe [762242,771241), default js [768633,768681), final row [770079,771241) |
| chunk-y5d901dg.js | 73562776966c4f2bc7ed94ca58a030176294979ae659eb5da683e22205f3b853 | Sjr [759,2262), vyt [2262,2314), i [2314,2376) |
| chunk-3qabb19b.js | ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2 | F [673,732) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | FS [65975,65986), ZA [65987,65998) |
| chunk-j8hqhz0c.js | 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891 | Vg [16174,16309), Pt [16673,16761), TAe [16761,16790) |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | Sn [84837,84907), x4 [84907,84939), Tfe [189738,189892), fmt [189892,189948), hIe [189948,190028) |
| chunk-hasac4vg.js | d5e03f345f45bd21e434d436004fe65dbc1099668fe348a1b4282f80bcc7f99d | iF [18680,18767), vJn [18870,19033), oae [19033,19099) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | IC [4222190,4222263) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | ve [92857,92917) |
| chunk-3gz7s57c.js | 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b | nv [9765,9819) |
| chunk-5g03s1vd.js | e97280ff5b92abebe38a2d69c3bada414caedf0e4d90738981286b7c0c9e5fe1 | dA [780,811) |
| chunk-356hrhz3.js | 0c821efb255e53af566480e6263c87c8be068ed1a7dae3205b2964f0f0c9076a | QD [926,953), i4n [953,980) |
| chunk-6zdc3jq1.js | 8009c180a36973dc5853feebabd9653728bb5a902f3f27aa36cd883187ca3e9a | vps [2939,2963) |

nv returns dA(i4n) && Mi() && !nt(). i4n -> QD -> vps returns false in this build,
so Fz selects LVe even in fullscreen. The separate tengu_copper_thistle gate defaults
false at [762790,762825); its WVe count-only renderer is not the default contract.

The default LVe computes fmt, uses Xn=yn>0 and renders pz for a positive eligible count.
pz filters Tfe and uses vyt. Vde always paints its label in the background theme slot;
selection/hover only changes inverse. With no onClick it returns the text node directly.
The final row retains task width and truncates trailing hints. Idle shortcuts are suppressed
when js exists. Bash, paste-expand and selected coordinator/workflow rows return earlier.

Vg admits running/pending tasks unless isBackgrounded is explicitly false. Pt/TAe excludes
ambient WebSocket monitors without an explicit frame. Tfe additionally filters local workflows
and coordinator-owned agents when Sn is true. IC admits a local_agent that is neither a
main-session nor a forkWorker. Sn reads the default-true coordinator flag, except when ve
reports a noninteractive launch. This host has no coordinator panel or its separate display
owner, so adapt Sn to false and keep its running child agents in this footer. This is a
recorded gate adaptation, not the source default. There is no separate local_workflow producer.
Crons and durable tasks are not background execution. Completed and queued children stay
outside the runtime's existing active projection; its queued state is setup, not source pending
background execution. Workflow agents already belong to that same child registry.

Sjr gives homogeneous bash jobs shell/monitor counts, homogeneous local agents their own count,
WebSocket monitors a monitor count, and mixtures N background task(s). vyt uses remote count
zero for the type-specific branch. Copy all three bodies and F, FS, ZA. The label dependency
oae requires monitor_ws autoReactArmed plus an enabled host auto-react service; local snapshots
have neither. Bind oae to false, so those monitors use the source's ordinary monitor label.
The copied unreachable remote/team/vendor branches gain no producer or network operation.

## Host ownership and adaptations

The existing BackgroundTaskSnapshot reader supplies jobs and children. Preserve source=websocket
in active job projections to distinguish monitor_ws from shell monitors. Map run/shell-monitor
jobs to local_bash, WebSockets to monitor_ws and children to local_agent, then use Vg/TAe.
Do not reuse the kill chord's ane count as a footer formatter or include scheduled crons.

Add the optional reader to bindBackgroundWork alongside the existing kill-count/stop callbacks.
The interactive closure reads the current session variable. Tool-result painting already covers
starts; runtime.subscribe notifications cover exits and child completion. Its callback repaints
and awakens without draining notifications. Existing successor binds repaint after owner changes.
No polling timer or task lifecycle mutation is needed. Closing drops the reader and subscription.

Only the chat footer receives this local indicator. Existing paste, bash, diff-attachment and
navigation-screen precedence stays intact. Permission, task label, local status and hints share
the existing footer row. The task gets its measured width before the local padding and hint
budget; feedback/stash keep the right column. The existing /tasks command manages work. No
down/manage, click, selected-task or foreground affordance is displayed without its handler.

## Throughput checkpoint

- Blocking steps: branch default, type-label closure, active snapshot and notification ownership.
- Independent work: one bounded source question; one read-only review after the implementation.
- Shared mutable state: one writer in the current checkout; unrelated changes remain intact.
- Smallest complete unit: label, live owner, width and completion repaint in one package.

## Validation

Pre-change decoded 120-column composer has a retained draft and no task label for a live job.

- npm run check and npm run build exit 0.
- Affected tests pass 200/200 across tui, tasks-panel, tasks-command, background,
  websocket-monitor, runtime-resources and interactive. Three added regression groups cover
  per-kind counts, omitted queued/finished/scheduled work, decoded widths/color/overlays/close,
  current-owner repaint and successor subscription teardown. Existing assertions stay intact.
- .audit/w289-background-footer.mjs passes source digest/text/AST checks and 18 compiled label
  cases against the isolated recovered formatter. Copied application entrypoints stay inert.
- Compiled PTY acceptance passes 21/21 at 160, 80 and 40 columns. Real owned processes exercise
  shell and monitor labels, natural completion with no input, WebSocket/shell monitor mixtures,
  the confirmed kill chord, a held local child, child completion preserving the draft, the
  existing /tasks manager, stop and /clear successor cleanup. All three CLI processes exit 0;
  all owned background PIDs and sockets exit; session/history locks are released; journals omit
  the fixture credential. This driver sends 22 requests to an owned loopback SSE provider,
  including existing background event turns. Paid upstream calls are 0.
- Existing compiled W285 effort acceptance passes 26/26 and W286 stash acceptance passes
  19/19 at the same content identity. The W286 startup wait now uses composer/permission state
  at 40 columns because the ready word is clipped there; every stash assertion is retained.
- Comment/suppression review reports no actionable scoped findings, 0 deletions, 0 restores,
  0 reruns or encoding proposals. Copied-source suppression and source citations follow S-7.
- Independent correctness review verifies all 13 recorded module identities, copied bodies,
  mixed WebSocket/shell-monitor classification, current-owner rebind, natural completion and
  post-close zero reads. No confirmed scoped defect. At 40 columns a long accept-edits chip
  together with effort and stash can consume the row and hide the task label; 80/120-column
  mixed labels remain complete. This is the existing footer allocation limit. The new CLI
  tests verify the 40-column shell label without those competing indicators.
- The full suite is not repeated; its current
  baseline remains W283's 3201/3202 with cli-migration.test.ts:87's existing effort mismatch.

Content identity: 7f10202c003bafde9048bbd12f7d0238fcbb13a62064835a1a2a2db76f70fb02.
Inputs: 182bba1a9ce1341edc0b9dbb97acc19e5dfe2e9c1952e7d15566de2eb00ed875.
Validation: c5506034dfb8de15dcd12fb9827bc175388f8f6dc58999ae795205d1f4ead424.
Build: b2a250663493a97d39a178e15a6418657c61295e85c8b88837613a1a9cae6d7c.
Logs live in the job temporary directory under w289-check, w289-build, w289-focused,
w289-cli, w289-cli-result.json, w289-effort-cli and w289-stash-cli.

## Coding-standard check

S-1/S-7 obtain the branch gate and full formatter before edits, then compare every copied body
by text/AST and compare compiled labels to the isolated source. S-2 retains draft, key and
existing geometry assertions. S-3 only renders labels; no display text enters task requests.
S-4 reads the current session without another task store or timer and releases reader/subscription.
S-5 binds decoded labels to owned PIDs, held responses and saved lifecycle state. S-6 carries
WebSocket identity through every active snapshot reader and all three runtime subscription sites.
Rework is recorded in the existing ignored question.md. The existing rules cover its causes.
Model the Domain chooses one task snapshot reader. Prove It Works chooses the compiled CLI.
