# W184 local plugin components

Status: implementation and validation complete; frozen for review. Sole product writer. W183 behavior remains fixed at commit 9882b12.

Task card
- Deliver local default/custom/empty skills, agents and commands discovery, invocation, reload and cross-runtime mutation freshness.
- Reuse wf_16b78277-a11 journal result and c9-frontmatter-realpath-source.json; original samples remain inert.
- Target plugins.ts, plugin-components.ts, config.ts, agent-types.ts, session.ts and runtime invocation consumers.
- Adapt source loader bodies to synchronous verified installed snapshots and existing YAML/path identity boundaries.
- Validate at most three regression groups, compiled CLI and two independent runtime effects. Full/package and independent review follow freeze.
- No account, OAuth, marketplace, network, paid upstream, commit or push.

Source coordinates are zero-based UTF-16 half-open. The canonical carrier is `extracted-v2/modules/chunk-sfn1dbxq.js` (SHA256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, 4762583 units). `recovered/chunk-sfn1dbxq.js` is a reformatted copy with a different digest (`0bcf7b9d…`) and must not be used for ranges. All bodies below were re-measured on the canonical carrier before product changes.

| Owner | Range | Adaptation |
| --- | --- | --- |
| s0 | [4057817,4057935) | Confinement check for a resolved component path. |
| zR | [4057941,4059187) | Declaration resolution helpers. |
| OEn | [4059187,4061881) | Manifest component entry resolution. |
| Dz | [4061881,4062192) | Declaration source-over-content precedence. |
| lEn | [4062192,4062560) | String-or-list component declaration normalization. |
| wne | [4062566,4070285) | Default/custom/empty component production only; remote/hooks/UI branches remain existing owners. |
| KU/MDt/hlo/ylo/_lo/IDt | [957156,972849) | Recursive Markdown, skill-directory stop/dominance, namespace and metadata overrides. |
| j4 | [959895,964356) | Explicit skill/command format and local invocation fields. `nXt` naming, `Wn` allowed-tools gate, `$re` background. |
| nle | [964489,967726) | Directory/file/inline command loading and independent bad-file continuation. |
| ODt/DDt/klo/WHe | [967732,972849) | Root SKILL.md first, immediate children, shared canonical identity dedup. |
| Zqe/J5t/Z5t/Yet | [2048217,2053851) | Recursive namespaced plugin agent parser, fallback description and restricted field warnings. User/project parser remains strict. |
| Wbe | chunk-3cynezh1.js [109634,109851) | Guard-event detection used by the `Wn` gate. |
| nXt | chunk-zm79vshj.js [10385,10555) | Frontmatter name length gate, AY = 256. |
| RDn/vhr/khr | chunk-zm79vshj.js | maxTurns string parse, autoCompactWindow 100000..1000000, experimental.cacheTtl 5m/1h. |
| Ygt/fHe/ib | chunk-sfn1dbxq.js [436958,437364) | Comma/list name parsing with parenthesis grouping; `*` collapses to a wildcard list. |
| Lu | chunk-z6p21rxk.js [3933,4292) | Skill-directory stop predicate. |

Frontmatter closure chunk-zm79vshj.js SHA256 671868b11eba6ba55d389827d959adb062c3e427d2a4f8ebe00d4f0755d6763c, Gb [2429,2488), WL [5292,5332), I [5416,5880), z [6913,6938), si [6938,8350), tXt [8350,8558), C [8708,8785). Exact acquired bodies read in sibling JSON. Key normalization is identity. Node yaml 2.9.1 replaces native Bun.YAML.parse; parser-version parity is unclaimed. Dedicated plugin parser preserves separated body after parse failure and two-pass scalar/tab recovery without changing W183's config parser.

Canonical identity closure chunk-gyf58rwf.js SHA256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad, ff [63574,63768), Vn [64077,64192), He [64745,67735), yo [67735,68107), FZ [68463,68860), $pe [71403,71491). Existing verified installed snapshot rejects symlink/hardlink mutation and confines reads; best-effort dedup identity does not grant access. Windows/network ancestry classification remains untested and is not replaced with a permissive authorization fallback.

Cache evidence from wf_16b78277-a11: chunk-3ph567jx.js SHA256 281868632c24f04e8dca6677ab734f29299f78b6933693a9148d7dbaf698a11b Nhr/Fhr/$hr [3862,3992); sfn zLr/sc [3706919,3707202). Read before lifecycle implementation. Host uses W181 committed-index identity and per-runtime owner lifetime rather than source registry singleton.

## Ported semantics

- Namespaced skill naming follows source `Ze`: the plugin-qualified name is the command; a bare frontmatter `name` becomes an alias, never the command. A declared name containing `:` never aliases.
- Source `Wn = Mn || nn ? [] : Ae`: a top-level PreToolUse/PermissionRequest declaration or unreadable hooks clears allowed-tools; a parseable `hooks` block containing a guard event also clears them and keeps the hooks.
- Plugin agents: over-256-character names fall back to the file stem; `model: inherit` is preserved literally; `maxTurns` accepts a numeric string; `memory` must be user/project/local; `autoCompactWindow` is an integer in 100000..1000000; `experimental.cacheTtl` accepts 5m/1h. The two restricted-key groups emit the source's distinct warning text.
- Agent `skills` preloads up to 32 names as meta user messages: exact name, then `plugin:name`, then any `:name` suffix. Missing or non-invocable entries warn and skip. The message carries `command-message`, `command-name`, `skill-format` and the expanded body, matching source `formatSkillLoadingMetadata`.

## Host adaptations

- `refreshPluginComponents` replaces only the heading, its intro line and the JSON catalog lines, preserving text appended after the section. The earlier "next `#` section" boundary truncated child markers and agent instructions on any config whose system ended with the agent-types section.
- A child config (`childMode` set) is a fixed snapshot: refresh returns early. Without this, a child turn reloaded the owner's catalog, changed the leased environment and failed `validateChildEnvironment` (`system`, `pluginGeneration`).
- Agent skill preloading is applied in both child paths: the synchronous `agent()` tool and the session-owned registry.
- Plugin agent fields the host does not execute (`memory`, `autoCompactWindow`, `cacheTtl`) are parsed and carried on `AgentTypeInfo`; their runtime consumers stay with the existing session owners.

## Smoke contract changes

- `scripts/smoke-plugin-components.mjs`: the second SessionStart hook is a command hook rather than a `type: "script"` hook. W89 refuses script hooks in this build, so a script hook can never produce `PLUGIN_SCRIPT_DISPLAY` or `suppressOutput`. Two command hooks still cover suppressOutput aggregation, systemMessages and SessionEnd display. Summary key `scriptStartupHook` became `secondCommandStartupHook`.
- `scripts/smoke-skill-agent-cli.mjs` was not modified. Its `--plugins` failure was a product regression fixed above, not a contract change.
- MCP `tools/call` assertions split name, arguments and `_meta.progressToken` because every call now carries the per-call progress token (commit bb237bd).

## Validation

- `npm run check` exit 0.
- Full suite: 2613 tests / 2613 pass / 0 fail / 118 suites under private HOME/XDG/TMPDIR/Git config.
- `npm run build` succeeds; identity `1e4dba4982acdbbecabe3841ff5efc95177f3bd0efcd87e317bb4c107cd6af41` (inputs 744, validation 231, build 508).
- `scripts/smoke-plugin-components.mjs` passes in source and `--compiled` modes (install, discovery inert, CLI, hooks, MCP handshake, reload).
- `scripts/smoke-skill-agent-cli.mjs --compiled --plugins` and `--compiled --agent-alias` pass; `--compiled` baseline passes.
- `test/plugin-components-w184.test.ts`: 6 tests covering default/custom/empty declarations, formats and diagnostics, field gates and preloads, two-owner refresh, reload and child-tail preservation.

Freeze: complete. Independent review and full/package acceptance remain open.
