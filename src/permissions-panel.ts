/**
 * The `/permissions` panel. Recovered from `chunk-fxx7hh8y.js`, sha256
 * `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`: the `local-jsx` body `gR` at
 * 91405, the shell `di` at 72643, the rule tab body `Jt` at 71615, the section table `Pr` at 19132,
 * the source-label readers `sd` 23270 / `dn` 23351 / `Te` 43114, the save-scope picker `mn` at
 * 25734 with the destination rows `el` at 25370, the add-rule input `pn` at 27432, the rule detail
 * and delete confirm `ai` at 67512, and the shadow analysis `Fr` at 24223 with `ld` 23975, `id`
 * 23651 and `Zi` 23380.
 *
 * Cross-chunk: the rule display formatter `jSr` (`chunk-qq2mgstr.js` 15549, mirrored by `ve` at
 * 10696) with the duplicate disambiguator `uFe` at 10928 and the label limit `N6` = 2000 at 8806,
 * the rule decomposition `iNt` (`chunk-es5g07ss.js` 662), the long source label `fT`
 * (`chunk-wtch2p0g.js` 6070), the delete service `kor` (`chunk-sfn1dbxq.js` 3364311), and the
 * canonical rule key `_` = `JSON.stringify` (`chunk-gyf58rwf.js` 59764). Offsets are zero-based
 * UTF-16 code units.
 *
 * Three surfaces, in the recovered order: the tabbed rule list, the add-rule flow (`pn` then `mn`),
 * and the rule's own pane (`ai`). The rule list is the tab strip's `allow`, `ask` and `deny` tabs;
 * the `workspace` tab is `wn`/`xn`, below, and the `recent` tab is `Rn`/`Wr`, below that. The
 * recovered `automode` tab is a `PERMISSION_TABS` entry this build does not render yet.
 */

import type { PermissionFilePaths } from './permission-settings.js';
import type { PermissionUpdate } from './permissions.js';
import type { TerminalPromptRequest } from './terminal.js';
import { addDirectoryMessage, validateAddDirectory } from './add-dir-command.js';
import { BASH_RULE_TOOL } from './agent-tool-restrictions.js';
import { denialReasonText, type AutoModeDenial } from './permission-denials.js';
import { parsePermissionRule, serializePermissionRule } from './permission-state.js';
import { te } from './tui-symbols.js';

export const PERMISSIONS_TITLE = 'Permissions';
export const PERMISSIONS_DISMISSED = 'Permissions dialog dismissed';
export const PERMISSIONS_RULE_DETAILS_TITLE = 'Rule details';

export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export interface PermissionRuleValue { readonly toolName: string; readonly ruleContent?: string }

/** One rule as the panel holds it: the value, the bucket it sits in and the layer that declares it. */
export interface PermissionPanelRule {
  readonly ruleValue: PermissionRuleValue;
  readonly ruleBehavior: PermissionBehavior;
  readonly source: string;
}

/** Source `Pr` at 19132: each section's title and the line it shows when it holds nothing. */
export const PERMISSION_SECTIONS = [
  { kind: 'allow', title: 'Allow', empty: 'No allow rules' },
  { kind: 'ask', title: 'Ask', empty: 'No ask rules' },
  { kind: 'deny', title: 'Deny', empty: 'No deny rules' },
  { kind: 'additionalDirectories', title: 'Workspace', empty: 'No additional working directories' },
] as const;
export type PermissionSectionKind = typeof PERMISSION_SECTIONS[number]['kind'];

export function permissionSectionTitle(kind: PermissionSectionKind): string {
  return PERMISSION_SECTIONS.find(section => section.kind === kind)!.title;
}

export function permissionSectionEmpty(kind: PermissionSectionKind): string {
  return PERMISSION_SECTIONS.find(section => section.kind === kind)!.empty;
}

/**
 * The shell's tab table, in the recovered `br` order (`di` at 72643): `recent`, `allow`, `ask`,
 * `deny`, then `automode` — which the source drops when `isAutoModeAvailable` is false — then
 * `workspace`. `title` is the `Na` prop each tab is declared with.
 */
export const PERMISSION_TABS = [
  { id: 'recent', title: 'Recently denied' },
  { id: 'allow', title: 'Allow' },
  { id: 'ask', title: 'Ask' },
  { id: 'deny', title: 'Deny' },
  { id: 'automode', title: 'Auto mode' },
  { id: 'workspace', title: 'Workspace' },
] as const;
export type PermissionTabId = typeof PERMISSION_TABS[number]['id'];

/** The tabs this package renders. The other three are their own work packages. */
export const PERMISSION_RULE_TABS = ['allow', 'ask', 'deny'] as const;
export type PermissionRuleTabId = typeof PERMISSION_RULE_TABS[number];

export function permissionTabTitle(id: PermissionTabId): string {
  return PERMISSION_TABS.find(tab => tab.id === id)!.title;
}

/** Source `Jt` at 71615: the one line each rule tab carries above its list. */
const PERMISSION_TAB_INTROS = {
  allow: "Claude Code won't ask before using allowed tools.",
  ask: 'Claude Code will always ask for confirmation before using these tools.',
  deny: 'Claude Code will always reject requests to use denied tools.',
} as const;

export function permissionTabIntro(tab: PermissionRuleTabId): string {
  return PERMISSION_TAB_INTROS[tab];
}

/** Source `di`'s `Mt`: the row that opens the add flow, and its value. */
export const PERMISSION_ADD_RULE_LABEL = `Add a new rule${te.ellipsis}`;
export const PERMISSION_ADD_RULE_VALUE = 'add-new-rule';

/** The tabs whose rows the recovered `Mt` withholds the add row from. */
const TABS_WITHOUT_ADD_ROW = new Set<PermissionTabId>(['workspace', 'recent', 'automode']);

/** Source `Hu` at 19679: the invisible characters the display text drops. */
const INVISIBLE = /[​‎‏⁠﻿]/g;

/**
 * Source `jSr` (mirrored by `ve` at 10696): the rule's display text. The recovered truncates at its
 * own limit and hands a gutter decision to the row renderer; this host's rows clip themselves, so
 * only the invisible-character strip and the whitespace fold survive. The wider `T3e` character
 * classifier and the gutter arm are not ported.
 */
export function permissionRuleText(rule: PermissionRuleValue): string {
  return serializePermissionRule(rule).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

/** Source `N6` at 8806: the label length the duplicate form truncates to. */
export const PERMISSION_LABEL_LIMIT = 2000;

/**
 * Source `uFe` at 10928 with `jD` as the formatter: the row label for each rule. Rules whose display
 * text is unique show it; rules that fold onto the same text fall back to the serialized text —
 * truncated and with its non-ASCII characters escaped — and take a `(#N)` suffix from the second
 * appearance on. Identical serialized texts share one group, so they never earn a suffix.
 */
export function permissionRuleLabels(rules: readonly PermissionRuleValue[]): string[] {
  return permissionDisplayLabels(rules.map(serializePermissionRule), text => text.replace(INVISIBLE, ''));
}

/**
 * Source `uFe` at 10928 with a caller formatter. `format` runs twice per value: once to group the
 * entries whose display text folds alike, and once for the plain label. A grouped entry falls back
 * to its own raw text — truncated and with its non-ASCII characters escaped — and takes a `(#N)`
 * suffix from the second appearance on. Identical raw texts share one seen-slot, so they never earn
 * a suffix. The workspace list reuses this (`nB` = `uFe` over `Fn`).
 */
export function permissionDisplayLabels<T>(values: readonly T[], format: (value: T) => string): string[] {
  const texts = values.map(value => format(value));
  const formatted = texts.map(text => text.replace(/\s+/g, ' ').trim());
  const groups = new Map<string, Set<string>>();
  for (const [index, text] of texts.entries()) {
    const key = formatted[index]!.normalize('NFC');
    const bucket = groups.get(key) ?? new Set<string>();
    bucket.add(text);
    groups.set(key, bucket);
  }
  const escaped = (text: string): string => text.slice(0, PERMISSION_LABEL_LIMIT)
    .replace(/[\u007f-￿]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
    + (text.length > PERMISSION_LABEL_LIMIT ? te.ellipsis : '');
  const seen = new Map<string, Map<string, number>>();
  return values.map((_value, index) => {
    const text = texts[index]!, form = formatted[index]!;
    if ((groups.get(form.normalize('NFC'))?.size ?? 0) <= 1) return form;
    const escapedText = escaped(text);
    const counts = seen.get(escapedText) ?? new Map<string, number>();
    seen.set(escapedText, counts);
    const position = counts.get(text) ?? counts.size + 1;
    counts.set(text, position);
    return position > 1 ? `${escapedText} (#${position})` : escapedText;
  });
}

/**
 * Source `iNt` (`chunk-es5g07ss.js` 662): the two-part reading of a rule, or undefined when the
 * rule has no such reading and the serialized text stands alone.
 */
export function permissionRuleDecomposition(rule: PermissionRuleValue):
  { prefix: string; emphasis?: string; suffix?: string } | undefined {
  if (rule.toolName === BASH_RULE_TOOL) {
    if (!rule.ruleContent) return { prefix: 'Any Bash command' };
    if (rule.ruleContent.endsWith(':*') || rule.ruleContent.endsWith(' *')) {
      return { prefix: 'Any Bash command starting with ', emphasis: rule.ruleContent.slice(0, -2) };
    }
    return { prefix: 'The Bash command ', emphasis: rule.ruleContent };
  }
  if (!rule.ruleContent) return { prefix: 'Any use of the ', emphasis: rule.toolName, suffix: ' tool' };
  return undefined;
}

/**
 * Source `fT` (`chunk-wtch2p0g.js` 6070): the long source label the shadow fixes and the rule
 * detail use. `Te` at 43114 is the short table the add flow's description does not use.
 */
export function permissionSourceName(source: string): string {
  switch (source) {
    case 'userSettings': return 'user settings';
    case 'projectSettings': return 'shared project settings';
    case 'localSettings': return 'project local settings';
    case 'flagSettings': return 'command line arguments';
    case 'policySettings': return 'enterprise managed settings';
    case 'cliArg': return 'CLI argument';
    case 'command': return 'command configuration';
    case 'session': return 'current session';
    case 'toolsNarrowing': return 'CLI tool narrowing';
    case 'mcpServerPolicy': return 'MCP server policy';
    case 'hostCredential': return 'cloud-session credential guard';
    default: return source;
  }
}

/**
 * Source `Bbe` (`chunk-wtch2p0g.js` 6070) with `el` at 25370: the save scopes in the recovered
 * order — local, then project, then user — each with the label and the description the picker
 * shows. `TO` resolves the path from the destination; here the caller supplies it.
 */
export const PERMISSION_SAVE_DESTINATIONS = ['localSettings', 'projectSettings', 'userSettings'] as const;
export type PermissionSaveDestination = typeof PERMISSION_SAVE_DESTINATIONS[number];

export interface PermissionSaveOption { label: string; description: string; value: PermissionSaveDestination }

export function permissionSaveOptions(paths: PermissionFilePaths = {},
  userSettingsFile = '~/.claude/settings.json'): PermissionSaveOption[] {
  return PERMISSION_SAVE_DESTINATIONS.map(destination => {
    const file = paths[destination] ?? userSettingsFile;
    switch (destination) {
      case 'localSettings': return { label: 'Project settings (local)', description: `Saved in ${file}`, value: destination };
      case 'projectSettings': return { label: 'Project settings', description: `Checked in at ${file}`, value: destination };
      default: return { label: 'User settings', description: `Saved in at ${file}`, value: destination };
    }
  });
}

/** Source `_` (`chunk-gyf58rwf.js` 59764): the recovered keys a rule by its canonical JSON. */
export function permissionRuleKey(rule: PermissionPanelRule): string {
  return `${rule.source}\u0000${rule.ruleBehavior}\u0000${serializePermissionRule(rule.ruleValue)}`;
}

/** The buckets a tab lists, flattened from the live state's per-source rule lists. */
export function permissionPanelRules(
  buckets: Readonly<Partial<Record<string, readonly string[]>>>,
  behavior: PermissionBehavior): PermissionPanelRule[] {
  const rules: PermissionPanelRule[] = [];
  for (const [source, values] of Object.entries(buckets)) {
    for (const value of values ?? []) {
      rules.push({ ruleValue: parsePermissionRule(value), ruleBehavior: behavior, source });
    }
  }
  return rules;
}

export interface PermissionRuleRow { label: string; value: string }

export interface PermissionRuleList {
  readonly options: readonly PermissionRuleRow[];
  readonly rulesByKey: ReadonlyMap<string, PermissionPanelRule>;
}

/**
 * Source `di`'s `Mt` at 72767: one tab's rows. The add row leads unless the tab is
 * `workspace`/`recent`/`automode` or a filter is active; the rules follow, sorted by their
 * lowercased display text, filtered by the query, and labelled through `nB`.
 */
export function permissionRuleRows(rules: readonly PermissionPanelRule[], tab: PermissionTabId,
  query = ''): PermissionRuleList {
  const buckets = new Map<string, PermissionPanelRule>();
  if (PERMISSION_RULE_TABS.includes(tab as PermissionRuleTabId)) {
    for (const rule of rules) buckets.set(permissionRuleKey(rule), rule);
  }
  const options: PermissionRuleRow[] = [];
  if (!TABS_WITHOUT_ADD_ROW.has(tab) && !query) {
    options.push({ label: PERMISSION_ADD_RULE_LABEL, value: PERMISSION_ADD_RULE_VALUE });
  }
  const sorted = [...buckets.keys()].sort((left, right) => {
    const a = buckets.get(left), b = buckets.get(right);
    if (a && b) return permissionRuleText(a.ruleValue).toLowerCase()
      .localeCompare(permissionRuleText(b.ruleValue).toLowerCase());
    return 0;
  });
  const needle = query.toLowerCase();
  const listed: { key: string; rule: PermissionPanelRule }[] = [];
  for (const key of sorted) {
    const rule = buckets.get(key);
    if (!rule) continue;
    const text = permissionRuleText(rule.ruleValue);
    if (query && !text.toLowerCase().includes(needle)) continue;
    listed.push({ key, rule });
  }
  const labels = permissionRuleLabels(listed.map(entry => entry.rule.ruleValue));
  for (const [index, entry] of listed.entries()) options.push({ label: labels[index]!, value: entry.key });
  return { options, rulesByKey: buckets };
}

/** Source `Fr` at 24223 with `ld`/`id`/`Zi`: the allow rules another rule already blocks. */
export interface PermissionShadowWarning {
  readonly rule: PermissionPanelRule;
  readonly reason: string;
  readonly shadowedBy: PermissionPanelRule;
  readonly shadowType: 'deny' | 'ask';
  readonly fix: string;
}

/** Source `sd` at 23270: the sources that still shadow a Bash ask rule under sandbox auto-allow. */
function sandboxKeepsShadow(source: string): boolean {
  return source === 'projectSettings' || source === 'policySettings' || source === 'command';
}

/** Source `ld` at 23975: a content-less deny rule for the same tool blocks the rule outright. */
function denyShadows(rule: PermissionPanelRule,
  denyRules: readonly PermissionPanelRule[]): PermissionPanelRule | undefined {
  if (rule.ruleValue.ruleContent === undefined) return undefined;
  return denyRules.find(candidate => candidate.ruleValue.toolName === rule.ruleValue.toolName
    && candidate.ruleValue.ruleContent === undefined);
}

/** Source `id` at 23651: a content-less ask rule for the same tool shadows it first. */
function askShadows(rule: PermissionPanelRule, askRules: readonly PermissionPanelRule[],
  sandboxAutoAllowEnabled: boolean): PermissionPanelRule | undefined {
  if (rule.ruleValue.ruleContent === undefined) return undefined;
  const found = askRules.find(candidate => candidate.ruleValue.toolName === rule.ruleValue.toolName
    && candidate.ruleValue.ruleContent === undefined);
  if (!found) return undefined;
  if (rule.ruleValue.toolName === BASH_RULE_TOOL && sandboxAutoAllowEnabled && !sandboxKeepsShadow(found.source)) {
    return undefined;
  }
  return found;
}

/** Source `Zi` at 23380: how to get out of the shadow. */
function shadowFix(behavior: 'deny' | 'ask', shadowedBy: PermissionPanelRule,
  rule: PermissionPanelRule): string {
  const from = permissionSourceName(shadowedBy.source);
  const to = permissionSourceName(rule.source);
  const tool = shadowedBy.ruleValue.toolName;
  return behavior === 'deny'
    ? `Remove the "${tool}" deny rule from ${from}, or remove the specific allow rule from ${to}`
    : `Remove the "${tool}" ask rule from ${from}, or remove the specific allow rule from ${to}`;
}

/**
 * Source `Fr` at 24223: the deny check runs first and wins, so a rule blocked by a deny rule never
 * also reports its ask shadow.
 */
export function permissionShadowWarnings(allowRules: readonly PermissionPanelRule[],
  askRules: readonly PermissionPanelRule[], denyRules: readonly PermissionPanelRule[],
  options: { sandboxAutoAllowEnabled?: boolean } = {}): PermissionShadowWarning[] {
  const sandbox = options.sandboxAutoAllowEnabled === true;
  const warnings: PermissionShadowWarning[] = [];
  for (const rule of allowRules) {
    const blocked = denyShadows(rule, denyRules);
    if (blocked) {
      warnings.push({ rule, shadowedBy: blocked, shadowType: 'deny',
        reason: `Blocked by "${blocked.ruleValue.toolName}" deny rule (from ${permissionSourceName(blocked.source)})`,
        fix: shadowFix('deny', blocked, rule) });
      continue;
    }
    const shadowed = askShadows(rule, askRules, sandbox);
    if (shadowed) {
      warnings.push({ rule, shadowedBy: shadowed, shadowType: 'ask',
        reason: `Shadowed by "${shadowed.ruleValue.toolName}" ask rule (from ${permissionSourceName(shadowed.source)})`,
        fix: shadowFix('ask', shadowed, rule) });
    }
  }
  return warnings;
}

/** Source `di` at 88400: the warning block one added rule earns, exactly as the recovered prints it. */
export function permissionShadowWarningLines(warning: PermissionShadowWarning): string[] {
  const state = warning.shadowType === 'deny' ? 'blocked' : 'shadowed';
  return [`${te.warning} Warning: ${permissionRuleText(warning.rule.ruleValue)} is ${state}`,
    `  ${warning.reason}`,
    `  Fix: ${warning.fix}`];
}

/* ------------------------------------------------------------------ requests */

/** The report the panel's add and delete arms print. Source `di` at 87900 and 88360. */
export function permissionAddedReport(behavior: PermissionBehavior, rule: PermissionRuleValue): string {
  return `Added ${behavior} rule ${permissionRuleText(rule)}`;
}

export function permissionDeletedReport(behavior: PermissionBehavior, rule: PermissionRuleValue): string {
  return `Deleted ${behavior} rule ${permissionRuleText(rule)}`;
}

export function permissionDeleteFailedReport(rule: PermissionRuleValue): string {
  return `Could not delete ${permissionRuleText(rule)} — the rule is unchanged`;
}

/** The tabs this build offers as rows, in the recovered `br` order. `automode` follows. */
export const PERMISSION_OFFERED_TABS = ['recent', 'allow', 'ask', 'deny', 'workspace'] as const;

/** The tab strip the panel draws above the body, the current tab bracketed. */
export function permissionTabRow(active: PermissionTabId,
  tabs: readonly PermissionTabId[] = PERMISSION_OFFERED_TABS): string {
  return tabs.map(id => (id === active ? `[${permissionTabTitle(id)}]` : ` ${permissionTabTitle(id)} `)).join('');
}

/** The recovered footer's non-header, non-search arm, minus the `←/→` clause this host cannot honour. */
export const PERMISSION_GUIDE = '↑/↓ to navigate · Enter to select · Esc to cancel';
const PERMISSION_GUIDE_BACK = 'Esc to go back';

export interface PermissionPanelInput {
  readonly rules: readonly PermissionPanelRule[];
  readonly paths?: PermissionFilePaths;
  readonly userSettingsFile?: string;
  /** The session's additional working directories, in insertion order (`wn` reads the map's keys). */
  readonly directories?: readonly string[];
  /** Source `Ac`: `originalCwd`, drawn above the workspace list. */
  readonly originalCwd?: string;
  /** Source `Wr`'s `denials` prop: the auto-mode classifier's recent refusals, newest first. */
  readonly denials?: readonly AutoModeDenial[];
}

/** The `recent` tab's two marks, held by the panel host (`di`'s `approved`/`retry` state). */
export interface DenialMarks {
  readonly approved: ReadonlySet<number>;
  readonly retry: ReadonlySet<number>;
}

/**
 * The `/permissions` Workspace tab. Recovered from `chunk-fxx7hh8y.js` sha256
 * `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`: the tab body `wn` at 33390,
 * the remove confirm `xn` at 32367, the add surface `TXe` in `chunk-k65ya3x7.js` (sha256
 * `ba76569c9bb35d13cdab5907534863174c7e0ba60fe3d0ac3cea099edf22e171`, body at 3186) with its
 * header `O` at 1720 and the input `Y` at 2140, and the add apply at 86500. Offsets are zero-based
 * UTF-16 code units.
 */
export const PERMISSIONS_WORKSPACE_DISMISSED = 'Workspace dialog dismissed';
export const PERMISSION_WORKSPACE_INTRO =
  'Claude Code can read files in the workspace, and make edits when auto-accept edits is on.';
export const PERMISSION_WORKSPACE_ORIGINAL = '(Original working directory)';
export const PERMISSION_WORKSPACE_ADD_SCOPE =
  'Claude Code will be able to read files in this directory and make edits when auto-accept edits is on.';
export const PERMISSION_ADD_DIRECTORY_LABEL = `Add directory${te.ellipsis}`;
export const PERMISSION_ADD_DIRECTORY_VALUE = 'add-directory';
export const PERMISSION_ADD_DIRECTORY_TITLE = 'Add directory to workspace';
export const PERMISSION_ADD_DIRECTORY_PROMPT = 'Enter the path to the directory:';
export const PERMISSION_REMOVE_DIRECTORY_TITLE = 'Remove directory from workspace?';
export const PERMISSION_REMOVE_DIRECTORY_NOTE =
  'Claude Code will no longer have access to files in this directory.';
/** Source `visibleOptionCount: Math.min(10, rows.length)`. */
export const PERMISSION_WORKSPACE_VISIBLE_ROWS = 10;

/**
 * Source `Fn` (`chunk-2bcyxj9q.js` 166973): the text a path is drawn with. Control, format and
 * unassigned code points become U+FFFD. The recovered's leading coercion arm is unreachable here
 * because the parameter is already a string.
 */
const DISPLAY_REPLACED = /[\u0000-\u001f\u007f-\u009f\u061c\u2028\u2029\u202a-\u202e\u2066-\u2069\p{Co}\p{Cn}]/gu;
export function workspaceDisplayText(value: string): string {
  return value.replace(DISPLAY_REPLACED, '\uFFFD').normalize('NFC');
}

export interface WorkspaceRow { readonly label: string; readonly value: string }

/**
 * Source `wn`'s list: the directories in insertion order under `nB`'s deduped labels, then the add
 * row last. The original directory is not a row — it is drawn above the list.
 */
export function workspaceDirectoryRows(directories: readonly string[]): WorkspaceRow[] {
  const labels = permissionDisplayLabels(directories, workspaceDisplayText);
  return [...directories.map((directory, index) => ({ label: labels[index]!, value: directory })),
    { label: PERMISSION_ADD_DIRECTORY_LABEL, value: PERMISSION_ADD_DIRECTORY_VALUE }];
}

/** Source `wn` + the shell's intro: the tab's read-only lines. */
export function workspaceTabLines(input: PermissionPanelInput): string[] {
  const lines = [PERMISSION_WORKSPACE_INTRO, ''];
  if (input.originalCwd !== undefined) {
    lines.push(`-  ${workspaceDisplayText(input.originalCwd)} ${PERMISSION_WORKSPACE_ORIGINAL}`);
  }
  for (const row of workspaceDirectoryRows(input.directories ?? [])) {
    if (row.value === PERMISSION_ADD_DIRECTORY_VALUE) continue;
    lines.push(`  ${row.label}`);
  }
  return lines;
}

export function workspaceAddedReport(directory: string, remembered: boolean): string {
  return `Added directory ${workspaceDisplayText(directory)} to workspace`
    + `${remembered ? ' and saved to local settings' : ' for this session'}`;
}

export function workspaceRemovedReport(directory: string): string {
  return `Removed directory ${workspaceDisplayText(directory)} from workspace`;
}

/** Source `TXe`'s input arm: the header line, the prompt, and the validation error when there is one. */
export function workspaceAddRequest(error?: string): TerminalPromptRequest {
  const lines = [PERMISSION_WORKSPACE_ADD_SCOPE, '', PERMISSION_ADD_DIRECTORY_PROMPT];
  if (error !== undefined) lines.push('', error);
  lines.push('', 'Esc to cancel');
  return { title: PERMISSION_ADD_DIRECTORY_TITLE, message: lines.join('\n'), allowText: true };
}

/** Source `xn`: the confirm that precedes a removal, focused on No. */
export function workspaceRemoveRequest(directory: string): TerminalPromptRequest {
  return {
    title: PERMISSION_REMOVE_DIRECTORY_TITLE,
    message: [workspaceDisplayText(directory), '', PERMISSION_REMOVE_DIRECTORY_NOTE].join('\n'),
    choices: [{ label: 'Yes', value: 'confirm' }, { label: 'No', value: 'cancel' }],
    defaultIndex: 1,
  };
}

/**
 * The `/permissions` `recent` tab. Recovered from `chunk-fxx7hh8y.js` sha256
 * `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`: the empty state `Rn` at 29218,
 * its list `Wr` at 29950 with the status icon `ut` (`chunk-hyx1j919.js` 275), the tab guide at
 * 61300 and the `Esc` apply `bu` at 76102. The store behind it is `src/permission-denials.ts`.
 * Offsets are zero-based UTF-16 code units.
 */
export const PERMISSION_RECENT_HEADER = 'Commands recently denied by the auto mode classifier.';
export const PERMISSION_RECENT_EMPTY =
  'No recent denials. Commands denied by the auto mode classifier will appear here.';
/** Source `visibleOptionCount: Math.min(10, rows.length)`. */
export const PERMISSION_RECENT_VISIBLE_ROWS = 10;
/** Source `Wr`'s `r` binding, which toggles the focused row's retry mark. */
export const PERMISSION_RECENT_RETRY_KEY = 'r';
/** Source `Wr`'s row prefix: `ut` with `status: approved ? "success" : "error"` and `withSpace`. */
export const PERMISSION_RECENT_APPROVED_MARK = `${te.tick} `;
export const PERMISSION_RECENT_DENIED_MARK = `${te.cross} `;
/** Source `Wr`'s `De`, drawn dim after the label. */
export const PERMISSION_RECENT_RETRY_SUFFIX = ' (retry)';
/** Source `di`'s guide for the `recent` tab, in the wide-terminal arm. */
export const PERMISSION_RECENT_GUIDE = 'Enter to approve · r to retry · ↑/↓ to navigate · Esc to cancel';

export interface DenialRow { readonly label: string; readonly value: string; readonly description?: string }

/**
 * Source `Wr`'s rows: the status mark, the label under `OJt`'s dedup, the dim ` (retry)` when the
 * row carries the retry mark, the collapsed reason as the description, and the row's index as its
 * value. `OJt`'s unit budget is `Kb` = 200000 (`chunk-qq2mgstr.js` 8897), above any label, so no
 * row is withheld and the recovered `withheld` marker has no reachable case here.
 */
export function denialRows(denials: readonly AutoModeDenial[], approved: ReadonlySet<number>,
  retry: ReadonlySet<number>): DenialRow[] {
  const labels = permissionDisplayLabels(denials.map(denial => denial.display), text => text);
  return denials.map((denial, index) => {
    const description = denialReasonText(denial.reason);
    return {
      label: `${approved.has(index) ? PERMISSION_RECENT_APPROVED_MARK : PERMISSION_RECENT_DENIED_MARK}`
        + `${labels[index]}${retry.has(index) ? PERMISSION_RECENT_RETRY_SUFFIX : ''}`,
      value: String(index),
      ...(description === undefined ? {} : { description }),
    };
  });
}

/** Source `bu`'s approved arm. The recovered bolds each label through `zh`; these rows are plain. */
export function denialsApprovedReport(labels: readonly string[]): string {
  return `Approved ${labels.join(', ')}`;
}

/** Source `bu`'s two `metaMessages` arms, one wording for one command and one for several. */
export function denialsGrantReport(labels: readonly string[]): string {
  return `Permission granted for: ${labels.join(', ')}. You may now retry `
    + `${labels.length === 1 ? 'this command' : 'these commands'} if you would like.`;
}

/**
 * Source `sS`/`Na` in the shell: the panel body. The recovered docks the tab strip in the frame and
 * switches it with left and right; this host's dialog has one selection axis, so the tabs are rows
 * at the head of the list, the way `/help` carries its three tabs.
 */
export function permissionsPanelRequest(input: PermissionPanelInput, tab: PermissionTabId = 'allow',
  marks: DenialMarks = { approved: new Set(), retry: new Set() }): TerminalPromptRequest {
  const lines = [permissionTabRow(tab), ''];
  const choices: { label: string; value: string; description?: string }[] =
    PERMISSION_OFFERED_TABS.map(id => ({ label: permissionTabTitle(id), value: `tab:${id}` }));
  if (tab === 'recent') {
    const denials = input.denials ?? [];
    lines.push(PERMISSION_RECENT_HEADER, '');
    if (denials.length === 0) {
      lines.push(PERMISSION_RECENT_EMPTY, '', PERMISSION_GUIDE);
    } else {
      const rows = denialRows(denials, marks.approved, marks.retry);
      for (const row of rows) lines.push(`  ${row.label}`);
      lines.push('', PERMISSION_RECENT_GUIDE);
      choices.push(...rows.map(row => ({ label: row.label, value: row.value,
        ...(row.description === undefined ? {} : { description: row.description }) })));
    }
  } else if (tab === 'workspace') {
    lines.push(...workspaceTabLines(input), '', PERMISSION_GUIDE);
    choices.push(...workspaceDirectoryRows(input.directories ?? []));
  } else {
    const ruleTab = tab as PermissionRuleTabId;
    const rules = input.rules.filter(rule => rule.ruleBehavior === ruleTab);
    const list = permissionRuleRows(rules, ruleTab);
    lines.push(permissionTabIntro(ruleTab), '');
    if (rules.length === 0) lines.push(permissionSectionEmpty(ruleTab));
    else for (const option of list.options) {
      if (option.value === PERMISSION_ADD_RULE_VALUE) continue;
      lines.push(`  ${option.label}`);
    }
    lines.push('', PERMISSION_GUIDE);
    choices.push(...list.options.map(option => ({ label: option.label, value: option.value })));
  }
  return { title: PERMISSIONS_TITLE, message: lines.join('\n'), choices,
    // Source `Wr`'s `r` binding: it resolves the dialog with the focused row's index in `selected`.
    ...(tab === 'recent' && (input.denials ?? []).length > 0
      ? { keys: [{ key: PERMISSION_RECENT_RETRY_KEY, label: `r to retry` }] } : {}),
    defaultIndex: Math.max(0, PERMISSION_OFFERED_TABS.indexOf(tab as typeof PERMISSION_OFFERED_TABS[number])) };
}

/** Source `pn` at 27432: the rule input, with its own example line and its submit guide. */
export function permissionAddRuleRequest(tab: PermissionRuleTabId,
  bashRuleText = permissionRuleText({ toolName: BASH_RULE_TOOL, ruleContent: 'ls *' })): TerminalPromptRequest {
  const example = `${permissionRuleText({ toolName: BASH_RULE_TOOL })} or ${bashRuleText}`;
  return {
    title: `Add ${tab} permission rule`,
    message: ['Permission rules are a tool name, optionally followed by a specifier in parentheses.',
      `e.g., ${example}`, '', PERMISSION_GUIDE_BACK].join('\n'),
    allowText: true,
  };
}

/** Source `mn` at 25734: the save-scope picker, one rule or many. */
export function permissionSaveRequest(tab: PermissionRuleTabId, rules: readonly PermissionRuleValue[],
  input: PermissionPanelInput = { rules: [] }): TerminalPromptRequest {
  const question = rules.length === 1 ? 'Where should this rule be saved?' : 'Where should these rules be saved?';
  const lines = [question, '', ...rules.map(rule => `  ${permissionRuleText(rule)}`), '', 'Esc to cancel'];
  return {
    title: `Add ${tab} permission ${rules.length === 1 ? 'rule' : 'rules'}`,
    message: lines.join('\n'),
    choices: permissionSaveOptions(input.paths, input.userSettingsFile)
      .map(option => ({ label: option.label, value: option.value, description: option.description })),
    defaultIndex: 0,
  };
}

/**
 * Source `ai` at 67512: the rule's own pane. A managed, flag or command rule is read-only and shows
 * the recovered sentence instead of the delete confirm; every other source asks first.
 */
export function permissionRulePaneRequest(rule: PermissionPanelRule): TerminalPromptRequest {
  const lines: string[] = [];
  const decomposition = permissionRuleDecomposition(rule.ruleValue);
  lines.push(permissionRuleText(rule.ruleValue));
  if (decomposition) lines.push(decomposition.prefix + (decomposition.emphasis === undefined ? '' : decomposition.emphasis) + (decomposition.suffix ?? ''));
  lines.push('', `From ${permissionSourceName(rule.source)}`, '');
  if (rule.source === 'policySettings') {
    lines.push('This rule is configured by managed settings and cannot be modified.',
      'Contact your system administrator for more information.', '', PERMISSION_GUIDE_BACK);
    return { title: PERMISSIONS_RULE_DETAILS_TITLE, message: lines.join('\n'),
      choices: [{ label: 'Back', value: 'back' }], defaultIndex: 0 };
  }
  if (rule.source === 'flagSettings' || rule.source === 'command') {
    const origin = rule.source === 'flagSettings' ? 'the --settings flag' : 'a slash command';
    lines.push(`This rule comes from a read-only source (${origin}) and cannot be modified here.`,
      '', PERMISSION_GUIDE_BACK);
    return { title: PERMISSIONS_RULE_DETAILS_TITLE, message: lines.join('\n'),
      choices: [{ label: 'Back', value: 'back' }], defaultIndex: 0 };
  }
  const state = rule.ruleBehavior === 'allow' ? 'allowed' : rule.ruleBehavior === 'deny' ? 'denied' : 'ask';
  lines.push(`Delete ${state} tool?`, '', 'Are you sure you want to delete this permission rule?', '',
    'enter confirm, escape cancel');
  return { title: PERMISSIONS_RULE_DETAILS_TITLE, message: lines.join('\n'),
    choices: [{ label: 'Yes', value: 'confirm' }, { label: 'No', value: 'cancel' }], defaultIndex: 1 };
}

/* -------------------------------------------------------------- navigation */

export type PermissionPanelAnswer = { selected: readonly string[]; text?: string; key?: string } | undefined;

/** One update to apply, with the report the panel prints when it lands. */
export interface PermissionPanelApplyResult { readonly error?: string }

export type PermissionPanelMode =
  | { readonly kind: 'tab'; readonly tab: PermissionTabId }
  | { readonly kind: 'add'; readonly tab: PermissionRuleTabId }
  | { readonly kind: 'save'; readonly tab: PermissionRuleTabId; readonly rules: readonly PermissionRuleValue[] }
  | { readonly kind: 'rule'; readonly tab: PermissionRuleTabId; readonly rule: PermissionPanelRule }
  | { readonly kind: 'addDirectory'; readonly error?: string }
  | { readonly kind: 'removeDirectory'; readonly path: string };

/**
 * Source `di`'s `no`/`sn`/`mu`/`Di` handlers: the panel's own navigation. Selecting a rule opens its
 * pane; the add row opens the input, whose submit opens the scope picker, whose pick applies the
 * update. The workspace tab's add row opens `TXe`'s text surface and its directory rows open `xn`'s
 * confirm. The `recent` tab's Enter toggles a row's approval mark and its `r` toggles the retry mark
 * and approves the row; `Esc` there applies the marks (`bu`) instead of dismissing. `Esc` elsewhere
 * steps back one surface and dismisses from a tab — with the workspace tab's own message (`wn`'s
 * `Workspace dialog dismissed`). The input is re-read on every surface, which is how the recovered
 * `U0(T)`/`Bc(T)`/`xm(T)` see a rule the panel just added.
 */
export async function browsePermissions(readInput: () => PermissionPanelInput,
  read: (request: TerminalPromptRequest) => Promise<PermissionPanelAnswer>,
  apply: (update: PermissionUpdate) => Promise<PermissionPanelApplyResult>,
  options: {
    /** Source `pEe()`'s `removeDenial`, which the host calls directly. */
    removeDenial?(denial: AutoModeDenial): void;
    /** Source `di`'s `onRetryDenials` prop. */
    onRetryDenials?(labels: readonly string[]): void;
  } = {}): Promise<string | undefined> {
  // Source `M`: every action appends its lines to the dialog's own list, and the dialog returns
  // that list joined when it closes (`wu`); with no lines it returns the dismissed message.
  const reports: string[] = [];
  const report = (lines: readonly string[]) => { reports.push(...lines); };
  const initialDenials = readInput().denials ?? [];
  // Source `di`: `E = initialTab ?? (denials.length > 0 ? "recent" : "allow")`.
  let tab: PermissionTabId = initialDenials.length > 0 ? 'recent' : 'allow';
  let marks: DenialMarks = { approved: new Set(), retry: new Set() };
  const finish = () => reports.length > 0 ? reports.join('\n')
    : tab === 'workspace' ? PERMISSIONS_WORKSPACE_DISMISSED : PERMISSIONS_DISMISSED;
  /** Source `bu`: the marks name rows by index into the denials list. */
  const markedLabels = (set: ReadonlySet<number>, denials: readonly AutoModeDenial[]) =>
    [...set].map(index => denials[index]?.display).filter((label): label is string => label !== undefined);
  let mode: PermissionPanelMode = { kind: 'tab', tab };
  for (;;) {
    const input = readInput();
    const request = mode.kind === 'tab' ? permissionsPanelRequest(input, mode.tab, marks)
      : mode.kind === 'add' ? permissionAddRuleRequest(mode.tab)
        : mode.kind === 'save' ? permissionSaveRequest(mode.tab, mode.rules, input)
          : mode.kind === 'rule' ? permissionRulePaneRequest(mode.rule)
            : mode.kind === 'addDirectory' ? workspaceAddRequest(mode.error)
              : workspaceRemoveRequest(mode.path);
    const answer = await read(request);
    if (answer === undefined) {
      if (mode.kind !== 'tab') { mode = { kind: 'tab', tab }; continue; }
      if (mode.tab !== 'recent') return finish();
      // Source `bu`: Esc on the `recent` tab applies the marks. A retry mark hands the labels to the
      // host, which appends the grant and starts the turn; the approved marks are removed from the
      // store and reported. Only when neither mark is set does the plain dismissal survive.
      const denials = input.denials ?? [];
      const retryLabels = markedLabels(marks.retry, denials);
      if (retryLabels.length > 0) {
        options.onRetryDenials?.(retryLabels);
        return denialsGrantReport(retryLabels);
      }
      const approvedLabels = markedLabels(marks.approved, denials);
      if (approvedLabels.length === 0 && reports.length === 0) return PERMISSIONS_DISMISSED;
      for (const index of marks.approved) {
        const denial = denials[index];
        if (denial !== undefined) options.removeDenial?.(denial);
      }
      if (approvedLabels.length > 0) {
        // Source `bu`: `[...uy, ...B]` — the approved line leads, then the panel's own reports.
        reports.unshift(denialsApprovedReport(approvedLabels));
        reports.push(denialsGrantReport(approvedLabels));
      }
      return reports.join('\n');
    }
    const value = answer.selected[0] ?? '';
    if (mode.kind === 'tab') {
      const picked = PERMISSION_OFFERED_TABS.find(entry => value === `tab:${entry}`);
      if (picked !== undefined) {
        // Source `Rn`: the marks are cleared whenever the denials list empties.
        marks = { approved: new Set(), retry: new Set() };
        tab = picked; mode = { kind: 'tab', tab: picked }; continue;
      }
      if (mode.tab === 'recent') {
        const index = Number(value);
        if (!Number.isInteger(index) || (input.denials ?? [])[index] === undefined) return finish();
        if (answer.key === PERMISSION_RECENT_RETRY_KEY) {
          // Source `Wr`'s `Ge`: `r` toggles the retry mark and adds the row to the approved set.
          const retry = new Set(marks.retry);
          if (retry.has(index)) retry.delete(index); else retry.add(index);
          marks = { approved: new Set(marks.approved).add(index), retry };
        } else {
          const approved = new Set(marks.approved);
          if (approved.has(index)) approved.delete(index); else approved.add(index);
          marks = { approved, retry: marks.retry };
        }
        continue;
      }
      if (mode.tab === 'workspace') {
        if (value === PERMISSION_ADD_DIRECTORY_VALUE) { mode = { kind: 'addDirectory' }; continue; }
        if (input.directories?.includes(value) === true) { mode = { kind: 'removeDirectory', path: value }; continue; }
        return finish();
      }
      if (value === PERMISSION_ADD_RULE_VALUE) {
        mode = { kind: 'add', tab: mode.tab as PermissionRuleTabId };
        continue;
      }
      const ruleTab = mode.tab as PermissionRuleTabId;
      const chosen: PermissionPanelRule | undefined = input.rules
        .find(rule => rule.ruleBehavior === ruleTab && permissionRuleKey(rule) === value);
      if (chosen === undefined) return finish();
      mode = { kind: 'rule', tab: ruleTab, rule: chosen };
      continue;
    }
    if (mode.kind === 'addDirectory') {
      const text = (answer.text ?? '').trim();
      if (text.length === 0) { mode = { kind: 'tab', tab }; continue; }
      const result = validateAddDirectory({ directoryPath: text,
        workingDirectories: input.directories ?? [], cwd: input.originalCwd ?? process.cwd() });
      if (result.kind !== 'success') {
        // Source `TXe`: a rejected path keeps the input surface open with `hge`'s line under it.
        mode = { kind: 'addDirectory', error: addDirectoryMessage(result) };
        continue;
      }
      // Source's add handler: the session-scope apply's own outcome is discarded, as `/add-dir` does.
      await apply({ type: 'addDirectories', directories: [result.absolutePath], destination: 'session' });
      report([workspaceAddedReport(result.absolutePath, false)]);
      mode = { kind: 'tab', tab };
      continue;
    }
    if (mode.kind === 'removeDirectory') {
      if (value !== 'confirm') { mode = { kind: 'tab', tab }; continue; }
      await apply({ type: 'removeDirectories', directories: [mode.path], destination: 'session' });
      report([workspaceRemovedReport(mode.path)]);
      mode = { kind: 'tab', tab };
      continue;
    }
    if (mode.kind === 'add') {
      const text = (answer.text ?? '').trim();
      if (text.length === 0) { mode = { kind: 'tab', tab: mode.tab }; continue; }
      mode = { kind: 'save', tab: mode.tab, rules: [parsePermissionRule(text)] };
      continue;
    }
    if (mode.kind === 'save') {
      const destination = PERMISSION_SAVE_DESTINATIONS.find(entry => entry === value);
      if (destination === undefined) { mode = { kind: 'tab', tab: mode.tab }; continue; }
      const behavior = mode.tab;
      const result = await apply({ type: 'addRules', rules: [...mode.rules], behavior, destination });
      if (result.error === undefined) {
        report(mode.rules.map(rule => permissionAddedReport(behavior, rule)));
        const warnings = permissionShadowWarnings(
          behavior === 'allow' ? mode.rules.map(ruleValue => ({ ruleValue, ruleBehavior: 'allow' as const, source: destination })) : [],
          input.rules.filter(rule => rule.ruleBehavior === 'ask'),
          input.rules.filter(rule => rule.ruleBehavior === 'deny'));
        report(warnings.flatMap(permissionShadowWarningLines));
      }
      mode = { kind: 'tab', tab: mode.tab };
      continue;
    }
    if (value !== 'confirm') { mode = { kind: 'tab', tab: mode.tab }; continue; }
    const result = await apply({ type: 'removeRules', rules: [mode.rule.ruleValue],
      behavior: mode.rule.ruleBehavior, destination: saveDestinationFor(mode.rule.source) });
    report([result.error === undefined ? permissionDeletedReport(mode.rule.ruleBehavior, mode.rule.ruleValue)
      : permissionDeleteFailedReport(mode.rule.ruleValue)]);
    mode = { kind: 'tab', tab: mode.tab };
  }
}

/** Source `kor`'s switch: only the three file layers and the two live scopes can be written. */
function saveDestinationFor(source: string): PermissionUpdate['destination'] {
  return PERMISSION_SAVE_DESTINATIONS.includes(source as PermissionSaveDestination)
    ? source as PermissionSaveDestination : 'session';
}
