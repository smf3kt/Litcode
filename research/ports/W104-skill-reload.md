# W104 — SessionStart reloadSkills

## Source position

`reloadSkills` is a SessionStart output field described as "Re-scan skill and
command directories after SessionStart hooks complete, so skills installed by
the hook are available in the same session" (chunk-n3ykh62m.js offset 392149;
schema at chunk-r2vtj1kh.js offset 205984). The hook loop keeps it sticky when
any output sets it true (`H7`, chunk-sfn1dbxq.js offset 2482855). After the
loop it runs `bM(),$5(),i1.emit()`: `bM` is `VT(),Nhr(),Fhr(),Hz()` at offset
1675968 (commands, agents, output styles, skill dirs), `$5` resets the
sent-skill names at offset 3689254, and `i1` emits the `skillsChanged` signal
defined at offset 2478788. The schema admits only `true`.

## Port

`HookResult` gains `reloadSkills`, parsed only from SessionStart output with
`=== true`. `Agent.startSession` applies it after the hooks complete and after
the title handling, so every start path (interactive, headless, clear/fork,
subagents, execution-mode skills) gets the rescan. `skill-catalog.ts` owns the
shared catalog section: `buildSystem` now renders through `skillsSection`, and
`reloadSkills` re-reads the skill directories, replaces the live array's
contents in place (the model-facing skill tool holds that reference) and
rewrites the system prompt's catalog section while preserving any later
sections. Settings, hooks, permissions and instructions stay as loaded.

## Adaptation

The source invalidates derived cache tables. This product has no derived caches:
its catalog is the session config's `skills` array, read at call time, and its
rendered form is the system prompt string, so the equivalent is an in-place
array replacement plus a section rewrite. `$5`'s sent-skill-name reset has no
counterpart here, and `i1`'s change signal has no subscriber. A legacy
configuration (`skills === undefined`) has no skill tool to feed and is left
alone. A rescan failure is reported through the status stream and keeps the
previous catalog. The rescan uses `loadProjectConfig`, which validates settings
on the way; the source touches only skill directories.

## Verification

`hooks` asserts SessionStart-only parsing for `true`, the `false` skip and the
UserPromptSubmit ignore. `reload` proves additions, removals, the preserved
array reference, the rewritten section, unchanged settings and the legacy
no-op. `agent-lifecycle` proves a hook-installed skill reaches the live catalog
and the system prompt after `startSession`. Focused 110/110, tsc 0, build 0,
full 2,140/2,140, chain 767/767, notices 0, identity `b59db97a…`.
