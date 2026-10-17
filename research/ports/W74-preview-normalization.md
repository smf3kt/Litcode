# W74 — preview normalization

## Source position

`chunk-qq2mgstr.js`, UTF-16 code units:

| Symbol | Range | Contents |
| --- | --- | --- |
| `ln` | [8080,8178) | default-ignorable code points (8204..8207, 1564, 65024..65039, 6155..6159, 10240) |
| `L` | [8178,8299) | per-character control/format test (`on`, U+2028/29, U+2800, surrogates, U+10FFEE, `an`) |
| `cn` | [8375,8414) | `L(e,n) && !ln(n)`: a character is replaced only when `L` holds and it is not default-ignorable |
| `Ce` | [8414,8503) | `for (let r of e) i += n(r, r.codePointAt(0) ?? 0) ? "\uFFFD" : r`; iterates code points |
| `pc` | [8706,8741) | `Zs(Ce(e, cn))` |
| `nD` | [15431,15484) | `n = pc(e); return rPe.test(n) || Ee(n)` |
| `Ee` | [15517,15549) | `xg(e) !== e` |
| `Gat` | [16278,16350) | `ZSo(pc(e))`; `ZSo` is identity, so `Gat = pc` |

`pe` (chunk-ktr9sak2.js [4720,4845)) admits a preview when it was shown
exactly (`e.previews.has(t)`), or, for any shown preview `n`:
`n.length <= ie && Gat(n) === t && !nD(n)`, with `ie = 2000` (offset 2056).
`rPe` is the truncation marker pattern `/\u2026 \[\+\d+ graphemes\]/`.

## Port

`admitCardAnswer`'s annotation preview check now uses
`cardPreviewAdmitted(previews, preview)`:

- an exact shown preview is admitted as before (first `pe` arm);
- otherwise a shown preview of at most 2000 UTF-16 units is admitted when its
  normalized form (`Zs(Ce(value, cn))`) equals the claimed preview and the shown
  preview is stable under `nD` (no truncation marker, no `xg` rewrite).

`ln`, `cn` and `Ce` are ported verbatim; `Zs`, `xg` and `rPe` are the copies
already exported by `src/plugin-chain-normalize-source.ts` and
`src/plugin-chain-label-text-source.ts`. `ZSo` is identity in this chunk, so
`Gat` collapses to `pc`.

## Verification

`interaction-tools` 31/31 with one new case: a control character in a shown
preview can be claimed in its normalized U+FFFD form or verbatim; a shown
preview carrying the truncation marker is refused even when normalized; a shown
preview over 2000 units is refused. tsc 0; build 0; full 2,102/2,102; chain
767/767; notices 0; source index unchanged; identity `a96ee3cd…`.
