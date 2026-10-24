import path from 'node:path';
import os from 'node:os';
import { formatTokens } from './autocompact-command.js';

/**
 * `/context`'s grid panel, ported from the recovered application. Offsets are zero-based UTF-16
 * code units in the extracted modules.
 *
 * - `chunk-sfn1dbxq.js` (`4c74137e…`): `DCn` 2109980 assembles the categories and grid geometry;
 *   `uge` 2100188, `cge` 2100217, `Zj` 2100238 are the reserved names; `FYr` 2100254 classifies
 *   them; `Orr` 858411 and `qMt` 858397 are the 3000-token and 13k reserves.
 * - `chunk-5d7rhstd.js` (`8bfa5599…`): `G` 22707 renders the panel; `zt` 19996 the cell glyph;
 *   `Mt` 20257 the row; `vt`/`Nt` the category predicates.
 *
 * The host's compaction policy owns the threshold; token counts come from the provider, so the
 * numbers are the host estimate where the gateway also estimates.
 */

export const CONTEXT_PANEL_TITLE = 'Context Usage';
export const FREE_SPACE = 'Free space';
export const AUTOCOMPACT_BUFFER = 'Autocompact buffer';
export const COMPACT_BUFFER = 'Compact buffer';
/** Source `Orr`: the reserve shown when automatic compaction is off. */
export const COMPACT_BUFFER_TOKENS = 3000;

export type ContextCategoryKind = 'category' | 'buffer' | 'free';
export interface ContextCategory { name: string; tokens: number; kind: ContextCategoryKind }
export interface ContextGridCell { categoryName: string; fullness: number }
export interface ContextDetail { name: string; tokens: number }
export interface ContextCatalogDetail extends ContextDetail {
  source: 'projectSettings' | 'userSettings' | 'localSettings' | 'flagSettings' | 'policySettings' | 'plugin' | 'mcp' | 'built-in';
  pluginName?: string;
}
export interface ContextDetails {
  mcpTools: ContextDetail[];
  agents: ContextCatalogDetail[];
  memoryFiles: ContextDetail[];
  skills: ContextCatalogDetail[];
}
export interface ContextUsage {
  model: string;
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  categories: ContextCategory[];
  gridRows: ContextGridCell[][];
  details?: ContextDetails;
}

export interface ContextCounts {
  model: string;
  systemTokens: number;
  toolTokens: number;
  messageTokens: number;
  maxTokens: number;
  /** The autocompact threshold; the reserve is the window above it. */
  compactAt?: number;
  autoCompact: boolean;
  /** Terminal width picks the 5x5 grid below 80 columns, as the recovered `hr` flag does. */
  columns?: number;
  details?: ContextDetails;
}

/** Source `FYr`: the three kinds the caption and grid switch on. */
export function contextCategoryKind(name: string): ContextCategoryKind {
  if (name === FREE_SPACE) return 'free';
  if (name === AUTOCOMPACT_BUFFER || name === COMPACT_BUFFER) return 'buffer';
  return 'category';
}

/**
 * `DCn`'s category block: the used categories, the reserve, then free space. The buffer is the
 * window above `compactAt` while automatic compaction is on (`Oo = Je - xo`), nothing while the
 * threshold is the model default (`source === "auto"`), and `Orr` when it is off.
 */
export function contextUsageFromCounts(counts: ContextCounts): ContextUsage {
  const window = Math.max(1, counts.maxTokens);
  const system = Math.max(0, counts.systemTokens);
  const tools = Math.max(0, counts.toolTokens);
  const messages = Math.max(0, counts.messageTokens);
  const used = system + tools + messages;
  // DCn, sfn1dbxq [2109980,2115882), UTF-16: detail categories partition the counted system/tool totals.
  const details = counts.details;
  const sum = (rows: readonly ContextDetail[] | undefined) => rows?.reduce((total, row) => total + row.tokens, 0) ?? 0;
  const mcp = sum(details?.mcpTools), agents = sum(details?.agents), files = sum(details?.memoryFiles), skills = sum(details?.skills);
  const categories: ContextCategory[] = [];
  const add = (name: string, tokens: number) => { if (tokens > 0) categories.push({ name, tokens, kind: 'category' }); };
  add('System prompt', Math.max(0, system - agents - files - skills));
  add('System tools', Math.max(0, tools - mcp));
  add('MCP tools', mcp);
  add('Custom agents', agents);
  add('Memory files', files);
  add('Skills', skills);
  add('Messages', messages);
  const buffer = !counts.autoCompact ? COMPACT_BUFFER_TOKENS
    : counts.compactAt === undefined ? 0 : Math.max(0, window - counts.compactAt);
  if (buffer > 0) categories.push({ name: counts.autoCompact ? AUTOCOMPACT_BUFFER : COMPACT_BUFFER,
    tokens: buffer, kind: 'buffer' });
  const reserved = categories.reduce((sum, category) => sum + (category.kind === 'category' ? category.tokens : 0), 0) + buffer;
  categories.push({ name: FREE_SPACE, tokens: Math.max(0, window - reserved), kind: 'free' });
  return { model: counts.model, totalTokens: used, maxTokens: window,
    percentage: Math.round(used / window * 100), categories,
    gridRows: contextGrid(categories, window, counts.columns),
    ...(details === undefined ? {} : { details }) };
}

/**
 * `DCn`'s grid: a category's cells are `max(1, round(tokens/window*cells))`, with the fractional
 * remainder carried by the cell after the whole part; free space fills what the categories and the
 * buffer leave, and the buffer's cells come last. Geometry follows `hr`/`es`: 5x5 narrow, 20x10 at
 * a window of at least 1e6, otherwise 10x10.
 */
export function contextGrid(categories: readonly ContextCategory[], window: number, terminalColumns = 80): ContextGridCell[][] {
  const narrow = terminalColumns < 80;
  const large = window >= 1_000_000;
  const columns = narrow ? 5 : large ? 20 : 10;
  const rows = large ? 10 : narrow ? 5 : 10;
  const cells = columns * rows;
  const buffer = categories.find(category => category.kind === 'buffer');
  const squaresOf = (category: ContextCategory): ContextGridCell[] => {
    const exact = category.tokens / window * cells;
    const whole = Math.floor(exact);
    const fraction = exact - whole;
    const squares = category.kind === 'free' ? Math.round(exact) : Math.max(1, Math.round(exact));
    const result: ContextGridCell[] = [];
    for (let index = 0; index < squares; index += 1) {
      result.push({ categoryName: category.name, fullness: index === whole && fraction > 0 ? fraction : 1 });
    }
    return result;
  };
  const cellList: ContextGridCell[] = [];
  for (const category of categories) {
    if (category.kind !== 'category') continue;
    for (const cell of squaresOf(category)) if (cellList.length < cells) cellList.push(cell);
  }
  const bufferCells = buffer ? squaresOf(buffer) : [];
  while (cellList.length < cells - bufferCells.length) {
    cellList.push({ categoryName: FREE_SPACE, fullness: 1 });
  }
  for (const cell of bufferCells) if (cellList.length < cells) cellList.push(cell);
  const grid: ContextGridCell[][] = [];
  for (let row = 0; row < rows; row += 1) grid.push(cellList.slice(row * columns, (row + 1) * columns));
  return grid;
}

/** Source `zt`: filled above 0.7, half-filled below, and the two reserved glyphs. */
export function contextCellGlyph(cell: ContextGridCell): string {
  if (cell.categoryName === FREE_SPACE) return '⛶';
  if (cell.categoryName === AUTOCOMPACT_BUFFER || cell.categoryName === COMPACT_BUFFER) return '⛝';
  return cell.fullness >= 0.7 ? '⛁' : '⛀';
}

function percent(tokens: number, window: number): string {
  return `${(tokens / window * 100).toFixed(1)}%`;
}

/**
 * `G`'s legend and grid as text. The recovered layout places the grid in a column beside the
 * legend; the host dialog is a single text body, so the legend comes first. Free space omits the
 * word "tokens" exactly as the source line does, and every non-free category uses the filled
 * glyph in the legend.
 */
export function contextPanelText(usage: ContextUsage, options: { collapseDetails?: boolean; workspace?: string } = {}): string {
  const lines = [CONTEXT_PANEL_TITLE, usage.model,
    `${formatTokens(usage.totalTokens)}/${formatTokens(usage.maxTokens)} tokens (${usage.percentage}%)`,
    '', 'Estimated usage by category'];
  for (const category of usage.categories) {
    if (category.kind === 'free') {
      lines.push(`⛶ ${category.name}: ${formatTokens(category.tokens)} (${percent(category.tokens, usage.maxTokens)})`);
      continue;
    }
    const glyph = category.kind === 'buffer' ? '⛝' : '⛁';
    lines.push(`${glyph} ${category.name}: ${formatTokens(category.tokens)} tokens (${percent(category.tokens, usage.maxTokens)})`);
  }
  lines.push('');
  for (const row of usage.gridRows) lines.push(row.map(cell => `${contextCellGlyph(cell)} `).join('').trimEnd());
  if (usage.details) lines.push(...contextDetailLines(usage.details, options));
  return lines.join('\n');
}

// ue/Po, 5d7rhstd [21935,22350)/[21874,21934), wtch2p0g [4166,4516), UTF-16; synced account groups stay absent.
export function contextDetailGroups(rows: readonly ContextCatalogDetail[]): Map<string, ContextCatalogDetail[]> {
  const labels = { projectSettings: 'Project', userSettings: 'User', localSettings: 'Local', flagSettings: 'Flag',
    policySettings: 'Managed', plugin: 'Plugin', mcp: 'MCP', 'built-in': 'Built-in' };
  const groups = new Map<string, ContextCatalogDetail[]>();
  for (const row of rows) {
    const key = labels[row.source] + (row.pluginName ? ` (${row.pluginName})` : '');
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  for (const [key, group] of groups) groups.set(key, group.sort((left, right) => right.tokens - left.tokens));
  const ordered = new Map<string, ContextCatalogDetail[]>();
  for (const label of ['Project', 'User', 'Managed', 'Plugin', 'MCP', 'Built-in']) {
    const group = groups.get(label); if (group) ordered.set(label, group);
    for (const key of [...groups.keys()].filter(key => key.startsWith(label + ' (')).sort()) ordered.set(key, groups.get(key)!);
  }
  for (const [key, group] of groups) if (!ordered.has(key)) ordered.set(key, group);
  return ordered;
}

// G/h/It/Vt/Ht/jt, 5d7rhstd [22707,29624)/[22350,22707)/[20874,21196)/[21400,21682), UTF-16.
function contextDetailLines(details: ContextDetails, options: { collapseDetails?: boolean; workspace?: string }): string[] {
  const lines: string[] = [];
  const sections = [
    { title: 'MCP tools · /mcp', noun: 'tool', rows: details.mcpTools, kind: 'tools' },
    { title: 'Custom agents · .harness/agents/', noun: 'agent', rows: details.agents, kind: 'agents' },
    { title: 'Memory files · /memory', noun: 'file', rows: details.memoryFiles, kind: 'files' },
    { title: 'Skills · /skills', noun: 'skill', rows: details.skills, kind: 'skills' },
  ] as const;
  const fileLabel = (name: string) => {
    const relative = options.workspace ? path.relative(options.workspace, name) : undefined;
    if (relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) return relative;
    const home = os.homedir(); return name.startsWith(home + path.sep) ? '~' + name.slice(home.length) : name;
  };
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    lines.push('', section.title);
    if (options.collapseDetails) {
      lines.push(`  ${section.rows.length} ${section.noun}${section.rows.length === 1 ? '' : 's'} · ${formatTokens(section.rows.reduce((sum, row) => sum + row.tokens, 0))} tokens`);
    } else if (section.kind === 'agents' || section.kind === 'skills') {
      const rows = section.kind === 'agents' ? details.agents : details.skills;
      for (const [group, entries] of contextDetailGroups(rows)) {
        lines.push(`  ${group}`);
        for (const row of entries) {
          const tokens = section.kind === 'skills' ? row.tokens < 20 ? '< 20' : `~${formatTokens(Math.round(row.tokens / 10) * 10)}` : formatTokens(row.tokens);
          lines.push(`    ${row.name}: ${tokens} tokens`);
        }
      }
    } else {
      for (const row of section.rows) lines.push(`  ${section.kind === 'files' ? fileLabel(row.name) : row.name}: ${formatTokens(row.tokens)} tokens`);
    }
  }
  if (options.collapseDetails && sections.some(section => section.rows.length > 0)) lines.push('', '/context all to expand');
  return lines;
}
