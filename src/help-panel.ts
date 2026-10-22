/**
 * The `/help` panel. Recovered from `chunk-yehhb8pt.js`, sha256
 * `c0ac0c13483588de94e740c94fa2865a11beb09a7bfb2e9073f44a7211955b7b`: the comparator `Do` at 16615,
 * the row model `Po` at 16668, the plain row `vo` at 16741, the list row `Bo` at 16832, the section
 * `C` at 16914, the list `U` at 17270, the tall threshold `mo` at 17950, the general tab `v` at
 * 17960, the builtin predicate `Uo` at 18765, the two row thresholds `to`/`so` at 18849, the panel
 * `G` at 18865 and the entry `De` at 21301. Offsets are zero-based UTF-16 code units.
 *
 * The shortcuts table is `hft` in `chunk-24k7d6mw.js` at 778248, whose key formatter `e2` sits at
 * 778164 and whose format options `Im` at 778210. The newline hint is `Z0r` in `chunk-qh0w98pn.js`
 * at 6253, and the chord formatter behind the `z` component is `JD` in `chunk-0qkpwgr4.js` at 4537:
 * `${chord} to ${action}`, or `${chord} for ${action}` where the recovered row writes the `for`.
 *
 * The panel is a `local-jsx` command with `requires: {ink: true}` and no `presentation`, so the
 * recovered host docks it in the frame; here that surface is the modal dialog, which keeps the chat
 * frame around it.
 */

import type { TerminalPromptRequest } from './terminal.js';
import type { TuiCommand } from './tui-autocomplete.js';

export const HELP_TITLE = 'Help';
export const HELP_DISMISSED = 'Help dialog dismissed';
export const HELP_INTRO = 'Claude understands your codebase, makes edits with your permission, '
  + 'and executes commands — right from your terminal.';
export const HELP_POWERUP_PREFIX = 'New here? Run ';
export const HELP_POWERUP_COMMAND = '/powerup';
export const HELP_POWERUP_SUFFIX = ' to learn the features most people miss.';
export const HELP_SHORTCUTS_HEADING = 'Shortcuts';
export const HELP_BROWSE_DEFAULT = 'Browse default commands';
export const HELP_BROWSE_CUSTOM = 'Browse custom commands';
export const HELP_CUSTOM_EMPTY = 'No custom commands found';
export const HELP_MORE_HELP_PREFIX = 'For more help: ';
export const HELP_MORE_HELP_URL = 'https://code.claude.com/docs/en/overview';
export const HELP_FEEDBACK = 'Something else? Use /feedback to report bugs or request features.';
export const HELP_KEYBINDINGS_HINT = '/keybindings to customize';
/** Source `LVe` 766656: the idle footer row that stands in for the other indicators. */
export const HELP_FOOTER_HINT = '? for shortcuts';
/**
 * The narrowest half-row that still shows the recovered row and the first key after the clip:
 * `? for shortcuts` plus two spaces plus `ctrl+o` is 23 cells. Below it the local hints stand
 * alone, so a narrow pty keeps a key it can read instead of a cut-off shortcut name.
 */
export const HELP_HINT_MIN_COLUMNS = 23;

/** Source `to`: above this many rows the panel has room for the feedback line. */
export const HELP_TALL_ROWS = 44;
/** Source `so`: below this many rows the panel drops its vertical padding. */
export const HELP_COMPACT_ROWS = 21;

export type HelpTabId = 'general' | 'commands' | 'custom';

export interface HelpTab {
  readonly id: HelpTabId;
  readonly title: string;
}

/** Source `G`'s three `Na` tabs, in the order the recovered dialog stacks them. */
export const HELP_TABS: readonly HelpTab[] = [
  { id: 'general', title: 'General' },
  { id: 'commands', title: 'Commands' },
  { id: 'custom', title: 'Custom commands' },
];

/** Source `Uo`: a prompt entry counts as builtin only when it came from a builtin or bundled source. */
export function isBuiltinHelpCommand(command: Pick<TuiCommand, 'kind'>): boolean {
  return command.kind === 'command';
}

export interface HelpEntry {
  readonly name: string;
  readonly label: string;
  readonly description: string;
}

/** Source `Po`: the row model the list builds from a command. */
function helpEntry(command: Pick<TuiCommand, 'name' | 'description'>): HelpEntry {
  return { name: command.name, label: `/${command.name}`, description: command.description };
}

/**
 * Source `U`'s `filter`/`sort`/`map`: the name-deduped, name-sorted rows of one tab. The recovered
 * also drops `isHidden` entries, which no local command declares.
 */
export function helpEntries(commands: readonly TuiCommand[], builtin: boolean): HelpEntry[] {
  const seen = new Set<string>();
  return commands
    .filter(command => isBuiltinHelpCommand(command) === builtin)
    .filter(command => (seen.has(command.name) ? false : (seen.add(command.name), true)))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(helpEntry);
}

/** Source `U`'s `t`: the rows a scrolling list shows for a body of `maxHeight` rows. */
export function helpVisibleCount(maxHeight: number): number {
  return 2 * Math.max(1, Math.floor((maxHeight - 10) / 2));
}

/** Source `v`'s `m`: the panel's compact layout, which drops the vertical padding. */
export function helpCompact(rows: number): boolean {
  return rows < HELP_COMPACT_ROWS;
}

/** Source `G`'s `l`: the tall layout, which adds the feedback line. */
export function helpTall(rows: number): boolean {
  return rows >= HELP_TALL_ROWS;
}

/** Source `Z0r`: how this terminal makes a newline in the composer. */
export function newlineHint(supportsShiftEnter: boolean): string {
  return supportsShiftEnter ? 'shift + ⏎ for newline' : 'backslash (\\) + return (⏎) for newline';
}

/**
 * Source `e2` with the `h9` key glyphs the table's own chords need: the recovered splits the chord
 * on `+` and rejoins it with `modSep`, which `Im` sets to ` + `.
 */
export function chordDisplay(chord: string): string {
  return chord.split('+').map(part => (part === 'return' ? '⏎' : part)).join(' + ');
}

/** The chord an action is bound to here, in the recovered `us`/`ma` shape. */
export interface HelpChords {
  (action: string, context: 'Global' | 'Chat', fallback: string): string;
}

/**
 * Source `hft`'s three columns. The left column is the four composer sigils, the second the
 * composer's own gestures, the third the session actions; `null` in the recovered tree is a blank
 * row, kept here as an empty string so the columns stay aligned.
 */
export function helpShortcutColumns(chords: HelpChords, options: { platform?: NodeJS.Platform } = {}): string[][] {
  const platform = options.platform ?? process.platform;
  const row = (action: string, context: 'Global' | 'Chat', fallback: string, verb: 'to' | 'for') =>
    `${chordDisplay(chords(action, context, fallback))} ${verb}`;
  return [
    ['! for shell mode', '/ for commands', '@ for file paths', '/btw for side question'],
    [
      'double tap esc to clear input',
      `${row('chat:cycleMode', 'Chat', 'shift+tab', 'to')} auto-accept edits`,
      '',
      `${row('app:toggleTranscript', 'Global', 'ctrl+o', 'for')} verbose output`,
      `${row('app:toggleTodos', 'Global', 'ctrl+t', 'to')} toggle tasks`,
      '',
      '',
      newlineHint(false),
    ],
    [
      `${row('chat:undo', 'Chat', 'ctrl+_', 'to')} undo`,
      ...(platform === 'win32' ? [] : [`${row('chat:suspend', 'Chat', 'ctrl+z', 'to')} suspend`]),
      `${row('chat:imagePaste', 'Chat', 'ctrl+v', 'to')} paste images`,
      `${row('chat:modelPicker', 'Chat', 'alt+p', 'to')} switch model`,
      `${row('chat:fastMode', 'Chat', 'alt+o', 'to')} toggle fast mode`,
      `${row('chat:stash', 'Chat', 'ctrl+s', 'to')} stash prompt`,
      `${row('chat:externalEditor', 'Chat', 'ctrl+g', 'to')} edit in $EDITOR`,
      HELP_KEYBINDINGS_HINT,
    ],
  ];
}

/** Source `vo`: the numbered plain row the list falls back to without a list component. */
export function helpCommandRow(entry: HelpEntry, index: number): string {
  return `${index + 1}. ${entry.label} — ${entry.description}`;
}

/** Source `Bo`: the list row's own two fields, which the local row renderer draws as `label  description`. */
export function helpCommandRowParts(entry: HelpEntry): { label: string; description: string } {
  return { label: entry.label, description: entry.description };
}

/** The tab the panel opens on, and the one a left/right step lands on. */
export function helpTabIndex(id: HelpTabId): number {
  return HELP_TABS.findIndex(tab => tab.id === id);
}

export function helpTabAt(index: number): HelpTab {
  const wrapped = ((index % HELP_TABS.length) + HELP_TABS.length) % HELP_TABS.length;
  return HELP_TABS[wrapped]!;
}

/** The tab titles as one row, the current one bracketed, the way the recovered tabs draw. */
export function helpTabRow(active: HelpTabId): string {
  return HELP_TABS.map(tab => (tab.id === active ? `[${tab.title}]` : ` ${tab.title} `)).join(' ');
}

export interface HelpPanelInput {
  readonly commands: readonly TuiCommand[];
  readonly rows: number;
  readonly chords: HelpChords;
  /** The message's own column budget, for the shortcut table's three-column layout. */
  readonly columns?: number;
}

const SHORTCUT_COLUMN_WIDTHS = [24, 35, 35];
/** The recovered table draws its three columns side by side; below this it stacks them. */
const SHORTCUT_TABLE_WIDTH = SHORTCUT_COLUMN_WIDTHS.reduce((total, width) => total + width + 2, -2);

/** Source `hft`: the three columns side by side when they fit, stacked when they do not. */
export function helpShortcutTable(chords: HelpChords, columns: number,
  options: { platform?: NodeJS.Platform } = {}): string[] {
  const table = helpShortcutColumns(chords, options);
  const widths = SHORTCUT_COLUMN_WIDTHS;
  if (columns < SHORTCUT_TABLE_WIDTH) return table.flatMap(column => column.filter(row => row !== ''));
  const height = Math.max(...table.map(column => column.length));
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    lines.push(table
      .map((column, index) => (column[row] ?? '').padEnd(widths[index]!))
      .join('  ').trimEnd());
  }
  return lines;
}

/** Source `v`'s general tab, then `C`'s two list tabs, as the panel's message lines. */
export function helpTabBody(input: HelpPanelInput, tab: HelpTabId): string[] {
  const tall = helpTall(input.rows);
  if (tab === 'general') {
    return [
      HELP_INTRO,
      ...(tall ? [HELP_POWERUP_PREFIX + HELP_POWERUP_COMMAND + HELP_POWERUP_SUFFIX] : []),
      '',
      HELP_SHORTCUTS_HEADING,
      ...helpShortcutTable(input.chords, input.columns ?? SHORTCUT_TABLE_WIDTH),
    ];
  }
  const entries = helpEntries(input.commands, tab === 'commands');
  const title = tab === 'commands' ? HELP_BROWSE_DEFAULT : HELP_BROWSE_CUSTOM;
  if (entries.length === 0 && tab === 'custom') return [title, '', HELP_CUSTOM_EMPTY];
  return [title, '', ...entries.map(helpCommandRow)];
}

/** Source `G`'s footer: the docs link always, the feedback line only in the tall layout. */
export function helpFooter(rows: number): string[] {
  return [HELP_MORE_HELP_PREFIX + HELP_MORE_HELP_URL, ...(helpTall(rows) ? ['', HELP_FEEDBACK] : [])];
}

/** Source `G`'s `sS`: the tabbed dialog, here a chooser whose rows are its tabs. */
export function helpPanelRequest(input: HelpPanelInput, tab: HelpTabId = 'general'): TerminalPromptRequest {
  return {
    title: HELP_TITLE,
    message: [helpTabRow(tab), '', ...helpTabBody(input, tab), '', ...helpFooter(input.rows)].join('\n'),
    choices: HELP_TABS.map(entry => ({ label: entry.title, value: entry.id })),
    defaultIndex: Math.max(0, helpTabIndex(tab)),
  };
}

export type HelpPanelAnswer = { selected: readonly string[] } | undefined;

/**
 * Source `G`'s navigation: the tabs are switched from inside the panel and `Esc` dismisses it. The
 * recovered dialog keeps `navFromContent`, so a tab step does not leave the panel.
 */
export async function browseHelp(input: HelpPanelInput,
  read: (request: TerminalPromptRequest) => Promise<HelpPanelAnswer>): Promise<string | undefined> {
  let tab: HelpTabId = 'general';
  for (;;) {
    const answer = await read(helpPanelRequest(input, tab));
    if (answer === undefined) return HELP_DISMISSED;
    const picked = HELP_TABS.find(entry => entry.id === answer.selected[0]);
    if (picked === undefined) return HELP_DISMISSED;
    tab = picked.id;
  }
}
