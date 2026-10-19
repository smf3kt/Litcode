# W203 custom theme storage and the band's slot colour

Status: implemented locally on `work/w43-choice-preview`. Follows W202. No push, no
upstream calls.

## Request

Loop prompt 「继续完善tui，直到搬运剩余还没做的的功能的tui显示」, next item in
`.audit/tui-remaining.todo.md`: 「W203 theme storage: custom theme names parse then fall back
to dark; custom stores are absent.」

## Recovered source

- `chunk-5dxmnnh1.js`, sha256
  `e606440bafb72dea60a46e063e4923a299c7071c6560e7fc58e0d2a45a135cfb`: `zye` [3226,4818),
  the slot-value-to-ANSI function, with the `rgb` and `ansi256` operand regexes `k` and `y` at
  3150 and 3174; `HK` [20509,20555), the override-value validator.
- `chunk-04m6g9sr.js`, sha256
  `f9592a99f1db870e5f9dd7a4b9c28fdf71d8b7450c6ad9a5dd2715a3b91f61bc`: the sixteen-name table
  `be` [5451,5713) and the theme-value parser `D` [5713,6254).
- `chunk-1r9zp6s1.js`, sha256
  `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e`: `j` [6395,6551), the
  pass-through that keeps a slot value already spelled `rgb(`, `#`, `ansi256(` or `ansi:`.

Coordinates are zero-based UTF-16 offsets.

**`zye` is the whole grammar.** Its foreground branch reads, in order: `ansi:<name>` against
`be`'s sixteen names, then `#` through `chalk.hex`, then `ansi256(n)` through
`chalk.ansi256`, then `rgb(r,g,b)` through `chalk.rgb`, and returns the string untouched for
anything else. `D` parses the same five spellings into a colour, and `HK` is the gate that
decides which of them a theme override may carry:

```js
function HK(r){if(typeof r!=="string")return!1;
  if(/^rgb\(\s?\d{1,3},\s?\d{1,3},\s?\d{1,3}\s?\)$/.test(r))return!0;
  if(/^#[0-9a-fA-F]{6}$/.test(r)||/^#[0-9a-fA-F]{3}$/.test(r))return!0;
  if(/^ansi256\(\d{1,3}\)$/.test(r))return!0;
  if(r.startsWith("ansi:"))return c.has(r.slice(5));return!1}
```

So a stored override is guaranteed to be one of those five, and every consumer of a slot value
must accept all five.

## What was actually wrong

The todo entry named three symptoms. Measured, only the third is a defect.

1. **Custom theme names parse and resolve.** A compiled CLI with
   `<user>/settings.json` = `{"theme":"custom:mine"}` and
   `<user>/themes/mine.json` = `{"name":"Mine","base":"light","overrides":{"claude":"#010203"}}`
   reaches `bindThemeCatalog` with the right `userDir` and the right setting, publishes
   `mine/light`, and reports `setting=custom:mine current=light claude=#010203`. The first
   paint is dark because `ThemeState` is constructed before the catalog lands and
   `resolveThemeSource` falls back for an unknown slug; the repaint after the publish is light.
   An earlier probe read only the first 900 bytes of the stream and called that fallback a
   permanent one. It is not: on the same run `custom` paints the light palette
   (`38;2;90;90;90` …) and `custom:nope` paints dark.
2. **Custom stores are not absent.** `CustomThemeCatalog` reads `<userDir>/themes/*.json`
   through the source's own loader, watches the directory, and re-publishes. The writer
   `themeFileWriter` round-trips: an empty store lists nothing, one save writes
   `<user>/themes/mine.json`, `reload()` then lists `mine/Mine/light` with both overrides, and
   `choices()` returns `{"label":"Mine","origin":"custom","value":"custom:mine"}`.
3. **A validated override painted nothing in the suggestion band.** `slotForeground` in
   `src/tui.ts` recognised only `rgb(r,g,b)` and the ANSI names, so the `#rrggbb` and
   `#rgb` overrides `HK` accepts — the form the theme editor and every hand-written theme file
   use — and `ansi256(n)` were dropped. The transcript path was unaffected because it goes
   through the full `chalk` port in `src/tui-color.ts`; only the band, which needs an opening
   SGR sequence rather than a wrapped string, used the narrower hand-written grammar.

## Port

`slotForeground` is now `zye`'s foreground branch. The name table `ANSI_FOREGROUND` drops the
two aliases the source's `be` does not carry (`gray`, `grey`), and three module-level regexes
take the source's own spellings: `SLOT_RGB` = `k`, `SLOT_ANSI256` = `y`, and `SLOT_HEX` =
chalk's `hexToRgb` operand `/[a-f\d]{6}|[a-f\d]{3}/i` with its three-digit doubling and its
`000000` fallback for a malformed value. `ansi256(n)` emits `38;5;n`; `#` and `rgb` emit
`38;2;r;g;b`.

## Verification

- `test/tui.test.ts` gains 「a custom theme slot paints the suggestion band for every spelling
  an override may carry」: a custom theme overriding `suggestion` and `skill`, driven through
  the real band and the real watcher, asserting `38;2;1;2;3` for `#010203`, `38;5;42` for
  `ansi256(42)` and `38;2;170;187;204` for `#abc`. It fails on the pre-port `src/tui.ts` with
  「Band colour did not update」 and passes after.
- Compiled before/after on `bin/personal-harness.mjs` under `scripts/pty-cli.exp` at 90x30,
  with `<user>/themes/band.json` overriding `suggestion` to `#010203`: before, the band
  contains no `38;2;1;2;3`; after, it does. The `skill` override is absent in both because no
  skill lane row is on screen in a bare workspace.
- `npm run check` clean, `npm run build` clean, full suite 2741/2741 (118 suites),
  `test/tui.test.ts` 62/62.

## Adaptations

- The band emits the opening SGR itself rather than calling `chalk`, because the renderer
  appends its own resets; the grammar and the emitted codes are the source's.
- `gray` and `grey` are removed from the name table. The source's `be` has exactly the sixteen
  chalk names, and no built-in palette or `HK`-validated override can produce the two aliases.
