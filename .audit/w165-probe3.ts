import { runComponent } from '../src/plugin-chain-react-surface.js';
import { DiffStatLabel } from '../src/diff-dialog-primitives.js';
const run = runComponent(() => DiffStatLabel({ added: 2, removed: 0 }));
const root = run.root as any;
console.log(root.props.children.map((x: any) => x && typeof x === 'object' ? { keys: Object.keys(x.props), props: x.props } : x));
