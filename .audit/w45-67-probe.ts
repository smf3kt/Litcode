// W45-67 probes: measure the ported keybinding editor before any assertion is written.
import {
  isActionOrCommand, isKnownContext, keyBindingBlockSchema, keyBindingsFileSchema, KEY_CONTEXT_SET,
  KEY_CONTEXTS, LAZY, LEGACY_ACTION_NAMES, LEGACY_ACTION_READ_AS, parseKeyBinding,
  reservedKeysForPlatform, runtimeKeyBindingBlockSchema, SCHEMA_REGISTRY,
} from '../src/plugin-chain-keys-editor.js';
import { SCHEMA_LIBRARY } from '../src/plugin-chain-schema-aliases.js';

const show = (label: string, value: unknown) => console.log(label.padEnd(50), JSON.stringify(value));
const attempt = (label: string, fn: () => unknown) => {
  try { console.log(label.padEnd(50), 'OK', JSON.stringify(fn())?.slice(0, 110)); }
  catch (error) { console.log(label.padEnd(50), 'REFUSED', (error as Error).message.slice(0, 150)); }
};

console.log('--- parseKeyBinding (mJ) ---');
for (const key of ['ctrl+c', 'Ctrl+Shift+B', 'shift+ctrl+b', 'esc', 'return', 'del', 'space', '↑', '↓',
  'cmd+p', 'command+p', 'super+p', 'win+p', 'option+x', 'opt+x', 'alt+x', 'meta+x', 'control+z', 'x',
  'A', 'ctrl+x b', '', '+', 'ctrl+']) {
  show(`parseKeyBinding(${JSON.stringify(key)})`, parseKeyBinding(key));
}
console.log('--- isKnownContext (lcs) / isActionOrCommand (F) ---');
show('KEY_CONTEXTS.length', KEY_CONTEXTS.length);
show('KEY_CONTEXT_SET.size', KEY_CONTEXT_SET.size);
show('KEY_CONTEXTS tail', KEY_CONTEXTS.slice(-6));
for (const name of ['Global', 'MessageSelector', 'DiffPanel', 'nope', '', 1, null]) {
  show(`isKnownContext(${JSON.stringify(name)})`, isKnownContext(name));
}
for (const name of ['app:interrupt', 'command:help', 'command:', 'command:nope:x', 'nope', '']) {
  show(`isActionOrCommand(${JSON.stringify(name)})`, isActionOrCommand(name));
}
console.log('--- legacy names ---');
show('LEGACY_ACTION_NAMES', LEGACY_ACTION_NAMES);
show('LEGACY_ACTION_READ_AS', LEGACY_ACTION_READ_AS);
console.log('--- reserved keys for this platform (fe) ---');
const reserved = reservedKeysForPlatform();
show('reservedKeysForPlatform().length', reserved.length);
show('reservedKeysForPlatform() keys', reserved.map((entry) => entry.key));
console.log('--- the lazy registry ---');
show('builtCount before', SCHEMA_REGISTRY.builtCount());
const built: string[] = [];
const lazy = LAZY(() => { built.push('built'); return 42; });
show('lazy() twice', [lazy(), lazy()]);
show('built', built);
show('builtCount after', SCHEMA_REGISTRY.builtCount());
attempt('isActionOrCommand(1)', () => isActionOrCommand(1));
show('SCHEMA_LIBRARY.string()._def.typeName', SCHEMA_LIBRARY.string()._def.typeName);
console.log('--- keyBindingsFileSchema (Bn) ---');
const file = keyBindingsFileSchema();
console.log('file description'.padEnd(50), JSON.stringify(file.description));
attempt('valid document', () => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } }] }));
attempt('legacy action name', () => file.parse({ bindings: [{ context: 'MessageSelector', bindings: { 'ctrl+p': 'messageSelector:up' } }] }));
attempt('command binding', () => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+h': 'command:help' } }] }));
attempt('null unbind', () => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': null } }] }));
attempt('with $schema and $docs', () => file.parse({ $schema: 'https://a', $docs: 'https://b', bindings: [] }));
attempt('unknown context', () => file.parse({ bindings: [{ context: 'Nope', bindings: {} }] }));
attempt('unknown action', () => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': 'nope' } }] }));
attempt('command with capitals', () => file.parse({ bindings: [{ context: 'Global', bindings: { 'ctrl+k': 'command:Help' } }] }));
attempt('bindings as an object', () => file.parse({ bindings: { context: 'Global' } }));
attempt('missing bindings', () => file.parse({}));
attempt('binding block description', () => keyBindingBlockSchema().description);
console.log('--- runtimeKeyBindingBlockSchema (He) ---');
const runtime = runtimeKeyBindingBlockSchema();
attempt('runtime valid', () => runtime.parse({ context: 'Global', bindings: { 'ctrl+k': 'app:interrupt' } }));
attempt('runtime legacy name', () => runtime.parse({ context: 'MessageSelector', bindings: { 'ctrl+p': 'messageSelector:up' } }));
attempt('runtime command binding', () => runtime.parse({ context: 'Global', bindings: { 'ctrl+h': 'command:help' } }));
attempt('runtime null unbind', () => runtime.parse({ context: 'Global', bindings: { 'ctrl+k': null } }));
attempt('runtime unknown context', () => runtime.parse({ context: 'Nope', bindings: {} }));

console.log('--- the platform word fe compares against ---');
import { bindHostPlatform } from '../src/plugin-chain-fs-boundaries.js';
import { Foo, Noo, QDe } from '../src/plugin-chain-keys-source.js';
show('QDe keys', QDe.map((entry) => entry.key));
show('Noo keys', Noo.map((entry: { key: string }) => entry.key));
show('Foo keys', Foo.map((entry: { key: string }) => entry.key));
bindHostPlatform(() => 'macos');
show('reservedKeysForPlatform() on the source\'s own macOS word',
  reservedKeysForPlatform().map((entry) => entry.key));
