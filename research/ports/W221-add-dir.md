# W221 `/add-dir`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/add-dir` is
`Add a new working directory`, the next live registration after `/help` and `/tui`, and the first
one this loop ports that writes session state rather than only reporting it.

## What was there

The command did not exist. The permission model that backs it did: `SessionPermissionUpdates`
(`src/permissions.ts:107`) already carries `additionalWorkingDirectories: Map<string, {path,
source}>`, `effectivePermissionPolicy` folds its keys into `additionalDirectories`, and
`Session.adoptPermissionUpdates(updates)` is the apply-and-persist path. Nothing wrote to it
except the launch flags.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-dzt2d3te.js` | sha256 `1936b91632b264d2051cd791d435fd3ab5c2bdfa41d525152188f1ffd88c8cce`, `d` 14026 | the command body |
| `chunk-8f8e39h5.js` | sha256 `e11fb72ae3ce145c111421083890229a5e6a7d4606465f14116347815e894282`, `gge` 1097 | the path validator |
| ↳ | `hge` 2073 | the message table |
| `chunk-340rde3k.js` | sha256 `00e3e7e5f62654d3f814557eb2399ff7787f3592377deed4a2d4b0eec5924727`, `lwn` 1608 | the apply report |
| ↳ | `iGt` 3062 | the `alreadyInWorkingDirectory` skills-loading note |
| `chunk-sfn1dbxq.js` | `k0e` 972849 | the `local` registration |
| ↳ | `Slo` 973112 | the `local-jsx` registration (`S0e` is an alias) |

The body:

```js
async function d(r,t){ let o=r.trim();
  if(!o) return {type:"text",value:"Usage: /add-dir <path>"};
  let e=await gge(o,de(t));
  if(e.resultType!=="success") return {type:"text",value:(e.resultType==="alreadyInWorkingDirectory"?iGt(t,e):null)??hge(e)};
  return {type:"text",value:await lwn(t,e.absolutePath,!1)} }
```

The registrations:

```js
var k0e={type:"local",name:"add-dir",description:"Add a new working directory",argumentHint:"<path>",
  supportsNonInteractive:!0,thinClientDispatch:"post-text",isEnabled:()=>ve()&&VOs(),
  get isHidden(){return !ve()},load:()=>import("/$bunfs/root/chunk-dzt2d3te.js")},
Slo={type:"local-jsx",name:"add-dir",description:"Add a new working directory",argumentHint:"<path>",
  immediate:(e,n)=>e.trim()!==""||n==="fullscreen",thinClientDispatch:"twin"};
```

The message table (`hge`) branches on `resultType` in the order `emptyPath`, `invalidPath`,
`pathNotFound`, `networkPath`, `notADirectory`, `alreadyInWorkingDirectory`, `success`. The
`alreadyInWorkingDirectory` arm reads `isExactMatch` first and then `isOriginalCwd`, and the
inexact arm interpolates `the current working directory` or `the additional working directory`
followed by the containing root. The validator (`gge`) walks: empty, null byte, network path,
`stat`, `isDirectory`, then containment against the working directories.

## Port

- `src/add-dir-command.ts` (new): `ADD_DIR_USAGE` (the body's empty arm), the `AddDirectoryResult`
  sum type (`emptyPath` | `invalidPath` | `networkPath` | `pathNotFound` | `notADirectory` |
  `alreadyInWorkingDirectory` | `success`), `isNetworkPath` (the UNC spellings `gge` rejects),
  `expandDirectoryPath` (`~` and `path.resolve` against the cwd), `withinDirectory`,
  `validateAddDirectory` (`gge`'s checks in its order), `addDirectoryMessage` (`hge`), and the
  three apply reports `addedForSessionMessage` / `addedToSettingsMessage` /
  `addedToSettingsFailedMessage` (`lwn`, `iGt`).
- `src/interactive.ts`: the `/add-dir` branch next to `/tui`. It validates, then applies
  `{type:'addDirectories', directories:[absolutePath], destination:'session'}` through
  `session.adoptPermissionUpdates` — the local `setToolPermissionContext` — and reports.
- `src/tui-autocomplete.ts`, `COMMAND_HELP` and `README.md`: the command row with the recovered
  description, which the recovered kind table (`chunk-wtch2p0g.js` 1739) classes as `action`.

## Adaptations and what stays out

- **`lwn`'s own outcome is ignored, as in the body.** `d` discards what `lwn` returns and reports
  the session arm unconditionally, so a failed settings write never changes the message. The local
  branch does the same and reports the session arm only.
- **`iGt` is out, and its branch falls through to `hge`.** `d` prefers `iGt(context, result)` over
  `hge(result)` for `alreadyInWorkingDirectory`. That function returns `null` for an exact match
  and for anything outside the current working directory, and otherwise explains that the
  location's skills, commands and agents were not loaded, because it resolved through a link or
  sits inside a directory whose skills are disabled. This build loads skills from fixed roots
  (`.harness/skills`, `.harness/commands`, `.harness/agents`, `.harness/plugins`) and keeps no
  per-directory loading state, so `iGt` has no local input; the branch reports `hge` instead.
- **The settings destination is out.** `lwn`'s third argument picks the destination —
  `destination: s ? "localSettings" : "session"` — and `d` passes `!1`. The settings arm and its
  two reports are ported as text but have no caller, because the local permission store persists
  the session map and has no settings writer for this key.
- **The network-path refusal keeps its Windows guidance verbatim.** The recovered message names
  `--add-dir` and the drive-letter trust note; on this host the check still fires for a UNC
  spelling, and the text is kept unchanged rather than rewritten for POSIX.
- **No path-entry box.** `Slo.immediate` is `argumentHint`-bearing `local-jsx`: with no argument
  the default renderer opens the path box (`chunk-9cqdphnz.js` `y`, which draws `❯ /add-dir` and
  the message under it), and only the fullscreen renderer submits an empty argument immediately.
  This build draws only the fullscreen renderer, so an empty `/add-dir` reaches the body's usage
  arm, which is the fullscreen behavior.
- **The `local` (non-interactive) registration is out.** It is gated by `ve() && VOs()` and hidden
  when `!ve()`; the local CLI has no non-interactive `/add-dir` dispatch to gate.
- **Styling is dropped.** `hge` wraps paths in `ge.bold`. The local status writer is plain text,
  as in the other ported reports (W218–W220).

## Verification

- `test/add-dir-command.test.ts` (new, 8 tests): `~` and cwd expansion; containment including the
  directory itself and the `/a/bc` vs `/a/b` boundary; the UNC spellings; `gge`'s checks in order;
  every `alreadyInWorkingDirectory` shape (exact/inexact against the cwd and an additional root);
  a real directory outside every root validating as `success`; every message in `hge`; and the
  three apply reports.
- Full suite 2873/2873 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w221-add-dir.mjs` passes 6 checks over the real CLI: an empty argument
  prints the usage line; the workspace reports `is already the current working directory.`; a
  missing path reports `was not found.`; a file is refused with its parent suggested; a real
  directory outside the workspace reports `Added … as a working directory for this session`; and
  adding it a second time reports `is already added as a working directory.` — which is the
  evidence that the write reached the session's working-directory set rather than only the report.
- The probe reads the pty at its own 90 columns. At 120 the harness's column-addressed redraws
  land in the wrong cells and a wrapped report can be dropped, which showed up as two false
  failures before the width was matched.
- `test/tui-autocomplete.test.ts` was updated in the same change. An empty query ranks every
  command equally, so the list is the table in name order; `add-dir` sorts before `agents` and the
  two tests that hard-coded `/agents` as the first row now assert the list's shape instead.
