import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HELP_CUSTOM_EMPTY, HELP_DISMISSED, HELP_FEEDBACK, HELP_INTRO, HELP_MORE_HELP_PREFIX,
  HELP_MORE_HELP_URL, HELP_TABS, browseHelp, chordDisplay, helpCommandRow, helpCompact, helpEntries,
  helpFooter, helpPanelRequest, helpShortcutColumns, helpShortcutTable, helpTabBody, helpTabRow,
  helpTall, helpVisibleCount, newlineHint } from '../src/help-panel.js';
import type { TuiCommand } from '../src/tui-autocomplete.js';

const CHORDS = (action: string, _context: 'Global' | 'Chat', fallback: string) => fallback;

function command(name: string, kind: 'command' | 'skill', description = `${name} description`): TuiCommand {
  return { name, description, kind };
}

test('the two list tabs split on the builtin predicate', () => {
  const commands = [command('zeta', 'command'), command('alpha', 'skill'), command('beta', 'command')];
  assert.deepEqual(helpEntries(commands, true).map(entry => entry.label), ['/beta', '/zeta']);
  assert.deepEqual(helpEntries(commands, false).map(entry => entry.label), ['/alpha']);
  // A repeated name is kept once, whichever kind carried it.
  assert.deepEqual(helpEntries([command('dup', 'command'), command('dup', 'command')], true).length, 1);
  assert.deepEqual(helpEntries(commands, true)[0],
    { name: 'beta', label: '/beta', description: 'beta description' });
});

test('the visible count halves the body above its ten-row allowance', () => {
  assert.equal(helpVisibleCount(24), 14);
  assert.equal(helpVisibleCount(10), 2);
  assert.equal(helpVisibleCount(0), 2);
  assert.equal(helpVisibleCount(44), 34);
});

test('the two row thresholds gate the padding and the feedback line', () => {
  assert.equal(helpCompact(20), true);
  assert.equal(helpCompact(21), false);
  assert.equal(helpTall(43), false);
  assert.equal(helpTall(44), true);
});

test('the newline hint names the terminal it is on', () => {
  assert.equal(newlineHint(true), 'shift + ⏎ for newline');
  assert.equal(newlineHint(false), 'backslash (\\) + return (⏎) for newline');
});

test('a chord is spelled with the recovered separator and key glyphs', () => {
  assert.equal(chordDisplay('ctrl+o'), 'ctrl + o');
  assert.equal(chordDisplay('alt+p'), 'alt + p');
  assert.equal(chordDisplay('shift+return'), 'shift + ⏎');
  assert.equal(chordDisplay('escape'), 'escape');
});

test('the shortcut table is the recovered three columns', () => {
  const [sigils, composer, session] = helpShortcutColumns(CHORDS, { platform: 'darwin' });
  assert.deepEqual(sigils, ['! for shell mode', '/ for commands', '@ for file paths', '/btw for side question']);
  assert.deepEqual(composer, ['double tap esc to clear input', 'shift + tab to auto-accept edits', '',
    'ctrl + o for verbose output', 'ctrl + t to toggle tasks', '', '',
    'backslash (\\) + return (⏎) for newline']);
  assert.deepEqual(session, ['ctrl + _ to undo', 'ctrl + z to suspend', 'ctrl + v to paste images',
    'alt + p to switch model', 'alt + o to toggle fast mode', 'ctrl + s to stash prompt',
    'ctrl + g to edit in $EDITOR', '/keybindings to customize']);
  // Windows cannot suspend the process, so that row is dropped.
  assert.equal(helpShortcutColumns(CHORDS, { platform: 'win32' })[2]!.length, 7);
  // A rebound action is what the table shows, not the fallback.
  const rebound = helpShortcutColumns((action, _c, fallback) => (action === 'chat:undo' ? 'ctrl+z' : fallback),
    { platform: 'darwin' });
  assert.equal(rebound[2]![0], 'ctrl + z to undo');
});

test('the table draws side by side when it fits and stacks when it does not', () => {
  const wide = helpShortcutTable(CHORDS, 120, { platform: 'darwin' });
  assert.equal(wide.length, 8);
  assert.match(wide[0]!, /^! for shell mode\s+double tap esc to clear input\s+ctrl \+ _ to undo$/);
  const narrow = helpShortcutTable(CHORDS, 60, { platform: 'darwin' });
  assert.deepEqual(narrow.slice(0, 4), ['! for shell mode', '/ for commands', '@ for file paths',
    '/btw for side question']);
  assert.equal(narrow.includes(''), false);
});

test('the general tab carries the intro, the shortcuts and the tall pointer', () => {
  const short = helpTabBody({ commands: [], rows: 30, chords: CHORDS, columns: 60 }, 'general');
  assert.equal(short[0], HELP_INTRO);
  assert.equal(short.includes('/powerup'), false);
  assert.equal(short[2], 'Shortcuts');
  const tall = helpTabBody({ commands: [], rows: 44, chords: CHORDS, columns: 60 }, 'general');
  assert.equal(tall[1], 'New here? Run /powerup to learn the features most people miss.');
});

test('the two list tabs carry their titles and rows', () => {
  const commands = [command('zeta', 'command'), command('alpha', 'skill')];
  assert.deepEqual(helpTabBody({ commands, rows: 30, chords: CHORDS }, 'commands'),
    ['Browse default commands', '', helpCommandRow({ name: 'zeta', label: '/zeta', description: 'zeta description' }, 0)]);
  assert.deepEqual(helpTabBody({ commands, rows: 30, chords: CHORDS }, 'custom'),
    ['Browse custom commands', '', '1. /alpha — alpha description']);
  assert.deepEqual(helpTabBody({ commands: [command('zeta', 'command')], rows: 30, chords: CHORDS }, 'custom'),
    ['Browse custom commands', '', HELP_CUSTOM_EMPTY]);
});

test('the footer always links the docs and adds the feedback line when tall', () => {
  assert.deepEqual(helpFooter(30), [HELP_MORE_HELP_PREFIX + HELP_MORE_HELP_URL]);
  assert.deepEqual(helpFooter(44), [HELP_MORE_HELP_PREFIX + HELP_MORE_HELP_URL, '', HELP_FEEDBACK]);
});

test('the panel opens on general with its tabs as the rows', () => {
  const request = helpPanelRequest({ commands: [], rows: 30, chords: CHORDS });
  assert.equal(request.title, 'Help');
  assert.deepEqual(request.choices, HELP_TABS.map(tab => ({ label: tab.title, value: tab.id })));
  assert.equal(request.defaultIndex, 0);
  assert.equal(request.message.split('\n')[0], '[General]  Commands   Custom commands ');
  assert.equal(request.message.split('\n').at(-1), HELP_MORE_HELP_PREFIX + HELP_MORE_HELP_URL);
  assert.equal(helpTabRow('custom'), ' General   Commands  [Custom commands]');
  assert.equal(helpPanelRequest({ commands: [], rows: 30, chords: CHORDS }, 'commands').defaultIndex, 1);
});

test('the browser switches tabs until the panel is dismissed', async () => {
  const seen: string[] = [];
  const notice = await browseHelp({ commands: [], rows: 30, chords: CHORDS }, async request => {
    const picked = request.choices![request.defaultIndex ?? 0]!.value;
    seen.push(picked);
    if (picked === 'custom') return undefined;
    return { selected: ['custom'] };
  });
  assert.equal(notice, HELP_DISMISSED);
  assert.deepEqual(seen, ['general', 'custom']);
});
