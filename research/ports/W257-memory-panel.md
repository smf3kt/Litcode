# W257 `/memory`

The recovered Memory panel over the session's instruction files, and its editor hand-off. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-xmmahshv.js` | `d05e6c429ee5b651d745505d90121bd96c379ab9cff423e58a8e31ddac03f2f0` | `eo` 45107 | home/workspace display path, shorter spelling wins |
| ↳ | | `kn` 45274 | local `Memory` dialog, file creation, editor report |
| ↳ | | `zi` 46871 | `local-jsx` registration and config refresh |
| `chunk-chvcdc26.js` | `aaa89855b78d0faf7fc7a17c11ca0192af4f8a917f43b803912ab4e4ee51947b` | `ecn` 1124 | row model: labels, descriptions, indentation, placeholders |
| `chunk-7tnkhv2k.js` | `9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9` | `eWe` 1876 | `$VISUAL`/`$EDITOR` resolution and spawn |

## Behaviour

- **Panel.** `kn` mounts a `Memory` dialog. `ecn` yields one row per loaded memory file: `User instructions` for the user file, `Project instructions` for the workspace file, the display path otherwise, an imported file indented under its parent with the `L ` prefix, and `@-imported` as its description. Descriptions are `Saved in …`, `Checked in at …` when the workspace is a repository, or empty. Absent user and project files are appended as placeholders so choosing one can create it.
- **Select.** The chosen path's parent is created, the file is created with `flag: "wx"` and `EEXIST` ignored, and `eWe` resolves `$VISUAL`, then `$EDITOR`, then `code`/`vi`/`nano`. A resolved editor receives the file; the report is `Opened <display>` followed by `> Using $VISUAL="$VISUAL". …` or `> Using $EDITOR="$EDITOR". …`, or the default `> To use a different editor, set the $EDITOR or $VISUAL environment variable.`
- **Failure.** No resolved editor, or an editor spawn error, reports `Couldn't open <display> in an editor. If no editor is configured, set $EDITOR or $VISUAL, then run /memory again.`
- **Cancel.** Escape reports `Cancelled memory editing`.
- **Refresh.** `zi` reloads the instruction list before mounting, so files added since launch are present.

## Host adaptations

- **File names.** The vendor row model hard-codes `CLAUDE.md` and `~/.claude/CLAUDE.md`. This host's loader reads `HARNESS.md` and `AGENTS.md` (`src/config.ts` `INSTRUCTION_FILES`), bounded at home or a git root, plus `.harness/rules`; `memoryPanelRows` applies the same label/description/placeholder rules over those names. The user placeholder is `~/HARNESS.md` because that is the user-scope file this loader reads.
- **Rows excluded.** `Ko` also renders organization-memory toggles, the synced-project picker, auto-memory folder rows and agent-memory rows. Those read the vendor control plane (`l_`, `wn`, `tcn`, `ncn`) and have no local consumer here, so they are not ported. The recovered local dialog `kn` is the portable surface.
- **Editor hand-off.** `eWe`'s terminal branch enters the alternate screen itself. This host routes through `terminal.openFile`, which suspends the renderer exactly as `/keybindings` does, and falls back to `openExternalFile` without a modal surface.
- **Piped mode.** The registration has no `local` sibling. A session without a modal surface prints the recovered rows as text instead of inventing a dialog.
- **Imports.** The recovered loader's file list comes from session state. This host re-reads `loadProjectConfig` and includes imported instructions from both `instructions` and `conditionalRules[].imports`, preserving `parent` for indentation.

## Validation

- `test/memory-panel.test.ts`: 7/7 (rows and placeholders, path shortening, create-then-open, failure line, editor-source report, piped report).
- `test/memory-command.test.ts`: 1/1 (`/memory` request title and choices, selection opens `./HARNESS.md`, recovered report).
- `test/tui-autocomplete.test.ts`: 22/22 after adding `memory` to `TUI_COMMANDS` and updating the `/mo` fixture counts.
- Compiled `.audit/w257-memory.mjs`: 8/8 at identity `205d9bf2…`. `/memory` lists both rows; Escape reports the cancellation; Enter on the project file opens it through the fake `$EDITOR`; the absent `~/HARNESS.md` is created and opened; every CLI exits zero.
- Full suite: see the STATUS line.
