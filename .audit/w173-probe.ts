import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { Zy } from '../src/plugin-chain-press-button-source.js';
import { DiffDialog, DiffDialogDataContext } from '../src/diff-dialog-dialog.js';

interface Node { type: unknown; props: Record<string, unknown> }

function shape(n: unknown, d = 0): unknown {
  if (d > 4) return '...';
  if (typeof n === 'string') return JSON.stringify(n);
  if (Array.isArray(n)) return n.map((x) => shape(x, d + 1));
  if (n && typeof n === 'object' && 'type' in n) {
    const node = n as Node;
    const t = typeof node.type === 'function' ? (node.type.name || 'fn') : String(node.type).slice(0, 20);
    return { t, keys: Object.keys(node.props ?? {}), ch: shape(node.props.children, d + 1) };
  }
  return String(n);
}

const data = {
  stats: { filesCount: 1, linesAdded: 2, linesRemoved: 1 },
  files: [{ path: 'a.ts', linesAdded: 2, linesRemoved: 1, isBinary: false, isLargeFile: false, isTruncated: false, isNewFile: false }],
  hunks: new Map([['a.ts', [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: ['-a', '+b', '+c'] }]]]),
  loading: false, source: { kind: 'working-tree' }, baseMode: 'auto',
};
const contexts = new Map<unknown, unknown>([
  [eE, { now: () => 1000, setTimeout: () => () => {} }],
  [Zm, { rows: 30, columns: 80 }],
  [Zy, { exit() {}, focusManager: null, rootNode: null }],
  [DiffDialogDataContext, { data, notice: null }],
]);
const run = runComponent(
  () => DiffDialog({ messages: [], onDone: () => {} }),
  { contexts },
);
console.log(JSON.stringify(shape(run.result), null, 1).slice(0, 9000));
