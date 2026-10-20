import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TUI_CLASSIC_UNAVAILABLE, TUI_RENDERERS, currentRenderer, parseTuiArgument, tuiAlreadyReport,
  tuiCurrentReport, tuiReport, tuiUnknownReport, tuiUsage } from '../src/tui-command.js';

test('the renderer list is the recovered one, in its order', () => {
  assert.deepEqual([...TUI_RENDERERS], ['default', 'fullscreen']);
  assert.equal(tuiUsage(), '/tui <default|fullscreen>');
});

test('the argument is trimmed and lowercased before it is matched', () => {
  assert.deepEqual(parseTuiArgument(''), { kind: 'current' });
  assert.deepEqual(parseTuiArgument('   '), { kind: 'current' });
  assert.deepEqual(parseTuiArgument(' FULLSCREEN '), { kind: 'renderer', renderer: 'fullscreen' });
  assert.deepEqual(parseTuiArgument('Default'), { kind: 'renderer', renderer: 'default' });
  assert.deepEqual(parseTuiArgument('classic'), { kind: 'unknown', got: 'classic' });
});

test('the two report strings are the recovered ones', () => {
  assert.equal(tuiCurrentReport('fullscreen'), 'Current renderer: fullscreen. Usage: /tui <default|fullscreen>');
  assert.equal(tuiCurrentReport('default', ' (note)'), 'Current renderer: default (note). Usage: /tui <default|fullscreen>');
  assert.equal(tuiUnknownReport('classic'), 'Unknown renderer "classic". Usage: /tui <default|fullscreen>');
  assert.equal(tuiAlreadyReport('fullscreen'), 'Already using the fullscreen renderer.');
});

test('this build is always the fullscreen renderer', () => {
  assert.equal(currentRenderer(), 'fullscreen');
});

test('each arm reports what it can do here', () => {
  assert.equal(tuiReport(''), 'Current renderer: fullscreen. Usage: /tui <default|fullscreen>');
  assert.equal(tuiReport('fullscreen'), 'Already using the fullscreen renderer.');
  assert.equal(tuiReport('bogus'), 'Unknown renderer "bogus". Usage: /tui <default|fullscreen>');
  // The classic renderer has no local implementation, so the switch is refused and changes nothing.
  assert.equal(tuiReport('default'), TUI_CLASSIC_UNAVAILABLE);
  assert.match(TUI_CLASSIC_UNAVAILABLE, /Nothing was changed\.$/);
});
