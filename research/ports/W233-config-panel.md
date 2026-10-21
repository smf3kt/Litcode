# W233 local config panel

Status: verified locally, 2026-10-21. Independent six-finding repair recheck passed. Local commit only.

## Task card

- Entry: bare `/config` from the input slash list.
- Baseline: compiled CLI opens only Editor mode with normal/vim choices; retained frame is `w233-before-0cUAsO/screen.txt` under the job temporary directory.
- Outcome: the recovered settings-list interaction over reachable local settings, including live application, persistence, exit and reopening.
- Source gate: component, row factories, action handlers and writers were acquired before initial product edits. The query clip and per-model effort closures were subsequently acquired before those dependent changes.
- Targets: settings panel module, modal host, interactive caller and existing local settings writer/consumers.
- Shape: ConfigPanel owns the full query, row focus, typed updates and measured viewport. TuiTerminal owns input handoff, pending writes, pointer state and cleanup.
- Acceptance: compiled CLI opens actual panel, changes local settings, observes real consumer effects and saved bytes, reopens/restarts and cancels without unintended writes.
- Checks: 0-3 new regression groups, check/build, related regressions, independent review and content identity.
- Constraints: existing user/command scope, no account/network/OAuth settings, original samples inert, no push or paid upstream calls.

## Existing host chain

`src/interactive.ts` maps bare `/config` and `/vim` to `editorModeRow`, then `saveEditorMode` and
`applyConfig`. The latter creates a new session carrying completed history and permissions,
binds its runtime and re-applies terminal settings through `bindConfigWatch`.
`theme-settings.ts` already preserves unrelated JSON fields and file mode through bounded read
and atomic write. CLI, reload and session schema already own display settings including reduced
motion, turn duration, message timestamps, editor mode, syntax highlighting and emoji completion.
Those consumers are available for source-backed rows; their existence alone does not establish
which rows the recovered panel displays.

The line-mode `/config` editor choice is separately exercised in `test/interactive.test.ts` and
must retain a usable entry. `/config editor=normal|vim` and `/vim` remain supported local commands.

## Recovered source gate

Artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All coordinates are zero-based UTF-16 half-open ranges. Module hashes were checked against
`extracted-v2/manifest.json`; declaration ranges and critical bodies were read as inert text.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | vWe [7247,31899), theme factory [4056,4214), non-user timeout gate ke [4744,4817), U2t [5051,6113), local writer closures [8029,8318), Reduce motion [15295,15585), Thinking [15586,16009), Turn duration [20770,20987), Time format [21613,21906), Editor [26179,26447), Question timeout [26484,26977), Model [27991,28337), Dialog expiry [29982,30405), sSn/Re/Ive [43606,44812) |
| chunk-dag4qhha.js | cd1a28e9b3a52a9e2fa16901017bf7b0151c67d1859d5104a840d41e33f3f4d2 | Vc [16553,16761), bs [17007,42182), filter St [22342,22674), close Hl [22890,26263), update an [26517,27022), picker exit Xt [27110,27150), activation Co [27492,30080), search Gl [30733,31282), local JSX rows [31282,33770), enum picker [36900,37450), search/list/guide [40450,42182) |
| chunk-czbq7s7d.js | 4160752a3b42549dc45e1e745b64e8c83848bc467b2b93cc4f006a20007c8345 | field Qe [1599,4413), Xe [4413,6470), geometry Ge=32/ne=2/Y=2/ge=2, row value F/te/oe/ce, wn [11819,12374), xn [12374,12442) |
| chunk-0wtqg4zf.js | 37fffc2f615ac9aaf5d92ff2cacd3d96cb7191880b1115f02b8f3353eb85a50f | viewport mn [7642,9547), fn [9547,12509), list Qe [15880,18925) |
| chunk-qh0w98pn.js | a6f4555b23f747a11e952695c27895a1f2c76e2cf92396754242e9c23fdd8472 | query editor _y [48154,53325), search field rS [55320,57047), caret Ai [57047,57547) |
| chunk-9vcaezw1.js | eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0 | settings resolution se [10679,11697), lookup de [11834,12021), key x6 [12117,12184), Pe [12184,12247), Duo [12247,12346), we [13891,13959), X9 [13959,14114) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | search prefix Kxs [65612,65624), user settings destination GW [400882,401146) |
| chunk-ppsy9aeg.js | 465947c512c63aa3df813d9f08b9abb0a1ae82d32b05de3ea872eed55094f756 | time-format options [1146,1192); theme choices around [1235,1337) |
| chunk-js2bhabe.js | f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de | D6 [1499,1554) userSettings single-key write |
| chunk-x0dc37w9.js | 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92 | An/ta [102209,102464), us [102833,105519), existing per-file queue/merge/undefined-delete host |
| chunk-stnaz0rq.js | dfc19e4c0816c91916156f7e915efa0fbbd4092a388951756023e84573166b53 | Jl [714,841) checks loaded plugin modules for a config.set declaration |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | config registration Cfo [1133011,1133308), iVt declarator [487323,487347), Hhe [1133554,1133604) category gate default false |

## Scope and adaptation before product edits

Port the complete local row loop for Reduce motion, Thinking mode, Show turn duration, Time
format, Theme, Editor mode, Question timeout, Model and Dialog expiry in source row order.
Theme and Model reuse their existing local pickers. Source category grouping Hhe is off, so the
panel stays flat. Message timestamps are gated off in vWe and stay absent from this panel.
Verbose, Auto-compact enable, tips, terminal progress, notifications and selection flags have no
complete local consumers yet and stay explicitly unported; no pretend controls are added.

Search starts active. Vc in dag4qhha [16553,16761) clips only the rendered prefix to columns-11,
while filtering and editing retain the full query. rS uses the literal `⌕` prefix and clamps the
displayed cursor to the prefix length. The host terminal cursor represents the source caret.
Filtering matches id/label/enum options case-insensitively. Enter/Down
focus the list; Esc clears a nonempty search, then leaves search, then closes. The row list
clamps at ends; Up at its first row returns to search. Enter/Space toggle booleans or cycle an
enum; Left/Right toggle booleans or cycle in that direction. Time format opens a pick-to-commit
subpage, whose Escape changes nothing. Theme and Model open subpages. Left is idle on these
picker links, as wn exposes only accept and next. Clicking a row moves focus; clicking its value
activates. The viewport adapts mn and fn with measured row boundaries, line-based paging and
wheel scrolling that clamps focus into the new window. Category and heading handling are absent
because Hhe is false and all selected rows are fields.

Each accepted edit writes immediately. Top-level close reports changes and keeps them.
Changes are represented as a typed discriminated update; a single owned panel tracks query,
row focus and layout while the existing modal owns input/cleanup. A host write callback is kept
outside structuredClone and serialized per settings file with the existing queue. Successful
writes then update the live config and terminal consumers. Theme and model retain their
existing save/apply/hook chain. Failed writes keep the old live state and show the error; query,
focus and successful earlier edits survive. There is no save-all or rollback-on-close state.

Reduce motion follows me/localSettings, using permissionSettingsPaths to choose the canonical
workspace file. Other owned rows write user settings. Thinking maps alwaysThinkingEnabled to
the product's existing thinking boolean and stores that explicit value, because the gateway's
false default differs from the source model-default true. The model capability lock has no
backing local record and stays excluded. Question timeout and Dialog expiry are hidden if a
higher authored source owns that key, matching ke. Dialog expiry default deletes its key.

Config's model child has no onSetDefault callback, so `s` remains inactive. Its accepted manual
effort reaches Me -> X9 with the default save flag enabled. The host now stores the four
persistable levels at modelSettings[model].effortLevel, preserves other model fields and the
legacy top-level effort, and leaves max session-scoped. CLI startup resolves that model entry
before the legacy fallback. Session metadata retains the map and reload refreshes it while
keeping the live effort. The map parser projects effort only; unknown authored model fields stay
on disk and are excluded from session metadata. The source's inherit/level/default distinction
is stored as effortSelection. Untouched model focus and acceptance resolve the target model's
default. A manually selected level survives focus and model changes. Standalone /effort retains
the legacy top-level setting and also updates or deletes the active model leaf when the new map
exists, so its promised default survives restart and auto clears both representations.
Arbitrary gateway IDs bypass vendor alias, organization and capability
tables, but remove the source's trailing [1m] context suffix. Prototype keys take the source's
fallback shape using this product's existing top-level effort key. The host awaits the effort
write to expose local errors; source Me fires it without awaiting. Standalone /model retains
its prior save scope. The typed map is a setting parser and session consumer, not a new provider.

The optional config.set wrapper is active only when Jl sees a loaded plugin declaration. This
host's existing registry has config.describe but no config.set implementation/active binding;
that optional path remains excluded in this package. Ordinary ConfigChange watcher hooks stay
on the existing file-change path. No account/OAuth/remote/bootstrap calls or outer Status/Usage/
Stats shell are ported. The neutral tab/header is Config. The line-mode editor chooser and
explicit /config editor=normal|vim remain available.

## Port map and comparison

All product bodies are adapted. No product body is classified as a byte copy. Fourteen character
comparisons bind the original source slices to TypeScript AST ranges in the owned product. The
manifest-validated inputs, target slice digests and diff digests are retained in
`w233-source-compare.json` in the job temporary directory. `w233-source-compare.mjs` reproduces
those comparisons with `git diff --word-diff-regex=.`. The comparisons cover rows, viewport,
query, query editor, field actions, frame, query frame, source scope, writes, subpages, model
save, effort defaults, inherited effort and command persistence. Comparison manifest SHA-256
`3aebe32c9b5fb36180789231442c8e95b9ca981cb0544884e3fc79336c20b1c2` covers 14 groups
and 136272 bytes of character-diff output.

| Target | Source body | Adaptation |
| --- | --- | --- |
| config-panel.ts rows | vWe | Nine local consumers retain source row order, values and enum options. Host names map thinking, turnDuration and editor to existing configuration keys. |
| settingsWindow, page, scroll, render | mn, fn, list Qe and field Qe/Xe | React refs become panel-owned state. The ungrouped rows remove only heading correction branches. The existing document renderer supplies measured row heights and ANSI lines. |
| clipQuery, queryDisplay and key | Vc, _y, Gl | Full UTF-16 query and cursor stay in the existing editor reducer. Clipping affects only rendering. Batched host text dispatches its remaining characters after search takes ownership. |
| tui.ts panel handler and frame | bs, rS, field Xe | The existing terminal owns callbacks, write lifetime, physical cursor, row hit maps and pointer pairing. The local Config panel occupies the modal screen without the unrelated outer tabs. |
| config-panel-input.ts | ke and timeout factories | Bounded authored-file ownership replaces the recovered settings service. Project, canonical local, legacy local and explicit flag layers hide user-only timeout controls. |
| theme-settings.ts | P, me, W, D6, ta/us, X9 and Duo | Existing atomic writer and shared per-file queue replace the storage service. JSON fields and file mode survive. Accepted values use the existing product settings names. |
| interactive.ts | bs/Hl/Co and Me | Existing applyConfig creates and binds a successor session, then releases the old runtime lease. Typed updates replace React setter closures. Parent query and focus survive child cancellation and errors. |
| effort-command, runtime, cli, session and reload | se/de/Pe/uc | A validated per-model map and exact gateway-ID lookup replace vendor alias and organization services. The chosen live effort stays distinct from saved defaults. |

## Validation

`npm run check` and `npm run build` exit 0. Three new regression groups pass. The final combined
run of command, model, effort, CLI, runtime, reload, terminal, configuration and session files
passes 264/264 with no skipped or cancelled cases. The full suite was not rerun for this local
package.

The compiled driver `.audit/w233-config-panel.mjs` passes 35 checks at 90x30 and 20x24. It changes
and persists local settings, cancels and confirms all three child types, checks next Messages
requests, restores values in a fresh process, tests a malformed authored file and retry, hides
foreign-owned timeouts through a symlink, clicks a narrow value row and verifies session-lock
cleanup. The six review scenarios also cover cross-command effort restart, target-model inherited
effort, metadata projection, close-time error publication and enum-option search. The fixture
uses an owned loopback SSE server. Magpie and paid upstream validation remain not_run.
Final result `w233-cli-Nfncvu/result.json`. Existing compiled W232 model picker passes 23/23 at
`w232-cli-6qIe8a/result.json`. Existing W231 effort slider passes 18/18 at
`w231-cli-9aYcii/result.json`. The last two results bind b0d100f9, whose only difference from
893ac6cb is the corrected provenance range in theme-settings.ts. Their build digest is identical.
Baseline and final probes retain terminal-decoded frames.

The independent comment pass reviewed 18 new or changed comments and found no removals or code
flags. Seventeen retain mandatory provenance. The callback ownership comment records the
observed structuredClone limitation. Subsequent repair comments carry required source ranges.

Independent correctness review initially found six defects at d4cc9d35. All six were repaired
and independently rechecked with the original inputs. The review confirms cross-command effort
restart, unknown-field metadata projection, untouched model defaults, post-close failure notices,
symlinked settings ownership and Time format option search. Every review CLI exited 0. The
portable results are `.audit/w233-review-evidence.json`. No new blocker arose in that recheck.

Final reviewed content identity is
`893ac6cb1d3fdebcf72f71f1b57b8309cc3953ef499be181f4ab0a9b58037954`.
Inputs 793 files `2741cc6e325f23fa70710f745388ce8c967f43bbfa2eddf9a52a4a3c7cc96574`.
Validation 265 files `c526719780540d9bcdc9f2dcb81aa999c3f797a6c5d7f7ee1ca3476d682d2ff5`.
Build 554 files `c2bd1aabf0106a719b56c01743d8291fe48c30689409f1ef5966a238503ea235`.
The snapshot is `w233-final-identity.json` in the job temporary directory. Portable driver
checks, decoded captures, request fields and source comparison ranges are preserved in
`.audit/w233-evidence.json` and `.audit/w233-source-evidence.json`. The records helper checks
build and regression identity for each result and retains its original source identity. The
compatibility runs precede only the provenance-range comment correction, with identical build
and tests. Final driver and regression digests are retained in the evidence manifest.

## Coding-standard check

S-1 ties assertions to direct source slices and decoded TUI probes. S-2 keeps the old line-mode
config chooser and all prior model/effort tests and compiled drivers. S-3 passes rendered ANSI
rows directly to the frame. S-4 keeps pending writes under the modal, awaits them before returning,
clears pointer ownership on resize and restores the draft. S-5 binds narrow checks to visible
prefixes and saved/request identities. S-6 carries the new model map through parsing, CLI,
session schema and reload. S-7 records source closure, exact coordinates and fourteen character
diffs. The question log records input-owner, display-predicate and type/AST corrections. No new
coding-standard rule is needed beyond these existing causes.

## Throughput

WORKFLOW section 6 overrides the skill's generic delegated writer/fan-out/PR pattern. One bounded
source reader and a lead writer keep coupled modal/session changes under one owner. Existing
pstack Model the Domain and Test Behavior, Not Implementation principles guide typed state and
actual key/file/request assertions. The source task is independent of the lead's current-host
mapping and compiled baseline capture.
