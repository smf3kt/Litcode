import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { Agent } from './agent.js';
import { automaticCompactionEnabled } from './compaction-policy.js';
import { DEFAULT_GATEWAY, type ModelProvider } from './provider.js';
import { Session, configSchema, type SessionConfig } from './session.js';
import { createTerminalInput, questionPreviewText, type TerminalSurface, type TerminalPromptRequest } from './terminal.js';
import { skillRequiresExecution } from './skill-runtime.js';
import { relocateSession } from './workspace-session.js';
import fs from 'node:fs';
import path from 'node:path';
import { InteractivePlanResume, permissionModeCommand, transitionPlanMode, type PermissionModeCommand } from './plan-resume.js';
import { permissionPolicySchema, bindPermissionOwner } from './permissions.js';
import { permissionCycleCommand } from './permission-cycle.js';
import type { PermissionUpdate } from './permissions.js';
import {
  browsePermissions, type PermissionPanelApplyResult, type PermissionPanelInput, permissionPanelRules,
} from './permissions-panel.js';
import { forkSession, listSessions, readSessionPreview, renameStoredSession } from './sessions.js';
import { startBackgroundSession } from './background-session.js';
import { parseAttachmentCommand } from './media.js';
import { questionClarification, terminalAnswerAnnotation } from './interaction-tools.js';
import { askUserQuestionTimeoutMs } from './tui-afk.js';
import { questionImageBlocks } from './question-images.js';
import { checkpointConversation, previewRewind, applyRewind, type RewindPreview } from './rewind.js';
import { recoverCheckpoint } from './checkpoints.js';
import { reloadConfig } from './reload.js';
import { promptBlockMessage } from './hooks.js';
import { createLocalPeerTransport, createLocalPeerTools, heldApprovalTimeoutMs, type LocalPeerTransport, type PeerTransportEvent } from './local-peer.js';
import { validateElicitationResult, type McpClientRequests, type McpElicitationResult } from './mcp-client-requests.js';
import { captureClipboardImage } from './clipboard.js';
import { listWorktreeArchives, recoverWorktreeArchives, resolveWorktreeEntry, resolveWorktreeExit, removeExitedWorktree, restoreWorktreeArchive } from './worktree-session.js';
import { permissionDecision } from './permissions.js';
import { watchProjectConfig, type ConfigWatcher } from './config-watch.js';
import { defaultUserDir, loadProjectConfig } from './config.js';
import { permissionSettingsPaths } from './permission-settings.js';
import { SKILLS_TITLE, applySkillOverrideDiff, defaultSkillModes, nextSkillMode, readLocalSkillOverrides,
  saveSkillOverrides, skillOverrideDiff, skillPanelRows, skillsPanelMessage, skillsSaveError,
  skillsSaveMessage, type SkillMode } from './skills-panel.js';
import { TASKS_EMPTY, TASKS_TITLE, backgroundTaskGoneMessage, backgroundTaskItems,
  parseBackgroundTaskValue, tasksPanelRows, tasksPanelSubtitle } from './tasks-panel.js';
import { hooksSchema } from './hooks.js';
import { HOOKS_NONE_YET, HOOKS_TITLE, attributeHooks, browseHooks, hookConfigLabel,
  hookListSubtitle, type HookLayer, type HookPanelHook } from './hooks-panel.js';
import { saveThemeSetting, saveEditorMode, saveEffortSetting, saveAutoCompactSetting,
  readAutoCompactSetting, saveModelSetting, saveConfigPanelSetting, saveConfigModelEffort } from './theme-settings.js';
import { editorModeRow, vimRedirect } from './tui-vim-settings-source.js';
import type { EditorMode } from './tui-vim.js';
import { parseTheme, themeChoices, type ThemeSetting } from './tui-theme-state.js';
import { workflowsAvailable } from './tui-input-highlights.js';
import { loopAutonomousInterval, loopAutonomousPrompt, loopCommandPrompt } from './loop-command.js';
import { DEFAULT_EFFORT, effortCommand, isEffortLevel, modelEffort, modelSettingsKey, persistableEffort,
  effortIndicator, type EffortLevel } from './effort-command.js';
import { effortSliderRequest } from './effort-slider.js';
import { modelPickerRequest } from './model-picker.js';
import { thinkingDialogRequest, THINKING_DIALOG_TITLE, THINKING_MID_CONVERSATION_WARNING } from './thinking-dialog.js';
import { TIME_FORMATS, type ConfigPanelState, type ConfigUpdate } from './config-panel.js';
import { configPanelInput } from './config-panel-input.js';
import { copyEmptyMessage, copyReport, copyResponses, copyTooManyMessage, copyUsageMessage,
  parseCopyArgument, writeCopyFile } from './copy-command.js';
import { AUTO_COMPACT_FALLBACK, applyAutoCompactWindow, autoCompactChoices,
  autoCompactDialogMessage, autoCompactLimit, autoCompactSelection, autoCompactSelectionValue,
  autoCompactStatus, autoCompactUnchangedMessage, resolveAutoCompactWindow } from './autocompact-command.js';
import { parseSessionColor, sessionColorArgumentHint, sessionColorMessage } from './session-color.js';
import { keybindingsFilePath, keybindingsReport, writeKeybindingsTemplate } from './keybindings-command.js';
import { MEMORY_CANCELLED, MEMORY_TITLE, memoryOpenFailedMessage, memoryOpenedMessage,
  memoryPanelReport, memoryPanelRows, openMemoryFile, type MemoryPanelRow } from './memory-panel.js';
import { SCROLL_SPEED_ENV, SCROLL_SPEED_UNCHANGED, applyStoredEnvironment, autoScrollSpeed,
  currentScrollSpeed, saveScrollSpeedSetting, scrollSpeedAvailable, scrollSpeedDetail,
  scrollSpeedNotch, scrollSpeedNotchCount, scrollSpeedReset, scrollSpeedRuler, scrollSpeedSaved,
  scrollSpeedSettingsFile, scrollSpeedStep, scrollSpeedValues, setLiveScrollSpeed } from './scroll-speed.js';
import { invalidateTerminalEnvironment, terminalEnvironment } from './plugin-chain-terminal-environment.js';
import { openExternalFile, externalEditorName } from './external-editor.js';
import { persistAutoModeUpdate, readAutoModePolicy } from './auto-mode-rules.js';
import { type AutoModeEditorHost } from './auto-mode-editor.js';
import { osc52Payload } from './clipboard-osc52.js';
import { SIDE_QUESTION_COPIED, SIDE_QUESTION_NO_RESPONSE, SIDE_QUESTION_PROMPT,
  SIDE_QUESTION_USAGE, sideQuestionPanelText, type SideQuestionExchange } from './side-question.js';
import { contextPanelText, contextUsageFromCounts } from './context-panel.js';
import { STATUS_PANEL_TITLE, appVersion, latestSessionTitle, statusPanelRows, statusPanelText } from './status-panel.js';
import { MCP_PANEL_TITLE, mcpPanelRows, mcpPanelText, mcpToolCounts } from './mcp-panel.js';
import { STATS_PANEL_TITLE, STATS_RANGE_LABELS, activityHeatmap, nextUsageRange, readUsageSessions, usagePanelText, usageStats, type UsageRange } from './usage-panel.js';
import {
  EXPORT_CANCELLED, EXPORT_CLIPBOARD_DESCRIPTION, EXPORT_CLIPBOARD_LABEL, EXPORT_DIALOG_SUBTITLE,
  EXPORT_DIALOG_TITLE, EXPORT_FILE_DESCRIPTION, EXPORT_FILE_LABEL, EXPORT_FILENAME_PROMPT,
  exportCopiedMessage, exportDefaultFilename, exportFailedMessage, exportSavedMessage, exportTranscriptText,
  writeConversationExport,
} from './export-command.js';
import { displayCronJobs, readLoopFile } from './loop-file.js';
import { browseWorkflows } from './workflow-panel.js';
import { HELP_DISMISSED, browseHelp } from './help-panel.js';
import { tuiReport } from './tui-command.js';
import { ADD_DIR_USAGE, addedForSessionMessage, addDirectoryMessage, validateAddDirectory } from './add-dir-command.js';
import { chordForAction } from './tui-keys.js';
import { tuiCommandsWithSkills } from './tui-autocomplete.js';
import { reloadSkillsMessage } from './reload-skills.js';
import { briefTranscriptEnabled, focusModeFor, focusReport, focusUnknownArgument, parseFocusArgument,
  saveViewModeSetting } from './focus-command.js';
import { reloadSkills } from './skill-catalog.js';
import {
  expandUserSkill,
  findSkill,
  parseSlashCommand,
  pinToolSchemas,
  type Runtime,
} from './runtime.js';

export type ConfigChangeSource = 'user_settings' | 'project_settings' | 'local_settings' | 'policy_settings' | 'skills';

/**
 * The recovered ConfigChange builder raises only from the settings and skill
 * watchers (`QXr`, chunk-sfn1dbxq.js [2933599,2933905)) and maps each watched
 * settings scope through `Uc` (chunk-2bcyxj9q.js [42936,43157)). The skills
 * watcher gates skill, command and agent files with the `skills` source
 * (`re`, chunk-zkxek575.js [4471,4606)); instruction files and session-only
 * settings raise nothing.
 */
export function configChangeSource(file: string, workspace: string, sources: {
  userDir?: string; settingsFile?: string; managedSettingsFile?: string; contentDirectories?: readonly string[];
}): ConfigChangeSource | undefined {
  const target = path.resolve(file);
  const root = path.resolve(workspace);
  if (sources.managedSettingsFile !== undefined &&
      target === path.resolve(root, sources.managedSettingsFile)) return 'policy_settings';
  if (target === path.join(root, '.harness', 'settings.json') ||
      (sources.settingsFile !== undefined && target === path.resolve(root, sources.settingsFile))) return 'project_settings';
  if (target === path.join(root, '.harness', 'settings.local.json')) return 'local_settings';
  const userDir = path.resolve(sources.userDir ?? defaultUserDir());
  if (target === path.join(userDir, 'settings.json')) return 'user_settings';
  const within = (directory: string): boolean => {
    const relative = path.relative(path.resolve(directory), target);
    return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
  };
  const skillRoots = ['.harness/skills', '.harness/commands', '.harness/agents', '.harness/plugins']
    .map(relative => path.join(root, relative))
    .concat(['skills', 'commands', 'agents'].map(name => path.join(userDir, name)));
  if (skillRoots.some(within) || (sources.contentDirectories ?? []).some(within)) return 'skills';
  return undefined;
}

export const COMMAND_HELP = `/help       Show help and available commands
/status     Show session, model, context settings and usage
/context    Visualize current context usage as a colored grid
/usage      Show session cost and activity stats
/effort LEVEL  Set effort level for model usage (low/medium/high/xhigh/max/auto)
/copy [N]   Copy the latest response to the clipboard (or the Nth-latest)
/btw [question]  Ask a side question with no tools; it never joins the conversation
/export [filename]  Export the conversation to a file or clipboard
/autocompact [auto|<tokens>]  Set how full the context gets before auto-summarizing
/color ${sessionColorArgumentHint()}  Set the prompt bar color for this session
/keybindings  Open your keyboard shortcuts file
/memory     Edit instruction files in your editor
/scroll-speed  Adjust mouse wheel scroll speed
/tui [default|fullscreen]  Set the terminal UI renderer
/focus [on|off]  Toggle focus view: just your prompt, summary, and response
/add-dir <path>  Add a new working directory
/hooks      View hook configurations for tool events
/sessions [QUERY]  List/search workspace sessions by title, model or UUID
/resume [UUID|QUERY]  Resume a matching session or choose from a local list
/rename TITLE  Set the current session title (alias: /name)
/skills     List available skills
/agents     List configured local agent types
/mcp        Show configured MCP servers and adapter limitations
/mcp-reconnect [SERVER]  Reconnect one server in place, or all servers into a new session
/tasks      Show workspace task dependencies and readiness (alias: /bashes)
/workflows  Browse running and completed workflows
/cron       Show scheduled prompts in the active session
/loop [interval] [prompt]  Repeat a prompt or command on an interval (e.g. /loop 5m /foo)
/peers      List live same-host sessions and this inbox address
/peer-held [list|approve N|deny N|expire N]  Review held peer messages
/peer-inbound accept|hold|refuse|off  Set the explicit inbound policy
/diff NAME [OFFSET]  Show a page of file changes against a checkpoint
/reload     Reload local instructions, skills, hooks, tools and settings into a new session
/reload-skills  Pick up skills added or changed on disk during this session
/attach PATH [--pages RANGE] PROMPT  Submit an image/PDF with a task (quote paths with spaces)
/paste-image PROMPT  Read a PNG image from the clipboard and submit it with a task
/NAME args  Run an available skill by name
/continue   Resume an interrupted turn
/compact    Summarize completed history
/fork       Fork completed history into a new session
/background [PROMPT]  Fork this session into a detached background task
/rewind N   Branch conversation at completed turn N (files stay as they are; alias: /undo)
/checkpoint NAME  Associate a file snapshot with the current completed turn
/checkpoint-recover  Resolve a proven interrupted restore; changed files stay preserved
/rewind N --files  Preview files and history together (N=0 means initial history)
/rewind N --files --apply TOKEN  Apply the exact preview and start a new session
/cwd DIR    Relocate completed conversation into an existing workspace
/worktree NAME  Create/enter an owned checkout and relocate completed history
/worktree-exit [--remove [--discard-changes]]  Return; optionally archive history and remove owned checkout/branch
/worktree-history [restore ARCHIVE]  List preserved worktree histories; restore one to its original name
/model [ID] Choose or enter a model, then start a session with completed history
/theme [NAME] Preview, choose and save a terminal theme
/thinking [on|off] Toggle or set thinking in a new session with completed history
/plan       Start a read-only session
/permissions  Manage allow and deny tool permission rules (alias: /allowed-tools)
/permissions MODE  Start a session in default/plan/acceptEdits/ask/bypass mode
/editor     Edit the current draft in VISUAL/EDITOR (Ctrl+G at a terminal)
/config     Browse and change local settings
/config editor=normal|vim  Save and apply the input editor mode
/vim        Open the Editor mode setting
/clear      Start a new session without changing existing logs (aliases: /reset, /new)
/exit       Close the interactive session (alias: /quit)
Other text is sent as a task.`;

/**
 * Recovered aliases from the `local-jsx` registrations (chunk-sfn1dbxq.js): `rename` -> `name`
 * 1165018, `tasks` -> `bashes` 1167415, `permissions` -> `allowed-tools` 1636668, `exit` -> `quit`
 * 1647455, `clear` -> `reset`, `new` 1121013, `rewind` -> `checkpoint`, `undo` 1640413. The
 * vendor's `resume` alias `continue` is not taken here because this host's `/continue` resumes an
 * interrupted turn, `config` -> `settings` is not taken because `/settings` does not exist, and
 * `rewind`'s `checkpoint` alias is dropped because this host has a real `/checkpoint`.
 */
export const COMMAND_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  name: 'rename', bashes: 'tasks', 'allowed-tools': 'permissions', quit: 'exit',
  reset: 'clear', new: 'clear', undo: 'rewind',
});

/** The canonical command for a typed name, or the name itself. */
export function canonicalCommand(name: string): string {
  return Object.hasOwn(COMMAND_ALIASES, name) ? COMMAND_ALIASES[name]! : name;
}

/** Recovered `O9n` (chunk-fyhzvvp0.js offset 5041): a pending permission prompt
 *  raises Notification after `aVt` = 6000 ms (chunk-sfn1dbxq.js offset
 *  2915839) with `notification_type: "permission_prompt"`; the disable flag
 *  skips it and the returned function cancels a prompt answered in time. The
 *  source message names its product; this runtime keeps the neutral text. */
export function notifyPermissionPrompt(tool: string, emit: (payload: { message: string; notification_type: string }) => void, delayMs = 6_000): () => void {
  if (process.env.CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS !== undefined) return () => {};
  const timer = setTimeout(() => emit({ message: `Permission needed to use ${tool}`, notification_type: 'permission_prompt' }), delayMs);
  timer.unref();
  return () => clearTimeout(timer);
}

/**
 * The settings layers that can declare hooks, read back for `/hooks`. The config merge folds every
 * layer into one `config.hooks`, so the panel recovers the source by re-reading each file this
 * session's config was built from (`permissionSettingsPaths`). A layer that is absent, unreadable,
 * or declares no hooks contributes nothing; an invalid `hooks` block is skipped rather than thrown,
 * because the merged config would already have refused to load.
 */
function hookSettingsLayers(session: Session): (HookLayer & { file: string })[] {
  const paths = permissionSettingsPaths(session.config.workspace,
    session.config.configSources?.userDir ?? defaultUserDir());
  const layers: (HookLayer & { file: string })[] = [];
  for (const source of ['userSettings', 'projectSettings', 'localSettings'] as const) {
    const file = paths[source];
    if (file === undefined) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { continue; }
    const declared = (parsed as { hooks?: unknown } | null)?.hooks;
    if (declared === undefined) continue;
    const hooks = hooksSchema.safeParse(declared);
    if (hooks.success) layers.push({ source, file, hooks: hooks.data });
  }
  return layers;
}

/** The `/hooks` text form for a session with no modal surface. */
function hooksReport(hooks: readonly HookPanelHook[]): string {
  if (hooks.length === 0) return `${HOOKS_TITLE}\n${HOOKS_NONE_YET}`;
  return [HOOKS_TITLE, hookListSubtitle(hooks), '',
    ...hooks.map(hook => `${hook.event}  ${hookConfigLabel(hook.config)}  [${hook.config.type ?? 'command'}]  ${hook.source}`)].join('\n');
}

/**
 * The `/permissions` panel's own view of the session: every rule bucket the live permission state
 * carries, attributed to the source that declares it, plus the settings file each writable source
 * resolves to. The recovered reads the same three buckets off its permission context (`U0`, `Bc`,
 * `xm`, `chunk-nkb63p1y.js`) and its own save paths (`TO`).
 */
function permissionPanelInput(session: Session): PermissionPanelInput {
  const state = session.permissionOwner.state();
  return {
    rules: [
      ...permissionPanelRules(state.alwaysAllowRules, 'allow'),
      ...permissionPanelRules(state.alwaysAskRules, 'ask'),
      ...permissionPanelRules(state.alwaysDenyRules, 'deny'),
    ],
    paths: permissionSettingsPaths(session.config.workspace,
      session.config.configSources?.userDir ?? defaultUserDir()),
    // Source `Ac`/`wn`: the workspace tab reads the raw insertion order, unlike the observed
    // `workingDirectories()` list, and draws the original directory above it.
    directories: [...session.permissionUpdates.additionalWorkingDirectories.keys()],
    originalCwd: session.config.workspace,
    // Source `Wr`'s `denials` prop, read from the store at mount.
    denials: session.autoModeDenials.denials,
    // Source `ve`'s layers: the config keeps the loaded layers with their `autoMode` blocks, which
    // `effectivePermissionPolicy` rebuilds without. The reader keeps only the three it reads.
    autoModeLayers: session.config.permissions?.layers ?? [],
  };
}

/**
 * Source `kor` (`chunk-sfn1dbxq.js` 3364311) and the `L9` write behind it: reduce the update onto
 * the live context, then persist it. The recovered `await`s its writer, so this awaits the session's
 * queued permission writes and reports the first one that failed.
 */
async function applyPermissionPanelUpdate(session: Session,
  update: PermissionUpdate): Promise<PermissionPanelApplyResult> {
  await session.drainPermissionWrites();
  const outcome = session.adoptPermissionUpdates([update]);
  if (outcome.blocked !== undefined) return { error: outcome.blocked };
  const results = await session.drainPermissionWrites();
  const failure = results.find(result => result.outcome === 'error');
  return failure === undefined ? {} : { error: failure.error };
}

export async function interactiveLoop(initial: Session, provider: ModelProvider, runtime: Runtime, options: {
  input: Readable; output: Writable; status: Writable; signal: AbortSignal;
  /** A full-screen interaction layer to drive instead of the built-in line editor. */
  terminal?: TerminalSurface;
  /** SessionStart `initialUserMessage`, queued ahead of the first typed input. */
  initialUserMessage?: string;
  /** SessionStart `watchPaths` from the startup hooks run before this loop. */
  initialWatchPaths?: string[];
}): Promise<void> {
  let session = initial;
  const planResume = new InteractivePlanResume(initial.id);
  // The user settings file's `env` block is applied before anything probes the environment, so a
  // persisted `/scroll-speed` survives a restart. It runs here rather than at startup because the
  // session's own user directory is the one `/scroll-speed` reads and writes; a real variable wins.
  applyStoredEnvironment(session.config.configSources?.userDir);
  try {
    const archives = recoverWorktreeArchives(initial.config.workspace);
    for (const restored of archives.recovered) options.status.write(`Restored worktree history after an interrupted removal: ${restored}\n`);
    for (const warning of archives.warnings) options.status.write(`Worktree history recovery: ${warning}\n`);
  } catch (error) { options.status.write(`Worktree history recovery skipped: ${String(error)}\n`); }
  let activeRuntime = runtime;
  const terminal: TerminalSurface | undefined = options.terminal ??
    ((options.input as Readable & { isTTY?: boolean }).isTTY &&
    (options.output as Writable & { isTTY?: boolean }).isTTY
      ? createTerminalInput({ input: options.input, output: options.output, keybindings: initial.config.keybindings,sourceInputGestures:true,
        editorMode:initial.config.editorMode,vimInsertModeRemaps:initial.config.vimInsertModeRemaps })
      : undefined);
  const rl = terminal ? undefined : createInterface({ input: options.input, terminal: false });
  // `251130`: the reader takes the colour from the session's own record, `??=` on resume.
  terminal?.setSessionColor?.(session.sessionColor);
  const output = terminal?.outputStream ?? options.output;
  let turnController: AbortController | undefined;
  const abort = () => { rl?.close(); terminal?.close(); onClose(); };
  const withTurn = async <T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    turnController = new AbortController(); terminal?.setRunning(true);
    const signal = AbortSignal.any([options.signal, turnController.signal]);
    let unregister: (() => void) | undefined;
    try {
      unregister = activeRuntime.registerElicitation?.(session.id, (params, requestSignal, context) =>
        elicit(params, AbortSignal.any([signal, requestSignal]), context),
        event => options.status.write(`MCP server "${event.serverName}" confirmed elicitation ${event.elicitationId} complete\n`));
      return await action(signal);
    } finally { unregister?.(); turnController.abort(); turnController = undefined; terminal?.setRunning(false); }
  };
  options.signal.addEventListener('abort', abort, { once: true });
  // `we`, chunk-qskwh3r4.js [1877,8641), UTF-16: side answers live for the session and never
  // enter the transcript, so the panel's history is this list.
  const btwExchanges: SideQuestionExchange[] = [];
  const queue: { prompt: string; source: 'user' | 'event'; idle?: { id: string; name: string | null };
    peer?: { from: string | null };
    /** Source `isMeta`: an entry this host queued itself, not one a person may pull back and edit. */
    meta?: boolean;
    attachment?: import('./terminal.js').PromptDiffSelection }[] = [];
  // The recovered prologue prepends the SessionStart message to the user input
  // queue (`prependUserMessage`, chunk-rx2nah4x.js offset 472137), so it runs
  // before anything typed or piped at startup.
  // The SessionStart message is host-generated, so it is source `isMeta`: the composer may not
  // pull it back as if a person had typed it.
  if (options.initialUserMessage !== undefined) queue.push({ prompt: options.initialUserMessage, source: 'user', meta: true });
  // Source `Kp`: the composer may pull back only a person's own queued prompt, not a meta entry,
  // an event and not a bash-mode command (this host has no bash queue mode).
  const editableQueued = (item: (typeof queue)[number]) => item.source === 'user' && item.meta !== true;
  const promptQueue = {
    snapshot: () => queue.filter(editableQueued).map(item => item.prompt),
    pop: (index: number) => {
      const target = queue.filter(editableQueued)[index];
      if (target === undefined) return undefined;
      queue.splice(queue.indexOf(target), 1);
      return { text: target.prompt, ...(target.attachment === undefined ? {} : { attachment: target.attachment }) };
    },
    popAll: () => {
      const editable = queue.filter(editableQueued);
      if (editable.length === 0) return undefined;
      for (const target of editable) queue.splice(queue.indexOf(target), 1);
      // Source `pi` restores the first item carrying a non-empty IDE selection, else the first
      // item with one at all.
      const attachment = editable.find(item => Boolean(item.attachment?.selection.text))?.attachment
        ?? editable.find(item => item.attachment !== undefined)?.attachment;
      return { text: editable.map(item => item.prompt).join('\n'),
        ...(attachment === undefined ? {} : { attachment }) };
    },
  };
  terminal?.bindPromptQueue?.(promptQueue);
  // Source `Jr` (chunk-24k7d6mw.js 435644) reads the task store and, on the confirmed press,
  // stops the running jobs and local-agent tasks. This host projects the same live set from the
  // owner's runtime and stops exactly those; a closed runtime has no live work to report.
  terminal?.bindBackgroundWork?.(
    () => {
      try { return activeRuntime.backgroundWorkCount?.(session.id) ?? 0; } catch { return 0; }
    },
    () => { try { activeRuntime.stopBackground?.(session.id); } catch (error) { options.status.write(`Background stop error: ${String(error)}\n`); } });
  const promptQueueChanged = () => { terminal?.promptQueueChanged?.(); };
  let editorWork: Promise<import('./external-editor.js').ExternalEditorResult> | undefined;
  let inputClosed = false;
  let approval: ((value: string | undefined) => void) | undefined;
  let wake: (() => void) | undefined;
  const awaken = () => { wake?.(); wake = undefined; };
  let configDirty = false;
  let configWatch: ConfigWatcher | undefined;
  let taskUnsubscribe: (() => void) | undefined;
  const refreshTasks = () => {
    if (!terminal?.setTasks) return;
    try {terminal.setTasks(activeRuntime.taskRecords?.(session.config) ?? []);}
    catch (error) {terminal.setTasks([]); options.status.write(`Task display error: ${String(error)}\n`);}
  };
  const dynamicWatchPaths = new Set<string>();
  let watchedWorkspace = session.config.workspace;
  const addInstructionPaths = (paths: string[]) => {
    if (!session.config.watchConfig) return;
    const added: string[] = [];
    for (const file of paths) {
      if (!path.isAbsolute(file) || Buffer.byteLength(file) > 4096 || dynamicWatchPaths.has(file) || dynamicWatchPaths.size + added.length >= 2048) continue;
      if (!added.includes(file) && Buffer.byteLength(JSON.stringify([...dynamicWatchPaths, ...added, file])) <= 65536) added.push(file);
    }
    if (added.length) {
      session.append({ kind: "instruction_watch", workspace: session.config.workspace, paths: added });
      for (const file of added) dynamicWatchPaths.add(file);
    }
    configWatch?.addInstructionPaths?.(added);
  };
  // `Kjt` registers the SessionStart hook's watchPaths with the file watcher
  // (chunk-sfn1dbxq.js offset 2483234, helpers at 1680634); the startup run
  // happened before this loop, so its paths arrive as an option.
  if (options.initialWatchPaths?.length) addInstructionPaths(options.initialWatchPaths);
  const bindConfigWatch = () => {
    configWatch?.close(); configWatch = undefined; configDirty = false;
    if (watchedWorkspace !== session.config.workspace) { dynamicWatchPaths.clear(); watchedWorkspace = session.config.workspace; }
    for (const event of session.events) if (event.kind === "instruction_watch" && event.workspace === session.config.workspace) {
      for (const file of event.paths) if (dynamicWatchPaths.size < 2048 && Buffer.byteLength(JSON.stringify([...dynamicWatchPaths, file])) <= 65536) dynamicWatchPaths.add(file);
    }
    terminal?.setKeybindings(session.config.keybindings);
    terminal?.setEditorMode?.(session.config.editorMode,session.config.vimInsertModeRemaps);
    terminal?.setPrefersReducedMotion?.(session.config.prefersReducedMotion);
    terminal?.setShowTurnDuration?.(session.config.showTurnDuration);
    terminal?.setShowMessageTimestamps?.(session.config.showMessageTimestamps);
    terminal?.setBriefTranscript?.(briefTranscriptEnabled(session.config));
    terminal?.setVerbose?.(session.config.verbose === true);
    terminal?.setTerminalProgressBar?.(session.config.terminalProgressBarEnabled !== false);
    terminal?.setProgressSettings?.({timeFormat:session.config.timeFormat, timeZone:session.config.timeZone,
      spinnerVerbs:session.config.spinnerVerbs});
    terminal?.setMaxProseWidth?.(session.config.maxProseWidth);
    terminal?.setSyntaxHighlightingDisabled?.(session.config.syntaxHighlightingDisabled);
    terminal?.setEmojiCompletion?.(session.config.emojiCompletionEnabled ?? true);
    terminal?.setWorkflowKeywordSettings?.({
      available: workflowsAvailable(session.config.enableWorkflows),
      triggerEnabled: session.config.workflowKeywordTriggerEnabled ?? true,
    });
    terminal?.bindThemeCatalog?.(session.config.configSources?.userDir, session.config.workspace, session.config.plugins);
    terminal?.setTheme?.(session.config.theme);
    terminal?.bindStatusLine?.(session);
    terminal?.bindDiffPanel?.(session);
    terminal?.bindInlineDiff?.(session);
    taskUnsubscribe?.(); taskUnsubscribe = undefined;
    refreshTasks();
    if (terminal?.setTasks) taskUnsubscribe = activeRuntime.subscribeTasks?.(session.config, refreshTasks);
    const duration = session.events.findLast(event => event.kind === 'turn_end' && event.duration !== undefined
      && event.reason !== 'aborted' && event.reason !== 'error');
    terminal?.restoreTurnDuration?.(duration?.kind === 'turn_end' ? duration.duration : undefined);
    if (session.config.watchConfig) {
      let instructionPaths: string[] = [];
      let contentDirectories: string[] = [];
      try {
        const loaded = loadProjectConfig(session.config.workspace, { ...session.config.configSources, paths: [] });
        instructionPaths = [...loaded.instructions, ...(loaded.conditionalRules ?? []).flatMap(rule => [rule, ...(rule.imports ?? [])])]
          .map(instruction => instruction.path);
        contentDirectories = loaded.watchDirectories ?? [];
      } catch (error) { options.status.write(`Config watch source error: ${String(error)}\n`); }
      try {
        configWatch = watchProjectConfig(session.config.workspace, { ...session.config.configSources,
          instructionPaths: [...new Set([...instructionPaths, ...dynamicWatchPaths])], contentDirectories,
          // FileChanged is watcher-driven (`e7r`, chunk-sfn1dbxq.js
          // [2935646,2935767)). A settings or skill change first raises
          // ConfigChange with the recovered source and path; a blocking result
          // skips the reload fan-out (`oi`, chunk-2bcyxj9q.js [39334,39473)).
          onFileChange: (file, event) => {
            const source = configChangeSource(file, session.config.workspace, {
              ...session.config.configSources, contentDirectories });
            return (async () => {
              let blocked = false;
              try {
                if (source !== undefined) {
                  const decision = await agent().emitHook('ConfigChange', { source, file_path: file }, options.signal);
                  // `policy_settings` results are never blocking (`QXr`).
                  if (source !== 'policy_settings' && (decision.blocked || decision.stopRequested)) {
                    blocked = true;
                    options.status.write(`ConfigChange hook blocked change to ${file}\n`);
                  }
                }
                const result = await agent().emitHook('FileChanged', { file_path: file, event }, options.signal);
                if (result.watchPaths?.length) configWatch?.addInstructionPaths?.(result.watchPaths);
                for (const message of result.systemMessages ?? []) options.status.write(`${message}\n`);
                for (const failure of result.failures ?? []) options.status.write(`${failure}\n`);
              } catch (error) {
                if (!options.signal.aborted) options.status.write(`Config change hook error: ${String(error)}\n`);
              }
              return !blocked;
            })();
          } },
          () => { configDirty = true; awaken(); },
          error => options.status.write(`Config watch error: ${error.message}\n`));
      } catch (error) { options.status.write(`Config watch error: ${String(error)}\n`); }
    }
  };
  const onLine = (line: string, attachment?: import('./terminal.js').PromptDiffSelection) => {
    if (approval) { approval(line); return; }
    // `kEo` (chunk-sfn1dbxq.js 1659192) and `bWe` (1650535) are `immediate`; the recovered submit
    // gate runs them while the turn guard is active (`zn`, chunk-24k7d6mw.js 1491124) instead of
    // queueing them behind the turn.
    const trimmed = line.trim();
    if (turnController && /^\/effort(?:\s|$)/.test(trimmed)) {
      void applyEffortCommand(trimmed).catch(error => {
        if (!options.signal.aborted) options.status.write(`${error instanceof Error ? error.message : String(error)}\n`);
      });
      return;
    }
    if (turnController && /^\/model(?:\s|$)/.test(trimmed)) {
      void applyModelCommand(trimmed.slice('/model'.length).trim()).catch(error => {
        if (!options.signal.aborted) options.status.write(`${error instanceof Error ? error.message : String(error)}\n`);
      });
      return;
    }
    queue.push({ prompt: line, source: 'user', ...(attachment ? { attachment } : {}) });
    promptQueueChanged(); awaken();
  };
  const onClose = () => {
    inputClosed = true;
    if (terminal) turnController?.abort(new Error('Terminal input closed'));
    approval?.(undefined); awaken();
  };
  if (options.signal.aborted) abort();
  rl?.on('line', onLine); rl?.on('close', onClose);
  const unsubscribeTerminal = terminal?.subscribe({ onSubmit: onLine, onExit: onClose,
    onInterrupt: () => turnController?.abort(new Error('Task interrupted')),
    onAction: action => {
      if(action==='chat:externalEditor') {
        if(inputClosed||approval||turnController||editorWork||!terminal?.editDraft)return;
        editorWork=terminal.editDraft(options.signal,session.config.workspace)
          .catch(error=>({content:null,error:String(error)}));
        queue.push({prompt:'/editor',source:'user',meta:true});promptQueueChanged();awaken();return;
      }
      // `e9`/`Zat`/`tlt` (chunk-24k7d6mw.js 887081 / 1343398 / 1343820): the TUI has already
      // queued a non-empty draft. The source flushes the queue through the low-latency channel;
      // without that channel it cancels the live turn only when one holds a queued message
      // (`elt`), which is the fallback this host reproduces. `nothing_to_send` stays a no-op.
      if (action === 'chat:sendNow') {
        if (inputClosed || approval) return;
        if (turnController && queue.some(item => item.source === 'user'))
          turnController.abort(new Error('Send now'));
        return;
      }
      // `Ax`/`Pq`, chunk-24k7d6mw.js [882826,884298): the source updates the permission context
      // synchronously. This host's recovered transition lives on the command boundary, so a busy
      // turn ignores the key rather than queueing a transition that would be refused.
      if (action === 'chat:cycleMode') {
        if (inputClosed || approval || turnController || session.awaitingResponse) return;
        // A command already queued has not reached the owner yet; step from it so a quick second
        // press advances again instead of recomputing the same step from the stale live mode.
        const pending = [...queue].reverse().find(item => item.source === 'user' && item.prompt.startsWith('/permissions '));
        const state = session.permissionOwner.state();
        const command = permissionCycleCommand({ mode: pending?.prompt.slice('/permissions '.length).trim() ?? state.mode,
          isBypassPermissionsModeAvailable: state.isBypassPermissionsModeAvailable });
        // The source applies every press; a full wrap repeats a command that may still be queued.
        if (command !== undefined) { queue.push({ prompt: command, source: 'user', meta: true }); promptQueueChanged(); }
        awaken(); return;
      }
      // Source `aL` (chunk-24k7d6mw.js 881614): the local branch opens (or closes) the picker
      // panel directly (`fa(S8t)`, `S8t = v => !v`), so the chord reaches it mid-turn.
      if (action === 'chat:modelPicker') {
        if (liveDialog?.kind === 'model') { liveDialog.controller.abort(); return; }
        if (!inputClosed && !approval) void openModelPickerLive?.();
        return;
      }
      // `lL` (chunk-24k7d6mw.js 882215) toggles the `SG` dialog the same way (`Iu(w8t)`).
      if (action === 'chat:thinkingToggle') {
        if (liveDialog?.kind === 'thinking') { liveDialog.controller.abort(); return; }
        if (!inputClosed && !approval) void applyThinkingToggle?.();
        return;
      }
      const command = action === 'app:toggleTodos' ? '/tasks' : undefined;
      if (!command || inputClosed || approval) return;
      if (!queue.some(item => item.source === 'user' && item.prompt === command)) {
        queue.push({ prompt: command, source: 'user', meta: true }); promptQueueChanged();
      }
      awaken();
    } });
  let unsubscribe: (() => void) | undefined;
  let activeAgent: Agent | undefined;
  let agentGeneration = 0;
  let rewindPreview: RewindPreview | undefined;
  let formController: AbortController | undefined;
  /** Bound after the picker helpers; the chord handler above runs only after terminal start. */
  let openModelPickerLive: (() => Promise<void>) | undefined;
  let applyThinkingToggle: (() => Promise<void>) | undefined;
  /** The dialog a live chord can close while it is open (the source's panel toggle). */
  let liveDialog: { kind: 'model' | 'thinking'; controller: AbortController } | undefined;
  const withLiveDialog = (kind: 'model' | 'thinking', signal: AbortSignal) => {
    const controller = new AbortController();
    liveDialog = { kind, controller };
    return { controller, signal: AbortSignal.any([signal, controller.signal]),
      release: () => { if (liveDialog?.controller === controller) liveDialog = undefined; } };
  };
  // Same-host peer transport. Admission follows the recipient's current
  // permission mode (`E`, chunk-0ydceggj.js [4491,4991)); accepted text enters
  // the queue as recipient meta input, exactly like a scheduled event, and
  // never as a user prompt.
  let peer: LocalPeerTransport | undefined;
  const peerMode = (): { mode: string; bypassAvailable?: boolean } | null => {
    const mode = session.permissionOwner.state().mode;
    return mode === undefined ? null : { mode };
  };
  const peerExplicit = () => session.config.crossSessionInbound;
  const queuePeerMessage = (message: { text: string; from?: string }) => {
    const eventCount = queue.filter(item => item.source === 'event').length;
    if (eventCount >= 50) {
      const oldest = queue.findIndex(item => item.source === 'event'); queue.splice(oldest, 1);
      options.status.write('Event queue full; dropped the oldest event.\n');
    }
    // `Qe` (chunk-bt8cr7rw.js [5180,6744)): recipient meta, slash commands and
    // attachments skipped; the sender text is untrusted task data.
    queue.push({ prompt: message.text, source: 'event', peer: { from: message.from ?? null } });
  };
  const releasePeerHeld = (cause: string) => {
    try { peer?.releaseHeld(cause); } catch (error) { options.status.write(`Peer held queue error: ${String(error)}\n`); }
  };
  const onPeerEvent = (event: PeerTransportEvent) => {
    if (event.kind === 'message') { queuePeerMessage(event.message); awaken(); }
    else if (event.kind === 'held') options.status.write(`Peer message from ${event.message.from ?? 'unknown'} held for approval: ${event.message.text.slice(0, 200)}\n`);
    else if (event.kind === 'dropped') options.status.write(`Peer message from ${event.message.from ?? 'unknown'} ${event.reason}\n`);
    else if (event.kind === 'listening') options.status.write(`Peer inbox: ${event.address}\n`);
    else if (event.kind === 'error') options.status.write(`Peer transport: ${event.message}\n`);
  };
  const startPeer = async (config: SessionConfig) => {
    if (config.features?.crossSessionMessaging !== true) return;
    try {
      peer = await createLocalPeerTransport({
        userDir: config.configSources?.userDir ?? defaultUserDir(),
        workspace: config.workspace, kind: 'interactive', name: session.id, entrypoint: 'interactive',
        policy: peerExplicit, mode: peerMode,
        // `Ade`: a held message for a mode cause expires after the settings
        // window (default 5m, `never` disables it); the getter keeps a reload live.
        heldTimeoutMs: () => heldApprovalTimeoutMs(session.config.dialogExpiry),
        onEvent: onPeerEvent,
        logger: (message, detail) => { if (detail?.level === 'error') options.status.write(`${message}\n`); },
      });
      peer.setMode(peerMode);
      await peer.setSession(session.id);
    } catch (error) {
      peer = undefined;
      options.status.write(`Peer inbox unavailable: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  };
  const stopPeer = async () => {
    const current = peer; peer = undefined;
    if (current) try { await current.close(); } catch (error) { options.status.write(`Peer cleanup error: ${String(error)}\n`); }
  };
  /** Tools are pinned per turn; the peer tool set joins the runtime's own. */
  const peerTools = () => peer === undefined ? [] : createLocalPeerTools(peer);
  const resolveHeld = async (msgId: string | undefined, decision: 'approve' | 'deny' | 'expire') => {
    if (peer === undefined) throw new Error('Peer transport is unavailable');
    const result = await peer.resolveHeld(msgId, decision);
    options.status.write(`Peer held message ${decision}: ${result}\n`);
  };
  const readDialog = async (request: TerminalPromptRequest, signal: AbortSignal, form = false) => {
    if (!form) formController?.abort();
    if (approval) throw new Error('Another interaction already owns terminal input');
    if (inputClosed || signal.aborted) throw new Error('Interaction input closed');
    const controller = new AbortController();
    // Keep the same owner gate for both the line UI and the modal surface.
    const owner = () => controller.abort();
    const combined = AbortSignal.any([signal, controller.signal]);
    const release = () => { if (approval === owner) approval = undefined; };
    approval = owner; combined.addEventListener('abort', release, { once: true });
    try {
      return await terminal!.prompt!(request, combined);
    } finally { combined.removeEventListener('abort', release); release(); }
  };
  const readAnswer = (prompt: string, signal: AbortSignal, form = false): Promise<string> => {
    if (terminal?.prompt) return readDialog({ message: prompt, allowText: true }, signal, form).then(answer => {
      if (answer?.text === undefined) throw new Error('Interaction cancelled');
      return answer.text;
    });
    if (!form) formController?.abort();
    if (approval) return Promise.reject(new Error('Another interaction already owns terminal input'));
    if (inputClosed || signal.aborted) return Promise.reject(new Error('Interaction input closed'));
    output.write(prompt);
    return new Promise((resolve, reject) => {
      const finish = (value: string | undefined) => {
        if (approval === finish) approval = undefined;
        signal.removeEventListener('abort', cancelled);
        if (value === undefined) reject(new Error('Interaction cancelled')); else resolve(value);
      };
      const cancelled = () => finish(undefined);
      approval = finish; signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled();
    });
  };
  const confirm = async (title: string, message: string, signal: AbortSignal): Promise<boolean> => {
    if (terminal?.prompt) {
      // `confirm:yes` binds enter and `confirm:no` escape (`chunk-6ccen3s8.js` 4063), so the
      // focused row must be Yes: Enter approves and Escape cancels.
      const answer = await readDialog({ title, message, choices: [
        { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' },
      ], defaultIndex: 0 }, signal);
      return answer?.selected[0] === 'yes';
    }
    return /^(y|yes)$/i.test((await readAnswer(`\n${message}\n${title}? [y/N] `, signal)).trim());
  };
  const agent = () => {
    // A plugin catalog change replaces the tool set a later turn can reach; a
    // turn boundary is the only point the session's pinned schemas move.
    const generation = session.config.pluginGeneration ?? 0;
    if (activeAgent !== undefined && agentGeneration !== generation) activeAgent = undefined;
    if (activeAgent === undefined) agentGeneration = generation;
    const base = activeRuntime.buildTools(session.config, session.id);
    const tools = peer === undefined ? base : [...base, ...createLocalPeerTools(peer)];
    // The inbox starts after the session pinned its schemas, so the first turn
    // that can reach the peer tools repins them; `Agent` rejects a mismatch.
    const schemas = pinToolSchemas(tools);
    if (JSON.stringify(schemas) !== JSON.stringify(session.config.tools)) session.config.tools = schemas;
    return activeAgent ??= new Agent(session, provider, tools, {
    // Stop/SubagentStop carry the live background jobs and session cron tasks
    // (`Sle`, chunk-sfn1dbxq.js [2946002,2946104)).
    stopState: () => activeRuntime.stopState?.(session.id) ?? { background_tasks: [], session_crons: [] },
    interaction: {
      ask: async (request, signal) => {
        // One grouped request runs every question and then a review page, which
        // is the recovered flow's last tab; the answers come back in order.
        if (terminal?.prompt && request.questions.length > 0) {
          // `Kdt`/`XZe`: the `askUserQuestionTimeout` setting is the dialog's
          // timeout prop; `never` and an absent setting both disable AFK, while
          // `CLAUDE_AFK_TIMEOUT_MS` still overrides inside the TUI.
          const afkTimeoutMs = askUserQuestionTimeoutMs(session.config.askUserQuestionTimeout);
          const answer = await readDialog({ title: 'Questions', message: '', allowClarification: true,
            afkTimeoutMs, groups: request.questions.map(question => ({
            key: question.question,
            title: question.header ?? 'Question', message: question.question,
            choices: question.options.map(option => ({ ...option, value: option.label })),
            multiple: question.multiSelect, allowText: true, maxTextChars: 4000 })) }, signal);
          if (!answer) throw new Error('Interaction cancelled');
          const answers = request.questions.map((question, questionIndex) => {
            const entry = answer.groups?.find(item => item.key === question.question);
            const selected = entry?.selected ?? [];
            const annotation = terminalAnswerAnnotation(question, selected, entry?.notes);
            return { questionIndex, selected,
              ...(entry?.text === undefined ? {} : { other: entry.text }),
              ...(annotation === undefined ? {} : { annotations: annotation }) };
          });
          // Recovered `P3`/`Qet`: the images attached across every question
          // convert once, before either result leaves the host.
          const images = (answer.groups ?? []).flatMap(entry => entry.images ?? []);
          const blocks = images.length === 0 ? undefined
            : await questionImageBlocks(images, { workspace: session.config.workspace, signal });
          return answer.clarify
            ? { ...questionClarification(request, answers), ...(blocks === undefined ? {} : { contentBlocks: blocks }) }
            : { answers, ...(answer.afkTimeoutMs === undefined ? {} : { afkTimeoutMs: answer.afkTimeoutMs }),
              ...(blocks === undefined ? {} : { contentBlocks: blocks }) };
        }
        const answers = [];
        for (const [questionIndex, question] of request.questions.entries()) {
          if (terminal?.prompt) {
            const answer = await readDialog({ title: question.header ?? 'Question', message: question.question,
              choices: question.options.map(option => ({ ...option, value: option.label })),
              multiple: question.multiSelect, allowText: true, maxTextChars: 4000 }, signal);
            if (!answer) throw new Error('Interaction cancelled');
            const annotation = terminalAnswerAnnotation(question, answer.selected);
            answers.push({ questionIndex, selected: answer.selected,
              ...(answer.text === undefined ? {} : { other: answer.text }),
              ...(annotation === undefined ? {} : { annotations: annotation }) });
            continue;
          }
          const choices = question.options.map((option, index) => {
            const preview = questionPreviewText(option.preview);
            return `${index + 1}. ${option.label}: ${option.description}${preview === undefined ? '' : `\nPreview:\n${preview}`}`;
          }).join('\n');
          const answer = (await readAnswer(`\n${question.question}\n${choices}\n${question.multiSelect ? 'Numbers separated by commas' : 'One number'}, or Other text: `, signal)).trim();
          const indices = /^\d+(?:\s*,\s*\d+)*$/.test(answer) ? answer.split(',').map(value => Number(value.trim()) - 1) : [];
          if (indices.length && indices.every(index => index >= 0 && index < question.options.length) &&
            (question.multiSelect || indices.length === 1)) {
            answers.push({ questionIndex, selected: [...new Set(indices.map(index => question.options[index]!.label))] });
          } else answers.push({ questionIndex, selected: [], other: answer });
        }
        return { answers };
      },
      plan: async (request, signal) => {
        return { approved: await confirm('Approve this plan', request.plan, signal) };
      },
      report: request => {
        for (const finding of request.findings) output.write(`${finding.severity}: ${finding.file}:${finding.line} ${finding.summary}\n`);
      },
    },
    progress: event => terminal?.setProgress?.(event),
    toolResult: result => terminal?.appendToolResult?.(result),
    textStart: () => terminal?.beginAssistantMessage?.(),
    text: text => { if (terminal?.writeAssistantText) terminal.writeAssistantText(text); else output.write(text); },
    textEnd: () => terminal?.endAssistantMessage?.(),
    status: text => { options.status.write(`${text}\n`); },
    // A PermissionRequest deny with `interrupt:true` aborts the turn's
    // controller (chunk-rx2nah4x.js offset 660913); `authorize` receives the
    // turn signal but does not own the controller, so the loop supplies it.
    interruptTurn: () => { turnController?.abort(new Error('Hook interrupt')); },
    instructionFiles: addInstructionPaths,
    ...(terminal?.isTTY ? { terminalSequence: (sequence: string) => terminal.writeTerminalSequence(sequence) } : {}),
    hookOptions: activeRuntime.hookOptions?.(session.config, session.id),
    permission: async request => {
      if (inputClosed || request.signal.aborted) return false;
      const cancelNotification = notifyPermissionPrompt(request.tool, payload => {
        void agent().emitHook('Notification', payload, request.signal).catch(() => {});
      });
      try {
        return await confirm('Allow once', `${request.reason}\n${request.tool}: ${JSON.stringify(request.input).slice(0, 2000)}`, request.signal);
      } catch { return false; }
      finally { cancelNotification(); }
    },
    });
  };
  let formActive = false;
  const elicit: NonNullable<McpClientRequests['elicitation']> = async (params, signal, context) => {
    if (inputClosed || signal.aborted || approval || formActive) return { action: 'cancel' };
    formActive = true;
    const controller = new AbortController(); formController = controller;
    signal = AbortSignal.any([signal, controller.signal]);
    // Elicitation carries the server as `mcp_server_name` (`cvt`,
    // chunk-sfn1dbxq.js [2934222,2934736)).
    const payload = { mcp_server_name: context.serverName, request_id: context.requestId,
      prompt: params.message, mode: params.mode === 'url' ? 'url' as const : 'form' as const,
      ...(params.mode === 'url' ? { url: params.url, elicitation_id: params.elicitationId } : { requested_schema: params.requestedSchema }) };
    try {
      const pre = await agent().emitHook('Elicitation', payload, signal);
      let result: McpElicitationResult = { action: 'cancel' };
      if (pre.blocked || pre.stopRequested) result = { action: 'decline' };
      else if (pre.elicitationResponse) {
        // `Zgn` (chunk-nejdhvxk.js offset 2367): a hook answer replaces the
        // dialog entirely, so the ElicitationResult hooks do not run.
        return pre.elicitationResponse.content === undefined
          ? { action: pre.elicitationResponse.action }
          : { action: pre.elicitationResponse.action,
              content: pre.elicitationResponse.content as McpElicitationResult['content'] };
      } else if (params.mode === 'url') {
        // The recovered host hands the URL to its window, which opens it. This terminal surface
        // shows the URL instead and the person opens it, so the answer is only accept/decline/cancel
        // and no form content is collected.
        const display = `\nMCP URL from ${context.serverName}:\n${params.message}\n${params.url}\n` +
          'Open it, then answer :accept, :decline or :cancel: ';
        if (Buffer.byteLength(display) > session.config.maxOutputBytes) throw new Error('MCP URL request exceeds the display budget');
        const clean = display.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
        for (let attempt = 0; attempt < 3; attempt++) {
          const answer = (await readAnswer(clean, signal, true)).trim().toLowerCase();
          if (answer === ':accept' || answer === ':decline' || answer === ':cancel') {
            result = { action: answer.slice(1) as 'accept' | 'decline' | 'cancel' };
            break;
          }
          output.write('Answer :accept, :decline or :cancel.\n');
        }
      } else {
        const display = `\nMCP form from ${context.serverName}:\n${params.message}\n` +
          JSON.stringify(params.requestedSchema, null, 2) + '\nEnter a JSON object, :decline or :cancel: ';
        if (Buffer.byteLength(display) > session.config.maxOutputBytes) throw new Error('MCP form exceeds the display budget');
        const clean = display.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
        for (let attempt = 0; attempt < 3; attempt++) {
          const answer = (await readAnswer(clean, signal, true)).trim();
          if (answer === ':decline' || answer === ':cancel') { result = { action: answer.slice(1) as 'decline' | 'cancel' }; break; }
          try {
            if (Buffer.byteLength(answer) > 32 * 1024) throw new Error('size');
            result = validateElicitationResult({ action: 'accept', content: JSON.parse(answer) }, params);
            break;
          } catch { output.write('Answer does not match the requested form.\n'); }
        }
      }
      const after = await agent().emitHook('ElicitationResult', { ...payload, elicitation_result: result }, signal);
      // `ehn` (chunk-nejdhvxk.js offset 2849): a blocking result declines, and
      // an answer overrides the action while keeping the person's content when
      // the hook supplies none. The source's response notice has no local
      // notification surface.
      if (after.blocked || after.stopRequested) return { action: 'decline' };
      if (after.elicitationResponse) {
        return {
          action: after.elicitationResponse.action,
          ...(after.elicitationResponse.content !== undefined
            ? { content: after.elicitationResponse.content as McpElicitationResult['content'] }
            : result.content === undefined ? {} : { content: result.content }),
        };
      }
      return result;
    } catch (error) {
      if (!signal.aborted) options.status.write(`MCP form error: ${error instanceof Error ? error.message : String(error)}\n`);
      return { action: 'cancel' };
    } finally { if (formController === controller) formController = undefined; formActive = false; }
  };
  // A new session (clear or fork) runs its SessionStart hooks once. A hook
  // message is prepended to the queue like the recovered claim path
  // (chunk-rx2nah4x.js offset 584530).
  const startAgentSession = async (source: 'clear' | 'fork') => {
    const started = await agent().startSession(source, options.signal);
    if (started?.initialUserMessage !== undefined) queue.unshift({ prompt: started.initialUserMessage, source: 'event' });
    if (started?.watchPaths?.length) addInstructionPaths(started.watchPaths);
  };
  const announce = () => options.status.write(`session: ${session.id}\n`);
  const bindNext = async (candidate: Runtime, next: Session): Promise<Runtime> => {
    try { return await candidate.bindSession?.(next) ?? candidate; }
    catch (error) {
      if (candidate !== activeRuntime) {
        try { await candidate.close(); } catch (cleanupError) { options.status.write(`New runtime cleanup error: ${String(cleanupError)}\n`); }
      }
      if (next !== session) next.close();
      throw error;
    }
  };
  const acceptNext = async (next: Session, nextRuntime: Runtime): Promise<void> => {
    unsubscribe?.();
    try {
      if (nextRuntime !== activeRuntime) await activeRuntime.close();
      else await activeRuntime.releaseSession?.(session.id);
    } catch (error) { options.status.write(`Old runtime cleanup error: ${String(error)}\n`); }
    session.close(); session = next; planResume.accept(next.id); activeRuntime = nextRuntime; activeAgent = undefined; rewindPreview = undefined;
    terminal?.setSessionColor?.(session.sessionColor);
    bindConfigWatch();
    await terminal?.bindInputHistory?.(session);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.source === 'event') queue.splice(i, 1);
    unsubscribe = activeRuntime.subscribe?.(owner => { if (owner === session.id) awaken(); });
  };
  const applyConfig = async (config: SessionConfig, switchingModel: boolean, signal: AbortSignal, modeCommand?: PermissionModeCommand) => {
    signal.throwIfAborted();
    const previousModel = session.config.model;
    const next = Session.open(config.workspace, { config, startedAt: session.startedAt });
    try {
      next.carryPermissions(session, config.permissions?.mode === session.config.permissions?.mode);
      // Y/pEe, frj2b06g [2565,3111), UTF-16: the denial provider survives a settings refresh.
      for (const denial of [...session.autoModeDenials.denials].reverse()) next.autoModeDenials.record(denial);
      const boundaries = new Map<number, number>([[0, 0]]);
      for (const [index, event] of session.events.entries()) {
        if (event.kind === 'message') {
          const copied = structuredClone(event);
          if (Array.isArray(copied.message.content)) {
            copied.message.content = copied.message.content.filter(block => block.type !== 'thinking' && block.type !== 'redacted_thinking');
            if (!copied.message.content.length) copied.message.content = [{ type: 'text', text: '[Prior thinking omitted after configuration change.]' }];
          }
          if (copied.response) copied.response.content = copied.response.content.filter(block => block.type !== 'thinking' && block.type !== 'redacted_thinking');
          next.append(copied);
        }
        if (event.kind === 'compact' || event.kind === 'turn_end') {
          next.append(event);
          if (event.kind === 'turn_end') boundaries.set(index, next.events.length - 1);
        }
        if (event.kind === 'checkpoint' && boundaries.has(event.boundary)) next.append({ ...event, boundary: boundaries.get(event.boundary)! });
        if (event.kind === 'title' || event.kind === 'session_color' || event.kind === 'instruction_watch' || event.kind === 'file_history' || event.kind === 'permission_mode_command') next.append(event);
      }
      next.append({ kind: 'branch', source: session.id, workspace: session.config.workspace, boundary: session.events.length - 1, reason: 'configuration' });
      if (modeCommand) {
        next.permissionUpdates = transitionPlanMode({ ...next.permissionOwner.state(), mode: session.permissionOwner.state().mode }, modeCommand.mode, planResume.runtime);
        next.append(modeCommand);
      }
    } catch (error) { next.close(); throw error; }
    const nextRuntime = await bindNext(activeRuntime, next);
    try { await agent().endSession('config_changed'); } catch (error) { options.status.write(`SessionEnd hook error: ${String(error)}\n`); }
    await acceptNext(next, nextRuntime);
    // The Verbose config row applies to the live surface through the successor session,
    // the same owner handoff `Te` performs beside its settings write.
    terminal?.setVerbose?.(next.config.verbose === true);
    terminal?.setTerminalProgressBar?.(next.config.terminalProgressBarEnabled !== false);
    announce();
    const resumed = await agent().startSession('resume', signal);
    if (resumed?.watchPaths?.length) addInstructionPaths(resumed.watchPaths);
    // Pre/PostModelSwitch carry from_model, to_model and requested_model
    // (`oXr`, chunk-sfn1dbxq.js [2937531,2939081); `sXr`, [2939454,2940852)).
    if (switchingModel) {
      await agent().emitHook('PostModelSwitch', { from_model: previousModel, to_model: config.model,
        requested_model: config.model }, signal);
    }
  };
  const selectTheme = async (theme: ThemeSetting, signal: AbortSignal) => {
    signal.throwIfAborted();
    const config = structuredClone(session.config);
    // The settings write is gated by the watcher-raised ConfigChange event, not
    // by a synchronous hook here (`QXr`, chunk-sfn1dbxq.js [2933599,2933905)).
    signal.throwIfAborted();
    saveThemeSetting(theme, config.configSources?.userDir);
    config.theme = theme;
    await applyConfig(config, false, signal);
    options.status.write(`Theme: ${theme}\n`);
  };
  /**
   * `dk`, chunk-hh0bresc.js 8545: the PreModelSwitch hook gate shared by every switch path.
   * The gate reads the session model before the hooks and re-runs once if a hook moved it, so a
   * slow hook cannot let an accept overwrite a newer choice; a second move blocks the switch.
   */
  const preModelSwitch = async (model: string, signal: AbortSignal, revalidating = false): Promise<void> => {
    // `fw(o())` (chunk-sfn1dbxq.js 2937319) reads the model together with the live permission
    // mode, so a mode change during a hook revalidates just like a model change.
    const identity = () => `${session.config.model ?? ''}\0${session.permissionOwner.state().mode}`;
    const base = identity();
    const pre = await agent().emitHook('PreModelSwitch', { from_model: session.config.model, to_model: model, requested_model: model }, signal);
    const hookReason = pre.permissionDecisionReason;
    if (pre.permissionDecision === 'deny') throw new Error(`Model switch blocked by a PreModelSwitch hook${hookReason === undefined ? '' : `: ${hookReason}`}`);
    if (pre.permissionDecision === 'ask') {
      const approved = await confirm('Switch model', hookReason ?? 'A PreModelSwitch hook asked you to confirm', signal).catch(() => false);
      if (!approved) throw new Error(`Model switch to ${model} was blocked by a PreModelSwitch hook${hookReason === undefined ? '' : `: ${hookReason}`}`);
    }
    if (pre.blocked || pre.stopRequested) throw new Error(pre.reason ?? 'PreModelSwitch hook blocked the change');
    if (identity() !== base) {
      if (revalidating) throw new Error('the session model changed while a PreModelSwitch hook was running; pick again');
      return preModelSwitch(model, signal, true);
    }
  };
  const modelPickerModels = (): string[] =>
    [...new Set([session.config.model,
      ...(session.config.agentTypes ?? []).map(type => type.model),
      ...(session.config.skills ?? []).map(skill => skill.model),
      ...listSessions(session.config.workspace).map(item => item.model)])]
      .filter((model): model is string => Boolean(model) && model !== 'inherit')
      .filter(model => model.length <= 256 && !/[\x00-\x1f\x7f-\x9f]/.test(model)).slice(0, 20);
  /**
   * Picker `w9`/`FL` (chunk-24k7d6mw.js 894465/895434): the chosen model is written to the live
   * session state (`mainLoopModel`, `sessionEffort`) instead of opening a successor session, so
   * the switch works while a turn is running. Enter persists the default; `s` is session-only.
   * The live state moves before the default write, and the write is non-fatal (`R_t` returns
   * `{kind:'failed'}`; its text joins the notice through `x_t`).
   */
  const switchModelInPlace = async (model: string, effort: EffortLevel | undefined, sessionOnly: boolean, signal: AbortSignal) => {
    if (!model || model.length > 256 || /[\x00-\x1f\x7f-\x9f]/.test(model)) throw new Error('Use a model ID of 1 to 256 characters without controls');
    const previous = session.config.model;
    const userDir = session.config.configSources?.userDir;
    await preModelSwitch(model, signal);
    // `X9(Ex, iae(lC), k9, Xn)` at chunk-24k7d6mw.js 894527 is called without `await`, so the
    // live switch never waits on the settings queue and a failed effort-table write does not
    // undo the switch; `s` skips it with the model default.
    if (effort !== undefined && !sessionOnly && userDir !== undefined) {
      const value = persistableEffort(effort), key = modelSettingsKey(model);
      saveConfigModelEffort(model, effort, userDir).then(() => {
        if (value !== undefined && !Object.hasOwn(Object.prototype, key))
          session.config.modelSettings = { ...session.config.modelSettings,
            [key]: { ...session.config.modelSettings?.[key], effortLevel: value } };
      }).catch(() => { /* The source ignores the effort write's failure. */ });
    }
    session.config.model = model;
    if (effort !== undefined) { session.config.effort = effort; session.config.effortSelection = { kind: 'level' }; }
    else {
      const inherited = modelEffort(session.config, model);
      if (inherited === undefined) delete session.config.effort; else session.config.effort = inherited;
    }
    let saveSuffix = ' for this session only';
    if (!sessionOnly && userDir !== undefined) {
      try {
        saveModelSetting(model, userDir);
        saveSuffix = ' and saved as your default for new sessions';
      } catch (error) {
        // `x_t` (chunk-hh0bresc.js 10783): the model stays applied and the notice carries why the
        // default write failed.
        const file = path.join(path.resolve(userDir), 'settings.json');
        const reason = error instanceof SyntaxError ? "isn't valid JSON"
          : `can't be written (${error instanceof Error ? error.message : String(error)})`;
        saveSuffix = ` · couldn't save it as your default: ${file} ${reason}`;
      }
    }
    await agent().emitHook('PostModelSwitch', { from_model: previous, to_model: model, requested_model: model }, signal);
    options.status.write(`Model set to ${model}${saveSuffix}\n`);
  };
  openModelPickerLive = async () => {
    if (!terminal?.prompt) return;
    const live = withLiveDialog('model', options.signal);
    try {
      const answer = await readDialog(modelPickerRequest(modelPickerModels(), session.config.model,
        session.config.effort, true,
        session.config.effortSelection?.kind === 'inherit'
          ? { modelSettings: session.config.modelSettings ?? {}, fallback: session.config.effortSelection.fallback } : undefined),
        live.signal);
      const selected = answer?.selected[0];
      if (!selected || selected === ':cancel') return;
      await switchModelInPlace(selected,
        answer?.adjusted !== undefined && isEffortLevel(answer.adjusted) ? answer.adjusted : undefined,
        answer?.key === 's', options.signal);
    } catch (error) {
      if (!options.signal.aborted && !live.controller.signal.aborted)
        options.status.write(`${error instanceof Error ? error.message : String(error)}\n`);
    } finally { live.release(); }
  };
  /**
   * `/model` inline arm (`R` in chunk-naxwgf3s.js): the argument is applied through the live
   * switch, while the bare command opens the picker. The hook gate and persistence are the same
   * ones W243 uses; the source's availability probe has no local catalogue.
   */
  async function applyModelCommand(argument: string): Promise<void> {
    if (argument === '') { await openModelPickerLive?.(); return; }
    await switchModelInPlace(argument, undefined, false, options.signal);
  }
  /** `MOe`, chunk-0q6c90q6.js 6286: apply the level to live state; the write is the only default arm. */
  async function applyEffortCommand(prompt: string): Promise<void> {
    let sessionOnly = false;
    if (prompt === '/effort' && terminal?.prompt) {
      // It/Ce, chunk-76jkr621.js [22174,30123)/[17514,17916), UTF-16:
      // Enter applies the displayed level even unchanged; s skips the default write.
      const answer = await readDialog(effortSliderRequest(session.config.effort), options.signal);
      const picked = answer?.adjusted;
      if (picked === undefined) { options.status.write('Effort selection cancelled.\n'); return; }
      if (!isEffortLevel(picked)) throw new Error('Invalid effort selection');
      sessionOnly = answer?.key === 's';
      prompt = `/effort ${picked}`;
    }
    const result = effortCommand(prompt.slice('/effort'.length), {
      current: session.config.effort, fallback: DEFAULT_EFFORT, save: !sessionOnly });
    // A read-only answer (usage, help, a status report, an invalid argument) leaves the session
    // alone. The recovered handler returns its answer as a `{type:"text"}` value (`u` at
    // `chunk-tf9zceev.js` [4922,5480)), which the dispatcher prints as text; the `eee` notice is
    // the separate status-row surface.
    if (result.effort === undefined && result.saved === undefined) { output.write(`${result.message}\n`); return; }
    const previousEffort = session.config.effort;
    const previousSelection = session.config.effortSelection;
    if (result.effort === null) {
      delete session.config.effort; session.config.effortSelection = { kind: 'default' };
    } else if (result.effort !== undefined) {
      session.config.effort = result.effort; session.config.effortSelection = { kind: 'level' };
    }
    if (result.saved !== undefined) {
      try {
        saveEffortSetting(result.saved ?? undefined, session.config.configSources?.userDir, session.config.model);
      } catch (error) {
        // `MOe` restores the snapshot taken at the first live update when the write reports no
        // `effortUpdate`, so a failed default write leaves the previous level in place.
        if (previousEffort === undefined) delete session.config.effort; else session.config.effort = previousEffort;
        session.config.effortSelection = previousSelection === undefined ? undefined : { ...previousSelection };
        throw error;
      }
      const key = modelSettingsKey(session.config.model);
      if (session.config.modelSettings !== undefined && !Object.hasOwn(Object.prototype, key)) {
        const entry = { ...session.config.modelSettings[key], effortLevel: persistableEffort(result.saved ?? DEFAULT_EFFORT) };
        if (result.saved === null) delete entry.effortLevel;
        session.config.modelSettings = { ...session.config.modelSettings, [key]: entry };
      }
    }
    output.write(`${result.message}\n`);
    // `eee` at `chunk-24k7d6mw.js` 153296 guards on a present level, so `auto` has none.
    if (session.config.effort !== undefined) options.status.write(`${effortIndicator(session.config.effort)}\n`);
  }
  /**
   * `lL` (chunk-24k7d6mw.js 882215) opens the `SG` dialog; accept `kp` (898567) and cancel `ph`
   * (898638). The accept writes the live state, and `SG` asks once more for a changed value
   * mid-conversation (`627114`). The source's `sendControlRequest` has no local channel here:
   * the request builder reads `config.thinking` on every call, so the live write is enough.
   */
  applyThinkingToggle = async () => {
    if (!terminal?.prompt) return;
    const live = withLiveDialog('thinking', options.signal);
    try {
      const current = session.config.thinking;
      const answer = await readDialog(thinkingDialogRequest(current), live.signal);
      const value = answer?.selected[0];
      if (value !== 'true' && value !== 'false') return;
      const next = value === 'true';
      if (next !== current && session.messages.some(message => message.role === 'assistant')) {
        const proceed = await confirm(THINKING_DIALOG_TITLE,
          `${THINKING_MID_CONVERSATION_WARNING}\n\nDo you want to proceed?`, live.signal);
        if (!proceed) return;
      }
      session.config.thinking = next;
      options.status.write(`Thinking ${next ? 'on' : 'off'}\n`);
    } catch (error) {
      if (!options.signal.aborted && !live.controller.signal.aborted)
        options.status.write(`${error instanceof Error ? error.message : String(error)}\n`);
    } finally { live.release(); }
  };
  /** Co -> Ll/Me, dag4qhha [33770,34600), nybcbd9t [8318,9556), UTF-16; shares the command's hook/save/apply path. */
  const selectModel = async (model: string, effort: EffortLevel | undefined, sessionOnly: boolean, signal: AbortSignal, fromConfig = false) => {
    if (!model || model.length > 256 || /[\x00-\x1f\x7f-\x9f]/.test(model)) throw new Error('Use a model ID of 1 to 256 characters without controls');
    const config = structuredClone(session.config);
    await preModelSwitch(model, signal);
    if (fromConfig && effort !== undefined) {
      await saveConfigModelEffort(model, effort, config.configSources?.userDir);
      const value = persistableEffort(effort), key = modelSettingsKey(model);
      if (value !== undefined && !Object.hasOwn(Object.prototype, key))
        config.modelSettings = { ...config.modelSettings, [key]: { ...config.modelSettings?.[key], effortLevel: value } };
    }
    if (!sessionOnly && config.configSources?.userDir !== undefined) saveModelSetting(model, config.configSources.userDir);
    config.model = model;
    if (effort !== undefined) { config.effort = effort; config.effortSelection = { kind: 'level' }; }
    else {
      const inherited = modelEffort(config, model);
      if (inherited === undefined) delete config.effort; else config.effort = inherited;
    }
    await applyConfig(config, true, signal);
    options.status.write(`Model: ${model}\n`);
  };
  try {
    await terminal?.bindInputHistory?.(session);
    terminal?.bindDiffPanel?.(session);
    terminal?.bindInlineDiff?.(session);
    terminal?.start();
    unsubscribe = activeRuntime.subscribe?.(owner => { if (owner === session.id) awaken(); });
    const bound = await bindNext(activeRuntime, session);
    if (bound !== activeRuntime) {
      unsubscribe?.();
      try { await activeRuntime.close(); } catch (error) { options.status.write(`Old runtime cleanup error: ${String(error)}\n`); }
      activeRuntime = bound;
      unsubscribe = activeRuntime.subscribe?.(owner => { if (owner === session.id) awaken(); });
    }
    options.status.write('Personal harness. /help for commands.\n');
    await startPeer(session.config);
    announce();
    bindConfigWatch();
    while (!options.signal.aborted) {
      if (configDirty && !session.awaitingResponse && !inputClosed) {
        configDirty = false;
        if (!queue.some(item => item.source === 'user' && item.prompt.trim() === '/reload')) {
          queue.unshift({ prompt: '/reload', source: 'user', meta: true }); promptQueueChanged();
        }
      }
      if (!session.awaitingResponse && !inputClosed) {
        for (const event of activeRuntime.drainEvents?.(session.id) ?? []) {
          if (event.kind === "instruction_paths") { addInstructionPaths(event.paths); continue; }
          if (event.kind === 'hook_terminal') {
            session.append({ kind: 'hook_terminal', id: event.id, event: event.event, sequences: event.sequences });
            for (const sequence of event.sequences) terminal?.writeTerminalSequence(sequence);
            continue;
          }
          if (event.kind === 'notification' && event.hookTerminal) {
            const effect = event.hookTerminal;
            session.append({ kind: 'hook_terminal', id: effect.id, event: effect.event, sequences: effect.sequences });
            for (const sequence of effect.sequences) terminal?.writeTerminalSequence(sequence);
          }
          const eventCount = queue.filter(item => item.source === 'event').length;
          if (eventCount >= 50) {
            const oldest = queue.findIndex(item => item.source === 'event'); queue.splice(oldest, 1);
            options.status.write('Event queue full; dropped the oldest event.\n');
          }
          queue.push({ prompt: event.prompt, source: 'event',
            ...(event.kind === 'teammate_idle' ? { idle: { id: event.agentId, name: event.name } } : {}) });
        }
      }
      // Terminal exit cancels its owner; piped line input still drains queued commands.
      if (inputClosed && terminal) break;
      const nextIndex = session.awaitingResponse ? queue.findIndex(item => item.source === 'user') : (queue.length ? 0 : -1);
      if (nextIndex < 0) {
        if (inputClosed) break;
        await new Promise<void>(resolve => { wake = resolve; });
        continue;
      }
      const item = queue.splice(nextIndex, 1)[0]!;
      promptQueueChanged();
      let prompt = item.prompt.trim();
      if (!prompt) continue;
      if (item.source === 'user' && prompt.startsWith('/')) {
        const typed = parseSlashCommand(prompt);
        if (typed !== undefined) {
          const canonical = canonicalCommand(typed.name);
          if (canonical !== typed.name) prompt = `/${canonical}` + (typed.args === '' ? '' : ` ${typed.args}`);
        }
      }
      if (item.source === 'user' && prompt === '/exit') break;
      if (item.source === 'event') {
        if (session.awaitingResponse) { options.status.write('Event deferred until the interrupted turn is continued.\n'); queue.push(item); }
        else {
          try {
            const result = await withTurn(async signal => {
              if (item.idle) {
                // Recovered payload (`qir`, chunk-sfn1dbxq.js [2946651,2946915)) carries the teammate
                // name and team name plus the common agent fields; this runtime has no team name.
                const hook = await agent().emitHook('TeammateIdle', { agent_id: item.idle.id,
                  teammate_name: item.idle.name ?? item.idle.id }, signal);
                if (hook.blocked || hook.stopRequested) { options.status.write('TeammateIdle hook suppressed this idle notification turn.\n'); return { reason: 'hook_blocked', text: "", modelCalls: 0 }; }
              }
              return agent().run(prompt, signal, undefined, undefined, [], undefined,
                item.peer === undefined ? { kind: 'generated', source: 'interactive-event' } : { kind: 'peer', source: 'uds' });
            });
            if (result.modelCalls === 0 && result.text) output.write(result.text);
            output.write('\n');
            options.status.write(`event finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
            // A turn boundary is the only safe point to re-evaluate held
            // messages: a mode change during the turn may now accept them.
            if (item.peer === undefined) releasePeerHeld('turn-complete');
          } catch (error) { options.status.write(`error: ${error instanceof Error ? error.message : String(error)}\n`); }
        }
        continue;
      }
      try {
        if (prompt === '/add-dir' || prompt.startsWith('/add-dir ')) {
          // Source `d` (chunk-dzt2d3te.js 14026) and `lwn` (chunk-340rde3k.js 1608): validate the
          // path, apply `{type:"addDirectories", directories:[abs], destination:"session"}`, then
          // report. `d` discards the apply's own outcome, so this does too, and the session's
          // `adoptPermissionUpdates` is this host's `setToolPermissionContext`.
          const argument = prompt.slice('/add-dir'.length).trim();
          if (!argument) { output.write(`${ADD_DIR_USAGE}\n`); continue; }
          const result = validateAddDirectory({ directoryPath: argument,
            workingDirectories: session.workingDirectories(false), cwd: session.config.workspace });
          if (result.kind !== 'success') { output.write(`${addDirectoryMessage(result)}\n`); continue; }
          session.adoptPermissionUpdates([{ type: 'addDirectories',
            directories: [result.absolutePath], destination: 'session' }]);
          output.write(`${addedForSessionMessage(result.absolutePath)}\n`);
          continue;
        }
        if (prompt === '/tui' || prompt.startsWith('/tui ')) {
          // Source `b1s` (chunk-24k7d6mw.js 64587): the recovered command saves the renderer
          // preference and relaunches into it. This build draws one renderer — the alternate-screen
          // one — and has no relaunch, so the arms that could change something say what they can.
          output.write(`${tuiReport(prompt.slice('/tui'.length))}\n`);
          continue;
        }
        if (prompt === '/focus' || prompt.startsWith('/focus ')) {
          // Source `r` (chunk-4jr9rxry.js [4693,5262)) and the `bEo` panel (chunk-sfn1dbxq.js
          // 1659965): `on`/`off`/empty-toggle, the `XMn` write (`viewMode` in the user settings
          // file) and the live flag the renderer reads. This host draws one fullscreen renderer,
          // so the panel's "needs the fullscreen renderer" arm is unreachable, and it has no
          // managed `viewMode`, so the "set by a managed setting" arm is too. The local-stdin
          // refusal (`bot`) has no local submission channel.
          const current = briefTranscriptEnabled(session.config);
          const argument = parseFocusArgument(prompt.slice('/focus'.length), current);
          if (argument.kind === 'unknown') { output.write(`${focusUnknownArgument(argument.argument)}\n`); continue; }
          // A successor session must not branch or trim an unfinished turn, as the other
          // config commands already refuse that case.
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const mode = focusModeFor(argument.enabled);
          try { saveViewModeSetting(mode, session.config.configSources?.userDir); }
          catch (error) { output.write(`Couldn't save focus view: ${(error as Error).message}\n`); continue; }
          // r, 4jr9rxry [4693,5262), UTF-16: the write is followed by apply_flag_settings; a live
          // owner change needs the successor session, and verbose stays untouched.
          const config = structuredClone(session.config);
          config.viewMode = mode;
          await withTurn(signal => applyConfig(config, false, signal));
          terminal?.setBriefTranscript?.(argument.enabled);
          output.write(`${focusReport(argument.enabled)}\n`);
          continue;
        }
        if (prompt === '/hooks') {
          // Source `Jd` (chunk-5ggmnm67.js 61081) and the `ft` machine: a bare `/hooks` opens the
          // hook list over the hooks the session's settings layers declare. This host merges those
          // layers, so the sources are reconstructed by re-reading them (`attributeHooks`). The
          // recovered `restrictedByPolicy` flag reads `allowManagedHooksOnly`, which this host has
          // no policy key for, so the list is never restricted to managed hooks.
          const layers = hookSettingsLayers(session);
          const settingsPaths = Object.fromEntries(layers.map(layer => [layer.source, layer.file]));
          const hooks = attributeHooks(session.config.hooks ?? {}, layers);
          if (terminal?.prompt) {
            const notice = await browseHooks({ hooks, settingsPaths },
              request => withTurn(signal => readDialog(request, signal)));
            if (notice) options.status.write(notice + '\n');
            continue;
          }
          output.write(hooksReport(hooks) + '\n'); continue;
        }
        if (prompt === '/help') {
          // Source `G` (chunk-yehhb8pt.js 18865): the recovered command docks a tabbed panel in the
          // frame — General, Commands and Custom commands. Without a modal surface the flat list
          // stays, which is what the same command prints for a piped session.
          if (terminal?.prompt) {
            const notice = await browseHelp({
              commands: tuiCommandsWithSkills(session.config.skills),
              rows: process.stdout.rows ?? 24,
              columns: Math.max(40, (process.stdout.columns ?? 80) - 4),
              chords: (action, context, fallback) => chordForAction(action, context, fallback),
            }, request => withTurn(signal => readDialog(request, signal)));
            if (notice) options.status.write(notice + '\n');
            continue;
          }
          output.write(COMMAND_HELP + '\n'); continue;
        }
        if (prompt === '/copy' || prompt.startsWith('/copy ')) {
          const responses = copyResponses(session.events.flatMap(event =>
            event.kind === 'message' ? [event.message] : []));
          if (responses.length === 0) { output.write(`${copyEmptyMessage()}\n`); continue; }
          const argument = parseCopyArgument(prompt.slice('/copy'.length), responses.length);
          if (argument.kind === 'usage') { output.write(`${copyUsageMessage(argument.got)}\n`); continue; }
          if (argument.kind === 'too-many') { output.write(`${copyTooManyMessage(argument.count)}\n`); continue; }
          const text = responses[argument.kind === 'latest' ? 0 : argument.index]!;
          let payload: string;
          try { payload = osc52Payload(text); }
          catch (error) { output.write(`${(error as Error).message}\n`); continue; }
          if (terminal?.writeClipboard) terminal.writeClipboard(payload); else output.write(payload);
          // The recovered `A` still returns its report when the file write fails, so a scratch
          // directory that cannot be created only drops the `Also written to` line.
          let file: string | undefined;
          try { file = writeCopyFile(text); } catch { file = undefined; }
          output.write(`${copyReport(text, file)}\n`);
          continue;
        }
        if (prompt === '/btw' || prompt.startsWith('/btw ')) {
          // `kmt`, chunk-d3s5r8h5.js [1289,3457): one tool-free call over the conversation. The
          // answer is shown in `we`'s panel (chunk-qskwh3r4.js [1877,8641)) and never appended to
          // the transcript. The recovered fork action (`f`) and remote thin-client dispatch are
          // not ported; browsing, clearing and copying are.
          let question = prompt.slice('/btw'.length).trim();
          if (question === '') {
            if (!terminal?.prompt) { output.write(`${SIDE_QUESTION_USAGE}\n`); continue; }
            const typed = await withTurn(signal => readDialog({ title: 'Btw', message: SIDE_QUESTION_PROMPT,
              allowText: true, maxTextChars: 4000 }, signal));
            question = typed?.text?.trim() ?? '';
            if (question === '') continue;
          }
          const outcome = await withTurn(signal => agent().askSideQuestion(question, btwExchanges, signal));
          if (outcome.response === null) { output.write(`${SIDE_QUESTION_NO_RESPONSE}\n`); continue; }
          const current: SideQuestionExchange = { question, response: outcome.response };
          // `N`'s synthetic replies are shown but never joined to the side history.
          if (!outcome.synthetic) btwExchanges.push(current);
          if (!terminal?.prompt) { output.write(`${outcome.response}\n`); continue; }
          let browse: number | null = null;
          for (;;) {
            const shown = browse === null ? current : btwExchanges[browse] ?? current;
            const answer = await withTurn(signal => readDialog({ title: 'Btw', readOnly: true,
              message: sideQuestionPanelText(shown.question, shown.response),
              keys: [{ key: '[', label: 'older' }, { key: ']', label: 'newer' },
                { key: 'x', label: 'clear history' }, { key: 'c', label: 'copy' }] }, signal));
            if (answer === undefined) break;
            if (answer.key === 'c') {
              let payload: string;
              try { payload = osc52Payload(shown.response); }
              catch (error) { output.write(`${(error as Error).message}\n`); continue; }
              if (terminal.writeClipboard) terminal.writeClipboard(payload); else output.write(payload);
              options.status.write(`${SIDE_QUESTION_COPIED}\n`);
              continue;
            }
            if (answer.key === 'x') { btwExchanges.length = 0; browse = null; continue; }
            if (answer.key === '[') {
              if (btwExchanges.length > 0) browse = browse === null ? btwExchanges.length - 1 : Math.max(0, browse - 1);
              continue;
            }
            if (answer.key === ']') {
              if (browse !== null) browse = browse + 1 < btwExchanges.length ? browse + 1 : null;
              continue;
            }
          }
          continue;
        }
        // `ho` (chunk-3f62mcb0.js 25000-ish): an argument writes at once; the bare command opens
        // the method dialog. The method select precedes the filename input, and Esc in the input
        // returns to the method select (`confirm:no` with the rename-style `isActive` gate).
        if (prompt === '/export' || prompt.startsWith('/export ')) {
          const messages = session.events.flatMap(event => event.kind === 'message' ? [event.message] : []);
          const content = exportTranscriptText(messages);
          const save = (filename: string): void => {
            try { output.write(`${exportSavedMessage(writeConversationExport(filename, content, session.config.workspace))}\n`); }
            catch (error) { output.write(`${exportFailedMessage(error)}\n`); }
          };
          const argument = prompt.slice('/export'.length).trim();
          if (argument !== '') { save(argument); continue; }
          if (!terminal?.prompt) { output.write('Usage: /export [filename]\n'); continue; }
          let close = false;
          while (!close) {
            const method = await withTurn(signal => readDialog({ title: EXPORT_DIALOG_TITLE,
              message: EXPORT_DIALOG_SUBTITLE, choices: [
                { label: EXPORT_CLIPBOARD_LABEL, value: 'clipboard', description: EXPORT_CLIPBOARD_DESCRIPTION },
                { label: EXPORT_FILE_LABEL, value: 'file', description: EXPORT_FILE_DESCRIPTION },
              ] }, signal));
            const choice = method?.selected[0];
            if (choice === undefined) { output.write(`${EXPORT_CANCELLED}\n`); break; }
            if (choice === 'clipboard') {
              try {
                const payload = osc52Payload(content);
                if (terminal.writeClipboard) terminal.writeClipboard(payload); else output.write(payload);
                output.write(`${exportCopiedMessage()}\n`);
              } catch (error) { output.write(`${exportFailedMessage(error)}\n`); }
              break;
            }
            const answer = await withTurn(signal => readDialog({ message: EXPORT_FILENAME_PROMPT,
              allowText: true, initialText: exportDefaultFilename(messages) }, signal));
            if (answer?.text === undefined) continue;
            save(answer.text);
            close = true;
          }
          continue;
        }
        if (prompt === '/autocompact' || prompt.startsWith('/autocompact ')) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const model = session.config.model;
          const limit = autoCompactLimit(session.config.contextTokens, session.config.maxTokens);
          const userDir = session.config.configSources?.userDir;
          let argument = prompt.slice('/autocompact'.length).trim();
          // The `local-jsx` registration (`SNt`, chunk-sfn1dbxq.js 1132446) opens the dialog on a
          // bare name and applies the argument directly; the `local` registration (`que`, 1132674)
          // answers the bare form with `w`'s status block. This host renders the dialog when it
          // has a prompt surface and falls back to the block, which is the `m2s` empty arm.
          if (!argument) {
            const resolved = resolveAutoCompactWindow(limit, readAutoCompactSetting(userDir));
            if (!terminal?.prompt) { output.write(`${autoCompactStatus(model, resolved, automaticCompactionEnabled(session.config))}\n`); continue; }
            const answer = await withTurn(signal => readDialog({ title: 'Auto-compact window',
              message: autoCompactDialogMessage(model, resolved, automaticCompactionEnabled(session.config)),
              choices: autoCompactChoices(), defaultIndex: autoCompactSelection(resolved) }, signal));
            const picked = answer?.selected[0];
            // `ue` reports the unchanged caption on cancel and on an accept that moved nothing.
            if (!picked || picked === autoCompactSelectionValue(resolved)) {
              options.status.write(`${autoCompactUnchangedMessage(model, resolved)}\n`); continue;
            }
            argument = picked;
          }
          const result = applyAutoCompactWindow(argument, { model, limit });
          if (result.saved === undefined) { output.write(`${result.message}\n`); continue; }
          try { saveAutoCompactSetting(result.saved === 'auto' ? undefined : result.saved, userDir); }
          catch (error) { output.write(`Couldn't save setting: ${(error as Error).message}\n`); continue; }
          // $2t, agx4redd [1968,3167), UTF-16: apply_flag_settings refreshes the owner after persistence.
          const config = structuredClone(session.config);
          config.compactAt = Math.min(limit, result.saved === 'auto' ? AUTO_COMPACT_FALLBACK : result.saved);
          await withTurn(signal => applyConfig(config, false, signal));
          output.write(`${result.message}\n`);
          continue;
        }
        if (prompt === '/keybindings') {
          // `call`: create the file when it is absent, then hand the terminal to the editor.
          const userDir = session.config.configSources?.userDir ?? defaultUserDir();
          const file = keybindingsFilePath(userDir);
          let created: boolean;
          try { created = writeKeybindingsTemplate(file); }
          catch (error) { output.write(`Couldn't write ${file}: ${(error as Error).message}\n`); continue; }
          const opened = terminal?.openFile
            ? await terminal.openFile(file, options.signal, session.config.workspace)
            : await openExternalFile(file, undefined, options.signal, session.config.workspace);
          output.write(`${keybindingsReport(file, created, opened.error)}\n`);
          continue;
        }
        if (prompt === '/memory' || prompt.startsWith('/memory ')) {
          // `kn` (chunk-xmmahshv.js 45274): a Memory panel over the instruction files the
          // session's loader reads, with the absent user and project files listed so choosing
          // one creates it, then the file is handed to $VISUAL/$EDITOR. Re-read the config so a
          // file added by `/reload` or a rules edit is listed here; the panel itself never edits
          // content.
          const userDir = session.config.configSources?.userDir ?? defaultUserDir();
          let rows: MemoryPanelRow[];
          try {
            const loaded = loadProjectConfig(session.config.workspace, { userDir });
            rows = memoryPanelRows({
              instructions: [...loaded.instructions,
                ...(loaded.conditionalRules ?? []).flatMap(rule => [rule, ...(rule.imports ?? [])])],
              workspace: session.config.workspace,
              userDir,
            });
          } catch (error) {
            output.write(`Couldn't read instruction files: ${(error as Error).message}\n`);
            continue;
          }
          if (!terminal?.prompt) { output.write(`${memoryPanelReport(rows)}\n`); continue; }
          const answer = await withTurn(signal => readDialog({ title: MEMORY_TITLE, message: '',
            choices: rows.map(row => ({ label: row.label, value: row.path, description: row.description })) }, signal));
          const file = answer?.selected[0];
          if (file === undefined) { output.write(`${MEMORY_CANCELLED}\n`); continue; }
          const opened = await openMemoryFile(file, options.signal, session.config.workspace,
            (target, signal, workspace) => terminal?.openFile
              ? terminal.openFile(target, signal, workspace)
              : openExternalFile(target, undefined, signal, workspace),
            () => externalEditorName() !== undefined);
          output.write(`${opened.ok ? memoryOpenedMessage(file, session.config.workspace)
            : memoryOpenFailedMessage(file, session.config.workspace)}\n`);
          continue;
        }
        if (prompt === '/scroll-speed') {
          // `ce`: the recovered dialog is a live adjuster with a demo ruler, so the reachable
          // values and `auto` are the choices here and the pick is applied on accept. The save
          // writes the settings file's `env` block and the live variable, which is what `O` and
          // `Y` do between them. `Xfo`'s gate is `Rc()` (fullscreen) and not a JetBrains
          // terminal; this host always draws its own renderer, so the half that can still say no
          // is the absence of a modal surface.
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const environment = terminalEnvironment();
          const current = currentScrollSpeed(environment);
          const file = scrollSpeedSettingsFile(session.config.configSources?.userDir);
          if (!terminal?.prompt) {
            // The recovered registration has no `local` sibling, so a piped session can only
            // report the value that would apply.
            output.write(`${scrollSpeedNotch(current.value)}${current.explicit ? '' : ' (auto)'}`
              + ` · ${SCROLL_SPEED_ENV}\n`);
            continue;
          }
          if (!scrollSpeedAvailable(environment)) {
            output.write('Scroll speed is fixed by this terminal.\n');
            continue;
          }
          const step = scrollSpeedStep(environment);
          const values = scrollSpeedValues(step);
          const environmentAnswer = await withTurn(signal => readDialog({ title: 'Scroll speed',
            message: scrollSpeedDetail(current, environment),
            choices: [
              { label: `auto (${scrollSpeedNotchCount(autoScrollSpeed(environment))} per notch)`, value: 'auto',
                description: scrollSpeedRuler(autoScrollSpeed(environment)) },
              ...values.map(value => ({ label: scrollSpeedNotch(value), value: String(value),
                description: scrollSpeedRuler(value) })),
            ],
            defaultIndex: current.explicit
              ? Math.max(1, values.indexOf(current.value) + 1) : 0 }, signal));
          const picked = environmentAnswer?.selected[0];
          if (picked === undefined) { output.write(`${SCROLL_SPEED_UNCHANGED}\n`); continue; }
          const value = picked === 'auto' ? undefined : Number(picked);
          try { saveScrollSpeedSetting(value, session.config.configSources?.userDir); }
          catch (error) {
            output.write(`Couldn't save scroll speed: ${(error as Error).message}\n`);
            continue;
          }
          setLiveScrollSpeed(value);
          // The probe caches on the environment, so the new variable has to invalidate it.
          invalidateTerminalEnvironment();
          output.write(`${value === undefined ? scrollSpeedReset(environment, file) : scrollSpeedSaved(value, file)}\n`);
          continue;
        }
        if (prompt === '/color' || prompt.startsWith('/color ')) {
          // `BQn`: the parse answers the reset words, one of the eight, a random pick for an
          // empty argument, or the list. `XKt` then writes the colour as a session record.
          const result = parseSessionColor(prompt.slice('/color'.length));
          if (result.kind === 'invalid') { output.write(`${result.message}\n`); continue; }
          const color = result.kind === 'set' ? result.color : undefined;
          session.append({ kind: 'session_color', color: color ?? null });
          terminal?.setSessionColor?.(color);
          output.write(`${sessionColorMessage(result)}\n`);
          continue;
        }
        if (/^\/peers(?:\s|$)/.test(prompt)) {
          if (peer === undefined) { options.status.write('Peer transport is unavailable.\n'); continue; }
          const listed = await peer.list();
          const text = JSON.stringify({ inbox: peer.address, peers: listed }, null, 2);
          if (Buffer.byteLength(text) > session.config.maxOutputBytes) throw new Error('Peer list exceeds display budget');
          output.write(text + '\n'); continue;
        }
        if (/^\/peer-held(?:\s|$)/.test(prompt)) {
          if (peer === undefined) { options.status.write('Peer transport is unavailable.\n'); continue; }
          const rest = prompt.slice('/peer-held'.length).trim();
          const match = /^(approve|deny|expire) (\d+)$/.exec(rest);
          if (match) {
            const held = peer.held()[Number(match[2]) - 1];
            if (!held) throw new Error('Use /peer-held to list held messages');
            await resolveHeld(held.origin.msgId, match[1] as 'approve' | 'deny' | 'expire');
            continue;
          }
          if (rest && !/^list$/.test(rest)) throw new Error('Use /peer-held [list|approve N|deny N|expire N]');
          const held = peer.held();
          if (held.length === 0) { options.status.write('No held peer messages.\n'); continue; }
          output.write(held.map((message, index) => `${index + 1}. ${message.from ?? 'unknown'} (${message.cause}): ${message.text.slice(0, 500)}`).join('\n') + '\n');
          continue;
        }
        if (/^\/peer-inbound(?:\s|$)/.test(prompt)) {
          const value = prompt.slice('/peer-inbound'.length).trim();
          if (value !== 'accept' && value !== 'hold' && value !== 'refuse' && value !== 'off') throw new Error('Use /peer-inbound accept|hold|refuse|off');
          session.config.crossSessionInbound = value === 'off' ? undefined : value;
          if (value === 'off') options.status.write('Peer inbound follows the permission mode.\n');
          else options.status.write(`Peer inbound policy: ${value}\n`);
          releasePeerHeld('policy-change');
          continue;
        }
        if (prompt === '/editor') {
          const edited=await (editorWork??terminal?.editDraft?.(options.signal,session.config.workspace));editorWork=undefined;
          const report=terminal?.prompt?options.status:output;
          if(edited?.error)report.write(`External editor: ${edited.error}\n`);
          else report.write(edited?.content===null?'External editor returned without changes.\n':'External editor returned.\n');
          continue;
        }
        if (/^\/sessions(?:\s|$)/.test(prompt)) {
          const query = prompt.slice(9).trim().toLowerCase();
          const listed = listSessions(session.config.workspace).filter(item => `${item.id} ${item.title ?? ""} ${item.model} ${item.parent?.id ?? ""}`.toLowerCase().includes(query));
          const text = JSON.stringify(listed.slice(0, 100), null, 2);
          if (Buffer.byteLength(text) > session.config.maxOutputBytes) throw new Error('Session list exceeds display budget; narrow the search');
          output.write(text + '\n'); continue;
        }
        if (/^\/rename(?:\s|$)/.test(prompt)) {
          const title = prompt.slice(7).trim();
          if (!title) throw new Error('Use /rename TITLE');
          session.append({ kind: 'title', title });
          options.status.write(`Session title: ${title}\n`); continue;
        }
        if (/^\/resume(?:\s|$)/.test(prompt)) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn before switching sessions');
          const selector = prompt.slice(7).trim();
          let id = selector;
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selector)) {
            const query = selector.toLowerCase();
            const matches = listSessions(session.config.workspace).filter(item => item.id !== session.id &&
              `${item.id} ${item.title ?? ""} ${item.model} ${item.parent?.id ?? ""}`.toLowerCase().includes(query));
            if (!selector && terminal?.prompt) {
              // Jln, chunk-er09v3xa.js 9331: a bare `/resume` opens the recovered session panel;
              // an argument keeps the source's exact-match path below.
              const answer = await withTurn(signal => readDialog({ title: 'Resume session', message: '',
                resumePicker: { logs: listSessions(session.config.workspace), currentId: session.id,
                  preview: log => readSessionPreview(session.config.workspace, log.id),
                  rename: (log, title) => renameStoredSession(session.config.workspace, log.id, title) } }, signal));
              if (answer?.resume === undefined) { options.status.write('Session selection cancelled.\n'); continue; }
              id = answer.resume.id;
            } else {
              if (!matches.length) throw new Error(selector ? `Session ${selector} was not found.` : 'No matching sessions found');
              if (matches.length === 1) id = matches[0]!.id;
              else if (selector && terminal?.prompt) {
                // X, chunk-14ept3y3.js 22590: `multipleMatches` reports and asks for `/resume`.
                output.write(`Found ${matches.length} sessions matching ${selector}. Please use /resume to pick a specific session.\n`);
                continue;
              } else {
                const page = matches.slice(0, 20);
                const choices = page.map((item, index) => `${index + 1}. ${item.title ?? item.id} | ${item.model} | ${item.updated}${item.active ? ' | locked' : ''}`).join('\n');
                const selectionPrompt = `Sessions${matches.length > page.length ? ' (first 20; use a query to narrow)' : ''}:\n${choices}\nChoose a number, or :cancel: `;
                if (Buffer.byteLength(selectionPrompt) > session.config.maxOutputBytes) throw new Error('Session picker exceeds display budget; narrow the query');
                const selected = (await withTurn(signal => readAnswer(selectionPrompt, signal))).trim();
                if (selected === ':cancel') { options.status.write('Session selection cancelled.\n'); continue; }
                const index = /^([1-9]|1\d|20)$/.test(selected) ? Number(selected) - 1 : -1;
                if (index < 0 || index >= page.length) throw new Error('Choose a displayed session number');
                id = page[index]!.id;
              }
            }
          }
          if (id === session.id) { options.status.write('Session is already active.\n'); continue; }
          if (!activeRuntime.reconfigure) throw new Error('Runtime session switching is unavailable');
          const next = Session.open(session.config.workspace, { id });
          let nextRuntime: Runtime;
          try {
            if (JSON.stringify(next.config.gateway) !== JSON.stringify(session.config.gateway)) throw new Error('Session gateway differs; restart with --resume UUID to recreate the provider');
            const prepared = await activeRuntime.reconfigure(next.config);
            next.carryPermissions(session);
            next.permissionUpdates = planResume.resume(next.id, next.permissionOwner.state(), next.config.permissions?.mode, next.events);
            nextRuntime = await bindNext(prepared, next);
          } catch (error) { next.close(); throw error; }
          try { await agent().endSession('session_switch'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${String(error)}\n`); }
          await acceptNext(next, nextRuntime);
          announce();
          const resumed = await agent().startSession('resume', options.signal);
          if (resumed?.watchPaths?.length) addInstructionPaths(resumed.watchPaths);
          options.status.write(session.awaitingResponse ? 'Session has an unfinished turn; use /continue.\n' : 'Session resumed.\n');
          continue;
        }
        if (prompt === '/agents') {
          const text = JSON.stringify({ builtins: ['general', 'explore', 'fork'],
            types: (session.config.agentTypes ?? []).map(type => ({ name: type.name, ...(type.aliases?.length ? { aliases: type.aliases } : {}), description: type.description,
              mode: type.mode, model: type.model ?? 'inherit' })) }, null, 2);
          if (Buffer.byteLength(text) > session.config.maxOutputBytes) throw new Error('Agent catalog exceeds display budget');
          output.write(text + '\n'); continue;
        }
        if (prompt === '/mcp' && terminal?.prompt) {
          const configured = Object.keys(session.config.mcpServers ?? {});
          if (configured.length === 0) { options.status.write('No MCP servers configured.\n'); continue; }
          for (;;) {
            const statuses = activeRuntime.mcpServers?.() ?? {};
            const counts = mcpToolCounts(configured, session.config.tools.map(tool => tool.name));
            const rows = mcpPanelRows(configured, statuses, counts);
            const answer = await withTurn(signal => readDialog({ title: MCP_PANEL_TITLE,
              message: mcpPanelText(rows),
              choices: rows.map(row => ({ label: row.name, value: row.name, description: row.status })),
              keys: [{ key: 'r', label: 'reconnect' }] }, signal));
            if (answer === undefined) break;
            if (answer.key !== 'r') continue;
            const server = answer.selected[0];
            if (server === undefined) continue;
            if (session.awaitingResponse) throw new Error('Finish or continue the current turn before reconnecting');
            if (!activeRuntime.reconnectMcp) throw new Error('Runtime MCP reconnect is unavailable');
            await withTurn(signal => activeRuntime.reconnectMcp!(server, signal));
          }
          continue;
        }
        if (prompt === '/mcp') {
          const text = JSON.stringify({ servers: Object.keys(session.config.mcpServers ?? {}), limits: activeRuntime.limits,
            ...(activeRuntime.mcpServers ? { connections: activeRuntime.mcpServers() } : {}),
            ...(activeRuntime.notificationStreams ? { notificationStreams: activeRuntime.notificationStreams() } : {}) }, null, 2);
          if (Buffer.byteLength(text) > session.config.maxOutputBytes) throw new Error('MCP catalog exceeds display budget');
          output.write(text + '\n'); continue;
        }
        if (prompt === '/diff' && terminal?.toggleDiffPanel) {
          options.status.write(await terminal.toggleDiffPanel() + '\n');
          continue;
        }
        // The inline presentation: a line-mode session opens the dialog rather than the panel, and
        // `/diff NAME [OFFSET]` keeps its checkpoint meaning below.
        if (prompt === '/diff' && terminal?.toggleInlineDiff) {
          const message = await terminal.toggleInlineDiff();
          if (message) options.status.write(message + '\n');
          continue;
        }
        if (prompt === '/tasks' && terminal?.prompt && activeRuntime.backgroundTasks) {
          // Source `fLt` (`chunk-24k7d6mw.js` 674472): the `Background` dialog over the live
          // registries. `x` is the stop chord; the selection it carries is the focused row.
          let notice: string | undefined;
          for (;;) {
            const items = backgroundTaskItems(activeRuntime.backgroundTasks(session.id));
            if (items.length === 0) {
              await withTurn(signal => readDialog({ title: TASKS_TITLE, message: notice ?? TASKS_EMPTY,
                readOnly: true }, signal));
              break;
            }
            const rows = tasksPanelRows(items);
            const answer = await withTurn(signal => readDialog({
              title: TASKS_TITLE,
              message: [tasksPanelSubtitle(items), notice].filter((part): part is string => part !== undefined).join('\n\n'),
              choices: rows.map(row => ({ label: row.label, value: row.value, description: row.description })),
              keys: [{ key: 'x', label: 'stop' }],
            }, signal));
            if (answer === undefined) break;
            if (answer.key !== 'x') continue;
            const parsed = parseBackgroundTaskValue(answer.selected[0] ?? '');
            if (parsed === undefined) continue;
            const stopped = await activeRuntime.stopTask?.(session.id, parsed.id);
            if (stopped === undefined) { notice = backgroundTaskGoneMessage(); continue; }
            // A stopped shell leaves `active()` only when its process group exits, so
            // hold the panel briefly for the registry to reflect the stop.
            for (let attempt = 0; attempt < 80; attempt++) {
              if (!activeRuntime.backgroundTasks(session.id).jobs.some(job => job.id === parsed.id)) break;
              await new Promise(resolve => setTimeout(resolve, 25));
            }
            notice = undefined;
          }
          continue;
        }
        if (prompt === '/tasks' || prompt === '/cron' || /^\/diff(?:\s|$)/.test(prompt)) {
          const match = /^\/diff ([A-Za-z0-9][A-Za-z0-9_-]{0,63})(?: (0|[1-9]\d*))?$/.exec(prompt);
          if (prompt !== '/tasks' && prompt !== '/cron' && !match) throw new Error('Use /diff NAME [OFFSET]');
          const name = prompt === '/tasks' ? 'task_list' : prompt === '/cron' ? 'cron_list' : 'checkpoint_diff';
          const tool = activeRuntime.buildTools(session.config, session.id).find(tool => tool.schema.name === name);
          if (!tool || !tool.readOnly) throw new Error('Requested inspection feature is disabled');
          const input = match ? { name: match[1], offset: Number(match[2] ?? 0), limit: 50 } : {};
          if (permissionDecision(session.config.permissions, tool, input).decision !== 'allow') throw new Error('Inspection requires an explicit tool allow decision');
          const text = await withTurn(signal => tool.execute(input, { workspace: session.config.workspace,
            signal, allowShell: false, maxOutputBytes: session.config.maxOutputBytes }));
          // Source `C` (chunk-appb2dtz.js [18304,18490)): a scheduled loop job shows as `/loop`, or
          // `/loop (loop.md)`. The tool result itself keeps the literal sentinel.
          output.write((prompt === '/cron' ? displayCronJobs(text) : text) + '\n');
          continue;
        }
        if (prompt === '/loop' || prompt.startsWith('/loop ')) {
          // Source `se` (chunk-1eegq95r.js [22959,24199)): a built-in user-invocable command whose
          // prompt is the loop instructions, with the typed arguments riding at the end of the
          // text. It never runs locally; the expanded text becomes the user turn. An empty input
          // or a bare interval takes the `y` branch over the loop-tasks file instead of `R`.
          const input = prompt.slice('/loop'.length).trim();
          const bare = loopAutonomousInterval(input);
          if (bare === null) prompt = loopCommandPrompt(input);
          else {
            const userDir = session.config.configSources?.userDir ?? defaultUserDir();
            prompt = loopAutonomousPrompt({ file: readLoopFile(session.config.workspace, userDir), ...bare });
          }
        }
        if (prompt === '/workflows') {
          const tool = activeRuntime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'workflow_get');
          if (!tool || permissionDecision(session.config.permissions, tool, {}).decision !== 'allow') throw new Error('Workflow inspection is disabled by configuration or permission');
          const list = () => activeRuntime.listWorkflows?.(session.config, session.id) ?? [];
          // Source `le`/`pe` (chunk-mtw0aefh.js [20074,24977)/[19263,20074)): the command is a
          // docked panel of rows, not a text dump. Without a modal surface the text stays.
          if (terminal?.prompt) {
            const notice = await browseWorkflows(list, request => withTurn(signal => readDialog(request, signal)));
            if (notice) options.status.write(notice + '\n');
            continue;
          }
          const views = list();
          const text = JSON.stringify(views.map(view => ({ id: view.id, status: view.status, started_at: view.started_at,
            ended_at: view.ended_at, tasks: view.tasks.map(task => ({ id: task.id, status: task.status })) })), null, 2);
          if (Buffer.byteLength(text) > session.config.maxOutputBytes) throw new Error('Workflow list exceeds display budget; use workflow_get for a known ID');
          output.write(text + '\n'); continue;
        }
        if (prompt.startsWith('/mcp-reconnect ')) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn before reconnecting');
          const server = prompt.slice('/mcp-reconnect '.length).trim();
          if (!server || !Object.hasOwn(session.config.mcpServers ?? {}, server)) throw new Error('Use /mcp-reconnect SERVER with a configured server name');
          if (!activeRuntime.reconnectMcp) throw new Error('Runtime MCP reconnect is unavailable');
          const status = await withTurn(signal => activeRuntime.reconnectMcp!(server, signal));
          options.status.write(`MCP server ${server} reconnected; generation ${status.generation}; published schemas retained.\n`);
          continue;
        }
        if (prompt === '/reload-skills') {
          // Source `v` (chunk-hyft8yrm.js [13938,14479)): snapshot the catalog by name,
          // rescan it in place, then report what the rescan added or removed. `reloadSkills`
          // is the local rescan — `Fhr`'s dropped skill table and the re-read — and it
          // re-renders the system prompt's skill section, which is this host's stand-in for
          // the source's `i1.emit()`. The composer keeps the command list it captured at
          // startup, so the fresh skill rows are handed back, the local counterpart of the
          // source's shared command table being invalidated (`Nhr`).
          const before = (session.config.skills ?? []).map(skill => skill.name);
          reloadSkills(session.config);
          const after = (session.config.skills ?? []).map(skill => skill.name);
          terminal?.setCommands?.(tuiCommandsWithSkills(session.config.skills));
          output.write(`${reloadSkillsMessage(before, after)}\n`);
          continue;
        }
        if (prompt === '/reload' || prompt === '/mcp-reconnect') {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn before reloading');
          if (!activeRuntime.reconfigure) throw new Error('Runtime configuration reload is unavailable');
          const reconnect = prompt === '/mcp-reconnect';
          if (reconnect && !Object.keys(session.config.mcpServers ?? {}).length) throw new Error('No configured MCP servers to reconnect');
          const config = reconnect ? structuredClone(session.config) : reloadConfig(session.config);
          let nextRuntime = await activeRuntime.reconfigure(config);
          let next: Session | undefined;
          try {
            config.tools = nextRuntime.buildTools(config, 'reload').map(tool => ({ ...structuredClone(tool.schema), eager_input_streaming: true }));
            next = Session.open(config.workspace, { config, startedAt: session.startedAt });
            next.carryPermissions(session);
            const boundaries = new Map<number, number>([[0, 0]]);
            for (const [index, event] of session.events.entries()) {
              if (event.kind === 'message') {
                const copied = structuredClone(event);
                if (Array.isArray(copied.message.content)) copied.message.content = copied.message.content.filter(block =>
                  block.type !== 'thinking' && block.type !== 'redacted_thinking');
                if (Array.isArray(copied.message.content) && copied.message.content.length === 0) {
                  copied.message.content = [{ type: 'text', text: '[Prior thinking omitted after configuration reload.]' }];
                }
                if (copied.response) copied.response.content = copied.response.content.filter(block =>
                  block.type !== 'thinking' && block.type !== 'redacted_thinking');
                next.append(copied);
              }
              if (event.kind === 'compact' || event.kind === 'turn_end') {
                next.append(event);
                if (event.kind === 'turn_end') boundaries.set(index, next.events.length - 1);
              }
              if (event.kind === 'checkpoint' && boundaries.has(event.boundary)) next.append({ ...event, boundary: boundaries.get(event.boundary)! });
              if (event.kind === 'title' || event.kind === 'session_color' || event.kind === "instruction_watch" || event.kind === 'file_history' || event.kind === 'permission_mode_command') next.append(event);
            }
            next.append({ kind: 'branch', source: session.id, workspace: session.config.workspace, boundary: session.events.length - 1, reason: 'reload' });
            nextRuntime = await bindNext(nextRuntime, next);
          } catch (error) { next?.close(); await nextRuntime.close(); throw error; }
          try { await agent().endSession('config_reload'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${String(error)}\n`); }
          await acceptNext(next, nextRuntime);
          // The merged Verbose value reaches the live surface with the reloaded owner.
          terminal?.setVerbose?.(next.config.verbose === true);
          terminal?.setTerminalProgressBar?.(next.config.terminalProgressBarEnabled !== false);
          announce();
          const resumed = await agent().startSession('resume', options.signal);
          if (resumed?.watchPaths?.length) addInstructionPaths(resumed.watchPaths);
          options.status.write(reconnect ? 'MCP servers reconnected; pinned settings retained and tool schemas refreshed.\n' : 'Local configuration reloaded; model, gateway and invocation budgets retained.\n');
          continue;
        }
        if (prompt === '/skills') {
          const skills = session.config.skills ?? [];
          // A session without a modal surface keeps the plain report; the local
          // component `He` (`chunk-hkrgn8hf.js` 23602) is the dialog arm below.
          if (!terminal?.prompt) {
            if (skills.length === 0) { output.write('No skills are available.\n'); continue; }
            const lines = skills.map(skill => {
              const flags = [skill.userInvocable ? '' : 'not user-invocable', skill.disableModelInvocation ? 'model-disabled' : ''].filter(Boolean);
              const suffix = flags.length ? ` (${flags.join(', ')})` : '';
              return `- ${skill.name}${skill.aliases?.length ? ` (aliases: ${skill.aliases.join(", ")})` : ""}${suffix}: ${skill.description === '' ? '(no description)' : skill.description}`;
            });
            output.write(`Skills:\n${lines.join('\n')}\n`);
            continue;
          }
          const userDir = session.config.configSources?.userDir ?? defaultUserDir();
          const settingsPaths = permissionSettingsPaths(session.config.workspace, userDir);
          const localFile = settingsPaths.localSettings;
          let localOverrides = readLocalSkillOverrides(settingsPaths);
          let modes: Record<string, SkillMode> = defaultSkillModes(skills, localOverrides);
          let sortByTokens = false;
          let focus = 0;
          for (;;) {
            const rows = skillPanelRows(skills, { modes, sortByTokens });
            // `settings:sortByTokens` at 29724 is a `t` key; every other answer
            // resolves the focused row, which `enter/space to cycle` at 29731 flips.
            const answer = await withTurn(signal => readDialog({
              title: SKILLS_TITLE,
              message: skillsPanelMessage({ skills, rows, query: '', total: skills.length, sortByTokens }),
              choices: rows.map(row => ({ label: row.label, value: row.value, description: row.description })),
              defaultIndex: Math.min(focus, Math.max(0, rows.length - 1)),
              keys: [{ key: 't', label: sortByTokens ? 'sort by name' : 'sort by tokens' }],
            }, signal));
            if (answer === undefined) {
              // `confirm:no` at 29871 saves before closing; the host dialog's
              // Escape is the same move, so the diff is written here.
              const { diff, writes, effectiveChanged } = skillOverrideDiff(skills, modes, localOverrides);
              if (writes > 0) {
                if (localFile === undefined) { output.write(`${skillsSaveError('no local settings file')}\n`); break; }
                try { saveSkillOverrides(localFile, diff); }
                catch (error) { output.write(`${skillsSaveError((error as Error).message)}\n`); break; }
                localOverrides = applySkillOverrideDiff(localOverrides, diff);
                // `VT()` at 1675922 invalidates the command table after a write.
                reloadSkills(session.config);
                terminal.setCommands?.(tuiCommandsWithSkills(session.config.skills));
              }
              output.write(`${skillsSaveMessage(effectiveChanged)}\n`);
              break;
            }
            if (answer.key === 't') { sortByTokens = !sortByTokens; continue; }
            const row = rows.find(entry => entry.value === answer.selected[0]);
            if (row === undefined || row.locked !== undefined) continue;
            modes = { ...modes, [row.name]: nextSkillMode(modes[row.name] ?? 'on') };
            focus = rows.indexOf(row);
          }
          continue;
        }
        if (prompt === '/context') {
          // Piped sessions keep the JSON contract; the modal surface opens `G`'s panel.
          if (!terminal?.prompt) {
            output.write(JSON.stringify(await withTurn(signal => agent().contextStatus(signal)), null, 2) + '\n');
            continue;
          }
          const counts = await withTurn(signal => agent().contextBreakdown(signal));
          const usage = contextUsageFromCounts({ ...counts, columns: process.stdout.columns ?? 80 });
          await withTurn(signal => readDialog({ title: 'Context', message: contextPanelText(usage),
            readOnly: true }, signal));
          continue;
        }
        if (prompt === '/status' && terminal?.prompt) {
          // `Ofe` mounts the Status tab with the rows `t3n`/`n3n` can answer locally.
          const rows = statusPanelRows({
            version: appVersion(),
            sessionName: latestSessionTitle(session.events),
            sessionId: session.id,
            sessionKind: 'interactive',
            tmux: process.env.TMUX,
            cwd: session.config.workspace,
            model: session.config.model,
            gatewayURL: session.config.gateway !== undefined &&
              session.config.gateway.baseURL !== DEFAULT_GATEWAY.baseURL
              ? session.config.gateway.baseURL : undefined,
          });
          await withTurn(signal => readDialog({ title: STATUS_PANEL_TITLE,
            message: statusPanelText(rows), readOnly: true }, signal));
          continue;
        }
        if ((prompt === '/usage' || prompt === '/cost' || prompt === '/stats') && terminal?.prompt) {
          // `Xje` (chunk-sfn1dbxq.js 1148618) mounts the Settings Stats tab. The vendor's Usage
          // tab reads account plan data, so only the local journal aggregate is ported; `t`
          // cycles `all` -> `7d` -> `30d` through `zn` (chunk-dag4qhha.js 91891).
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const sessions = readUsageSessions(path.join(session.config.workspace, '.agent'));
          // `ni` draws `Fn` from the all-time activity while the rows follow the selected range.
          const heatmap = activityHeatmap(usageStats(sessions, { range: 'all' }).dailyActivity,
            { columns: process.stdout.columns ?? 80 });
          let range: UsageRange = 'all';
          for (;;) {
            const answer = await withTurn(signal => readDialog({ title: STATS_PANEL_TITLE,
              message: usagePanelText(usageStats(sessions, { range }), range, heatmap,
                process.stdout.columns ?? 80), readOnly: true,
              keys: [{ key: 't', label: STATS_RANGE_LABELS[nextUsageRange(range)] }] }, signal));
            if (answer?.key !== 't') break;
            range = nextUsageRange(range);
          }
          continue;
        }
        if (prompt === '/status' || prompt === '/usage' || prompt === '/cost') {
          const responses = session.events.flatMap(event => event.kind === 'message' && event.response ? [event.response] : event.kind === 'compact' ? [event.response] : []);
          output.write(JSON.stringify({ session: session.id, model: session.config.model, theme: session.config.theme ?? 'dark',
            gateway: session.config.gateway?.baseURL, unfinished: session.awaitingResponse,
            contextTokens: session.config.contextTokens, compactAt: session.config.compactAt,
            skills: session.config.skills?.length ?? 0, effort: session.config.effort,
            counting: session.config.gateway?.tokenCounting ?? 'provider',
            cacheCreationInputTokens: responses.reduce((sum, r) => sum + (r.usage.cache_creation_input_tokens ?? 0), 0),
            cacheReadInputTokens: responses.reduce((sum, r) => sum + (r.usage.cache_read_input_tokens ?? 0), 0),
            modelCalls: responses.length,
            inputTokens: responses.reduce((sum, r) => sum + r.usage.input_tokens, 0),
            outputTokens: responses.reduce((sum, r) => sum + r.usage.output_tokens, 0),
          }, null, 2) + '\n');
          continue;
        }
        if (prompt === '/theme') {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          let selected: string | undefined, editing = false;
          if (terminal?.prompt) {
            const choices = await terminal.getThemeChoices?.() ?? themeChoices as { label: string; value: ThemeSetting }[];
            const answer = await withTurn(signal => readDialog({ title: 'Theme',
              message: 'Choose the text style that looks best with your terminal.',
              choices: terminal.editCustomTheme ? [...choices, {label:'New custom theme...', value:'new-custom-theme'}] : choices,
              defaultIndex: Math.max(0, choices.findIndex(choice => choice.value === (session.config.theme ?? 'dark'))),
              themePreview: true, themeEdit: Boolean(terminal.editCustomTheme) }, signal));
            selected = answer?.selected[0]; editing = answer?.themeEdit === true || selected === 'new-custom-theme';
          } else selected = (await withTurn(signal => readAnswer('Theme name, or :cancel: ', signal))).trim();
          if (!selected || selected === ':cancel') { options.status.write('Theme selection cancelled.\n'); continue; }
          if (editing && terminal?.editCustomTheme) {
            await withTurn(async signal => {
              if (selected !== 'new-custom-theme' && selected !== session.config.theme) await selectTheme(parseTheme(selected)!, signal);
              await terminal.editCustomTheme!(selected === 'new-custom-theme' ? undefined : selected,
                theme => theme === session.config.theme ? Promise.resolve() : selectTheme(theme, signal), signal);
            });
            options.status.write('Theme editor closed.\n'); continue;
          }
          prompt = `/theme ${selected}`;
        }
        // The picker's enter arm also makes the pick the default for new sessions; its `s` arm
        // (`modelPicker:thisSessionOnly`) accepts the same row without the settings write.
        let pendingEffort: EffortLevel | undefined;
        let pendingSessionOnly = false;
        if (prompt === '/model') {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          let selected: string | undefined;
          if (terminal?.prompt) {
            // uBe ys/Cr/dr, 24k7d6mw [617998,624627), UTF-16: touched effort is distinct
            // from implicit effort, even after an endpoint or round trip returns to the same level.
            const answer = await withTurn(signal => readDialog(
              modelPickerRequest(modelPickerModels(), session.config.model, session.config.effort, true,
                session.config.effortSelection?.kind === 'inherit'
                  ? { modelSettings: session.config.modelSettings ?? {}, fallback: session.config.effortSelection.fallback } : undefined), signal));
            selected = answer?.selected[0];
            if (answer?.adjusted !== undefined && isEffortLevel(answer.adjusted)) pendingEffort = answer.adjusted;
            pendingSessionOnly = answer?.key === 's';
          } else selected = (await withTurn(signal => readAnswer(`Current model: ${session.config.model}\nModel ID, or :cancel: `, signal))).trim();
          if (!selected || selected === ':cancel') { options.status.write('Model selection cancelled.\n'); continue; }
          // Pr has no same-model early return; Enter can promote the live choice to a default.
          // xWe, hh0bresc [9916,10415), UTF-16, likewise runs the default-save condition.
          prompt = `/model ${selected}`;
        }
        if (prompt === '/config' && terminal?.prompt) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          let state: ConfigPanelState | undefined;
          let problem: string | undefined;
          const changes = new Map<string, string>();
          // bs/Hl/Co, dag4qhha [17007,42182), UTF-16: accepted rows persist immediately; closing only reports.
          for (;;) {
            const answer = await withTurn(signal => readDialog({ title: 'Config', message: '', configPanel: {
              input: configPanelInput(session.config, state),
              change: async update => {
                signal.throwIfAborted();
                const config = structuredClone(session.config);
                try {
                  await saveConfigPanelSetting(update, config.workspace, config.configSources?.userDir);
                  switch (update.id) {
                    // hs/D6, js2bhabe [1114,1554), UTF-16: higher authored layers still win after the user write.
                    case 'autoCompact': {
                      // Row 12035: userSettings plus the global config, no restart. The merged
                      // setting is re-read first so a higher authored layer keeps precedence.
                      const loaded = loadProjectConfig(config.workspace, { ...config.configSources, paths: [] });
                      const enabled = configSchema.shape.autoCompactEnabled.parse(loaded.settings.autoCompactEnabled);
                      session.config.autoCompactEnabled = enabled;
                      changes.set(update.id, `Set ${update.id} to ${enabled}`);
                      return configPanelInput(session.config);
                    }
                    case 'verbose':
                      // `Te`, chunk-nybcbd9t.js 20116: the row writes userSettings, the global
                      // config and the live app state together; `setVerbose` is the terminal's
                      // binding to that state, so no successor session is opened.
                      session.config.verbose = update.value;
                      terminal?.setVerbose?.(update.value === true);
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'progressBar': {
                      // y0 reads the merged setting (`hs`) with default true; re-read it after the write
                      // so a higher authored layer keeps precedence. Row 20203 writes the global
                      // config and the live flag, never a new session.
                      const loaded = loadProjectConfig(config.workspace, { ...config.configSources, paths: [] });
                      const authored = loaded.settings.terminalProgressBarEnabled;
                      const enabled = authored === undefined ? true
                        : configSchema.shape.terminalProgressBarEnabled.parse(authored);
                      session.config.terminalProgressBarEnabled = enabled;
                      terminal?.setTerminalProgressBar?.(enabled !== false);
                      changes.set(update.id, `Set ${update.id} to ${enabled}`);
                      return configPanelInput(session.config);
                    }
                    case 'permissionMode': {
                      // vWe 21908: the settings cache moves without changing the live mode; the
                      // row's value is the merged default (`hs`), so re-read it after the write.
                      const loaded = loadProjectConfig(config.workspace, { ...config.configSources, paths: [] });
                      const raw = loaded.settings.permissions;
                      const defaultMode = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
                        ? permissionPolicySchema.shape.defaultMode.parse((raw as Record<string, unknown>).defaultMode) : undefined;
                      const permissions = session.config.permissions ?? { mode: 'default' as const, allow: [], deny: [] };
                      if (defaultMode === undefined) delete permissions.defaultMode; else permissions.defaultMode = defaultMode;
                      session.config.permissions = permissions;
                      // The owner map is keyed by policy identity; keep the live binding when the
                      // policy object is new so child agents and skills still see the live mode.
                      bindPermissionOwner(session.config.permissions, session.permissionOwner);
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    }
                    case 'reduceMotion':
                      // `vy` row, chunk-nybcbd9t.js: localSettings and the live app settings move
                      // together; the renderer and progress animations read the live value.
                      session.config.prefersReducedMotion = update.value;
                      terminal?.setPrefersReducedMotion?.(update.value === true);
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'thinking':
                      // `nybcbd9t` 15590: the row writes live `thinkingEnabled` and persists its
                      // setting; this host's settings key is `thinking`, written just above, so
                      // the change applies in place instead of opening a successor session.
                      session.config.thinking = update.value;
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'turnDuration':
                      // Row 20771: userSettings plus the global config, no session restart; the
                      // terminal's duration switch is bound to that state.
                      session.config.showTurnDuration = update.value;
                      terminal?.setShowTurnDuration?.(update.value);
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'timeFormat':
                      // Row 21614: persisted setting plus the settings cache; the progress
                      // formatter reads the live value.
                      session.config.timeFormat = update.value;
                      terminal?.setProgressSettings?.({ timeFormat: session.config.timeFormat,
                        timeZone: session.config.timeZone, spinnerVerbs: session.config.spinnerVerbs });
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'editor':
                      // Row 26180: userSettings plus the global config; the editor mode is host
                      // state and applies through `setEditorMode`.
                      session.config.editorMode = update.value;
                      terminal?.setEditorMode?.(update.value, session.config.vimInsertModeRemaps);
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'askUserQuestionTimeout':
                      // vWe 26485: the settings cache moves after the write; the live field is
                      // what a new question dialog reads.
                      session.config.askUserQuestionTimeout = update.value;
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                    case 'dialogExpiry':
                      // vWe 29983: `default` removes the stored key; dialog expiry is read live.
                      if (update.value === 'default') delete session.config.dialogExpiry;
                      else session.config.dialogExpiry = update.value;
                      changes.set(update.id, `Set ${update.id} to ${update.value}`);
                      return configPanelInput(session.config);
                  }
                } catch (error) {
                  terminal.writeNotice?.(`Setting change failed: ${error instanceof Error ? error.message : String(error)}`);
                  throw error;
                }
              },
            }, ...(problem === undefined ? {} : { initialText: problem }) }, signal));
            const result = answer?.configPanel;
            if (result === undefined || result.open === undefined) break;
            state = result.state; problem = undefined;
            try {
              if (result.open === 'timeFormat') {
                const picked = await withTurn(signal => readDialog({ title: 'Time format', message: '',
                  choices: TIME_FORMATS.map(value => ({ label: value, value })),
                  defaultIndex: TIME_FORMATS.findIndex(value => value === session.config.timeFormat) }, signal));
                const value = TIME_FORMATS.find(value => value === picked?.selected[0]);
                if (value !== undefined) {
                  const update: ConfigUpdate = { id: 'timeFormat', value };
                  await saveConfigPanelSetting(update, session.config.workspace, session.config.configSources?.userDir);
                  // Row 21614 has no restart arm; the picker writes the live formatter directly.
                  session.config.timeFormat = value;
                  terminal?.setProgressSettings?.({ timeFormat: session.config.timeFormat,
                    timeZone: session.config.timeZone, spinnerVerbs: session.config.spinnerVerbs });
                  changes.set('timeFormat', `Set timeFormat to ${value}`);
                }
              } else if (result.open === 'theme') {
                const choices = await terminal.getThemeChoices?.() ?? themeChoices as { label: string; value: ThemeSetting }[];
                const picked = await withTurn(signal => readDialog({ title: 'Theme', message: '', choices,
                  defaultIndex: Math.max(0, choices.findIndex(choice => choice.value === (session.config.theme ?? 'dark'))), themePreview: true }, signal));
                const value = parseTheme(picked?.selected[0]);
                if (value !== undefined) {
                  await withTurn(signal => selectTheme(value, signal)); changes.set('theme', `Set theme to ${value}`);
                }
              } else {
                const models = [...new Set([session.config.model, ...(session.config.agentTypes ?? []).map(type => type.model),
                  ...(session.config.skills ?? []).map(skill => skill.model), ...listSessions(session.config.workspace).map(item => item.model)])]
                  .filter((model): model is string => Boolean(model) && model !== 'inherit')
                  .filter(model => model.length <= 256 && !/[\x00-\x1f\x7f-\x9f]/.test(model)).slice(0, 20);
                const inherited = session.config.effortSelection?.kind === 'inherit'
                  ? { modelSettings: session.config.modelSettings ?? {}, fallback: session.config.effortSelection.fallback } : undefined;
                const picked = await withTurn(signal => readDialog(modelPickerRequest(models, session.config.model, session.config.effort, false, inherited), signal));
                const model = picked?.selected[0];
                if (model !== undefined) {
                  await withTurn(signal => selectModel(model, picked?.adjusted !== undefined && isEffortLevel(picked.adjusted) ? picked.adjusted : undefined, false, signal, true));
                  changes.set('model', `Set model to ${model}`);
                }
              }
            } catch (error) {
              options.signal.throwIfAborted(); problem = error instanceof Error ? error.message : String(error);
            }
          }
          terminal.writeNotice?.(changes.size ? [...changes.values()].join('\n') : 'Config dialog dismissed');
          continue;
        }
        if(prompt==='/vim'||prompt==='/config'||/^\/config\s+editor(?:=|\s|$)/.test(prompt)){
          if(session.awaitingResponse)throw new Error('Finish or continue the current turn first');
          const config=structuredClone(session.config);
          const row=editorModeRow(config,(_key:string,value:EditorMode)=>saveEditorMode(value,config.configSources?.userDir),()=>{});
          let picked:string|undefined;
          if(prompt==='/vim'||prompt==='/config'){
            if(prompt==='/vim')options.status.write(vimRedirect('vim')+'\n');
            if(terminal?.prompt){
              const answer=await withTurn(signal=>readDialog({title:'Editor mode',message:'Choose input editing',choices:row.options.map((value:string)=>({label:value,value})),
                defaultIndex:row.options.indexOf(row.value)},signal));
              picked=answer?.selected[0];
            }else{
              const answer=(await withTurn(signal=>readAnswer('Choose input editing\n1. normal\n2. vim\nOne number, or :cancel: ',signal))).trim();
              picked=row.options[Number(answer)-1];
            }
            if(!picked)continue;
          }else{
            const value=prompt.replace(/^\/config\s+editor\s*(?:=|\s)\s*/,'').trim().toLowerCase();
            if(!row.options.includes(value))throw new Error('Use /config editor=normal|vim');picked=value;
          }
          const mode=picked as EditorMode;
          // The user-settings write is gated by the watcher-raised ConfigChange
          // event, not by a synchronous hook here (`QXr`).
          options.signal.throwIfAborted();row.onChange(mode);config.editorMode=mode;
          await applyConfig(config,false,options.signal);options.status.write(`Editor mode: ${mode}\n`);continue;
        }
        if (prompt === '/permissions' && terminal?.prompt) {
          // Source `bTo` (`chunk-sfn1dbxq.js` 1636668: `local-jsx`, `immediate:!0`, no `load`) and
          // the body `gR` (`chunk-fxx7hh8y.js` 91405): the bare command opens the rule panel, while
          // an argument still names a session mode. The panel reads the live state's per-source
          // buckets, which is the local counterpart of the recovered `U0`/`Bc`/`xm`, and applies
          // each change through the same adoption path `/add-dir` uses.
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          // Source `gR` (`chunk-fxx7hh8y.js` 91624): `onRetryDenials` appends the grant and the
          // panel's own exit carries `shouldQuery: true`, so a retry mark starts a turn here.
          let retried = false;
          let autoModeSaved = false;
          let autoModeLayers = session.config.permissions?.layers ?? [];
          const autoModeFile = permissionSettingsPaths(session.config.workspace,
            session.config.configSources?.userDir ?? defaultUserDir()).userSettings;
          // ve/me refresh after both outcomes, di [78011,79476)/[81747,85560), UTF-16.
          const refreshAutoModeLayers = () => {
            const policy = readAutoModePolicy(autoModeFile);
            const user = autoModeLayers.find(layer => layer.source === 'userSettings');
            const updated = user === undefined ? { source: 'userSettings' as const, root: session.config.workspace,
              allow: [], deny: [], ask: [], additionalDirectories: [], autoMode: policy } : { ...user, autoMode: policy };
            autoModeLayers = [...autoModeLayers.filter(layer => layer.source !== 'userSettings'), updated];
          };
          refreshAutoModeLayers();
          // Ms/Gl, fxx7hh8y [63340,63987)/[49877,50106), UTF-16. Owned private files use the existing TTY handoff.
          const editAutoModeFile = async (prefix: string, content: string, keep = false) => {
            const signal = options.signal;
            signal.throwIfAborted();
            const directory = fs.mkdtempSync(path.join(path.dirname(session.file), `${prefix}-`));
            const file = path.join(directory, 'rules.md');
            fs.chmodSync(directory, 0o700);
            try {
              fs.writeFileSync(file, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
              const result = terminal?.openFile ? await terminal.openFile(file, signal, session.config.workspace)
                : await openExternalFile(file, undefined, signal, session.config.workspace);
              signal.throwIfAborted();
              return { ...result, file };
            } finally { if (!keep) fs.rmSync(directory, { recursive: true, force: true }); }
          };
          const autoMode: AutoModeEditorHost = {
            apply: async update => {
              try {
                await session.drainPermissionWrites();
                await persistAutoModeUpdate(autoModeFile, update);
                autoModeSaved = true;
                return {};
              } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
              finally { refreshAutoModeLayers(); }
            },
            editDocument: async lines => {
              if (externalEditorName() === undefined) return { kind: 'problem', canReopen: false,
                message: 'No editor is configured — set $VISUAL or $EDITOR, then reopen /permissions to edit the environment.' };
              try {
                const result = await editAutoModeFile('auto-mode-env-edit', lines.join('\n'));
                return result.content === null ? { kind: 'problem', canReopen: true,
                  message: result.error ?? 'the editor returned no content — reopen to try again.' }
                  : { kind: 'edited', content: result.content };
              } catch (error) {
                options.signal.throwIfAborted();
                return { kind: 'problem', canReopen: true, message: `could not write the file: ${String(error)}` };
              }
            },
            viewRules: async (_section, lines) => {
              try {
                const result = await editAutoModeFile('auto-mode-builtins', lines.join('\n\n'), true);
                return result.error === undefined ? `wrote ${result.file}` : `wrote ${result.file} — ${result.error}`;
              } catch (error) {
                options.signal.throwIfAborted();
                return `could not write the file: ${error instanceof Error ? error.message : String(error)}`;
              }
            },
          };
          const notice = await browsePermissions(() => ({ ...permissionPanelInput(session), autoModeLayers }),
            request => withTurn(signal => readDialog(request, signal)),
            update => applyPermissionPanelUpdate(session, update),
            { onRetryDenials: labels => { session.appendPermissionRetry(labels); retried = true; },
              removeDenial: denial => session.autoModeDenials.remove(denial), autoMode });
          // di refreshes ve/me after writes; FVt's existing configuration branch refreshes the live classifier owner.
          if (autoModeSaved) await withTurn(signal => applyConfig(reloadConfig(session.config), false, signal));
          // The recovered dialog returns its accumulated lines as the command's own result text
          // (`display: "system"`), so the whole block lands in the transcript, not on the status row.
          if (notice) terminal.writeNotice?.(notice);
          if (retried) {
            const result = await withTurn(signal => agent().run(undefined, signal));
            if (result.modelCalls === 0 && result.text) output.write(result.text);
            output.write('\n');
            options.status.write(`finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
          }
          continue;
        }
        // `kEo` (chunk-sfn1dbxq.js 1659192) is an `immediate` local-jsx command; the submit gate
        // (`zn`, chunk-24k7d6mw.js 1491124) lets it run mid-turn. `MOe` (chunk-0q6c90q6.js 6286)
        // applies the level to live state, so no successor session is opened here either.
        if (prompt === '/effort' || prompt.startsWith('/effort ')) {
          await applyEffortCommand(prompt);
          continue;
        }
        if (prompt.startsWith('/model ') || prompt.startsWith('/theme ') || /^\/thinking(?:\s|$)/.test(prompt)
          || prompt === '/plan' || prompt === '/permissions' || prompt.startsWith('/permissions ')) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const config = structuredClone(session.config);
          let modeCommand: PermissionModeCommand | undefined;
          const switchingModel = prompt.startsWith('/model ');
          const switchingTheme = prompt.startsWith('/theme ');
          if (switchingTheme) {
            const theme = parseTheme(prompt.slice(7).trim());
            if (!theme) throw new Error('Theme takes the name of a theme');
            await selectTheme(theme, options.signal); continue;
          } else if (switchingModel) {
            await selectModel(prompt.slice(7).trim(), pendingEffort, pendingSessionOnly, options.signal);
            continue;
          } else if (/^\/thinking(?:\s|$)/.test(prompt)) {
            const value = prompt.slice('/thinking'.length).trim();
            if (value && value !== 'on' && value !== 'off') throw new Error('Use /thinking [on|off]');
            config.thinking = value ? value === 'on' : !config.thinking;
            if (config.thinking === session.config.thinking) { options.status.write('Thinking unchanged.\n'); continue; }
          } else {
            if (session.config.managedPolicy?.permissions !== undefined) throw new Error('Permission mode is pinned by managed settings');
            const mode = prompt === '/plan' ? 'plan' : prompt.slice(13).trim();
            if (!mode) throw new Error('Use /permissions default|plan|acceptEdits|ask|bypass|auto|dontAsk');
            config.permissions = permissionPolicySchema.parse({ ...config.permissions, mode,
              allow: config.permissions?.allow ?? [], deny: config.permissions?.deny ?? [] });
            modeCommand = permissionModeCommand(prompt === '/plan' ? 'plan' : 'permissions', config.permissions.mode,
              session.permissionOwner.state().mode);
            if (config.configSources) config.configSources.overrides = { ...config.configSources.overrides,
              permissions: structuredClone(config.permissions) };
          }
          await applyConfig(config, false, options.signal, modeCommand);
          if (/^\/thinking(?:\s|$)/.test(prompt)) options.status.write(`Thinking: ${config.thinking ? 'on' : 'off'}\n`);
          // The mode change decides whether held peer messages may now enter.
          if (modeCommand !== undefined) releasePeerHeld('mode-change');
          continue;
        }
        if (/^\/worktree-history(?:\s|$)/.test(prompt)) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          if (session.config.worktreeReturn !== undefined) throw new Error('Exit the active worktree before using /worktree-history');
          const rest = prompt.slice('/worktree-history'.length).trim();
          if (!rest) {
            const archives = listWorktreeArchives(session.config.workspace);
            if (!archives.length) { options.status.write('No preserved worktree histories.\n'); continue; }
            const lines = archives.slice(0, 20).map((item, index) =>
              `${index + 1}. ${path.basename(item.archive)} | ${item.sessions} session${item.sessions === 1 ? '' : 's'} | ${item.created}${item.title ? ` | ${item.title}` : ''}`);
            options.status.write(`Preserved worktree histories${archives.length > 20 ? ' (first 20; restore by name)' : ''}:\n${lines.join('\n')}\n`);
            continue;
          }
          const match = /^restore (\S+)$/.exec(rest);
          if (!match) throw new Error('Use /worktree-history [restore ARCHIVE]');
          const restored = await withTurn(signal => restoreWorktreeArchive(session.config.workspace, match[1]!, signal));
          output.write(`Restored worktree history ${path.basename(restored.archive)} to ${restored.path} (${restored.sessions} session${restored.sessions === 1 ? '' : 's'})\n`);
          continue;
        }
        if (prompt === '/cwd' || prompt.startsWith('/cwd ') || /^\/worktree(?:\s|$)/.test(prompt) || /^\/worktree-exit(?:\s|$)/.test(prompt)) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          if (!activeRuntime.reconfigure) throw new Error('Runtime workspace relocation is unavailable');
          const previousWorkspace = session.config.workspace;
          let target: string;
          let worktreeReturn: string | null | undefined;
          let removal: { config: SessionConfig; discard: boolean } | undefined;
          if (/^\/worktree-exit(?:\s|$)/.test(prompt)) {
            const match = /^\/worktree-exit(?: (--remove)( --discard-changes)?)?$/.exec(prompt);
            if (!match) throw new Error('Use /worktree-exit [--remove [--discard-changes]]');
            target = await withTurn(signal => resolveWorktreeExit(session.config, signal));
            if (match[1]) removal = { config: structuredClone(session.config), discard: Boolean(match[2]) };
            worktreeReturn = null;
          } else if (/^\/worktree(?:\s|$)/.test(prompt)) {
            const name = prompt.slice(9).trim();
            const entry = await withTurn(signal => resolveWorktreeEntry(session.config, name, signal));
            target = entry.path; worktreeReturn = entry.origin;
          } else {
            if (session.config.worktreeReturn) throw new Error('Exit the active worktree before using /cwd');
            const directory = prompt.slice(5).trim();
            if (!directory) throw new Error('Use /cwd DIR');
            target = fs.realpathSync(path.resolve(session.config.workspace, directory));
          }
          const nextConfig = { ...structuredClone(session.config), workspace: target };
          if (worktreeReturn === null) delete nextConfig.worktreeReturn;
          else if (worktreeReturn !== undefined) nextConfig.worktreeReturn = worktreeReturn;
          let nextRuntime = await activeRuntime.reconfigure(nextConfig);
          let next: Session | undefined;
          try {
            next = relocateSession(session, target, config => nextRuntime.buildTools(config, 'relocation'),
              worktreeReturn === undefined ? undefined : { worktreeReturn });
            nextRuntime = await bindNext(nextRuntime, next);
          } catch (error) { next?.close(); await nextRuntime.close(); throw error; }
          try { await agent().endSession('cwd_changed'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}\n`); }
          await acceptNext(next, nextRuntime);
          announce();
          const resumed = await agent().startSession('resume', options.signal);
          if (resumed?.watchPaths?.length) addInstructionPaths(resumed.watchPaths);
          if (removal) {
            try {
              const removed = await withTurn(signal => removeExitedWorktree(removal.config, removal.discard, signal));
              output.write(`Removed owned worktree; branch deleted: ${removed.branchDeleted}; history: ${removed.archive ?? 'none'}\n`);
            } catch (error) { options.status.write(`Worktree removal error after return: ${error instanceof Error ? error.message : String(error)}\n`); }
          }
          // CwdChanged carries both directories (`ZXr`, chunk-sfn1dbxq.js
          // [2935532,2935646)); DirectoryAdded carries `directory` and `source`
          // (`lvt`, chunk-sfn1dbxq.js [2933905,2934228)), where `source` is the
          // documented slash-command or registration producer (`jK`,
          // chunk-r2vtj1kh.js offset 203596). This CLI has no /add-dir or
          // register_repo_root, so its relocation commands are the slash-command
          // producer. Failed outputs display after the system messages, as in
          // `ke`/`Pe` (chunk-sfn1dbxq.js [1678937,1679560)).
          const moved = await agent().emitHook('CwdChanged', { old_cwd: previousWorkspace, new_cwd: target }, options.signal);
          if (moved.watchPaths?.length) configWatch?.addInstructionPaths?.(moved.watchPaths);
          for (const failure of moved.failures ?? []) options.status.write(`${failure}\n`);
          const added = await agent().emitHook('DirectoryAdded', { directory: target, source: 'slash_command' }, options.signal);
          for (const failure of added.failures ?? []) options.status.write(`${failure}\n`);
          continue;
        }
        if (prompt === '/checkpoint-recover') {
          if (session.config.features?.checkpoints === false) throw new Error('Checkpoints are disabled in this session');
          output.write(JSON.stringify(await withTurn(signal => Promise.resolve(recoverCheckpoint({ workspace: session.config.workspace,
            signal, allowShell: false, maxOutputBytes: session.config.maxOutputBytes }))), null, 2) + '\n');
          rewindPreview = undefined;
          continue;
        }
        if (/^\/checkpoint(?:\s|$)/.test(prompt)) {
          const match = /^\/checkpoint ([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/.exec(prompt);
          if (!match) throw new Error('Use /checkpoint NAME');
          output.write(JSON.stringify(await withTurn(signal => Promise.resolve(checkpointConversation(session, match[1]!, signal))), null, 2) + '\n');
          rewindPreview = undefined;
          continue;
        }
        if (/^\/rewind \d+ --files(?:\s|$)/.test(prompt)) {
          const match = /^\/rewind (0|[1-9]\d*) --files(?: --apply ([a-f0-9]{64}))?$/.exec(prompt);
          if (!match) throw new Error('Use /rewind N --files [--apply TOKEN]');
          const turn = Number(match[1]);
          if (!match[2]) {
            const preview = await withTurn(signal => Promise.resolve(previewRewind(session, turn, signal)));
            const display = JSON.stringify(preview, null, 2);
            if (Buffer.byteLength(display) > session.config.maxOutputBytes) {
              rewindPreview = undefined;
              throw new Error('Rewind preview exceeds the output budget; use paged checkpoint_diff and selected checkpoint_restore paths');
            }
            rewindPreview = preview;
            output.write(display + '\n');
            output.write(`Apply: /rewind ${turn} --files --apply ${rewindPreview.token}\n`);
            continue;
          }
          if (!rewindPreview || rewindPreview.turn !== turn || rewindPreview.token !== match[2]) {
            throw new Error('Preview this turn with /rewind N --files before applying');
          }
          const preview = rewindPreview;
          // Quiesce owned workers before the final digest check and file effects.
          try { await agent().endSession('rewind'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${String(error)}\n`); }
          await activeRuntime.releaseSession?.(session.id);
          activeAgent = undefined;
          const next = await withTurn(signal => Promise.resolve(applyRewind(session, preview, match[2]!, signal)));
          const nextRuntime = await bindNext(activeRuntime, next);
          await acceptNext(next, nextRuntime);
          announce(); await startAgentSession('fork');
          output.write(`Rewound files and conversation to turn ${turn}; restored ${preview.operations.length} file operations; preserved ${preview.preserved.length} directory/symlink changes.\n`);
          continue;
        }
        if (prompt === '/fork' || prompt === '/clear' || prompt.startsWith('/rewind')) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          let boundary: number | undefined;
          if (prompt.startsWith('/rewind')) {
            const match = /^\/rewind (0|[1-9]\d*)$/.exec(prompt);
            if (!match) throw new Error('Use /rewind N with a completed turn number');
            const turns = session.events.flatMap((event, index) => event.kind === 'turn_end' ? [index] : []);
            boundary = match[1] === '0' ? 0 : turns[Number(match[1]) - 1];
            if (boundary === undefined) throw new Error('Completed turn number does not exist');
          }
          const next = prompt === '/clear' ? Session.open(session.config.workspace, { config: structuredClone(session.config) }) : forkSession(session, boundary);
          if (prompt.startsWith('/rewind')) next.carryPermissions(session);
          const nextRuntime = await bindNext(activeRuntime, next);
          try { await agent().endSession(prompt === '/clear' ? 'clear' : 'fork'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}\n`); }
          await acceptNext(next, nextRuntime); announce();
          await startAgentSession(prompt === '/clear' ? 'clear' : 'fork');
          continue;
        }
        if (/^\/background(?:\s|$)/.test(prompt)) {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          const task = prompt.slice('/background'.length).trim();
          const started = startBackgroundSession({ session, prompt: task });
          output.write(`Backgrounded session ${started.sessionId}${started.pid === undefined ? '' : ` (pid ${started.pid})`}.\n`);
          output.write(`Log: ${started.log}\nResume it with: litcode --resume ${started.sessionId}\n`);
          continue;
        }
        if (/^\/compact(?:\s|$)/.test(prompt)) {
          const instructions = prompt.slice(8).trim();
          await withTurn(signal => agent().compactContext(signal, instructions || undefined));
          options.status.write('Context compacted\n'); continue;
        }
        if (/^\/paste-image(?:\s|$)/.test(prompt)) {
          const task = prompt.slice(12).trim();
          if (!task) throw new Error('Use /paste-image PROMPT');
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          if (session.config.features?.media === false) throw new Error('Media input is disabled in this session');
          const result = await withTurn(async signal => {
            const attachment = await captureClipboardImage(session.config.workspace, signal);
            const target = path.join(session.config.workspace, attachment.path);
            const before = fs.lstatSync(target);
            try { return await agent().run(task, signal, attachment); }
            finally {
              try {
                const after = fs.lstatSync(target);
                if (after.isFile() && !after.isSymbolicLink() && before.dev === after.dev && before.ino === after.ino &&
                  before.mtimeMs === after.mtimeMs && before.size === after.size) fs.unlinkSync(target);
              } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') options.status.write(`Clipboard cleanup error: ${String(error)}\n`); }
            }
          });
          if (result.modelCalls === 0 && result.text) output.write(result.text);
          output.write('\n'); options.status.write(`finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
          continue;
        }
        if (/^\/attach(?:\s|$)/.test(prompt)) {
          const { attachment, prompt: task } = parseAttachmentCommand(prompt.slice(7));
          const result = await withTurn(signal => agent().run(task, signal, attachment));
          if (result.modelCalls === 0 && result.text) output.write(result.text);
          output.write('\n');
          options.status.write(`finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
          continue;
        }
        if (prompt.startsWith('/') && prompt !== '/continue') {
          activeRuntime.buildTools(session.config, session.id);
          const parsed = parseSlashCommand(prompt);
          const skill = parsed ? findSkill(session.config.skills, parsed.name) : undefined;
          if (!parsed || !skill) throw new Error('Unknown command; use /help');
          // The expansion payload names the canonical command, the typed arguments, and the
          // skill's settings scope (`VYr`, chunk-sfn1dbxq.js [2947575,2947964); `prompt` is the
          // command text the source reconstructs).
          const expansion = { expansion_type: 'slash_command' as const, command_name: skill.name,
            command_args: parsed.args, ...(skill.source === undefined ? {} : { command_source: skill.source }),
            prompt: parsed.args === '' ? `/${skill.name}` : `/${skill.name} ${parsed.args}` };
          if (skillRequiresExecution(skill, session.config) && activeRuntime.runSkill) {
            // The expansion hook is raised when the command is typed, before any execution mode
            // (`at`, chunk-htgmc2p1.js [38703,39841)); its verdict gates the skill run.
            const pre = await agent().emitHook('UserPromptExpansion', expansion, options.signal);
            if (pre.blocked) {
              output.write(`${promptBlockMessage('UserPromptExpansion', pre.reason ?? 'blocked', expansion.prompt,
                pre.suppressOriginalPrompt === true)}\n`);
              options.status.write('finished: hook_blocked; model calls: 0\n');
              continue;
            }
            const result = await withTurn(signal => activeRuntime.runSkill!(session.config, session.id, skill, parsed.args, signal,
              async (tool, input, decision) => {
                if (inputClosed || signal.aborted) return { decision: 'deny', reason: 'Input closed' };
                let allowed = false;
                try {
                  allowed = await confirm('Allow once', `${decision.reason ?? 'Skill permission'}\n${tool.schema.name}: ${JSON.stringify(input).slice(0, 2000)}`, signal);
                } catch { /* Cancellation retains a denied permission result. */ }
                return { decision: allowed ? 'allow' : 'deny', reason: allowed ? 'Approved once' : 'Permission declined' };
              }, session.messages));
            if (skill.context === 'fork' || skill.model || skill.effort || skill.background || skill.hooks || skill.allowedTools) {
              output.write(result + '\n'); continue;
            }
            // at, chunk-htgmc2p1.js [38703,39841), UTF-16, returns hookMessages after one raise.
            const completed = await withTurn(signal => agent().run(result, signal, undefined,
              { kind: 'raised', payload: expansion }, pre.additionalContext));
            output.write('\n'); options.status.write(`finished: ${completed.reason}; model calls: ${completed.modelCalls}\n`); continue;
          }
          const expanded = expandUserSkill(skill, parsed.args, session.config);
          const result = await withTurn(signal => agent().run(expanded, signal, undefined, expansion));
          if (result.modelCalls === 0 && result.text) output.write(result.text);
          output.write('\n');
          options.status.write(`finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
          continue;
        }
        const before = session.events.length;
        const attachment = item.attachment?.sessionId === session.id ? item.attachment : undefined;
        let result;
        try {
          result = await withTurn(signal => agent().run(prompt === '/continue' ? undefined : prompt, signal,
            undefined, undefined, [], attachment?.selection));
        } finally {
          if (attachment && !session.events.slice(before).some(event => event.kind === 'message'
            && event.message.role === 'user' && event.isMeta)) terminal?.restoreDiffSelection?.(attachment);
        }
        if (result.modelCalls === 0 && result.text) output.write(result.text);
        output.write('\n');
        options.status.write(`finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
      } catch (error) {
        options.status.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
        if (options.signal.aborted) break;
      }
    }
  } finally {
    taskUnsubscribe?.(); taskUnsubscribe = undefined;
    configWatch?.close();
    options.signal.removeEventListener('abort', abort);
    unsubscribe?.(); unsubscribeTerminal?.(); rl?.off('line', onLine); rl?.off('close', onClose);
    rl?.close(); terminal?.close();
    await editorWork;editorWork=undefined;
    await terminal?.flushStatusLine?.();
    await terminal?.flushInputHistory?.();
    await stopPeer();
    try { await (activeAgent ?? agent()).endSession(options.signal.aborted ? 'interrupt' : 'prompt_input_exit'); }
    catch (error) { options.status.write(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}\n`); }
    try { await activeRuntime.releaseSession?.(session.id); }
    finally {
      session.close();
      if (activeRuntime !== runtime) await activeRuntime.close();
    }
  }
}
