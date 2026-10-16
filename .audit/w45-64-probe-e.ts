import { cQt } from '../src/plugin-chain-style-props-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
show('key straddle', [cQt({ k: 'x'.repeat(99990) }), cQt({ k: 'x'.repeat(99991) }), cQt({ k: 'x'.repeat(99992) })]);
show('long key', [cQt({ kk: 'x'.repeat(99988) }), cQt({ kk: 'x'.repeat(99989) })]);
