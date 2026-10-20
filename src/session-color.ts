import { cellWidth } from './terminal.js';
import { clipEnd } from './tui-autocomplete.js';

/**
 * `/color` and the composer banner it paints, ported from the recovered interactive
 * application. Coordinates are zero-based UTF-16 offsets in the extracted module.
 *
 * - `chunk-zm6kh5jw.js` (SHA-256
 *   857c50354b6a9e92382a46c6fb8cad46077640d9b1960f12fc07b2647956c3fc): `c` 394 the reset
 *   words, `b2s` 472 the `local-jsx` body, `BQn` 580 the command body, `p` 1597 the remote
 *   bridge tag update.
 * - `chunk-1z1j45h7.js` (SHA-256
 *   01bb837725202a084cad281f0b8fcf059995c5d924da078b489cd9611f50fc9d): `BM` 43 the name to
 *   theme-slot table, `B_` 366 its keys, `bLe` 459 the user-over-agent precedence.
 * - `chunk-24k7d6mw.js` (SHA-256
 *   1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `Mk` 1567586 the
 *   composer banner row, `xzt` 1576494 the chip it draws, `p2` 1577469 the slot resolver,
 *   `Rzt` 1577813 the default prompt border slot.
 * - `chunk-sfn1dbxq.js` (SHA-256
 *   4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da): `Jco` 1831786 and
 *   `cBe` 1832036, the two registrations that share this body.
 */

/** `B_`: the eight colour names `/color` accepts, in the order the error message lists them. */
export const SESSION_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as const;
export type SessionColor = (typeof SESSION_COLORS)[number];

/** `c`: the words that clear the colour instead of setting one. */
export const SESSION_COLOR_RESETS = ['default', 'reset', 'none', 'gray', 'grey'] as const;

/** `BM`: a colour name to the theme slot it paints with. */
export const SESSION_COLOR_SLOTS: Readonly<Record<SessionColor, string>> = {
  red: 'red_FOR_SUBAGENTS_ONLY', blue: 'blue_FOR_SUBAGENTS_ONLY',
  green: 'green_FOR_SUBAGENTS_ONLY', yellow: 'yellow_FOR_SUBAGENTS_ONLY',
  purple: 'purple_FOR_SUBAGENTS_ONLY', orange: 'orange_FOR_SUBAGENTS_ONLY',
  pink: 'pink_FOR_SUBAGENTS_ONLY', cyan: 'cyan_FOR_SUBAGENTS_ONLY',
};

/** `p2`'s default and `Rzt`'s prompt branch: what the banner paints with before any `/color`. */
export const PROMPT_BORDER_SLOT = 'promptBorder';
export const SUBAGENT_COLOR_FALLBACK_SLOT = 'cyan_FOR_SUBAGENTS_ONLY';

export function isSessionColor(value: string): value is SessionColor {
  return (SESSION_COLORS as readonly string[]).includes(value);
}

/**
 * `p2`: a name that is one of the eight resolves to its slot, and anything else — absence
 * included — to the caller's fallback.
 */
export function sessionColorSlot(color: string | undefined,
  fallback: string = SUBAGENT_COLOR_FALLBACK_SLOT): string {
  return color !== undefined && isSessionColor(color) ? SESSION_COLOR_SLOTS[color] : fallback;
}

/**
 * `bLe`: the user's own pick wins over whatever the active agent definition declares.
 * The local product has no agent colour source, so only the override ever arrives.
 */
export function effectiveSessionColor(source: { userOverride?: string;
  agentDefinitionColor?: string }): string | undefined {
  return source.userOverride ?? source.agentDefinitionColor;
}

/** `BQn`'s argumentHint: `[red|blue|green|yellow|purple|orange|pink|cyan|default]`. */
export function sessionColorArgumentHint(): string {
  return `[${[...SESSION_COLORS, 'default'].join('|')}]`;
}

export type SessionColorResult =
  | { readonly kind: 'set'; readonly color: SessionColor }
  | { readonly kind: 'reset' }
  | { readonly kind: 'invalid'; readonly message: string };

/**
 * `BQn`'s parse: an empty argument picks a colour at random, any other argument is
 * lowercased, a reset word clears the colour, one of the eight sets it, and everything else
 * reports the list.
 */
export function parseSessionColor(argument: string | undefined,
  pick: () => SessionColor = () => SESSION_COLORS[Math.floor(Math.random() * SESSION_COLORS.length)]!):
SessionColorResult {
  const trimmed = argument?.trim() ?? '';
  const name = trimmed === '' ? pick() : trimmed.toLowerCase();
  if ((SESSION_COLOR_RESETS as readonly string[]).includes(name)) return { kind: 'reset' };
  if (isSessionColor(name)) return { kind: 'set', color: name };
  return { kind: 'invalid',
    message: `Invalid color "${name}". Available colors: ${SESSION_COLORS.join(', ')}, default` };
}

/** `BQn`'s two success strings, verbatim. */
export function sessionColorMessage(result: Extract<SessionColorResult, { kind: 'set' | 'reset' }>): string {
  return result.kind === 'reset' ? 'Session color reset to default'
    : `Session color set to: ${result.color}`;
}

/** `Oc`: a teammate's colour belongs to the team leader, so the command refuses. */
export const TEAMMATE_COLOR_MESSAGE =
  'Cannot set color: This session is a teammate. Teammate colors are assigned by the team leader.';

/**
 * `Mk`'s banner row: `columns` dashes with the chip embedded, and the whole row painted in
 * one colour. With no text the chip collapses and the row is a full-width rule, which is
 * what `/color` alone produces.
 */
export function composeBanner(text: string, columns: number): string {
  const room = columns - 3;
  const label = room > 0 ? clipEnd(text, room) : '';
  const chip = label === '' ? 0 : cellWidth(label) + 2;
  const tail = chip > 0 ? 1 : 0;
  const dashes = Math.max(0, columns - chip - tail);
  return '─'.repeat(dashes) + (label === '' ? '' : ` ${label} `) + (tail ? '─' : '');
}
