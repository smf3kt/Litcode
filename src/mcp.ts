// MCP tools adapter with legacy stdio and Streamable HTTP transports.
// Server data is parsed as JSON and passed through as tool schemas/content.
// Stdio retains the 2024-11-05 handshake; HTTP negotiates modern versions in
// mcp-http.ts. Each connection reports limits for the transports it uses.

import { spawn, type ChildProcess } from "node:child_process";

import type { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";

import { McpHttpClient, MCP_HTTP_LIMITS, validateMcpHttpUrl, validateMcpHeadersEnv } from "./mcp-http.js";
import type { ToolContext, ToolDefinition } from "./tools.js";
import { mcpReconnectDelay, isTransientMcpFailure } from "./mcp-retry.js";
import { McpClientRequestHandler, MCP_CLIENT_REQUEST_LIMITS, type McpClientRequests } from "./mcp-client-requests.js";
import { McpResourceSubscriptions, McpSubscriptionPersistenceError, MCP_SUBSCRIPTION_LIMITS, MCP_MAX_RESOURCE_SUBSCRIPTIONS, MCP_MAX_RESOURCE_URI_BYTES, MCP_MAX_RESOURCE_NOTIFICATIONS, validateMcpResourceUri, type McpSubscriptionMethod } from "./mcp-subscriptions.js";
import { driveMcpTask, parseTaskHandle } from './mcp-task.js';
import { type StandardMcpTask, MCP_TASK_PROTOCOL_VERSION, standardTaskSupport, canAugmentTask, parseStandardTask, driveStandardMcpTask } from './mcp-standard-task.js';
import { McpLogging, MCP_LOGGING_LIMITS, MCP_LOG_LEVELS, MCP_MAX_LOG_NOTIFICATIONS, validateMcpLogLevel } from "./mcp-logging.js";
export { MCP_LOGGING_LIMITS, MCP_LOG_LEVELS, MCP_MAX_LOG_NOTIFICATIONS, MCP_MAX_LOG_QUEUE_BYTES, MCP_MAX_LOG_MESSAGE_BYTES, MCP_MAX_LOG_METADATA_BYTES, MCP_MAX_LOG_LOGGER_BYTES, MCP_MAX_LOG_JSON_DEPTH, MCP_MAX_LOG_JSON_NODES } from "./mcp-logging.js";
export { MCP_SUBSCRIPTION_LIMITS, MCP_MAX_RESOURCE_SUBSCRIPTIONS, MCP_MAX_RESOURCE_URI_BYTES, MCP_MAX_RESOURCE_NOTIFICATIONS, MCP_MAX_RESOURCE_NOTIFICATION_BYTES } from "./mcp-subscriptions.js";
export type { McpClientRequests, McpClientRequestContext, McpRoot, McpElicitationParams, McpElicitationResult, McpSamplingParams, McpSamplingResult, McpSamplingContent, McpJson } from "./mcp-client-requests.js";

// ---------------------------------------------------------------------------
// Protocol constants and documented limits
// ---------------------------------------------------------------------------

/** Protocol version this client offers and is written against. */
export const MCP_PROTOCOL_VERSION = "2024-11-05";
/** Per-request deadline before the call is rejected and cancelled. */
export const MCP_REQUEST_TIMEOUT_MS = 30_000;
/** Maximum size of a single inbound stdout frame (one JSON-RPC line). */
export const MCP_MAX_FRAME_BYTES = 1024 * 1024; // 1 MiB
/** Bytes of stderr retained as diagnostic context for error messages. */
export const MCP_STDERR_CAP_BYTES = 8192;
/** Upper bound on `tools/list` pages followed before giving up. */
export const MCP_MAX_LIST_PAGES = 1000;
/** Tool inventories are bounded across pages and configured servers. */
export const MCP_MAX_TOTAL_TOOLS = 10_000;
export const MCP_MAX_TOOL_CATALOG_BYTES = 8 * 1024 * 1024;
/** Maximum tool-name length accepted by the Messages tool schema. */
export const MCP_TOOL_NAME_MAX = 128;
/**
 * Protocol versions this client accepts from an `initialize` result. Only the
 * version this client is written against is listed; a server that reports a
 * missing or different version is rejected before the handshake completes.
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [MCP_PROTOCOL_VERSION];
/** Bound on how long teardown waits for the leader to be reaped before it stops waiting on inherited pipes. */
export const MCP_REAP_TIMEOUT_MS = 2000;

const MCP_CLIENT_NAME = "personal-agent-harness";
const MCP_CLIENT_VERSION = "0.1.0";
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;
const TOOL_NAME_CHAR = /[A-Za-z0-9_-]/;
const TOOL_NAME_SHAPE = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * What this adapter does not speak. Surfaced on the connection so callers can
 * report the supported envelope instead of assuming full MCP coverage.
 */
export const MCP_PROTOCOL_LIMITS: readonly string[] = [
  "stdio transport: local child process with newline-delimited JSON-RPC; a failed child is always closed and cleared, and with recovery enabled the next tool call or catalog request dials one fresh process instead of using a background timer, while without recovery the connection stays unavailable until an explicit reconnect; the failed call is never replayed, and a changed tool catalog still fails the pinned-metadata check",
  "stdio authentication: no client authentication flow or credential storage; environment is passed to the child process",
  "server features: tools only (resources, prompts, sampling, roots and logging are not implemented)",
  "server-initiated requests: refused with a JSON-RPC method-not-found error",
  `stdio init-result protocol version: only ${MCP_PROTOCOL_VERSION} is accepted; a missing or different version is rejected before notifications/initialized`,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpStdioServerConfig = {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpHttpServerConfig = {
  type: "http";
  url: string;
  headersEnv?: Record<string, string>;
};

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

// Persist only credential references; direct stdio callers may still supply env.
export const mcpServersSchema = z.record(z.union([
  z.object({
    type: z.literal("stdio").optional(),
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
  }).strict(),
  z.object({
    type: z.literal("http"),
    url: z.string().superRefine((value, ctx) => {
      try { validateMcpHttpUrl(value); }
      catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid MCP HTTP URL" }); }
    }),
    headersEnv: z.record(z.string()).optional().superRefine((value, ctx) => {
      try { validateMcpHeadersEnv(value); }
      catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid MCP header environment mapping" }); }
    }),
  }).strict(),
]));

export type McpConnectContext = {
  workspace: string;
  signal: AbortSignal;
  maxOutputBytes: number;
};

export type McpConnectOptions = {
  requestTimeoutMs?: number;
  clientName?: string;
  clientVersion?: string;
  catalog?: boolean;
  dynamic?: boolean;
  deferred?: boolean;
  /** Connection-owned URI subscriptions; opt-in independently of resource catalogs. */
  subscriptions?: boolean;
  /** Restore URI subscriptions, degrade transient HTTP startup failures and extend retries; opt-in. */
  recovery?: boolean;
  /** Bind acknowledged URI intent to an owned session journal; requires recovery and subscriptions. */
  persistence?: boolean;
  /** Foreground resultType/task extension; no background replay. */
  tasks?: boolean;
  standardTasks?: boolean;
  taskJournal?: (server: string, tool: string, task: StandardMcpTask, resolved: boolean, result?: string, isError?: boolean) => void;
  /** Connection-owned log collection; absent by default. */
  logging?: boolean;
  /** Own one HTTP GET SSE notification stream; stdio ignores this option. */
  notificationStream?: boolean;
  /** Trusted in-memory host callbacks; absent by default and excluded from persisted config. */
  clientRequests?: McpClientRequests;
};
export type McpConnectSettings = Required<Omit<McpConnectOptions, "clientRequests" | "persistence" | "tasks" | "standardTasks" | "taskJournal">> & Pick<McpConnectOptions, "clientRequests" | "persistence" | "tasks" | "standardTasks" | "taskJournal">;

export type McpConnection = {
  tools: ToolDefinition[];
  close(): Promise<void>;
  limits: readonly string[];
  servers?: () => Record<string, McpServerStatus>;
  reconnect?: (server: string, signal: AbortSignal) => Promise<McpServerStatus>;
  resumeTask?: (server: string, task: StandardMcpTask, signal: AbortSignal) => Promise<McpToolResult>;
  bindSubscriptions?: (state: Record<string, readonly string[]>, commit: (server: string, method: McpSubscriptionMethod, uri: string) => void, signal: AbortSignal) => Promise<void>;
  /** Fresh per-server transport state, present only for opted-in HTTP streams. */
  notificationStreams?: () => Record<string, McpNotificationStreamStatus>;
};

export type McpServerStatus = {
  state: "connected" | "disconnected" | "reconnecting" | "closed";
  generation: number;
  attempts: number;
  automaticAttempts?: number;
  lastError?: string;
  retryPhase?: "fast" | "slow" | "exhausted" | "stopped";
};

export type McpNotificationStreamStatus = {
  state: "starting" | "active" | "unavailable" | "ended" | "failed" | "closed";
  reason?: string;
  reopenAttempts?: number;
  lastEventId?: string;
};

export type McpToolInfo = {
  name: string;
  description: string | undefined;
  inputSchema: unknown;
  readOnly: boolean;
  taskSupport?: 'required' | 'optional' | 'forbidden';
};

export type McpToolResult = {
  content: unknown[];
  structuredContent: unknown;
  isError: boolean;
};

export type McpCatalogMethod = "resources/list" | "resources/templates/list" | "resources/read" | "prompts/list" | "prompts/get";

export interface McpClient {
  onDisconnected?(listener: () => void): () => void;
  readonly notificationStreamStatus?: McpNotificationStreamStatus;
  readonly resourceSubscriptions?: McpResourceSubscriptions;
  readonly logging?: McpLogging;
  initialize(signal: AbortSignal): Promise<void>;
  listTools(signal: AbortSignal): Promise<McpToolInfo[]>;
  callTool(toolName: string, args: unknown, signal: AbortSignal, pinned?: McpToolInfo): Promise<McpToolResult>;
  resumeTask?(task: StandardMcpTask, signal: AbortSignal): Promise<McpToolResult>;
  supportsCatalog(family: "resources" | "prompts"): boolean;
  onToolsChanged(listener: () => void): () => void;
  catalogRequest(method: McpCatalogMethod, params: unknown, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}

// Both transports use the same pagination and tool result validation.
export async function listMcpTools(
  serverName: string,
  request: (method: string, params: unknown, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
): Promise<McpToolInfo[]> {
  const tools: McpToolInfo[] = [];
  const seenCursors = new Set<string>();
  let bytes = 0;
  let cursor: string | undefined;
  for (let page = 0; page < MCP_MAX_LIST_PAGES; page++) {
    const result = await request("tools/list", cursor === undefined ? {} : { cursor }, signal);
    if (!isRecord(result) || !Array.isArray(result.tools)) {
      throw new Error(`MCP server "${serverName}" returned an invalid tools/list result`);
    }
    if (tools.length + result.tools.length > MCP_MAX_TOTAL_TOOLS) throw new Error(`MCP tool catalog exceeds ${MCP_MAX_TOTAL_TOOLS} tools`);
    bytes += Buffer.byteLength(JSON.stringify(result.tools));
    if (bytes > MCP_MAX_TOOL_CATALOG_BYTES) throw new Error("MCP tool catalog exceeds byte limit");
    for (const raw of result.tools) tools.push(parseToolInfo(raw, serverName));
    const next = result.nextCursor;
    if (next === undefined || next === null) return tools;
    if (typeof next !== "string" || next.length === 0) {
      throw new Error(`MCP server "${serverName}" returned an invalid tools/list cursor`);
    }
    if (seenCursors.has(next)) {
      throw new Error(`MCP server "${serverName}" repeated a tools/list cursor (cycle)`);
    }
    seenCursors.add(next);
    cursor = next;
  }
  throw new Error(`MCP server "${serverName}" exceeded ${MCP_MAX_LIST_PAGES} tools/list pages`);
}

export function parseMcpToolResult(result: unknown, serverName: string): McpToolResult {
  if (!isRecord(result)) {
    throw new Error(`MCP server "${serverName}" returned an invalid tools/call result`);
  }
  return {
    content: Array.isArray(result.content) ? result.content : [],
    structuredContent: result.structuredContent,
    isError: result.isError === true,
  };
}

type PendingRequest = {
  method: string;
  onResult?: (result: unknown) => void;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function abortError(): Error {
  const error = new Error("MCP request aborted");
  error.name = "AbortError";
  return error;
}

/** Floor a positive finite number, or return undefined for anything unusable. */
function positiveLimit(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

/** Largest prefix length <= maxBytes that ends on a UTF-8 code point boundary. */
function utf8PrefixEnd(buf: Buffer, maxBytes: number): number {
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return end;
}

/** Cap text to a UTF-8 byte budget without ever emitting a replacement char. */
function capUtf8(text: string, maxBytes: number, label: string): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  const end = utf8PrefixEnd(buf, maxBytes);
  return `${buf.subarray(0, end).toString("utf8")}\n[mcp:${label} output truncated; ${buf.length - end} more bytes omitted]`;
}

/** A bounded, printable preview of unexpected stdout (never evaluated). */
function preview(text: string): string {
  return JSON.stringify(text.length > 200 ? `${text.slice(0, 200)}…` : text);
}

function rpcErrorMessage(serverName: string, method: string, error: unknown): string {
  const record = isRecord(error) ? error : {};
  const message = typeof record.message === "string" ? record.message : "unknown error";
  const code = typeof record.code === "number" ? ` (code ${record.code})` : "";
  return `MCP request "${method}" on server "${serverName}" failed: ${message}${code}`;
}

// ---------------------------------------------------------------------------
// Tool naming: sanitize, reject invalid, detect collisions
// ---------------------------------------------------------------------------

function sanitizeNamePart(part: string): string {
  let result = "";
  for (const char of part) result += TOOL_NAME_CHAR.test(char) ? char : "_";
  return result;
}

/**
 * Build the agent-visible tool name `mcp__<server>__<tool>`. Server and tool
 * names are sanitized (any character outside `[A-Za-z0-9_-]` becomes `_`);
 * names that sanitize to nothing, or that exceed the schema length limit, are
 * rejected. Collision detection across servers happens in connectMcpServers.
 */
export function mcpToolName(serverName: string, toolName: string): string {
  const server = sanitizeNamePart(serverName);
  const tool = sanitizeNamePart(toolName);
  if (server.length === 0) {
    throw new Error(`MCP server name is empty after sanitizing: ${JSON.stringify(serverName)}`);
  }
  if (tool.length === 0) {
    throw new Error(`MCP tool name is empty after sanitizing: ${JSON.stringify(toolName)}`);
  }
  const name = `mcp__${server}__${tool}`;
  if (name.length > MCP_TOOL_NAME_MAX || !TOOL_NAME_SHAPE.test(name)) {
    throw new Error(`MCP tool name is invalid after sanitizing: ${JSON.stringify(name)}`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------

/**
 * Turn an MCP tool result into the textual payload the agent sees. Purely
 * textual results are joined with newlines; anything with images, resources or
 * structured content is rendered as indented JSON so no information is silently
 * dropped. The caller caps the result to the UTF-8 byte budget.
 */
function renderToolResult(result: McpToolResult): string {
  const { content, structuredContent } = result;
  const textOnly =
    content.length > 0 &&
    content.every(
      (block) => isRecord(block) && block.type === "text" && typeof block.text === "string",
    );
  if (textOnly && structuredContent === undefined) {
    return content.map((block) => (block as { text: string }).text).join("\n");
  }
  if (content.length === 0 && structuredContent === undefined) return "";
  const payload: Record<string, unknown> = { content };
  if (structuredContent !== undefined) payload.structuredContent = structuredContent;
  if (result.isError) payload.isError = true;
  return JSON.stringify(payload, null, 2);
}

function parseToolInfo(raw: unknown, serverName: string): McpToolInfo {
  if (!isRecord(raw) || typeof raw.name !== "string" || raw.name.length === 0) {
    throw new Error(`MCP server "${serverName}" returned a tool without a valid name`);
  }
  const annotations = isRecord(raw.annotations) ? raw.annotations : undefined;
  return {
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : undefined,
    inputSchema: raw.inputSchema,
    readOnly: annotations?.readOnlyHint === true,
    ...(isRecord(raw.execution) && raw.execution.taskSupport !== undefined ? { taskSupport: standardTaskSupport(raw.execution) } : {}),
  };
}

/** Pass the server's JSON schema through, guaranteeing the object root the SDK requires. */
function normalizeInputSchema(value: unknown): Anthropic.Tool["input_schema"] {
  const schema = (isRecord(value) ? { ...value } : {}) as Record<string, unknown>;
  schema.type = "object";
  return schema as unknown as Anthropic.Tool["input_schema"];
}

function toArguments(toolName: string, input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (isRecord(input)) return input;
  throw new Error(`MCP tool "${toolName}" expects a JSON object input`);
}

// ---------------------------------------------------------------------------
// Stdio JSON-RPC client
// ---------------------------------------------------------------------------

class McpStdioClient implements McpClient {
  readonly name: string;
  readonly resourceSubscriptions?: McpResourceSubscriptions;
  readonly logging?: McpLogging;
  private readonly child: ChildProcess;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly clientRequests: McpClientRequestHandler;
  private nextId = 1;
  private stdoutBuffer: Buffer = Buffer.alloc(0);
  private stderrTail: Buffer = Buffer.alloc(0);
  private closed = false;
  private failure: Error | null = null;
  private readonly taskLifetime = new AbortController();
  private capabilities: Record<string, unknown> = {};
  private version = MCP_PROTOCOL_VERSION;
  private taskTools = new Map<string, McpToolInfo>();
  private readonly toolsChangedListeners = new Set<() => void>();
  private readonly disconnectListeners = new Set<() => void>();
  onDisconnected(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => { this.disconnectListeners.delete(listener); };
  }
  private killed = false;
  private exitDone = false;
  private resolveExit!: () => void;
  private readonly exited: Promise<void>;

  constructor(
    name: string,
    config: McpStdioServerConfig,
    context: McpConnectContext,
    private readonly settings: McpConnectSettings,
  ) {
    this.name = name;
    this.clientRequests = new McpClientRequestHandler(name, settings.clientRequests);
    if (settings.subscriptions) this.resourceSubscriptions = new McpResourceSubscriptions(this.request.bind(this), () => isRecord(this.capabilities.resources) && this.capabilities.resources.subscribe === true);
    if (settings.logging) this.logging = new McpLogging(this.request.bind(this), () => isRecord(this.capabilities.logging));
    if (typeof config.command !== "string" || config.command.length === 0) {
      throw new Error(`MCP server "${name}" requires a non-empty command`);
    }
    const env = config.env ? { ...process.env, ...config.env } : process.env;
    this.child = spawn(config.command, config.args ?? [], {
      cwd: context.workspace,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      // Own process group on POSIX so close can kill any descendants too.
      detached: process.platform !== "win32",
    });
    this.exited = new Promise<void>((resolve) => {
      this.resolveExit = resolve;
    });
    // Never let a broken pipe surface as an unhandled stream error; teardown and
    // the process `error`/`exit` handlers own failure reporting.
    this.child.stdin?.on("error", () => undefined);
    this.child.stdout?.on("error", () => undefined);
    this.child.stderr?.on("error", () => undefined);
    this.child.stdout?.on("data", (chunk: Buffer) => this.ingest(chunk));
    this.child.stderr?.on("data", (chunk: Buffer) => this.captureStderr(chunk));
    this.child.on("error", (error) => {
      this.fail(
        new Error(`MCP server "${this.name}" failed to start or crashed: ${error.message}`),
      );
      this.markExited();
    });
    this.child.on("exit", (code, signal) => {
      if (!this.closed) {
        this.fail(
          new Error(
            `MCP server "${this.name}" exited (code ${code ?? "null"}${
              signal ? `, signal ${signal}` : ""
            })${this.stderrSuffix()}`,
          ),
        );
      }
      this.markExited();
    });
  }

  private markExited(): void {
    if (this.exitDone) return;
    this.exitDone = true;
    this.resolveExit();
  }

  // -- lifecycle ----------------------------------------------------------

  async close(): Promise<void> {
    this.taskLifetime.abort();
    this.closed = true;
    this.resourceSubscriptions?.close();
    this.logging?.close();
    this.rejectAll(new Error(`MCP server "${this.name}" connection closed`));
    this.kill();
    await Promise.all([this.clientRequests.close(), this.reap()]);
  }

  /**
   * Bound teardown so it never blocks on a descendant that inherited the stdio
   * pipes: wait for the leader to be reaped, but give up after
   * MCP_REAP_TIMEOUT_MS and release the pipes directly. Without this, Node's
   * `close` (which waits for stdio) could be postponed indefinitely by a
   * surviving descendant holding the write end open.
   */
  private async reap(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const bound = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MCP_REAP_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.exited, bound]);
    } finally {
      if (timer) clearTimeout(timer);
      for (const stream of [this.child.stdin, this.child.stdout, this.child.stderr]) {
        try {
          stream?.destroy();
        } catch {
          /* already closed */
        }
      }
    }
  }

  /**
   * Signal the server's process group exactly once. The group kill is retained
   * even when the leader has already exited: a POSIX process group outlives its
   * leader, so a descendant that outlived a normally-exited server still needs
   * SIGKILL. Checking `exitCode`/`signalCode` here (as an earlier version did)
   * skipped that sweep and leaked descendants. The single-shot guard bounds the
   * window in which the numeric group id could be reused.
   */
  private kill(): void {
    if (this.killed) return;
    this.killed = true;
    const child = this.child;
    if (process.platform !== "win32" && typeof child.pid === "number") {
      try {
        process.kill(-child.pid, "SIGKILL");
        return;
      } catch {
        /* group already gone: fall through to a direct signal */
      }
    }
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }

  private fail(error: Error): void {
    this.taskLifetime.abort();
    if (this.failure) return;
    this.failure = error;
    this.closed = true;
    this.resourceSubscriptions?.close();
    this.logging?.close();
    this.rejectAll(error);
    void this.clientRequests.close();
    this.kill();
    for (const listener of this.disconnectListeners) listener();
  }

  private rejectAll(error: Error): void {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const pending of entries) {
      this.finishPending(pending);
      pending.reject(error);
    }
  }

  // -- transport ----------------------------------------------------------

  private send(message: unknown): void {
    if (this.closed) throw new Error(`MCP server "${this.name}" is not connected`);
    const stdin = this.child.stdin;
    if (!stdin || stdin.destroyed || !stdin.writable) {
      throw new Error(`MCP server "${this.name}" stdin is not writable`);
    }
    stdin.write(`${JSON.stringify(message)}\n`, "utf8");
  }

  private trySend(message: unknown): void {
    try {
      this.send(message);
    } catch {
      /* best effort for notifications and refusals */
    }
  }

  private request(method: string, params: unknown, signal?: AbortSignal, onResult?: (result: unknown) => void): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(
        this.failure ?? new Error(`MCP server "${this.name}" is not connected`),
      );
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = {
        method,
        onResult,
        resolve,
        reject,
        timer: setTimeout(() => this.expire(id, pending), this.settings.requestTimeoutMs),
        signal,
      };
      if (signal) {
        pending.onAbort = () => this.abortRequest(id, pending);
        if (signal.aborted) {
          this.finishPending(pending);
          reject(abortError());
          return;
        }
        signal.addEventListener("abort", pending.onAbort, { once: true });
      }
      this.pending.set(id, pending);
      try {
        this.send({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        this.pending.delete(id);
        this.finishPending(pending);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private finishPending(pending: PendingRequest): void {
    clearTimeout(pending.timer);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
  }

  private expire(id: number, pending: PendingRequest): void {
    if (!this.pending.delete(id)) return;
    this.finishPending(pending);
    this.trySend({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: id, reason: "timeout" },
    });
    pending.reject(
      new Error(
        `MCP request "${pending.method}" on server "${this.name}" timed out after ${this.settings.requestTimeoutMs}ms`,
      ),
    );
  }

  private abortRequest(id: number, pending: PendingRequest): void {
    if (!this.pending.delete(id)) return;
    this.finishPending(pending);
    this.trySend({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: id, reason: "client aborted" },
    });
    pending.reject(abortError());
  }

  // -- inbound handling ---------------------------------------------------

  private captureStderr(chunk: Buffer): void {
    const combined =
      this.stderrTail.length === 0 ? chunk : Buffer.concat([this.stderrTail, chunk]);
    this.stderrTail =
      combined.length > MCP_STDERR_CAP_BYTES
        ? combined.subarray(combined.length - MCP_STDERR_CAP_BYTES)
        : combined;
  }

  private stderrSuffix(): string {
    if (this.stderrTail.length === 0) return "";
    const text = this.stderrTail.toString("utf8").trim();
    return text.length === 0 ? "" : `; stderr: ${text}`;
  }

  private ingest(chunk: Buffer): void {
    if (this.closed) return;
    this.stdoutBuffer =
      this.stdoutBuffer.length === 0 ? chunk : Buffer.concat([this.stdoutBuffer, chunk]);
    for (;;) {
      const newline = this.stdoutBuffer.indexOf(0x0a);
      if (newline === -1) break;
      const line = this.stdoutBuffer.subarray(0, newline);
      this.stdoutBuffer = this.stdoutBuffer.subarray(newline + 1);
      if (line.length > MCP_MAX_FRAME_BYTES) {
        this.fail(
          new Error(
            `MCP server "${this.name}" sent a frame larger than ${MCP_MAX_FRAME_BYTES} bytes`,
          ),
        );
        return;
      }
      this.handleLine(line);
      if (this.closed) return;
    }
    if (this.stdoutBuffer.length > MCP_MAX_FRAME_BYTES) {
      this.fail(
        new Error(
          `MCP server "${this.name}" sent a frame larger than ${MCP_MAX_FRAME_BYTES} bytes`,
        ),
      );
    }
  }

  private handleLine(line: Buffer): void {
    if (this.failure) return;
    let text = line.toString("utf8");
    if (text.endsWith("\r")) text = text.slice(0, -1);
    if (text.trim().length === 0) return;
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      this.fail(
        new Error(
          `MCP server "${this.name}" wrote non-JSON to stdout (protocol violation): ${preview(text)}`,
        ),
      );
      return;
    }
    this.dispatch(message);
  }

  private dispatch(message: unknown): void {
    if (!isRecord(message) || message.jsonrpc !== "2.0") {
      this.fail(new Error(`MCP server "${this.name}" sent a malformed JSON-RPC message`));
      return;
    }
    const method = typeof message.method === "string" ? message.method : undefined;
    const id =
      typeof message.id === "number" || typeof message.id === "string" ? message.id : undefined;
    if (method !== undefined) {
      if (id === undefined && method === "notifications/tools/list_changed") {
        for (const listener of this.toolsChangedListeners) listener();
      }
      if (!Object.hasOwn(message, "id") && method === "notifications/cancelled") {
        this.clientRequests.cancelled(message.params);
      }
      if (!Object.hasOwn(message, "id") && method === "notifications/resources/updated") this.resourceSubscriptions?.updated(message.params);
      if (!Object.hasOwn(message, "id") && method === "notifications/message") this.logging?.message(message.params);
      if (Object.hasOwn(message, "id")) {
        void this.clientRequests.handle(message, (reply) => this.send(reply)).catch(() => undefined);
      }
      return;
    }
    if (id === undefined || typeof id !== "number") return; // not a response to us
    const pending = this.pending.get(id);
    if (!pending) return; // response to a timeout/cancelled request: ignore
    this.pending.delete(id);
    this.finishPending(pending);
    if (pending.onResult && Object.hasOwn(message, "result") === Object.hasOwn(message, "error")) {
      pending.reject(new Error("MCP response requires exactly one result or error"));
      return;
    }
    if (message.error !== undefined) {
      const error = new Error(rpcErrorMessage(this.name, pending.method, message.error));
      if (isRecord(message.error) && Number.isFinite(message.error.code)) Object.assign(error, { code: message.error.code });
      pending.reject(error);
      return;
    }
    try { pending.onResult?.(message.result); pending.resolve(message.result); }
    catch (error) { pending.reject(error instanceof Error ? error : new Error(String(error))); }
  }

  // -- protocol calls -----------------------------------------------------

  async initialize(signal: AbortSignal): Promise<void> {
    const result = await this.request(
      "initialize",
      {
        protocolVersion: this.settings.standardTasks ? MCP_TASK_PROTOCOL_VERSION : MCP_PROTOCOL_VERSION,
        capabilities: this.settings.standardTasks ? { ...this.clientRequests.capabilities, tasks: {} } : this.clientRequests.capabilities,
        clientInfo: { name: this.settings.clientName, version: this.settings.clientVersion },
      },
      signal,
    );
    this.validateInitializeResult(result);
    this.capabilities = isRecord(result) && isRecord(result.capabilities) ? result.capabilities : {};
    this.version = (result as Record<string, string>).protocolVersion!;
    this.send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  }

  /**
   * Reject a missing or unsupported protocol version (or malformed metadata)
   * BEFORE announcing initialization, so a session is never marked initialized
   * against a version this client cannot speak.
   */
  private validateInitializeResult(result: unknown): void {
    if (!isRecord(result)) {
      throw new Error(`MCP server "${this.name}" returned an invalid initialize result`);
    }
    const version = result.protocolVersion;
    if (typeof version !== "string" || version.length === 0) {
      throw new Error(`MCP server "${this.name}" did not report a protocolVersion`);
    }
    if (!MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(version) && !(this.settings.standardTasks && version === MCP_TASK_PROTOCOL_VERSION)) {
      throw new Error(
        `MCP server "${this.name}" negotiated unsupported protocolVersion "${version}"; ` +
          `this client supports ${MCP_SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
      );
    }
    if (result.capabilities !== undefined && !isRecord(result.capabilities)) {
      throw new Error(`MCP server "${this.name}" returned malformed capabilities`);
    }
    if (result.serverInfo !== undefined && !isRecord(result.serverInfo)) {
      throw new Error(`MCP server "${this.name}" returned malformed serverInfo`);
    }
  }

  async listTools(signal: AbortSignal): Promise<McpToolInfo[]> {
    if ((this.settings.catalog || this.settings.subscriptions || this.settings.logging) && !isRecord(this.capabilities.tools)) return [];
    const tools = await listMcpTools(this.name, this.request.bind(this), signal);
    this.taskTools = new Map(tools.map(tool => [tool.name, tool]));
    return tools;
  }

  async callTool(toolName: string, args: unknown, signal: AbortSignal): Promise<McpToolResult> {
    const support = this.taskTools.get(toolName)?.taskSupport;
    if (!this.settings.standardTasks && support === 'required') throw new Error('MCP tool requires enabled standard task execution');
    const augment = this.settings.standardTasks && canAugmentTask(this.version, this.capabilities, support);
    let release: (() => void) | undefined;
    let result: unknown;
    try {
      result = await this.request("tools/call", { name: toolName, arguments: args, ...(augment ? { task: { ttl: this.settings.requestTimeoutMs } } : {}) }, signal,
        augment ? value => { release = this.clientRequests.ownTask(parseStandardTask(value).taskId); } : undefined);
      if (augment) {
        result = await driveStandardMcpTask(parseStandardTask(result), this.request.bind(this),
          AbortSignal.any([signal, this.taskLifetime.signal, AbortSignal.timeout(this.settings.requestTimeoutMs)]), isRecord(this.capabilities.tasks) && isRecord(this.capabilities.tasks.cancel));
        return parseMcpToolResult(result, this.name);
      }
    } finally { release?.(); }
    const task = this.settings.tasks ? parseTaskHandle(result) : undefined;
    if (task) result = await driveMcpTask({ task,
      signal: AbortSignal.any([signal, this.taskLifetime.signal, AbortSignal.timeout(this.settings.requestTimeoutMs)]),
      request: (method, params, requestSignal) => this.request(method, params, requestSignal),
      resolveInputRequest: (key, input, requestSignal) => this.clientRequests.resolveTaskInput(key, input, requestSignal),
    });
    return parseMcpToolResult(result, this.name);
  }

  supportsCatalog(family: "resources" | "prompts"): boolean {
    return isRecord(this.capabilities[family]);
  }

  onToolsChanged(listener: () => void): () => void {
    this.toolsChangedListeners.add(listener);
    return () => { this.toolsChangedListeners.delete(listener); };
  }

  catalogRequest(method: McpCatalogMethod, params: unknown, signal: AbortSignal): Promise<unknown> {
    return this.request(method, params, signal);
  }
}

// ---------------------------------------------------------------------------
// Tool adapter
// ---------------------------------------------------------------------------

function makeMcpTool(
  client: McpClient,
  serverName: string,
  info: McpToolInfo,
  name: string,
  context: McpConnectContext,
  beforeCall?: (signal: AbortSignal) => Promise<void>,
): ToolDefinition {
  return {
    readOnly: info.readOnly,
    schema: {
      name,
      description:
        info.description ?? `Tool "${info.name}" provided by local MCP server "${serverName}".`,
      input_schema: normalizeInputSchema(info.inputSchema),
    },
    async execute(input: unknown, toolContext: ToolContext): Promise<string> {
      const signal = toolContext.signal ?? context.signal;
      const cap =
        positiveLimit(toolContext.maxOutputBytes) ??
        positiveLimit(context.maxOutputBytes) ??
        FALLBACK_MAX_OUTPUT_BYTES;
      await beforeCall?.(signal);
      const result = await client.callTool(info.name, toArguments(name, input), signal, info);
      const text = renderToolResult(result);
      // A server-declared error is surfaced as a thrown tool error, not a
      // successful string result, so the agent loop marks tool_result.is_error.
      if (result.isError) throw new Error(capUtf8(text, cap, name));
      return capUtf8(text, cap, name);
    },
  };
}

export const MCP_CATALOG_LIMITS: readonly string[] = [
  "catalog: capability-aware resources/list, resources/templates/list, resources/read, prompts/list and prompts/get; results are inert JSON with output caps",
  "catalog pagination: bounded pages with cursor-cycle rejection; no resource subscriptions, prompt execution, sampling, roots or logging",
  "catalog discovery: explicit calls only; list_changed notifications do not refresh the connected tool schemas",
];

function catalogLimits(limits: readonly string[]): readonly string[] {
  return [...limits.filter((entry) => !entry.startsWith("server features:")), ...MCP_CATALOG_LIMITS];
}

function makeCatalogTools(clients: Map<string, McpClient>, context: McpConnectContext): ToolDefinition[] {
  const specifications = [
    { name: "mcp_resources_list", family: "resources", method: "resources/list", list: "resources", description: "List MCP resources or resource templates from a configured server.", properties: { templates: { type: "boolean", description: "List resource templates instead of concrete resources." } }, required: [] },
    { name: "mcp_resource_read", family: "resources", method: "resources/read", list: undefined, description: "Read an MCP resource URI through its configured server. Content is returned as data.", properties: { uri: { type: "string" } }, required: ["uri"] },
    { name: "mcp_prompts_list", family: "prompts", method: "prompts/list", list: "prompts", description: "List MCP prompt definitions from a configured server.", properties: {}, required: [] },
    { name: "mcp_prompt_get", family: "prompts", method: "prompts/get", list: undefined, description: "Retrieve an MCP prompt's messages as data using string arguments.", properties: { name: { type: "string" }, arguments: { type: "object", additionalProperties: { type: "string" } } }, required: ["name"] },
  ] as const;
  return specifications.filter((spec) => [...clients.values()].some((client) => client.supportsCatalog(spec.family))).map((spec): ToolDefinition => ({
    readOnly: true,
    schema: {
      name: spec.name,
      description: spec.description,
      input_schema: {
        type: "object", properties: { server: { type: "string", enum: [...clients].filter(([, client]) => client.supportsCatalog(spec.family)).map(([name]) => name) }, ...spec.properties },
        required: ["server", ...spec.required], additionalProperties: false,
      },
    },
    async execute(input: unknown, toolContext: ToolContext): Promise<string> {
      const args = toArguments(spec.name, input);
      const allowed = new Set(["server", ...Object.keys(spec.properties)]);
      if (Object.keys(args).some((key) => !allowed.has(key))) throw new Error(`MCP catalog tool "${spec.name}" received an unknown field`);
      if (typeof args.server !== "string" || !clients.has(args.server)) throw new Error("MCP catalog requires a configured server name");
      const client = clients.get(args.server)!;
      if (!client.supportsCatalog(spec.family)) throw new Error(`MCP server "${args.server}" did not advertise ${spec.family}`);
      const signal = toolContext.signal ?? context.signal;
      const cap = positiveLimit(toolContext.maxOutputBytes) ?? positiveLimit(context.maxOutputBytes) ?? FALLBACK_MAX_OUTPUT_BYTES;
      let method: McpCatalogMethod = spec.method;
      let params: Record<string, unknown> = {};
      let list: string | undefined = spec.list;
      if (spec.name === "mcp_resources_list") {
        if (args.templates !== undefined && typeof args.templates !== "boolean") throw new Error("MCP templates must be a boolean");
        if (args.templates) { method = "resources/templates/list"; list = "resourceTemplates"; }
      } else if (spec.name === "mcp_resource_read") {
        if (typeof args.uri !== "string" || args.uri.length === 0) throw new Error("MCP resource read requires a non-empty URI");
        params = { uri: args.uri };
      } else if (spec.name === "mcp_prompt_get") {
        if (typeof args.name !== "string" || args.name.length === 0) throw new Error("MCP prompt get requires a non-empty name");
        if (args.arguments !== undefined && (!isRecord(args.arguments) || Object.values(args.arguments).some((value) => typeof value !== "string"))) throw new Error("MCP prompt arguments must be an object of strings");
        params = { name: args.name, ...(args.arguments === undefined ? {} : { arguments: args.arguments }) };
      }
      let result: unknown;
      if (list !== undefined) {
        const all: unknown[] = [];
        const seen = new Set<string>();
        let cursor: string | undefined;
        let completed = false;
        for (let page = 0; page < MCP_MAX_LIST_PAGES; page++) {
          const response = await client.catalogRequest(method, cursor === undefined ? {} : { cursor }, signal);
          const items = isRecord(response) ? response[list] : undefined;
          if (!isRecord(response) || !Array.isArray(items) || items.some((item: unknown) => !isRecord(item))) throw new Error(`MCP server "${args.server}" returned an invalid ${method} result`);
          all.push(...items);
          // Stop at a truthful byte-capped page rather than accumulating an
          // unbounded catalog before rendering it.
          if (Buffer.byteLength(JSON.stringify(all)) > cap) {
            return capUtf8(JSON.stringify({ server: args.server, [list]: all, truncated: true, nextCursor: response.nextCursor }, null, 2), cap, spec.name);
          }
          if (response.nextCursor === undefined || response.nextCursor === null) { completed = true; break; }
          if (typeof response.nextCursor !== "string" || response.nextCursor.length === 0) throw new Error("MCP catalog returned an invalid cursor");
          if (seen.has(response.nextCursor)) throw new Error("MCP catalog repeated a cursor (cycle)");
          seen.add(response.nextCursor);
          cursor = response.nextCursor;
        }
        if (!completed) throw new Error(`MCP catalog exceeded ${MCP_MAX_LIST_PAGES} pages`);
        result = { server: args.server, [list]: all };
      } else {
        result = await client.catalogRequest(method, params, signal);
        if (!isRecord(result) || (method === "resources/read" && !Array.isArray(result.contents)) || (method === "prompts/get" && !Array.isArray(result.messages))) throw new Error(`MCP server "${args.server}" returned an invalid ${method} result`);
      }
      return capUtf8(JSON.stringify(result, null, 2), cap, spec.name);
    },
  }));
}

export const MCP_DYNAMIC_LIMITS: readonly string[] = [
  "dynamic tools: private catalogs refresh atomically; published schemas remain pinned to their initial snapshot",
  "dynamic permissions: generic mcp_tool_call is always mutable; permission matching uses its generic name, not the remote tool name",
  "dynamic notifications: tools/list_changed observed on stdio or active HTTP POST streams marks a server dirty; no background HTTP GET stream",
  `dynamic discovery: at most ${MCP_MAX_TOTAL_TOOLS} tools, ${MCP_MAX_LIST_PAGES} pages per server and ${MCP_MAX_TOOL_CATALOG_BYTES} bytes of catalog metadata`,
];

function boundedJson(value: unknown, cap: number): string {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) <= cap) return text;
  const summary = JSON.stringify({ truncated: true });
  if (Buffer.byteLength(summary) <= cap) return summary;
  if (cap >= 2) return "{}";
  throw new Error("MCP JSON output budget requires at least 2 bytes");
}

function makeSubscriptionTools(clients: Map<string, McpClient>, context: McpConnectContext, persistence = false): ToolDefinition[] {
  const servers = [...clients].filter(([, client]) => persistence || client.resourceSubscriptions?.supports()).map(([name]) => name);
  if (!servers.length) return [];
  return ["resource_subscribe", "resource_unsubscribe", "resource_notifications"].map((operation): ToolDefinition => {
    const name = `mcp_${operation}`;
    const poll = operation === "resource_notifications";
    return {
      readOnly: poll,
      schema: {
        name,
        description: poll
          ? "Poll and consume queued MCP resource URI updates for this connection. Reports dropped updates. HTTP delivery covers active POST SSE responses only. No automatic resource read."
          : `Explicitly ${operation === "resource_subscribe" ? "subscribe to" : "unsubscribe from"} an exact MCP resource URI on this connection. State changes after successful RPC acknowledgement.`,
        input_schema: {
          type: "object", properties: {
            server: { type: "string", enum: servers },
            ...(poll ? { limit: { type: "integer", minimum: 1, maximum: MCP_MAX_RESOURCE_NOTIFICATIONS } }
              : { uri: { type: "string", minLength: 1, maxLength: MCP_MAX_RESOURCE_URI_BYTES, description: "Exact URI, at most 4096 UTF-8 bytes; no normalization." } }),
          }, required: poll ? ["server"] : ["server", "uri"], additionalProperties: false,
        },
      },
      async execute(input, toolContext): Promise<string> {
        const args = toArguments(name, input);
        if (Object.keys(args).some((key) => !["server", poll ? "limit" : "uri"].includes(key))) throw new Error("MCP subscription tool received an unknown field");
        if (typeof args.server !== "string" || !servers.includes(args.server)) throw new Error("MCP subscriptions require a configured server advertising resources.subscribe === true");
        const subscriptions = clients.get(args.server)!.resourceSubscriptions!;
        const signal = toolContext.signal ?? context.signal;
        const cap = positiveLimit(toolContext.maxOutputBytes) ?? positiveLimit(context.maxOutputBytes) ?? FALLBACK_MAX_OUTPUT_BYTES;
        if (poll) return subscriptions.poll(args.server, args.limit === undefined ? MCP_MAX_RESOURCE_NOTIFICATIONS : args.limit as number, cap, signal);
        validateMcpResourceUri(args.uri);
        // Preflight the output budget before sending a mutation, preserving exact receipts.
        const receipt = JSON.stringify({ server: args.server, uri: args.uri, subscribed: operation === "resource_subscribe" });
        if (Buffer.byteLength(receipt) > cap) throw new Error("MCP subscription output budget too small");
        await subscriptions.change(operation === "resource_subscribe" ? "resources/subscribe" : "resources/unsubscribe", args.uri, signal);
        return receipt;
      },
    };
  });
}

function makeLoggingTools(clients: Map<string, McpClient>, context: McpConnectContext): ToolDefinition[] {
  const servers = [...clients].filter(([, client]) => client.logging?.supports()).map(([name]) => name);
  if (!servers.length) return [];
  return ["mcp_logging_set_level", "mcp_logging_notifications"].map((name): ToolDefinition => {
    const poll = name === "mcp_logging_notifications";
    return {
      readOnly: poll,
      schema: {
        name, description: poll
          ? "Poll and consume queued MCP logs for this connection as untrusted JSON data. Reports dropped messages; causes no server requests. HTTP observes active POST SSE responses only."
          : "Set the server logging threshold to an exact MCP severity through logging/setLevel. Requires advertised logging capability.",
        input_schema: { type: "object", properties: {
          server: { type: "string", enum: servers },
          ...(poll ? { limit: { type: "integer", minimum: 1, maximum: MCP_MAX_LOG_NOTIFICATIONS } } : { level: { type: "string", enum: [...MCP_LOG_LEVELS] } }),
        }, required: poll ? ["server"] : ["server", "level"], additionalProperties: false },
      },
      async execute(input, toolContext): Promise<string> {
        const args = toArguments(name, input);
        if (Object.keys(args).some((key) => !["server", poll ? "limit" : "level"].includes(key))) throw new Error("MCP logging tool received an unknown field");
        if (typeof args.server !== "string" || !servers.includes(args.server)) throw new Error("MCP logging requires a configured server advertising a logging object");
        const logging = clients.get(args.server)!.logging!;
        const signal = toolContext.signal ?? context.signal;
        const cap = positiveLimit(toolContext.maxOutputBytes) ?? positiveLimit(context.maxOutputBytes) ?? FALLBACK_MAX_OUTPUT_BYTES;
        if (poll) return logging.poll(args.server, args.limit === undefined ? MCP_MAX_LOG_NOTIFICATIONS : args.limit as number, cap, signal);
        validateMcpLogLevel(args.level);
        const receipt = JSON.stringify({ server: args.server, level: args.level });
        if (Buffer.byteLength(receipt) > cap) throw new Error("MCP logging output budget too small");
        await logging.setLevel(args.level, signal);
        return receipt;
      },
    };
  });
}

class DynamicMcpCatalog {
  private inventories: Map<string, McpToolInfo[]>;
  private readonly revisions = new Map<string, number>();
  private readonly dirty = new Set<string>();
  private readonly unsubscribe: (() => void)[] = [];
  private queue: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(private readonly clients: Map<string, McpClient>, initial: Map<string, McpToolInfo[]>) {
    this.inventories = initial;
    for (const [name, client] of clients) {
      this.revisions.set(name, 0);
      this.unsubscribe.push(client.onToolsChanged(() => {
        this.revisions.set(name, (this.revisions.get(name) ?? 0) + 1);
        this.dirty.add(name);
      }));
    }
    this.validate(initial);
  }

  private validate(inventories: Map<string, McpToolInfo[]>): void {
    let count = 0;
    let bytes = 0;
    const names = new Set<string>();
    for (const [server, listed] of inventories) {
      count += listed.length;
      bytes += Buffer.byteLength(JSON.stringify(listed));
      if (count > MCP_MAX_TOTAL_TOOLS) throw new Error(`MCP tool catalog exceeds ${MCP_MAX_TOTAL_TOOLS} tools`);
      if (bytes > MCP_MAX_TOOL_CATALOG_BYTES) throw new Error("MCP tool catalog exceeds byte limit");
      for (const info of listed) {
        const name = mcpToolName(server, info.name);
        if (names.has(name)) throw new Error(`MCP tool name collision: "${name}"`);
        names.add(name);
      }
    }
  }

  async refresh(server: string | undefined, signal: AbortSignal, onlyDirty = false): Promise<void> {
    const job = this.queue.then(async () => {
      if (this.closed) throw new Error("MCP dynamic catalog closed");
      if (signal.aborted) throw abortError();
      const selected = server === undefined ? [...this.clients.keys()] : [server];
      const next = new Map(this.inventories);
      const observed = new Map<string, number>();
      for (const name of selected) {
        const client = this.clients.get(name);
        if (!client) throw new Error("MCP requires a configured server name");
        if (onlyDirty && !this.dirty.has(name)) continue;
        this.dirty.add(name);
        observed.set(name, this.revisions.get(name) ?? 0);
        next.set(name, await client.listTools(signal));
      }
      this.validate(next);
      if (this.closed) throw new Error("MCP dynamic catalog closed");
      this.inventories = next;
      for (const [name, revision] of observed) {
        if (this.revisions.get(name) === revision) this.dirty.delete(name);
      }
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  async ensureFresh(server: string | undefined, signal: AbortSignal): Promise<void> {
    await this.refresh(server, signal, true);
    // A notification during discovery invalidates the new snapshot. Leave it
    // dirty and fail closed if the server keeps changing under a call.
    if ([...this.dirty].some((name) => server === undefined || server === name)) {
      await this.refresh(server, signal, true);
      if ([...this.dirty].some((name) => server === undefined || server === name)) throw new Error("MCP tool catalog changed during refresh; retry discovery");
    }
  }

  find(server: string, tool: string): McpToolInfo {
    const found = this.inventories.get(server)?.find((info) => info.name === tool);
    if (!found) throw new Error("MCP tool is absent from the current catalog");
    return found;
  }

  async assertPinned(server: string, pinned: McpToolInfo, signal: AbortSignal): Promise<void> {
    await this.ensureFresh(server, signal);
    const current = this.find(server, pinned.name);
    if ((pinned.readOnly && !current.readOnly) || pinned.taskSupport !== current.taskSupport || JSON.stringify(normalizeInputSchema(pinned.inputSchema)) !== JSON.stringify(normalizeInputSchema(current.inputSchema))) {
      throw new Error("MCP pinned tool metadata changed; use mcp_tool_search and mcp_tool_call");
    }
  }

  markDirty(server: string): void {
    this.revisions.set(server, (this.revisions.get(server) ?? 0) + 1);
    this.dirty.add(server);
  }

  close(): void {
    this.closed = true;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
  }

  tools(context: McpConnectContext): ToolDefinition[] {
    const servers = [...this.clients.keys()];
    const executeContext = (ctx: ToolContext) => ({ signal: ctx.signal ?? context.signal, cap: positiveLimit(ctx.maxOutputBytes) ?? positiveLimit(context.maxOutputBytes) ?? FALLBACK_MAX_OUTPUT_BYTES });
    const params = (input: unknown, fields: string[], requiredServer = false) => {
      const args = toArguments("dynamic", input);
      if (Object.keys(args).some((key) => !fields.includes(key))) throw new Error("MCP dynamic tool received an unknown field");
      if ((requiredServer || args.server !== undefined) && (typeof args.server !== "string" || !this.clients.has(args.server))) throw new Error("MCP requires a configured server name");
      return args;
    };
    return [
      {
        readOnly: true,
        schema: { name: "mcp_tool_search", description: "Search the current MCP tool catalog and retrieve input schemas. A blank query lists tools.", input_schema: { type: "object", properties: { query: { type: "string" }, server: { type: "string", enum: servers }, limit: { type: "integer", minimum: 1, maximum: 100 } }, required: ["query"], additionalProperties: false } },
        execute: async (input, ctx) => {
          const args = params(input, ["query", "server", "limit"]);
          if (typeof args.query !== "string") throw new Error("MCP tool search requires a query string");
          if (args.limit !== undefined && (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)) throw new Error("MCP tool search limit must be an integer from 1 to 100");
          const { signal, cap } = executeContext(ctx);
          const server = args.server as string | undefined;
          await this.ensureFresh(server, signal);
          const terms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
          const matched: Record<string, unknown>[] = [];
          let total = 0;
          for (const [name, infos] of this.inventories) {
            if (server !== undefined && server !== name) continue;
            for (const info of infos) {
              const text = `${name} ${info.name} ${info.description ?? ""}`.toLowerCase();
              if (!terms.every((term) => text.includes(term))) continue;
              total++;
              if (matched.length < (args.limit as number | undefined ?? 20)) matched.push({ server: name, tool: info.name, name: mcpToolName(name, info.name), description: info.description, input_schema: normalizeInputSchema(info.inputSchema), readOnlyHint: info.readOnly });
            }
          }
          while (matched.length && Buffer.byteLength(JSON.stringify({ tools: matched, total, truncated: matched.length < total })) > cap) matched.pop();
          return boundedJson({ tools: matched, total, truncated: matched.length < total }, cap);
        },
      },
      {
        readOnly: false,
        schema: { name: "mcp_tool_call", description: "Call a tool by configured server and exact remote tool name. All calls use mutable-tool permissions.", input_schema: { type: "object", properties: { server: { type: "string", enum: servers }, tool: { type: "string" }, arguments: { type: "object" } }, required: ["server", "tool"], additionalProperties: false } },
        execute: async (input, ctx) => {
          const args = params(input, ["server", "tool", "arguments"], true);
          if (typeof args.tool !== "string" || !args.tool) throw new Error("MCP tool call requires an exact tool name");
          const toolArgs = toArguments(args.tool, args.arguments);
          const { signal, cap } = executeContext(ctx);
          const server = args.server as string;
          await this.ensureFresh(server, signal);
          this.find(server, args.tool);
          const result = await this.clients.get(server)!.callTool(args.tool, toolArgs, signal);
          const rendered = renderToolResult(result);
          const structured = result.structuredContent !== undefined || result.content.some((block) => !isRecord(block) || block.type !== "text" || typeof block.text !== "string");
          const text = structured
            ? boundedJson({ content: result.content, ...(result.structuredContent === undefined ? {} : { structuredContent: result.structuredContent }), ...(result.isError ? { isError: true } : {}) }, cap)
            : capUtf8(rendered, cap, "mcp_tool_call");
          if (result.isError) throw new Error(text);
          return text;
        },
      },
      {
        readOnly: true,
        schema: { name: "mcp_refresh", description: "Refresh private MCP tool catalogs without changing published tool schemas.", input_schema: { type: "object", properties: { server: { type: "string", enum: servers } }, additionalProperties: false } },
        execute: async (input, ctx) => {
          const args = params(input, ["server"]);
          const { signal, cap } = executeContext(ctx);
          const server = args.server as string | undefined;
          await this.refresh(server, signal);
          return boundedJson({ refreshed: server === undefined ? servers : [server], tools: [...this.inventories.values()].reduce((sum, tools) => sum + tools.length, 0) }, cap);
        },
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

async function closeAll(clients: McpClient[]): Promise<void> {
  await Promise.allSettled(clients.map((client) => client.close()));
}

/** Keep adapter closures stable while replacing one transport generation. */
class ManagedMcpClient implements McpClient {
  private current: McpClient;
  private inventory: McpToolInfo[] = [];
  private listeners = new Set<() => void>();
  private unbind: (() => void)[] = [];
  private status: McpServerStatus = { state: "connected", generation: 1, attempts: 0 };
  private replacing: Promise<McpServerStatus> | undefined;
  private controller = new AbortController();
  private closing: Promise<void> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryEpoch = 0;
  private automaticReady = false;
  private automaticDial: AbortController | undefined;
  private desired: Set<string> | undefined;
  private acknowledgement: ((method: McpSubscriptionMethod, uri: string) => void) | undefined;
  private journalFailure: McpSubscriptionPersistenceError | undefined;

  constructor(private factory: () => McpClient, private context: McpConnectContext, private automatic: boolean,
    // The recovered client keeps no background timer for stdio: a failed transport is closed and the
    // next use dials a fresh process. onDemand marks the transports whose replacement is use-driven.
    private onDemand: boolean, private validate: (listed: McpToolInfo[]) => void, private settings: McpConnectSettings) {
    this.current = factory();
    this.bind();
  }
  private bind(): void {
    for (const unsubscribe of this.unbind) unsubscribe();
    this.unbind = [this.current.onToolsChanged(() => { for (const listener of this.listeners) listener(); })];
    const client = this.current;
    const subscriptions = client.resourceSubscriptions;
    if (subscriptions && this.acknowledgement) {
      const commit = this.acknowledgement;
      subscriptions.setAcknowledgement((method, uri) => {
        if (this.current !== client || this.status.state === "closed") throw new Error("MCP subscription acknowledgement belongs to an inactive transport");
        if (method === "resources/subscribe") this.desired!.add(uri);
        else this.desired!.delete(uri);
        if (this.journalFailure) throw this.journalFailure;
        commit(method, uri);
      });
      this.unbind.push(() => subscriptions.setAcknowledgement(undefined));
    }
    const unsubscribe = client.onDisconnected?.(() => {
      if (this.current !== client || this.status.state === "closed") return;
      if (this.status.state === "disconnected") return;
      this.status.state = "disconnected";
      if (this.automatic && this.automaticReady && !this.replacing) this.scheduleRetry(0, ++this.retryEpoch);
    });
    if (unsubscribe) this.unbind.push(unsubscribe);
  }
  startAutomatic(): void {
    this.automaticReady = true;
    if (this.automatic && this.status.state === "disconnected") this.scheduleRetry(0, ++this.retryEpoch);
  }
  prepareSubscriptionBinding(uris: readonly string[]): ReturnType<McpResourceSubscriptions["prepareReplacement"]> | undefined {
    if (this.journalFailure) throw this.journalFailure;
    if (this.replacing) throw new Error("MCP session binding blocked during transport replacement");
    const subscriptions = this.current.resourceSubscriptions;
    if (subscriptions?.snapshot().length) throw new Error("MCP session binding requires a fresh connection without prior subscriptions");
    const frozen = subscriptions?.prepareReplacement();
    this.desired = new Set(uris);
    return frozen;
  }
  async restoreSubscriptionBinding(signal: AbortSignal): Promise<void> {
    if (this.journalFailure) throw this.journalFailure;
    const activeSignal = AbortSignal.any([signal, this.context.signal, this.controller.signal]);
    activeSignal.throwIfAborted();
    if (this.status.state === "disconnected" || !this.desired?.size) return;
    await this.current.resourceSubscriptions!.restore(Object.freeze([...this.desired]), activeSignal);
    activeSignal.throwIfAborted();
  }
  commitSubscriptionBinding(commit: (method: McpSubscriptionMethod, uri: string) => void): void {
    this.acknowledgement = commit;
    this.bind();
  }
  poisonSubscriptionBinding(error: McpSubscriptionPersistenceError): void {
    this.journalFailure ??= error;
    this.current.resourceSubscriptions?.poisonPersistence(error);
    this.cancelRetry();
    this.status.retryPhase = "stopped";
    this.status.lastError = "MCP subscription journal binding poisoned; reconcile the journal before using a fresh connection";
  }
  async degradeStartup(): Promise<void> {
    this.status = { state: "disconnected", generation: 0, attempts: 0,
      lastError: "MCP startup transport unavailable; background recovery pending" };
    this.inventory = [];
    for (const unsubscribe of this.unbind) unsubscribe();
    this.unbind = [];
    await this.current.close();
  }
  view(): McpServerStatus { return { ...this.status }; }
  listed(): McpToolInfo[] { return this.inventory; }
  get notificationStreamStatus() { return this.current.notificationStreamStatus; }
  get resourceSubscriptions() { return this.current.resourceSubscriptions; }
  get logging() { return this.current.logging; }
  async initialize(signal: AbortSignal) {
    await this.current.initialize(signal);
    signal.throwIfAborted();
    this.status.state = "connected";
  }
  async listTools(signal: AbortSignal): Promise<McpToolInfo[]> {
    if (this.status.state === "disconnected") return this.inventory;
    const client = this.current;
    const listed = await client.listTools(signal);
    if (this.current !== client) throw new Error("MCP connection changed during discovery; retry discovery");
    this.inventory = listed;
    return listed;
  }
  async callTool(tool: string, args: unknown, signal: AbortSignal, pinned?: McpToolInfo): Promise<McpToolResult> {
    signal.throwIfAborted();
    if (this.status.state === "closed") throw new Error("MCP connection closed");
    if (this.status.state === "disconnected") await this.redialBeforeUse(signal, "reconnect before calling tools");
    if (pinned) this.assertPinned(pinned);
    return this.current.callTool(tool, args, signal, pinned);
  }
  /**
   * One use-driven replacement attempt on a disconnected transport. The recovered client dials a fresh
   * process on the next call and re-dials on the call after a failure; the pinned catalog check that
   * follows keeps a changed server from serving the tool definition the caller already saw.
   */
  private async redialBeforeUse(signal: AbortSignal, unavailable: string): Promise<void> {
    if (!this.onDemand || !this.settings.recovery) throw new Error(`MCP connection disconnected; ${unavailable}`);
    if (this.status.state === "closed") throw new Error("MCP connection closed");
    if (this.status.state !== "disconnected") { await this.replacing?.catch(() => undefined); return; }
    await this.replace(AbortSignal.any([signal, this.controller.signal]));
  }
  resumeTask(task: StandardMcpTask, signal: AbortSignal): Promise<McpToolResult> {
    signal.throwIfAborted();
    if (this.status.state !== 'connected' || !this.current.resumeTask) return Promise.reject(new Error('MCP task recovery requires a connected HTTP server'));
    return this.current.resumeTask(task, signal);
  }
  supportsCatalog(family: "resources" | "prompts") { return this.current.supportsCatalog(family); }
  async catalogRequest(method: McpCatalogMethod, params: unknown, signal: AbortSignal): Promise<unknown> {
    if (this.status.state === "closed") throw new Error("MCP connection closed");
    if (this.status.state === "disconnected") await this.redialBeforeUse(signal, "reconnect before catalog requests");
    return this.current.catalogRequest(method, params, signal);
  }
  onToolsChanged(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  assertPinned(info: McpToolInfo): void {
    const current = this.inventory.find(tool => tool.name === info.name);
    if (!current || (info.readOnly && !current.readOnly) || info.taskSupport !== current.taskSupport || JSON.stringify(normalizeInputSchema(info.inputSchema)) !== JSON.stringify(normalizeInputSchema(current.inputSchema))) {
      throw new Error("MCP pinned tool metadata changed; rediscover with mcp_tool_search/mcp_tool_call or rebuild published schemas");
    }
  }
  private cancelRetry(): void {
    this.retryEpoch++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.automaticDial?.abort();
  }
  private scheduleRetry(attempt: number, epoch: number): void {
    if (this.journalFailure || epoch !== this.retryEpoch || this.status.state === "closed" || this.context.signal.aborted) return;
    const delay = mcpReconnectDelay(attempt, this.settings.recovery);
    if (delay === undefined) {
      this.status.retryPhase = "exhausted";
      this.status.lastError = `Automatic reconnect exhausted after ${this.settings.recovery ? 13 : 5} attempts; reconnect explicitly`;
      return;
    }
    this.status.retryPhase = attempt < 5 ? "fast" : "slow";
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (epoch !== this.retryEpoch || this.status.state === "closed" || this.context.signal.aborted) return;
      this.status.automaticAttempts = attempt + 1;
      const dial = new AbortController();
      this.automaticDial = dial;
      void this.replace(AbortSignal.any([this.context.signal, dial.signal])).catch(error => {
        if (epoch !== this.retryEpoch || this.status.state === "closed" || this.context.signal.aborted) return;
        if (isTransientMcpFailure(error)) this.scheduleRetry(attempt + 1, epoch);
        else this.status.retryPhase = "stopped";
      }).finally(() => { if (this.automaticDial === dial) this.automaticDial = undefined; });
    }, delay);
    this.retryTimer.unref();
  }
  reconnect(signal: AbortSignal): Promise<McpServerStatus> {
    if (this.journalFailure) return Promise.reject(this.journalFailure);
    signal.throwIfAborted();
    const automatic = this.automaticDial ? this.replacing : undefined;
    this.cancelRetry();
    if (automatic) return automatic.catch(() => undefined).then(() => {
      signal.throwIfAborted();
      return this.replace(signal);
    });
    return this.replace(signal);
  }
  private replace(signal: AbortSignal): Promise<McpServerStatus> {
    if (this.journalFailure) return Promise.reject(this.journalFailure);
    if (this.status.state === "closed") return Promise.reject(new Error("MCP connection closed"));
    if (this.replacing) return this.replacing;
    const operationSignal = AbortSignal.any([signal, this.context.signal, this.controller.signal]);
    const old = this.current;
    let subscriptions: ReturnType<McpResourceSubscriptions["prepareReplacement"]> | undefined;
    let desired: readonly string[] = [];
    try {
      operationSignal.throwIfAborted();
      if (this.settings.recovery && this.settings.subscriptions) subscriptions = old.resourceSubscriptions?.prepareReplacement();
      desired = Object.freeze([...new Set([...(subscriptions?.uris ?? []), ...(this.desired ?? [])])]);
      if (desired.length > MCP_MAX_RESOURCE_SUBSCRIPTIONS) throw new Error("MCP resource subscription limit reached (32)");
    } catch (error) { subscriptions?.release(); return Promise.reject(error); }
    const previous = this.status.state;
    this.status.state = "reconnecting";
    this.status.attempts++;
    this.replacing = Promise.resolve().then(async () => {
      let candidate: McpClient | undefined;
      try {
        operationSignal.throwIfAborted();
        candidate = this.factory();
        await candidate.initialize(operationSignal);
        const listed = await candidate.listTools(operationSignal);
        this.validate(listed);
        if (this.journalFailure) throw this.journalFailure;
        if (this.settings.recovery && this.settings.subscriptions && desired.length) {
          const restored = candidate.resourceSubscriptions;
          if (!restored?.supports()) throw new Error("MCP replacement server did not advertise resources.subscribe === true for active subscriptions");
          for (const uri of desired) {
            if (this.journalFailure) throw this.journalFailure;
            await restored.restore([uri], operationSignal);
          }
        }
        // Other servers may have changed their inventories during restoration.
        this.validate(listed);
        operationSignal.throwIfAborted();
        if (this.journalFailure) throw this.journalFailure;
        this.current = candidate;
        this.inventory = listed;
        this.status = { state: "connected", generation: this.status.generation + 1, attempts: this.status.attempts,
          ...(this.status.automaticAttempts === undefined ? {} : { automaticAttempts: this.status.automaticAttempts }) };
        this.bind();
        for (const listener of this.listeners) listener();
        await old.close().catch(() => undefined);
        return this.view();
      } catch (error) {
        if (candidate && this.current !== candidate) await candidate.close().catch(() => undefined);
        if (this.status.state !== "closed" && this.current === old) {
          this.status.state = previous === "disconnected" || this.status.state === "disconnected" ? "disconnected" : "connected";
          this.status.lastError = "MCP reconnect failed; previous transport retained";
        }
        throw error;
      } finally {
        subscriptions?.release();
        this.replacing = undefined;
      }
    });
    return this.replacing;
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.status.state = "closed";
    this.cancelRetry();
    this.controller.abort();
    this.current.resourceSubscriptions?.close();
    this.acknowledgement = undefined;
    this.desired?.clear();
    for (const unsubscribe of this.unbind) unsubscribe();
    this.listeners.clear();
    return this.closing = (async () => {
      await this.replacing?.catch(() => undefined);
      await this.current.close();
    })();
  }
}

/**
 * Connect configured stdio/HTTP servers and expose their tool definitions.
 * Optional catalog adapters are gated by advertised server capabilities.
 * Close reaps owned children or cancels HTTP requests and deletes assigned
 * sessions. Limits describe the enabled transports and catalog features.
 * Subscription queues belong to these connections, including when a runtime
 * shares one connection between turns; opted-in recovery restores acknowledged URIs.
 */
export async function connectMcpServers(
  config: Record<string, McpServerConfig>,
  context: McpConnectContext,
  options: McpConnectOptions = {},
): Promise<McpConnection> {
  if (!isRecord(config)) {
    throw new Error("connectMcpServers: config must be an object of server definitions");
  }
  if (!isRecord(context) || typeof context.workspace !== "string" || context.workspace.length === 0) {
    throw new Error("connectMcpServers: context.workspace must be a non-empty string");
  }
  const settings: McpConnectSettings = {
    requestTimeoutMs: positiveLimit(options.requestTimeoutMs) ?? MCP_REQUEST_TIMEOUT_MS,
    clientName: options.clientName ?? MCP_CLIENT_NAME,
    clientVersion: options.clientVersion ?? MCP_CLIENT_VERSION,
    catalog: options.catalog ?? false,
    dynamic: options.dynamic ?? options.deferred ?? false,
    deferred: options.deferred ?? false,
    subscriptions: options.subscriptions ?? false,
    recovery: options.recovery ?? false,
    persistence: options.persistence ?? false,
    tasks: options.tasks ?? false,
    standardTasks: options.standardTasks ?? false,
    taskJournal: options.taskJournal,
    logging: options.logging ?? false,
    notificationStream: options.notificationStream ?? false,
    clientRequests: options.clientRequests,
  };
  // Deferred publication requires the stable generic discovery/call adapters.
  if (settings.deferred) settings.dynamic = true;

  // Validate all definitions before any owned child or HTTP request.
  for (const [name, value] of Object.entries(config)) {
    if (!name) throw new Error("connectMcpServers: MCP server names must be non-empty");
    if (!isRecord(value)) throw new Error("MCP requires server configuration objects");
    if (value.type !== undefined && value.type !== "stdio" && value.type !== "http") throw new Error("Invalid MCP transport type");
    if (value.type === "http") {
      validateMcpHttpUrl(value.url as string);
      validateMcpHeadersEnv(value.headersEnv as Record<string, string> | undefined);
      for (const envName of Object.values(value.headersEnv ?? {})) {
        const header = process.env[envName];
        if (!header) throw new Error("MCP HTTP authentication environment value is missing");
        if (/[^\x20-\x7e]/.test(header)) throw new Error("MCP HTTP authentication environment value is invalid");
      }
    } else {
      if (typeof value.command !== "string" || !value.command || value.command.includes("\0")) throw new Error(`MCP server "${name}" requires a non-empty command without NUL`);
      if (value.args !== undefined && (!Array.isArray(value.args) || value.args.some(arg => typeof arg !== "string" || arg.includes("\0")))) throw new Error("Invalid MCP stdio arguments");
      if (value.env !== undefined && (!isRecord(value.env) || Object.entries(value.env).some(([key, item]) => !key || /[=\0]/.test(key) || typeof item !== "string" || item.includes("\0")))) throw new Error("Invalid MCP stdio environment");
    }
  }

  const clients: McpClient[] = [];
  const namedClients = new Map<string, McpClient>();
  const inventories = new Map<string, McpToolInfo[]>();
  const initialDirty = new Set<string>();
  const initialUnsubscribe: (() => void)[] = [];
  let dynamicCatalog: DynamicMcpCatalog | undefined;
  let hasHttp = false;
  let hasStdio = false;
  const tools: ToolDefinition[] = [];
  const claimed = new Map<string, string>();
  try {
    for (const [serverName, serverConfig] of Object.entries(config)) {
      if (context.signal.aborted) throw abortError();
      if (serverName.length === 0) {
        throw new Error("connectMcpServers: MCP server names must be non-empty");
      }
      if (!isRecord(serverConfig)) throw new Error(`MCP server "${serverName}" config must be an object`);
      if (serverConfig.type !== undefined && serverConfig.type !== "stdio" && serverConfig.type !== "http") {
        throw new Error(`MCP server "${serverName}" has an invalid transport type`);
      }
      const http = serverConfig.type === "http";
      hasHttp ||= http;
      hasStdio ||= !http;
      const pinned = structuredClone(serverConfig);
      const factory = (): McpClient => http
        ? new McpHttpClient(serverName, pinned as McpHttpServerConfig, settings)
        : new McpStdioClient(serverName, pinned as McpStdioServerConfig, context, settings);
      const client = new ManagedMcpClient(factory, context, http, !http, listed => {
        const next = new Map([...namedClients].map(([name, active]) => [name, (active as ManagedMcpClient).listed()]));
        next.set(serverName, listed);
        let bytes = 0, count = 0;
        const names = new Set<string>();
        for (const [server, infos] of next) {
          count += infos.length; bytes += Buffer.byteLength(JSON.stringify(infos));
          for (const info of infos) {
            const name = mcpToolName(server, info.name);
            if (names.has(name)) throw new Error("MCP tool name collision during reconnect");
            names.add(name);
          }
        }
        if (count > MCP_MAX_TOTAL_TOOLS || bytes > MCP_MAX_TOOL_CATALOG_BYTES) throw new Error("MCP reconnect catalog exceeds limits");
      }, settings);
      clients.push(client);
      namedClients.set(serverName, client);
      if (settings.dynamic) initialUnsubscribe.push(client.onToolsChanged(() => initialDirty.add(serverName)));
      let listed: McpToolInfo[];
      try {
        await client.initialize(context.signal);
        listed = await client.listTools(context.signal);
      } catch (error) {
        if (!settings.recovery || !http || context.signal.aborted || !isTransientMcpFailure(error)) throw error;
        await client.degradeStartup();
        listed = [];
      }
      inventories.set(serverName, listed);
      if ([...inventories.values()].reduce((sum, infos) => sum + infos.length, 0) > MCP_MAX_TOTAL_TOOLS) throw new Error(`MCP tool catalog exceeds ${MCP_MAX_TOTAL_TOOLS} tools`);
      if ([...inventories.values()].reduce((sum, infos) => sum + Buffer.byteLength(JSON.stringify(infos)), 0) > MCP_MAX_TOOL_CATALOG_BYTES) throw new Error("MCP tool catalog exceeds byte limit");
      for (const info of listed) {
        const name = mcpToolName(serverName, info.name);
        const source = `${serverName}/${info.name}`;
        const existing = claimed.get(name);
        if (existing !== undefined) {
          throw new Error(
            `MCP tool name collision: "${name}" is provided by both ${existing} and ${source}`,
          );
        }
        claimed.set(name, source);
        if (!settings.deferred) tools.push(makeMcpTool(client, serverName, info, name, context,
          async signal => {
            if (settings.dynamic) await dynamicCatalog!.assertPinned(serverName, info, signal);
            client.assertPinned(info);
          }));
      }
    }
    if (settings.dynamic && namedClients.size > 0) {
      dynamicCatalog = new DynamicMcpCatalog(namedClients, inventories);
      for (const server of initialDirty) dynamicCatalog.markDirty(server);
      tools.push(...dynamicCatalog.tools(context));
    }
    for (const unsubscribe of initialUnsubscribe) unsubscribe();
  } catch (error) {
    for (const unsubscribe of initialUnsubscribe) unsubscribe();
    dynamicCatalog?.close();
    await closeAll(clients);
    throw error;
  }

  if (settings.catalog) tools.push(...makeCatalogTools(namedClients, context));
  if (settings.subscriptions) tools.push(...makeSubscriptionTools(namedClients, context, settings.persistence && settings.recovery));
  if (settings.logging) tools.push(...makeLoggingTools(namedClients, context));
  const persistentSubscriptions = settings.persistence && settings.recovery && settings.subscriptions;
  if (!persistentSubscriptions) for (const client of namedClients.values()) (client as ManagedMcpClient).startAutomatic();
  const transportLimits = hasHttp
    ? (hasStdio ? [...MCP_PROTOCOL_LIMITS, ...MCP_HTTP_LIMITS] : MCP_HTTP_LIMITS)
    : MCP_PROTOCOL_LIMITS;
  const baseLimits = settings.catalog ? catalogLimits(transportLimits) : transportLimits;
  const hasClientRequests = settings.clientRequests && [settings.clientRequests.roots, settings.clientRequests.elicitation, settings.clientRequests.sampling].some((callback) => typeof callback === "function");
  const requestLimits = hasClientRequests
    ? [...baseLimits.filter((entry) => !entry.startsWith("server features:") && !entry.startsWith("server-initiated requests") && !entry.startsWith("catalog pagination:")),
      ...(settings.catalog ? ["catalog pagination: bounded pages with cursor-cycle rejection; no resource subscriptions or logging"] : ["server features: tools; resource/prompt catalogs require catalog mode; no logging"]), ...MCP_CLIENT_REQUEST_LIMITS]
    : baseLimits;
  const enabledLimits = settings.subscriptions
    ? [...requestLimits.filter((entry) => !entry.startsWith("server features:") && !entry.startsWith("catalog pagination:")).map((entry) => entry.replace("other notifications are ignored", "subscribed resource updates are queued; other notifications are ignored")),
      ...(settings.catalog ? ["catalog pagination: bounded pages with cursor-cycle rejection; subscription updates do not refresh catalog schemas"] : []), ...MCP_SUBSCRIPTION_LIMITS.map(entry =>
        settings.recovery && entry.startsWith("resource subscription ownership:")
          ? "resource subscription ownership: opt-in recovery restores up to 32 successfully acknowledged exact URIs on candidate transports before atomic commit; failed/cancelled restoration retains the old transport and inventory; generations keep separate update queues; " + (persistentSubscriptions
            ? "session binding restores journal desired URIs before tasks; only current validated acknowledgements commit synchronously; journal failures retain acknowledged remote effects and poison mutations/reconnect until journal reconciliation and a fresh connection; fatal transport failure retains desired intent; close clears memory while the session journal remains; no resource reads, tool-call replay or event replay"
            : "close/fatal stdio failure clears state; no durable persistence, resource reads, tool-call replay or event replay")
          : settings.recovery && entry.startsWith("resource subscription requests:")
            ? entry + "; transport replacement freezes mutations and rejects replacement while a mutation is in flight"
            : entry)]
    : requestLimits;
  const finalLimits = settings.logging
    ? [...enabledLimits.filter((entry) => !entry.startsWith("server features:")).map((entry) => entry.replace("or logging", "(logging is enabled separately)").replace("other notifications are ignored", "logging messages are queued; other notifications are ignored")), ...MCP_LOGGING_LIMITS]
    : enabledLimits;
  const streamLimits = settings.notificationStream && hasHttp
    ? [...finalLimits.map((entry) => entry
      .replace("no standalone GET stream,", "opt-in owned GET SSE stream;")
      .replace("no background HTTP GET stream", "owned HTTP GET SSE stream enabled")
      .replace("HTTP observes only active POST SSE responses, with no GET stream or continuous HTTP push", "HTTP observes POST SSE plus its owned GET SSE notification stream")
      .replace("active HTTP POST SSE responses only; no GET stream or continuous HTTP push", "HTTP POST SSE responses plus its owned GET SSE notification stream")),
      `HTTP GET notification stream: one owned stream after initialize; same URL/session/protocol/auth headers and redirect restrictions; ${settings.requestTimeoutMs}ms header/read idle deadline; ${settings.recovery ? "recovery enables at most 5 GET-only reopens per transport lifetime after EOF, idle timeout or transport failure, delayed by the latest server SSE retry value when present and otherwise by 1/2/4/8/8 seconds; a reopen sends the last observed SSE event id as last-event-id, which a bare id field clears, so the server keeps ownership of payload replay; 404/405 unavailable and 204 ended are terminal, as are authentication, redirect, malformed/oversized SSE and other HTTP status failures; no client-side payload replay, and a stream that carried a client request is never reopened" : "404/405 unavailable, 204/EOF ended; no retry, reconnect or event replay"}; failures do not disable POST`,
      `HTTP GET dispatch: logging/resource updates/tools list changes/cancellation notifications; every client request (roots/list, form elicitation/create, sampling/createMessage) is dispatched under the same callback, capability, ownership, cancellation and bounded POST-reply contract as POST SSE, so an unsupported method receives a bounded error reply;; a replayed request is served again, so replay dedupe remains the server responsibility RPC responses are ignored; a stream that carried a request is not auto-reopened; incremental bounds 1MiB/event, 64KiB/line, 8MiB/read chunk without whole-stream accumulation or total event limit; close aborts reader and awaits at most 1000ms`]
    : finalLimits;
  let closed = false;
  let subscriptionsBound = false;
  const lifecycleLimits = settings.recovery ? [...streamLimits,
    "MCP startup recovery: transient HTTP failures retain healthy peers and empty disconnected inventories; background dialing starts after catalog setup. Configuration/authentication/protocol/catalog failures remain fatal. Automatic replacement uses five fast attempts plus eight slow full-jitter rounds (30s base, 300s cap, 15s floor); manual reconnect supersedes timers; no tool replay.",
  ] : streamLimits;
  return {
    tools,
    ...(settings.standardTasks ? { resumeTask: async (server: string, task: StandardMcpTask, signal: AbortSignal) => {
      const client = namedClients.get(server);
      if (!client?.resumeTask) throw new Error('MCP task recovery requires a configured HTTP server');
      return client.resumeTask(task, signal);
    } } : {}),
    ...(persistentSubscriptions ? { bindSubscriptions: async (state: Record<string, readonly string[]>, commit: (server: string, method: McpSubscriptionMethod, uri: string) => void, signal: AbortSignal): Promise<void> => {
      if (closed) throw new Error("MCP connections closed");
      if (subscriptionsBound) throw new Error("MCP subscriptions already bound; session owner changes require a fresh connection");
      signal.throwIfAborted();
      if (!isRecord(state) || typeof commit !== "function") throw new Error("MCP subscription binding requires URI state and a synchronous commit callback");
      const restored = new Map<string, readonly string[]>();
      for (const [server, uris] of Object.entries(state)) {
        if (!namedClients.has(server)) throw new Error("MCP subscription binding requires configured server names");
        if (!Array.isArray(uris) || uris.length > MCP_MAX_RESOURCE_SUBSCRIPTIONS) throw new Error("MCP subscription binding requires at most 32 exact URIs per server");
        for (const uri of uris) validateMcpResourceUri(uri);
        if (new Set(uris).size !== uris.length) throw new Error("MCP subscription binding requires unique exact URIs");
        restored.set(server, Object.freeze([...uris]));
      }
      const freezes: ReturnType<McpResourceSubscriptions["prepareReplacement"]>[] = [];
      subscriptionsBound = true;
      try {
        for (const [server, client] of namedClients) {
          const freeze = (client as ManagedMcpClient).prepareSubscriptionBinding(restored.get(server) ?? []);
          if (freeze) freezes.push(freeze);
        }
        for (const client of namedClients.values()) await (client as ManagedMcpClient).restoreSubscriptionBinding(signal);
        signal.throwIfAborted();
        if (closed) throw new Error("MCP connections closed during subscription binding");
        for (const [server, client] of namedClients) (client as ManagedMcpClient).commitSubscriptionBinding((method, uri) => {
          try { commit(server, method, uri); }
          catch (cause) {
            const error = new McpSubscriptionPersistenceError(method, cause);
            for (const active of namedClients.values()) (active as ManagedMcpClient).poisonSubscriptionBinding(error);
            throw error;
          }
        });
      } finally { for (const freeze of freezes) freeze.release(); }
      for (const client of namedClients.values()) (client as ManagedMcpClient).startAutomatic();
    } } : {}),
    servers: () => Object.fromEntries([...namedClients].map(([name, client]) => [name, (client as ManagedMcpClient).view()])),
    reconnect: async (server, signal) => {
      if (closed) throw new Error("MCP connections closed");
      const client = namedClients.get(server) as ManagedMcpClient | undefined;
      if (!client) throw new Error("MCP requires a configured server name");
      const result = await client.reconnect(signal);
      inventories.set(server, client.listed());
      return result;
    },
    limits: settings.standardTasks ? [...lifecycleLimits, 'MCP standard tasks: opt-in 2025-11-25 requestor; server capability and tool execution.taskSupport gates; foreground get/result, related-task result metadata and bounded cancellation; no receiving task-augmented client requests or background reattachment'] : settings.tasks ? [...lifecycleLimits,
      ...(settings.dynamic ? MCP_DYNAMIC_LIMITS : []),
      ...(settings.deferred ? ['deferred tools: namespaced schemas are omitted; input schema metadata is returned by mcp_tool_search'] : []),
      'MCP tasks: opted-in foreground resultType/task and tasks/get/update/cancel extension with inline terminal content; poll250..30000ms/default2000,5consecutive failures,16input keys with cached answers; only roots/form inputs; whole drive uses requestTimeoutMs and connection lifetime, cancel best-effort5000ms; no standard tasks/result, background persistence or tool replay']
      : settings.dynamic ? [...lifecycleLimits, ...MCP_DYNAMIC_LIMITS.map((entry) => settings.notificationStream && hasHttp ? entry.replace("no background HTTP GET stream", "owned HTTP GET SSE stream enabled") : entry), ...(settings.deferred ? ["deferred tools: namespaced schemas are omitted; input schema metadata is returned by mcp_tool_search"] : [])] : lifecycleLimits,
    ...(settings.notificationStream && hasHttp ? { notificationStreams: () => Object.fromEntries([...namedClients].filter(([, client]) => client.notificationStreamStatus !== undefined).map(([name, client]) => [name, { ...client.notificationStreamStatus! }])) } : {}),
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      dynamicCatalog?.close();
      await closeAll(clients);
    },
  };
}
