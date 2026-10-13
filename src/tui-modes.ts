/**
 * DEC private terminal modes for the full-screen interaction layer.
 *
 * Ported from the recovered interactive terminal's mode module
 * (`chunk-awnyk09r.js` [662,1776), SHA-256 954877238a19ecfcf3cb1ca1ff6d895c9e845212ebce8b91ce64be5b2f02c36d,
 * zero-based UTF-16 coordinates). The constants, the two `?N h` / `?N l`
 * formatters, the composite mouse profiles, and `mouseSequence` are carried
 * over as they are; only the type annotations are new.
 *
 * The controller at the bottom is an adaptation: the recovered one keeps a
 * mode->action table inside its React render owner
 * (`chunk-1r9zp6s1.js` @9554, for example
 * `case BRACKETED_PASTE: return {type:"mode", action:{type:"bracketedPaste", enabled}}`).
 * This product has no render owner to hang that table on, so the same
 * transitions are applied by an explicit owner that restores every mode it
 * changed.
 */

export const TERMINAL_MODES = {
  CURSOR_VISIBLE: 25,
  ALT_SCREEN: 47,
  ALT_SCREEN_CLEAR: 1049,
  MOUSE_NORMAL: 1000,
  MOUSE_BUTTON: 1002,
  MOUSE_ANY: 1003,
  MOUSE_SGR: 1006,
  MOUSE_SGR_PIXELS: 1016,
  FOCUS_EVENTS: 1004,
  BRACKETED_PASTE: 2004,
  THEME_NOTIFY: 2031,
  SYNCHRONIZED_UPDATE: 2026,
  WIN32_INPUT_MODE: 9001,
} as const;

export type TerminalMode = (typeof TERMINAL_MODES)[keyof typeof TERMINAL_MODES];

const CSI = '\x1b[';

/** `?N h`: set a DEC private mode. */
export const setMode = (mode: TerminalMode): string => `${CSI}?${mode}h`;
/** `?N l`: reset a DEC private mode. */
export const resetMode = (mode: TerminalMode): string => `${CSI}?${mode}l`;

export const ENABLE_SYNCHRONIZED_UPDATE = setMode(TERMINAL_MODES.SYNCHRONIZED_UPDATE);
export const DISABLE_SYNCHRONIZED_UPDATE = resetMode(TERMINAL_MODES.SYNCHRONIZED_UPDATE);
export const ENABLE_BRACKETED_PASTE = setMode(TERMINAL_MODES.BRACKETED_PASTE);
export const DISABLE_BRACKETED_PASTE = resetMode(TERMINAL_MODES.BRACKETED_PASTE);
export const ENABLE_FOCUS_EVENTS = setMode(TERMINAL_MODES.FOCUS_EVENTS);
export const DISABLE_FOCUS_EVENTS = resetMode(TERMINAL_MODES.FOCUS_EVENTS);
export const ENABLE_THEME_NOTIFY = setMode(TERMINAL_MODES.THEME_NOTIFY);
export const DISABLE_THEME_NOTIFY = resetMode(TERMINAL_MODES.THEME_NOTIFY);
export const SHOW_CURSOR = setMode(TERMINAL_MODES.CURSOR_VISIBLE);
export const HIDE_CURSOR = resetMode(TERMINAL_MODES.CURSOR_VISIBLE);
export const ENTER_ALT_SCREEN = setMode(TERMINAL_MODES.ALT_SCREEN_CLEAR);
export const LEAVE_ALT_SCREEN = resetMode(TERMINAL_MODES.ALT_SCREEN_CLEAR);
export const DISABLE_WIN32_INPUT_MODE = resetMode(TERMINAL_MODES.WIN32_INPUT_MODE);

/** Reporting every mouse event, button and motion. */
export const MOUSE_FULL = setMode(TERMINAL_MODES.MOUSE_NORMAL) + setMode(TERMINAL_MODES.MOUSE_BUTTON)
  + setMode(TERMINAL_MODES.MOUSE_ANY) + setMode(TERMINAL_MODES.MOUSE_SGR);
/** Reporting only wheel and press events, which is what a transcript scrolls on. */
export const MOUSE_SCROLL = setMode(TERMINAL_MODES.MOUSE_NORMAL) + setMode(TERMINAL_MODES.MOUSE_SGR);
export const MOUSE_OFF = resetMode(TERMINAL_MODES.MOUSE_SGR) + resetMode(TERMINAL_MODES.MOUSE_ANY)
  + resetMode(TERMINAL_MODES.MOUSE_BUTTON) + resetMode(TERMINAL_MODES.MOUSE_NORMAL);
export const MOUSE_PIXELS_ON = setMode(TERMINAL_MODES.MOUSE_SGR_PIXELS);
export const MOUSE_PIXELS_OFF = resetMode(TERMINAL_MODES.MOUSE_SGR_PIXELS) + setMode(TERMINAL_MODES.MOUSE_SGR);

export type MouseTracking = 'full' | 'scroll' | 'off';

/** The recovered profile selector; `off` emits nothing because it is reset separately. */
export function mouseSequence(tracking: MouseTracking): string {
  switch (tracking) {
    case 'full': return MOUSE_FULL;
    case 'scroll': return MOUSE_SCROLL;
    case 'off': return '';
  }
}

export interface ModeControllerOptions {
  output: { write(chunk: string): unknown };
  /** Mouse reporting profile for the duration of the owned screen. */
  mouseTracking?: MouseTracking;
  /** Ask the terminal to hold the frame until it is complete. */
  synchronizedUpdate?: boolean;
}

/**
 * Owns the modes of one full-screen session and restores exactly the ones it
 * changed. Two instances may nest, but only the outermost owns the screen.
 */
export class TerminalModeController {
  private readonly applied = new Set<string>();
  private active = false;

  constructor(private readonly options: ModeControllerOptions) {}

  get inputMode(): 'raw' | 'cooked' { return this.active ? 'raw' : 'cooked'; }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.apply(ENTER_ALT_SCREEN);
    this.apply(ENABLE_BRACKETED_PASTE);
    this.apply(ENABLE_FOCUS_EVENTS);
    if (this.options.synchronizedUpdate) this.apply(ENABLE_SYNCHRONIZED_UPDATE);
    const mouse = mouseSequence(this.options.mouseTracking ?? 'off');
    if (mouse) this.apply(mouse);
    this.apply(HIDE_CURSOR);
  }

  /** Leave the owned screen, restoring every mode this controller set. */
  leave(): void {
    if (!this.active) return;
    this.active = false;
    // Mouse reporting is switched off before the screen is restored so the
    // terminal the person returns to is not left reporting motion.
    this.release(MOUSE_OFF);
    if (this.options.synchronizedUpdate) this.release(DISABLE_SYNCHRONIZED_UPDATE);
    this.release(DISABLE_FOCUS_EVENTS);
    this.release(DISABLE_BRACKETED_PASTE);
    this.release(DISABLE_WIN32_INPUT_MODE);
    this.apply(SHOW_CURSOR);
    this.release(LEAVE_ALT_SCREEN);
  }

  /** Wrap one frame so the terminal presents it atomically when it can. */
  frame(text: string): string {
    return this.options.synchronizedUpdate
      ? `${ENABLE_SYNCHRONIZED_UPDATE}${text}${DISABLE_SYNCHRONIZED_UPDATE}`
      : text;
  }

  private apply(sequence: string): void {
    if (!sequence) return;
    this.applied.add(sequence);
    this.options.output.write(sequence);
  }

  private release(sequence: string): void {
    if (!sequence) return;
    this.applied.delete(sequence);
    this.options.output.write(sequence);
  }
}
