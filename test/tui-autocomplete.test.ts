import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type { Terminal as TerminalType } from '@xterm/headless';
import { COMMAND_HELP } from '../src/interactive.js';
import { TuiTerminal } from '../src/tui.js';
import { acceptanceText, commandQuery, commandSuggestions, layoutSuggestionRows,
  maxVisibleSuggestions, suggestionMaxColumnWidth, suggestionRowHeight, suggestionRowOwners,
  suggestionRowWindow, suggestionsEmptyMessage, tuiCommandsWithSkills,
  TUI_COMMANDS, type TuiCommand } from '../src/tui-autocomplete.js';

const skill = (name: string, description: string, extra: Partial<TuiCommand> = {}): TuiCommand =>
  ({ name, description, kind: 'skill', ...extra });

test('the local command table mirrors COMMAND_HELP one-to-one', () => {
  const fromHelp = new Set<string>();
  for (const line of COMMAND_HELP.split('\n')) {
    const match = /^\/([A-Za-z0-9._:-]+)/.exec(line);
    if (match && match[1] !== 'NAME') fromHelp.add(match[1]!);
  }
  const fromTable = new Set(TUI_COMMANDS.map(command => command.name));
  assert.deepEqual([...fromTable].sort(), [...fromHelp].sort());
  for (const command of TUI_COMMANDS) assert.ok(command.description.length > 0, command.name);
  assert.equal(new Set(TUI_COMMANDS.map(command => command.name)).size, TUI_COMMANDS.length);
});

test('the draft gate accepts only an argument-free slash command', () => {
  assert.equal(commandQuery('/', 1), '');
  assert.equal(commandQuery('/mo', 3), 'mo');
  assert.equal(commandQuery('/mcp-reconnect', 5), 'mcp-reconnect',
    'the source reads the whole token, not the part before the cursor');
  assert.equal(commandQuery('/model ', 7), undefined);
  assert.equal(commandQuery('hello', 5), undefined);
  assert.equal(commandQuery('/model', 0), undefined);
  assert.equal(commandQuery('/model', 7), undefined);
});

test('an empty prefix lists skills first, then commands alphabetically', () => {
  const commands = [skill('zeta', 'z'), skill('alpha', 'a'), skill('beta', 'b'),
    skill('gamma', 'g'), skill('delta', 'd'), skill('epsilon', 'e'),
    { name: 'model', description: 'm', kind: 'command' as const },
    { name: 'agents', description: 'a', kind: 'command' as const }];
  const listed = commandSuggestions('/', 1, commands).map(row => row.name);
  assert.deepEqual(listed, ['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'agents', 'model', 'zeta']);
});

test('prefix, substring and subsequence matches rank ahead of weaker ones', () => {
  const commands: TuiCommand[] = [
    { name: 'model', description: 'pick a model', kind: 'command' },
    { name: 'mcp', description: 'servers', kind: 'command' },
    { name: 'mcp-reconnect', description: 'reconnect', kind: 'command' },
    { name: 'compact', description: 'summarize', kind: 'command' },
    { name: 'exit', description: 'close', kind: 'command' }];
  const ranked = commandSuggestions('/mc', 3, commands).map(row => row.name);
  assert.deepEqual(ranked.slice(0, 3), ['mcp', 'mcp-reconnect', 'compact'],
    'the exact-name prefix wins, then the longer prefix, then the subsequence');
  assert.ok(!ranked.includes('exit'));
  assert.equal(commandSuggestions('/xl', 3, commands).length, 0);
});

test('a plugin skill matches on its local segment and accepts through its alias', () => {
  const commands = [skill('local:build-report', 'Build a report', { aliases: ['report'] })];
  const bySegment = commandSuggestions('/build', 6, commands);
  assert.equal(bySegment[0]?.name, 'local:build-report');
  assert.equal(bySegment[0]?.displayText, '/local:build-report');
  const byAlias = commandSuggestions('/rep', 4, commands);
  assert.equal(byAlias[0]?.displayText, '/local:build-report (report)');
  assert.equal(acceptanceText(byAlias[0]!), '/report ');
});

test('a skill that declares arguments completes without submitting', () => {
  const plain = skill('summarize', 'Summarize');
  const withArguments = skill('deploy', 'Deploy', { requiresArguments: true });
  assert.equal(commandSuggestions('/sum', 4, [plain])[0]?.executeOnAccept, true);
  assert.equal(commandSuggestions('/dep', 4, [withArguments])[0]?.executeOnAccept, false);
  assert.equal(commandSuggestions('/hel', 4, TUI_COMMANDS)[0]?.executeOnAccept, true);
});

test('a local command name shadows a skill with the same name', () => {
  const commands = tuiCommandsWithSkills([
    { name: 'help', description: 'shadowed', userInvocable: true },
    { name: 'review', description: 'Review a change', userInvocable: true },
    { name: 'held', description: 'not invocable', userInvocable: false }]);
  assert.equal(commands.filter(command => command.name === 'help').length, 1);
  assert.equal(commands.find(command => command.name === 'help')?.kind, 'command');
  assert.equal(commands.find(command => command.name === 'review')?.kind, 'skill');
  assert.equal(commands.some(command => command.name === 'held'), false);
});

test('the no-match message appears only for a non-empty command name', () => {
  assert.equal(suggestionsEmptyMessage('/zzz', 4, []), 'No commands match "/zzz"');
  assert.equal(suggestionsEmptyMessage('/', 1, []), undefined);
  assert.equal(suggestionsEmptyMessage('/model', 6, commandSuggestions('/model', 6, TUI_COMMANDS)), undefined);
  assert.equal(suggestionsEmptyMessage('/zzz x', 6, []), undefined);
});

test('the list budget is at most half the screen and never fewer than six rows', () => {
  assert.equal(maxVisibleSuggestions(40), 20, 'a tall screen spends at most half its rows');
  assert.equal(maxVisibleSuggestions(12), 6);
  assert.equal(maxVisibleSuggestions(8), 5);
});

test('a row is the pointer, the padded command, the kind lane and the description', () => {
  const suggestions = commandSuggestions('/mo', 3, TUI_COMMANDS);
  const rows = layoutSuggestionRows(suggestions, 0, 100, '❯ ');
  assert.equal(rows.length, suggestions.length, 'the descriptions fit on one line at 100 columns');
  for (const row of rows) assert.equal([...row].length, 100);
  assert.ok(rows[0]!.startsWith('❯ /model'));
  assert.ok(rows[0]!.includes('Choose or enter a model'));
  assert.ok(rows[1]!.startsWith('  '), 'an unselected row keeps the pointer lane blank');
  // Source `_t`: `config` draws its label, `action` draws seven blank cells so the
  // descriptions still line up, and the lane starts at the widest row plus five.
  assert.ok(rows[0]!.includes('config '), 'a config command names its lane');
  assert.equal(rows[1]!.slice(19, 26), '       ', 'an action command leaves its lane blank');
  assert.equal(rows[0]!.indexOf('config'), 19, 'the lane starts at the widest row plus five');
  // Source `ee`/`No`: past 40% of the terminal the lane is pushed right, and the name
  // itself is cut to keep a two-cell gap, so a 20-column row shows only a prefix.
  const narrow = layoutSuggestionRows(suggestions, 0, 20, '❯ ');
  assert.ok(narrow[0]!.startsWith('❯ /mod'), narrow[0]!);
  assert.equal(narrow[0]!.includes('Choose'), false, 'a narrow column drops the description');
  for (const row of narrow) assert.equal([...row].length, 20);
});

test('a description that does not fit wraps onto a second line under its own column', () => {
  const suggestions = commandSuggestions('/mo', 3, TUI_COMMANDS);
  const rows = layoutSuggestionRows(suggestions, 0, 60, '❯ ');
  assert.equal(rows.length, suggestions.length * 2, 'every row needs two lines at 60 columns');
  for (const row of rows) assert.equal([...row].length, 60);
  // The continuation starts where the description began, one row below its own row.
  assert.equal(rows[1]!.indexOf('start'), rows[0]!.indexOf('Choose'), 'the tail is indented to the description');
  assert.equal(rows[1]!.trim().length > 0, true);
  // Source `_o`: the row height is one when the whole description fits beside the lanes.
  const heights = suggestions.map(row => suggestionRowHeight(row, suggestionMaxColumnWidth(suggestions), 100, 2));
  assert.deepEqual(heights, [1, 1, 1], '100 columns leaves room for every description');
  assert.deepEqual(suggestionRowOwners(heights), [0, 1, 2], 'one line each, so each line owns its row');
});

test('the window is measured in rows, so a wrapped row spends two of its budget', () => {
  const suggestions = commandSuggestions('/m', 2, TUI_COMMANDS);
  const widest = suggestionMaxColumnWidth(suggestions);
  const heights = suggestions.map(row => suggestionRowHeight(row, widest, 60, 2));
  const window = suggestionRowWindow(heights, 6, 0, 0);
  const used = heights.slice(window.start, window.end).reduce((total, height) => total + height, 0);
  assert.ok(used <= 6, `the window stays inside the row budget, used ${used}`);
  assert.ok(window.start <= 0 && window.end > 0, 'the selection stays inside the window');
  // A selection past the window re-anchors it.
  const far = suggestionRowWindow(heights, 6, heights.length - 1, 0);
  assert.ok(far.start <= heights.length - 1 && far.end === heights.length, JSON.stringify(far));
});

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as
  { Terminal: typeof TerminalType };

function startComposer(commands: readonly TuiCommand[]) {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.setRawMode = () => {};
  const terminal = new HeadlessTerminal({ allowProposedApi: true, logLevel: 'off' });
  const output = new Writable({
    write(chunk, _encoding, done) {
      (terminal as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk));
      done();
    },
  });
  Object.assign(output, { isTTY: true, columns: 90, rows: 30 });
  terminal.resize(90, 30);
  const submitted: string[] = [];
  const tui = new TuiTerminal({ input, output, commands, onSubmit: text => submitted.push(text) }).start();
  const screen = () => {
    const buffer = terminal.buffer.active;
    return Array.from({ length: terminal.rows }, (_, row) =>
      buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '').join('\n');
  };
  return { tui, submitted, input, screen };
}

test('typing a colon opens the emoji list and accepting inserts the glyph', () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key(':roc');
    const opened = composer.screen();
    assert.ok(opened.includes('🚀'), `the rocket row is on screen: ${opened}`);
    assert.ok(opened.includes(':rocket:'), 'the row describes its shortcode');
    assert.equal(composer.tui.state.text, ':roc', 'the trigger leaves the draft alone');
    key('\r');
    assert.equal(composer.tui.state.text, '🚀 ');
    assert.deepEqual(composer.submitted, [], 'an emoji row never submits');
    assert.equal(composer.screen().includes(':rocket:'), false, 'the list closed');
  } finally { composer.tui.close(); }
});

test('a completed shortcode is replaced inline, and a slash draft still lists commands', () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    // The closing colon is the keystroke that swaps the shortcode for its glyph.
    key(':rocket');
    assert.equal(composer.tui.state.text, ':rocket');
    key(':');
    assert.equal(composer.tui.state.text, '🚀');
    assert.equal(composer.tui.state.cursor, 2);
    // An unknown name is left as typed.
    key(' :nope:');
    assert.equal(composer.tui.state.text, '🚀 :nope:');
    // Emoji completion is tried first but falls through, so a slash draft is unaffected.
    key('\u0015/mo');
    assert.equal(composer.tui.state.text, '/mo');
    assert.ok(composer.screen().includes('/model'), 'the command list still opens');
  } finally { composer.tui.close(); }
});

test('typing a slash opens the suggestion list above the composer', () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key('/');
    const opened = composer.screen();
    assert.ok(opened.includes('❯ /agents'), opened);
    const listed = opened.split('\n').filter(row => /^\s*❯? ?\//.test(row)).length;
    assert.ok(listed >= 6, `the list fills its row budget, saw ${listed}`);
    key('mo');
    const filtered = composer.screen();
    assert.ok(filtered.includes('/model'));
    assert.equal(filtered.includes('/agents'), false, 'the list follows the typed prefix');
    key('\t');
    assert.equal(composer.tui.state.text, '/model ', 'Tab accepts the selected command');
    assert.deepEqual(composer.submitted, [], 'Tab never submits');
  } finally { composer.tui.close(); }
});

test('Enter accepts and runs the selected command, Escape closes the list', async () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key('/hel');
    key('\r');
    assert.deepEqual(composer.submitted, ['/help '], 'Enter accepts and submits a local command');
    assert.equal(composer.tui.state.text, '', 'submission clears the draft');
    key('/');
    assert.ok(composer.screen().includes('❯ /agents'));
    key('\u001b');
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(composer.screen().includes('/agents'), false, 'Escape hides the list');
    assert.equal(composer.tui.state.text, '/', 'Escape leaves the draft untouched');
    key('m');
    assert.ok(composer.screen().includes('/model'), 'editing the draft opens the list again');
  } finally { composer.tui.close(); }
});

test('an arrow moves the selection and Enter runs the highlighted row', () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key('/checkpoint');
    key('\u001b[B');
    const moved = composer.screen();
    assert.ok(moved.includes('❯ /checkpoint-recover'), moved);
    key('\r');
    assert.deepEqual(composer.submitted, ['/checkpoint-recover '],
      'the arrow moved the selection before Enter');
  } finally { composer.tui.close(); }
});

test('ctrl+p and ctrl+n walk the selection, and the draft keeps it by row', () => {
  const composer = startComposer(TUI_COMMANDS);
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key('/checkpoint');
    key('\u0010');
    assert.ok(composer.screen().includes('❯ /checkpoint-recover'),
      'ctrl+p walks back to the last row from the first');
    key('\u000e');
    assert.ok(composer.screen().includes('❯ /checkpoint'));
    key('r');
    assert.ok(composer.screen().includes('❯ /checkpoint-recover'),
      'the selection follows its row id across a draft edit');
  } finally { composer.tui.close(); }
});
