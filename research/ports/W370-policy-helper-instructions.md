# W370 settings and instructions: the policy helper's `claudeMd` tier

Status: implementation and main verification. One active package.

## Task card

ID: W370, the Settings and instructions family's next source difference, the one W368 recorded as absent.
User chain: an opted-in managed-policy helper publishes instruction text; the host refuses the document because the strict managed-policy schema has no `claudeMd` key, and the text never reaches a prompt.
Source: `M2n` (chunk-x0dc37w9.js [71537,71580)), `lr` ([71464,71537)), the tier insertion in `qZn` (chunk-sfn1dbxq.js 669530) with the `EEo` sentinel at 53208, the refresh watcher `zt` (chunk-1dhzexv1.js [26980,27435)) and `Jt` ([27435,27614)), `Cx` (chunk-sfn1dbxq.js [684086,684342)), and the static default output at 56953, which carries `managedSettings` only.
Targets: the helper schema, the loader's tier order, a live instruction refresh, the config journal, the child pass-through, the CLI settle, the permission-layer repair the driver surfaced, three regression groups plus one extended group, and one extended compiled driver.
Mode: port the tier and its refresh watcher into the host's existing instruction loader; adapt the host's once-built prompt and once-seeded permission owner.
Predicate: a helper document carrying `claudeMd` is accepted, its text sits under `<policyHelper>` between the managed directory's file and the settings document's `claudeMd`, a document rewritten while the session runs changes the next request, and the document's policy fields still govern; a helper document without the key behaves exactly as before.

## Provenance

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, read from extracted bytes as inert data. chunk-x0dc37w9.js SHA-256 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92 (113411 bytes); chunk-1dhzexv1.js SHA-256 bd0b184583b7ed75cbcd56c65bb3c5175dfeb7f94d6a35754b988df573ebfff9 (73091 bytes); chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da (4762583 bytes).

| Owner | Module | Range | Body SHA-256 (first 16) |
| --- | --- | --- | --- |
| `lr` | chunk-x0dc37w9.js | [71464,71537) | 4820141a85a85ec6 |
| `M2n` | chunk-x0dc37w9.js | [71537,71580) | d1d5af9a76730689 |
| `zt` | chunk-1dhzexv1.js | [26980,27435) | 78d769c9fedf27c2 |
| `Jt` | chunk-1dhzexv1.js | [27435,27614) | 756afa6fd4d3cfb4 |
| `Cx` | chunk-sfn1dbxq.js | [684086,684342) | b0e111faa86eb73a |

- `lr(){let e=I.state;return e&&!e.armedFromRemote?e.output:void 0}` and `M2n(){return lr()?.claudeMd??null}`: the instruction text is the governing helper output's `claudeMd`, and a remote-armed helper supplies none.
- Tier assembly at 669530: `z.push(...await Mn(Se,"Managed"));let bn=M2n();if(bn)z.push({path:EEo,type:"Managed",content:bn,...});let an=fe("policySettings")?.claudeMd;if(an)z.push({path:MRt,...})`. `EEo` is the literal `<policyHelper>` at 53208. The block is pushed only when the text is truthy.
- The refresh watcher: `zt()` fingerprints `[fe("policySettings")?.claudeMd ?? null, M2n(), claudeMdExcludes, autoMemoryEnabled, env, await ir()]`; `Jt(e)` re-evaluates it and, when it changes, calls `gk(e)` and `Cx(e,"policy_refresh")`, which clears the cached `userContext` so the next request rebuilds the prompt (`Cx` at 684086: `if(s.userContext=void 0,...)`).
- The default fallback output at 56953 is `{managedSettings:$e(this.defaultFallback.settings,R,ly())}`: a failed helper with a static default serves no instruction text.

## Host adaptations

- `managedHelperSchema` (session.ts) is the strict managed-policy schema plus `claudeMd: z.string().optional()`. The CLI validates the helper document with it. The settings `policyHelper.defaultPolicy` keeps the plain managed schema: the settle only takes text from a document the helper served, and the recovered static default output carries no text, so a fallback `claudeMd` would never apply.
- `loadProjectConfig` and `loadChildInstructions` take `policyHelperText` and insert it under `POLICY_HELPER_SENTINEL` (`<policyHelper>`) after the managed directory's own files and before the settings document's `claudeMd`, the `qZn` order.
- The host builds a session prompt once, so `refreshPolicyHelperInstructions` (config.ts) re-reads the instruction set with the new text and rewrites the section in place, keeping memory blocks and journaling `policyHelperText`. The CLI settle calls it on every refresh with the governing text; `reloadConfig` and every child build forward the journaled text.
- The text is taken from the helper tier only (`serving === "helper"`), matching `lr()?.claudeMd`; the static default output carries no text.
- `policyHelperPolicy` removes `claudeMd` before the managed-policy application, so the instruction key never reaches `applyManagedPolicy`.
- Repaired while validating: `applyManagedPolicy` replaced the managed policy's base fields but kept the stale `policySettings` permission layer, and the live permission owner kept the rules seeded at open. A helper document's policy therefore never replaced the startup managed policy; the W08 driver's served case was red at the W369 commit. `applyManagedPolicy` now rebuilds that layer from the applied policy, and the settle re-seeds the owner with `reloadPermissionState`, which takes the managed layer from the new policy while session approvals and a user-chosen mode stay.

Not ported, with reasons: `dxs` / `appendSystemPrompt` (the host has no appendSystemPrompt surface), the remote-armed helper state (`armedFromRemote`, remote managed policy is External), and the plist/registry mechanisms and remote refusal enforcement already recorded as out of scope in W08.

## Contract and boundaries

A helper document may carry `claudeMd`; a non-string value is refused by the strict schema, an empty string is absence, and the document's policy fields apply without it. The instruction tier appears in the startup prompt (the CLI settles the helper before the first request), in every later request when the helper's text changes, in a reloaded config, and in child prompts. A config whose `instructionSources` is absent cannot distinguish a memory block from instruction text; the live CLI, reload and every child build carry the list, and the fallback replaces every block.

## Validation

`test/policy-helper.test.ts` gains two groups: the instruction text is the non-empty string `claudeMd` (empty, non-string, non-object are absence), the policy view drops the instruction key, and the helper schema accepts `claudeMd` while still refusing unknown keys and a non-string value.

`test/config.test.ts` gains one group: the loaded tier order is managed file, `<policyHelper>`, `<managed-settings>`, managed rule, project file, with an empty text treated as absence; a live refresh replaces the block in place, keeps the memory block after it, journals the tier, returns false for the same text, and removes only the helper block when the text disappears.

`test/agent-registry.test.ts` extends the W369 managed-only group: the parent config carries `instructionSources` and a memory block; the child prompt places the helper tier between the managed file and the settings document, drops the parent's project block, and keeps the memory block. Without the source list the memory assertion fails, so the forwarding is exercised.

`test/permissions.test.ts` gains one group: a managed policy replaces the `policySettings` layer, the re-seeded live state drops the previous managed deny, and the write decision flips to allow.

`scripts/smoke-policy-helper-cli.mjs` gains two cases and captures each request's system prompt. A document carrying `claudeMd` still governs the write and the request carries the text; a document rewritten during a slow shell call is re-read on a 100 ms interval and the second request carries the new text. Five cases, two model requests each, source and compiled.

The red baseline: the compiled CLI refused `{claudeMd:"HELPER_TEXT",allowShell:false}` with `policy does not match the managed policy schema` and the request lacked the text; the same build also denied the served write, the layer defect above.

Check and build pass. Focused suites 159/159 (policy helper 6, config 79, agent registry 50, permissions 23, subagents 1 group file). Full suite 3449/3449 across 118 suites, 0 fail/cancel/skip/todo. Driver passes in source and compiled modes. Identity e7e429ec67805a18dd2442545d2ecbecbbdd9140ed344afdc0bf5788ea458b4f (939 input / 360 validation / 662 build records).

## Reproduction

```sh
node --import tsx --test test/policy-helper.test.ts test/config.test.ts test/agent-registry.test.ts test/permissions.test.ts
node scripts/smoke-policy-helper-cli.mjs
node scripts/smoke-policy-helper-cli.mjs --compiled
```

## Review disposition (2026-10-28)

One bounded independent review read the committed change and returned five findings plus a minor. Disposition:

1. **Confirmed, repaired.** `applyManagedPolicy` appended the rebuilt `policySettings` layer at the end, so after startup it sat behind the `cliArg` layer and the CLI's reload capture (`layers.at(-1)`) recorded the managed layer. `/reload` would then lose the `--allow-tool`/`--deny-tool` layer. The layer is now replaced in the slot it already occupies, or inserted before `cliArg` when the document first declares one; `test/permissions.test.ts` asserts the source order and that the last layer stays the CLI's.
2. **Confirmed, repaired.** The layer was rebuilt only when the new document carried `permissions`, so a helper document that dropped the block left the previous layer in force. The rebuild now also removes the layer when the document declares no layer field (`permissions`, `autoMode`, `useAutoModeDuringPlan`), and an auto-mode-only document still owns a rule-free layer. Both cases are asserted.
3. **Confirmed, repaired.** `policyHelper.defaultPolicy` accepted `claudeMd` through `managedHelperSchema` while the settle ignores a fallback's text. The fallback now uses `managedPolicySchema`, so the key is refused rather than silently unused.
4. **Confirmed as a pre-existing edge case, recorded.** `replaceInstructionSection` finds the previous block span by `Instructions from <path>:` headers, so a previous file whose own text contains such a header line can move the cut inside the old section and re-append its tail. The function predates this package and serves every instruction refresh (W368 onward); the recovered product rebuilds its user context instead of cutting a span, so the in-place rewrite is the host adaptation that carries the edge case. Fixing it needs a block-identity signal the prompt text does not carry.
5. **Coverage, partially addressed.** `test/reload.test.ts` now asserts the journaled helper tier survives a reload. The CLI settle wiring itself stays covered by the compiled driver rather than a unit test, which is the project's convention for CLI wiring.

Minor: the unused `skillsSection` import is removed, and `SessionConfig['managedPolicy']` is now the schema's own inferred type so a field the schema accepts is a field the type carries.

After the repairs: check and build pass, focused suites 162/162, full suite 3451/3451 across 118 suites, driver passes in source and compiled modes, identity 9fc6595ea3d22cc2aa666e84e6c1a8b0cccc12972a280d19eff72bfe326731c6 (939/360/662).
