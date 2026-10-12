# Unreviewed corpus characterisation

Status: bounded characterisation pass, not a port record. Date: 2026-10-12.
Purpose: the module ledger counts 2283 uncited modules (33,446,926 bytes). This pass describes what that remainder is using byte evidence only, so the number stops being an unqualified unknown. Nothing here claims which subsystem owns a module, and naming a module here does not make it port evidence - the ledger counts a module as port-backed only when a record under `research/ports/` that declares a port classification names it.

## Method

Every rule below is mechanical and reproducible from the extracted sample (`/Users/mant1ssa/.local/share/claude/versions/2.1.296`, SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937). All of it runs in the ledger generator, so the same numbers can be regenerated at any time:

- **Banner.** Every recovered module starts with a leading block of `//` comment lines (the sample's build banner). Its length is recorded per module so later passes can measure the readable payload rather than the header.
- **Binary.** A module whose decoded text contains U+0000 is recorded as a binary payload. Three modules qualify in the whole sample (`chart.umd.min.js`, `hljsBundle.generated.min.js`, `mermaid.min.js`), all of them bundled assets rather than product source.
- **Markers.** Sixteen literal strings are searched verbatim; a hit records the literal and its first offset. The literals were chosen because they appear only in one recognisable family of code, so a hit characterises the module without asserting ownership.
- **Imports.** Well-formed module specifiers are extracted from `from"..."` and `require("...")` occurrences and validated against a specifier grammar, so no package name is ever invented from adjacent minified text. Each specifier is filed as a runtime builtin, a sibling chunk, or an external package.

A note on the false lead this pass corrected: the `// @bun @bytecode` banner appears on 2362 of 2365 modules and does **not** mean the module is undecodable bytecode. The manifest's "bytecode is indexed, not decoded" limitation refers to the compiled payload; the extracted text after the banner is readable source, which is what every record in `research/ports/` has been quoting. Only the three U+0000 modules carry no readable payload.

## What the uncited remainder is

- Uncited modules: **2283** (33,446,926 bytes).
- Of those, **2265** import only Node builtins or nothing at all, and **0** import a sibling `chunk-*.js` by name. The bundler inlines sibling chunks, so import structure cannot separate product code from vendored code here; it does show that the uncited set is made of self-contained leaves rather than a graph of small product modules.
- External package specifiers across the whole uncited set: `ajv` (3 modules), `ws` (3), `ajv-formats` (1), `inspector` (1), `claude-code` (1, the bundle naming itself), plus `async_hooks`, which is a runtime builtin the builtin list was missing.
- **2231** of the 2283 carry none of the sixteen markers. They are the true remainder: readable recovered source whose subsystem this pass did not determine.

## Marker families inside the uncited set

Counted from the ledger summary; a module may carry several markers. Generously interpreted, these families cover roughly fifty of the 2283 modules, which is why the remainder above is stated separately.

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

## Residual and next pass

The honest remainder is **2231 uncited modules with no marker**: readable source whose subsystem this pass did not determine. Removing that number requires reading modules, not more rules, so the next pass should repeat what produced the table above for the next slice by size (extract distinctive literals per module, then classify against CURRENT's scope rules), and any module a future package actually reads should be cited from that package's port record so the ledger's port-backed count grows with real evidence.

Regenerate everything here with:

```
node scripts/port-ledger.mjs --extracted <extracted-sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md
```
