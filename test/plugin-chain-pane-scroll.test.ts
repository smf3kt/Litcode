import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { scrollSites, siteKey } from '../src/plugin-chain-scroll-focus.js';
import {
  dispatchScroll,
  keyRows,
  paneScrollHost,
  paneScrollProps,
  scrollKeyMap,
  wheelPointerOptions,
} from '../src/plugin-chain-pane-scroll.js';

/** The site `RFe` files in the registry: the scroll site's own fields plus the pane's. */
interface PaneSite {
  component: string;
  requestId: string;
  owner?: string;
  bodyRows: number;
  contentRows: number;
  maxOffset: number;
  offset(): number;
  keyRows(plugin: string, elementKey: unknown): { top: number; bottom: number } | undefined;
  commit(offset: number, origin: { kind: string; name?: string }): boolean;
  followEnd(): void;
}

/** What `RFe` returns for one pane. */
interface PaneHostResult {
  offset: number;
  bodyRows: number;
  contentRows: number;
  maxOffset: number;
  placed: number;
  raised: number;
  scrollBy(rows: number): void;
  place(next: (offset: number) => number): void;
}

interface FakeNode {
  nodeName: string;
  attributes: { elementKey?: unknown; elementPlugin?: unknown };
  parentNode?: FakeNode;
  childNodes: FakeNode[];
  yogaNode: { getComputedTop(): number; getComputedHeight(): number };
}

function fakeNode(
  nodeName: string,
  attributes: FakeNode['attributes'],
  top: number,
  height: number,
): FakeNode {
  return {
    nodeName,
    attributes,
    childNodes: [],
    yogaNode: { getComputedTop: () => top, getComputedHeight: () => height },
  };
}

function attach(parent: FakeNode, child: FakeNode): FakeNode {
  child.parentNode = parent;
  parent.childNodes.push(child);
  return child;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

afterEach(() => {
  scrollSites().clear();
  clearChainRecords();
});

test('dispatchScroll refuses when no site is filed under the key', async () => {
  const result = await dispatchScroll({
    input: {
      component: 'Pane',
      requestId: 'missing',
      offset: 3,
      by: 1,
      bodyRows: 10,
      contentRows: 20,
      origin: { kind: 'person' },
    },
  });

  assert.deepEqual(result, { deny: 'no such site' });
  assert.ok(
    chainRecords().some(
      (record) => record.kind === 'log'
        && record.message === 'ui.scroll Pane missing (person) by 1 to 3: denied (no such site)',
    ),
  );
});

test('dispatchScroll runs the site commit and reports the move', async () => {
  const committed: unknown[] = [];
  scrollSites().set(siteKey('Pane', 'p1'), {
    commit: (offset, origin) => {
      committed.push({ offset, origin });
      return true;
    },
  });

  const result = await dispatchScroll({
    input: {
      component: 'Pane',
      requestId: 'p1',
      offset: 7,
      by: 4,
      bodyRows: 10,
      contentRows: 20,
      origin: { kind: 'person' },
    },
  });

  assert.deepEqual(result, {});
  assert.deepEqual(committed, [{ offset: 7, origin: { kind: 'person' } }]);
  assert.ok(
    chainRecords().some(
      (record) => record.kind === 'log'
        && record.message === 'ui.scroll Pane p1 (person) by 4 to 7: moved',
    ),
  );
});

test('dispatchScroll passes the site refusal through', async () => {
  scrollSites().set(siteKey('Pane', 'p2'), { commit: () => false });

  const result = await dispatchScroll({
    input: {
      component: 'Pane',
      requestId: 'p2',
      offset: 1,
      by: 1,
      bodyRows: 10,
      contentRows: 20,
      origin: { kind: 'person' },
    },
  });

  assert.deepEqual(result, { deny: 'the window moved meanwhile' });
});

test('dispatchScroll refuses a plugin call to another plugin\'s site', async () => {
  let committed = false;
  scrollSites().set(siteKey('Pane', 'p3'), {
    owner: 'other',
    commit: () => {
      committed = true;
      return true;
    },
  });

  const result = await dispatchScroll({
    input: {
      component: 'Pane',
      requestId: 'p3',
      offset: 1,
      by: 1,
      bodyRows: 10,
      contentRows: 20,
      origin: { kind: 'plugin', name: 'mine' },
    },
  });

  assert.deepEqual(result, { deny: 'not this plugin\'s site' });
  assert.equal(committed, false);
});

test('paneScrollHost registers its site and clamps every move', () => {
  const content: { current: unknown } = { current: null };
  const run = runComponent(() => paneScrollHost({
    component: 'Pane',
    requestId: 'p1',
    content,
    bodyRows: 3,
    contentRows: 10,
    maxOffset: 7,
  }));
  const host = run.result as unknown as PaneHostResult;

  assert.equal(host.offset, 0);
  assert.equal(host.bodyRows, 3);
  assert.equal(host.contentRows, 10);
  assert.equal(host.maxOffset, 7);
  assert.equal(host.placed, 0);
  assert.equal(host.raised, 0);

  const site = scrollSites().get(siteKey('Pane', 'p1')) as unknown as PaneSite;
  assert.ok(site);
  assert.equal(site.component, 'Pane');
  assert.equal(site.requestId, 'p1');
  assert.equal(site.offset(), 0);

  assert.equal(site.commit(4, { kind: 'person' }), true);
  assert.equal(site.offset(), 4);

  assert.equal(site.commit(99, { kind: 'person' }), true);
  assert.equal(site.offset(), 7);

  assert.equal(site.commit(3, { kind: 'plugin', name: 'mine' }), true);
  assert.equal(site.offset(), 3);

  site.followEnd();
  assert.equal(site.offset(), 7);
  assert.equal(site.commit(2, { kind: 'plugin', name: 'mine' }), true);
  assert.equal(site.offset(), 2);

  run.unmount();
  assert.equal(scrollSites().has(siteKey('Pane', 'p1')), false);
});

test('the registered site looks up the key rows under the pane content', () => {
  const root = fakeNode('root', {}, 0, 0);
  const child = attach(root, fakeNode('box', { elementKey: 'k1', elementPlugin: 'plug' }, 2, 4));
  const content = { current: root as unknown };
  const run = runComponent(() => paneScrollHost({
    component: 'Pane',
    requestId: 'p2',
    content,
    bodyRows: 3,
    contentRows: 10,
    maxOffset: 7,
  }));

  const site = scrollSites().get(siteKey('Pane', 'p2')) as unknown as PaneSite;
  assert.deepEqual(site.keyRows('plug', 'k1'), { top: 2, bottom: 6 });
  assert.equal(site.keyRows('other', 'k1'), undefined);
  assert.equal(site.keyRows('plug', 'missing'), undefined);
  assert.equal(child.parentNode, root);

  run.unmount();
});

test('scrollBy raises ui.scroll and clamps to the max offset', async () => {
  const run = runComponent(() => paneScrollHost({
    component: 'Pane',
    requestId: 'p3',
    content: { current: null },
    bodyRows: 3,
    contentRows: 10,
    maxOffset: 5,
  }));
  const host = run.result as unknown as PaneHostResult;
  const site = scrollSites().get(siteKey('Pane', 'p3')) as unknown as PaneSite;

  host.scrollBy(2);
  await settle();
  assert.equal(site.offset(), 2);
  assert.ok(
    chainRecords().some(
      (record) => record.kind === 'log'
        && record.message === 'ui.scroll Pane p3 (person) by 2 to 2: moved',
    ),
  );

  host.scrollBy(10);
  await settle();
  assert.equal(site.offset(), 5);
  assert.ok(
    chainRecords().some(
      (record) => record.kind === 'log'
        && record.message === 'ui.scroll Pane p3 (person) by 10 to 5: moved',
    ),
  );

  run.unmount();
});

test('paneScrollProps merges the settled offset into the element scroll prop', () => {
  const element = {
    type: 'box',
    props: { scroll: { offset: 0, sticky: true }, id: 'pane' },
    children: [],
  };
  const run = runComponent(() => paneScrollProps(element, { offset: 5, raised: 1 }));

  assert.deepEqual(run.result, {
    type: 'box',
    props: { scroll: { offset: 5, sticky: true }, id: 'pane' },
    children: [],
  });
});

test('scrollKeyMap maps the six scroll commands', () => {
  const moves: number[] = [];
  const keys = scrollKeyMap({
    bodyRows: 3,
    contentRows: 10,
    scrollBy: (rows) => moves.push(rows),
  });

  keys['pane:scrollUp']();
  keys['pane:scrollDown']();
  keys['pane:pageUp']();
  keys['pane:pageDown']();
  keys['pane:top']();
  keys['pane:bottom']();

  assert.deepEqual(moves, [-1, 1, -3, 3, -10, 10]);
});

test('wheelPointerOptions turns a wheel event into a layout-relative pointer', () => {
  const pointer = wheelPointerOptions({ current: { cachedLayout: { x: 2, y: 5 } } });

  assert.deepEqual(pointer({ col: 4, row: 7 }), { column: 2, row: 2 });
  assert.equal(pointer({ row: 7 }), undefined);
  assert.equal(pointer({ col: 4 }), undefined);
  assert.equal(wheelPointerOptions({ current: null })({ col: 4, row: 7 }), undefined);
});

test('keyRows sums the tops from the matching node up to the root', () => {
  const root = fakeNode('root', {}, 0, 0);
  const outer = attach(root, fakeNode('box', { elementKey: 'k1', elementPlugin: 'plug' }, 2, 3));
  attach(outer, fakeNode('box', { elementKey: 'inner' }, 1, 2));
  attach(root, fakeNode('#text', { elementKey: 'k1', elementPlugin: 'plug' }, 9, 9));

  assert.deepEqual(keyRows(root, 'k1', 'plug'), { top: 2, bottom: 5 });
  assert.deepEqual(keyRows(root, 'inner', 'plug'), { top: 3, bottom: 5 });
  assert.deepEqual(keyRows(root, 'inner', undefined), { top: 3, bottom: 5 });
  assert.equal(keyRows(root, 'k1', 'other'), undefined);
  assert.equal(keyRows(root, 'missing', 'plug'), undefined);
});
