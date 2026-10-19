// @ts-nocheck
// Port of the recovered startup header `Hee` (chunk-9c78dh5n.js [960,15899),
// zero-based UTF-16 code units) and its Apple_Terminal variant `V`. The compact
// branch, the landscape rows and the row accounting are copied; the recovered
// build-literal product name is replaced with this product's neutral name, the
// version comes from the caller, and the mascot is this product's own white
// pixel snowy owl drawn in the source's row slots with the source's colour
// slots (`clawd_body` fill, `clawd_background` detail).
import { jsx as e } from './tui-jsx.js';
import { s, n } from './tui-base-components.js';

/** Source `A`: every art row is exactly 58 cells. */
export const WELCOME_ART_WIDTH = 58;
/** Source `z`: below this many terminal rows the header collapses to one line. */
export const WELCOME_MIN_ROWS = 30;
export const WELCOME_MESSAGE = 'Welcome to LiTcode';

const LIGHT_THEMES = ['light', 'light-daltonized', 'light-ansi'];

export interface WelcomeProps {
  theme: string;
  version: string;
  compact: boolean;
  /** Source `a.terminal === "Apple_Terminal"`, which selects the `V` art. */
  appleTerminal?: boolean;
}

export function Welcome({ theme, version, compact, appleTerminal = false }: WelcomeProps) {
  if (compact) {
    return e(n, { children: [
      e(n, { color: 'text', children: [WELCOME_MESSAGE, ' '] }),
      e(n, { dimColor: true, children: ['v', version] }),
    ] });
  }
  const rows = appleTerminal ? appleArt(version, theme) : LIGHT_THEMES.includes(theme) ? lightArt(version) : darkArt(version);
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
const detail = (children: string) => e(n, { color: 'clawd_background', children });

/** The owl, five rows of eleven cells: crown, head, eyes, beak, talons. */
function owlRows(trailing: readonly unknown[]) {
  return [
    e(n, { children: ['      ', body('  ▄█████▄  '), trailing[0]] }),
    e(n, { children: ['      ', body(' █████████ '), trailing[1]] }),
    e(n, { children: ['      ', body(' █'), detail('◉'), body('█████'), detail('◉'), body('█ '), trailing[2]] }),
    e(n, { children: ['      ', body(' ████'), detail('▽'), body('████ '), trailing[3]] }),
    e(n, { children: ['.......', body('  ██   ██  '), trailing[4]] }),
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
      '..........................░..........▒..',
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
      e(n, { children: '........................................' }),
    ]),
  ];
}

/** Source `V`: the Apple_Terminal variant. Its first 12 rows are the generic art. */
function appleArt(version: string, theme: string) {
  return LIGHT_THEMES.includes(theme) ? appleLightArt(version) : appleDarkArt(version);
}

/** The tufts row the `V` art adds above its face, drawn in that variant's `▗`/`▖` idiom. */
function appleTufts(trailing: unknown) {
  return e(n, { children: ['      ', body(' ▟█▙   ▟█▙ '), trailing] });
}

/** The `V` art's own crown row: a filled head top between the tufts and the face. */
function appleCrown(trailing: unknown) {
  return e(n, { children: ['      ', body(' ▟███████▙ '), trailing] });
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
