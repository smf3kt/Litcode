// Probe the W45-64 bodies through the copy before the seam's API is fixed.
import { B, cN, cQt, ca, Ro, sQt, un, xgo, Ubr, rQt, Cgo, Rgo, olt, oQt, slt, Ybr, ESe, AFe, Vs } from '../src/plugin-chain-style-props-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
show('bounds', { Vs, Ybr, ESe, AFe, slt });
show('set sizes', { Ubr: Ubr.size, rQt: rQt.size, Cgo: Cgo.size, Rgo: Rgo.size, olt: olt.size, oQt: oQt.size });
show('xgo keys', Object.keys(xgo).slice(0, 40));
show('xgo size', Object.keys(xgo).length);
show('cN', [cN(null), cN([]), cN({}), cN('s'), cN(1), cN(true), cN(undefined), cN(() => {})]);
show('un', [un(false), un(true), un('ab'), un(12345), un(null), un([]), un({}), un(undefined)]);
show('ca', [ca({ nodes: 1, chars: 1 }), ca({ nodes: AFe + 1, chars: 0 }), ca({ nodes: 0, chars: Ybr + 1 })]);
show('B', [B([1, 2, 3]), B('abcd'), B({ length: 2 }), (() => { try { return B({ length: -1 }); } catch (error) { return `threw ${(error as Error).constructor.name}`; } })()]);
show('cQt small', [cQt(1), cQt('s'), cQt([1, 2]), cQt({ a: 1 }), cQt(null)]);
show('cQt nested', cQt({ a: [1, { b: 'c' }], d: null }));
show('cQt depth', cQt((() => { let deep: any = 0; for (let i = 0; i < 40; i += 1) deep = [deep]; return deep; })()));
const cyclic: any = { name: 'x' }; cyclic.self = cyclic;
show('cQt cycle', cQt(cyclic));
show('cQt wide', cQt(new Array(AFe + 10).fill(1)).slice(0, 60) + '...');
show('sQt known', [
  sQt('dimColor', true), sQt('dimColor', 1), sQt('color', 'red'), sQt('color', 1),
  sQt('width', 10), sQt('width', '10'), sQt('width', 1.5),
  sQt('gap', 2), sQt('top', 1), sQt('bold', 1), sQt('nope', 1),
]);
