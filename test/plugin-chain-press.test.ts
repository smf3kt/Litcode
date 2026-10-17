// W45-78: the held-press store (`AK`/`b_`), the drawing walkers (`XPt`/`Rto`/`SFs`/`FM`/`BM`), the
// input and select dispatch (`Xl`/`x_`/`T_`/`UPn`/`jPn`/`ql`) and the three press sites (`ya`/`da`/
// `ha`). Expected values were measured through the ported bodies (see .audit/w45-78-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { installChainModule, setChainRecordFactory } from '../src/plugin-chain-host.js';
import { chainModuleRecord } from '../src/plugin-chain-module-record.js';
import {
  m_, g_, Hrt, b_, AK, XPt, Rto, SFs, FM, BM, k_, ql, UPn, jPn, x_, T_, _f, S_, __,
} from '../src/plugin-chain-press.js';
import { ot, mn, Cn, ya, da, ha, zd } from '../src/plugin-chain-press-sites.js';

type Drawing = Record<string, unknown>;

interface ReleaseLog {
  handles: number[];
}
const releaseLog: ReleaseLog = { handles: [] };
setChainRecordFactory((module) => {
  const record = chainModuleRecord(module);
  record.releasePresses = (handles: readonly unknown[]) => {
    releaseLog.handles.push(...handles as number[]);
  };
  return record;
});

const pressed: Array<{ handle: number; argument: unknown }> = [];
function installFixture(name: string): () => void {
  return installChainModule({
    name,
    hooks: () => false,
    record: () => ({ name, tier: 'core', run: () => undefined }) as never,
    press: (handle, argument) => {
      pressed.push({ handle, argument });
      return { ok: true };
    },
  });
}

const button = (key: string, handle: number, plugin: string): Drawing =>
  ({ type: 'Button', props: { key }, press: { plugin, handle } });
const input = (key: string, handle: number, plugin: string): Drawing =>
  ({ type: 'Input', props: { key }, press: { plugin, handle } });
const select = (key: string, handle: number, plugin: string, options: unknown[]): Drawing =>
  ({ type: 'Select', props: { key, options }, press: { plugin, handle } });

const pressesOf = (drawing: unknown): Array<[string, unknown, number]> => {
  const out: Array<[string, unknown, number]> = [];
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const held = node as Drawing;
    const press = held.press as { handle?: number } | undefined;
    if (press !== undefined) out.push([String(held.type), (held.props as Drawing | undefined)?.key, Number(press.handle)]);
    for (const child of (held.children as unknown[] | undefined) ?? []) walk(child);
  };
  walk(drawing);
  return out;
};

const drawing = (plugin: string): Drawing => ({
  type: 'Box',
  props: {},
  children: [
    button('b1', 1, plugin),
    { type: 'Box', props: {}, children: [input('i1', 2, plugin)] },
    select('s1', 3, plugin, [{ value: 'a' }, { value: 'b' }]),
    { type: 'Text', props: {}, children: ['x'] },
    { type: 'Button', props: { key: 'nokey' }, press: { plugin, handle: 4 } },
    button('b2', 7, 'other'),
  ],
});
const identity = { component: 'Fixture', requestId: 'r1', surface: 'terminal' };

describe('the held-press store', () => {
  it('files a drawing under its plugin, component, request and surface key', () => {
    const store = b_();
    assert.equal(_f('probe-fixture', identity), 'probe-fixture\u0000Fixture\u0000r1\u0000terminal');
    const held = store.holdDrawing('p', identity, [{ tag: 'Button', handle: 5, element: 'x' }]);
    assert.deepEqual([...held.hosted.keys()], [5]);
    assert.equal(held.released.length, 0);
    assert.equal(store.heldPressCount(), 1);
    assert.deepEqual(store.holdersOf(identity), ['p']);
  });

  it('answers a press by its hosted handle and only for the element it drew', () => {
    const store = b_();
    const held = store.holdDrawing('p', identity, [{ tag: 'Button', handle: 5, element: 'x' }]);
    const hosted = Number([...held.hosted.values()][0]);
    assert.equal(store.heldPress('p', hosted, 'x')?.element, 'x');
    assert.equal(store.heldPress('p', hosted, 'y'), undefined);
    assert.equal(store.heldPress('q', hosted, 'x'), undefined);
    assert.deepEqual(store.heldPress('p', hosted, ''), store.heldPress('p', hosted, 'x'));
  });

  it('reuses the handle a second drawing of the same plugin drew', () => {
    const store = b_();
    const one = store.holdDrawing('p', identity, [{ tag: 'Button', handle: 5, element: 'x' }]);
    const two = store.holdDrawing('p', { ...identity, requestId: 'r2' }, [{ tag: 'Button', handle: 5, element: 'x' }]);
    assert.equal([...one.hosted.values()][0], [...two.hosted.values()][0]);
    assert.equal(store.heldPressCount(), 1);
    const r1 = store.heldByKeyOf({ tag: 'Button', plugin: 'p', element: 'x', surface: 'terminal', component: 'Fixture', requestId: 'r1' });
    const r2 = store.heldByKeyOf({ tag: 'Button', plugin: 'p', element: 'x', surface: 'terminal', component: 'Fixture', requestId: 'r2' });
    assert.equal(r1, undefined);
    assert.equal(r2?.element, 'x');
  });

  it('reports the hosted buttons of an element and forgets a plugin whole', () => {
    const store = b_();
    const held = store.holdDrawing('p', identity, [{ tag: 'Button', handle: 5, element: 'x' }]);
    const hosted = Number([...held.hosted.values()][0]);
    assert.deepEqual(store.hostedButtonsOf('p', 'x').map((entry) => entry.hosted), [hosted]);
    store.forgetPresses('p');
    assert.equal(store.heldPressCount(), 0);
    assert.deepEqual(store.holdersOf(identity), []);
  });
});

describe('the drawing walkers', () => {
  it('collects the press each pressable element carries', () => {
    assert.deepEqual(XPt(drawing('probe-fixture')), [
      { tag: 'Button', plugin: 'probe-fixture', handle: 1, element: 'b1' },
      { tag: 'Input', plugin: 'probe-fixture', handle: 2, element: 'i1' },
      { tag: 'Select', plugin: 'probe-fixture', handle: 3, element: 's1', options: ['a', 'b'] },
      { tag: 'Button', plugin: 'probe-fixture', handle: 4, element: 'nokey' },
      { tag: 'Button', plugin: 'other', handle: 7, element: 'b2' },
    ]);
  });

  it('ignores a drawing that is not an element and an element with no key', () => {
    assert.deepEqual(XPt(undefined), []);
    assert.deepEqual(XPt([]), []);
    assert.deepEqual(XPt({ type: 'Button', props: {}, press: { plugin: 'p', handle: 1 } }), []);
  });

  it('hosts a drawing and rewrites every press handle', () => {
    const name = 'walk-fixture';
    const uninstall = installFixture(name);
    const hosted = Rto(drawing(name), identity);
    const presses = pressesOf(hosted);
    assert.deepEqual(presses.map((entry) => entry[1]), ['b1', 'i1', 's1', 'nokey', 'b2']);
    for (const [, , handle] of presses) {
      assert.equal(Number.isInteger(handle), true);
      assert.ok(handle >= 0 && handle < S_);
    }
    assert.equal(new Set(presses.map((entry) => entry[2])).size, 5);
    assert.deepEqual(AK.holdersOf(identity), [name, 'other']);
    const b1 = Number(presses[0][2]);
    assert.equal(AK.heldPress(name, b1, 'b1')?.tag, 'Button');
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('rewrites only the handles the mapper names', () => {
    const relabelled = SFs(drawing('p'), (_plugin: string, handle: number) => (handle === 1 ? 100 : undefined));
    assert.deepEqual(pressesOf(relabelled), [
      ['Button', 'b1', 100], ['Input', 'i1', 2], ['Select', 's1', 3], ['Button', 'nokey', 4], ['Button', 'b2', 7],
    ]);
  });

  it('releases the handles a replacement dropped after hosting removed them', () => {
    const name = 'release-fixture';
    const uninstall = installFixture(name);
    Rto(drawing(name), identity);
    releaseLog.handles.length = 0;
    Rto({ type: 'Box', props: {}, children: [input('i1', 2, name)] }, identity);
    assert.deepEqual([...releaseLog.handles].sort((a, b) => a - b), [1, 3, 4]);
    releaseLog.handles.length = 0;
    FM(drawing(name), { type: 'Box', props: {}, children: [input('i1', 2, name)] }, identity);
    assert.deepEqual([...releaseLog.handles].sort((a, b) => a - b), [1, 3, 4]);
    releaseLog.handles.length = 0;
    BM({ type: 'Box', props: {}, children: [input('i1', 2, name)] }, identity);
    assert.deepEqual(releaseLog.handles, [2]);
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });
});

describe('the input and select dispatch', () => {
  it('reads the input argument through the held press and returns what the site kept', async () => {
    const name = 'dispatch-fixture';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing(name), identity);
    const handle = Number(pressesOf(hosted).find((entry) => entry[0] === 'Input')?.[2]);
    const result = await x_({ plugin: name, handle, element: 'i1', ...identity, kind: 'text', value: 'hello' });
    assert.deepEqual(result, { element: 'i1', value: 'hello' });
    assert.deepEqual(pressed.at(-1), {
      handle: 2,
      argument: { plugin: name, element: 'i1', component: 'Fixture', requestId: 'r1', surface: 'terminal', kind: 'text', value: 'hello' },
    });
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('runs a select value the drawing offered and refuses one it did not', async () => {
    const name = 'select-fixture';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing(name), identity);
    const handle = Number(pressesOf(hosted).find((entry) => entry[0] === 'Select')?.[2]);
    const ran = await T_({ plugin: name, handle, element: 's1', ...identity, value: 'a' });
    assert.deepEqual(ran, { element: 's1', value: 'a' });
    assert.deepEqual(pressed.at(-1), {
      handle: 3,
      argument: { plugin: name, element: 's1', component: 'Fixture', requestId: 'r1', surface: 'terminal', value: 'a' },
    });
    const before = pressed.length;
    const refused = await T_({ plugin: name, handle, element: 's1', ...identity, value: 'z' });
    assert.equal(refused, undefined);
    assert.equal(pressed.length, before);
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('finds the held press by its full key when the handle is not the hosted one', async () => {
    const name = 'key-fixture';
    const uninstall = installFixture(name);
    pressed.length = 0;
    Rto(drawing(name), identity);
    const result = await x_({ plugin: name, handle: -1, element: 'i1', ...identity, kind: 'text', value: 'byKey' });
    assert.deepEqual(result, { element: 'i1', value: 'byKey' });
    assert.equal(pressed.at(-1)?.handle, 2);
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('runs nothing when the element is not held', async () => {
    const name = 'absent-fixture';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const result = await x_({ plugin: name, handle: -1, element: 'nope', ...identity, kind: 'text', value: 'none' });
    assert.equal(result, undefined);
    assert.deepEqual(pressed, []);
    uninstall();
  });

  it('queues input and select dispatches behind the plugin and skips unheld ones', async () => {
    const name = 'queue-fixture';
    const uninstall = installFixture(name);
    pressed.length = 0;
    const hosted = Rto(drawing(name), identity);
    const inputHandle = Number(pressesOf(hosted).find((entry) => entry[0] === 'Input')?.[2]);
    const selectHandle = Number(pressesOf(hosted).find((entry) => entry[0] === 'Select')?.[2]);
    assert.deepEqual(
      await UPn({ plugin: name, handle: inputHandle, element: 'i1', ...identity, kind: 'text', value: 'queued' }),
      { element: 'i1', value: 'queued' },
    );
    assert.deepEqual(
      await jPn({ plugin: name, handle: selectHandle, element: 's1', ...identity, value: 'b' }),
      { element: 's1', value: 'b' },
    );
    assert.equal(
      await UPn({ plugin: name, handle: -1, element: 'nope', ...identity, kind: 'text', value: 'no' }),
      undefined,
    );
    assert.equal(
      await ql(
        { plugin: name, handle: inputHandle, element: 'i1' },
        () => (thunk: () => Promise<unknown>) => thunk(),
        (input: { plugin: string }) => Promise.resolve(`ran ${input.plugin}`),
      ),
      `ran ${name}`,
    );
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('answers whether the plugin holds the element', () => {
    const name = 'held-fixture';
    const uninstall = installFixture(name);
    const hosted = Rto(drawing(name), identity);
    const handle = Number(pressesOf(hosted).find((entry) => entry[0] === 'Input')?.[2]);
    assert.equal(k_({ plugin: name, handle, element: 'i1' }), true);
    assert.equal(k_({ plugin: name, handle: -1, element: 'b1' }), true);
    assert.equal(k_({ plugin: name, handle: -1, element: 'nope' }), false);
    AK.forgetPresses(name);
    AK.forgetPresses('other');
    uninstall();
  });

  it('refuses a press for a plugin that is not loaded', async () => {
    const name = 'ghost';
    pressed.length = 0;
    const hosted = Rto({ type: 'Box', props: {}, children: [input('g1', 11, name)] }, identity);
    const handle = Number(pressesOf(hosted)[0]?.[2]);
    await assert.rejects(
      x_({ plugin: name, handle, element: 'g1', ...identity, kind: 'text', value: 'v' }),
      { message: 'ui.input: ghost, which drew g1, is not loaded' },
    );
    assert.deepEqual(pressed, []);
    AK.forgetPresses(name);
  });
});

describe('the press runner table', () => {
  it('keeps one runner per handle and answers whether a handle was released', () => {
    const runners = m_();
    const runner = (): void => {};
    const handle = runners.hold('p', runner);
    assert.ok(handle < 0);
    assert.ok(g_(handle));
    assert.equal(runners.runnerFor('p', handle), runner);
    assert.equal(runners.runnerFor('p', handle - 1), undefined);
    assert.equal(runners.count(), 1);
    runners.release('p', [handle]);
    assert.equal(runners.runnerFor('p', handle), undefined);
    assert.equal(runners.count(), 0);
    assert.equal(g_(0), false);
    assert.equal(Hrt.count(), 0);
  });
});

describe('the press site descriptors', () => {
  const held = { plugin: 'p', requestId: 'r1', surface: 'terminal' };
  const press = { plugin: 'p', element: 'e', component: 'C', requestId: 'r1', surface: 'terminal' };

  it('names the three events the terminal dispatches', () => {
    assert.equal(ya.event, 'ui.press');
    assert.equal(da.event, 'ui.input');
    assert.equal(ha.event, 'ui.select');
    assert.deepEqual(Object.keys(zd), ['ui.press', 'ui.input', 'ui.select']);
    assert.equal(zd['ui.press'], ya);
    assert.equal(zd['ui.input'], da);
    assert.equal(zd['ui.select'], ha);
  });

  it('accepts a press that names its plugin, element, component, request and surface', () => {
    assert.equal(ot(press, held), undefined);
    assert.equal(ot({ ...press, plugin: 'q' }, held), 'a plugin other than the one that drew the element');
    assert.equal(ot({ ...press, element: undefined }, held), 'no { element }');
    assert.equal(ot({ ...press, component: undefined }, held), 'no { component }');
    assert.equal(ot({ ...press, requestId: 'r2' }, held), 'a requestId other than the instance the element was drawn in');
    assert.equal(ot({ ...press, surface: 'watch' }, held), 'no { surface } naming a surface');
    assert.equal(ot({ ...press, link: { href: 'https://x' } }, held), 'a { link } on a press that had none');
    assert.equal(ot({ ...press, link: { href: 1 } }, { ...held, link: { href: 'https://x' } }), 'no { link: { href } } on a press that had one');
    assert.equal(ot({ ...press, link: { href: 'https://y' } }, { ...held, link: { href: 'https://x' } }), undefined);
  });

  it('adds the kind and value checks each site names', () => {
    assert.equal(mn({ ...press, kind: 'text', value: 'v' }, { ...held, kind: 'text' }), undefined);
    assert.equal(mn({ ...press, kind: 'number', value: 'v' }, { ...held, kind: 'text' }), 'a kind other than the text it was given');
    assert.equal(mn({ ...press, kind: 'text', value: 3 }, { ...held, kind: 'text' }), 'no { value } string');
    assert.equal(Cn({ ...press, value: 'v' }, held), undefined);
    assert.equal(Cn({ ...press, value: 3 }, held), 'no { value } string');
  });
});
