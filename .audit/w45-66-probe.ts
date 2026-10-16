// W45-66 probes: measure the ported keybinding seam and the Button before any assertion is written.
import { buttonLeafProblem } from '../src/plugin-chain-button.js';
import {
  ACTION_NAMES, CONTEXT_DESCRIPTIONS, DEFAULT_BINDINGS, engineOnlyAction, KEY_ALIASES, KEY_PASTE_KEY,
  KEY_PLATFORM, KEY_PLATFORM_IS_WINDOWS, KEY_PLATFORM_USES_TOGGLE, KEY_TOGGLE_KEY, KNOWN_ACTIONS,
  knownAction, normalizeKey, normalizeKeyParts, RESERVED_KEYS, SURVEY_CONTEXTS,
} from '../src/plugin-chain-keys.js';

const show = (label: string, value: unknown) => console.log(label.padEnd(46), JSON.stringify(value));

console.log('--- the header ---');
show('KEY_PLATFORM', KEY_PLATFORM);
show('KEY_PASTE_KEY', KEY_PASTE_KEY);
show('KEY_TOGGLE_KEY', KEY_TOGGLE_KEY);
show('KEY_PLATFORM_IS_WINDOWS', KEY_PLATFORM_IS_WINDOWS);
show('KEY_PLATFORM_USES_TOGGLE', KEY_PLATFORM_USES_TOGGLE);
console.log('--- the tables ---');
show('ACTION_NAMES.length', ACTION_NAMES.length);
show('KNOWN_ACTIONS.size', KNOWN_ACTIONS.size);
show('DEFAULT_BINDINGS.length', DEFAULT_BINDINGS.length);
show('DEFAULT_BINDINGS contexts', DEFAULT_BINDINGS.map((s) => s.context));
show('RESERVED_KEYS.length', RESERVED_KEYS.length);
show('RESERVED_KEYS keys', RESERVED_KEYS.map((s) => s.key));
show('SURVEY_CONTEXTS', SURVEY_CONTEXTS);
show('CONTEXT_DESCRIPTIONS keys', Object.keys(CONTEXT_DESCRIPTIONS).length);
show('KEY_ALIASES', KEY_ALIASES);
console.log('--- knownAction ---');
for (const name of ['app:interrupt', 'app:exit', 'app:cycleDiffBase', 'plugin:toggle', 'agents:setGroup',
  'nope', '', 'app:nope', 1, null, undefined, {}]) show(`knownAction(${JSON.stringify(name)})`, knownAction(name));
console.log('--- engineOnlyAction ---');
for (const name of ['app:interrupt', 'app:exit', 'app:cycleDiffBase', 'plugin:toggle', 'app:openArtifact',
  'chat:cancel', 'nope', '', 1]) show(`engineOnlyAction(${JSON.stringify(name)})`, engineOnlyAction(name));
console.log('--- normalisers ---');
for (const key of [' ', 'ctrl+c', 'Ctrl+Shift+B', 'shift+ctrl+b', 'ctrl+x b', 'Cmd+P', 'command+p',
  'Option+Up', 'opt+up', 'meta+up', 'esc', 'return', 'del', 'caps', 'caps-lock', 'caps_lock', 'arrowup', 'x']) {
  show(`normalizeKey(${JSON.stringify(key)})`, normalizeKey(key));
}
show('normalizeKeyParts("Ctrl+Shift+B")', normalizeKeyParts('Ctrl+Shift+B'));
show('normalizeKeyParts(" ")', normalizeKeyParts(' '));
console.log('--- the Button ---');
const P = { plugin: 'p', handle: 1 };
const b = (props: unknown, extra: Record<string, unknown> = {}) => show(String(JSON.stringify(props)).slice(0, 58), buttonLeafProblem({ props, ...extra }));
b({ key: 'k', label: 'L' });
b({ key: 'k', label: 'L', action: 'app:cycleDiffBase' });
b({ key: 'k', label: 'L', action: 'app:interrupt' });
b({ key: 'k', label: 'L', action: 'app:exit' });
b({ key: 'k', label: 'L', action: 'app:nope' });
b({ key: 'k', label: 'L', action: 1 });
b({ key: 'k', label: 'L', action: null });
b({ key: 'k', label: 'L', action: {} });
b({ key: 'k', label: 'L', hotkey: '1' });
b({ key: 'k', label: 'L', hotkey: 'a' });
b({ key: 'k', label: 'L', hotkey: 'A' });
b({ key: 'k', label: 'L', hotkey: 'ab' });
b({ key: 'k', label: 'L', hotkey: 1 });
b({ key: 'k', label: 'L', plain: true });
b({ key: 'k', label: 'L', plain: false });
b({ key: 'k', label: 'L', dimColor: true });
b({ key: 'k', label: 'L', dimColor: 1 });
b({ key: 'k', label: 'L', variant: 'primary' });
b({ key: 'k', label: 'L', variant: 'secondary' });
b({ key: 'k', label: 'L', variant: 'tertiary' });
b({ key: 'k', label: 'L', role: 'dismiss' });
b({ key: 'k', label: 'L', role: 'menu' });
b({ key: 'k', label: 'L', autoFocus: true });
b({ key: 'k', label: 'L', autoFocus: 'x' });
b({ key: 'k' });
b({ label: 'L' });
b({ key: '', label: 'L' });
b({ key: 'k', label: 'L', extra: 1 });
b(undefined);
b('x');
b({ key: 'k', label: 'L', variant: 'tertiary', action: 'app:nope' });
b({ key: 'k', label: 'L', action: 'app:nope', dimColor: 1 });
b({ key: 'k', label: 'L', action: 'app:interrupt', hotkey: 'A' });
b({ key: 'k', label: 'L', hotkey: 'A', plain: false });
b({ key: 'k', label: 'L', plain: false, autoFocus: 'x' });
b({ key: 'k', label: 'a\x1bb' });
b({ key: 'k', label: 'L' }, { children: [] });
b({ key: 'k', label: 'L' }, { children: 'x' });
b({ key: 'k', label: 'L' }, { children: 1 });
b({ key: 'k', label: 'L' }, { press: { plugin: 'p', handle: 1 } });
b({ key: 'k', label: 'L' }, { press: { plugin: 'p' } });
b({ key: 'k', label: 'L' }, { press: 'p' });
b({ key: 'k', label: 'L', action: 'app:interrupt', plain: false }, { children: 'x' });
