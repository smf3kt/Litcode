// Hee, 9c78dh5n [960,15899), UTF-16: retain the compact fallback; user artwork replaces the splash (W302).
import { jsx as e } from './tui-jsx.js';
import { s, n } from './tui-base-components.js';
import { owlPixels, OWL_WIDTH, OWL_HEIGHT, type OwlPixel, type OwlPose } from './tui-owl.js';

export const WELCOME_ART_WIDTH = 36;
export const WELCOME_ART_ROWS = OWL_HEIGHT / 2 + 1;
const LOG_SLACK = 4;
export const WELCOME_MESSAGE = 'Welcome to LiTcode';
export type WelcomeDensity = 'art' | 'line';

export function welcomeDensity(availableRows: number): WelcomeDensity {
  return availableRows >= WELCOME_ART_ROWS + LOG_SLACK ? 'art' : 'line';
}

export interface WelcomeProps {
  theme: string;
  version: string;
  density: WelcomeDensity;
  pose?: OwlPose;
  columns?: number;
}

type Palette = Record<Exclude<OwlPixel, ' '>, string>;
function palette(theme: string): Palette {
  if (theme.endsWith('-ansi')) return {
    w: 'ansi:whiteBright', g: 'ansi:blackBright',
    y: 'ansi:yellow', k: 'ansi:black',
  };
  return { w: '#f6f7fa', g: '#b8c0ca', y: '#ffd12d', k: '#30323c' };
}

export function Welcome({ theme, version, density, pose = 'rest', columns = 100 }: WelcomeProps) {
  const title = () => e(n, { children: [
    e(n, { color: 'text', children: [columns < 28 ? 'LiTcode' : WELCOME_MESSAGE, ' '] }, 'title'),
    e(n, { dimColor: true, children: ['v', version] }, 'version'),
  ] }, 'lockup-title');
  if (density === 'line') return title();
  const pixels = owlPixels(pose), colors = palette(theme);
  const light = theme === 'light' || theme.startsWith('light-');
  const occupied = (x: number, y: number) => pixels[y]?.[x] !== undefined && pixels[y]![x] !== ' ';
  const color = (x: number, y: number): string | undefined => {
    const pixel = pixels[y]?.[x];
    if (pixel === undefined || pixel === ' ') return;
    // On light backgrounds the thin feather edge preserves the white silhouette without a panel.
    if (pixel === 'w' && light &&
      (!occupied(x - 1, y) || !occupied(x + 1, y) || !occupied(x, y - 1) || !occupied(x, y + 1))) return colors.g;
    return colors[pixel];
  };
  const rows = [title()];
  for (let row = 0; row < OWL_HEIGHT / 2; row++) {
    const cells = [];
    for (let x = 0; x < OWL_WIDTH; x++) {
      const top = color(x, row * 2), bottom = color(x, row * 2 + 1);
      const props = top === undefined && bottom === undefined ? { children: ' ' }
        : top === undefined ? { children: '▄', color: bottom }
        : bottom === undefined ? { children: '▀', color: top }
        : top === bottom ? { children: '█', color: top }
        : { children: '▀', color: top, backgroundColor: bottom };
      cells.push(e(n, props, x));
    }
    rows.push(e(n, { children: cells }, row));
  }
  return e(s, { flexDirection: 'column', width: Math.min(columns, WELCOME_ART_WIDTH), children: rows }, 'welcome');
}
