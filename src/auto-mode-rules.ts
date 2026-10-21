import fs from 'node:fs';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { queuePermissionSettingsWrite } from './permission-settings.js';
import { autoPolicySchema } from './permissions.js';

export type AutoModePolicy = z.infer<typeof autoPolicySchema>;
export const AUTO_MODE_SECTIONS = ['allow', 'soft_deny', 'hard_deny', 'environment'] as const;
export type AutoModeSection = typeof AUTO_MODE_SECTIONS[number];
export const AUTO_MODE_SPLICE_SENTINEL = '$defaults';
export const AUTO_MODE_ENTRY_LIMIT = 200;
export const AUTO_MODE_TEXT_LIMIT = 10000;

export type AutoModeUpdate =
  | { kind: 'add'; section: AutoModeSection; text: string }
  | { kind: 'update'; section: AutoModeSection; index: number; original: string; text: string }
  | { kind: 'delete'; section: AutoModeSection; index: number; original: string }
  | { kind: 'toggle'; section: AutoModeSection; enabled: boolean }
  | { kind: 'document'; section: 'environment'; expected: readonly string[]; text: string };

export class AutoModeRuleWriteError extends Error {
  constructor(readonly code: 'no_user_settings_path' | 'settings_file_invalid' | 'invalid_input' | 'entry_not_found' | 'write_failed', message: string) {
    super(message);
    this.name = 'AutoModeRuleWriteError';
  }
}

const objectSchema = z.record(z.unknown());
const variationSelectors = new RegExp('[\\uFE00-\\uFE0F\\u{E0100}-\\u{E01EF}]', 'gu');
const invisibleCharacters = new RegExp('[\\p{Cf}\\p{Default_Ignorable_Code_Point}\\u2028\\u2029\\u2800\\uFFF9-\\uFFFB\\u{1D173}-\\u{1D17A}]', 'u');
const slotNames = ['user_allow_rules_to_replace', 'user_soft_deny_rules_to_replace',
  'user_hard_deny_rules_to_replace', 'user_environment_to_replace'];

/** sz, fmjcnmvh [61347,61386); Rit/xit/Pit, 7ah5c51p [4449,4930), UTF-16. */
export function normalizeAutoModeText(text: string): string {
  return text.replace(variationSelectors, '');
}

/** oZe, fmjcnmvh [60463,61301), UTF-16. */
function entriesProblem(section: AutoModeSection, entries: readonly string[]): string | null {
  if (entries.length > AUTO_MODE_ENTRY_LIMIT) return `${section} has ${entries.length} entries; the maximum is ${AUTO_MODE_ENTRY_LIMIT}.`;
  for (const entry of entries) {
    const text = normalizeAutoModeText(entry);
    if (text.trim() === '') return `${section} contains an empty entry.`;
    if (text.length > AUTO_MODE_TEXT_LIMIT) return `${section} contains an entry of ${text.length} characters; the maximum is ${AUTO_MODE_TEXT_LIMIT}.`;
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code < 32 && code !== 9 || code >= 127 && code <= 159 || code === 8232 || code === 8233) {
        return `${section} contains an entry with a control character; entries must be single-line text.`;
      }
    }
    if (invisibleCharacters.test(text)) return `${section} contains an entry with an invisible or bidirectional character; entries must be plainly renderable text.`;
    if (text.includes('<settings_') || slotNames.some(tag => text.includes(`<${tag}`) || text.includes(`</${tag}`))) {
      return `${section} contains an entry with a literal "<settings_" template token; entries must not contain classifier template tokens.`;
    }
    if (text.includes('<cc_automode') || text.includes('</cc_automode')) {
      return `${section} contains an entry with a literal "cc_automode" region tag; entries must not contain classifier region markers.`;
    }
  }
  return null;
}

/** co/Gr, fxx7hh8y [39952,40564), UTF-16. */
export function autoModeRuleProblem(section: AutoModeSection, value: string): string | null {
  const text = normalizeAutoModeText(value);
  if (text === AUTO_MODE_SPLICE_SENTINEL) return '"$defaults" is reserved — it splices the built-in rules in and cannot be added as a rule.';
  if (text.length > AUTO_MODE_TEXT_LIMIT) return `the rule is ${text.length} characters; the maximum is ${AUTO_MODE_TEXT_LIMIT}.`;
  const lines = text.split('\n');
  if (section === 'environment' && lines.some(line => line.startsWith('### '))) {
    return "'### ' lines are environment section headers (structure, not entries) and cannot be written here.";
  }
  return entriesProblem(section, lines);
}

/** El/wl, fxx7hh8y [38115,38244)/[36197,36420), UTF-16. */
function pruneHeaders(lines: string[]): string[] {
  return lines.filter((line, index) => !line.startsWith('### ')
    || lines[index + 1] !== undefined && !lines[index + 1]!.startsWith('### '));
}
export function autoModeDocument(text: string): { entries: string[]; problem: string | null } {
  const entries = pruneHeaders(text.split('\n').map(normalizeAutoModeText).filter(line => line.length > 0));
  return { entries, problem: entries.length === 0 ? null : entriesProblem('environment', entries) };
}

function invalid(message: string): never {
  throw new AutoModeRuleWriteError('invalid_input', message);
}

/** Tc/Dc/Fc/Xr/qr, fxx7hh8y [40646,41824)/[37516,38115)/[35679,36021), UTF-16. */
function mutateEntries(entries: string[], update: AutoModeUpdate): string[] {
  if (update.kind === 'document') {
    if (entries.length !== update.expected.length || entries.some((entry, index) => entry !== update.expected[index])) {
      return invalid('The environment changed since this screen loaded — reopen the tab to see the current entries.');
    }
    const document = autoModeDocument(update.text);
    if (document.problem !== null) return invalid(document.problem);
    return document.entries;
  }
  if (update.kind === 'toggle') {
    if (update.section === 'environment') return invalid('The environment is a single replaceable document — write your own version to replace the built-in default, or delete your entries to restore it.');
    const custom = entries.filter(entry => entry !== AUTO_MODE_SPLICE_SENTINEL);
    if (update.enabled) return [AUTO_MODE_SPLICE_SENTINEL, ...custom];
    if (custom.length === 0) return invalid('An empty section cannot hold the off state — add a rule to this section first.');
    return custom;
  }
  if (update.kind === 'add' || update.kind === 'update') {
    const problem = autoModeRuleProblem(update.section, update.text);
    if (problem !== null) return invalid(problem);
  }
  if (update.kind === 'add') {
    if (update.section === 'environment') return invalid('The environment is edited as a document — use Edit environment on the Auto mode tab.');
    const text = normalizeAutoModeText(update.text);
    return entries.length === 0 ? [AUTO_MODE_SPLICE_SENTINEL, text] : [...entries, text];
  }
  if (update.original === AUTO_MODE_SPLICE_SENTINEL) {
    return invalid(`"$defaults" is splice plumbing, not ${update.kind === 'update' ? 'an editable' : 'a deletable'} rule.`);
  }
  if (update.section === 'environment' && update.original.startsWith('### ')) {
    return invalid(`'### ' lines are environment section headers (structure, not entries) and cannot be ${update.kind === 'update' ? 'edited' : 'deleted'} here.`);
  }
  if (entries[update.index] !== update.original) throw new AutoModeRuleWriteError('entry_not_found',
    'That rule changed on disk while the dialog was open — close and reopen /permissions, then try again.');
  if (update.kind === 'update') {
    const next = [...entries];
    next[update.index] = normalizeAutoModeText(update.text);
    return next;
  }
  const next = [...entries.slice(0, update.index), ...entries.slice(update.index + 1)];
  return update.section === 'environment' ? pruneHeaders(next) : next;
}

/** ve/Yr, fxx7hh8y [35310,35679)/[36021,36161), UTF-16: invalid declarations have no rows. */
export function readAutoModePolicy(file: string | undefined): AutoModePolicy | undefined {
  if (!file) return undefined;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) return undefined;
    const text = fs.readFileSync(file, 'utf8');
    const raw = objectSchema.parse(text.trim() ? JSON.parse(text) : {});
    const parsed = autoPolicySchema.safeParse(raw.autoMode);
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

/** Ho, fxx7hh8y [38346,39924), UTF-16. Node atomic writes replace By/ta's storage host. */
export async function persistAutoModeUpdate(file: string | undefined, update: AutoModeUpdate): Promise<AutoModePolicy> {
  if (!file) throw new AutoModeRuleWriteError('no_user_settings_path', 'Could not resolve the user settings file path.');
  return queuePermissionSettingsWrite(file, () => {
    let raw: Record<string, unknown> = {}, mode = 0o600;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Invalid settings file');
      mode = stat.mode & 0o777;
      const text = fs.readFileSync(file, 'utf8');
      raw = objectSchema.parse(text.trim() ? JSON.parse(text) : {});
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw new AutoModeRuleWriteError('settings_file_invalid', 'the settings file has a validation error or cannot be read, so its auto mode rules are not in effect; fix it, then try again.');
      }
    }
    if (Array.isArray(raw.autoMode)) throw new AutoModeRuleWriteError('settings_file_invalid',
      'the existing autoMode value in the settings file is an array — fix or remove it, then try again.');
    const parsed = autoPolicySchema.safeParse(raw.autoMode ?? {});
    if (raw.autoMode === null || !parsed.success) throw new AutoModeRuleWriteError('settings_file_invalid',
      'the existing autoMode value in the settings file does not match the expected shape — fix or remove it, then try again.');
    const policy = parsed.data;
    const existing = policy[update.section] ?? [];
    const replacement = mutateEntries(existing, update);
    const count = (values: readonly string[]) => values.length - (values.includes(AUTO_MODE_SPLICE_SENTINEL) ? 1 : 0);
    if (count(replacement) > AUTO_MODE_ENTRY_LIMIT && count(replacement) > count(existing)) {
      return invalid(`autoMode.${update.section} already has ${count(existing)} entries; the maximum is ${AUTO_MODE_ENTRY_LIMIT}.`);
    }
    const next = { ...policy, [update.section]: replacement };
    const content = JSON.stringify({ ...raw, autoMode: next }, null, 2) + '\n';
    try {
      if (Buffer.byteLength(content) > 1024 * 1024) throw new Error('Settings exceed the byte limit');
      atomicWriteFile(file, content, { mode, label: 'autoModeRules' });
    } catch {
      throw new AutoModeRuleWriteError('write_failed', `Could not write ${file} — check file permissions and disk space (run with --debug for the underlying error).`);
    }
    return next;
  });
}
