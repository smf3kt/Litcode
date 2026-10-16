// Second round: the admitted side, and the two checks that need state threaded through them.
import { inputLeafProblem, optionProblem, selectLeafProblem, checkHoverKey } from '../src/plugin-chain-site-leaves.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const press = { plugin: 'p', handle: 1 };
show('input admitted', [
  inputLeafProblem({ props: { key: 'k' }, press }),
  inputLeafProblem({ props: { key: 'k', label: 'L', placeholder: 'p', value: 'v', submitLabel: 's', autoFocus: true }, press }),
  inputLeafProblem({ props: { key: 'k' }, press, children: 'x' }),
  inputLeafProblem({ props: { key: 'k', label: 1 }, press, children: 'x' }),
]);
show('select admitted', [
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] }, press }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, { value: 'b' }], label: 'L', value: 'a', autoFocus: true }, press }),
  selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] }, press, children: 'x' }),
]);
const seen = new Set<string>();
show('option seen once', [optionProblem({ value: 'a' }, seen), [...seen]]);
show('option seen twice', [optionProblem({ value: 'a' }, seen), [...seen]]);
show('option label bad', optionProblem({ value: 'b', label: 1 }, new Set()));
show('hover key at the limit', checkHoverKey('k'.repeat(10000)));
