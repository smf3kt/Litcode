# W272 `/branch`

The `/branch [name]` command. Offsets are zero-based UTF-16 code units, ranges half-open.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `CTo` 1638151 | the `local-jsx` registration: `branch`, `Create a branch of the current conversation at this point`, argument hint `[name]` |
| `chunk-8a6bg1at.js` | `e34c7cbe744b07bcb28040e5434e9bd785af93f7a157e9ac60f904a2413e96df` | `te` 14328 | the first-prompt reader over the branch source list |
| ↳ | | `se` 17210 | the storage branch: guard, journal copy, new title, new id |
| ↳ | | `re` 19834 | the title allocator `<base> (Branch)` / `<base> (Branch N)` |
| ↳ | | `oe` 20188 | the command body and its success/failure lines |
| ↳ | | `_e` 21599 | the local `call` |
| `chunk-nkvcn1t9.js` | `f0c22846a7a6e8758dc7a99291d9aabe69e2e64df7befc70aefb93c3d4f51941` | `d8e` 824 | the per-message prompt reader: `isMeta`, compact summary, tool result, command and bash tags |
| `chunk-sahdsq7n.js` | `f8807529cfba1dc0bc35ef9b17d6d39ccf35bba8f66e3e0e6c6ed07c1d43eda0` | `gwe`/`$Mt` 1822 | the pasted-content unwrap |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` | `ne` 1128 | the grapheme cut |
| ↳ | | `gl` 677 | the regex escape |

## Behaviour

- **Guard.** `se` refuses while a turn is unfinished; the body raises the same guard before it copies
  anything.
- **Copy.** The new session receives the conversation epochs (messages, compact summaries, turn
  boundaries and their checkpoints, titles, colour, instruction watch, file history, permission-mode
  commands) and appends a `branch` record naming the source id, workspace and boundary.
- **Title.** `oe` takes the custom name as typed when one is given: `S = l?.replace(/\s+/g," ").trim()`,
  with no `(Branch)` suffix and no ordinal. Only a bare `/branch` derives the base through `te` and
  passes it to `re`, which appends ` (Branch)`, and on a collision the lowest unused ` (Branch N)`,
  N starting at 2; a title that only shares the prefix does not consume an ordinal.
- **First prompt.** `te` walks the source rows in order and skips `isMeta` rows, compact summaries,
  tool-result rows, interrupted rows and rows that start with an XML-style tag. Within one message
  `d8e` reads each text block in order and returns at the first tool_result block. A
  `<command-name>` row only supplies the fallback, so a plain prompt after it still wins; a
  `<bash-input>` row becomes `! <command>`. The 200-unit cut with `…` is applied first, then `te`
  collapses whitespace and cuts the whole title to 100 units, so the ellipsis only survives for a
  prompt shorter than 100 units.
- **Lines.** Interactive: `Branched conversation "T". You are now in the new branch (session X). Use
  /resume Y ("orig") to return to the original, or run \`claude -r Y\` in a new terminal.` Only a
  custom title is quoted; a derived title leaves the opening bare. Headless:
  `Branched conversation "T". Resume with: /resume X`. Failure:
  `Failed to branch conversation: <message>`.

## Host adaptations

- **Storage.** The source writes a new journal beside the original through its storage layer; the
  host's `forkSession` already performs that copy and the `branch` record, so the command calls it
  and appends the title the source computes.
- **Existing titles.** `re`'s collision set comes from `listSessions(workspace)`, which reads the
  same journals the new branch is written beside.
- **Switch.** `acceptNext` + `startAgentSession('fork')` is the host's session-switch path, shared
  with `/fork` and `/resume`; the branch record's `reason` is the host's `fork`.
- **Current title.** The interactive line's `("orig")` comes from the last `title` event in the
  source session, the same row `/rename` writes.
- **Argument.** `[name]` is trimmed; a non-empty argument is the title as typed. An empty argument
  derives the prompt and allocates the ordinal.
- **Not ported.** The vendor's branch-telemetry event, the remote/thin-client dispatch and the
  post-branch "keep working" composer hint have no local counterpart.

## Validation

Unit 10/10 (`test/branch.test.ts`) and 6/6 (`test/branch-command.test.ts`); compiled 10/10 at
identity `bec59cf7…`; full suite 3146/3147 with the known `cli-migration` effort failure.
