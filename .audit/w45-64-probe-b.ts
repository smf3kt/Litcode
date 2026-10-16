// Second round: the prop rules name by name, the length guard's refusal, and what the describer answers.
import { B, cQt, sQt, Ubr, Cgo, Rgo, olt, oQt, xgo, slt } from '../src/plugin-chain-style-props-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
show('one of each set', [
  [...Ubr][0], [...Cgo][0], [...Rgo][0], [...olt][0], [...oQt][0],
]);
const probe = (name: string, values: unknown[]) => values.map((value) => sQt(name, value));
show('bool props', { dimColor: probe('dimColor', [true, false, 1, 'true']), bold: probe('bold', [true, 1]) });
show('colour props', { color: probe('color', ['red', '#fff', 'primary', 1, null]), borderColor: probe('borderColor', [1]) });
show('size props', { width: probe('width', [10, '50%', '50', 1.5, -1, 0, 1e9]), minWidth: probe('minWidth', ['%']) });
show('spacing props', { gap: probe('gap', [1, 1.5, -1, '2']), margin: probe('margin', [1, '2']), top: probe('top', [1, '1']) });
show('enum props', {
  flexDirection: probe('flexDirection', ['row', 'column', 'nope', 1]),
  overflow: probe('overflow', ['hidden', 'nope']),
  wrap: probe('wrap', ['wrap']),
  position: probe('position', ['absolute', 'nope']),
  display: probe('display', ['flex', 'nope']),
});
show('unknown names', [sQt('nope', 1), sQt('key', 1), sQt('options', 1), sQt('autoFocus', true)]);
show('xgo values', Object.entries(xgo).map(([k, v]) => [k, typeof v]));
show('length guard', [
  B(new Array(10)), B('x'.repeat(10)), B({ length: 0 }),
  (() => { try { return B({ length: 4294967295 + 1 }); } catch (e) { return `threw: ${(e as Error).message}`; } })(),
  (() => { try { return B({ length: 10n }); } catch (e) { return `threw: ${(e as Error).message}`; } })(),
]);
show('describer answers', [cQt(1), cQt('s'), cQt([1]), cQt({ a: 1 }), cQt(undefined), cQt(() => {})]);
show('slt', slt);
