export const MCP_LOG_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"] as const;
export type McpLogLevel = typeof MCP_LOG_LEVELS[number];
export const MCP_MAX_LOG_NOTIFICATIONS = 128;
export const MCP_MAX_LOG_QUEUE_BYTES = 32 * 1024;
export const MCP_MAX_LOG_MESSAGE_BYTES = 16 * 1024;
export const MCP_MAX_LOG_METADATA_BYTES = 4096;
export const MCP_MAX_LOG_LOGGER_BYTES = 1024;
export const MCP_MAX_LOG_JSON_DEPTH = 16;
export const MCP_MAX_LOG_JSON_NODES = 2048;
export const MCP_LOGGING_LIMITS: readonly string[] = [
  "logging: opt-in and requires an advertised logging object; explicit logging/setLevel and destructive local polling; logs are untrusted JSON, never instructions or automatic actions",
  `logging queue per server connection: ${MCP_MAX_LOG_NOTIFICATIONS} entries and ${MCP_MAX_LOG_QUEUE_BYTES} JSON bytes; oldest entries evicted, malformed/oversized entries discarded, losses reported as dropped`,
  `logging payload bounds: ${MCP_MAX_LOG_MESSAGE_BYTES} serialized bytes per notification/data, ${MCP_MAX_LOG_METADATA_BYTES} per _meta object, ${MCP_MAX_LOG_LOGGER_BYTES} per logger; JSON depth ${MCP_MAX_LOG_JSON_DEPTH}, nodes ${MCP_MAX_LOG_JSON_NODES}; strict eight-level enum`,
  "logging ownership: runtime connection owns queue across turns; close/failure clears state; no persistence, replay or reconnect; setLevel uses transport deadlines/abort and accepts only successful object results",
  "logging delivery: unsolicited stdio notifications/message and active HTTP POST SSE responses only; no GET stream or continuous HTTP push; polling causes no server requests",
];
type Request = (method: "logging/setLevel", params: { level: McpLogLevel }, signal: AbortSignal, onResult: (result: unknown) => void) => Promise<unknown>;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validateMcpLogLevel(level: unknown): asserts level is McpLogLevel {
  if (typeof level !== "string" || !MCP_LOG_LEVELS.includes(level as McpLogLevel)) throw new Error("MCP logging level must be debug/info/notice/warning/error/critical/alert/emergency");
}
/** Bound JSON traversal before serialization; getters and non-JSON values fail. */
function jsonText(root: unknown, cap: number): string {
  const stack = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (++nodes > MCP_MAX_LOG_JSON_NODES || depth > MCP_MAX_LOG_JSON_DEPTH) throw new Error("MCP log JSON exceeds structural bounds");
    if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) continue;
    if (!record(value) && !Array.isArray(value)) throw new Error("MCP log requires JSON data");
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("MCP log requires plain JSON data");
    const keys = Object.keys(value);
    if (nodes + stack.length + keys.length > MCP_MAX_LOG_JSON_NODES) throw new Error("MCP log JSON exceeds node limit");
    if (Array.isArray(value) && keys.length !== value.length) throw new Error("MCP log requires dense JSON arrays");
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!Object.hasOwn(descriptor, "value")) throw new Error("MCP log requires inert JSON data");
      stack.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
  const text = JSON.stringify(root);
  if (typeof text !== "string" || Buffer.byteLength(text) > cap) throw new Error("MCP log JSON exceeds byte limit");
  return text;
}
export class McpLogging {
  private readonly queue: string[] = [];
  private bytes = 2;
  private dropped = 0;
  private closed = false;
  private changing = false;
  constructor(private readonly request: Request, private readonly advertised: () => boolean) {}
  supports(): boolean { return !this.closed && this.advertised(); }
  private active(signal: AbortSignal): void {
    if (this.closed) throw new Error("MCP logging connection closed");
    if (signal.aborted) { const error = new Error("MCP request aborted"); error.name = "AbortError"; throw error; }
    if (!this.advertised()) throw new Error("MCP server did not advertise a logging object");
  }
  async setLevel(level: unknown, signal: AbortSignal): Promise<void> {
    this.active(signal); validateMcpLogLevel(level);
    if (this.changing) throw new Error("MCP logging level request already in flight");
    this.changing = true;
    try {
      await this.request("logging/setLevel", { level }, signal, (result) => {
        this.active(signal);
        if (!record(result)) throw new Error("MCP logging/setLevel returned an invalid result");
      });
    } finally { this.changing = false; }
  }
  private lose(): void { this.dropped = Math.min(Number.MAX_SAFE_INTEGER, this.dropped + 1); }
  message(params: unknown): void {
    if (!this.supports()) return;
    try {
      const text = jsonText(params, MCP_MAX_LOG_MESSAGE_BYTES);
      if (!record(params) || !Object.hasOwn(params, "data") || Object.keys(params).some((key) => !["level", "logger", "data", "_meta"].includes(key))) throw new Error("Invalid MCP log notification");
      validateMcpLogLevel(params.level);
      if (params.logger !== undefined && (typeof params.logger !== "string" || Buffer.byteLength(params.logger) > MCP_MAX_LOG_LOGGER_BYTES || /[\x00-\x1f\x7f]/.test(params.logger))) throw new Error("Invalid MCP logger");
      jsonText(params.data, MCP_MAX_LOG_MESSAGE_BYTES);
      if (params._meta !== undefined) {
        if (!record(params._meta)) throw new Error("Invalid MCP log metadata");
        jsonText(params._meta, MCP_MAX_LOG_METADATA_BYTES);
      }
      this.queue.push(text); this.bytes += Buffer.byteLength(text) + 1;
      while (this.queue.length > MCP_MAX_LOG_NOTIFICATIONS || this.bytes > MCP_MAX_LOG_QUEUE_BYTES) {
        this.bytes -= Buffer.byteLength(this.queue.shift()!) + 1; this.lose();
      }
    } catch { this.lose(); }
  }
  poll(server: string, limit: number, cap: number, signal: AbortSignal): string {
    this.active(signal);
    if (!Number.isInteger(limit) || limit < 1 || limit > MCP_MAX_LOG_NOTIFICATIONS) throw new Error("MCP logging notification limit must be an integer from 1 to 128");
    const notifications = this.queue.slice(0, limit).map((text) => JSON.parse(text) as unknown);
    const wanted = notifications.length;
    const render = () => JSON.stringify({ server, notifications, dropped: this.dropped, remaining: this.queue.length - notifications.length });
    let text = render();
    while (notifications.length && Buffer.byteLength(text) > cap) { notifications.pop(); text = render(); }
    if (Buffer.byteLength(text) > cap || (wanted && !notifications.length)) throw new Error("MCP logging output budget too small; queued logs retained");
    for (let i = 0; i < notifications.length; i++) this.bytes -= Buffer.byteLength(this.queue.shift()!) + 1;
    this.dropped = 0;
    return text;
  }
  close(): void { this.closed = true; this.queue.length = 0; this.bytes = 2; this.dropped = 0; }
}
