// The `$` table's ui.notify entry (W45-57). The floor is ported verbatim — `{check:Dzo,stamp:Fzo,run:Nzo}`
// from the source's table literal in chunk-sfn1dbxq.js — and the bodies are the copy's
// `src/plugin-chain-ui-source.ts` (Dzo/qQt/Nzo/Fzo at [2338792,2339663) and the committed flag `wn` at
// chunk-r2vtj1kh.js [150398,150468)). Assertions are written from the measurement probe.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindPluginSession, raiseUiCall, uiCallTable } from '../src/plugin-chain-ui.js';
import { Dzo, Fzo, Ia, Nzo, wn } from '../src/plugin-chain-ui-source.js';

const caller = { plugin: 'tips', origin: [] };

/** Bind a session whose only surface is the notify write, and answer the unbind. */
function withNotify(notify: unknown): () => void {
  return bindPluginSession({ status: () => void 0, toast: () => void 0, notify } as never);
}

test('the table carries the notify entry beside the four ui names', () => {
  const table = uiCallTable();
  assert.equal(Object.keys(table).sort().join(','), 'ui.blit,ui.log,ui.notify,ui.selection,ui.status,ui.toast');
  assert.equal(Object.keys(table['ui.notify']).sort().join(','), 'check,run,stamp',
    'the entry keeps the source\'s third field, which this seam models rather than records');
  assert.equal(typeof table['ui.notify'].run, 'function');
});

test('the check reads only the text and, when given, the title', () => {
  assert.equal(Dzo({ text: 'hi' }), undefined);
  assert.equal(Dzo({ text: 'hi', title: 'T' }), undefined);
  assert.equal(Dzo({ text: 'hi', title: undefined }), undefined);
  assert.equal(Dzo({ text: 'hi', title: 7 }), 'title is a string, when given');
  assert.equal(Dzo({}), 'takes a string text', 'a missing text is refused by the same text check');
  assert.equal(Dzo({ text: 7 }), 'takes a string text');
  assert.equal(Dzo(undefined), 'takes a string text', 'the optional chain leaves the text undefined');
});

test('the stamp fills an absent title with the plugin name', () => {
  assert.deepEqual(Fzo({ text: 'hi' }, caller), { text: 'hi', title: 'tips' });
  assert.deepEqual(Fzo({ text: 'hi', title: 'T' }, caller), { text: 'hi', title: 'T' });
  assert.deepEqual(Fzo({ text: 'hi', title: '' }, caller), { text: 'hi', title: 'tips' },
    'an empty title is falsy, so it is replaced too');
  assert.deepEqual(Fzo({ text: 'hi', extra: 1 }, caller), { text: 'hi', extra: 1, title: 'tips' });
});

test('the run maps the channel the session answers with', async () => {
  assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: false, reason: 'no-surface' },
    'with no session bound the floor answers the no-surface reason');
  for (const channel of ['iterm2', 'iterm2_with_bell', 'kitty', 'ghostty', 'terminal_bell']) {
    const unbind = withNotify(async () => channel);
    try {
      assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: true, channel });
    } finally { unbind(); }
  }
  const disabled = withNotify(async () => 'disabled');
  try { assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: false, reason: 'disabled' }); }
  finally { disabled(); }
  for (const channel of ['none', 'no_method_available']) {
    const unbind = withNotify(async () => channel);
    try { assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: false, reason: 'no-channel' }); }
    finally { unbind(); }
  }
  const undefinedAnswer = withNotify(async () => void 0);
  try {
    assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: false, reason: 'no-surface' },
      'a session that answers nothing is the same no-surface the absent session is');
  } finally { undefinedAnswer(); }
});

test('an error channel throws the source\'s own error, and any other answer is its own hole', async () => {
  const unbind = withNotify(async () => 'error');
  try {
    await assert.rejects(() => Nzo({ text: 'hi' }, caller), (error: unknown) => {
      assert.equal((error as Error).name, 'HooksError', 'the class sets its own name, minified class name is He');
      assert.equal((error as Error).constructor.name, 'He');
      assert.equal((error as Error).message, 'tips: $.ui.notify: the channel\'s write failed');
      return true;
    });
  } finally { unbind(); }
  // `qQt`'s switch has no default: a channel name it does not know answers `undefined`, and the log
  // line the floor builds then reads `.isSent` of it. Measured rather than smoothed over — the source
  // has the same hole, and its own channel list is the five names above plus these four.
  const unknown = withNotify(async () => 'weird');
  try {
    await assert.rejects(() => Nzo({ text: 'hi' }, caller), TypeError);
  } finally { unknown(); }
});

test('the request the session receives is the source\'s own shape', async () => {
  const seen: unknown[] = [];
  const unbind = withNotify(async (request: unknown, origin: unknown) => (seen.push({ request, origin }), 'kitty'));
  try {
    assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: true, channel: 'kitty' });
    assert.deepEqual(seen, [{
      request: { message: 'hi', title: 'tips', notificationType: 'plugin_notification' },
      origin: [],
    }], 'the run fills an absent title itself, so the stamp is not needed for the title to be set');
  } finally { unbind(); }
});

test('the committed flag answers no-surface without touching the session', async () => {
  assert.equal(wn(), false, 'a fresh process has not committed its surface');
  let calls = 0;
  const unbind = withNotify(async () => (calls++, 'kitty'));
  try {
    assert.equal(Ia, Ia, 'the flag is the module singleton the copied `wn` reads');
    Ia.committed = true;
    assert.equal(wn(), true);
    assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: false, reason: 'no-surface' });
    assert.equal(calls, 0, 'the session is never asked once the surface is committed');
  } finally {
    Ia.committed = false;
    unbind();
  }
  const after = withNotify(async () => 'kitty');
  try { assert.deepEqual(await Nzo({ text: 'hi' }, caller), { isSent: true, channel: 'kitty' }); }
  finally { after(); }
});

test('the seam raises the entry, and its hookless path runs the floor without the check', async () => {
  const unbind = withNotify(async () => 'ghostty');
  try {
    assert.deepEqual(await raiseUiCall({ event: 'ui.notify', args: { text: 'hi' }, caller: caller as never }),
      { isSent: true, channel: 'ghostty' });
    // `Hze` runs `bottom.check` only when hooks are registered ahead of the floor; with none, the run
    // is the whole dispatch, so a bad title still reaches it. Measured, and the same is true of the
    // other entries this seam raises.
    assert.deepEqual(await raiseUiCall({ event: 'ui.notify', args: { text: 'hi', title: 7 }, caller: caller as never }),
      { isSent: true, channel: 'ghostty' });
  } finally { unbind(); }
});
