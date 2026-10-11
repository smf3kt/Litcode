import { DEFAULT_SYSTEM } from "./agent.js";
import { loadProjectConfig } from "./config.js";
import { buildSystem, parseSettings } from "./runtime.js";
import { configSchema, applyManagedPolicy, type SessionConfig } from "./session.js";
import { loadKeybindings } from "./keybindings.js";

/** Reload local policy/catalogs while retaining the live provider and call limits. */
export function reloadConfig(current: SessionConfig): SessionConfig {
  const loaded = loadProjectConfig(current.workspace, { ...current.configSources, paths: [] });
  const settings = parseSettings(loaded.settings);
  const next = structuredClone(current);
  const overrides = current.configSources?.overrides ?? {};
  next.skills = loaded.skills;
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
  next.system = buildSystem(DEFAULT_SYSTEM, [...loaded.instructions,
    ...(next.features.memory === false || next.autoMemory ? [] : loaded.memories ?? [])], loaded.skills);
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
  next.permissions = overrides.permissions ?? settings.permissions ?? { mode: "default", allow: [], deny: [] };
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
