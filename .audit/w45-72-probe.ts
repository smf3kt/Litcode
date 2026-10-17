import { runComponent, ee, jo } from '../src/plugin-chain-react-surface.js';
import { hs } from '../src/plugin-chain-ui-blit-source.js';
import { Fo, nr } from '../src/plugin-chain-react-surface.js';

const cells = Buffer.alloc(4 * 2 * 4).toString('base64');
const contexts = new Map<unknown, unknown>([[ee, { requestId: 'req-1' }]]);
const mounted = runComponent(
  () => jo({ plugin: 'plug', elementKey: 'k1', columns: 4, rows: 2, cells }),
  { contexts },
);
console.log('root type', (mounted.root as any)?.type);
const child = (mounted.root as any)?.children?.[0];
console.log('child type', child?.type, 'rawWidth', child?.props?.rawWidth, 'rawHeight', child?.props?.rawHeight);
console.log('rawText length', String(child?.props?.rawText ?? '').length);
const rows = [...(hs() as Map<string, any>).entries()];
console.log('registry rows', rows.length, rows.map(([k, v]) => [k, [...v.rasters].map((m: any) => m.plugin + '/' + m.requestId + '/' + m.key)]));
const childNode = (mounted.runtime.nodes[0] as any)?.children?.[0] ?? mounted.runtime.nodes[0];
console.log('node flags', childNode?.nodeName, childNode?.dirty, childNode?.yogaMarks, childNode?.onRenderCalls);
const mount = rows[0]?.[1]?.rasters?.values?.().next?.().value;
console.log('mount keys', mount && Object.keys(mount));
const words = new Uint32Array(4 * 2 * 8);
words.fill(0);
for (let at = 0; at < 8; at += 1) words[at * 8] = 65 + at;
mount?.paint?.(words);
console.log('after paint rawText length', String(childNode?.attributes?.rawText ?? '').length);
console.log('after paint flags', childNode?.dirty, childNode?.yogaMarks, childNode?.onRenderCalls);
const node = childNode as any;
node.attributes.rawText = 'same';
const before = { dirty: node.dirty, marks: node.yogaMarks, renders: node.onRenderCalls };
const next = new Uint32Array(4 * 2 * 8);
for (let at = 0; at < 8; at += 1) next[at * 8] = 97 + at;
mount?.paint?.(next);
console.log('second paint flags', node.dirty, node.yogaMarks, node.onRenderCalls, 'before', before);
mounted.unmount();
console.log('registry after unmount', [...(hs() as Map<string, any>).keys()].length);

const calls: number[] = [];
const scheduler = Fo((value: number) => calls.push(value));
scheduler.paint(1);
scheduler.paint(2);
console.log('after two paints', calls);
await new Promise((resolve) => setTimeout(resolve, 25));
console.log('after timer', calls);
scheduler.paint(3);
scheduler.cancel();
await new Promise((resolve) => setTimeout(resolve, 25));
console.log('after cancel', calls);

const schedule: Array<[number, number]> = [];
const fake = (standing: string) => ({
  standing: () => standing,
  schedule: (value: number, delay: number) => schedule.push([value, delay]),
});
nr(fake('complete') as any, fake('complete') as any, 9);
nr(fake('progressing') as any, fake('progressing') as any, 9);
nr(fake('waiting') as any, fake('waiting') as any, 9);
console.log('nr schedules', JSON.stringify(schedule));
