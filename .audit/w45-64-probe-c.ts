// Third round: the two boundaries the describer compares against, and what a repeat costs.
import { cQt, B } from '../src/plugin-chain-style-props-source.js';
const nest = (d: number): unknown => { let v: unknown = 1; for (let i = 0; i < d; i += 1) v = [v]; return v; };
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
show('depth', [cQt(nest(30)), cQt(nest(31)), cQt(nest(32)), cQt(nest(33)), cQt(nest(40))]);
show('chars', [cQt('x'.repeat(99998)), cQt('x'.repeat(99999)), cQt('x'.repeat(100000)), cQt('x'.repeat(100001))]);
const shared = { s: 1 };
show('repeat', [cQt({ a: shared, b: shared }), cQt(Array(5).fill(shared))]);
show('non-finite', [cQt(NaN), cQt(Infinity), cQt(-Infinity), cQt({ a: NaN })]);
show('class', [cQt(new Date(0)), cQt(Object.create(null)), cQt({ a: Object.create(null) })]);
show('other scalars', [cQt(1n), cQt(Symbol('s'))]);
show('list length bounds', [
  (() => { try { return B({ length: 4294967295 }); } catch (e) { return `threw: ${(e as Error).message}`; } })(),
  (() => { try { return B({ length: 4294967296 }); } catch (e) { return `threw: ${(e as Error).message}`; } })(),
  B({ length: -1.9 }), B({ length: '12' }), B({ length: NaN }), B({ length: 1.5 }),
]);
