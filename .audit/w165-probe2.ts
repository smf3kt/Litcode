import { runComponent } from '../src/plugin-chain-react-surface.js';
import { DiffStatLabel } from '../src/diff-dialog-primitives.js';
for (const props of [{ added: 2, removed: 0 }, { added: 0, removed: 3 }]) {
  const run = runComponent(() => DiffStatLabel(props));
  const root = run.root as unknown as { props: { children: unknown[] }, children: unknown[] };
  console.log(JSON.stringify({ props: root.props.children, committed: root.children }, (k, v) => typeof v === 'function' ? '[fn]' : v));
}
