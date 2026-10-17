import { aUn, Slt, b } from '../src/plugin-chain-matchers.js';

console.log('aUn 1,1', aUn(1, 1));
console.log('aUn 2,1', aUn(2, 1));
console.log('aUn obj', aUn({ a: 1 }, { a: 1 }), aUn({ a: 2 }, { a: 1 }));
console.log('aUn regex', aUn('x', /^x/), aUn('y', /^x/));
console.log('Slt regex', Slt(/^x/, 'x'), Slt(/^x/, 'y'));
console.log('blt', b({ a: 1 }, { field: 'a', value: 1 }), b({ a: 2 }, { field: 'a', value: 1 }), b(undefined, { field: 'a', value: 1 }));
const names = { table: { Task: 'Agent', ListPeers: 'ListAgents' }, paths: [[]] };
console.log('alias', aUn('Agent', 'Task', names as never), aUn('Task', 'Agent', names as never));
console.log('Slt alias', Slt(/^Agent$/, 'Task', names as never));
