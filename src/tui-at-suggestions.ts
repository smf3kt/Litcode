import Fuse from 'fuse.js';
import { clipEnd } from './tui-autocomplete.js';
import type { AgentSuggestionRow } from './tui-agent-suggestions.js';

/**
 * The combined `@` provider, adapted from the recovered interactive application
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `tse` 562716 merges the
 * file, MCP and agent rows, `$0e` 561755 adapts one row, `W0`/`BDt` 562302 is the fifteen-row
 * cap and the sixty-cell cut behind `q0` 560849, `Nre` 491566 trims a template to its literal
 * head, and `ese` 565691 shapes a template's replacement. `aAt` (chunk-n3ykh62m.js, SHA-256
 * 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac, 378662) hides app-only
 * resources. The search is the source's own dependency, fuse.js, at the same threshold,
 * weights and per-type offset. Coordinates are zero-based UTF-16 offsets.
 */

/** `W0`: the combined list keeps at most fifteen rows. */
export const AT_SUGGESTION_LIMIT = 15;

/** `q0` reuses `BDt`: every non-file description is cut to sixty cells. */
export const AT_DESCRIPTION_LIMIT = 60;

/** `Xc`: a resource whose URI carries the UI scheme is app-only. */
const UI_URI_PREFIX = 'ui://';
/** `S1`: a mime type over this length is not parsed. */
const MIME_TYPE_LIMIT = 1024;
/** `y1`: the mime parameter value that marks an MCP app. */
const APP_PROFILE = 'mcp-app';
/** `Jc`: an RFC 7230 token. */
const TOKEN = '[!#$%&\'*+.^_`|~0-9A-Za-z-]+';
/** `_1`: the type/subtype head of a mime type. */
const MIME_HEAD = new RegExp(String.raw`^[ \t]*(${TOKEN})/(${TOKEN})`);
/** `Ip`: one `; name=value` parameter, sticky from the end of the head. */
const MIME_PARAMETER = new RegExp(
  String.raw`[ \t\r\n]*;[ \t\r\n]*(?:(${TOKEN})=(?:(${TOKEN})|"((?:[^"\\]|\\.)*)")(?=[ \t\r\n]*(?:;|$)))?`, 'y');

/** `Nre`: a template's display text stops at its first placeholder. */
export function templatePrefix(uriTemplate: string): string {
  const brace = uriTemplate.indexOf('{');
  return brace === -1 ? uriTemplate : uriTemplate.slice(0, brace);
}

/**
 * `ese`: a template replacement always leaves the draft open. A spaced text is quoted, and a
 * partial never closes the quote.
 */
export function shapeTemplateReplacement(text: string, complete: boolean): string {
  if (text.includes(' ')) return complete ? `@"${text}"` : `@"${text}`;
  return `@${text}`;
}

/**
 * `aAt`: a resource is hidden from the model's list when it is app-only — a `ui://` URI, or
 * a `text/html` mime type carrying `profile=mcp-app`. An unparsable or oversized mime type
 * is listed.
 */
export function isUiOnlyResource(resource: { uri: string; mimeType?: string }): boolean {
  if (resource.uri.slice(0, UI_URI_PREFIX.length).toLowerCase() === UI_URI_PREFIX) return true;
  const mimeType = resource.mimeType;
  if (mimeType === undefined || mimeType.length > MIME_TYPE_LIMIT) return false;
  const head = MIME_HEAD.exec(mimeType);
  if (head?.[1]?.toLowerCase() !== 'text' || head[2]?.toLowerCase() !== 'html') return false;
  MIME_PARAMETER.lastIndex = head[0].length;
  for (let match = MIME_PARAMETER.exec(mimeType); match !== null; match = MIME_PARAMETER.exec(mimeType)) {
    const [, name, bare, quoted] = match;
    const value = bare ?? quoted?.replace(/\\(.)/g, '$1');
    if (name?.toLowerCase() === 'profile' && value?.toLowerCase() === APP_PROFILE) return true;
  }
  return false;
}

/** One row the combined provider can emit; the id decides its family. */
export interface AtSuggestionRow {
  readonly id: string;
  readonly displayText: string;
  readonly description: string;
  /** `$0e`: the agent colour slot, when the type has one. */
  readonly color?: string;
  /** `$0e`: a template's replacement text, which the accept writes verbatim. */
  readonly metadata?: { readonly replacement: string; readonly partial: boolean };
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
export interface McpResource {
  readonly server: string;
  readonly uri: string;
  readonly name?: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/** One `he` entry: a listed MCP resource template. */
export interface McpTemplate {
  readonly server: string;
  readonly uriTemplate: string;
  readonly name?: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/** A non-file row, keyed for the shared fuzzy search. */
export type AtRankedItem =
  | { readonly type: 'mcp_resource'; readonly displayText: string; readonly description: string;
      readonly name: string; readonly server: string; readonly uri: string }
  | { readonly type: 'mcp_resource_template'; readonly displayText: string; readonly description: string;
      readonly name: string; readonly server: string; readonly uriTemplate: string }
  | { readonly type: 'agent'; readonly displayText: string; readonly description: string;
      readonly agentType: string; readonly color?: string };

/** `$0e`: one item becomes the row the composer draws. */
function adapt(item: AtRankedItem): AtSuggestionRow {
  switch (item.type) {
    case 'agent':
      return { id: `agent-${item.agentType}`, displayText: item.displayText,
        description: item.description, ...(item.color === undefined ? {} : { color: item.color }) };
    case 'mcp_resource':
      return { id: `mcp-resource-${item.server}__${item.uri}`,
        displayText: item.displayText, description: item.description };
    case 'mcp_resource_template': {
      const replacement = shapeTemplateReplacement(item.displayText, true);
      return { id: `mcp-template::${item.server}__${item.uriTemplate}`,
        displayText: item.displayText, description: item.description,
        metadata: { replacement, partial: true } };
    }
  }
}

/** `He`: every listed resource, flattened server-first, minus the app-only ones. */
export function mcpResourceRows(
  byServer: Readonly<Record<string, readonly McpResource[]>>): AtRankedItem[] {
  return Object.values(byServer).flat()
    .filter(resource => !isUiOnlyResource({ uri: resource.uri, mimeType: resource.mimeType }))
    .map(resource => ({ type: 'mcp_resource' as const,
      displayText: `${resource.server}:${resource.uri}`,
      description: clipEnd(resource.description || resource.name || resource.uri, AT_DESCRIPTION_LIMIT),
      name: resource.name || resource.uri, server: resource.server, uri: resource.uri }));
}

/** `$e`: the same for templates, filtered through their `uriTemplate`. */
export function mcpTemplateRows(
  byServer: Readonly<Record<string, readonly McpTemplate[]>>): AtRankedItem[] {
  return Object.values(byServer).flat()
    .filter(template => !isUiOnlyResource({ uri: template.uriTemplate, mimeType: template.mimeType }))
    .map(template => ({ type: 'mcp_resource_template' as const,
      displayText: `${template.server}:${templatePrefix(template.uriTemplate)}`,
      description: clipEnd(template.description || template.name || template.uriTemplate,
        AT_DESCRIPTION_LIMIT),
      name: template.name || template.uriTemplate, server: template.server,
      uriTemplate: template.uriTemplate }));
}

function agentItem(row: AgentSuggestionRow): AtRankedItem {
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
  /** `M`: the listed resources by server. */
  readonly mcpResources?: Readonly<Record<string, readonly McpResource[]>>;
  /** `he`: the listed templates by server. */
  readonly mcpResourceTemplates?: Readonly<Record<string, readonly McpTemplate[]>>;
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
  const ranked: AtRankedItem[] = [
    ...mcpResourceRows(options.mcpResources ?? {}),
    ...mcpTemplateRows(options.mcpResourceTemplates ?? {}),
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
