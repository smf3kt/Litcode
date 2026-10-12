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
| `chunk-phm7wwmz.js` | 39614 | `if(n.username!==`, `||n.password!==`, `||n.pathname!==`, `disabled by your organization` | URL-credential comparison behind an organization policy gate, external |
| `chunk-6ccen3s8.js` | 39412 | `app:toggleTodos`, `app:toggleTranscript`, `app:toggleBrief` | interactive action registry; this runtime has local counterparts |
| `chunk-z1vfv8xh.js` | 39291 | `sanitizeBridgeNotices: notice cap (${x}) reached; dropping entry`, `the only connected`, `deviceId` | Remote Control bridge notice handling, external |
| `chunk-0y0rpvta.js` | 39208 | `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`, `connector_${o.uuid.slice(0,8)}`, `claude.ai connectors could not be loaded in this Claude Code session` | base58 identifiers for cloud routines and connectors, external |
| `chunk-x0tzrjjr.js` | 38929 | `renders a local page file before you publish it `, ` browsers captured for an artifact`, `viewport widths in px, default 1280 and 390` | hosted page-publishing tool description, external |
| `chunk-m6jeqzgx.js` | 38217 | `Cleaned up old image cache: ${a}`, `cleanupPeriodDays` | image-cache cleanup task; this runtime reads images but keeps no cache to reap |
| `chunk-3qrn68kc.js` | 38021 | `\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\p{Mn}\p{Mc}\p{Nd}`, `s.frontmatter.some((b)=>b.includes(`, `hasFrontmatter` | Unicode-folded slug construction and frontmatter reading; this runtime does both in `src/config.ts` |
| `chunk-cnvr16zw.js` | 37806 | `commander.invalidArgument`, `Allowed choices are ${this.argChoices.join(`, `t._aliases[0]` | vendored commander |
| `chunk-b51chbpg.js` | 37300 | `set_model failed`, `The pending model switch was applied`, `set_model verdict rejected after the deadline reply` | control-protocol model switch, external |
| `chunk-nvmgz2d7.js` | 37149 | `data/users/<id>`, `(?!\.\.?(?:/|$))[A-Za-z0-9_\-.~:@+]{1,200}` | hosted artifact-database path grammar, external |
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
| `chunk-f606a53w.js` | 16665 | `writeTextContent: on-disk size mismatch after write`, `writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path`, `atomic_write_staging_dir_tampered`, `EINVAL: not a regular file`, `assertDirChainReal: dir must be strictly inside base` | **candidate**: post-write size verification and a temp-file fallback that preserves content, in the file write path - adjacent to the identity family [W09](W09-path-chain.md) ported |
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
| `chunk-ekrtrxy7.js` | 16007 | `unknown .git entry`, `symlinked, hardlinked or unexpected .git/index`, `no .git/config or .git/HEAD`, `symlinked or oversized .git/objects entry` | **candidate**: entry-level vetting of a Git directory before it is trusted; this runtime creates and verifies worktrees' registration identity but never inspects the entries of a repository's Git directory |
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

The sixteen slices read five hundred and twenty-five modules between them, in sixteen contiguous bands of the uncited list, and the next pass continues at rank 521; from slice twelve each band is 50 ranks wide. The honest remainder is **2217 uncited modules with no marker**, and 2267 uncited modules in all: readable source whose subsystem this pass did not determine. Recording a module in this file changes nothing - it is not a citation source for the ledger - but naming one in CURRENT or STATUS does move it out of the uncited set and into the prose count without adding port evidence, and slices six and seven did that to three modules (`chunk-2kdsvp3x.js`, `chunk-bt8cr7rw.js` and `chunk-patq2z05.js`), which is why the uncited figure reads 2267 rather than 2270; slices eight and nine avoided it by naming modules here only. A package that actually ports a module adds port evidence, and this review has fed two of them: [W09](W09-path-chain.md) ported `chunk-gyf58rwf.js` and [W10](W10-include-link-vetting.md) ported the candidate this file recorded in slice five, `chunk-pn44qc66.js`. The ledger now reads 33 backed / 65 mentioned only in prose / 2267 uncited / 2217 without a marker. Slices six through eleven added no candidate of their own: slice six's two reusable rule sets guard surfaces this runtime does not have, slice seven's most interesting module is the source of the ancestry switches W09 already declined, slice eight is largely this runtime's own subject matter seen from the inside, slice nine's one reusable rule refuses an impersonating marketplace name in a product that has no marketplace, and slices ten and eleven are thin on new ground entirely. Slice fourteen adds the second candidate this file has recorded: the file write path's post-write size verification and its preserving temp-file fallback, which is a rule about a surface this runtime owns and does not verify. Slice fifteen adds the third: entry-level vetting of a Git directory, where the runtime checks the registration identity of the worktrees it created and never inspects the entries of a Git directory. Slice sixteen adds the fourth: the memory contradiction verdict against an instruction file and the consolidation pass over the memory store, where the runtime's memory tools merge on write and state precedence but never reconcile a remembered fact against an instruction file or sweep the store. Removing the uncited number requires reading modules, not more rules, so the next pass should repeat what produced the tables above for the next slice by size (extract distinctive literals per module, then classify against CURRENT's scope rules), and any module a future package actually reads should be cited from that package's port record so the ledger's port-backed count grows with real evidence. One method note for the next pass: the literal extraction has to skip the build banner. A second note, recorded as an owned method decision from slice twelve on: the band widens from 25 to 50 ranks, because eleven bands have now shown that the per-module work is the same at either width and the remaining set is large enough that halving the number of passes matters more than keeping the band size uniform with the earlier slices. A third note, recorded from slice fourteen on: the dependency list must be skipped per match rather than per line, because these modules are minified onto effectively one line and a line-based skip discards the whole body of any module whose dependency list shares that line and reports it as a module with no literals at all; and rank by size stops being a proxy for unreviewed substance at this depth, since 28 of slice fourteen's 50 modules are 80% or more import statements and the band is 57.7% import text. Slice fifteen repeats that shape at 62.5% import text and eighteen modules with no literal of their own, so the next passes should expect most of a band's byte mass to be dependency lists and read the remaining logic rather than the size. Slice sixteen is the extreme of that shape so far: 77.2% import text, 39 modules at 85% or more, and 34 with no literal at all, so a band can carry a full 50-module budget and still contain only about sixteen modules with anything to read.

Regenerate everything here with:

```
node scripts/port-ledger.mjs --extracted <extracted-sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md
```
