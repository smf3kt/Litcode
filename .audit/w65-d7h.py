# -*- coding: utf-8 -*-
"""Wave D step 7c research record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:70], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, "## Protocol slip (recorded)\n", """## Wave D step 7c — the record builders and the generated protos (landed, `ce11027`)

`services/analytics/metadata.ts` existed to build one record: an environment context, a process-metrics sample, the swarm/team agent identification, the user data, and a 1P snake_case formatter. `getEventMetadata` assembled them for the two transports that went in step 7a, and step 7b then took the last remaining reader — `tools/BashTool/bashSecurity.ts` names the function only in a note about `process.memoryUsage`. So the module's second half was dead as one contiguous block and went as one: from the `EnvContext` type to the end of the file. 950 lines to 363; 4 files, +10/−1,749.

What is left is the part the tree still calls, and after this it is a PII-redaction module rather than a metadata module: the tool-name sanitizer (21 files), the MCP-detail, skill-name and bounded tool-input helpers (`services/tools/toolExecution.ts`), the file-extension helpers for two callers, and the `not_code_or_filepaths` marker type (137 files). Nine surviving lines are checked word-for-word against the base revision by the new fixture. The import block shrank from twenty-one bindings to four, because every other one existed for the dead half.

### The deletion named its own orphans, twice

The cut made `types/generated/events_mono/claude_code/v1/claude_code_internal_event.ts` — the 866-line 1P event proto type — unreferenced. Deleting that made `events_mono/common/v1/auth.ts` and `google/protobuf/timestamp.ts` unreferenced, because this file was each one's only importer. The scanner caught both rounds: 11 orphans after the truncation, back to the ten legitimate entries after the second deletion. This is the third time the post-cut re-scan has found a chain nothing else would (wave D step 3's `Stats.tsx` cascade, then the voice cluster, now this), and the first time it found a *second* round caused by the first round's own cleanup.

**Recorded finding:** `types/generated/` now holds no files at all. Every generated proto type in this tree existed for the 1P event payload, so the last of them left with the last importer. Anyone looking for the proto schemas should know the directory is emptied deliberately rather than by accident.

### Verification

tsc 0, eleven fixtures pass, `git diff --check` clean (one repair: the truncation left a blank line at EOF, which `git diff --check` caught and the same script's neighbour removed). The orphan scan's ten remaining entries are all legitimate — a vendored TypeScript file, ambient declaration files, the CLI entrypoint, a shim and a utility with no importer by design.

**Next (step 7d):** the last reader-less cluster this wave left behind. `utils/user.ts`'s `getUserForGrowthBook` → `getCoreUserData` → `CoreUserData` chain (all three reader-less now, and `CoreUserData`'s only other mention was the dead half of `metadata.ts`), the `initUser`/`resetUserCache` pair in `main.tsx` that exists to pre-fetch the email those records carried, the `GitHubActionsMetadata` type whose remaining user was this cut's generated file, and three exports 7c orphaned in modules that keep other live exports: `utils/git.ts`'s `getRepoRemoteHash`, `utils/platform.ts`'s `getLinuxDistroInfo` and `detectVcs`.

## Protocol slip (recorded)
""")

C = 'research/CURRENT.md'
anchor = "6 files, +126/-847. tsc 0, ten fixtures pass.\n"
rep(C, anchor, anchor + """

Wave D step 7c (`ce11027`): metadata.ts becomes a PII-redaction module. Its second half — the environment context builder, the process-metrics sampler, the agent-identification helper, `getEventMetadata`, the 1P snake_case formatter and their six types — was one contiguous block whose entry point lost its last reader to step 7a (the only remaining mention, in `tools/BashTool/bashSecurity.ts`, is a comment), so it went as one: 950 lines to 363, import block from twenty-one bindings to four. What survives is what the tree still calls — the tool-name sanitizer (21 files), the MCP-detail, skill-name and tool-input helpers, the file-extension helpers, the marker type (137 files) — and nine of its lines are checked word-for-word against the base revision. The deletion then named its own orphans in two rounds: the 866-line 1P event proto type, and the two generated types that depended only on it, after which `types/generated/` holds no files at all — every generated proto in this tree existed for the 1P payload. 4 files, +10/-1,749. tsc 0, eleven fixtures pass.""")

S = 'research/STATUS.md'
rep(S, "tsc exits 0; ten fixtures pass. Independent review not run (rate-limited).",
    "Wave D step 7c (`ce11027`) turns `services/analytics/metadata.ts` into a PII-redaction module: the environment builder, process-metrics sampler, agent-identification helper, `getEventMetadata`, the 1P formatter and their six types were one contiguous dead block and went as one (950 lines to 363; imports from twenty-one bindings to four), leaving the tool-name, MCP-detail, skill-name, tool-input and file-extension helpers the tool path still calls. The deletion orphaned the 866-line 1P event proto type and, with it, the two generated types that depended only on that file — `types/generated/` now holds no files at all. 4 files, +10/-1,749; tsc exits 0; eleven fixtures pass. Independent review not run (rate-limited).")

F = 'research/FEATURES.md'
rep(F, "Next in the same cluster: `services/analytics/metadata.ts`'s getEventMetadata / buildProcessMetrics / FirstPartyEventLogging* converters and `utils/user.ts`'s getUserForGrowthBook + CoreUserData + getCoreUserData chain, all reader-less after step 7b. [W65](ports/W65-account-network.md). |",
    "Wave D step 7c removed `services/analytics/metadata.ts`'s record builders (getEventMetadata, buildProcessMetrics, the environment builder, the agent-identification helper and the 1P formatter; 950 lines to 363, imports from twenty-one bindings to four) along with the 866-line 1P event proto type it was the last importer of and the two generated types that depended only on that file, leaving `types/generated/` empty. What remains in metadata.ts is the PII-redaction surface the tool path calls. Next: `utils/user.ts`'s getUserForGrowthBook + CoreUserData + getCoreUserData chain, `main.tsx`'s initUser/resetUserCache pair, and the three exports step 7c orphaned (getRepoRemoteHash, getLinuxDistroInfo, detectVcs). [W65](ports/W65-account-network.md). |")

print('record ok')
