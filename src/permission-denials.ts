/**
 * The auto-mode denials the `/permissions` `recent` tab lists. Recovered from `chunk-frj2b06g.js`,
 * sha256 `1f4f2bc8200dcb30a20f5dfea1c04546696e503b3adf71412ec65c98a119f00e`, offset 2696: the
 * provider `pEe`'s value, `getDenials`/`recordDenial`/`removeDenial` over an in-memory list capped
 * at `$e` = 20, newest first, with removal by record identity.
 *
 * The record is written at the classifier's refusal in `chunk-24k7d6mw.js` offset 1506012:
 * `{toolName, display, inputKey, reason, timestamp}`. `display` is the tool's own description of the
 * call (`await tool.description(input, …)`), `inputKey` is `B4`'s canonical input
 * (`JSON.stringify({command: input.command})` for the shell tools `p_` = `["Bash","PowerShell"]`,
 * `JSON.stringify(input)` otherwise), and `reason` is `decisionReason.reason` — written only when
 * the verdict is the auto-mode classifier's own deny (`classifier === "auto-mode"` and not
 * `noVerdict`). The recovered `timestamp` feeds the `tengu_auto_mode_subsequent_approval` telemetry
 * only, so it is not carried here.
 *
 * The text helpers are `Ci` (`chunk-qq2mgstr.js` 15827), `Bi` at 12567, `PJt` at 8861 and the label
 * limit `N6` = 2000 at 8806. `Ets` (the appended grant) is `chunk-sfn1dbxq.js` 4502383. Offsets are
 * zero-based UTF-16 code units.
 */

import type { ToolDefinition } from './tools.js';

export interface AutoModeDenial {
  /** `vUt`'s tool name; the recovered maps its agent tool to a public name, which this build's
   *  registry already carries. */
  readonly toolName: string;
  /** `display`: the tool's own one-line description of the call. */
  readonly display: string;
  /** `inputKey`: the canonical input, so a re-issued identical call can be matched. */
  readonly inputKey: string;
  /** The classifier's reason for the refusal, or an empty string when it gave none. */
  readonly reason: string;
}

/** Source `$e` at 2706. */
export const AUTO_MODE_DENIAL_LIMIT = 20;

/** Source `p_` (`chunk-hwpb27as.js` 3558) resolved through `chunk-r2vtj1kh.js` 663061/663075. */
const SHELL_DENIAL_TOOLS: readonly string[] = ['run_command'];

/**
 * Source `B4` at 1504867: the shell tools key on the command alone, every other tool on its whole
 * input.
 */
export function autoModeDenialInputKey(toolName: string, input: unknown): string {
  try {
    if (SHELL_DENIAL_TOOLS.includes(toolName) && typeof input === 'object' && input !== null) {
      const command = Object.getOwnPropertyDescriptor(input, 'command')?.value;
      if (typeof command === 'string') return JSON.stringify({ command });
    }
    return JSON.stringify(input) ?? String(input);
  } catch { return String(input); }
}

/** Source `N6` at 8806; the same limit the rule labels use. */
export const DENIAL_LABEL_LIMIT = 2000;

/** The U+FFFD the display substitutes. */
const REPLACEMENT = String.fromCharCode(0xfffd);

/**
 * Source `Bi`'s display sanitize: C0 and C1 controls, the Arabic letter mark, the bidi embeddings
 * and overrides, the bidi isolates, private use and unassigned code points. The line and paragraph
 * separators are `Ci`'s own set, kept apart because that function replaces them with U+FFFD before
 * the whitespace fold while `Bi` keeps them for the fold to collapse.
 */
const DENIAL_CONTROLS: readonly (readonly [number, number])[] = [
  [0x00, 0x1f], [0x7f, 0x9f], [0x061c, 0x061c], [0x202a, 0x202e], [0x2066, 0x2069],
];
const DENIAL_LINE_BREAKS = new RegExp(`[${String.fromCharCode(10, 13, 0x2028, 0x2029)}]`, 'g');
const DENIAL_REPLACED = new RegExp(
  `[${DENIAL_CONTROLS.map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join('')}`
  + `\\p{Co}\\p{Cn}]`, 'gu');

export function denialDisplayText(value: string): string {
  return value.replace(DENIAL_LINE_BREAKS, REPLACEMENT).replace(DENIAL_REPLACED, REPLACEMENT).normalize('NFC');
}

/**
 * Source `display`: `await tool.description(input, …)`. This build's tools have no separate
 * human-facing description, so the ported counterpart is the tool's own classifier input — the same
 * value `serializeAutoTool` reads — rendered as text, then `PJt`'s cut and `pc`'s normalization.
 */
export function autoModeDenialDisplay(tool: ToolDefinition, input: unknown): string {
  let converted: unknown;
  try { converted = tool.toAutoClassifierInput?.(input) ?? JSON.stringify(input); }
  catch { converted = JSON.stringify(input); }
  const text = typeof converted === 'string' ? converted : JSON.stringify(converted) ?? String(converted);
  return denialDisplayText(text.slice(0, DENIAL_LABEL_LIMIT));
}

/**
 * Source `sc` at 30120: the row's description — `Ci` over `Bi`'s text, then the whitespace fold and
 * trim, absent when the classifier gave no reason.
 */
export function denialReasonText(reason: string): string | undefined {
  if (!reason) return undefined;
  const collapsed = denialDisplayText(reason).replace(/\s+/g, ' ').trim();
  return collapsed.length === 0 ? undefined : collapsed.slice(0, DENIAL_LABEL_LIMIT);
}

/**
 * Source `pEe`'s provider value. The recovered holds it in an `AppStateProvider`-mounted context;
 * here it lives on the session, which outlives the dialog the same way.
 */
export class AutoModeDenialStore {
  private items: readonly AutoModeDenial[] = [];

  get denials(): readonly AutoModeDenial[] { return this.items; }

  /** Source `recordDenial`: newest first, cut to the limit. */
  record(denial: AutoModeDenial): void {
    this.items = [denial, ...this.items.slice(0, AUTO_MODE_DENIAL_LIMIT - 1)];
  }

  /** Source `removeDenial`: by record identity, so two identical denials stay distinct. */
  remove(denial: AutoModeDenial): void {
    this.items = this.items.filter(entry => entry !== denial);
  }
}

/**
 * Source `Ets` (`chunk-sfn1dbxq.js` 4502383), appended by `gR` at 91624 through
 * `applyMessageOp({type: "append", messages: [Ets(labels)]})`. The source record is a `system`
 * message; this build's conversation carries `Anthropic.MessageParam`s, and the classifier reads a
 * human-origin message as `{user: …}` while every other origin becomes non-user content — so the
 * grant is appended as a user message marked human.
 */
export function permissionRetryMessage(labels: readonly string[]): string {
  return `Allowed ${labels.join(', ')}`;
}
