import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { Agent } from './agent.js';
import type { ModelProvider } from './provider.js';
import { Session, type SessionConfig } from './session.js';
import { createTerminalInput, questionPreviewText, type TerminalSurface, type TerminalPromptRequest } from './terminal.js';
import { skillRequiresExecution } from './skill-runtime.js';
import { relocateSession } from './workspace-session.js';
import fs from 'node:fs';
import path from 'node:path';
import { InteractivePlanResume, permissionModeCommand, transitionPlanMode, type PermissionModeCommand } from './plan-resume.js';
import { permissionPolicySchema } from './permissions.js';
import { forkSession, listSessions } from './sessions.js';
import { startBackgroundSession } from './background-session.js';
import { parseAttachmentCommand } from './media.js';
import { questionClarification, terminalAnswerAnnotation } from './interaction-tools.js';
import { checkpointConversation, previewRewind, applyRewind, type RewindPreview } from './rewind.js';
import { recoverCheckpoint } from './checkpoints.js';
import { reloadConfig } from './reload.js';
import { promptBlockMessage } from './hooks.js';
import { validateElicitationResult, type McpClientRequests, type McpElicitationResult } from './mcp-client-requests.js';
import { captureClipboardImage } from './clipboard.js';
import { listWorktreeArchives, recoverWorktreeArchives, resolveWorktreeEntry, resolveWorktreeExit, removeExitedWorktree, restoreWorktreeArchive } from './worktree-session.js';
import { permissionDecision } from './permissions.js';
import { watchProjectConfig, type ConfigWatcher } from './config-watch.js';
import { defaultUserDir, loadProjectConfig } from './config.js';
import { saveThemeSetting, saveEditorMode } from './theme-settings.js';
import { editorModeRow, vimRedirect } from './tui-vim-settings-source.js';
import type { EditorMode } from './tui-vim.js';
import { parseTheme, themeChoices, type ThemeSetting } from './tui-theme-state.js';
import { workflowsAvailable } from './tui-input-highlights.js';
import {
  expandUserSkill,
  findSkill,
  parseSlashCommand,
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

export const COMMAND_HELP = `/help       Show commands
/status     Show session, model, context settings and usage
/context    Count current request against the configured context budget
/usage      Show recorded model usage
/effort LEVEL  Start a session with low/medium/high/xhigh/max effort
/sessions [QUERY]  List/search workspace sessions by title, model or UUID
/resume [UUID|QUERY]  Resume a matching session or choose from a local list
/rename TITLE  Set the current session title
/skills     List available skills
/agents     List configured local agent types
/mcp        Show configured MCP servers and adapter limitations
/mcp-reconnect [SERVER]  Reconnect one server in place, or all servers into a new session
/tasks      Show workspace task dependencies and readiness
/workflows  Show this session workflow runs, including saved runs
/cron       Show scheduled prompts in the active session
/diff NAME [OFFSET]  Show a page of file changes against a checkpoint
/reload     Reload local instructions, skills, hooks, tools and settings into a new session
/attach PATH [--pages RANGE] PROMPT  Submit an image/PDF with a task (quote paths with spaces)
/paste-image PROMPT  Read a PNG image from the clipboard and submit it with a task
/NAME args  Run an available skill by name
/continue   Resume an interrupted turn
/compact    Summarize completed history
/fork       Fork completed history into a new session
/background [PROMPT]  Fork this session into a detached background task
/rewind N   Branch conversation at completed turn N (files stay as they are)
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
/permissions MODE  Start a session in default/plan/acceptEdits/ask/bypass mode
/editor     Edit the current draft in VISUAL/EDITOR (Ctrl+G at a terminal)
/config editor=normal|vim  Save and apply the input editor mode
/vim        Open the Editor mode setting
/clear      Start a new session without changing existing logs
/exit       Close the interactive session
Other text is sent as a task.`;

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
  const queue: { prompt: string; source: 'user' | 'event'; idle?: { id: string; name: string | null };
    attachment?: import('./terminal.js').PromptDiffSelection }[] = [];
  // The recovered prologue prepends the SessionStart message to the user input
  // queue (`prependUserMessage`, chunk-rx2nah4x.js offset 472137), so it runs
  // before anything typed or piped at startup.
  if (options.initialUserMessage !== undefined) queue.push({ prompt: options.initialUserMessage, source: 'user' });
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
    terminal?.setProgressSettings?.({timeFormat:session.config.timeFormat, timeZone:session.config.timeZone,
      spinnerVerbs:session.config.spinnerVerbs});
    terminal?.setMaxProseWidth?.(session.config.maxProseWidth);
    terminal?.setSyntaxHighlightingDisabled?.(session.config.syntaxHighlightingDisabled);
    terminal?.setWorkflowKeywordSettings?.({
      available: workflowsAvailable(session.config.enableWorkflows),
      triggerEnabled: session.config.workflowKeywordTriggerEnabled ?? true,
    });
    terminal?.bindThemeCatalog?.(session.config.configSources?.userDir, session.config.workspace, session.config.plugins);
    terminal?.setTheme?.(session.config.theme);
    terminal?.bindStatusLine?.(session);
    terminal?.bindDiffPanel?.(session);
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
    queue.push({ prompt: line, source: 'user', ...(attachment ? { attachment } : {}) }); awaken();
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
        queue.push({prompt:'/editor',source:'user'});awaken();return;
      }
      const command = action === 'chat:modelPicker' ? '/model' : action === 'chat:thinkingToggle' ? '/thinking'
        : action === 'app:toggleTodos' ? '/tasks' : undefined;
      if (!command || inputClosed || approval) return;
      if (!queue.some(item => item.source === 'user' && item.prompt === command)) queue.push({ prompt: command, source: 'user' });
      awaken();
    } });
  let unsubscribe: (() => void) | undefined;
  let activeAgent: Agent | undefined;
  let agentGeneration = 0;
  let rewindPreview: RewindPreview | undefined;
  let formController: AbortController | undefined;
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
      const answer = await readDialog({ title, message, choices: [
        { label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' },
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
    return activeAgent ??= new Agent(session, provider, activeRuntime.buildTools(session.config, session.id), {
    // Stop/SubagentStop carry the live background jobs and session cron tasks
    // (`Sle`, chunk-sfn1dbxq.js [2946002,2946104)).
    stopState: () => activeRuntime.stopState?.(session.id) ?? { background_tasks: [], session_crons: [] },
    interaction: {
      ask: async (request, signal) => {
        // One grouped request runs every question and then a review page, which
        // is the recovered flow's last tab; the answers come back in order.
        if (terminal?.prompt && request.questions.length > 0) {
          const answer = await readDialog({ title: 'Questions', message: '', allowClarification: true,
            groups: request.questions.map(question => ({
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
          return answer.clarify ? questionClarification(request, answers) : { answers };
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
        if (event.kind === 'title' || event.kind === 'instruction_watch' || event.kind === 'file_history' || event.kind === 'permission_mode_command') next.append(event);
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
  try {
    await terminal?.bindInputHistory?.(session);
    terminal?.bindDiffPanel?.(session);
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
    announce();
    bindConfigWatch();
    while (!options.signal.aborted) {
      if (configDirty && !session.awaitingResponse && !inputClosed) {
        configDirty = false;
        if (!queue.some(item => item.source === 'user' && item.prompt.trim() === '/reload')) queue.unshift({ prompt: '/reload', source: 'user' });
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
      let prompt = item.prompt.trim();
      if (!prompt) continue;
      if (item.source === 'user' && (prompt === '/exit' || prompt === '/quit')) break;
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
              return agent().run(prompt, signal, undefined, undefined, [], undefined, { kind: 'generated', source: 'interactive-event' });
            });
            if (result.modelCalls === 0 && result.text) output.write(result.text);
            output.write('\n');
            options.status.write(`event finished: ${result.reason}; model calls: ${result.modelCalls}\n`);
          } catch (error) { options.status.write(`error: ${error instanceof Error ? error.message : String(error)}\n`); }
        }
        continue;
      }
      try {
        if (prompt === '/help') { output.write(COMMAND_HELP + '\n'); continue; }
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
            if (!matches.length) throw new Error('No matching sessions found');
            if (matches.length === 1) id = matches[0]!.id;
            else {
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
        if (prompt === '/tasks' || prompt === '/cron' || /^\/diff(?:\s|$)/.test(prompt)) {
          const match = /^\/diff ([A-Za-z0-9][A-Za-z0-9_-]{0,63})(?: (0|[1-9]\d*))?$/.exec(prompt);
          if (prompt !== '/tasks' && prompt !== '/cron' && !match) throw new Error('Use /diff NAME [OFFSET]');
          const name = prompt === '/tasks' ? 'task_list' : prompt === '/cron' ? 'cron_list' : 'checkpoint_diff';
          const tool = activeRuntime.buildTools(session.config, session.id).find(tool => tool.schema.name === name);
          if (!tool || !tool.readOnly) throw new Error('Requested inspection feature is disabled');
          const input = match ? { name: match[1], offset: Number(match[2] ?? 0), limit: 50 } : {};
          if (permissionDecision(session.config.permissions, tool, input).decision !== 'allow') throw new Error('Inspection requires an explicit tool allow decision');
          output.write(await withTurn(signal => tool.execute(input, { workspace: session.config.workspace,
            signal, allowShell: false, maxOutputBytes: session.config.maxOutputBytes })) + '\n');
          continue;
        }
        if (prompt === '/workflows') {
          const tool = activeRuntime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'workflow_get');
          if (!tool || permissionDecision(session.config.permissions, tool, {}).decision !== 'allow') throw new Error('Workflow inspection is disabled by configuration or permission');
          const views = activeRuntime.listWorkflows?.(session.config, session.id) ?? [];
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
              if (event.kind === 'title' || event.kind === "instruction_watch" || event.kind === 'file_history' || event.kind === 'permission_mode_command') next.append(event);
            }
            next.append({ kind: 'branch', source: session.id, workspace: session.config.workspace, boundary: session.events.length - 1, reason: 'reload' });
            nextRuntime = await bindNext(nextRuntime, next);
          } catch (error) { next?.close(); await nextRuntime.close(); throw error; }
          try { await agent().endSession('config_reload'); }
          catch (error) { options.status.write(`SessionEnd hook error: ${String(error)}\n`); }
          await acceptNext(next, nextRuntime);
          announce();
          const resumed = await agent().startSession('resume', options.signal);
          if (resumed?.watchPaths?.length) addInstructionPaths(resumed.watchPaths);
          options.status.write(reconnect ? 'MCP servers reconnected; pinned settings retained and tool schemas refreshed.\n' : 'Local configuration reloaded; model, gateway and invocation budgets retained.\n');
          continue;
        }
        if (prompt === '/skills') {
          const skills = session.config.skills ?? [];
          if (skills.length === 0) { output.write('No skills are available.\n'); continue; }
          const lines = skills.map(skill => {
            const flags = [skill.userInvocable ? '' : 'not user-invocable', skill.disableModelInvocation ? 'model-disabled' : ''].filter(Boolean);
            const suffix = flags.length ? ` (${flags.join(', ')})` : '';
            return `- ${skill.name}${skill.aliases?.length ? ` (aliases: ${skill.aliases.join(", ")})` : ""}${suffix}: ${skill.description === '' ? '(no description)' : skill.description}`;
          });
          output.write(`Skills:\n${lines.join('\n')}\n`);
          continue;
        }
        if (prompt === '/context') {
          output.write(JSON.stringify(await withTurn(signal => agent().contextStatus(signal)), null, 2) + '\n');
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
        if (prompt === '/model') {
          if (session.awaitingResponse) throw new Error('Finish or continue the current turn first');
          let selected: string | undefined;
          if (terminal?.prompt) {
            const models = [...new Set([session.config.model,
              ...(session.config.agentTypes ?? []).map(type => type.model).filter((model): model is string => Boolean(model) && model !== 'inherit'),
              ...listSessions(session.config.workspace).map(item => item.model)])]
              .filter(model => model.length <= 256 && !/[\x00-\x1f\x7f-\x9f]/.test(model)).slice(0, 20);
            const answer = await withTurn(signal => readDialog({ title: 'Model',
              message: `Current: ${session.config.model}\nChoose a local model or enter another gateway model ID.`,
              choices: models.map(model => ({ label: model, value: model })), allowText: true, maxTextChars: 256 }, signal));
            selected = answer?.text ?? answer?.selected[0];
          } else selected = (await withTurn(signal => readAnswer(`Current model: ${session.config.model}\nModel ID, or :cancel: `, signal))).trim();
          if (!selected || selected === ':cancel') { options.status.write('Model selection cancelled.\n'); continue; }
          if (selected === session.config.model) { options.status.write('Model unchanged.\n'); continue; }
          prompt = `/model ${selected}`;
        }
        if(prompt==='/vim'||/^\/config\s+editor(?:=|\s|$)/.test(prompt)){
          if(session.awaitingResponse)throw new Error('Finish or continue the current turn first');
          const config=structuredClone(session.config);
          const row=editorModeRow(config,(_key:string,value:EditorMode)=>saveEditorMode(value,config.configSources?.userDir),()=>{});
          let picked:string|undefined;
          if(prompt==='/vim'){
            options.status.write(vimRedirect('vim')+'\n');
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
        if (prompt.startsWith('/model ') || prompt.startsWith('/theme ') || prompt.startsWith('/effort ') || /^\/thinking(?:\s|$)/.test(prompt)
          || prompt === '/plan' || prompt.startsWith('/permissions ')) {
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
            const model = prompt.slice(7).trim();
            if (!model || model.length > 256 || /[\x00-\x1f\x7f-\x9f]/.test(model)) throw new Error('Use a model ID of 1 to 256 characters without controls');
            const pre = await agent().emitHook('PreModelSwitch', { from_model: config.model, to_model: model,
              requested_model: model }, options.signal);
            // The recovered hook runner maps deny to a blocking error and ask
            // to a confirmation requirement (`oXr`, chunk-sfn1dbxq.js offset
            // 2937531); the user-facing texts are the `RWe`/`jU` shapes.
            const hookReason = pre.permissionDecisionReason;
            if (pre.permissionDecision === 'deny') {
              throw new Error(`Model switch blocked by a PreModelSwitch hook${hookReason === undefined ? '' : `: ${hookReason}`}`);
            }
            if (pre.permissionDecision === 'ask') {
              const approved = await confirm('Switch model', hookReason ?? 'A PreModelSwitch hook asked you to confirm',
                options.signal).catch(() => false);
              if (!approved) {
                throw new Error(`Model switch to ${model} was blocked by a PreModelSwitch hook${hookReason === undefined ? '' : `: ${hookReason}`}`);
              }
            }
            if (pre.blocked || pre.stopRequested) throw new Error(pre.reason ?? 'PreModelSwitch hook blocked the change');
            config.model = model;
          } else if (prompt.startsWith('/effort ')) {
            const effort = prompt.slice(8).trim();
            if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error('Use /effort low|medium|high|xhigh|max');
            config.effort = effort as NonNullable<typeof config.effort>;
          } else if (/^\/thinking(?:\s|$)/.test(prompt)) {
            const value = prompt.slice('/thinking'.length).trim();
            if (value && value !== 'on' && value !== 'off') throw new Error('Use /thinking [on|off]');
            config.thinking = value ? value === 'on' : !config.thinking;
            if (config.thinking === session.config.thinking) { options.status.write('Thinking unchanged.\n'); continue; }
          } else {
            if (session.config.managedPolicy?.permissions !== undefined) throw new Error('Permission mode is pinned by managed settings');
            const mode = prompt === '/plan' ? 'plan' : prompt.slice(13).trim();
            config.permissions = permissionPolicySchema.parse({ ...config.permissions, mode,
              allow: config.permissions?.allow ?? [], deny: config.permissions?.deny ?? [] });
            modeCommand = permissionModeCommand(prompt === '/plan' ? 'plan' : 'permissions', config.permissions.mode,
              session.permissionOwner.state().mode);
            if (config.configSources) config.configSources.overrides = { ...config.configSources.overrides,
              permissions: structuredClone(config.permissions) };
          }
          await applyConfig(config, switchingModel, options.signal, modeCommand);
          if (switchingModel) options.status.write(`Model: ${config.model}\n`);
          else if (/^\/thinking(?:\s|$)/.test(prompt)) options.status.write(`Thinking: ${config.thinking ? 'on' : 'off'}\n`);
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
        if (prompt.startsWith('/cwd ') || /^\/worktree(?:\s|$)/.test(prompt) || /^\/worktree-exit(?:\s|$)/.test(prompt)) {
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
            target = fs.realpathSync(path.resolve(session.config.workspace, prompt.slice(5).trim()));
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
    try { await (activeAgent ?? agent()).endSession(options.signal.aborted ? 'interrupt' : 'prompt_input_exit'); }
    catch (error) { options.status.write(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}\n`); }
    try { await activeRuntime.releaseSession?.(session.id); }
    finally {
      session.close();
      if (activeRuntime !== runtime) await activeRuntime.close();
    }
  }
}
