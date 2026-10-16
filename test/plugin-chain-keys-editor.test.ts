// The keybinding editor (W45-67). The bodies are the copy's src/plugin-chain-keys-editor-source.ts
// (chunk-6ccen3s8.js [8839,9463), [9463,9546), [10621,10997), [10997,11037), [11145,11530), [11530,11563),
// [16567,16624), [16624,17524), [18783,18864), [19738,19801), [19801,19849), [19849,19900), plus the lazy
// registry `i`/`RTr`/`p` from chunk-fdwn5gdv.js [615,965)) and the seven schema names bound in
// src/plugin-chain-schema-aliases.ts. Assertions are written from the measurement probe
// .audit/w45-67-probe.ts and .audit/w45-67-probe-b.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindHostPlatform } from '../src/plugin-chain-fs-boundaries.js';
import {
  blockPassesRuntimeSchema, documentPassesRuntimeSchema, isActionOrCommand, isKnownContext,
  isLegacyAction, keyBindingBlockSchema, keyBindingsFileSchema, KEY_CONTEXT_SET, KEY_CONTEXTS, LAZY,
  LEGACY_ACTION_NAMES, LEGACY_ACTION_READ_AS, parseKeyBinding, reservedKeysForPlatform,
  runtimeKeyBindingBlockSchema, SCHEMA_REGISTRY, splitChord,
} from '../src/plugin-chain-keys-editor.js';
import { normalizeKey } from '../src/plugin-chain-keys.js';

test('a key is taken apart into the record a binding is stored as', () => {
  assert.deepEqual(parseKeyBinding('ctrl+c'),
    { key: 'c', ctrl: true, alt: false, shift: false, meta: false, super: false });
  assert.deepEqual(parseKeyBinding('Ctrl+Shift+B'),
    { key: 'b', ctrl: true, alt: false, shift: true, meta: false, super: false },
    'measured: the parts are lowercased and the order does not matter');
  assert.deepEqual(parseKeyBinding('shift+ctrl+b'), parseKeyBinding('Ctrl+Shift+B'));
  assert.deepEqual(parseKeyBinding('control+z'), parseKeyBinding('ctrl+z'), 'the long spelling of ctrl folds');
  assert.deepEqual(parseKeyBinding('A'), parseKeyBinding('a'), 'and so does case on the key itself');
});

test('the parser resolves the four aliases and the four arrow glyphs, and leaves the rest alone', () => {
  const plain = { ctrl: false, alt: false, shift: false, meta: false, super: false };
  assert.deepEqual(parseKeyBinding('esc'), { key: 'escape', ...plain });
  assert.deepEqual(parseKeyBinding('return'), { key: 'enter', ...plain });
  assert.deepEqual(parseKeyBinding('del'), { key: 'delete', ...plain });
  assert.deepEqual(parseKeyBinding('space'), { key: ' ', ...plain }, 'measured: a space key is a space');
  assert.deepEqual(parseKeyBinding('↑'), { key: 'up', ...plain });
  assert.deepEqual(parseKeyBinding('↓'), { key: 'down', ...plain });
  assert.deepEqual(parseKeyBinding('←'), { key: 'left', ...plain });
  assert.deepEqual(parseKeyBinding('→'), { key: 'right', ...plain });
  assert.deepEqual(parseKeyBinding('arrowup'), { key: 'arrowup', ...plain }, 'a word that is not an alias is itself');
});

test('the parser separates meta from alt and keeps super, which the comparison normaliser does not', () => {
  for (const spelling of ['cmd', 'command', 'super', 'win']) {
    assert.equal(parseKeyBinding(`${spelling}+p`).super, true, spelling);
    assert.equal(parseKeyBinding(`${spelling}+p`).meta, false, spelling);
    assert.equal(parseKeyBinding(`${spelling}+p`).alt, false, spelling);
  }
  for (const spelling of ['alt', 'opt', 'option']) {
    assert.equal(parseKeyBinding(`${spelling}+x`).alt, true, spelling);
    assert.equal(parseKeyBinding(`${spelling}+x`).super, false, spelling);
  }
  assert.equal(parseKeyBinding('meta+x').meta, true);
  assert.equal(parseKeyBinding('meta+x').alt, false);
  // The two functions in the same module answer different questions, and this is where they part:
  // `Ye`, the comparison normaliser W45-66 ported, folds `meta` into `alt`, while the parser keeps it.
  assert.equal(normalizeKey('meta+x'), 'alt+x');
  assert.equal(parseKeyBinding('meta+x').alt, false, 'measured: the parser does not fold meta into alt');
});

test('the parser splits on one character only, so a chord keeps its space and an empty part is empty', () => {
  assert.equal(parseKeyBinding('ctrl+x b').key, 'x b', 'measured: only `+` separates the parts');
  assert.equal(parseKeyBinding('ctrl+x b').ctrl, true);
  assert.equal(parseKeyBinding('').key, '');
  assert.equal(parseKeyBinding('ctrl+').key, '', 'an empty last part is an empty key');
  assert.equal(parseKeyBinding('ctrl+').ctrl, true);
  assert.equal(parseKeyBinding('+').key, '');
  assert.deepEqual(Object.keys(parseKeyBinding('x')),
    ['key', 'ctrl', 'alt', 'shift', 'meta', 'super'], 'the record always carries all six fields');
});

test('a chord is split on whitespace, and the space key is the one spelling answered first', () => {
  assert.deepEqual(splitChord('ctrl+k'), [parseKeyBinding('ctrl+k')], 'one key is a chord of one');
  assert.deepEqual(splitChord('ctrl+x shift+y'),
    [parseKeyBinding('ctrl+x'), parseKeyBinding('shift+y')], 'and two keys are two');
  assert.deepEqual(splitChord(' g g '), [parseKeyBinding('g'), parseKeyBinding('g')],
    'measured: the chord is trimmed once, then split on runs of whitespace');
  assert.deepEqual(splitChord('\tg\ng '), splitChord('g g'), 'measured: with a tab or a newline between');
  assert.deepEqual(splitChord(' '), [parseKeyBinding('space')], 'a single space is the space key');
  assert.deepEqual(splitChord('  '), [{ key: '', ctrl: false, alt: false, shift: false, meta: false, super: false }],
    'measured: two spaces are not the space key — the guard answers the exact single space only');
  assert.deepEqual(splitChord(''), splitChord('  '), 'and an empty chord is one empty key, never no keys');
  assert.equal(splitChord('gg').length, 1, 'measured: keys are separated by whitespace, not by character');
  assert.equal(splitChord('gg')[0].key, 'gg');
});

test('the contexts a binding may name are their own list, not the one the defaults bind', () => {
  assert.equal(KEY_CONTEXTS.length, 29);
  assert.equal(KEY_CONTEXT_SET.size, 29);
  assert.deepEqual([...KEY_CONTEXT_SET], KEY_CONTEXTS);
  assert.equal(KEY_CONTEXTS[0], 'Global');
  assert.equal(KEY_CONTEXTS.at(-1), 'Agents');
  assert.equal(KEY_CONTEXTS.includes('MessageSelector'), true,
    'measured: the list keeps the contexts the defaults no longer bind');
  assert.equal(KEY_CONTEXTS.includes('DiffPanel'), true);
  for (const name of ['Global', 'MessageSelector', 'DiffPanel']) assert.equal(isKnownContext(name), true, name);
  for (const name of ['Nope', 'nope', '', 1, null, undefined]) assert.equal(isKnownContext(name), false, String(name));
});

test('the action-or-command check is a superset of the action list, and it needs a string', () => {
  assert.equal(isActionOrCommand('app:interrupt'), true);
  assert.equal(isActionOrCommand('app:cycleDiffBase'), true);
  assert.equal(isActionOrCommand('command:help'), true, 'measured: a command binding is the other form');
  assert.equal(isActionOrCommand('command:'), true, 'the prefix alone is enough — the check is a prefix');
  assert.equal(isActionOrCommand('command:a:b-c_d'), true);
  assert.equal(isActionOrCommand('nope'), false);
  assert.equal(isActionOrCommand(''), false);
  assert.throws(() => isActionOrCommand(1 as unknown as string), TypeError,
    'measured: a non-string reaches the prefix test and throws, which is why callers type-check first');
});

test('the reserved keys are the base table plus what this platform adds', () => {
  const reserved = reservedKeysForPlatform().map((entry) => entry.key);
  assert.deepEqual(reserved.slice(0, 7),
    ['ctrl+c', 'ctrl+d', 'ctrl+m', 'ctrl+[', 'ctrl+i', 'ctrl+h', 'capslock'], 'the table W45-66 ported comes first');
  assert.deepEqual(reserved.slice(7), ['ctrl+z', 'ctrl+\\'],
    'measured: the two non-macOS additions are there on this platform');
  // The additions are keyed on the source's own word for the platform, so a host that speaks it gets
  // the macOS list. The base table is read from the copy, so rebinding the probe cannot move it.
  try {
    bindHostPlatform(() => 'macos');
    const macos = reservedKeysForPlatform().map((entry) => entry.key);
    assert.equal(macos.length, 16);
    assert.deepEqual(macos.slice(7),
      ['ctrl+z', 'ctrl+\\', 'cmd+c', 'cmd+v', 'cmd+x', 'cmd+q', 'cmd+w', 'cmd+tab', 'cmd+space'],
      'measured: the seven cmd keys are the source\'s macOS additions');
  } finally {
    bindHostPlatform(() => process.platform);
  }
  assert.equal(reservedKeysForPlatform().length, 9, 'and the binding is back to this host');
});

test('the six legacy action names are read as the names they became', () => {
  assert.equal(LEGACY_ACTION_NAMES.length, 6);
  assert.deepEqual(Object.keys(LEGACY_ACTION_READ_AS), LEGACY_ACTION_NAMES, 'every legacy name is mapped');
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:up'], 'select:previous');
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:down'], 'select:next');
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:top'], 'select:first');
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:bottom'], 'select:last');
  assert.equal(LEGACY_ACTION_READ_AS['messageSelector:select'], 'select:accept');
  assert.equal(LEGACY_ACTION_READ_AS['diff:viewDetails'], 'select:accept');
});

test('the legacy check reads the list, so only the old names answer yes', () => {
  for (const name of LEGACY_ACTION_NAMES) assert.equal(isLegacyAction(name), true, name);
  assert.equal(isLegacyAction('select:previous'), false,
    'measured: the name a legacy key is read as is not itself a legacy name');
  assert.equal(isLegacyAction('app:interrupt'), false);
  assert.equal(isLegacyAction(''), false);
  // Unlike the action-or-command check one package over, this one compares rather than tests a prefix, so
  // a value that is not a string answers no instead of throwing.
  for (const value of [null, undefined, 1, {}, []]) {
    assert.equal(isLegacyAction(value), false, String(value));
  }
});

test('a keybindings file is described by a schema that checks the values, not only the shapes', () => {
  const file = keyBindingsFileSchema();
  assert.equal(file.description, 'Claude Code keybindings configuration. Customize keyboard shortcuts by context.');
  assert.equal(keyBindingBlockSchema().description, 'A block of keybindings for a specific context');
  const block = { context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } };
  assert.deepEqual(file.parse({ bindings: [block] }), { bindings: [block] });
  assert.deepEqual(file.parse({ $schema: 'https://a', $docs: 'https://b', bindings: [] }),
    { $schema: 'https://a', $docs: 'https://b', bindings: [] });
  for (const value of ['messageSelector:up', 'diff:viewDetails', 'command:help', 'command:Help', null]) {
    assert.doesNotThrow(() => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': value } }] }),
      String(value));
  }
  assert.throws(() => file.parse({ bindings: [{ context: 'Nope', bindings: {} }] }), 'a context from outside the list');
  assert.throws(() => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': 'nope' } }] }),
    'an action the engine does not know is not a value this schema takes');
  assert.throws(() => file.parse({ bindings: { context: 'Global' } }), 'the blocks are an array');
  assert.throws(() => file.parse({}), 'and the array is required');
});

test('the runtime schema holds a block to its shapes, having checked the values once already', () => {
  const runtime = runtimeKeyBindingBlockSchema();
  assert.deepEqual(runtime.parse({ context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } }),
    { context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } });
  // Measured: everything the file schema refuses about *values* this one admits, because the value was
  // checked when the file was read and this is what the shapes are held to afterwards.
  for (const [context, action] of [['MessageSelector', 'messageSelector:up'], ['Nope', 'app:interrupt'],
    ['Global', 'command:help'], ['Global', null]]) {
    assert.doesNotThrow(() => runtime.parse({ context, bindings: { 'ctrl+k': action } }),
      `${context} / ${String(action)}`);
  }
  assert.throws(() => runtime.parse({ context: 'Global', bindings: { 'ctrl+k': 1 } }), 'the action is a string');
  assert.throws(() => runtime.parse({ bindings: {} }), 'the context is required');
  assert.throws(() => runtime.parse({ context: 'Global' }), 'and so are the bindings');
});

test('the runtime checks ask the schema rather than the file parser, so they answer what it answers', () => {
  const block = { context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } };
  const schema = runtimeKeyBindingBlockSchema();
  assert.equal(blockPassesRuntimeSchema(block), true);
  for (const value of [block, { context: 'Nope', bindings: { 'ctrl+k': 'nope' } }, { context: 'Global', bindings: { 'ctrl+k': null } }]) {
    assert.equal(blockPassesRuntimeSchema(value), schema.safeParse(value).success, JSON.stringify(value));
  }
  for (const value of [{ bindings: {} }, { context: 'Global' }, null, 1, 'x', []]) {
    assert.equal(blockPassesRuntimeSchema(value), false, JSON.stringify(value));
  }
  assert.equal(documentPassesRuntimeSchema([block]), true);
  assert.equal(documentPassesRuntimeSchema([block, { context: 'Global', bindings: {} }]), true);
  assert.equal(documentPassesRuntimeSchema([]), true,
    'measured: an empty document passes — every block of none passes');
  assert.equal(documentPassesRuntimeSchema([block, { context: 1, bindings: {} }]), false, 'one bad block fails it');
  assert.equal(documentPassesRuntimeSchema([block, null]), false);
  for (const value of [{}, 'x', null, undefined, block]) {
    assert.equal(documentPassesRuntimeSchema(value), false, String(value));
  }
  assert.equal(documentPassesRuntimeSchema([{ context: 'Nope', bindings: { 'ctrl+k': 'nope' } }]), true,
    'measured: this is the runtime check, so a context the file schema refuses is not its business');
});

test('the schemas are built through the lazy registry the source files them in', () => {
  const before = SCHEMA_REGISTRY.builtCount();
  const builds: string[] = [];
  const value = LAZY(() => { builds.push('built'); return { a: 1 }; });
  assert.deepEqual(value(), { a: 1 });
  assert.deepEqual(value(), { a: 1 });
  assert.deepEqual(builds, ['built'], 'the builder runs once and the value is remembered');
  assert.equal(SCHEMA_REGISTRY.builtCount(), before + 1);
  assert.equal(keyBindingsFileSchema(), keyBindingsFileSchema(), 'and a schema getter answers the same schema');
});
