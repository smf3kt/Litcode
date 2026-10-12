// Streamable HTTP POST transport with an optional independently owned GET SSE
// notification stream. Session replacement belongs to the connection manager.
import {
  listMcpTools,
  parseMcpToolResult,
  type McpClient,
  type McpCatalogMethod,
  type McpConnectOptions,
  type McpConnectSettings,
  type McpHttpServerConfig,
  type McpToolInfo,
  type McpToolResult,
  type McpNotificationStreamStatus,
} from "./mcp.js";
import { boundToolContent } from './tool-output.js';
import { McpClientRequestHandler } from "./mcp-client-requests.js";
import { McpResourceSubscriptions } from "./mcp-subscriptions.js";
import { McpLogging } from "./mcp-logging.js";
import { McpTaskError, driveMcpTask, parseTaskHandle } from './mcp-task.js';
import { MCP_RELATED_TASK, MCP_TASK_PROTOCOL_VERSION, standardTaskSupport, canAugmentTask, parseStandardTask, driveStandardMcpTask } from './mcp-standard-task.js';

export const MCP_HTTP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_HTTP_SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = ["2025-03-26", "2025-06-18"];
export const MCP_HTTP_MAX_FRAME_BYTES = 1024 * 1024;
export const MCP_HTTP_MAX_BODY_BYTES = 8 * 1024 * 1024;
export const MCP_HTTP_MAX_SSE_LINE_BYTES = 64 * 1024;
export const MCP_HTTP_MAX_SSE_EVENTS = 1000;
export const MCP_HTTP_CLEANUP_TIMEOUT_MS = 1000;
export class McpHttpStatusError extends Error {
  constructor(method: string, readonly status: number) { super(`MCP HTTP request "${method}" failed with status ${status}`); }
}

class McpHttpStreamTransportError extends Error {
  constructor() { super("MCP GET notification transport failed"); }
}
const notificationReopenDelays = [1000, 2000, 4000, 8000, 8000] as const;
export const MCP_HTTP_LIMITS: readonly string[] = [
  "transport: Streamable HTTP POST with bounded JSON or SSE responses; no standalone GET stream or legacy HTTP+SSE endpoint discovery; managed replacement does not replay events",
  "authentication: request headers read freshly from environment variable references; no OAuth, login, token refresh or credential storage",
  "HTTP URLs: HTTP(S) only, no userinfo, credential query parameters or fragments; redirects are rejected without following",
  "server features: tools only (resources, prompts, sampling, roots and logging are not implemented)",
  "server-initiated requests on POST responses: answered with JSON-RPC method-not-found via a bounded POST; tools/list_changed marks dynamic catalogs dirty, other notifications are ignored",
  "init-result protocol version: 2025-03-26 and 2025-06-18 only; stdio retains 2024-11-05",
  `HTTP responses: ${MCP_HTTP_MAX_FRAME_BYTES} bytes per JSON message/SSE event, ${MCP_HTTP_MAX_BODY_BYTES} bytes per response, ${MCP_HTTP_MAX_SSE_LINE_BYTES} bytes per SSE line, ${MCP_HTTP_MAX_SSE_EVENTS} SSE events per response`,
  "requests: bounded deadlines and abort; cancellation notifications and session DELETE are best effort and independently bounded",
];

const reservedHeaders = new Set([
  "accept", "content-type", "content-length", "content-encoding", "host", "connection",
  "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "expect",
  "mcp-session-id", "mcp-protocol-version", "mcp-name", "origin", "referer", "set-cookie",
]);

export function validateMcpHttpUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid MCP HTTP URL"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash || value.includes("#")) {
    throw new Error("MCP HTTP URL requires HTTP(S) without userinfo or fragments");
  }
  for (const key of url.searchParams.keys()) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/token|secret|password|passwd|credential|authorization|apikey|accesskey|signature|session|auth|bearer/.test(normalized) || normalized === "key") {
      throw new Error("MCP HTTP URL contains a credential query parameter");
    }
  }
  return url.href;
}

export function validateMcpHeadersEnv(value: unknown): asserts value is Record<string, string> | undefined {
  if (value === undefined) return;
  if (!record(value)) throw new Error("MCP headersEnv must be an object");
  const seen = new Set<string>();
  for (const [name, envName] of Object.entries(value)) {
    const lower = name.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || reservedHeaders.has(lower) ||
        lower.startsWith("proxy-") || lower.startsWith("sec-") || seen.has(lower)) {
      throw new Error("MCP headersEnv contains an invalid or reserved header name");
    }
    if (typeof envName !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName)) {
      throw new Error("MCP headersEnv values must be environment variable names");
    }
    seen.add(lower);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function aborted(): Error {
  const error = new Error("MCP request aborted");
  error.name = "AbortError";
  return error;
}
function parseJson(text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new Error("MCP HTTP response contains invalid JSON"); }
}
function decodeUtf8(decoder: TextDecoder, bytes?: Uint8Array, stream = false): string {
  try { return decoder.decode(bytes, { stream }); }
  catch { throw new Error("MCP HTTP response contains invalid UTF-8"); }
}

type Operation = { controller: AbortController; done: Promise<void>; finish: () => void };

/** A small incremental SSE parser with UTF-8 decoding owned by the response reader. */
class SseParser {
  private line = "";
  private lineBytes = 0;
  private data: string[] = [];
  private eventBytes = 0;
  private events = 0;
  private afterCr = false;
  private first = true;

  constructor(private readonly onData: (text: string) => Promise<boolean>, private readonly continuous = false) {}

  async feed(text: string): Promise<boolean> {
    for (const char of text) {
      if (this.first) {
        this.first = false;
        if (char === "﻿") continue;
      }
      if (this.afterCr) {
        this.afterCr = false;
        if (char === "\n") continue;
      }
      if (char === "\r" || char === "\n") {
        this.afterCr = char === "\r";
        if (await this.endLine()) return true;
      } else {
        this.lineBytes += Buffer.byteLength(char);
        if (this.lineBytes > MCP_HTTP_MAX_SSE_LINE_BYTES) throw new Error("MCP HTTP SSE line exceeds byte limit");
        this.line += char;
      }
    }
    return false;
  }

  private async endLine(): Promise<boolean> {
    const line = this.line;
    this.line = "";
    this.lineBytes = 0;
    if (line === "") {
      if (!this.continuous && ++this.events > MCP_HTTP_MAX_SSE_EVENTS) throw new Error("MCP HTTP SSE exceeds event limit");
      const text = this.data.join("\n");
      this.data = [];
      this.eventBytes = 0;
      // Empty events, comments and SSE id/retry fields carry no JSON-RPC data.
      return text.trim() ? this.onData(text) : false;
    }
    this.eventBytes += Buffer.byteLength(line) + 1;
    if (this.eventBytes > MCP_HTTP_MAX_FRAME_BYTES) throw new Error("MCP HTTP SSE event exceeds byte limit");
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") this.data.push(value);
    return false;
  }

  complete(): void {
    if (this.line.length || this.data.length || this.eventBytes) throw new Error("MCP HTTP SSE stream ended inside a frame");
  }
}

export class McpHttpClient implements McpClient {
  private streamStatus: McpNotificationStreamStatus | undefined;
  get notificationStreamStatus(): McpNotificationStreamStatus | undefined {
    return this.streamStatus ? { ...this.streamStatus, ...(this.settings.recovery ? { reopenAttempts: this.streamReopenAttempts } : {}) } : undefined;
  }
  private streamReopenAttempts = 0;
  private streamRetryTimer: NodeJS.Timeout | undefined;
  private streamController: AbortController | undefined;
  private streamDone: Promise<void> | undefined;
  readonly resourceSubscriptions?: McpResourceSubscriptions;
  readonly logging?: McpLogging;
  private readonly url: string;
  private readonly headersEnv: Record<string, string>;
  private readonly settings: McpConnectSettings;
  private readonly clientRequests: McpClientRequestHandler;
  private readonly taskJournal: McpConnectOptions["taskJournal"];
  private nextId = 1;
  private version = MCP_HTTP_PROTOCOL_VERSION;
  private sessionId: string | undefined;
  private initialized = false;
  private capabilities: Record<string, unknown> = {};
  private taskTools = new Map<string, McpToolInfo>();
  private readonly toolsChangedListeners = new Set<() => void>();
  private readonly disconnectListeners = new Set<() => void>();
  private transportFailures = 0;
  private disconnected = false;
  private failedTransport(expired = false): void {
    if (this.closed || !this.initialized || this.disconnected) return;
    if (!expired && ++this.transportFailures < 3) return;
    this.disconnected = true;
    for (const listener of this.disconnectListeners) listener();
  }
  onDisconnected(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => { this.disconnectListeners.delete(listener); };
  }
  private closed = false;
  private readonly taskLifetime = new AbortController();
  private closing: Promise<void> | undefined;
  private readonly operations = new Set<Operation>();

  constructor(readonly name: string, config: McpHttpServerConfig, options: McpConnectOptions = {}) {
    this.url = validateMcpHttpUrl(config.url);
    validateMcpHeadersEnv(config.headersEnv);
    this.headersEnv = { ...config.headersEnv };
    const timeout = options.requestTimeoutMs;
    this.settings = {
      requestTimeoutMs: typeof timeout === "number" && Number.isFinite(timeout) && timeout >= 1 ? Math.floor(timeout) : 30_000,
      clientName: options.clientName ?? "personal-agent-harness",
      clientVersion: options.clientVersion ?? "0.1.0",
      catalog: options.catalog ?? false,
      dynamic: options.dynamic ?? false,
      deferred: options.deferred ?? false,
      subscriptions: options.subscriptions ?? false,
      logging: options.logging ?? false,
      notificationStream: options.notificationStream ?? false,
      clientRequests: options.clientRequests,
      recovery: options.recovery ?? false,
      persistence: options.persistence ?? false,
      tasks: options.tasks ?? false,
      standardTasks: options.standardTasks ?? false,
    };
    this.taskJournal = options.taskJournal;
    this.clientRequests = new McpClientRequestHandler(name, options.clientRequests);
    if (this.settings.subscriptions) this.resourceSubscriptions = new McpResourceSubscriptions(this.request.bind(this), () => record(this.capabilities.resources) && this.capabilities.resources.subscribe === true);
    if (this.settings.logging) this.logging = new McpLogging(this.request.bind(this), () => record(this.capabilities.logging));
  }

  private headers(): Headers {
    const headers = new Headers({
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": this.version,
    });
    if (this.sessionId !== undefined) headers.set("MCP-Session-Id", this.sessionId);
    for (const [name, envName] of Object.entries(this.headersEnv)) {
      const value = process.env[envName];
      if (value === undefined || value.length === 0) throw new Error("MCP HTTP authentication environment value is missing");
      if (/[^\x20-\x7e]/.test(value)) throw new Error("MCP HTTP authentication environment value is invalid");
      headers.set(name, value);
    }
    return headers;
  }

  private async bounded<T>(
    method: string, signal: AbortSignal | undefined, timeoutMs: number,
    fn: (signal: AbortSignal) => Promise<T>, allowClosed = false,
  ): Promise<T> {
    if (this.closed && !allowClosed) throw new Error(`MCP server "${this.name}" connection closed`);
    if (signal?.aborted) throw aborted();
    const controller = new AbortController();
    let finish!: () => void;
    const op: Operation = { controller, done: new Promise<void>((resolve) => { finish = resolve; }), finish: () => finish() };
    this.operations.add(op);
    let timedOut = false;
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      return await fn(controller.signal);
    } catch (error) {
      if (timedOut) throw new Error(`MCP request "${method}" on server "${this.name}" timed out after ${timeoutMs}ms`);
      if (controller.signal.aborted) throw aborted();
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      this.operations.delete(op);
      op.finish();
    }
  }

  private async fetchMessage(method: "POST" | "DELETE" | "GET", message: unknown, signal: AbortSignal, taskId?: string): Promise<Response> {
    const body = message === undefined ? undefined : JSON.stringify(message);
    if (body !== undefined && Buffer.byteLength(body) > MCP_HTTP_MAX_FRAME_BYTES) throw new Error("MCP HTTP outbound message exceeds byte limit");
    const headers = this.headers();
    if (taskId !== undefined) headers.set('Mcp-Name', taskId);
    if (method === "GET") { headers.set("Accept", "text/event-stream"); headers.delete("Content-Type"); }
    let response: Response;
    try { response = await fetch(this.url, { method, headers, body, signal, redirect: "manual" }); }
    catch (error) {
      if (signal.aborted) throw aborted();
      if (method !== "GET" || !this.settings.recovery) this.failedTransport();
      if (method === "GET" && error instanceof TypeError) throw new McpHttpStreamTransportError();
      throw new Error("MCP HTTP transport request failed");
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new Error("MCP HTTP redirect rejected");
    }
    return response;
  }

  private async accepted(message: unknown, signal: AbortSignal): Promise<void> {
    const response = await this.fetchMessage("POST", message, signal);
    // Streamable HTTP notifications and client responses are acknowledged by 202.
    await response.body?.cancel();
    if (response.status !== 202) throw new Error(`MCP HTTP expected 202 acknowledgement, received ${response.status}`);
  }

  private notification(msg: Record<string, unknown>): void {
    if (this.closed || Object.hasOwn(msg, "id")) return;
    if (msg.method === "notifications/tools/list_changed") for (const listener of this.toolsChangedListeners) listener();
    if (msg.method === "notifications/cancelled") this.clientRequests.cancelled(msg.params);
    if (msg.method === "notifications/resources/updated") this.resourceSubscriptions?.updated(msg.params);
    if (msg.method === "notifications/message") this.logging?.message(msg.params);
  }

  private startNotificationStream(): void {
    if (this.closed) return;
    const controller = new AbortController();
    this.streamController = controller;
    this.streamStatus = { state: "starting" };
    this.streamDone = this.readNotificationStream(controller);
  }

  private scheduleNotificationReopen(): void {
    if (this.closed || !this.settings.recovery || !this.settings.notificationStream || this.streamRetryTimer) return;
    // Finite local adaptation: five GET-only reopens per client lifetime, with
    // 1/2/4/8/8s backoff. An active stream never resets this budget; no replay.
    const delay = notificationReopenDelays[this.streamReopenAttempts];
    if (delay === undefined) {
      this.streamStatus = { state: "failed", reason: "notification stream reopen exhausted after 5 attempts" };
      return;
    }
    this.streamStatus = { state: "starting", reason: `GET recovery backoff ${delay}ms` };
    this.streamRetryTimer = setTimeout(() => {
      this.streamRetryTimer = undefined;
      if (this.closed) return;
      this.streamReopenAttempts++;
      this.startNotificationStream();
    }, delay);
    this.streamRetryTimer.unref();
  }
  private async readNotificationStream(controller: AbortController): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    let reopen = false;

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let idle = false;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { idle = true; controller.abort(); }, this.settings.requestTimeoutMs);
    };
    try {
      arm();
      const response = await this.fetchMessage("GET", undefined, controller.signal);
      if (response.status === 404 || response.status === 405) {
        this.streamStatus = { state: "unavailable", reason: `HTTP ${response.status}` }; await response.body?.cancel(); return;
      }
      if (response.status === 204) { this.streamStatus = { state: "ended", reason: "HTTP 204" }; await response.body?.cancel(); return; }
      if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "text/event-stream" || !response.body) {
        await response.body?.cancel(); throw new Error("MCP GET notification stream requires successful SSE response");
      }
      this.streamStatus = { state: "active" };
      const parser = new SseParser(async (text) => {
        const msg = parseJson(text);
        if (!record(msg) || msg.jsonrpc !== "2.0") throw new Error("MCP GET malformed JSON-RPC message");
        if (this.settings.recovery && ((Object.hasOwn(msg, "method") && (typeof msg.method !== "string" || Object.hasOwn(msg, "result") || Object.hasOwn(msg, "error"))) ||
            (Object.hasOwn(msg, "params") && !record(msg.params)) ||
            (Object.hasOwn(msg, "id") && msg.id !== null && typeof msg.id !== "string" && (typeof msg.id !== "number" || !Number.isFinite(msg.id))) ||
            (!Object.hasOwn(msg, "method") && (!Object.hasOwn(msg, "id") || Object.hasOwn(msg, "result") === Object.hasOwn(msg, "error")))))
          throw new Error("MCP GET malformed JSON-RPC message type");
        this.notification(msg);
        if (this.settings.standardTasks && this.version === MCP_TASK_PROTOCOL_VERSION && Object.hasOwn(msg, "id") &&
            ["roots/list", "elicitation/create"].includes(String(msg.method)) && record(msg.params) &&
            record(msg.params._meta) && Object.hasOwn(msg.params._meta, MCP_RELATED_TASK)) {
          // Keep reading so cancellation notifications can interrupt a pending callback.
          void this.clientRequests.handle(msg, reply => this.bounded("client response", undefined, MCP_HTTP_CLEANUP_TIMEOUT_MS,
            replySignal => this.accepted(reply, replySignal))).catch(() => undefined);
        }
        return false;
      }, true);
      const decoder = new TextDecoder("utf-8", { fatal: true });
      reader = response.body.getReader();
      for (;;) {
        arm();
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try { chunk = await reader.read(); }
        catch (error) {
          // Only the I/O boundary classifies TypeError as transport; decoding
          // and parser failures below stay terminal, including invalid UTF-8.
          if (!controller.signal.aborted && error instanceof TypeError) throw new McpHttpStreamTransportError();
          throw error;
        }
        if (controller.signal.aborted || this.closed) throw aborted();
        if (chunk.done) {
          await parser.feed(decodeUtf8(decoder)); parser.complete();
          this.streamStatus = { state: "ended", reason: "EOF" };
          reopen = true;
          return;
        }
        if (chunk.value.byteLength > MCP_HTTP_MAX_BODY_BYTES) throw new Error("MCP GET notification chunk exceeds byte limit");
        // Decode bounded slices; per-line/per-event parser bounds apply across
        // chunks. A continuous stream has no accumulated body or event counter.
        for (let offset = 0; offset < chunk.value.byteLength; offset += MCP_HTTP_MAX_SSE_LINE_BYTES) {
          await parser.feed(decodeUtf8(decoder, chunk.value.subarray(offset, offset + MCP_HTTP_MAX_SSE_LINE_BYTES), true));
          if (controller.signal.aborted || this.closed) throw aborted();
        }
      }
    } catch (error) {
      reopen = idle || error instanceof McpHttpStreamTransportError;
      this.streamStatus = this.closed ? { state: "closed" } : { state: "failed", reason: idle ? "header/read idle deadline exceeded" : "transport, redirect or malformed SSE failure" };
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      if (this.streamController === controller) this.streamController = undefined;
      if (reopen) this.scheduleNotificationReopen();
    }
  }

  private async responseResult(response: Response, id: number, method: string, signal: AbortSignal, onResult?: (result: unknown) => void): Promise<unknown> {
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404 && this.sessionId) this.failedTransport(true);
      else if ([500, 502, 503, 504].includes(response.status)) this.failedTransport();
      throw new McpHttpStatusError(method, response.status);
    }
    this.transportFailures = 0;
    const kind = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if ((kind !== "application/json" && kind !== "text/event-stream") || !response.body) {
      await response.body?.cancel();
      throw new Error("MCP HTTP response requires application/json or text/event-stream");
    }
    const limit = kind === "application/json" ? MCP_HTTP_MAX_FRAME_BYTES : MCP_HTTP_MAX_BODY_BYTES;
    const length = response.headers.get("content-length");
    if (length && Number(length) > limit) {
      await response.body.cancel();
      throw new Error("MCP HTTP response exceeds body byte limit");
    }
    let result: unknown;
    let matched = false;
    const dispatch = async (text: string): Promise<boolean> => {
      const msg = parseJson(text);
      if (!record(msg) || msg.jsonrpc !== "2.0") throw new Error("MCP HTTP malformed JSON-RPC message");
      if (typeof msg.method === "string") {
        this.notification(msg);
        if (Object.hasOwn(msg, "id")) {
          // Callback/reply deadlines belong to the connection, not the outer POST.
          // Keep reading this stream so cancellation and parallel requests progress.
          const handling = this.clientRequests.handle(msg, (reply) => this.bounded("client response", undefined, MCP_HTTP_CLEANUP_TIMEOUT_MS,
            (replySignal) => this.accepted(reply, replySignal)));
          if (this.clientRequests.supports(msg.method)) void handling.catch(() => undefined);
          else await handling;
        }
        return false;
      }
      if (msg.id !== id) throw new Error("MCP HTTP response id does not match request");
      const hasResult = Object.hasOwn(msg, "result");
      const hasError = Object.hasOwn(msg, "error");
      if (hasResult === hasError) throw new Error("MCP HTTP response requires exactly one result or error");
      if (hasError) {
        if (!record(msg.error) || typeof msg.error.code !== "number" || typeof msg.error.message !== "string") throw new Error("MCP HTTP malformed JSON-RPC error");
        // Remote error text can echo request headers, including an earlier value
        // of an env credential. Report its code without journaling remote text.
        throw Object.assign(new Error(`MCP request "${method}" on server "${this.name}" failed (code ${msg.error.code})`), { code: msg.error.code });
      }
      result = msg.result;
      onResult?.(result);
      matched = true;
      return true;
    };
    const parser = new SseParser(dispatch);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const reader = response.body.getReader();
    let total = 0;
    let json = "";
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > limit) throw new Error("MCP HTTP response exceeds body byte limit");
        const text = decodeUtf8(decoder, chunk.value, true);
        if (kind === "application/json") json += text;
        else if (await parser.feed(text)) return result;
      }
      const tail = decodeUtf8(decoder);
      if (kind === "application/json") {
        json += tail;
        await dispatch(json);
      } else {
        await parser.feed(tail);
      }
      if (!matched) throw new Error("MCP HTTP stream ended without a matching response");
      return result;
    } finally {
      // A successful SSE response can leave its connection open indefinitely.
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private async request(method: string, params: unknown, signal: AbortSignal, onResult?: (result: unknown) => void, taskId?: string): Promise<unknown> {
    if (signal.aborted) throw aborted();
    const id = this.nextId++;
    try {
      return await this.bounded(method, signal, this.settings.requestTimeoutMs, async (activeSignal) => {
        const response = await this.fetchMessage("POST", { jsonrpc: "2.0", id, method, params }, activeSignal, taskId);
        if (method === "initialize") {
          const session = response.headers.get("mcp-session-id");
          if (session !== null) {
            if (!/^[\x21-\x7e]{1,1024}$/.test(session)) {
              await response.body?.cancel();
              throw new Error("MCP HTTP invalid session id header");
            }
            this.sessionId = session;
          }
        }
        return this.responseResult(response, id, method, activeSignal, onResult);
      });
    } catch (error) {
      if (!this.closed && method !== "initialize" &&
          ((error instanceof Error && error.name === "AbortError") || (error instanceof Error && error.message.includes("timed out after")))) {
        void this.bounded("notifications/cancelled", undefined, MCP_HTTP_CLEANUP_TIMEOUT_MS,
          (activeSignal) => this.accepted({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id, reason: signal.aborted ? "client aborted" : "timeout" } }, activeSignal)).catch(() => undefined);
      }
      throw error;
    }
  }

  async initialize(signal: AbortSignal): Promise<void> {
    if (this.initialized) throw new Error("MCP HTTP session already initialized");
    const result = await this.request("initialize", {
      protocolVersion: this.settings.standardTasks ? MCP_TASK_PROTOCOL_VERSION : MCP_HTTP_PROTOCOL_VERSION,
      capabilities: this.settings.standardTasks ? { ...this.clientRequests.capabilities, tasks: {} } : this.clientRequests.capabilities,
      clientInfo: { name: this.settings.clientName, version: this.settings.clientVersion },
    }, signal);
    if (!record(result) || typeof result.protocolVersion !== "string") throw new Error("MCP HTTP initialize did not report a protocolVersion");
    if (!MCP_HTTP_SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion) && !(this.settings.standardTasks && result.protocolVersion === MCP_TASK_PROTOCOL_VERSION)) throw new Error("MCP HTTP negotiated unsupported protocolVersion");
    if ((result.capabilities !== undefined && !record(result.capabilities)) || (result.serverInfo !== undefined && !record(result.serverInfo))) throw new Error("MCP HTTP malformed initialize metadata");
    this.capabilities = record(result.capabilities) ? result.capabilities : {};
    this.version = result.protocolVersion;
    await this.bounded("notifications/initialized", signal, this.settings.requestTimeoutMs,
      (activeSignal) => this.accepted({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }, activeSignal));
    this.initialized = true;
    if (this.settings.notificationStream && !this.closed) this.startNotificationStream();
  }

  async resumeTask(task: import('./mcp-standard-task.js').StandardMcpTask, signal: AbortSignal): Promise<McpToolResult> {
    if (!this.initialized || !this.settings.standardTasks || this.version !== MCP_TASK_PROTOCOL_VERSION) throw new Error('Standard task recovery requires negotiated2025-11-25');
    const release = this.clientRequests.ownTask(task.taskId);
    try {
      const read = async (method: string, params: unknown, requestSignal: AbortSignal) => {
        const value = await this.request(method, params, requestSignal);
        if (method === 'tasks/get' && (!record(value) || value.createdAt !== task.createdAt)) throw new McpTaskError('malformed');
        return value;
      };
      const result = await driveStandardMcpTask(task, read,
        AbortSignal.any([signal, this.taskLifetime.signal, AbortSignal.timeout(this.settings.requestTimeoutMs)]), false);
      return parseMcpToolResult(result, this.name);
    } finally { release(); }
  }

  async listTools(signal: AbortSignal): Promise<McpToolInfo[]> {
    if (!this.initialized) throw new Error("MCP HTTP session is not initialized");
    if ((this.settings.catalog || this.settings.subscriptions || this.settings.logging) && !record(this.capabilities.tools)) return [];
    const tools = await listMcpTools(this.name, this.request.bind(this), signal);
    this.taskTools = new Map(tools.map(tool => [tool.name, tool]));
    return tools;
  }

  async callTool(toolName: string, args: unknown, signal: AbortSignal): Promise<McpToolResult> {
    if (!this.initialized) throw new Error("MCP HTTP session is not initialized");
    const support = this.taskTools.get(toolName)?.taskSupport;
    if (!this.settings.standardTasks && support === 'required') throw new Error('MCP tool requires enabled standard task execution');
    const augment = this.settings.standardTasks && canAugmentTask(this.version, this.capabilities, support);
    let release: (() => void) | undefined;
    let result: unknown;
    try {
      result = await this.request("tools/call", { name: toolName, arguments: args, ...(augment ? { task: { ttl: this.settings.requestTimeoutMs } } : {}) }, signal,
        augment ? value => {
          const task = parseStandardTask(value);
          release = this.clientRequests.ownTask(task.taskId);
          this.taskJournal?.(this.name, toolName, task, false);
        } : undefined);
      if (augment) {
        const resultTask = result;
        result = await driveStandardMcpTask(parseStandardTask(result), this.request.bind(this),
          AbortSignal.any([signal, this.taskLifetime.signal, AbortSignal.timeout(this.settings.requestTimeoutMs)]), record(this.capabilities.tasks) && record(this.capabilities.tasks.cancel));
        const parsed = parseMcpToolResult(result, this.name);
        // Mark resolution only after the original payload has passed tool-result validation.
        this.taskJournal?.(this.name, toolName, parseStandardTask(resultTask), true, boundToolContent(JSON.stringify(parsed), 24000) as string, parsed.isError);
        return parsed;
      }
    } finally { release?.(); }
    const task = this.settings.tasks ? parseTaskHandle(result) : undefined;
    if (task) result = await driveMcpTask({ task,
      signal: AbortSignal.any([signal, this.taskLifetime.signal, AbortSignal.timeout(this.settings.requestTimeoutMs)]),
      request: (method, params, requestSignal) => this.request(method, params, requestSignal, undefined, task.taskId),
      resolveInputRequest: (key, input, requestSignal) => this.clientRequests.resolveTaskInput(key, input, requestSignal),
    });
    return parseMcpToolResult(result, this.name);
  }

  supportsCatalog(family: "resources" | "prompts"): boolean {
    return record(this.capabilities[family]);
  }

  onToolsChanged(listener: () => void): () => void {
    this.toolsChangedListeners.add(listener);
    return () => { this.toolsChangedListeners.delete(listener); };
  }

  catalogRequest(method: McpCatalogMethod, params: unknown, signal: AbortSignal): Promise<unknown> {
    if (!this.initialized) return Promise.reject(new Error("MCP HTTP session is not initialized"));
    return this.request(method, params, signal);
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.taskLifetime.abort();
    this.closed = true;
    this.streamController?.abort();
    if (this.streamStatus) this.streamStatus = { state: "closed" };
    this.resourceSubscriptions?.close();
    this.logging?.close();
    if (this.streamRetryTimer) clearTimeout(this.streamRetryTimer);
    this.streamRetryTimer = undefined;
    this.closing = this.cleanup();
    return this.closing;
  }

  private async cleanup(): Promise<void> {
    if (this.streamDone) {
      let timer: NodeJS.Timeout | undefined;
      try { await Promise.race([this.streamDone, new Promise<void>((resolve) => { timer = setTimeout(resolve, MCP_HTTP_CLEANUP_TIMEOUT_MS); })]); }
      finally { if (timer) clearTimeout(timer); }
    }
    const pending = [...this.operations];
    for (const op of pending) op.controller.abort();
    await Promise.all([this.clientRequests.close(), Promise.allSettled(pending.map((op) => op.done))]);
    if (this.sessionId !== undefined) {
      await this.bounded("DELETE", undefined, MCP_HTTP_CLEANUP_TIMEOUT_MS, async (signal) => {
        const response = await this.fetchMessage("DELETE", undefined, signal);
        await response.body?.cancel();
      }, true).catch(() => undefined);
    }
    this.sessionId = undefined;
  }
}
