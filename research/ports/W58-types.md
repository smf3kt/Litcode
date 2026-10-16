# W58 types and dependency adapters

Status: local partial, 2026-10-16. Base is `/Users/mant1ssa/Projects/cc-base-2188`, HEAD `7d27a343422cdf491d611dcdefdd83b115c40c02`. Preserve its 56 changed files. Goal is to restore boolean narrowing and actual dependency contracts without concealing missing runtime exports. This closes the local correction and evidence pass; the reconstructed CLI remains unverified.

## Source and adaptations

All line coordinates below are one-based inclusive in recovered files; boolean edit coordinates are UTF-16 half-open offsets.

| Target | Source identity and range | Disposition |
| --- | --- | --- |
| services/api/client.ts skip-auth | chunk-14rnebpd.js, Jxt, lines 831-837; SHA256 76ca9f04ee6b14422f3b4760e275185d4a8360c1dca6a677fc97afbb3c9bcb7b | Adapt the existing skip branch to async Headers. Installed vertex-sdk/client.mjs:118-134 awaits headers then calls get. The previous object failed before fetch. |
| native-ts/color-diff/index.ts highlightLine | chunk-04m6g9sr.js lines 785-797; SHA256 44b945302753e948d9f6c310cf43f9b42912aa083554b2ed07cda6d8b0d3ee01 | Adapt access to _emitter, retaining the existing shape check and flattening. |
| ANSI dependency | chunk-q4ya5hp8.js, _ns, lines 492-542; SHA256 a16a7765e997e33f2abea238f7dd06f024b0974baececa5b52af14f33780e801 | 0.2.5 exposes char/ansi tokens, but segments graphemes while recovered code walks codepoints. API compatibility is not algorithm parity. |
| Workflow actions | chunk-mzp16wqa.js b lines 164-211, _X/V/jJe/WJe lines 261-303; SHA256 9bd628b2e93e9b0095f30e9e8857e2e0a146ba60e985f26774fe41c672cf3e81 | Bodies are obtainable and use registry.get/update, not the older setAppState callback. No claim that workflow implementation is absent. Its enabled integration remains pending. |
| Boolean sites | .audit/w58-boolean-evidence.json, SHA256 ecc2541f627b39608fabdeccf3c35ff450980858039e286a5c757c70110a0104 | 35 files/64 comparisons with before/output digests and exact ranges. === true and !== true retain the declared boolean/nullish domain. Explicit equality narrows even with strictNullChecks disabled. |
| MCP stdio | services/mcp/types.ts schema lines 28-35 and guard lines 163-169; consumers client.ts, config.ts and cli/print.ts | Preserve the optional stdio discriminator through a named predicate. Boundary inputs still require schema validation. |
| Skill discovery prefetch | chunk-r1x169b6.js export line 340 | Withdraw false port classification. The matching names are attachment/memory exports. Current prefetch is export {}; discovery bodies remain unresolved. |

Disabled branch removal is justified only by `shims/bun-bundle.ts:4-6`, whose enabled set is empty. This proof expires if flags change. Live process.env.USER_TYPE is not a constant and is not a removal premise. Existing Bedrock constructor compatibility was checked in the preceding W58 work; MCPB 1.2.0 export compatibility does not establish its full package flow. Google auth is 10.9.0. The dependency versions are contemporary, not original sample versions.

## Verification

1. `node .audit/w58-verify.mjs` from cc_reverse exits 0. Three groups exercise installed Vertex SDK 0.21.0 with an owned fetch stub, the source stdio predicate, and the source compact streaming loop plus boolean-domain branch equivalence. The old Vertex shape rejects before fetch; corrected source reaches exactly one fetch. No external model requests. These are focused source/SDK fixtures, not a CLI test.
2. `node .audit/w58-boolean-narrowing.mjs /tmp/w58g.txt --apply` exits 0 with 0 files/0 comparisons. The evidence digest remains ecc2541f627b39608fabdeccf3c35ff450980858039e286a5c757c70110a0104. Script was read before execution; its wx creation and preserve-existing branch retain original evidence.
3. From base cwd, `./node_modules/.bin/tsc --noEmit --pretty false > /tmp/w58-final7.txt` exits 1 under TypeScript 7.0.2. It reports 136 errors/64 files. tsc-diff against w58g reports identical counts and zero worse files. Against w57j it reports 303→136, 111→64 files, TS2339 148→2, 53 improved files, zero worse files. Both repositories pass git diff --check.

The final log is persisted at `.audit/w58-tsc-final.txt`. An initial run accidentally used `/tmp/w47-tools/node_modules/.bin/tsc` 5.7.2, exit 2, 132 errors/65 files. It is not the comparable checkpoint. Its diagnostic differences were resolved by selecting the project compiler, not editing product code.

Identity: client.ts SHA256 f282d6c8f663d2cba2b45e059e536d512f66cd533e32df829fc08a541094a933; package.json 5ef955d666d867ff445668465545f47e0e3ec05df98cbf98a361f597308e971f; package-lock.json b0d06e63cd10f039c593420f81c9422576ab9da25952095aabb03cc5db72b974; final compiler log da383a8c575118f9e20f63698c986a289faa717e503199636e113dac5671eabb. Build identity is unavailable because no successful build was produced. No recovered entrypoint was executed, and no commit, push or publication occurred.

## Remaining and standards

136 compile errors remain. Both TS2339 errors are commands/clear/caches.ts:97 requesting clearSessionsWithTungstenUsage and resetInitializationState. Their implementation bodies remain missing; fake declarations were withdrawn. Full build, reconstructed CLI, live model flow, full MCPB packaging, enabled workflow registry integration and ANSI algorithm parity remain unverified. Broader inherited W58 changes retain their per-file git diff and boolean evidence; this record does not claim fresh runtime coverage of every changed body.

S-1/S-7: reproduced the adapter defect and read the exact recovered body before repair. S-2/S-5: preserve missing-export diagnostics and distinguish dependency API compatibility from algorithm parity. S-3: no rendering output claim. S-4/S-6: focused owned fixtures cover source consumers and iterator terminal handling; full lifecycle remains pending. Type System Discipline guided retaining honest errors instead of adding fictional declarations. Incidents and corrected A16/Extract claims are synchronized in question.md and CURRENT.md.
