// @ts-nocheck
// The startup header. The recovered `Hee` (chunk-9c78dh5n.js [960,15899), zero-based
// UTF-16 code units) supplied the row accounting and the colour slots this product
// still uses (`clawd_body` plumage, `clawd_background` detail and backdrop); its
// landscape, its 58-cell width, its Apple_Terminal variant `V` and its binary compact
// flag are dropped in favour of one small owl mark, because the recovered art reads as
// a pastiche of another product's splash rather than this one's identity. See
// research/ports/W194-compact-owl.md.
import { jsx as e } from './tui-jsx.js';
import { s, n } from './tui-base-components.js';

/** Widest row of the lockup: the owl, two spaces, and the title line. */
export const WELCOME_ART_WIDTH = 36;
/** Rows the lockup occupies. */
export const WELCOME_ART_ROWS = 4;
/** Log rows the header must leave free before it is worth drawing at all. */
const LOG_SLACK = 4;
export const WELCOME_MESSAGE = 'Welcome to LiTcode';

/** How much of the header fits; below the lockup the title stands alone. */
export type WelcomeDensity = 'art' | 'line';

export function welcomeDensity(availableRows: number): WelcomeDensity {
  return availableRows >= WELCOME_ART_ROWS + LOG_SLACK ? 'art' : 'line';
}

export interface WelcomeProps {
  theme: string;
  version: string;
  density: WelcomeDensity;
}

export function Welcome({ theme, version, density }: WelcomeProps) {
  if (density === 'line') {
    return e(n, { children: [
      e(n, { color: 'text', children: [WELCOME_MESSAGE, ' '] }),
      e(n, { dimColor: true, children: ['v', version] }),
    ] });
  }
  return e(s, { width: WELCOME_ART_WIDTH, children: e(s, { flexDirection: 'column', children: owlLockup(version) }) });
}

/** `clawd_body` is the owl's plumage, `clawd_background` its eye and beak detail. */
const body = (children: string) => e(n, { color: 'clawd_body', children });
/** Detail sits inside the plumage, so it swaps the two slots and reads as a hole. */
const detail = (children: string) => e(n, { color: 'clawd_background', backgroundColor: 'clawd_body', children });

/**
 * The owl paints its own backdrop. A theme that assumes the wrong terminal
 * background (auto-detection falling back to `dark` on a light terminal) would
 * otherwise draw white plumage on white and the bird would disappear, so the
 * nine-cell block carries `clawd_background` behind it and stays legible
 * whatever the terminal itself is.
 */
const owl = (children: unknown) => e(n, { backgroundColor: 'clawd_background', children });

/** The mark: four rows of nine cells, tufts, face, body, feet. */
const OWL_SHAPE = [' ▟█▙ ▟█▙ ', '█◉██▽██◉█', '█████████', ' ██   ██ '];

function owlRow(cells: string, suffix: unknown = '') {
  const spans: unknown[] = [];
  for (const cell of cells) {
    spans.push(cell === '◉' || cell === '▽' ? detail(cell) : cell === ' ' ? body(' ') : body(cell));
  }
  return e(n, { children: [owl(e(n, { children: spans })), suffix] });
}

function owlLockup(version: string) {
  return [
    owlRow(OWL_SHAPE[0]!, e(n, { children: [
      '  ',
      e(n, { color: 'text', children: [WELCOME_MESSAGE, ' '] }),
      e(n, { dimColor: true, children: ['v', version] }),
    ] })),
    owlRow(OWL_SHAPE[1]!),
    owlRow(OWL_SHAPE[2]!),
    owlRow(OWL_SHAPE[3]!),
  ];
}
