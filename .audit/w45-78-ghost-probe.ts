import '../src/plugin-chain-registry.js';
import { AK, Rto, x_, k_ } from '../src/plugin-chain-press.js';

const identity = { component: 'Fixture', requestId: 'r1', surface: 'terminal' };
const el = { type: 'Button', props: { key: 'g1' }, press: { plugin: 'ghost', handle: 11 } };
const hosted = Rto({ type: 'Box', props: {}, children: [el] }, identity);
const handle = (hosted as any).children[0].press.handle;
console.log('hosted', JSON.stringify(hosted));
console.log('held', JSON.stringify(AK.heldPress('ghost', handle, 'g1')));
console.log('k_', k_({ plugin: 'ghost', handle, element: 'g1' }));
try {
  const r = await x_({ plugin: 'ghost', handle, element: 'g1', ...identity, kind: 'text', value: 'v' });
  console.log('resolved', r);
} catch (e) { console.log('threw', (e as Error).message); }
