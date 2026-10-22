# W281 model picker ultracode suffix

The model picker's effort line now names the session ultracode flag. While the flag is on and the
session's workflow gate agrees, the line ends with ` · Ultracode on (/effort)`; otherwise it keeps
the W232 text. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | 623257 | `gr&&VC(Nn,gr)?" \xB7 Ultracode on (/effort)":""` on the effort line |
| ↳ | | 619077 | `Nn=V((Xn)=>Xn.ultracode)`, the session flag the gate reads |
| `chunk-9vcaezw1.js` | `eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0` | 5771 | `ZI(e)`: `dg() && (e === undefined \|\| ve(e))` |
| ↳ | | 5819 | `VC(e,n)`: `e === true && ZI(n)` |
| ↳ | | 4151 | `fde()`: the `max`-effort reminder flag, unrelated but read beside it |

## Behaviour

- **The gate.** `VC(Nn, gr)` needs the session flag `true`, `dg()` (dynamic workflows enabled) and
  the model's own `xhigh` support through `ve`/`Bit`. The suffix is appended inside the effort
  line's text run, after the level, the `(default)` mark and the `Left/Right adjust` chord, so it
  shares that row's dim styling.
- **Where it does not appear.** `Effort not supported` replaces the whole line when `Dr` is false,
  and the line itself is only drawn while a row is focused and enabled, so the suffix never
  outlives the effort line.

## Host adaptations

- **The per-model half of the gate is absent.** This host has no capability table (W212), so every
  model offers every level and `ve`/`Bit` are constant true. The gate therefore reduces to the
  session flag plus `features.workflow`, which is the same pair `effortCommand` already reads for
  `ultracode on`.
- **The flag is the live session value.** `modelPickerRequest` gained two optional trailing
  parameters, and all three call sites (`openModelPickerLive`, the piped `/model` arm, the config
  panel's model row) pass `session.config.ultracode === true` and
  `session.config.features?.workflow !== false`. The picker owner reads them once at construction,
  which matches the source's `V` selector because the flag cannot change while the modal is open.
- **Not ported.** The `max`-effort reminder arm beside it (`fde()` and `V$`) is W212's existing
  `MAX_EFFORT_NOTE`, unchanged here.

## Correction to W232

W232 recorded the session-override line and the synthetic `Current model` / `Base model` rows as
unported for want of a base-model concept. Reading the producer again, the picker's own accept path
(`w9`, `chunk-24k7d6mw.js` 894465) writes `mainLoopModel: lC` and **clears**
`mainLoopModelForSession`, so the picker can never leave an override behind. The override is
written by the per-request `model` field instead (`applyModel`, `chunk-rx2nah4x.js` 501705, and
`chunk-24k7d6mw.js` 632917/1457121), a request-shaped surface this host has no counterpart for.
The two rows and the line therefore stay out for a stronger reason than W232 gave, and the note in
`src/model-picker.ts` now says so.

## Validation

Unit: `test/model-picker.test.ts` 6/6, including the new gate and footer group. Focused
`test/tui-model-picker.test.ts` and `test/config-panel.test.ts` 5/5. `npx tsc --noEmit` clean,
`npm run build` clean. Full suite 3199/3200 with the known `cli-migration` effort failure only.
Compiled 10/10 at identity `86ca6473…`: the picker opens without a suffix, `/effort ultracode on`
puts ` · Ultracode on (/effort)` on the effort line and keeps it across a level step,
`/effort ultracode off` removes it, and the picker sends no provider request of its own.
