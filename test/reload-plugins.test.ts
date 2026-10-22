import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEADLESS_MCP_PENDING_NOTE, RELOAD_PLUGINS_DECLINED, counted, diffPluginServers, formatCacheWarningText,
  lspToolChange, pluginCacheWarning, pluginReloadSummary, pluginServerIdentities, pluralize,
  reloadPluginsForced } from '../src/reload-plugins.js';

test('the pluralizer keeps the singular for one', () => {
  assert.equal(pluralize(0, 'plugin'), 'plugins');
  assert.equal(pluralize(1, 'plugin'), 'plugin');
  assert.equal(pluralize(2, 'plugin'), 'plugins');
  assert.equal(counted(1, 'error'), '1 error');
  assert.equal(counted(3, 'error'), '3 errors');
});

test('a force token anywhere in the argument is accepted', () => {
  assert.equal(reloadPluginsForced(''), false);
  assert.equal(reloadPluginsForced('  '), false);
  assert.equal(reloadPluginsForced('--force'), true);
  assert.equal(reloadPluginsForced('force'), true);
  assert.equal(reloadPluginsForced('--other force'), true);
  assert.equal(reloadPluginsForced('--forced'), false);
});

test('the summary counts every catalog and drops the MCP count when non-interactive', () => {
  const counts = { plugins: 2, skills: 3, agents: 1, hooks: 4, mcpServers: 2, lspServers: 0, errors: 0 };
  assert.equal(pluginReloadSummary(counts),
    'Reloaded: 2 plugins · 3 skills · 1 agent · 4 hooks · 2 plugin MCP servers · 0 plugin LSP servers');
  assert.equal(pluginReloadSummary(counts, { nonInteractive: true }),
    'Reloaded: 2 plugins · 3 skills · 1 agent · 4 hooks · 0 plugin LSP servers');
  assert.equal(pluginReloadSummary({ ...counts, errors: 2 }),
    'Reloaded: 2 plugins · 3 skills · 1 agent · 4 hooks · 2 plugin MCP servers · 0 plugin LSP servers\n'
    + '2 errors during load. Run /plugin for details.');
});

test('the non-interactive pending note follows a changed MCP set', () => {
  const counts = { plugins: 1, skills: 0, agents: 0, hooks: 0, mcpServers: 0, lspServers: 0, errors: 0 };
  assert.equal(pluginReloadSummary(counts, { nonInteractive: true, mcpChanged: true }),
    `Reloaded: 1 plugin · 0 skills · 0 agents · 0 hooks · 0 plugin LSP servers\n${HEADLESS_MCP_PENDING_NOTE}`);
  assert.equal(pluginReloadSummary(counts, { nonInteractive: true, mcpChanged: true }).includes(HEADLESS_MCP_PENDING_NOTE), true);
  assert.equal(pluginReloadSummary(counts, { nonInteractive: false, mcpChanged: true }).includes(HEADLESS_MCP_PENDING_NOTE), false);
});

test('the cache warning names one server by its local segment and several by count', () => {
  assert.equal(formatCacheWarningText({ added: ['plugin:sample:fs'], removed: [], lspToolChange: null }),
    'This reload changes MCP tools (fs) — your next message will re-read '
    + 'the whole conversation instead of using the cache. Run /reload-plugins --force to apply.');
  assert.equal(formatCacheWarningText({ added: [], removed: ['plugin:a:one', 'plugin:a:two'], lspToolChange: null }),
    'This reload changes MCP tools (2 MCP servers) — your next message will re-read '
    + 'the whole conversation instead of using the cache. Run /reload-plugins --force to apply.');
  assert.equal(formatCacheWarningText({ added: [], removed: [], lspToolChange: 'may-add' }),
    'This reload may add the LSP tool — your next message will re-read '
    + 'the whole conversation instead of using the cache. Run /reload-plugins --force to apply.');
  assert.equal(formatCacheWarningText({ added: ['plugin:a:x'], removed: [], lspToolChange: 'may-remove' }),
    'This reload changes MCP tools (x) and may remove the LSP tool — your next message will re-read '
    + 'the whole conversation instead of using the cache. Run /reload-plugins --force to apply.');
});

test('an unchanged catalog has no cache warning', () => {
  const none = { added: [], removed: [], wouldInvalidateCache: false, lspToolChange: null };
  assert.equal(pluginCacheWarning(none, false), null);
  // An interactive session ignores an LSP-only change; a non-interactive one warns.
  const lsp = { added: [], removed: [], wouldInvalidateCache: true, lspToolChange: 'may-add' as const };
  assert.equal(pluginCacheWarning(lsp, false)?.includes('may add the LSP tool'), true);
  assert.equal(pluginCacheWarning(lsp, true)?.includes('may add the LSP tool'), true);
  // A non-interactive session with only an MCP change has nothing to warn about.
  const mcp = { added: ['plugin:a:b'], removed: [], wouldInvalidateCache: true, lspToolChange: null };
  assert.equal(pluginCacheWarning(mcp, true), null);
  assert.equal(pluginCacheWarning(mcp, false)?.includes('changes MCP tools (b)'), true);
});

test('server identities reduce both the source id and the host key to the same pair', () => {
  assert.deepEqual(pluginServerIdentities(['plugin:sample:fs', 'sample/http', 'authored']), [
    { plugin: 'sample', name: 'fs' }, { plugin: 'sample', name: 'http' }, { name: 'authored' },
  ]);
  // A host key and its source spelling compare equal, so a rename is not a change.
  assert.deepEqual(diffPluginServers(['sample/fs'], ['plugin:sample:fs']),
    { added: [], removed: [], wouldInvalidateCache: false });
  assert.deepEqual(diffPluginServers(['sample/fs'], ['sample/fs', 'sample/http']),
    { added: ['sample/http'], removed: [], wouldInvalidateCache: true });
  assert.deepEqual(diffPluginServers(['sample/fs', 'authored'], ['authored']),
    { added: [], removed: ['sample/fs'], wouldInvalidateCache: true });
});

test('the LSP tool change is a presence flip only', () => {
  assert.equal(lspToolChange(false, false), null);
  assert.equal(lspToolChange(true, true), null);
  assert.equal(lspToolChange(false, true), 'may-add');
  assert.equal(lspToolChange(true, false), 'may-remove');
});

test('the declined line names the remote connection', () => {
  assert.equal(RELOAD_PLUGINS_DECLINED, "/reload-plugins isn't available over a remote connection in this session.");
});
