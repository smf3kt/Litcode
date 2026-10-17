import { Ob, B } from '../src/plugin-chain-code-block-source.js';
import { tq, H4, uu, DIe, DXe } from '../src/plugin-chain-code-diff-source.js';
import { Zoo } from '../src/plugin-chain-diff-source.js';
import { runComponent } from '../src/plugin-chain-react-surface.js';
import { vVe } from '../src/plugin-chain-leaf-walkers.js';
import { et, Te } from '../src/plugin-chain-code-source.js';

const tree = (n: any): unknown => n === null || n === undefined ? null
  : typeof n === 'string' ? n
  : { type: typeof n.type === 'function' ? n.type.name || 'fn' : n.type, key: n.key ?? null,
      props: Object.fromEntries(Object.entries(n.props ?? {}).map(([k, v]) => [k, k === 'ref' ? '<ref>' : v])),
      children: (n.children ?? []).map(tree) };
const j = (x: unknown) => JSON.stringify(x);

const ob5 = runComponent(() => Ob({ code: 'a\nb\nc', width: 40, startLine: 5 }) as any);
console.log('Ob startLine =', j(tree(ob5.root)));
ob5.unmount();
const ob0 = runComponent(() => Ob({ code: 'a\nb\nc', width: 40, startLine: 1 }) as any);
console.log('Ob startLine1 =', j(tree(ob0.root)));
ob0.unmount();
const long = 'x'.repeat(2005);
const bl = runComponent(() => B({ code: long, skipColoring: true }) as any);
const leaf = (bl.root as any).children[0].children[0];
console.log('B long leaf len =', j(String(leaf).length), 'tail =', j(String(leaf).slice(-20)));
bl.unmount();
const bmulti = runComponent(() => B({ code: 'aaa\nbbb', skipColoring: true }) as any);
console.log('B multi =', j(tree(bmulti.root)));
bmulti.unmount();
console.log('Zoo same =', j(Zoo('abc', 'abc', { ignoreCase: false })));
console.log('Zoo case =', j(Zoo('Abc', 'abc', { ignoreCase: true })));
const uu1 = runComponent(() => uu({ children: 'X' }) as any);
console.log('uu plain =', j(tree(uu1.root)));
uu1.unmount();
const di = runComponent(() => DIe({ lines: ['abc'] }) as any);
console.log('DIe one =', j(tree(di.root)));
di.unmount();
console.log('DXe short =', j(DXe('abcdef', 1)), j(DXe('abc', 0)));
const h4 = runComponent(() => H4({ patch: { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['+a'] }, dim: true, width: 10 }) as any);
console.log('H4 =', j(tree(h4.root)));
h4.unmount();
const d = '--- a\n+++ b\n@@ -1 +1 @@\n-a\n+b\n@@ -5 +5 @@\n-c\n+d\n';
const parsed = vVe(d, 'diff') as any;
const hunks = parsed.kind === 'hunks' ? parsed.hunks : [];
console.log('hunks =', hunks.length);
const two = runComponent(() => tq({ hunks, dim: false, width: 20 }) as any);
console.log('tq two =', j((two.result as any[]).map((x: any) => tree(x))));
two.unmount();
console.log('et =', j(et(hunks, 4).map((h: any) => h.lines)));
console.log('Te =', j(Te(hunks).map((h: any) => h.lines)));
