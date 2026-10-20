/**
 * The hook-event metadata table behind the `/hooks` panel. Recovered from `igt` in
 * `chunk-5s0t90hn.js`, sha256
 * `78fb5ac9b58de2292c2682ae027da0104606e0119919e1d87a6cbce32beafe89`, at 861, with the source
 * label table `$p` and the config formatter `Mx` from `chunk-n3ykh62m.js`, sha256
 * `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac`, at 410486 and
 * 409429. Offsets are zero-based UTF-16 code units.
 *
 * The table is a transcription, not an interpretation: every `summary` and `description` is the
 * recovered string byte for byte, and `matcherField` is the recovered `fieldToMatch`. The
 * recovered `values` arrays are the candidate values for that field, which the dialog never
 * renders, so they are dropped here.
 */

import type { HookEvent } from "./hooks.js";

/** Source `igt`: one entry per lifecycle event the dialog can list. */
export interface HookEventMetadata {
  readonly summary: string;
  readonly description: string;
  /** Source `matcherMetadata.fieldToMatch`: absent where the event accepts no matcher. */
  readonly matcherField?: string;
}

/** Source `igt`: the table itself, in the order the recovered object literal declares it. */
export const HOOK_EVENT_METADATA: Readonly<Record<string, HookEventMetadata>> = {
  PreToolUse: { summary: "Before tool execution", description: "Input to command is JSON of tool call arguments.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and block tool call\nOther exit codes - show stderr to user only but continue with tool call", matcherField: "tool_name" },
  PostToolUse: { summary: "After tool execution", description: "Input to command is JSON with fields \"inputs\" (tool call arguments) and \"response\" (tool call response).\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nExit code 2 - show stderr to model immediately\nOther exit codes - show stderr to user only", matcherField: "tool_name" },
  PostToolUseFailure: { summary: "After tool execution fails", description: "Input to command is JSON with tool_name, tool_input, tool_use_id, error, error_type, is_interrupt, and is_timeout.\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nExit code 2 - show stderr to model immediately\nOther exit codes - show stderr to user only", matcherField: "tool_name" },
  PostToolBatch: { summary: "After a batch of tool calls resolves", description: "Fires once after every tool call in a batch has resolved, before the next model request. Input includes tool_calls (array of {tool_name, tool_input, tool_use_id, tool_response}).\nReturn additionalContext via hookSpecificOutput to inject context once for the whole batch.\nExit code 2 - stop the agentic loop (stderr shown to user only)\nOther exit codes - show stderr to user only" },
  PermissionDenied: { summary: "After auto mode classifier denies a tool call", description: "Input to command is JSON with tool_name, tool_input, tool_use_id, and reason.\nReturn {\"hookSpecificOutput\":{\"hookEventName\":\"PermissionDenied\",\"retry\":true}} to tell the model it may retry.\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nOther exit codes - show stderr to user only", matcherField: "tool_name" },
  Notification: { summary: "When notifications are sent", description: "Input to command is JSON with notification message and type.\nExit code 0 - stdout/stderr not shown\nOther exit codes - show stderr to user only", matcherField: "notification_type" },
  UserPromptSubmit: { summary: "When the user submits a prompt", description: "Input to command is JSON with original user prompt text.\nExit code 0 - stdout shown to Claude\nExit code 2 - block processing, erase original prompt, and show stderr to user only\nOther exit codes - show stderr to user only" },
  UserPromptExpansion: { summary: "When a user-typed slash command expands into a prompt", description: "Input to command is JSON with expansion_type, command_name, command_args, command_source, and original prompt.\nExit code 0 - stdout shown to Claude\nExit code 2 - block expansion and show stderr to user only\nOther exit codes - show stderr to user only", matcherField: "command_name" },
  SessionStart: { summary: "When a new session is started", description: "Input to command is JSON with session start source.\nExit code 0 - stdout shown to Claude\nExit code 2 - show stderr to user only\nOther exit codes - show stderr to user only", matcherField: "source" },
  Stop: { summary: "Right before Claude concludes its response", description: "Exit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and continue conversation\nOther exit codes - show stderr to user only" },
  StopFailure: { summary: "When the turn ends due to an API error", description: "Fires instead of Stop when an API error (rate limit, auth failure, etc.) ended the turn. Fire-and-forget — hook output and exit codes are ignored.", matcherField: "error" },
  SubagentStart: { summary: "When a subagent (Agent tool call) is started", description: "Input to command is JSON with agent_id and agent_type.\nExit code 0 - JSON additionalContext shown to subagent\nExit code 2 - show stderr to user only\nOther exit codes - show stderr to user only", matcherField: "agent_type" },
  SubagentStop: { summary: "Right before a subagent (Agent tool call) concludes its response", description: "Input to command is JSON with agent_id, agent_type, and agent_transcript_path.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to subagent and continue having it run\nOther exit codes - show stderr to user only", matcherField: "agent_type" },
  PreCompact: { summary: "Before conversation compaction", description: "Input to command is JSON with compaction details.\nExit code 0 - stdout appended as custom compact instructions\nExit code 2 - block compaction\nOther exit codes - show stderr to user only but continue with compaction", matcherField: "trigger" },
  PostCompact: { summary: "After conversation compaction", description: "Input to command is JSON with compaction details and the summary.\nExit code 0 - stdout shown to user\nOther exit codes - show stderr to user only", matcherField: "trigger" },
  PreModelSwitch: { summary: "Before a requested model switch (/model, model picker, set_model)", description: "Input to command is JSON with from_model, to_model, requested_model, source, context_tokens and the estimated re-cache cost.\nExit code 0 - switch proceeds; JSON permissionDecision allow/deny/ask as for PreToolUse\nExit code 2 - block the switch and show stderr to user\nOther exit codes - show stderr to user only and continue", matcherField: "to_model" },
  PostModelSwitch: { summary: "After the session model changes (any cause)", description: "Input to command is JSON with from_model, to_model, requested_model, source, context_tokens and the estimated re-cache cost.\nExit code 0 - stdout shown to Claude on the next request\nOther exit codes - show stderr to user only", matcherField: "to_model" },
  SessionEnd: { summary: "When a session is ending", description: "Input to command is JSON with session end reason.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only", matcherField: "reason" },
  PermissionRequest: { summary: "When a permission dialog is displayed", description: "Input to command is JSON with tool_name, tool_input, and tool_use_id.\nOutput JSON with hookSpecificOutput containing decision to allow or deny.\nExit code 0 - use hook decision if provided\nOther exit codes - show stderr to user only", matcherField: "tool_name" },
  Setup: { summary: "Repo setup hooks for init and maintenance", description: "Input to command is JSON with trigger (init or maintenance).\nExit code 0 - JSON additionalContext shown to Claude\nExit code 2 - show stderr to user only\nOther exit codes - show stderr to user only", matcherField: "trigger" },
  TeammateIdle: { summary: "When a teammate is about to go idle", description: "Input to command is JSON with teammate_name and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to teammate and prevent idle (teammate continues working)\nOther exit codes - show stderr to user only" },
  TaskCreated: { summary: "When a task is being created", description: "Input to command is JSON with task_id, task_subject, task_description, teammate_name, and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and prevent task creation\nOther exit codes - show stderr to user only" },
  TaskCompleted: { summary: "When a task is being marked as completed", description: "Input to command is JSON with task_id, task_subject, task_description, teammate_name, and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and prevent task completion\nOther exit codes - show stderr to user only" },
  Elicitation: { summary: "When an MCP server requests user input (elicitation)", description: "Input to command is JSON with mcp_server_name, message, and requested_schema.\nOutput JSON with hookSpecificOutput containing action (accept/decline/cancel) and optional content.\nExit code 0 - use hook response if provided\nExit code 2 - deny the elicitation\nOther exit codes - show stderr to user only", matcherField: "mcp_server_name" },
  ElicitationResult: { summary: "After a user responds to an MCP elicitation", description: "Input to command is JSON with mcp_server_name, action, content, mode, and elicitation_id.\nOutput JSON with hookSpecificOutput containing optional action and content to override the response.\nExit code 0 - use hook response if provided\nExit code 2 - block the response (action becomes decline)\nOther exit codes - show stderr to user only", matcherField: "mcp_server_name" },
  ConfigChange: { summary: "When configuration files change during a session", description: "Input to command is JSON with source (user_settings, project_settings, local_settings, policy_settings, skills) and file_path.\nExit code 0 - allow the change\nExit code 2 - block the change from being applied to the session\nOther exit codes - show stderr to user only", matcherField: "source" },
  InstructionsLoaded: { summary: "When an instruction file (CLAUDE.md or rule) is loaded", description: "Input to command is JSON with file_path, memory_type (User, Project, Local, Managed), load_reason (session_start, nested_traversal, path_glob_match, include, compact), globs (optional — the paths: frontmatter patterns that matched), trigger_file_path (optional — the file Claude touched that caused the load), and parent_file_path (optional — the file that @-included this one).\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only\nThis hook is observability-only and does not support blocking.", matcherField: "load_reason" },
  WorktreeCreate: { summary: "Create an isolated worktree for VCS-agnostic isolation", description: "Input to command is JSON with name (suggested worktree slug).\nStdout should contain the absolute path to the created worktree directory.\nExit code 0 - worktree created successfully\nOther exit codes - worktree creation failed" },
  WorktreeRemove: { summary: "Remove a previously created worktree", description: "Input to command is JSON with worktree_path (absolute path to worktree).\nExit code 0 - worktree removed successfully\nOther exit codes - show stderr to user only" },
  CwdChanged: { summary: "After the working directory changes", description: "Input to command is JSON with old_cwd and new_cwd.\nCLAUDE_ENV_FILE is set — write bash exports there to apply env to subsequent BashTool commands.\nHook output can include hookSpecificOutput.watchPaths (array of absolute paths) to register with the FileChanged watcher.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only" },
  FileChanged: { summary: "When a watched file changes", description: "Input to command is JSON with file_path and event (change, add, unlink).\nCLAUDE_ENV_FILE is set — write bash exports there to apply env to subsequent BashTool commands.\nThe matcher field specifies filenames to watch in the current directory (e.g. \".envrc|.env\").\nHook output can include hookSpecificOutput.watchPaths (array of absolute paths) to dynamically update the watch list.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only" },
  DirectoryAdded: { summary: "After a working directory is added mid-session", description: "Fires after /add-dir or the register_repo_root SDK control request registers a new working directory, after the sandbox configuration has been refreshed — so sandboxed tools and permission state already see the new directory (hook commands themselves run unsandboxed).\nInput to command is JSON with directory (absolute path) and source (\"slash_command\" or \"register_repo_root\").\nExit code 0 - command completes successfully\nOther exit codes - stderr is debug-logged on both paths; for /add-dir, a failure count is summarized to Claude and hook systemMessage output reaches Claude as bounded context; for register_repo_root, everything is debug-logged only", matcherField: "source" },
  MessageDisplay: { summary: "While assistant message text is displayed", description: "Input to command is JSON with turn_id, message_id, index, final, and delta (the newly completed lines).\nOutput JSON with hookSpecificOutput containing displayContent to replace the delta on screen.\nDisplay-only: the stored message and what the model sees are untouched.\nExit code 0 - use hook response if provided\nOther exit codes - display the original delta" },
};

/** Source `$p`: how a hook definition is attributed, by settings source. */
export interface HookSourceLabels {
  readonly description: string;
  readonly header: string;
  readonly inline: string;
}

export const HOOK_SOURCES: Readonly<Record<string, HookSourceLabels>> = {
  userSettings: { description: "User settings (~/.claude/settings.json)", header: "User Settings", inline: "User" },
  projectSettings: { description: "Project settings (.claude/settings.json)", header: "Project Settings", inline: "Project" },
  localSettings: { description: "Local settings (.claude/settings.local.json)", header: "Local Settings", inline: "Local" },
  policySettings: { description: "policySettings", header: "policySettings", inline: "policySettings" },
  pluginHook: { description: "Plugin hooks (~/.claude/plugins/*/hooks/hooks.json)", header: "Plugin Hooks", inline: "Plugin" },
  sessionHook: { description: "Session hooks (in-memory, temporary)", header: "Session Hooks", inline: "Session" },
  builtinHook: { description: "Built-in hooks (registered internally by Claude Code)", header: "Built-in Hooks", inline: "Built-in" },
};

/** Source `Bbe` in `chunk-wtch2p0g.js` at 6070: the settings sources a matcher is sorted by. */
export const HOOK_SOURCE_ORDER: readonly string[] = ["localSettings", "projectSettings", "userSettings"];

/** Source `H4t`: the short attribution the matcher row shows inline. */
export function hookSourceInline(source: string): string { return HOOK_SOURCES[source]?.inline ?? source; }

/** Source `SPn`: the long attribution the hook detail row shows. */
export function hookSourceHeader(source: string): string { return HOOK_SOURCES[source]?.header ?? source; }

/** Source `O4t`: the source description, used where the dialog explains a source. */
export function hookSourceDescription(source: string): string { return HOOK_SOURCES[source]?.description ?? source; }

/** Source `igt`'s parameter: the events the panel lists, narrowed to this host's inventory. */
export function hookEventMetadata(event: HookEvent): HookEventMetadata | undefined {
  return (HOOK_EVENT_METADATA as Record<string, HookEventMetadata>)[event];
}
