/**
 * The `/model` picker's text and its effort axis. Every string below is recovered; the offsets are
 * zero-based UTF-16 code units into the named module.
 *
 * | Module | SHA-256 | Range | Contents |
 * | --- | --- | --- | --- |
 * | `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `Dy` 617964, `uBe` 617998 | the no-preference sentinel and the picker component |
 * | ↳ | | 620947 | `modelPicker:decreaseEffort` / `increaseEffort` / `thisSessionOnly` |
 * | ↳ | | 622189 / 622237 | the title and the caption |
 * | ↳ | | 622880 | `No models match "<q>"` |
 * | ↳ | | 623104 / 623444 | the `effort` word and `Effort not supported` |
 * | ↳ | | 624054 / 624441 | the `set as default` and `use this session only` guides |
 * | ↳ | | `KHe` 624931, `yG` 625236 | the stepper and the per-model effort record |
 * | `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` | 7848 | the `ModelPicker` context: `left`/`right` step the effort, `s` accepts session-only |
 * | `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `bWe` 1650764 | the `local-jsx` registration and its `(currently <model>)` description |
 *
 * The stepper, read from `chunk-24k7d6mw.js`:
 *
 * ```js
 * function KHe(h,T,M,L,ee){let he=M.filter((Le)=>(Le!=="max"||L)&&(Le!=="xhigh"||ee)),
 *   we=h==="max"&&!L||h==="xhigh"&&!ee?"high":h,Te=he.indexOf(we),
 *   Me=Te!==-1?Te:he.length-1;
 *   if(T==="right")return he[Math.min(Me+1,he.length-1)];else return he[Math.max(Me-1,0)]}
 * ```
 *
 * and the accept arm:
 *
 * ```js
 * let as = Er && ar !== void 0 ? Y9(ar, Er) : ar;   // ar = the adjusted value
 * let ws = ds && Er && Vb(Er) ? as : void 0;        // ds = the axis was touched
 * M(Xn, ws)
 * ```
 *
 * Four recovered branches are out. The per-model capability table behind `yG`
 * (`Vb`/`Jre`/`Bit`/`mde`/`w_r`) has no local source, so every model offers every level and
 * `Effort not supported` is unreachable. The catalogue that fills the rows (`Ypo`) is
 * account-gated, so the rows stay this host's own model set. The session-override line
 * (`Currently using X for this session only (base model: Y)`) needs a separate session-override
 * state this host keeps only as the live model. The search mode's `Type to search`,
 * `Type to filter` and `No models match` guides belong to a filter the local dialog does not
 * have: its text row is an Other answer, not a filter.
 */

import { DEFAULT_EFFORT, EFFORT_LEVELS, effortGlyph, type EffortLevel } from './effort-command.js';

/** Source `uBe` at `chunk-24k7d6mw.js` 617998: `Select model`. */
export const MODEL_PICKER_TITLE = 'Select model';

/**
 * The caption at 622237. The recovered text opens "Switch between Claude models"; this host
 * talks to a gateway with arbitrary model ids, so the vendor name is dropped and the rest is
 * verbatim.
 */
export function modelPickerCaption(): string {
  return 'Switch between models. Your pick becomes the default for new sessions. ' +
    'For other/previous model names, specify with --model.';
}

/**
 * The guide at 624054 / 624441. The recovered line is built from chord components
 * (`enter` = `set as default`, `s` = `use this session only`, `Esc` = cancel); this host draws
 * its guides as one line, so the same entries are joined in its own separator style.
 */
export function modelPickerGuide(): string {
  return 'Enter set as default / s use this session only / Esc cancel';
}

/**
 * Source `KHe` at 624931 with every level supported: one step along `EFFORT_LEVELS`, clamped at
 * both ends. The recovered folds an unsupported `max`/`xhigh` down to `high` before stepping.
 */
export function modelPickerEffortStep(current: EffortLevel, direction: 'left' | 'right'): EffortLevel {
  const index = EFFORT_LEVELS.indexOf(current);
  const at = index === -1 ? EFFORT_LEVELS.length - 1 : index;
  return direction === 'right'
    ? EFFORT_LEVELS[Math.min(at + 1, EFFORT_LEVELS.length - 1)]!
    : EFFORT_LEVELS[Math.max(at - 1, 0)]!;
}

/**
 * The footer at 623104: `glyph level effort`, with ` (default)` when the level is the one `auto`
 * resolves to. The recovered spells `xhigh` as `xHigh` in this line and leaves the rest verbatim.
 */
export function modelPickerEffortLine(level: EffortLevel, defaultLevel: EffortLevel = DEFAULT_EFFORT): string {
  const shown = level === 'xhigh' ? 'xHigh' : level;
  return `${effortGlyph(level)} ${shown} effort${level === defaultLevel ? ' (default)' : ''}`;
}

/** The row description the recovered synthesizes for the row that is already in use. */
export function modelPickerRowDescription(model: string, currentModel: string): string | undefined {
  return model === currentModel ? 'Current model' : undefined;
}

/**
 * The accept arm's `ws`: the adjusted level is passed only when the axis was touched, which is
 * the recovered `ds` flag set by `Cr` and read in `dr`.
 */
export function modelPickerEffortFor(initial: string, adjusted: string | undefined): EffortLevel | undefined {
  if (adjusted === undefined || adjusted === initial) return undefined;
  return (EFFORT_LEVELS as readonly string[]).includes(adjusted) ? adjusted as EffortLevel : undefined;
}
