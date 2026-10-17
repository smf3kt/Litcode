# W76 — preview display sanitation

## Source position

`Yb(e,n)` (chunk-qq2mgstr.js, UTF-16 [14883,15431)) is the display split for a
preview. Its string branch:

1. `if (!pn(i, n?.maxUnits)) return {kind:"withheld", marker}` — `pn`
   [8907,8946) is `ne(e, N6) === e`, with `N6 = 2000` (offset 8811);
2. `r = n?.softWrap ? MIs(i) : i`, then
   `s = (n?.scrub === "key" ? Pe(r) : pc(r)).replace(/\t/g, " ")`;
3. `if (rPe.test(c)) withheld`, then `if (xg(s) !== s) withheld`;
4. full text `$8(s)`, gutter flag `RS(s)`.

`pc` [8706,8741) is `Zs(Ce(e, cn))`; `Ce` [8414,8503) iterates code points and
replaces where `cn` [8375,8414) holds (`L` [8178,8299) and not `ln`
[8080,8178)). `Zs` is the already-copied `kt` [5645,5792) from
chunk-bf3z2ftn.js: variation selectors dropped, controls/`Rt`/surrogates
replaced by U+FFFD, the tab/ESC pass `Epe` expands tabs to the next eight-column
stop, then `Lr` applies the grapheme preview. `rPe` is declared in the same
module [3856,3916); `xg` [9362,9571) collapses a mark run longer than eight to
one U+FFFD, and `nD` [15431,15484) with `Ee` [15517,15549) is the admission
form of the same check.

## Port

`src/preview-sanitize.ts` now owns the shared bodies: `previewSanitized`
(`pc`), `previewRewritten` (`Ee`), `previewUnstableInput` (`nD`) and
`previewUnstableText` (the display check after tab replacement). The W74 helpers
in `interaction-tools.ts` delegate to it, so admission and display share one
copy.

`questionPreviewText` now follows the recovered string branch:

- absent input returns `undefined` (host contract);
- the 2000-code-unit cut uses the copied `ne`, so any cut returns the withheld
  text;
- the preview is sanitised through `pc`, tabs become one space;
- replacement-only text returns `undefined` (the host's own plain-text filter,
  kept from W43);
- a truncation marker or a mark run `xg` would rewrite returns the withheld
  text;
- otherwise the sanitised text is displayed.

## Adaptation

The host has no soft-wrap option, no key scrub and no structured payload branch,
so those source branches are not reachable here; the source `RS` gutter flag is
a renderer concern and is not needed by the plain-text host. CRLF now follows the
source pass: `\r` becomes U+FFFD while `\n` is kept.

## Verification

`terminal` 28/28 with one new case: BEL becomes U+FFFD instead of withholding,
a tab expands to the tab stop, ZWSP becomes U+FFFD while ZWNJ survives, CRLF
becomes U+FFFD plus newline, replacement-only text is empty, and a truncation
marker, a nine-mark run and a 2001-unit preview are withheld.
`interaction-tools` 32/32 unchanged. tsc 0; build 0; full 2,104/2,104; chain
767/767; notices 0; source index unchanged; identity `27613f94…`.
