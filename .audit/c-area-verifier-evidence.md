# C-area verifier evidence (peer session c9c17d97)

Independent acceptance runs by the C-area verifier, recorded so the exit checklist rows
that cite "independent review passed" have a durable artifact. All runs used owned
loopback fixtures, a private HOME/XDG and no paid upstream call.

## C2 inline DiffDialog: accepted (2026-10-19)

Driver: `w188-c2-inline-pty.mjs` over the compiled CLI (`bin/personal-harness.mjs`) through
`scripts/pty-cli.exp`, 100x30 PTY, private git workspace, owned SSE gateway.

```
open + list            Uncommitted changes (git diff HEAD) / 1 file changed +20 -20 / sample.txt +20 -20
detail + scroll        ok, scrollChanged=true
Escape back to list    ok
Escape dismisses       ok
reopen + editor        ok, draft typed after close is accepted
turn 1 write_file      requests 1-2
turn 2 edit_file       requests 3-4, tabs ["Current   T2   T1"]
written file           "first\nSECOND\nthird\n"
resize 100/40/100      ok
exit                   code 0
provider calls while the dialog is open   0
```

Borderless rendering is correct for the inline mount: `inline-diff.ts` supplies the `VS`
scroll-viewport context, and the source frame box (`es`) drops its border when
`nl()` (the `VS` presence test) is true.

Blocked-then-fixed: the acceptance could not reach turn 2 on any build until the runtime
owner regression below was repaired.

## Runtime owner regression: fixed and re-verified

`Runtime owner configuration changed; release session resources before rebuilding`
(`src/runtime.ts:619`) fired on every prompt after a tool-using turn. Cause, measured with
an external `JSON.stringify` probe (`fp-probe.cjs`, no product file modified): the cached
tool-set fingerprint's `settings.dynamicSkillDirs` went from absent to a populated
`<HARNESS_DIR>/skills` array because `discoverTouchedSkills` mutates the live config
during a turn.

After the writer's fix, the same probe reports the fingerprint unchanged across all five
builds of a session, and:

```
w188-second-turn.mjs --tool-turn --bypass      first=2 requests, second=3, third=4
w188-second-turn-tui.mjs --tool-turn --bypass  first=2 requests, second=3, third=4
```

Both the line mode and the normal TUI now accept prompts after a tool-using turn.

## C9 / W184 plugin components: accepted

Driver: `w184-acceptance.mjs` against installed fixture plugins alpha/beta/gamma/delta.

Asserted: all four install; catalog lists 4; skill/agent/command expansion per plugin;
`skills: []`, `agents: []` and `commands: {}` each suppress only their own default folder
while a root `SKILL.md` still loads; bad entries excluded from listings; plugin agent fork
carries the plugin system body, the fork argument and only the declared tools; plugin
update swaps the generation (`ALPHA_ONE_V2` in, `ALPHA_ONE_V1` out) for both skills and
forked agents; removal stops expansion and makes the slash command unknown; a second
plugin's inline skill survives the first plugin's removal.

## C6 / W185 async adoption: accepted

Driver: `c6-after/matrix3.mjs` (11 cases) plus `c6-after/fields.mjs`, re-run against the
current `dist`.

| case | held before release | after release |
|---|---|---|
| `{"async":true}` newline / no-newline / split header | settled, 1 job | 1 completion, state completed |
| malformed, `{"x":1}`, `{"async":false}`, plain, registration refused | not settled, 0 jobs | no job, foreground result only |
| configured `async: true` | settled, 1 job | 1 completion, not re-adopted |

`fields.mjs` shows the adopted command's later stdout arriving as
`result.systemMessages: ["OWNED_FINAL_CONTEXT"]` on the completion, with the foreground
turn returning `backgroundTasks`. `registry.close()` kills the adopted group; the fixture
reports owned cleanup.

## C7 / W186 same-host peer: accepted, and the Node 22 gap is closed

Driver: `w185-peer-acceptance.mjs` plus `scripts/smoke-peer-cli.mjs`.

Peer acceptance asserted: record discovery, per-socket auth keys `0600` under a `0700`
directory, socket `0600`, approved / denied / expired delivery with receipts, the approved
text reaching the peer's next request, no session artifact embedding the auth token, and
owned cleanup leaving no records or keys.

The checklist row still reads "Node22 remains unmeasured". Measured now:

```
npx -y node@22 scripts/smoke-peer-cli.mjs             v22.23.3  cli=passed, 2 processes, ownedCleanup=true
npx -y node@22 scripts/smoke-peer-cli.mjs --compiled  v22.23.3  cli=passed, compiledCLI=true, ownedCleanup=true
```

## C5 permission persistence: implemented, independently accepted

The checklist keeps C5 open as an umbrella, but the destination engine exists
(`src/permission-settings.ts`, wired at `src/session.ts:429`) and the remaining C5 evidence
is now in place. Driver: `w188-c5-persistence.mjs` against `dist/`.

Asserted against real files under a private userDir and a private git workspace:

- three persisting destinations write their own file (`user/settings.json`,
  `<ws>/.harness/settings.json`, `<ws>/.harness/settings.local.json`) and their own bucket;
  a sibling bucket, an unrelated top-level field and an unrelated env object all survive
- `session` and `cliArg` are `skipped` and leave every file byte-identical
- `setMode` writes `permissions.defaultMode`; `setMode` `bypassPermissions` is `skipped`
  and never writes `defaultMode`; under `managedOnly` an `addRules` is skipped while
  `setMode` still writes
- `addDirectories` preserves same-batch duplicates as the source does; `removeDirectories`
  drops exactly the named paths; re-adding a normalized duplicate is `unchanged`
- 20 concurrent additions to one file all survive with no duplicates (per-file queue)
- malformed JSON returns `outcome: error` with the original bytes intact; a settings
  symlink is refused with `Permission settings must be a regular file` and its target is
  untouched
- `drainPermissionSettings()` resolves with every accepted update on disk
- a **new process** loading through `loadProjectConfig(workspace, { userDir })` sees the
  same files: the queued additions, the sibling deny bucket, the directory removal, the
  local ask bucket, and `settings.permissions.defaultMode === "plan"`

Memory-first is the call order at `src/session.ts:416-428`: the update is applied to the
in-memory state, then persistence is scheduled. No disk-before-tool claim is made, matching
the source contract.

Already independently verified in the W183 driver set and still applicable: directory
consumers reaching the real path boundary (`w183-directory-independent-result.json`:
empty/relative/missing deny, alias retarget deny, independent owner allow, removal deny,
explicit regrant allow), legacy `settings.local.json` revocation without reviving removed
rules (`w183-legacy-after-result.json`), and the `auto`/`dontAsk` classifier gates
(`w183-final-independent-result.json`).

Recorded boundary: interactive UI restore stays unclosed and is not generalized from print
resume, as the source report requires. Vendor account/remote policy stays excluded.

## Full suite on the current tree

```
npm test    2663 tests, 118 suites, 0 fail, 0 cancelled, 0 skipped
```

Bound to the working tree that contains the C2 inline mount and the runtime-owner fix.

## Still open

The final local CLI/build/evidence row consumes this file. The W183 checklist row still
contradicts itself (head claims commit `9882b12` and identity `96ea4a19`, tail lists
recovery/children, whole-package compiled CLI and final independent acceptance as pending;
the port record's Status still reads "exact-path commit pending"). W182's identity appears
as both `4ee7b8a4` and `ed62c245`. W181's port record still ends "No commit or push"
although `9caf843` contains it. None of these are product defects; all three are record
inconsistencies that block a truthful exit checklist.
