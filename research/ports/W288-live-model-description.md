# W288 live model command description

Status: verified locally on 2026-10-23. Independent review found no confirmed scoped defect. Local composer UI only.

## Task card

- Entry: type `/model` in the composer after startup, a live switch, config adoption or resume.
- Outcome: the command description reads `Set the AI model (currently <model>)` from live state.
- Source: bWe.description, tt/qo, Wre/jtt and AT's complete text cleanup closure.
- Targets: command catalog, CLI/interactive bindings, copied cleanup source and focused fixtures.
- Shape: an optional current-model reader on the catalog factory; a normal string getter on its model row.
- Mode: adapt the obtained getter and model-label fallback; copy cleanup bodies with a Node ANSI binding.
- Validation: getter freshness, safe display text, typed/picker switches, config/reload/resume, cleanup.
- Done: check/build, affected regressions, compiled CLI, independent review, records and local commit.

## Source preflight

Sample 2.1.296 SHA-256 is `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All coordinates are zero-based UTF-16 code units, half-open. Module digests match the manifest.

| Module | SHA-256 | Obtained bodies |
| --- | --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | bWe [1650742,1650952), getter [1650777,1650860), jtt [1666990,1667469) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Wre [507454,507979) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | Ah [356351,356428), tt [357377,357451), Zl [378569,378599), Uv [385045,385110), fF [385482,385604), qo [386338,386796), Dt [387346,387890) |
| chunk-gyf58rwf.js | 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad | pn [9076,9115), Mt [9240,9285), qy [9286,9345), Wt [9766,9796), Bse [11889,11938), ti [11938,12100), I8e [12137,12144), AT [12145,12302) |
| chunk-ax7r0qj7.js | 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | ne [1128,1272), WMt [1544,1645), x [1645,1850), a [1929,2004), l [2005,2123), Gw [2353,2411) |

The original getter reads `Set the AI model for Claude Code (currently ${qo(tt())})`.
Wre obtains the description on each row build; jtt's nonprompt arm directly reads e.description.
tt resolves Ah or Zl through Dt. The source maps vendor aliases and policy defaults through
its host state. qo first checks fF's custom catalog, then model metadata and option registries,
then Uv's vendor model labels, then `AT(e)||"unknown model"`.

The host has one effective model in `session.config.model`, already updated by typed commands,
pickers, config successors and resume. It has none of qo's catalog/identity registries. The
explicit local-only and neutral-product constraints exclude their account-backed sources and
vendor alias labels. Adapt tt to a supplied live reader and qo to its obtained AT fallback.
Remove `for Claude Code` from the descriptor. No fabricated model labels or capability metadata.

AT strips ANSI through pn, drops ill-formed surrogates through Gw, replaces the exact Wt
invisible/control/private/unassigned set with spaces, collapses whitespace, drops backticks and
angle brackets, separates markdown link/image delimiters and truncates to I8e=255 UTF-16 units
without leaving a high surrogate. Copy every cleanup body. Bind Bun.stripANSI to Node's
stripVTControlCharacters; retain the rest of the closure exactly, including declaration kinds.

## Host ownership

The command factory owns a getter, not a second model snapshot. Interactive catalogs read the
current session variable so a successor never leaves a closure on the old config. Startup
receives the initial session reader. Config rebind installs a new catalog and live model switch
repaints it. Existing skill-rescan callers retain the same reader. The optional factory input
preserves unbound catalogs and caller-authored descriptions. Help uses the same catalog.

A direct current-source probe observed the stale description `Choose or enter a model, then
start a session with completed history`. Model switching already applies live, so this wording
also describes an obsolete transition. Only the model row changes in this package.

## Throughput checkpoint

- Blocking first steps: exact getter/consumer, model owner and complete cleanup closure.
- Independent workstreams: one bounded read-only review after implementation and checks.
- Shared mutable state: one writer in the current checkout; unrelated changes remain intact.
- Smallest safe decomposition: one catalog/getter package because initial and successor readers share the state contract.

## Validation

- `npm run check` and `npm run build` exit 0.
- Affected command/model/effort/interactive suites pass 76/76. Existing TUI suite passes 94/94,
  for 170/170 affected tests. Two new regression groups cover fresh getters, catalog ownership,
  cleanup output, retained drafts, Enter submission and Tab completion. Two prior geometry
  fixtures retain their original long text and every wrapping/lane assertion.
- `W288_RESULT=<path> node .audit/w288-live-model-description.mjs` exits 0. The driver compares
  all cleanup bodies byte-for-byte and by compiled AST. The target getter AST matches the
  recovered getter after exactly the declared neutral-wording and tt/qo adapter replacements.
  Ten compiled labels match the isolated source closure. Recovered entrypoints remain inert.
- Compiled PTY acceptance passes 16 checks. Startup shows first-model. A typed switch during
  an active request shows second-model, a session-only picker choice shows third-model, and
  the next explicit request uses third-model. Config selection binds second-model on the
  successor. Reload and skill-rescan retain it. Resume returns to the stored first-model and
  the description follows that session. Enter opens the existing picker and cancel preserves
  the model. The 64-column surface keeps its row inside the terminal width.
- Existing compiled W285 effort acceptance passes 26/26 at the same identity, including
  model switching, config adoption, environment effort precedence and 10000 ms expiry.
- Both W288 CLI processes exit zero and release history/session locks. The W288 driver makes
  two explicit requests to its owned loopback SSE service; UI actions add none. Journals omit
  the fixture credential. Paid upstream calls are zero.
- Independent read-only review verifies all five module identities and 13 copied body slices,
  the mutable session owner and catalog consumers. Its two public composer groups pass. The
  Node ANSI adapter passes SGR, OSC hyperlink, erase-screen and C1 CSI inputs. Bun is absent,
  so direct Bun-versus-Node ANSI parity remains untested. No confirmed correctness finding
  or actionable source-comment/suppression finding.
- The full suite is not repeated. Its last result remains W283's 3201/3202 with the existing
  `cli-migration.test.ts:87` effort mismatch.

Content identity: `abd4117070ced1ce70824fdab4ed9c0a6034598137220107d2e90872941444d4`.
Inputs: `f120a27268e63099e354930dbf91d286a3aac5e6d2c1383cd89915b054f359d6`.
Validation: `521d6a5a4a9cacc0a0e649a793e1abc8568bb0c25f3c0312a26184f01869459e`.
Build: `c06cb601fb183cf754db4da1d70378579240ec58bbe32cbdee4efb64cf51a22d`.
Job temporary logs: `w288-focused.log`, `w288-tui.log`, `w288-check.log`, `w288-build.log`,
`w288-cli.log`, `w288-cli-result.json`, `w288-effort-cli.log` and `w288-identity.json`.

## Coding-standard check

S-1/S-7 read the getter, display/selection dependencies and complete AT closure before editing.
S-2 retains old geometry and acceptance intent through explicit fixtures. S-3 keeps display
cleanup in the getter; the model sent to the provider remains the actual ID. S-4 reads the
mutable session owner and introduces no timer or second model snapshot. S-5 binds compiled
frames to the next request and stored resumed session. S-6 updates startup, config rebind,
live switches and existing catalog refresh consumers together. Corrections are recorded in
the existing ignored `research/question.md`. The existing seven rules cover their causes.
Model the Domain chooses one live reader. Prove It Works chooses compiled session transitions.
