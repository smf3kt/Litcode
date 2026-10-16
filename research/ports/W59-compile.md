# W59 compiler contracts

Status: verified partial repair. Baseline base commit is `033b9b8d704a12fed9e70e0b9429b49f87870508` in `/Users/mant1ssa/Projects/cc-base-2188`. TypeScript 7.0.2 diagnostics decreased from 136 in 64 files to 4 in 3 files. Compilation still exits 1. The remaining implementation gaps are listed below.

## Changes and source contracts

- Restore SDK types from existing schemas, with external MCP/stream payload and UUID relationships expressed at the static export boundary. Runtime `unknown` placeholders and the original string UUID acceptance remain intact. Added control-request schemas extend the accepted subtype set to match existing handlers; this is a runtime schema extension, not solely a type edit.
- Preserve source algorithms while repairing directory-entry overload selection, shell operator object types, RGB tuples, generic picker inference, generator terminal narrowing, binary framing and LSP text conversion.
- Adapt OpenTelemetry logger construction to the installed options API. Recover metadata through the same type-erasure boundary used when the logger inserted it.
- Fold only source-identified branches disabled by the current empty feature set. Live `process.env.USER_TYPE` branches remain active and are not covered by this proof.
- Bind Workflow and Monitor ports to the actual recovered tool objects. Their descriptor-copying factory preserves fields lost by JavaScript inference. Cross-version execution-context compatibility remains unverified.
- Use official Bun listener declarations at the listener boundary. Do not treat the remaining ambient runtime declarations as implementations.

## Source coordinates

All ranges here are one-based inclusive text lines. Original dump reference is `bd958088195aefbb4bce96ba966447e5e09b1312`. Audit JSON edit offsets use UTF-16 half-open intervals where explicitly marked.

| Source | Range | SHA-256 | Use |
| --- | --- | --- | --- |
| Original `entrypoints/sdk/coreSchemas.ts` | 1247 | `7c4e83756565d421d6d338a2b8356147d95b30132e555c68012ea2551fb3ea9e` | UUID runtime placeholder remains `z.string()` |
| `recovered/chunk-a7gk0710.js` | 3054-3128 | `aadc6ead9b90311bde30e292bef062788e61872a89af0a79ce5ff07d10426e34` | Workflow tool definition |
| `recovered/chunk-znqf6yae.js` | 746-817 | `d2955631e1482570ce6bbe71efc961f31049a84dc91f74bed1ea6118e90080b4` | Monitor tool definition |
| `recovered/chunk-hwpb27as.js` | 6594-6742 | `8341cb6917fbc49b4003bec1022f33cb5c45997c1a24766efa0ee4ef31cb03f2` | Tool factory and descriptor copying |
| `recovered/chunk-sfn1dbxq.js` | 67212-67213, 241556-241574 | `0bcf7b9da8a0e64d2ac63c46c935ce766cbc26008910c252564679e3437bef4b` | Pen attachment variants |
| Installed `bun-types/bun.d.ts` | 7442-7448 | `c73b98a2b831a772fc5de009b4dc029be6d2dc19dfb2780e98674c709c2f8302` | Official listen overloads |

The final evidence generator compares each original blob with the working tree using that same original commit as the diff base. Old hunk coordinates address the hashed original blob; new coordinates address the working tree. This corrects an intermediate checkpoint that paired original digests with HEAD-relative coordinates. That intermediate checkpoint is historical and is not final provenance.

## Verification and limits

Use the base project's `node_modules/.bin/tsc --noEmit --pretty false` from its own directory. The `/tmp/w47-tools` compiler is a different version and is not the measurement authority.

Owned verification commands run from cc_reverse:

```sh
node .audit/w58-verify.mjs
node .audit/w59-verify.mjs
node .audit/w59-followup-verify.mjs
```

Independent reviews reran these fixtures. They cover selected SDK, iterator, discriminator, exporter, filesystem, permission, framing and LSP contracts. Some execute extracted functions or installed dependencies, not complete product call chains. No recovered application entrypoint or paid model request was executed. Full application build and CLI acceptance remain pending.

Two rejected approaches were removed: unchecked `z.custom` payload claims were moved to static types, and UUID template validation was reverted because it narrowed the original string acceptance. Missing Tungsten functions were not filled with invented declarations. Broad message-type experiments that demanded fields absent from source constructors were withdrawn.

S-1/S-7 require source identity before adaptation; S-2 retains genuine missing-implementation diagnostics; S-5 binds checks to observed contracts; S-6 covers affected type consumers. Runtime equivalence claims for deleted gates apply only while the feature shim stays disabled.

## Final checkpoint

Three owned verification scripts and both repositories' diff whitespace checks passed. Independent verification compared the final assistant/user/system serialization expressions with the original source: own-key order, payload identity and JSON output agreed. Marketplace declaration typing now derives from the settings schema without changing runtime parsing.

Final compiler log `.audit/w59-tsc-final.txt` SHA-256 is `36dd3b8c3fdc8de5af386c46159786d4d9901c8c1ddc368203933c1a8c81125d`. `.audit/w59-delivery-evidence.json` binds the 56 changed product files, configuration identities and corrected original-commit coordinate ranges. Earlier checkpoints retain historical states and are not the final result. Evidence generation initially exceeded Node's default subprocess output buffer on the original REPL diff; a bounded 32 MiB buffer fixed it, and the generator then completed.

Remaining diagnostics:

- `commands/clear/caches.ts:97`: two TS2339 errors for absent Tungsten `clearSessionsWithTungstenUsage` and `resetInitializationState` implementations.
- `utils/envUtils.ts:141`: TS18050 for `null.checkProtectedNamespace()` in a live USER_TYPE branch.
- `utils/permissions/classifierDecision.ts:31`: TS18050 for another live USER_TYPE null-module access.

These branches were not deleted and missing implementations were not concealed with declarations. Full build and CLI acceptance remain blocked. This commit records verified partial progress, not a completed compiler cleanup.
