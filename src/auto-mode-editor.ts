import type { PermissionLayer } from './permissions.js';
import type { TerminalPromptRequest } from './terminal.js';
import { denialDisplayText } from './permission-denials.js';
import { autoModeDocument, autoModeRuleProblem, normalizeAutoModeText,
  AUTO_MODE_SECTIONS, type AutoModeSection, type AutoModeUpdate } from './auto-mode-rules.js';
import { autoModeBuiltinRules, autoModeBuiltins, autoModeBuiltinsPaneRequest, autoModeDeleteRequest,
  autoModeEntries, autoModeEntryPaneRequest, autoModeEntryValue, autoModeEnvironmentConfirmRequest,
  autoModeEnvironmentProblemRequest, autoModeInputRequest, autoModeSectionRequest,
  autoModeSectionTitle, type AutoModeEntry } from './auto-mode-panel.js';

type Answer = { selected: readonly string[]; text?: string } | undefined;
export type AutoModeEditorResult =
  | { kind: 'edited'; content: string }
  | { kind: 'problem'; message: string; canReopen: boolean };
export interface AutoModeEditorHost {
  apply(update: AutoModeUpdate): Promise<{ error?: string }>;
  editDocument(lines: readonly string[]): Promise<AutoModeEditorResult>;
  viewRules(section: AutoModeSection, lines: readonly string[]): Promise<string | undefined>;
}

type Pane =
  | { kind: 'section' }
  | { kind: 'input'; section: AutoModeSection; editing?: AutoModeEntry; draft: string; error?: string }
  | { kind: 'entry'; entry: AutoModeEntry }
  | { kind: 'delete'; entry: AutoModeEntry }
  | { kind: 'builtins'; section: AutoModeSection; notice?: string }
  | { kind: 'environment-confirm' }
  | { kind: 'environment-problem'; problem: string; draft: readonly string[]; expected: readonly string[]; canReopen: boolean };

/** di, fxx7hh8y [78011,85560), UTF-16. Modal state stays here; disk and editor ownership stay with the host. */
export async function browseAutoMode(value: string, readLayers: () => readonly PermissionLayer[],
  read: (request: TerminalPromptRequest) => Promise<Answer>, host: AutoModeEditorHost): Promise<string[]> {
  const entries = () => autoModeEntries(readLayers());
  const reports: string[] = [];
  const save = async (update: AutoModeUpdate, success: string, failure: string) => {
    const result = await host.apply(update);
    reports.push(result.error === undefined ? success : `${failure} — ${result.error}`);
  };
  const environment = async (draft: readonly string[], expected: readonly string[]): Promise<Pane | undefined> => {
    const result = await host.editDocument(draft);
    if (result.kind === 'problem') return { kind: 'environment-problem', problem: result.message, draft, expected,
      canReopen: result.canReopen };
    const text = result.content.replace(/\r\n?/g, '\n');
    if (text.replace(/\n+$/, '') === draft.join('\n').replace(/\n+$/, '')) return {
      kind: 'environment-problem', problem: 'No changes detected — nothing was saved. If your editor opened in a separate window without waiting, configure it to wait (for example "code --wait"), then reopen.',
      draft, expected, canReopen: true,
    };
    const problem = autoModeDocument(text).problem;
    if (problem !== null) return { kind: 'environment-problem', problem, draft: text.split('\n'), expected, canReopen: true };
    await save({ kind: 'document', section: 'environment', expected, text }, expected.length === 0
      ? 'Replaced the built-in auto mode environment with your own document' : 'Saved your auto mode environment document',
    'Could not save the environment');
    return undefined;
  };
  const openEnvironment = async (): Promise<Pane | undefined> => {
    const expected = readLayers().filter(layer => layer.source === 'userSettings')
      .flatMap(layer => layer.autoMode?.environment ?? []);
    return expected.length === 0 && autoModeBuiltins(readLayers()).environment.enabled
      ? { kind: 'environment-confirm' } : environment(expected, expected);
  };
  let pane: Pane | undefined;
  if (value === 'add-new-rule') pane = { kind: 'section' };
  else if (value === 'environment-document') pane = await openEnvironment();
  else {
    const section = AUTO_MODE_SECTIONS.find(section => value === `builtins:${section}`);
    const entry = entries().find(entry => autoModeEntryValue(entry) === value);
    pane = section !== undefined ? { kind: 'builtins', section } : entry === undefined ? undefined : { kind: 'entry', entry };
  }
  while (pane !== undefined) {
    const request = pane.kind === 'section' ? autoModeSectionRequest()
      : pane.kind === 'input' ? autoModeInputRequest(pane.section, pane.draft, pane.editing !== undefined, pane.error)
        : pane.kind === 'entry' ? autoModeEntryPaneRequest(pane.entry)
          : pane.kind === 'delete' ? autoModeDeleteRequest(pane.entry, entries())
            : pane.kind === 'environment-confirm' ? autoModeEnvironmentConfirmRequest()
              : pane.kind === 'environment-problem' ? autoModeEnvironmentProblemRequest(pane.problem, pane.canReopen)
                : autoModeBuiltinsPaneRequest(pane.section, autoModeBuiltins(readLayers())[pane.section]);
    if (pane.kind === 'builtins' && pane.notice) request.message += `\n\n${pane.notice}`;
    const answer = await read(request);
    const selected = answer?.selected[0];
    if (answer === undefined || selected === 'cancel' || selected === 'back') {
      pane = pane.kind === 'delete' ? { kind: 'entry', entry: pane.entry }
        : pane.kind === 'input' && pane.editing ? { kind: 'entry', entry: pane.editing } : undefined;
      continue;
    }
    switch (pane.kind) {
      case 'section': {
        const section = AUTO_MODE_SECTIONS.find(section => section === selected);
        pane = section === 'environment' ? await openEnvironment()
          : section === undefined ? undefined : { kind: 'input', section, draft: '' };
        break;
      }
      case 'input': {
        const text = (answer.text ?? '').trim().replace(/\r\n?/g, '\n');
        if (!text) continue;
        const problem = autoModeRuleProblem(pane.section, text);
        if (problem !== null) { pane = { ...pane, draft: text, error: problem }; break; }
        const editing = pane.editing;
        const normalized = normalizeAutoModeText(text);
        if (editing?.text !== normalized) await save(editing === undefined
          ? { kind: 'add', section: pane.section, text }
          : { kind: 'update', section: pane.section, index: editing.index, original: editing.text, text },
        `${editing ? 'Updated' : 'Added'} auto mode ${autoModeSectionTitle(pane.section).toLowerCase()} rule ${denialDisplayText(normalized)}`,
        `Could not ${editing ? 'update' : 'add'} ${denialDisplayText(editing?.text ?? normalized)}`);
        pane = undefined;
        break;
      }
      case 'entry': {
        const editable = pane.entry.source === 'userSettings' && pane.entry.structure !== true;
        if (editable && selected === 'edit' && autoModeRuleProblem(pane.entry.section, pane.entry.text) === null) {
          pane = { kind: 'input', section: pane.entry.section, editing: pane.entry, draft: pane.entry.text };
        } else pane = editable && selected === 'delete' ? { kind: 'delete', entry: pane.entry } : undefined;
        break;
      }
      case 'delete': {
        if (selected !== 'confirm') { pane = { kind: 'entry', entry: pane.entry }; break; }
        const entry = pane.entry;
        await save({ kind: 'delete', section: entry.section, index: entry.index, original: entry.text },
          `Deleted auto mode ${autoModeSectionTitle(entry.section).toLowerCase()} rule ${denialDisplayText(entry.text)}`,
          `Could not delete ${denialDisplayText(entry.text)}`);
        pane = undefined;
        break;
      }
      case 'builtins': {
        const section = pane.section;
        const builtin = autoModeBuiltins(readLayers())[section];
        if (selected === 'view') {
          const notice = await host.viewRules(section, autoModeBuiltinRules(section).map(rule => `- ${rule}`));
          pane = { kind: 'builtins', section, ...(notice === undefined ? {} : { notice }) };
        } else if (selected === 'toggle' && builtin.control === 'user') {
          await save({ kind: 'toggle', section, enabled: !builtin.enabled },
            `${builtin.enabled ? 'Disabled' : 'Enabled'} the built-in auto mode ${autoModeSectionTitle(section).toLowerCase()} rules`,
            `Could not ${builtin.enabled ? 'disable' : 'enable'} the built-in ${autoModeSectionTitle(section).toLowerCase()} rules`);
          pane = undefined;
        } else pane = undefined;
        break;
      }
      case 'environment-confirm':
        pane = selected === 'confirm' ? await environment(autoModeBuiltinRules('environment'), []) : undefined;
        break;
      case 'environment-problem':
        pane = selected === 'reopen' && pane.canReopen ? await environment(pane.draft, pane.expected) : undefined;
        break;
    }
  }
  return reports;
}
