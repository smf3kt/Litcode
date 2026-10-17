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
import { activateConditionalSkills, loadProjectConfig, type SkillInfo } from './config.js';
import type { SessionConfig } from './session.js';

export const SKILL_TOOL_NAME = 'skill';

const SKILLS_HEADING = '\n\n# Available skills\n';

/** The catalog section `buildSystem` appends, or an empty string when none applies. */
export function skillsSection(skills: readonly SkillInfo[]): string {
  const invocable = skills.filter((skill) => !skill.disableModelInvocation);
  if (invocable.length === 0) return '';
  const lines = invocable.map(
    (skill) => `- ${skill.name}${skill.aliases?.length ? ` (aliases: ${skill.aliases.join(", ")})` : ""}: ${skill.description === '' ? '(no description)' : skill.description}`,
  );
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
