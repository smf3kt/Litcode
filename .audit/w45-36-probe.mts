// Measure the ported label sanitiser before anything asserts on it. Every line is an observation.
import { Mde, O, Y, dn, R, Ae, mn, V, ke, g3, L, xg } from '../src/plugin-chain-label-text-source.js';
import { Lr, kt, Zs, Epe, gCo, gGn, Et, Rt, _r, Pr, _t } from '../src/plugin-chain-normalize-source.js';
import { ae, ct, jo, Ar, Qe, $8, ra, z } from '../src/plugin-chain-text-clamp-source.js';
import { pluginLabel } from '../src/plugin-chain-notify-stack.js';

const show = (value: unknown): string => (typeof value === 'string'
  ? JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…(${value.length})` : value)
  : String(value));

const run = (label: string, fn: () => unknown): void => {
  try { console.log(`${label} -> ${show(fn())}`); } catch (error) { console.log(`${label} -> THREW ${(error as Error).message}`); }
};

console.log('--- widths and the primitives');
run('ae  (engine)      ', () => ae('engine'));
run('ae  (中文)        ', () => ae('中文'));
run('_t  (a)           ', () => _t('a'));
run('_t  (\u0009)          ', () => _t('\u0009'));
run('_t  (٠)         ', () => _t('٠'));
run('z                 ', () => JSON.stringify(z));
run('ra() is a segmenter', () => ra().constructor.name);
run('Ar  (a\\nb)        ', () => Ar('a\nb'));
run('Qe  (a/b, /)      ', () => Qe('a/b', '/'));
run('$8  (x)           ', () => $8('x'));
run('ct  (abcdef, 4)   ', () => ct('abcdef', 4));
run('jo  (a b c, 3, t) ', () => jo('a b c', 3, true));
run('jo  (a\\nb, 9, t)   ', () => jo('a\nb', 9, true));

console.log('--- the fold and the preview');
run('Et  (10) newline  ', () => Et(10));
run('Et  (9)  tab      ', () => Et(9));
run('Et  (7)  control  ', () => Et(7));
run('Rt  (1564)        ', () => Rt(1564));
run('_r  (65039)       ', () => _r(65039));
run('Pr  (0xD800)      ', () => Pr(0xd800));
run('kt  (a\\uD800b)    ', () => kt('a\uD800b', false));
run('kt  (a\\uFE0Fb)    ', () => kt('a️b', false));
run('Zs  (plain)       ', () => Zs('plain'));
run('Lr  (short)       ', () => Lr('short'));
run('Lr  (4097 chars)  ', () => `len ${Lr('x'.repeat(4097)).length}`);
run('Epe (plain)       ', () => Epe('plain'));
run('gGn (plain)       ', () => gGn('plain'));
run('gGn (esc)         ', () => gGn('\u001b[31m'));
run('gCo ([plain])     ', () => gCo(['plain']));
run('gCo ([esc])       ', () => gCo(['\u001b[31m']));
run('Epe (tab)         ', () => Epe('a\tb'));

console.log('--- the sanitiser stages');
run('L   (​)         ', () => L('​', 0x200b));
run('L   (a)           ', () => L('a', 0x61));
run('R   (​)         ', () => R('​'));
run('Ae  (⠀)         ', () => Ae('⠀'));
run('dn  (a​b)       ', () => dn('a​b', (c) => L(c, c.codePointAt(0) ?? 0)));
run('O   (a​b)       ', () => O('a​b'));
run('O   (a\\uFE0Fb)     ', () => O('a️b'));
run('Y   (á)        ', () => Y('á'));
run('xg  (9 marks)     ', () => `len ${xg('x' + '́'.repeat(9)).length} ${JSON.stringify(xg('x' + '́'.repeat(9)).slice(-3))}`);
run('mn  (​a​)     ', () => mn('​a​'));
run('V   (a​, end)   ', () => V('a​', 'end'));
run('ke  (a…)        ', () => ke('a…'));
run('g3  (​�)      ', () => g3('​�'));
run('g3  (�)         ', () => g3('�'));

console.log('--- Mde');
for (const input of ['engine', 'my plugin', '  padded  ', '', '   ', '​​', 'a\nb', 'café', 'x́'.repeat(40), 'a'.repeat(300), 'end…', 'plain⠀', ' ', '\u{1F389}', '\u{1F469}‍\u{1F469}‍\u{1F467}', null, 42, undefined, {}, ['a']]) {
  run(`Mde ${typeof input === 'string' ? show(input).padEnd(30) : show(input)}`, () => Mde(input));
}
run('Mde (tab)', () => Mde('a\tb'));
run('Mde (esc)', () => Mde('\u001b[31mred'));
run('Mde (24 col clamp)', () => Mde('word '.repeat(12)));
run('pluginLabel(engine)', () => pluginLabel('engine'));
run('pluginLabel(42 as any)', () => pluginLabel(42 as unknown as string));

console.log('--- second pass: the unmeasured cases');
for (const input of ['⠀', '﻿', '‍', '  ', 'a⠀', '́'.repeat(9), 'word '.repeat(12) + 'x', '\u{1F600}️', 'ḿ'.repeat(3)]) {
  run(`Mde ${show(input).padEnd(28)}`, () => Mde(input));
}
run('Lr marker passthrough', () => Lr('… [+3 graphemes]'));
run('Lr two lines      ', () => Lr('one\ntwo'));
run('Lr empty line     ', () => Lr('one\n\ntwo'));
run('Mde of Lr marker  ', () => Mde('… [+3 graphemes]'));
run('xg 1 mark         ', () => xg('á'));
run('xg 8 marks        ', () => xg('a' + '́'.repeat(8)));
run('g3 of ​       ', () => g3('​'));
run('g3 of a​       ', () => g3('a​'));
