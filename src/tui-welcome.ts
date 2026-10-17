// @ts-nocheck
// Port of the recovered startup header `Hee` (chunk-9c78dh5n.js [960,15899),
// zero-based UTF-16 code units) and its Apple_Terminal variant `V`. The compact
// branch and every art row are copied; the recovered build-literal product name
// is replaced with this product's neutral name, and the version comes from the
// caller.
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
      e(n, { color: 'claude', children: [WELCOME_MESSAGE, ' '] }),
      e(n, { dimColor: true, children: ['v', version] }),
    ] });
  }
  const rows = appleTerminal ? appleArt(version, theme) : LIGHT_THEMES.includes(theme) ? lightArt(version) : darkArt(version);
  return e(s, { width: WELCOME_ART_WIDTH, children: e(s, { flexDirection: 'column', children: rows }) });
}

function header(version: string) {
  return e(n, { children: [
    e(n, { color: 'claude', children: [WELCOME_MESSAGE, ' '] }),
    e(n, { dimColor: true, children: ['v', version, ' '] }),
  ] });
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
    e(n, { children: '                                                          ' }),
    e(n, { children: [
      e(n, { dimColor: true, children: '                           ░░░░' }),
      e(n, { children: '                     ██    ' }),
    ] }),
    e(n, { children: [
      e(n, { dimColor: true, children: '                         ░░░░░░░░░░' }),
      e(n, { children: '               ██▒▒██  ' }),
    ] }),
    e(n, { children: '                                            ▒▒      ██   ▒' }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: ' █████████ ' }),
      '                         ▒▒░░▒▒      ▒ ▒▒'] }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', backgroundColor: 'clawd_background',
      children: '██▄█████▄██' }),
      '                           ▒▒         ▒▒ '] }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: ' █████████ ' }),
      '                          ░          ▒   '] }),
    e(n, { children: ['.......', e(n, { color: 'clawd_body', children: '█ █   █ █' }),
      '..........................░..........▒....'] }),
  ];
}

function darkArt(version: string) {
  return [
    header(version),
    e(n, { children: '..........................................................' }),
    e(n, { children: '                                                          ' }),
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
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: ' █████████ ' }),
      '                                       ', e(n, { dimColor: true, children: '*' }), e(n, { children: ' ' })] }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: '██▄█████▄██' }),
      e(n, { children: '                        ' }), e(n, { bold: true, children: '*' }), e(n, { children: '                ' })] }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: ' █████████ ' }),
      '     *                                   '] }),
    e(n, { children: ['.......', e(n, { color: 'clawd_body', children: '█ █   █ █' }),
      '..........................................'] }),
  ];
}

/** Source `V`: the Apple_Terminal variant. Its first 12 rows are the generic art. */
function appleArt(version: string, theme: string) {
  return LIGHT_THEMES.includes(theme) ? appleLightArt(version) : appleDarkArt(version);
}

function appleLightArt(version: string) {
  return [
    ...lightArt(version).slice(0, 12),
    e(n, { children: '                                          ▒▒░░▒▒      ▒ ▒▒' }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: '▗' }),
      e(n, { color: 'clawd_background', backgroundColor: 'clawd_body',
        children: [' ', '▗', '     ', '▖', ' '] }),
      e(n, { color: 'clawd_body', children: '▖' }),
      '                           ▒▒         ▒▒ '] }),
    e(n, { children: ['       ', e(n, { backgroundColor: 'clawd_body', children: ' '.repeat(9) }),
      '                           ░          ▒   '] }),
    e(n, { children: ['.......', e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: '   ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      '..........................░..........▒....'] }),
  ];
}

function appleDarkArt(version: string) {
  return [
    ...darkArt(version).slice(0, 12),
    e(n, { children: ['                                                      ',
      e(n, { dimColor: true, children: '*' }), e(n, { children: '   ' })] }),
    e(n, { children: ['      ', e(n, { color: 'clawd_body', children: '▗' }),
      e(n, { color: 'clawd_background', backgroundColor: 'clawd_body',
        children: [' ', '▗', '     ', '▖', ' '] }),
      e(n, { color: 'clawd_body', children: '▖' }),
      e(n, { children: '                       ' }), e(n, { bold: true, children: '*' }),
      e(n, { children: '                 ' })] }),
    e(n, { children: ['       ', e(n, { backgroundColor: 'clawd_body', children: ' '.repeat(9) }),
      '      *                                   '] }),
    e(n, { children: ['.......', e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: '   ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      e(n, { children: ' ' }), e(n, { backgroundColor: 'clawd_body', children: ' ' }),
      '..........................................'] }),
  ];
}
