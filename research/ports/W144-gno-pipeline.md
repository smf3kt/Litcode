# W144 — `ui.render` engine pipeline (`gno` slice 4, final)

Date: 2026-10-18. Package: W144-01. Area: C-12. Status: accepted.

## Question

What does `gno` do end to end, what closure does the final slice need beyond the three
landed slices, and can the pipeline run unchanged in the product as its `RenderAnswerHost`?

## Source

`gno` is `async function gno({input,signal,origin})` at chunk-n3ykh62m.js
[283212,284410), 1,198 UTF-16 units, module digest `2a0e605d…`. It reads 46 top-level
declarations; 16 of them are copied in this package (3,392 units), the rest are imports
from seams landed by earlier packages.

The site `gno` dispatches against is `zd["ui.render"]`, which the source's literal table
holds (chunk-nyce03br.js, digest `6a5164eb…`). The descriptor `ga` and the copier `ilt`
it restores with were not ported yet (`ilt` only lived inside the W144 probe). They are
copied here as a second generated module: 30 blocks, 4,796 units, including
`ilt` [7275,7339), `ga` [93643,93988), the envelope check `rn`/`on`, the component prop
table `tn` and its validators (`Sn`, `vn`, `en`/`Tn`/`bn`/`hn`/`nn`/`gn`/`xn`/`kn`/`En`/`yn`),
the prop-cost helpers `bo`/`Wbr`/`Ft` and the pattern constants `Gbr`/`Vbr`/`zbr`.

## Port

- `src/plugin-chain-engine-pipeline-source.ts` (16 blocks, 3,392 units; plan
  `research/ports/W144-gno-pipeline.plan.json`): `gno`, `Pto`, `AAt`, `HD`, `Mf`, `Ito`,
  `Pb`, `jss`, `M_`, `ki`, `I_`, `Ai`, `Yf`, `Gf`, `Xf`, `uno`.
- `src/plugin-chain-engine-render-site-source.ts` (30 blocks, 4,796 units; plan
  `research/ports/W144-engine-render-site.plan.json`): `ga`, `ilt`, `vn`, `Sn`, `So`, `on`
  and their closure.
- `src/plugin-chain-engine-pipeline.ts` — the typed seam and the engine render host.
- `src/plugin-chain-engine-render-site.ts` — registers `ui.render` and exports the site.

Reuse over copy: `ls` (the dispatch async store) and `tIt` come from
`plugin-chain-host-call-source.js`, which already holds the same nyce/n3 copies; copying
`ls` again would create a second `AsyncLocalStorage` and split the dispatch context.
`ilt` lives once, in the site module, mirroring the source module split (both are nyce).
`er` and `b3` were already exported by `plugin-chain-source.ts`; no extension was needed.

The source's `zd` is a literal, so `ui.render` exists before `gno` is evaluated. The
product's `zd` is a live registry populated "as sites land" (plugin-chain-host.ts). The
generated pipeline imports `./plugin-chain-engine-render-site.js` first, so registration
runs before its body binds `Ito`; the binding itself is the copied line
`var Ito=zd["ui.render"]`. The seam installs `gno` as `RenderAnswerHost` on evaluation —
the product equivalent of the source engine always answering through `gno`.

Seam defaults: a missing `signal` becomes `new AbortController().signal` because `gno`
dereferences it when `requestId !== ""`; `origin` is passed through (the source's `aJ`
maps `undefined` to the engine origin `CFe`). No copied body changed.

## Semantics

1. Raise a record (`RFe`), wrap the drawing function as the `core` handler (`Pto`) and
   dispatch `input` through `aP` with the hook records (`P0`), the `ui.render` site and
   `ls`. The core keeps `zss(answer, input, {cut, own})` and answers `{type:'engine',ref}`.
2. When `requestId !== ""` and the signal is live, flush version reads: detach readers
   (`Ai`), keep at most `Xf` (4000) readers dropping unmounted instances (`Yf`), and
   notify on a changed version (`Ci`).
3. Copy the answer (`ilt`), validate it (`Eur`); the dialog component (`B3e` —
   `AskUserQuestion`) also reports client rows (`AAt.clientRows`) and measured own rows.
   A problem logs the sentence, records the refusal (`jss`) and returns the engine
   sentinel `Ioe`.
4. Draw passes: border-style/key transforms (`nIn`/`dno`), link validation (`kur`),
   code-row/cut measurement (`vur`/`Nss`), press relabelling (`FM`), then the descriptor
   and trace tables (`bVe`, `Lur`). The drawn tree is returned.

`M_` (the row ledger) keeps 64 request entries (`I_`), reports freed rows when own or
client rows shrink, and closes at `kFe` (12) counting own + every other client's rows.

## Verification

- Focused: 34/34 (`pipeline` 8, `validate` 12, `budget` 10, `draw` 6, scan 2).
- Full: 2273/2273.
- tsc 0, build 0, notices 0.
- Identity: `e6ede94cf49084a3d4505b780b61801701edeecf8dde3a0a3d4b74c35d2e7486`.
- End-to-end probe: `runEnginePipeline({component:'Probe',requestId:'',surface:'terminal',props:{}})`
  draws `{type:'engine',ref:1}` and `descriptorInput(drawn, 1)` returns the same input.

## Follow-ups

C-12's `gno` slices are complete. The remaining C-area items are C-2 (diff/attachment/
footer/above-prompt panes), C-5 local remainders, C-6 remaining consumers, C-7/C-9 external,
C-11 renderer differences.
