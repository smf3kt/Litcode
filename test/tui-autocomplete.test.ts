import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type { Terminal as TerminalType } from '@xterm/headless';
import { COMMAND_HELP } from '../src/interactive.js';
import { TuiTerminal } from '../src/tui.js';
import { acceptanceText, commandQuery, commandSuggestions, layoutSuggestionRows,
  maxVisibleSuggestions, suggestionMaxColumnWidth, suggestionRowHeight, suggestionRowOwners,
  suggestionRowWindow, suggestionsEmptyMessage, tuiCommandsWithSkills,
  TUI_COMMANDS, type CommandSuggestion, type TuiCommand } from '../src/tui-autocomplete.js';

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

const layoutCommands = TUI_COMMANDS.map(command => command.name === 'model'
  ? { ...command, description: 'Choose or enter a model, then start a session with completed history' }
  : command);
test('a row is the pointer, the padded command, the kind lane and the description', () => {
  const suggestions = commandSuggestions('/mo', 3, layoutCommands);
  const rows = layoutSuggestionRows(suggestions, 0, 100, '❯ ');
  assert.equal(rows.length, suggestions.length, 'the descriptions fit on one line at 100 columns');
  for (const row of rows) assert.equal([...row].length, 100);
  assert.ok(rows[0]!.startsWith('❯ /model'));
  assert.ok(rows[0]!.includes('Choose or enter a model'));
  assert.ok(rows[1]!.startsWith('  '), 'an unselected row keeps the pointer lane blank');
  // Source `_t`: `config` draws its label, `action` draws seven blank cells so the
  // descriptions still line up, and the lane starts at the widest row plus five.
  assert.ok(rows[0]!.includes('config '), 'a config command names its lane');
  assert.equal(rows[2]!.slice(19, 26), '       ', 'an action command leaves its lane blank');
  assert.equal(rows[0]!.indexOf('config'), 19, 'the lane starts at the widest row plus five');
  // Source `ee`/`No`: past 40% of the terminal the lane is pushed right, and the name
  // itself is cut to keep a two-cell gap with the source's trailing ellipsis.
  const narrow = layoutSuggestionRows(suggestions, 0, 20, '❯ ');
  assert.ok(narrow[0]!.startsWith('❯ /mo…'), narrow[0]!);
  assert.equal(narrow[0]!.includes('Choose'), false, 'a narrow column drops the description');
  for (const row of narrow) assert.equal([...row].length, 20);
});

test('a description that does not fit wraps onto a second line under its own column', () => {
  const suggestions = commandSuggestions('/mo', 3, layoutCommands);
  const rows = layoutSuggestionRows(suggestions, 0, 60, '❯ ');
  assert.equal(rows.length, suggestions.length * 2, 'every row needs two lines at 60 columns');
  for (const row of rows) assert.equal([...row].length, 60);
  // The continuation starts where the description began, one row below its own row.
  assert.equal(rows[1]!.indexOf('start'), rows[0]!.indexOf('Choose'), 'the tail is indented to the description');
  assert.equal(rows[1]!.trim().length > 0, true);
  // Source `_o`: the row height is one when the whole description fits beside the lanes.
  const heights = suggestions.map(row => suggestionRowHeight(row, suggestionMaxColumnWidth(suggestions), 100, 2));
  assert.deepEqual(heights, [1, 1, 1, 1], '100 columns leaves room for every description');
  assert.deepEqual(suggestionRowOwners(heights), [0, 1, 2, 3], 'one line each, so each line owns its row');
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

function startComposer(commands: readonly TuiCommand[], workspace?: string,
  agentTypes?: readonly { name: string; description: string }[],
  mcpCatalog?: () => Promise<{ resources: Record<string, readonly { server: string; uri: string; name?: string; description?: string; mimeType?: string }[]>;
    templates: Record<string, readonly { server: string; uriTemplate: string; name?: string; description?: string; mimeType?: string }[]> }>) {
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
  const tui = new TuiTerminal({ input, output, commands, workspace, agentTypes, mcpCatalog,
    onSubmit: text => submitted.push(text) }).start();
  const screen = () => {
    const buffer = terminal.buffer.active;
    return Array.from({ length: terminal.rows }, (_, row) =>
      buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '').join('\n');
  };
  return { tui, submitted, input, screen };
}

test('a file row draws its own lane glyph and keeps its basename when the path is cut', () => {
  const file = (path: string): CommandSuggestion => ({
    id: `file-${path}`, name: path, insertName: path, displayText: path, description: '',
    kind: 'file', executeOnAccept: false });
  const long = file('src/very/deeply/nested/directory/structure/alpha.ts');
  const [row] = layoutSuggestionRows([long], 0, 40, '❯ ');
  assert.ok(row!.startsWith('❯ + src/very'), row!);
  assert.ok(row!.includes('…/alpha.ts'), `the middle cut keeps the basename: ${row}`);
  assert.equal([...row!].length, 40);
  const [wide] = layoutSuggestionRows([long], 0, 100, '❯ ');
  assert.ok(wide!.startsWith(`❯ + ${long.displayText}`), wide!);
  // Source `_o`: a special family is always one line, description or not.
  assert.equal(suggestionRowHeight(long, 30, 40, 2), 1);
  assert.equal(suggestionRowHeight({ ...long, description: 'a long description that would wrap' },
    30, 40, 2), 1);
  const [described] = layoutSuggestionRows([{ ...long, description: 'A source file' }], 0, 60, '❯ ');
  assert.ok(described!.includes(' – A source file'), described!);
});

test('typing @ opens the file list and Tab fills the shared prefix before accepting', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-at-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'alpha.ts'), '');
  fs.writeFileSync(path.join(dir, 'src', 'alpine.ts'), '');
  const composer = startComposer(TUI_COMMANDS, dir);
  const key = (text: string) => composer.input.emit('data', text);
  const waitFor = async (ready: () => boolean) => {
    for (let tries = 0; tries < 100 && !ready(); tries++) await new Promise(resolve => setTimeout(resolve, 20));
    return ready();
  };
  try {
    key('@src/al');
    assert.ok(await waitFor(() => composer.screen().includes('alpha.ts')),
      `the index answers the query: ${composer.screen()}`);
    const opened = composer.screen();
    assert.ok(opened.includes('+ src/alpha.ts'), opened);
    assert.ok(opened.includes('+ src/alpine.ts'), opened);
    assert.equal(composer.tui.state.text, '@src/al', 'the trigger leaves the draft alone');
    key('\t');
    assert.equal(composer.tui.state.text, '@src/alp', 'Tab fills the prefix both rows share');
    key('\t');
    assert.ok(/^@src\/al(p|pha\.ts) ?$/.test(composer.tui.state.text), composer.tui.state.text);
    assert.deepEqual(composer.submitted, [], 'a file row never submits');
    // An explicit path lists the directory instead of searching the index. Those rows
    // carry no `file-` id, so they take the plain layout rather than the file glyph.
    key('\u0015@./src/');
    assert.ok(await waitFor(() => composer.screen().includes('src/alpha.ts')), composer.screen());
  } finally {
    composer.tui.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an @ draft lists the agent roster beside the files and splices its display text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-agent-'));
  const composer = startComposer(TUI_COMMANDS, dir, [
    { name: 'explore', description: 'Fast read-only search agent' },
    { name: 'reviewer', description: 'Reviews a change' },
  ]);
  const key = (text: string) => composer.input.emit('data', text);
  const waitFor = async (ready: () => boolean) => {
    for (let tries = 0; tries < 100 && !ready(); tries++) await new Promise(resolve => setTimeout(resolve, 20));
    return ready();
  };
  try {
    key('@rev');
    assert.ok(await waitFor(() => composer.screen().includes('reviewer (agent)')), composer.screen());
    const opened = composer.screen();
    // Source `tse` labels every non-file row with the same family glyph as a file row.
    assert.ok(opened.includes('* reviewer (agent)'), opened);
    assert.ok(opened.includes('Reviews a change'), opened);
    assert.ok(!opened.includes('explore (agent)'), 'the filter drops the other types');
    key('\r');
    // Source `tse` output carries no template `replacement`, so `Gs` is the shared prefix
    // and one row's prefix is its whole display text: the first accept only fills it.
    assert.equal(composer.tui.state.text, '@reviewer (agent)');
    assert.deepEqual(composer.submitted, [], 'an agent row never submits');
    key('\r');
    assert.deepEqual(composer.submitted, ['@reviewer (agent)'],
      'a second Enter submits the filled draft');
  } finally {
    composer.tui.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an @ draft lists an MCP resource row and accepts an explicit server template', async () => {
  const catalog = async () => ({
    resources: { docs: [{ server: 'docs', uri: 'docs://guide', name: 'Guide' }] },
    templates: { repo: [{ server: 'repo', uriTemplate: 'repo://file/{path}', name: 'File' }] },
  });
  const composer = startComposer(TUI_COMMANDS, undefined, undefined, catalog);
  const key = (text: string) => composer.input.emit('data', text);
  const waitFor = async (ready: () => boolean) => {
    for (let tries = 0; tries < 100 && !ready(); tries++) await new Promise(resolve => setTimeout(resolve, 20));
    return ready();
  };
  try {
    key('@docs');
    assert.ok(await waitFor(() => composer.screen().includes('docs:docs://guide')), composer.screen());
    const opened = composer.screen();
    assert.ok(opened.includes('◇ docs:docs://guide'), opened);
    assert.ok(opened.includes('Guide'), opened);
    key('\u0015@repo:repo://fi');
    assert.ok(await waitFor(() => composer.screen().includes('repo:repo://file/')), composer.screen());
    assert.ok(composer.screen().includes('◇ repo:repo://file/'), composer.screen());
    key('\r');
    // Source `ese` + `partial`: the template writes its replacement and keeps the draft open.
    assert.equal(composer.tui.state.text, '@repo:repo://file/');
    assert.deepEqual(composer.submitted, [], 'a partial template never submits');
  } finally {
    composer.tui.close();
  }
});

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
    // An empty query ranks every command equally, so the list is the whole table in name
    // order and the highlight sits on the first row. Assert the shape, not the first name.
    assert.ok(/❯ \/\S/.test(opened), opened);
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
    const open = composer.screen();
    const row = open.split('\n').map(line => line.match(/❯ (\/\S+)/)?.[1]).find(Boolean);
    assert.ok(row, `the list opens with a highlighted row:\n${open}`);
    key('\u001b');
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(composer.screen().includes(row), false, 'Escape hides the list');
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

test('the recovered aliases resolve to their canonical rows', () => {
  const rows: [string, string][] = [['name', 'rename'], ['bashes', 'tasks'], ['allowed-tools', 'permissions'],
    ['quit', 'exit'], ['reset', 'clear'], ['new', 'clear'], ['undo', 'rewind'],
    ['plugins', 'plugin'], ['marketplace', 'plugin']];
  for (const [alias, canonical] of rows) {
    const found = commandSuggestions(`/${alias}`, alias.length + 1, TUI_COMMANDS);
    assert.equal(found[0]?.name, canonical, alias);
    assert.equal(found[0]?.matchedAlias, alias);
  }
});

test('the recovered usage aliases resolve to the usage row', () => {
  for (const alias of ['cost', 'stats']) {
    const rows = commandSuggestions(`/${alias}`, alias.length + 1, TUI_COMMANDS);
    assert.equal(rows[0]?.name, 'usage');
    assert.equal(rows[0]?.matchedAlias, alias);
    assert.equal(rows[0]?.insertName, alias);
  }
});

test('the model description getter reads current state and keeps the recovered label cleanup', () => {
  let model = 'fixture/one';
  const catalog = tuiCommandsWithSkills([
    { name: 'model', description: 'shadowed', userInvocable: true },
    { name: 'review', description: 'Review changes', userInvocable: true },
  ], { fleetFork: false, currentModel: () => model });
  const row = () => commandSuggestions('/model', 6, catalog).find(command => command.name === 'model')!;
  assert.equal(row().description, 'Set the AI model (currently fixture/one)');
  for (const [input, shown] of [
    ['gateway/custom-model', 'gateway/custom-model'],
    ['\x1b[31m  custom\nmodel  \x1b[0m', 'custom model'],
    ['`<tag>`[text](url)![image][label]:', 'tag[text] (url)! [image] [label] :'],
    ['\ud800test', 'test'],
    ['⠀', 'unknown model'],
    ['a'.repeat(254) + '🦉', 'a'.repeat(254)],
    ['gateway/foo[1m]', 'gateway/foo[1m]'],
  ]) {
    model = input!;
    assert.equal(row().description, `Set the AI model (currently ${shown})`);
  }
  assert.equal(catalog.filter(command => command.name === 'model').length, 1);
  assert.equal(catalog.find(command => command.name === 'review')?.description, 'Review changes');
  assert.ok(!catalog.some(command => command.name === 'subtask'));
  assert.equal(TUI_COMMANDS.find(command => command.name === 'model')?.description, 'Set the AI model');
  assert.equal(commandSuggestions('/model', 6, [{ name: 'model', description: 'authored', kind: 'command' }])[0]?.description, 'authored');
});

test('the visible model suggestion refreshes its getter without changing the draft or accept path', () => {
  let current = { model: 'first-model' };
  const catalog = () => tuiCommandsWithSkills([], { currentModel: () => current.model });
  const composer = startComposer(catalog());
  const key = (text: string) => composer.input.emit('data', text);
  try {
    key('/model');
    assert.ok(composer.screen().includes('(currently first-model)'), composer.screen());
    current.model = 'second-model';
    composer.tui.setStatus('repaint');
    assert.ok(composer.screen().includes('(currently second-model)'), composer.screen());
    assert.ok(!composer.screen().includes('(currently first-model)'));
    assert.equal(composer.tui.state.text, '/model');
    assert.deepEqual(composer.submitted, []);
    current = { model: 'resumed-model' };
    composer.tui.setCommands(catalog());
    assert.ok(composer.screen().includes('(currently resumed-model)'), composer.screen());
    assert.equal(composer.tui.state.text, '/model');
    key('\r');
    assert.deepEqual(composer.submitted, ['/model ']);
    assert.equal(composer.tui.state.text, '');
    key('/mo\t');
    assert.equal(composer.tui.state.text, '/model ');
    assert.deepEqual(composer.submitted, ['/model ']);
    key('\x03');
  } finally { composer.tui.close(); }
});
