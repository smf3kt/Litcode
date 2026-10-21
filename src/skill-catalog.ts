// The skill catalog shared by the system-prompt builder and the SessionStart
// `reloadSkills` consumer.
//
// `reloadSkills` is a SessionStart-only hook output: "Re-scan skill and command
// directories after SessionStart hooks complete, so skills installed by the hook
// are available in the same session" (chunk-n3ykh62m.js offset 392149). The
// recovered consumer runs after the hook loop with `bM()`, `$5()` and
// `i1.emit()` (chunk-sfn1dbxq.js offset 2482855): the first invalidates the
// command and skill tables, the second resets the sent-skill names, and the
// third signals the change to subscribers. This product keeps the live catalog
// as the session config's `skills` array and renders it as the system prompt's
// final section; the model-facing skill tool captures the array reference, so a
// rescan replaces the array's contents in place.
//
// A skill whose frontmatter names `paths` is not in that catalog yet. The
// recovered assembler keeps it in `conditionalSkills` and activates it when the
// model touches a matching file (`emn`, chunk-sfn1dbxq.js offset 3398872); this
// product keeps the same held list on the session config, so it travels with the
// session and re-renders the catalog section after an activation.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_DIR, activateConditionalSkills, loadProjectConfig, loadSkillsFromDirectories, type SkillInfo } from './config.js';
import { discoverInstalledPluginComponents, installedPluginCatalogIdentity } from './plugins.js';
import { loadPluginComponents } from './plugin-components.js';
import type { SessionConfig } from './session.js';
import type { AgentTypeInfo } from './agent-types.js';

const pluginIdentities = new WeakMap<SessionConfig, string>();
/** One agent-catalog renderer for startup, reload and plugin refresh. */
export function agentTypesSection(agents: readonly AgentTypeInfo[]): string {
  const catalog = agents.map(type => JSON.stringify({ name: type.name, ...(type.aliases?.length ? { aliases: type.aliases } : {}),
    description: type.description, mode: type.mode, ...(type.model ? { model: type.model } : {}), ...(type.effort ? { effort: type.effort } : {}) })).join('\n');
  return '\n\n# Available agent types\nUse agent.subagent_type with general, explore, fork, or a catalog name below. ' +
    'Fork inherits the parent model, effort and paired conversation history. Catalog model IDs are literal gateway names; inherit uses the parent model.' +
    (catalog ? '\n' + catalog : '');
}
/** sc cache invalidation, chunk-sfn1dbxq.js [3706919,3707202), UTF-16; index identity is the owned host generation. */
export function refreshPluginComponents(current: SessionConfig): void {
  // A child config is a snapshot of its owner's catalog; reloading it there
  // would change the leased environment and the child's pinned system text.
  if (current.childMode !== undefined) return;
  if (!current.plugins?.enabled) return;
  const identity = installedPluginCatalogIdentity(current.workspace, current.plugins);
  if (pluginIdentities.get(current) === identity) return;
  const loaded = loadPluginComponents(discoverInstalledPluginComponents(current.workspace, current.plugins),
    new Set((current.skills ?? []).filter(skill => skill.source !== 'plugin').map(skill => skill.path)), undefined,
    current.features?.pluginSkillNamespaces === true);
  const skills = current.skills ??= [];
  const retained = skills.filter(skill => skill.plugin === undefined && skill.source !== 'plugin');
  skills.splice(0, skills.length, ...retained, ...loaded.skills);
  const agents = current.agentTypes ??= [];
  agents.splice(0, agents.length, ...agents.filter(agent => agent.plugin === undefined), ...loaded.agents);
  current.system = replaceSkillsSection(current.system, skills);
  // The agent-types section is the last appended block, and a child config may
  // already carry child markers and agent instructions after it. Replace only
  // the heading plus its catalog lines so later text survives.
  const heading = '\n\n# Available agent types\n';
  const start = current.system.indexOf(heading);
  const section = agents.length ? agentTypesSection(agents) : '';
  if (start < 0) current.system += section;
  else {
    let end = start + heading.length;
    const intro = current.system.indexOf('\n', end);
    if (intro >= 0 && current.system.slice(end, intro).startsWith('Use agent.subagent_type')) end = intro + 1;
    while (end < current.system.length && current.system[end] === '{') {
      const line = current.system.indexOf('\n', end);
      // Stop before the line terminator so text appended after the catalog keeps
      // its separating newline.
      end = line < 0 ? current.system.length : line;
      if (line >= 0) break;
    }
    current.system = current.system.slice(0, start) + section + current.system.slice(end);
  }
  pluginIdentities.set(current, identity);
  // The owner's cached tool set and the live catalog must agree; a plugin
  // install, update or removal replaces the catalog a later turn can reach.
  current.pluginGeneration = (current.pluginGeneration ?? 0) + 1;
}


export const SKILL_TOOL_NAME = 'skill';

const SKILLS_HEADING = '\n\n# Available skills\n';

/** The catalog section `buildSystem` appends, or an empty string when none applies. */
export function skillsSection(skills: readonly SkillInfo[]): string {
  // `$C`/`_5` (`chunk-sfn1dbxq.js` 401991): `user-invocable-only` and `off` are
  // out of the model catalog; `name-only` keeps the row and drops its description.
  const invocable = skills.filter((skill) => !skill.disableModelInvocation &&
    skill.mode !== 'user-invocable-only' && skill.mode !== 'off');
  if (invocable.length === 0) return '';
  const lines = invocable.map((skill) => {
    const name = `- ${skill.name}${skill.aliases?.length ? ` (aliases: ${skill.aliases.join(", ")})` : ""}`;
    return skill.mode === 'name-only' ? name : `${name}: ${skill.description === '' ? '(no description)' : skill.description}`;
  });
  return `${SKILLS_HEADING}Call the \`${SKILL_TOOL_NAME}\` tool with a skill \`name\` (and optional \`args\`) to load its instructions.\n` +
    lines.join('\n');
}

/** Replace the rendered catalog in a system prompt, keeping any later sections. */
export function replaceSkillsSection(system: string, skills: readonly SkillInfo[]): string {
  const section = skillsSection(skills);
  const start = system.indexOf(SKILLS_HEADING);
  if (start < 0) return section === '' ? system : system + section;
  const next = system.indexOf('\n\n# ', start + SKILLS_HEADING.length);
  return system.slice(0, start) + section + (next < 0 ? '' : system.slice(next));
}

/**
 * Re-scan skill directories after SessionStart hooks complete. Settings, hooks,
 * permissions and instructions stay as loaded; only the skill catalog and its
 * rendered section change. A legacy configuration has no skill tool to feed, so
 * its undefined catalog is left alone.
 */
export function reloadSkills(current: SessionConfig): void {
  if (current.skills === undefined) return;
  const loaded = loadProjectConfig(current.workspace, { ...current.configSources, paths: [] });
  current.skills.splice(0, current.skills.length, ...loaded.skills);
  setHeldSkills(current, loaded.conditionalSkills);
  current.system = replaceSkillsSection(current.system, current.skills);
  // Dynamic directories survive the rescan: the recovered reload re-reads the
  // directories already discovered in this session (`WRn` → `E3t(...,
  // {replace: true})`, chunk-sfn1dbxq.js offset 3399649).
  appendDynamicSkills(current, current.dynamicSkillDirs ?? []);
}

/** Install the held list a load produced; a reload replaces it wholesale. */
export function setHeldSkills(current: SessionConfig, skills: readonly SkillInfo[] | undefined): void {
  if (skills === undefined || skills.length === 0) delete current.heldSkills;
  else current.heldSkills = [...skills];
}

/**
 * Activate the conditional skills whose `paths` match a touched workspace path
 * and append them to the live catalog in place, so the skill tool (which holds
 * the array reference) sees them. The system prompt section is re-rendered only
 * when something activated; the recovered path emits the same change signal and
 * leaves the prompt untouched otherwise. Returns the activated skills.
 */
export function activateTouchedSkills(current: SessionConfig, touched: readonly string[]): SkillInfo[] {
  if (current.skills === undefined || current.heldSkills === undefined || current.heldSkills.length === 0) return [];
  const held = new Map(current.heldSkills.map(skill => [skill.name, skill]));
  const activated = activateConditionalSkills(held, current.workspace, touched);
  if (activated.length === 0) return [];
  current.skills.push(...activated);
  setHeldSkills(current, [...held.values()]);
  current.system = replaceSkillsSection(current.system, current.skills);
  return activated;
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/**
 * `git check-ignore -- <directory>` in the workspace (`KAr`, called from `dAr`
 * at chunk-sfn1dbxq.js offset 3396597). Exit 0 means ignored; any other exit,
 * missing repository, or timeout means not ignored. The directory argument is
 * the one that would contain the harness directory, matching the recovered
 * call.
 */
function gitIgnored(directory: string, cwd: string): Promise<boolean> {
  return new Promise(resolve => {
    execFile('git', ['check-ignore', '--', directory], { cwd, timeout: 2000, windowsHide: true },
      error => resolve(error === null));
  });
}

function appendDynamicSkills(current: SessionConfig, dirs: readonly string[]): SkillInfo[] {
  if (current.skills === undefined || dirs.length === 0) return [];
  const existing = new Set([
    ...current.skills.map(skill => skill.name),
    ...(current.heldSkills ?? []).map(skill => skill.name),
  ]);
  const loaded = loadSkillsFromDirectories(dirs, existing);
  if (loaded.length === 0) return [];
  current.skills.push(...loaded);
  current.system = replaceSkillsSection(current.system, current.skills);
  return loaded;
}

/**
 * Discover `<dir>/<HARNESS_DIR>/skills` beside a touched path and every
 * workspace ancestor, then append the new skills to the live catalog. The
 * recovered `dAr` walks upward from the touched file's directory to the
 * workspace base, records every candidate directory in a session set before
 * checking it (so a directory is examined at most once), skips directories
 * ignored by git, and loads the survivors with the project source (`MU` at
 * chunk-sfn1dbxq.js offset 3399649). Absolute paths and paths outside the
 * workspace never discover anything.
 */
export async function discoverTouchedSkills(current: SessionConfig, touched: readonly string[]): Promise<SkillInfo[]> {
  if (current.skills === undefined) return [];
  const root = path.resolve(current.workspace);
  const known = new Set(current.dynamicSkillDirs ?? []);
  const previous = known.size;
  const found: string[] = [];
  for (const target of touched) {
    if (typeof target !== 'string' || target === '') continue;
    const resolved = path.resolve(root, target);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) continue;
    let dir = path.dirname(resolved);
    while (dir === root || dir.startsWith(root + path.sep)) {
      const candidate = path.join(dir, HARNESS_DIR, 'skills');
      if (!known.has(candidate)) {
        known.add(candidate);
        if (isDirectory(candidate) && !(await gitIgnored(dir, root))) found.push(candidate);
      }
      if (dir === root) break;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  if (known.size !== previous) current.dynamicSkillDirs = [...known];
  return appendDynamicSkills(current, found);
}
