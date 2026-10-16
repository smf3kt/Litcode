import { BDe, rOn } from '../src/plugin-chain-records.js';
const long = 'z'.repeat(10001);
const out = BDe(long);
console.log('rOn', rOn, 'len', out.length, 'ends', JSON.stringify(out.slice(-3)));
const exact = BDe('z'.repeat(10000));
console.log('10000 ->', exact.length, 'ends', JSON.stringify(exact.slice(-3)));
