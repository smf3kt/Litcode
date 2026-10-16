// The custom-theme loader's reader path (W45-25). `P` (chunk-6yqf5ttk.js [3829,5631), carried in
// src/tui-custom-theme-source.ts) reaches four names that file never declared: `Wi`/`Yf` (the paging
// driver and its cap), `Fe` (the namespace-key table it builds the batched read with) and `gt`/`i`
// (the error text its warnings carry). Those lines run only when the loader is handed a reader, which
// is the path the file-system tests never take, so this test drives it and pins each name's output.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { initializeCustomThemes } from '../src/tui-custom-theme-source.js';

const PAGE = { namespace: 'userConfigDir', dir: 'themes' };

/** The store `T_t` commits through, and the warnings the loader reports. */
function store(cached: unknown[] = []) {
  const committed: unknown[][] = [];
  return {
    committed,
    api: {
      cachedUserThemes: () => cached,
      commitUserThemes: (themes: unknown[]) => { committed.push(themes); },
    },
  };
}

function warnings(): { sink: string[]; api: (message: string) => void } {
  const sink: string[] = [];
  return { sink, api: (message: string) => { sink.push(message); } };
}

test('theme reader: a paged key list is read in one batch through Fe\'s key shape', async () => {
  const seen: string[] = [];
  const { sink, api } = warnings();
  const { committed, api: storeApi } = store();
  const reader = {
    listEntries: async (namespace: unknown, options: unknown) => {
      seen.push(JSON.stringify([namespace, options ?? null]));
      return {
        ok: true,
        value: {
          items: [
            { kind: 'key', key: { namespace: 'userConfigDir', relPath: ['ocean.json'] }, size: 64 },
            // Not a key, not `.json`, and over the 256KB limit: each is skipped where the source skips it.
            { kind: 'dir', key: { namespace: 'userConfigDir', relPath: ['nested'] }, size: 0 },
            { kind: 'key', key: { namespace: 'userConfigDir', relPath: ['notes.txt'] }, size: 10 },
            { kind: 'key', key: { namespace: 'userConfigDir', relPath: ['huge.json'] }, size: 262145 },
          ],
        },
      };
    },
    read: async (paths: unknown) => {
      seen.push(JSON.stringify(paths));
      return { ok: true, value: { items: [{ found: true, value: JSON.stringify({ name: 'Ocean', base: 'light', overrides: { text: '#112233' } }) }] } };
    },
  };

  const parser = initializeCustomThemes({ be: () => '/root', BU: () => storeApi, t: api });
  await parser.load(reader);

  assert.deepEqual(JSON.parse(seen[0]!), [PAGE, null], 'the first page asks for the themes directory');
  assert.deepEqual(JSON.parse(seen[1]!), [{ namespace: 'userConfigDir', dir: 'themes', relPath: ['ocean.json'] }],
    'the batched read uses Fe.userConfigDir\'s own shape');
  assert.deepEqual(committed.at(-1), [{ slug: 'ocean', name: 'Ocean', base: 'light', overrides: { text: '#112233' }, source: 'user' }]);
  assert.deepEqual(sink, ['[theme] /root/themes/huge.json exceeds 256KB; skipping']);
});

test('theme reader: an error page, a page cap and a throwing reader keep the cached themes', async () => {
  const { sink, api } = warnings();
  const cached = [{ slug: 'kept', name: 'Kept', base: 'dark', overrides: {}, source: 'user' }];
  const { committed, api: storeApi } = store(cached);
  const parser = initializeCustomThemes({ be: () => '/root', BU: () => storeApi, t: api });

  // `Wi` reports a failed page as `{status:"error"}`, and `gt` writes its code, failure class and cause.
  await parser.load({
    listEntries: async () => ({ ok: false, error: { code: 'EACCES', failureClass: 'fs', cause: new Error('inner') } }),
    read: async () => ({ ok: true, value: { items: [] } }),
  });
  assert.deepEqual(sink, ['[theme] list themes failed: EACCES fs: inner; keeping the previously loaded themes (if any)']);
  assert.deepEqual(committed.at(-1), cached, 'a failed list falls back to the cached themes');

  // A cursor that never ends runs `Wi` to its own cap, and the warning names it.
  sink.length = 0;
  let pages = 0;
  await parser.load({
    listEntries: async () => { pages++; return { ok: true, value: { items: [], cursor: 'more' } }; },
    read: async () => ({ ok: true, value: { items: [] } }),
  });
  assert.equal(pages, 10000, 'the paging driver stops at the cap');
  assert.deepEqual(sink, ['[theme] list themes exceeded 10000 pages; keeping the previously loaded themes (if any)']);
  assert.deepEqual(committed.at(-1), cached);

  // A reader that throws is caught before `Wi` sees a page.
  sink.length = 0;
  await parser.load({
    listEntries: async () => { throw new Error('boom'); },
    read: async () => ({ ok: true, value: { items: [] } }),
  });
  assert.deepEqual(sink, ['[theme] list themes failed: boom; keeping the previously loaded themes (if any)']);
  assert.deepEqual(committed.at(-1), cached);

  // No reader at all is the file-system path: the paging driver is not reached.
  const listings = sink.length;
  await parser.load(undefined);
  assert.equal(sink.length, listings);
});
