import {
  AT_DESCRIPTION_LIMIT, AT_SUGGESTION_LIMIT, isUiOnlyResource, shapeTemplateReplacement,
  templatePrefix, type McpTemplate,
} from './tui-at-suggestions.js';
import { clipEnd } from './tui-autocomplete.js';

/**
 * The explicit `@server:` template list, adapted from the recovered interactive application
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `ose` 564216. The
 * source first tries to complete the next template argument through the connected client
 * (`o0e`/`bEt`/`n0e`); that path needs a live server and is not ported, so the static
 * prefix branch is the whole local behaviour. Coordinates are zero-based UTF-16 offsets.
 */

/** One template row the explicit form returns, before it becomes a suggestion. */
export interface TemplateArgumentRow {
  readonly id: string;
  readonly displayText: string;
  readonly description: string;
  /** `ese(displayText, true)`: the draft the accept writes. */
  readonly replacement: string;
  /** Always true: a template is completed only to its literal head. */
  readonly partial: true;
}

/**
 * `ose`, static branch: a `server:` partial lists the templates for that server whose URI
 * starts with the typed remainder. Null means "no explicit answer" — the caller then falls
 * back to the combined provider, exactly as `ose` returning null does.
 */
export function templateArgumentRows(partial: string,
  byServer: Readonly<Record<string, readonly McpTemplate[]>>): TemplateArgumentRow[] | null {
  const colon = partial.indexOf(':');
  if (colon === -1) return null;
  const server = partial.slice(0, colon);
  const rest = partial.slice(colon + 1);
  if (!Object.hasOwn(byServer, server)) return null;
  const templates = (byServer[server] ?? [])
    .filter(template => !isUiOnlyResource({ uri: template.uriTemplate, mimeType: template.mimeType }));
  if (templates.length === 0) return null;
  if (rest === '') return null;
  const matches = templates.filter(template =>
    template.uriTemplate.startsWith(rest) && template.uriTemplate.length > rest.length);
  if (matches.length === 0) return null;
  return matches.slice(0, AT_SUGGESTION_LIMIT).map(template => {
    const displayText = `${server}:${templatePrefix(template.uriTemplate)}`;
    return { id: `mcp-template::${server}__${template.uriTemplate}`, displayText,
      description: clipEnd(template.description || template.name || template.uriTemplate,
        AT_DESCRIPTION_LIMIT),
      replacement: shapeTemplateReplacement(displayText, true), partial: true as const };
  });
}
