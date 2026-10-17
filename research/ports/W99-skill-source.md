# W99 — UserPromptExpansion command_source

## Source position

`VYr` (chunk-sfn1dbxq.js [2947575,2947964)) builds the expansion payload with
`expansion_type`, `command_name`, `command_args`, `command_source` and
`prompt`. The single caller, `at` (chunk-htgmc2p1.js offset 38703), passes the
command entry's own `source` as `command_source` and derives
`expansion_type` from it (`mcp` → `mcp_prompt`, everything else →
`slash_command`). The hook schema keeps `command_source` optional
(chunk-r2vtj1kh.js offset 195092).

The skill loader assigns that `source` while reading each directory: the
filesystem loader `mO` (chunk-sfn1dbxq.js [3384052,3388176)) places the
scope passed by its caller into the skill record (`source:n` at 3383703), and
the directory discovery `sAr` (offset 3390484) passes `policySettings`,
`userSettings` and `projectSettings` for the managed, user and project
locations. Plugin components carry the literal `source:"plugin"`
(offset 962912), alongside `loadedFrom:"plugin"`.

## Port

`SkillInfo` gains `source?: SkillSource` with the three scopes this product
reads: `.harness/skills` → `projectSettings`, `<userDir>/skills` →
`userSettings`, installed plugin skill directories and explicit
`settings.pluginDirs` → `plugin`. The interactive slash-command expansion
adds `command_source: skill.source`; when a hand-built skill has no scope the
key is omitted, matching the optional schema field.

## Adaptation

The recovered loader also reads managed policy skills, the synced host catalog
and bundled/MCP/memory-store skills. This runtime has none of those catalogs,
so only the three scopes it actually scans can appear; no source string is
invented for the absent ones.

## Verification

`config` asserts the scope on project, user, installed-plugin and configured
plugin skills. `interactive` asserts the wire payload carries
`projectSettings` for a scoped skill and no key for a hand-built one.
`agent-lifecycle` asserts the expansion hook receives `command_source`.
Focused 170/170, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0,
identity `e0cd9d5e…`.
