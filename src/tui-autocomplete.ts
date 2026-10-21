import { cellWidth } from './terminal.js';
import { EMOJI_QUERY, emojiSuggestions } from './tui-emoji.js';

/**
 * Slash-command suggestions for the composer, adapted from the recovered
 * interactive application `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31):
 * `Wre` [507454,507979) builds a row, `U0` [507979,509573) filters and orders
 * suggestions, `LK` [510169,510842) accepts one, and `mse` [569848,592289)
 * owns the key semantics. The row window is adapted from
 * `chunk-qfjvvwpv.js` (SHA-256
 * 116de8fc147859476928cc4bb1a0c61d1a54b1373f46eb01bfee91349e1b2504)
 * `iEe` [8770,10298) and `ze` [4084,8770). Coordinates are zero-based UTF-16
 * half-open ranges.
 *
 * The source receives its `commands` array as a prop, so the catalog here is
 * this product's own command set. It mirrors `COMMAND_HELP` one-to-one rather
 * than copying the vendor command table; skills are supplied by the caller.
 */

/**
 * Source `Ixs` plus the vendor name table in `chunk-wtch2p0g.js`: the lane a row shows.
 * `action` draws an empty lane, `info` draws `config`, and `skill` comes from the entry
 * type rather than the table.
 */
export type SuggestionLane = 'config' | 'action' | 'info' | 'agent' | 'skill';

export interface TuiCommand {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly kind: 'command' | 'skill';
  /** Source `a`: the lane this command draws. Defaults to `action`, the table's default. */
  readonly lane?: Exclude<SuggestionLane, 'skill'>;
  /** Source `_Dt`: the `[tag]` lane. No local command sets one yet. */
  readonly tag?: string;
  /** Source `_Dt`: the `[sourceTag]` lane, which only prompt entries carry. */
  readonly sourceTag?: 'project' | 'org' | 'claude.ai';
  /** A skill with declared argument names only completes; it is not submitted. */
  readonly requiresArguments?: boolean;
}

export interface SkillCommandSource {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly userInvocable: boolean;
  readonly argumentNames?: readonly string[];
  /** Source `q2n`/`_Dt`: only a project-settings skill draws a `[project]` lane. */
  readonly source?: string;
}

export interface CommandSuggestion {
  readonly id: string;
  readonly name: string;
  readonly insertName: string;
  readonly displayText: string;
  readonly description: string;
  readonly kind: 'command' | 'skill' | 'emoji' | 'file' | 'directory';
  /** Source `Wre`: the resolved lane. An emoji row has no lane, which is `_t`'s
   *  "kind is undefined" case. */
  readonly lane?: SuggestionLane;
  /** Source `Wre`: `[dynamic workflow]` for a workflow prompt entry. */
  readonly tag?: string;
  /** Source `_Dt`: `project`/`org`/`claude.ai` for a prompt entry from that source. */
  readonly sourceTag?: string;
  readonly matchedAlias?: string;
  /** Source `JI`: a row that carries its own replacement text. A template always does, and
   *  its presence suppresses the shared-prefix fill. */
  readonly metadata?: { readonly replacement: string; readonly partial: boolean };
  /** Source `LK`: local commands and prompt commands without arguments submit on accept. */
  readonly executeOnAccept: boolean;
}

/** The product command table, transcribed from `COMMAND_HELP`. */
export const TUI_COMMANDS: readonly TuiCommand[] = [
  { name: 'help', description: 'Show help and available commands', kind: 'command', lane: 'info' },
  { name: 'status', description: 'Show session, model, context settings and usage', kind: 'command', lane: 'info' },
  { name: 'context', description: 'Count current request against the configured context budget', kind: 'command', lane: 'info' },
  { name: 'usage', description: 'Show recorded model usage', kind: 'command', lane: 'info' },
  { name: 'effort', description: 'Set effort level for model usage', kind: 'command', lane: 'config' },
  { name: 'copy', description: "Copy Claude's last response to clipboard (or /copy N for the Nth-latest)", kind: 'command', lane: 'action' },
  { name: 'export', description: 'Export the current conversation to a file or clipboard', kind: 'command', lane: 'action' },
  { name: 'autocompact', description: 'Set how full the context gets before auto-summarizing', kind: 'command', lane: 'config' },
  { name: 'color', description: 'Set the prompt bar color for this session', kind: 'command', lane: 'config' },
  { name: 'keybindings', description: 'Open your keyboard shortcuts file', kind: 'command', lane: 'config' },
  { name: 'scroll-speed', description: 'Adjust mouse wheel scroll speed', kind: 'command', lane: 'config' },
  { name: 'tui', description: 'Set the terminal UI renderer (default | fullscreen)', kind: 'command', lane: 'config' },
  { name: 'focus', description: 'Toggle focus view: just your prompt, summary, and response', kind: 'command', lane: 'config' },
  { name: 'add-dir', description: 'Add a new working directory', kind: 'command', lane: 'action' },
  { name: 'hooks', description: 'View hook configurations for tool events', kind: 'command', lane: 'config' },
  { name: 'sessions', description: 'List/search workspace sessions by title, model or UUID', kind: 'command', lane: 'info' },
  { name: 'resume', description: 'Resume a matching session or choose from a local list', kind: 'command', lane: 'action' },
  { name: 'rename', description: 'Set the current session title', kind: 'command', lane: 'action' },
  { name: 'skills', description: 'List available skills', kind: 'command', lane: 'info' },
  { name: 'agents', description: 'List configured local agent types', kind: 'command', lane: 'config' },
  { name: 'mcp', description: 'Show configured MCP servers and adapter limitations', kind: 'command', lane: 'config' },
  { name: 'mcp-reconnect', description: 'Reconnect one server in place, or all servers into a new session', kind: 'command', lane: 'action' },
  { name: 'tasks', description: 'Show workspace task dependencies and readiness', kind: 'command', lane: 'agent' },
  { name: 'workflows', description: 'Browse running and completed workflows', kind: 'command', lane: 'agent' },
  { name: 'cron', description: 'Show scheduled prompts in the active session', kind: 'command', lane: 'agent' },
  { name: 'loop', description: 'Repeat a prompt or command on an interval (e.g. /loop 5m /foo)', kind: 'command', lane: 'agent' },
  { name: 'peers', description: 'List live same-host sessions and this inbox address', kind: 'command', lane: 'agent' },
  { name: 'peer-held', description: 'Review held peer messages', kind: 'command', lane: 'agent' },
  { name: 'peer-inbound', description: 'Set the explicit inbound policy', kind: 'command', lane: 'agent' },
  { name: 'diff', description: 'Show a page of file changes against a checkpoint', kind: 'command', lane: 'info' },
  { name: 'reload', description: 'Reload local instructions, skills, hooks, tools and settings into a new session', kind: 'command', lane: 'action' },
  { name: 'reload-skills', description: 'Pick up skills added or changed on disk during this session', kind: 'command', lane: 'action' },
  { name: 'attach', description: 'Submit an image/PDF with a task (quote paths with spaces)', kind: 'command', lane: 'action' },
  { name: 'paste-image', description: 'Read a PNG image from the clipboard and submit it with a task', kind: 'command', lane: 'action' },
  { name: 'continue', description: 'Resume an interrupted turn', kind: 'command', lane: 'action' },
  { name: 'compact', description: 'Summarize completed history', kind: 'command', lane: 'action' },
  { name: 'fork', description: 'Fork completed history into a new session', kind: 'command', lane: 'agent' },
  { name: 'background', description: 'Fork this session into a detached background task', kind: 'command', lane: 'action' },
  { name: 'rewind', description: 'Branch conversation at completed turn N (files stay as they are)', kind: 'command', lane: 'action' },
  { name: 'checkpoint', description: 'Associate a file snapshot with the current completed turn', kind: 'command', lane: 'action' },
  { name: 'checkpoint-recover', description: 'Resolve a proven interrupted restore; changed files stay preserved', kind: 'command', lane: 'action' },
  { name: 'cwd', description: 'Relocate completed conversation into an existing workspace', kind: 'command', lane: 'action' },
  { name: 'worktree', description: 'Create/enter an owned checkout and relocate completed history', kind: 'command', lane: 'action' },
  { name: 'worktree-exit', description: 'Return; optionally archive history and remove owned checkout/branch', kind: 'command', lane: 'action' },
  { name: 'worktree-history', description: 'List preserved worktree histories; restore one to its original name', kind: 'command', lane: 'action' },
  { name: 'model', description: 'Choose or enter a model, then start a session with completed history', kind: 'command', lane: 'config' },
  { name: 'theme', description: 'Preview, choose and save a terminal theme', kind: 'command', lane: 'config' },
  { name: 'thinking', description: 'Toggle or set thinking in a new session with completed history', kind: 'command', lane: 'config' },
  { name: 'plan', description: 'Start a read-only session', kind: 'command', lane: 'config' },
  { name: 'permissions', description: 'Manage allow and deny tool permission rules', kind: 'command', lane: 'config' },
  { name: 'editor', description: 'Edit the current draft in VISUAL/EDITOR (Ctrl+G at a terminal)', kind: 'command', lane: 'config' },
  { name: 'config', description: 'Browse and change local settings', kind: 'command', lane: 'config' },
  { name: 'memory', description: 'Edit instruction files in your editor', kind: 'command', lane: 'config' },
  { name: 'vim', description: 'Open the Editor mode setting', kind: 'command', lane: 'config' },
  { name: 'clear', description: 'Start a new session without changing existing logs', kind: 'command', lane: 'action' },
  { name: 'exit', description: 'Close the interactive session', kind: 'command', lane: 'action' },
];

/** Base commands plus the session's user-invocable skills. A skill whose name
 *  collides with a local command is not offered, because the local command wins
 *  in `interactiveLoop`'s dispatch. */
export function tuiCommandsWithSkills(skills: readonly SkillCommandSource[] | undefined): readonly TuiCommand[] {
  const localNames = new Set(TUI_COMMANDS.map(command => command.name));
  const extra: TuiCommand[] = [];
  for (const skill of skills ?? []) {
    if (!skill.userInvocable || localNames.has(skill.name)) continue;
    extra.push({ name: skill.name, description: skill.description || '(no description)',
      aliases: skill.aliases, kind: 'skill',
      sourceTag: skill.source === 'projectSettings' ? 'project' : undefined,
      requiresArguments: (skill.argumentNames?.length ?? 0) > 0 });
  }
  return [...TUI_COMMANDS, ...extra];
}

/** `hR`: the draft is a slash command name with no arguments. */
export function isCommandQuery(text: string): boolean {
  if (!text.startsWith('/')) return false;
  const token = text.slice(1);
  return token === '' || /^[A-Za-z0-9._:-]+$/.test(token);
}

/** The command token the menu answers to, or undefined when the draft is not a command query. */
export function commandQuery(text: string, cursor: number): string | undefined {
  if (cursor < 1 || cursor > text.length) return undefined;
  if (!isCommandQuery(text)) return undefined;
  return text.slice(1).toLowerCase();
}

function nameParts(name: string): string[] {
  const lower = name.toLowerCase();
  const local = lower.slice(lower.lastIndexOf(':') + 1);
  return local === lower ? [lower] : [lower, local];
}

/** Prefix, substring, then subsequence scoring over the full name and its local segment. */
function matchScore(query: string, name: string): number | undefined {
  let best: number | undefined;
  for (const part of nameParts(name)) {
    if (part === query) return 1000 + Math.max(0, 80 - part.length);
    if (part.startsWith(query)) best = Math.max(best ?? 0, 900 - part.length);
    else {
      const at = part.indexOf(query);
      if (at >= 0) best = Math.max(best ?? 0, 700 - at - Math.floor(part.length / 4));
      else {
        const span = subsequenceSpan(part, query);
        if (span !== undefined) best = Math.max(best ?? 0, 500 - span);
      }
    }
  }
  return best;
}

function subsequenceSpan(haystack: string, needle: string): number | undefined {
  let at = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, at);
    if (found < 0) return undefined;
    at = found + 1;
  }
  return at - needle.length;
}

function bestMatch(query: string, command: TuiCommand):
{ score: number; matchedAlias?: string } | undefined {
  let best: { score: number; matchedAlias?: string } | undefined;
  const named = matchScore(query, command.name);
  if (named !== undefined) best = { score: named };
  for (const alias of command.aliases ?? []) {
    const scored = matchScore(query, alias);
    if (scored === undefined) continue;
    if (!best || scored > best.score) best = { score: scored, matchedAlias: alias };
  }
  if (best && command.kind === 'skill') best = { ...best, score: best.score + 25 };
  return best;
}

function toSuggestion(command: TuiCommand, matchedAlias?: string): CommandSuggestion {
  const aliasSuffix = matchedAlias && matchedAlias !== command.name ? ` (${matchedAlias})` : '';
  return {
    id: `${command.kind}:${command.name}`,
    name: command.name,
    insertName: matchedAlias ?? command.name,
    displayText: `/${command.name}${aliasSuffix}`,
    description: command.description,
    kind: command.kind,
    lane: command.kind === 'skill' ? 'skill' : command.lane ?? 'action',
    tag: command.tag,
    sourceTag: command.sourceTag,
    matchedAlias,
    executeOnAccept: command.kind === 'command' || command.requiresArguments !== true,
  };
}

/**
 * Source `H0e`: the `:partial` popup. The trigger is on the text before the cursor only,
 * so an emoji row appears while the shortcode is still being typed. Returns undefined when
 * the draft is not an emoji query, which is the source's fall-through to the command list.
 */
export function emojiRows(text: string, cursor: number): CommandSuggestion[] | undefined {
  const match = text.slice(0, cursor).match(EMOJI_QUERY);
  if (!match) return undefined;
  return emojiSuggestions(match[2]!).map(row => ({
    id: row.id,
    name: row.name,
    insertName: row.name,
    displayText: row.displayText,
    description: row.description,
    kind: 'emoji' as const,
    executeOnAccept: false,
  }));
}

/** `U0`: empty prefix orders the first five skills, then local commands, then the rest. */
function emptyQueryOrder(commands: readonly TuiCommand[]): TuiCommand[] {
  const byName = (a: TuiCommand, b: TuiCommand) => a.name.localeCompare(b.name);
  const skills = commands.filter(command => command.kind === 'skill').sort(byName);
  const locals = commands.filter(command => command.kind === 'command').sort(byName);
  return [...skills.slice(0, 5), ...locals, ...skills.slice(5)];
}

export function commandSuggestions(text: string, cursor: number,
  commands: readonly TuiCommand[]): CommandSuggestion[] {
  const query = commandQuery(text, cursor);
  if (query === undefined) return [];
  if (query === '') return emptyQueryOrder(commands).map(command => toSuggestion(command));
  const ranked: { command: TuiCommand; score: number; matchedAlias?: string }[] = [];
  for (const command of commands) {
    const match = bestMatch(query, command);
    if (match) ranked.push({ command, score: match.score, matchedAlias: match.matchedAlias });
  }
  ranked.sort((a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name));
  return ranked.map(row => toSuggestion(row.command, row.matchedAlias));
}

/** `U0`'s `suggestionsEmptyMessage` gate: a non-empty name and no matches. */
export function suggestionsEmptyMessage(text: string, cursor: number,
  suggestions: readonly CommandSuggestion[]): string | undefined {
  const query = commandQuery(text, cursor);
  if (query === undefined || query === '' || suggestions.length > 0) return undefined;
  return `No commands match "${text}"`;
}

/** `iEe`: the list may occupy at most half the screen, six rows minimum. */
export function maxVisibleSuggestions(rows: number): number {
  return Math.max(1, Math.min(Math.max(6, Math.floor(rows / 2)), rows - 3));
}

/** `ct`: the plain row's cuts all end in an ellipsis, so this is the end cut. */
function truncateCells(text: string, columns: number): string {
  return clipEnd(text, columns);
}

/**
 * `_t`: the row's kind lane, its label, and its source lane. `action` and an absent kind
 * draw an empty label, `info` draws `config`, and every present kind still spends the
 * seven-cell lane so the descriptions line up.
 */
export function suggestionLanes(row: { lane?: SuggestionLane; sourceTag?: string }):
{ kindLaneText: string; kindLabel: string; sourceText: string } {
  const kindLabel = row.lane === undefined || row.lane === 'action' ? ''
    : row.lane === 'info' ? 'config' : row.lane;
  const kindLaneText = row.lane === undefined ? ''
    : kindLabel + ' '.repeat(Math.max(0, 7 - cellWidth(kindLabel)));
  return { kindLaneText, kindLabel, sourceText: row.sourceTag ? `[${row.sourceTag}] ` : '' };
}

/** Source `ze`: only the skill and agent lanes take an accent; every other lane stays dim. */
export function laneAccent(kindLabel: string): 'skill' | 'background' | undefined {
  return kindLabel === 'skill' ? 'skill' : kindLabel === 'agent' ? 'background' : undefined;
}

/** Source `No`: how far past the 40% mark the kind lane may push the description. */
function laneOffset(row: CommandSuggestion, width: number, pointerWidth: number): number {
  const { kindLaneText, sourceText } = suggestionLanes(row);
  const tagWidth = row.tag ? cellWidth(`[${row.tag}] `) : 0;
  const room = width - Math.floor(width * 0.4) - tagWidth - cellWidth(kindLaneText)
    - cellWidth(sourceText) - 4 - (row.description ? 1 : 0);
  return room < 0 ? pointerWidth : Math.min(pointerWidth, room);
}

/**
 * Source `ee`: the column the kind lane starts at. It is the widest row plus five, unless
 * that passes 40% of the terminal, where the lane is pushed right by as much of the
 * pointer as the remaining room allows.
 */
export function suggestionColumn(row: CommandSuggestion, maxColumnWidth: number, width: number,
  pointerWidth: number): number {
  const floor = Math.floor(width * 0.4);
  return maxColumnWidth <= floor ? maxColumnWidth : floor + laneOffset(row, width, pointerWidth);
}

/** `xt`: the source collapses every whitespace run before it measures or splits. */
const SPACE_RUN = /\s+/g;
function collapsedDescription(row: CommandSuggestion): string {
  return row.description.replace(SPACE_RUN, ' ').trim();
}

/** The description column and the cells the description gets on its first line. */
function descriptionPlacement(row: CommandSuggestion, maxColumnWidth: number, width: number,
  pointerWidth: number): { column: number; tagWidth: number; laneWidth: number; room: number } {
  const column = suggestionColumn(row, maxColumnWidth, width, pointerWidth);
  const { kindLaneText, sourceText } = suggestionLanes(row);
  const tagWidth = row.tag ? cellWidth(`[${row.tag}] `) : 0;
  const laneWidth = cellWidth(kindLaneText) + tagWidth + cellWidth(sourceText);
  return { column, tagWidth, laneWidth, room: Math.max(0, width - column - laneWidth - 4) };
}

/** `_o`: the rows a suggestion needs. Only the plain families wrap, and only when the
 *  description does not fit beside the lanes. */
export function suggestionRowHeight(row: CommandSuggestion, maxColumnWidth: number, width: number,
  pointerWidth: number): number {
  // Source `_o`: a special family never wraps, whatever its description says.
  if (isSpecialRow(row.id) || !row.description) return 1;
  const { room } = descriptionPlacement(row, maxColumnWidth, width, pointerWidth);
  if (room <= 0) return 1;
  return cellWidth(collapsedDescription(row)) > room ? 2 : 1;
}

/** `Ue`: the first line and the remainder, split at the last whole word that fits. */
export function splitDescription(text: string, cells: number): [string, string] {
  if (cells <= 0 || cellWidth(text) <= cells) return [text, ''];
  const head = clipHead(text, cells);
  const rest = text.slice(head.length);
  if (rest.startsWith(' ')) return [head, rest.trimStart()];
  const space = head.lastIndexOf(' ');
  return space > 0 ? [head.slice(0, space), text.slice(space + 1)] : [head, rest];
}

/** `go`: a window of at most `maxRows` rows, held near `keptStart` and always containing
 *  the selection. A row is one or two lines, so the window is measured in rows. */
export function suggestionRowWindow(heights: readonly number[], maxRows: number,
  selected: number, keptStart: number): { start: number; end: number; usedRows: number } {
  const heightAt = (index: number) => heights[index] ?? 1;
  const grow = (start: number) => {
    let end = start + 1, used = heightAt(start);
    while (end < heights.length && used + heightAt(end) <= maxRows) { used += heightAt(end); end += 1; }
    return { start, end, usedRows: used };
  };
  const last = Math.max(0, heights.length - 1);
  let window = grow(Math.max(0, Math.min(keptStart, last)));
  if (selected >= window.end) window = grow(selected);
  else if (selected < window.start) window = { start: selected, end: selected + 1, usedRows: heightAt(selected) };
  while (window.start > 0 && window.usedRows + heightAt(window.start - 1) <= maxRows) {
    window.start -= 1; window.usedRows += heightAt(window.start);
  }
  return grow(window.start);
}

/** The suggestion each drawn line belongs to, so a click resolves to a row. */
export function suggestionRowOwners(heights: readonly number[]): number[] {
  const owners: number[] = [];
  heights.forEach((height, index) => { for (let line = 0; line < height; line++) owners.push(index); });
  return owners;
}

/** Source `Zt`: the families that get their own lane glyph and row layout. */
export function isSpecialRow(id: string): boolean {
  return id.startsWith('file-') || id.startsWith('mcp-resource-')
    || id.startsWith('mcp-template') || id.startsWith('agent-');
}

/** Source `ue`: the glyph a special family draws instead of a kind lane. */
export function specialRowGlyph(id: string): string | undefined {
  if (id.startsWith('file-')) return '+';
  if (id.startsWith('mcp-resource-') || id.startsWith('mcp-template')) return '◇';
  if (id.startsWith('agent-')) return '*';
  return undefined;
}

/** The grapheme iterator every width-aware cut shares. */
const SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** `ct`: the head of the text plus an ellipsis. */
export function clipEnd(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text;
  if (columns <= 1) return '…';
  return clipHead(text, columns - 1) + '…';
}

/** `qB`: as many leading whole graphemes as fit, with no ellipsis. */
function clipHead(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text;
  if (columns <= 0) return '';
  let out = '', used = 0;
  for (const { segment } of SEGMENTER.segment(text)) {
    const cells = cellWidth(segment);
    if (used + cells > columns) break;
    out += segment;
    used += cells;
  }
  return out;
}

/** `OO`: an ellipsis then the tail of the text, which keeps a path's last segment. */
function clipLeading(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text;
  if (columns <= 1) return '…';
  const budget = columns - 1;
  const segments = [...SEGMENTER.segment(text)].map(part => part.segment);
  let used = 0, start = segments.length;
  for (let index = segments.length - 1; index >= 0; index--) {
    const cells = cellWidth(segments[index]!);
    if (used + cells > budget) break;
    used += cells;
    start = index;
  }
  return `…${segments.slice(start).join('')}`;
}

/**
 * `hc`: a path cut in the middle so its basename survives. A basename that fills the
 * budget falls back to the tail, and a budget under five cells to a plain head cut.
 */
function clipMiddle(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text;
  if (columns <= 0) return '…';
  if (columns < 5) return clipEnd(text, columns);
  const slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  const base = slash >= 0 ? text.slice(slash) : text;
  const directory = slash >= 0 ? text.slice(0, slash) : '';
  const baseWidth = cellWidth(base);
  if (baseWidth >= columns - 1) return clipLeading(text, columns);
  return clipHead(directory, columns - 1 - baseWidth) + '…' + base;
}

/** The widest row plus five, which is what the source passes as `maxColumnWidth`. */
export function suggestionMaxColumnWidth(suggestions: readonly CommandSuggestion[]): number {
  return suggestions.reduce((max, row) => Math.max(max, cellWidth(row.displayText)), 0) + 5;
}

/** A row segment and the theme role the renderer paints it with. */
export interface SuggestionRowSegment {
  readonly text: string;
  /** `skill`/`background` keep their colour; everything else follows the row. */
  readonly accent?: 'skill' | 'background';
  /** Source `ze`: the tag and source lanes are dim even on the selected row. */
  readonly dim?: boolean;
  /** The description takes the `suggestion` slot when the row is selected. */
  readonly description?: boolean;
}

/**
 * `iEe`/`ze`: one line per drawn row. A row is the pointer, the padded command, the kind
 * lane, the tag and source lanes and the description; a description that does not fit
 * continues on a second line, indented to the column it started at.
 */
export function suggestionRowSegments(suggestions: readonly CommandSuggestion[], selected: number,
  columns: number, pointer: string, maxColumnWidth = suggestionMaxColumnWidth(suggestions),
  heightOf?: (row: CommandSuggestion) => number): SuggestionRowSegment[][] {
  const width = Math.max(1, Math.floor(columns));
  const pointerWidth = cellWidth(pointer);
  const lines: SuggestionRowSegment[][] = [];
  suggestions.forEach((suggestion, index) => {
    const gutter = index === selected ? pointer : ' '.repeat(pointerWidth);
    const glyph = specialRowGlyph(suggestion.id);
    if (glyph !== undefined) {
      const description = collapsedDescription(suggestion);
      const separator = suggestion.description ? 3 : 0;
      // Source `ze`: a file row reserves a description column capped at twenty cells and
      // cuts its path in the middle; an MCP resource shows a plain thirty-cell head.
      const fileFamily = suggestion.id.startsWith('file-')
        || suggestion.id.startsWith('mcp-template::') || suggestion.id.startsWith('mcp-template-value::');
      let name = suggestion.displayText;
      if (fileFamily) {
        const descriptionColumn = suggestion.description ? Math.min(20, cellWidth(description)) : 0;
        const nameBudget = width - pointerWidth - 2 - 4 - separator - descriptionColumn;
        name = suggestion.id.startsWith('mcp-template-value::')
          ? clipLeading(name, nameBudget) : clipMiddle(name, nameBudget);
      } else if (suggestion.id.startsWith('mcp-resource-')) {
        name = clipEnd(name, 30);
      }
      const descriptionBudget = width - pointerWidth - 2 - cellWidth(name) - separator - 4;
      const text = suggestion.description
        ? `${gutter}${glyph} ${name} – ${clipEnd(description, Math.max(0, descriptionBudget))}`
        : `${gutter}${glyph} ${name}`;
      const padded = cellWidth(text) >= width ? clipHead(text, width) : text + ' '.repeat(width - cellWidth(text));
      lines.push([{ text: padded }]);
      return;
    }
    const { column, tagWidth, laneWidth, room } = descriptionPlacement(suggestion, maxColumnWidth, width, pointerWidth);
    const name = truncateCells(suggestion.displayText, Math.max(0, column - 2 - pointerWidth));
    const { kindLaneText, kindLabel, sourceText } = suggestionLanes(suggestion);
    const tagText = suggestion.tag ? `[${suggestion.tag}] ` : '';
    const pad = ' '.repeat(Math.max(0, column - cellWidth(name) - pointerWidth));
    const head: SuggestionRowSegment[] = [{ text: gutter + name + pad }];
    if (kindLaneText) head.push({ text: kindLaneText, accent: laneAccent(kindLabel) });
    if (tagText) head.push({ text: tagText, dim: true });
    if (sourceText) head.push({ text: sourceText, dim: true });
    const description = collapsedDescription(suggestion);
    const wrap = (heightOf?.(suggestion) ?? suggestionRowHeight(suggestion, maxColumnWidth, width, pointerWidth)) > 1;
    if (room > 0) {
      const [first, rest] = wrap ? splitDescription(description, room) : [truncateCells(description, room), ''];
      head.push({ text: first, description: true });
      const used = head.reduce((total, segment) => total + cellWidth(segment.text), 0);
      if (used < width) head.push({ text: ' '.repeat(width - used) });
      lines.push(head);
      if (rest !== '') {
        // Source `ze`: the continuation is indented to where the description began.
        const indent = column + laneWidth - tagWidth;
        const tail = truncateCells(rest, Math.max(0, width - indent - 4));
        const filler = ' '.repeat(Math.max(0, width - indent - cellWidth(tail)));
        lines.push([{ text: ' '.repeat(indent) }, { text: tail, description: true }].concat(
          filler === '' ? [] : [{ text: filler }]));
      }
      return;
    }
    const used = head.reduce((total, segment) => total + cellWidth(segment.text), 0);
    if (used > width) lines.push([{ text: truncateCells(head.map(s => s.text).join(''), width) }]);
    else lines.push(used < width ? [...head, { text: ' '.repeat(width - used) }] : head);
  });
  return lines;
}

/** The same rows as plain text, for callers that only need the layout. */
export function layoutSuggestionRows(suggestions: readonly CommandSuggestion[], selected: number,
  columns: number, pointer: string): string[] {
  return suggestionRowSegments(suggestions, selected, columns, pointer)
    .map(segments => segments.map(segment => segment.text).join(''));
}

/** `LK`: accepting a suggestion replaces the draft with `/<name> ` and puts the cursor after it. */
export function acceptanceText(suggestion: CommandSuggestion): string {
  return `/${suggestion.insertName} `;
}
