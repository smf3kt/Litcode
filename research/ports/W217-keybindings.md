# W217 `/keybindings`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/keybindings`
is `Open your keyboard shortcuts file`: the last live name in the scan of the composer's command
list (`/loops` and `/branch` are `isEnabled:()=>!1`, `/insights` sits behind a policy gate,
`/memory` is a thin-client form). The command itself is one line of terminal handoff, so the
package is mostly the editor capability it needs and the file it writes.

## What was there

Nothing. The command did not exist, `COMMAND_HELP` and the composer's command list did not name
it, and the reader (`src/keybindings.ts`) already loaded `<userDir>/keybindings.json` for a
session but nothing in the product ever created that file. The editor handoff existed only as
`editDraft`, which writes its own temporary buffer for the composer's draft; opening a file that
is already on disk was not a capability any surface had.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-askg8yg9.js` | `f66d35c67fefda8abd2156a3764b7f5e07e3e16905afbf4a87fdb74ee606ed81` | `m` 4976 | the pass that strips every non-rebindable key out of a context group |
| ↳ | | `a` 5210 | the template builder |
| ↳ | | `O` 5430 | the command body, exported as `call` |
| ↳ | | 6218 | the two report strings |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | `w1` 1960 | the named default table, grouped by context |
| ↳ | | `QOn` 16491 | `["FeedbackSurvey"]`, the contexts this environment excludes |
| ↳ | | `QDe` 17524 | the seven keys that cannot be rebound, with their reasons |
| ↳ | | `pqe` 18864 | the key-name normalizer (`" "` to `space`, trim, join) |
| ↳ | | `y9` 26121 | the customization gate |
| ↳ | | `k9t` 26748 | `join(be(), "keybindings.json")` |
| ↳ | | `$oo` 26798 | the `keybindings` storage key |
| `chunk-7tnkhv2k.js` | `9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9` | `Zie` 3081 | open a file in the editor |

The template and the body:

```js
function m(n){ let o = new Set(QDe.map((e) => pqe(e.key)));
  return n.map((e) => { let t = {};
      for (let [r, s] of Object.entries(e.bindings)) if (!o.has(pqe(r))) t[r] = s;
      return { context: e.context, bindings: t } })
    .filter((e) => Object.keys(e.bindings).length > 0) }

function a(){ let n = QOn, e = {
    $schema: "https://www.schemastore.org/claude-code-keybindings.json",
    $docs: "https://code.claude.com/docs/en/keybindings",
    bindings: m(w1.filter((t) => !n.includes(t.context))) };
  return _(e, null, 2) + `\n` }

async function O(n, o){
  if (!y9()) return { type: "text", value: "Keybinding customization is disabled in this environment." };
  let e = k9t(), t = !1, r = o.storageV5;
  if (r) { let i = await r.write($oo, a(), { precondition: { type: "ifAbsent" } });
    if (!i.ok) if (i.error.code === "AlreadyExists") t = !0;
      else throw new x(`keybindings template write failed: ${gt(i.error)}`, "keybindings template write failed") }
  else { await ie().mkdir(f(e));
    try { await c(e, a(), { encoding: "utf-8", flag: "wx" }) }
    catch (i) { if (E(i) === "EEXIST") t = !0; else throw i } }
  let s = await Zie(e);
  if (s.error) return { type: "text", value: `${t ? "Opened" : "Created"} ${e}. ${s.error}` };
  let d = Tr() ? ` (Safe mode: custom keybindings are disabled this session — changes take effect after you ${$g()}.)` : "";
  return { type: "text", value: t ? `Opened ${e} in your editor.${d}`
    : `Created ${e} with template. Opened in your editor.${d}` } }
```

`QDe` in full, which is where the local non-rebindable table comes from:

```js
var QDe = [
  { key: "ctrl+c",  reason: "Cannot be rebound - used for interrupt/exit (hardcoded)", severity: "error" },
  { key: "ctrl+d",  reason: "Cannot be rebound - used for exit (hardcoded)", severity: "error" },
  { key: "ctrl+m",  reason: "Cannot be rebound - identical to Enter in terminals (both send CR)", severity: "error" },
  { key: "ctrl+[",  reason: "Cannot be rebound - identical to Escape in terminals", severity: "error" },
  { key: "ctrl+i",  reason: "Cannot be rebound - identical to Tab in terminals", severity: "error" },
  { key: "ctrl+h",  reason: "Cannot be rebound - identical to Backspace in terminals", severity: "error" },
  { key: "capslock", reason: "Caps Lock is not delivered to terminal applications", severity: "error" } ];
```

## Port

- `src/keybindings-command.ts` (new): `NON_REBINDABLE_KEYBINDINGS` (`QDe`), `keybindingsFilePath`
  (`k9t`), `keybindingsTemplate` (`a` and `m`), `writeKeybindingsTemplate` (`O`'s `wx` step, where
  `EEXIST` is the `AlreadyExists` arm), and `keybindingsReport` (`O`'s two report strings).
- `src/external-editor.ts`: the dependency object `editExternal` used to build inline is now
  `editorDependencies(...)`, shared with the new `openExternalFile` (`Zie` without the draft
  write). `editExternal`'s behaviour is unchanged.
- `src/external-editor-source.ts`: `Zie` was already ported but not exported; it is now part of
  the returned surface.
- `src/terminal.ts`: `DEFAULT_KEYS` is exported as `DEFAULT_KEYBINDINGS` so the template can
  enumerate the defaults. `TerminalSurface.openFile?` and its `TerminalInput` implementation
  mirror `editDraft`'s suspend/resume (focus events off, raw mode off, cursor shown on suspend;
  the reverse on resume).
- `src/tui.ts`: `handoffEditor`'s body became `editorHandoff()`; `openFile` is the same guard and
  the same source-search cancellation as `editDraft`, without a buffer.
- `src/interactive.ts`: the `/keybindings` branch, placed with the other configuration commands.
  The file is written first, then handed to the terminal when there is one and to
  `openExternalFile` directly when there is not.
- `src/tui-autocomplete.ts` and `README.md`: the command row and the README line.

## Adaptations and what stays out

- **The file shape is the reader's, not the writer's.** `a` emits
  `{$schema, $docs, bindings: [{context, bindings}]}` over the named default table, because the
  recovered reader is context-aware. This host's reader (`src/keybindings.ts`) takes one flat map
  of literal terminal sequence to editor command and reads every top-level key as a sequence; its
  own limitations line records that named keystrokes and vendor contexts are outside its contract.
  The template is therefore that flat map, and `$schema`/`$docs` are dropped. Writing the
  recovered shape would produce a file this host cannot load, so the deviation is forced by the
  reader, not chosen.
- **The non-rebindable list is the sequence image of the recovered names.** `QDe` names seven
  keys; the local table holds eight sequences. `ctrl+m` is both CR and LF and `ctrl+h` both DEL
  and BS, so each pair expands to two sequences; `capslock` is not delivered to a terminal as any
  sequence, so it cannot appear in a sequence-keyed file. The reasons are the recovered strings
  verbatim.
- **The customization gate is dropped.** `y9()` reads the `tengu_keybinding_customization_release`
  flag. This host has no gates, so the disabled-environment message is recorded rather than
  reachable.
- **The safe-mode suffix is out.** `Tr()` and `$g()` are the safe-mode state and its exit command.
  This host has no safe mode.
- **The storage path is out.** `o.storageV5.write($oo, ..., {precondition:{type:"ifAbsent"}})`
  writes the template through the versioned store. This host has no such store, so the `else`
  branch is the only one: `mkdir` the directory and `writeFile` with `flag: "wx"`, which is the
  same create-once contract the precondition expresses. The local write adds mode `0600`, because
  the file holds the user's own shortcut map.
- **The excluded context is out.** `QOn` names `FeedbackSurvey`, a context this host has no
  defaults for; with no contexts at all, the filter is the non-rebindable pass alone.

## Verification

- `test/keybindings-command.test.ts` (new, 4 tests): the path; the template round-tripping through
  the product's own reader (`decodeKeybindingsJson`) with the eight non-rebindable sequences
  absent, `ctrl+r` to `search`, `ctrl+y` to `yank`, `ctrl+g` to `externalEditor` and more than
  thirty entries; create-once at mode `0600` with an existing file left untouched; and the four
  report forms.
- `test/interactive.test.ts` (+1 test): a live loop creates the file on the first `/keybindings`,
  reports the created arm, leaves it byte for byte alone on the second and reports the opened arm.
  The test pins both `VISUAL` and `EDITOR`, because the resolver prefers `VISUAL` and resolves
  once per process.
- Full suite 2829/2829 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w217-keybindings.mjs` passes 13 checks over the real CLI at the pty's
  90x30, with a stub editor on `VISUAL`/`EDITOR` that records its argument: the first run reports
  `Created <file> with template. Opened in your editor.`, the stub was handed that exact path and
  the file already existed when it was spawned, the file is mode `0600` and parses as a flat
  string map holding `ctrl+g` and none of the eight non-rebindable sequences, and the second run
  reports `Opened <file> in your editor.` with a second spawn and an unchanged file.
