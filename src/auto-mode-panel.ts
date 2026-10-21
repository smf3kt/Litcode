/**
 * The `/permissions` `automode` tab: the auto-mode classifier's own rule sections. Recovered from
 * `chunk-fxx7hh8y.js`, sha256 `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78`:
 * the tab body `Bn` at 44266 with its intro at 48286 and its row dispatch at 48450, the entry reader
 * `ve` at 35310, the builtins state `me` at 36535, the section table `Ke` at 35249, the section
 * titles `ie` at 42811, the source labels `Te` at 42889 and the source tags `En` at 42850, the entry
 * column `Vm` at 42306, the builtins row `$t` at 47106, the environment document row `hi` at 46500,
 * the builtins card `Hn` at 56850, the entry card `Nn` at 52375 and the entry display `Le` at 51291.
 * Cross-chunk: the splice sentinel `xu` (`chunk-7ah5c51p.js` 2452), the layer order `aUe`
 * (`chunk-x0dc37w9.js`), the built-in rule reader `Rue` (`chunk-sfn1dbxq.js` 1065708) and the
 * always-true internal-template gate `rne` (same chunk), the display text `Ci`/`Bi`
 * (`chunk-qq2mgstr.js` 15827/12567). Offsets are zero-based UTF-16 code units.
 *
 * This package ports the tab's list and both read-only detail cards. The add, edit, delete and
 * environment-editor arms (`Jr` 40570, `ts` 40909, `os` 41045, `Xr` 36731, `qr` 35450, `Ho` 36630)
 * write `permissions.autoMode.<section>` through a settings-document writer this build does not
 * carry yet; they are W230.
 */

import { AUTO_RULES } from './auto-classifier-rules-source.js';
import type { PermissionLayer } from './permissions.js';
import type { TerminalPromptRequest } from './terminal.js';
import { denialDisplayText } from './permission-denials.js';
import { PERMISSIONS_RULE_DETAILS_TITLE } from './permissions-panel.js';

/** Source `Ke` at 35249, in its declared order. */
export const AUTO_MODE_SECTIONS = ['allow', 'soft_deny', 'hard_deny', 'environment'] as const;
export type AutoModeSection = typeof AUTO_MODE_SECTIONS[number];

/** Source `aUe` at `chunk-x0dc37w9.js`: the layers whose `autoMode` blocks the tab reads. */
export const AUTO_MODE_LAYER_SOURCES = ['userSettings', 'flagSettings', 'policySettings'] as const;
export type AutoModeLayerSource = typeof AUTO_MODE_LAYER_SOURCES[number];

/** Source `xu` at `chunk-7ah5c51p.js` 2452: the sentinel that splices the built-in rules in. */
export const AUTO_MODE_SPLICE_SENTINEL = '$defaults';
/** Source `Re` at 42930: the section-title column width. */
export const AUTO_MODE_SECTION_COLUMN = 20;
/** Source `Ml` at 43840: the environment document's own line budget in its row. */
export const AUTO_MODE_DOCUMENT_ROWS = 5;
/** Source `Jm` at 56846: the built-in rule text budget of the card. */
export const AUTO_MODE_BUILTIN_LIMIT = 3200;
/** Source the list's `visibleOptionCount: Math.min(10, rows.length)`. */
export const AUTO_MODE_VISIBLE_ROWS = 10;
/** Source `Bn`'s intro line at 48286. */
export const AUTO_MODE_INTRO =
  'Extra rules for the auto mode classifier. Rules are plain sentences; new rules are saved to your user settings.';
/** Source `Bn`'s `environment-document` row value. */
export const AUTO_MODE_DOCUMENT_VALUE = 'environment-document';
/** Source `$t`/`Hn`: the builtins row's own title. */
export const AUTO_MODE_BUILTINS_TITLE = 'Built-in rules';

/** Source `ie` at 42811. */
export function autoModeSectionTitle(section: AutoModeSection): string {
  switch (section) {
    case 'allow': return 'Soft allow';
    case 'soft_deny': return 'Soft deny';
    case 'hard_deny': return 'Hard deny';
    case 'environment': return 'Environment';
  }
}

/** Source `Te` at 42889. */
export function autoModeSourceLabel(source: string): string {
  switch (source) {
    case 'userSettings': return 'user settings';
    case 'flagSettings': return 'the --settings flag';
    default: return 'managed settings';
  }
}

/** Source `En` at 42850: the short tag a non-default source adds to an entry's row. */
export function autoModeSourceTag(source: string): string | undefined {
  switch (source) {
    case 'userSettings': return undefined;
    case 'flagSettings': return 'flag';
    default: return 'org';
  }
}

/** Source `Rue` at `chunk-sfn1dbxq.js` 1065708 over the `SL()` slot names. */
const AUTO_MODE_SLOT_TAGS: Record<AutoModeSection, string> = {
  allow: 'user_allow_rules_to_replace',
  soft_deny: 'user_soft_deny_rules_to_replace',
  hard_deny: 'user_hard_deny_rules_to_replace',
  environment: 'user_environment_to_replace',
};

/**
 * Source `SL()`: the built-in rules a section starts from, read out of the classifier's own rules
 * document. `Rue` takes each `- ` bullet of the slot and folds its continuation lines into it.
 */
export function autoModeBuiltinRules(section: AutoModeSection): string[] {
  const tag = AUTO_MODE_SLOT_TAGS[section];
  const found = AUTO_RULES.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (found === null) return [];
  const rules: string[] = [];
  for (const raw of (found[1] ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '').trimEnd();
    if (line.startsWith('- ')) rules.push(line.slice(2));
    else if (rules.length > 0 && line.trim().length > 0) rules[rules.length - 1] += `\n${line}`;
  }
  return rules;
}

/** Source `hs` at 42677: the built-in rule count each section's row prints. */
export function autoModeBuiltinCounts(): Record<AutoModeSection, number> {
  return Object.fromEntries(AUTO_MODE_SECTIONS.map(section =>
    [section, autoModeBuiltinRules(section).length])) as Record<AutoModeSection, number>;
}

/** One classifier rule as the tab lists it (source `ve`). */
export interface AutoModeEntry {
  readonly text: string;
  readonly section: AutoModeSection;
  readonly source: AutoModeLayerSource;
  /** Position inside the section's array in that layer. */
  readonly index: number;
  /** An `### ` line of the environment document: structure, not an entry. */
  readonly structure?: true;
}

/** Source `ve` at 35310: every section entry the classifier's layers declare, in layer order. */
export function autoModeEntries(layers: readonly PermissionLayer[]): AutoModeEntry[] {
  const entries: AutoModeEntry[] = [];
  for (const source of AUTO_MODE_LAYER_SOURCES) {
    for (const layer of layers.filter(candidate => candidate.source === source)) {
      for (const section of AUTO_MODE_SECTIONS) {
        const values = layer.autoMode?.[section];
        if (!values) continue;
        values.forEach((text, index) => {
          if (text === AUTO_MODE_SPLICE_SENTINEL) return;
          if (section === 'environment' && text.startsWith('### ')) {
            entries.push({ text, section, source, index, structure: true });
            return;
          }
          entries.push({ text, section, source, index });
        });
      }
    }
  }
  return entries;
}

/** Source `me`'s state per section: whether the built-in block is in effect and who owns it. */
export type AutoModeBuiltinControl = 'empty' | 'user' | 'otherSource';
export interface AutoModeBuiltin {
  readonly enabled: boolean;
  readonly control: AutoModeBuiltinControl;
  readonly source?: AutoModeLayerSource;
}

/**
 * Source `me` at 36535, minus its `rne()` gate: that gate is the constant `{value: true}`, so the
 * recovered build always takes this settings path and a section with no values is its empty state.
 */
export function autoModeBuiltins(layers: readonly PermissionLayer[]): Record<AutoModeSection, AutoModeBuiltin> {
  const byLayer = new Map<AutoModeLayerSource, Partial<Record<AutoModeSection, readonly string[]>>>();
  for (const source of AUTO_MODE_LAYER_SOURCES) {
    const values: Partial<Record<AutoModeSection, readonly string[]>> = {};
    for (const layer of layers.filter(candidate => candidate.source === source)) {
      for (const section of AUTO_MODE_SECTIONS) {
        const declared = layer.autoMode?.[section];
        if (declared?.length) values[section] = [...(values[section] ?? []), ...declared];
      }
    }
    byLayer.set(source, values);
  }
  const result = {} as Record<AutoModeSection, AutoModeBuiltin>;
  for (const section of AUTO_MODE_SECTIONS) {
    const owners = AUTO_MODE_LAYER_SOURCES
      .map(source => ({ source, values: byLayer.get(source)?.[section] ?? [] }))
      .filter(owner => owner.values.length > 0);
    if (owners.length === 0) { result[section] = { enabled: true, control: 'empty' }; continue; }
    if (section === 'environment') {
      const spliced = owners.find(owner => owner.values.includes(AUTO_MODE_SPLICE_SENTINEL));
      result[section] = spliced === undefined
        ? { enabled: false, control: 'otherSource', source: owners[0]!.source }
        : { enabled: true, control: 'otherSource', source: spliced.source };
      continue;
    }
    const foreign = owners.find(owner => owner.source !== 'userSettings'
      && owner.values.includes(AUTO_MODE_SPLICE_SENTINEL));
    if (foreign !== undefined) {
      result[section] = { enabled: true, control: 'otherSource', source: foreign.source };
      continue;
    }
    const user = byLayer.get('userSettings')?.[section] ?? [];
    if (user.length > 0) {
      result[section] = { enabled: user.includes(AUTO_MODE_SPLICE_SENTINEL), control: 'user' };
      continue;
    }
    result[section] = { enabled: false, control: 'otherSource', source: owners[0]!.source };
  }
  return result;
}

/**
 * Source `tn` at 46500: whether a section draws its builtins row. Its `environment` arm tests the
 * internal-template state, which `rne()` makes unreachable here, so the environment section never
 * draws one — it draws its document row instead.
 */
export function autoModeShowsBuiltin(section: AutoModeSection, builtin: AutoModeBuiltin): boolean {
  if (section === 'environment') return false;
  return !(builtin.control === 'otherSource' && !builtin.enabled);
}

/** Source `$t` at 47106: the builtins row's one line. */
export function autoModeBuiltinRow(section: AutoModeSection, builtin: AutoModeBuiltin, count: number): string {
  const source = builtin.control === 'user' || builtin.control === 'empty' || builtin.source === undefined
    ? '' : ` · from ${autoModeSourceLabel(builtin.source)}`;
  return `${autoModeSectionTitle(section).padEnd(AUTO_MODE_SECTION_COLUMN)}`
    + `${builtin.enabled ? '[x]' : '[ ]'} ${AUTO_MODE_BUILTINS_TITLE}`
    + ` · ${count}${builtin.enabled ? '' : ' · off'}${source}`;
}

/**
 * Source `Vm` at 42306: the section-title column, the source tag when the entry is not the user's
 * own, then the entry text. A structure line is drawn dim in the source; this host's rows have one
 * style, so it is plain text here.
 */
export function autoModeEntryRow(entry: AutoModeEntry): string {
  const title = autoModeSectionTitle(entry.section);
  const tag = autoModeSourceTag(entry.source);
  const column = tag === undefined ? title.padEnd(AUTO_MODE_SECTION_COLUMN)
    : `${title}${` · ${tag}`.padEnd(AUTO_MODE_SECTION_COLUMN - title.length)}`;
  return `${column}${denialDisplayText(entry.text)}`;
}

/** Source `gt` at 43457: the entry's row value. The `legacy` marker has no local counterpart. */
export function autoModeEntryValue(entry: AutoModeEntry): string {
  return `${entry.section}:${entry.source}:${entry.index}`;
}

/** Source `D`'s ordered dedup, which `hi` applies to the environment entries' sources. */
function orderedUnique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Source `hi`'s note at 46500: what the environment row says about the document it stands for. The
 * recovered ends it with `enter to edit`, which is W230's editor; this host ends it with
 * `enter to view` until that writer lands.
 */
export function autoModeDocumentNote(entries: readonly AutoModeEntry[], builtin: AutoModeBuiltin): string {
  const environment = entries.filter(entry => entry.section === 'environment');
  if (environment.length === 0) {
    return `Built-in default document${builtin.control === 'otherSource'
      ? ` · kept by ${autoModeSourceLabel(builtin.source ?? 'userSettings')}` : ''} · enter to view`;
  }
  const sources = orderedUnique(environment.map(entry => entry.source)).map(autoModeSourceLabel).join(' and ');
  const anyUser = environment.some(entry => entry.source === 'userSettings');
  const anyForeign = environment.some(entry => entry.source !== 'userSettings');
  const action = !anyForeign ? 'enter to view' : anyUser ? 'enter to view your entries' : 'enter to view';
  return `${builtin.enabled ? 'Extends' : 'Replaces'} the built-in default · from ${sources} · ${action}`;
}

export interface AutoModeRow { readonly label: string; readonly value: string; readonly description?: string }

/**
 * Source `Bn`'s non-search row list at 46900, minus its leading add row (W230's writer): per section
 * its builtins row when `tn` keeps it, then its entries — except the environment, which the source
 * replaces with the single document row.
 */
export function autoModeRows(entries: readonly AutoModeEntry[],
  builtins: Record<AutoModeSection, AutoModeBuiltin>): AutoModeRow[] {
  const counts = autoModeBuiltinCounts();
  const rows: AutoModeRow[] = [];
  for (const section of AUTO_MODE_SECTIONS) {
    if (section === 'environment') {
      const document = autoModeBuiltinRules('environment');
      rows.push({ label: `${autoModeSectionTitle(section).padEnd(AUTO_MODE_SECTION_COLUMN)}`
        + autoModeDocumentNote(entries, builtins[section]),
      value: AUTO_MODE_DOCUMENT_VALUE,
      ...(document.length === 0 ? {} : { description: document.join(' ') }) });
      continue;
    }
    if (autoModeShowsBuiltin(section, builtins[section])) {
      rows.push({ label: autoModeBuiltinRow(section, builtins[section], counts[section]),
        value: `builtins:${section}` });
    }
    for (const entry of entries.filter(candidate => candidate.section === section)) {
      rows.push({ label: autoModeEntryRow(entry), value: autoModeEntryValue(entry) });
    }
  }
  return rows;
}

/**
 * Source `hi`'s document at 46500 and `Nn`'s frame: the environment document the row stands for —
 * the entries the layers declare, or the built-in default when they declare none. The recovered
 * opens this as an editor; this host reads it until W230's writer lands.
 */
export function autoModeDocumentPaneRequest(entries: readonly AutoModeEntry[],
  builtin: AutoModeBuiltin): TerminalPromptRequest {
  const environment = entries.filter(entry => entry.section === 'environment');
  const lines: string[] = [autoModeDocumentNote(entries, builtin), ''];
  if (environment.length === 0) lines.push(...autoModeBuiltinRules('environment'));
  else lines.push(...environment.map(entry => denialDisplayText(entry.text)));
  return { title: 'Environment document', message: lines.join('\n'),
    choices: [{ label: 'Back', value: 'back' }], defaultIndex: 0 };
}

/** Source `An` at 43849: the cut the built-in rule text takes. */
function cutText(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 1))}${String.fromCharCode(0x2026)}`;
}

/**
 * Source `Hn` at 56850: the builtins card. Its rule list is bounded by `Jm` and its two control
 * notes explain an empty or foreign-owned section. The recovered's toggle and editor rows are
 * W230's writes, so this host shows the section and a way back.
 */
export function autoModeBuiltinsPaneRequest(section: AutoModeSection,
  builtin: AutoModeBuiltin): TerminalPromptRequest {
  const rules = autoModeBuiltinRules(section);
  const lines: string[] = [`${autoModeSectionTitle(section)} · ${rules.length} built-in `
    + `${rules.length === 1 ? 'rule' : 'rules'} · ${builtin.enabled ? 'in effect' : 'switched off'}`, ''];
  let used = 0;
  const shown: string[] = [];
  for (const rule of rules) {
    if (used + rule.length > AUTO_MODE_BUILTIN_LIMIT && shown.length > 0) break;
    shown.push(rule);
    used += rule.length;
  }
  if (shown.length === 1 && shown[0]!.length > AUTO_MODE_BUILTIN_LIMIT) {
    const extra = shown[0]!.length - AUTO_MODE_BUILTIN_LIMIT;
    shown[0] = `${cutText(shown[0]!, AUTO_MODE_BUILTIN_LIMIT)}`
      + ` +${extra} more characters — View in editor for the full text.`;
  }
  for (const rule of shown) lines.push(`- ${rule}`);
  const hidden = rules.length - shown.length;
  if (hidden > 0) {
    lines.push('', `… +${hidden} more ${hidden === 1 ? 'rule' : 'rules'}`
      + ' — run `claude auto-mode defaults` to print the full set.');
  }
  if (builtin.control === 'empty') {
    lines.push('', 'This section has no configured rules, so the built-ins apply. '
      + 'Add a rule to customize it.');
  } else if (builtin.control === 'otherSource') {
    lines.push('', builtin.enabled
      ? `Kept on by ${autoModeSourceLabel(builtin.source ?? 'policySettings')} — it cannot be switched off here.`
      : `Replaced by rules from ${autoModeSourceLabel(builtin.source ?? 'policySettings')}. `
        + 'This control follows that configuration; add your own rules to customize the section.');
  }
  return { title: AUTO_MODE_BUILTINS_TITLE, message: lines.join('\n'),
    choices: [{ label: 'Back', value: 'back' }], defaultIndex: 0 };
}

/**
 * Source `Nn` at 52375, its read-only arms. A rule whose section is the environment describes this
 * machine and project for the classifier. The recovered's Edit, Delete and toggle rows write the
 * settings file, which is W230; the legacy `autoMode.deny` arm is absent because this build's
 * `classifierSystem` passes only `allow`/`soft_deny`/`hard_deny`/`environment` to the classifier,
 * so a legacy rule would be described as enforced when it is not.
 */
export function autoModeEntryPaneRequest(entry: AutoModeEntry): TerminalPromptRequest {
  const text = denialDisplayText(entry.text);
  const lines: string[] = [text, ` ${entry.structure === true ? 'section header' : 'rule'}`
    + ` for the auto mode classifier · From ${autoModeSourceLabel(entry.source)}`, ''];
  if (entry.structure === true) {
    lines.push('A section header that organizes the environment entries below it; it renders into '
      + 'the classifier prompt as written.', ' ', entry.source === 'userSettings'
      ? 'Edit your settings file directly to restructure.'
      : `It is delivered by ${autoModeSourceLabel(entry.source)} and cannot be modified here.`);
  } else if (entry.source === 'policySettings') {
    lines.push('This rule is configured by managed settings and cannot be modified.',
      '', 'Contact your system administrator for more information.');
  } else if (entry.source === 'flagSettings') {
    lines.push('This rule comes from a read-only source (the --settings flag) and cannot be '
      + 'modified here.');
  } else if (entry.section === 'environment') {
    lines.push('Environment entries describe this machine and project for the classifier.');
  }
  return { title: PERMISSIONS_RULE_DETAILS_TITLE, message: lines.join('\n'),
    choices: [{ label: 'Back', value: 'back' }], defaultIndex: 0 };
}
