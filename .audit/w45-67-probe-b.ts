import {
  blockPassesRuntimeSchema, documentPassesRuntimeSchema, isLegacyAction, splitChord,
} from '../src/plugin-chain-keys-editor.js';

const rows: unknown[] = [];
for (const chord of ['ctrl+k', ' ', '  ', '', ' g g ', 'g g', 'gg', 'ctrl+x shift+y', '\tg\ng ']) {
  rows.push([chord, splitChord(chord)]);
}
console.log(JSON.stringify(rows, null, 1));
for (const value of ['messageSelector:up', 'select:previous', 'diff:viewDetails', 'app:interrupt', '', null, 1, undefined]) {
  console.log('isLegacyAction', JSON.stringify(value), isLegacyAction(value));
}
const block = { context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } };
for (const value of [block, { context: 'Nope', bindings: { 'ctrl+k': 'nope' } }, { bindings: {} }, { context: 'Global' }, null, 1, 'x', []]) {
  console.log('block', JSON.stringify(value), blockPassesRuntimeSchema(value));
}
for (const value of [[block], [], [{ ...block }, { context: 1, bindings: {} }], {}, 'x', null, [block, null]]) {
  console.log('document', JSON.stringify(value), documentPassesRuntimeSchema(value));
}
