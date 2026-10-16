import { cQt, Ro, Dt } from '../src/plugin-chain-style-props-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
show('bare string', [cQt('x'.repeat(99997)), cQt('x'.repeat(99998)), cQt('x'.repeat(99999)), cQt('x'.repeat(100000))]);
for (const size of [19996, 19997, 19998, 19999]) {
  const value = { a: new Array(size).fill(0) };
  const budget = Ro();
  const answer = Dt(value, 0, budget);
  show(`object+array ${size}`, [`${answer}`, budget.nodes, budget.chars]);
}
const budget = Ro();
console.log('two walks', Dt({ a: new Array(19997).fill(0) }, 0, budget), budget.nodes,
  Dt({ a: new Array(19997).fill(0) }, 0, budget), budget.nodes);
