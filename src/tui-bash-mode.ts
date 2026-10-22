// The composer's bash mode: the `!` entry that turns the draft into a shell command, the pointer
// and border it paints, the footer's two labels, and the transcript rows a drained command leaves.
// Ported from the recovered interactive application; offsets are zero-based UTF-16 code units in
// the extracted module.
//
// - `chunk-k0f477m1.js` (SHA-256
//   2c89d198bcc1bc7db4efcd69212bc5fddb7c440bc1472156041b639182da01a9): `x_` 686 the mode a value
//   reads as, `sI` 727 the value without its `!`, `Jgt` 797 the bare `!` check, `J1o` 833 the
//   mode-switch detector, `BEe` 686 the inverse that puts the `!` back on a queued command.
// - `chunk-24k7d6mw.js` (SHA-256
//   1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `bZ` 84305 the entry
//   handler (the empty-composer `!` arm at 84911, its backspace unwind at 84762), `gSt` 85305 the
//   printable gate, `QE` 815713 the escape/backspace/delete/ctrl+u exit at caret 0, `uT` 815565
//   the pointer and its `Zxs` NBSP, `Rzt` 814893 the border slot, `Pzt` 815001 the agent-chip
//   width, `Sce` 754626 the `shell mode` row, `LVe` 764050 the `! for shell mode` row, the submit
//   exit 1492848, `showDrainedShellLine` 1372925 with `y4` 1368887, the `tTe` drained row's
//   `<bash-input>` wrap 1522655, and the `<bash-input>` user row wrap 1310609.
// - `chunk-w79px1ss.js` (SHA-256
//   dddc2e68d8a7ae860270520bcfe5c1aaea5e0898b88c3f6d06f2f46c89ce0f30): `processBashCommand` `V`
//   14067: the `<bash-input>` row, the shell call, the `<bash-stdout>`/`<bash-stderr>` result and
//   the `respondToBashCommands` switch.
// - `chunk-ts42ykgs.js` (SHA-256
//   d8b5f9ef6550b5e71556d694a6f054baf30aaaedd82983b1c169c3b3523eed33): `$t` 24080, the
//   `&`/`<`/`>` escaping the result row's text goes through.
// - `chunk-3yqee67r.js` (SHA-256
//   df651f4891a511f06dca4337632f3641ae3307800138064be0818eaab1e352ec): `fIe` 1148 the live
//   drained row, its `x=5`/`G=5` bounds at 1120 and `UHr` 2503 the collapse gate.
// - `chunk-phg89898.js` (SHA-256
//   b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3): `umt` 109053 the
//   `<bash-input>` transcript row, `wp` 109959 the stdout/stderr split.
// - `chunk-gsnbskq4.js` (SHA-256
//   d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee): `fwe`/`Dpe`/`lG` 8822,
//   the `bash-input`/`bash-stdout`/`bash-stderr` tag names.
// - `chunk-3cynezh1.js` (SHA-256
//   c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3): `Zxs` 3948, the
//   pointer's trailing NBSP.

/** Source `x_` (686): a value beginning with `!` reads as bash mode. */
export type ComposerMode = 'prompt' | 'bash';

/** Source `x_`. */
export function composerMode(value: string): ComposerMode {
  return value.startsWith('!') ? 'bash' : 'prompt';
}

/** Source `sI`: bash mode's value is the draft without its leading `!`. */
export function bashCommand(value: string): string {
  return composerMode(value) === 'prompt' ? value : value.slice(1);
}

/** Source `Jgt`: the bare `!` a shell command needs before its text arrives. */
export function isBareBashSigil(value: string): boolean {
  return value === '!';
}

/**
 * Source `J1o`: whether the edit that produced `nextValue` switched the mode. The switch is only
 * the caret landing at 0 on a value that now reads as bash and did not before, and only when the
 * value grew by one character or the previous value was empty — typing `!` into an empty composer,
 * or prepending it to a draft whose caret sat at the start.
 */
export function switchedToBash(input: { nextValue: string; value: string; cursorOffset: number; mode: ComposerMode }): boolean {
  const next = composerMode(input.nextValue);
  if (input.cursorOffset !== 0 || next === 'prompt' || next === input.mode) return false;
  return input.nextValue.length === input.value.length + 1 || input.value.length === 0;
}

/** Source `BEe`: a queued command keeps the `!` its mode needs when it returns to the draft. */
export function composerValue(text: string, mode: ComposerMode): string {
  return mode === 'bash' ? `!${text}` : text;
}

/** Source `Zxs` (chunk-3cynezh1.js 3948). */
const NBSP = '\xA0';

/**
 * Source `uT` (815565): the pointer a composer row leads with. Bash mode paints `!`; an agent chip
 * takes its place with a clipped label; otherwise the session pointer is followed by an NBSP.
 * `maxWidth` is `Pzt`'s 24-cell clip for the agent label.
 */
export function composerPointer(mode: ComposerMode, pointer: string, agentText?: string, maxWidth = 24): string {
  if (mode === 'bash') return `!${NBSP}`;
  if (agentText !== undefined) return clip(agentText, Math.max(1, Math.min(24, maxWidth - 1))) + NBSP;
  return `${pointer}${NBSP}`;
}

function clip(text: string, width: number): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > width ? flat.slice(0, width) : flat;
}

/** Source `Rzt` (814893): the composer border slot, which bash mode owns. */
export function composerBorderSlot(mode: ComposerMode, fallback = 'promptBorder'): string {
  return mode === 'bash' ? 'bashBorder' : fallback;
}

/** Source `Sce` 754626: the footer row's bash label, dim and italic. */
export const SHELL_MODE_LABEL = 'shell mode';
/** Source `LVe` 764050: the hint's bash label, painted in `bashBorder`. */
export const SHELL_MODE_HINT = '! for shell mode';

/** Source `fwe`/`Dpe`/`lG` (chunk-gsnbskq4.js 8822). */
export const BASH_INPUT_TAG = 'bash-input';
export const BASH_STDOUT_TAG = 'bash-stdout';
export const BASH_STDERR_TAG = 'bash-stderr';

/**
 * Source `cG` (chunk-gsnbskq4.js 8947) and `tye()` (chunk-sfn1dbxq.js 4382813): the meta row a
 * command carries when the model is not asked about it. The recovered sentence names its own
 * product; this build substitutes its own name and keeps the sentence.
 */
export const BASH_CAVEAT_TAG = 'local-command-caveat';
export const BASH_CAVEAT = `<${BASH_CAVEAT_TAG}>The command below was run directly in LiTcode, not sent to you as a request, and its output goes straight to the user. It's recorded here as context for later messages.</${BASH_CAVEAT_TAG}>`;

/** Source 1310609: bash mode's user row is the command wrapped in its tag. */
export function bashInputText(command: string): string {
  return `<${BASH_INPUT_TAG}>${command}</${BASH_INPUT_TAG}>`;
}

/** Source `umt` (chunk-phg89898.js 3225): the transcript row's leading `! ` in `bashBorder`. */
export function bashPointerMark(): string {
  return '! ';
}

/** Source `$t` (chunk-ts42ykgs.js 24080): the result row's text escapes only these three. */
export function escapeBashText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Source `processBashCommand` 14067 and 1492848: the rows a drained command leaves behind. The
 * first block is the `<bash-input>` row, which this host renders from the tag rather than sending
 * the tag to the model; the second carries both result tags, with an empty stderr tag when the
 * command wrote nothing there.
 */
export function bashResultText(stdout: string, stderr: string): string {
  return `<${BASH_STDOUT_TAG}>${escapeBashText(stdout)}</${BASH_STDOUT_TAG}>`
    + `<${BASH_STDERR_TAG}>${escapeBashText(stderr)}</${BASH_STDERR_TAG}>`;
}

/** Source `wp` (chunk-phg89898.js 109959): split a result row back into its two streams. */
export function readBashResult(text: string): { stdout: string; stderr: string } {
  const between = (tag: string): string => {
    const open = `<${tag}>`, close = `</${tag}>`;
    const start = text.indexOf(open), end = text.indexOf(close);
    return start < 0 || end < start ? '' : text.slice(start + open.length, end);
  };
  return { stdout: between(BASH_STDOUT_TAG), stderr: between(BASH_STDERR_TAG) };
}

/** Source `Mle`/`fwe`: the command a `<bash-input>` row carries, or null for any other text. */
export function readBashInput(text: string): string | null {
  const open = `<${BASH_INPUT_TAG}>`, close = `</${BASH_INPUT_TAG}>`;
  const trimmed = text.trim();
  return trimmed.length >= open.length + close.length && trimmed.startsWith(open) && trimmed.endsWith(close)
    ? trimmed.slice(open.length, trimmed.length - close.length) : null;
}

/**
 * Source `y4` (1368887) and `showDrainedShellLine` (1372925): the live row's fixed tool id, so a
 * second drained command replaces the first one's row instead of stacking another.
 */
export const DRAINED_SHELL_LINE_ID = 'drained-shell-line';

/** Source `fIe`'s `x=5` and `G=5` (chunk-3yqee67r.js 1120): the row keeps five trailing lines. */
export const BASH_PROGRESS_LINES = 5;
export const BASH_PROGRESS_GUTTER = 5;

/**
 * Source `v` in chunk-3yqee67r.js (2610): the live row shows the tail of the output, clipped to
 * `BASH_PROGRESS_LINES` rows, and reports whether it had to drop anything.
 */
export function drainedShellTail(output: string, columns: number): { text: string; clipped: boolean; dropped: number } {
  const width = Math.max(1, columns - BASH_PROGRESS_GUTTER);
  const lines = output.replace(/\r\n?/g, '\n').split('\n').filter(line => line.length > 0);
  const kept: string[] = [];
  let used = 0;
  let index = lines.length;
  while (index > 0 && used < BASH_PROGRESS_LINES) {
    const wrapped = wrapHard(lines[--index]!, width);
    const room = BASH_PROGRESS_LINES - used;
    if (wrapped.length > room) {
      kept.unshift(wrapped.slice(-room).join('').replace(/^ /, ''));
      return { text: kept.join('\n'), clipped: true, dropped: index };
    }
    kept.unshift(lines[index]!);
    used += wrapped.length;
  }
  return { text: kept.join('\n'), clipped: index > 0, dropped: index };
}

function wrapHard(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const rows: string[] = [];
  for (let at = 0; at < text.length; at += width) rows.push(text.slice(at, at + width));
  return rows;
}

/** Source `UHr` (2503): the live row shows its output while the tail is not clipped away. */
export function drainedShellLineVisible(output: string, fullOutput: string, columns: number, totalLines?: number): boolean {
  if (!fullOutput.trim()) return false;
  return (totalLines ?? 0) > BASH_PROGRESS_LINES || drainedShellTail(output, columns).clipped;
}
