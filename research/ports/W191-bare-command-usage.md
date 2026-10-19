# W191 bare slash commands answer with their usage

Status: implemented locally on `work/w43-choice-preview`. Follow-up to
[W190](W190-tui-autocomplete.md): the suggestion list offered every command, but four
bare commands fell past their handler and answered `Unknown command; use /help`, so
choosing them from the list looked like nothing happened. No push, no upstream calls.

## Symptom

A compiled per-command sweep (`dist/cli.js` under a private HOME/XDG/userDir/workspace,
unreachable loopback gateway, `--no-inherit-gateway`, driver
`/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/slash-sweep.mjs`) ran each bare command in a
fresh session and read the resulting screen:

| Command | Before | After |
| --- | --- | --- |
| `/effort` | `error: Unknown command; use /help` | `error: Use /effort low\|medium\|high\|xhigh\|max` |
| `/cwd` | `error: Unknown command; use /help` | `error: Use /cwd DIR` |
| `/permissions` | `error: Unknown command; use /help` | `error: Use /permissions default\|plan\|acceptEdits\|ask\|bypass\|auto\|dontAsk` |
| `/config` | `error: Unknown command; use /help` | the Editor mode choice dialog |
| `/rename` | empty title written, no visible reaction | `error: Use /rename TITLE` |

Each handler matched `/<name> ` with an argument and then re-parsed the argument out of
the full prompt, so the bare spelling never entered the branch.

## Change

`src/interactive.ts`, four branches widened and two empty-argument guards added:

- the config branch condition gains `prompt === '/config'`, and its dialog arm covers
  both `/vim` and `/config` (the `/vim`-only `vimRedirect` line stays `/vim`-only,
  because that redirect names where the setting moved);
- the effort/permissions group condition gains `prompt === '/effort'` and
  `prompt === '/permissions'`, the effort arm gains the bare spelling, and the
  permission arm rejects an empty mode;
- the cwd group condition gains `prompt === '/cwd'` and the cwd arm rejects an empty
  directory;
- `/rename` rejects an empty title.

The permission list in the new message is the `permissionPolicySchema` enum
(`src/permissions.ts`), not the narrower `COMMAND_HELP` summary, so the message is
usable as written.

## Deliberately not ported: mouse click on a suggestion row

The recovered `iEe` does carry an `onMouseEnter`/`onClick` pair, but the inline
composer does not use it. In `chunk-24k7d6mw.js` the inline call site
[785707,785890) passes `suggestions`, `selectedSuggestion`, `maxColumnWidth`,
`emptyMessage`, `keepWindow` and `cursorRowId` only; the object that carries
`onSelect:xt, onHoverChange:Ct` is built at [785326,…) under `hn` (fullscreen) and is
consumed by `rKn`, the fullscreen renderer. The inline list therefore has no click
surface in the source, and W190's port matches it. Adding one here would be invented
behaviour, so the list keeps its keyboard surface (Tab, Enter, arrows, ctrl+n/ctrl+p,
Escape).

## Validation

- `test/interactive.test.ts` gains two tests: a bare argument command answers with its
  usage and never with `Unknown command`, and bare `/config` asks `Choose input editing`
  and records `Editor mode: vim` (driven by a live `PassThrough`, because the choice is
  read after the command line is handled). 18/18 in the file.
- Full suite 2679/2679 (118 suites), `npm run check` and `npm run build` clean.
- Compiled PTY sweep over all 43 offered commands in batches, `/editor` excepted (the
  sweep driver suspends on the TTY handoff; `/editor` is unchanged and already works):
  every row now yields transcript output, a dialog, or an explicit state/usage error.
  The accept probe
  (`/Users/mant1ssa/.claude/jobs/c9c17d97/tmp/accept-probe.mjs`) shows Enter on the
  filtered rows producing `/effort` → the effort usage line, `/rename` → the rename
  usage line, and `/help` → the command list in the transcript. No provider request is
  issued.

Raw samples stay unchanged; no recovered entrypoint is executed.
