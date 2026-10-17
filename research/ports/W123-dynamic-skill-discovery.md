# W123 — Dynamic skill directory discovery

## Source position

`MU` (chunk-sfn1dbxq.js offset 3399634) runs from the read, write and edit
tool paths before the access (offsets 739846, 3547532, 4167540). It calls
`dAr` with the touched path and the workspace base, then loads the returned
directories with `E3t` and activates conditional skills for the same touch.
A request-time drain also reloads pending directories through `E3t` when the
Read tool is available.

`dAr` (offset 3396591) walks upward from the touched file's directory to the
workspace base. At each ancestor it forms `<dir>/.claude/skills`; the first
time a candidate is seen it records it in the session's `dynamicSkillDirs`
set, then keeps it only when the directory exists, is not ignored by git
(`KAr`: `git check-ignore -- <dir>`, chunk-x0dc37w9.js offset 4806), and is
not sync-owned. Discovery is skipped entirely when skills are disabled, a
policy base is active, or the session is diskless. Errors from a candidate are
swallowed; the walk continues at the next ancestor.

`E3t` (offset 3397661) loads every returned directory with the project source
(`mO`, offset 3384052), keeps prompt skills in `dynamicSkills` keyed by
`skillRoot` and name, removes stale entries when `replace` is set, and emits
`dynamicSkillsLoaded`. The recovered request assembly merges those entries
under the live catalog. A global rescan (`WRn`, offset 3399814) re-reads the
already discovered directories with `{replace: true}`.

## Port

- `discoverTouchedSkills` (src/skill-catalog.ts) climbs the same ancestors,
  substitutes the product's `<HARNESS_DIR>/skills` for the recovered
  `.claude/skills`, records every candidate in `SessionConfig.dynamicSkillDirs`
  before checking it, skips candidates that are absent or ignored by
  `git check-ignore`, and loads survivors with
  `loadSkillsFromDirectories` (source `projectSettings`).
- New skills are appended to the live `skills` array in place and the catalog
  section is re-rendered, so the next model request sees them. No `contexts`
  are returned, so a mutating tool is not forced to re-evaluate.
- `loadSkillsFromDirectories` scans each directory with the project loader's
  `SKILL.md` rules but skips a malformed entry instead of failing the tool
  call (`mO` logs and continues); names already live or held are not returned.
- `reloadSkills` re-reads `dynamicSkillDirs` after the static rescan, matching
  `WRn`; `dynamicSkillDirs` is journaled with the session config.

## Adaptation

- The recovered product scans `.claude/skills`; this product's configuration
  directory is neutral, so it scans `.harness/skills` and the workspace base is
  the session workspace.
- The recovered tool path queues directories on `dynamicSkillDirTriggers` and
  the request path drains them; this runtime awaits the load inside the touch
  trigger so the next request is deterministic. Loading is once per candidate
  directory per session, as in `dAr`.
- Duplicate names: the recovered `E3t` stores dynamic skills separately and
  merges by name during request assembly; this flat catalog skips a discovered
  name that is already live or held.
- Dynamic skills with frontmatter `paths` join the catalog directly. The
  recovered `E3t` stores every prompt skill in `dynamicSkills` without the
  load-time conditional split, so the visible behavior matches.
- The diskless, policy-base and sync-owned gates have no counterpart here.
  Reserved-name refusal and collision naming remain open under C-10.

## Verification

`config` pins tolerant directory loading (a malformed entry is skipped, an
existing name is filtered, a missing directory is a no-op). `skill-runtime`
pins ancestor discovery, the once-per-candidate set, the workspace boundary
and the gitignore skip through a real `git check-ignore`. `agent-lifecycle`
pins the touch trigger: after reading a nested file, the next request's system
prompt carries the discovered skill and the catalog array keeps its identity.
Focused pool 137/137, three-suite 164/164, tsc 0, build 0, full 2,194/2,194,
chain 768/768, identity `4149770c…`.
