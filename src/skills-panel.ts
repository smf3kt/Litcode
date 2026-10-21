/**
 * The `/skills` panel. Recovered from `chunk-hkrgn8hf.js`, sha256
 * `39a1769355adecf252d7842b15c2d2fab0770e8af9fc66dd3f6d707968cf2f82`: the local component `He` at
 * 23602 and its registration `wr` at 31783. Cross-chunk helpers come from `chunk-z3fv2hxp.js`
 * (`cgt` 1033, `PLr` 1233, `F` 1828, `b` 2097, `BIe` 2143, `xje` 2341, `ILr` 2408, `Pje` 4664,
 * `O4n` 4966, `Ije` 5059, `Oje` 5212, `w$t` 5422, sha256
 * `2954bdb160b17cb3dbe5b7d335df40053653ef6b57cd07da0dd653dce7220360`), the token counter `Td`
 * (`chunk-hwpb27as.js` 4137: `Math.round(text.length / bytesPerToken)`), the skill text `OQr`
 * (`chunk-sfn1dbxq.js` 3372617), and the token range formatter `KB` (`chunk-yn0pfn70.js` 11476).
 * Offsets are zero-based UTF-16 code units.
 */

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import type { PermissionFilePaths } from './permission-settings.js';

/** `cgt` at 1033: the cycle order enter and space walk. */
export const SKILL_MODES = ['on', 'name-only', 'user-invocable-only', 'off'] as const;
export type SkillMode = typeof SKILL_MODES[number];

export const SKILLS_TITLE = 'Skills';
export const SKILLS_DISMISSED = 'Skills dialog dismissed';
export const SKILLS_PLUGIN_FOOTER = 'Plugin skills are managed via /plugin';
export const SKILLS_EMPTY = 'No skills found';
/** The recovered hint names the product's own folders; this host reads `.harness/skills`. */
export const SKILLS_EMPTY_HINT = 'Create skills in .harness/skills/ or ~/.claude/skills/';

/** The fields the panel reads from a loaded skill. */
export interface SkillPanelSkill {
  readonly name: string;
  readonly description: string;
  readonly source?: 'userSettings' | 'projectSettings' | 'plugin';
  readonly userInvocable: boolean;
  readonly disableModelInvocation: boolean;
  /** Frontmatter `when_to_use`, which the recovered token estimate includes. */
  readonly whenToUse?: string;
}

/** `PLr` at 1233: a mode the author, the reserved-name rule or a plugin pins. */
export interface SkillLock {
  readonly value: SkillMode;
  readonly source: 'reserved-name' | 'author' | 'plugin';
  readonly reason: string;
}

/** `qge` at 399482: the only name the settings object cannot store. */
export function skillNameStorable(name: string): boolean {
  return name !== '__proto__';
}

/**
 * `PLr` at 1233, local subset. A policy or flag override and the synced-skill
 * branches have no local source; the three remaining locks are the reserved
 * name, the author's `disable-model-invocation`, and plugin ownership.
 */
export function skillLock(skill: SkillPanelSkill): SkillLock | undefined {
  if (!skillNameStorable(skill.name)) {
    return { value: skill.disableModelInvocation ? 'user-invocable-only' : 'on', source: 'reserved-name', reason: 'reserved name' };
  }
  if (skill.disableModelInvocation) return { value: 'user-invocable-only', source: 'author', reason: 'locked by author' };
  if (skill.source === 'plugin') return { value: 'on', source: 'plugin', reason: 'locked by plugin' };
  return undefined;
}

/** `Ije` at 5059, local subset: the lock table by name. */
export function skillLocks(skills: readonly SkillPanelSkill[]): Map<string, SkillLock> {
  const locked = new Map<string, SkillLock>();
  for (const skill of skills) {
    const lock = skillLock(skill);
    if (lock !== undefined) locked.set(skill.name, lock);
  }
  return locked;
}

/** `xje` at 2341. The host has no separate user-facing name, so the loaded name is the label. */
export function skillDisplayName(skill: SkillPanelSkill): string {
  return skill.name;
}

/** `BIe` at 2143, mapped onto this host's settings scopes. */
export function skillSourceLabel(skill: SkillPanelSkill): string {
  switch (skill.source) {
    case 'plugin': return 'plugin';
    case 'projectSettings': return 'project';
    case 'userSettings': return 'user';
    default: return 'project';
  }
}

/** `S6e` at 3372700 over `OQr` at 3372617: the skill's own name and description. */
export function skillTokenEstimate(skill: SkillPanelSkill, bytesPerToken = 4): number {
  const text = [skill.name, skill.description, skill.whenToUse].filter(Boolean).join(' ');
  return Math.round(text.length / (bytesPerToken > 0 ? bytesPerToken : 4));
}

/** `KB` at 11476: `< 20`, otherwise the count rounded to ten with a `~` prefix. */
export function skillTokenRange(tokens: number): string {
  if (tokens < 20) return '< 20';
  return `~${Math.round(tokens / 10) * 10}`;
}

/** `Pje` at 4664: source label then display name, or tokens descending then display name. */
export function sortSkills<T extends SkillPanelSkill>(skills: readonly T[], sortByTokens: boolean): T[] {
  const copy = [...skills];
  if (sortByTokens) {
    return copy.sort((left, right) => skillTokenEstimate(right) - skillTokenEstimate(left) ||
      skillDisplayName(left).localeCompare(skillDisplayName(right)));
  }
  return copy.sort((left, right) => skillSourceLabel(left).localeCompare(skillSourceLabel(right)) ||
    skillDisplayName(left).localeCompare(skillDisplayName(right)));
}

/** The filter arm of `He`: name, display name, description and source label, case-insensitive. */
export function filterSkills<T extends SkillPanelSkill>(skills: readonly T[], query: string): T[] {
  if (query === '') return [...skills];
  const needle = query.toLowerCase();
  return skills.filter(skill => skill.name.toLowerCase().includes(needle) ||
    skillDisplayName(skill).toLowerCase().includes(needle) ||
    skill.description.toLowerCase().includes(needle) ||
    skillSourceLabel(skill).toLowerCase().includes(needle));
}

/** `Oje` at 5212: the mode each row starts on. `localOverrides` is `O4n`'s local table. */
export function defaultSkillModes(skills: readonly SkillPanelSkill[],
  localOverrides: Readonly<Record<string, SkillMode>>): Record<string, SkillMode> {
  const locks = skillLocks(skills);
  const modes: Record<string, SkillMode> = Object.create(null) as Record<string, SkillMode>;
  for (const skill of skills) {
    if (Object.hasOwn(modes, skill.name)) continue;
    modes[skill.name] = locks.get(skill.name)?.value ?? localOverrides[skill.name] ?? 'on';
  }
  return modes;
}

/** `cgt`'s cycle arm: `(index + 1) % 4`. */
export function nextSkillMode(mode: SkillMode): SkillMode {
  return SKILL_MODES[(SKILL_MODES.indexOf(mode) + 1) % SKILL_MODES.length]!;
}

/** `wt` at 23510: the word the row shows when the mode is not the plain `on`. */
export function skillModeWord(mode: SkillMode): string {
  if (mode === 'name-only') return 'name-only';
  if (mode === 'user-invocable-only') return 'user-only';
  return '';
}

export interface SkillPanelRow {
  readonly name: string;
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly tokens: number;
  readonly locked: SkillLock | undefined;
}

/**
 * The list `le` builds at 30033: each row's label is `xje`, and its meta is the
 * lock reason, the mode word, the source label and `KB(S6e(...)) tok`. The host
 * row renderer takes one description string, so the meta joins with ` · `.
 */
export function skillPanelRows(skills: readonly SkillPanelSkill[], options: {
  readonly modes: Readonly<Record<string, SkillMode>>;
  readonly sortByTokens: boolean;
  readonly query?: string;
  readonly bytesPerToken?: number;
}): SkillPanelRow[] {
  const locks = skillLocks(skills);
  return filterSkills(sortSkills(skills, options.sortByTokens), options.query ?? '').map(skill => {
    const lock = locks.get(skill.name);
    const mode = lock?.value ?? options.modes[skill.name] ?? 'on';
    const tokens = skillTokenEstimate(skill, options.bytesPerToken ?? 4);
    const description = [lock?.reason ?? '', skillModeWord(mode), skillSourceLabel(skill),
      `${skillTokenRange(tokens)} tok`].filter(Boolean).join(' · ');
    return { name: skill.name, value: `skill:${skill.name}`, label: skillDisplayName(skill),
      description, tokens, locked: lock };
  });
}

/** `I` at the subtitle: `1 skill`, `2 skills`. */
function skillCount(count: number): string {
  return `${count} ${count === 1 ? 'skill' : 'skills'}`;
}

/**
 * The panel's subtitle. The recovered line is `${count}${sorted} · ${guide}`;
 * this host's dialog has no text filter, and Escape saves and closes, so the
 * guide names those two moves and drops `/ to search`.
 */
export function skillsPanelSubtitle(options: {
  readonly count: number; readonly total: number; readonly query: string; readonly sortByTokens: boolean;
}): string {
  const counted = options.query === '' ? skillCount(options.total) : `${options.count}/${skillCount(options.total)}`;
  const guide = 'enter/space to cycle, t to sort, esc to save';
  return `${counted}${options.sortByTokens ? ' · sorted by tokens' : ''} · ${guide}`;
}

/** The empty-filter line: `No skills match "<query>"`. */
export function skillsNoMatch(query: string): string {
  return `No skills match "${query}"`;
}

/**
 * `Ie` at 30469: a name the settings object cannot hold can never be changed
 * here. The recovered collects the names and writes one note.
 */
export function skillUnsafeNameNote(skills: readonly SkillPanelSkill[]): string | undefined {
  const names = [...new Set(skills.map(skill => skill.name).filter(name => !skillNameStorable(name)))];
  if (names.length === 0) return undefined;
  return `Settings can't store an entry named ${names.join(' or ')}, so a skill with that name can't be changed here. Rename its folder or command file to configure it.`;
}

/** The dialog body: subtitle, the plugin footer, then the reserved-name note. */
export function skillsPanelMessage(options: {
  readonly skills: readonly SkillPanelSkill[]; readonly rows: readonly SkillPanelRow[];
  readonly query: string; readonly total: number; readonly sortByTokens: boolean;
}): string {
  if (options.total === 0) return `${SKILLS_EMPTY}\n\n${SKILLS_EMPTY_HINT}`;
  if (options.rows.length === 0) return skillsNoMatch(options.query);
  const parts = [skillsPanelSubtitle({ count: options.rows.length, total: options.total,
    query: options.query, sortByTokens: options.sortByTokens })];
  if (options.skills.some(skill => skill.source === 'plugin')) parts.push(SKILLS_PLUGIN_FOOTER);
  const unsafe = skillUnsafeNameNote(options.skills);
  if (unsafe !== undefined) parts.push(unsafe);
  return parts.join('\n\n');
}

export interface SkillOverrideState {
  readonly localOverrides: Readonly<Record<string, SkillMode>>;
  readonly locked: ReadonlyMap<string, SkillLock>;
}

export interface SkillOverrideDiff {
  /** The local `skillOverrides` entries to write; `undefined` removes the key. */
  readonly diff: Record<string, SkillMode | undefined>;
  readonly writes: number;
  readonly effectiveChanged: number;
}

/**
 * `w$t` at 5422, local subset. The MCP coordinator and synced-skill arms have no
 * local source. A chosen mode equal to the row's locked lower tier clears the
 * stored value instead of pinning it; `effectiveChanged` counts rows whose mode
 * differs from what the local table already produced.
 */
export function skillOverrideDiff(skills: readonly SkillPanelSkill[], modes: Readonly<Record<string, SkillMode>>,
  localOverrides: Readonly<Record<string, SkillMode>>): SkillOverrideDiff {
  const locked = skillLocks(skills);
  // `y` starts as the locked names, so a locked row never contributes a write.
  const seen = new Set<string>(locked.keys());
  const diff: Record<string, SkillMode | undefined> = Object.create(null) as Record<string, SkillMode | undefined>;
  let writes = 0, effectiveChanged = 0;
  for (const skill of skills) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    const target = modes[skill.name] ?? 'on';
    const lower = locked.get(skill.name)?.value ?? 'on';
    const stored = localOverrides[skill.name];
    const next = target === lower ? undefined : target;
    if (next !== stored) { diff[skill.name] = next; writes++; }
    if (target !== (stored ?? lower)) effectiveChanged++;
  }
  return { diff, writes, effectiveChanged };
}

/** The local table after a write, so the panel can keep editing without re-reading. */
export function applySkillOverrideDiff(localOverrides: Readonly<Record<string, SkillMode>>,
  diff: Readonly<Record<string, SkillMode | undefined>>): Record<string, SkillMode> {
  const next: Record<string, SkillMode> = { ...localOverrides };
  for (const [name, mode] of Object.entries(diff)) {
    if (mode === undefined) delete next[name];
    else next[name] = mode;
  }
  return next;
}

function parseMode(value: unknown): SkillMode | undefined {
  return typeof value === 'string' && (SKILL_MODES as readonly string[]).includes(value) ? value as SkillMode : undefined;
}

function readSkillOverrideTable(file: string): Record<string, SkillMode> {
  const table: Record<string, SkillMode> = {};
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return table;
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return table;
    const overrides = (parsed as Record<string, unknown>).skillOverrides;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return table;
    for (const [name, value] of Object.entries(overrides)) {
      const mode = parseMode(value);
      if (mode !== undefined) table[name] = mode;
    }
  } catch { /* an absent or unreadable file contributes nothing */ }
  return table;
}

/**
 * `O4n` at 4966 over this host's local layer. The loader reads the canonical
 * local file first and merges a legacy cwd file beneath it (config.ts 1180), so
 * the panel sees the same table the runtime will.
 */
export function readLocalSkillOverrides(paths: Pick<PermissionFilePaths, 'localSettings' | 'legacyLocalSettings'>): Record<string, SkillMode> {
  const legacy = paths.legacyLocalSettings !== undefined && paths.localSettings !== undefined &&
    path.resolve(paths.legacyLocalSettings) !== path.resolve(paths.localSettings) ? paths.legacyLocalSettings : undefined;
  const table = legacy === undefined ? {} : readSkillOverrideTable(legacy);
  if (paths.localSettings === undefined) return table;
  return { ...table, ...readSkillOverrideTable(paths.localSettings) };
}

/** The `An("localSettings", { skillOverrides: diff })` write at 28337, through the host's atomic writer. */
export function saveSkillOverrides(file: string, diff: Readonly<Record<string, SkillMode | undefined>>): void {
  let raw: Record<string, unknown> = {}, mode = 0o600;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Local settings must be a regular file');
    mode = stat.mode & 0o777;
    const text = fs.readFileSync(file, 'utf8');
    const parsed: unknown = text.trim() === '' ? {} : JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Local settings must hold a JSON object');
    raw = parsed as Record<string, unknown>;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const current = raw.skillOverrides && typeof raw.skillOverrides === 'object' && !Array.isArray(raw.skillOverrides)
    ? { ...raw.skillOverrides as Record<string, unknown> } : {};
  for (const [name, value] of Object.entries(diff)) {
    if (value === undefined) delete current[name];
    else current[name] = value;
  }
  if (Object.keys(current).length === 0) delete raw.skillOverrides;
  else raw.skillOverrides = current;
  atomicWriteFile(file, `${JSON.stringify(raw, null, 2)}\n`, { mode, label: 'skillSettings' });
}

/** `Ui`-style report arm at 28505: the save outcome, or `No changes`. */
export function skillsSaveMessage(effectiveChanged: number): string {
  if (effectiveChanged <= 0) return 'No changes';
  return `Updated ${effectiveChanged} skill ${effectiveChanged === 1 ? 'override' : 'overrides'}`;
}

/** The failure arm at 28263. */
export function skillsSaveError(message: string): string {
  return `Failed to save skill overrides: ${message}`;
}

/**
 * The mode the runtime applies to a loaded skill. The lock wins; otherwise the
 * merged `skillOverrides` entry. Returns undefined when no override applies.
 */
export function skillOverrideMode(skill: SkillPanelSkill,
  overrides: Readonly<Record<string, unknown>>): SkillMode | undefined {
  if (skillLock(skill) !== undefined) return undefined;
  return parseMode(overrides[skill.name]);
}
