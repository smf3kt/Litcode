/**
 * The `/hooks` panel. Recovered from `chunk-5ggmnm67.js`, sha256
 * `ea9d9376a5653cc9717c6259d762931644a873dbbb103880bad9c78e5f917776`: the entry `Jd` at 61081, the
 * mode machine `ft` (its `list` arm at 58711, `select-event` at 58900, `select-matcher` at 60145,
 * `select-hook` at 60852, `view-hook` at 61081), the list view `wo` at 39911, the events view `So`
 * at 44300, the matcher view `bo` at 44860, the hook view `Ho` at 45500, the detail view `Eo` at
 * 48222, and the two type tables `kn` at 51200 and `vn` at 51492. Offsets are zero-based UTF-16
 * code units.
 *
 * The event metadata, the source labels and their readers come from `./hooks-event-metadata.js`
 * (`igt` in `chunk-5s0t90hn.js`, `$p`/`Mx` in `chunk-n3ykh62m.js`).
 *
 * Four surfaces, in the recovered machine's order: the hook list (`Hooks`), the event browser
 * (`Hook events`), the matcher browser for one event, and the hook detail. The recovered `list`
 * surface is what a bare `/hooks` opens; `All events` is a row inside it that opens the browser.
 */

import type { HookDefinition, HookEntry, HookEvent, HooksConfig } from './hooks.js';
import type { TerminalPromptRequest } from './terminal.js';
import { HOOK_EVENT_METADATA, hookEventMetadata, hookSourceDescription } from './hooks-event-metadata.js';

export const HOOKS_TITLE = 'Hooks';
export const HOOKS_EVENTS_TITLE = 'Hook events';
export const HOOKS_ALL_EVENTS = 'All events';
export const HOOKS_NONE_YET = 'no hooks yet';
export const HOOKS_MANAGED_ONLY = 'managed hooks only';
export const HOOKS_NONE_FOR_EVENT = 'No hooks configured for this event';
export const HOOKS_ADD_HINT = 'To add hooks, edit settings.json directly or ask Claude';
export const HOOKS_ALL_MATCHER = '(all)';
export const HOOKS_MATCHES_EVERYTHING = 'matches everything';
export const HOOKS_GUIDE_LIST = 'enter view, escape close';
export const HOOKS_GUIDE_EVENTS = 'enter open, escape go back';
export const HOOKS_GUIDE_BACK = 'escape go back';
export const HOOKS_DISMISSED = 'Hooks dialog dismissed';
/** Source `Zo`: the row that opens the event browser from the list. */
export const HOOKS_EVENTS_ROW = `events`;

/** Source `I`: one is the singular, anything else the plural. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Source `ep`: control characters are shown as their symbol rather than breaking the row. */
export function escapeHookText(text: string): string {
  return text.replace(/\n/g, '␤').replace(/\t/g, '␉');
}

/** One hook as the panel shows it: the definition, the event, and where it came from. */
export interface HookPanelHook {
  readonly event: HookEvent;
  /** The matcher this definition is filed under, or `''` for the `(all)` bucket. */
  readonly matcher: string;
  readonly config: HookDefinition;
  readonly source: string;
  readonly pluginName?: string;
}

export interface HookPanelInput {
  readonly hooks: readonly HookPanelHook[];
  /** Settings file per source, for the detail view's "edit …" guidance. */
  readonly settingsPaths?: Readonly<Record<string, string>>;
  /** Source `fi`: managed settings restrict the list to their own hooks. */
  readonly restrictedByPolicy?: boolean;
}

/** One settings layer's own declaration, before the config merge flattened them together. */
export interface HookLayer {
  readonly source: string;
  readonly hooks: HooksConfig;
}

/** One hook's identity inside a config object, as a merge-stable key. */
function hookEntryKey(event: string, entry: HookEntry): string {
  return `${event}\u0000${JSON.stringify(entry)}`;
}

/**
 * Splits the merged hook config back into its layers. The local merge
 * (`loadProjectConfig`) folds plugin declarations and every settings layer into one `config.hooks`,
 * so the source has to be reconstructed: walk the merged entries and attribute each to the first
 * layer that declares the same entry, then give whatever is left to `pluginHook` — which is how the
 * recovered merge puts plugin declarations first. A layer cannot be matched twice for the same
 * entry, so duplicated declarations keep one per declaring layer.
 */
export function attributeHooks(merged: HooksConfig, layers: readonly HookLayer[]): HookPanelHook[] {
  const remaining = new Map<string, { source: string; count: number }[]>();
  for (const layer of layers) {
    for (const [event, entries] of Object.entries(layer.hooks)) {
      for (const entry of entries ?? []) {
        const key = hookEntryKey(event, entry);
        const buckets = remaining.get(key) ?? [];
        const bucket = buckets.find(candidate => candidate.source === layer.source);
        if (bucket === undefined) buckets.push({ source: layer.source, count: 1 });
        else bucket.count++;
        remaining.set(key, buckets);
      }
    }
  }
  const hooks: HookPanelHook[] = [];
  for (const [event, entries] of Object.entries(merged)) {
    for (const entry of entries ?? []) {
      const key = hookEntryKey(event, entry);
      const bucket = remaining.get(key)?.find(candidate => candidate.count > 0);
      const source = bucket?.source ?? 'pluginHook';
      if (bucket !== undefined) bucket.count--;
      const definitions: { definition: HookDefinition; matcher: string }[] = 'hooks' in entry
        ? entry.hooks.map(definition => ({ definition, matcher: entry.matcher ?? definition.matcher ?? '' }))
        : [{ definition: entry, matcher: entry.matcher ?? '' }];
      for (const { definition, matcher } of definitions) {
        hooks.push({ event: event as HookEvent, matcher, config: definition, source });
      }
    }
  }
  return hooks;
}

/**
 * Source `Mx`: the text a definition shows in the list and the detail body. The local definition
 * has no `args`, no `server` and no `statusMessage`, so those recovered arms collapse to the field
 * this host carries.
 */
export function hookConfigText(config: HookDefinition): string {
  if ('command' in config) return config.command;
  if ('url' in config) return config.url;
  if ('prompt' in config) return config.prompt;
  if ('tool' in config) return config.tool;
  if ('name' in config) return config.name;
  return '';
}

/** Source `C0`: the status message when a definition carries one, otherwise the config text. */
export function hookConfigLabel(config: HookDefinition): string {
  return escapeHookText(hookConfigText(config));
}

/** Source `kn`: the detail view's title. */
export function hookDetailTitle(config: HookDefinition): string {
  switch (config.type) {
    case 'http': return 'HTTP hook';
    case 'prompt': return 'Prompt hook';
    case 'agent': return 'Agent hook';
    case 'mcp_tool': return 'MCP tool hook';
    case 'script': return 'Script hook';
    default: return 'Command hook';
  }
}

/** Source `vn`: the label of the definition's payload. */
export function hookConfigKindLabel(config: HookDefinition): string {
  switch (config.type) {
    case 'http': return 'URL';
    case 'prompt':
    case 'agent': return 'Prompt';
    case 'mcp_tool': return 'MCP tool';
    case 'script': return 'Script';
    default: return 'Command';
  }
}

/**
 * Source `gn`: how this hook can be changed. The recovered resolves the settings path through the
 * source; here the caller supplies it, and an unknown path falls back to the recovered literal.
 */
export function hookGuidance(hook: HookPanelHook,
  settingsPaths: Readonly<Record<string, string>> = {}): string {
  switch (hook.source) {
    case 'userSettings':
    case 'projectSettings':
    case 'localSettings': {
      const file = settingsPaths[hook.source];
      return `To change or remove this hook, edit ${file === undefined ? 'settings.json' : escapeHookText(file)} or ask Claude.`;
    }
    case 'pluginHook':
      return hook.pluginName
        ? `This hook comes from the ${escapeHookText(hook.pluginName)} plugin and stops running when that plugin is disabled (/plugin).`
        : 'This hook comes from a plugin and stops running when that plugin is disabled (/plugin).';
    case 'builtinHook':
      return "This hook is built in to Claude Code and can't be changed or removed.";
    case 'sessionHook':
      return 'This hook was registered while Claude Code was running (by /goal, an agent or a skill), not by a settings file, and can\'t be changed here.';
    case 'policySettings':
      return "This hook is set by your organization's managed settings and can't be changed here.";
    default:
      return `This hook comes from ${escapeHookText(hook.source)}.`;
  }
}

/** Source `wo`'s subtitle: the hook and event counts, or the reason the list is empty. */
export function hookListSubtitle(hooks: readonly HookPanelHook[], restrictedByPolicy = false): string {
  if (hooks.length === 0) return restrictedByPolicy ? HOOKS_MANAGED_ONLY : HOOKS_NONE_YET;
  const events = new Set(hooks.map(hook => hook.event)).size;
  return `${hooks.length} ${pluralize(hooks.length, 'hook')} on ${events} ${pluralize(events, 'event')}`;
}

/** Source `So`'s subtitle: every event, then how many carry hooks. */
export function hookEventSubtitle(total: number, withHooks: number): string {
  return `${total} ${pluralize(total, 'event')} · ${withHooks} with hooks`;
}

/** Source `xr`: the matcher's row label, `(all)` where the matcher is empty. */
export function hookMatcherLabel(matcher: string): string {
  return matcher ? escapeHookText(matcher) : HOOKS_ALL_MATCHER;
}

/** Source `bo`'s title. */
export function hookMatcherTitle(event: string): string {
  return `${event} - Matchers`;
}

/** Source `Ho`'s title: the matcher only where the event declares matcher metadata. */
export function hookEventHooksTitle(event: string, matcher: string,
  hasMatcherMetadata: boolean): string {
  return hasMatcherMetadata ? `${event} - Matcher: ${matcher ? escapeHookText(matcher) : HOOKS_ALL_MATCHER}` : event;
}

/** The events the list knows about, in the metadata table's order, with the events that have hooks first. */
function eventsWithCounts(input: HookPanelInput, onlyWithHooks: boolean): { event: HookEvent; count: number }[] {
  const counts = new Map<string, number>();
  for (const hook of input.hooks) counts.set(hook.event, (counts.get(hook.event) ?? 0) + 1);
  const rows: { event: HookEvent; count: number }[] = [];
  for (const event of Object.keys(HOOK_EVENT_METADATA) as HookEvent[]) {
    const count = counts.get(event) ?? 0;
    if (onlyWithHooks && count === 0) continue;
    rows.push({ event, count });
  }
  return rows;
}

/** Source `wo`: the flat hook list, hooks grouped by event, with the `All events` row last. */
export function hooksListRequest(input: HookPanelInput, focus = 0): TerminalPromptRequest {
  const lines: string[] = [hookListSubtitle(input.hooks, input.restrictedByPolicy), ''];
  const choices: { label: string; value: string; description?: string }[] = [];
  let lastEvent = '';
  for (const [index, hook] of input.hooks.entries()) {
    const metadata = hookEventMetadata(hook.event);
    if (hook.event !== lastEvent) {
      lines.push(hook.event);
      lastEvent = hook.event;
    }
    const description = hook.source === 'pluginHook' && hook.pluginName
      ? `${hookSourceDescription(hook.source)} (${escapeHookText(hook.pluginName)})`
      : hookSourceDescription(hook.source);
    lines.push(`  ${hookConfigLabel(hook.config)}  [${hook.config.type ?? 'command'}]  ${description}`);
    choices.push({ label: `${hook.event} ${hookConfigLabel(hook.config)}`.trim(), value: `hook:${index}`,
      ...(metadata === undefined ? {} : { description: metadata.summary }) });
  }
  if (input.hooks.length > 0) lines.push('');
  else lines.push(input.restrictedByPolicy === true ? HOOKS_MANAGED_ONLY : HOOKS_NONE_YET);
  lines.push('', HOOKS_ALL_EVENTS);
  choices.push({ label: HOOKS_ALL_EVENTS, value: HOOKS_EVENTS_ROW });
  return {
    title: HOOKS_TITLE,
    message: [...lines, '', HOOKS_GUIDE_LIST].join('\n'),
    choices,
    defaultIndex: Math.max(0, Math.min(focus, choices.length - 1)),
  };
}

/** Source `So`: every lifecycle event with its summary and hook count. */
export function hooksEventRequest(input: HookPanelInput, focus = 0): TerminalPromptRequest {
  const rows = eventsWithCounts(input, false);
  const withHooks = rows.filter(row => row.count > 0).length;
  const choices = rows.map((row, position) => {
    const metadata = hookEventMetadata(row.event);
    return {
      label: row.event,
      value: `event:${row.event}`,
      description: [metadata?.summary, row.count > 0 ? `${row.count} ${pluralize(row.count, 'hook')}` : undefined]
        .filter(Boolean).join(' · '),
    };
  });
  return {
    title: HOOKS_EVENTS_TITLE,
    message: [hookEventSubtitle(rows.length, withHooks), '', HOOKS_ALL_EVENTS, '', HOOKS_GUIDE_EVENTS].join('\n'),
    choices,
    defaultIndex: Math.max(0, Math.min(focus, Math.max(0, choices.length - 1))),
  };
}

/** Source `bo`: the matchers of one event, each with the sources that declare it and its hook count. */
export function hooksMatcherRequest(input: HookPanelInput, event: HookEvent,
  focus = 0): TerminalPromptRequest {
  const metadata = hookEventMetadata(event);
  const hooks = input.hooks.filter(hook => hook.event === event);
  const matchers = [...new Set(hooks.map(hook => hook.matcher))];
  const choices = matchers.map(matcher => {
    const bucket = hooks.filter(hook => hook.matcher === matcher);
    const sources = [...new Set(bucket.map(hook => hook.source))];
    return {
      label: hookMatcherLabel(matcher),
      value: `matcher:${matcher}`,
      description: `[${sources.join(', ')}] · ${bucket.length} ${pluralize(bucket.length, 'hook')}`,
    };
  });
  const body = choices.length === 0
    ? [HOOKS_NONE_FOR_EVENT, HOOKS_ADD_HINT]
    : [metadata?.description ?? '', ''];
  return {
    title: hookMatcherTitle(event),
    message: [...body, '', HOOKS_GUIDE_BACK].join('\n'),
    choices,
    defaultIndex: Math.max(0, Math.min(focus, Math.max(0, choices.length - 1))),
  };
}

/** Source `Ho`: the hooks filed under one matcher, or under the event when it has no matchers. */
export function hooksEventHooksRequest(input: HookPanelInput, event: HookEvent, matcher: string,
  focus = 0): TerminalPromptRequest {
  const hasMatcherMetadata = hookEventMetadata(event)?.matcherField !== undefined;
  const hooks = input.hooks
    .map((hook, index) => ({ hook, index }))
    .filter(entry => entry.hook.event === event && (!hasMatcherMetadata || entry.hook.matcher === matcher));
  const choices = hooks.map(({ hook, index }) => ({
    label: hookConfigLabel(hook.config),
    value: `hook:${index}`,
    description: hook.source === 'pluginHook' && hook.pluginName
      ? `${hookSourceDescription(hook.source)} (${escapeHookText(hook.pluginName)})`
      : hookSourceDescription(hook.source),
  }));
  const metadata = hookEventMetadata(event);
  const body = choices.length === 0
    ? [HOOKS_NONE_FOR_EVENT, HOOKS_ADD_HINT]
    : [metadata?.description ?? ''];
  return {
    title: hookEventHooksTitle(event, matcher, hasMatcherMetadata),
    message: [...body, '', HOOKS_GUIDE_BACK].join('\n'),
    choices,
    defaultIndex: Math.max(0, Math.min(focus, Math.max(0, choices.length - 1))),
  };
}

/** Source `Eo`: one hook's details. `Esc` goes back to the surface it was opened from. */
export function hookDetailRequest(hook: HookPanelHook,
  settingsPaths: Readonly<Record<string, string>> = {}): TerminalPromptRequest {
  const hasMatcherMetadata = hookEventMetadata(hook.event)?.matcherField !== undefined;
  const matcher = hook.matcher ? escapeHookText(hook.matcher) : HOOKS_MATCHES_EVERYTHING;
  const lines = [
    hasMatcherMetadata ? `${hook.event} · ${matcher}` : hook.event,
    '',
    `Source: ${hookSourceDescription(hook.source)}`,
    ...(hook.pluginName === undefined ? [] : [`Plugin: ${escapeHookText(hook.pluginName)}`]),
    '',
    hookConfigKindLabel(hook.config),
    escapeHookText(hookConfigText(hook.config)),
    '',
    hookGuidance(hook, settingsPaths),
    '',
    HOOKS_GUIDE_BACK,
  ];
  return {
    title: hookDetailTitle(hook.config),
    message: lines.join('\n'),
    choices: [{ label: 'Back', value: 'back' }],
    defaultIndex: 0,
  };
}

export type HookPanelAnswer = { selected: readonly string[] } | undefined;

/** Source `ft`: `list` → `view-hook` | `select-event` → `select-matcher` → `select-hook` → `view-hook`. */
type HookPanelMode =
  | { readonly kind: 'list' }
  | { readonly kind: 'events' }
  | { readonly kind: 'matchers'; readonly event: HookEvent }
  | { readonly kind: 'hooks'; readonly event: HookEvent; readonly matcher: string }
  | { readonly kind: 'detail'; readonly hook: HookPanelHook; readonly from: 'list' | 'events' };

/**
 * Source `ft`'s navigation. `Esc` steps back one surface and dismisses the panel from the list; a
 * hook opened from the list returns to the list, and one opened from the event browser returns to
 * the hooks surface, which is where the recovered `from` field sends it.
 */
export async function browseHooks(input: HookPanelInput,
  read: (request: TerminalPromptRequest) => Promise<HookPanelAnswer>): Promise<string | undefined> {
  let mode: HookPanelMode = { kind: 'list' };
  for (;;) {
    const request = mode.kind === 'list' ? hooksListRequest(input)
      : mode.kind === 'events' ? hooksEventRequest(input)
        : mode.kind === 'matchers' ? hooksMatcherRequest(input, mode.event)
          : mode.kind === 'hooks' ? hooksEventHooksRequest(input, mode.event, mode.matcher)
            : hookDetailRequest(mode.hook, input.settingsPaths);
    const answer = await read(request);
    if (answer === undefined) {
      switch (mode.kind) {
        case 'list': return HOOKS_DISMISSED;
        case 'events': mode = { kind: 'list' }; break;
        case 'matchers': mode = { kind: 'events' }; break;
        case 'hooks':
          mode = hookEventMetadata(mode.event)?.matcherField === undefined
            ? { kind: 'events' } : { kind: 'matchers', event: mode.event };
          break;
        case 'detail':
          mode = mode.from === 'list' ? { kind: 'list' } : { kind: 'hooks', event: mode.hook.event, matcher: mode.hook.matcher };
          break;
      }
      continue;
    }
    const value = answer.selected[0] ?? '';
    if (mode.kind === 'list') {
      if (value === HOOKS_EVENTS_ROW) { mode = { kind: 'events' }; continue; }
      const hook = value.startsWith('hook:') ? input.hooks[Number(value.slice(5))] : undefined;
      if (hook === undefined) return HOOKS_DISMISSED;
      mode = { kind: 'detail', hook, from: 'list' };
      continue;
    }
    if (mode.kind === 'events') {
      const event = value.startsWith('event:') ? value.slice(6) as HookEvent : undefined;
      if (event === undefined) { mode = { kind: 'list' }; continue; }
      mode = hookEventMetadata(event)?.matcherField === undefined
        ? { kind: 'hooks', event, matcher: '' } : { kind: 'matchers', event };
      continue;
    }
    if (mode.kind === 'matchers') {
      mode = { kind: 'hooks', event: mode.event, matcher: value.startsWith('matcher:') ? value.slice(8) : '' };
      continue;
    }
    if (mode.kind === 'hooks') {
      const index = value.startsWith('hook:') ? Number(value.slice(5)) : -1;
      const hook = input.hooks[index];
      if (hook === undefined) { mode = { kind: 'events' }; continue; }
      mode = { kind: 'detail', hook, from: 'events' };
      continue;
    }
    mode = mode.from === 'list' ? { kind: 'list' }
      : { kind: 'hooks', event: mode.hook.event, matcher: mode.hook.matcher };
  }
}
