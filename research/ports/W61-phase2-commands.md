# W61 — phase 2 package 1: the non-coding slash-command surface

Status: verified. Base commit `df7abc4` in `/Users/mant1ssa/Projects/cc-base-2188`. 75 files deleted (8,242 lines) plus 171 lines cut from `commands.ts` (+1 comment); `tsc --noEmit --pretty false` exits 0. This is the first strip package of A11 phase ② — removing what is not coding from the base.

## Scope

41 command modules under `commands/` (desktop, install-github-app, install-slack-app, mobile, remote-env, release-notes, session, stats, stickers, tag, feedback, usage, insights, remote-setup, brief, bridge, voice, thinkback, thinkback-play, privacy-settings, passes, backfill-sessions, break-cache, bughunter, ctx_viz, good-claude, issue, mock-limits, bridge-kick, version, reset-limits, onboarding, share, summary, teleport, ant-trace, perf-issue, env, oauth-refresh, debug-tool-call, autofix-pr), the orphan `components/WorkflowMultiselectDialog.tsx` (referenced by nothing; its only import was the deleted `install-github-app/types.js`), and the five empty shells `daemon/ jobs/ proactive/ self-hosted-runner/ environment-runner/`.

## How the surface was chosen

A recon workflow (`wf_15e7d169-dad`, 20 of 180 agents completed; 160 died on gateway 429) inventoried 293 candidates across six faces and marked 170 as non-coding; 4 were rescued by the verification that did run and stay out of every removal set (upgrade, extra-usage, rate-limit-options, and chrome pending its entrypoint cluster). The 429s meant per-candidate cross-reference verification mostly did not run, so a local scanner (`.audit/w61-phase2-scan.mjs`) replaced it: it classifies each candidate by its importers from outside the candidate set. Package 1 = candidates whose only outside importer is `commands.ts`, where deletion is a registration cut plus a file delete. Artifacts: `.audit/w61-phase2-recon.json` (recon result), `.audit/w61-phase2-references.json` (final import classification), `.audit/w61-source-baks/` (29 quarantined `*.w*bak` inline source maps, byte-compared).

Three scanner defects were found and fixed on the way to the final classification, and are recorded because each one produced a wrong leaf list: import specs were only captured when starting with `.` (so `src/cli/update.js` aliases vanished), the path builder carried a `.js` suffix into the joined path so extension variants never fired, and `modulesOf` only collected `.ts/.tsx` while the dump holds large `.js` core files (`services/api`). The pre-fix lists misclassified `services/api`, `cli/remoteIO.ts` and the bridge dir as deletable; the final classification does not.

## Registration edits in commands.ts

Import lines and gated `const … require(...)` slots for every removed command; the `usageReport` insights shim; array elements in `COMMANDS` and `INTERNAL_ONLY_COMMANDS`; the spread lines for `forceSnip/ultraplan/subscribePr/webCmd/forkCmd/buddy/proactive/briefCommand/assistantCommand/bridge/remoteControlServerCommand/voiceCommand/peersCmd/workflowsCmd/torch`; the `...(!isUsing3PServices() ? [logout, login()] : [])` spread; entries in `REMOTE_SAFE_COMMANDS` and `BRIDGE_SAFE_COMMANDS` for removed commands; the dead `clearSkillIndexCache?.()` call (its const was `null`).

One deliberate adaptation beyond pure deletion: `BRIDGE_SAFE_COMMANDS`'s `.filter((c): c is Command => c !== null)` stopped typechecking (TS2677) once the array narrowed to four non-null members — the filter was already a no-op after W51's constant folding, so it became `as Command[]` with a comment. No behaviour change.

## Deferrals (recorded, not forgotten)

- `commands/login` and `commands/logout` are restored in this package. `cli/handlers/auth.ts` (the `claude auth` print path), `commands/upgrade` and `commands/extra-usage` all import from the login/logout modules; they belong to the auth-cluster package, which must cut those imports in the same change.
- `commands/chrome` and the `--chrome`/`--chrome-native-host`/`--claude-in-chrome-mcp` entrypoint cluster stay until that cluster is stripped together.
- 30 recon entries are recorded `missing` in the references JSON: their prose paths (`services/analytics (index/sink/…)`-style) defeated the normalizer. They are candidates for later packages and were not evaluated this one.
- The in-place CLI subcommand blocks (`claude auth …`, `claude ssh`, `claude install`, `claude update`, `--teleport`, `--remote*`, `--assistant`, `--brief`, `--proactive`, …) in `main.tsx`/`entrypoints/cli.tsx`/`setup.ts` are 33 recorded entries for later packages.
- The `referenced` side (services/analytics, services/oauth, services/tips, PromptSuggestion, claudeAiLimits, policyLimits, remoteManagedSettings, settingsSync, internalLogging, bridge/inboundMessages, voice, buddy, assistant, server, ssh, remote, moreright …) needs import-site surgery in coding-core hosts (`cli/print.ts`, `query/stopHooks.ts`, `screens/REPL.tsx`, `services/compact/*`, `utils/gracefulShutdown.ts`); the recon's whole-dir marks for `services/api` and `bridge` are wrong — both contain coding-core files and must be narrowed, not deleted.

## Verification and limits

`node_modules/.bin/tsc --noEmit --pretty false` from the base exits 0; `.audit/w60-tsc-final.txt` still holds the empty log (sha `e3b0c442…`). All four owned fixtures (`w58/w59/w59-followup/w60-verify.mjs`) pass unchanged; `git diff --check` clean. The base has no test suite and no bun runtime, so the acceptance surface is the compiler plus fixtures — no CLI ran, and no recovered entrypoint was executed.

The base is git-tracked, so every deleted file is recoverable from history; the quarantined `*.w*bak` files are not (they are gitignored), which is why they were copied out with byte comparison before deletion.
