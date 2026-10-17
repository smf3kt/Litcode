// W45-78 probe: the held-press store, the drawing walkers and the input/select dispatch, measured
// through the copied bodies with a fixture module installed. Values printed here belong in
// test/plugin-chain-press.test.ts.
import '../src/plugin-chain-registry.js';
import { installChainModule, setChainRecordFactory } from '../src/plugin-chain-host.js';
import { chainModuleRecord } from '../src/plugin-chain-module-record.js';
import {
  m_, g_, Hrt, b_, AK, XPt, Rto, SFs, FM, BM, k_, ql, UPn, jPn, x_, T_, _f, bf, S_, __,
} from '../src/plugin-chain-press.js';
import { ot, mn, Cn, ya, da, ha, zd } from '../src/plugin-chain-press-sites.js';

const pressed: Array<{ handle: number; argument: unknown }> = [];
const released: number[] = [];
setChainRecordFactory((module) => {
  const record = chainModuleRecord(module);
  record.releasePresses = (handles: readonly unknown[]) => {
    released.push(...handles as number[]);
  };
  return record;
});
const uninstall = installChainModule({
  name: 'probe-fixture',
  hooks: () => false,
  record: () => ({ name: 'probe-fixture', tier: 'core', run: () => undefined }) as never,
  press: (handle, argument) => {
    pressed.push({ handle, argument });
    return { ok: true };
  },
});

type Drawing = Record<string, unknown>;
const button = (key: string, handle: number, plugin = 'probe-fixture'): Drawing =>
  ({ type: 'Button', props: { key }, press: { plugin, handle } });
const input = (key: string, handle: number): Drawing =>
  ({ type: 'Input', props: { key }, press: { plugin: 'probe-fixture', handle } });
const select = (key: string, handle: number, options: unknown[]): Drawing =>
  ({ type: 'Select', props: { key, options }, press: { plugin: 'probe-fixture', handle } });

const group: Drawing = {
  type: 'Box',
  props: {},
  children: [
    button('b1', 1),
    { type: 'Box', props: {}, children: [input('i1', 2)] },
    select('s1', 3, [{ value: 'a' }, { value: 'b' }]),
    { type: 'Text', props: {}, children: ['x'] },
    { type: 'Button', props: { key: 'nokey' }, press: { plugin: 'probe-fixture', handle: 4 } },
    button('b2', 7, 'other'),
  ],
};
const identity = { component: 'Fixture', requestId: 'r1', surface: 'terminal' };

const pressesOf = (drawing: unknown): Array<[string, unknown, number]> => {
  const out: Array<[string, unknown, number]> = [];
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const held = node as Drawing;
    const press = held.press as { plugin?: string; handle?: number } | undefined;
    if (press !== undefined) out.push([String(held.type), (held.props as Drawing | undefined)?.key, Number(press.handle)]);
    for (const child of (held.children as unknown[] | undefined) ?? []) walk(child);
  };
  walk(drawing);
  return out;
};

console.log('XPt', JSON.stringify(XPt(group)));
const hosted = Rto(group, identity);
console.log('Rto presses', JSON.stringify(pressesOf(hosted)));
console.log('Rto count', AK.heldPressCount());
console.log('holdersOf(identity)', JSON.stringify(AK.holdersOf(identity)));
console.log('hostedButtonsOf', JSON.stringify(AK.hostedButtonsOf('probe-fixture', 'b1').map((entry) => entry.hosted)));
console.log('_f', JSON.stringify(_f('probe-fixture', identity)));
console.log('S_', S_, '__range', typeof __(), __() < S_);

console.log('b_', (() => {
  const store = b_();
  const heldOne = store.holdDrawing('p', identity, [{ tag: 'Button', handle: 5, element: 'x' }]);
  const hostedHandle = [...heldOne.hosted.values()][0];
  const byKey = store.heldByKeyOf({ tag: 'Button', plugin: 'p', element: 'x', surface: 'terminal', component: 'Fixture', requestId: 'r1' });
  const byFilter = store.heldPress('p', Number(hostedHandle), 'x');
  const byWrong = store.heldPress('p', Number(hostedHandle), 'y');
  const drawingTwo = store.holdDrawing('p', { ...identity, requestId: 'r2' }, [{ tag: 'Button', handle: 5, element: 'x' }]);
  const reuse = hostedHandle === [...drawingTwo.hosted.values()][0];
  const r1after = store.heldByKeyOf({ tag: 'Button', plugin: 'p', element: 'x', surface: 'terminal', component: 'Fixture', requestId: 'r1' });
  const r2after = store.heldByKeyOf({ tag: 'Button', plugin: 'p', element: 'x', surface: 'terminal', component: 'Fixture', requestId: 'r2' });
  return {
    hosted: [...heldOne.hosted.entries()], byKey: byKey !== undefined, byFilter: byFilter !== undefined,
    byWrong: byWrong === undefined, reuse, r1after: r1after === undefined, r2after: r2after !== undefined,
    count: store.heldPressCount(), holders: store.holdersOf(identity),
  };
})());

const hostedPresses = pressesOf(hosted);
const inputHandle = Number(hostedPresses.find((entry) => entry[0] === 'Input')?.[2]);
const selectHandle = Number(hostedPresses.find((entry) => entry[0] === 'Select')?.[2]);
console.log('handles', inputHandle, selectHandle);

console.log('k_ held', k_({ plugin: 'probe-fixture', handle: inputHandle, element: 'i1' }));
console.log('k_ by element', k_({ plugin: 'probe-fixture', handle: -1, element: 'b1' }));
console.log('k_ absent', k_({ plugin: 'probe-fixture', handle: -1, element: 'nope' }));

const inputResult = await x_({
  plugin: 'probe-fixture', handle: inputHandle, element: 'i1', ...identity, kind: 'text', value: 'hello',
});
console.log('x_ result', JSON.stringify(inputResult));
console.log('x_ pressed', JSON.stringify(pressed.at(-1)));

const selectResult = await T_({
  plugin: 'probe-fixture', handle: selectHandle, element: 's1', ...identity, value: 'a',
});
console.log('T_ result', JSON.stringify(selectResult));
console.log('T_ pressed', JSON.stringify(pressed.at(-1)));
const before = pressed.length;
const refused = await T_({
  plugin: 'probe-fixture', handle: selectHandle, element: 's1', ...identity, value: 'z',
});
console.log('T_ refused', refused, 'ran', pressed.length - before);

const queued = await UPn({
  plugin: 'probe-fixture', handle: inputHandle, element: 'i1', ...identity, kind: 'text', value: 'queued',
});
console.log('UPn result', JSON.stringify(queued));
const skipped = await UPn({
  plugin: 'probe-fixture', handle: -1, element: 'nope', ...identity, kind: 'text', value: 'no',
});
console.log('UPn skipped', skipped);
const selectQueued = await jPn({
  plugin: 'probe-fixture', handle: selectHandle, element: 's1', ...identity, value: 'b',
});
console.log('jPn result', JSON.stringify(selectQueued));
console.log('ql direct', await ql({ plugin: 'probe-fixture', handle: inputHandle, element: 'i1' }, (name) => () => Promise.resolve(`ran ${name}`)));
const byKey = await x_({
  plugin: 'probe-fixture', handle: -1, element: 'i1', ...identity, kind: 'text', value: 'byKey',
});
console.log('x_ by key', JSON.stringify(byKey));
const missing = await x_({
  plugin: 'probe-fixture', handle: -1, element: 'nope', ...identity, kind: 'text', value: 'none',
});
console.log('x_ missing', missing);

const relabelled = SFs(group, (_plugin, handle) => (handle === 1 ? 100 : undefined));
console.log('SFs', JSON.stringify(pressesOf(relabelled)));

const next: Drawing = { type: 'Box', props: {}, children: [input('i1', 2)] };
released.length = 0;
Rto(next, identity);
console.log('Rto next released', JSON.stringify(released));
released.length = 0;
FM(group, next, identity);
console.log('FM released', JSON.stringify(released));
released.length = 0;
BM(next, identity);
console.log('BM released', JSON.stringify(released));

const ghost = Rto({ type: 'Box', props: {}, children: [button('g1', 11, 'ghost')] }, identity);
const ghostHandle = Number(pressesOf(ghost)[0]?.[2]);
try {
  await x_({ plugin: 'ghost', handle: ghostHandle, element: 'g1', ...identity, kind: 'text', value: 'v' });
} catch (error) {
  console.log('ghost error', (error as Error).message);
}
AK.forgetPresses('ghost');

const runners = m_();
const run = runners.hold('p', (argument: unknown) => argument);
console.log('m_ runner', runners.runnerFor('p', run) !== undefined, g_(run), g_(0), runners.count());
runners.release('p', [run]);
console.log('m_ released', runners.runnerFor('p', run), runners.count());
console.log('Hrt count', Hrt.count());

console.log('sites', ya.event, da.event, ha.event, Object.keys(zd).length);
const siteHeld = { plugin: 'p', requestId: 'r1', surface: 'terminal' };
console.log('ot ok', ot({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal' }, siteHeld));
console.log('ot plugin', ot({ plugin: 'q', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal' }, siteHeld));
console.log('ot surface', ot({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'watch' }, siteHeld));
console.log('ot link', ot({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal', link: { href: 'https://x' } }, siteHeld));
console.log('mn ok', mn({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal', kind: 'text', value: 'v' }, { ...siteHeld, kind: 'text' }));
console.log('mn kind', mn({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal', kind: 'number', value: 'v' }, { ...siteHeld, kind: 'text' }));
console.log('Cn value', Cn({ plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal', value: 3 }, siteHeld));

uninstall();
