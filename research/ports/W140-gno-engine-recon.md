# W140 — `gno` engine pipeline reconnaissance

C-12's next subsystem. W45-88 wired the terminal glue to an injected engine render service
(`dce.uiRender` → `che`), because the source's engine pipeline `gno` was outside that package.
This record measures `gno`'s dependency closure so the port can be sliced; no product code
changes, so the identity stays `a118ac44…`.

## Measurement method

- Parsed the recovered module (`extracted-v2/modules/chunk-n3ykh62m.js`, UTF-16 coordinates)
  with acorn 8.15 as ESM, located the top-level `gno` declaration, collected every referenced
  identifier, then walked the transitive closure of top-level function/variable declarations
  in the same module. Imports are reported as seams, never followed into other chunks.
- Locally declared names used as properties or labels were excluded; parameters and block
  locals were subtracted per function. This counts statements, not complete lexical scope.

## Measured closure

- `gno` itself: `[283212,284410)` — 1,198 units, 1 statement.
- Total closure: **204 statements, 40,767 units** in `chunk-n3ykh62m.js`.
- Imported seams (9): `P0`, `aP`, `RFe`, `aJ`, `sIt`, `ilt`, `t`, `Ioe`, `B3e`. The first five
  already have product copies or host seams (`aP`/`P0` runner and site table, `RFe` records,
  `aJ` origin); `ilt` is the engine answer unwrapper and `sIt` the static-frame gate.
- The five largest unported bodies:

| Symbol | Range | Units | Role |
| --- | --- | ---: | --- |
| `Eur` | [262627,266967) | 4,340 | tree validation: node/depth caps, control characters in text, engine node rules, props/children/ref checks, component-specific leaves |
| `lur` | [239459,241244) | 1,785 | image/row helper closure pulled by the validation or draw path |
| `M_` | [231733,232412) | 679 | drawing/measurement helper |
| `kur` | [267903,268419) | 516 | link validation and rewrite-to-Text |
| `vur` | [267454,267903) | 449 | row measurement |

- Handler cluster (each dispatches a plugin event through the already-ported `aP`):
  `zss` 422, `Wss` 217, `Bss` 162, `qss` 146, `Nss` 104, `Gss` 55.
- Draw path: `nIn` 423 (Box borderStyle moved into hover, recursively), `dno` 365,
  `jss` 157, `Pto` 109, `Pb` 415, `HD` 152, `Mf` 27, `ls` 6, `FM`/`BM` 302/124.
- Render-layer names in the closure already carried by W45-86..88 (`MF`, `SVe`, `vA`, `bVe`,
  `Lur`, `Vss`, `cce`, `s5t`, `Iye`, `sIn`, `CK`, `Ito`, `X4t`, `Oto`) are not new work; the
  copy plan will import them rather than duplicate them.

## Slice plan

1. **Draw/base slice** — `nIn`, `dno`, `kur`, `vur`, `FM`, `BM`, `HD`, `M_`, and the small
   helpers they pull. These are pure tree transforms/measurements with no plugin dispatch and
   can be validated directly against probe trees.
2. **Handler slice** — `qss`, `zss`, `Wss`, `Uss`, `Bss`, `Gss`, `Nss`, `Pto`, `jss`: the
   style/clip/draw handler dispatch over `aP`/`P0`.
3. **Validation slice** — `Eur` and its table closure (the largest, and the one that can reject
   a hook-returned tree).
4. **Pipeline wiring** — `gno` itself plus `Pb`/`Mf`/`ls` and the `chet`/`ilt`/`sIt` seams,
   installed as the default `RenderAnswerHost`; then `dce.uiRender` answers without an injected
   engine.

## Blockers and unknowns

- Slices 3–4 pull table data (`w3`, `ESe`, `AFe`, `lQt`, image/row tables) whose ranges were not
  enumerated in this pass; the next package must measure them before claiming closure.
- `aP`/`P0` dispatch already exists, but the engine's handler list construction (`Pto`) and
  trace capture (`gno`'s `trace` assignment) have no product caller yet.
- The product's independent render path (its own TUI) must keep working while the default host
  is undefined; installing `gno` changes only chain-driven renders.

## Verification

- No product change: focused 139/139 and full 2241/2241 remain the W139 baseline; identity
  `a118ac44…` unchanged. The measurement is reproducible with an acorn top-level closure walk
  over the quoted module.
