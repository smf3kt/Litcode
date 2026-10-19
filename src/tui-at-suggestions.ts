import Fuse from 'fuse.js';
import { clipEnd } from './tui-autocomplete.js';
import type { AgentSuggestionRow } from './tui-agent-suggestions.js';

/**
 * The combined `@` provider, adapted from the recovered interactive application
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `tse` 562716 merges the
 * file, MCP and agent rows, `$0e` 561755 adapts one row, `W0`/`BDt` 562302 is the fifteen-row
 * cap and the sixty-cell cut behind `q0` 560849, and `Nre` 491566 trims a template to its
 * literal head. The search is the source's own dependency, fuse.js, at the same threshold,
 * weights and per-type offset. Coordinates are zero-based UTF-16 offsets.
 */

/** `W0`: the combined list keeps at most fifteen rows. */
export const AT_SUGGESTION_LIMIT = 15;

/** `q0` reuses `BDt`: every non-file description is cut to sixty cells. */
export const AT_DESCRIPTION_LIMIT = 60;

/** `Nre`: a template's display text stops at its first placeholder. */
export function templatePrefix(uriTemplate: string): string {
  const brace = uriTemplate.indexOf('{');
  return brace === -1 ? uriTemplate : uriTemplate.slice(0, brace);
}

/** One row the combined provider can emit; the id decides its family. */
export interface AtSuggestionRow {
  readonly id: string;
  readonly displayText: string;
  readonly description: string;
  /** `$0e`: the agent colour slot, when the type has one. */
  readonly color?: string;
}

/** The file row the provider receives, already ranked by the index. */
export interface AtFileRow {
  readonly id: string;
  readonly displayText: string;
  readonly description?: string;
  /** `C`: the index ratio, or the listing position over the entry count. */
  readonly score?: number;
}

/** One `M` entry: a listed MCP resource. */
export interface AtMcpResource {
  readonly server: string;
  readonly uri: string;
  readonly name?: string;
  readonly description?: string;
}

/** One `he` entry: a listed MCP resource template. */
export interface AtMcpTemplate {
  readonly server: string;
  readonly uriTemplate: string;
  readonly name?: string;
  readonly description?: string;
}

/** A non-file row, keyed for the shared fuzzy search. */
type RankedItem =
  | { readonly type: 'mcp_resource'; readonly displayText: string; readonly description: string;
      readonly name: string; readonly server: string; readonly uri: string }
  | { readonly type: 'mcp_resource_template'; readonly displayText: string; readonly description: string;
      readonly name: string; readonly server: string; readonly uriTemplate: string }
  | { readonly type: 'agent'; readonly displayText: string; readonly description: string;
      readonly agentType: string; readonly color?: string };

/** `$0e`: one item becomes the row the composer draws. */
function adapt(item: RankedItem): AtSuggestionRow {
  switch (item.type) {
    case 'agent':
      return { id: `agent-${item.agentType}`, displayText: item.displayText,
        description: item.description, ...(item.color === undefined ? {} : { color: item.color }) };
    case 'mcp_resource':
      return { id: `mcp-resource-${item.server}__${item.uri}`,
        displayText: item.displayText, description: item.description };
    case 'mcp_resource_template':
      return { id: `mcp-template::${item.server}__${item.uriTemplate}`,
        displayText: item.displayText, description: item.description };
  }
}

function resourceItem(resource: AtMcpResource): RankedItem {
  return { type: 'mcp_resource', displayText: `${resource.server}:${resource.uri}`,
    description: clipEnd(resource.description ?? resource.name ?? resource.uri, AT_DESCRIPTION_LIMIT),
    name: resource.name ?? resource.uri, server: resource.server, uri: resource.uri };
}

function templateItem(template: AtMcpTemplate): RankedItem {
  return { type: 'mcp_resource_template',
    displayText: `${template.server}:${templatePrefix(template.uriTemplate)}`,
    description: clipEnd(template.description ?? template.name ?? template.uriTemplate, AT_DESCRIPTION_LIMIT),
    name: template.name ?? template.uriTemplate, server: template.server,
    uriTemplate: template.uriTemplate };
}

function agentItem(row: AgentSuggestionRow): RankedItem {
  return { type: 'agent', displayText: row.displayText, description: row.description,
    agentType: row.agentType, ...(row.color === undefined ? {} : { color: row.color }) };
}

/** The fuse options `tse` builds: the same keys, weights and threshold. */
const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.6,
  keys: [
    { name: 'displayText', weight: 2 }, { name: 'name', weight: 3 }, { name: 'server', weight: 1 },
    { name: 'description', weight: 1 }, { name: 'agentType', weight: 3 }, { name: 'uriTemplate', weight: 2 },
  ],
};

export interface CombinedAtOptions {
  readonly query: string;
  /** `showOnEmpty`: an empty query still lists the rows. */
  readonly showOnEmpty: boolean;
  readonly files: readonly AtFileRow[];
  readonly agents: readonly AgentSuggestionRow[];
  /** `M`: the listed resources, already flattened and filtered by `aAt`. */
  readonly resources?: readonly AtMcpResource[];
  /** `he`: the listed templates, already flattened and filtered by `aAt`. */
  readonly templates?: readonly AtMcpTemplate[];
}

/**
 * `tse`: an empty query lists the families in source order (files, resources, templates,
 * agents) up to the cap. A query keeps the files in index order with their own scores and
 * ranks the rest with fuse, adding the MCP resource offset before the two lists merge on
 * score, best first.
 */
export function combinedAtRows(options: CombinedAtOptions): AtSuggestionRow[] {
  const { query, showOnEmpty, files, agents } = options;
  if (query === '' && !showOnEmpty) return [];
  const fileRows: AtSuggestionRow[] = files.map(file => ({ id: file.id,
    displayText: file.displayText, description: file.description ?? '' }));
  const ranked: RankedItem[] = [
    ...(options.resources ?? []).map(resourceItem),
    ...(options.templates ?? []).map(templateItem),
    ...agents.map(agentItem),
  ];
  if (query === '') {
    return [...fileRows, ...ranked.map(adapt)].slice(0, AT_SUGGESTION_LIMIT);
  }
  const scored: { row: AtSuggestionRow; score: number }[] = [];
  for (let index = 0; index < files.length; index++) {
    scored.push({ row: fileRows[index]!, score: files[index]!.score ?? 0.5 });
  }
  if (ranked.length > 0) {
    const fuse = new Fuse(ranked, FUSE_OPTIONS);
    for (const hit of fuse.search(query, { limit: AT_SUGGESTION_LIMIT })) {
      const item = hit.item;
      scored.push({ row: adapt(item),
        score: (hit.score ?? 0.5) + (item.type === 'mcp_resource' ? 0.15 : 0) });
    }
  }
  scored.sort((left, right) => left.score - right.score);
  return scored.slice(0, AT_SUGGESTION_LIMIT).map(entry => entry.row);
}
