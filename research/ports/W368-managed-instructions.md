# W368 settings and instructions: the managed tier, and an isolated child's own checkout

Status: implementation, main verification, and two bounded independent reviews. The first returned NOT_VERIFIED with four defects; all four were repaired. The second returned CONFIRMED_REPAIRED with three further fixes and two recorded limitations. One active package.

## Task card

ID: W368, the Settings and instructions family's next source difference. The family's finite predicate in the inventory is "managed merge, new instruction discovery and isolated child paths in actual CLI".
User chain: a workspace under a managed policy directory shows no managed instruction text in the model's system prompt, and an isolated (`worktree`) child is told the parent's instruction files rather than the checkout's.
Source: `qZn` (chunk-sfn1dbxq.js 668054), `mCt` (674681), `Znr` (674896), `gCt` (675599), `zae` (662489), `Sar` (3671831), `Zyn` (3669904), `leo` (682161), `xC` (680835), `I_` (666922); `j3`/`E$e`/`v$e` (chunk-bk5ct2gw.js 606265/606486/606535); `M2n`/`EEo` (chunk-x0dc37w9.js 71537/53208); the managed settings schema `claudeMd` (chunk-x0dc37w9.js 53208).
Targets: one managed tier in the instruction loader, one child re-read against the isolated checkout, three regression groups and one compiled driver.
Mode: port the loader shape into the existing host loader. Adapt only the directory names, which the host spells `HARNESS.md`/`AGENTS.md`/`.harness/rules`.
Predicate: the model's first request carries the managed tier's text ahead of the project text and in the source's internal order; touching a file in a directory that was never visited brings that directory's instruction into the next request; an isolated child's prompt carries the checkout's instruction text and not the parent working tree's, and keeps its own child suffix.

## Provenance

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, read from extracted bytes as inert data. Chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.

| Owner | Range | Body SHA-256 (first 16) |
| --- | --- | --- |
| `qZn` | [668054,674681) | 3fc99147b0a1a3da |
| `mCt` | [674681,674896) | 0b65f503b66f6417 |
| `Znr` | [674896,675599) | 652984fffa26b39d |
| `gCt` | [675599,675783) | ff3043516d8825b5 |
| `zae` | [662489,663889) | 41f95aa43e32dce4 |
| `Sar` | [3671831,3672142) | 06b8a4df52652e77 |
| `Zyn` | [3669904,3671831) | 950cde8caf866bbe |
| `leo` | [682161,683000) | 41b79e8c607ce0c5 |
| `xC` | [680835,682161) | 0d0f2a61ac358e25 |
| `I_` | [666922,667130) | afd313f4e93b860e |

Chunk-bk5ct2gw.js `j3` [606265,606486), body 16-hex 4141a10e3afd4447; `E$e` [606486,606535), body 16-hex 8512ea395d4c0173; `v$e` [606535,606574), body 16-hex 7444a14dfa048cdc. Chunk-x0dc37w9.js `M2n` [71537,71580), body 16-hex d1d5af9a76730689, and the `EEo` sentinel literal at 53208.

- Tier assembly `qZn` — chunk-sfn1dbxq.js 668054. It builds the ordered file list: managed directory instruction file (`j3("Managed")`, chunk-bk5ct2gw.js 606265 -> `<managed dir>/CLAUDE.md`), the policy helper's text (`M2n()` at chunk-x0dc37w9.js 71537, filed under `EEo` = `"<policyHelper>"`, 53208), the managed settings document's `claudeMd` (`fe("policySettings")?.claudeMd`, filed under `MRt` = `"<managed-settings>"`, chunk-sfn1dbxq.js 669647 and 655638), then the managed rules (`zae({rulesDir: E$e()})`, `E$e` = `<managed dir>/.claude/rules`), then the user tier, then the ancestor walk.
- Managed tier entry `mCt` — 674681. `mCt` itself calls `qie` over the managed rules directory and the user rules directory; `qZn` is the ordered walk above. The host follows `qZn`'s order.
- Ancestor walk `Znr` — 674896. Per directory: the project instruction file and `.claude/CLAUDE.md`, then `.claude/rules` through `zae`, then the conditional rules through `qie`.
- Cwd-level tier `gCt` — 675599. `qie` over `<dir>/.claude/rules` for the directories between the workspace and the worktree root.
- Rules walker `zae` — 662489. Recurses into subdirectories, reads `.md` files, refuses a symlinked tree it did not canonicalize, and shares one `processedPaths` set with the file readers.
- Root computation `Zyn`/`Sar` — 3669904/3671831. `Sar` yields the managed tier for the checkout target path, then the ancestor walk per nested directory, then the cwd-level tier. `Zyn` derives nested dirs, cwd-level dirs and the worktree from the path passed to it. This is why an isolated child's instruction set is rooted at its own checkout.
- Child prompt assembly `xC`/`leo`/`I_` — 680835/682161/666922. `I_` loads the instruction files for the session root, `leo` renders them into the user-context blocks, and `xC` is the memoized entry point. Nothing in that chain carries the parent's text into a child whose root differs.

Classification: adapted port. The loader shape and order are copied; the directory names are the host's own, as with every other instruction reader in `src/config.ts`. The policy-helper document (`M2n`/`EEo`) has no host counterpart and is absent; the host keeps the settings-document `claudeMd` under the same sentinel name the source uses.

## Contract and boundaries

`loadProjectConfig` reads one managed tier before the ancestor walk: `<managedRoot>/HARNESS.md`, `<managedRoot>/AGENTS.md`, the policy document's `claudeMd` under `<managed-settings>`, then `<managedRoot>/.harness/rules`. The tier root is `managedSettingsDir` when given, else the directory of `managedSettingsFile`, else the platform managed directory. The tier goes through the same `appendInstruction` path as the walk, so a realpath it already read is not read again from an ancestor directory, matching the shared processed set `qZn` keeps (`V.has`/`V.add`, chunk-sfn1dbxq.js 671626); managed rules also go through `conditionalRulePatterns` like project rules.

`loadChildInstructions(workspace, options)` returns `{ files, rules }` for an arbitrary root, and `rebaseChildInstructions(config, root, options, appended, endMarkers)` rewrites the child's prompt and returns `{ system, instructions, conditionalRules }` when that root differs from the parent's workspace. `appended` is the exact text the caller appended after the parent prompt to make the child's prompt; it is held back so the section rewrite can find the end of the parent's instruction section, then restored unchanged. The section is found by its `Instructions from <path>:` block headers, not by a heading inside a file: a block whose path is not named by the parent's `instructionSources` is a memory block and is kept, and the cut stops at the first catalog marker (`instructionEndMarkers`) or the end of the prompt. `replaceInstructionSection` therefore keeps everything after the section (the skill and agent catalogs, memory blocks) and replaces the section itself.

`childPromptSuffix(options)` in `src/subagents.ts` is the single owner of that appended text: the child sentence, plus `Agent instructions:` when an agent type supplies a body. Both rebase call sites pass it, and `agent-registry.ts` adds the structured-output note when schema mode is active. Both call sites also replace `config.conditionalRules` with the checkout's own rules, so the parent's working-tree rule paths do not survive into a child that runs elsewhere.

Not ported, with reasons: the policy-helper document and its `<policyHelper>` entry (no host counterpart, out of scope for this package), `omitClaudeMd`/`managedInstructionsOnly` (a managed-only instruction path surveyed and recorded as its own follow-up), remote managed policy, and the external-include approval flow. The family stays Partial for those and for full recursive coverage.

## Validation

`test/config.test.ts` gains two groups. The first pins the managed tier's order and sentinel: with a managed directory holding `HARNESS.md`, `AGENTS.md`, `.harness/rules/policy.md` and a policy document carrying `claudeMd`, the loaded instructions are `MANAGED_FILE_TEXT`, `MANAGED_AGENTS_TEXT`, `MANAGED_SETTINGS_TEXT`, `MANAGED_RULE_TEXT`, `PROJECT_TEXT`, with the sentinel path on the third entry, while the policy keys still merge and `claudeMd` is not treated as policy. A second case places the workspace inside the managed directory's own tree and asserts the managed files are not read twice. The second group pins the explicit policy file: its neighbouring `HARNESS.md` is read first, the document's own text second, and a non-string `claudeMd` is refused on the explicit path and reported-and-skipped on the directory path. Further cases pin the child tier when the policy comes from a directory rather than an explicit file (managed file, sentinel, checkout file), the checkout's own conditional rule replacing the parent's and staying out of the prompt, a managed root equal to the checkout root collecting each rule once, the import-depth refusal on a six-file chain, a missing import refused like the parent loader, and the rebased prompt: an H1 inside a parent instruction file does not end the section, a memory block after the parent's files stays in place, and the parent text is gone.

`test/agent-registry.test.ts` gains one group: an isolated child launched into a checkout whose `HARNESS.md` differs from the parent's working tree carries the checkout text, not the parent's, and still carries its child suffix and its catalogs. That group is what caught the first defect below.

`scripts/smoke-managed-instructions-cli.mjs` drives the real CLI on an owned loopback SSE gateway in both source and compiled modes: the first request carries the managed tier ahead of the project text and in the source's internal order; a `read_file` into a directory that was never visited brings that directory's `AGENTS.md` into the next request; the isolated child's prompt carries the committed checkout variant, not the parent working-tree variant, still carries the managed file text and its own body and suffix; and the parent's final prompt keeps its own text. Four model requests, asserted.

Check and build pass. Focused suites 125/125 (config 76, agent registry 49). Full suite 3442/3442 across 118 suites, 0 fail/cancel/skip/todo. Identity ee819909f540299d6d87024cb5077f645edbfa1ed32b00c65339dfa7fa9396ef (939 input / 360 validation / 662 build records). `scripts/smoke-memory-reload.mjs` still passes (10 requests).

Defects found and repaired inside the package:

1. The first child test failed because `replaceInstructionSection` scanned for the next `# ` heading and, when none followed, dropped everything after the instruction section — which is exactly the child's own suffix. The repair holds the suffix back and restores it, and `childPromptSuffix` became the single owner of that text so the two call sites cannot drift.
2. The first draft pushed the settings document's `claudeMd` before the managed directory's own file. Reading `qZn` at 668054 shows the opposite order: the managed file first, then the policy-helper text, then the settings document's `claudeMd`, then the rules. Both the product and the two assertions that had been written to the wrong order are corrected.
3. `loadChildInstructions` read the document's `claudeMd` only when an explicit policy file was supplied, so a child under a platform managed directory lost that tier while its parent carried it. It now resolves the text through the same document the parent read: the explicit file, else the merged platform directory. The config group's third case pins it, and that case is what found the defect.

The independent review returned NOT_VERIFIED with four confirmed defects, all accepted and repaired:

4. The section still ended at the first `"\n\n# "` after the intro, so an H1 inside an instruction file truncated the parent's section, leaked the rest of the parent text into the child, and left `instructionSources` describing text the prompt did not carry. The section is now delimited by its block headers; a block the parent's `instructionSources` do not name (a memory block) is preserved, and the blank line joining it to the replaced section is kept.
5. The managed tier was read after the ancestor walk and then `unshift`ed, so a managed directory inside the workspace's ancestor chain was read twice and its rules bypassed conditional handling. The tier now runs before the walk through `appendInstruction`, sharing the processed set and the rule path.
6. `loadChildInstructions` recursed through imports with no depth check, so a cyclic or deep child import chain was unbounded. It now enforces `CONFIG_LIMITS.importDepth`.
7. The conditional-rule channel was not rebased: an isolated child kept the parent's rule paths. `loadChildInstructions` now returns the checkout's rules, and both call sites replace `config.conditionalRules` with them.

A second bounded independent review of the repaired candidate returned CONFIRMED_REPAIRED for all four, with three further fixes applied:

8. A child rule with `paths` frontmatter was added both to the prompt and to the conditional rules, so touching the path injected the same text twice; the parent loads with no selected paths, which keeps such a rule out of its prompt. `pushRule` now puts a patterned rule only into `rules`, and non-patterned rules stay in the prompt.
9. When the managed root equals the checkout root, the same rule directory was listed twice and the same rule collected twice. A per-call rule set now deduplicates it.
10. A relative `managedSettingsFile`/`managedSettingsDir` was resolved against the process cwd in the child loader while the parent resolves it against the workspace root. The child now resolves both against its own root, the same base `managedInstructionRoot` uses.

Known limitations, recorded rather than repaired:

- A block header embedded in an instruction file's body (`"\n\nInstructions from /x.md:\n"` after a blank line) is indistinguishable from a rendered block boundary. If it names a path outside `instructionSources`, the section rewrite cuts there and keeps the remainder as a memory block. The rendered prompt has the same ambiguity, and instruction content is data.
- `/context` lists no instruction rows for an isolated child whose prompt carries memory blocks: `contextDetails` requires the block headers to match `instructionSources` one-for-one and suppresses the partition when an unnamed block follows, the same conservative behaviour it already had for an untracked appended block.

## Reproduction

```sh
node --import tsx --test test/config.test.ts test/agent-registry.test.ts
node scripts/smoke-managed-instructions-cli.mjs
node scripts/smoke-managed-instructions-cli.mjs --compiled
```
