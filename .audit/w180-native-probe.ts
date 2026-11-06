import assert from 'node:assert/strict';
import { TuiRenderer } from '../src/tui-renderer.js';
import { nativeElement, Xe, qt, Ae, y, en, R } from '../src/plugin-chain-react-hooks.js';

const context = qt('default');
let increment: (() => void) | undefined;
let mounted = 0;
let cleaned = 0;
let node: any;
function Child() {
  const value = Ae(context);
  const [count, setCount] = y(0);
  const ref = R(null);
  increment = () => setCount(previous => previous + 1);
  en(() => { mounted += 1; node = ref.current; return () => { cleaned += 1; }; }, []);
  return Xe('Box', { ref, flexDirection: 'column', children: Xe('Text', { children: `${value} ${count}` }) });
}
const renderer = new TuiRenderer({ write() {} });
const tree = nativeElement(Xe(context, { value: 'mounted', children: Xe(Child, {}) }));
const paint = () => renderer.renderElement(tree, 60, 12, { row: 0, column: 0, visible: false });
paint();
assert.match(renderer.frame.join('\n'), /mounted 0/);
assert.equal(mounted, 1);
assert.equal(node.nodeName, 'ink-box');
increment!();
paint();
assert.match(renderer.frame.join('\n'), /mounted 1/);
renderer.close();
assert.equal(cleaned, 1);
assert.equal(renderer.liveNodes, 0);
console.log('native component persistence and cleanup passed');
