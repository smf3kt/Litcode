/**
 * The `/tui` command. Recovered from `chunk-24k7d6mw.js`: the renderer list `lZ` at 63380, the
 * relaunch `yan` at 63413, `_an` at 63857, `THs` at 64013, `OHo` at 64259, `RHs` at 64445 and the
 * command body `b1s` at 64587, re-exported as `call` by `chunk-1wsqtf4b.js` (sha256
 * `854c4a1af9be3812a3cfbbf32c1275c8df03c14b760b7dcad401cc201d5ef101`). Offsets are zero-based
 * UTF-16 code units. The registration is `STo` in `chunk-sfn1dbxq.js` at 1636494, with no
 * `isEnabled` and the argument hint `[default|fullscreen]`.
 *
 * The recovered body reads the current renderer from `Rc()`, refuses an unknown word, saves
 * `{tui: <renderer>}` into `userSettings`, and relaunches the process into the picked renderer
 * through `yan`, which passes `CLAUDE_CODE_TUI_JUST_SWITCHED` and drops the three renderer
 * environment overrides. This build draws one renderer — the alternate-screen one `Rc()` selects —
 * and has no relaunch, so the two arms that could change something report instead. The refusal
 * frame is the recovered `THs`/`_an` wording, which is what a switch that cannot complete says.
 */

/** Source `lZ`: the two renderer names, in the order the usage line lists them. */
export const TUI_RENDERERS = ['default', 'fullscreen'] as const;

export type TuiRenderer = (typeof TUI_RENDERERS)[number];

export type TuiArgument =
  | { readonly kind: 'current' }
  | { readonly kind: 'unknown'; readonly got: string }
  | { readonly kind: 'renderer'; readonly renderer: TuiRenderer };

/** Source `b1s`'s `L = M.trim().toLowerCase()` and its two argument arms. */
export function parseTuiArgument(argument: string): TuiArgument {
  const token = argument.trim().toLowerCase();
  if (token === '') return { kind: 'current' };
  if (!(TUI_RENDERERS as readonly string[]).includes(token)) return { kind: 'unknown', got: token };
  return { kind: 'renderer', renderer: token as TuiRenderer };
}

/**
 * Source `Rc()`: whether this session is on the fullscreen renderer. The local terminal enters the
 * alternate screen for the whole session (`TerminalModeController.enter`), so it always is.
 */
export function currentRenderer(): TuiRenderer {
  return 'fullscreen';
}

/** Source ``/tui <${lZ.join("|")}>``. */
export function tuiUsage(): string {
  return `/tui <${TUI_RENDERERS.join('|')}>`;
}

/** Source `Current renderer: ${ee}${Mt}. Usage: …`, whose `Mt` is the crash-recovery note. */
export function tuiCurrentReport(renderer: TuiRenderer = currentRenderer(), note = ''): string {
  return `Current renderer: ${renderer}${note}. Usage: ${tuiUsage()}`;
}

/** Source `Unknown renderer "${L}". Usage: …`. */
export function tuiUnknownReport(got: string): string {
  return `Unknown renderer "${got}". Usage: ${tuiUsage()}`;
}

/** Source `Already using the ${he} renderer.`, both of the recovered arms that print it. */
export function tuiAlreadyReport(renderer: TuiRenderer): string {
  return `Already using the ${renderer} renderer.`;
}

/**
 * The local refusal for the arm this build cannot honour. It keeps the recovered frame — a switch
 * that cannot complete says so and changes nothing — because `yan`'s relaunch into the classic
 * renderer has no counterpart here.
 */
export const TUI_CLASSIC_UNAVAILABLE =
  'Cannot switch renderers — this build draws only the fullscreen renderer. Nothing was changed.';

/** The whole command: the argument grammar and the report each arm produces. */
export function tuiReport(argument: string): string {
  const parsed = parseTuiArgument(argument);
  if (parsed.kind === 'current') return tuiCurrentReport();
  if (parsed.kind === 'unknown') return tuiUnknownReport(parsed.got);
  if (parsed.renderer === currentRenderer()) return tuiAlreadyReport(parsed.renderer);
  return TUI_CLASSIC_UNAVAILABLE;
}
