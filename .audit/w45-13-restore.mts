// W45-13: `we(["previous","ifVersion"])` fills back only the keys a rewrite dropped (`m$` restores a
// key only when the passed object does not own it), so the measured case is a rewrite that omitted them.
import '../src/plugin-chain-registry.js';
import { $be } from '../src/plugin-chain-host.js';
const ss: any = ($be() as any)['state.set'];
console.log('dropped ->', JSON.stringify(ss.restoreArgument({ value: 5 }, { previous: { a: 2 }, ifVersion: 8, value: 1 })));
console.log('present ->', JSON.stringify(ss.restoreArgument({ previous: { a: 9 }, value: 5 }, { previous: { a: 2 }, ifVersion: 8, value: 1 })));
console.log('check after restore ->', JSON.stringify(ss.checkArgument(ss.restoreArgument({ value: 5 }, { previous: { a: 2 }, ifVersion: 8, value: 1 }), { previous: { a: 2 }, ifVersion: 8, value: 1 })));
