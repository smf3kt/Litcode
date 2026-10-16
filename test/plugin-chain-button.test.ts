// The Button and the keybinding tables it reads (W45-66). The bodies are the copies'
// src/plugin-chain-button-source.ts (chunk-n3ykh62m.js [234038,235650)) and
// src/plugin-chain-keys-source.ts (chunk-6ccen3s8.js [1764,8839), [11563,16491), [16491,16534),
// [16534,16567), [17524,18783), [18864,18952), [18952,19125), [19125,19541), [19541,19548),
// [19548,19738), plus `nA` chunk-yvnhkg35.js [1245,1268) and `Yho` chunk-bk5ct2gw.js [342203,342254)).
// Assertions are written from the measurement probe .audit/w45-66-probe.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buttonLeafProblem } from '../src/plugin-chain-button.js';
import {
  ACTION_NAMES, CONTEXT_DESCRIPTIONS, DEFAULT_BINDINGS, engineOnlyAction, KEY_ALIASES, KEY_PASTE_KEY,
  KEY_PLATFORM, KEY_PLATFORM_IS_WINDOWS, KEY_PLATFORM_USES_TOGGLE, KEY_TOGGLE_KEY, KNOWN_ACTIONS,
  knownAction, normalizeKey, normalizeKeyParts, RESERVED_KEYS, SURVEY_CONTEXTS,
} from '../src/plugin-chain-keys.js';

/** A press held by a plugin of this chain, which a Button must carry to be admitted at all. */
const PRESS = { plugin: 'p', handle: 1 };

const button = (props: unknown, extra: Record<string, unknown> = {}) =>
  buttonLeafProblem({ props, press: PRESS, ...extra });

test('the platform header answers this host, and the two keys follow from it', () => {
  // Read the platform as a plain string and compare it through a boolean: an assertion on the
  // comparison itself would narrow the name to the host's own union, and the point of this test is
  // what the copied header decided, whatever vocabulary the boundary handed it.
  const platform: string = String(KEY_PLATFORM);
  const readsTheHost: boolean = platform === process.platform;
  assert.ok(readsTheHost, `the header reads the platform through the fs boundary: ${platform}`);
  // The copied header names the platform in the source's own vocabulary (`"windows"`, `"wsl"`), while
  // Node's `process.platform` says `win32`, so on this host the Windows branch is the one not taken —
  // which is exactly what the second file in this package binds and exercises.
  assert.equal(KEY_PLATFORM_IS_WINDOWS, platform === 'windows' || platform === 'wsl');
  assert.equal(KEY_PASTE_KEY, KEY_PLATFORM_IS_WINDOWS ? 'alt+v' : 'ctrl+v');
  assert.equal(KEY_PLATFORM_USES_TOGGLE, true,
    'measured: on anything but Windows the toggle key short-circuits to its pre-version value');
  assert.equal(KEY_TOGGLE_KEY, 'shift+tab');
});

test('the action names, the defaults and the reserved keys are the tables they name', () => {
  assert.equal(ACTION_NAMES.length, 174);
  assert.equal(KNOWN_ACTIONS.size, 174, 'the set is built from the list, so the two agree');
  assert.equal(new Set(ACTION_NAMES).size, 174, 'and the list names each action once');
  assert.equal(DEFAULT_BINDINGS.length, 27);
  assert.equal(DEFAULT_BINDINGS[0].context, 'Global');
  assert.equal(DEFAULT_BINDINGS.at(-1)?.context, 'Agents');
  assert.deepEqual(DEFAULT_BINDINGS[0].bindings['ctrl+c'], 'app:interrupt');
  assert.deepEqual(SURVEY_CONTEXTS, ['FeedbackSurvey']);
  assert.equal(Object.keys(CONTEXT_DESCRIPTIONS).length, 29, 'the descriptions cover more than the defaults');
  assert.deepEqual(RESERVED_KEYS.map((entry) => entry.key),
    ['ctrl+c', 'ctrl+d', 'ctrl+m', 'ctrl+[', 'ctrl+i', 'ctrl+h', 'capslock']);
  assert.equal(RESERVED_KEYS[0].severity, 'error');
  assert.match(RESERVED_KEYS[0].reason, /interrupt\/exit \(hardcoded\)/);
});

test('a name is known to the engine or it is not, and anything that is not a name is not', () => {
  for (const name of ['app:interrupt', 'app:exit', 'app:cycleDiffBase', 'plugin:toggle', 'agents:setGroup']) {
    assert.equal(knownAction(name), true, `${name} is one of the engine's actions`);
  }
  for (const name of ['nope', 'app:nope', '', 1, null, undefined, {}]) {
    assert.equal(knownAction(name), false);
  }
});

test('the engine holds two actions alone, and they are the two the Button names', () => {
  assert.equal(engineOnlyAction('app:interrupt'), true);
  assert.equal(engineOnlyAction('app:exit'), true);
  assert.equal(engineOnlyAction('app:cycleDiffBase'), false, 'a reboundable action is not engine-only');
  assert.equal(engineOnlyAction('plugin:toggle'), false);
  assert.equal(engineOnlyAction('chat:cancel'), false);
  assert.equal(engineOnlyAction('nope'), false, 'an unknown name is not engine-only either');
  assert.equal(engineOnlyAction(1), false);
  // Seven keys are reserved and only two of them are bound to an action in the defaults, so the set is
  // built from the bindings rather than from the reserved list.
  assert.equal(RESERVED_KEYS.filter((entry) => engineOnlyAction(entry.key)).length, 0,
    'a reserved key is a key, not an action name');
});

test('the key normaliser folds spellings, sorts modifiers and names the space key', () => {
  assert.equal(normalizeKey(' '), 'space', 'measured: the space key is named as a word before anything else');
  assert.equal(normalizeKey('Ctrl+Shift+B'), 'ctrl+shift+b');
  assert.equal(normalizeKey('shift+ctrl+b'), 'ctrl+shift+b', 'the modifiers are sorted');
  assert.equal(normalizeKey('Cmd+P'), 'cmd+p');
  assert.equal(normalizeKey('command+p'), 'cmd+p', 'the spellings of meta fold together');
  assert.equal(normalizeKey('Option+Up'), 'alt+up');
  assert.equal(normalizeKey('opt+up'), 'alt+up');
  assert.equal(normalizeKey('meta+up'), 'alt+up', 'and so do the spellings of alt');
  assert.equal(normalizeKey('ctrl+x b'), 'ctrl+x b', 'a chord keeps the space between its two keys');
  for (const [key, alias] of Object.entries(KEY_ALIASES)) assert.equal(normalizeKey(key), alias, key);
  assert.equal(normalizeKey('arrowup'), 'arrowup', 'an unaliased key is itself, lowercased');
  assert.equal(normalizeKeyParts('Ctrl+Shift+B'), 'ctrl+shift+b', 'and the parts are normalised the same way');
  assert.equal(normalizeKeyParts(' '), '', 'measured: the parts pass has no space rule, so a lone space is empty');
});

test('a Button must be held by a plugin, and that check is the last one before children', () => {
  assert.equal(button({ key: 'k', label: 'L' }), undefined);
  assert.equal(buttonLeafProblem({ props: { key: 'k', label: 'L' } }),
    'Button "k" is not held by a plugin of this chain', 'measured: a Button with no press at all is refused');
  for (const press of [{ plugin: 'p' }, 'p', 1, null]) {
    assert.equal(buttonLeafProblem({ props: { key: 'k', label: 'L' }, press }),
      'Button "k" is not held by a plugin of this chain', JSON.stringify(press));
  }
  assert.equal(buttonLeafProblem({ props: { key: 'k', label: 'L' }, press: { plugin: 'p', handle: 1.5 } }),
    'Button "k" is not held by a plugin of this chain', 'the handle must be a whole number');
  assert.equal(buttonLeafProblem({ props: { key: 'k', label: 'L' }, press: { plugin: '', handle: 1 } }),
    'Button "k" is not held by a plugin of this chain');
});

test('a Button names its props sentence for every wrong shape of the props', () => {
  const sentence = 'Button props must be { key, label }, both strings, hotkey a digit or a letter, ' +
    'action a keybinding action, dimColor a boolean, variant "primary" or "secondary", role "dismiss" ' +
    'and autoFocus true';
  assert.equal(button(undefined), sentence);
  assert.equal(button('x'), sentence);
  assert.equal(button({ key: 'k' }), sentence, 'a label is required');
  assert.equal(button({ label: 'L' }), sentence);
  assert.equal(button({ key: '', label: 'L' }), sentence);
  assert.equal(button({ key: 1, label: 'L' }), sentence);
  assert.equal(button({ key: 'k', label: 1 }), sentence);
  assert.equal(button({ key: 'k', label: 'L', extra: 1 }), sentence, 'a stray field answers the props sentence');
});

test('a Button checks its options in the order the source destructures them', () => {
  assert.equal(button({ key: 'k', label: 'L', plain: true }), undefined);
  assert.equal(button({ key: 'k', label: 'L', plain: false }), 'Button "k" plain is true or absent');
  assert.equal(button({ key: 'k', label: 'L', dimColor: true }), undefined);
  assert.equal(button({ key: 'k', label: 'L', dimColor: 1 }), 'Button "k" dimColor is a boolean or absent');
  assert.equal(button({ key: 'k', label: 'L', variant: 'primary' }), undefined);
  assert.equal(button({ key: 'k', label: 'L', variant: 'secondary' }), undefined);
  assert.equal(button({ key: 'k', label: 'L', variant: 'tertiary' }),
    'Button "k" variant is "primary", "secondary" or absent');
  assert.equal(button({ key: 'k', label: 'L', role: 'dismiss' }), undefined);
  assert.equal(button({ key: 'k', label: 'L', role: 'menu' }), 'Button "k" role is "dismiss" or absent');
  assert.equal(button({ key: 'k', label: 'L', autoFocus: true }), undefined);
  assert.equal(button({ key: 'k', label: 'L', autoFocus: 'x' }), 'Button "k" autoFocus is true or absent');
  // Measured: plain is read first of all, then dimColor, then variant, then role, then autoFocus.
  assert.equal(button({ key: 'k', label: 'L', plain: false, autoFocus: 'x' }), 'Button "k" plain is true or absent');
  assert.equal(button({ key: 'k', label: 'L', variant: 'tertiary', action: 'app:nope' }),
    'Button "k" variant is "primary", "secondary" or absent');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:nope', dimColor: 1 }),
    'Button "k" dimColor is a boolean or absent');
});

test('a Button hotkey is one digit or one lowercase letter, and it is checked before the action', () => {
  for (const hotkey of ['0', '9', 'a', 'z']) assert.equal(button({ key: 'k', label: 'L', hotkey }), undefined);
  for (const hotkey of ['A', 'Z', 'ab', '', ' ', '1a', 1, true]) {
    assert.equal(button({ key: 'k', label: 'L', hotkey }),
      'Button "k" hotkey must be one digit 0-9 or one lowercase letter a-z', JSON.stringify(hotkey));
  }
  assert.equal(button({ key: 'k', label: 'L', hotkey: 'A', plain: false }), 'Button "k" plain is true or absent');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:interrupt', hotkey: 'A' }),
    'Button "k" hotkey must be one digit 0-9 or one lowercase letter a-z');
});

test('a Button refuses an action the engine does not know and quotes it back', () => {
  for (const action of ['app:cycleDiffBase', 'app:diffFileListDown', 'plugin:toggle']) {
    assert.equal(button({ key: 'k', label: 'L', action }), undefined, action);
  }
  assert.equal(button({ key: 'k', label: 'L', action: 'app:nope' }),
    'Button "k" action "app:nope" is not one of the engine\'s keybinding actions ' +
    '(app:cycleDiffBase, app:diffFileListDown)', 'a string action is quoted as a string');
  assert.equal(button({ key: 'k', label: 'L', action: 1 }),
    'Button "k" action a number is not one of the engine\'s keybinding actions ' +
    '(app:cycleDiffBase, app:diffFileListDown)', 'and anything else is described rather than quoted');
  assert.equal(button({ key: 'k', label: 'L', action: {} }),
    'Button "k" action an object is not one of the engine\'s keybinding actions ' +
    '(app:cycleDiffBase, app:diffFileListDown)');
});

test('a Button refuses an action the engine holds alone, with the reason the table carries', () => {
  assert.equal(button({ key: 'k', label: 'L', action: 'app:interrupt' }),
    'Button "k" action "app:interrupt" is the engine\'s alone: its key cannot be rebound (ctrl+c, ctrl+d)');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:exit' }),
    'Button "k" action "app:exit" is the engine\'s alone: its key cannot be rebound (ctrl+c, ctrl+d)');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:interrupt' }, { children: 'x' }),
    'Button "k" action "app:interrupt" is the engine\'s alone: its key cannot be rebound (ctrl+c, ctrl+d)',
    'measured: the engine-only action is answered before children, which are read last of all');
});

test('a Button checks its label before its press, and reads children last', () => {
  assert.equal(button({ key: 'k', label: 'a\x1bb' }), 'Button "k" label holds a control character');
  assert.equal(button({ key: 'k', label: 'a\x1bb' }, { press: undefined }),
    'Button "k" label holds a control character', 'the label is checked before the press');
  assert.equal(button({ key: 'k', label: 'L' }, { children: [] }), undefined, 'an array of children is admitted');
  assert.equal(button({ key: 'k', label: 'L' }, { children: 'x' }), 'Button "k" children is a string');
  assert.equal(button({ key: 'k', label: 'L' }, { children: 1 }), 'Button "k" children is a number');
  assert.equal(button({ key: 'k', label: 'L', action: 'app:interrupt' }, { children: 'x' }),
    'Button "k" action "app:interrupt" is the engine\'s alone: its key cannot be rebound (ctrl+c, ctrl+d)',
    'measured: the engine-only action is answered before children, as the children sentence is last');
});
