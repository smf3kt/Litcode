import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { Qe } from '../src/diff-dialog-list-source.js';

interface Node { type: unknown; props: Record<string, unknown> }

function shape(n: unknown, d = 0): unknown {
  if (d > 5) return '...';
  if (typeof n === 'string') return JSON.stringify(n);
  if (Array.isArray(n)) return n.map((x) => shape(x, d + 1));
  if (n && typeof n === 'object' && 'type' in n) {
    const node = n as Node;
    const t = typeof node.type === 'function' ? (node.type.name || 'fn') : String(node.type).slice(0, 24);
    return { t, keys: Object.keys(node.props ?? {}), ch: shape(node.props.children, d + 1) };
  }
  return String(n);
}

const clock = { now: () => 1000, setTimeout: () => () => {} };
const contexts = new Map<unknown, unknown>([[eE, clock], [Zm, { rows: 24, columns: 40 }]]);
const run = runComponent(() => Qe({ props: { children: ['alpha', 'beta'] }, visibleCount: 10 }), { contexts });
console.log(JSON.stringify(shape(run.result), null, 1).slice(0, 6000));
