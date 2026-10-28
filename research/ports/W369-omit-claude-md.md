# W369 settings and instructions: the managed-only child (`omitClaudeMd`)

Status: implementation and main verification. One active package.

## Task card

ID: W369, the Settings and instructions family's next source difference, the follow-up W368 recorded.
User chain: an agent definition that says it takes everything from the delegation prompt still receives the workspace's project instruction files in the child's system prompt.
Source: `gd` (chunk-40cepjpq.js [147565,147921)), the spawn gate [123469,123561), the child-option propagation [133848,133872), the two managed-only filters (chunk-5b2hxy2e.js [29841,29911), chunk-sfn1dbxq.js [3671615,3671685)), the agent-definition schema [429193,429451), the built-in Explore literal [201834,202021), and the plugin loader's field gate (chunk-sfn1dbxq.js 2049628 read, 2051536 emit).
Targets: one definition field, one managed-tier loader mode, one prompt rewrite at the child-config owner, and the flag on both isolation rewrites; three regression groups and one extended compiled driver.
Mode: port the source branch shape into the host's existing instruction loader and child-config owner. Adapt only the names and the host's lack of built-in/policy agent sources and injected `userContext`.
Predicate: a child spawned from a definition with `omitClaudeMd: true` carries the managed tier and no user, project or local instruction file, keeps its own suffix and body, and an isolated such child carries the checkout's managed tier rather than its project files; a definition without the flag is unchanged.

## Provenance

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, read from extracted bytes as inert data. Chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; chunk-40cepjpq.js SHA-256 473c9dfb84c9defcb7ca5bd5e6f598cd951274dc2c1334a67c8b9d25b451a8b2; chunk-5b2hxy2e.js SHA-256 46d7f73a2b28fd9493ecf37d85abc89acd020f6de7e2bdb83efe621811f12656.

| Owner | Module | Range | Body SHA-256 (first 16) |
| --- | --- | --- | --- |
| `gd` | chunk-40cepjpq.js | [147565,147921) | 418041b6211925f6 |
| spawn gate | chunk-40cepjpq.js | [123469,123561) |  |
| child option | chunk-40cepjpq.js | [133848,133872) |  |
| prompt filter | chunk-5b2hxy2e.js | [29841,29911) | 2f37931fb82ab1eb |
| announcement filter | chunk-sfn1dbxq.js | [3671615,3671685) | 8f30de36447bacb3 |
| schema field | chunk-sfn1dbxq.js | [429193,429451) | 6eff32d5214a8ac4 |
| built-in Explore | chunk-sfn1dbxq.js | [201834,202021) | 932de2669bc06e3d |

- Definition field: `omitClaudeMd:jC().optional().describe("If true, the agent runs without the user, project and local CLAUDE.md instruction files when spawned as a subagent; managed policy files are kept. For agents that take everything they need from the delegation prompt.")` — the schema text at [429193,429451). The built-in Explore agent sets it (`source:"built-in"`, `omitClaudeMd:!0`).
- Plugin field gate — chunk-sfn1dbxq.js 2049628 (`nt=z.omitClaudeMd, ut=nt==="true"||nt===!0?!0:void 0`) and 2051536 (`...ut&&{omitClaudeMd:ut}`): the plugin loader reads and re-emits the flag, so a plugin definition can set it too. The user/project definition loader carries it at 2098768, the definition serializer at chunk-0n88wbb5.js 39906, the spawn copy at chunk-kwdhpnes.js 14407, and the field allowlists at chunk-nyce03br.js 214952 and chunk-zm79vshj.js 4966.
- Spawn branch `gd(e,s,n)` — [147565,147921): `let{claudeMd:r,...y}=s,T={userContext:y,managedInstructionsOnly:!1};if(e.source==="built-in"||e.source==="policySettings")return T;let h=await DXo(n.session,n.storageV5,n.credentials);if(h===void 0)return{userContext:s,managedInstructionsOnly:!1};if(h==="")return T;return{userContext:{...s,claudeMd:h},managedInstructionsOnly:!0}`.
- Gate — [123469,123561): `e.omitClaudeMd&&!N?.userContext?await gd(e,so,n):{userContext:so,managedInstructionsOnly:!1}`. The branch runs only when the spawn carries no injected `userContext`.
- Propagation — [133848,133872): `...me&&{managedInstructionsOnly:!0}` reaches the child's options.
- Consumers — the prompt builder keeps only blocks whose `type` is `"Managed"` when the flag is set (chunk-5b2hxy2e.js [29841,29911)); the announcement set is filtered by the same predicate (chunk-sfn1dbxq.js [3671615,3671685)).

Classification: adapted port. The branch shape is copied: split the instruction text off the user context, answer built-in/policy sources with the text dropped, otherwise load the managed text; undefined keeps the full text, empty drops it, non-empty replaces it and marks the child managed-only. Host adaptations, all recorded: the host's agent catalog contains no built-in or `policySettings` definitions (its `explore`/`general` are modes, not `AgentTypeInfo` objects), so every loaded definition takes the non-built-in path; the host has no injected `userContext`, so the gate reduces to the definition flag; the host's managed loader is local, so "unavailable" is an unreadable root and keeps the parent text while an empty tier is the empty-string branch.

## Contract and boundaries

`AgentTypeInfo.omitClaudeMd?: boolean` is read from the strict definition schema, so the field is accepted for authored, user and plugin definitions and survives `agentTypesSchema` journal validation. The plugin loader applies the recovered Z5t gate (only `true`/`"true"` sets it) so a plugin definition is not silently dropped. `loadChildInstructions(workspace, options, tier)` takes `"managed"` to stop after the managed tier — the same order and bounds as the full loader, with the managed directory's files, the settings document's `claudeMd` under `<managed-settings>`, and the managed rules. `rebaseChildInstructions(..., managedOnly)` bypasses the same-root shortcut (the source applies the flag without a workspace change) and loads that tier; an unreadable root returns the parent system, the recovered fail-open.

`childConfig` is the single owner of the rewrite: when `options.type?.omitClaudeMd === true` it replaces the parent's instruction blocks with the managed tier, sets the child's `instructionSources` and `conditionalRules` to that tier, and restores the child suffix. Both isolation call sites pass the same flag to their checkout rewrite, so a worktree child re-reads the managed tier from its own root instead of reintroducing the checkout's project files. Memory blocks are not instruction files and are kept, matching the source's separate memory channel.

Not ported, with reasons: the built-in/policySettings source branch (no host counterpart), the injected-`userContext` suppression (no host spawn argument), and the separate announcement filter (the host's announcement set is derived from `instructionSources`, which the rewrite already narrows). The family stays Partial for the policy-helper document, remote managed policy and full recursive coverage.

## Validation

`test/agent-types.test.ts` gains one group: `omitClaudeMd: true` and `false` load onto the typed definition and survive `agentTypesSchema`; a non-boolean value is reported invalid.

`test/config.test.ts` gains one group: `loadChildInstructions(..., "managed")` returns the managed file, the settings sentinel and the managed rule, and only the managed conditional rule; `rebaseChildInstructions(..., managedOnly)` on the same root replaces the parent block with the managed tier, keeps the memory block after it and restores the child suffix, with `instructionSources` and `conditionalRules` narrowed to the managed tier; an unreadable root returns the parent prompt unchanged.

`test/agent-registry.test.ts` gains one group: a spawn with `subagent_type: "no-md"` where the definition sets `omitClaudeMd` carries the managed file and settings text, not the parent's project text, and keeps its body and child suffix.

`test/plugin-components.test.ts` extends its existing install group: a plugin agent with `omitClaudeMd: true` in its frontmatter loads with the flag set on the catalog entry, the recovered Z5t gate.

`scripts/smoke-managed-instructions-cli.mjs` is extended with a same-workspace `no-md` definition and a second child launch. The driver now makes six owned loopback requests (four parent, two children) and asserts the managed-only child keeps `MANAGED_FILE_TEXT`, `MANAGED_SETTINGS_TEXT` and `MANAGED_RULE_TEXT` while carrying neither the parent working-tree variant nor the committed checkout variant, and keeps its suffix; the isolated child's existing assertions are unchanged.

The compiled baseline before the change: the strict schema rejected the definition, so the spawn returned `Unknown agent type: no-md` and no child request was made. After the change the same probe completes the child request with the managed tier only.

Check and build pass. Focused suites 146/146 (agent types 15, config 77, agent registry 50, plugin components 4). Full suite 3445/3445 across 118 suites, 0 fail/cancel/skip/todo. Identity c1c683904683ad67ffa9c9e37a201fdaaf72b75f715bd07a2f3ab1fb3dd4ac3e (939 input / 360 validation / 662 build records).

## Reproduction

```sh
node --import tsx --test test/agent-types.test.ts test/config.test.ts test/agent-registry.test.ts
node scripts/smoke-managed-instructions-cli.mjs
node scripts/smoke-managed-instructions-cli.mjs --compiled
```
