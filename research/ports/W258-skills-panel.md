# W258 `/skills`

The recovered Skills panel, its per-skill mode cycling and the local `skillOverrides` write. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-hkrgn8hf.js` | `39a1769355adecf252d7842b15c2d2fab0770e8af9fc66dd3f6d707968cf2f82` | `He` 23602 | dialog body: sort, filter, mode state, save, rows |
| ↳ | | `wr` 31783 | `local-jsx` registration; `bytesPerToken` from `Ch(mainLoopModel)` |
| ↳ | | `As` 23121 | sort toggle `(value) => !value` |
| ↳ | | `Hs` 23147, `Zs` 23178 | row names, and the `__proto__` reserved-name filter |
| ↳ | | `wt` 23510, `bt` 23543 | mode icons/words and the lock label |
| `chunk-z3fv2hxp.js` | `2954bdb160b17cb3dbe5b7d335df40053653ef6b57cd07da0dd653dce7220360` | `cgt` 1033 | cycle order |
| ↳ | | `PLr` 1233 | lock sources: policy/flag, reserved name, author, plugin |
| ↳ | | `F` 1828, `b` 2097 | stored override lookup |
| ↳ | | `BIe` 2143, `xje` 2341 | source label and display name |
| ↳ | | `ILr` 2408 | claude.ai collision note; `undefined` without synced skills |
| ↳ | | `Pje` 4664 | sort by source label or tokens |
| ↳ | | `O4n` 4966 | local overrides table |
| ↳ | | `Ije` 5059, `Oje` 5212 | lock table and default modes |
| ↳ | | `w$t` 5422 | diff, writes, effective changes |
| `chunk-sfn1dbxq.js` | | `OQr` 3372617 | `[name, description, whenToUse].join(" ")` |
| `chunk-hwpb27as.js` | `c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e` | `Td` 4137 | `Math.round(text.length / bytesPerToken)` |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `KB` 11476 | `< 20`, else `~` to the nearest ten |

## Behaviour

- **Panel.** `He` mounts a `Skills` dialog over `commands`. The list is `Pje`: by source label then display name, or by token estimate descending then name when `t` toggles `sortByTokens`. The filter matches name, display name, description and source label, case-insensitively. Each row is `xje(skill)` with meta `[lock reason, mode word, source label, "${KB(S6e(skill, bytesPerToken))} tok"]`.
- **Modes.** `cgt` is `["on","name-only","user-invocable-only","off"]`; Enter or space advances the focused row and wraps. `PLr` pins three cases: `__proto__` as a reserved name, the author's `disable-model-invocation` to `user-invocable-only`, and plugin skills to `on`. A pinned row cannot be cycled.
- **Defaults.** `Oje` reads lock value, then the local table (`O4n`), then `on`. `w$t` compares the chosen mode with the locked lower tier: choosing that tier clears the stored entry instead of pinning it. `writes` counts changed entries; `effectiveChanged` counts rows whose mode differs from what the stored table already produced.
- **Save.** `confirm:no` (Escape) calls `An("localSettings", {skillOverrides: diff})` and then `VT()` to invalidate the command table. On failure it reports `Failed to save skill overrides: <message>`; otherwise `Updated N skill override(s)` or `No changes`.
- **Empty and notes.** No skills: `No skills found` with `Create skills in .claude/skills/ or ~/.claude/skills/`. No match: `No skills match "<query>"`. Any plugin skill adds `Plugin skills are managed via /plugin`; a stored-name guard adds the reserved-name note.
- **Cancel.** The dialog's own cancel reports `Skills dialog dismissed`.

## Host adaptations

- **Mode application.** The runtime honours the merged `skillOverrides` setting through `SkillInfo.mode`: `off` hides the skill from the composer and the model, `user-invocable-only` removes it from the model catalog, and `name-only` keeps the catalog row without its description (`skillsSection`). Authored flags stay untouched, so the panel's lock table still reflects the file rather than an applied override.
- **File and precedence.** The write targets the canonical local layer (`permissionSettingsPaths.localSettings`); reads merge a legacy cwd file beneath it, matching the loader at `src/config.ts` 1180. The recovered `F` consults project then user settings for regular skills; this host uses the merged settings table, where the local layer wins, because both the runtime application and the panel must agree.
- **Dialog surface.** `skillsPanelRows` emits one description string per row (meta joined with ` · `) for the host row renderer. The host dialog has no text-filter field, so `/ to search` is not offered and the subtitle's guide reads `enter/space to cycle, t to sort, esc to save`; `t` is a requested `keys` entry. Escape both saves and closes, the recovered `confirm:no` arm. The separate `Skills dialog dismissed` path (the vendor's own cancel) has no host keystroke.
- **Path hint.** The empty hint names `.harness/skills/`, the directory this loader scans, instead of the product's `.claude/skills/`.
- **Excluded.** `ILr`'s claude.ai collision sentence needs synced skills and is always `undefined` here. `PLr`'s policy/flag branch and `w$t`'s MCP and synced-skill arms read vendor control-plane state and are not ported. `Ch(model)`'s per-model byte ratio collapses to the default 4, the value it returns without a model.

## Validation

- `test/skills-panel.test.ts`: 14/14 (cycle, locks, defaults, both sorts, filter, row meta, token range, diff arms, local-table merge, atomic save, messages, loader application, lock precedence).
- `test/skills-command.test.ts`: 1/1 (Enter cycles `alpha` to `name-only`, second render shows the new meta, Escape writes `{ skillOverrides: { alpha: "name-only" } }` and reports `Updated 1 skill override`).
- Focused regressions `skills-panel`, `skills-command`, `interactive`, `tui-autocomplete`, `skill-catalog`: 62/62.
- Compiled `.audit/w258-skills.mjs`: 10/10 at identity `3e8af877…`. The panel lists three skills with source and token meta, the author lock shows `user-only`, Enter cycles to `name-only`, `t` sorts by tokens, Escape writes exactly one override and reports the change, reopening shows the saved default, and a second Escape reports `No changes`.
- Full suite: see the STATUS line (only the known CLI-effort failure remains).
