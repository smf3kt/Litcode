import { runComponent } from '../src/plugin-chain-react-surface.js';
import { formatChord, formatActionHint, ChordHint, HintText } from '../src/diff-dialog-chrome.js';
for (const c of ['ctrl+a', 'escape', 'up', 'ctrl+up', 'shift+tab', 'alt+enter', ['ctrl+a', 'ctrl+b'], '', 'meta+k']) {
  console.log(JSON.stringify(c), '=>', JSON.stringify(formatChord(c as never)));
}
console.log('symbol', JSON.stringify(formatChord('ctrl+a', { style: 'symbol' })));
console.log('compact', JSON.stringify(formatChord('ctrl+shift+a', { style: 'compact' })));
console.log('hint', JSON.stringify(formatActionHint({ chord: 'escape', action: 'close' })));
console.log('parens', JSON.stringify(formatActionHint({ chord: 'escape', action: 'close', parens: true })));
console.log('terse', JSON.stringify(formatActionHint({ chord: 'escape', action: 'close', terse: true })));
const hint = runComponent(() => ChordHint({ chord: 'escape', action: 'close' }));
console.log('ChordHint', JSON.stringify(hint.root, (k, v) => typeof v === 'function' ? '[fn]' : v));
const text = runComponent(() => HintText({ children: 'none', hint: 'try again' }));
console.log('HintText', JSON.stringify(text.root, (k, v) => typeof v === 'function' ? '[fn]' : v));
const none = runComponent(() => ChordHint({ chord: '', action: 'close' }));
console.log('empty', none.result);
