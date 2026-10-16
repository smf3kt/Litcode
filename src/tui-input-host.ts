import { cellWidth } from './terminal.js';
import { wrapMessageText } from './tui-wrap.js';
export { twe } from './tui-ansi-tokenizer.js';

export const ae = cellWidth;
export const Nu = wrapMessageText;
let degradedWraps = 0;

/** Source ur reports telemetry once; the owned host exposes only a count. */
export function ur(): void { degradedWraps++; }
export function inputWrapDiagnostics(): number { return degradedWraps; }
