import assert from 'node:assert/strict';
import { test } from 'node:test';

import { terminalProgressMux, terminalProgressSequence, terminalProgressSupported } from '../src/terminal-progress.js';

test('the recovered gate accepts ConEmu and versioned Ghostty or iTerm2 only', () => {
  assert.equal(terminalProgressSupported(false, {}), false);
  assert.equal(terminalProgressSupported(true, {}), false);
  assert.equal(terminalProgressSupported(true, { WT_SESSION: '1' }), false);
  assert.equal(terminalProgressSupported(true, { ConEmuANSI: 'ON' }), true);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.5' }), false);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.6' }), true);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'ghostty', TERM_PROGRAM_VERSION: '1.1.9' }), false);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'ghostty', TERM_PROGRAM_VERSION: '1.2.0' }), true);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'WezTerm', TERM_PROGRAM_VERSION: '2024.1.0' }), false);
  assert.equal(terminalProgressSupported(false, {}, true), true);
});

test('states map to the iTerm2 OSC 9;4 codes with BEL framing', () => {
  assert.equal(terminalProgressSequence('indeterminate'), '\x1b]9;4;3;\x07');
  assert.equal(terminalProgressSequence('completed'), '\x1b]9;4;0;\x07');
  assert.equal(terminalProgressSequence('running', 42), '\x1b]9;4;1;42\x07');
  assert.equal(terminalProgressSequence('error', 150), '\x1b]9;4;2;100\x07');
  assert.equal(terminalProgressSequence('error', -4), '\x1b]9;4;2;0\x07');
  assert.equal(terminalProgressSequence(null), '\x1b]9;4;0;\x07');
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: 'v3.6.6' }), true);
  assert.equal(terminalProgressSupported(true, { TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6' }), false);
});

test('tmux and screen wrap the OSC in their passthrough guard', () => {
  const body = '\x1b]9;4;3;\x07';
  assert.equal(terminalProgressSequence('indeterminate', 0, { mux: 'tmux' }),
    `\x1bPtmux;\x1b\x1b]9;4;3;\x07\x1b\\`);
  assert.equal(terminalProgressSequence('indeterminate', 0, { mux: 'screen' }),
    `\x1bP\x1b\x1b]9;4;3;\x07\x1b\\`);
  assert.equal(body, terminalProgressSequence('indeterminate'));
  assert.equal(terminalProgressMux({ TMUX: '/tmp/tmux' }), 'tmux');
  assert.equal(terminalProgressMux({ STY: '123.pts' }), 'screen');
  assert.equal(terminalProgressMux({ ZELLIJ: '0' }), undefined);
});
