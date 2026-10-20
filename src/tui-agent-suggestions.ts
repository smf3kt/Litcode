import { clipEnd } from './tui-autocomplete.js';
import { SESSION_COLOR_SLOTS } from './session-color.js';

/**
 * The `@` agent rows, adapted from the recovered interactive application
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `HDt` 562351 builds
 * and filters them, `q0` 560849 cuts their description, and `wLe` (chunk-1z1j45h7.js
 * 01bb837725202a084cad281f0b8fcf059995c5d924da078b489cd9611f50fc9d) 1062 resolves the agent
 * colour slot over the `BM` table at 663, which `session-color.ts` now owns. Coordinates are
 * zero-based UTF-16 offsets.
 */

/** `BDt`: an agent's description is cut to sixty cells. */
export const AGENT_DESCRIPTION_LIMIT = 60;

/** The definition fields the row needs; the source's `agentType` and `whenToUse`. */
export interface AgentSuggestionSource {
  readonly name: string;
  readonly description: string;
}

export interface AgentSuggestionRow {
  /** `$0e`: `agent-<agentType>`. */
  readonly id: string;
  /** `<agentType> (agent)`. */
  readonly displayText: string;
  readonly description: string;
  /** The source's `agentType`, kept for the shared fuzzy keys. */
  readonly agentType: string;
  /** `wLe`: the theme slot the row paints with, when the type has a colour. */
  readonly color?: string;
}

/**
 * `wLe`: `general-purpose` never takes a colour, and every other type needs an override
 * naming one of the eight slots. The local product has no agent colour source, so the map
 * is empty unless a caller supplies one.
 */
export function agentColor(agentType: string,
  overrides: Readonly<Record<string, string>> = {}): string | undefined {
  if (agentType === 'general-purpose') return undefined;
  const chosen = overrides[agentType];
  return chosen === undefined ? undefined : SESSION_COLOR_SLOTS[chosen as keyof typeof SESSION_COLOR_SLOTS];
}

/**
 * `HDt`: one row per agent type. With no query the rows appear only when `showOnEmpty`;
 * a query keeps the types whose name or display text contains it, case-insensitively.
 */
export function agentSuggestionRows(agents: readonly AgentSuggestionSource[], query: string,
  showOnEmpty = false, colorOf: (agentType: string) => string | undefined = agentColor):
AgentSuggestionRow[] {
  if (query === '' && !showOnEmpty) return [];
  const rows = agents.map(agent => ({
    id: `agent-${agent.name}`,
    displayText: `${agent.name} (agent)`,
    description: clipEnd(agent.description, AGENT_DESCRIPTION_LIMIT),
    agentType: agent.name,
    color: colorOf(agent.name),
  }));
  if (query === '') return rows;
  const needle = query.toLowerCase();
  return rows.filter(row => row.agentType.toLowerCase().includes(needle)
    || row.displayText.toLowerCase().includes(needle));
}
