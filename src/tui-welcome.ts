// @ts-nocheck
// Port of the recovered startup header `Hee` (chunk-9c78dh5n.js [960,15899),
// zero-based UTF-16 code units) and its Apple_Terminal variant `V`. The landscape
// rows, the row accounting and the colour slots are copied; the recovered
// build-literal product name is replaced with this product's neutral name, the
// version comes from the caller, and the mascot is this product's own white pixel
// snowy owl drawn in the source's row slots (`clawd_body` plumage,
// `clawd_background` detail *and* backdrop). The source's binary compact flag is
// replaced by the three-way `WelcomeDensity` below; see
// research/ports/W193-owl-visibility.md for why.
import { jsx as e } from './tui-jsx.js';
import { s, n } from './tui-base-components.js';

/** Source `A`: every art row is exactly 58 cells. */
export const WELCOME_ART_WIDTH = 58;
/** Rows the full landscape occupies: eleven scenery rows plus the five owl rows. */
export const WELCOME_ART_ROWS = 16;
/** Rows the bird alone occupies: the header plus the five owl rows. */
export const WELCOME_OWL_ROWS = 6;
/** Log rows the header must leave free before it is worth drawing at all. */
const LOG_SLACK = 4;
export const WELCOME_MESSAGE = 'Welcome to LiTcode';

const LIGHT_THEMES = ['light', 'light-daltonized', 'light-ansi'];

/**
 * How much of the header fits. The source's binary compact flag would drop the
 * mascot entirely on a short terminal; this product's mascot is the identity, so
 * the bird survives on its own when the scenery does not fit.
 */
export type WelcomeDensity = 'art' | 'owl' | 'line';

export function welcomeDensity(availableRows: number): WelcomeDensity {
  if (availableRows >= WELCOME_ART_ROWS + LOG_SLACK) return 'art';
  if (availableRows >= WELCOME_OWL_ROWS + LOG_SLACK) return 'owl';
  return 'line';
}

export interface WelcomeProps {
  theme: string;
  version: string;
  density: WelcomeDensity;
  /** Source `a.terminal === "Apple_Terminal"`, which selects the `V` art. */
  appleTerminal?: boolean;
}

export function Welcome({ theme, version, density, appleTerminal = false }: WelcomeProps) {
  if (density === 'line') {
    return e(n, { children: [
      e(n, { color: 'text', children: [WELCOME_MESSAGE, ' '] }),
      e(n, { dimColor: true, children: ['v', version] }),
    ] });
  }
  const rows = density === 'owl'
    ? [header(version), ...owlRows(['', '', '', '', ''], '      ')]
    : appleTerminal ? appleArt(version, theme) : LIGHT_THEMES.includes(theme) ? lightArt(version) : darkArt(version);
  return e(s, { width: WELCOME_ART_WIDTH, children: e(s, { flexDirection: 'column', children: rows }) });
}

function header(version: string) {
  return e(n, { children: [
    e(n, { color: 'text', children: [WELCOME_MESSAGE, ' '] }),
    e(n, { dimColor: true, children: ['v', version, ' '] }),
  ] });
}

/** `clawd_body` is the owl's plumage, `clawd_background` its eye and beak detail. */
const body = (children: string) => e(n, { color: 'clawd_body', children });
/** Detail sits inside the plumage, so it swaps the two slots and reads as a hole. */
const detail = (children: string) => e(n, { color: 'clawd_background', backgroundColor: 'clawd_body', children });

/**
 * The owl paints its own backdrop. A theme that assumes the wrong terminal
 * background (auto-detection falling back to `dark` on a light terminal) would
 * otherwise draw white plumage on white and the bird would disappear, so the
 * eleven-cell block carries `clawd_background` behind it and stays legible
 * whatever the terminal itself is.
 */
const owl = (children: unknown) => e(n, { backgroundColor: 'clawd_background', children });

/** The owl, five rows of eleven cells: tufts, head, face, body, talons. */
function owlRows(trailing: readonly unknown[], ground = '......') {
  return [
    e(n, { children: ['      ', owl(body(' ▟█▙   ▟█▙ ')), trailing[0]] }),
    e(n, { children: ['      ', owl(body('▟█████████▙')), trailing[1]] }),
    e(n, { children: ['      ', owl([body('█'), detail('◉'), body('███'), detail('▽'), body('███'), detail('◉'), body('█')]), trailing[2]] }),
    e(n, { children: ['      ', owl(body('███████████')), trailing[3]] }),
    e(n, { children: [ground, owl(body(' ██     ██ ')), trailing[4]] }),
  ];
}

function lightArt(version: string) {
  return [
    header(version),
    e(n, { children: '..........................................................' }),
    e(n, { children: '                                                          ' }),
    e(n, { children: '                                                          ' }),
    e(n, { children: '                                                          ' }),
    e(n, { children: '            ░░░░░░                                        ' }),
    e(n, { children: '    ░░░   ░░░░░░░░░░                                      ' }),
    e(n, { children: '   ░░░░░░░░░░░░░░░░░░░                                    ' }),
    e(n, { children: [
      e(n, { dimColor: true, children: '                           ░░░░' }),
      e(n, { children: '                     ██    ' }),
    ] }),
    e(n, { children: [
      e(n, { dimColor: true, children: '                         ░░░░░░░░░░' }),
      e(n, { children: '               ██▒▒██  ' }),
    ] }),
    e(n, { children: '                                            ▒▒      ██   ▒' }),
    ...owlRows([
      '▒▒░░▒▒      ▒ ▒▒                        ',
      '▒▒         ▒▒                           ',
      '░          ▒                            ',
      '░          ▒                            ',
      '...........................░..........▒..',
    ]),
  ];
}

function darkArt(version: string) {
  return [
    header(version),
    e(n, { children: '..........................................................' }),
    e(n, { children: '     *                                       █████▓▓░     ' }),
    e(n, { children: '                                 *         ███▓░     ░░   ' }),
    e(n, { children: '            ░░░░░░                        ███▓░           ' }),
    e(n, { children: '    ░░░   ░░░░░░░░░░                      ███▓░           ' }),
    e(n, { children: [
      e(n, { children: '   ░░░░░░░░░░░░░░░░░░░    ' }),
      e(n, { bold: true, children: '*' }),
      e(n, { children: '                ██▓░░      ▓   ' }),
    ] }),
    e(n, { children: '                                             ░▓▓███▓▓░    ' }),
    e(n, { dimColor: true, children: ' *                                 ░░░░                   ' }),
    e(n, { dimColor: true, children: '                                 ░░░░░░░░                 ' }),
    e(n, { dimColor: true, children: '                               ░░░░░░░░░░░░░░░░           ' }),
    ...owlRows([
      e(n, { children: '                                        ' }),
      e(n, { children: ['                       ', e(n, { bold: true, children: '*' }), '                '] }),
      e(n, { children: '     *                                  ' }),
      e(n, { children: '     *                                  ' }),
      e(n, { children: '.........................................' }),
    ]),
  ];
}

/** Source `V`: the Apple_Terminal variant. Its first 12 rows are the generic art. */
function appleArt(version: string, theme: string) {
  return LIGHT_THEMES.includes(theme) ? appleLightArt(version) : appleDarkArt(version);
}

/** The tufts row the `V` art adds above its face, drawn in that variant's `▗`/`▖` idiom. */
function appleTufts(trailing: unknown) {
  return e(n, { children: ['      ', owl(body(' ▟█▙   ▟█▙ ')), trailing] });
}

/** The `V` art's own crown row: a filled head top between the tufts and the face. */
function appleCrown(trailing: unknown) {
  return e(n, { children: ['      ', owl(body(' ▟███████▙ ')), trailing] });
}

function appleLightArt(version: string) {
  return [
    ...lightArt(version).slice(0, 11),
    appleTufts('                                        '),
    appleCrown('                                        '),
    e(n, { children: ['      ', body('▗'),
      e(n, { color: 'clawd_background', backgroundColor: 'clawd_body',
        children: [' ', '▗', '     ', '▖', ' '] }),
      body('▖'),
      '                          ▒▒         ▒▒'] }),
    e(n, { children: ['       ', e(n, { backgroundColor: 'clawd_body', children: ' '.repeat(9) }),
      '                          ░          ▒  '] }),
    e(n, { children: ['.......', e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: '   ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      '..........................░..........▒..'] }),
  ];
}

function appleDarkArt(version: string) {
  return [
    ...darkArt(version).slice(0, 11),
    appleTufts([e(n, { children: '            ' }), e(n, { dimColor: true, children: '*' }), e(n, { children: '   ' })]),
    appleCrown(e(n, { children: '                                        ' })),
    e(n, { children: ['      ', body('▗'),
      e(n, { color: 'clawd_background', backgroundColor: 'clawd_body',
        children: [' ', '▗', '     ', '▖', ' '] }),
      body('▖'),
      e(n, { children: ['                       ', e(n, { bold: true, children: '*' }), '                '] })] }),
    e(n, { children: ['       ', e(n, { backgroundColor: 'clawd_body', children: ' '.repeat(9) }),
      e(n, { children: '     *                                  ' })] }),
    e(n, { children: ['.......', e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: '   ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      '........................................'] }),
  ];
}
