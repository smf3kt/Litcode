import fs from "node:fs";
import path from "node:path";

import { assertPaired } from "./agent.js";
import { Session, configSchema, fingerprint, type SessionConfig, type SessionEvent } from "./session.js";
import type { ToolDefinition } from "./tools.js";

export type RelocatedToolBuilder = (config: SessionConfig) => ToolDefinition[];
export type RelocateSessionOptions = { worktreeReturn?: string | null };

function completedHistory(source: Session): SessionEvent[] {
  const history = structuredClone(source.events);
  const metadata = history[0];
  if (metadata?.kind !== "metadata" || metadata.id !== source.id ||
    fingerprint(metadata.config) !== metadata.fingerprint || fingerprint(source.config) !== metadata.fingerprint) {
    throw new Error("Source session identity or pinned configuration changed");
  }
  const pendingTools = new Set<string>();
  const pendingHooks = new Set<string>();
  let unfinishedEpoch = false;
  for (const event of history.slice(1)) {
    if (event.kind === "metadata") throw new Error("Source session has duplicate metadata");
    if (event.kind === "message" || event.kind === "compact") unfinishedEpoch = true;
    if (event.kind === "tool_start") {
      if (pendingTools.has(event.id)) throw new Error("Source session has duplicate pending tool calls");
      pendingTools.add(event.id);
    }
    if (event.kind === "tool_result") pendingTools.delete(event.result.tool_use_id);
    if (event.kind === "hook_start") {
      if (pendingHooks.has(event.id)) throw new Error("Source session has duplicate pending hooks");
      pendingHooks.add(event.id);
    }
    if (event.kind === "hook_result") pendingHooks.delete(event.id);
    if (event.kind === "turn_end") {
      if (pendingTools.size || pendingHooks.size) throw new Error("Source session has unfinished tool or hook effects");
      unfinishedEpoch = false;
    }
  }
  if (unfinishedEpoch || pendingTools.size || pendingHooks.size || source.awaitingResponse) {
    throw new Error("Finish or continue the unfinished session before relocating its workspace");
  }
  assertPaired(source.messages);
  return history.filter((event) => event.kind === "message" || event.kind === "compact" || event.kind === "turn_end" || event.kind === "title");
}

/**
 * Copy completed conversation epochs to a new target-bound journal. This keeps
 * the original instruction/settings snapshot; target instruction discovery and
 * process/tool disposal remain the caller's lifecycle responsibilities.
 */
export function relocateSession(source: Session, targetWorkspace: string, buildTools: RelocatedToolBuilder,
  options?: RelocateSessionOptions): Session {
  const history = completedHistory(source);
  const target = fs.realpathSync(path.resolve(targetWorkspace));
  if (!fs.statSync(target).isDirectory()) throw new Error("Target workspace must be a directory");
  if (target === source.config.workspace) throw new Error("Target workspace is already the source workspace");
  const agent = path.join(target, ".agent");
  if (fs.existsSync(agent) && (fs.lstatSync(agent).isSymbolicLink() || !fs.statSync(agent).isDirectory())) {
    throw new Error("Target session directory must be a real directory");
  }

  const config: SessionConfig = { ...structuredClone(source.config), workspace: target };
  if (options?.worktreeReturn === null) delete config.worktreeReturn;
  else if (options?.worktreeReturn !== undefined) config.worktreeReturn = options.worktreeReturn;
  const definitions = buildTools(structuredClone(config));
  if (!Array.isArray(definitions)) throw new Error("Workspace tool builder must return tool definitions");
  const names = new Set<string>();
  for (const tool of definitions) {
    if (!tool || typeof tool.execute !== "function" || typeof tool.readOnly !== "boolean" ||
      typeof tool.schema?.name !== "string" || !tool.schema.name || names.has(tool.schema.name)) {
      throw new Error("Workspace tool builder returned invalid or duplicate tool definitions");
    }
    names.add(tool.schema.name);
  }
  config.tools = definitions.map((tool) => ({ ...structuredClone(tool.schema), eager_input_streaming: true }));
  configSchema.parse(config);
  if (config.compactAt + config.maxTokens >= config.contextTokens) {
    throw new Error("Compaction threshold must leave room for model output");
  }
  const marker: Exclude<SessionEvent, { kind: "metadata" }> = {
    kind: "message",
    message: { role: "user", content: [
      "Workspace relocation context:",
      `Source session: ${source.id}`,
      `Previous workspace: ${JSON.stringify(source.config.workspace)}`,
      `Current workspace: ${JSON.stringify(target)}`,
      "Earlier conversation paths and tool outputs describe the previous workspace. Resolve new relative paths against the current workspace and inspect its files before edits.",
      "The original instruction, model and runtime settings snapshot remains pinned. Completed conversation history was copied; tool executions and hooks were not replayed.",
    ].join("\n") },
  };
  const next = Session.open(target, { config });
  try {
    for (const event of history) {
      if (event.kind === "message") {
        const copied = structuredClone(event);
        if (Array.isArray(copied.message.content)) {
          copied.message.content = copied.message.content.filter(block => block.type !== "thinking" && block.type !== "redacted_thinking");
          if (!copied.message.content.length) copied.message.content = [{ type: "text", text: "[Prior thinking omitted after workspace relocation.]" }];
        }
        if (copied.response) copied.response.content = copied.response.content.filter(block => block.type !== "thinking" && block.type !== "redacted_thinking");
        next.append(copied);
      } else next.append(event as Exclude<SessionEvent, { kind: "metadata" }>);
    }
    next.append({ kind: "branch", source: source.id, workspace: source.config.workspace, boundary: source.events.length - 1, reason: "relocation" });
    next.append(marker);
    next.append({ kind: "turn_end", reason: "workspace_relocated" });
    return next;
  } catch (error) {
    // A partial new journal is never offered as a relocation result. Its own
    // lock is released while the source journal remains untouched.
    const identity = fs.lstatSync(next.file);
    try { next.close(); }
    finally {
      const present = fs.lstatSync(next.file);
      if (present.isFile() && !present.isSymbolicLink() && present.dev === identity.dev && present.ino === identity.ino) {
        fs.unlinkSync(next.file);
      }
    }
    throw error;
  }
}
