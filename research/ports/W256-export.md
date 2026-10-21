# W256 `/export`

The recovered export command and its method dialog. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-3f62mcb0.js` | `2b0102b81ba0ddf6c8db8739e245076f2f778277cec7957212d07aebb07041b4` | `ho` 25338 | command entry and argument arm |
| ↳ | | `S` 22772 | method dialog, filename mode, clipboard/file writes |
| ↳ | | 22488 / 22588 | `ce` extension rule, `h` mkdir + flushed write |
| ↳ | | 23803 / 24103 / 24785 / 25147 | option labels, `Enter filename:`, dialog title |
| `chunk-p3r9fahb.js` | `d32fee194e230ad32247a55d3228b524b0ddc507145014fd1bbdc7e08d45c04d` | `wcn` 662 | default filename and slug |
| `chunk-wh2vcbh8.js` | `4f11ef8e1e1749cb96813db9575a40fad7d44576d313172aaa372c4baf330b68` | `et` 3533 | path resolution |
| `chunk-3gz7s57c.js` | `9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b` | `VBe` 189735 | transcript text builder |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `iEo` 1650377 | `local-jsx` registration |

## Behaviour

- **Argument arm.** `/export FILE` writes immediately: `ce` appends `.txt` only when the raw name
  has no extension, `h` creates parent directories and writes UTF-8 with flush, then the command
  reports `Conversation exported to: <path>` or `Failed to export conversation: <message>`.
- **Bare command.** `S` opens the `Export conversation` panel with subtitle `Select export method`
  and two options: `Copy to clipboard` (`Copy the conversation to your system clipboard`) and
  `Save to file` (`Save the conversation to a file in the current directory`). Clipboard writes the
  OSC 52 payload and reports `Conversation copied to clipboard`; file mode asks
  `Enter filename:` with the default name prefilled. Esc in file mode is the panel's `confirm:no
  isActive` arm: it returns to the method list; Esc in the method list reports `Export cancelled`.
- **Default filename.** `wcn`: local timestamp `YYYY-MM-DD-HHMMSS`, the first user message
  (string or its last text block, trimmed, trailing newlines dropped, capped at 50 with `…`),
  lowercased and slugged to `[a-z0-9-]`; with no text, `conversation-<timestamp>.txt`.
- **Path.** `et`: trim, `~/…` against the home directory, absolute as-is, otherwise against the
  base directory.

## Host adaptations

- **Transcript text.** `VBe` mounts the vendor transcript surface (`CD`) and joins its rendered
  rows. This host has no off-screen transcript renderer, so `exportTranscriptText` emits the
  conversation it owns: user text prefixed `> ` per line, assistant text as-is, blank line between
  messages, non-text blocks skipped. The vendor welcome header and tool rows are not reproduced.
- **Base directory.** The source resolves relative names against its launch directory. The local
  CLI's logical working directory is the session workspace, which `writeConversationExport` uses.
- **Dialog shape.** The source switches one panel between method and filename modes. This host's
  dialog is one request per step, so `/export` opens the method dialog and then the filename
  dialog, preserving the Esc-in-filename → method-list loop and the recovered guide semantics.
- **Clipboard writers.** The source writes the payload to stdout. This host routes it through
  `writeClipboard` when the terminal surface has one, as `/copy` already does.
- **Piped mode.** The registration is `local-jsx` only. Without a prompt surface the bare command
  answers `Usage: /export [filename]`; the argument form works.
- **Path portability.** The source's Windows drive normalization and its `mon` path validation are
  not ported; the host rejects NUL and resolves POSIX paths.

## Validation

- `test/export-command.test.ts`: 5/5 (timestamp + slug, no-request fallback, last-text-block and
  50-character cap, transcript prefixes and dropped blocks, extension/resolution rules, mkdir and
  flushed write).
- `test/tui-autocomplete.test.ts`: 27/27 after adding `export` to `TUI_COMMANDS`, matching
  `COMMAND_HELP`.
- Compiled `.audit/w256-export.mjs`: 9/9 at identity `ded25dac…`. Bare `/export` shows both methods
  and Esc reports `Export cancelled`; Save to file prefills
  `<timestamp>-export-me-please.txt`, Enter writes it and the file carries `> export me please`
  plus `response 1`; `/export direct-notes` writes `direct-notes.txt`; a bad path reports
  `Failed to export conversation: …`; the clipboard method reports its success text.
- Full suite: 3027 tests, 3026 pass; the single failure is the pre-existing CLI effort-flag
  divergence. `async-hooks`' cancellation test failed once under the full run and passed in
  isolation (17/17).
