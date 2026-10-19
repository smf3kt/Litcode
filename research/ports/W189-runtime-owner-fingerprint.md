# W189 runtime owner tool-set fingerprint

2026-10-19. Blocking repair surfaced by the W188/C2 compiled acceptance run.

## Defect

After any turn that calls a tool, every later prompt in the same session failed with
`Runtime owner configuration changed; release session resources before rebuilding`. The session
stayed single-turn for the rest of its life. Reproduced on a detached worktree of `9f72427`
(pre-C2, no local changes) in both line mode and TUI; three consecutive prompts without a tool
call stayed healthy. The guard and the owner cache were introduced by `9caf843` (W181).

## Root cause

`buildTools` (`src/runtime.ts`) keys the per-owner tool-set cache on a JSON fingerprint of the
session config. That fingerprint strips `skills`, `agentTypes` and the rendered skills/agents
system sections, but it did not strip the two fields a turn's path access writes:

- `activateTouchedSkills` (`src/skill-catalog.ts`) moves a held skill into `skills`, rewrites
  `heldSkills` and re-renders `system`.
- `discoverTouchedSkills` (`src/skill-catalog.ts`) records every visited
  `<HARNESS_DIR>/skills` directory in `dynamicSkillDirs`.

`Agent.ruleContext` (`src/agent.ts`) runs both on the first access of a read/write/edit path.
On the next turn the interactive loop calls `buildTools(config, session.id)` while the owner
still holds its resources; the fingerprint differed, so the guard threw.

The skill tool reads `config.skills` by reference (`createSkillTool`, `src/runtime.ts`), which
is why `skills` and the rendered section are already excluded: catalog mutation is visible
without a rebuild. `heldSkills` and `dynamicSkillDirs` are the same class of bookkeeping.

## Fix

Exclude `heldSkills` and `dynamicSkillDirs` from the fingerprint alongside `skills`. No other
part of the owner identity changes: a genuine pinned-setting or plugin-generation change still
invalidates the cache, and a changed fingerprint for a live owner still refuses to rebuild.

## Validation

- `npx tsc --noEmit` clean; `npm run build` clean.
- `test/runtime.test.ts` 24/24, including the new regression: build the owner tool set, apply
  the exact mutations a turn makes (`activateTouchedSkills` with a matching path,
  `discoverTouchedSkills` recording nested and workspace harness directories), then build again
  and require the same tool names.
- Affected set `runtime`, `skill-runtime`, `agent-lifecycle`, `interactive` 133/133.
- Compiled PTY (`bin/personal-harness.mjs`, private HOME/XDG/git workspace, owned loopback SSE):
  two real user turns whose tool calls write and edit a file (`made.txt` content asserted
  `first\nSECOND\nTHIRD\n`), then `/diff` shows `Current   T2   T1`, `2 files changed`,
  `made.txt untracked`, `sample.txt +20 -20`; `/exit` returns 0.
- Compiled verifier driver (exit listener attached before any input) passes list/detail/scroll/
  Escape twice, draft retention, one tool turn, Current/T1, `zzz` routing, resize 100/40/100 and
  exit 0.
- Compiled resume probe: dialog remounts over a stored session with no provider call, Ctrl+C
  while the dialog is open leaves the dialog and process alive, Escape dismisses, both sessions
  exit 0.

## Boundaries

The repair changes the fingerprint's identity rule only; it does not alter when an owner is
released, when resources are rebuilt, or the behavior of a genuine configuration change.
`heldSkills` drifting during a turn was not observed in the fixture (its scoped-skill path is
exercised by the unit regression); the exclusion follows from the same by-reference catalog
design as `skills`. The exit-hang reported by the verifier was a defect in the verifier's own
driver (the `exit` listener was attached after the settle window, so an already-exited child was
missed), not in the product; the product exits 0 with and without the dialog.
