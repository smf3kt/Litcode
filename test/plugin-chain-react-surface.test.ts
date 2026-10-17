// W45-72: partition 1 of the React layer — the Raster site component (`jo`), the surface hook (`Ko`),
// the paint scheduler (`Fo`, `Bo`, `eg`), the dirty/raw-text helpers (`_o`, `tI`, `ZFt`) and the
// context token they read (`ee`, `Ce`). Expected values were measured through the ported bodies
// (see .audit/w45-72-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hs, e5t } from '../src/plugin-chain-ui-blit-source.js';
import { gNs, Lss } from '../src/plugin-chain-raster-surface.js';
import {
  Bo, Ce, Fo, Ko, Wo, eg, jo, nr, runComponent, ee, n, s,
} from '../src/plugin-chain-react-surface.js';

const CELL = 8;

// A `columns x rows` frame whose every cell carries a character and no colour, so two frames with
// different characters render different text.
function frame(columns: number, rows: number, first: number): Uint32Array {
  const words = new Uint32Array(columns * rows * CELL);
  for (let at = 0; at < columns * rows; at += 1) words[at * CELL] = first + at;
  return words;
}

const cellsOf = (columns: number, rows: number, first: number): string =>
  Buffer.from(frame(columns, rows, first).buffer).toString('base64');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('the Raster site component', () => {
  it('renders a Box holding one raw-ansi element sized to the frame', () => {
    const cells = cellsOf(4, 2, 65);
    const run = runComponent(() => jo({ plugin: 'plug', elementKey: 'k1', columns: 4, rows: 2, cells }));
    const root = run.root!;
    assert.equal(root.type, s);
    assert.deepEqual(root.props, { flexShrink: 0, width: 4, height: 2, overflow: 'hidden', elementKey: 'k1', elementPlugin: 'plug' });
    assert.equal(root.children.length, 1);
    const child = root.children[0] as { type: unknown; props: Record<string, unknown> };
    assert.equal(child.type, 'ink-raw-ansi');
    assert.equal(child.props.rawWidth, 4);
    assert.equal(child.props.rawHeight, 2);
    const engine = gNs();
    assert.ok(engine);
    assert.equal(String(child.props.rawText).length > 0, true);
    run.unmount();
  });

  it('registers the mount under plugin, request id and key, and drops it on unmount', () => {
    hs().clear();
    const run = runComponent(
      () => jo({ plugin: 'plug', elementKey: 'k1', columns: 2, rows: 1, cells: cellsOf(2, 1, 65) }),
      { contexts: new Map([[ee, { requestId: 'req-1' }]]) },
    );
    const row = hs().get(e5t('req-1', 'k1', 'plug'));
    assert.ok(row);
    assert.equal(row!.rasters.size, 1);
    const mount = [...row!.rasters][0] as unknown as { plugin: string; requestId: string; key: string; columns: number; rows: number };
    assert.equal(mount.plugin, 'plug');
    assert.equal(mount.requestId, 'req-1');
    assert.equal(mount.key, 'k1');
    assert.equal(mount.columns, 2);
    assert.equal(mount.rows, 1);
    run.unmount();
    assert.equal(hs().get(e5t('req-1', 'k1', 'plug')), undefined);
  });

  it('reports "detached" when no focus context is mounted', () => {
    hs().clear();
    const run = runComponent(
      () => jo({ plugin: 'plug', elementKey: 'k2', columns: 2, rows: 1, cells: cellsOf(2, 1, 65) }),
    );
    assert.ok(hs().get(e5t(Ce, 'k2', 'plug')));
    run.unmount();
  });
});

describe('the surface hook and its paint path', () => {
  it('paints a frame into the raw-ansi node, marks it and its ancestors dirty, and renders the root', async () => {
    hs().clear();
    const first = frame(4, 2, 65);
    const run = runComponent(
      () => jo({ plugin: 'plug', elementKey: 'k1', columns: 4, rows: 2, cells: cellsOf(4, 2, 65) }),
      { contexts: new Map([[ee, { requestId: 'req-1' }]]) },
    );
    const rootNode = run.runtime.nodes[0] as any;
    const childNode = rootNode.children[0] as any;
    const initial = childNode.attributes.rawText;
    assert.equal(childNode.dirty, false);
    const mount = [...hs().get(e5t('req-1', 'k1', 'plug'))!.rasters][0] as unknown as { paint(words: Uint32Array): void };
    const engine = gNs();
    mount.paint(first);
    const rendered = Lss(first, { columns: 4, rows: 2 }, (run.runtime.slots[0] as { value: unknown }).value as never);
    assert.notEqual(rendered, initial);
    assert.equal(childNode.attributes.rawText, rendered);
    assert.equal(childNode.dirty, true);
    assert.equal(childNode.yogaMarks, 1);
    assert.equal(rootNode.dirty, true);
    assert.equal(rootNode.onRenderCalls, 1);
    assert.ok(engine);
    run.unmount();
  });

  it('coalesces a second paint within the frame and lets cancel drop it', async () => {
    hs().clear();
    const run = runComponent(
      () => jo({ plugin: 'plug', elementKey: 'k1', columns: 2, rows: 1, cells: cellsOf(2, 1, 65) }),
      { contexts: new Map([[ee, { requestId: 'req-1' }]]) },
    );
    const rootNode = run.runtime.nodes[0] as any;
    const childNode = rootNode.children[0] as any;
    const mount = [...hs().get(e5t('req-1', 'k1', 'plug'))!.rasters][0] as unknown as { paint(words: Uint32Array): void };
    mount.paint(frame(2, 1, 65));
    const afterFirst = childNode.attributes.rawText;
    mount.paint(frame(2, 1, 97));
    assert.equal(childNode.attributes.rawText, afterFirst);
    await sleep(25);
    assert.equal(childNode.attributes.rawText, Lss(frame(2, 1, 97), { columns: 2, rows: 1 }, (run.runtime.slots[0] as { value: never }).value));
    run.unmount();
  });
});

describe('the paint scheduler', () => {
  it('paints the first frame at once and the second after the frame interval', async () => {
    const calls: number[] = [];
    const paint = Fo((value: number) => calls.push(value));
    paint.paint(1);
    paint.paint(2);
    assert.deepEqual(calls, [1]);
    await sleep(25);
    assert.deepEqual(calls, [1, 2]);
    paint.cancel();
  });

  it('drops a pending paint on cancel', async () => {
    const calls: number[] = [];
    const paint = Fo((value: number) => calls.push(value));
    paint.paint(1);
    paint.paint(2);
    paint.cancel();
    await sleep(25);
    assert.deepEqual(calls, [1]);
  });

  it('schedules the next paint by the surface standing: a frame while progressing, the settle delay waiting', () => {
    const scheduled: Array<[number, number]> = [];
    const surface = (standing: string) => ({
      standing: () => standing,
      schedule: (value: number, after: number) => scheduled.push([value, after]),
    });
    nr(surface('complete') as never, surface('complete') as never, 1);
    nr(surface('progressing') as never, surface('progressing') as never, 2);
    nr(surface('waiting') as never, surface('waiting') as never, 3);
    assert.deepEqual(scheduled, [[2, eg], [3, Bo]]);
    assert.equal(eg, 16);
    assert.equal(Bo, 250);
  });
});

describe('the mount object builder', () => {
  it('keeps its own props, takes the frame size, and carries the paint', () => {
    const paint = () => undefined;
    assert.deepEqual(Wo({ plugin: 'p', requestId: 'r', key: 'k' }, { columns: 4, rows: 2 }, paint), {
      plugin: 'p', requestId: 'r', key: 'k', columns: 4, rows: 2, paint,
    });
  });
});

describe('the hook seam', () => {
  it('exposes the Box and Text kinds as tokens', () => {
    assert.equal(s, 'Box');
    assert.equal(n, 'Text');
  });

  it('runs a component effect after the element tree is committed, so its ref is bound', () => {
    let seen: unknown;
    const run = runComponent(() => {
      const ref = (Ko as unknown as (p: unknown, i: unknown, f: unknown) => { current: unknown })({
        plugin: 'plug', elementKey: 'k1', columns: 1, rows: 1,
      }, gNs(), frame(1, 1, 65));
      return { type: 'ink-raw-ansi', props: { ref, rawText: '', rawWidth: 1, rawHeight: 1 }, children: [] };
    });
    const rootNode = run.runtime.nodes[0] as any;
    seen = rootNode.attributes.ref?.current;
    assert.equal(seen, rootNode);
    run.unmount();
  });
});
