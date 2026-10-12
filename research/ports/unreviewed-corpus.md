# Unreviewed corpus characterisation

Status: bounded characterisation pass, not a port record. Date: 2026-10-12.
Purpose: the module ledger counts 2267 uncited modules (31,663,093 bytes; 33 backed by a port record, 65 mentioned only in prose). The figures in the tables below were taken at the pass that produced them and are not rewritten afterwards; the authoritative totals are always the regenerated ledger's. This pass describes what that remainder is using byte evidence only, so the number stops being an unqualified unknown. The figure moves as packages land, and one correction is recorded here: the ledger used to scan its own generated `-evidence.json` files as citing records, so a package's evidence file could cite the very modules it had ported and inflate the count. The generator now skips those files, and the numbers below are the regenerated ones. Nothing here claims which subsystem owns a module, and naming a module here does not make it port evidence - the ledger counts a module as port-backed only when a record under `research/ports/` that declares a port classification names it.

## Method

Every rule below is mechanical and reproducible from the extracted sample (`/Users/mant1ssa/.local/share/claude/versions/2.1.296`, SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937). All of it runs in the ledger generator, so the same numbers can be regenerated at any time:

- **Banner.** Every recovered module starts with a leading block of `//` comment lines (the sample's build banner). Its length is recorded per module so later passes can measure the readable payload rather than the header.
- **Binary.** A module whose decoded text contains U+0000 is recorded as a binary payload. Three modules qualify in the whole sample (`chart.umd.min.js`, `hljsBundle.generated.min.js`, `mermaid.min.js`), all of them bundled assets rather than product source.
- **Markers.** Sixteen literal strings are searched verbatim; a hit records the literal and its first offset. The literals were chosen because they appear only in one recognisable family of code, so a hit characterises the module without asserting ownership.
- **Imports.** Well-formed module specifiers are extracted from `from"..."` and `require("...")` occurrences and validated against a specifier grammar, so no package name is ever invented from adjacent minified text. Each specifier is filed as a runtime builtin, a sibling chunk, or an external package.

A note on the false lead this pass corrected: the `// @bun @bytecode` banner appears on 2362 of 2365 modules and does **not** mean the module is undecodable bytecode. The manifest's "bytecode is indexed, not decoded" limitation refers to the compiled payload; the extracted text after the banner is readable source, which is what every record in `research/ports/` has been quoting. Only the three U+0000 modules carry no readable payload.

## What the uncited remainder is

- Uncited modules: **2275** (32,072,858 bytes).
- Of those, **2258** import only Node builtins or nothing at all, and **0** import a sibling `chunk-*.js` by name. The bundler inlines sibling chunks, so import structure cannot separate product code from vendored code here; it does show that the uncited set is made of self-contained leaves rather than a graph of small product modules.
- External package specifiers across the whole uncited set: `async_hooks` (10 modules), `ws` (3), `ajv` (2), `inspector` (1) and `claude-code` (1, the bundle naming itself). `async_hooks` is a runtime builtin that the generator's builtin list still misses, so those ten are filed as an external package; correcting the list would move them into the leaf-only count.
- **2225** of the 2275 carry none of the sixteen markers. They are the true remainder: readable recovered source whose subsystem this pass did not determine.

## Marker families inside the uncited set

Counted from the ledger summary; a module may carry several markers. Generously interpreted, these families cover roughly fifty of the 2275 modules, which is why the remainder above is stated separately.

| Family | Literal | Modules | Bytes |
| --- | --- | --- | --- |
| API beta headers | `anthropic-beta` | 20 | 3098332 |
| cloud identity client | `login.microsoftonline.com` | 4 | 1907554 |
| validation-library messages | `invalid_union` | 4 | 1572631 |
| protobuf descriptors | `EDITION_2023` | 2 | 1336593 |
| self-hosted release surface | `self_hosted_` | 10 | 1220276 |
| plugin eval tooling | `cli_plugin_eval` | 2 | 1061861 |
| org memory surface | `org_memory_` | 3 | 1037975 |
| background-agent UI | `fleet_view_` | 3 | 1036352 |
| artifact capability surface | `artifact_capability_section` | 2 | 977755 |
| protobuf runtime | `google.protobuf.Struct` | 1 | 943361 |
| syntax grammars | `title.class` | 3 | 608622 |
| DOM/HTML parser | `annotation-xml` | 3 | 438255 |
| terminal UI library | `ink-virtual-text` | 1 | 360288 |
| MCP protocol surface | `resources/templates/list` | 2 | 343724 |
| otel otlp protobuf | `timeUnixNano` | 1 | 267269 |
| plugin marketplace UI | `manage-marketplaces` | 1 | 247454 |

## The twenty largest uncited modules

Each row was read (the module's distinctive literals were extracted, as in the method above) and classified against the rules CURRENT already fixes: OAuth and cloud-product backends are external or excluded, and this runtime ships its own interactive UI rather than a copy of the recovered one.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-yhar7r1q.js` | 1458514 | `invalid_union`, `unrecognized_keys`, `not_multiple_of` | vendored validation library |
| `chunk-qxmpnv25.js` | 943361 | `google.protobuf.Struct`, `uninterpreted_option` | vendored protobuf runtime |
| `chunk-bk5ct2gw.js` | 744610 | `apiKeyHelper`, `ANTHROPIC_API_KEY`, `anthropic-ratelimit-unified-status` | product networking/config surface; this runtime owns its gateway layer |
| `chunk-95gcr8xw.js` | 670136 | `read_asset`, `upload_asset`, `room_send` | hosted artifact surface, external |
| `chunk-vgrqk0ky.js` | 589973 | `title.class`, `variable.language` | vendored syntax grammars |
| `chunk-1pwmtn16.js` | 393232 | `EDITION_2023`, `proto3_optional` | vendored protobuf descriptors |
| `chunk-06azbynj.js` | 360288 | `ink-text`, `wrap-trim`, `cursorTo` | vendored terminal UI library |
| `chunk-2rxk8n7w.js` | 332939 | `notifications/tools/list_changed`, `sampling/createMessage`, `subscriptions/listen`, `tasks/get` | in scope: the protocol surface this runtime ports against |
| `chunk-dg43zpqr.js` | 332758 | `login.microsoftonline.com`, `refresh_token` | vendored cloud identity client |
| `chunk-14rnebpd.js` | 320347 | `anthropic-beta`, `managed-agents-2026-04-01`, `seven_day_overage_included` | provider beta headers and entitlement metadata; this runtime pins the stable surface |
| `chunk-b96hm1m2.js` | 317251 | `cli_plugin_eval`, `cli_plugin_eval_mocks` | product plugin-eval tooling, not ported |
| `chunk-0n88wbb5.js` | 293606 | `self_hosted_release_session`, `self_hosted_governed_push_url` | self-hosted governance surface, external |
| `chunk-ttr9m1ca.js` | 267269 | `timeUnixNano`, `droppedAttributesCount` | vendored otlp protobuf |
| `chunk-dxmjjd09.js` | 248950 | `annotation-xml`, `application/x-www-form-urlencoded` | vendored DOM/HTML parser |
| `chunk-tw1h5pks.js` | 247454 | `manage-marketplaces`, `claudeai-proxy` | plugin marketplace UI, cloud-dependent |
| `chunk-phg89898.js` | 247210 | `renderToolResultMessage`, `app:toggleTranscript` | recovered interactive UI; this runtime ships its own |
| `chunk-2bcyxj9q.js` | 245965 | `org_memory_credential`, `org_memory_discovery` | organisation memory surface, cloud |
| `chunk-nyce03br.js` | 240023 | `engine.create`, `prompt.submit` | recovered interactive UI |
| `chunk-yy4ay7w5.js` | 233145 | `artifact_capability_section`, `chrome_install_upsell` | hosted artifact/upsell prompts |
| `chunk-kjhqbc9p.js` | 200144 | `fleet_view_open`, `tengu_bg_agent_action` | background-agent UI and telemetry |

The in-scope row is the one actionable finding of this pass. `chunk-2rxk8n7w.js` carries the protocol method names this runtime implements against (`notifications/tools/list_changed` at [8033,8065), `subscriptions/listen` [5839,5859), `sampling/createMessage` [9367,9389), `elicitation/create` [11191,11209), `tasks/get` [12450,12459)) and the SDK-level reconnect policy `_h={initialReconnectionDelay:1000,maxReconnectionDelay:30000,reconnectionDelayGrowFactor:1.5,maxRetries:2}` that the stdio re-dial record replaces with owned bounded rounds. It is recorded here as a candidate for a port record's provenance the next time one of the MCP records is revised; this pass does not edit a verified record to add a citation.

## Slice two: uncited modules ranked 21 to 45

The same method applied to the next twenty-five uncited modules by size (rank 21-45 of the uncited list). Each row's literals were extracted mechanically from the module text, then classified against the rules CURRENT fixes. Ranks 21-45 total 3,271,635 bytes.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-d3mr9n6t.js` | 189764 | `invalid publish options`, `artifact_publish`, `deploy_incomplete` | artifact publish/deploy surface, cloud |
| `chunk-7arz1812.js` | 182565 | `TABULATION`, `CARRIAGE_RETURN`, `EXCLAMATION_MARK` enum | vendored tokenizer |
| `chunk-6feyq2pe.js` | 170185 | `@aws-sdk/core/protocols - JsonReplacer exhausted.` | vendored AWS SDK core |
| `chunk-b1maf7av.js` | 159827 | `"karma-sourcemap-loader":"^0.4.0","karma-webpack":"^5.0.1` | vendored dev-dependency manifest and HTTP helper |
| `chunk-es07s2ha.js` | 156084 | `artifact_comments_autoreact`, `compose_hidden_codepoints` | hosted artifact surface, external |
| `chunk-qx79s5zs.js` | 153987 | `Unable to create cloud session` | cloud session surface, external |
| `chunk-8jhea020.js` | 153070 | `{kind:"refuse`, `PreToolUse",permissionDecision:"deny` | **in scope**: refusal outcome records and the permission-decision surface |
| `chunk-40cepjpq.js` | 148871 | `turn_start_tool_run`, `turn.complete`, `turn.step hooks` | recovered turn lifecycle telemetry; this runtime owns its hook contract |
| `chunk-z0td7hqb.js` | 141182 | `save_panel_restricted`, `${n.chord}` | recovered settings-panel UI; this runtime ships its own |
| `chunk-nw390769.js` | 131245 | `/worker/events/delivery`, `cli_heartbeat_interval_updated` | hosted telemetry delivery, external |
| `chunk-tm17ttjb.js` | 129126 | `Plugin "${n}`, `object"&&u.source.source==="command` | plugin loading surface; this runtime has plugins, candidate |
| `chunk-4bw62nzm.js` | 124371 | `this.policyWalks>o?"raced":"deferred` | **in scope**: managed settings policy install race handling |
| `chunk-6ejn7q9s.js` | 123165 | `task-notification",skipAttachments:!0,priority:"next` | task notification queue; this runtime has task projections, candidate |
| `chunk-4k0venhb.js` | 122612 | `decisionReason:{type:"safetyCheck"`, `db_write_source_changed` | permission-decision reasons; this runtime has its own permission contract, candidate |
| `chunk-g7dvhj78.js` | 122571 | `Comma is not permitted after the rest element` | vendored JavaScript parser |
| `chunk-dag4qhha.js` | 116794 | `confirm:no",context:"Settings"` | recovered settings dialog UI |
| `chunk-8r2p9ym6.js` | 116101 | `ajv implementation error`, `CodeGen: name must be a valid identifier` | vendored ajv code generator |
| `chunk-x0dc37w9.js` | 113411 | `settings_policy_helpers_per_os`, `remote_consent_missing`, `\builtin eval ': "${(U)__cc_uc}` | **in scope**: per-OS managed settings policy helpers and remote-consent state, in a module that also carries POSIX-shell helper wrappers |
| `chunk-wvk9709s.js` | 111068 | `-literalpath","-pspath","-lp"],knownSwitches`, `operationType:"write"` | OS-specific command permission table, candidate |
| `chunk-fk088dyb.js` | 105918 | `not_served`, `unknown_host`, `in_progress.checkin` | hosted service routing surface, external |
| `chunk-4vzk3y22.js` | 104016 | `DelayedStream#maxDataSize`, `maxContentLength size of ` | vendored HTTP client |
| `chunk-r1tkyayr.js` | 101509 | `chart-card`, `stat-value`, `glance-section` | recovered report/artifact HTML template |
| `chunk-2qc0y6h3.js` | 99781 | `PACKAGE_URL:"@anthropic-ai/claude-code"`, bundle chunk map | build metadata |
| `chunk-wfd47qpn.js` | 99115 | `VERSION:"2.1.296"`, `BUILD_TIME:"2026-10-09T01:31:52Z"` | build metadata |
| `chunk-hedqf2m1.js` | 95297 | `workflow_log`, `LocalFileJournal: journal append failed` | workflow journal/abort surface; this runtime has workflow, candidate |

Three in-scope findings stand out. `chunk-x0dc37w9.js` is the per-OS managed-settings policy helper subsystem this pass had listed as unidentified, and it also carries the remote-consent state names, so the two are one subsystem rather than two. `chunk-8jhea020.js` carries refusal outcome records (`kind:"refuse`) alongside the permission-decision surface, which is why the refusal-notice record cites it. `chunk-4bw62nzm.js` carries the policy-install race/deferred handling. The remaining candidates (plugin loading, task notifications, permission reasons, OS command tables, workflow journal) are recorded as candidates only; naming them here does not make them port evidence, and no record under `research/ports/` was edited by this pass.

## Slice three: uncited modules ranked 46 to 70

The same method on ranks 46-70 of the uncited list (2,052,421 bytes). Twenty of the twenty-five are already classifiable without new judgement: six are byte-identical builds of the same build-constants module (`VERSION:"2.1.296"`, `BUILD_TIME`, `GIT_SHA`), four are bundler import tables or recovered UI panels, and the rest are vendored libraries (`LinkedMap got modified during iteration.`), hosted surfaces (`artifact_live_subscribe`, `remote_connect_reconnect_exhausted`, `X-Trusted-Device-Token`) or recovered report text.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-8f5kkssn.js` | 93995 | `Prompt is too long`, build constants | build metadata |
| `chunk-zjewzgfh.js` | 93529 | `too-complex",reason:`, `nodeType:"heredoc_redirect"`, `readings:s,exhaustive:` | **in scope**: the shell-reading analyser behind permission matching (see below), a different module from the argument splitter in `chunk-m00pavz3.js` |
| `chunk-qh0w98pn.js` | 93183 | build constants | build metadata |
| `chunk-78w3rfp3.js` | 91598 | `,what:"Worktree not removed."`, `tengu_bg_respawn_no_transcript` | product worktree/fleet surface, candidate |
| `chunk-0gtwhfja.js` | 91257 | `artifact_live_subscribe`, `stop_latched` | hosted artifact surface, external |
| `chunk-n2m97prf.js` | 90987 | `away.ending`, `transport_error` | recovered UI/transport |
| `chunk-p04gkfzf.js` | 90180 | `**GOOD**`, `**BAD**`, `ui.render` | recovered UI and prompt text |
| `chunk-3rqqsw4d.js` | 88940 | build constants | build metadata |
| `chunk-nvrxq9nn.js` | 87530 | `100.100.100.200`, `168.63.129.16`, `192.0.0.192`, `agent_proxy_init` | **in scope, candidate**: cloud metadata-address classification and agent proxy init |
| `chunk-81hpx0b5.js` | 86363 | `ask.settings_person_only`, `"bash":"powershell"`, `own_record` | settings/permission and shell-family selection, candidate |
| `chunk-ggrygrz8.js` | 86361 | `effort_options`, `mode_options` | recovered interactive settings UI |
| `chunk-7vyj6mx6.js` | 85574 | `import("/$bunfs/root/chunk-qrk2kkgt.js` | bundler import table |
| `chunk-h6bkpzcg.js` | 84102 | build constants | build metadata |
| `chunk-gyf58rwf.js` | 82836 | `[REDACTED]`, `replace(/!\[/g,"! [` | **in scope, both halves landed**: the link-chain resolver as [W09](W09-path-chain.md), the credential-pattern table as [W19](W19-credential-shapes.md) |
| `chunk-mktwnkyx.js` | 81379 | `X-Trusted-Device-Token`, `control_response`, `remote_connect` | remote device surface, external |
| `chunk-m4qpskd4.js` | 80152 | `./board.tsx`, `Program":case"FunctionDeclaration` | recovered UI and a vendored parser |
| `chunk-9hhsx4g6.js` | 76969 | `owns-process`, `tengu_turn_handoff_flag_wait`, `carried_writes` | turn handoff and context carrying, candidate |
| `chunk-xxx7vgzn.js` | 75989 | `sdk-ts`, `Control request aborted` | bundler import table and transport |
| `chunk-f3ced139.js` | 73494 | `claude-local-pairing/v1`, `sealed channel torn down` | local pairing surface, external |
| `chunk-8rwtkpax.js` | 72999 | `artifact_guard_autoread`, `ws-decisions` | hosted artifact guard, external |
| `chunk-b72e3nw2.js` | 70841 | build constants, `job not found - it may have already exited` | build metadata |
| `chunk-gvps5cb5.js` | 69470 | build constants | build metadata |
| `chunk-yvnhkg35.js` | 69026 | `import{gy,oee,b6n,Mwe}from"/$bunfs/root/chunk-ae84tp6z.js` | bundler import table |
| `chunk-fwvv1b55.js` | 68187 | `tengu_setup_github_actions_failed`, `confirm:yes` | CI setup flow and recovered UI |
| `chunk-pr56pwvs.js` | 67480 | `LinkedMap got modified during iteration.` | vendored library |

Slice three's most significant row is `chunk-zjewzgfh.js` (93,529 bytes, SHA-256 `83180bcc6260cb73ac46b7d44d98a5a621a1dc03153582b929e8d717649149b3`). It is not the argument splitter this ledger already decided not to port - that lives in `chunk-m00pavz3.js` - and the two are easy to confuse because both are shell-grammar code. This module is the shell-reading analyser behind permission matching:

- `function pyr(e,t)` [7547, 7897) builds the set of readings: every one of the `2**e` combinations when at most three positions vary, marked `exhaustive:!0`, and otherwise a bounded set (all-false, all-true, then one-hot readings up to eight) marked `exhaustive:!1`. A permission check that matches one literal reading is unsound when the shell could read the same text another way, so this is the part that enumerates the alternatives.
- `function E6(e,t,{plainUnquotedHeredocs:r=!1,declarationPrefix:s}={})`, entering at [7897, 7910), classifies a command before that comparison as `{kind:"too-complex",reason,differential:!0}` for a lone surrogate [7988, ...), control characters, Unicode whitespace, backslash-escaped whitespace, zsh `~[` dynamic directory syntax, zsh `=cmd` equals expansion and zsh `<N-M>` numeric-range globs. Sixty-six `differential:!0` verdicts appear between 8040 and 64507, so the rule machinery, not just a preamble, is what fills this module.
- `function b(e)` [73416, 74572) returns the same kind for a shell node it does not model, naming the node type in `` `${t} in this command can't be checked before it runs` ``, and for a `${` followed by non-ASCII text it says that the text can't be checked before it runs.

Nothing in `src/` enumerates shell readings or refuses an ambiguous command, so this is an in-scope gap rather than a decided item, and CURRENT carries it as the next candidate work package.

Slice three's other new in-scope candidate is the cloud metadata-address table in `chunk-nvrxq9nn.js`.

The three slices read fifty modules between them. They were ranked against the uncited list as it stood when each slice was taken, so the counts in the tables and the ledger's current totals do not subtract cleanly; the authoritative number is the regenerated ledger's, which after this package's own citations stands at **2225 uncited modules with no marker**.

## Slice four: uncited modules ranked 71 to 95

The same method on ranks 71-95 of the uncited list (1,376,177 bytes, 25 modules, 61,473 bytes down to 49,498). Slices are taken on successive rank bands of that list, and the list is stable between passes because this file is excluded from the ledger's citation scan along with the other generated records, so the bands are contiguous: slice three ended at rank 70 and 67,480 bytes, and slice four begins at rank 71 and 61,473. The two tables therefore share no module, and ranking against the uncited set rather than the whole module list is what keeps them apart - an earlier attempt that ranked all 2,365 modules re-covered twenty of slice three's rows.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-5ggmnm67.js` | 61473 | `Hooks dialog dismissed`, `Only hooks from managed settings run here.`, `a managed policy allows plugin hooks only` | hooks dialog and per-machine consent, recovered UI |
| `chunk-fmjcnmvh.js` | 61459 | `auto_mode_pregather`, `allow_auto_mode_sibling_docs`, `denied by the Claude Code auto mode classifier` | **in scope, candidate**: auto-mode environment gathering and its own classifier |
| `chunk-qtksmp3x.js` | 61379 | `ReadProjectContext`, `RunPluginHook`, `RegisterRepoRoot`, `StageFile` | project/IDE bridge RPC surface, external |
| `chunk-bfx0ykd5.js` | 61291 | `Failed to discover OAuth metadata`, `No code verifier saved`, `McpClientRegistrationDeferredError` | MCP OAuth client, excluded by the standing OAuth rule |
| `chunk-wzb08ah9.js` | 61165 | `PeriodicExportingMetricReader`, `ExponentialHistogramAggregator` | vendored OpenTelemetry metrics SDK |
| `chunk-7hyndmfy.js` | 60051 | `ZodDiscriminatedUnion`, `Validation failed but no issues detected.` | vendored zod |
| `chunk-j78s1mr1.js` | 60006 | `Claude Code Signed Cache Issuing CA`, `Policy limits: Using stale cache after error` | hosted policy-limits fetch with a pinned CA and stale-cache fallback, external |
| `chunk-zha4hbcb.js` | 58238 | `Cursor Custom Modes`, `Codex user-scope config`, `No matching Claude Code hook event.` | **in scope, candidate**: foreign agent-config import and translation |
| `chunk-xnkq6d5e.js` | 57822 | `Claude Design requires a project write grant`, `List design systems` | hosted design surface, external |
| `chunk-yygmb66g.js` | 56087 | `select:accept`, `attachments:remove`, `focus-next-page` | recovered TUI select and attachment component |
| `chunk-6ep3wnmg.js` | 54991 | `MCP OAuth refused: no valid server URL`, `Acquired refresh lock` | MCP OAuth client, second copy, excluded |
| `chunk-dsfrra43.js` | 54689 | `RegisterWorker`, `IssueSessionToken`, `SERVER_AUTO_MODE_LISTS_NO_ALLOW` | self-hosted runner worker protocol and the auto-mode list the server hands down, external |
| `chunk-zzcgzkve.js` | 53767 | `artifact_live_subscribe`, `boot_403_request_access`, `asset_egress_relayed` | hosted artifact and asset surface, external |
| `chunk-m2gn903q.js` | 53420 | `bg roster.json v5 read failed`, `attachStallRespawns`, `claude agents` | background-session roster and daemon registry |
| `chunk-kwp08k6x.js` | 52906 | `claude-plugin-test-`, `prompt.submit`, `poll_events` | plugin eval and test harness tooling |
| `chunk-f37m98yh.js` | 52545 | `com.apple.Terminal`, `iTerm2 clipboard access already enabled`, `keybindings.json` | terminal and keybinding setup; this runtime has local counterparts |
| `chunk-smqzgwbf.js` | 52325 | `Projects needs a claude.ai login.`, `Read project memory file` | hosted Projects and memory surface, external |
| `chunk-nx416mf9.js` | 51516 | `RSASSA-PKCS1-v1_5-SHA512`, `Release manifest signature verification failed` | native installer and updater behind a signed release manifest |
| `chunk-k4j9t0m5.js` | 51226 | `artifact_type_describe`, `deck/design-systems` | hosted artifact-type surface, external |
| `chunk-4j3cp32b.js` | 50939 | `adopt.json`, `bad ack: non-object ack line`, `control socket closed` | background supervisor control socket |
| `chunk-fn59xp63.js` | 50532 | `BatchSpanProcessor: span export failed`, `OTEL_BSP_MAX_QUEUE_SIZE` | vendored OpenTelemetry traces and OTLP exporter |
| `chunk-waj214sv.js` | 49691 | `ERR_JWE_DECRYPTION_FAILED`, `Compact JWS must be a string or Uint8Array` | vendored jose |
| `chunk-3e1vfdd3.js` | 49650 | `deserializerMiddleware`, `generateIdempotencyToken` | vendored AWS SDK protocol core |
| `chunk-9nek920x.js` | 49511 | `cli_marketplace_add_blocked_by_policy`, `No marketplaces configured` | plugin marketplace CLI; this runtime has plugins but no marketplace client |
| `chunk-4e6zns40.js` | 49498 | `https://json-schema.org/draft/2020-12/schema`, `Applicator vocabulary meta-schema` | vendored ajv meta-schemas |

The band is mostly settled material: six vendored libraries (two OpenTelemetry, zod, jose, AWS SDK core, ajv), seven hosted or external surfaces, two OAuth clients the project rule already excludes, two modules of the background/daemon family, two recovered UI panels, and three that this runtime already has counterparts for or that belong to product tooling (terminal and keybinding setup, the signed-manifest installer, and the plugin eval harness). Three in-scope items are recorded as candidates only - auto-mode gathering (`chunk-fmjcnmvh.js`), the foreign-config import (`chunk-zha4hbcb.js`) and the plugin marketplace CLI (`chunk-9nek920x.js`) - and naming them here is not port evidence.

## Slice three's open candidates, now disposed

Slice three left two modules as in-scope candidates. Both readings are now settled against their bytes.

`chunk-nvrxq9nn.js` (87,530 bytes, SHA-256 `c3ac807c5931807f85455223fccc717deac2148575bc8de9e73e039a6ec4ae8b`) is the `ccr-agent-proxy` cloud-sandbox egress proxy, and it is **external**. Every literal in the module belongs to it: the relay's failure names (`agent_proxy_init_no_token`, `agent_proxy_request_not_connect`, `agent_proxy_direct_peer_blocked_`, `agent_proxy_buffered_amount_untrusted`), the trust-installation targets (`nss_add_failed`, `java_truststore_import_failed`, `bazelrc_write_failed`, `boto_write_failed`, `git_ssl_cainfo_configured`, `gh_shim_write_failed`), and the mechanism set the slice flagged. It needs three things this host does not have: an `AGENT_PROXY_URL` and `AGENT_PROXY_AUTH_TOKEN` issued by the cloud environment, a session token read from the container path `/run/ccr/session_token`, and the cloud relay itself, whose status route is `` `${port}/__agentproxy/status` ``. `src/` has no proxy transport at all - the only matches for `proxy` are `new Proxy` in `src/runtime.ts` and a header-name filter in `src/mcp-http.ts` - so the module's NO_PROXY address tables (`169.254.0.0/16`, `100.64.0.0/10`, `127.0.0.0/8`, `.svc.cluster.local`, the RFC1918 blocks) have no local consumer to serve. Porting the tables alone would be dead code, so the module is classed external with the cloud product backend, which is the disposition CURRENT already fixes.

`chunk-gyf58rwf.js` (82,836 bytes, SHA-256 `7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad`) was recorded by slice three as redaction and Markdown link rewriting. That reading is wrong. The module is a **credential-pattern table and a path link-chain resolver**, and both are in scope because this runtime has no counterpart to either:

- The pattern side carries fifty-five distinct provider-name literals, from `anthropic-api-key` [26093, ...) and `github-pat` [26940, ...) through `SendGrid` [47460, ...), graded `low` or `high` and grouped by categories such as `masked-value-rest`, `sensitive-assign-escaped` and `sensitive-assign`. The literals span [24284, 79325], so the table is interleaved with the resolver rather than occupying a region of its own. Nothing in `src/` scans content for credentials; the sixteen files that match `secret` or `credential` are about settings and MCP headers, not detection.
- The path side resolves a link chain rather than calling `realpath` once. `ff` [63574, ...) walks the chain hop by hop and `NN` [63768, ...) is its asynchronous form; `FZ` [68463, ...) falls back on an unreadable ancestry, consulting `ywe` [68107, ...) for the launch ancestry's common root; `Azn` [61668, ...) builds `ELOOP: symbolic link chain too long to vet` through a factory, `Spt="ERR_SYMLINK_TO_NETWORK_PATH"` [68860, ...) names the verdict a chain that surfaces a network path earns, and the sentinels `Lh="\x00unverified-ancestry"` and `C8e="\x00opaque-link-text"` mark the two outcomes that are not a path. `kzn` [61366, ...) rejects text that is not canonical - U+FFFD, drive-relative `C:foo`, root-relative `\foo`, `\\?\` device paths without a drive or UNC, and components ending in a dot or a space - and `Un` [61780, ...) decides whether an unreadable ancestor may be treated as verified, exempting `ENOENT` and `ENOTDIR`. `DV` [68898, ...) and `lj` [69060, ...) are the sync and async entry points; `lj` additionally records every link hop, the end state, and a `dev`/`ino`/`ctimeNs` identity, and reports `noFileSeen` when a symbolic link was the last thing observed.

This runtime's own path handling is a single check, not a resolver: `src/media.ts` rejects a resolved path that escapes the workspace, `src/plugins.ts` rejects symbolic links and re-stats a directory after reading it, and `src/sessions.ts` rejects a symlinked session directory. `research/FEATURES.md` therefore lists *symlink confinement* as integrated, which it is, but none of those checks can see a chain that lands on a network path, none caps the chain length, and none verifies that the file it resolved is the file it then reads. The link-chain resolver is the smaller of the two gaps and the one that hardens behaviour this runtime already claims, so it is carried as the next candidate work

**Both halves have since landed.** The resolver became [W09](W09-path-chain.md) (the chain walk with its bound, its network-path refusal and its read-before-and-after identity). The pattern side became [W19](W19-credential-shapes.md), and the port read the table whole rather than from the literals: `mn` at [24001,30608) holds 64 entries, not the fifty-five provider names this note counted from the literal scan - the difference is the twelve contextual entries. Of those, 52 are prefix-anchored provider formats and are transcribed into `src/credential-shapes.ts`; the twelve contextual ones (the `url-userinfo` family, an authorization header value, a loose JWT, an assignment to a field named like a secret, `cloud-env-var`, `masked-value-rest`, a loose Anthropic prefix and a service-account mailbox) are deliberately not carried, because this runtime's text surface drops a citation whose URL changes under redaction and a broad pattern would silently discard legitimate results. The rule landed where this runtime already redacts text it re-emits - the known-secret pass in `src/web-search.ts` - so a provider-shaped token the session was never configured with is now removed for the same reason a configured one is. The confidence field, the `prefilter` and the `redactOnly` flag are not carried: they decide anchoring and finding-count on the recovered side and have no reader here. package; the credential table is recorded beside it as a second candidate, unscheduled.

## Slice five: uncited modules ranked 96 to 120

The same method on ranks 96-120 of the uncited list (1,119,349 bytes, 25 modules, 47,719 bytes down to 41,435), continuing directly below slice four's 41,435-byte boundary.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-j8hqhz0c.js` | 47719 | `GIT_ALLOW_PROTOCOL`, `SSH_ASKPASS`, `credential.helper`, `extensions.partialclone`, `diff_base_resolve` | git environment hardening and diff-base resolution for a cloud session, external |
| `chunk-vwf6cfye.js` | 47498 | `bridge_transcript_catch_up`, `allow_remote_control`, `oauth_expired_unrefreshable` | Remote Control bridge, external |
| `chunk-nybcbd9t.js` | 47466 | `Auto-scroll output`, `Precompute compaction`, `Remote Control setting locked by org policy` | recovered settings catalog |
| `chunk-xmmahshv.js` | 47400 | `Memory dialog dismissed`, `Synced project memory`, `auto-dream` | memory dialog and project-memory sync; this runtime has local counterparts |
| `chunk-53ca5km4.js` | 47240 | `artifact_publish_retry`, `db_write`, `asset_upload` | hosted artifact and asset surface, external |
| `chunk-qq2mgstr.js` | 46867 | `HIPAA-R13`, `Account skills sync`, `Design sync` | compliance labels and account sync surfaces |
| `chunk-mkyr1xcw.js` | 46820 | `control_request`, `can_use_tool`, `export_conversation` | control-protocol request handlers, external |
| `chunk-kjfwbh4w.js` | 45881 | `tty-graphics-protocol`, `kittyGraphics`, `probe: the query was dropped` | recovered terminal graphics probe |
| `chunk-ekc0m0v0.js` | 45760 | `AppifactRepl: refused for a remote caller`, `artifact_repl_call`, `CLAUDE_CODE_ARTIFACT_FD` | hosted artifact REPL surface, external |
| `chunk-ry9wp54p.js` | 45614 | `resume picker: pre-load failed`, `claude --resume` | recovered resume picker |
| `chunk-e24bvje9.js` | 45278 | `Save dynamic workflow`, `JSON outcome nested past MAX_DEPTH` | workflow view and saved-outcome serialization; this runtime has a workflow surface |
| `chunk-kqp903rz.js` | 45134 | `deferred_tools`, `mcp_late_tool_additions`, `eager_input_streaming` | MCP tool annex surface; this runtime already discusses deferred tool additions |
| `chunk-pn44qc66.js` | 45078 | `link chain too long to vet`, `too_many_links`, `hard_link`, `link body climbs out of a directory it entered` | **in scope, disposed**: the link vetting on the settings and instruction handoff, ported as [W10](W10-include-link-vetting.md) (see below) |
| `chunk-5yngbcvk.js` | 44513 | `artifact_gallery`, `Rename artifact:` | artifacts panel, external |
| `chunk-2hgx41bq.js` | 44509 | `npm-global`, `homebrew`, `native_binary_missing` | auto-updater, product distribution |
| `chunk-xbv4ppt3.js` | 43780 | `SELF_HOSTED_RUNNER_HEALTH_PORT`, `PTY tunnel is not supported by the SCM connector` | self-hosted runner health surface, external |
| `chunk-y8r1wa4z.js` | 43116 | `ccr_cloud_plugins_forward`, `cloud-plugins-consent` | cloud plugin consent and forwarding, external |
| `chunk-qkjzdf0s.js` | 43089 | `Sign in with your Console account`, `Cloud gateway`, `Google Vertex AI` | login and gateway auth surfaces, excluded |
| `chunk-fknw5er0.js` | 43071 | `ERR_JWE_DECRYPTION_FAILED`, `Compact JWS must be a string or Uint8Array` | vendored jose, second copy |
| `chunk-y98nbw94.js` | 42918 | `SIGSTKFLT`, `MaxBufferError`, `Terminal window size changed` | vendored process and signal vocabulary |
| `chunk-hxew5k1.js` | 42604 | `Feature of the week:`, `agent-flag`, `chat:cycleMode` | feature tips and the command registry |
| `chunk-c8e2z911.js` | 42575 | `settings_quarantine`, `tampered`, `hard_linked`, `Staged change to` | settings change review and staging |
| `chunk-ba1ca3k4.js` | 42199 | `WORKING_ROOT_NOT_CANONICAL`, `a gitdir file with more than one name`, `BISECT_NAMES` | git worktree registration vetting; this runtime vets worktrees too |
| `chunk-xg3mnpt2.js` | 41785 | `blocked_by_git_proxy`, `SHR_GIT_PROXY_TOKEN`, `ensureRepository` | repository access validation behind a git proxy, external |
| `chunk-akag0p4e.js` | 41435 | `Remote settings: Using stale cache after error`, `If-None-Match` | hosted remote settings poll with an ETag and a stale-cache fallback, external |

The band is the most external of the five: eleven hosted or server-dependent surfaces (a cloud session's git environment, Remote Control, artifacts and their REPL, the control protocol, the self-hosted runner, cloud plugins, login and gateway auth, the git proxy, and remote settings), four recovered UI panels, two vendored libraries, two product distribution and compliance modules, one MCP tool annex, one settings-review surface, one worktree-registration vetting surface and two with local counterparts. One in-scope candidate was recorded, and naming it here was not port evidence.

`chunk-pn44qc66.js` (45,078 bytes) is the settings-and-instructions handoff to a cloud session - it decides which local settings, instruction and agent-memory files are safe to send. Its purpose is external, but the vetting it applies along the way is a rule set this runtime can use, because this runtime reads the same class of files locally: it resolves `@file.md` instruction imports in `src/config.ts` and pins what it read. The recovered rules are `link chain too long to vet` and `too_many_links` along `EMLINK`/`ENAMETOOLONG`, `link body is not valid UTF-8`, `link body climbs out of a directory it entered`, `hard_link`, `alias_unreadable`, `home_unvettable`, `outside_root`, `not_regular_file` and `symlink_not_sent`. Nothing in `src/config.ts` did any of this beyond de-duplicating by `realpath`: an import whose link chain left the directory the import walked into was read like any other, a link chain of any length was followed, and the body's encoding was not checked before it was treated as instructions. [W10](W10-include-link-vetting.md) ported the three text-level rules of that family onto the instruction loader - the 32-hop bound, the climbs-out refusal and the encoding check - and left the send-or-don't-send verdicts to the cloud handoff they belong to. On `On` [11287, ...) the bound is `Un=32` [11281, ...), the climbs-out predicate is `$n` [12206, ...), and the three messages are `link body is not valid UTF-8` [11462, ...), `link body climbs out of a directory it entered` [11603, ...) and `link chain too long to vet` [11808, ...).

## Slice six: uncited modules ranked 121 to 145

The same method on ranks 121-145 of the uncited list (962,864 bytes, 25 modules, 40,582 bytes down to 36,019), continuing directly below slice five's 41,435-byte boundary. No module in this band carries a marker, and none imports a sibling chunk by name.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-xveb52av.js` | 40582 | `${o} Bridge not connected`, `${o} No Chrome extension connected after discovery`, `${o} browser activity observer threw` | browser-extension bridge transport, external |
| `chunk-47j6nv0k.js` | 40575 | `← or → to set a limit`, `Wait for limit to reset`, `Upgrade to ${wi} for higher session limits every month` | recovered usage-limit dialog |
| `chunk-2kdsvp3x.js` | 40547 | `MCPB zip entry validation failed`, `Unsafe file path detected: `, `MAX_COMPRESSION_RATIO`, `stored entry size mismatch`, `entry larger than declared`, `invalid zip data` | MCPB bundle installer and its zip-slip, declared-size and ratio validation; this runtime has no bundle ingestion path, external |
| `chunk-manmfkhn.js` | 40386 | `Int64 buffers must be exactly 8 bytes`, `is too large (or, if negative, too small) to represent as an Int64` | vendored msgpack encoder |
| `chunk-n6kf5ep5.js` | 40082 | `JSON schema for tool `, `path ${...} is outside ${s}`, `${e}: permission denied`, `${e}: too many levels of symbolic links`, `.tmp-${process.pid}-${...randomUUID()}` | tool-host input-schema and filesystem-error layer; this runtime has its own confinement and error mapping |
| `chunk-qxx42xzq.js` | 39869 | `Use cowork_plugins directory`, `Manifest description`, `commander.invalidArgument` | plugin-manifest CLI surface, external |
| `chunk-yr905dsa.js` | 39860 | `CLAUDE_CODE_ARTIFACT_COMMENTS`, `accountUuid`, `produced in your user` | hosted artifact comment surface, external |
| `chunk-vaz3vkeb.js` | 39773 | `Successfully imported ${Ce} MCP ${...} to ${m} config.`, `Could not import ${It}: ${Dt}` | connector import into configuration, external |
| `chunk-phm7wwmz.js` | 39614 | `if(n.username!==`, `\|\|n.password!==`, `\|\|n.pathname!==`, `disabled by your organization` | URL-credential comparison behind an organization policy gate, external |
| `chunk-6ccen3s8.js` | 39412 | `app:toggleTodos`, `app:toggleTranscript`, `app:toggleBrief` | interactive action registry; this runtime has local counterparts |
| `chunk-z1vfv8xh.js` | 39291 | `sanitizeBridgeNotices: notice cap (${x}) reached; dropping entry`, `the only connected`, `deviceId` | Remote Control bridge notice handling, external |
| `chunk-0y0rpvta.js` | 39208 | `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`, `connector_${o.uuid.slice(0,8)}`, `claude.ai connectors could not be loaded in this Claude Code session` | base58 identifiers for cloud routines and connectors, external |
| `chunk-x0tzrjjr.js` | 38929 | `renders a local page file before you publish it `, ` browsers captured for an artifact`, `viewport widths in px, default 1280 and 390` | hosted page-publishing tool description, external |
| `chunk-m6jeqzgx.js` | 38217 | `Cleaned up old image cache: ${a}`, `cleanupPeriodDays` | image-cache cleanup task; this runtime reads images but keeps no cache to reap |
| `chunk-3qrn68kc.js` | 38021 | `\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\p{Mn}\p{Mc}\p{Nd}`, `s.frontmatter.some((b)=>b.includes(`, `hasFrontmatter` | Unicode-folded slug construction and frontmatter reading; this runtime does both in `src/config.ts` |
| `chunk-cnvr16zw.js` | 37806 | `commander.invalidArgument`, `Allowed choices are ${this.argChoices.join(`, `t._aliases[0]` | vendored commander |
| `chunk-b51chbpg.js` | 37300 | `set_model failed`, `The pending model switch was applied`, `set_model verdict rejected after the deadline reply` | control-protocol model switch, external |
| `chunk-nvmgz2d7.js` | 37149 | `data/users/<id>`, `(?!\.\.?(?:/\|$))[A-Za-z0-9_\-.~:@+]{1,200}` | hosted artifact-database path grammar, external |
| `chunk-yd8q3bwb.js` | 37079 | `refusal:`, `gh api ${c}/issues/<number>/comments -f body=`, `git clone https://github.com/<owner>/<repo>.git`, `Nothing to sign in to and no token to read` | hosted git credential brokering with the instructions it emits, external |
| `chunk-pnen8h1k.js` | 37078 | `anthropic/toolHostPermissionDecision`, `relativePattern`, `\*\s*$` | permission-rule glob compiler for the tool host; this runtime has its own matcher from W01-permission-readings |
| `chunk-4qd8fxx1.js` | 37001 | `Ultrareview runs in a cloud session and is unavailable on third-party providers.`, `fetchUltrareviewPreflight schema mismatch` | hosted review feature, external |
| `chunk-qw7tf8gj.js` | 36573 | `Removed remote-control server for ${t.dir}.`, `Stop serving ${p} to claude.ai.`, `Each session gets its own git worktree (requires a git repo).` | Remote Control server management; the worktree half has a local counterpart |
| `chunk-ts42ykgs.js` | 36263 | `latinLetterConfusableClass: expected one ASCII lowercase letter`, `lookalikePattern`, `invisiblePattern` | vendored Unicode confusable and invisible-character tables |
| `chunk-bt8cr7rw.js` | 36230 | `ancestry walk failed`, `ancestry walk truncated (maxDepth) above the prefix`, `readAncestors`, `readStartToken`, `[uds-messaging] Dropping ${kg(e.type)} message: session_id mismatch` | unix-domain peer messaging that verifies the caller's launch ancestry; this runtime has no such peer surface, external |
| `chunk-f8vrg6p1.js` | 36019 | `callPlumbing: not a plumbing tool`, `the session stream is closed; nothing was sent`, `the answer was not a tool result`, `structuredContent` | control-protocol plumbing tool; this runtime has its own tool plumbing |

The band is the control-protocol and product-UI band: fifteen hosted or server-dependent surfaces (the browser-extension bridge, the MCPB installer, the plugin CLI, artifact comments, connector import, URL-credential policy, Remote Control notices, cloud routines, page publishing, the model switch, the artifact database, git credential brokering, Ultrareview, Remote Control servers and unix-domain peer messaging), three vendored libraries (msgpack, commander, the confusable tables), one recovered UI dialog, five modules with local counterparts (the tool-host schema and error layer, the interactive action registry, the image cache, the slug and frontmatter helpers, and the permission glob compiler) and one module that reads images without keeping a cache. No in-scope candidate is recorded: the two rule sets worth reusing here - the MCPB entry validation and the unix-domain ancestry verification - both guard surfaces this runtime does not expose, so porting either would mean building the surface first.



## Slice seven: uncited modules ranked 146 to 170

The same method on ranks 146-170 of the uncited list (845,223 bytes, 25 modules, 36,014 bytes down to 31,722), continuing directly below slice six's 36,019-byte boundary. None imports a sibling chunk by name except through the build banner; one carries the `self-hosted release surface` and `API beta headers` markers.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-4jd48rch.js` | 36014 | `${e} — the teammate is not started unwrapped; fix the launcher setting, then retry`, `--permission-mode acceptEdits`, `CLAUDE_CODE_USE_BEDROCK` | teammate launcher and permission modes; this runtime has agent types and permission modes |
| `chunk-patq2z05.js` | 35866 | `adopt path is remote UNC: ${r}`, `adopt path is on an automount host (or map) none of the allowed roots live on: ${r}`, `unreadableAncestry` | the ancestry-aware path resolver, and the module W09's unported `launchAncestry`/`unreadableAncestry` switches come from; this runtime has no launch context to adopt a path into |
| `chunk-gmp2yk41.js` | 35848 | ` pings the user to come back; everything else doesn`, ` is an annoying interruption for nothing. A false `, `no change needed` | recovered notification-copy rules for when an answer is worth an interruption |
| `chunk-dv12nbsn.js` | 35326 | `The action to perform.`, `For screenshot/zoom only. `, `scroll_direction`, `normalized_0_100` | browser-control tool schema, external |
| `chunk-8wcxq6fk.js` | 35275 | `linkResolves===!0`, `Select a project to purge:`, `current directory` | project-purge CLI with a link-resolution check, recovered CLI surface |
| `chunk-h20sc871.js` | 34814 | `IniSectionType`, `e[e.TRAILER=1]=`, `this.hostname=e.hostname\|\|` | vendored INI and field-position parser |
| `chunk-va9jsxer.js` | 34732 | `${p}/v1/code/sessions/${a}/move-to-cloud`, `X-Trusted-Device-Token`, `The move may still have gone through — check the session in the web UI.` | moving a session to the cloud, external |
| `chunk-5wc3wh5m.js` | 34626 | `SJ=49152`, `invalid poll event kind: ${JSON.stringify(e)}`, `new Map([[R0n,new Set([` | poll-event validation keyed by kind constants; this runtime has its own watcher and list-changed refetch |
| `chunk-nj10dvab.js` | 34570 | `Sandbox is not enabled`, `Excluded Commands:`, `Filesystem Read Restrictions:` | sandbox-policy panel; this runtime states its own permission and confinement rules |
| `chunk-54hpyawv.js` | 34292 | `session serving: re-encoding a served image to fit the channel failed: ${l(C)}`, `session serving: served image(s) re-encoded, answer now ${r} bytes (limit ${o})` | the served-image re-encoding W05-image-limits recorded as having no recovered algorithm; this runtime re-encodes through its own media path |
| `chunk-f5wjy38g.js` | 34099 | `ge({model:n,effort:r})`, `Kept effort level as ${...}` | interactive model and effort selection; this runtime configures both |
| `chunk-kvz2ymff.js` | 34058 | `bun run generate:model-catalog`, `claude-3-5-haiku@20241022`, `VERTEX_REGION_CLAUDE_3_5_HAIKU`, `knowledge_cutoff` | generated provider model catalog; this runtime takes arbitrary configured model IDs instead |
| `chunk-sq2jx6rf.js` | 33891 | `DE(n).filter((u)=>u.file===r&&u.severity!==`, `ye(r)===UE.cowork` | editor-diagnostics aggregation; this runtime has its own `lsp` surface |
| `chunk-xewmfw4d.js` | 33678 | no literal of eight characters or more in 33,064 characters of body | a pure code leaf; the pass records it as undetermined rather than guessing |
| `chunk-76jkr621.js` | 33418 | `Kept effort level as ${...}`, `Higher effort levels are capped by your settings or organization.`, `autoAccept-shimmer` | effort settings and their organization cap, recovered UI |
| `chunk-y9e5d83w.js` | 33327 | markers `self-hosted release surface`, `API beta headers`; `set-mode-${He()}`, `branchDropped`, `revisionGuessUsed` | self-hosted runner release surface, external |
| `chunk-p6h5vgkx.js` | 33098 | `Detecting open PR for current branch…`, `Spawning cloud autofix session…`, `has_repo_ref` | cloud autofix session, external |
| `chunk-x58yzpqb.js` | 32824 | `resolve as Ne,sep as _e`, `endsWith(` with trailing separator trimming | path-separator utility helpers; this runtime has its own |
| `chunk-s9zkj3fw.js` | 32658 | `relative as ve,sep as Te`, `!i.startsWith(` with `isAbsolute` | relative-path containment helper; this runtime confines with its own checks |
| `chunk-f6kq81eq.js` | 32646 | `this cloud session runs unattended (claude -p --cloud): there is no one to ask`, `decision_reason`, `behavior:` | unattended cloud permission responder, external |
| `chunk-ntwjhb8m.js` | 32497 | `oe=65536,ie=262144,se=524288`, `{ok:!0,decision:{action:`, `extname` | file-size thresholds and a decision object; this runtime bounds reads and outputs itself |
| `chunk-15zz59jx.js` | 32104 | `{mode:n},null,2)`, `private:!0`, `process.argv[1]` | writer for a private per-user configuration file, excluded as credential-adjacent |
| `chunk-hkrgn8hf.js` | 32018 | ` loaded in the cloud session`, `/reload-skills re-scans its skill folders`, `The cloud session hasn` | skills panel; this runtime has its own skill loading |
| `chunk-qw2csqy5.js` | 31822 | `observer:${_.observerAgentType}`, `[${_.observedTaskId}]`, `reportOrigins` | task-observer reporting; this runtime has its own background task surfaces |
| `chunk-p0tt9vq1.js` | 31722 | `Http2ServerRequest`, `abortControllerKey`, `typeof r?.body?.getReader<` | HTTP request and abort plumbing; this runtime has its own HTTP path |

The band splits between product UI and the SDK's own plumbing: six hosted or server-dependent surfaces (the browser-control tool, moving a session to the cloud, the self-hosted release surface, cloud autofix, the unattended cloud responder, and a private config writer excluded as credential-adjacent), thirteen modules whose surfaces this runtime already owns (the teammate launcher, poll-event validation, the sandbox panel, served-image re-encoding, model and effort selection, diagnostics, effort caps, two path helpers, read-size thresholds, the skills panel, task observers and HTTP plumbing), two recovered CLI and copy surfaces, one vendored INI parser, one generated model catalog, one pure code leaf that no literal can characterise, and one module worth naming for a different reason: `chunk-patq2z05.js` is the ancestry-aware path resolver, which is where the `launchAncestry` and `unreadableAncestry` options W09 deliberately did not port come from. No candidate is recorded; the resolver needs a launch context this runtime does not have, and everything else either already exists here or belongs to a hosted surface.



## Slice eight: uncited modules ranked 171 to 195

The same method on ranks 171-195 of the uncited list (735,478 bytes, 25 modules, 31,115 bytes down to 28,168), continuing directly below slice seven's 31,722-byte boundary. One module carries the `self-hosted release surface` marker.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-5d7rhstd.js` | 31115 | `Context is ${a.percentage}% full`, `Autocompact is disabled. Use /compact to free space`, `Read results using ${i} tokens` | context and compaction accounting; this runtime reports its own |
| `chunk-0n0tsw9p.js` | 30742 | `Mermaid diagrams in the terminal: flowcharts and sequence diagrams in a reply`, code-point width folding | terminal diagram rendering and width handling |
| `chunk-8v4zf78h.js` | 30559 | `Remote Control is already connected — a session`, `Run /remote-control from an interactive Claude Code session.` | Remote Control UI, external |
| `chunk-0q677art.js` | 30378 | `anthropic.omelette.api.v1alpha.OmeletteService`, `PROJECT_TYPE_DESIGN_SYSTEM` | design-system service client, external |
| `chunk-qajs04tk.js` | 30101 | `Decompose question (from args) into 5 search angles`, `5 parallel WebSearch agents, one per angle`, `3-vote adversarial verification per claim (need 2/3 refutes to kill)` | a recovered bundled research workflow: content rather than mechanism, and this runtime's workflow surface is its own |
| `chunk-vmvk1y2n.js` | 29999 | `ttlExpiresAt`, `transportFingerprint`, `; the result arrives as a task notification.` | MCP call transport with a TTL; this runtime has its own task transport |
| `chunk-y1y19xyr.js` | 29993 | hook-dense state pairs around a list, no user-visible literal | recovered UI panel |
| `chunk-mx3sfnyd.js` | 29859 | `AWS_EXECUTION_ENV`, `AZURE_FUNCTIONS_ENVIRONMENT`, `CLAUDE_CODE_CONTAINER_ID`, `CLAUDE_AGENT_SDK_VERSION` | execution-environment detection table; this runtime detects its own |
| `chunk-8tf84az4.js` | 29841 | `CLAUDE_CODE_ARTIFACT_ASSETS`, `we=2097152`, an extension-to-MIME map | asset MIME table for the hosted artifact surface, external |
| `chunk-a49msw72.js` | 29755 | `syncedFileRequestSigner: the content hash is not 32 bytes`, `the size is not a byte count`, `NUL in a signed field` | signing and validating synced-file requests; this runtime has no sync surface, external |
| `chunk-qskwh3r4.js` | 29512 | in-flight state with `preventDefault` on key and paste events | recovered input panel |
| `chunk-1r9zp6s1.js` | 29468 | `[render] first ink render: ${...}ms since process start`, `CURSOR_TRACE_ID`, `switch(a.TERM_PROGRAM)` | terminal capability detection and first-render timing; this runtime has its own terminal path |
| `chunk-ne45hawt.js` | 29456 | `your ask-user tool (if available)`, `d=60000`, an input schema for user questions | ask-the-user tool contract; this runtime has its own interaction and permission prompts |
| `chunk-k86tbrty.js` | 29325 | `[deviceBridge] open connection failed: ${G(e).message}`, `handleAuthenticated`, `this.endRotation()` | paired-device bridge protocol with key rotation, external |
| `chunk-bq1yzzg9.js` | 29307 | `Tn=10,St=Tn*60000`, `gt=4`, `wt=5,ht=1440`, `s.ageMs<D` | cache age thresholds in minutes; this runtime keeps its own |
| `chunk-9vcaezw1.js` | 29106 | `isAutoModeAvailable`, `isBypassPermissionsModeAvailable`, `bypassPermissions` | permission-mode availability; this runtime decides its own modes |
| `chunk-g135h42d.js` | 28977 | `{eligible:!1,ineligibleReason:`, `hostVerdict`, `a.CLAUDE_CODE_ENTRYPOINT` | feature eligibility gating by entrypoint, external |
| `chunk-yttags1e.js` | 28904 | markers `self-hosted release surface`; `self_hosted_runner_read_health`, `self_hosted_runner_tail_log` | self-hosted runner CLI surface, external |
| `chunk-wksmhr3a.js` | 28862 | `/^[0-9a-f]{40}$/`, `/^https:\/\/(?!-)[A-Za-z0-9._-]+\/[^\s\\?#%]+$/`, `e===e.normalize(`, `ve=255` | git remote and revision validation rules for a hosted flow |
| `chunk-8tta3x8h.js` | 28564 | `posix as W,win32 as O`, `if(A(e)===6)return!0`, drive-relative prefix handling | Windows-shaped path classification, the family W09's `kzn` rules come from |
| `chunk-s7xk43sw.js` | 28535 | `MCP identity-change handler failed: ${l(n)}`, `baseline:rearmed` | MCP identity-change handling; this runtime has its own MCP paths |
| `chunk-6wc4rtdz.js` | 28462 | a scanner loop that tracks quotes and escapes and stops on a terminator | string and escape scanner utility; this runtime has its own |
| `chunk-f7x3yeg4.js` | 28253 | `thought for ${Math.max(1,Math.round(l/1000))}s`, `picking the thought back up (${l} of ${t})`, `outputLimitRecovery` | thinking-status UI with output-limit recovery; this runtime reports its own status |
| `chunk-dgraa013.js` | 28237 | `[bridge:server-config] sdk-host lane sessionId=${...} appendPrompt=${...} denyRules=${...}` | SDK-host bridge server configuration, external |
| `chunk-942xgmkh.js` | 28168 | `Do you wish to enable auto-connect to IDE?`, `Visual Studio Code`, `--ide flag` | IDE auto-connect prompt, recovered UI |

The band is mostly this runtime's own subject matter seen from the inside: thirteen modules whose surfaces already exist here (context accounting, MCP call transport, environment detection, terminal capability detection, the ask-the-user contract, cache thresholds, permission modes, Windows-shaped path classification, MCP identity changes, a string scanner, thinking status, a bundled research workflow, and hosted git-URL validation), three recovered UI panels, two rendering and data tables (the terminal diagram renderer and the asset MIME map) and seven hosted or server-dependent surfaces (Remote Control, the design-system service, synced-file request signing, the device bridge, feature eligibility gating, the self-hosted runner and the SDK-host bridge). No candidate is recorded. Two modules are worth naming as pointers rather than as work: `chunk-qajs04tk.js` is a bundled research workflow, which shows what the recovered workflow surface was used for rather than how it works, and `chunk-8tta3x8h.js` is another member of the Windows path-classification family whose `kzn` rules W09 declined to port because this host makes them unreachable.



## Slice nine: uncited modules ranked 196 to 220

The same method on ranks 196-220 of the uncited list (660,212 bytes, 25 modules, 28,085 bytes down to 24,699), continuing directly below slice eight's 28,168-byte boundary. No module in the band carries a marker.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-3s80jwa7.js` | 28085 | `clearer than terminal text`, `exists only in terminal scrollback or in a local file`, `gives the answer in its reply` | notification-tool description; this runtime has its own notification contract |
| `chunk-hxw7kxga.js` | 28002 | `[uds-messaging] Late bind refused: ${b.message}`, `[uds-messaging] Late bind: gate enabled by a GrowthBook refresh after startup` | unix-domain messaging with a remote-flag gate, external |
| `chunk-jyz6k6q0.js` | 27909 | `if(e.liveEditOn)s.push(`, `if(e.readPageDataOpen)s.push(`, `if(e.roomOn)s.push(` | browser and IDE capability flags, external |
| `chunk-qamzqcr8.js` | 27879 | `Now in a new directory:`, `Moving to a new directory:`, `This directory is part of the repository at` | directory-change flow; this runtime tracks its own working directory |
| `chunk-1yrqse38.js` | 27787 | dynamic imports of `InvalidSettingsDialog`, `TeleportResumeWrapper`, `TeleportRepoMismatchDialog`, `DeviceReenrollDialog`, `DeviceMcpConsentDialog` | dialog registry for session teleport and device enrollment, external |
| `chunk-xk0w67h7.js` | 27549 | `add <name> <commandOrUrl> [args...]`, `Transport type (stdio, sse, http). Defaults to stdio`, `-s, --scope <scope>` | MCP server CLI help; this runtime configures MCP servers itself |
| `chunk-xv9wnb67.js` | 27437 | `${r.ruleValue.toolName}(*)`, `ruleDisplay:n.ruleContent?` | permission-rule display formatting; this runtime renders its own rules |
| `chunk-f9e2awqy.js` | 27139 | `lstat as lr,mkdtemp as Ge,rm as je,symlink as cr`, `getSystemErrorName as ye`, an error class carrying `code` | temp-directory and symlink helper over system error names; this runtime has its own test and path helpers |
| `chunk-hwtkjv40.js` | 26998 | `Claude Code refuses the marketplace name `, `: it looks like one of Anthropic`, `var M=64` | refusal of an impersonating marketplace name; this runtime has no marketplace to name |
| `chunk-rxs7brs0.js` | 26991 | `${D}${R} changed the tools ${u?`, `; not offered to cloud sessions until re-approved`, `(claude --cloud asks at the next start)` | tool-approval change tracking; this runtime re-asks on its own terms |
| `chunk-671pa9nx.js` | 26983 | `${u.BASE_API_URL}/api/hello`, `${p.origin}/v1/oauth/hello`, `Failed to connect to ${x}: Status ${l.status}` | connectivity probe with proxy detection, external |
| `chunk-agyp1qjr.js` | 26913 | `[asciicast] Renamed recording: ${w} → ${P}`, `${K()}-${o.timestamp}.cast` | terminal recording file management, recovered CLI surface |
| `chunk-xyw7f4bh.js` | 26741 | `[brief:upload] could not scale an oversize image, sending it unscaled: ${h}` | image scaling for a hosted brief upload, external |
| `chunk-c27qma24.js` | 25925 | `&(?!(?:#\d{1,7}\|#[Xx][0-9a-fA-F]{1,6}\|\w+);)`, `<input (?:checked=`, `<pre>${i(s)}</pre>` | vendored Markdown and HTML renderer |
| `chunk-tcgffd8k.js` | 25846 | `auth setup failed: ${l(u)}`, reason and message envelope handling | credential setup flow, external |
| `chunk-3f62mcb0.js` | 25786 | `zO().workspace===`, `process.stdout.write(W)` | workspace-scoped command runner; this runtime runs its own |
| `chunk-mtw0aefh.js` | 25661 | `Dynamic workflows dialog dismissed`, `storageV5` | workflow dialog; this runtime has its own workflow surface |
| `chunk-zn2yy8vq.js` | 25578 | `entries and the note are the coordinator session’s words, not a member’s.`, `^(?:<relay${Q}>\|</relay>\|...)`, `/[\p{Cc}  ]/u` | coordinator and member relay message format with its escaping rules; this runtime's teammate messaging is its own |
| `chunk-nrvtz9yb.js` | 25468 | `claude-in-chrome select_browser failed: ${G(L).message}`, `Now using browser ` | browser automation surface, external |
| `chunk-w5p3z8nt.js` | 25092 | `Could not resolve the user settings file path.`, `c.autoMode` | user-settings resolution; this runtime resolves its own |
| `chunk-zq3khf86.js` | 24994 | `Run ultrareview in the cloud?`, `Est. cost ${Dye()} USD`, `one plain comment, not a review or an approval` | cloud review feature, external |
| `chunk-0f9aea7y.js` | 24978 | `V=/^[A-Za-z0-9_-]{1,128}$/`, a per-provider model-name normalisation switch | provider model-id mapping; this runtime takes configured model IDs literally |
| `chunk-4f4t2ys6.js` | 24914 | a `gh` invocation with `timeout:5000,reject:!1`, `/^x-oauth-scopes:[ \t]*(.*)$/im` | probing a hosted token's scopes through the `gh` CLI, external |
| `chunk-0r179cga.js` | 24858 | `/api/oauth/organizations/:orgUUID/plugins/search`, `PluginSkillSearchUnavailableError` | hosted organization plugin and skill search, excluded with OAuth |
| `chunk-3nb8mv1p.js` | 24699 | `Secret access key`, `Only needed for temporary credentials from STS`, `Set up AWS Bedrock` | vendor credential setup for a hosted provider, excluded |

The band is the permission, plugin and session-lifecycle band: eleven hosted, vendor or server-dependent surfaces (unix-domain late binding, browser and IDE capability flags, the teleport and device-enrollment dialog registry, the connectivity probe, brief image scaling, credential setup, browser automation, cloud review, the `gh` scope probe, organization plugin search and Bedrock credential setup), eleven modules whose surfaces this runtime already owns (the notification contract, directory tracking, MCP configuration, permission-rule rendering, a temp and symlink helper, tool-approval change tracking, workspace command running, the workflow dialog, coordinator-and-member relay formatting, settings resolution and provider model-id mapping), one vendored Markdown and HTML renderer and two recovered product surfaces with no local counterpart (a marketplace-name impersonation refusal and asciicast recording management). No candidate is recorded: the impersonation refusal is the only rule in the band that would be worth reusing, and this runtime has no marketplace whose name could impersonate anything.



## Slice ten: uncited modules ranked 221 to 245

The same method on ranks 221-245 of the uncited list (594,435 bytes, 25 modules, 24,699 bytes down to 23,207), continuing directly below slice nine's 24,699-byte boundary. One module carries the `API beta headers` marker; two carry no literal of sixteen characters or more at all.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-9mazb6vn.js` | 24699 | `[memdir] left ${_(o)} out of the background ${n.source} pass`, `mtime only, content identical`, `${o} blocks those writes` | memory-directory scanning with write-rule blocking; this runtime has its own memory store |
| `chunk-2mchjty4.js` | 24640 | `Paste code here if prompted > `, a copy-and-reset interaction state | recovered code-paste UI |
| `chunk-r0bvamsj.js` | 24631 | `Xe=409,Ge=64,Ve=300000,qe=32,Ke=60000`, `[bridge:inbound-attach] ${e}`, `no_token` | bridge inbound attach with its limits, external |
| `chunk-8sdnf51c.js` | 24580 | `(?=[\\p{L}\\p{N}])(?:\\p{Default_Ignorable_Code_Point}\|${I})`, `s scratch folder` | invisible-character stripping for identifiers, the confusable-table family |
| `chunk-m3ncpg7j.js` | 24397 | `createWriteStream`, `mkdtemp`, `pipeline`, an extension test before writing | download and atomic-write helper; this runtime writes its own |
| `chunk-1eegq95r.js` | 24199 | `s done. Skip this if you`, `where N ≤ 59 \| ` | recovered prompt text with a numeric bound |
| `chunk-kwdhpnes.js` | 24194 | `the teammate mailbox (a static-description wire)`, `onRefuse(l)`, `onUnboundVerdict()` | teammate mailbox wire; this runtime's teammate messaging is its own |
| `chunk-nca5bd28.js` | 24150 | `execFile`, `createInterface`, `constants`, `createWriteStream` | subprocess and stream helper for a CLI flow |
| `chunk-4pz6r9ta.js` | 23885 | `e.logCode`, `{ok:!1,code:`, `reason:e.message,usage:n` | credential-login runner with usage reporting, excluded with authentication |
| `chunk-kezhcy3j.js` | 23807 | no literal of sixteen characters or more | pure code leaf; recorded as undetermined |
| `chunk-6gw241sa.js` | 23691 | `Workers have access to MCP tools from these connected MCP servers: `, ` via your comms tool`, `Use the /<name> skill` | recovered worker prompt |
| `chunk-xjzm13h1.js` | 23675 | `${r.name}\x00${y.serverName}`, `cached (connects on first use)`, `needs authentication`, `pending approval`, `ee=2500` | MCP client status labels; this runtime reports its own |
| `chunk-11cg1zv8.js` | 23553 | list items built from `R.prompt` with `meta:[R.human,R.id]`, and from `R.condition` | recovered rule and prompt list UI |
| `chunk-1azky4vr.js` | 23518 | `/^chunk-[0-9a-z]+\.js$/`, `homedir`, `sep` | sibling-chunk path helper for the bundled layout |
| `chunk-0wtqg4zf.js` | 23417 | Ink row rendering with `inverse:H&&B` and joined children | recovered table row component |
| `chunk-27et44g8.js` | 23417 | `a.CLAUDE_CODE_ENVIRONMENT_KIND`, `normalize`, `relative`, `isAbsolute` | environment-kind and path configuration; this runtime resolves its own |
| `chunk-nrf25fpr.js` | 23405 | markers `API beta headers`; `typeof window`, `typeof Deno`, `EdgeRuntime` | runtime-environment detection; this runtime detects its own |
| `chunk-2djwkyet.js` | 23395 | `EventEmitter`, `readdir`, `realpath`, `Readable` | file watcher; this runtime has its own watcher |
| `chunk-6zdc3jq1.js` | 23365 | `[daemon] peer uid lookup failed`, `[daemon] rejecting control connection: ${d}`, `Bun.ant.getPeerPid` | daemon peer-uid check on the control socket; this runtime has no daemon |
| `chunk-2fdh01xj.js` | 23351 | no literal of sixteen characters or more | pure code leaf; recorded as undetermined |
| `chunk-x3k1646w.js` | 23346 | markdown lexer state (`inLink`, `inRawBlock`, `declining`, `taken`) | vendored Markdown lexer |
| `chunk-1h8sm2jz.js` | 23337 | `G.loadedFrom`, `G.allowedTools?.some(Jo)`, `Do.startsWith(Be+` | tool source and allowed-tools filtering; this runtime filters its own |
| `chunk-ae84tp6z.js` | 23305 | `global.Object===Object`, `[object Function]`, `[object GeneratorFunction]` | vendored type-inspection utilities |
| `chunk-kvhk43b5.js` | 23271 | a regex built then applied in a replace loop over a filtered list | text-transformation helper |
| `chunk-tjq92q8j.js` | 23207 | `No items imported.`, `✓ ${o0(Ue)}`, ` - skipped ${o0(Ue.skipped)}` | import summary UI |

The band is thin on new ground: ten modules whose surfaces this runtime already owns (the memory directory, a download writer, teammate messaging, a subprocess helper, MCP status labels, environment and path configuration, runtime detection, a file watcher, tool-source filtering and a text transform), three vendored or utility modules (an invisible-character stripper, a Markdown lexer and type-inspection helpers), four recovered UI components, two prompt texts, two modules with no local counterpart (a sibling-chunk path helper for the bundled layout and a daemon peer-uid check), two excluded with authentication, and two pure code leaves that no literal can characterise. No candidate is recorded.

## Slice eleven: uncited modules ranked 246 to 270

The same method on ranks 246-270 of the uncited list (556,327 bytes, 25 modules, 23,195 bytes down to 21,646), continuing directly below slice ten's 23,207-byte boundary. Three modules carry no literal of sixteen characters or more.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-rwhxe5qy.js` | 23195 | `createInterface`, a stderr write followed by `process.exit(1)` | CLI subcommand runner that exits on error; this runtime runs its own |
| `chunk-c6qwr3kc.js` | 23134 | `process.env.GRACEFUL_FS_PLATFORM`, read and rename patches, a `Date.now()-w<60000` retry, `process.getuid()!==0` | vendored graceful-fs |
| `chunk-07jnjfgd.js` | 23059 | `this session holds no gateway credential`, `Not authenticated — run /login (${e})`, `/^[a-z][a-z_-]{0,31}$/` | session credential state with a name pattern, excluded with authentication |
| `chunk-c283tj3z.js` | 23030 | `{...Bt,copyFullResponse:!0}`, list items labelled by `ee.text` with a language meta | recovered message list UI |
| `chunk-x0d85p85.js` | 22957 | `Select remote environment`, `Configure environments at: https://claude.ai/code`, `Failed to fetch remote environments` | hosted remote environments, external |
| `chunk-b0f4exdv.js` | 22856 | `Add funds to continue with usage credits`, `Your Claude Code trial has ended.` | billing and trial UI, external |
| `chunk-k40xsyrk.js` | 22746 | `Session resumed successfully` | resume confirmation; this runtime resumes its own sessions |
| `chunk-sn9mqsg8.js` | 22722 | `discard and exit`, `Catch you later!`, key handling with `preventDefault` | interactive exit flow; this runtime has its own |
| `chunk-17g9rbbr.js` | 22428 | `Failed to record update result: ${i.error.code}`, `atomicWrite(S(),_(e))`, a stateless read with `items[0].found` | update-state file for the auto-updater, a product surface this runtime does not have |
| `chunk-jtkaqz88.js` | 22264 | `Reflect.get(r,`, a split-then-join parse over a default | generic value helper |
| `chunk-zs5kb20m.js` | 22130 | `includeCoAuthoredBy`, `includeGitInstructions`, `alwaysThinkingEnabled`, `showThinkingSummaries`, `home pack files exceed the caps` | settings field names and caps; this runtime owns its own settings |
| `chunk-bdxkbhka.js` | 22106 | no literal of sixteen characters or more | pure code leaf; recorded as undetermined |
| `chunk-hb620t8k.js` | 22036 | `secureStorage.READ_FAILED`, `[secureStorage] write lock compromised: ${l(o)}` | secure credential storage with a write lock, excluded with authentication |
| `chunk-1xxbhxjg.js` | 21973 | a lowercase membership test against two lists, `Run /config to open settings.` | settings validation and its guidance; this runtime validates its own |
| `chunk-xbf8bx5h.js` | 21910 | `f.entryPath` joined and parsed, a stat check before reading | plugin and skill entry-path resolution; this runtime resolves its own |
| `chunk-62rej6c1.js` | 21887 | `orchestrate this with subagents`, `export const meta = {...}`, `(shown in the permission dialog)` | the recovered workflow-authoring guidance, prompt text rather than mechanism |
| `chunk-mxnah6m6.js` | 21878 | no literal of sixteen characters or more | pure code leaf; recorded as undetermined |
| `chunk-zsg1bb14.js` | 21877 | a trimmed user message parsed into a request, with a null result on failure | message-to-request preprocessing; this runtime builds its own |
| `chunk-dy7th9we.js` | 21826 | no literal of sixteen characters or more | pure code leaf; recorded as undetermined |
| `chunk-5b0cs9fj.js` | 21817 | `if(!process.env.SRT_DEBUG)return`, a level from the caller, `console.error` | debug-scoped logger; this runtime logs its own |
| `chunk-8qac8gbd.js` | 21754 | `{...e,rendered:o}`, `renderedInHumanTurn:o`, `isDeepStrictEqual` | attachment rendering; this runtime renders its own |
| `chunk-s698q0h2.js` | 21736 | `https://clau.de/desktop`, `https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect`, `Cancelled. Learn more about Claude Desktop at` | desktop-app download surface, external |
| `chunk-qfjvvwpv.js` | 21713 | dispatch on `t.id.startsWith(` prefixes | id-prefix dispatch; this runtime routes its own |
| `chunk-j0bpp8q1.js` | 21647 | `Successfully loaded skill`, `o.allowedTools.length>0`, `Initializing…` | skill-loading UI with an allowed-tools note; this runtime loads its own skills |
| `chunk-bncpe25p.js` | 21646 | `smithy.api#noAuth`, `AssumeRoleWithWebIdentity`, `resolveClientEndpointParameters` | vendored AWS SDK STS client, excluded with the vendor surface |

The band is mostly plumbing and copies of things this runtime already does: thirteen modules whose surfaces exist here (a CLI runner, resume, the interactive exit flow, settings fields, settings validation, plugin entry paths, message preprocessing, a debug logger, attachment rendering, id routing, skill loading, a value helper and the message list), two vendored libraries (graceful-fs and the AWS SDK's STS client), three hosted or vendor surfaces (remote environments, billing and the desktop download), two excluded with authentication (session credential state and secure storage), two product surfaces with no local counterpart (the auto-updater's state file and the recovered workflow-authoring guidance, which is prompt text), and three pure code leaves. No candidate is recorded.

## Slice twelve: uncited modules ranked 271 to 320

The first 50-rank band, on ranks 271-320 of the uncited list (1,045,813 bytes, 50 modules, 21,613 bytes down to 19,670), continuing directly below slice eleven's 21,646-byte boundary. Eleven modules carry no literal of eighteen characters or more at all. One carries the `API beta headers` marker.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-zrpr5yy3.js` | 21613 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-taw1b2r3.js` | 21588 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-0smqs8xk.js` | 21587 | `(yours; a co-writer has also published to it)`, `classifierApprovable:!1` | hosted artifact type classification, external |
| `chunk-wxvzwbcc.js` | 21560 | `{type:`, `,message:e.error===` error envelopes | error envelope helper; this runtime builds its own |
| `chunk-btm6fnmr.js` | 21526 | `schemeId:`, `,signingProperties:{name:` | vendored AWS SDK auth scheme provider |
| `chunk-68wmv4pr.js` | 21513 | a backslash-and-slash escape scanner (`case 92`, `case 47`) | string unescaping helper |
| `chunk-1mhryrpw.js` | 21505 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-3hxxhbqz.js` | 21494 | `C=15000,R=20000,k=16,E=4,w=300`, `e.up_to`, `e.wait_ms` | upload chunking limits and wait policy |
| `chunk-xa4hnq1w.js` | 21493 | `voice_transcription_connection_failed_`, `Voice connection failed. Check your network and try again.`, `No speech detected.` | voice transcription surface, no local counterpart |
| `chunk-ymjpkd6r.js` | 21493 | `dynamicAnchors`, `validateName`, `dynamicRef` | vendored ajv |
| `chunk-2hqes6ca.js` | 21462 | `${t} moved → ${a[t]} in /config` | config-move notice; this runtime reports its own |
| `chunk-zekxzqvp.js` | 21449 | `PassthroughMcpUnavailableError`, `[deviceBridge] passthrough MCP tools refresh failed` | device-bridge passthrough MCP, external |
| `chunk-mhjxre6z.js` | 21427 | `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_SESSION_ACCESS_TOKEN` | OAuth and session token handling, excluded |
| `chunk-6bm5hdvf.js` | 21419 | `{onComplete:s,args:` dialog wiring | recovered dialog component |
| `chunk-apk44smy.js` | 21418 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-gwkz5ew2.js` | 21412 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-yehhb8pt.js` | 21389 | `to learn the features most people miss.` | recovered tips panel |
| `chunk-grfsmtwy.js` | 21376 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-ghr0kcfz.js` | 21370 | `~/.local/bin/claude` install path | native installer path, distribution surface |
| `chunk-5dxmnnh1.js` | 21343 | `JetBrains-JediTerm`, `WT_SESSION`, `TERM_PROGRAM` | terminal emulator detection; this runtime detects its own |
| `chunk-g9hh4c1d.js` | 21328 | `would stay on this machine (you are told which, and why, when a session` | plugin stay-local messaging; this runtime has its own plugin trust path |
| `chunk-p16hdq43.js` | 21310 | plugin handle and key validation before use | plugin handle resolution; this runtime resolves its own |
| `chunk-498z460n.js` | 21281 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-czadvbm5.js` | 21220 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-er09v3xa.js` | 21019 | memo-dense render body with no user-visible literal | recovered UI component |
| `chunk-ja4p43ty.js` | 21013 | `${Math.floor(e/1024)}KB`, a digest sliced to twelve characters | size and short-hash helper |
| `chunk-ywt9ek0j.js` | 20887 | `an answer larger than the cap`, `unrecognised HTTP ${c.status}`, `switch(e.operation)` | MCP operation error mapping; this runtime maps its own |
| `chunk-f0442373.js` | 20880 | `m.O_NOFOLLOW??0`, `yt=8388608`, `NTt=5368709120`, `n.outputDir` | output directory and size caps opened without following links; this runtime bounds its own reads and outputs |
| `chunk-0n5v455r.js` | 20864 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-f4gn159f.js` | 20812 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-n2jtmdcb.js` | 20759 | `Remote Control and Cloud sessions`, `No organization policy allows sends to this kind of session` | organization policy gating of sends, external |
| `chunk-7p8tck75.js` | 20777 | `Application Default Credentials (gcloud auth)`, `Service account key file` | vendor credential setup, excluded |
| `chunk-ftwnrj7c.js` | 20625 | `{trusted:!1,reason:`, `there once to accept the trust dialog` | directory trust dialog; this runtime asks its own way |
| `chunk-g55a060z.js` | 20596 | `claude plugin install <plugin> --marketplace <source>` | plugin install CLI; this runtime installs plugins from a source directly |
| `chunk-z1h9082m.js` | 20590 | `ListProjectCommands`, `commands_DEPRECATED` | IDE command listing surface |
| `chunk-gs2kyzqb.js` | 20578 | root check then dispatch on a resolved value | permission check helper; this runtime has its own |
| `chunk-4a802yd0.js` | 20459 | markers `API beta headers`; `Fo(y)?.error?.type` | API error classification; this runtime classifies its own |
| `chunk-8wbnkfdg.js` | 20444 | `import.meta.require`, `is from .mcp.json and was rejected. Run` | MCP configuration trust and rejection messaging; this runtime has its own |
| `chunk-7rbfz3z6.js` | 20395 | a two-character delimiter scanner with a letter test | parsing helper |
| `chunk-b7hv2fkt.js` | 20276 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-ahdg823y.js` | 20254 | `https://claude.com/blog/the-advisor-strategy` | recovered tips panel with a link |
| `chunk-x42vcmsr.js` | 20182 | `let{value:s,source:d}=$n(` then a switch on the source | configuration-value source dispatch; this runtime resolves its own |
| `chunk-3dhetjey.js` | 20106 | Ink box with `position:`, a symbol and a colour | recovered spinner component |
| `chunk-x876fw6t.js` | 20106 | `Object.freeze([` list with an `includes(E(e))` test | enum dispatch helper |
| `chunk-htc1nv07.js` | 20065 | `cloud session was archived before producing output`, an error class carrying `reason` | cloud session lifecycle error, external |
| `chunk-mw3gtcge.js` | 20059 | `{server_count:l.length}`, a `take()` gate on a decision | consent dialog with telemetry |
| `chunk-c27zz9xr.js` | 20056 | `from CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `default for an unrecognized model` | auto-compact window resolution; this runtime compacts its own way |
| `chunk-73c4snhh.js` | 19950 | `The configuration file at `, ` contains invalid JSON.` | configuration error dialog; this runtime reports its own |
| `chunk-tnmwq2s7.js` | 19915 | `plugin or command line`, `{server_count:a.length}` | plugin and CLI source dialog with telemetry |
| `chunk-s5fnj4tm.js` | 19670 | `s own skills; a plugin`, `Publish a plugin folder on this machine to the person` | publishing a local plugin to a hosted library, external |

The band is dominated by things this runtime already owns: twenty-three modules with local counterparts (an error envelope helper, a string unescaper, a config-move notice, dialogs and panels, terminal emulator detection, plugin trust and handle resolution, size and short-hash helpers, MCP error mapping, output caps opened without following links, directory trust, plugin installation, permission checks, API error classification, MCP configuration trust, parsing helpers, configuration-source dispatch, enum dispatch, compaction window resolution and configuration error reporting), eleven pure code leaves with no characterising literal, seven product surfaces with no local counterpart (voice transcription, the installer path, IDE command listing, tips panels, consent telemetry, the plugin-and-CLI source dialog and upload chunking limits), five hosted surfaces (artifact type classification, device-bridge passthrough, organization send policy, an archived cloud session and plugin publishing), two vendored libraries (the AWS SDK auth scheme provider and ajv) and two excluded with credentials. No candidate is recorded, though two modules are worth naming as near misses rather than work: the output-directory module opens with `O_NOFOLLOW` and caps at 8 MiB and 5 GiB, which is this runtime's own family of rules expressed against a different output surface, and the plugin-stay-local messaging states what a session is told when something would not leave the machine, which this runtime states in its own words.



## Slice thirteen: uncited modules ranked 321 to 370

Ranks 321-370 of the uncited list (940,949 bytes, 50 modules, 19,629 bytes down to 17,899), continuing directly below slice twelve's 19,670-byte boundary. Nine modules carry no literal of eighteen characters or more; one carries the `API beta headers` marker.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-nemnpd8g.js` | 19629 | `lstat`, `open`, `realpath`, `rmdir`, `posix`, `lastErrorCode` | path and filesystem helper; this runtime has its own |
| `chunk-9s3y7e6f.js` | 19607 | `path:${GC(e.slice(5))}` | small path formatting helper |
| `chunk-h4pewgmp.js` | 19580 | `http://www.w3.org/2000/svg`, `http://www.w3.org/1998/Math/MathML` | vendored HTML sanitizer namespace handling |
| `chunk-va8dv9d8.js` | 19543 | `(file not specified)`, a tree node render | recovered file tree |
| `chunk-qv3y1kty.js` | 19520 | `^<${PD}\\s+source=`, a `lastIndexOf` slice after a tag | tag and attribute parsing helper |
| `chunk-mwa27yr7.js` | 19444 | `schemeId:`, `,signingProperties:{name:` | vendored AWS SDK auth scheme provider, second copy |
| `chunk-3xq2qhex.js` | 19429 | `removeMcpTaskMetadata failed`, `mcp-task-result-${Date.now()}-${Math.random()...}` | MCP task metadata cleanup; this runtime names its own |
| `chunk-wfncfsk3.js` | 19359 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-appb2dtz.js` | 19328 | `toLocaleString(`, `includeYear`, `timeZone`, a `,? at ` cleanup | date formatting; this runtime formats its own |
| `chunk-tvdq3hrk.js` | 19328 | `join(be(),` then a `kind` dispatch | path and configuration helper |
| `chunk-qxp7vvz1.js` | 19228 | `[...,r.fingerprint])).update(` then `digest(` | fingerprint hashing helper |
| `chunk-8sascw73.js` | 19222 | `Claude wants to upload a file to this artifact.`, `Claude wants to copy files from another artifact into this one.` | artifact permission prompts, external |
| `chunk-msy0wfrd.js` | 19219 | `Stored deep link terminal preference: ${h}`, `report the issue at https://github.com/anthropics/claude-code/issues` | deep-link preference with an issue link, a product surface without a local counterpart |
| `chunk-5bc3870c.js` | 19199 | `constants`, `promisify`, `{windowsHide:!0}`, a stdout parse | subprocess helper; this runtime runs its own |
| `chunk-7y72610j.js` | 19124 | an `isNonInteractiveSession` option, event-type checks, an `AbortController` | event gating and abort helper |
| `chunk-hh5gp14z.js` | 19081 | `createWriteStream`, `rm`, `dirname` | file write helper |
| `chunk-zqyjdv9s.js` | 19068 | `removeEventListener` and `addEventListener` pairs | listener swap helper |
| `chunk-2zhybd9r.js` | 19043 | `typeof performance.now`, `process.emitWarning` | vendored timing and warning polyfill |
| `chunk-grj7dp0e.js` | 19043 | `Validating session`, `Fetching session logs`, `Getting branch info` | cloud session setup steps, external |
| `chunk-frj2b06g.js` | 19037 | a reservoir sorted for percentiles, `[keybindings] Chord timeout - cancelling` | keybinding chord handling with statistics; this runtime has its own keybindings |
| `chunk-3jqfmt54.js` | 19020 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-8q85xryy.js` | 19007 | `keep browser tools off`, `Browser actions still go through Claude` | browser tool settings, external |
| `chunk-mk7bp7a5.js` | 18984 | the same `removeMcpTaskMetadata failed` and `mcp-task-result-` literals as the module above | near-duplicate of the MCP task metadata cleanup |
| `chunk-fkrgh0sv.js` | 18964 | a status prop rendered into a component | recovered UI component |
| `chunk-q148m20m.js` | 18909 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-sjkwe6cx.js` | 18899 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-yspgct4b.js` | 18896 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-gea15kzp.js` | 18879 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-52aw3vkn.js` | 18876 | markers `API beta headers`; `typeof e===`, `String(e.message).includes(` | error classification helper |
| `chunk-w93df3n3.js` | 18785 | `${os(i)} no longer contains the correct repository. Select another pat` | repository selection error; this runtime verifies its own repository |
| `chunk-3066sf0r.js` | 18746 | a zod refine over finite numbers, an ISO timestamp pattern, `T=64,W=16,G=256,H=32,F=64` | bounded schema; this runtime validates its own |
| `chunk-dcbjzzq8.js` | 18667 | `[liveReplica] held saves pushed before logout`, `final divergence report before logout` | live replication before logout, external |
| `chunk-c0aaqg7t.js` | 18561 | `the eager argv scan sees a --sdk-url value commander did not bind` | CLI argv scan; this runtime parses its own |
| `chunk-szsp20sx.js` | 18536 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-c7jc8962.js` | 18535 | `the last message ends on a direct question or explicit request for the `, `which do you prefer?`, `needs input: …` | the needs-input heuristic; this runtime decides its own |
| `chunk-qdewyn2k.js` | 18470 | `inputSchema:{...r.input_schema,type:`, `${r.name} is one of ${e}`, `session-channel MCP tool called without being routed to its machine` | MCP tool schema and routing checks; this runtime routes its own |
| `chunk-wy25wgx2.js` | 18414 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-vks3711y.js` | 18407 | `s folder is in the container, not on the person`, `--plugin-dir <mod folder>`, `CLAUDE_CODE_PLUGIN_DIRS` | container plugin directories, external |
| `chunk-desqk94p.js` | 18262 | `t verify your git remote host (remote is ` | git remote host verification, a recovered dialog |
| `chunk-r4m2wntw.js` | 18262 | `[account memory text not recorded]`, `<${e.length} chars; not recorded>`, `<not recorded: ${e}>` | memory text withheld from a record; this runtime records its own memory text |
| `chunk-x7wez8gv.js` | 18257 | an outcome compared after an awaited call | recovered UI flow |
| `chunk-hs9jkxkf.js` | 18218 | a promise result rendered into a component | recovered UI component |
| `chunk-rddyv0j7.js` | 18209 | `Failed to start pro trial: ${l(g)}`, `Your Pro plan includes ${x} days of Claude Code.` | billing and trial UI, external |
| `chunk-qxtf5fmk.js` | 18120 | no literal of eighteen characters or more | pure code leaf, undetermined |
| `chunk-kdpfa1zf.js` | 18078 | a decision gate with `take()` and a title | consent dialog, recovered UI |
| `chunk-c489a4nk.js` | 18068 | `URL must be parseable`, `URL cannot use javascript:, data:, or vbscript: scheme`, an error class with `errorCode` | a URL scheme allowlist; no tool in this runtime takes a URL from the model, so the rule guards a surface that does not exist here |
| `chunk-xr9ttztq.js` | 18029 | `${JWe}/${rJ} is reserved`, `syncDir must be absolute` | reserved sync directory rules; this runtime reserves its own paths |
| `chunk-ypbkhaky.js` | 18006 | `the signed-in account changed while probing`, `artifactKind`, `livePaths` | artifact probing tied to an account, external |
| `chunk-6wx3ne7e.js` | 17955 | a count joined with a plural helper | formatting helper |
| `chunk-yrmd1p0k.js` | 17899 | `observer marker read-back failed`, `${e.agentType}@${o.observedEnvelopeName}`, `subagentName`, `invocationKind` | subagent observation envelope; this runtime has its own subagent records |

The band is again mostly the runtime's own plumbing: twenty-five modules with local counterparts, nine pure code leaves, seven hosted surfaces (artifact permission prompts, cloud session setup, browser tools, live replication, container plugin directories, billing and artifact probing), four recovered UI components, three vendored or polyfill modules (an HTML sanitizer, a second copy of the AWS auth scheme provider and a timing polyfill), one product surface without a local counterpart (deep-link preference with an issue link) and one rule that guards a surface this runtime does not have: a URL scheme allowlist refusing `javascript:`, `data:` and `vbscript:`, which would matter here only if a tool ever took a URL from the model. That is the closest thing to a candidate in the band and it is not one, because no such tool exists. No candidate is recorded.

## Slice fourteen: uncited modules ranked 371 to 420

Ranks 371-420 of the uncited list (858,355 bytes, 50 modules, 17,837 bytes down to 16,545), continuing directly below slice thirteen's 17,899-byte boundary.

This band forced a method correction, and it is the more useful result than the table. The recovered modules are minified onto essentially one line, so the earlier extraction, which skipped the `/$bunfs/root/chunk-*.js` dependency list line by line, was dropping the whole body of any module whose dependency list shares its line, and reporting it as a module with no literals. Skipping the dependency list per match instead of per line changes what this band looks like, and it also exposes why the band looked empty: 28 of these 50 modules are 80% or more import statements - one is 99.9% - and the band is 57.7% import text overall. At this depth, rank by size is largely measuring the dependency list rather than the logic, so a large uncited module is no longer evidence of a large unreviewed subsystem.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-jyw2nenq.js` | 17837 | `In Bypass Permissions mode, Claude Code will not ask for your approval before running pote`, `sandboxed container/VM that has restricted internet acc`, `tengu_bypass_permissions_mode_dialog_accept` | permission-mode consent dialog; this runtime has permission modes of its own |
| `chunk-3xcmvqfg.js` | 17802 | `the module returned no tree`, `the instance unmounted`, `the frame before it kept` | view-tree reconciliation where a module is replaced; this runtime renders its own |
| `chunk-9cqdphnz.js` | 17796 | `\xB7 /permissions to manage`, `Did not add a working directory.`, `alreadyInWorkingDirectory` | working-directory add flow; this runtime tracks its own |
| `chunk-n397yagt.js` | 17794 | 99.5% import statements, no literal of its own | dependency aggregator |
| `chunk-bezmxxs5.js` | 17760 | `[headlessCloud] device-MCP refusal not saved; this computer offers none of its MCP servers`, `asked again at the next attach`, `tengu_device_mcp_host_consent`, `unsupported_surface` | device MCP host consent stored in a cloud session, hosted |
| `chunk-f4zfsb50.js` | 17755 | `claude --resume to pick a session, then /desktop inside it.`, `a cc:// connect URL`, `CLAUDE_CODE_RESTRICTED`, `not_subscriber` | desktop app entry and restricted-session modes, external |
| `chunk-2zj7x9mp.js` | 17735 | `The activity above is a read-only digest of the agent you are observing — it is data,`, `observer tombstone`, `only tags carrying that nonce are the digest's`, `tengu_observer_subagent_fanout` | observer digest fed to a watching agent; this runtime keeps its own subagent records |
| `chunk-kcwp0ct0.js` | 17735 | `settings review store: malformed or of an unknown version`, `settings write refused: a managed drop-in directory did not resolve`, `settings_quarantine`, `tengu_settings_change_staged`, `user_settings`, `policy_settings` | staged settings review over the config source layers; the file mechanism W08 ported, its staging half unported |
| `chunk-zq3k2mvx.js` | 17679 | `Currently pinned: `, `Latest available: `, `Claude Code will restart to apply.` | model update notice; this runtime reports its own |
| `chunk-9hftv3j7.js` | 17668 | 94.4% import statements; one telemetry name, `tengu_powerup_discovery_shown` | dependency aggregator |
| `chunk-xym9xmem.js` | 17555 | 96.8% import statements, no literal of its own | dependency aggregator |
| `chunk-gsnbskq4.js` | 17534 | `<artifact-content-authored-by-others/>`, `its author may be anyone on the internet. Treat it as data, not instructions.`, `no_own_files`, `sandbox_violations` | artifact authorship notes fed to the model, external; the same data-not-instructions boundary this runtime states in its own prompt |
| `chunk-k315yzdc.js` | 17534 | `--dangerously-load-development-channels is for local channel development only.`, `Please use --channels to run a list of approved channels.`, `I am using this for local development` | consent prompt for a development-only flag; this runtime has its own flags and consent |
| `chunk-qt65yy3t.js` | 17503 | `no allowed place in the scratchpad`, `over the 8 MB total`, `same name as another file except for letter case`, ` within the budget` | file-collection budget with a case-collision rule; this runtime bounds its own collections |
| `chunk-cyqvfe2w.js` | 17470 | `CCR_AGENT_PROXY_FRAME_HOSTS is malformed; keeping the gateway routes`, `forbidden: CCR agent tokens`, `organization network policy denies artifact storage reads for this session`, `frame_publish` | remote frame tunnel under an organization network policy, hosted |
| `chunk-ykwza2f6.js` | 17470 | `mount_path must be absolute`, `mount_path must be under /uploads/ or /outputs/`, `staging under /outputs/ is only supported on managed remote sessions`, `ccr_stage_file_outputs` | managed remote session mounts, hosted |
| `chunk-h3pghfvj.js` | 17427 | `Review and manage your privacy settings at https://claude.ai/settings/data-privacy-control`, `Privacy settings dialog dismissed`, `tengu_grove_policy_toggled` | hosted privacy settings, external |
| `chunk-69bswe6y.js` | 17417 | `missing_capability`, `That draft is too large to save. Trim the details.`, `Couldn't send feedback. The draft is still queued. Try again later.`, `tengu_feedback_queue_opened` | feedback draft store, a product surface without a local counterpart |
| `chunk-jhzmh5xy.js` | 17372 | 99.7% import statements, no literal of its own | dependency aggregator |
| `chunk-1wsqtf4b.js` | 17244 | 98.9% import statements, no literal of its own | dependency aggregator |
| `chunk-xxgdhngd.js` | 17205 | 99.7% import statements, no literal of its own | dependency aggregator |
| `chunk-4bk0r2h7.js` | 17143 | 99.9% import statements, no literal of its own | dependency aggregator |
| `chunk-9faebf06.js` | 17102 | `Only show enabled plugins`, `Only show disabled plugins`, `Add a marketplace from a URL or path`, `Remove a known marketplace`, `Refresh a marketplace from its source` | recovered marketplace panel, UI |
| `chunk-0b1cav3q.js` | 17082 | 99.8% import statements, no literal of its own | dependency aggregator |
| `chunk-tjwzg4gs.js` | 17077 | `compact_hint_reject`, `tengu_context_hint_reject`, `tengu_context_hint_busy_fallback`, `invalid_request_error` | context hint rejection with a busy fallback; this runtime hints and compacts its own way |
| `chunk-khejd89b.js` | 17067 | 98.0% import statements, no literal of its own | dependency aggregator |
| `chunk-49rn8j6s.js` | 17064 | `cli_agents_json`, `waiting`, `working`, `subagentStatusLine` | agent listing for the CLI surface; this runtime lists its own |
| `chunk-j719bwvm.js` | 17050 | 97.9% import statements, no literal of its own | dependency aggregator |
| `chunk-1n9rk9tp.js` | 17037 | `plugin command source entry traverses a suspect link`, `plugin command source link escapes producer directory`, `plugin command source path resolves to a network path`, `tengu_plugin_folder_shadowed` | the link-vetting rule set applied a second time, to plugin command sources - independent corroboration of the family [W10](W10-include-link-vetting.md) ported |
| `chunk-brn53y7y.js` | 17025 | `trigger limit reached`, `maximum number of webhook triggers`, `artifact_durable_subscribe`, `orphan_trigger_release_failed`, `bound to a desktop device` | durable artifact triggers and subscriptions, hosted |
| `chunk-fyhzvvp0.js` | 16993 | `The name of the tool requesting permission`, `The unique tool use request ID`, `user_temporary`, `user_permanent`, `org_ask_ceiling`, `can_use_tool` | host-side permission prompt protocol; this runtime decides its own permissions |
| `chunk-2vjeaqby.js` | 16979 | `auth: no token found, will re-check keychain every 30s`, `auth: token found via keychain re-check`, `known_dead_refresh_token` | credential token re-checks, excluded with credentials |
| `chunk-8arn3139.js` | 16979 | 99.5% import statements, no literal of its own | dependency aggregator |
| `chunk-ms836stj.js` | 16978 | 99.4% import statements, no literal of its own | dependency aggregator |
| `chunk-km7yk7x6.js` | 16864 | `Generate a concise, technical issue title (max 80 chars) for a public GitHub issue based on this bug report for Claude Code.`, `this session + this project’s other sessions from the last 7 days` | feedback scope and issue drafting, a product surface without a local counterpart |
| `chunk-56b99s01.js` | 16856 | 99.7% import statements, no literal of its own | dependency aggregator |
| `chunk-wwpqezyr.js` | 16853 | `Session mirroring was turned off by your organization's policy (allow_remote_sessions).`, `Remote Control is not available inside a cloud session.`, `managed_disabled`, `not_in_rollout` | Remote Control policy gates, hosted |
| `chunk-fcqdb5ar.js` | 16817 | 98.6% import statements, no literal of its own | dependency aggregator |
| `chunk-8w0gx47m.js` | 16775 | `Couldn't save the output style (detail withheld on this connection).`, `tengu_output_style_changed`, `localSettings`, `outputStyle` | output style selection and save; this runtime selects and saves its own style |
| `chunk-fenc1aa8.js` | 16774 | `@media (prefers-reduced-motion:reduce){.pixelgram .moving{display:none}`, `width=device-width,initial-scale=1`, `Iowan Old Style`, a close-tab script with a nonce | HTML preview generation with bundled fonts, a product surface without a local counterpart |
| `chunk-vd6vcvf5.js` | 16762 | `https://http-intake.logs.us5.datadoghq.com/api/v2/logs`, `tengu_tether_live_outcome`, `chrome_bridge_connection_failed` | telemetry shipped to a named hosted intake, external |
| `chunk-e3y6jrrd.js` | 16759 | `expected \`region\` to be configured for \`aws.auth#sigv4\``, `Invalid Configuration: FIPS and custom endpoint are not supported`, `supportsDualStack` | vendored AWS SDK auth scheme provider, third copy |
| `chunk-he6c39cm.js` | 16740 | `allow_local_checkpoint_commit`, `bare_repo`, `gitroot_uncontained`, `gitdir_uncontained`, `core.splitIndex=false`, `user.name=Claude Code` | git checkpoint commits and their containment checks; this runtime checkpoints its own way |
| `chunk-4y67nrfk.js` | 16719 | `/recap only runs when you ask for it yourself in this session`, `Nothing to recap yet — send a message first.`, `fallback_rebuild_failed` | session recap command, a product surface without a local counterpart |
| `chunk-f606a53w.js` | 16665 | `writeTextContent: on-disk size mismatch after write`, `writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path`, `atomic_write_staging_dir_tampered`, `EINVAL: not a regular file`, `assertDirChainReal: dir must be strictly inside base` | **ported 2026-10-12**: post-write size verification and a temp-file fallback that preserves content, in the file write path, landed as a shared verified writer (`ports/W13-verified-write.md`); the same reading also recovered an unsupported-flush notice, a step-by-step writer log and a named staging-tamper error, recorded with the port - adjacent to the identity family [W09](W09-path-chain.md) ported |
| `chunk-5z1j5myx.js` | 16644 | `The proposal offered to remove a permissions.allow rule the scan of your settings didn’t flag, so it wasn’t kept.`, `auto_mode_setup_propose`, `recon_failed`, `no_refresh_token` | settings scan and permissions proposal; its auth states are credential handling and stay excluded |
| `chunk-36h1wcr3.js` | 16575 | `workflow_agent`, `workflow_phase`, `workflow_log` | workflow bookkeeping; this runtime runs its own workflows |
| `chunk-8vv42z7k.js` | 16573 | 99.8% import statements, no literal of its own | dependency aggregator |
| `chunk-k6m7j40m.js` | 16566 | `relay not armed from the handed-off turn: no start-up of the relay is waiting for it any m`, `the member is not a marker line with a uuid of its own`, `relay_not_configured`, `thinking_strip_owed`, `write_unconfirmable` | turn relay and handoff bookkeeping, hosted relay |
| `chunk-0fzcfed0.js` | 16545 | 99.5% import statements, no literal of its own | dependency aggregator |

The band reads as sixteen dependency aggregators, sixteen modules with local counterparts, ten hosted surfaces (device MCP consent, the desktop entry, artifact authorship notes, the remote frame tunnel, managed remote mounts, hosted privacy settings, durable artifact triggers, Remote Control policy gates, telemetry to a named intake and the turn relay), four product surfaces without a local counterpart (feedback drafts, issue drafting with its feedback scope, HTML preview generation and the recap command), one recovered UI panel, one vendored copy of the AWS auth scheme provider, one module excluded with credentials, and one candidate. Three modules are worth naming as pointers rather than as work. The link-vetting rule set appears a second time in this band, applied to plugin command sources, which corroborates the family W10 ported without adding a new rule. The settings review store sits on top of the config source layers W08 ported and its staging half is unported, but it needs a proposal UI this runtime does not have. The output-style save path is a surface this runtime also has in its own form. The candidate is the file write path's post-write verification: this runtime writes files and edits them in place, it verifies none of it after the fact, and the module states both a size re-check against what was written and a fallback that keeps the content at a temp path when the in-place write fails.



## Slice fifteen: uncited modules ranked 421 to 470

Ranks 421-470 of the uncited list (803,148 bytes, 50 modules, 16,542 bytes down to 15,478), continuing directly below slice fourteen's 16,545-byte boundary. The extraction skips the dependency list per match, as slice fourteen's method note requires. Eighteen of the fifty modules carry no characterising literal of their own at all, and the band is 62.5% import text - higher than slice fourteen, so the trend the previous band recorded continues: size rank keeps measuring the dependency list rather than the logic.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-01dkdjqy.js` | 16542 | `cross-session idle notice`, `notify_when_idle`, `peer_idle_notice`, `revoked_before_fire`, `subscription_after_exit` | cross-session idle notices and their revocation; this runtime has its own cross-session notice semantics |
| `chunk-3tfztmj7.js` | 16499 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-v9dv314h.js` | 16474 | `claude agents --json`, `claude agents --plugin-dir (commander action)`, `requires an interactive terminal (stdout is not a TTY)` | agent listing CLI; this runtime lists its own |
| `chunk-71cecbjp.js` | 16419 | 91% import statements, no literal of its own | dependency aggregator |
| `chunk-6y233r97.js` | 16413 | `workflow-launch-exec: no pending launch handoff for this invocation`, `workflow_launch_settle_failed`, `workflow_launch_no_slot` | workflow launch handoff slots; this runtime runs its own workflows |
| `chunk-y8v0ps1b.js` | 16402 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-5nw4c80d.js` | 16392 | `this command only runs inside a remote (CCR) session (CLAUDE_CODE_REMOTE is not set).`, `remote_env` | remote-session-only command, hosted |
| `chunk-9vfgfkdj.js` | 16352 | 99% import statements, no literal of its own | dependency aggregator |
| `chunk-s22xp6c3.js` | 16339 | `Claude in Chrome: a browser_batch must act on one tab.`, `Claude in Chrome: switch browsers in its own call, not inside a browser_batch.`, `tabs_context_mcp`, `list_connected_browsers` | browser extension tool validation, external |
| `chunk-04m6g9sr.js` | 16333 | `color_diff_hljs_emitter_shape_error`, `blackBright`, `greenBright` | diff syntax-highlight emitter; this runtime prints its own diffs |
| `chunk-9sq8whr4.js` | 16329 | `Your claude.ai usage limit has reset. Continue the task you were working on when the limit`, `quota_auto_resume`, `autoContinueAtUsageLimit`, `tengu_quota_auto_resume_offer_armed` | subscription quota auto-resume, hosted |
| `chunk-7cvpzcj4.js` | 16317 | `[tool-host] the request ids are not in a usable form; starting the helper without them`, `tool host helper: not available on Windows`, `bridge_tool_host_work`, `at_capacity` | bridge tool-host helper process, external |
| `chunk-2ny9pph7.js` | 16304 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-7wfe037m.js` | 16298 | `[queued-notifications] dropping malformed queued_notification payload`, `GitHub activity on a subscribed PR`, `scheduled trigger (the stored prompt of a routine or task on this account)`, `ccr_queued_notifications` | cloud queued notifications, hosted |
| `chunk-fmmf2rry.js` | 16293 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-4e9r8e6d.js` | 16285 | 98% import statements, no literal of its own | dependency aggregator |
| `chunk-68x9ff96.js` | 16268 | `plan_mode`, `plan_mode_reentry`, `plan_mode_exit` | plan mode entry and exit; this runtime has its own plan mode |
| `chunk-5s1xqb5y.js` | 16233 | 92% import statements, no literal of its own | dependency aggregator |
| `chunk-yn0pfn70.js` | 16208 | `costs may be inaccurate due to usage of unknown models`, `at your organization's configured rates`, `readRange`, `readTail`, `maxBytes` | cost display beside a bounded file range reader; this runtime reads with its own bounds |
| `chunk-169gwk6m.js` | 16204 | `File paths (absolute or relative to cwd) to send to the user. Always pass an array, even f`, `How the client should present the file. 'render' opens it inline in the side panel`, `tengu_send_user_file` | send-file tool that hands a file to the client, external |
| `chunk-r79ds8r6.js` | 16202 | `does not dial under a provider other than Anthropic`, `does not dial while CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set`, `cli_mcp_serve_session_tunnel`, `token_expired` | session tunnel dial guards, hosted |
| `chunk-cdt17j30.js` | 16198 | 87% import statements, no literal of its own | dependency aggregator |
| `chunk-7xnx6cv2.js` | 16194 | `(?:read_db\|write_db)`, `a read (get, list, query or profiles)`, `a write (set, update, delete or batch)` | artifact database tool schema, hosted |
| `chunk-m7864yc0.js` | 16169 | `refusing to derive a messaging key name for a non-canonical socket path`, `messaging key could not be published through storage`, `tengu_session_stable_address` | local agent messaging key over a socket path; this runtime has its own session addressing |
| `chunk-tcpnppq7.js` | 16128 | `system prompt changed`, `tool definitions changed`, `cache scope or TTL changed`, `beta headers changed`, `opus_5_prompt_bundle` | prompt-cache invalidation reasons; this runtime builds its own prompts |
| `chunk-b5bcs8ah.js` | 16122 | `left_click_drag`, `gif_creator`, `read_console_messages`, `resize_window` | browser extension action set, external |
| `chunk-xpm5jwed.js` | 16120 | `Index of saved memories`, `autoMemoryEnabled`, `autoDreamEnabled`, `legacyGlobalConfig` | memory index; this runtime keeps its own memory directory |
| `chunk-c885xb6b.js` | 16107 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-cb7abgty.js` | 16105 | `Not shown under your organization's policy: this breakdown is built by scanning the sessio`, `allow_usage_transcript_scan`, `attributionSkill`, `attributionPlugin` | usage attribution behind an organization policy, hosted |
| `chunk-7n2gnd9w.js` | 16061 | `Enable Claude in Chrome, the Claude extension in the Chrome browser on the user's own comp`, `Enable the browser built into the Claude desktop app`, `device_tool_requested` | browser enablement request to the client, external |
| `chunk-ekrtrxy7.js` | 16007 | `unknown .git entry`, `symlinked, hardlinked or unexpected .git/index`, `no .git/config or .git/HEAD`, `symlinked or oversized .git/objects entry` | **reclassified 2026-10-12 - rule without a local surface**: read whole for a port attempt, this module is not a Git-directory inspector but a workspace-diff materialiser that copies a discovered repository's `.git` into a temporary directory so git can read it without touching the original; the vetting rules above are the gates on that copy (per-entry dispositions with `commondir`/`gitdir`/`reftable` refused, a 256-entry cap, an allowlisted config with `core.commitGraph` and `core.multiPackIndex` forced false). This runtime has no surface that reads a repository it did not create - no diff anywhere in `src/`, git invoked only by `src/worktrees.ts` for worktree registration, and the other `.git` references merely bound ancestor traversal or reserve the name - and the half that does have a counterpart is already covered by `checkFile` (`src/worktrees.ts:66`), which refuses a non-regular file, a symlink and `nlink !== 1`. Porting it would mean building the diff capability first, which is new product scope rather than a rule landing on an owned surface, so it is recorded as a rule without a local surface and no longer counts as a pending port |
| `chunk-x9tvxwnr.js` | 15999 | `A mod is code Claude wrote; it runs with your permissions.`, `Enable for this session`, `managed_hooks_only`, `sideload_disabled`, `safe_mode` | hook and mod consent with managed-only and safe-mode gates; this runtime has its own hooks |
| `chunk-bf8m6k6e.js` | 15991 | `MCP tool file input rejected`, `path_rejected`, `egress_blocked`, `container_too_old` | MCP tool file input rejection reasons; this runtime handles its own tool inputs |
| `chunk-gt9q9c80.js` | 15981 | `end the conversation — only for sustained user abuse, or when the user explicitly ask`, `end_conversation` | an end-conversation tool, a product surface without a local counterpart |
| `chunk-w79px1ss.js` | 15947 | `No result received from shell command`, `bash_mode_progress`, `tengu_input_bash` | shell command progress reporting; this runtime runs commands its own way |
| `chunk-gwp04mmf.js` | 15940 | `This background session shares credentials with other sessions; /logout here has no effect`, `Successfully logged out from your Anthropic account.` | account session and logout, excluded with credentials |
| `chunk-9c78dh5n.js` | 15899 | `Welcome to Claude Code`, `clawd_body`, `clawd_background`, the issue and overview URLs, a build timestamp | recovered welcome screen with the product's mascot, UI |
| `chunk-pd0xy2yx.js` | 15776 | `A plugin skill is managed with the plugin, not here.`, `Settings can't store an entry with this skill's name; rename its folder or file`, `A higher-priority configuration sets this skill's state` | skill state edit refusals by source priority; this runtime has its own skills |
| `chunk-xm8pyvc6.js` | 15728 | ` — previous content replaced (no diff shown)`, `Error writing file`, `tool_use_error` | file rewrite reporting; this runtime writes and reports its own |
| `chunk-n10kqgv9.js` | 15716 | `read_truncation_notice` | read truncation notice; this runtime truncates its own reads |
| `chunk-9gr45zr0.js` | 15702 | 99% import statements, no literal of its own | dependency aggregator |
| `chunk-vbk7aw26.js` | 15670 | 89% import statements, no literal of its own | dependency aggregator |
| `chunk-4mgy76hy.js` | 15644 | 97% import statements, no literal of its own | dependency aggregator |
| `chunk-raerh5yw.js` | 15594 | 98% import statements, no literal of its own | dependency aggregator |
| `chunk-s7a3x3hz.js` | 15583 | `published-file reads run only from a local session or an Anthropic-hosted cloud session wi`, `not a valid artifact id`, `it is served to you as a public (non-member) reader`, `relay_unauthorized` | artifact file reads restricted by session kind, hosted |
| `chunk-zwebmz22.js` | 15576 | 97% import statements, no literal of its own | dependency aggregator |
| `chunk-yddtazsr.js` | 15550 | 100% import statements, no literal of its own | dependency aggregator |
| `chunk-cxwnrac7.js` | 15529 | 98% import statements, no literal of its own | dependency aggregator |
| `chunk-g0qz7p20.js` | 15528 | `plugin eval: a repo-authored path is an automounter path — refusing it`, `links to a network-reaching path — refusing it`, `has an unexaminable component — refusing it`, `lands on an automounter map directory` | the path and link vetting family a third time, now for plugin eval paths - further corroboration of the family [W09](W09-path-chain.md) and [W10](W10-include-link-vetting.md) ported |
| `chunk-fft78nr6.js` | 15478 | 100% import statements, no literal of its own | dependency aggregator |

The band reads as eighteen dependency aggregators, sixteen modules with local counterparts, twelve hosted surfaces (a remote-session-only command, the browser extension tool set and its enablement request, subscription quota auto-resume, the bridge tool-host helper, cloud queued notifications, the send-file hand-off, the session tunnel, the artifact database tool, org-policy usage attribution and artifact file reads), one product surface without a local counterpart (an end-conversation tool), one recovered UI panel (the welcome screen with its mascot), one module excluded with credentials and one candidate. Two findings are pointers rather than work. The path and link vetting family appears a third time in this band, applied to plugin eval paths with macOS automounter and network-reachability refusals, which is the strongest corroboration yet that the family is a repeated invariant of the recovered client rather than one module's local habit. The messaging key over a socket path is adjacent to this runtime's own cross-session addressing, but its storage-backed publication has no local counterpart.

The candidate is the Git-directory vetting: the recovered client refuses an unknown `.git` entry, a symlinked or hardlinked `.git/index`, a `.git` with no `config` or `HEAD`, and a symlinked or oversized `.git/objects` entry, while this runtime's worktree code verifies the *registration* identity it created (device and inode of the worktree directory, the resolved Git directory and its backlink, the common directory) and never inspects the entries of a Git directory it did not create. The rule is small, it guards a surface this runtime already owns, and the honest statement of coverage is that identity is checked and structure is not.

## Slice sixteen: uncited modules ranked 471 to 520

Ranks 471-520 of the uncited list (749,472 bytes, 50 modules, 15,467 bytes down to 14,608), continuing directly below slice fifteen's 15,478-byte boundary. This is the thinnest band the review has read: 77.2% of it is import text, 39 of the 50 modules are 85% or more import statements, and 34 carry no characterising literal of their own. Only sixteen modules say anything at all, so the table below lists those and records the remainder as one group.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-57v1bkyr.js` | 15427 | `Usage: /subtask <task>`, `Subtasks are not available in coordinator sessions. Use /branch instead.`, `Cannot start a subtask before the first conversation turn` | subtask command with coordinator and first-turn guards; this runtime has its own subagents |
| `chunk-yqmn7976.js` | 15397 | `running dynamic workflow` | workflow launch status; this runtime runs its own workflows |
| `chunk-an8ydp4g.js` | 15367 | `post-trust: re-discover project @skills-dir plugins` | plugin and skill re-discovery after a project is trusted; this runtime discovers its own |
| `chunk-k9pr531z.js` | 15187 | `only POST, GET and DELETE are relayed`, `tunnel request does not name this session`, `WebSocket tunnel is not enabled for this session`, `preview_tunnel_liveness_enforced_reconnect` | live preview tunnel with a liveness policy, hosted |
| `chunk-01ee7e9z.js` | 15163 | `Fast mode is not available` | fast mode gating, a product surface without a local counterpart |
| `chunk-gckz56z0.js` | 15099 | `AWS SDK for JavaScript Sso Client for Node.js, Browser and React Native`, `expected \`region\` to be configured for \`aws.auth#sigv4\``, `concurrently 'yarn:build:cjs'` | vendored AWS SDK SSO client with its build scripts |
| `chunk-w9kaj2q7.js` | 15098 | `not reachable from this cloud session`, `Claude Desktop session`, `(session list too long to fetch completely`, `No reachable agents.`, `in_process_teammate`, `messaging_disabled` | cross-session and agent listing across local, in-process and hosted sessions; this runtime lists its own |
| `chunk-geje3xvd.js` | 14984 | `This folder is already served by another Claude Code on this device. Stop it first.`, `Remote Control session expired.`, `bridge_environment_register`, `environment_expired` | Remote Control bridge registration, hosted |
| `chunk-ppwwh8y9.js` | 14977 | `it is in another of the user's organizations, which this login cannot read`, `its link is not an Artifact URL of this session's claude.ai`, `new comments are waiting on it, so a read of it asks first` | artifact read refusal reasons, hosted |
| `chunk-6sycc0cx.js` | 14923 | `Run /ultrareview to confirm and launch the cloud review.`, `claude ultrareview` | cloud review launcher, hosted |
| `chunk-hh4k8r73.js` | 14804 | `; the context beside the deny is dropped` | permission deny and its dropped context; this runtime decides its own permissions |
| `chunk-4rrprwwq.js` | 14729 | `no Anthropic config directory was found`, `the profile on this machine belongs to another tool`, `ANTHROPIC_API_KEY is set in this environment`, `env_credential_shadow`, `oidc_federation` | credential profile and environment shadowing, excluded with credentials |
| `chunk-5s0t90hn.js` | 14696 | `Before tool execution`, `After tool execution fails`, `After a batch of tool calls resolves`, `After auto mode classifier denies a tool call`, `hookEventName` | hook event catalogue; this runtime has its own hooks |
| `chunk-5kma9zk6.js` | 14651 | `managed-settings file tier`, `project/local layers`, `settingsPrime: user settings already read before start-up; seed skipped`, `seedAbsence` | settings seeding across the config layers, adjacent to the layer mechanism W08 ported |
| `chunk-efek3snh.js` | 14611 | ` Error installing `, `Please restart your IDE and try again.`, `Managed settings only (allowManagedPermissionRulesOnly)`, `Organization policy`, `settings_unknowable` | managed-settings source labels beside an IDE installer; this runtime labels its own settings sources |
| `chunk-kxgzv2t8.js` | 14608 | `## Team memory (\`team/\` subdirectory)`, `contradicts CLAUDE.md — verify which is current`, `Why: the user corrected me`, `record_newer`, `items_unreadable`, `tengu_auto_dream_fired` | **candidate**: a contradiction verdict between a remembered fact and an instruction file, and a consolidation pass over the memory store with newer-record and unreadable-item skips |

The remaining thirty-four modules are dependency aggregators: ninety to one hundred percent import statements, no literal of their own, and no subsystem this pass can name. They are not undetermined in the sense of unreadable - their readable text is a dependency list - so the honest disposition is that they carry this band's byte mass and almost none of its content.

The band reads as thirty-four dependency aggregators, eight modules with local counterparts, four hosted surfaces (the preview tunnel, the Remote Control bridge, artifact reads and the cloud review), one product surface without a local counterpart (fast mode gating), one vendored AWS SDK copy, one module excluded with credentials and one candidate. The candidate is the memory rule: this runtime's memory tools already merge duplicate facts on write, carry a hash conflict path and state that current user instructions take precedence over remembered preferences, while the recovered client also reaches an explicit *contradiction* verdict against an instruction file, asking which of the two is current, and runs a consolidation pass that skips a newer record and an unreadable item by name. The precedence half is covered locally; the contradiction verdict and the consolidation pass are not.

## Slice seventeen: uncited modules ranked 521 to 620

Ranks 521-620 of the uncited list (1,332,357 bytes, 100 modules, 14,575 bytes down to 12,761). This band is twice as wide as the previous one, an owned method decision recorded below, and it is the first band read at that width. Sixty of the hundred modules are dependency aggregators - 58 of them 95% or more import statements - and the band is 70.1% import text, so 40 modules carry the readable content.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-6a1924eb.js` | 14539 | `highlighting this text takes more work than its length allows`, `this text is too long, or its lines are, for a grammar`, a language-name registry | syntax highlighting with a work bound per grammar; this runtime renders its own |
| `chunk-hyft8yrm.js` | 14498 | ` (custom skills are disabled in safe mode)` | skills under safe mode; this runtime has its own skills |
| `chunk-nrk8z90j.js` | 14419 | `Anthropic Directory`, `plugin marketplace remove`, `Other projects' settings are not checked` | hosted plugin directory, external |
| `chunk-7vnvq3kn.js` | 14414 | `Session keeps running. Use /stop to end it.` | session stop semantics; this runtime has its own |
| `chunk-hh0bresc.js` | 14372 | ` \xB7 Fast mode ON`, ` \xB7 Draws from usage credits`, `pay_per_request`, `included_in_plan` | fast mode and credit accounting, hosted billing |
| `chunk-v9zhakgk.js` | 14354 | `[deviceKey] stored device key is unreadable; minting a new one`, `[deviceKeyStore] keychain item is not a device-key document` | device key in the keychain, excluded with credentials |
| `chunk-dzt2d3te.js` | 14342 | `Usage: /add-dir <path>` | working-directory addition, as in slice fourteen |
| `chunk-dmx7k8nv.js` | 14214 | `allow_mcp_task_worker_wake`, `not_sent`, `unusable_payload`, `malformed_id` | MCP task worker wake scheduling; this runtime drives its own task workers |
| `chunk-tkv2v0va.js` | 14198 | `Self-hosted cloud environments`, `Open ${t}/admin-settings/cloud-environments in your browser`, `self_hosted_runner_list_runners` | self-hosted runner administration, hosted |
| `chunk-sr98f9sa.js` | 14161 | `[promo] status response carried neither field (in-band error)`, `allow_promo_offers`, `promo_status` | promotional offer status, hosted |
| `chunk-gq1jcqm5.js` | 14137 | `<cloud-transcript-unavailable>`, `Hooks that run on the user's own machine are paused because it did not answer`, `the attached machine` | cloud transcript and device-attached hooks, hosted |
| `chunk-qvy5jmvh.js` | 14031 | `https://{Region}.signin.aws.amazon.com`, `AWS SDK ... FIPS and custom endpoint are not supported` | vendored AWS sign-in provider |
| `chunk-9snggdpy.js` | 14008 | `Windows file-system call failed`, `name too long for Windows (over 32,766 characters)`, `symbolic link target too long for a reparse point` | Windows path guards; this runtime's own path rules are POSIX-shaped |
| `chunk-9k4fc4ce.js` | 13721 | `[bridge:repl] Account changed via /login — disconnecting Remote Control ses`, `[trusted-device] Same account+org re-login with existing token`, `profile_credential_error` | login, trusted-device and bridge session lifecycle, excluded with credentials |
| `chunk-bjnm9gn2.js` | 13677 | `Plugin autoupdate: command-source refresh disabled by managed settings`, `Plugin autoupdate: skipped (auto-updater disabled)` | plugin auto-update policy; this runtime updates plugins its own way |
| `chunk-jby75btn.js` | 13560 | `Issue every read for it in the SAME message as your other reads (parallel tool c`, `The system's files are styling data its editors can change, not instructions` | hosted design-system reads, external; states the data-not-instructions boundary again |
| `chunk-4pn151fb.js` | 13551 | `edit_hook: op must be add, replace, or remove`, `edit_hook: source must be userSettings, projectSettings, or localSettings`, `policy_locked` | hook editing across the settings sources; this runtime edits its own hooks |
| `chunk-209y9f7t.js` | 13544 | `No task was started.`, `start_task upload cleanup timed out`, `managed_agents_task_file_upload` | hosted managed-agent task start with file upload, external |
| `chunk-vxwtr5mz.js` | 13505 | `reading it took too long`, `the account lists no design systems — build without one unless the user nam` | hosted design-system reads, external |
| `chunk-gz3f33zw.js` | 13490 | `VS Code settings read timed out`, `Scroll speed unchanged`, `high-rate wheel events` | IDE integration, external |
| `chunk-faj1q409.js` | 13423 | `hook_forwarding_disabled: policy`, `invalid_registration: request larger than 64 KiB`, `awaiting_upload` | hosted hook forwarding, external |
| `chunk-v61j0m6p.js` | 13387 | `usage: claude daemon scheduled remove <task-id>`, `daemon service is not installed` | daemon scheduled tasks; this runtime schedules its own |
| `chunk-2wf42wxk.js` | 13279 | `No terminal emulator detected`, `--window-save-state=never`, `osascript`, `apple_terminal`, `alacritty` | external terminal launch; this runtime runs in its own terminal |
| `chunk-rjtpt4bn.js` | 13268 | `@aws-sdk/credential-provider-ini - resolveAssumeRoleCredentials (STS)` | vendored AWS credential provider |
| `chunk-wvkmx4h8.js` | 13257 | `cd: unexpected stat errno`, `The environment block at the start of this conversation still names the previous directory — that information is stale.` | cd bookkeeping with a stale-environment notice; this runtime tracks its own directory |
| `chunk-566cpr3w.js` | 13221 | `<persisted-output>`, `tengu_tool_result_persisted`, `tengu_tool_empty_result` | tool result persistence; this runtime persists and truncates its own |
| `chunk-9nbnj2a9.js` | 13206 | `Let's get you set up — takes a few minutes. What kind of work do you do?`, `Product management` | onboarding survey, a product surface without a local counterpart |
| `chunk-z7whhrje.js` | 13188 | `useTerminalNotification must be used within TerminalWriteProvider` | recovered terminal-write view provider, UI |
| `chunk-fcpmj1yh.js` | 13144 | `https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local f`, `git URL contains control characters`, `git URL contains %00`, `git URL has a square bracket that git could read as the host` | git URL parsing guards; the same vetting family as W09 and W10, for URLs rather than paths |
| `chunk-vbfs7rth.js` | 13093 | `invalid block type`, `invalid length/literal`, `invalid UTF-8 data`, `extra field too long` | inflate error surface; this runtime decompresses its own |
| `chunk-w3s83mfm.js` | 13085 | `AGENTS.md as project instructions: by default loaded where the project has no CL`, `no CLAUDE.md found; AGENTS.md loaded` | the project-instruction loader family whose imports W10 vetted |
| `chunk-yps0v79v.js` | 13083 | `${v(y.name,y.aliases)}`, `***SensitiveInformation***` | sensitive-value redaction helper; this runtime redacts its own |
| `chunk-zs1fqezg.js` | 13069 | `skill_mcp_claudeai_bearer_rejected`, `tengu_mcp_skills_funnel`, `skill_mcp_load` | hosted skill MCP loading with a bearer token, external |
| `chunk-h79w96jw.js` | 12989 | `submodule inspection deadline`, `its submodules' state could not be read`, `^submodule\\..*\\.path$`, `gitdir_outside_modules`, `nested_repository` | Git submodule state inspection with a deadline and unverifiable states; corroborates the slice fifteen candidate, which covers the Git directory itself |
| `chunk-gqagkf48.js` | 12976 | `import hashlib,os,sys`, `os.path.getsize(p)<=n or fail('too large')`, `integrity_failed`, `interpreter_untrusted` | a helper's integrity and interpreter checked before it runs; this runtime verifies its own build identity |
| `chunk-xhgxg5se.js` | 12878 | `Guest passes dialog dismissed`, `Referral link copied to clipboard!`, `tengu_guest_passes_link_copied` | guest passes, hosted |
| `chunk-hfrxdgkk.js` | 12853 | `File has not been read yet`, `File must be read first`, `Error editing file` | read-before-edit precondition; this runtime enforces its own |
| `chunk-qz5ejfv9.js` | 12842 | `Deciding from the page needs this Artifact to be able to update itself`, `Or type your own answer…` | artifact-declared decisions, hosted |
| `chunk-73z04srf.js` | 12761 | `not a plain file name here`, `another program holds the file`, `a link stands at the name`, `unstable_identity`, `serial64`, `serial32` | file identity by serial with unstable-identity states, the family W09 ported |
| `chunk-czbq7s7d.js` | 12761 | 93% logic, one marker, `suggestion` | pure code leaf |

Sixty modules are dependency aggregators with no literal of their own - fifty-eight of them 95% or more import statements, two carrying only a one-word marker (an availability label and a workflow-kind label). Their readable text is a dependency list, so they carry this band's byte mass and almost none of its content, and they are recorded as a group for that reason rather than one row each.

The band reads as sixty dependency aggregators, one pure code leaf, twenty modules with local counterparts, thirteen hosted surfaces (the plugin directory, fast-mode credit accounting, self-hosted runner administration, promotional offers, cloud transcripts and device-attached hooks, design-system reads, managed-agent task start, IDE integration, hook forwarding, hosted skill MCP loading, guest passes and artifact decisions), two vendored AWS packages, two modules excluded with credentials and one product surface without a local counterpart. It records no new candidate, and two of its modules are pointers into candidates already open: the Git submodule inspection extends the Git-directory candidate slice fifteen recorded, and the file-serial identity checks extend the identity family W09 ported. A third pointer is the git URL guard, which applies the W09/W10 vetting family to a URL rather than a path, and a fourth is the project-instruction loader whose imports W10 vets - the loader itself is this runtime's own.

## Slice eighteen: uncited modules ranked 621 to 720

Ranks 621-720 of the uncited list (1,027,709 bytes, 100 modules, 12,645 bytes down to 9,254). The shape reverses here: only 21.0% of the band is import text and ninety-three of the hundred modules carry readable content (one of them only a three-word marker), against sixty aggregators in the previous band. This is the first band where the modules are mostly small logic and copy rather than dependency lists, and several of them are the very mechanisms this session runs - the goal proposal, its `/goal` command text, the loop skill's own prompt bundle, the subagent hand-back text and the cross-session inbound gate.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-vgwm5mc0.js` | 12645 | `page with a smaller \`query.limit\``, `narrow with a \`query.where\``, `viewers of this artifact (share status could not be confirmed)` | artifact database read guidance, hosted |
| `chunk-237kfbc1.js` | 12644 | `If waiting for a background task you started with \`run_in_background\``, `PowerShell edition: PowerShell 7+ (pwsh)` | Bash tool description across shells; this runtime documents its own |
| `chunk-5vztnqym.js` | 12637 | a subagent definition with `shutdown`, `disabled`, `unreadable` states | subagent definitions; this runtime registers its own agents |
| `chunk-0rgbqesw.js` | 12597 | `[bridge:peers] list body \`data\` not an array; stopping`, `this cloud session cannot message other sessions yet` | bridge peer listing, hosted |
| `chunk-k9bc38yt.js` | 12513 | the `prompt-audit` subcommand instructions including `No project language was auto-detected` | shipped skill text, not runtime logic |
| `chunk-1t033v1j.js` | 12458 | `plugin copy source swapped for a non-regular file mid-copy`, `in-place write refused: the target has other names (a hard link)`, `original target restored` | plugin copy integrity; extends the slice fourteen write-path candidate |
| `chunk-p6ha32r1.js` | 12452 | `The sandbox_violations lines in the output name what it blocked.`, `This answer to a permission request`, `stopped_by_person`, `time_limit` | permission answer outcomes; this runtime answers its own |
| `chunk-431ax568.js` | 12370 | an IPv4 regex, a hostname label regex, `use_dualstack_endpoint`, `use_fips_endpoint` | vendored AWS endpoint rule set |
| `chunk-qr8es7b8.js` | 12309 | `claude.ai connectors`, `applyConnectionResult: disposing orphaned connect (slot config changed mid-fli` | MCP connector lifecycle; this runtime connects its own servers |
| `chunk-dcpmzpza.js` | 12243 | `Running in cloud session \xB7 `, `Running in background \xB7 `, `remote_launched` | status line variants; this runtime prints its own |
| `chunk-3w2sqbe6.js` | 12234 | `Stateless transport cannot be reused across requests`, `Not Acceptable: Client must accept text/event-stream`, `Only one SSE stream is allowed per session` | MCP HTTP transport errors; this runtime has its own transport |
| `chunk-zm79vshj.js` | 12212 | `File has been modified since read, either by the user or by a linter`, `when_to_use`, `created_by`, `improved_by` | read-before-edit and skill metadata; this runtime enforces its own |
| `chunk-jrz2zk22.js` | 12204 | `**/.claude/scheduled_tasks.lock`, `**/.claude/routines/.state/`, `tengu_scheduled_task_missed`, `next_fire_unresolvable` | scheduled tasks and routines layout; this runtime schedules its own |
| `chunk-sf3bgjbg.js` | 12158 | `\bsimctl\b\|-sdk iphonesimulator\|-sdk iphoneos`, `agent_progress`, `skill_progress` | progress event kinds and platform detection |
| `chunk-ar9xtx80.js` | 12114 | `what is Claude Tag`, `can Claude live in Slack`, `set up Claude for my Slack workspace` | shipped skill text for a hosted product |
| `chunk-rzdtfaj8.js` | 12109 | `not_owner`, `not_typed`, `local_command`, `tengu_update_refused` | update refusal reasons; this runtime updates its own way |
| `chunk-ma8kg8hy.js` | 12036 | `stuck on a startup dialog`, `open this session to continue setup`, `bg_rv_gate`, `unauthed_drops` | background keepalive gating; this runtime keeps its own |
| `chunk-syb27zr1.js` | 11933 | `invalid request: expires_at is required when output_files are declared`, `staged mcp_call timed out`, `lane_path_reserved` | staged cloud MCP calls, hosted |
| `chunk-dxp0113e.js` | 11914 | `binary content was not saved`, `[Another PDF in this result was left out: only the first is shown.]` | attachment persistence and truncation; this runtime handles its own |
| `chunk-483ez8ct.js` | 11872 | `Class extends value `, ` is not a constructor or null`, `Generator is already executing.` | vendored runtime-helper error text |
| `chunk-cn1c6arp.js` | 11833 | `Optional server name to filter resources by`, `MIME type of the resource`, `Server that provides this resource` | MCP resource listing fields; this runtime lists its own |
| `chunk-55s9m4r4.js` | 11831 | `CCR_AGENT_PROXY_TOKEN_FILE_DESCRIPTOR is not a descriptor number of 3 or more`, `this process has an IPC channel` | cloud agent proxy token handoff, hosted |
| `chunk-7cz73w46.js` | 11815 | `Error editing notebook` | notebook edit error; this runtime edits its own |
| `chunk-81td4hgc.js` | 11774 | `ECDSA signature must be a Base64 string or a Buffer`, `Unexpected data type (` | vendored Node crypto error text |
| `chunk-02army2d.js` | 11744 | `wif_unavailable`, `unix_socket_skip`, `no_profile_scope_403` | workload-identity bootstrap, excluded with credentials |
| `chunk-ba5tgr3e.js` | 11733 | `behavior must be one of: allow, deny, ask`, `each rule must be at most 10000 characters`, `rules must be an array of 1 to 100 strings` | permission rule validation with stated bounds; this runtime validates its own rules |
| `chunk-xxhayked.js` | 11640 | `.pick() cannot be used on object schemas containing refinements`, `.omit() cannot be used on object schemas` | vendored zod error text |
| `chunk-vr7yfckx.js` | 11586 | `[FileIndex] skipped index rebuild — merged paths unchanged`, `core.quotepath=false` | file index over git ls-files; this runtime indexes its own |
| `chunk-p2ct4tzw.js` | 11572 | `I was just about to type that`, `No tools needed for suggestion`, `tengu_prompt_suggestion_init` | prompt suggestion behind a flag, product surface without a local counterpart |
| `chunk-vmgyazz0.js` | 11541 | `HKCU\Software\Google\Chrome\NativeMessagingHosts`, `SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths` | browser native-messaging registration, external |
| `chunk-ryyp81k6.js` | 11524 | `newly blocked on a decision you won't make alone, you're ending the loop`, `<<loop.md-dynamic>>` | shipped loop skill text, not runtime logic |
| `chunk-20t62004.js` | 11463 | `[cu-esc] user escape, aborting turn`, `Claude is using your computer \xB7 press Esc to stop`, `read_clipboard` | computer use, external |
| `chunk-pw2pw9tj.js` | 11444 | `must be the file_id from the notification`, `read a relayed inbox message from a linked thread` | session inbox file relay; this runtime relays its own |
| `chunk-1q7m8rey.js` | 11441 | `decode-token: not a JWT — expected 3 dot-separated base64url segments`, `token has no numeric \`exp\` claim` | token decoding utility, excluded with credentials |
| `chunk-hm9h07cn.js` | 11431 | `Cannot use the MCP needs-auth cache file in a diskless session`, `The full callback URL from the browser address bar` | MCP OAuth callback, excluded with OAuth |
| `chunk-e0449cqm.js` | 11343 | `https://downloads.claude.ai/model-catalog/v1/catalog.json`, `managed_key`, `not_spki_pem`, `modulus_too_short` | hosted model catalog verified against a pinned key, external |
| `chunk-46pdabck.js` | 11307 | `deny_rules_over_bounds`, `carries_asks_key`, `crashed_check` | MCP serve permission bounds; this runtime applies its own |
| `chunk-bd84n5am.js` | 11306 | `Int64 buffers must be exactly 8 bytes`, `Signature version 4 presigned URLs must have an expiration date` | vendored AWS SigV4 error text |
| `chunk-pdf06tgz.js` | 11289 | `Automatic replies to comments on the Artifact(s) this session was answering mo`, `holder_unreachable` | artifact comment-reply handoff, hosted |
| `chunk-s4k4pk2n.js` | 11254 | `an AWS or gcloud identity file is over 4 MB or not a regular`, `an IAM or SCP policy denies the call`, `sso_role_name` | third-party provider identity files, excluded with credentials |
| `chunk-c0zba9s1.js` | 11231 | `No cells found in notebook`, `Unchanged since last read` | notebook read with an unchanged check; this runtime reads its own |
| `chunk-p55rpzef.js` | 11147 | `Whether to ask the user for approval before the goal is set. Defaults to true `, `tengu_goal_proposal_available`, `plan_mode` | the goal proposal mechanism this session runs |
| `chunk-521p4r0c.js` | 11094 | `the deny rules in your settings could not be checked for this call, so it is r`, `allowedMcpServers (managed): plugins outside policy may not add tools`, `Security default: seated outermost` | permission readings that fail closed when a check cannot run; this runtime's own readings follow the same shape |
| `chunk-s7977spq.js` | 11091 | 92% logic, markers `contextual`, `immediate`, `recording` | no characterising literal; runtime helper |
| `chunk-d7wfeeft.js` | 11086 | `Consumed gateway token from bg auth snapshot`, `bg auth snapshot missing accessToken` | background auth snapshot, excluded with credentials |
| `chunk-34bv7wfw.js` | 11068 | `newlineIsToken may not be used with patch-generation functions`, `\ No newline at end of file` | vendored diff library error text |
| `chunk-0ydceggj.js` | 11048 | `[cross-session-inbound] held peer message approved but DROPPED by the ingress `, `[cross-session-inbound] permission-mode getter not wired (fail-closed` | cross-session inbound gating; this runtime gates its own peer messages |
| `chunk-9yt87bk7.js` | 11038 | `Nothing was published or removed: this publish touches files whose published c`, `Changed since you last saw them:` | artifact publish pins, hosted |
| `chunk-5kbrsvzx.js` | 10958 | `Your organization has configured managed settings that could allow execution o`, `Only accept if you trust your organization's IT administration` | managed-settings trust prompt; the file mechanism W08 ported, this prompt is unported |
| `chunk-4700evkk.js` | 10948 | `Spinner ignored an API retry status it could not draw (session unaffected)` | retry-status rendering degradation; this runtime renders its own |
| `chunk-790w8tcz.js` | 10904 | `/goal clear to stop early`, `/goal <condition> to set another` | the `/goal` command text this session runs |
| `chunk-nvcqkjfn.js` | 10800 | `[Subagent hand-back] The text below is the final report of a subagent this ses`, `handback-send-enforce`, `countermand` | subagent hand-back text enforcement; this runtime has subagents |
| `chunk-dqmk1qrr.js` | 10785 | `tool_result blocks are not matching any tool_use from the previous message`, `Client does not support sampling tools capability.` | MCP message validation; this runtime validates its own |
| `chunk-570dddxt.js` | 10671 | `Pin model versions`, `Each candidate is tested with a one-token request:` | model pinning wizard, product surface without a local counterpart |
| `chunk-vkjg8e3b.js` | 10536 | `DER: truncated element header`, `DER: non-minimal length encoding`, `no_embedded_root`, `bad_chain` | certificate-chain parsing, external |
| `chunk-vqjpjzkw.js` | 10523 | `<!--claude-mermaid-runtime-begin:`, `<!--claude-hljs-runtime-end-->` | asset injection into a generated page, product surface without a local counterpart |
| `chunk-rtf1gae9.js` | 10403 | `Failed to parse request: could not parse request body as JSON`, `ccr_worker`, `tengu_gzip_request_bodies` | gateway request handling, hosted |
| `chunk-jhr6hg8z.js` | 10372 | `[externalMetadataToAppState] Refusing restored mode 'bypassPermissions' (disab` | session state restore refusals; this runtime restores its own |
| `chunk-9f9hx2aq.js` | 10364 | `Arabic Syriac Nko Mongolian Devanagari Bengali Gurmukhi Gujarati Oriya Tamil T`, `Removed 1 invisible character` | invisible-character stripping by script group; this runtime strips its own |
| `chunk-886tf6ja.js` | 10347 | `[object DOMException]`, `Request was aborted.`, `Request timed out.` | HTTP failure shapes; this runtime maps its own |
| `chunk-bhbpsqk0.js` | 10341 | `Not a sandbox settings edit.`, `Sandboxing is not available on this platform.` | sandbox settings edits; this runtime has its own sandbox surface |
| `chunk-aesdaxt1.js` | 10164 | `a served shell line's read-only check threw; the line counts as not read-only`, `the parser gave up on the command` | shell readings that treat a throwing check as adverse, the shape W01's conservative readings use |
| `chunk-vhvxrq53.js` | 10139 | `(string, too long or not snake_case)`, `public_grouping_hosted_only` | name validation and grouping flags |
| `chunk-11zpdqkt.js` | 10111 | `waiting for your answer in the elicitation dialog`, `runs on the server; survives exiting this session` | MCP elicitation; this runtime answers its own |
| `chunk-rgbrxhz0.js` | 10088 | `artifact_sha256 is missing or not 64 lowercase hex chars`, `bundle_size_bytes is missing or not a positive integer` | workflow bundle validation; this runtime runs its own workflows |
| `chunk-bngc1aq9.js` | 10086 | `Team file missing (session team not initialized)`, `Team file update failed (storage v5)` | team file storage v5; this runtime stores its own state |
| `chunk-fzk4rpqy.js` | 10030 | `kitty graphics: payload must be standard base64`, `kitty graphics: an id, cell count or pixel size must be a positive integer` | terminal graphics protocol validation; this runtime prints its own |
| `chunk-2qm6fz2x.js` | 9982 | `Sent to Claude on each fire. Slash commands work.`, `5m, 2h, 1d  or  */15 * * * *` | scheduled task creation text; this runtime schedules its own |
| `chunk-vs2c1rb6.js` | 9870 | `tengu_vertex_probe_result`, `tengu_vertex_default_check`, `fallback` | Vertex model probing, hosted |
| `chunk-xmvfy87k.js` | 9843 | `Workspace changes aren't available over this connection — showing per-tur`, `remote_workspace_diff_fetch` | remote workspace diffs, hosted |
| `chunk-82qkaak3.js` | 9808 | `Spinner tips as a plugin: the tip line under the spinner`, `tip advertisedCommand check threw` | plugin-provided spinner tips; this runtime has its own plugins |
| `chunk-9a05m92j.js` | 9803 | `[Computer Use MCP] Starting MCP server` | computer use server, external |
| `chunk-c38jjqy6.js` | 9779 | `A file path cannot be attached here: this tool cannot read files in this sessi`, `not delivered: this session is not on a project thread` | SDK-hosted session delivery rules, hosted |
| `chunk-yv3rvqk7.js` | 9750 | `https-proxy-agent:parse-proxy-response`, `Proxy connection ended before receiving CONNECT response` | vendored proxy agent error text |
| `chunk-ksjypbtc.js` | 9748 | `blocked by a UserPromptSubmit hook`, `Prompt blocked: the UserPromptSubmit hooks did not run over the submitted text` | prompt-submit hooks; this runtime runs its own hooks |
| `chunk-tadwrn0a.js` | 9736 | `Claude Tag in Slack`, `Claude Tag in Teams`, `remote_trigger` | hosted chat channels, external |
| `chunk-0c58fh5r.js` | 9704 | `The artifact named in this session's opening context carries an instructions f`, `the share probe took longer than the prefetch budget` | artifact instructions and prefetch budget, hosted |
| `chunk-dhr14qkh.js` | 9685 | `tengu_turn_handoff_files_by_name_refresh`, `row_refused`, `left_occupied` | turn handoff file bookkeeping; this runtime keeps its own |
| `chunk-6e3rp7gr.js` | 9678 | `tengu_fullscreen_crash_auto_off`, `bg_forced_on` | recovered fullscreen mode handling, UI |
| `chunk-0gkanwwq.js` | 9648 | `This Claude apps gateway is in load-test mode. This is a canned reply`, `load_test_mode is on, but the database at store.postgres_url` | gateway load-test mode, hosted |
| `chunk-y8g1gshe.js` | 9620 | `STARTUP PROFILING REPORT`, `before_mcp_prewait`, `stdin_listen_started` | startup profiling; this runtime measures its own |
| `chunk-bw56p3n4.js` | 9567 | `Your organization requires Trusted Devices for Remote Control, but enrollment `, `tengu_bridge_attestation_enforce` | trusted-device enforcement, hosted |
| `chunk-814d81ex.js` | 9544 | `workspace_moved`, `path_not_canonical`, `unsupported_name`, `read_rule` | filesystem error classification; this runtime maps its own |
| `chunk-ht2xnjba.js` | 9506 | `The setup-token command will create a new OAuth token`, `Claude subscription required.` | token setup flow, excluded with OAuth |
| `chunk-7sdm5x5t.js` | 9483 | `The \`level\` option should be an integer from 0 to 3` | vendored colour-support error text |
| `chunk-r7krvsz6.js` | 9451 | `, none differing from what you sent`, `no whole Read of it is needed: Read the lines you need with offset/lim`, `file_changed` | read-versus-changed comparison; this runtime compares its own |
| `chunk-a6ey48sd.js` | 9441 | `This setting cannot be changed from an editor started inside a Claude Code ses`, `Apply one permission-rule edit read as JSON from stdin` | editor integration restrictions, external |
| `chunk-6p9pc4n6.js` | 9439 | `Mapper function is required`, `inflates_to_other_bytes`, `no_flush_marker` | a bounded block store with an inflate check; this runtime stores its own |
| `chunk-q7m0q8zw.js` | 9436 | `enter to interrupt and send \xB7 ctrl+x then enter to queue`, `You're absolutely right`, `I apologize for the confusion` | composer key hints and assistant-phrase detection, UI |
| `chunk-8pet3bvp.js` | 9367 | `the file was replaced or changed after its path was checked`, `a link stands above the spelled name`, `tempdir_owner_mismatch` | file identity after a path check, the family W09 ported |
| `chunk-rstskas0.js` | 9323 | `Not in remote mode. Start with \`claude --cloud\` to use this command.`, `Generating QR code…` | remote session view, hosted |
| `chunk-12ahet8x.js` | 9254 | `tengu_mantle_probe_result`, `admin_pin`, `tengu_mantle_default_check` | admin-pinned configuration probing, hosted |
| `chunk-cndbk9b4.js` | 9254 | `An update to our Consumer Terms and Privacy Policy will take effect on`, `Allow the use of your chats and coding sessions to train` | hosted policy acceptance, external |

Eight modules carry no characterising literal of their own: three are mostly import text, four are pure logic, and one, listed above for its three markers, carries nothing else.

The band reads as forty-eight modules with local counterparts, twenty-three hosted surfaces, eight vendored packages, six modules excluded with credentials or OAuth, three shipped skill or product texts, three product surfaces without a local counterpart, one recovered UI module and eight with no characterising literal. It records no new candidate, and four of its modules point into work already open or already ported: the plugin copy integrity rule (a source swapped mid-copy, an in-place write refused because the target has another name, the original target restored) and the file identity checks that run after a path check both extend the write-path and identity families the slice fourteen candidate and W09 cover; the permission modules that state concrete rule bounds and that fail closed when a check cannot run extend the family W01 vetted; and the shipped skill texts - the audit subcommand, the chat-channel skill and the loop skill's own prompt bundle - are the same kind of embedded text this project ports as skill content rather than as runtime logic.

## Slice nineteen: uncited modules ranked 721 to 820

Ranks 721-820 of the uncited list (772,295 bytes, 100 modules, 9,249 bytes down to 7,411). Import text is 35.4% of the band and 81 modules carry content; the modules are smaller than in the previous band and the band is where the client's plugin, daemon, bridge and agent-swarm plumbing sits.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-348b2aae.js` | 9249 | `the URL must be the https://downloads.claude.ai/ address Anthropic gave yo`, `it cannot be used in a cloud, remote-environment or ssh session`, `your organization's policy does not allow it` | a pinned download URL with session-kind and policy gates, hosted |
| `chunk-4qh9ecjv.js` | 9192 | `<function_results>`, a string joiner that guards letter-adjacent punctuation | tool result framing; this runtime frames its own |
| `chunk-9d9dw68h.js` | 9187 | `\\.\pipe\cc-daemon-*` | daemon pipe naming; this runtime names its own |
| `chunk-b5qrs9dw.js` | 9176 | `git's configuration for the repository could not be read in full`, `the repository's own git config has a conditional include (includeIf)`, `if that setting is yours, move it to your global git config` | git config read vetting with an actionable message; extends the Git family slice fifteen opened |
| `chunk-rq8b22hr.js` | 9249 | `Loading Claude Code sessions…`, `tengu_teleport_resume_session` | session teleport resume, hosted |
| `chunk-64ag51qf.js` | 9143 | `claude-swarm-${process.pid}`, `different`, `reply_across_default_dirs` | swarm identity naming; this runtime names its own |
| `chunk-mzp16wqa.js` | 9139 | `Dynamic workflow `, `workflow_agent`, `workflow_phase` | dynamic workflow failure text; this runtime runs its own |
| `chunk-g6j4g5k0.js` | 9136 | `hide/show plugin panel`, `focus plugin buttons, inputs and selects` | recovered plugin panel keybindings, UI |
| `chunk-vvnxcw4y.js` | 9103 | markers `pagedown`, `suggestion`, `inactive` only | no literal of its own |
| `chunk-5p9btghj.js` | 9098 | `Auto (match terminal)`, `Dark mode (colorblind-friendly)` | recovered theme picker, UI |
| `chunk-9rz2kgpd.js` | 9091 | `LSHandlerURLScheme = (?:http\|https);`, `osascript`, `defaults` | browser handler detection on macOS, external |
| `chunk-8x0s4t30.js` | 9078 | `Not set up \xB7 /web-setup to connect GitHub`, `/rename to add a name`, `not available on third-party providers` | command hints; this runtime has its own commands |
| `chunk-c6egb88x.js` | 9078 | `daemon.json v5 read failed`, `invalid 5-field cron expression`, `task ids must be unique` | scheduled task store; this runtime stores and validates its own |
| `chunk-e4yc5z5q.js` | 9066 | `Requires the Chrome extension. Get started at`, `Site-level permissions are inherited from the Chrome extension` | browser extension onboarding, hosted |
| `chunk-yv8cbqsb.js` | 9038 | `Wellbeing settings are not available in this build` | settings surface; this runtime has its own |
| `chunk-c9eya63j.js` | 8968 | `runner_prep_git_proxy_config_ms`, `runner_prep_reset_remote_ms`, `runner_prep_outcome_branch_ms` | self-hosted runner preparation timing, hosted |
| `chunk-gk1qp4f7.js` | 8938 | `linked_worktree`, `alternates`, `leads_nowhere`, `win32_handle` | git directory entry classification; extends the Git family slice fifteen opened |
| `chunk-05jp8hm2.js` | 8869 | `A re-queried tool list was not applied: another server holds the name` | MCP name collision handling; this runtime resolves its own |
| `chunk-ed7zyzrn.js` | 8864 | `data nested too deep to freeze` | serialization guard; this runtime has its own |
| `chunk-h8atc0s7.js` | 8802 | `Read the output file to get the result (it is gone if the restart replaced`, `No output file was recorded for them` | background task output recovery; this runtime keeps its own |
| `chunk-1w9hc2bp.js` | 8791 | `bad argv: --bg-pty-host <sock> <cols> <rows> -- <file> [args...]`, `tokens-file unreadable; DATA gate fail-open` | background pty host; this runtime has its own |
| `chunk-yhn1d8p4.js` | 8776 | `https://claude.ai/mobile?entrypoint=claude_code_cli`, ` to continue this session from your phone` | mobile handoff, hosted |
| `chunk-cmfs7m7p.js` | 8762 | `flagged plugins v5 write failed`, `tengu_plugin_delisted_enforcement` | hosted plugin delisting enforcement |
| `chunk-2band22t.js` | 8723 | markers `policy_pending`, `policy_denied` only | no literal of its own |
| `chunk-7mc2hgym.js` | 8686 | `manifest_invalid`, `identity_unverified`, `archive_not_probed`, `will_not_load` | plugin manifest admission states; this runtime admits its own |
| `chunk-v2xyc5y8.js` | 8685 | `[bridge:population] walk ran under a previous identity — ignoring its`, `[bridge:population] failed walk — cleared the printed set` | bridge population walk, hosted |
| `chunk-9r54k71g.js` | 8675 | `plugin_load_workflows_dir_failed`, `plugin_load_workflows_path_failed`, `workflow_discover` | plugin workflow discovery; this runtime discovers its own |
| `chunk-y59djfw7.js` | 8661 | `shortWordSlugFromSeed needs at least 8 seed bytes`, `abundant`, `cheerful`, `dazzling` | slug generation from a seed; this runtime names its own |
| `chunk-vdj4qqgg.js` | 8637 | `</system-reminder>`, `malformed_inline_pastes`, `inline_pastes_cut` | reminder and inline-paste handling; this runtime composes its own |
| `chunk-t7yfgdvh.js` | 8619 | `[Image data detected and sent to Claude]`, `Running in the background` | image placeholder and background notice; this runtime handles media its own way |
| `chunk-daspryhm.js` | 8587 | `Failed to resolve AWS credentials from the credential provider chain.`, `Expected request method property to be set` | vendored AWS fetch handler error text |
| `chunk-70sep977.js` | 8555 | `[it2Setup] Found uv (will use uv tool install)`, `swarm_iterm2_it2_install` | iTerm2 helper installation, external |
| `chunk-fy7za2r0.js` | 8558 | `daemon pipe.key is not a valid nonce`, `refusing to use the daemon socket: this process runs in a user namespace w` | daemon socket security; this runtime guards its own |
| `chunk-qhgkvad6.js` | 8539 | `Sandbox settings are locked by policy.`, `Windows sandbox install is only available on native Windows.` | sandbox policy surface; this runtime has its own |
| `chunk-04v7vxqn.js` | 8521 | `┌─┐`, `workflow_size_guideline_change` | recovered box-drawing panel, UI |
| `chunk-jtkw6zm9.js` | 8510 | markers `suggestion`, `continue` only | no literal of its own |
| `chunk-npygwqnj.js` | 8506 | `This machine is attached but does not run commands for this session.`, `The bridge service's own identify probe, sent with no session.` | device bridge tool refusal, hosted |
| `chunk-n2brnzkz.js` | 8496 | markers `pr_create`, `callback` only | no literal of its own |
| `chunk-cg61h5m8.js` | 8488 | `Design OAuth lock contention: another process is holding the refresh lock` | OAuth token refresh lock, excluded with OAuth |
| `chunk-7tgm5mkw.js` | 8469 | `The notification body. Keep it under 200 characters; mobile OSes truncate.`, `Push not sent — mobile push is disabled in /config.` | a notification tool, product surface without a local counterpart |
| `chunk-xrjhyksm.js` | 8469 | `MCP skill builders not registered — loadSkillsDir.ts has not been eva` | skill host wiring; this runtime loads its own skills |
| `chunk-3857kmpe.js` | 8468 | `<<autonomous-loop>>`, `<<autonomous-loop-dynamic>>`, `This must be ordinary visible response text` | shipped loop skill text, not runtime logic |
| `chunk-cpzpr7hy.js` | 8466 | `No HttpAuthScheme was selected: unable to sign request`, `Deserialization error: to see the raw response` | vendored AWS serializer error text |
| `chunk-w98nk8wq.js` | 8438 | `Drafted by Claude via the SendFeedback tool; approved by the user from the`, `Feedback payload too large.` | feedback drafting, product surface without a local counterpart |
| `chunk-7hvh6zks.js` | 8416 | `schema document must be an object`, `unsupported format version`, `island must be a token` | schema document validation; this runtime validates its own |
| `chunk-067g73sj.js` | 8372 | `Your message via Slack` | hosted chat channel, external |
| `chunk-54t850gd.js` | 8342 | `Deliver your final report to the agent that spawned you: the only way it r`, `Your full report for your caller` | a subagent hand-back tool; this runtime has its own subagents |
| `chunk-s5a4x1xw.js` | 8280 | `Run /sandbox install, or see https://code.claude.com/docs/en/sandboxing.` | sandbox setup guidance; this runtime guides its own |
| `chunk-eh8jynp0.js` | 8249 | `refresh succeeded but projects scopes not granted`, `## Project description`, `allow_projects_tool` | hosted project context behind a policy verdict |
| `chunk-3dnyxzpb.js` | 8224 | marker `suggestion` only | no literal of its own |
| `chunk-nnwag7zt.js` | 8147 | marker `nochange` only | no literal of its own |
| `chunk-1hwe35j8.js` | 8139 | `Authorization code not found`, `oauth_callback_listener`, `Your account is on hold.` | OAuth callback listener, excluded with OAuth |
| `chunk-8d1w41f2.js` | 8128 | markers `read_it_first`, `not_as_read`, `over_the_cap` | no literal of its own |
| `chunk-mwn972p1.js` | 8052 | `Socket server listening for connections`, `Socket permissions set to 0600`, `chrome_native_host_run` | native messaging host, external |
| `chunk-sg9tedwm.js` | 8046 | `id=\\"ws-decisions\\"`, `wiring up the decisions` | hosted workshop surface |
| `chunk-cx7rxhps.js` | 8022 | `not seated: managed prependPlugins does not list it`, `seated outermost: this machine has managed settings`, `a managed settings source on this machine was not read whole (a load error` | **reclassified 2026-10-12**: the plugin tier-seating rule has no surface here - see the band note |
| `chunk-rk6tjv7j.js` | 7945 | 98% logic, a hand-written tokenizer | pure code leaf |
| `chunk-e25gqp1f.js` | 7905 | `registerPlan: plan failed shape validation`, `missing plan_token or project_id`, `update_sharing` | hosted sharing plan validation |
| `chunk-sygzmvn5.js` | 7860 | `[closeSessionTabGroup] bridge not connected, skipping`, `tabs_context_mcp timed out` | browser tab groups, hosted |
| `chunk-5j20d6j1.js` | 7855 | markers `here_unreadable`, `probe_failed`, `listing_capped` | no literal of its own |
| `chunk-mxcjeah2.js` | 7853 | markers `workspace_root`, `diff_root` | no literal of its own |
| `chunk-jfcanjcw.js` | 7789 | `Could not determine current tmux pane/window`, `swarm_pane_spawn` | tmux swarm panes; this runtime manages its own |
| `chunk-pc717mjq.js` | 7785 | `[DaemonLock] v5 acquire write failed`, `pid_recycled`, `predates_boot` | daemon lock with pid-recycling checks; this runtime locks its own |
| `chunk-dsnmd3xt.js` | 7732 | `Unable to connect to instance metadata service`, `ec2_metadata_v1_disabled` | vendored AWS instance metadata client |
| `chunk-xbbaeft1.js` | 7703 | marker `daemon_bg_reap_all` | no literal of its own |
| `chunk-2wbpq63f.js` | 7702 | `compact_sleep`, `tengu_sleep_compact_fired`, `newer_request` | compaction while idle; this runtime compacts its own |
| `chunk-4f7jg7jp.js` | 7701 | `Prometheus stopServer() was called but server was never started.`, `# no registered metrics` | vendored Prometheus exporter text |
| `chunk-4jpx7fsy.js` | 7649 | `path is inside a Claude temp folder, which background sessions can write t`, `only kept when set to a true value such as 1` | temp-folder exclusion rules; this runtime scopes its own |
| `chunk-82stne6k.js` | 7642 | markers `skills_sync_host_mount_miss`, `earlier_work_outstanding`, `budget_spent` | no literal of its own |
| `chunk-wh2a5yfa.js` | 7606 | markers `persistent`, `readonly` | no literal of its own |
| `chunk-w4jyayj8.js` | 7595 | `fullscreen trial: healthy — persisted settings.tui=fullscreen`, `fullscreen trial: renderer is not fullscreen this session` | recovered fullscreen trial handling, UI |
| `chunk-tp2dds3e.js` | 7586 | `yield_artifact_replies`, `artifact_comments_autoreact`, `yield_answer_pid_mismatch` | hosted artifact reply yielding |
| `chunk-f8pbmdmz.js` | 7583 | `tengu_bedrock_probe_result`, `tengu_bedrock_default_check`, `fallback` | Bedrock model probing, hosted |
| `chunk-qm7kbp9q.js` | 7575 | `[bridge] supervised session id refused (not a safe bridge id)` | bridge session identity check, hosted |
| `chunk-d65c1ax2.js` | 7570 | `#{client_control_mode}`, `tengu_pewter_brook`, `bg_forced_on` | recovered control-mode prompt, UI |
| `chunk-mp82pq0x.js` | 7564 | `Check once more only when the user says it is back or asks you to try agai`, `host_withdrawn`, `superseded`, `tool_withdrawn` | background command state; this runtime tracks its own |
| `chunk-6h68pvsc.js` | 7550 | markers `rc_owner`, `permission` | no literal of its own |
| `chunk-w0eqf91f.js` | 7544 | `deviceBind: malformed UUID`, `deviceBind: tool-host link capabilities must be 1 to 8 sorted, distinct na` | device binding validation, hosted |
| `chunk-p46ep603.js` | 7454 | markers `working_directory`, `allowed_tools`, `bash_command_clamp`, `sandbox_auto_allow_suspended` | tool context fields; this runtime passes its own |
| `chunk-k18762s9.js` | 7401 | `[servedCatalog] cache file oversized`, `/login managed key`, `allow_model_catalog` | hosted catalog cache with a managed key |
| `chunk-061ctddf.js` | 7398 | `Launch and drive this project's app to see a change working.` | shipped skill text, not runtime logic |

Nineteen further modules carry no literal of their own at all; all but four are mostly import text, and they are recorded as a group.

The band reads as thirty modules with local counterparts, eighteen hosted surfaces, thirty-two modules with no literal of their own, five recovered UI components, four vendored packages, three external surfaces, two modules excluded with OAuth, two product surfaces without a local counterpart, two shipped skill texts, one pure code leaf and one candidate. Two modules extend the Git family slice fifteen opened - a repository git config whose conditional includes or unreadable sections must be reported rather than silently used, and a classification of Git directory entries such as alternates, a linked worktree and a handler that leads nowhere.

The candidate is plugin admission under managed settings. The recovered client seats a plugin outermost only when a managed settings source lists or enables it on this machine, refuses to seat one that managed `prependPlugins` does not list, and treats a managed source that was **not read whole** - a load error - as not vouching. The local statement of coverage: `src/config.ts` reads a single managed settings file and takes only `allowShell`, `permissions`, `features` and `mcpClient` from it, then admits plugins from `settings.plugins` by schema and discovery, with no rule that a managed source must vouch for a plugin and no treatment of a partially read managed source as unable to vouch. That is a surface this runtime owns - it loads plugins and it reads managed settings - and the rule about the unreadable source is the part with no local counterpart at all.

## Slice twenty: uncited modules ranked 821 to 920

Ranks 821-920 of the uncited list (618,698 bytes, 100 modules, 7,391 bytes down to 6,379). Import text is 48.4% of the band and 62 modules carry content, twelve of those only through state-name markers. This band is the session-plumbing layer: cross-session messages and their holds, session naming and titles, subagent forks, connector-registry tools and the managed-settings gates that switch features off.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-eycnyycd.js` | 7391 | `tengu_session_name_uniqueness`, `session_name_collision`, `check_failed` | session name uniqueness; this runtime names its own sessions |
| `chunk-v9n7gch0.js` | 7352 | `session-channel PowerShell tool called without being routed to its m`, `PowerShellTool no longer declares an object schema` | a PowerShell tool variant; this runtime declares its own tools |
| `chunk-zv9f1yn8.js` | 7343 | `Author or improve the run-<unit> skill - a per-project skill that te` | shipped skill text, not runtime logic |
| `chunk-01svw805.js` | 7304 | `xcodebuild`, `fastlane`, `carthage`, `sdkmanager` | mobile build-tool detection; this runtime detects its own project types |
| `chunk-5b5m6pwc.js` | 7302 | `unhandled_rejection`, `uncaught_exception`, the issue and overview URLs | process error handlers; this runtime installs its own |
| `chunk-nv1qvpv3.js` | 7293 | markers `transcript`, `settings`, `identity`, `recording` only | no literal of its own |
| `chunk-wcg96dd6.js` | 7290 | `must be ISO 8601 with timezone, e.g. 2026-06-04T16:00:00Z`, `/api/oauth/organizations/:orgUUID/overage_credit_grant` | credit grants and a feature-of-the-week gate, hosted |
| `chunk-0h9tjxyg.js` | 7273 | `tengu_rc_thread_reply_gate`, `no_reply_needed`, `update_status` | Remote Control thread replies, hosted |
| `chunk-xejvy0xp.js` | 7195 | `file_store_probe_unreachable`, `file_store_verdict_publish_threw` | hosted artifact file store verdicts |
| `chunk-6gt8rg0t.js` | 7189 | `[bridge:projects] reply mount retries exhausted`, `the reply mount's name is no longer held by i` | bridge reply mounts, hosted |
| `chunk-7830sqqx.js` | 7163 | `Claude has ended this chat.`, `You are running as a background fork of the main conversation (for e` | background-fork session semantics; this runtime runs background sessions its own way |
| `chunk-rh12tz8k.js` | 7156 | `Guided setup — pick a role, install a matching plugin, try a sk` | guided setup, a product surface without a local counterpart |
| `chunk-bbpmnk1q.js` | 7145 | `Read-only analyst for a single artifact comment thread: pages throug` | hosted artifact comment reader tool |
| `chunk-qnkxwr4a.js` | 7090 | `The Claude Design sign-in is not configured in this build.`, `Claude Design sync is not available in this session.` | design sign-in states, hosted |
| `chunk-r9b1bf0c.js` | 7068 | `a cloud session does not run command, script, HTTP or MCP tool hooks`, `invalid hook matcher` | hook matcher validation with a cloud-session rule; this runtime has its own hooks |
| `chunk-76mcc9yv.js` | 7060 | `list the user's installed MCP connectors`, `Connector registry is unavailable right now` | hosted connector registry tool |
| `chunk-mvsmkx6d.js` | 7060 | `env: CLAUDE_CODE_DISABLE_TERMINAL_TITLE`, `env: inside tmux or screen`, `CLAUDE_CODE_FORCE_TERMINAL_IMAGES` | terminal capability detection; this runtime detects its own |
| `chunk-ctdn785v.js` | 7020 | `Write the title in the predominant language of the session` | session title generation; this runtime titles its own |
| `chunk-15nhwk6k.js` | 6980 | markers `has_directory`, `too_long`, `odd_spelling`, `no_suffix` | no literal of its own |
| `chunk-s7g108e0.js` | 6928 | `ZIP archive (Office documents such as .pptx/.docx/.xlsx are ZIPs)` | file-type detection; this runtime classifies its own |
| `chunk-x602w4ez.js` | 6908 | markers `suggestion`, `inactive` only | no literal of its own |
| `chunk-0q6c90q6.js` | 6901 | `Quick, straightforward implementation`, `Comprehensive implementation with extensive testing`, `ultracode` | effort levels including ultracode; this runtime selects its own effort |
| `chunk-4q4hjaz0.js` | 6888 | `This session can run tools on this computer, so Claude Code must fir` | device attach binding, hosted |
| `chunk-41052r85.js` | 6863 | `Connect to Claude Design?`, `design consent POST blocked by policy gate` | design consent behind a policy gate, hosted |
| `chunk-j9jd60g4.js` | 6838 | `Approvals are asked in this session. This machine's rules and hooks `, `The person declined this call in the session — it did not run.`, `offered standing rule held` | session approval wording and outcomes; this runtime asks its own |
| `chunk-79q2xdk9.js` | 6826 | `Only the Artifact's owner can delete it.`, `Deleting Artifacts isn't available in this cloud session` | hosted artifact deletion states |
| `chunk-c69ep7ep.js` | 6825 | `XAA IdP: OIDC discovery failed: issuer is not a valid URL`, `mcp_xaa_idp_login` | identity-provider login, excluded with OAuth |
| `chunk-g92w1aqv.js` | 6796 | `truncateForPreview: redaction round-trip yielded no text for a field`, `non-object input exceeds the serialization depth` | preview truncation with redaction; this runtime truncates and redacts its own |
| `chunk-my0kzjs6.js` | 6793 | `discover MCP connectors by keyword`, `Connector registry is unavailable right now` | hosted connector registry tool |
| `chunk-5wvx6gd2.js` | 6771 | `since this conversation was last summarized`, `the split between groups is an estimate, since usage is metered per ` | usage since the last summary; this runtime accounts for its own |
| `chunk-nsm8z5rg.js` | 6770 | the same identity-provider login literals as its neighbour | a near-duplicate of the module above, excluded with OAuth |
| `chunk-rdnxaw2f.js` | 6759 | `resolve MCP connector payloads by directoryUuid` | hosted connector registry tool |
| `chunk-3sda67c1.js` | 6757 | `[win32-kernel32] bun:ffi loaded` | a Windows FFI load notice from the compiled bundle |
| `chunk-9yz707ke.js` | 6740 | `application/xhtml+xml`, `noframes`, `plaintext`, `foreignobject` | vendored HTML sanitizer tag and MIME tables |
| `chunk-ypz2er89.js` | 6730 | `the automatic continue at the usage-limit reset was cancelled (/rate`, `Claude Code couldn't restart. Your conversation is saved.` | quota auto-continue cancellation, hosted |
| `chunk-97q60twp.js` | 6729 | `No git remote URL found` | git remote lookup; this runtime resolves its own |
| `chunk-q28p7cy0.js` | 6701 | `[voice_stream] No OAuth token available`, `[voice_stream] Sending CloseStream (finalize)`, `linear16` | hosted voice streaming |
| `chunk-ecfjn15r.js` | 6698 | `spinnerTipsOverride.tipsFile from remote managed settings is ignored`, `must be a local path, not a network (UN` | a managed settings file that points at a network path is ignored - the W09/W10 vetting family applied to a managed setting |
| `chunk-ywpww1r2.js` | 6692 | `MCP servers may execute code or access system resources. All tool ca`, `Use this MCP server` | MCP consent wording; this runtime asks its own way |
| `chunk-wd3cdds3.js` | 6648 | markers `debugged`, `overrode`, `overwrote`, `understood` | no literal of its own |
| `chunk-9pfx07qm.js` | 6572 | `held by the receiving session`, `expired without approval`, `released after approval` | cross-session message holds; this runtime holds its own |
| `chunk-z3fv2hxp.js` | 6542 | `a command from a plugin`, `Rename it (folder and SKILL.md name) or delete it` | skill name collisions across sources; this runtime has its own skills |
| `chunk-hemf8mv9.js` | 6537 | `Another Claude session sent a message`, `This came from another Claude session — not typed by your user,` | the peer-message boundary this runtime also states in its own words |
| `chunk-mvs7kb6p.js` | 6537 | `marker has no integer schema_version`, `teleport state is not inactive` | teleport relay marker validation, hosted |
| `chunk-txz5nmp7.js` | 6519 | `expected header name to be a string`, `Private accessor was defined without a setter` | vendored fetch and private-field error text |
| `chunk-m9s94xen.js` | 6491 | marker `spare_claim_module_wait_ms` only | no literal of its own |
| `chunk-9dhv0d4w.js` | 6467 | `forked_skill_live_duplicate`, `forked_skill_depth_cap`, `subagent_launch` | subagent forks with a depth cap; this runtime launches its own |
| `chunk-pn0q31w0.js` | 6443 | marker `connector` only | no literal of its own |
| `chunk-tnjc84mp.js` | 6443 | marker `connector` only | no literal of its own |
| `chunk-gwhp9exw.js` | 6437 | marker `connector` only | no literal of its own |
| `chunk-gjzyk1qc.js` | 6430 | `Task list reset still in flight; not arming another hide until it se`, `useTasksV2 cannot be called outside of a TasksV2StoreContext provide` | recovered task-list store and its context guard, UI |
| `chunk-nmnavv08.js` | 6429 | `@smithy/util-utf8: toUtf8 encoder function only accepts string`, `Incorrect padding on base64 string.` | vendored AWS utility error text |
| `chunk-bgqhemy7.js` | 6419 | `The advisor is not available` | hosted advisor surface |
| `chunk-yfhs3yf4.js` | 6388 | marker `markdown` only | no literal of its own |
| `chunk-tf1y64kd.js` | 6383 | the same fetch and private-field error text as its neighbour | vendored, a near-duplicate |
| `chunk-yektmah3.js` | 6372 | `your organization's policy could not be checked yet`, `allow_plugin_directory_search` | hosted plugin directory search behind a policy |
| `chunk-378j80xp.js` | 6365 | `[model-access] stale-deny re-probe timed out`, `org_level_disabled_until` | hosted model access policy |
| `chunk-20dzvxpm.js` | 6338 | `exit-handoff agent flush timeout`, `task_local_agent_exit_handoff` | agent exit handoff; this runtime ends its own agents |
| `chunk-bh9bjk30.js` | 6334 | markers `withdrawn`, `announced`, `compatible`, `probe_missed` | no literal of its own |
| `chunk-zkxek575.js` | 6333 | `<skill-watcher-idle-wake>`, `skillChangeDetector: ConfigChange hook gate not wired` | skill file watching; this runtime watches its own config |
| `chunk-vw2b9ke9.js` | 6316 | `Code review did not run: workflows are turned off in this machine's `, `this machine's managed settings could not b` | workflows switched off when managed settings could not be read - the same unreadable-source rule slice nineteen recorded |
| `chunk-e6t05mh2.js` | 6314 | markers `completed`, `in_progress` only | no literal of its own |

Thirty-eight further modules carry no literal of their own; thirty-six of them are mostly import text and two are pure logic.

The band reads as twenty-three modules with local counterparts, fifty with no characterising literal of their own (twelve of those with state-name markers only), eighteen hosted surfaces, four vendored packages, two modules excluded with OAuth or identity-provider login, one shipped skill text, one product surface without a local counterpart and one recovered UI module. It records one candidate, the plugin admission rule in the table above - since reclassified on 2026-10-12, see the band note below - and two of its modules corroborate it from a different subsystem: a workflow is switched off when this machine's managed settings could not be read, and a tips file named by remote managed settings is ignored when it is a network path.

**Reclassified 2026-10-12: plugin tier seating.** `chunk-cx7rxhps.js` is not an admission gate but a tier-seating pass: for every plugin the managed settings enable, it decides whether that plugin's hooks load in the organization's tier or the user's, and it withholds the organization's tier - with a warning naming which condition failed - when the plugin does not load in place from a local folder its marketplace is registered from, or when the source it is registered from is named only by a managed settings source *the session does not vouch for* (remote managed settings the server has not confirmed this session, or a document the user account can write), or when no managed source names that source at all. The half that would generalise is the one it states outright: `a managed settings source on this machine was not read whole (a load error, or a plugin key it could not apply), so what it says of plugins is not known`.

Checked against the local product before recording. `src/config.ts:938-944` reads the one managed settings file as *required*, rejects any key outside `allowShell`, `permissions`, `features` and `mcpClient`, and `readSettingsLayer` (`src/config.ts:414`) throws on a missing required file, an oversize file, invalid JSON and a non-object - so a managed source that cannot be read whole aborts configuration rather than being treated as having spoken, which is stronger than withholding a tier and leaves no rule missing there. The seating half has nothing to land on: this runtime has no plugin tier, no marketplace registration, no `enabledPlugins` list and no remote managed settings source, and `src/plugins.ts` plugins are inert local directory snapshots discovered from a store index by digest, with `pluginConfigSchema` a single `enabled` switch plus size limits - nothing carries an organization identity to seat or withhold. The principle underneath, that a source the governed party can write must not count as the governing party's policy, is already enforced where it applies here: a project layer cannot approve its own MCP servers (`src/config.ts:962-968`, W12), and the managed file is named by the caller rather than discovered. Not ported, and no longer counted as a pending package. Three more modules are pointers: the peer-message wording marks the same data-not-user-instructions boundary this runtime states in its own words, session message holds have their own release and expiry states, and a subagent fork carries a depth cap.

## Slice twenty-one: uncited modules ranked 921 to 1020

Ranks 921-1020 of the uncited list (509,866 bytes, 100 modules, 6,309 bytes down to 5,236). Import text is 50.6% of the band and 61 modules carry content, four of those only through state-name markers. The modules are small now - the band's largest is 6,309 bytes - and the band is command and tool surface work: the keybinding, brief, focus and goal commands, the scheduled-wakeup and loop tools, the permission prompts and their wording, and the bridge and teleport paths.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-gmm3zaaw.js` | 6309 | `Memory resumed \xB7 memory content may be referenced and new memor`, `Run /pause-memory again to resume.` | memory pause and resume as a command; this runtime has its own memory tools |
| `chunk-77fcp0gt.js` | 6296 | markers `device_bash`, `device_commit_files`, `device_list_dir`, `device_request_delete_permission` | no literal of its own |
| `chunk-askg8yg9.js` | 6281 | `https://www.schemastore.org/claude-code-keybindings.json`, `Keybinding customization is disabled in this environment.` | keybinding customization; this runtime binds its own keys |
| `chunk-fvj23q0f.js` | 6258 | `@ant/computer-use-input is not supported on this platform`, `Clipboard write did not round-trip.` | computer use input, external |
| `chunk-gdkvcgp2.js` | 6229 | `a notice that is not one text block`, `that is not isMeta`, `a plugin appends a user-role isMeta row or a system notice` | prompt structure validation; this runtime composes its own prompts |
| `chunk-qzbmdah5.js` | 6229 | `tengu_bedrock_default_fallback`, `tengu_vertex_default_fallback`, `exhausted` | hosted model fallbacks |
| `chunk-8ejjjngx.js` | 6169 | ` [likely sleep/wake]`, `tengu_event_loop_stall` | event loop stall detection with a sleep/wake hint; this runtime keeps its own timing |
| `chunk-3cx32cgy.js` | 6151 | markers `hook_additional_context`, `unhooked`, `fulfilled` | no literal of its own |
| `chunk-2c87rzwm.js` | 6149 | `interrupt_receipt_v1`, `msg_lifecycle_v1`, `request_marker_lists_v1` | versioned UI protocol markers; this runtime has its own |
| `chunk-2hb5361r.js` | 6151 | byte-range regexes for identifier validation, `tengu_feature_ok`, `tengu_feature_bad` | identifier validation; this runtime validates its own |
| `chunk-vrkgsseg.js` | 6108 | `your user \xB7 Remote Control`, `file_id must be a Files API id (file_…)`, `session id contains unsafe characters` | bridge inbox identifiers, hosted |
| `chunk-ytdamgwe.js` | 6048 | `Stashing changes before teleport...`, `Teleport auto-stash`, `Failed to get changed files` | teleport with an automatic stash, hosted |
| `chunk-v6b7qas5.js` | 6046 | `bundled file path escapes its extraction dir`, `skill_bundled_extract_write_failed` | a skill bundle extraction that refuses a path escaping its own directory; the W09/W10 containment family |
| `chunk-2tr8kq7k.js` | 6038 | `MCP config diagnostics`, `For help configuring MCP servers, see:` | MCP config diagnostics; this runtime reports its own |
| `chunk-dw6nwqvg.js` | 6027 | markers `ccr_record_created_pr`, `not_deployed` | no literal of its own |
| `chunk-fh503bhf.js` | 6022 | `[planModeResume] ignoring unrecognized internal_metadata.worker_pe`, `Your plan has been submitted to the team lead` | plan mode resume with team handoff; this runtime has its own plan mode |
| `chunk-hnaveaa7.js` | 6012 | `Display-only MCP tool invoked — it exists only for transcript` | transcript-only tool handling; this runtime has its own |
| `chunk-zyrmp4wz.js` | 5974 | markers `batch_tools`, `zero_entries`, `per_entry_threw` | no literal of its own |
| `chunk-khadjt3k.js` | 5938 | `getGitDir returned null — cannot verify worktree state`, `repository config could not be vetted`, `submodules_unverifiable` | worktree and repository state that must be verified before use; extends the Git family slice fifteen opened |
| `chunk-cpbr5t78.js` | 5913 | `Install was cancelled at the elevation prompt`, `Network filters can't be verified from a non-elevated process` | Windows sandbox installation states; this runtime has its own sandbox surface |
| `chunk-1h28m7y3.js` | 5903 | `Schedule a prompt to run at a future time`, `true = persist to .claude/scheduled_tasks.json and survive restart` | the scheduled-wakeup tool this session runs |
| `chunk-ktawjrp8.js` | 5898 | `active-time ledger read failed` | usage ledger; this runtime accounts for its own |
| `chunk-crw1fpdp.js` | 5903 | `another command ran in this repository at the same time`, `a git step in this command can move the working tree` | diff warnings when a git command can move the tree; extends the Git family |
| `chunk-ds04xcdf.js` | 5857 | marker `tengu_workflow_usage_warning_accepted` | no literal of its own |
| `chunk-f130arwz.js` | 5851 | `Toggle brief-only mode`, `Brief tool is not enabled for your account` | brief-only mode, a product surface without a local counterpart |
| `chunk-zygdtz20.js` | 5842 | `--dangerously-skip-permissions cannot be used with root/sudo privi`, `[permissions] bypass consent was accepted but user settings do not` | **candidate**: bypass permissions refused under root or sudo, and a bypass consent that is not persisted in user settings does not hold |
| `chunk-ngwg2y6m.js` | 5792 | `the record of attached computers gave no list` | attached-device records, hosted |
| `chunk-1vhw5e51.js` | 5791 | `read project memory`, `no memory route over the CCR bridge` | project memory over the bridge, hosted |
| `chunk-vq5xch6f.js` | 5788 | `unattended-serving:v1:auto-arm-classifier`, `unattended-serving consent: a Yes while settings turn unattended s` | unattended serving consent, hosted |
| `chunk-h2r3abcs.js` | 5780 | `nonBlockingStdout: active`, `not_same_tty`, `ttyname_unavailable` | terminal detection states; this runtime detects its own |
| `chunk-er8d3hpd.js` | 5769 | `read from private field`, `Cannot add the same private member more than once` | vendored private-field error text |
| `chunk-mrf41zrh.js` | 5760 | regexes stripping UUIDs and `req_` identifiers, `tengu_ax_screen_reader`, `tengu_ax_sr_suggestion_nav` | screen-reader rendering with identifier redaction; this runtime renders its own |
| `chunk-k65ya3x7.js` | 5747 | `Yes, for this session`, `Yes, and remember this directory`, `Claude Code will be able to read files in this directory` | directory permission prompt wording; this runtime asks its own |
| `chunk-d3s5r8h5.js` | 5745 | `_/btw can't run tools: any tool calls or tool output shown above w`, `_(This answer was cut off before it finished. Ask again to retry.)` | side-question handling; this runtime has its own |
| `chunk-80g07x2j.js` | 5724 | `Google Chrome.app/Contents/MacOS/Google Chrome`, `Microsoft Edge.app/Contents/MacOS/Microsoft Edge` | browser binary paths and mount checks, external |
| `chunk-8662jwy2.js` | 5710 | `If WSLg is not available (for example WSL1), run Claude Code in na`, `[voice] startRecording called, platform=darwin` | voice recording with a platform note; this runtime has its own surfaces |
| `chunk-6fqa4e59.js` | 5681 | `[bridge:owner-pin] daemon owner not declared: no bootstrap stamp`, `[bridge:owner-pin] identity sources disagree and the credential co` | bridge owner pinning, hosted |
| `chunk-w00x0qwx.js` | 5636 | `readMcpDirectory called on a server without directoryRead capabili` | MCP capability check; this runtime checks its own |
| `chunk-keykkkw1.js` | 5607 | markers `session_keepalive_parked_on_user`, `session_idle_30s`, `session_activity_main_loop_underflow` | no literal of its own |
| `chunk-g0vyas06.js` | 5597 | the same MCP capability message as its neighbour | a near-duplicate, this runtime checks its own |
| `chunk-z4jt4szw.js` | 5545 | `tengu_bridge_min_version`, `unanswered`, `malformed` | bridge version negotiation, hosted |
| `chunk-356hrhz3.js` | 5520 | markers `fullscreen`, `immediate`, `suppress` | no literal of its own |
| `chunk-e79bz4jk.js` | 5487 | `Your Claude Code session is ready — continue from your phone`, `tips_rc_long_turn_show` | Remote Control nudges, hosted |
| `chunk-tf9zceev.js` | 5480 | `\|ultracode [on\|off]` | the ultracode flag this session's own prompts name |
| `chunk-vvz1khq0.js` | 5474 | `No goal set. Usage: \`/goal <condition>\`` | the goal command text this session runs |
| `chunk-4xejdmzw.js` | 5466 | `the approval sent with this call did not come from a person`, `what a person approved is no longer what this call would do` | approval provenance and freshness; this runtime asks per call |
| `chunk-a0y7jnhw.js` | 5445 | markers `type_url`, `from_url` | no literal of its own |
| `chunk-879p98pj.js` | 5430 | markers `powershell`, `input_remote_bash`, `spawn_failed` | no literal of its own |
| `chunk-gg0vwz81.js` | 5381 | `session gained a toolset after a toolless first relay-attempted di`, `outgoing toolset diverged from the first relay-attempted dispatch` | relay toolset divergence, hosted |
| `chunk-ja828hhq.js` | 5370 | marker `callback` only | no literal of its own |
| `chunk-68g5e6vr.js` | 5370 | `[loop] keepalive budget exhausted (model declined to reschedule tw`, `[loop] ScheduleWakeup({stop:true}) after loop already ended` | the loop skill's keepalive budget, the mechanism this session runs |
| `chunk-daxb2jg6.js` | 5338 | `Claude Code URL Handler.app`, `-//Apple//DTD PLIST 1.0//EN` | macOS deep-link registration, external |
| `chunk-vs7hm73x.js` | 5331 | `Team name is required for permission requests`, `Worker ID is required for permission requests` | swarm permission requests that require team and worker identity |
| `chunk-jnzcenjm.js` | 5294 | `The SSO session associated with this profile has expired. To refre` | vendored AWS SSO error text |
| `chunk-4jr9rxry.js` | 5281 | `Focus view enabled`, `Focus view disabled`, `/focus isn't available here yet` | focus view, a product surface without a local counterpart |
| `chunk-rdkad6sh.js` | 5267 | `a key named __proto__`, `serialized_as_restriction` | a prototype-key guard in serialization; this runtime serializes its own |
| `chunk-7tnkhv2k.js` | 5264 | `# ─── Write your reply below this line ──`, `Ink instance not found - cannot pause rendering` | reply-block rendering; this runtime renders its own |
| `chunk-1mamt004.js` | 5257 | `Couldn't save your login. If your Mac's keychain is locked, unlock` | login persistence, excluded with credentials |
| `chunk-7m4087qg.js` | 5252 | `Disconnect Remote Control`, `Control this session from your phone or claude.ai/code` | Remote Control control surface, hosted |
| `chunk-wh2vcbh8.js` | 5244 | `Git Bash not found; BashTool will be unavailable`, `is not a bash/sh binary` | Git Bash discovery on Windows; this runtime resolves its own shell |
| `chunk-cjfmbkc1.js` | 5241 | markers `cumulative`, `lowmemory` | no literal of its own |

Thirty-nine further modules carry no literal of their own; all but five are mostly import text.

The band reads as thirty-five modules with local counterparts, forty-three with no characterising literal of their own, sixteen hosted surfaces, two vendored packages, two product surfaces without a local counterpart and one module excluded with credentials. It records the sixth candidate.

The candidate is the bypass-permission guard. The recovered client refuses bypass under root or sudo privileges outright, and separately records that a bypass consent accepted in the moment does not hold when user settings do not persist it - a consent that leaves no record is not a standing consent. The local statement of coverage: this runtime accepts `--permission-mode bypass` on the command line and `/permissions MODE` in session, and `src/permissions.ts` returns `allow` for every call in that mode; there is no privileged-uid check anywhere in `src/`, and no rule that the bypass consent must be persisted before the mode is honoured. Both halves of the recovered rule are about a surface this runtime owns and neither is implemented. Three further modules extend families already open: a skill bundle extraction that refuses a path escaping its own directory, worktree and repository state that must be verified before use (with submodules explicitly unverifiable), and diff warnings when a git command can move the working tree.

## Slice twenty-two: uncited modules ranked 1021 to 1120

Ranks 1021-1120 of the uncited list (437,757 bytes, 100 modules, 5,231 bytes down to 4,767). Import text is 57.7% of the band and 46 modules carry content, six of those only through state-name markers; fifty-four carry nothing of their own, and most of them are ninety percent or more import statements. This band is the small helper and hosted-adjacent layer: session and rename bookkeeping, plugin cache refresh, deep links, cloud containers and vitals, and the vendored AWS credential providers.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-nqc6v990.js` | 5231 | `restart without --safe-mode`, `unset CLAUDE_CODE_SAFE_MODE`, `restart without --bare` | safe-mode and bare restart hints; this runtime has its own flags |
| `chunk-xknabhjq.js` | 5243 | `Auto mode lets Claude handle permission prompts automatically`, `Sessions are slightly more expensive.` | auto-mode consent wording, a product surface without a local counterpart |
| `chunk-4qwmcq8c.js` | 5221 | markers `list_projects`, `finalize_plan` | no literal of its own |
| `chunk-4h1krm9x.js` | 5183 | markers `too_many_concurrent`, `unbound_device`, `sandbox_unavailable` | no literal of its own |
| `chunk-075qs5w9.js` | 5179 | `Not a Claude in Chrome settings edit.` | browser extension settings, hosted |
| `chunk-4swkhv8v.js` | 5164 | `You can start typing — messages send once the session is re` | session resume affordance; this runtime has its own |
| `chunk-zzjk4vrs.js` | 5151 | a line parser splitting key/value pairs | pure code leaf |
| `chunk-nwtxjypf.js` | 5148 | `[vitals] kill switch or essential-traffic-only set`, `VITALS_EMITTER_BIN not set` | hosted vitals emitter |
| `chunk-j0kcafpy.js` | 5123 | `bridge_token_refresh_no_oauth`, `no_oauth_token` | bridge token refresh, excluded with OAuth |
| `chunk-z6p21rxk.js` | 5122 | markers `workspace`, `malformed`, `unclosed` | no literal of its own |
| `chunk-r6mm6zrm.js` | 5109 | `Fast mode unchanged (cancelled)`, `Fast mode was not changed` | fast mode toggling, a product surface without a local counterpart |
| `chunk-dh7hkvp1.js` | 5109 | `accepted settings text exceeds the settings size limit`, `tengu_remote_tool_serving` | remote tool serving, hosted |
| `chunk-ry2gekq4.js` | 5109 | `no deep link opener for darwin`, `Claude Desktop is not installed.` | desktop deep links, external |
| `chunk-tat46164.js` | 5072 | `stdout drain timeout (exit)` | process exit hygiene; this runtime drains its own |
| `chunk-kjdxy8zz.js` | 5063 | markers `allow_remote_sessions`, `tengu_harbor_kite_cloud` | no literal of its own |
| `chunk-03m733d4.js` | 5051 | marker `subagent` | no literal of its own |
| `chunk-wmq1tnzy.js` | 5044 | `https://slack.com/marketplace/A08SF47R6P4-claude`, `Opening Slack app installation page in browser` | hosted Slack app installation |
| `chunk-9yh2xzb7.js` | 5036 | `refreshActivePlugins: clearing all plugin caches` | plugin cache refresh; this runtime reloads its own |
| `chunk-rkbvpz0q.js` | 5035 | `Resumed your cloud container`, `Set up a cloud container` | hosted cloud containers |
| `chunk-x8m8yfey.js` | 5020 | markers `auxiliary`, `advisor_tool` | no literal of its own |
| `chunk-pwk4h63p.js` | 5012 | `the Claude Code project thread this session belongs to`, `the chat thread linked to this session` | hosted thread linking |
| `chunk-njj04bkb.js` | 5006 | markers `shutdown`, `interrupt`, `user_cancel` | no literal of its own |
| `chunk-e17cxwnz.js` | 4990 | `the source of a home file was exchanged while it was published`, `the source of a home file is not a regular file` | a published file whose source changed underneath it; the identity family W09 ported |
| `chunk-8v6xem3d.js` | 4978 | `ctrl+b ctrl+b (twice)` | background key hint; this runtime binds its own keys |
| `chunk-7ah5c51p.js` | 4975 | `Block the action if it accomplishes the same effect via a differ`, `` `python -c`, `sed -i`, `cat >`, heredocs, or similar to write or``, `<settings_deny_rules>` | deny rules judged by the effect a command accomplishes, the family W01 vetted |
| `chunk-mnxkv3v1.js` | 4965 | `Cannot rename: This session is a teammate.`, `Session name generation cannot use tools` | session rename rules; this runtime renames its own |
| `chunk-t50k4547.js` | 4955 | `/api/oauth/organizations/:orgUUID/admin_requests`, `Request sent to your admin for usage credits.` | hosted credit requests |
| `chunk-30ght5hf.js` | 4952 | `forked-skill sidecar write refused: diskless session with no sto`, `forked-skill provenance marker write failed` | forked-skill provenance writes with a diskless refusal; this runtime has its own skills |
| `chunk-hrkpf32h.js` | 4913 | `Invalid cwd in deep link: parent-directory segments are not supp`, `Deep link cwd contains invisible or bidirectional control charac` | deep-link path vetting (parent segments, invisible and bidirectional characters) - the W09/W10 family, guarding a surface this runtime does not have |
| `chunk-ha254rj6.js` | 4912 | `Reading a local file from outside this session's connected folde`, `A local file that could not be examined requires a live human co` | foreign-file reads where an unexaminable file needs a human; this runtime applies its own reading rules |
| `chunk-cyvb4eds.js` | 4911 | `transfer path is outside the file-transfer spool`, `peer file transfer: source unreadable or over the size limit` | peer file transfer inside a spool; containment again |
| `chunk-4vnqc6n5.js` | 4902 | `List subagents, teammates, and other Claude sessions you can mes` | the agent-listing tool; this runtime lists its own |
| `chunk-0qkpwgr4.js` | 4880 | markers `preserve`, `backspace` | no literal of its own |
| `chunk-pdmt26sy.js` | 4879 | `[REDACTED:gh-token]`, `/api/oauth/organizations/:orgUUID/sync/github/auth` | GitHub connection with token redaction, excluded with credentials |
| `chunk-68tpa3e9.js` | 4867 | `Native memory > heap - leak may be in native addons (node-pty, e`, `No obvious leak indicators.` | heap dump analysis; this runtime diagnoses its own |
| `chunk-5b8s3gnd.js` | 4860 | `user:projects:read`, `org:create_api_key` | OAuth scopes, excluded with OAuth |
| `chunk-nwvfsc5d.js` | 4852 | `@aws-sdk/credential-provider-env - fromEnv`, `Unable to find environment variable credentials.` | vendored AWS credential provider |
| `chunk-yw9879fj.js` | 4852 | `tengu_tool_search_unsupported_models`, `tengu_non_deferrable_builtins` | tool search and deferral; this runtime defers its own tools |
| `chunk-tta63cnm.js` | 4848 | `background commands started by cloud sessions:`, `claude daemon remote-control stop-shell <id>` | cloud-session background commands, hosted |
| `chunk-mv5ceh8c.js` | 4843 | `Browse running and completed workflows` | workflow browsing; this runtime runs its own |
| `chunk-j9b8j6ev.js` | 4838 | ``read_file requires `path` — a published path from a list_fi``, `out_dir cannot be resolved to a local directory` | hosted artifact file tool schema |
| `chunk-mm2bt8j9.js` | 4806 | `http://169.254.170.2`, `@aws-sdk/credential-provider-http - fromHttp` | vendored AWS HTTP credential provider |
| `chunk-3qvtbph9.js` | 4784 | marker `cowork_plugins` | no literal of its own |
| `chunk-ck2yq9t7.js` | 4777 | `Usage fetch returned a fieldless or non-object body (in-band err` | hosted usage API envelope handling |
| `chunk-svp90acn.js` | 4775 | a bounded key cache with a size guard | pure code leaf |
| `chunk-da0jjd0m.js` | 4773 | `Your settings were saved — restart Claude Code to apply the`, ` Restarting Claude Code…` | settings reload and restart; this runtime reloads its own |

Fifty-four further modules carry no literal of their own, and most of them are ninety percent or more import statements.

The band reads as sixteen modules with local counterparts, sixty with no characterising literal of their own, fourteen hosted surfaces, three modules excluded with credentials or OAuth, two vendored AWS credential providers, two product surfaces without a local counterpart, two pure code leaves and one rule that guards a surface this runtime does not have. It records no new candidate. Four modules extend families already open or ported: deny rules judged by the effect a command accomplishes (the family W01 vetted), a deep-link path refused for parent-directory segments and for invisible or bidirectional characters (the W09/W10 vetting family, on a surface this runtime does not have), a published file whose source was exchanged underneath it (the identity family W09 ported), and a peer file transfer whose path must stay inside the transfer spool (containment again).

## Slice twenty-three: uncited modules ranked 1121 to 1220

Ranks 1121-1220 of the uncited list (383,570 bytes, 100 modules, 4,765 bytes down to 3,988). Import text is 36.1% of the band and 69 modules carry content, twelve of those only through state-name markers; thirty-one carry nothing of their own. This band is the interaction and runtime-plumbing layer: permission and dialog plumbing, skill and plugin surfaces, session and bridge bookkeeping, and the vendored AWS and smithy clients.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-fypgvs3m.js` | 4765 | `inherited standing request withdrawn`, `ask lapsed unanswered`, `ask ended without an answer` | standing-request bookkeeping; this runtime tracks its own asks |
| `chunk-ymfgyg1a.js` | 4758 | `Remote Control is disabled by your organization's policy.`, ` Set the permission mode with `claude remote-control --permiss` | hosted remote control gated by organization policy |
| `chunk-q9ntxmhx.js` | 4750 | `Grove: No cache, fetching config in background (dialog skipped`, `Grove: Cache stale, returning cached data and refreshing in ba` | hosted Grove config cache |
| `chunk-53x0p69z.js` | 4737 | `Run JavaScript against the appifact SDK: the built-in one, or ` | hosted artifact SDK surface |
| `chunk-frf786f1.js` | 4733 | `you have unsent text in the input`, `Send it or clear it, then press \\u2190 again.` | interactive input affordance; this runtime has its own |
| `chunk-8zgs1qmk.js` | 4718 | `useDialogStore cannot be called outside of a DialogStoreContex` | dialog store context guard; this runtime has its own dialogs |
| `chunk-hmg4e8gm.js` | 4682 | `The user asked for more questions`, `Asks the user multiple choice questions to gather information,` | the multiple-choice question tool; this runtime asks its own |
| `chunk-z7dmj97w.js` | 4671 | `register_repo_root:`, `is already a registered working directory`, `outside_scope`, `not_directory` | repository-root registration vetting; this runtime registers its own roots |
| `chunk-rgrg9230.js` | 4664 | `CLAUDE_CODE_CHILD_SESSION=` | child-session environment marker; this runtime marks its own children |
| `chunk-340rde3k.js` | 4661 | `skills, commands, and agents`, `skills and commands` | skill and command directory additions; this runtime reloads its own |
| `chunk-cnq34fr6.js` | 4650 | markers `session_` | no literal of its own |
| `chunk-jf37mcn0.js` | 4649 | `Auth error: no credential usable for the metrics opt-out check`, `metrics_enabled response missing metrics_logging_enabled` | hosted metrics opt-out check |
| `chunk-9e3hxv6b.js` | 4641 | marker `standalone` | no literal of its own |
| `chunk-sqv6prqv.js` | 4620 | `from a remote cloud agent`, `Permission Required:` | hosted cloud-agent permission prompt |
| `chunk-0vbe15j3.js` | 4617 | `The titles and page text in the results are untrusted web cont`, `, including links as markdown hyperlinks` | untrusted web results framed as data; this runtime frames its own |
| `chunk-xne59n03.js` | 4588 | `core.quotePath=false`, `core.hooksPath=/dev/null`, `log.showSignature=false` | Git invocation hardening; this runtime already sets six `-c` options and scrubs `GIT_*` |
| `chunk-xn01wkh9.js` | 4581 | `[ITermBackend] isAvailable: false (not in iTerm2)`, `[ITermBackend] First split from active session (no leader ID)` | terminal split backend; this runtime has its own terminal handling |
| `chunk-cvwdwj4m.js` | 4577 | `Nested clients for AWS SDK packages.`, `node ../../scripts/compilation/inline nested-clients` | vendored AWS SDK internals |
| `chunk-m18zhdb2.js` | 4569 | `Failed to read Apple Terminal bell setting: defaults export is`, markers `libghostty`, `libvterm`, `terminology` | terminal capability detection; this runtime detects its own |
| `chunk-jr9qmh6g.js` | 4548 | `Startup settings (--settings option)`, `Managed settings (set by your organization)` | settings provenance by source; the managed-settings family this file has recorded twice |
| `chunk-yttbm1rn.js` | 4542 | `server did not declare claude/channel capability`, `channels are not available on third-party providers` | hosted channel capability negotiation |
| `chunk-vkkyb5rv.js` | 4532 | `environment scan for /auto-mode-setup`, `still reading local memory notes; running the command again la` | the auto-mode setup surface, a product surface without a local counterpart |
| `chunk-g87ac9ev.js` | 4528 | `skill-doctor stage failed`, markers `scan_failed`, `skill_set_failed` | skill-doctor stages; this runtime diagnoses its own skills |
| `chunk-hmnmysdg.js` | 4523 | `  (no skills loaded)`, `Skills loaded this session`, `  context = this skill's one-line listing in the system prompt` | loaded-skill listing; this runtime lists its own |
| `chunk-j7em9nj1.js` | 4514 | `Spawn a self-hosted runner as a detached background process on`, `GET http://127.0.0.1:{health_port}/healthz on the local runner` | hosted self-hosted-runner tool surface |
| `chunk-pg0hc7z0.js` | 4513 | `https://github.com/apps/claude/installations/new` | hosted GitHub App installation |
| `chunk-ps3grg8t.js` | 4513 | `[bridge] title write retry dropped: sending is now barred`, `[bridge] title write retry skipped: server state unreadable` | hosted bridge title writes |
| `chunk-5cakx2ka.js` | 4511 | `@aws-sdk/credential-providers - createCredentialChain(...).exp`, `@aws-sdk/credential-providers - fromTemporaryCredentials (STS)` | vendored AWS credential providers |
| `chunk-yze9xmwg.js` | 4505 | `MCP server not approved for this project`, `MCP server blocked by enterprise managed policy` | MCP server admission by project approval and managed policy; this runtime admits its own servers |
| `chunk-hxgefxf8.js` | 4494 | `sep2663 task id exceeds the wire bound`, `mcp task metadata write failed` | MCP task metadata writes with a wire-bound check; this runtime drives its own tasks |
| `chunk-y2w3pjq0.js` | 4488 | `the value is set but contains no launcher \\u2014 unset the var`, `the launcher must be an absolute path, not a bare name resolve` | launcher variable vetting; this runtime vets its own environment |
| `chunk-nwvarfxa.js` | 4473 | `computer-use lock v5 create failed`, `Released computer-use lock`, `stale_recovered` | the computer-use lock, a product surface without a local counterpart |
| `chunk-h7m7xy71.js` | 4447 | `@deprecated Use manifest_version instead`, `Either 'dxt_version' (deprecated) or 'manifest_version' must b` | extension manifest schema versions; this runtime validates its own plugin manifests |
| `chunk-yebth8wa.js` | 4400 | `must be 0 (disabled) or \\u2265100ms`, `at-capacity liveness requires non_exclusive_heartbeat_interval` | hosted bridge poll-interval and liveness config |
| `chunk-vdyt4fpj.js` | 4397 | marker `condensed` | no literal of its own |
| `chunk-940nvk4p.js` | 4392 | markers `subagent_launch`, `subagent_fork_ended_by_model`, `subagent_fork_prompt_missing` | no literal of its own |
| `chunk-pa2d6xdm.js` | 4388 | `(invalid tool name)`, `mintDisplayedUpdates: non-plain array in mint input \\u2014 pla` | display-update input validation; this runtime validates its own |
| `chunk-x1qwsaf6.js` | 4367 | `@smithy::core/protocols - initial-response event encountered i`, `@smithy/core/event-streams - non-struct member not supported i` | vendored smithy event streams |
| `chunk-yk2dv1vy.js` | 4350 | `MCP skill cache meta.json write failed`, `MCP skill cache SKILL.md write failed` | MCP skill cache writes; this runtime caches its own skills |
| `chunk-je68pfjg.js` | 4345 | `Not a memory settings edit.` | memory settings edit classification; this runtime toggles its own memory |
| `chunk-kxkex3we.js` | 4342 | markers `fetch_failed`, `notif_prefs_fetch_parse_failed`, `notif_prefs_patch` | no literal of its own |
| `chunk-dwbjyxcp.js` | 4331 | `artifact content fetch blocked: the sandbox proxy's content sc`, `content_scan_permanent` | hosted artifact content fetch through a scanning proxy |
| `chunk-znrvabr2.js` | 4320 | `Attempted to update an already finished hash.`, `Cannot hash more than 2^53 - 1 bits` - a bounded hash accumulator | pure code leaf |
| `chunk-xnjp66p2.js` | 4301 | `[conversation summary withheld: it may include account memory]` | summary withholding when account memory may be included; this runtime summarises its own |
| `chunk-zra6s2sk.js` | 4272 | markers `spare_claim`, `spare_claim_token_file_wait_ms`, `tengu_bg_claim_env_dropped` | no literal of its own |
| `chunk-e7hwd1w0.js` | 4259 | `/goal is only available in trusted workspaces. Restart, accept`, `/goal can't run while hooks are restricted (disableAllHooks or` | the goal surface gated by workspace trust and hook restriction; this runtime gates its own |
| `chunk-0gpgwsjg.js` | 4252 | `Waiting on a user dialog`, markers `remote_cowork`, `remote_desktop`, `remote_projects` | hosted remote surfaces |
| `chunk-nm1hxajq.js` | 4251 | `now add tests for that`, `needs user approval for X`, `Added Redis cache implementation. Tests pass, typecheck clean.` | example prompts shown as samples, a product surface without a local counterpart |
| `chunk-bcnhka5p.js` | 4224 | `Allow external CLAUDE.md file imports?`, `This project's CLAUDE.md or .claude/rules imports files outsid`, `Yes covers those too, plus any this project adds later.` | **reclassified 2026-10-12**: the consent dialog has no surface here - see the band note |
| `chunk-hyx1j919.js` | 4211 | markers `suggestion`, `trailing` | no literal of its own |
| `chunk-6dp9qwjh.js` | 4208 | `target is this session itself \\u2014 there is no one else to s` | addressing guard for a self-targeted message; this runtime guards its own |
| `chunk-bsh5jd0z.js` | 4206 | markers `custom_url`, `oversized`, `essential_traffic`, `federation` | no literal of its own |
| `chunk-xaes9ysz.js` | 4205 | markers `microsoft`, `mercurial`, `perforce` | no literal of its own |
| `chunk-es3b6n2x.js` | 4178 | markers `no_credential`, `user_mismatch`, `upstream_401` | no literal of its own |
| `chunk-7c38cy4d.js` | 4169 | markers `codeship`, `truecolor`, `alacritty` | no literal of its own |
| `chunk-e4ddr9cq.js` | 4148 | `Use this machine's settings in cloud sessions?`, `Send the CLAUDE.md, rules, output styles, and preferences in t` | hosted cloud-session settings seeding behind a prompt |
| `chunk-edprrf6e.js` | 4138 | `[file inputs] a path was rejected: a credential, or Claude's o` | file-input path vetting against credentials; this runtime vets its own reads |
| `chunk-af2amwy8.js` | 4137 | `current branch only`, `current history only`, `snapshot without history` | hosted share/snapshot modes |
| `chunk-qcxyj0he.js` | 4095 | `plugin init <name>`, `Scaffold a new plugin at ~/.claude/skills/<name>/ (auto-loads ` | plugin scaffolding and validation; this runtime has its own plugins |
| `chunk-q3m6vda6.js` | 4086 | `headlessPluginInstall: seed marketplaces registered`, `headlessPluginInstall: marketplaces reconciled` | headless plugin install from declared marketplaces; this runtime installs its own |
| `chunk-yhqe2e5b.js` | 4086 | `</cross-session-message>`, `/?.[1],c=l.match(/\\bfrom-name="` | cross-session message envelope parsing; this runtime has its own |
| `chunk-6f3cp7aa.js` | 4080 | `[Workflow harness \\u2014 computed task] The task text below wa`, `runtime by a workflow script. It was not typed by this session` | workflow harness task framing marked as not typed by the session; this runtime runs its own workflows |
| `chunk-daqzn5gy.js` | 4076 | `Run the file via `bun run test:file -- <path>` with this reque`, `src/services/http/firstParty \\u2014 it enforces the 3P data-re` | repository-internal development guidance for a surface this runtime does not have |
| `chunk-s0xwphr3.js` | 4042 | `The permission handler rewrote the message into a structured (` | permission-handler message-shape validation; this runtime validates its own |
| `chunk-rmy74w22.js` | 4032 | `client IPs: TCP peer address (listen.trusted_proxies empty)`, `oidc: not configured (customer-routed inference only)` | hosted proxy, OIDC and relay configuration reporting |
| `chunk-xx4cahtd.js` | 4029 | `confirmWithUser: the question does not satisfy the AskUserQues`, `confirmWithUser: AskUserQuestion.checkPermissions did not answ` | confirmation through the question tool and its no-one-to-ask case; this runtime confirms its own |
| `chunk-txtr8b4c.js` | 4017 | ` in an interactive terminal session`, `The advisor can't be changed from this client \\u2014 this conn` | the advisor setting surface, a product surface without a local counterpart |
| `chunk-03hxp3zp.js` | 3996 | `control socket timeout`, `daemon lease: the control socket is not served by this user, o` | background daemon control socket and lease; this runtime owns its own daemon |
| `chunk-9mez5993.js` | 3988 | markers `read_file`, `read_asset`, `describe_type`, `list_files`, `list_assets` | no literal of its own |

Thirty-one further modules carry no literal of their own, and most of them are ninety percent or more import statements.

The band reads as thirty-two modules with local counterparts, forty-three with no characterising literal of their own, fifteen hosted surfaces, four product surfaces without a local counterpart, three vendored AWS or smithy clients, one pure code leaf and one rule that guards a surface this runtime does not have. It records one candidate, the external instruction-import consent rule in the table above - since reclassified on 2026-10-12, see the band note below. This runtime's half is the containment rule, which throws `ConfigError("nested instruction import escapes workspace")` for any import that realpaths outside the root, plus the reserved-tree and depth checks in the same visitor; the uncovered half was the consent path and its forward scoping. (The rule's site is `src/config.ts:1173`; the note recorded it as `:1136` when the band was read, and the line has since moved as the file grew. Two more rows extend families already open: `chunk-jr9qmh6g.js` reports settings provenance by source including managed settings, the family this file recorded in slices nineteen and twenty, and `chunk-xne59n03.js` hardens the Git invocation further, which this runtime already does through six `-c` options and a scrubbed `GIT_*` environment.)

**Reclassified 2026-10-12: the consent to import instructions from outside the workspace.** `chunk-bcnhka5p.js` is the dialog, not the rule: it renders a warning-titled question - `Allow external CLAUDE.md file imports?`, with the body `This project's CLAUDE.md or .claude/rules imports files outside the current working directory. Never allow this for third-party repositories.` - lists the external imports it found, says `Yes covers those too, plus any this project adds later.`, records the answer through `Qcn(Ie==="yes","dialog",k)` and latches a refusal so the question is not asked again in the same scope. Everything it gates is a surface this runtime does not have: an instruction import that leaves the working directory is refused, so there is nothing to ask about. Both places that would decide it refuse instead. At configuration time the nested-import visitor throws on a realpath outside the root, with the reserved-tree and depth refusals beside it (`src/config.ts:1173`, W10 ported the link-chain half of the same visitor and recorded this consent as not ported). At tool time, a path outside the workspace is refused outright rather than asked about - `path escapes the workspace (absolute paths are not allowed): <path>` (`src/tools.ts:136`), with the symlink and dangling-symlink spellings beside it (`:140`, `:168`, `:173`). Nothing in `src/` prompts for out-of-workspace file access.

The reusable half of this candidate is not the dialog but the shape: a capability a checkout asks for, granted only by a person, where one yes stands for what that checkout adds later. That shape already landed here, on the surface where this runtime has it - [W12](W12-mcp-server-approval.md) holds a project-declared MCP server until the person running the session approves it, keys the answer to the declaration's digest and the workspace's real path, refuses to let a checkout answer for itself (`src/config.ts:962-968`), and takes the one standing switch from the user's own layer. Porting this module's consent would instead mean adding an interactive, forward-scoped grant whose only effect is to relax the confinement that refuses the import - new product scope in the direction of less confinement, not a rule landing on a surface this runtime owns. Not ported, and no longer counted as a pending package.

## Slice twenty-four: uncited modules ranked 1221 to 1320

Ranks 1221-1320 of the uncited list (293,424 bytes, 100 modules, 3,982 bytes down to 3,180). Import text is 18.2% of the band, the lowest share since slice eighteen, and 80 modules carry content, twelve of those only through state-name markers; twenty carry nothing of their own. This band is the smallest-module layer of the corpus so far and the most product-shaped: settings validation and provenance, keybindings and interactive session plumbing, MCP elicitation, plugin tips, and the hosted bridge, fleet and device surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-46nkg6gv.js` | 3982 | `number,url,headRefOid`, `no artifact-pr-review invocation is recorded in this session ` | hosted artifact pull-request review records |
| `chunk-rcqh8fh0.js` | 3975 | markers `bridge_inbox_fetch`, `traffic_disabled`, `base_url_override` | hosted bridge inbox |
| `chunk-v0tncmrv.js` | 3968 | markers `tengu_synchronous_bunny`, `remote_served_settings_freeze`, `own_write_not_recorded` | remote-served settings with a freeze on own writes |
| `chunk-mf8v3w8b.js` | 3923 | markers `localhost`, `localhost4`, `broadcasthost`, `metadata` - a hosts-file entry table | pure code leaf |
| `chunk-k7rzvkc1.js` | 3905 | `ignoring CLAUDE_CODE_HOST_CREDS_FILE with group/other-readable`, `host-creds refresh rejected: endpoint changed` | host credential file restrictions, excluded with credentials |
| `chunk-byemygya.js` | 3902 | `device-mcp snapshot read failed`, `device-mcp snapshot write failed` | hosted device MCP snapshots |
| `chunk-2x1jdkd9.js` | 3885 | `plutil did not finish converting it`, `it holds a value plutil cannot convert to JSON` | property-list conversion; this runtime reads its own formats |
| `chunk-226p11hv.js` | 3868 | markers `workflows`, `subagents`, `completed` | no literal of its own |
| `chunk-bwyexfny.js` | 3863 | markers `backspace`, `pagedown`, `wheeldown` | key handling; this runtime binds its own keys |
| `chunk-v7xwexv5.js` | 3854 | `until your limit resets`, `Lower-priority mode isn't available right now.` | the lower-priority mode surface, a product surface without a local counterpart |
| `chunk-vfd75557.js` | 3847 | markers `agent_progress`, `skill_progress`, `tool_use` | no literal of its own |
| `chunk-cskgx80w.js` | 3840 | ` (detail withheld on this connection)` | detail withholding on a connection; this runtime has its own |
| `chunk-wa0p9jsy.js` | 3812 | `Anthropic's agentic coding tool`, `Transport is closed`, `protocol_version_mismatch`, `malformed_result` | MCP client protocol handling; this runtime runs its own client |
| `chunk-7k6ht5e1.js` | 3805 | `not deleted: not_uploaded_here`, markers `policy_pending`, `egress_blocked`, `essential_traffic` | hosted egress and policy states |
| `chunk-82g4131q.js` | 3803 | markers `artifact_comment_consent_read`, `no_opening_comment`, `deadline` | hosted artifact comments |
| `chunk-a8pz28bf.js` | 3799 | markers `approved`, `changes_requested` | hosted review states |
| `chunk-twrtnh1w.js` | 3795 | markers `tengu_mcp_elicitation_shown`, `mcp_elicitation_handle`, `handler_error` | MCP elicitation; this runtime drives its own MCP |
| `chunk-v4nwq522.js` | 3748 | `Missing credentials. Please pass one of `apiKey` and `azureTok`, `The `apiKey` and `azureADTokenProvider` arguments are mutually` | a vendored SDK's credential errors |
| `chunk-j1ngavj8.js` | 3735 | `Manage scheduled remote Claude Code agents (routines) via the ` | hosted scheduled routines |
| `chunk-2m34xck0.js` | 3728 | `the rollout switch was fetched, but its value could not be sav`, `hooks modules are turned off here (disableAllHooks, allowManag` | rollout switch and hook gating; this runtime gates its own hooks |
| `chunk-8r22ax2y.js` | 3724 | `canonicalJson: non-finite number`, `canonicalJson: a value with no JSON form` | canonical JSON encoding; this runtime has its own |
| `chunk-dr63q6zt.js` | 3718 | markers `ambiguous`, `not_found`, `in_process_teammate`, `swarm_in_process_kill` | no literal of its own |
| `chunk-zekn1sw4.js` | 3680 | `--dest=org.freedesktop.FileManager1`, `--type=method_call` | desktop file-manager opener; this runtime opens its own |
| `chunk-g5swwp2g.js` | 3666 | `/plugin install <plugin> --marketplace <source>` | the plugin marketplace command; this runtime has its own plugins |
| `chunk-sazx74ct.js` | 3666 | markers `bash_shell`, `mcp_stdio`, `tengu_sdk_memory_summary` | no literal of its own |
| `chunk-pkt63meg.js` | 3662 | `write queue drain timeout (relaunch)`, markers `agent_launcher`, `relaunch_child_error` | agent launcher relaunch; this runtime launches its own |
| `chunk-wgtnthwq.js` | 3661 | `server-managed settings not loaded`, `user settings not read`, `settings not readable` | settings source reporting; the managed-settings family this file has recorded repeatedly |
| `chunk-qj81wxb3.js` | 3651 | `[awaySummary] ccr recap dropped: new turn already running`, `The user stepped away and is coming back. Recap in under 40 wo` | hosted away-summary recap |
| `chunk-chvcdc26.js` | 3642 | `Project instructions`, `Saved in ~/.claude/CLAUDE.md`, `Open auto-memory folder` | memory and instruction surface; this runtime owns its own memory |
| `chunk-na6dyeqm.js` | 3637 | `Failed to create heap dump (detail withheld on this connection`, `Open the .heapsnapshot in Chrome DevTools` | heap dump analysis; this runtime diagnoses its own |
| `chunk-wytmhqks.js` | 3634 | markers `background_operator`, `unresolved_shell_write`, `peer_too_old` | hosted peer and bridge states |
| `chunk-5s2z7cva.js` | 3633 | `Cloud sessions use your claude.ai login.`, `the key from apiKeyHelper` | hosted cloud-session login |
| `chunk-afp70n0f.js` | 3629 | `[bg] prompt stash too large to persist; kept in memory only`, `[bg] persisted prompt stash unreadable or empty` | background prompt stash; this runtime keeps its own background state |
| `chunk-9z6z9q34.js` | 3611 | `/api/oauth/organizations/:orgUUID/mcp/connectors/search`, `policy_denied` | OAuth organization connector search, excluded with OAuth |
| `chunk-c5zwk83v.js` | 3590 | `This is a guideline, not a hard limit \\u2014 follow it unless `, `This session has the default workflow size guideline:` | workflow size guideline; this runtime runs its own workflows |
| `chunk-m9vc4x6e.js` | 3582 | ``callbacks` must be an object, got a function instead. Did you` | a vendored library's argument validation |
| `chunk-1852h2m2.js` | 3571 | marker `input_digest_mismatch`, `approved`, `approval` | no literal of its own |
| `chunk-nrzqn6ne.js` | 3571 | `To refresh this SSO session run 'aws sso login' with the corre`, `@aws-sdk/token-providers - fromSso` | vendored AWS SSO token provider |
| `chunk-gwwwxdvd.js` | 3564 | `marketplace-plugin:org-marketplace`, markers `tips_startup_show`, `tips_spinner_show` | plugin tips; this runtime has its own tips |
| `chunk-ted9ecpa.js` | 3552 | markers `api_ultrareview_quota`, `tengu_ultrareview_awareness` | hosted review quota |
| `chunk-e3svbxxj.js` | 3540 | markers `assistant`, `adaptive`, `disabled` | no literal of its own |
| `chunk-gd3k56a8.js` | 3515 | marker `not_needed` | no literal of its own |
| `chunk-8f8e39h5.js` | 3507 | `validateDirectoryForWorkspace: expandPath threw`, `validateDirectoryForWorkspace: unexpected stat errno` | workspace directory validation; the W09 path family |
| `chunk-1h6b2a5q.js` | 3502 | `Resetting your limits\\u2026 this usually takes a few seconds` | hosted limit reset |
| `chunk-0767hfs9.js` | 3492 | `Delivered by a plugin hook; nothing else was sent.`, markers `ambiguous`, `tool_result` | plugin-hook message delivery; this runtime has its own hooks |
| `chunk-8zxshpt7.js` | 3491 | markers `claudeai`, `tengu_cobalt_plinth_yew` | no literal of its own |
| `chunk-edfy00bq.js` | 3478 | `no status for a background command on an attached machine`, markers `device_bash`, `sync_files` | hosted device background commands |
| `chunk-z514thvk.js` | 3474 | markers `owner_unverified`, `tengu_bridge_inbox_pointer_boundary` | hosted bridge inbox ownership |
| `chunk-jbg84wzq.js` | 3452 | `[OUTPUT TRUNCATED - exceeded ` | output truncation notice; this runtime caps its own output |
| `chunk-frzgxr6h.js` | 3447 | `Error log sink initialized` | error log sink; this runtime logs its own |
| `chunk-61z91y8b.js` | 3444 | `report the issue at https://github.com/anthropics/claude-code/`, `https://code.claude.com/docs/en/overview` | hosted issue reporting with a build identity |
| `chunk-s3h1ke63.js` | 3442 | `[fleet nudge] listing sessions failed for a reason that may pa`, `useFleetNudgeStore cannot be called outside of a FleetNudgeSto` | hosted fleet nudge |
| `chunk-bnwk2w5h.js` | 3433 | `Can't open \\u2014 this session is running in another terminal` | interactive session ownership; this runtime has its own |
| `chunk-r9qyb6nq.js` | 3427 | `Review and accept settings changes for cloud sessions that use`, `--managed-settings ignored: invalid JSON object` | managed settings acceptance; this runtime reads its own sources |
| `chunk-esb2v65n.js` | 3422 | a small string-index scanner | pure code leaf |
| `chunk-6wbt5907.js` | 3413 | `must be an absolute local path, not a network or automount path (such as \\\\server\\share, //server/share or /net/host), with no NUL character` | a worktree registration path rule this runtime already covers at `src/path-identity.ts:115` and `:196` |
| `chunk-14gqw0dc.js` | 3384 | `No browsers are connected. Open Chrome with the Claude extensi`, `That browser isn't connected right now.` | hosted browser bridge |
| `chunk-yhkf8gan.js` | 3381 | `the flag payload landed`, `the fetch settled with no payload`, `the rollout switch served off` | rollout flag payloads; this runtime watches its own config |
| `chunk-51w556q5.js` | 3370 | marker `opusplan` | no literal of its own |
| `chunk-xzsrr1a3.js` | 3353 | `apply_flag_settings: effort changes over Remote Control are tu`, markers `bridge_flag_settings`, `env_override` | hosted Remote Control flag settings |
| `chunk-agx4redd.js` | 3350 | `from CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `default for an unrecognized model`, `tengu_autocompact_command` | auto-compaction window; this runtime has its own compaction setting |
| `chunk-z8p4p77q.js` | 3336 | markers `cold_no_identity`, `artifact_roster_wait`, `http_4xx` | no literal of its own |
| `chunk-54ejy0pp.js` | 3309 | markers `enforced`, `allowlist`, `settings_env_default` | no literal of its own |
| `chunk-swtkzgxp.js` | 3301 | marker `tengu_agents_md_mod` | no literal of its own |
| `chunk-g1yqb0n4.js` | 3295 | `You ended the turn without calling SendUserMessage.`, `Send a message the user will read.` | the messaging tool surface, a product surface without a local counterpart |
| `chunk-nejdhvxk.js` | 3292 | markers `elicitation_complete`, `elicitation_response` | no literal of its own |
| `chunk-9zyrj6we.js` | 3279 | a quote-normalising text helper | pure code leaf |
| `chunk-0hm793yn.js` | 3276 | `EISDIR: illegal operation on a directory, read`, `Not a regular file (device, FIFO, or socket)`, `File exceeds maxBytes limit` | file read hardening; this runtime bounds its own reads |
| `chunk-373xbbdt.js` | 3272 | markers `tengu_lantern_wick_release`, `tengu_lantern_wick_braid_text` | hosted release surface |
| `chunk-fpef8znp.js` | 3248 | a quoted-string scanner | pure code leaf |
| `chunk-3sr3513w.js` | 3243 | markers `elicitation_complete`, `elicitation_response` | no literal of its own |
| `chunk-23rpm06c.js` | 3242 | `Not a valid value for this setting, so it is ignored and the s`, `Set it with /config, or delete the key from this file` | settings value validation; this runtime validates its own |
| `chunk-8xz7xv6h.js` | 3232 | `what they want designed`, `Make a new Design artifact from a brief`, `what the deck should be about` | hosted design-artifact prompts |
| `chunk-g9z2s3cs.js` | 3226 | markers `always_allow`, `always_deny` | no literal of its own |
| `chunk-kgz0jy3b.js` | 3208 | `https://browser-intake-us5-datadoghq.com/api/v2/logs`, `report the issue at https://github.com/anthropics/claude-code/` | hosted telemetry intake and issue reporting |
| `chunk-sx6f0gq0.js` | 3199 | markers `tengu_slash_command_unavailable`, `unavailable_over_remote_control` | hosted Remote Control command availability |
| `chunk-8k1xtbgb.js` | 3195 | `Application Support`, `Could not find Claude Desktop config file in Windows.` | Claude Desktop integration, external |
| `chunk-mhjr6p0a.js` | 3184 | `report the issue at https://github.com/anthropics/claude-code/`, `https://github.com/anthropics/claude-code/issues` | issue reporting; this runtime reports its own |
| `chunk-08y6bv7r.js` | 3182 | `Optional. Name of an attached machine to run this tool call on`, markers `container`, `local_command` | hosted attached-machine tool routing |
| `chunk-0mtwhy7y.js` | 3179 | marker `navigate` | no literal of its own |

Twenty further modules carry no literal of their own, and most of them are eighty percent or more import statements.

The band reads as thirty-two modules with local counterparts, thirty-two with no characterising literal of their own, twenty-five hosted surfaces, four pure code leaves, three vendored packages, two product surfaces without a local counterpart and two modules excluded with credentials or OAuth. It records no candidate of its own, and two rows close out rules that looked like candidates before the local source was read: a worktree registration path refused if it is not an absolute local path - rejecting `\\\\server\\share`, `//server/share` and `/net/host` forms and any NUL - is already covered by this runtime's path identity checks, which refuse a NUL or replacement character and reject a network filesystem by its `statfs` type; and an approval recorded against an input digest had no local surface to compare with and too little of its own text to make a rule. One row extends the managed-settings family this file has recorded in slices nineteen and twenty: a settings source that was not read is reported as not read rather than assumed default.

## Slice twenty-five: uncited modules ranked 1321 to 1420

Ranks 1321-1420 of the uncited list (213,929 bytes, 100 modules, 3,176 bytes down to 2,451). Import text is 22.2% of the band and 67 modules carry content, twenty-one of those only through state-name markers; thirty-three carry nothing of their own. This band is the sub-three-kilobyte layer: request parameters and tool input validation, repository trust and permission mode plumbing, transcript and session bookkeeping, plugin fetch and prompt overrides, and the hosted bridge, device, vitals and workshop surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-tyjj9vvy.js` | 3170 | `Allow network egress`, `*.frame.staging.claudeusercontent.com`, `*.frame.claudeusercontent.com` | hosted frame egress allowlist |
| `chunk-5q84zvx6.js` | 3166 | marker `request_error` | no literal of its own |
| `chunk-p80tcw96.js` | 3149 | `Unknown error during spawn`, markers `swarm_in_process_spawn`, `spawn_failed` | in-process teammate spawning; this runtime spawns its own |
| `chunk-6f1wh8d8.js` | 3134 | marker `tengu_plugin_hooks_modules` | no literal of its own |
| `chunk-7nkwy6kk.js` | 3127 | a recorder class, markers `max_tokens`, `output_config`, `context_management` | request parameters; this runtime builds its own |
| `chunk-e4eky0pj.js` | 3120 | `item could not be found`, `interaction is not allowed`, markers `keychain_unavailable`, `no_keychain` | OS keychain storage, excluded with credentials |
| `chunk-bw6fsnpp.js` | 3084 | marker `connected` | no literal of its own |
| `chunk-jjye1htf.js` | 3080 | `Tell the user to remove it on GitHub. Do not remove it yours`, marker `pr_steward_owns_binding` | hosted pull-request stewardship |
| `chunk-mke1mg83.js` | 3064 | marker `unregistered` | no literal of its own |
| `chunk-25vrbr0v.js` | 3056 | markers `group_kill`, `external`, `production`, `enum_spawn` | no literal of its own |
| `chunk-ras8sqbj.js` | 3036 | markers `shipping`, `deferred`, `kept_here`, `not_running` | no literal of its own |
| `chunk-rct77j3r.js` | 2991 | `Pushed to GitHub. Connect GitHub to claude.ai so you can wor`, markers `not_connected`, `eligible` | hosted GitHub connection offer |
| `chunk-95s6vqpk.js` | 2915 | a secret-matching pattern set and its redaction expression | secret redaction; this runtime redacts its own text |
| `chunk-nbvdgwj8.js` | 2905 | `config:repo-trusted`, `config:no-git-repo`, `config:repo-trust-declined`, markers `confirm_repository_trust` | repository trust confirmation; this runtime has its own trust gate |
| `chunk-8e9fdjt4.js` | 2888 | a small destructuring helper | pure code leaf |
| `chunk-9em13yqt.js` | 2887 | markers `projects`, `subagents`, `transcript` | no literal of its own |
| `chunk-p6q2xt56.js` | 2881 | ` \\u2014 run `claude login` to refresh your session, or verif`, `Self-hosted runner management is only available on the first` | hosted environment-management tool |
| `chunk-nvvjbm1y.js` | 2877 | `[mcp error detail unavailable: redaction failed]` | MCP error redaction; this runtime redacts its own MCP errors |
| `chunk-2wm7f6yt.js` | 2871 | `report the issue at https://github.com/anthropics/claude-cod`, markers `blocked_restriction`, `blocked_tainted` | error reporting gate; this runtime has its own |
| `chunk-z789az26.js` | 2849 | `-//Apple//DTD PLIST 1.0//EN`, `http://www.apple.com/DTDs/PropertyList-1.0.dtd` | property-list serialisation; this runtime writes its own formats |
| `chunk-55rwxm3c.js` | 2827 | `) does not resolve to the public CDN (downloads.claude.ai). `, markers `tengu_plugin_remote_fetch`, `dns_or_refused` | plugin fetch pinned to a vendor CDN; this runtime's plugin sources are caller-configured, so there is no fixed expected host to pin |
| `chunk-t9m5acj4.js` | 2811 | a small text helper, markers `environment_secret`, `access_token`, `response` | hosted environment secrets and ingress tokens |
| `chunk-gkhqcgnn.js` | 2808 | markers `transcript_cleared`, `session_start` | no literal of its own |
| `chunk-sabjpebs.js` | 2800 | `Catch-all for any task that doesn't fit a more specific agen` | agent type catalogue; this runtime has its own agent types |
| `chunk-hvdnvcfg.js` | 2798 | `https://json-schema.org/draft/2020-12/schema`, `MCP: draft 2020-12 meta-validator unavailable` | MCP tool schema validation; this runtime validates its own |
| `chunk-apky5tj5.js` | 2792 | marker `function` | no literal of its own |
| `chunk-1wt7fpjh.js` | 2779 | `${GH_TOKEN:-}${GITHUB_TOKEN:-}${GH_ENTERPRISE_TOKEN:-}` | token environment expansion in a command; this runtime expands its own |
| `chunk-5cmjnf0r.js` | 2766 | `Send a notification to the user via their terminal and, when`, `build failed: 2 auth tests` | terminal notification; this runtime notifies its own way |
| `chunk-fdxhcr6b.js` | 2740 | `Signal listener(s) threw` | signal listener error reporting; this runtime has its own |
| `chunk-acj4sqtk.js` | 2734 | `device unbound-creates read failed`, `device unbound-creates write failed` | hosted device binding state |
| `chunk-b1475ctq.js` | 2707 | `fill in a form field`, `read console messages`, `read network requests` | hosted browser automation verbs |
| `chunk-eb9r2hbv.js` | 2706 | markers `language`, `grapheme` | no literal of its own |
| `chunk-sypfrx68.js` | 2704 | marker `archived` | no literal of its own |
| `chunk-z0n2djw5.js` | 2685 | `Send one or more files to the user`, `the failing case is row 42` | the file-sending tool surface, a product surface without a local counterpart |
| `chunk-2h78b7n5.js` | 2679 | marker `job_sweep_drafts` | no literal of its own |
| `chunk-xxz4a49n.js` | 2672 | `shutdown complete: every open request finished, none was cut` | shutdown draining; this runtime drains its own |
| `chunk-9vk2r9dw.js` | 2656 | marker `localhost` | no literal of its own |
| `chunk-yars701z.js` | 2655 | markers `not_enforced`, `out_of_order`, `delivered` | no literal of its own |
| `chunk-6k07rctx.js` | 2654 | `Tool execution failed`, `InputValidationError: `, `Invalid tool parameters` | tool input validation; this runtime validates its own tool calls |
| `chunk-xr99wkvg.js` | 2650 | `[mcp-policy-cold-start] waiting on remote managed-settings c`, `mcp_policy_settings_wait_ms`, `timed_out` | MCP policy waiting on remote managed settings; the managed-settings family recorded in slices nineteen, twenty and twenty-three |
| `chunk-7kcepcx4.js` | 2636 | marker `oversized` | no literal of its own |
| `chunk-sahdsq7n.js` | 2632 | a `pasted_content` envelope parser | pasted-content handling; this runtime parses its own input |
| `chunk-5s50d32n.js` | 2624 | markers `workshop_turn`, `workshop_build_started`, `workshop_first_page` | hosted workshop surface |
| `chunk-dsn94zf4.js` | 2619 | `Error: the proxy setting named above is refused.` | proxy setting vetting; this runtime reads its own proxy settings |
| `chunk-rtrtjevx.js` | 2607 | `[bridge:projects] binding names an unexpected MCP server `, `api base is not an approved ingress origin` | hosted bridge project bindings |
| `chunk-x3et6ayt.js` | 2603 | `Tell the user it was not attached.`, markers `credential_name`, `hard_links`, `not_regular`, `too_large` | attachment vetting: this runtime's read path already confines, refuses a non-regular file, caps the size and re-verifies dev and ino, but does not refuse a credential-shaped name or a file with more than one hard link |
| `chunk-36h2ba6n.js` | 2596 | markers `artifact_live_subscribe`, `subagent_arm_evicted`, `subagent_arm_orphaned` | hosted artifact subscription arms |
| `chunk-2mwn91qc.js` | 2589 | `/api/oauth/organizations/:orgUUID/skills/list-skills?include`, `skills_sync_download_not_ok` | OAuth organization skill sync, excluded with OAuth |
| `chunk-r424b6xk.js` | 2569 | `--permission-mode=` | the permission-mode flag; this runtime has its own |
| `chunk-j4veqdye.js` | 2556 | markers `stop_task`, `send_task_message`, `set_permission_mode`, `set_model` | no literal of its own |
| `chunk-31cgx48f.js` | 2553 | markers `not_recordable`, `kept_existing`, `recorded`, `read_failed` | no literal of its own |
| `chunk-hgqhyp1m.js` | 2553 | `session ingress token`, `Session ingress token re-read from well-known file` | hosted session ingress tokens, excluded with credentials |
| `chunk-v30pyx7a.js` | 2550 | `disabled after repeated failures \\xB7 restart to retry`, `Remote Control not started here` | hosted Remote Control state |
| `chunk-z6yhgx3x.js` | 2534 | `useHost cannot be called outside of a <SessionProvider /> or`, `useSession cannot be called outside of a <SessionProvider />` | hosted UI provider guards |
| `chunk-6b36tbtb.js` | 2533 | marker `transcript` | no literal of its own |
| `chunk-y5d901dg.js` | 2528 | `1 background dynamic workflow`, `1 Artifact comment monitor`, markers `local_agent`, `remote_agent` | background work summary; this runtime summarises its own |
| `chunk-vew7ssxx.js` | 2527 | marker `permission` | no literal of its own |
| `chunk-qr9z1wer.js` | 2524 | `Stopped waiting for the remote \\u2014 the command may still ` | hosted remote wait cancellation |
| `chunk-6emtyxxw.js` | 2516 | `This tool call's approval was for different arguments. Ask t`, `Nothing ran: the user's approval was stored without this cal` | an approval stored against the exact arguments it was granted for; this runtime decides each call statelessly and keeps no approval store to bind |
| `chunk-90h4tje8.js` | 2516 | `@aws-sdk/credential-provider-process - fromProcess` | vendored AWS process credential provider |
| `chunk-0wxf3phv.js` | 2515 | `report the issue at https://github.com/anthropics/claude-cod`, markers `claude_code_vscode`, `remote_cowork` | hosted issue reporting and client identities |
| `chunk-cmj9h994.js` | 2503 | `tengu_official_plugin_prompt_overrides: GB payload is not an` | plugin prompt overrides; this runtime has its own plugin prompts |
| `chunk-w2bp5tz4.js` | 2495 | markers `tengu_log_datadog_events`, `tengu_oauth_success`, `tengu_oauth_token_refresh_lock_acquiring` | hosted telemetry and OAuth token refresh, excluded with OAuth |
| `chunk-rrrfrwjr.js` | 2475 | marker `offscreen` | no literal of its own |
| `chunk-wa84971e.js` | 2472 | `[vitals] no session token file on this worker; guest vitals ` | hosted vitals worker |
| `chunk-rkcvbgse.js` | 2470 | marker `inconclusive` | no literal of its own |
| `chunk-tdjxpe2m.js` | 2454 | `https://api.github.com` | hosted GitHub API use |

Thirty-three further modules carry no literal of their own, and most of them are half or more import statements.

The band reads as fifty-four modules with no characterising literal of their own, twenty-two with local counterparts, sixteen hosted surfaces, four modules excluded with credentials or OAuth, one vendored package, one pure code leaf, one product surface without a local counterpart and one candidate. It records the eighth candidate: an attachment path is refused when its name is credential-shaped or when it has more than one hard link, over a read path this runtime already owns. The covered half is the attachment read at `src/media.ts:98-125`, which confines the path inside the workspace, opens with `O_NOFOLLOW`, refuses anything that is not a regular file, caps the size, and re-verifies device and inode before returning bytes; the uncovered half is the credential-shaped-name refusal and the hard-link refusal, neither of which appears anywhere in the local source. Two rows extend families already open rather than adding candidates: the MCP policy cold start waits on remote managed settings, the managed-settings family this file has recorded in slices nineteen, twenty and twenty-three, and an approval stored against the exact arguments it was granted for describes a rule over a surface this runtime does not have, because it decides each call statelessly and keeps no approval store.

## Slice twenty-six: uncited modules ranked 1421 to 1520

Ranks 1421-1520 of the uncited list (157,862 bytes, 100 modules, 2,451 bytes down to 1,970). Import text is 22.9% of the band and 65 modules carry content, twenty-one of those only through state-name markers; thirty-five carry nothing of their own. This band is the last of the two-kilobyte-and-under prose: terminal integration and clipboard transports, session colour and teammate bookkeeping, login and subscription surfaces, startup phase ordering, and the hosted bridge, fleet and dev-intent surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-1hykqabe.js` | 2451 | marker `directory` | no literal of its own |
| `chunk-dwx5j03m.js` | 2442 | a small bracketed-token parser | pure code leaf |
| `chunk-jnzyk1sw.js` | 2425 | `it2 was found on PATH \\u2014 check that the iTerm2 Python `, `(Preferences > General > Magic > Enable Python API).` | terminal integration diagnostics; this runtime has its own |
| `chunk-71e3nz8p.js` | 2412 | `/api/oauth/organizations/:orgUUID/claude_code/pro_trial`, markers `ineligible`, `not_started` | OAuth organization trial endpoint, excluded with OAuth |
| `chunk-4hfbst3m.js` | 2396 | markers `settings`, `rejected` | no literal of its own |
| `chunk-v6ynfd2k.js` | 2393 | `The Docs type is filled only through the first-party Claud`, markers `claudedocs`, `claudepages` | hosted docs surfaces |
| `chunk-khw18tw4.js` | 2384 | marker `permissions` | no literal of its own |
| `chunk-e40t8aht.js` | 2369 | `(unrecognized address)` | address formatting; this runtime formats its own |
| `chunk-4hvygm2f.js` | 2368 | `Starting new login following /usage-credits. Exit with Ctr` | hosted login flow |
| `chunk-8dde28qh.js` | 2361 | `hosted desktop reached past its tools` | hosted desktop surface |
| `chunk-89aw29ag.js` | 2353 | marker `unmarked` | no literal of its own |
| `chunk-ffrzgf4k.js` | 2345 | `(Copied to tmux buffer \\xB7 select the URL manually if pas`, `(Sent via OSC 52 \\xB7 select the URL manually if paste fai` | clipboard transports; this runtime has its own clipboard |
| `chunk-1fn2qn0y.js` | 2340 | markers `malformed`, `no_shared_version`, `requested` | no literal of its own |
| `chunk-1achhxwq.js` | 2335 | `McpTask.kill: onWorkerWakeOutcome threw, the stop continue`, marker `mcp_task` | MCP task teardown; this runtime drives its own tasks |
| `chunk-tkk73e47.js` | 2318 | `Error: --watch-artifact expects an artifact id or a claude`, `--watch-artifact-no-autoreact=` | hosted artifact watch flag |
| `chunk-wtdka69b.js` | 2315 | `is disabled by CLAUDE_CODE_DISABLE_AGENT_VIEW`, `is disabled by the 'disableAgentView' setting` | hosted agent view toggles |
| `chunk-yks34f89.js` | 2313 | marker `readable` | no literal of its own |
| `chunk-0rakhf2s.js` | 2305 | `[drainRunLoop] pump started`, `[cu-esc] registerEscape returned false` | run-loop draining and escape registration; this runtime has its own loops |
| `chunk-kyy5nfa1.js` | 2303 | `Showing fewer prompt suggestions`, ` \\xB7 use one to bring them back` | prompt suggestion back-off; this runtime suggests its own |
| `chunk-p7tzn9jv.js` | 2272 | `useKillRing cannot be called outside of a <KillRingProvide` | terminal UI provider guard; this runtime has its own UI |
| `chunk-p8pr216r.js` | 2270 | markers `defaults`, `no_backup`, `cfprefsd`, `restored` | platform preferences handling; this runtime has its own |
| `chunk-t0mb9hr8.js` | 2270 | `Do you want to use this API key?`, `Detected a custom API key in your environment` | detected key consent; this runtime reads its own key |
| `chunk-a4gns8gb.js` | 2261 | `its socket directory could not be set up`, `its socket path is not a usable local address`, markers `socket_dir_refused`, `bind_failed` | a unix control socket setup rule, guarding a surface this runtime does not have |
| `chunk-p9x8seqp.js` | 2231 | `Propose a session goal condition, with one-keypress user a`, `make the tests pass` | the goal condition surface, a product surface without a local counterpart |
| `chunk-4t0s8gye.js` | 2228 | `Structured output was retracted by a model fallback and no` | structured output retraction; this runtime has its own structured output |
| `chunk-fdehaew6.js` | 2222 | `app:toggleTranscript`, marker `action_not_found` | keybinding action ids; this runtime binds its own keys |
| `chunk-pft5jvhp.js` | 2219 | `@aws-sdk/credential-provider-web-identity - fromWebToken`, `Web identity configuration not specified` | vendored AWS web identity provider |
| `chunk-55s2xjk4.js` | 2210 | `the plugin-hook registration pass`, `the remote managed-settings load`, `the policy-limits load` | startup phase ordering; the managed-settings family recorded in slices nineteen to twenty-five |
| `chunk-fd2yg008.js` | 2208 | `You are already on the highest Max subscription plan. For ` | hosted subscription flow |
| `chunk-f02nys6n.js` | 2206 | markers `sdk_host`, `tengu_proactivity_cycle` | no literal of its own |
| `chunk-pvxfv19b.js` | 2199 | `app:toggleTranscript` | keybinding action id; this runtime binds its own keys |
| `chunk-cews7mk7.js` | 2196 | markers `not_eligible`, `settings_pending_empty`, `started_in_init_empty` | no literal of its own |
| `chunk-sm8jk17g.js` | 2192 | markers `standard`, `control_response`, `error_during_execution` | no literal of its own |
| `chunk-m9s4y488.js` | 2191 | markers `call_endpoint`, `write_db`, `files_string_list` | hosted database and endpoint tool surface |
| `chunk-pxjy4t8j.js` | 2162 | markers `autocomplete`, `elicitation` | no literal of its own |
| `chunk-3fs5mn0t.js` | 2160 | marker `subagents` | no literal of its own |
| `chunk-0yczyn9c.js` | 2158 | markers `tengu_warm_sunrise`, `tengu_vast_puddle` | no literal of its own |
| `chunk-ezerben3.js` | 2154 | `A background launch rule needs background tasks disabled f`, `A background launch rule is already installed` | background launch rule validation; this runtime has its own background rules |
| `chunk-1tsh4em7.js` | 2150 | marker `child_process` | no literal of its own |
| `chunk-6p4kvraw.js` | 2147 | markers `local_agent`, `remote_agent`, `local_workflow` | no literal of its own |
| `chunk-zm6kh5jw.js` | 2147 | `Cannot set color: This session is a teammate. Teammate col`, `Session color reset to default` | session colour rules; this runtime has its own session state |
| `chunk-kd3dbbtb.js` | 2146 | `function hooks error (message not reported: it may contain` | hook error redaction; this runtime redacts its own |
| `chunk-btcaa7nx.js` | 2144 | `This directory already exists \\u2014 write to it directly ` | scaffolding guidance; this runtime scaffolds its own |
| `chunk-dr9qwf5q.js` | 2133 | ` Run a narrower command instead: read part of the file (of`, markers `tool_error`, `replayed`, `served_at` | narrower-command guidance after a refusal, the W01 permission family |
| `chunk-m676y3ka.js` | 2129 | `Not in a GitHub repository, skipping path mapping update` | repository path mapping; this runtime maps its own paths |
| `chunk-1p2sk76z.js` | 2122 | markers `claude_md`, `output_style` | no literal of its own |
| `chunk-82enqqqt.js` | 2113 | `home settings: the record of what was sent could not be wr` | hosted home settings seed record |
| `chunk-1yby7m6m.js` | 2083 | `this server could not read the version of the interface th`, markers `session_too_old`, `daemon_too_old` | interface version checks between session and daemon; this runtime owns its daemon |
| `chunk-ec2v5y16.js` | 2069 | markers `remote_tools_host_inventory`, `unsupported_platform`, `deadline` | hosted remote tool host inventory |
| `chunk-w2r9hdjf.js` | 2068 | markers `filesystem`, `system_settings` | no literal of its own |
| `chunk-p3nvgjww.js` | 2053 | marker `tengu_tab_read_sep` | no literal of its own |
| `chunk-gkdkfb30.js` | 2050 | `project dev intent send failed`, markers `android_app`, `dev_intent_detect` | hosted dev-intent surface |
| `chunk-31crqhvq.js` | 2047 | markers `completed`, `background`, `foreground` | no literal of its own |
| `chunk-tf732hny.js` | 2044 | `Help me fix these Claude Code settings issues.`, `For each issue: briefly explain what the fix will do, then` | a settings-repair prompt; this runtime has its own diagnostics |
| `chunk-fnhgbhf6.js` | 2041 | `omitted from outcomes.branches (the runner stays on the cl`, `[bridge] no session-anchored default-branch evidence` | hosted bridge branch evidence |
| `chunk-t2x9eyac.js` | 2036 | markers `constructor`, `prototype` | no literal of its own |
| `chunk-gmqwd72e.js` | 2033 | `MCP tool execution result`, `MCPTool requires permission.` | MCP tool results and permission; this runtime runs its own MCP tools |
| `chunk-0jyjhrht.js` | 2021 | markers `node_modules`, `commands` | no literal of its own |
| `chunk-hpbwrkmm.js` | 2020 | `Error: --agents takes a JSON object, or a file path only w` | the agents flag; this runtime has its own |
| `chunk-fch65n13.js` | 2014 | `app:toggleTranscript` | keybinding action id; this runtime binds its own keys |
| `chunk-xq2em4bw.js` | 2005 | markers `assistant`, `api_retry` | no literal of its own |
| `chunk-akfkn8xh.js` | 2004 | marker `interactive` | no literal of its own |
| `chunk-yvj2yhad.js` | 1998 | markers `permission_bridge_relay`, `toolname_mismatch` | hosted bridge permission relay |
| `chunk-93jnxr7z.js` | 1993 | `CA certs: skipping settings-sourced NODE_EXTRA_CA_CERTS un`, marker `ca_certs_load` | a CA certificate loading rule, guarding a surface this runtime does not have |
| `chunk-76f8dpa7.js` | 1981 | markers `powershell`, `ipconfig`, `hostname` | shell reading patterns, the W01 permission family |

Thirty-five further modules carry no literal of their own, and most of them are half or more import statements.

The band reads as fifty-six modules with no characterising literal of their own, twenty-six with local counterparts, twelve hosted surfaces, two rules guarding surfaces this runtime does not have, one module excluded with OAuth, one vendored package, one pure code leaf and one product surface without a local counterpart. It records no candidate, and two rules that could have become one closed on the local read: a unix control socket refused when its directory cannot be set up or its path is not a usable local address guards a surface this runtime does not have, because it runs no unix-socket server, and a CA certificate loader that skips a settings-sourced `NODE_EXTRA_CA_CERTS` value guards a surface it does not have either, because the local source never reads a CA certificate configuration. One row extends the managed-settings family this file has recorded since slice nineteen: the startup phase ordering names the remote managed-settings load among the passes it sequences.

## Slice twenty-seven: uncited modules ranked 1521 to 1620

Ranks 1521-1620 of the uncited list (119,654 bytes, 100 modules, 1,968 bytes down to 1,651). Import text is 35.4% of the band and 50 modules carry content, thirteen of those only through state-name markers; fifty carry nothing of their own. This band is the under-two-kilobyte tail: MCP dialling and tool discovery, GitHub CLI and plugin directory handling, shell allow rules, usage-limit reporting, and the hosted connector, tunnel, voice and device surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-8ndanznr.js` | 1968 | `MCP lazy dial timed out connecting`, `MCP lazy dial aborted before connect` | MCP lazy dialling; this runtime dials its own servers |
| `chunk-tfm99p8y.js` | 1967 | `Expected a function` | argument validation; this runtime validates its own |
| `chunk-vgthw1fb.js` | 1964 | marker `function` | no literal of its own |
| `chunk-35w06btb.js` | 1958 | `Search the MCP connector registry by keyword to discover`, `check my Asana tasks` | hosted connector registry |
| `chunk-6kv8cp3f.js` | 1952 | marker `callback` | no literal of its own |
| `chunk-gqbxc61m.js` | 1945 | `No providers in chain` | a vendored credential chain |
| `chunk-ketr5cx7.js` | 1941 | ``gh auth token` timed out`, ``gh auth status` timed out` | GitHub CLI integration; this runtime has its own |
| `chunk-sw3z2jzf.js` | 1938 | ` or the GitHub Enterprise host a command names`, ` and the hosts named below` | host vetting in permission rules; this runtime vets its own |
| `chunk-hb34zre7.js` | 1937 | `https://www.stickermule.com/claudecode`, `Opening sticker page in browser` | hosted sticker page |
| `chunk-z20de24a.js` | 1936 | `Remote Control is only available with claude.ai subscrip` | hosted Remote Control |
| `chunk-y284gcbm.js` | 1933 | markers `tengu_violin_strad`, `tengu_violin_maple`, `flag_off` | no literal of its own |
| `chunk-nekw1rqg.js` | 1926 | `Error: claude -p --cloud needs a task: pass it as the pr` | CLI flag validation; this runtime validates its own |
| `chunk-6nmqv5f1.js` | 1923 | `the server rejected tool discovery as unauthorized `, `superseded by a newer concurrent refresh of this server ` | MCP tool discovery refresh; this runtime refreshes its own |
| `chunk-vjx1sked.js` | 1923 | `Connect it via Settings \\u2192 Connectors on claude.ai (`, marker `tengu_mcp_local_oauth_blocked_hosts` | MCP local OAuth connector flow, excluded with OAuth |
| `chunk-tdbh6758.js` | 1907 | `https://clau.de/radio`, `Opening Claude FM in your browser` | hosted radio page |
| `chunk-rgay4wwx.js` | 1895 | marker `function` | no literal of its own |
| `chunk-4fxc6330.js` | 1891 | marker `connecting` | no literal of its own |
| `chunk-pnneq8td.js` | 1890 | marker `function` | no literal of its own |
| `chunk-asg98fgn.js` | 1878 | markers `session_switch`, `spawn_stamp`, `tengu_chrome_tools_added` | hosted browser tools |
| `chunk-7rs61wcn.js` | 1867 | `a custom system prompt, a tool allowlist, or restricted ` | agent definition fields; this runtime defines its own agents |
| `chunk-7yyzmq2m.js` | 1865 | an attribute and array normaliser | pure code leaf |
| `chunk-j48tx8jj.js` | 1863 | marker `appended` | no literal of its own |
| `chunk-v94c5hmj.js` | 1830 | ` (re-send; in-session pick stands)` | model pick state; this runtime picks its own |
| `chunk-ctwsvbjq.js` | 1817 | `template_refused: unknown_template`, `invalid_upload: bad_base64` | hosted template and upload checks |
| `chunk-jc1r95yy.js` | 1808 | `Name it for what it does.`, `If this is one of Anthropic's own plugins, validate the ` | plugin authoring guidance; this runtime has its own plugins |
| `chunk-91jeevtc.js` | 1806 | markers `tengu_auto_default_nudge_shown`, `switched`, `declined` | default-model nudge; this runtime has its own model choice |
| `chunk-g8mpmf0e.js` | 1806 | markers `non_https`, `unparseable`, `origin_extras`, `missing_ingress_url` | hosted ingress URL vetting |
| `chunk-sve74zfz.js` | 1799 | markers `dangerous_prefix`, `tengu_shell_allow_rules_at_init`, `tengu_shell_allow_rule_added` | shell allow rules with a dangerous-prefix notion, the W01 permission family |
| `chunk-k1gt97av.js` | 1791 | `@aws-sdk/token-providers - fromEnvSigningName`, `Could not load token from any providers` | vendored AWS token provider |
| `chunk-gzyqt42h.js` | 1778 | `useVoiceState must be used within a VoiceProvider` | the voice surface, a product surface without a local counterpart |
| `chunk-jr4zt5gv.js` | 1764 | `tool host attestation: reading tengu_vast_tulip threw; o`, `repository_trust.served_calls.unattested` | a tool host attestation gate, guarding a surface this runtime does not have |
| `chunk-83mjq7ab.js` | 1751 | `That answer arrived too quickly after the question to co` | an answer discarded for arriving implausibly fast after the question; this runtime accepts an answer when it arrives and measures no elapsed time |
| `chunk-0safrqpy.js` | 1743 | markers `tengu_tty_stream_error`, `tty_unavailable`, `override` | TTY stream handling; this runtime has its own terminal |
| `chunk-89g7p5za.js` | 1737 | `You can continue now. Continue the task you were working`, markers `five_hour`, `seven_day` | hosted usage-limit windows |
| `chunk-nmc2bp4h.js` | 1737 | marker `completion` | no literal of its own |
| `chunk-kz0df4tc.js` | 1732 | `getTeammateModeFromSnapshot called before capture - this` | hosted teammate mode |
| `chunk-8f8xamv4.js` | 1730 | a bracketed-token splitter | pure code leaf |
| `chunk-zrh141bk.js` | 1726 | markers `child_process`, `security` | no literal of its own |
| `chunk-j4hbysq9.js` | 1718 | markers `unplaced`, `verified`, `other_server` | hosted tool host placement |
| `chunk-3mzdbnan.js` | 1708 | `No available ports for OAuth redirect` | OAuth redirect ports, excluded with OAuth |
| `chunk-r79fmgd0.js` | 1704 | marker `indeterminate` | no literal of its own |
| `chunk-r9cfmqyq.js` | 1700 | `render an HTML file to a claude.ai web page` | hosted page rendering |
| `chunk-jgbprkn6.js` | 1681 | `Unset CLAUDE_CODE_PLUGIN_DIRS (in the environment, or in` | plugin directory environment; this runtime reads its own plugin configuration |
| `chunk-txt1tvjz.js` | 1680 | marker `function` | no literal of its own |
| `chunk-8wng8cn4.js` | 1679 | markers `get_device_info`, `device_bash`, `list_devices` | hosted device tools |
| `chunk-6b5hvjn6.js` | 1676 | marker `tengu_startup_announcements` | no literal of its own |
| `chunk-qgaar405.js` | 1672 | marker `function` | no literal of its own |
| `chunk-yfxs2hqh.js` | 1670 | ``claude plugin eval` is available in this session (gener` | plugin eval availability; this runtime has its own plugin tooling |
| `chunk-j4tp8n4e.js` | 1665 | `(value set by your organization)` | managed settings provenance; the managed-settings family recorded since slice nineteen |
| `chunk-m8cw1089.js` | 1663 | `the session tunnel's line of JSON` | hosted session tunnel |

Fifty further modules carry no literal of their own, and most of them are eighty percent or more import statements.

The band reads as sixty-three modules with no characterising literal of their own, sixteen with local counterparts, thirteen hosted surfaces, two vendored packages, two modules excluded with credentials or OAuth, two pure code leaves, one product surface without a local counterpart and one rule guarding a surface this runtime does not have. It records no candidate: a tool host attestation gate that counts unattested served calls and can raise a configuration exception guards a surface this runtime does not have, and an answer discarded for arriving implausibly fast after the question is one literal over an intake the runtime could plausibly own but far too little text to make a rule, so both are recorded rather than proposed. Two rows extend families already open rather than adding anything: shell allow rules carrying a dangerous-prefix notion, the W01 permission family, and a managed-settings value reported as set by the organization, the family recorded since slice nineteen.

## Slice twenty-eight: uncited modules ranked 1621 to 1720

Ranks 1621-1720 of the uncited list (92,032 bytes, 100 modules, 1,647 bytes down to 1,425). Import text is 30.3% of the band and 40 modules carry content, ten of those only through state-name markers; sixty carry nothing of their own. This band is the under-1.7-kilobyte remainder: hosted artifact, design and connector surfaces, browser and device tool naming, agent and subagent reporting, and the tail of the MCP, plugin and background-job plumbing.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-j6fk7hcd.js` | 1647 | `<the new Artifact's url>`, `<the tokens.json path above>`, `   // only with a design system` | hosted artifact and design scaffolding |
| `chunk-7n39kxwj.js` | 1625 | `useMcpConnections cannot be called outside of an <AppSta`, `useActivePlugins cannot be called outside of an <AppStat` | hosted UI provider guards |
| `chunk-6xrdcseg.js` | 1623 | `<!-- dataviz-callout -->`, markers `prototype_started`, `prototype_publish` | hosted prototype surface |
| `chunk-9jcxa30s.js` | 1621 | `stopped from session`, markers `job_stop_self`, `prompt_input_exit` | background job actions; this runtime runs its own background work |
| `chunk-nt1qy8sp.js` | 1621 | markers `tengu_juniper_relay`, `tengu_feedback_drafts_setting_changed` | no literal of its own |
| `chunk-8x1df3bs.js` | 1618 | `StdioServerTransport already started! If using Server cl` | a vendored MCP transport |
| `chunk-6d7qttpb.js` | 1607 | marker `trace_context` | no literal of its own |
| `chunk-c1r4rm9h.js` | 1605 | `file_upload is not available in this session, alone or i`, markers `browser_batch`, `read_page` | hosted browser tool availability |
| `chunk-pf51eqsx.js` | 1605 | marker `conflict` | no literal of its own |
| `chunk-ef12jbwb.js` | 1592 | markers `tengu_kairos_brief`, `tengu_kairos_brief_stop_hook_text` | hosted brief surface |
| `chunk-y5bh2ssh.js` | 1588 | markers `entrypoint`, `session_id`, `request_id` | no literal of its own |
| `chunk-a15vfg0h.js` | 1571 | `home ready row is off-schema`, markers `unsupported_version`, `malformed` | hosted home row schema |
| `chunk-45n90e94.js` | 1566 | `Wait for MCP servers that are still connecting and whose`, `yet in your tool list. Pass `servers` to wait for specif` | the MCP wait tool; this runtime waits for its own servers |
| `chunk-4ydpxa49.js` | 1564 | `Design agent access granted for your Claude Design proje`, `Design agent access revoked for your Claude Design proje` | hosted design-project access |
| `chunk-txyg0txt.js` | 1551 | markers `tengu_brindle_causeway`, `growthbook`, `tengu_mcp_sdk_generation` | hosted flag provider |
| `chunk-h5grhdx3.js` | 1545 | `(?<![\\w-])mcp__claude-device__chrome_[\\w-]*` | hosted device browser tool naming |
| `chunk-d2vt7d7f.js` | 1541 | `Launch a new agent to handle complex, multi-step tasks`, `A short (3-5 word) description of the task` | the subagent tool description; this runtime dispatches its own |
| `chunk-b3yd6bbr.js` | 1537 | marker `conversation_reset` | no literal of its own |
| `chunk-d5qj2cfe.js` | 1535 | markers `tool_reference`, `deferred_tools_delta` | no literal of its own |
| `chunk-m4np7bm0.js` | 1528 | `Resolve full connector payloads for directoryUuid values` | hosted connector payloads |
| `chunk-e5603psn.js` | 1527 | `List the MCP connectors installed for the user's claude.` | hosted connector listing |
| `chunk-ss3z45fz.js` | 1527 | `Resumed agent. Its final report is not in this message.`, `Resumed agent. Its final report follows this JSON, frame` | subagent resume reporting; this runtime reports its own |
| `chunk-8jdtp67h.js` | 1517 | markers `rejected`, `fulfilled`, `self_hosted_pool` | hosted self-hosted pool |
| `chunk-jth9xavg.js` | 1517 | marker `resource_link` | no literal of its own |
| `chunk-5q1mqj6a.js` | 1513 | `ComputerUseSession.reset() called while the lock cleanup` | the computer-use surface, a product surface without a local counterpart |
| `chunk-wg7kg2dm.js` | 1506 | markers `tengu_malort_pedway`, `tengu_dapper_acorn` | no literal of its own |
| `chunk-w87rxh9c.js` | 1504 | `.mcp.json servers are awaiting approval \\u2014 run `clau` | project-declared MCP servers held until the user approves them |
| `chunk-nkvcn1t9.js` | 1502 | marker `tool_result` | no literal of its own |
| `chunk-btevcxdf.js` | 1492 | `Turned off by your organization's settings (remoteTools.`, `Turned off in your user settings (remoteTools.allowUnatt` | unattended serving consent, forced off by organization or user settings |
| `chunk-95z6czbh.js` | 1490 | `https://clau.de/chrome/permissions` | hosted browser permissions page |
| `chunk-jx0gn306.js` | 1486 | markers `auto_mode_off`, `unattended_serving_off`, `consent_forced_off` | unattended serving consent, forced off |
| `chunk-4yt2mg41.js` | 1477 | markers `goal_set`, `resume_swap`, `tengu_goal_restored_on_resume` | the goal surface, a product surface without a local counterpart |
| `chunk-hf90k897.js` | 1468 | marker `bitbucket` | version-control host detection; this runtime detects its own |
| `chunk-xds8k7aa.js` | 1463 | `a network edge refused the connection before it reached `, `the connection was refused before it reached Anthropic (` | network error classification; this runtime classifies its own |
| `chunk-8f7kvc01.js` | 1456 | `Its marketplace is a folder whose catalog could not be r`, markers `unresolved`, `workspace` | plugin marketplace folder resolution; this runtime resolves its own |
| `chunk-e7v7g86m.js` | 1456 | marker `cli_error` | no literal of its own |
| `chunk-70nf72b4.js` | 1439 | `window-activation click`, markers `window_activation`, `mount_settle` | hosted UI window handling |
| `chunk-ppsy9aeg.js` | 1439 | markers `terminal_bell`, `iterm2_with_bell`, `permission_prompt`, `idle_prompt` | terminal bell and prompt classes; this runtime has its own terminal |
| `chunk-zssv4668.js` | 1432 | markers `peer_too_old`, `self_too_old` | hosted peer protocol versions |
| `chunk-j6je5ybw.js` | 1425 | `job folder not made` | background job folders; this runtime makes its own |

Sixty further modules carry no literal of their own, and most of them are seventy percent or more import statements.

The band reads as seventy modules with no characterising literal of their own, fifteen hosted surfaces, nine with local counterparts, two product surfaces without a local counterpart, two rules guarding surfaces this runtime does not have, one vendored package and one candidate. It records the ninth candidate: a project-declared MCP server is held until the user approves it, while this runtime connects a server declared by a workspace-controlled settings layer with no approval step. The covered half is the layered settings read at `src/config.ts:913-936`, which includes the workspace's own `.harness/settings.json` and `settings.local.json` before merging, and the schema-parsed `mcpServers` that reaches `connectMcpServers(config.mcpServers ?? {})` at `src/runtime.ts:443`; the uncovered half is any approval before a declaration from that layer is connected, and the local source has no such gate. Two rows extend families already recorded rather than adding candidates: unattended serving consent, forced off by organization or user settings and carrying accepted, declined and not-saved states, guards a surface this runtime does not have, and completes the attestation family slice twenty-seven named; and a goal restored on resume belongs to the goal surface this runtime also lacks.

## Slice twenty-nine: uncited modules ranked 1721 to 1820

Ranks 1721-1820 of the uncited list (69,906 bytes, 100 modules, 1,424 bytes down to 1,209). Import text is 24.9% of the band and 35 modules carry content, eleven of those only through state-name markers; sixty-five carry nothing of their own. This band is the last of the above-one-kilobyte prose: policy and managed-settings reporting, daemon and background bookkeeping, cross-session messaging, Windows command resolution, and single-purpose hosted surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-8rac8rc8.js` | 1424 | `[bridge:meta-mcp] meta tools[] is not an array`, `[bridge:meta-mcp] injected tools[] entry is malformed` | hosted bridge meta-MCP injection |
| `chunk-y6betqnz.js` | 1420 | marker `tengu_marble_heron` | no literal of its own |
| `chunk-kp48t6p5.js` | 1403 | `first-party design MCP server requires consent` | MCP server consent; the MCP admission surface this runtime owns, and the same rule candidate nine records from the project-declaration side |
| `chunk-qnkbf575.js` | 1400 | markers `tengu_dead_probe_adopt_ticks_token`, `kill_gate` | no literal of its own |
| `chunk-twdfzmms.js` | 1391 | `Set a goal Claude checks before stopping`, `Set a goal \\u2014 keep working until the condition is me` | the goal surface, a product surface without a local counterpart |
| `chunk-kdp5d13b.js` | 1389 | markers `resolved`, `mismatch` | no literal of its own |
| `chunk-630w4d34.js` | 1388 | `it is held for good, or refused to this process`, `Start the daemon again once this is mended.` | daemon lease states; this runtime owns its own daemon |
| `chunk-9z39tx1m.js` | 1381 | marker `continue` | no literal of its own |
| `chunk-fsfwqvh9.js` | 1379 | an alphabet constant | pure code leaf |
| `chunk-ngwfw4c8.js` | 1362 | `ZDR (Zero Data Retention)`, `Per your organization's policy, some features are limite` | organization policy reporting; this runtime has its own policy helper |
| `chunk-dp4bc9y2.js` | 1357 | `HKLM\\SOFTWARE\\Policies\\ClaudeCode`, `HKCU\\SOFTWARE\\Policies\\ClaudeCode`, `/mnt/c/Program Files/ClaudeCode` | managed-settings sources on Windows; this runtime reads its own sources |
| `chunk-3d3zazvg.js` | 1351 | markers `tengu_harbor_ledger`, `allow_channels`, `route_missing` | hosted channel routing |
| `chunk-85qtx5w6.js` | 1345 | markers `tengu_bg_low_mem_mb`, `tengu_bg_attach_upgrade` | background memory states; this runtime runs its own background work |
| `chunk-1shb9gj1.js` | 1340 | marker `tengu_kairos_cron_config` | hosted scheduled configuration |
| `chunk-navv1d1v.js` | 1338 | `request event dropped after an upload attempt that may h`, `request withdrawn before it left this process; not deliv` | hosted request delivery states |
| `chunk-qys3nxrm.js` | 1337 | `Load the reference for writing Workflow tool scripts` | workflow authoring reference; this runtime runs its own workflows |
| `chunk-fg1mspy7.js` | 1328 | `cannot form a device hook id from these inputs` | hosted device hook ids |
| `chunk-jwjgedet.js` | 1324 | marker `allow_bundled_skills` | bundled skills admission; this runtime has its own skills |
| `chunk-k1419ccf.js` | 1308 | markers `function`, `unchanged`, `conflict` | no literal of its own |
| `chunk-gxjdapnz.js` | 1305 | `%windir%\\System32\\REG.exe`, `%windir%\\sysnative\\cmd.exe /c ` | Windows command resolution; this runtime resolves its own |
| `chunk-5yrdvprx.js` | 1297 | marker `run_in_background` | no literal of its own |
| `chunk-jce4gshh.js` | 1289 | `Cross-session messaging is not available in this session` | cross-session messaging; this runtime has its own peer messages |
| `chunk-f0pxkrbh.js` | 1274 | markers `restricted`, `malformed` | no literal of its own |
| `chunk-bqbdppwe.js` | 1263 | marker `tengu_hazel_trellis` | no literal of its own |
| `chunk-6nfqw5w9.js` | 1261 | markers `tengu_pewter_owl_model`, `pewter_owl_tool` | hosted brief surface |
| `chunk-86dmqjvk.js` | 1261 | `Running SessionStart hooks\\u2026` | session-start hooks; this runtime runs its own hooks |
| `chunk-jya10f7t.js` | 1256 | markers `mcp_elicitation`, `mcp_elicitation_waiting`, `cancelled` | no literal of its own |
| `chunk-d4f8v144.js` | 1246 | markers `allow_plugin_skill_search`, `org_denied`, `unregistered` | plugin skill search admission; this runtime has its own plugins |
| `chunk-712v9m5y.js` | 1236 | markers `slack_send_message`, `slack_post_message` | hosted Slack tool surface |
| `chunk-rpjrsrzf.js` | 1228 | markers `boot_404`, `never_published`, `other_org`, `public_outside_org` | hosted artifact visibility states |
| `chunk-v6j3m91r.js` | 1216 | marker `tool_use` | no literal of its own |
| `chunk-zs86hcan.js` | 1216 | marker `file_attachments` | no literal of its own |
| `chunk-9w5kf8rs.js` | 1210 | `https://artifact.invalid/` | hosted artifact placeholder origin |
| `chunk-pg5q08zd.js` | 1210 | `Hex encoded strings must have an even number length` - a hex decoder | pure code leaf |
| `chunk-chkhyhk3.js` | 1209 | `embedded asset is missing or corrupt` | embedded asset handling; this runtime has its own assets |

Sixty-five further modules carry no literal of their own, and most of them are ninety percent or more import statements.

The band reads as seventy-six modules with no characterising literal of their own, twelve with local counterparts, nine hosted surfaces, two pure code leaves and one product surface without a local counterpart. It records no candidate of its own and one corroboration: a first-party design MCP server that requires consent applies the same rule the ninth candidate records from the project-declaration side, so the recovered client asks before connecting an MCP server in more than one place while this runtime connects every declared server without asking. One row extends the managed-settings family this file has recorded since slice nineteen: the Windows policy registry keys and the in-WSL programme-files path are settings sources this runtime reads from its own layer list instead.

## Slice thirty: uncited modules ranked 1821 to 1920

Ranks 1821-1920 of the uncited list (50,996 bytes, 100 modules, 1,209 bytes down to 1,046). Import text is 27.5% of the band and 39 modules carry content, eighteen of those only through state-name markers; sixty-one carry nothing of their own. This band is the last of the above-one-kilobyte modules: permission message fragments, organization MCP policy, launch ancestry and path text, skills bookkeeping, and the hosted machine-identity, powerup, whiteboard and prompt-bundle surfaces.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-jhkb87rz.js` | 1209 | `kenv -q smbios.system.uuid` | hosted machine identity |
| `chunk-yzah55fq.js` | 1208 | `you are not signed in, or this machine is not authorized to write to the session`, `without your deny and ask rules` | two message fragments about a session that cannot write; the polarity of the second cannot be fixed from the fragment alone, so this is recorded as an open reading and not a rule |
| `chunk-n3qe6f2e.js` | 1207 | markers `mcp_url_elicitation`, `tengu_mcp_discovery_cache_enable` | no literal of its own |
| `chunk-dna847bk.js` | 1203 | marker `mcp_task` | no literal of its own |
| `chunk-rdpb9c0j.js` | 1202 | markers `tengu_wise_bear_copy`, `seven_day_opus`, `seven_day_sonnet` | hosted usage windows |
| `chunk-29x12e55.js` | 1192 | marker `completed` | no literal of its own |
| `chunk-xmdpqvbv.js` | 1192 | a path-character test over split segments | path text vetting; the W09 family |
| `chunk-m1swb7sb.js` | 1191 | marker `suggestion` | no literal of its own |
| `chunk-hsd9nysw.js` | 1186 | markers `hook_additional_context`, `hook_blocking_error`, `hook_success` | no literal of its own |
| `chunk-ekmvkx2h.js` | 1183 | marker `versions` | no literal of its own |
| `chunk-ny55yhge.js` | 1181 | marker `local_jsx` | no literal of its own |
| `chunk-b08e56d8.js` | 1172 | marker `none_yet` | no literal of its own |
| `chunk-j7bqdeg6.js` | 1172 | markers `unstated`, `unreadable`, `requested`, `detached` | no literal of its own |
| `chunk-exbrpgbv.js` | 1168 | markers `tengu_violin_willow`, `tengu_violin_wood` | no literal of its own |
| `chunk-34wj73gb.js` | 1161 | `Quick lessons on the things power users do \\u2014 plan m`, `New here? Type /powerup for a 5-minute tour` | the powerup tour surface, a product surface without a local counterpart |
| `chunk-94bnebpa.js` | 1160 | markers `invalid_type`, `too_small`, `invalid_format`, `unrecognized_keys` | a vendored validation library's issue codes |
| `chunk-drb19cer.js` | 1144 | `--chrome is blocked by your organization's MCP policy (a`, marker `bypassPermissions` | organization MCP policy denying a tool; the managed-settings family |
| `chunk-qdv5r5zs.js` | 1143 | markers `elsewhere`, `here_only`, `not_looked`, `tengu_remote_attach_record_lookup` | hosted remote attach records |
| `chunk-t58kj6z7.js` | 1142 | `This runtime has no Bun.ant.CellSegmenter. Run Claude Co` | hosted runtime capability absence |
| `chunk-j4nk8dcv.js` | 1134 | `localDisplayOnly ask not forwarded:` | permission forwarding states; this runtime forwards its own asks |
| `chunk-mq2bx360.js` | 1134 | markers `tengu_org_policy_denied`, `unregistered` | organization policy denial; this runtime reports its own policy |
| `chunk-tt59r4gs.js` | 1131 | marker `self_hosted_runner_` | no literal of its own |
| `chunk-dahea6vz.js` | 1130 | `Server returned 403 after trying upscoping`, `Server returned 401 after successful authentication` | hosted authentication scope escalation |
| `chunk-qs9zqxwh.js` | 1129 | marker `malformed` | no literal of its own |
| `chunk-736kh3vr.js` | 1123 | marker `notification` | no literal of its own |
| `chunk-qrdrfntr.js` | 1123 | marker `settings` | no literal of its own |
| `chunk-qy9nfxqx.js` | 1119 | `  dir         The mod's folder (default: the current fol`, `Runs every *.test.ts and *.test.tsx under dir` | a test-runner command's help text; this runtime runs its own tests |
| `chunk-449ewv46.js` | 1106 | markers `skill_directory_reload`, `rehome_failed` | skill directory handling; this runtime reloads its own skills |
| `chunk-xmffr6gw.js` | 1094 | markers `whiteboard_publish`, `whiteboard_turn` | hosted whiteboard surface |
| `chunk-g5m3cxby.js` | 1085 | markers `workshop`, `whiteboard`, `prototype`, `schedule` | hosted surface catalogue |
| `chunk-v1xqn3wv.js` | 1081 | marker `string_decoder` | no literal of its own |
| `chunk-64e8mxz2.js` | 1072 | `Transport is closed` | transport state; this runtime has its own MCP transport |
| `chunk-0nsas8wt.js` | 1068 | marker `unhooked` | no literal of its own |
| `chunk-edc6v4z8.js` | 1067 | markers `launched_from_home`, `windows_profile_on_mount_without_drive` | launch ancestry and Windows profile paths; the W09 family |
| `chunk-es5g07ss.js` | 1066 | `Any Bash command`, `Any Bash command starting with `, `Any use of the ` | permission rule descriptions, the W01 family |
| `chunk-g9487cpm.js` | 1066 | markers `malformed`, `not_found`, `ambiguous` | no literal of its own |
| `chunk-tjh9gsg7.js` | 1062 | markers `downstream_unreachable`, `downstream_error` | no literal of its own |
| `chunk-0r0xqv8j.js` | 1061 | `A result could not be saved where the model reads files` | structured output save failure; this runtime saves its own structured output |
| `chunk-qnna9bgh.js` | 1057 | markers `fable_5_mitigations`, `fable_5_1_prompt_bundle` | hosted model prompt bundles |

Sixty-one further modules carry no literal of their own, and most of them are seventy-five percent or more import statements.

The band reads as seventy-nine modules with no characterising literal of their own, eleven with local counterparts, eight hosted surfaces, one product surface without a local counterpart and one vendored package. It records no candidate, and one row it deliberately does not turn into one: a session that is not signed in or is not authorized to write carries two message fragments, one saying the session cannot write and one naming the deny and ask rules, and the polarity of the second fragment cannot be established from an isolated constant, so the reading stays open rather than becoming a rule. Three rows extend families already open: path character vetting and launch ancestry name the W09 family, permission rule descriptions name the W01 family, and an organization MCP policy that blocks a tool names the managed-settings family recorded since slice nineteen.

## Slice thirty-one: uncited modules ranked 1921 to 2020

Ranks 1921-2020 of the uncited list (35,171 bytes, 100 modules, 1,041 bytes down to 895). Import text is 25.0% of the band and 40 modules carry content, twenty-two of those only through state-name markers; sixty carry nothing of their own. This band is the sub-kilobyte layer where every module is a fragment: hosted session and remote-control states, permissions and goals, terminal and deep-link handling, and single constants.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-zqn9y3gp.js` | 1029 | `[3P telemetry] OTEL diag error:` | hosted telemetry diagnostics |
| `chunk-s5mvqpy4.js` | 1026 | marker `tengu_amber_flint` | no literal of its own |
| `chunk-s98g3ktd.js` | 1024 | markers `permission_workflow`, `behavior`, `cancelled` | no literal of its own |
| `chunk-jrcc2jsw.js` | 1022 | `repl_main_thread:outputStyle:custom`, marker `repl_main_thread` | output style and REPL threading; this runtime has its own |
| `chunk-kjaawdkh.js` | 1016 | markers `allow_design_sync`, `tengu_omelette_grant_watch` | hosted design sync admission |
| `chunk-rb5hrqm8.js` | 1015 | markers `ccd_session_mgmt`, `recipient_kind`, `notify_when_idle` | hosted session management |
| `chunk-z3f0m1q8.js` | 1014 | markers `action_not_found`, `no_context` | no literal of its own |
| `chunk-zwvpggbj.js` | 1010 | `The OS protocol handler passes exactly `--handle-uri <ur` | deep-link handling; the W09/W10 vetting family |
| `chunk-4xj6t50t.js` | 1006 | markers `claude_ai_`, `claudeai_` | no literal of its own |
| `chunk-rm0tawrz.js` | 1006 | marker `computer_use_approval` | the computer-use surface, a product surface without a local counterpart |
| `chunk-zzrhqdzn.js` | 1006 | marker `function` | no literal of its own |
| `chunk-jq5m1vf8.js` | 997 | marker `function` | no literal of its own |
| `chunk-fhrtf84b.js` | 996 | markers `starting`, `resuming` | no literal of its own |
| `chunk-t8vb436n.js` | 988 | markers `action_not_found`, `no_context` | no literal of its own |
| `chunk-y5hvvr9q.js` | 981 | marker `external` | no literal of its own |
| `chunk-21ye35cj.js` | 978 | a character-code switch | pure code leaf |
| `chunk-p0w39gjb.js` | 973 | markers `tengu_radiant_heron`, `override`, `fallback` | no literal of its own |
| `chunk-chh7rz1n.js` | 961 | markers `fulfilled`, `connected` | no literal of its own |
| `chunk-w15j5w3t.js` | 956 | `remote-control-fork-seed:`, `remote-control-fork-parent:` | hosted remote-control fork markers |
| `chunk-rm1tkd2e.js` | 954 | marker `outcome_of` | no literal of its own |
| `chunk-e7qryjgw.js` | 945 | marker `tengu_hover_rest` | no literal of its own |
| `chunk-4e7xcb9m.js` | 941 | marker `function` | no literal of its own |
| `chunk-tajfn8hd.js` | 941 | `Select-Object -First, Select-Object -Last or Select-Stri`, `head, tail or grep` | narrower-command guidance for two shells, the W01 permission family |
| `chunk-zh3cktaw.js` | 939 | `could not read machine-id: unsupported platform` | a machine identity read, guarding a surface this runtime does not have |
| `chunk-j7nxf689.js` | 936 | markers `terminate`, `function` | no literal of its own |
| `chunk-6tsf12ka.js` | 935 | marker `tengu_buzzing_lightning` | no literal of its own |
| `chunk-0zq39nqh.js` | 931 | `shell command failed (detail withheld on this connection` | shell command reporting; this runtime runs its own shell work |
| `chunk-n6379ww5.js` | 925 | markers `allow_remote_sessions`, `policy_org` | hosted remote session admission |
| `chunk-73bqpaxc.js` | 923 | markers `remote_callout`, `cancelled` | hosted remote callouts |
| `chunk-r0g20c30.js` | 922 | marker `tengu_cedar_marsh` | no literal of its own |
| `chunk-sq2cq8kt.js` | 920 | marker `tengu_violin_fret` | no literal of its own |
| `chunk-5nf258q1.js` | 919 | marker `goal_proposal` | the goal surface, a product surface without a local counterpart |
| `chunk-8kx58byx.js` | 919 | `Remote Control is disabled by your organization's policy`, `Remote Control was turned off by your organization's pol` | hosted Remote Control policy |
| `chunk-edq7enfd.js` | 916 | marker `tengu_send_file` | no literal of its own |
| `chunk-kn3ntq3p.js` | 915 | markers `it2_setup`, `installed`, `cancelled` | terminal integration setup; this runtime has its own |
| `chunk-zf8k2z6n.js` | 906 | `sha256Hex: the data is neither text nor bytes` - a hash helper | pure code leaf |
| `chunk-b26c6m11.js` | 904 | marker `foreground` | no literal of its own |
| `chunk-nn5afh0z.js` | 904 | marker `remote_tools_reannounce` | no literal of its own |
| `chunk-pq0wcvc2.js` | 902 | `Cloud session active`, `Attached to cloud session` | hosted cloud session states |
| `chunk-gjq2f3sw.js` | 895 | marker `simplify` | no literal of its own |

Sixty further modules carry no literal of their own, and most of them are one or two import statements with a state name.

The band reads as eighty-two modules with no characterising literal of their own, eight hosted surfaces, five with local counterparts, two product surfaces without a local counterpart, two pure code leaves and one rule guarding a surface this runtime does not have. It records no candidate: a machine identity read that reports an unsupported platform guards a surface this runtime does not have, and every other reading in the band either belongs to a hosted surface or repeats a local one. Two rows extend families already open rather than adding anything: narrower-command guidance for PowerShell and for the POSIX tools, the W01 permission family, and deep-link handling that names the OS protocol handler's argument, the W09/W10 vetting family.

## Slice thirty-two: uncited modules ranked 2021 to 2120

Ranks 2021-2120 of the uncited list (21,119 bytes, 100 modules, 890 bytes down to 773). Import text is 27.6% of the band and only 19 modules carry content, eleven of those only through state-name markers; eighty-one carry nothing of their own. This is the smallest band in the review: 81 of its 100 modules are aggregators, most of them two or three imports and a re-export.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-4h4khrzx.js` | 890 | markers `windsurf`, `alacritty` | no literal of its own |
| `chunk-qgddjpxv.js` | 882 | marker `powershell` | no literal of its own |
| `chunk-ek438zk9.js` | 878 | marker `tengu_mcp_skills` | no literal of its own |
| `chunk-3rzg1srd.js` | 876 | `Theme takes the name of a theme` | theme selection; this runtime has its own themes |
| `chunk-rkt9x5nz.js` | 867 | markers `transport`, `connected` | no literal of its own |
| `chunk-np2hxx6s.js` | 862 | `Bypass permissions mode was disabled by settings` | permission mode state; the W01 family, and the surface the bypass-guard candidate from slice twenty-one concerns |
| `chunk-nq922405.js` | 843 | `/extra-usage is now /usage-credits` | hosted command rename notice |
| `chunk-tz1x0g31.js` | 842 | `useTerminalSize must be used within an Ink App component` | a vendored terminal UI library's guard |
| `chunk-ycjka6yj.js` | 841 | marker `child_process` | no literal of its own |
| `chunk-fb72dpse.js` | 833 | marker `tengu_violin_bridgepin` | no literal of its own |
| `chunk-t05cqr1r.js` | 833 | marker `nonconforming` | no literal of its own |
| `chunk-1d8w1b0d.js` | 826 | marker `allow_large` | no literal of its own |
| `chunk-v3g1yayj.js` | 826 | marker `tengu_concurrent_candle` | no literal of its own |
| `chunk-48j2kd7k.js` | 825 | `http://www.w3.org/1999/xhtml` - an XHTML namespace constant | pure code leaf |
| `chunk-p1dqh1yt.js` | 807 | marker `child_process` | no literal of its own |
| `chunk-r22p6ysy.js` | 804 | marker `tool_use_result` | no literal of its own |
| `chunk-7jm4faeg.js` | 785 | `Just want the answer? Run /focus now to hide the steps a`, `Focus view is on and the steps are hidden.` | the focus view surface, a product surface without a local counterpart |
| `chunk-nneapzja.js` | 776 | `Reserved placeholder that keeps deferred tool loading ac` | deferred tool loading; this runtime defers its own tools |
| `chunk-jdr4wxmh.js` | 773 | `claude-plugin-test-report ` | plugin test report; this runtime has its own plugin tooling |

Eighty-one further modules carry no literal of their own, and in this band that is almost the whole file: two or three import statements and a re-export, with no body to read.

The band reads as ninety-two modules with no characterising literal of their own, four with local counterparts, one hosted surface, one pure code leaf, one product surface without a local counterpart and one vendored package. It records no candidate and nothing new: a permission mode reported as disabled by settings belongs to the W01 family and to the surface the bypass-guard candidate from slice twenty-one concerns, deferred tool loading is a surface this runtime already has, and the remaining rows are a theme name, a command rename notice, an XHTML namespace and a vendored UI guard.

## Slice thirty-three: uncited modules ranked 2121 to 2220

Ranks 2121-2220 of the uncited list (13,023 bytes, 100 modules, 773 bytes down to 699). Import text is 35.6% of the band and only 18 modules carry content, ten of those only through state-name markers; eighty-two carry nothing of their own. This is the bottom of the corpus by size: every module is below 800 bytes, most are a single import or a state-name constant, and the band's whole byte mass is smaller than one module of slice four.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-vqejppw5.js` | 769 | `some files were skipped there`, `your settings file was not applied there` | settings application reporting; this runtime reports its own |
| `chunk-e1aq05k5.js` | 767 | marker `localhost` | no literal of its own |
| `chunk-hg6sq7aw.js` | 765 | `Manage background services and routines` | hosted routines surface |
| `chunk-ctfmr4y4.js` | 750 | marker `plugin_forwarding_disabled` | no literal of its own |
| `chunk-qwn6m3mn.js` | 750 | marker `tengu_violin_corner` | no literal of its own |
| `chunk-7nced1hz.js` | 749 | marker `tengu_violin_varnish` | no literal of its own |
| `chunk-dh4zj5kz.js` | 747 | marker `tengu_violin_tip` | no literal of its own |
| `chunk-k2pxx42t.js` | 747 | marker `tengu_violin_rib` | no literal of its own |
| `chunk-1f7ey3rr.js` | 746 | marker `tengu_lazy_dove` | no literal of its own |
| `chunk-tp0jd4t2.js` | 746 | marker `not_held` | no literal of its own |
| `chunk-nannv282.js` | 743 | markers `memory_list`, `memory_read`, `memory_write` | the memory tool surface; this runtime owns its own memory tools |
| `chunk-kc55f6aw.js` | 739 | markers `interactive`, `bg_session` | no literal of its own |
| `chunk-82t9spd3.js` | 736 | marker `tengu_copper_gazette` | no literal of its own |
| `chunk-6yn7jpmg.js` | 728 | markers `remote_tool_call`, `remote_tools_probe`, `remote_tools_reannounce` | hosted remote tool calls |
| `chunk-s44yve45.js` | 726 | marker `authorize_upload` | hosted upload authorisation |
| `chunk-m5jn4met.js` | 724 | marker `tengu_propose_goal` | the goal surface, a product surface without a local counterpart |
| `chunk-dgkgyjy5.js` | 717 | `Routines are disabled by your organization's policy.`, marker `allow_routines` | hosted routine admission |
| `chunk-92efj6xk.js` | 706 | marker `allow_web_fetch` | web fetch admission; this runtime admits its own fetches |

Eighty-two further modules carry no literal of their own; in this band that means a single import statement or a state-name constant with no body.

The band reads as ninety-two modules with no characterising literal of their own, four hosted surfaces, three with local counterparts and one product surface without a local counterpart. It records no candidate: everything readable is either a hosted surface, a state name, or a local surface this runtime already owns, and the band's total byte mass is smaller than a single module near the top of the corpus.

## Slice thirty-four: uncited modules ranked 2221 to 2267 - the last band

Ranks 2221-2267 of the uncited list: the remainder, 47 modules and 2,241 bytes, 697 bytes down to 615. This is the noise floor of the corpus. Only 4 modules carry content and 43 carry nothing at all, and seven of those have a **zero-byte body**: the file is its banner followed by a re-export statement and nothing else, so for those modules the recorded byte size is not content at all.

| Module | Bytes | What the literals show | Disposition |
| --- | --- | --- | --- |
| `chunk-prwr1nzt.js` | 688 | `claude native binary not installed` | native binary presence check; this runtime checks its own installation |
| `chunk-xgs2697n.js` | 683 | marker `tengu_umber_kestrel` | no literal of its own |
| `chunk-1qfa3hek.js` | 673 | `Unsupported control request subtype` | control protocol handling; this runtime has its own control surface |
| `chunk-ds0vnb6d.js` | 672 | `Sandbox required but unavailable` | sandbox availability; this runtime has its own sandbox decision |

Forty-three further modules carry no literal of their own, and seven of those - `chunk-6e4pv9ys.js`, `chunk-9fm17gv5.js`, `chunk-d1aahbgc.js`, `chunk-eamkhb9v.js`, `chunk-g1t9r9y0.js`, `chunk-p9frg3mj.js` and `chunk-xhar08fd.js` - have a zero-byte body: banner, one re-export, nothing else.

The band reads as forty-four modules with no characterising literal of their own and three with local counterparts. It records no candidate: the three readable lines are a native binary presence check, a control protocol error and a sandbox availability error, all describing surfaces this runtime already owns. With this band the review has read the uncited set end to end - every uncited module named in the ledger has now been read once, in thirty-four contiguous bands of a hundred ranks, from the largest module down to the seven that are nothing but a re-export.

The thirty-four slices have read every one of the two thousand two hundred and sixty-seven modules of the uncited list, in thirty-four contiguous bands, from the largest module down to the seven that are nothing but a re-export. No unread module remains, so there is no next band to take; what remains is the candidate list below, which is work for port packages rather than for this pass. The honest remainder is **2217 uncited modules with no marker**, and 2267 uncited modules in all. Reading a module in this file changes nothing - this file is not a citation source for the ledger - so the count stands exactly where it did before the first slice: what would move it is a package that cites the module it actually reads, and that is how the two ported modules below left the set. Recording a module here matters for the opposite reason: naming it in CURRENT or STATUS would move it out of the uncited set and into the prose count without adding port evidence, which is why slices eight onward name modules only here. Recording a module in this file changes nothing - it is not a citation source for the ledger - but naming one in CURRENT or STATUS does move it out of the uncited set and into the prose count without adding port evidence, and slices six and seven did that to three modules (`chunk-2kdsvp3x.js`, `chunk-bt8cr7rw.js` and `chunk-patq2z05.js`), which is why the uncited figure reads 2267 rather than 2270; slices eight and nine avoided it by naming modules here only. A package that actually ports a module adds port evidence, and this review has fed two of them: [W09](W09-path-chain.md) ported `chunk-gyf58rwf.js` and [W10](W10-include-link-vetting.md) ported the candidate this file recorded in slice five, `chunk-pn44qc66.js`. The ledger now reads 33 backed / 65 mentioned only in prose / 2267 uncited / 2217 without a marker. Slices six through eleven added no candidate of their own: slice six's two reusable rule sets guard surfaces this runtime does not have, slice seven's most interesting module is the source of the ancestry switches W09 already declined, slice eight is largely this runtime's own subject matter seen from the inside, slice nine's one reusable rule refuses an impersonating marketplace name in a product that has no marketplace, and slices ten and eleven are thin on new ground entirely. Slice fourteen adds the second candidate this file has recorded: the file write path's post-write size verification and its preserving temp-file fallback, which is a rule about a surface this runtime owns and does not verify. Slice fifteen adds the third: entry-level vetting of a Git directory, where the runtime checks the registration identity of the worktrees it created and never inspects the entries of a Git directory. Slice sixteen adds the fourth: the memory contradiction verdict against an instruction file and the consolidation pass over the memory store, where the runtime's memory tools merge on write and state precedence but never reconcile a remembered fact against an instruction file or sweep the store. Slice nineteen adds the fifth: plugin admission under managed settings, where a managed source must vouch for a plugin and a managed source that was not read whole does not. Slice twenty-one adds the sixth: the bypass-permission guard, where bypass is refused under root or sudo privileges and a bypass consent that settings do not persist does not stand. Slice twenty-three adds the seventh: workspace-external instruction imports, which this runtime refuses with a `ConfigError` while the recovered client asks for consent, and whose consent is scoped forward to the imports the project adds later. Removing the uncited number requires reading modules, not more rules, so the next pass should repeat what produced the tables above for the next slice by size (extract distinctive literals per module, then classify against CURRENT's scope rules), and any module a future package actually reads should be cited from that package's port record so the ledger's port-backed count grows with real evidence. One method note for the next pass: the literal extraction has to skip the build banner. A second note, recorded as an owned method decision from slice twelve on: the band widens from 25 to 50 ranks, because eleven bands have now shown that the per-module work is the same at either width and the remaining set is large enough that halving the number of passes matters more than keeping the band size uniform with the earlier slices. A third note, recorded from slice fourteen on: the dependency list must be skipped per match rather than per line, because these modules are minified onto effectively one line and a line-based skip discards the whole body of any module whose dependency list shares that line and reports it as a module with no literals at all; and rank by size stops being a proxy for unreviewed substance at this depth, since 28 of slice fourteen's 50 modules are 80% or more import statements and the band is 57.7% import text. Slice fifteen repeats that shape at 62.5% import text and eighteen modules with no literal of their own, so the next passes should expect most of a band's byte mass to be dependency lists and read the remaining logic rather than the size. Slice sixteen is the extreme of that shape so far: 77.2% import text, 39 modules at 85% or more, and 34 with no literal at all, so a band can carry a full 50-module budget and still contain only about sixteen modules with anything to read. A fourth note, recorded from slice seventeen on: the band widens again, from 50 to 100 ranks, because slice sixteen showed that most of a 50-module band is mechanical to dispose - the aggregator check is one import-share measurement and one literal scan per module, and its result is verifiable from the ledger - while the remaining readable modules are as deep as before, so a hundred-rank band keeps the same depth of reading at half the number of passes. Slice seventeen is the first band at that width: 100 modules, 60 of them aggregators, 40 with content, and no candidate of its own. Slice eighteen reverses the shape at the same width: only 21.0% import text and 92 modules with content, so the aggregator share of a band is a property of that band, not a trend, and the width stays at 100. Slice nineteen sits between them at 35.4% import text and 81 modules with content, and it adds the fifth candidate this file has recorded: plugin admission under managed settings, where a managed source that was not read whole does not vouch for a plugin. Slice twenty sits at 48.4% import text and 62 modules with content, twelve of them only through state-name markers, and it records no candidate while corroborating the fifth from another subsystem: a workflow is switched off when this machine's managed settings could not be read. Slice twenty-one sits at 50.6% import text and 61 modules with content in a band whose largest module is 6,309 bytes, and it adds the sixth: the bypass-permission guard, where the recovered client refuses bypass under root or sudo and treats a bypass consent that settings do not persist as not standing. Slice twenty-two is the smallest band in bytes so far (437,757) at 57.7% import text with 46 modules carrying content, and it records no candidate while four modules extend families already open: deny rules judged by the effect a command accomplishes, a deep-link path refused for parent-directory segments and for invisible or bidirectional characters, a published file whose source was exchanged underneath it, and a peer file transfer confined to its spool. Slice twenty-three is the first band since slice fourteen below half import text at 36.1%, with 69 modules carrying content and twelve of those only through state-name markers, in the smallest per-module size range so far (4,765 down to 3,988 bytes), and it adds the seventh candidate: external instruction-file imports behind a consent dialog whose acceptance covers later additions, against this runtime's `ConfigError` refusal. Slice twenty-four is the lowest import share since slice eighteen at 18.2% and the smallest per-module size range in the corpus (3,982 down to 3,180), with 80 modules carrying content and twelve of those only through state-name markers, so the aggregator share keeps falling as the band descends; it records no candidate, and two rules that looked like candidates close out as already covered or too thin once the local source was read. Slice twenty-five is the first band entirely below three kilobytes (3,176 down to 2,451) at 22.2% import text, with 67 modules carrying content and twenty-one of those only through state-name markers, so the aggregator share rises again as the band descends past the modules that still carry prose; it records the eighth candidate, an attachment refused for a credential-shaped name or more than one hard link over a read path this runtime already owns. Slice twenty-six closes the two-kilobyte-and-under prose (2,451 down to 1,970) at 22.9% import text with 65 modules carrying content, and records no candidate while two rules that could have become one close on the local read: a unix control socket setup rule and a CA certificate loading rule both guard surfaces this runtime does not have. Slice twenty-seven is the under-two-kilobyte tail (1,968 down to 1,651) where the aggregator share climbs back to 35.4% and only 50 modules carry content, and it records no candidate while naming two rules it will not propose: a tool host attestation gate over a surface this runtime does not have, and a single literal discarding an answer that arrived implausibly fast. Slice twenty-eight reaches the under-1.7-kilobyte remainder (1,647 down to 1,425) at 30.3% import text with 40 modules carrying content, and it records the ninth candidate: a project-declared MCP server held until the user approves it, where this runtime connects a server declared by a workspace-controlled settings layer with no approval step. Slice twenty-nine is the last of the above-one-kilobyte prose (1,424 down to 1,209) at 24.9% import text with only 35 modules carrying content, and it records no candidate while corroborating the ninth: a first-party design MCP server that also requires consent shows the recovered client asks before connecting an MCP server in more than one place. Slice thirty takes the last above-one-kilobyte modules (1,209 down to 1,046) at 27.5% import text with 39 modules carrying content, and it records no candidate while naming one reading it deliberately leaves open: two message fragments about a session that is not authorized to write cannot be given a polarity from an isolated constant. Slice thirty-one is the sub-kilobyte layer (1,041 down to 895) at 25.0% import text with 40 modules carrying content and twenty-two of those only state names, and it records no candidate either: every reading either belongs to a hosted surface or repeats a local one, and a machine identity read guards a surface this runtime does not have. Slice thirty-two is the smallest band in the review (890 down to 773) where 81 of 100 modules are aggregators and only 19 carry content, and it records no candidate and nothing new. Slice thirty-three is the bottom of the corpus by size (773 down to 699, every module below 800 bytes, the band's whole byte mass smaller than one module of slice four) at 35.6% import text with only 18 modules carrying content, and it records no candidate: everything readable is a hosted surface, a state name, or a local surface this runtime already owns. Slice thirty-four is the remainder (47 modules, 2,241 bytes, 697 down to 615), the noise floor where seven modules have a zero-byte body and the recorded size is a banner and a re-export rather than content; it records no candidate, and with it the reading pass is finished - no unread module remains in the uncited list.

Regenerate everything here with:

```
node scripts/port-ledger.mjs --extracted <extracted-sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md
```

## Candidate dispositions after the reading pass

The pass recorded nine candidates. This section is the disposition of each, kept here rather than rewritten into the historical slices above, so the reading pass still reads as it was written. Every module named here is named only in this file (and in the matching `-evidence.json`), both of which the ledger excludes from its citation scan.

| Candidate | Slice | Disposition | Package |
| --- | --- | --- | --- |
| file write path's post-write size verification and its preserving temp-file fallback | fourteen | ported 2026-10-12 | [W13](W13-verified-write.md) |
| entry-level vetting of a Git directory | fifteen | reclassified 2026-10-12: `ruleWithoutLocalSurface` (the module is a workspace-diff materialiser; this runtime has no surface that reads a repository it did not create) | - |
| the memory contradiction verdict and the consolidation pass | sixteen | ported 2026-10-12, verdict half | [W16](W16-memory-contradiction.md) |
| plugin admission under managed settings | nineteen | reclassified 2026-10-12: `ruleWithoutLocalSurface` (the module is a tier-seating pass; the not-read-whole half already holds more strongly, and there is no plugin tier to seat) | - |
| the bypass-permission guard under root or sudo | twenty-one | ported 2026-10-12, guard half | [W15](W15-bypass-guard.md) |
| external instruction-file imports behind a forward-scoped consent | twenty-three | reclassified 2026-10-12: `ruleWithoutLocalSurface` (out-of-workspace access is refused at configuration time and at tool time; the reusable consent *shape* already landed as W12's MCP approval) | - |
| an attachment refused for a credential-shaped name or more than one hard link | twenty-five | ported 2026-10-12 | [W14](W14-attachment-refusals.md) |
| a project-declared MCP server held until the user approves it | twenty-eight | ported 2026-10-12 | [W12](W12-mcp-server-approval.md) |
| the link chain vetting on the settings and instruction handoff (slice five, disposed there) | five | ported 2026-10-12 | [W10](W10-include-link-vetting.md) |
| the credential-pattern table and the path link-chain resolver (slice four, recorded as slice three's redaction reading before the correction) | four | ported 2026-10-12: the resolver as W09 and the pattern table as W19, precise half only | [W09](W09-path-chain.md), [W19](W19-credential-shapes.md) |

Two candidates landed as half a rule each, and both halves that were left are recorded in their own package's `notPorted` with the reason. The three reclassified modules were each read whole before the disposition changed; the local checks that decided them are in each slice's band note above or in `sliceFifteen`/`sliceNineteen`/`sliceTwentyThree` of the evidence file. No unread module remains and no recorded candidate remains open.
