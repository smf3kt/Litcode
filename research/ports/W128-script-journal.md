# W128 — Workflow script journal and resume

W125/W126 run workflow scripts but leave every invocation independent. The
recovered runtime journals each agent() call and lets `resumeFromRunId` reuse
the unchanged prefix. This package ports the journal and the resume path.

## Source position

- Journal (`sn`, `Do`, `Hr`, `No`, `Qr`; chunk-hedqf2m1.js 20500-23000):
  `<run dir>/journal.jsonl`, one JSON entry per line, `launched`/`started`/
  `result`/`failed`; results and started attempts are indexed by key, failed
  keys tracked separately; unparseable lines are skipped. The key is
  `v2:sha256(previousKey \0 prompt \0 canonicalOptions)` where canonical
  options are `schema/model/effort/isolation/agentType/disallowedTools/
  bashCommandClamp` copied with sorted keys and functions dropped, and the
  prompt is `String(prompt)` for primitives. The first key chains from `""`.
- Runner cache (chunk-hedqf2m1.js 47494-48200): a cached result returns
  without spawning; a call with a `started` entry and no `failed` entry
  respawns without breaking the cache for later calls; the first miss stops
  cache reads for the rest of the run; a `null` result writes `failed` and no
  `result`.
- Resume entry (chunk-a7gk0710.js 59981 schema, 65391/69003 preflight, 70009
  run id, 73879 collision check): `resumeFromRunId` matches
  `/^wf_[a-z0-9-]{6,}$/`; run ids are `wf_` plus the first 12 characters of
  a UUID; a run with the same id that is still active is refused; a missing
  journal is refused with a "nothing to resume" message, and the recovered
  path then tries a remote session mirror.

## Port

- `workflowAgentJournalKey` (src/workflow-script.ts) ports `No`/`Hr` and the
  primitive prompt projection. `loadWorkflowScriptJournal` reads the file
  with `O_NOFOLLOW`, rejects a non-regular file and a size over 2 MiB, skips
  unparseable/invalid entries, and returns undefined when the file is absent.
  `openWorkflowScriptJournal` appends with `O_WRONLY|O_CREAT|O_APPEND|
  O_NOFOLLOW` after creating the directory with mode 0700.
- `runWorkflowScript` takes an optional journal. Each agent() call computes
  the chained key after options validation, returns a cached result without
  spawning, applies the started-without-failed respawn rule, and writes
  `started`/`result`/`failed` entries in order. Journal write failures never
  fail the script, matching the recovered warning-only behavior.
- `workflow_run` generates `wf_<uuid12>` (or reuses `resumeFromRunId`), stores
  the journal under the owner's workflow directory at
  `journals/<runId>/journal.jsonl`, appends `launched` for a fresh run, and
  returns `run_id` beside the script result. The bridge reports the child id
  through `onStarted` so `started` entries carry the real session id.
- `WorkflowStore.journalDirectory` validates the run id before building the
  session-owned path; the owner directory is never traversed by a caller path.
  `WorkflowRegistry` tracks active script runs to refuse a concurrent resume.

## Adaptation

- The recovered journal has an account-backed remote mirror used to restore a
  missing or partial local journal. This runtime is local-only, so a missing
  journal is refused with the local adaptation of the same message, and no
  remote restore is attempted. `resumeFromRunId` is exposed only when the
  workflow tool is constructed with session persistence.
- The recovered remote-session fields (`remoteSessionId`) are accepted and
  ignored on load; entries are otherwise validated exactly as `Qr`.
- Script runs and DAG runs share one owner directory; script journals live in
  the `journals/` subdirectory so existing snapshot listing and limits are
  unchanged.
- Named workflows, remote journal mirroring, reattachment and automatic effect
  replay remain out. Script text itself is not part of the key chain, exactly
  as in the recovered runtime: editing the script while keeping the same call
  sequence and options reuses cached results.

## Verification

`workflow-script` adds prefix reuse (including label insensitivity), changed
options rerunning only that call, started-without-result respawn, failed-call
non-caching, malformed-line skipping, and a tool-level persisted run plus
resume with one provider request. tsc 0, build 0, focused 64/64 (workflow,
agent-isolation, cli-gateway, migration-integration), notices 0, source index
unchanged, identity `4c2f329b…`.
