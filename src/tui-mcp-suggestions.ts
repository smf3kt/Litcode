import {
  AT_DESCRIPTION_LIMIT, AT_SUGGESTION_LIMIT, isUiOnlyResource, shapeTemplateReplacement,
  templatePrefix, type McpTemplate,
} from './tui-at-suggestions.js';
import { clipEnd } from './tui-autocomplete.js';
import type { McpTemplateCompletion } from './mcp.js';

type TemplatePart = { type: 'literal'; value: string } | { type: 'variable'; name: string };
export interface TemplateArgument {
  template: McpTemplate;
  argName: string;
  argValue: string;
  resolvedArgs: Record<string, string>;
  valueStartIndex: number;
}
export interface TemplateArgumentRow {
  readonly id: string;
  readonly displayText: string;
  readonly description: string;
  readonly replacement: string;
  readonly partial: boolean;
}

/** Lre, chunk-24k7d6mw.js [491873,492286), UTF-16. */
export function templateParts(text: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let index = 0, start = 0;
  while (index < text.length) {
    if (text[index] === '{') {
      if (index > start) parts.push({ type: 'literal', value: text.slice(start, index) });
      const end = text.indexOf('}', index);
      if (end === -1) { parts.push({ type: 'literal', value: text.slice(index) }); return parts; }
      let name = text.slice(index + 1, end).replace(/^[+#./;?&]/, '').replace(/\*$|:\d+$/, '');
      const comma = name.indexOf(',');
      if (comma !== -1) name = name.slice(0, comma);
      parts.push({ type: 'variable', name });
      index = end + 1; start = index;
    } else index++;
  }
  if (start < text.length) parts.push({ type: 'literal', value: text.slice(start) });
  return parts;
}

/** bEt, chunk-24k7d6mw.js [492286,492853), UTF-16. */
function matchTemplate(template: McpTemplate, value: string): TemplateArgument | null {
  const parts = templateParts(template.uriTemplate), resolvedArgs: Record<string, string> = {};
  let offset = 0;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    if (part.type === 'literal') {
      const rest = value.slice(offset);
      if (rest.length < part.value.length || !rest.startsWith(part.value)) return null;
      offset += part.value.length;
    } else {
      const next = parts[index + 1], delimiter = next?.type === 'literal' ? next.value : null;
      const rest = value.slice(offset);
      if (delimiter) {
        const end = rest.indexOf(delimiter);
        if (end === -1) return { template, argName: part.name, argValue: rest, resolvedArgs, valueStartIndex: offset };
        resolvedArgs[part.name] = rest.slice(0, end);
        offset += end;
      } else return { template, argName: part.name, argValue: rest, resolvedArgs, valueStartIndex: offset };
    }
  }
  return null;
}

/** o0e, chunk-24k7d6mw.js [492853,493153), UTF-16. */
export function activeTemplateArgument(value: string, templates: readonly McpTemplate[]): TemplateArgument | null {
  let best: TemplateArgument | null = null, rank = [-1, -1, -1];
  for (const template of templates) {
    const match = matchTemplate(template, value);
    if (!match) continue;
    const score = [Object.keys(match.resolvedArgs).length, match.valueStartIndex, (template.uriTemplate.match(/\{/g) ?? []).length];
    if (!best || score[0]! > rank[0]! || score[0] === rank[0] && score[1]! > rank[1]!
      || score[0] === rank[0] && score[1] === rank[1] && score[2]! > rank[2]!) {
      best = match; rank = score;
    }
  }
  return best;
}

/** n0e/e0e, chunk-24k7d6mw.js [493153,493497)/[491632,491873), UTF-16. */
function completedArgument(value: string, argument: TemplateArgument, candidate: string): { value: string; partial: boolean } {
  const parts = templateParts(argument.template.uriTemplate);
  const resolved = Object.keys(argument.resolvedArgs).length;
  let current = -1, count = 0;
  for (let index = 0; index < parts.length; index++) {
    if (parts[index]!.type !== 'variable') continue;
    if (count === resolved) { current = index; break; }
    count++;
  }
  let next = current + 1;
  while (parts[next]?.type === 'variable') next++;
  const following = current >= 0 ? parts[next] : undefined;
  return { value: value.slice(0, argument.valueStartIndex) + candidate
      + (following?.type === 'literal' ? following.value : ''),
    partial: current >= 0 && parts[current + 1]?.type === 'literal' && parts[current + 2]?.type === 'variable' };
}

function serverTemplates(partial: string, byServer: Readonly<Record<string, readonly McpTemplate[]>>) {
  const colon = partial.indexOf(':');
  if (colon === -1) return null;
  const server = partial.slice(0, colon), value = partial.slice(colon + 1);
  if (!Object.hasOwn(byServer, server)) return null;
  const templates = (byServer[server] ?? []).filter(template =>
    !isUiOnlyResource({ uri: template.uriTemplate, mimeType: template.mimeType }));
  return templates.length === 0 ? null : { server, value, templates };
}

/** ose static branch, chunk-24k7d6mw.js [564216,565691), UTF-16. */
export function templateArgumentRows(partial: string,
  byServer: Readonly<Record<string, readonly McpTemplate[]>>): TemplateArgumentRow[] | null {
  const selected = serverTemplates(partial, byServer);
  if (!selected || selected.value === '') return null;
  const { server, value, templates } = selected;
  const matches = templates.filter(template =>
    template.uriTemplate.startsWith(value) && template.uriTemplate.length > value.length);
  if (matches.length === 0) return null;
  return matches.slice(0, AT_SUGGESTION_LIMIT).map(template => {
    const displayText = `${server}:${templatePrefix(template.uriTemplate)}`;
    return { id: `mcp-template::${server}__${template.uriTemplate}`, displayText,
      description: clipEnd(template.description || template.name || template.uriTemplate, AT_DESCRIPTION_LIMIT),
      replacement: shapeTemplateReplacement(displayText, true), partial: true };
  });
}

/** ose dynamic branch, chunk-24k7d6mw.js [564216,565691), UTF-16. */
export async function completeTemplateArguments(partial: string,
  byServer: Readonly<Record<string, readonly McpTemplate[]>>, complete: McpTemplateCompletion,
  signal: AbortSignal): Promise<TemplateArgumentRow[] | null> {
  const selected = serverTemplates(partial, byServer);
  if (!selected) return null;
  const { server, value, templates } = selected;
  const argument = activeTemplateArgument(value, templates);
  if (!argument) return templateArgumentRows(partial, byServer);
  const values = await complete({ server, uriTemplate: argument.template.uriTemplate,
    argument: { name: argument.argName, value: argument.argValue }, resolvedArgs: argument.resolvedArgs }, signal);
  const description = clipEnd(argument.template.description || argument.template.name || '', AT_DESCRIPTION_LIMIT);
  return values.slice(0, AT_SUGGESTION_LIMIT).map(candidate => {
    const completed = completedArgument(value, argument, candidate);
    return { id: `mcp-template-value::${server}__${completed.value}`,
      displayText: completed.value.slice(argument.valueStartIndex), description,
      replacement: shapeTemplateReplacement(`${server}:${completed.value}`, completed.partial), partial: completed.partial };
  });
}

type CompletionState = { kind: 'empty' } | { kind: 'pending'; key: string; controller: AbortController; timer?: NodeJS.Timeout }
  | { kind: 'ready'; key: string; rows: TemplateArgumentRow[] | null };

/** ys/Cr, chunk-24k7d6mw.js [572764,573328)/[573571,573583), UTF-16: one debounced query owner. */
export class TemplateCompletion {
  private state: CompletionState = { kind: 'empty' };
  constructor(private readonly changed: () => void) {}
  rows(key: string, load: (signal: AbortSignal) => Promise<TemplateArgumentRow[] | null>): TemplateArgumentRow[] | null {
    if (this.state.kind !== 'empty' && this.state.key === key) return this.state.kind === 'ready' ? this.state.rows : [];
    this.reset();
    const state: Extract<CompletionState, { kind: 'pending' }> = { kind: 'pending', key, controller: new AbortController() };
    this.state = state;
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void load(state.controller.signal).then(rows => {
        if (this.state !== state || state.controller.signal.aborted) return;
        this.state = { kind: 'ready', key, rows }; this.changed();
      }).catch(() => {
        if (this.state !== state || state.controller.signal.aborted) return;
        this.state = { kind: 'ready', key, rows: [] }; this.changed();
      });
    }, 50);
    return [];
  }
  reset(): void {
    if (this.state.kind === 'pending') { clearTimeout(this.state.timer); this.state.controller.abort(); }
    this.state = { kind: 'empty' };
  }
}
