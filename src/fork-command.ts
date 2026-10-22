/**
 * `/fork`. Recovered from the two `fork` registrations in `chunk-sfn1dbxq.js`
 * (sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`) and the selector
 * `Ujt` at 1663949: `fleetFork:{open:()=>gw()&&!Ne(a.IS_DEMO),whenOpen:[njt,ojt],whenClosed:[tjt]}`.
 * With the fleet fork open, `/fork` is `njt` (1638551, `Copy this conversation into a new
 * background session and keep working here`, argument hint `[prompt]`) and `/subtask` (`ojt`,
 * 1638723) is offered. With it closed, `/fork` is `tjt` (1638340, `Spawn a background agent that
 * inherits the full conversation`, argument hint `<directive>`), whose body `m` is
 * `chunk-0krtqd6x.js` 15000 (sha256
 * `64f3467f02a34e42387c6e3e14747eb2f1ee829fdf087cb521186ec43d2bd3cb`). The gate `gw`/`Tkt`/`r`
 * lives in `chunk-wtdka69b.js` 1096/854/887 (sha256
 * `5619612f9e775014b7693af2153033c4cbdad460dceb30d5f872d2e10bd1780e`); `Ne` is
 * `chunk-fdxhcr6b.js` 615. Offsets are zero-based UTF-16 code units.
 *
 * The directive body is the same spawn `/subtask` uses (`Zjt`, `chunk-940nvk4p.js` 1241): it
 * seeds a child with the whole conversation and the parent's exact tools. Only the three rows
 * differ, so the host runs both commands through `Runtime.launchSubtask`.
 */

import { SUBTASK_FORK } from './subtask.js';

/** Source `OR` (chunk-3cynezh1.js 65963), shared with `/subtask`: `⑂`, the fork glyph. */
const FORK_GLYPH = SUBTASK_FORK;

/** Source `m` (chunk-0krtqd6x.js 15000): the empty-argument row, escaped brackets and all. */
export const FORK_USAGE = 'Usage: /fork \\<directive\\>';

/** Source `m`'s null-return row when `xa()` reports a coordinator session. */
export const FORK_COORDINATOR = 'Forking is not available in coordinator sessions. Use /branch instead.';

/** Source `m`'s other null-return row when no fork could be seeded. */
export const FORK_FIRST_TURN = 'Cannot fork before the first conversation turn';

/** Host gate: the session has no fork seam, so there is nothing to spawn. */
export const FORK_DISABLED = 'Forking is disabled in this session';

/** Source `tjt` (1638340): the closed-fleet registration's description. */
export const FORK_DESCRIPTION = 'Spawn a background agent that inherits the full conversation';

/** Source `njt` (1638551): the open-fleet registration's description. */
export const FORK_BACKGROUND_DESCRIPTION = 'Copy this conversation into a new background session and keep working here';

/** Source `Ne` (chunk-fdxhcr6b.js 615): `1`/`true`/`yes`/`on` in any case. */
function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase().trim());
}

/**
 * Source `r` (chunk-wtdka69b.js 887): the environment flag disables the agent view on any
 * non-empty value, and the `disableAgentView` setting disables it only when strictly `true`.
 */
export function agentViewDisabled(env: NodeJS.ProcessEnv, config: { disableAgentView?: boolean }): boolean {
  if (env.CLAUDE_CODE_DISABLE_AGENT_VIEW) return true;
  return config.disableAgentView === true;
}

/**
 * Source `gw() && !Ne(a.IS_DEMO)` (chunk-wtdka69b.js 1096, chunk-sfn1dbxq.js 1663971): the fleet
 * fork is open unless the agent view is disabled or the demo flag is truthy. The open branch
 * selects `njt` and offers `/subtask`; the closed branch selects `tjt`.
 */
export function fleetForkOpen(env: NodeJS.ProcessEnv, config: { disableAgentView?: boolean }): boolean {
  return !agentViewDisabled(env, config) && !truthy(env.IS_DEMO);
}

/**
 * Source `Ucn`/`rFt`/`_e` (chunk-t721xmjm.js 46831/46881/46909, sha256
 * `c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26`): the two session-state
 * chips and the separator the fork row joins with.
 */
export const SESSION_RUNNING = 'session running';
export const SESSION_WAITING = 'session waiting for a prompt';
const CHIP_SEPARATOR = ' · ';

/**
 * Source `UKn` (chunk-t721xmjm.js 47819): the fork row is the state, then the name, the short id
 * and any chips, each present part joined by ` · `.
 */
export function forkSessionLine(parts: { state: string; name?: string; id?: string; chips?: readonly string[] }): string {
  return [parts.state, ...(parts.name ? [parts.name] : []), ...(parts.id ? [parts.id] : []),
    ...(parts.chips ?? [])].join(CHIP_SEPARATOR);
}

/** Source `TMr` (chunk-t721xmjm.js 46946): the name chips split on the fork glyph, trimmed, rejoined. */
export function forkNameLine(name: string): string | undefined {
  const parts = name.split(FORK_GLYPH).map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const [head, ...rest] = parts;
  return rest.length === 0 ? head : `${head} ${FORK_GLYPH} ${rest.join(CHIP_SEPARATOR)}`;
}

/**
 * Source `Ue` (chunk-zsg1bb14.js 19311, sha256
 * `b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26`): the open-fleet `/fork`
 * body. A coordinator session, a
 * persistence-off session and a session started with launch flags are refused before anything is
 * seeded; an empty conversation prints `Nothing to fork yet. Send a message first.`. The host's
 * `njt` path runs the copy through `startBackgroundSession`, which forks the journal and starts
 * the child detached while this session keeps running.
 */
export const FORK_NOTHING = 'Nothing to fork yet. Send a message first.';
export const FORK_PERSISTENCE_OFF = "Can't fork: session persistence is off, so the new session would have nothing to start from. Run the task here, or fork from a session that saves its transcript.";
