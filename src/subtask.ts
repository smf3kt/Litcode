/**
 * `/subtask`. Recovered from the registration `ojt` in `chunk-sfn1dbxq.js` 1638723
 * (sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`): a `local-jsx`
 * command named `subtask`, described as `Send a subagent off with your full context; its result
 * comes back here`, with argument hint `<task>` and `isEnabled:()=>!xa()`. The body `m` is
 * `chunk-57v1bkyr.js` 15000 (sha256
 * `38a4ef68a99a508da6ba6d162153e0d73c7e8d0a7646076feece2b738f2f5868`); the fork spawn `Zjt` is
 * `chunk-940nvk4p.js` 1241 (sha256
 * `ccbaa2429c7a25d7f8b8724bd20245450200035b2468e7c78ddc1383fb2a66ba`), its name allocator `_` at
 * 4214; the id builder `Fh` is `chunk-nfna65jh.js` 1482 (sha256
 * `c1764357cf2e6f8c97c1b9994577437baec0e04fe67d8532ceb9a562b4d12446`); the fork glyph `OR` is
 * `chunk-3cynezh1.js` 65963 (sha256
 * `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3`). Offsets are zero-based
 * UTF-16 code units.
 */

/**
 * Source `m` (15000): the empty-argument row. The recovered literal carries escaped angle
 * brackets (`\\<task\\>` in the module text), so the row renders with a backslash before each
 * bracket; it is kept as the source spells it.
 */
export const SUBTASK_USAGE = 'Usage: /subtask \\<task\\>';

/** Source `OR` (chunk-3cynezh1.js 65963): `⑂`, the fork glyph the success row leads with. */
export const SUBTASK_FORK = '⑂';

/** Source `m`'s null-return row when no fork could be seeded. */
export const SUBTASK_FIRST_TURN = 'Cannot start a subtask before the first conversation turn';

/** Source `m`'s other null-return row, reached only when `xa()` reports a coordinator session. */
export const SUBTASK_COORDINATOR = 'Subtasks are not available in coordinator sessions. Use /branch instead.';

/** Host gate: the session has the subagent feature off, so there is no fork to seed. */
export const SUBTASK_DISABLED = 'Subtasks are disabled in this session';

/** What a `/subtask` spawn produced. The two unavailable reasons map to the source's two rows. */
export type SubtaskLaunch =
  | { kind: 'forked'; name: string; agentId: string }
  | { kind: 'unavailable'; reason: 'coordinator' | 'no-conversation' | 'disabled' };

/**
 * Source `xa` (`chunk-vvj0cwgx.js` 758, sha256
 * `557a86a5e4f608e938b7d477d0daf16f8cf8bba85d6ddb4cb695dea263fc4f46`): coordinator mode is
 * on when the environment flag is truthy, except on an interactive local surface without the
 * remote flag. `Ne` (`chunk-fdxhcr6b.js` 615) accepts `1`/`true`/`yes`/`on` in any case.
 */
export function subtaskCoordinator(env: NodeJS.ProcessEnv,
  surface: { interactive: boolean; remote: boolean }): boolean {
  const raw = env.CLAUDE_CODE_COORDINATOR_MODE;
  if (!raw || !['1', 'true', 'yes', 'on'].includes(raw.toLowerCase().trim())) return false;
  if (surface.interactive && !surface.remote && !env.CLAUDE_CODE_REMOTE) return false;
  return true;
}

/**
 * Source `_` (chunk-940nvk4p.js 4214): the first three words joined by `-`, lowercased, stripped
 * to `[a-z0-9-]`, runs collapsed, edge dashes trimmed, cut to 24 units, with `fork` when nothing
 * survives.
 */
export function subtaskName(task: string): string {
  return task.trim().split(/\s+/).slice(0, 3).join('-').toLowerCase()
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'fork';
}

/**
 * Source `allocateName` (chunk-yx9wnc2f.js): the base, then `base-2`, `base-3`, … until a name
 * no live agent holds. The source also skips reserved and agent-id-shaped names; this host's
 * allocator only sees the names its own registry reports.
 */
export function allocateSubtaskName(base: string, taken: ReadonlySet<string>): string {
  for (let ordinal = 1; ; ordinal++) {
    const candidate = ordinal === 1 ? base : `${base}-${ordinal}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// qqe/Ykn, sfn1dbxq [1979997,1980977)/[1982499,1982532), UTF-16; agent is the host tool name.
export function subtaskDirective(task: string): string {
  return `<fork-boilerplate>
You are a worker fork. The transcript above is the parent's history — inherited reference, not your situation. You are NOT a continuation of that agent. Execute ONE directive, then stop.

Hard rules:
- Do NOT spawn subagents with the agent tool. The "default to forking" guidance is for the parent; you ARE the fork, execute directly.
- One shot: report once and stop. No follow-up questions, no proposed next steps, no waiting for the user.

Guidelines (your directive may override any of these):
- Stay in scope. Other forks may be handling adjacent work; if you spot something outside your directive, note it in a sentence and move on.
- Open with one line restating your task, so the parent can spot scope drift at a glance.
- Be concise — as short as the answer allows, no shorter. Plain text, no preamble, no meta-commentary.
- If you committed changes, list the paths and commit hashes in your report.
</fork-boilerplate>

Your directive: ${task}`;
}

/** Source `m`'s success row: the glyph, the allocated name and the last four id characters. */
export function subtaskForkLine(name: string, agentId: string): string {
  return `${SUBTASK_FORK} forked ${name} (${agentId.slice(-4)})`;
}
