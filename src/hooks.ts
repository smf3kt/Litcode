// Lifecycle hook execution for the personal agent.
// Command, script and HTTP transports run explicit configured definitions.
// Model/callback/MCP hooks and async commands use trusted parent-owned resolvers.
// The event inventory advertises accepted definitions, not runtime invocation.
//
// Contracts mirror static observations from the studied 2.1.296
// sample (module chunk-sfn1dbxq.js):
//   - the hook receives a JSON object on stdin containing `hook_event_name`
//     plus session/cwd context and event-specific fields (`tool_name`,
//     `tool_input`, `tool_response`, `prompt`);
//   - `matcher` selects by `tool_name` (tool events), `timeout` is in seconds;
//   - exit status 2 blocks PreToolUse/UserPromptSubmit/PreCompact/PostToolBatch/
//     PostToolUseFailure; for Stop it is a continuation request; the display-only
//     events (SessionStart/PostToolUse/PostCompact/StopFailure/SessionEnd) treat
//     it as a non-blocking note;
//   - stdout JSON may carry `continue: false` (a terminal stop request) or a
//     validated `hookSpecificOutput` whose `hookEventName` must equal the event; a
//     top-level `decision: "block"` blocks Stop/PreCompact/PostToolBatch/
//     PostToolUseFailure, and for Stop a non-empty `additionalContext` is itself a
//     continuation request;
//   - PreCompact is a raw-stdout contract: its trimmed stdout becomes context
//     verbatim and `continue: false` is ignored.

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { z } from "zod";
import { validateHookTerminalSequence } from "./hook-terminal.js";

/**
 * Accepted lifecycle event inventory shared by session and runtime schemas.
 * Parent runtimes invoke only the lifecycle transitions they actually own.
 */
export const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
  "PreCompact",
  "PostCompact",
  "Stop",
  "StopFailure",
  "PermissionRequest",
  "PermissionDenied",
  "Notification",
  "UserPromptExpansion",
  "Setup",
  "SubagentStart",
  "SubagentStop",
  "PreModelSwitch",
  "PostModelSwitch",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
  "CwdChanged",
  "FileChanged",
  "DirectoryAdded",
  "MessageDisplay",
  "SessionEnd",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

const commonHookFields = {
  matcher: z.string().max(4096).optional(),
  timeout: z.number().positive().finite().max(3600).optional(),
  once: z.boolean().optional(),
};
const commandHookSchema = z.object({
  ...commonHookFields,
  type: z.literal("command").optional(),
  command: z.string().min(1),
  async: z.boolean().optional(),
}).strict();
const envName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const httpHookSchema = z.object({
  ...commonHookFields,
  type: z.literal("http"),
  url: z.string().url().refine(value => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash;
  }, "HTTP hook URLs must use HTTP(S) without credentials or fragments."),
  headersEnv: z.record(z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/), envName).optional(),
}).strict();
const modelHookFields = { ...commonHookFields, prompt: z.string().min(1), model: z.string().min(1).optional() };
const hookNameSchema = z.string().min(1).max(256).refine(value => !value.includes("\0") && Buffer.byteLength(value) <= 256,
  "Hook names must fit 256 UTF-8 bytes without NUL.");
export const hookDefinitionSchema = z.union([
  commandHookSchema,
  httpHookSchema,
  z.object({ ...modelHookFields, type: z.literal("prompt") }).strict(),
  z.object({ ...modelHookFields, type: z.literal("agent") }).strict(),
  z.object({ ...commonHookFields, type: z.literal("callback"), name: hookNameSchema }).strict(),
  z.object({ ...commonHookFields, type: z.literal("mcp_tool"), tool: hookNameSchema, arguments: z.record(z.unknown()).optional() }).strict(),
  z.object({ ...commonHookFields, type: z.literal("script"), command: z.string().min(1).refine(value => !value.includes("\0")) }).strict(),
]);

// Absent command type stays absent when legacy session/config JSON is parsed.
export type HookDefinition = z.infer<typeof hookDefinitionSchema>;
export const MAX_HOOK_DEFINITIONS = 1024;
export const hookEntrySchema = z.union([
  hookDefinitionSchema,
  z.object({
    matcher: commonHookFields.matcher,
    hooks: z.array(hookDefinitionSchema).min(1).max(MAX_HOOK_DEFINITIONS),
  }).strict(),
]);
export type HookEntry = z.infer<typeof hookEntrySchema>;
export const hookEntriesSchema = z.array(hookEntrySchema).max(MAX_HOOK_DEFINITIONS).superRefine((entries, ctx) => {
  const count = entries.reduce((total, entry) => total + ("hooks" in entry ? entry.hooks.length : 1), 0);
  if (count > MAX_HOOK_DEFINITIONS) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Flattened hook count exceeds 1024." });
});

export type HookOnceRecord = { event: HookEvent; key: string };
const onceKeySchema = z.string().max(256).refine(key => {
  const parts = key.split(":");
  const validIndex = (value: string | undefined) => value !== undefined && /^(0|[1-9][0-9]*)$/.test(value) && Number(value) < MAX_HOOK_DEFINITIONS;
  return parts.length === 4 && (HOOK_EVENTS as readonly string[]).includes(parts[0]!) && validIndex(parts[1]) &&
    (parts[2] === "flat" || validIndex(parts[2])) && /^[a-f0-9]{64}$/.test(parts[3]!);
}, "Invalid once hook identity.");

/** One owner shares this instance across runs and restores keys from its journal. */
export class HookLifecycle {
  private readonly consumed = new Set<string>();
  private readonly claiming = new Set<string>();
  private resolverStages = 0;

  constructor(seed: readonly string[] = [], private readonly onClaim?: (key: string) => void) {
    for (const key of z.array(onceKeySchema).max(65536).parse(seed)) this.consumed.add(key);
  }

  has(key: string): boolean { return this.consumed.has(key) || this.claiming.has(key); }

  /** The journal callback must commit synchronously; throwing leaves the claim unused. */
  claim(key: string): boolean {
    onceKeySchema.parse(key);
    if (this.has(key)) return false;
    this.claiming.add(key);
    try {
      const committed: unknown = this.onClaim?.(key);
      if (committed && typeof (committed as { then?: unknown }).then === "function") {
        // Ignore a rejected callback promise while rejecting the asynchronous contract.
        void Promise.resolve(committed).catch(() => {});
        throw new Error("Once hook claim callback must be synchronous.");
      }
      this.consumed.add(key);
      return true;
    } finally { this.claiming.delete(key); }
  }

  snapshot(): string[] { return [...this.consumed]; }

  /** A timed-out resolver still owns its slot until its actual promise settles. */
  tryStartResolverStage(): (() => void) | undefined {
    if (this.resolverStages >= 16) return undefined;
    this.resolverStages++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.resolverStages--;
    };
  }
}

export type FlattenedHookDefinition = {
  definition: HookDefinition;
  entryIndex: number;
  /** null identifies a legacy flat entry. */
  innerIndex: number | null;
  matchers: readonly string[];
  identity: HookOnceRecord;
  matches: (value?: string) => boolean;
};

/** Keep original coordinates and raw definition bytes independent of schema parsing. */
export function flattenHookDefinitions(config: HooksConfig, event: HookEvent): FlattenedHookDefinition[] {
  let entriesCount = 0;
  let definitionsCount = 0;
  for (const name of HOOK_EVENTS) {
    const entries = config[name] ?? [];
    if (!Array.isArray(entries)) throw new Error("Hook entries must be an array.");
    entriesCount += entries.length;
    if (entriesCount > MAX_HOOK_DEFINITIONS) throw new Error("Hook configuration exceeds 1024 entries or definitions.");
    for (const entry of entries) {
      if (entry && typeof entry === "object" && "hooks" in entry) {
        if (!Array.isArray(entry.hooks) || entry.hooks.length === 0 || entry.hooks.length > MAX_HOOK_DEFINITIONS - definitionsCount) {
          throw new Error("Hook groups must contain 1 to 1024 nonrecursive definitions within the configuration limit.");
        }
        // Groups are nonrecursive and nonempty, including for direct runner callers.
        hookEntrySchema.parse(entry);
        definitionsCount += entry.hooks.length;
      } else definitionsCount++;
      if (definitionsCount > MAX_HOOK_DEFINITIONS) throw new Error("Hook configuration exceeds 1024 entries or definitions.");
    }
  }
  const flattened: FlattenedHookDefinition[] = [];
  for (const [entryIndex, entry] of (config[event] ?? []).entries()) {
    const group = entry && typeof entry === "object" && "hooks" in entry ? entry : undefined;
    const definitions = group ? group.hooks : [entry as HookDefinition];
    for (const [position, definition] of definitions.entries()) {
      const innerIndex = group ? position : null;
      const matchers = [group?.matcher, definition?.matcher].filter((matcher): matcher is string => typeof matcher === "string");
      const digest = createHash("sha256").update(JSON.stringify({ event, entryIndex, innerIndex, groupMatcher: group?.matcher, definition })).digest("hex");
      const identity = { event, key: `${event}:${entryIndex}:${innerIndex ?? "flat"}:${digest}` };
      flattened.push({ definition, entryIndex, innerIndex, matchers, identity, matches: value => matchers.every(matcher => matcherMatches(matcher, value)) });
    }
  }
  return flattened;
}

export type ModelHookDefinition = Extract<HookDefinition, { type: "prompt" | "agent" }>;
export type CallbackHookDefinition = Extract<HookDefinition, { type: "callback" }>;
export type McpHookDefinition = Extract<HookDefinition, { type: "mcp_tool" }>;
export type AsyncHookRequest = {
  definition: Extract<HookDefinition, { type?: "command" }>;
  event: HookEvent;
  payload: HookPayload;
  input: string;
  cwd: string;
  timeoutMs: number;
  signal: AbortSignal;
};
export type HookRunOptions = {
  /** Parent resolver owns model calls, tool limits, cancellation and billing. */
  resolveModelHook?: (definition: ModelHookDefinition, event: HookEvent, payload: HookPayload, signal: AbortSignal) => Promise<unknown>;
  /** Trusted host callback; the owner must share lifecycle across resolver wrappers. */
  resolveCallbackHook?: (definition: CallbackHookDefinition, event: HookEvent, payload: HookPayload, signal: AbortSignal) => Promise<unknown>;
  /** Parent supplies a read-only MCP executor with permissions and no recursive hooks. */
  resolveMcpHook?: (definition: McpHookDefinition, event: HookEvent, payload: HookPayload, signal: AbortSignal) => Promise<unknown>;
  /** Owner must register and later terminate the command process, returning its task id. */
  startAsyncCommand?: (request: AsyncHookRequest) => Promise<string>;
  /** Resolves only explicitly configured environment-variable names for HTTP headers. */
  environment?: NodeJS.ProcessEnv;
  /** Share per owner for once semantics; omission creates state for this run only. */
  lifecycle?: HookLifecycle;
};

/**
 * Strict event map shared by the session and runtime settings schemas.
 *
 * Session validation uses it as written, so an unknown lifecycle event name is
 * rejected outright. The runtime's settings loader re-derives an identical but
 * lenient map from `HOOK_EVENTS`, so a settings typo drops the unknown key
 * instead of merging it. Both keep the schema key order below.
 */
const hooksObjectSchema = z.object(
  Object.fromEntries(HOOK_EVENTS.map((event) => [event, hookEntriesSchema.optional()])),
);
function refineHookCounts(config: Record<string, HookEntry[] | undefined>, ctx: z.RefinementCtx): void {
  const entries = Object.values(config).flatMap(value => value ?? []);
  const count = entries.reduce((total, entry) => total + ("hooks" in entry ? entry.hooks.length : 1), 0);
  if (entries.length > MAX_HOOK_DEFINITIONS || count > MAX_HOOK_DEFINITIONS) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hook configuration exceeds 1024 entries or definitions." });
}
export const hooksSchema = hooksObjectSchema.strict().superRefine(refineHookCounts);
/** Settings retain historical unknown-event stripping with the same total bounds. */
export const hooksSettingsSchema = hooksObjectSchema.strip().superRefine(refineHookCounts);

export type HooksConfig = Partial<Record<HookEvent, HookEntry[]>>;

/** Event context supplied by the parent runtime. Serialized as hook stdin. */
export type HookPayload = {
  request_id?: string | number;
  requested_schema?: unknown;
  elicitation_result?: unknown;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  prompt?: string;
  tool_use_id?: string;
  source?: string;
  model?: string;
  /** SessionStart: the current session title, when one was recorded. */
  session_title?: string;
  permission_mode?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  /** PostToolBatch: the tool_use_ids of every call in the resolved batch. */
  tool_use_ids?: string[];
  /** PostToolUseFailure / StopFailure: the failure text. */
  error?: string;
  /** PostToolUseFailure: true when the call was interrupted rather than failed. */
  is_interrupt?: boolean;
  /** PreCompact / PostCompact: how compaction was started; Setup: its dispatch kind. */
  trigger?: string;
  /** PreCompact: user-supplied compaction instructions, or null when none were given. */
  custom_instructions?: string | null;
  /** MessageDisplay: the turn, message, delta index and displayed delta (`zir`). */
  turn_id?: string;
  message_id?: string;
  index?: number;
  final?: boolean;
  delta?: string;
  /** PostCompact: the summary produced by compaction. */
  compact_summary?: string;
  /** SessionEnd: why the session is ending. */
  reason?: string;
  /** StopFailure: the model stop reason that ended the turn. */
  stop_reason?: string;
  agent_id?: string;
  agent_type?: string;
  /** TaskCreated / TaskCompleted: the task's own metadata, not the tool echo. */
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
  notification_type?: string;
  /** Elicitation / ElicitationResult: the MCP server asking. */
  mcp_server_name?: string;
  server_name?: string;
  /** UserPromptExpansion: the command name that triggered the expansion. */
  command_name?: string;
  /** InstructionsLoaded: the loaded file and why it was loaded. */
  memory_type?: string;
  load_reason?: string;
  globs?: unknown;
  trigger_file_path?: string;
  parent_file_path?: string;
  /** CwdChanged: the workspace directory before and after the change. */
  old_cwd?: string;
  new_cwd?: string;
  /** DirectoryAdded: the directory and the source that added it. */
  directory?: string;
  /** FileChanged: the change kind, one of add, change or unlink. */
  event?: string;
  /** PreModelSwitch / PostModelSwitch: the models that participated. */
  from_model?: string;
  to_model?: string;
  requested_model?: string;
  /** Elicitation / ElicitationResult: which request form the server used. */
  mode?: "form" | "url";
  /** Elicitation: the URL the person is asked to open, present only in URL mode. */
  url?: string;
  elicitation_id?: string;
  worktree_path?: string;
  file_path?: string;
  /** Additional transition-specific fields supplied by the owning runtime. */
  [field: string]: unknown;
};

export type HookResult = {
  /** True when at least one hook blocked the event. */
  blocked: boolean;
  /** Human-readable block reason (first blocking hook wins). */
  reason?: string;
  /** Replacement tool input, only from an allowing PreToolUse hook. */
  updatedInput?: unknown;
  /** Context strings appended by hooks, in execution order. */
  additionalContext: string[];
  /** Absolute paths a hook asked the file watcher to add (`hookSpecificOutput.watchPaths`). */
  watchPaths?: string[];
  /** Failed hook outputs, also carried in `additionalContext`, for watcher display. */
  failures?: string[];
  /**
   * PreCompact: each successful hook's trimmed stdout, joined by the caller.
   * The source treats this as `newCustomInstructions` and appends it to the
   * compaction prompt rather than ordinary hook context.
   */
  newCustomInstructions?: string[];
  /** MessageDisplay: replacement text for the displayed delta; storage is untouched. */
  displayContent?: string;
  /**
   * Set only by an explicit `continue:false` output, meaning "terminate the
   * session". A Stop hook that merely requests continuation (exit 2 or a
   * `decision:"block"` output) sets `blocked` but leaves this false, so the
   * parent can tell "resume another turn" from "stop".
   */
  stopRequested?: boolean;
  permissionDecision?: "allow" | "deny" | "ask" | "defer";
  permissionDecisionReason?: string;
  updatedPermissions?: unknown[];
  updatedToolOutput?: unknown;
  updatedPrompt?: string;
  suppressOutput?: boolean;
  systemMessages?: string[];
  /** Validated terminal side effects, in execution order and independent of text suppression. */
  terminalSequences?: string[];
  hookSpecificOutput?: Record<string, unknown>[];
  pendingHooks?: { index: number; type: "prompt" | "agent" | "command" | "callback" | "mcp_tool"; reason: string }[];
  backgroundTasks?: string[];
  /** Supplemental claims; the synchronous lifecycle journal callback commits them. */
  consumedOnce?: HookOnceRecord[];
};

const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_HOOK_OUTPUT_BYTES = 64 * 1024;
const MAX_HOOK_INPUT_BYTES = 1024 * 1024;
const MAX_TERMINAL_SEQUENCES = 128;
const MAX_TERMINAL_OUTPUT_BYTES = 32 * 1024;
const PIPE_GRACE_MS = 200;
const BLOCKING_EXIT_CODE = 2;
// Exit code 2 blocks these events. Stop treats it as a continuation request;
// PreCompact/PostToolBatch/PostToolUseFailure treat it as a block (the consumer
// decides whether that ends the run or is surfaced as feedback). Every other
// event — SessionStart/PostToolUse and the display-only PostCompact/StopFailure/
// SessionEnd — records a non-zero exit (including 2) as a non-blocking note so a
// feedback hook can never gate a step it did not run for.
const BLOCKING_EVENTS: ReadonlySet<HookEvent> = new Set([
  "PreToolUse",
  "UserPromptSubmit",
  "Stop",
  "PreCompact",
  "PostToolBatch",
  "PostToolUseFailure",
  "PermissionRequest",
  "SubagentStop",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
  "Elicitation",
  "WorktreeCreate",
]);
// `Zge` (chunk-sfn1dbxq.js offset 564884) also includes TaskCreated, so a
// top-level `decision:"block"` from that event becomes a blocking error.
// A top-level `decision:"block"` is honored only for these events. PreToolUse
// uses `hookSpecificOutput.permissionDecision` instead, and the display-only
// events ignore a top-level decision entirely.
const DECISION_BLOCK_EVENTS: ReadonlySet<HookEvent> = new Set([
  "Stop",
  "PreCompact",
  "PostToolBatch",
  "PostToolUseFailure",
  "SubagentStop",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted",
]);
const PERMISSION_DECISIONS: ReadonlySet<string> = new Set(["allow", "deny", "ask", "defer"]);
const MATCH_ALL: ReadonlySet<string> = new Set(["*", ".*"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  return [];
}

/**
 * Select the transition field a matcher is tested against. Ports `y5e`
 * (chunk-sfn1dbxq.js, UTF-16 [2984225,2985215)): each event has one selector
 * field, FileChanged matches the file's basename, and an event outside the
 * selector table has no value, which means its configured matchers match every
 * occurrence. `g4e`/`zIt` model-alias normalization stays out of this port;
 * Pre/PostModelSwitch use the requested model text as carried by the payload.
 */
export function hookMatcherValue(event: HookEvent, payload: HookPayload): string | undefined {
  const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
  switch (event) {
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionRequest":
    case "PermissionDenied":
      return text(payload.tool_name);
    case "UserPromptExpansion":
      return text(payload.command_name);
    case "SessionStart":
      return text(payload.source);
    case "Setup":
      return text(payload.trigger);
    case "PreCompact":
    case "PostCompact":
      return text(payload.trigger);
    case "PreModelSwitch":
    case "PostModelSwitch":
      return text(payload.to_model);
    case "Notification":
      return text(payload.notification_type);
    case "SessionEnd":
      return text(payload.reason);
    case "StopFailure":
      return text(payload.error);
    case "SubagentStart":
    case "SubagentStop":
      return text(payload.agent_type);
    case "TeammateIdle":
    case "TaskCreated":
    case "TaskCompleted":
      return undefined;
    case "Elicitation":
    case "ElicitationResult":
      return text(payload.mcp_server_name) ?? text(payload.server_name);
    case "ConfigChange":
      return text(payload.source);
    case "DirectoryAdded":
      return text(payload.source);
    case "InstructionsLoaded":
      return text(payload.load_reason);
    case "FileChanged": {
      const file = text(payload.file_path);
      return file === undefined ? undefined : basename(file);
    }
    default:
      return undefined;
  }
}

/**
 * Match a hook matcher against a selector value. Matched alternatives are exact
 * string equality first, then a full-string regular expression so a plain name
 * ("Bash") behaves as an exact match while "Edit|Write" or "mcp__.*" also work.
 * An invalid regex falls back to exact-only and never throws.
 */
function matcherMatches(matcher: string | undefined, value: string | undefined): boolean {
  if (matcher === undefined || matcher.trim() === "") return true;
  const pattern = matcher.trim();
  if (MATCH_ALL.has(pattern)) return true;
  if (value === undefined) return false;
  if (pattern === value) return true;
  try { return new RegExp(`^(?:${pattern})$`).test(value); }
  catch { return false; }
}

function trimIncompleteTail(buf: Buffer): Buffer {
  if (buf.length === 0) return buf;
  let index = buf.length;
  let continuation = 0;
  while (index > 0 && continuation < 3 && (buf[index - 1]! & 0xc0) === 0x80) {
    index -= 1;
    continuation += 1;
  }
  if (index === 0) return buf;
  const lead = buf[index - 1]!;
  let expected: number;
  if (lead < 0x80) expected = 1;
  else if ((lead & 0xe0) === 0xc0) expected = 2;
  else if ((lead & 0xf0) === 0xe0) expected = 3;
  else if ((lead & 0xf8) === 0xf0) expected = 4;
  else return buf;
  if (buf.length - (index - 1) >= expected) return buf;
  return buf.subarray(0, index - 1);
}

function decode(buf: Buffer): string {
  return trimIncompleteTail(buf).toString("utf8");
}

// ---------------------------------------------------------------------------
// Bounded, cancellable command execution (POSIX process group)
// ---------------------------------------------------------------------------

type RawHookResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  aborted: boolean;
  truncated: boolean;
  spawnError: NodeJS.ErrnoException | null;
};

export function runHookCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  input: string,
  signal: AbortSignal,
): Promise<RawHookResult> {
  return new Promise<RawHookResult>((resolve) => {
    if (signal.aborted) {
      resolve({ stdout: "", stderr: "", code: null, timedOut: false, aborted: true, truncated: false, spawnError: null });
      return;
    }

    let child: ChildProcess;
    try {
      child = spawn("/bin/sh", ["-c", command], {
        cwd,
        env: process.env,
        detached: true, // own process group so the whole tree can be killed
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        stdout: "",
        stderr: "",
        code: null,
        timedOut: false,
        aborted: false,
        truncated: false,
        spawnError: error as NodeJS.ErrnoException,
      });
      return;
    }

    let settled = false;
    let timedOut = false;
    let aborted = false;
    let truncated = false;
    let exitCode: number | null = null;
    let outBytes = 0;
    let errBytes = 0;
    const outParts: Buffer[] = [];
    const errParts: Buffer[] = [];
    let grace: NodeJS.Timeout | undefined;

    const killGroup = () => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    };
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killGroup();
          }, timeoutMs)
        : undefined;
    const onAbort = () => {
      aborted = true;
      killGroup();
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (grace) clearTimeout(grace);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        stdout: decode(Buffer.concat(outParts)),
        stderr: decode(Buffer.concat(errParts)),
        code: exitCode,
        timedOut,
        aborted,
        truncated,
        spawnError: null,
      });
    };

    signal.addEventListener("abort", onAbort, { once: true });

    // Bound each stream; a hook cannot exhaust memory through its output.
    child.stdout?.on("data", (chunk: Buffer) => {
      const room = Math.max(0, MAX_HOOK_OUTPUT_BYTES - outBytes);
      if (room > 0) outParts.push(chunk.subarray(0, room));
      outBytes += chunk.length;
      if (outBytes > MAX_HOOK_OUTPUT_BYTES) truncated = true;
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const room = Math.max(0, MAX_HOOK_OUTPUT_BYTES - errBytes);
      if (room > 0) errParts.push(chunk.subarray(0, room));
      errBytes += chunk.length;
      if (errBytes > MAX_HOOK_OUTPUT_BYTES) truncated = true;
    });

    child.stdin?.on("error", () => {
      /* the hook may exit before reading stdin (EPIPE); ignore */
    });
    child.stdin?.end(input);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        stdout: "",
        stderr: "",
        code: null,
        timedOut,
        aborted,
        truncated,
        spawnError: error as NodeJS.ErrnoException,
      });
    });
    child.on("exit", (code) => {
      // The shell has exited; detached descendants may still hold the pipes
      // open. Kill the group now and bound how long we wait to drain.
      exitCode = code;
      if (timer) clearTimeout(timer);
      killGroup();
      grace = setTimeout(() => {
        try {
          child.stdout?.destroy();
        } catch {
          /* ignore */
        }
        try {
          child.stderr?.destroy();
        } catch {
          /* ignore */
        }
        finish();
      }, PIPE_GRACE_MS);
    });
    child.on("close", () => finish());
  });
}

// HTTP/resolver transports share the command output translator, but require JSON.
function emptyRaw(overrides: Partial<RawHookResult> = {}): RawHookResult {
  return { stdout: "", stderr: "", code: null, timedOut: false, aborted: false, truncated: false, spawnError: null, ...overrides };
}
// Direct callers without a lifecycle still share capacity by resolver identity;
// this fallback never shares once claims across otherwise independent runs.
const resolverOwners = new WeakMap<Function, HookLifecycle>();
function resolverOwner(resolver: Function): HookLifecycle {
  let owner = resolverOwners.get(resolver);
  if (!owner) { owner = new HookLifecycle(); resolverOwners.set(resolver, owner); }
  return owner;
}
function httpHookHeaders(definition: Extract<HookDefinition, { type: "http" }>, environment: NodeJS.ProcessEnv): Headers | string {
  const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
  for (const [name, variable] of Object.entries(definition.headersEnv ?? {})) {
    if (["host", "content-length", "transfer-encoding", "connection", "content-type"].includes(name.toLowerCase())) return "HTTP hook reserved header name.";
    const value = environment[variable];
    if (value === undefined || /[\r\n\x00]/.test(value)) return "HTTP hook header environment variable is missing or invalid.";
    try { headers.set(name, value); }
    catch { return "HTTP hook header environment variable is missing or invalid."; }
  }
  return headers;
}
async function runHookHttp(definition: Extract<HookDefinition, { type: "http" }>, input: string, timeoutMs: number, signal: AbortSignal, headers: Headers): Promise<RawHookResult> {
  if (signal.aborted) return emptyRaw({ aborted: true });
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(definition.url, { method: "POST", headers, body: input, signal: controller.signal, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      return emptyRaw({ stderr: "HTTP hook redirect rejected.", code: 1 });
    }
    if (!response.ok) {
      await response.body?.cancel();
      return emptyRaw({ stderr: `HTTP hook returned status ${response.status}.`, code: 1 });
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > MAX_HOOK_OUTPUT_BYTES) {
            await reader.cancel();
            return emptyRaw({ stderr: "HTTP hook response exceeded output cap.", code: 1, truncated: true });
          }
          chunks.push(Buffer.from(next.value));
        }
      } finally { reader.releaseLock(); }
    }
    if (signal.aborted) return emptyRaw({ aborted: true });
    const stdout = decode(Buffer.concat(chunks));
    if (!parseHookJson(stdout)) return emptyRaw({ stderr: "HTTP hook returned malformed JSON object.", code: 1 });
    return emptyRaw({ stdout, code: 0 });
  } catch {
    return emptyRaw({ timedOut, aborted: signal.aborted, stderr: timedOut || signal.aborted ? "" : "HTTP hook transport failed.", code: 1 });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
async function runResolvedHook<D extends HookDefinition>(definition: D, event: HookEvent, payload: HookPayload, signal: AbortSignal, timeoutMs: number,
  resolver: (definition: D, event: HookEvent, payload: HookPayload, signal: AbortSignal) => Promise<unknown>, label: string, release: () => void): Promise<RawHookResult> {
  if (signal.aborted) { release(); return emptyRaw({ aborted: true }); }
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let onAbort = (): void => {};
  const cancelled = new Promise<RawHookResult>(resolve => {
    onAbort = () => { controller.abort(); resolve(emptyRaw({ aborted: true })); };
    signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => { controller.abort(); resolve(emptyRaw({ timedOut: true })); }, timeoutMs);
  });
  // Invoke in this synchronous turn so a claim never precedes a deferred start.
  let resolved: Promise<unknown>;
  try { resolved = Promise.resolve(resolver(definition, event, payload, controller.signal)); }
  catch { resolved = Promise.reject(new Error(`${label} hook resolver failed.`)); }
  const execution = resolved.then(value => {
    const stdout = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof stdout !== "string" || Buffer.byteLength(stdout) > MAX_HOOK_OUTPUT_BYTES) return emptyRaw({ stderr: `${label} hook response exceeded output cap or was absent.`, code: 1, truncated: true });
    const json = parseHookJson(stdout);
    if (!json) return emptyRaw({ stderr: `${label} hook returned malformed JSON object.`, code: 1 });
    if (typeof json.ok === "boolean") return emptyRaw({ code: json.ok ? 0 : 2, stderr: asString(json.reason) ?? `${label} hook blocked the event.`, stdout: json.ok ? stdout : "" });
    return emptyRaw({ stdout, code: 0 });
  }).catch(() => emptyRaw({ stderr: `${label} hook resolver failed.`, code: 1 })).finally(release);
  try { return await Promise.race([execution, cancelled]); }
  finally { if (timer) clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
}

// ---------------------------------------------------------------------------
// stdout JSON interpretation
// ---------------------------------------------------------------------------

function parseHookJson(stdout: string): Record<string, unknown> | null {
  const text = stdout.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Apply a parsed stdout object onto `result`.
 *
 * PreCompact is a raw-stdout contract: the caller appends the hook's trimmed
 * stdout verbatim (see `runHooks`), so only terminal side effects and decisions are consumed here
 * and `continue:false` is ignored; only a top-level `decision:"block"` is
 * honored. Every other event parses the standard protocol: top-level and
 * `hookSpecificOutput.additionalContext` append (the latter only when its
 * `hookEventName` matches), `continue:false` blocks and requests a terminal
 * stop, a top-level `decision:"block"` blocks the events in
 * `DECISION_BLOCK_EVENTS`, and `permissionDecision` is PreToolUse-only.
 *
 * Display-only events (PostCompact/StopFailure/SessionEnd) may still carry
 * `blocked`/`stopRequested` here; the caller is documented to ignore those flags
 * for those events and use only the returned context.
 */
function applyJsonOutput(event: HookEvent, json: Record<string, unknown>, result: HookResult): void {
  const sequence = validateHookTerminalSequence(json.terminalSequence);
  if (sequence !== undefined) {
    const sequences = result.terminalSequences ?? [];
    const bytes = sequences.reduce((total, item) => total + Buffer.byteLength(item, "utf8"), 0);
    if (sequences.length >= MAX_TERMINAL_SEQUENCES || bytes + Buffer.byteLength(sequence, "utf8") > MAX_TERMINAL_OUTPUT_BYTES) {
      const diagnostic = `Hook terminalSequence aggregate exceeded ${MAX_TERMINAL_SEQUENCES} entries or ${MAX_TERMINAL_OUTPUT_BYTES} bytes; excess sequence dropped.`;
      const messages = result.systemMessages ??= [];
      if (!messages.includes(diagnostic)) messages.push(diagnostic);
    } else (result.terminalSequences ??= []).push(sequence);
  }
  if (event === "PreCompact") {
    if (json.decision === "block") {
      result.blocked = true;
      result.reason ??= asString(json.reason) ?? "PreCompact hook requested a block";
    }
    return;
  }

  // Top-level display fields are retained independently of event-specific data.
  result.additionalContext.push(...strings(json.additionalContext));
  if (typeof json.suppressOutput === "boolean") result.suppressOutput = json.suppressOutput;
  const messages = strings(json.systemMessage);
  if (messages.length) (result.systemMessages ??= []).push(...messages);

  if (json.continue === false) {
    // Explicit, unambiguous stop request: block the event *and* tell the parent
    // to terminate the session rather than resume another turn.
    result.blocked = true;
    result.stopRequested = true;
    result.reason ??= asString(json.stopReason) ?? asString(json.reason) ?? "hook stopped continuation";
  }

  // A Stop hook's top-level `decision:"block"` is a continuation request; for
  // PostToolBatch/PostToolUseFailure it is a block. The consumer decides whether
  // a block ends the run or is surfaced as feedback.
  if (DECISION_BLOCK_EVENTS.has(event) && json.decision === "block") {
    result.blocked = true;
    result.reason ??=
      asString(json.reason) ?? (event === "Stop" ? "Stop hook requested continuation" : `${event} hook requested a block`);
  }

  const specific = json.hookSpecificOutput;
  if (typeof specific !== "object" || specific === null || Array.isArray(specific)) return;
  const output = specific as Record<string, unknown>;
  // Validation: hookEventName must match the event this hook ran for.
  if (output.hookEventName !== event) return;

  result.additionalContext.push(...strings(output.additionalContext));
  // Command and HTTP hooks may add watched paths (`hookSpecificOutput.watchPaths`;
  // `Vln` collects them at chunk-sfn1dbxq.js [2935234,2935532)).
  if (Array.isArray(output.watchPaths)) {
    const paths = output.watchPaths.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (paths.length) (result.watchPaths ??= []).push(...paths);
  }
  (result.hookSpecificOutput ??= []).push(output);
  if (event === "PostToolUse" && output.updatedToolOutput !== undefined) result.updatedToolOutput = output.updatedToolOutput;
  if (event === "UserPromptExpansion" && typeof output.updatedPrompt === "string") result.updatedPrompt = output.updatedPrompt;
  // MessageDisplay is display-only: `hookSpecificOutput.displayContent` replaces the delta on
  // screen while the stored message and what the model sees stay unchanged (source output
  // processing at chunk-sfn1dbxq.js offset 2967137).
  if (event === "MessageDisplay" && typeof output.displayContent === "string") result.displayContent = output.displayContent;
  if (event === "PermissionRequest") {
    const permission = output.decision;
    if (permission && typeof permission === "object" && !Array.isArray(permission)) {
      const decision = permission as Record<string, unknown>;
      if (decision.behavior === "allow" || decision.behavior === "deny") {
        if (!result.permissionDecision || result.permissionDecision === "allow") result.permissionDecision = decision.behavior;
        result.permissionDecisionReason ??= asString(decision.message) ?? asString(decision.reason);
        if (decision.behavior === "deny") {
          result.blocked = true;
          result.reason ??= result.permissionDecisionReason ?? "PermissionRequest hook denied the request";
        } else {
          if (decision.updatedInput !== undefined) result.updatedInput = decision.updatedInput;
          if (Array.isArray(decision.updatedPermissions)) result.updatedPermissions = decision.updatedPermissions;
        }
      }
    }
    return;
  }
  if (event !== "PreToolUse") return;
  const decision = output.permissionDecision;
  if (typeof decision === "string" && PERMISSION_DECISIONS.has(decision)) {
    // A later allowing hook may update input but cannot erase an earlier gate.
    if (!result.permissionDecision || result.permissionDecision === "allow") result.permissionDecision = decision as NonNullable<HookResult["permissionDecision"]>;
    result.permissionDecisionReason ??= asString(output.permissionDecisionReason);
  }
  if (decision === "deny") {
    result.blocked = true;
    result.reason ??=
      asString(output.permissionDecisionReason) ?? asString(json.reason) ?? `Blocked by ${event} hook`;
  } else if (decision === "ask" || decision === "defer") {
    // This harness has no interactive permission UI. A hook that asks or
    // defers must not silently allow the call: record the request and deny
    // until the parent runtime resolves it.
    result.blocked = true;
    result.reason ??= `PreToolUse hook requested "${decision}"; no interactive confirmation is available, treated as deny-until-UI`;
  } else if (decision === "allow" || decision === undefined) {
    if (output.updatedInput !== undefined) result.updatedInput = output.updatedInput;
  }
  // Any other permissionDecision value is ignored.
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run every configured hook for `event` and merge their outcomes.
 *
 * Hooks run in configuration order. Matching hooks all run (a later hook may
 * add context even after an earlier one blocks); the first blocking reason
 * wins. Aborting `signal` stops the command group immediately and prevents
 * further hooks from starting; the result reflects whatever completed.
 */
export async function runHooks(
  config: HooksConfig,
  event: HookEvent,
  payload: HookPayload = {},
  signal: AbortSignal = new AbortController().signal,
  options: HookRunOptions = {},
): Promise<HookResult> {
  const result: HookResult = { blocked: false, additionalContext: [] };
  const definitions = flattenHookDefinitions(config, event);
  if (definitions.length === 0) return result;
  const lifecycle = options.lifecycle ?? new HookLifecycle();
  const matcherValue = hookMatcherValue(event, payload);
  // True once any hook's stdout JSON contributed context. A Stop hook that adds
  // context is a continuation request (handled after the loop); diagnostic notes
  // such as timeout/abort must not count.
  let stopContext = false;
  // The hook stdin is newline-terminated so line-reader consumers can process
  // the JSON record without waiting for EOF.
  const input = `${JSON.stringify({ ...payload, hook_event_name: event })}\n`;
  if (Buffer.byteLength(input) > MAX_HOOK_INPUT_BYTES && definitions.length > 0) {
    result.additionalContext.push(`[${event} hook: input exceeded ${MAX_HOOK_INPUT_BYTES} byte cap; hooks were not started]`);
    if (BLOCKING_EVENTS.has(event)) { result.blocked = true; result.reason = "Hook input exceeded byte cap"; }
    return result;
  }
  const cwd = asString(payload.cwd) ?? process.cwd();
  // Failure text stays in additionalContext for the model and is also kept
  // separately so a watcher can display it like the recovered failed-hook
  // output (`ke`, chunk-sfn1dbxq.js [1678937,1679425)).
  const fail = (message: string): void => {
    result.additionalContext.push(message);
    (result.failures ??= []).push(message);
  };

  for (const [index, flattened] of definitions.entries()) {
    const stored = flattened.definition;
    const parsed = hookDefinitionSchema.safeParse(stored);
    if (!parsed.success) {
      // Preserve the historical skip for an empty legacy command; other invalid
      // definitions produce a diagnostic instead of silently claiming execution.
      if ((stored as { command?: unknown })?.command !== "") result.additionalContext.push(`[${event} hook: invalid definition at index ${index}]`);
      continue;
    }
    const definition = parsed.data;
    if (matcherValue !== undefined && !flattened.matches(matcherValue)) continue;
    if (definition.once && lifecycle.has(flattened.identity.key)) continue;
    if (signal.aborted) {
      result.additionalContext.push(`[${event} hook: not run, cancelled before start]`);
      break;
    }

    const seconds =
      typeof definition.timeout === "number" && definition.timeout > 0
        ? definition.timeout
        : DEFAULT_TIMEOUT_SECONDS;
    const timeoutMs = Math.max(1, Math.floor(seconds * 1000));
    const modelHook = definition.type === "prompt" || definition.type === "agent";
    const asyncCommand = (definition.type === undefined || definition.type === "command") && definition.async;
    if (modelHook && !options.resolveModelHook) {
      const reason = "model hook resolver is pending parent integration";
      (result.pendingHooks ??= []).push({ index, type: definition.type, reason });
      result.additionalContext.push(`[${event} ${definition.type} hook: ${reason}]`);
      if (BLOCKING_EVENTS.has(event)) { result.blocked = true; result.reason ??= reason; }
      continue;
    }
    if ((definition.type === "callback" && !options.resolveCallbackHook) || (definition.type === "mcp_tool" && !options.resolveMcpHook)) {
      const option = definition.type === "callback" ? "resolveCallbackHook" : "resolveMcpHook";
      const reason = `Configure trusted HookRunOptions.${option} before running ${definition.type} hooks.`;
      (result.pendingHooks ??= []).push({ index, type: definition.type, reason });
      result.additionalContext.push(`[${event} ${definition.type} hook: ${reason}]`);
      if (BLOCKING_EVENTS.has(event)) { result.blocked = true; result.reason ??= reason; }
      continue;
    }
    if (asyncCommand && !options.startAsyncCommand) {
      const reason = "async command owner registry is pending parent integration";
      (result.pendingHooks ??= []).push({ index, type: "command", reason });
      result.additionalContext.push(`[${event} hook: ${reason}]`);
      if (BLOCKING_EVENTS.has(event)) { result.blocked = true; result.reason ??= reason; }
      continue;
    }
    let headers: Headers | undefined;
    if (definition.type === "http") {
      const prepared = httpHookHeaders(definition, options.environment ?? process.env);
      if (typeof prepared === "string") {
        result.additionalContext.push(`[${event} hook: exit code 1] ${prepared}`);
        continue;
      }
      headers = prepared;
    }
    if (signal.aborted) {
      result.additionalContext.push(`[${event} hook: not run, cancelled before start]`);
      break;
    }
    // Reserve before the journal callback, which may reenter the runner.
    const resolvedHook = modelHook || definition.type === "callback" || definition.type === "mcp_tool";
    const resolver = modelHook ? options.resolveModelHook : definition.type === "callback" ? options.resolveCallbackHook : options.resolveMcpHook;
    const stageOwner = resolvedHook ? options.lifecycle ?? resolverOwner(resolver!) : undefined;
    const release = stageOwner?.tryStartResolverStage();
    if (resolvedHook && !release) {
      const reason = "Hook resolver capacity reached (16 active stages); wait for outstanding resolvers to settle.";
      result.additionalContext.push(`[${event} hook: ${reason}]`);
      if (BLOCKING_EVENTS.has(event)) { result.blocked = true; result.reason ??= reason; }
      continue;
    }
    // Claim and journal in the same turn as execution, before its first await.
    try {
      if (definition.once) {
        if (!lifecycle.claim(flattened.identity.key)) { release?.(); continue; }
        (result.consumedOnce ??= []).push({ ...flattened.identity });
      }
    } catch (error) {
      release?.();
      throw error;
    }
    let raw: RawHookResult;
    if (definition.type === "http") raw = await runHookHttp(definition, input, timeoutMs, signal, headers!);
    else if (definition.type === "prompt" || definition.type === "agent") {
      raw = await runResolvedHook(definition, event, payload, signal, timeoutMs, options.resolveModelHook!, "Model", release!);
    } else if (definition.type === "callback") {
      raw = await runResolvedHook(definition, event, payload, signal, timeoutMs, options.resolveCallbackHook!, "Callback", release!);
    } else if (definition.type === "mcp_tool") {
      raw = await runResolvedHook(definition, event, payload, signal, timeoutMs, options.resolveMcpHook!, "MCP", release!);
    } else if (definition.type === "script") {
      raw = await runHookCommand(definition.command, cwd, timeoutMs, input, signal);
    } else if (definition.async) {
      try {
        const id = await options.startAsyncCommand!({ definition, event, payload, input, cwd, timeoutMs, signal });
        if (typeof id !== "string" || !id) throw new Error("Missing owned task id");
        (result.backgroundTasks ??= []).push(id);
      } catch { result.additionalContext.push(`[${event} hook: async owner registration failed]`); }
      continue;
    } else raw = await runHookCommand(definition.command, cwd, timeoutMs, input, signal);

    if (raw.aborted) {
      result.additionalContext.push(`[${event} hook: aborted, process group killed]`);
      break;
    }
    if (raw.spawnError) {
      fail(`[${event} hook: failed to launch: ${raw.spawnError.message}]`);
      continue;
    }

    if (raw.truncated) {
      result.additionalContext.push(`[${event} hook: output truncated at ${MAX_HOOK_OUTPUT_BYTES} bytes]`);
    }
    if (raw.code === 0 && !raw.truncated && !raw.timedOut) {
      // PreCompact is a raw-stdout contract: a successful hook's trimmed stdout
      // becomes context verbatim (even when it is raw JSON), independent of the
      // structured protocol handled below.
      if (event === "PreCompact") {
        const text = raw.stdout.trim();
        if (text.length > 0) {
          result.additionalContext.push(text);
          (result.newCustomInstructions ??= []).push(text);
        }
      }
      const json = parseHookJson(raw.stdout);
      if (json) {
        const before = result.additionalContext.length;
        applyJsonOutput(event, json, result);
        if (result.additionalContext.length > before) stopContext = true;
      } else if (event === "PostCompact") {
        const text = raw.stdout.trim();
        if (text) result.additionalContext.push(text);
      }
    }

    if (raw.timedOut) {
      fail(`[${event} hook: timed out after ${timeoutMs}ms, process group killed]`);
      continue;
    }
    if (raw.code === BLOCKING_EXIT_CODE) {
      if (BLOCKING_EVENTS.has(event)) {
        result.blocked = true;
        result.reason ??=
          raw.stderr.trim() || raw.stdout.trim() || `${event} hook exited with status 2`;
      } else {
        // Display-only events (SessionStart/PostToolUse/PostCompact/StopFailure/
        // SessionEnd) must never block: record the failure, do not gate.
        fail(
          `[${event} hook: exit code 2 is non-blocking for this event]${raw.stderr.trim() ? ` ${raw.stderr.trim()}` : ""}`,
        );
      }
    } else if (raw.code !== 0) {
      fail(
        `[${event} hook: exit code ${raw.code ?? "null"}]${raw.stderr.trim() ? ` ${raw.stderr.trim()}` : ""}`,
      );
    }
  }

  // A Stop hook that contributes context asks for continuation: block the stop
  // so the parent runs another turn with that context, but never set the terminal
  // stopRequested flag (so an explicit continue:false still wins).
  if (event === "Stop" && stopContext && !result.blocked) {
    result.blocked = true;
    result.reason ??= "Stop hook returned additional context";
  }

  return result;
}
