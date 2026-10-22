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
 * | ↳ | | 623104 / 623257 / 623444 | the `effort` word, its ` · Ultracode on (/effort)` suffix and `Effort not supported` |
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
 * state this host keeps only as the live model. Gse [616800,617486) gates search with
 * canEnter=false in uBe, so the search paths remain closed in this sample.
 */

import { DEFAULT_EFFORT, EFFORT_LEVELS, MAX_EFFORT_NOTE, configuredEffort, effortGlyph, type EffortLevel, type ModelSettings } from './effort-command.js';
import type { TerminalPromptAnswer, TerminalPromptChoice, TerminalPromptRequest } from './terminal.js';
import { cellWidth } from './terminal.js';
import { clipEnd } from './tui-autocomplete.js';
import { s, n } from './tui-base-components.js';
import { jsx } from './tui-jsx.js';
import { te } from './tui-symbols.js';
import { formatActionHint } from './diff-dialog-chrome.js';
import { Z0, ay, Ne } from './model-picker-effort-source.js';

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
export function modelPickerGuide(setDefault = true): string {
  return setDefault ? 'Enter set as default / s use this session only / Esc cancel' : 'Enter confirm / Esc cancel';
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
 * The suffix at `chunk-24k7d6mw.js` 623257, `gr&&VC(Nn,gr)?" · Ultracode on (/effort)":""`.
 * `VC`/`ZI` (`chunk-9vcaezw1.js` 5819/5771) are the session flag AND the workflow gate AND the
 * model's `xhigh` support; this host has no per-model effort table (W212), so every model
 * supports every level and the gate is the session's own workflow feature flag.
 */
export function modelPickerUltracodeSuffix(ultracode: boolean, workflowsEnabled = true): string {
  return ultracode && workflowsEnabled ? ' · Ultracode on (/effort)' : '';
}

type PickerEffort = { kind: 'implicit'; value: EffortLevel } | { kind: 'adjusted'; value: EffortLevel };

export interface ModelPickerInput {
  current: string;
  effort?: EffortLevel;
  defaults?: { modelSettings: ModelSettings; fallback?: EffortLevel };
  setDefault?: boolean;
  /** `Nn` in `uBe`: the session ultracode flag. */
  ultracode?: boolean;
  /** `dg()` behind `ZI`: the session's dynamic-workflow feature flag. */
  workflowsEnabled?: boolean;
}

/** uBe, 24k7d6mw [617998,624627), UTF-16; source closure and host differences in W232. */
export function modelPickerRequest(models: readonly string[], current: string, effort?: EffortLevel, setDefault = true,
  defaults?: ModelPickerInput['defaults'], ultracode?: ModelPickerInput['ultracode'],
  workflowsEnabled?: boolean): TerminalPromptRequest {
  return { title: MODEL_PICKER_TITLE, message: modelPickerCaption(),
    choices: models.map(model => ({ label: model, value: model, description: modelPickerRowDescription(model, current) })),
    modelPicker: { current, setDefault, ...(effort === undefined ? {} : { effort }), ...(defaults === undefined ? {} : { defaults }),
      ...(ultracode === true ? { ultracode } : {}), ...(workflowsEnabled === false ? { workflowsEnabled } : {}) } };
}

/** uBe ys/Cr/dr plus W3n/lc, yygmb66g [34632,40138), UTF-16. */
export class ModelPicker {
  private index: number;
  private start = 0;
  private count = 1;
  private effortState: PickerEffort;

  constructor(readonly options: readonly TerminalPromptChoice[], private readonly input: ModelPickerInput) {
    this.index = Math.max(0, options.findIndex(option => option.value === input.current));
    this.effortState = { kind: 'implicit', value: this.implicitEffort(input.current) };
  }

  get focusIndex(): number { return this.index; }
  get focused(): TerminalPromptChoice | undefined { return this.options[this.index]; }
  get effort(): EffortLevel { return this.effortState.value; }

  /** ys/uc, 24k7d6mw [620537,620695), 9vcaezw1 [12346,12719), UTF-16. */
  private implicitEffort(model: string): EffortLevel {
    return this.input.defaults === undefined ? this.input.effort ?? DEFAULT_EFFORT
      : configuredEffort({ modelSettings: this.input.defaults.modelSettings, effort: this.input.defaults.fallback }, model) ?? DEFAULT_EFFORT;
  }

  /** tl/lc, yygmb66g [34632,38135), UTF-16: keep the focused row within the window. */
  fit(visibleCount: number): void {
    this.count = Math.min(this.options.length, Math.max(1, visibleCount));
    this.start = Math.min(this.start, Math.max(0, this.options.length - this.count));
    if (this.index < this.start) this.start = this.index;
    else if (this.index >= this.start + this.count) this.start = Math.max(0, this.index - this.count + 1);
  }

  focus(index: number): void {
    if (!this.options[index]) return;
    this.index = index;
    if (this.effortState.kind === 'implicit')
      this.effortState = { kind: 'implicit', value: this.implicitEffort(this.options[index]!.value) };
    this.fit(this.count);
  }

  move(delta: -1 | 1): void {
    if (!this.options.length) return;
    const index = (this.index + delta + this.options.length) % this.options.length;
    if (delta === 1 && index === 0) this.start = 0;
    else if (delta === -1 && this.index === 0) this.start = Math.max(0, this.options.length - this.count);
    else if (delta === -1 && index <= this.start) this.start = Math.max(0, this.start - 1);
    this.focus(index);
  }

  page(delta: -1 | 1): void {
    const index = Math.max(0, Math.min(this.options.length - 1, this.index + delta * this.count));
    this.start = delta === 1 ? Math.max(0, index + 1 - this.count) : index;
    this.focus(index);
  }

  scroll(delta: -1 | 1): void {
    const start = Math.max(0, Math.min(this.options.length - this.count, this.start + delta));
    if (start === this.start) return;
    this.start = start;
    this.focus(Math.max(start, Math.min(start + this.count - 1, this.index)));
  }

  adjust(direction: 'left' | 'right'): void {
    if (this.focused) this.effortState = { kind: 'adjusted', value: modelPickerEffortStep(this.effort, direction) };
  }

  accept(sessionOnly = false, index = this.index): TerminalPromptAnswer | undefined {
    if (sessionOnly && this.input.setDefault === false) return;
    this.focus(index);
    const row = this.focused;
    return row === undefined ? undefined : { selected: [row.value],
      ...(this.effortState.kind === 'adjusted' ? { adjusted: this.effort } : {}),
      ...(sessionOnly ? { key: 's' } : {}) };
  }

  /** Yi compact column path, yygmb66g [41667,54367), UTF-16, with plain local model labels. */
  render(columns: number, visibleCount: number): { rows: unknown[]; indices: number[] } {
    this.fit(visibleCount);
    const numberWidth = String(this.options.length).length;
    const prefixWidth = numberWidth + 2;
    const measured = Math.max(0, ...this.options.map(row =>
      2 + prefixWidth + cellWidth(row.label) + (row.value === this.input.current ? 2 : 0)));
    const labelColumn = Math.min(measured, Math.floor(columns * 0.6));
    const indices: number[] = [];
    const rows = this.options.slice(this.start, this.start + this.count).map((row, offset) => {
      const index = this.start + offset;
      indices.push(index);
      const selected = row.value === this.input.current;
      const focused = index === this.index;
      const color = selected ? 'success' : focused ? 'suggestion' : undefined;
      const label = clipEnd(row.label, Math.max(1, labelColumn - 2 - prefixWidth - (selected ? 2 : 0)));
      const used = 2 + prefixWidth + cellWidth(label) + (selected ? 2 : 0);
      const marker = focused ? te.pointer : offset === this.count - 1 && this.start + this.count < this.options.length
        ? te.arrowDown : offset === 0 && this.start > 0 ? te.arrowUp : ' ';
      return jsx(s, { flexDirection: 'row', children: [
        jsx(n, { color: focused ? 'suggestion' : undefined, dimColor: !focused, children: marker }, 'pointer'),
        jsx(s, { flexDirection: 'row', flexShrink: 0, children: [
          jsx(n, { children: ' ' }, undefined),
          jsx(n, { color, children: [jsx(n, { dimColor: true,
            children: `${index + 1}.`.padEnd(prefixWidth) }, undefined), label] }, undefined),
          selected ? jsx(n, { color: 'success', children: ` ${te.tick}` }, 'selected') : null,
          used < labelColumn ? jsx(n, { children: ' '.repeat(labelColumn - used) }, 'padding') : null,
        ] }, 'label'),
        jsx(s, { flexGrow: 1, marginLeft: 2, children: jsx(n, { color, dimColor: true,
          children: row.description || ' ' }, undefined) }, 'description'),
      ] }, row.value);
    });
    const hidden = this.options.length - this.start - this.count;
    if (this.count < this.options.length) {
      rows.push(jsx(n, { dimColor: true,
        children: hidden > 0 ? `   … +${hidden} model${hidden === 1 ? '' : 's'}` : '' }, 'hidden'));
      indices.push(-1);
    }
    return { rows, indices };
  }

  /** uBe, 24k7d6mw [622928,623491), UTF-16; local fde fallback and copied dependencies in W292. */
  footer(): unknown[] {
    if (this.focused === undefined) return [];
    const level = this.effort;
    const suffix = modelPickerUltracodeSuffix(this.input.ultracode === true, this.input.workflowsEnabled !== false);
    const warning = Ne(process.env.LITCODE_MAX_EFFORT_REMINDER);
    return [jsx(n, { dimColor: true, children: [
      jsx(Z0, { effort: level }, 'glyph'), ' ', level === 'xhigh' ? 'xHigh' : level, ' effort',
      level === DEFAULT_EFFORT ? ' (default)' : '',
      jsx(n, { color: 'subtle', children: [' ', formatActionHint({ chord: ['left', 'right'], action: 'adjust' })] }, 'adjust'),
      suffix,
    ] }, 'effort'), ...(level === 'max' ? [jsx(n, { color: warning ? 'warning' : 'subtle',
      children: warning ? [ay, ' ', MAX_EFFORT_NOTE] : MAX_EFFORT_NOTE }, 'max-note')] : [])];
  }
}
