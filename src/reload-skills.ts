// `/reload-skills` — `Pick up skills added or changed on disk during this session`.
//
// Recovered body `v`, chunk-hyft8yrm.js [13938,14479) (SHA-256
// fad372982d5516747b598e25e44c70b79d2fe1cbebaa85282cdd65e17fc5cfcb), exported as
// `call`; the registration `ITo` sits at chunk-sfn1dbxq.js 1640128 (SHA-256
// 4c74137e…): `{type:"local", name:"reload-skills", supportsNonInteractive:!0,
// thinClientDispatch:"post-text"}`. The body:
//
//   n = skillList(); d = names(n); gL(); bM(); $5(); e = skillList(); c = names(e);
//   i1.emit();
//   r = count(e, o => !d.has(o.name)); l = count(n, o => !c.has(o.name));
//   a = []; if (r > 0) a.push(`${r} added`); if (l > 0) a.push(`${l} removed`);
//   p = a.length > 0 ? a.join(", ") : "no changes";
//   `Reloaded skills: ${e.length} ${I(e.length,"skill")} available (${p})`
//
// `bM()` (chunk-sfn1dbxq.js 1675968) drops the command table (`VT` → `Nhr`,
// chunk-3ph567jx.js 3862) and the skill table and its V5 copy (`Fhr`, 3898), and clears
// the skill-directory cache and the parsed markdown map (`Hz`, chunk-sfn1dbxq.js
// 3393591). `$5()` (3689254) resets the names already sent to the model. `i1` (2478788)
// is the `skillsChanged` emitter. `gL()` (431968) is the cloud skill-sync invalidation,
// which this host has no sync to invalidate. The count is `F`, chunk-3qabb19b.js 673
// (`function F(n,e){let r=0;for(let t of n)r+=+!!e(t);return r}`); the pluralizer is `I`,
// chunk-ax7r0qj7.js 798, already ported as `pluralize`.
import { pluralize } from './diff-dialog-primitives.js';

/** Source `p`: the no-change arm of the parenthesised diff. */
export const RELOAD_SKILLS_NO_CHANGES = 'no changes';

export interface SkillReloadCounts {
  /** Skills the rescan found that the earlier snapshot did not have. */
  readonly added: number;
  /** Skills the earlier snapshot had that the rescan no longer finds. */
  readonly removed: number;
}

/** Source `F` over both name lists: entries in `after` unknown to `before`, and the reverse. */
export function skillReloadCounts(before: readonly string[], after: readonly string[]): SkillReloadCounts {
  const beforeNames = new Set(before);
  const afterNames = new Set(after);
  let added = 0;
  for (const name of after) if (!beforeNames.has(name)) added++;
  let removed = 0;
  for (const name of before) if (!afterNames.has(name)) removed++;
  return { added, removed };
}

/** Source `a`/`p`: `2 added, 1 removed`, one arm, or `no changes`. */
export function skillReloadDiff(counts: SkillReloadCounts): string {
  const parts: string[] = [];
  if (counts.added > 0) parts.push(`${counts.added} added`);
  if (counts.removed > 0) parts.push(`${counts.removed} removed`);
  return parts.length > 0 ? parts.join(', ') : RELOAD_SKILLS_NO_CHANGES;
}

/**
 * The recovered return value. The safe-mode suffix (`Tr()`, chunk-nqc6v990.js 3899) is
 * not ported: this host has no `--safe-mode` flag or `CLAUDE_CODE_SAFE_MODE` gate.
 */
export function reloadSkillsMessage(before: readonly string[], after: readonly string[]): string {
  const diff = skillReloadDiff(skillReloadCounts(before, after));
  return `Reloaded skills: ${after.length} ${pluralize(after.length, 'skill')} available (${diff})`;
}
