import { DEFAULT_SYSTEM } from "./agent.js";
import { loadProjectConfig, instructionSources } from "./config.js";
import { buildSystem, parseSettings } from "./runtime.js";
import { configSchema, applyManagedPolicy, type SessionConfig } from "./session.js";
import { loadKeybindings } from "./keybindings.js";
import { setHeldSkills } from "./skill-catalog.js";

/** Reload local policy/catalogs while retaining the live provider and call limits. */
export function reloadConfig(current: SessionConfig): SessionConfig {
  const loaded = loadProjectConfig(current.workspace, { ...current.configSources, paths: [] });
  const settings = parseSettings(loaded.settings);
  const next = structuredClone(current);
  const overrides = current.configSources?.overrides ?? {};
  next.skills = loaded.skills;
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
  if (settings.prefersReducedMotion !== undefined) next.prefersReducedMotion = settings.prefersReducedMotion;
  else delete next.prefersReducedMotion;
  if (settings.showTurnDuration !== undefined) next.showTurnDuration = settings.showTurnDuration;
  else delete next.showTurnDuration;
  for (const key of ['timeFormat', 'timeZone', 'spinnerVerbs','editorMode','vimInsertModeRemaps'] as const) {
    if (settings[key] === undefined) delete next[key];
  }
  if (settings.timeFormat !== undefined) next.timeFormat = settings.timeFormat;
  if (settings.timeZone !== undefined) next.timeZone = settings.timeZone;
  if (settings.spinnerVerbs !== undefined) next.spinnerVerbs = settings.spinnerVerbs;
  if(settings.editorMode!==undefined)next.editorMode=settings.editorMode;
  if(settings.vimInsertModeRemaps!==undefined)next.vimInsertModeRemaps=settings.vimInsertModeRemaps;
  if (settings.maxProseWidth !== undefined) next.maxProseWidth = settings.maxProseWidth;
  else delete next.maxProseWidth;
  if (settings.syntaxHighlightingDisabled !== undefined) next.syntaxHighlightingDisabled = settings.syntaxHighlightingDisabled;
  else delete next.syntaxHighlightingDisabled;
  if (settings.enableWorkflows !== undefined) next.enableWorkflows = settings.enableWorkflows;
  else delete next.enableWorkflows;
  if (settings.workflowKeywordTriggerEnabled !== undefined) next.workflowKeywordTriggerEnabled = settings.workflowKeywordTriggerEnabled;
  else delete next.workflowKeywordTriggerEnabled;
  if (settings.theme !== undefined) next.theme = settings.theme;
  else delete next.theme;
  if (settings.statusLine !== undefined) next.statusLine = settings.statusLine;
  else delete next.statusLine;
  next.system = buildSystem(DEFAULT_SYSTEM, [...loaded.instructions,
    ...(next.features.memory === false || next.autoMemory ? [] : loaded.memories ?? [])], loaded.skills);
  // Conditional skills are session state, not config text: install the held list
  // before the clone is returned to the runtime.
  setHeldSkills(next, loaded.conditionalSkills);
  if (next.features.subagents && next.features.agentTypes) {
    const catalog = next.agentTypes.map(type => JSON.stringify({ name: type.name, ...(type.aliases?.length ? { aliases: type.aliases } : {}), description: type.description,
      mode: type.mode, ...(type.model ? { model: type.model } : {}), ...(type.effort ? { effort: type.effort } : {}) })).join("\n");
    next.system += "\n\n# Available agent types\nUse agent.subagent_type with general, explore, fork, or a catalog name below. " +
      "Fork inherits the parent model, effort and paired conversation history." + (catalog ? "\n" + catalog : "");
  }
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
