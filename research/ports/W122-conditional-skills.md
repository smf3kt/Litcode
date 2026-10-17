# W122 — Conditional skills (frontmatter `paths`)

## Source position

`qlr` parses a skill's frontmatter and stores `paths: smn(z)` (chunk-sfn1dbxq.js
offset 3376365); `smn` (offset 3374436) splits the string or array with the
brace-aware comma splitter `bRt` (chunk-zm79vshj.js offset 8785), drops a
trailing `/**`, discards empty entries, and returns undefined when nothing
meaningful remains or every entry is `**`. The assembler `sAr` (offset
3392751) then partitions the de-duplicated skills: a prompt skill with a
non-empty `paths` goes to `conditionalSkills` keyed by name instead of the
returned catalog, unless `activatedConditionalSkillNames` already holds it.

Activation is `emn` (offset 3398872). For each held skill it builds a
gitignore matcher from the paths (`cKe` filters patterns the matcher cannot
compile, chunk-2bcyxj9q.js offset 152393), then for each touched path: an
absolute path is made relative to the workspace, and empty, `..`-prefixed or
absolute results are skipped; the first match moves the skill from
`conditionalSkills` to `dynamicSkills`, records its name in
`activatedConditionalSkillNames`, logs the matched path and emits
`dynamicSkillsLoaded`. `MU` (offset 3399649) calls it from the read, write and
edit tool paths before the access (offsets 739846, 3547532, 4167540).

## Port

- `SkillInfo.paths` carries the normalized patterns; `skillPathPatterns`
  reproduces `smn` including the comma/brace split and the `/**` trim, and a
  non-string pattern raises a `ConfigError` instead of dropping the skill.
- `loadProjectConfig` returns live `skills` and `conditionalSkills` separately
  (`LoadedConfig.conditionalSkills`), so every caller gets the same split the
  recovered assembler performs.
- `SessionConfig.heldSkills` is the live held list. `activateTouchedSkills`
  (src/skill-catalog.ts) moves matching entries into the captured `skills`
  array in place and re-renders the system-prompt section only when something
  activated.
- `Agent.ruleContext` calls the activation for every path-bearing tool input
  before the tool runs. The next model request reads the updated
  `config.system`, so the new catalog entry is visible without a restart.
- The matcher is the `ignore` package the recovered bundle itself uses; pattern
  semantics (a directory pattern covers descendants, `!` re-includes) are
  therefore identical. Activation of a name already in `skills` is a no-op
  because it left the held list with the same name.

## Adaptation

- The recovered trigger is wired to read/write/edit only. This runtime applies
  the same touch test to every path-bearing tool already covered by
  `ruleContext` (read_media, notebook_read, notebook_edit, lsp, search,
  list_files); the trigger is idempotent and strictly additive.
- Dynamic directory discovery (`dAr`/`E3t`, which loads `.claude/skills`
  directories found beside a touched path) is not ported; this package covers
  the conditional-skill half only.
- The source's reserved-name refusal and collision naming are unchanged (still
  open under C-10).

## Verification

`config` pins normalization (`src/**` → `src`, `**` → unconditional, string
form, empty list, non-string error) and the partition. The activation tests pin
gitignore semantics, one-level `docs/*.md`, negation via directory patterns,
workspace escape and absolute inputs. `skill-runtime` pins the live catalog
and prompt re-render through the captured array. `agent-lifecycle` pins that a
matching read activates the skill before the next model request and a
non-matching read leaves it held. Focused 134/134, lifecycle 55/55, tsc 0,
build 0, full 2,190/2,190, chain 768/768, identity `03e2bef1…`.
