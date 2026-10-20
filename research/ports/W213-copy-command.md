# W213 the `/copy` command

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/copy` was the
first recovered local command with no counterpart at all: the input bar offered no way to put a
response on the clipboard, and the transcript's `selection:copy` only copied a hand-drawn span.

## What was there

Nothing. `COMMAND_HELP` and the composer's command table had no `copy` row, and the interactive
loop's dispatch had no branch for it. The pieces it needed already existed: `osc52Payload` in
`src/clipboard-osc52.ts` and the raw-write sink `copySelection` uses at `src/tui.ts:2180`.

## Recovered source

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-c283tj3z.js` | `79b675ce7d1fe271ccc2fb0ba60f71b9899f5a7ac9e98a5fafe7582c1a7c82af` | 16481 / 16498 / 16511 | `re` `response.md`, `ge` `copy.md`, `Ue` 20 |
| ↳ | | 16171 / 16290 | `bt` / `wt`, the block labels |
| ↳ | | 17750 | `Ye`, the recent assistant texts |
| ↳ | | 17979 | `ye`, the extension from a language token |
| ↳ | | 18085 | `ue`, the scratch-file write |
| ↳ | | 18207 | `A`, the copy action and its report |
| ↳ | | 18528 | `Be`, the block selector |
| ↳ | | 22222 / 22233 | `kt` 120, `cn`, the command handler |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 1121856 | the registration |

The handler, read from the bundle:

```js
cn = async (l, a, t) => {
  let o = Ye(a.messages);
  if (o.length === 0) return l("No assistant message to copy"), null;
  let u = 0, d = t?.trim();
  if (d) {
    let f = Number(d);
    if (!Number.isInteger(f) || f < 1) return l(`Usage: /copy [N] where N is 1 (latest), 2, 3, … Got: ${d}`), null;
    if (f > o.length) return l(`Only ${o.length} assistant ${o.length === 1 ? "message" : "messages"} available to copy`), null;
    u = f - 1;
  }
  let c = Ge(zh(o[u])), p = Je(c), m = ce();
  if (p.length === 0 || m.copyFullResponse) {
    let g = await A(c, re);
    return l(g), null;
  }
  return e(Be, { fullText: c, blocks: p, messageAge: u, onDone: l })
};
```

and the copy action, which is what the local port follows:

```js
async function A(l, a) {
  let t = await Sv(l);
  if (t) process.stdout.write(t);
  let o = Lt(l, `\n`) + 1, d = `Copied to clipboard (${l.length} characters, ${o} lines)`, c = _xn(l);
  try { let p = await ue(l, a), m = c ? `\n⚠ ${c}; the file below is unaffected` : "";
    return `${d}${m}\nAlso written to ${p}` }
  catch { let p = c ? `\n⚠ ${c}` : ""; return `${d}${p}` }
}
```

`Sv` returns the clipboard request and the caller hands it to stdout unwrapped — the payload is not
routed through a sanitizer.

## Port

- `src/copy-command.ts` (new): `copyResponses` (`Ye`), `parseCopyArgument` (`cn`'s argument arm),
  `copyEmptyMessage`/`copyTooManyMessage`/`copyUsageMessage`, `copyReport` (`A`'s report),
  `copyFileExtension` (`ye`), `copyBlockLabel` (`bt`/`wt`), `copyScratchDirectory` and
  `writeCopyFile` (`ue`).
- `src/interactive.ts`: a `/copy [N]` branch beside the other output-only commands. It collects the
  assistant turns from `session.events`, answers the empty / usage / overrun cases with the
  recovered texts, writes the clipboard request, then the scratch file, then the report.
- `src/terminal.ts` gains `writeClipboard?(payload)` on `TerminalSurface`; `src/tui.ts` implements
  it as the same raw `options.output.write` `copySelection` uses.
- `COMMAND_HELP` and `src/tui-autocomplete.ts` take the recovered description
  `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)`.

## Adaptations and what stays out

- **The block selector is out.** `Be` offers `["full", ...blocks, "always"]` when a response holds
  copyable code or quote blocks, and `ce()`'s `copyFullResponse` skips it. The local port always
  takes the full-response arm, which is the recovered behaviour when a response has no blocks or
  the option is set.
- **Table normalization is out.** `Ge` rewrites markdown tables before copying and needs the vendor
  markdown tokenizer (`FXe` over `Cm`); the copied text keeps the table source the model wrote.
- **The control-character advisory is out.** `_xn`'s text lives in a module this host has not
  located, so its branch is absent rather than paraphrased. The base report is byte-identical to
  the recovered no-advisory case.
- **A per-process scratch directory.** The recovered `tc()` is a session temp directory; this host
  has none, so `copyScratchDirectory` keys on the process id and two running sessions cannot
  overwrite each other's `response.md`.
- **The write is not inside the hook sequence formatter.** `writeTerminalSequence` re-wraps for
  tmux and screen and caps the length, which `osc52Payload` has already handled, so the clipboard
  request goes to a separate sink. Recorded on the interface, because reusing the hook path would
  double-wrap under tmux.
- **Telemetry dropped.** `i("tengu_copy", …)` and the `Bg`/`copy.md` export path are not ported.

## Verification

- `test/copy-command.test.ts` (new, 9 tests): newest-first collection with the non-text and
  plain-string turns skipped; the blank-line join across a response's text blocks; the twenty
  ceiling; every argument arm including `0`, `-1`, `1.5` and the overrun; the exact report for one
  and three lines with and without a file; the three recovered messages; the extension rule; the
  block labels including the 120-unit cut and the empty code block; and the scratch write.
- `test/interactive.test.ts` (+1 test): a live session runs two turns then `/copy`, `/copy 2`,
  `/copy 9` and `/copy 0`, asserting the base64 of each response appears in the OSC 52 request, the
  report names the size and the file, and the scratch file holds the last copied response.
- Full suite 2794/2794 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w213-copy.mjs` passes 7 checks over the real CLI: both responses reach the
  terminal as byte-exact OSC 52 requests, the report names 11 characters and the scratch file, an
  overrun names the available count, a bad index prints the usage, and the file lands under
  `response.md`.
