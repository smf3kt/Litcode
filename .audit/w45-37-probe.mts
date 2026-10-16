// Measure the tab and ESC-sequence pass before anything asserts on it.
import { Mde } from '../src/plugin-chain-label-text-source.js';
import { Epe, mCo, ht, yt, mt, gCo, kt, Zs } from '../src/plugin-chain-normalize-source.js';
import { pluginLabel } from '../src/plugin-chain-notify-stack.js';
import { twe, tokenizeAnsi } from '../src/tui-ansi-tokenizer.js';

const show = (value: unknown): string => (typeof value === 'string'
  ? JSON.stringify(value.length > 48 ? `${value.slice(0, 48)}…(${value.length})` : value)
  : JSON.stringify(value));
const run = (label: string, fn: () => unknown): void => {
  try { console.log(`${label} -> ${show(fn())}`); } catch (error) { console.log(`${label} -> THREW ${(error as Error).message}`); }
};

run('Epe plain        ', () => Epe('engine'));
run('Epe tab          ', () => Epe('a\tb'));
run('mCo a\\tb         ', () => mCo(['a\tb']).join(''));
run('mCo col tracking ', () => mCo(['abcdefg\th']).join(''));
run('mCo escape+tab   ', () => show(mCo(['\u001b[31ma\tb']).join('')));
run('ht plain         ', () => ht('plain', true));
run('ht escape        ', () => show(ht('\u001b[31mred', true)));
run('ht unterminated  ', () => show(ht('\u001b[31', true)));
run('yt text token    ', () => yt({ type: 'text', value: 'a\u0090b' }));
run('yt sequence      ', () => yt({ type: 'sequence', value: '\u001b[31m' }));
run('yt control token ', () => yt({ type: 'text', value: 'a\u0085b' }));
run('mt C1            ', () => mt('a\u0090b'));
run('gCo escape       ', () => gCo(['\u001b[31m']));
run('gCo tab only     ', () => gCo(['a\tb']));
run('kt tab (no prev) ', () => kt('a\tb', false));
run('Zs tab           ', () => Zs('a\tb'));
run('twe is exported  ', () => typeof twe);
run('tokenizeAnsi     ', () => show(tokenizeAnsi('\u001b[31mred')));
for (const input of ['a\tb', '\t', 'a\tb\tc', 'x\u001b[31my', 'a\t' + 'b'.repeat(30), 'engine']) {
  run(`Mde ${show(input).padEnd(22)}`, () => Mde(input));
}
run('pluginLabel(tab) ', () => pluginLabel('a\tb'));

console.log('--- the reachability truth table');
run('gCo C1           ', () => gCo(['a\u0090b']));
run('gCo C1 8-bit     ', () => gCo(['a\u009bb']));
run('gCo newline      ', () => gCo(['a\nb']));
run('Epe escape only  ', () => show(Epe('\u001b[31mred')));
run('Epe C1           ', () => show(Epe('a\u0090b')));
run('mCo C1           ', () => show(mCo(['a\u0090b']).join('')));
run('mCo multiline    ', () => show(mCo(['a\tb\nc\td']).join('')));
run('mCo two lines    ', () => show(mCo(['a\tb', 'c\td']).join('')));
run('ht C1 untermin.  ', () => show(ht('a\u001b', true)));
run('yt text with NEL ', () => JSON.stringify(yt({ type: 'text', value: 'a\u0085b' })));
run('yt 8-bit seq     ', () => JSON.stringify(yt({ type: 'text', value: 'a\u009bb' })));
run('Mde tab at end   ', () => Mde('a\t'));
run('Mde tab then 30  ', () => Mde('a\t' + 'b'.repeat(30)));
run('Mde only spaces  ', () => Mde('\t\t'));
