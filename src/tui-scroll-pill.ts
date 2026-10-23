import { cellWidth } from './terminal.js';
import { chordForAction } from './tui-keys.js';
import { formatChord } from './diff-dialog-chrome.js';
import { jsx } from './tui-jsx.js';
import { n, s } from './tui-base-components.js';
import { y } from './tui-react-runtime.js';
import { te } from './tui-symbols.js';

export interface ScrollPillProps {
  count: number;
  columns: number;
  mouse: boolean;
  onClick(): void;
}

/** Vc/Xw, 3gz7s57c [41715,43141), 3c5vzz43 [753,1088), UTF-16; geometry and input are owned props. */
export function ScrollPill({ count, columns, mouse, onClick }: ScrollPillProps) {
  const [hover, setHover] = y(false);
  const bottom = formatChord(chordForAction('scroll:bottom', 'Scroll', 'ctrl+end'));
  const page = formatChord(chordForAction('scroll:pageDown', 'Scroll', 'pagedown'));
  const label = count > 0 ? `${count} new ${count === 1 ? 'message' : 'messages'}` : 'Jump to bottom';
  const mac = process.platform === 'darwin' && (bottom === '' || bottom === formatChord('ctrl+end'));
  const down = page === formatChord('pagedown') ? `fn+${te.arrowDown}` : page;
  const full = mac && mouse ? `${label} (click) ${te.arrowDown}` : mac && down
    ? `${label}: ${down} to scroll` : bottom ? `${label} (${bottom}) ${te.arrowDown}` : `${label} ${te.arrowDown}`;
  const text = [full, `${label} ${te.arrowDown}`, label].find(value => cellWidth(value) <= columns - 2) ?? label;
  return jsx(s, { position: 'absolute', bottom: 0, left: 0, right: 0, justifyContent: 'center',
    children: jsx(s, { noSelect: true, scrollPill: true, onClick,
      onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
      children: jsx(n, { backgroundColor: hover ? 'userMessageBackgroundHover' : 'userMessageBackground',
        color: 'text', wrap: 'truncate-end', children: [' ', text, ' '] }, 'label') }, 'target') }, 'jump');
}
