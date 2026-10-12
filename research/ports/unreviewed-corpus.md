# Unreviewed corpus characterisation

Status: bounded characterisation pass, not a port record. Date: 2026-10-12.
Purpose: the module ledger counts 2270 uncited modules (31,775,736 bytes; 32 backed by a port record, 63 mentioned only in prose). The figures in the tables below were taken at the pass that produced them and are not rewritten afterwards; the authoritative totals are always the regenerated ledger's. This pass describes what that remainder is using byte evidence only, so the number stops being an unqualified unknown. The figure moves as packages land, and one correction is recorded here: the ledger used to scan its own generated `-evidence.json` files as citing records, so a package's evidence file could cite the very modules it had ported and inflate the count. The generator now skips those files, and the numbers below are the regenerated ones. Nothing here claims which subsystem owns a module, and naming a module here does not make it port evidence - the ledger counts a module as port-backed only when a record under `research/ports/` that declares a port classification names it.

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
| `chunk-gyf58rwf.js` | 82836 | `[REDACTED]`, `replace(/!\[/g,"! [` | **in scope, candidate**: redaction and Markdown link rewriting |
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

This runtime's own path handling is a single check, not a resolver: `src/media.ts` rejects a resolved path that escapes the workspace, `src/plugins.ts` rejects symbolic links and re-stats a directory after reading it, and `src/sessions.ts` rejects a symlinked session directory. `research/FEATURES.md` therefore lists *symlink confinement* as integrated, which it is, but none of those checks can see a chain that lands on a network path, none caps the chain length, and none verifies that the file it resolved is the file it then reads. The link-chain resolver is the smaller of the two gaps and the one that hardens behaviour this runtime already claims, so it is carried as the next candidate work package; the credential table is recorded beside it as a second candidate, unscheduled.

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
| `chunk-pn44qc66.js` | 45078 | `link chain too long to vet`, `too_many_links`, `hard_link`, `link body climbs out of a directory it entered` | **in scope, candidate**: the link vetting on the settings and instruction handoff (see below) |
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

The band is the most external of the five: eleven hosted or server-dependent surfaces (a cloud session's git environment, Remote Control, artifacts and their REPL, the control protocol, the self-hosted runner, cloud plugins, login and gateway auth, the git proxy, and remote settings), four recovered UI panels, two vendored libraries, two product distribution and compliance modules, one MCP tool annex, one settings-review surface, one worktree-registration vetting surface and two with local counterparts. One in-scope candidate is recorded, and naming it here is not port evidence.

`chunk-pn44qc66.js` (45,078 bytes) is the settings-and-instructions handoff to a cloud session - it decides which local settings, instruction and agent-memory files are safe to send. Its purpose is external, but the vetting it applies along the way is a rule set this runtime can use, because this runtime reads the same class of files locally: it resolves `@file.md` instruction imports in `src/config.ts` and pins what it read. The recovered rules are `link chain too long to vet` and `too_many_links` along `EMLINK`/`ENAMETOOLONG`, `link body is not valid UTF-8`, `link body climbs out of a directory it entered`, `hard_link`, `alias_unreadable`, `home_unvettable`, `outside_root`, `not_regular_file` and `symlink_not_sent`. Nothing in `src/config.ts` does any of this beyond de-duplicating by `realpath`: an import whose link chain leaves the directory the import walked into is read like any other, a link chain of any length is followed, and the body's encoding is not checked before it is treated as instructions. That is the same family as the W09 resolver, one layer up at the include rather than at the tool, and it is carried as the next candidate work package.

## Residual and next pass

The five slices read one hundred and twenty modules between them, in five contiguous bands of the uncited list, and the next pass continues at rank 121. The honest remainder is **2225 uncited modules with no marker**: readable source whose subsystem this pass did not determine. Slice four changed that number by nothing, on purpose - this file is not a citation source for the ledger, so recording a module here does not move it out of the uncited set and cannot flatter the count. A package that actually ports a module does move it, and [W09](W09-path-chain.md) is the first that did so from this review: `chunk-gyf58rwf.js` is now port-backed, which takes the ledger to 32 backed / 63 mentioned only in prose / 2270 uncited / 2220 without a marker. The prose count rose by four across slices four and five because CURRENT and STATUS name the candidates those slices recorded, not because anything was ported. Removing that number requires reading modules, not more rules, so the next pass should repeat what produced the tables above for the next slice by size (extract distinctive literals per module, then classify against CURRENT's scope rules), and any module a future package actually reads should be cited from that package's port record so the ledger's port-backed count grows with real evidence.

Regenerate everything here with:

```
node scripts/port-ledger.mjs --extracted <extracted-sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md
```
