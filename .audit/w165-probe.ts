import { runComponent } from '../src/plugin-chain-react-surface.js';
import { DiffStatLabel } from '../src/diff-dialog-primitives.js';
const run = runComponent(() => DiffStatLabel({ added: 2, removed: 1, bold: true }));
console.log(JSON.stringify(run.root, (k, v) => typeof v === 'function' ? '[fn]' : v, 2));
const zero = runComponent(() => DiffStatLabel({ added: 0, removed: 0 }));
console.log('zero', zero.result);
