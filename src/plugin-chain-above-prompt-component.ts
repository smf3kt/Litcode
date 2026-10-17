// The AbovePrompt component (W156). `NFe` is the prompt pane above the input: it measures the
// remaining window, hosts the pane scroll site (`RFe`) and its wheel handler (`_Fe`), draws the
// focusable tree the runner committed, and routes the three contexts' handlers
// (`AbovePrompt`/`AbovePromptInput`/`AbovePromptSelect`), the toggle/focus key actions and the digit
// confirmation hook.
//
// The copied body lives in ./plugin-chain-above-prompt-component-source.ts:
// chunk-24k7d6mw.js `NFe` [456049,461905) 5,856 units, zero-based UTF-16 half-open. Every name the
// body reads comes from an existing seam or exact copy: the hook surface, the W145/W146 AbovePrompt
// copies, W148 seats, W149 select keys, W150 key handlers, W152 local state, W153 focus ring,
// W154 registry, W155 host glue, W157c/d wheel and pane scroll, the input/select/button/terminal
// copies, the client and hover hosts, and the notify-fold pane store. The W151 reconnaissance
// recorded why one flat closure file cannot be built: short module-level names collide across the
// ten source modules.
//
// The two contexts the body reads are mounted values: `QY` (the pane measurement getter) and `Zm`
// (the terminal size, read by `ke` inside ./plugin-chain-input-field-source.ts). A renderer mounts
// both; the body throws without the terminal size, as the source's `ke` does.
import { NFe } from './plugin-chain-above-prompt-component-source.js';

/** The AbovePrompt props the source destructures. */
export interface AbovePromptProps {
  survey?: boolean;
  working?: boolean;
  setInputValue(value: string): void;
  onHoldsBandChange?(holds: boolean): void;
}

/** Source `NFe`: the AbovePrompt component. Render it inside the product's component runner with
 *  the pane-measure and terminal-size contexts mounted. */
export function AbovePrompt(props: AbovePromptProps): unknown {
  return NFe(props as Parameters<typeof NFe>[0]);
}

/** The copied body under its source name, for a record or a test that compares the ported component
 *  with the source's own. */
export const SOURCE_BODIES = { NFe };
