# W371 — external instruction includes

## Source position

All coordinates are zero-based half-open UTF-16 code units in the extracted 2.1.296 sample (artifact `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`).

| Symbol | Module | Range | body16 |
| --- | --- | --- | --- |
| `t1` (instruction file reader) | chunk-sfn1dbxq.js | [661767,662489) | dcc7a3e5b7dd3741 |
| `zae` (rules-directory walker) | chunk-sfn1dbxq.js | [662489,664541) | 474deff27981d295 |
| `Q6t` (external-include list) | chunk-sfn1dbxq.js | [676285,676512) | 941bf97cd081c4b5 |
| `m9r` | chunk-sfn1dbxq.js | [676512,676551) | e961a5986bc80b41 |
| `HXo` (ask gate) | chunk-sfn1dbxq.js | [676557,676708) | e79d39785e895444 |
| `IL` (inside the working directory) | chunk-sfn1dbxq.js | [656718,656751) | 104b417586d4b466 |
| `lCt` (local-agent mode) | chunk-sfn1dbxq.js | [666879,666922) | a2be8af63c7a5c70 |
| `ir` (managed tier) | chunk-1dhzexv1.js | [27153,27416) | 749862b5bc647cb2 |
| `qZn` (project/ancestor tier) | chunk-sfn1dbxq.js | [668060,672726) | 530f0207daa5256c |
| `Qcn` (persists the answer) | chunk-bcnhka5p.js | [1498,1742) | 578fdf7ab3486d6f |
| `e3n` (dialog) | chunk-bcnhka5p.js | [1742,4206) | 1fe346440e20abdd |
| defaults (`bue`) | chunk-bk5ct2gw.js | 558344 | — |

Module digests: chunk-sfn1dbxq.js 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; chunk-1dhzexv1.js bd0b184583b7ed75cbcd56c65bb3c5175dfeb7f94d6a35754b988df573ebfff9; chunk-bcnhka5p.js 45da18e565d1f5e3547e2cc3fe2c79935b4ff95ef96ee6a79b431e17bf7f2540; chunk-bk5ct2gw.js efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1. The startup provider that calls `HXo` is chunk-msy0wfrd.js 11 (f489401ba9fbd8586a1009a984b6701a0286372a2a84a6a78f46ecac546e9bf8).

## Source behaviour

- `t1` resolves the file, refuses a missing one, and then applies `if(h>0&&!V&&!IL(he))return[]`: an import at depth > 0 that is not inside the working directory is dropped unless external includes are allowed. Its recursion applies the same test to each import target (`if(!IL(Me)&&!V)continue`), so the walk stops at the dropped file and its own imports never load.
- `V = s && (n !== "User" || lCt())`; `lCt()` is `qE() !== "local-agent"`, so in local-agent mode even a user-level file's imports are gated. `s` is the caller's `includeExternal`, and `ir()` passes `hasClaudeMdExternalIncludesApproved` into both `t1` and `zae`; the project tier computes `he = s || approved` before walking.
- `IL(p)` is `Wd(p, Ee())`: containment in the working directory, judged on the resolved path.
- `Q6t` lists what was skipped: entries whose type is not `User`, that have a `parent` (or `linkedFrom`) and are not `IL`. `m9r` is "the list is non-empty".
- `HXo` answers "should the user be asked": false when `hasClaudeMdExternalIncludesApproved` or `hasClaudeMdExternalIncludesWarningShown`; otherwise it loads the instruction set and asks when `m9r` is non-empty.
- `Qcn(approved, source, ctx)` persists `hasClaudeMdExternalIncludesApproved: approved` and `hasClaudeMdExternalIncludesWarningShown: true`. The dialog (`e3n`) lists the external includes, states that the project's CLAUDE.md or rules import files outside the working directory, focuses cancel, and labels the answers "Yes, allow external imports" / "No, disable external imports". A "yes" covers later additions.
- Both flags default to false (`bue`, chunk-bk5ct2gw.js 558344).

## Host adaptations

- The host has no startup dialog. Its idiom for a user-level approval is a user-layer settings boolean, the same shape as `approveAllProjectMcpServers`: `approveExternalIncludes` is accepted only from the user layer or an explicitly named settings file, is refused from `settings.json`/`settings.local.json`, must be a boolean, and is removed from the effective settings map.
- `loadProjectConfig` gates imports at depth > 0 whose resolved path leaves the workspace (realpath judged, both the resolved and the given workspace spelling accepted). `appendInstruction` and `pinRuleImports` share the gate, so a rule's pinned imports obey it too. The dropped file stops the walk, matching `t1`.
- `loadChildInstructions` applies the same containment test to every depth > 0 import unless its caller passes `approveExternalIncludes`, so a child checkout cannot be used as the way around the gate. `rebaseChildInstructions` forwards the parent config's switch.
- The skipped set is reported as `externalIncludes: {path, parent}[]` on `LoadedConfig`, deduplicated by path because the same file can be reached as a pinned rule import and as a body import. A file the walk reads at depth 0 anyway is not reported. The CLI prints one stderr line per skipped include naming the switch.
- The switch and the skipped set are carried on `SessionConfig`, so a reload replaces both and the interactive config application prints the notice when the set changes, not only at startup.
- `hasClaudeMdExternalIncludesWarningShown` is not ported: it exists only to keep the dialog from reappearing, and the host has no dialog. The switch is the durable answer.
- `loadPathInstructions` already refuses every escape from the workspace with a named error; it is stricter than the gate and unchanged.
- `zae`'s external rules-directory discovery (`Ve`, parent-directory walk) has no host counterpart: `listRules` only descends into the given directory.
- `IL` compares against the process working directory; the host compares against the resolved workspace root, the boundary its loader already owns.

## Contract and boundaries

A project or managed instruction file may import another Markdown file. An import inside the workspace is read as before. An import outside it is not read, and neither are its own imports, until the user sets `approveExternalIncludes: true` in the user settings; the loader reports each skipped file with its importer. A checkout cannot grant itself the switch. The gate applies to the managed tier, the ancestor walk and the project rules alike, and to conditional rules' pinned imports.

## Review disposition

One bounded independent review of the committed package (`6df08a4`) returned four findings.

1. **HIGH — the child-instruction loader had no gate.** `loadChildInstructions` read any import a child checkout named, so a subagent definition could reach a file the parent's own walk refuses. Confirmed: repaired by adding the containment test to `push`, with `approveExternalIncludes` threaded from `rebaseChildInstructions`.
2. **MEDIUM — a reload discarded the notice.** `reloadConfig` replaced the instruction set without carrying the skipped list, so the user lost the only statement of why a file was missing until the next process start. Confirmed: repaired by adding `SessionConfig.approveExternalIncludes`/`externalIncludes`, set from the reload and printed by `applyConfig` when the set changes. The `/memory` reload also now spreads `configSources`, which it had been dropping.
3. **LOW — the report could name a file that was read anyway.** A file that is both an external import of a project file and an ancestor instruction read at depth 0 appeared in the skipped list. Confirmed: repaired by filtering the report against the set of files the walk actually read.
4. **LOW — the containment test compared raw strings.** A case-insensitive filesystem could resolve two spellings of one path differently. Confirmed: repaired by folding case and comparing device/inode when both spellings resolve.

Follow-up commit adds one regression group per confirmed finding (absolute external path, depth-0 exemption, child loader both sides) and re-freezes the package.

## Validation

`test/config.test.ts`: the home-import group now asserts the skip and the approval path; a new group covers the external import (unapproved skip with the nested import absent and the report shape, approved read, project-layer refusal, non-boolean refusal, switch absent from effective settings); a third group covers a conditional rule's pinned imports on both sides of the gate; the review round adds an absolute external path, a depth-0 file that is imported and read anyway, and the child loader on both sides of the switch. The absolute-path import group now uses an absolute path inside the workspace.

`scripts/smoke-external-includes-cli.mjs` runs the same workspace twice against an owned loopback SSE server: unapproved, the request carries the project text and not the external text and stderr names the file and the switch; approved through the user settings, the request carries both. Source and compiled pass.

Red baseline: the compiled CLI from the W370 repair commit read the external import (`OUTSIDE_INCLUDE_TEXT` present) and printed no notice; the new driver fails on it at the "not read" assertion.

Check and build pass. `test/config.test.ts` 83/83. Full suite 3456/3456 across 118 suites, 0 fail/cancel/skip/todo. Identity 60910703c10f5a053e13beb8eac5dc477a6a65a34204c028d63dd6029daf1371 (940 input / 360 validation / 662 build records).

## Reproduction

```sh
node --import tsx --test test/config.test.ts
node scripts/smoke-external-includes-cli.mjs
node scripts/smoke-external-includes-cli.mjs --compiled
```
