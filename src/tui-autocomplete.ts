import { cellWidth } from './terminal.js';

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

export interface TuiCommand {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly kind: 'command' | 'skill';
  /** A skill with declared argument names only completes; it is not submitted. */
  readonly requiresArguments?: boolean;
}

export interface SkillCommandSource {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly userInvocable: boolean;
  readonly argumentNames?: readonly string[];
}

export interface CommandSuggestion {
  readonly id: string;
  readonly name: string;
  readonly insertName: string;
  readonly displayText: string;
  readonly description: string;
  readonly kind: 'command' | 'skill';
  readonly matchedAlias?: string;
  /** Source `LK`: local commands and prompt commands without arguments submit on accept. */
  readonly executeOnAccept: boolean;
}

/** The product command table, transcribed from `COMMAND_HELP`. */
export const TUI_COMMANDS: readonly TuiCommand[] = [
  { name: 'help', description: 'Show commands', kind: 'command' },
  { name: 'status', description: 'Show session, model, context settings and usage', kind: 'command' },
  { name: 'context', description: 'Count current request against the configured context budget', kind: 'command' },
  { name: 'usage', description: 'Show recorded model usage', kind: 'command' },
  { name: 'effort', description: 'Start a session with low/medium/high/xhigh/max effort', kind: 'command' },
  { name: 'sessions', description: 'List/search workspace sessions by title, model or UUID', kind: 'command' },
  { name: 'resume', description: 'Resume a matching session or choose from a local list', kind: 'command' },
  { name: 'rename', description: 'Set the current session title', kind: 'command' },
  { name: 'skills', description: 'List available skills', kind: 'command' },
  { name: 'agents', description: 'List configured local agent types', kind: 'command' },
  { name: 'mcp', description: 'Show configured MCP servers and adapter limitations', kind: 'command' },
  { name: 'mcp-reconnect', description: 'Reconnect one server in place, or all servers into a new session', kind: 'command' },
  { name: 'tasks', description: 'Show workspace task dependencies and readiness', kind: 'command' },
  { name: 'workflows', description: 'Show this session workflow runs, including saved runs', kind: 'command' },
  { name: 'cron', description: 'Show scheduled prompts in the active session', kind: 'command' },
  { name: 'peers', description: 'List live same-host sessions and this inbox address', kind: 'command' },
  { name: 'peer-held', description: 'Review held peer messages', kind: 'command' },
  { name: 'peer-inbound', description: 'Set the explicit inbound policy', kind: 'command' },
  { name: 'diff', description: 'Show a page of file changes against a checkpoint', kind: 'command' },
  { name: 'reload', description: 'Reload local instructions, skills, hooks, tools and settings into a new session', kind: 'command' },
  { name: 'attach', description: 'Submit an image/PDF with a task (quote paths with spaces)', kind: 'command' },
  { name: 'paste-image', description: 'Read a PNG image from the clipboard and submit it with a task', kind: 'command' },
  { name: 'continue', description: 'Resume an interrupted turn', kind: 'command' },
  { name: 'compact', description: 'Summarize completed history', kind: 'command' },
  { name: 'fork', description: 'Fork completed history into a new session', kind: 'command' },
  { name: 'background', description: 'Fork this session into a detached background task', kind: 'command' },
  { name: 'rewind', description: 'Branch conversation at completed turn N (files stay as they are)', kind: 'command' },
  { name: 'checkpoint', description: 'Associate a file snapshot with the current completed turn', kind: 'command' },
  { name: 'checkpoint-recover', description: 'Resolve a proven interrupted restore; changed files stay preserved', kind: 'command' },
  { name: 'cwd', description: 'Relocate completed conversation into an existing workspace', kind: 'command' },
  { name: 'worktree', description: 'Create/enter an owned checkout and relocate completed history', kind: 'command' },
  { name: 'worktree-exit', description: 'Return; optionally archive history and remove owned checkout/branch', kind: 'command' },
  { name: 'worktree-history', description: 'List preserved worktree histories; restore one to its original name', kind: 'command' },
  { name: 'model', description: 'Choose or enter a model, then start a session with completed history', kind: 'command' },
  { name: 'theme', description: 'Preview, choose and save a terminal theme', kind: 'command' },
  { name: 'thinking', description: 'Toggle or set thinking in a new session with completed history', kind: 'command' },
  { name: 'plan', description: 'Start a read-only session', kind: 'command' },
  { name: 'permissions', description: 'Start a session in default/plan/acceptEdits/ask/bypass mode', kind: 'command' },
  { name: 'editor', description: 'Edit the current draft in VISUAL/EDITOR (Ctrl+G at a terminal)', kind: 'command' },
  { name: 'config', description: 'Save and apply the input editor mode', kind: 'command' },
  { name: 'vim', description: 'Open the Editor mode setting', kind: 'command' },
  { name: 'clear', description: 'Start a new session without changing existing logs', kind: 'command' },
  { name: 'exit', description: 'Close the interactive session', kind: 'command' },
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
    matchedAlias,
    executeOnAccept: command.kind === 'command' || command.requiresArguments !== true,
  };
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

export function suggestionWindow(count: number, selected: number, maxVisible: number):
{ start: number; end: number; selected: number } {
  if (count === 0) return { start: 0, end: 0, selected: -1 };
  const visible = Math.max(1, Math.min(maxVisible, count));
  const index = Math.max(0, Math.min(selected, count - 1));
  const start = Math.max(0, Math.min(index - Math.floor(visible / 2), count - visible));
  return { start, end: start + visible, selected: index };
}

function truncateCells(text: string, columns: number): string {
  if (columns <= 0) return '';
  let out = '', used = 0;
  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)) {
    const cells = cellWidth(segment);
    if (used + cells > columns) break;
    out += segment; used += cells;
  }
  return out;
}

/** `iEe`/`ze`: pointer, padded command, then the description when it fits. */
export function layoutSuggestionRows(suggestions: readonly CommandSuggestion[], selected: number,
  columns: number, pointer: string): string[] {
  const width = Math.max(1, Math.floor(columns));
  const pointerWidth = cellWidth(pointer);
  const showDescription = width >= 36;
  const widest = suggestions.reduce((max, suggestion) => Math.max(max, cellWidth(suggestion.displayText)), 0);
  const nameWidth = Math.min(widest, Math.max(1, width - pointerWidth - (showDescription ? 24 : 1)));
  return suggestions.map((suggestion, index) => {
    const marker = index === selected ? pointer : ' '.repeat(pointerWidth);
    const name = truncateCells(suggestion.displayText, nameWidth);
    const gap = Math.max(2, nameWidth - cellWidth(name) + 2);
    let line = marker + name + ' '.repeat(gap);
    if (showDescription) line += truncateCells(suggestion.description, Math.max(0, width - cellWidth(line)));
    if (cellWidth(line) > width) line = truncateCells(line, width);
    if (cellWidth(line) < width) line += ' '.repeat(width - cellWidth(line));
    return line;
  });
}

/** `LK`: accepting a suggestion replaces the draft with `/<name> ` and puts the cursor after it. */
export function acceptanceText(suggestion: CommandSuggestion): string {
  return `/${suggestion.insertName} `;
}
