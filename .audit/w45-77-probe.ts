// W45-77 probe: measure the Code leaf (`lt`), the code block renderer (`Ob`/`nt`/`B`) and the diff
// renderer (`tq`/`H4`) through the host seam before any assertion.
import {
  lt, Oe, Te, et, tt,
} from '../src/plugin-chain-code-source.js';
import { Ob, B, nt } from '../src/plugin-chain-code-block-source.js';
import { tq, H4, uu, DIe, DXe, dje } from '../src/plugin-chain-code-diff-source.js';
import { Zoo } from '../src/plugin-chain-diff-source.js';
import { Ys, kc, Mi, hr, Tj, Kl, rDr, CNo } from '../src/plugin-chain-code-host.js';
import { runComponent } from '../src/plugin-chain-react-surface.js';
import { vVe } from '../src/plugin-chain-leaf-walkers.js';
import { ge } from '../src/tui-color.js';

const out: string[] = [];
const show = (label: string, value: unknown): void => out.push(`${label} = ${JSON.stringify(value)}`);
const props = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'ref') out.ref = '<ref>';
    else if (typeof item === 'function') out[key] = `<fn ${item.name || 'anonymous'}>`;
    else if (key === 'children') continue;
    else out[key] = item;
  }
  return out;
};
const tree = (node: any, depth = 0): unknown => {
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return node;
  const children = (node.children ?? []).map((child: any) => tree(child, depth + 1));
  return { type: typeof node.type === 'function' ? node.type.name || 'fn' : node.type, props: props(node.props), children };
};

show('seams', { mi: Mi(), rDr: rDr(), CNo: CNo(), ys: Ys(null) });
const hooksRun = runComponent(() => ({ hr: hr(), kl: Kl(), tj: Tj() !== null, kc: kc(() => 12) }));
show('hook seams', hooksRun.result);
hooksRun.unmount();
show('ge.level', ge.level);

show('Oe', Oe('abcdefghij', 5));
show('tt', tt('abcdefghij\nklmnop', 5));

const src = 'const a = 1;\nconst b = 2;\n';
const ltRun = runComponent(() => lt({ source: src, format: 'source' }) as any);
show('lt source root', tree(ltRun.root));
ltRun.unmount();

const obRun = runComponent(() => Ob({ code: src, width: 40 }) as any);
show('Ob source', tree(obRun.root));
obRun.unmount();

const bRun = runComponent(() => B({ code: src, filePath: '/a.js' }) as any);
show('B source', tree(bRun.root));
bRun.unmount();
const bPlain = runComponent(() => B({ code: src, skipColoring: true }) as any);
show('B uncoloured', tree(bPlain.root));
bPlain.unmount();
const ntRun = runComponent(() => nt({ codeWithSpaces: src, language: 'javascript' }) as any);
show('nt javascript', tree(ntRun.root));
ntRun.unmount();

const ntPlain = runComponent(() => nt({ codeWithSpaces: src }) as any);
show('nt plain', tree(ntPlain.root));
ntPlain.unmount();

const diffSrc = '--- a.txt\n+++ b.txt\n@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n const b = 3;\n';
show('vVe diff', vVe(diffSrc, 'diff'));
const parsed = vVe(diffSrc, 'diff') as any;
const hunks = parsed?.kind === 'hunks' ? parsed.hunks : [];

const ltDiff = runComponent(() => lt({ source: diffSrc, format: 'diff' }) as any);
show('lt diff root', tree(ltDiff.root));
ltDiff.unmount();

if (hunks.length > 0) {
  const tqRun = runComponent(() => tq({ hunks, dim: false, width: 40 }) as any);
  show('tq result', Array.isArray(tqRun.result) ? tqRun.result.map((item: any) => tree(item)) : tree(tqRun.root));
  tqRun.unmount();

  const h4Run = runComponent(() => H4({ patch: hunks[0], dim: false, width: 40 }) as any);
  show('H4 hunk', tree(h4Run.root));
  h4Run.unmount();
}

show('DXe', DXe('x'.repeat(2100), 0));
show('dje', dje(37));
show('Zoo', Zoo('abc', 'abd', { ignoreCase: false }));

show('uu shell', tree(runComponent(() => uu({ children: 'X', fromLeftEdge: true }) as any).root));
show('DIe lines', tree(runComponent(() => DIe({ lines: ['a', 'b'], width: 3 }) as any).root));

console.log(out.join('\n'));
