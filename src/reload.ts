import { DEFAULT_SYSTEM } from "./agent.js";
import { loadProjectConfig, instructionSources } from "./config.js";
import { buildSystem, parseSettings } from "./runtime.js";
import { configSchema, applyManagedPolicy, type SessionConfig } from "./session.js";
import { loadKeybindings } from "./keybindings.js";
import { agentTypesSection, setHeldSkills } from "./skill-catalog.js";
import { startupVerbose } from "./focus-command.js";
import { modelEffort } from './effort-command.js';

/** Reload local policy/catalogs while retaining the live provider and call limits. */
export function reloadConfig(current: SessionConfig): SessionConfig {
  const loaded = loadProjectConfig(current.workspace, { ...current.configSources, paths: [] });
  const settings = parseSettings(loaded.settings);
  const next = structuredClone(current);
  const overrides = current.configSources?.overrides ?? {};
  // se/uc, 9vcaezw1 [10679,11697)/[12346,12719), UTF-16: inherit re-reads the refreshed table.
  if (settings.modelSettings !== undefined) next.modelSettings = settings.modelSettings;
  else delete next.modelSettings;
  if (next.effortSelection?.kind === 'inherit') {
    next.effortSelection = { kind: 'inherit', fallback: settings.effort };
    const effort = modelEffort(next, next.model);
    if (effort === undefined) delete next.effort; else next.effort = effort;
  }
  next.skills = loaded.skills;
  if (loaded.pluginComponentDiagnostics !== undefined) next.pluginComponentDiagnostics = loaded.pluginComponentDiagnostics;
  else delete next.pluginComponentDiagnostics;
  next.instructionSources = instructionSources(loaded.instructions);
  next.conditionalRules = loaded.conditionalRules ?? [];
  next.agentTypes = loaded.agentTypes ?? [];
  next.features = { tasks: true, taskProjections: true, subagents: true, notebooks: true, background: true, scheduler: true,
    agentMessaging: true, agentIdle: true, agentTypes: true, interaction: true, web: true, checkpoints: true,
    worktrees: true, memory: true, media: true, workflow: true, mcpCatalog: true,
    workflowPersistence: true, mcpSubscriptions: false,
    mcpDynamic: Boolean(settings.mcpServers && Object.keys(settings.mcpServers).length), mcpDeferred: false,
    lsp: Boolean(settings.lspServers && Object.keys(settings.lspServers).length), ...settings.features,
    ...(overrides.tasks === undefined ? {} : { tasks: overrides.tasks }),
    ...(overrides.subagents === undefined ? {} : { subagents: overrides.subagents }) };
  applyManagedPolicy(next, loaded.managedSettings);
  next.autoMemory = overrides.autoMemory ?? settings.autoMemory ?? false;
  next.watchConfig = overrides.watchConfig ?? settings.watchConfig ?? false;
  // hs/ef, js2bhabe [1114,1499), 14rnebpd [317949,318021), UTF-16: re-read the merged value.
  if (settings.autoCompactEnabled !== undefined) next.autoCompactEnabled = settings.autoCompactEnabled;
  else delete next.autoCompactEnabled;
  if (settings.prefersReducedMotion !== undefined) next.prefersReducedMotion = settings.prefersReducedMotion;
  else delete next.prefersReducedMotion;
  if (settings.showTurnDuration !== undefined) next.showTurnDuration = settings.showTurnDuration;
  else delete next.showTurnDuration;
  if (settings.showMessageTimestamps !== undefined) next.showMessageTimestamps = settings.showMessageTimestamps;
  else delete next.showMessageTimestamps;
  if (settings.copyOnSelect !== undefined) next.copyOnSelect = settings.copyOnSelect;
  else delete next.copyOnSelect;
  if (settings.copyFullResponse !== undefined) next.copyFullResponse = settings.copyFullResponse;
  else delete next.copyFullResponse;
  if (settings.preferredNotifChannel !== undefined) next.preferredNotifChannel = settings.preferredNotifChannel;
  else delete next.preferredNotifChannel;
  if (settings.autoScrollEnabled !== undefined) next.autoScrollEnabled = settings.autoScrollEnabled;
  else delete next.autoScrollEnabled;
  if (settings.viewMode !== undefined) next.viewMode = settings.viewMode;
  else delete next.viewMode;
  // It, 9shw4xrd [106333,106421), UTF-16: reload resolves the same way startup does, so a
  // removed key falls back to the authored viewMode instead of keeping a stale live value.
  next.verbose = startupVerbose(next.viewMode, settings.verbose);
  // y0, 3gz7s57c 138878, UTF-16: the merged row defaults on when no layer authors it.
  next.terminalProgressBarEnabled = settings.terminalProgressBarEnabled ?? true;
  for (const key of ['timeFormat', 'timeZone', 'spinnerVerbs','editorMode','vimInsertModeRemaps'] as const) {
    if (settings[key] === undefined) delete next[key];
  }
  if (settings.timeFormat !== undefined) next.timeFormat = settings.timeFormat;
  if (settings.timeZone !== undefined) next.timeZone = settings.timeZone;
  if (settings.spinnerVerbs !== undefined) next.spinnerVerbs = settings.spinnerVerbs;
  if (settings.spinnerTipsEnabled === undefined) delete next.spinnerTipsEnabled;
  else next.spinnerTipsEnabled = settings.spinnerTipsEnabled;
  if (loaded.spinnerTipsLayers === undefined) delete next.spinnerTipsLayers;
  else next.spinnerTipsLayers = loaded.spinnerTipsLayers;
  if(settings.editorMode!==undefined)next.editorMode=settings.editorMode;
  if(settings.vimInsertModeRemaps!==undefined)next.vimInsertModeRemaps=settings.vimInsertModeRemaps;
  if (settings.maxProseWidth !== undefined) next.maxProseWidth = settings.maxProseWidth;
  else delete next.maxProseWidth;
  if (settings.askUserQuestionTimeout !== undefined) next.askUserQuestionTimeout = settings.askUserQuestionTimeout;
  else delete next.askUserQuestionTimeout;
  if (settings.dialogExpiry !== undefined) next.dialogExpiry = settings.dialogExpiry;
  else delete next.dialogExpiry;
  if (settings.syntaxHighlightingDisabled !== undefined) next.syntaxHighlightingDisabled = settings.syntaxHighlightingDisabled;
  else delete next.syntaxHighlightingDisabled;
  if (settings.enableWorkflows !== undefined) next.enableWorkflows = settings.enableWorkflows;
  else delete next.enableWorkflows;
  if (settings.workflowKeywordTriggerEnabled !== undefined) next.workflowKeywordTriggerEnabled = settings.workflowKeywordTriggerEnabled;
  else delete next.workflowKeywordTriggerEnabled;
  if (settings.emojiCompletionEnabled !== undefined) next.emojiCompletionEnabled = settings.emojiCompletionEnabled;
  else delete next.emojiCompletionEnabled;
  if (settings.respondToBashCommands !== undefined) next.respondToBashCommands = settings.respondToBashCommands;
  else delete next.respondToBashCommands;
  if (settings.disableAgentView !== undefined) next.disableAgentView = settings.disableAgentView;
  else delete next.disableAgentView;
  if (settings.theme !== undefined) next.theme = settings.theme;
  else delete next.theme;
  if (settings.statusLine !== undefined) next.statusLine = settings.statusLine;
  else delete next.statusLine;
  next.system = buildSystem(DEFAULT_SYSTEM, [...loaded.instructions,
    ...(next.features.memory === false || next.autoMemory ? [] : loaded.memories ?? [])], loaded.skills);
  // Conditional skills are session state, not config text: install the held list
  // before the clone is returned to the runtime.
  setHeldSkills(next, loaded.conditionalSkills);
  if (next.features.subagents && next.features.agentTypes) next.system += agentTypesSection(next.agentTypes);
  next.hooks = settings.hooks ?? {};
  next.allowShell = overrides.allowShell ?? settings.allowShell ?? false;
  next.mcpServers = settings.mcpServers ?? {};
  next.lspServers = settings.lspServers ?? {};
  next.permissions = { ...(settings.permissions ?? { mode: "default", allow: [], deny: [] }),
    ...(overrides.permissions === undefined ? {} : { mode: overrides.permissions.mode }),
    layers: [...loaded.permissionLayers, ...(overrides.permissions?.layers ??
      (overrides.permissions ? [{ source: 'cliArg' as const, root: current.workspace, allow: overrides.permissions.allow,
        deny: overrides.permissions.deny, ask: overrides.permissions.ask ?? [], additionalDirectories: [] }] : []))] };
  if (settings.webSearch) next.webSearch = settings.webSearch; else delete next.webSearch;
  if (settings.plugins) next.plugins = settings.plugins; else delete next.plugins;
  next.mcpClient = { ...settings.mcpClient, ...overrides.mcpClient };
  next.dynamicInstructions = settings.dynamicInstructions ?? current.dynamicInstructions ?? true;
  if (settings.stopHookBlockCap !== undefined) next.stopHookBlockCap = settings.stopHookBlockCap;
  next.automaticCheckpoints = settings.automaticCheckpoints ?? false;
  applyManagedPolicy(next, loaded.managedSettings);
  const keybindings = loadKeybindings(current.workspace, current.configSources?.userDir);
  if (Object.keys(keybindings).length) next.keybindings = keybindings; else delete next.keybindings;
  configSchema.parse(next);
  return next;
}
