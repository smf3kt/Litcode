/** Adapted from dd/Wo/jy in the recovered Ink input reader; provenance is kept in research. */
export interface TerminalMouseEvent {
  type: 'mouse';
  button: number;
  action: 'press' | 'release' | 'move' | 'wheelup' | 'wheeldown';
  /** One-based terminal report coordinates, checked against the transcript region. */
  col: number;
  row: number;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export const MAX_MOUSE_REPORT_CHARS = 64;
const SGR_MOUSE = /^\x1b\[<(\d+);(-?\d+);(-?\d+)([Mm])$/;

export function parseTerminalMouse(sequence: string): TerminalMouseEvent | undefined {
  let button: number, col: number, row: number, release = false;
  const sgr = SGR_MOUSE.exec(sequence);
  if (sgr) {
    button = Number(sgr[1]); col = Number(sgr[2]); row = Number(sgr[3]);
    release = sgr[4] === 'm';
  } else if (sequence.startsWith('\x1b[M') && sequence.length === 6) {
    button = sequence.charCodeAt(3) - 32;
    col = sequence.charCodeAt(4) - 32; row = sequence.charCodeAt(5) - 32;
    // The recovered X10 path supplies wheel keys only; pointer events use SGR.
    if ((button & 64) === 0) return undefined;
  } else return undefined;
  if (sequence.length > MAX_MOUSE_REPORT_CHARS || ![button, col, row].every(Number.isSafeInteger)
    || button < 0 || button > 255) return undefined;
  const wheel = button & 67;
  const action = wheel === 64 ? 'wheelup' : wheel === 65 ? 'wheeldown'
    : (button & 64) !== 0 ? undefined
    : release ? 'release' : (button & 32) !== 0 ? 'move' : 'press';
  if (action === undefined) return undefined;
  return { type: 'mouse', button, action, col, row,
    ctrl: (button & 16) !== 0, meta: (button & 8) !== 0, shift: (button & 4) !== 0 };
}
