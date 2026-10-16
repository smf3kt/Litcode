// W45-71: the `ui.scroll` and `ui.focus` call entries. Every expected value below was measured through
// the ported bodies before it was written (see .audit/w45-71-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { it as registry, zd } from '../src/plugin-chain-host.js';
import {
  FOCUS_CALL_ARGUMENTS, FOCUS_SITE, SCROLL_CALL_ARGUMENTS, SCROLL_SITE, elementCheck, siteAnswerCheck,
} from '../src/plugin-chain-scroll-focus-sites.js';
import {
  FOCUS_ENTRY, SCROLL_ENTRY, focusCall, focusCallIsForwarded, focusSiteFor, focusSites,
  otherHolderHasKeyboard, scrollCall, scrollCallIsForeign, scrollSiteFor, scrollSites, siteKey,
} from '../src/plugin-chain-scroll-focus.js';
import type { PluginFocusSite, PluginScrollSite } from '../src/plugin-chain-scroll-focus.js';

type Registry = {
  scrollSites: Map<string, PluginScrollSite>;
  focusSites: Map<string, PluginFocusSite>;
  zd?: Record<string, unknown>;
};
const state = () => registry() as unknown as Registry;
const plugin = (name: string) => ({ kind: 'plugin', name });

const scrollSite = (over: Partial<PluginScrollSite> = {}): PluginScrollSite => ({
  owner: 'p1', commit: () => true, ...over,
});
const focusSite = (over: Partial<PluginFocusSite> = {}): PluginFocusSite => ({
  owner: 'p1', commit: () => undefined, isHeldNow: () => true, holderNow: () => undefined, ...over,
});

describe('the two site registries', () => {
  it('are the maps the registry state holds, and a site is filed under its component and request id', () => {
    state().scrollSites = new Map();
    state().focusSites = new Map();
    assert.equal(scrollSites(), state().scrollSites);
    assert.equal(focusSites(), state().focusSites);
    assert.equal(siteKey('button', 'r1'), 'button:r1');
    assert.equal(siteKey('a', 'b:c'), 'a:b:c');
    assert.equal(siteKey('', ''), ':');
  });

  it('answers nothing for a key no site is filed under', () => {
    state().scrollSites = new Map();
    state().focusSites = new Map();
    assert.equal(scrollSiteFor({ component: 'x', requestId: 'y' }), undefined);
    assert.equal(focusSiteFor({ component: 'x', requestId: 'y' }), undefined);
  });

  it('finds the site a call names', () => {
    const site = scrollSite();
    state().scrollSites = new Map([[siteKey('button', 'r1'), site]]);
    assert.equal(scrollSiteFor({ component: 'button', requestId: 'r1' }), site);
    assert.equal(scrollSiteFor({ component: 'button', requestId: 'r2' }), undefined);
  });
});

describe('the scroll call', () => {
  it('commits and answers nothing when the site lets the window move', () => {
    const site = scrollSite({ commit: (offset, origin) => offset === 3 && origin !== undefined });
    state().scrollSites = new Map([[siteKey('button', 'r1'), site]]);
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'r1', offset: 3, origin: plugin('p1') }), {});
  });

  it('refuses a call for a site that is not there, and one for a site another plugin owns', () => {
    state().scrollSites = new Map([[siteKey('button', 'r2'), scrollSite({ owner: 'owner' })]]);
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'nope', offset: 3, origin: plugin('p1') }),
      { deny: 'no such site' });
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'r2', offset: 3, origin: plugin('p1') }),
      { deny: "not this plugin's site" });
  });

  it('lets an editor call and a call for an unowned site through', () => {
    state().scrollSites = new Map([
      [siteKey('button', 'r3'), scrollSite({ commit: () => true })],
      [siteKey('button', 'r4'), scrollSite({ owner: 'p1', commit: () => true })],
    ]);
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'r3', offset: 3, origin: plugin('p1') }), {});
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'r4', offset: 3, origin: { kind: 'editor', name: 'e1' } }), {});
  });

  it('answers the site own sentence when the window moved meanwhile', () => {
    state().scrollSites = new Map([[siteKey('button', 'r5'), scrollSite({ commit: () => false })]]);
    assert.deepEqual(scrollCall({ component: 'button', requestId: 'r5', offset: 3, origin: plugin('p1') }),
      { deny: 'the window moved meanwhile' });
  });

  it('holds the ownership check the body reads', () => {
    assert.equal(scrollCallIsForeign(scrollSite({ owner: 'p1' }), plugin('p2')), true);
    assert.equal(scrollCallIsForeign(scrollSite({ owner: 'p1' }), plugin('p1')), false);
    assert.equal(scrollCallIsForeign(scrollSite({ owner: undefined }), plugin('p2')), false);
    assert.equal(scrollCallIsForeign(scrollSite({ owner: 'p1' }), { kind: 'editor', name: 'p2' }), false);
  });
});

describe('the focus call', () => {
  it('commits and answers nothing when the site holds the keyboard for this plugin', () => {
    state().focusSites = new Map([[siteKey('input', 'r1'), focusSite()]]);
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1') }), {});
  });

  it('refuses a call for a site that is not there', () => {
    state().focusSites = new Map();
    assert.deepEqual(focusCall({ component: 'input', requestId: 'nope', plugin: 'p1', origin: plugin('p1') }),
      { deny: 'no such site' });
  });

  it('refuses a forwarded call for a site another plugin owns, and lets the same plugin touch it directly', () => {
    state().focusSites = new Map([[siteKey('input', 'r2'), focusSite({ owner: 'owner' })]]);
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r2', plugin: 'p1', origin: plugin('p2') }),
      { deny: "not this plugin's site" });
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r2', plugin: 'p1', origin: plugin('p1') }), {});
  });

  it('refuses when the site does not hold the keyboard, and when another element does', () => {
    state().focusSites = new Map([
      [siteKey('input', 'r3'), focusSite({ isHeldNow: () => false })],
      [siteKey('input', 'r4'), focusSite({ holderNow: () => 'p2' })],
    ]);
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r3', plugin: 'p1', origin: plugin('p1') }),
      { deny: 'that site does not hold the keyboard' });
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r4', plugin: 'p1', origin: plugin('p1') }),
      { deny: "another plugin's element holds the keyboard" });
  });

  it('passes the site own refusal through, and lets the origin holder through', () => {
    state().focusSites = new Map([
      [siteKey('input', 'r5'), focusSite({ commit: () => 'the element refused' })],
      [siteKey('input', 'r6'), focusSite({ holderNow: () => 'p1' })],
    ]);
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r5', plugin: 'p1', origin: plugin('p1') }),
      { deny: 'the element refused' });
    assert.deepEqual(focusCall({ component: 'input', requestId: 'r6', plugin: 'p1', origin: plugin('p1') }), {});
  });

  it('holds the forwarded-call check and the keyboard check the body reads', () => {
    assert.equal(focusCallIsForwarded(focusSite({ owner: 'owner' }), { plugin: 'p1', origin: plugin('p2') }), true);
    assert.equal(focusCallIsForwarded(focusSite({ owner: 'p1' }), { plugin: 'p1', origin: plugin('p1') }), false);
    assert.equal(focusCallIsForwarded(focusSite({ owner: 'p2' }), { plugin: 'p2', origin: plugin('p2') }), false);
    assert.equal(focusCallIsForwarded(focusSite({ owner: 'p1' }), { plugin: 'p2', origin: { kind: 'editor', name: 'e' } }), false);
    assert.equal(otherHolderHasKeyboard(focusSite({ holderNow: () => 'p2' }), plugin('p1')), true);
    assert.equal(otherHolderHasKeyboard(focusSite({ holderNow: () => 'p1' }), plugin('p1')), false);
    assert.equal(otherHolderHasKeyboard(focusSite({ holderNow: () => undefined }), plugin('p1')), false);
    assert.equal(otherHolderHasKeyboard(focusSite({ holderNow: () => 'p2' }), { kind: 'editor', name: 'e' }), false);
  });
});

describe('the two site descriptors', () => {
  it('are filed in the host seam site table under their event names', () => {
    assert.equal(SCROLL_SITE.event, 'ui.scroll');
    assert.equal(FOCUS_SITE.event, 'ui.focus');
    assert.equal(zd['ui.scroll'], SCROLL_SITE);
    assert.equal(zd['ui.focus'], FOCUS_SITE);
    assert.deepEqual(FOCUS_CALL_ARGUMENTS, ['component', 'requestId', 'plugin', 'origin']);
    assert.deepEqual(SCROLL_CALL_ARGUMENTS,
      ['component', 'requestId', 'by', 'bodyRows', 'contentRows', 'origin', 'pointer']);
  });

  it('hold a focus call to its element and to an envelope a rewrite may not change', () => {
    const call = { component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1'), element: 'el' };
    assert.equal(FOCUS_SITE.checkArgument(call, call), undefined);
    assert.equal(FOCUS_SITE.checkArgument({ ...call, element: 5 }, call),
      'an element that is not a non-empty string');
    assert.equal(FOCUS_SITE.checkArgument({ ...call, plugin: 'other' }, call),
      "a changed plugin (the envelope is the engine's; a rewrite keeps component, requestId, plugin, origin)");
    assert.equal(FOCUS_SITE.checkArgument({ ...call, junk: 1 }, call), undefined);
  });

  it('hold a scroll call to a whole row offset, and never restore it', () => {
    const call = {
      component: 'button', requestId: 'r1', by: 3, bodyRows: 10, contentRows: 20,
      origin: plugin('p1'), pointer: 1, offset: 2,
    };
    assert.equal(SCROLL_SITE.checkArgument(call, call), undefined);
    assert.equal(SCROLL_SITE.checkArgument({ ...call, offset: 1.5 }, call),
      'an offset that is not a whole row number (0 or more)');
    assert.equal(SCROLL_SITE.checkArgument({ ...call, offset: -1 }, call),
      'an offset that is not a whole row number (0 or more)');
    assert.deepEqual(SCROLL_SITE.restoreArgument({ ...call, offset: 9 }, {}), { ...call, offset: 9 });
  });

  it('answer the check both sites share: a refusal has to be a non-empty string', () => {
    const call = { component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1'), element: 'el' };
    assert.equal(siteAnswerCheck({}, call, []), undefined);
    assert.equal(siteAnswerCheck({ deny: 'no' }, call, []), undefined);
    assert.equal(siteAnswerCheck({ deny: '' }, call, []), 'a deny that is not a non-empty string');
    assert.equal(SCROLL_SITE.check(undefined, call, []), 'something that is not a result object');
  });

  it('read the element check both directions', () => {
    assert.equal(elementCheck('el', undefined), "an element where the move named none (one of the engine's stops)");
    assert.equal(elementCheck(undefined, 'el'), 'no element where the move named one (a rewrite names another)');
    assert.equal(elementCheck(undefined, undefined), undefined);
    assert.equal(elementCheck('', ''), 'an element that is not a non-empty string');
  });
});

describe('the two entries', () => {
  it('attach the site the host seam table holds to a core handler that is the body', async () => {
    state().scrollSites = new Map([[siteKey('button', 'r1'), scrollSite({ commit: () => true })]]);
    state().focusSites = new Map([[siteKey('input', 'r1'), focusSite()]]);
    assert.equal(SCROLL_ENTRY.site, zd['ui.scroll']);
    assert.equal(FOCUS_ENTRY.site, zd['ui.focus']);
    assert.equal(SCROLL_ENTRY.core.name, 'core');
    assert.equal(SCROLL_ENTRY.core.isCore, true);
    assert.equal(SCROLL_ENTRY.core.budgetMs, 0);
    assert.deepEqual(await SCROLL_ENTRY.core.run({ component: 'button', requestId: 'r1', offset: 7, origin: plugin('p1') }), {});
    assert.deepEqual(await FOCUS_ENTRY.core.run({ component: 'input', requestId: 'r1', plugin: 'p1', origin: plugin('p1') }), {});
  });

  it('refuse through the handler the way the body refuses', async () => {
    state().scrollSites = new Map();
    assert.deepEqual(await SCROLL_ENTRY.core.run({ component: 'nope', requestId: 'nope', offset: 1, origin: plugin('p1') }),
      { deny: 'no such site' });
  });
});
