export const MCP_MAX_RESOURCE_SUBSCRIPTIONS = 32;
export const MCP_MAX_RESOURCE_URI_BYTES = 4096;
export const MCP_MAX_RESOURCE_NOTIFICATIONS = 128;
export const MCP_MAX_RESOURCE_NOTIFICATION_BYTES = 32 * 1024;

export const MCP_SUBSCRIPTION_LIMITS: readonly string[] = [
  "resource subscriptions: opt-in and require resources.subscribe === true; exact URI strings, explicit subscribe/unsubscribe RPCs and local destructive notification polling; no automatic read/refetch",
  `resource subscription bounds per server connection: ${MCP_MAX_RESOURCE_SUBSCRIPTIONS} subscriptions, ${MCP_MAX_RESOURCE_URI_BYTES} UTF-8 bytes per URI, ${MCP_MAX_RESOURCE_NOTIFICATIONS} queued updates and ${MCP_MAX_RESOURCE_NOTIFICATION_BYTES} bytes of queued JSON text; oldest updates evicted with explicit dropped counts`,
  "resource subscription ownership: state and pending notifications belong to the runtime-owned connection, shared by its tools; close/failure clears state; a replacement connection starts empty; no persistence, reconnect or replay",
  "resource subscription delivery: stdio observes unsolicited push; HTTP observes only active POST SSE responses, with no GET stream or continuous HTTP push; updates before successful subscribe replies are ignored",
  "resource subscription requests: transport deadlines/abort apply; at most one subscription mutation in flight per server connection; state changes only after a successful object RPC result",
];

export type McpSubscriptionMethod = "resources/subscribe" | "resources/unsubscribe";
type Request = (method: McpSubscriptionMethod, params: { uri: string }, signal: AbortSignal, onResult: (result: unknown) => void) => Promise<unknown>;

export class McpSubscriptionPersistenceError extends Error {
  constructor(method: McpSubscriptionMethod, cause: unknown) {
    super(`MCP ${method} acknowledged but not recorded: session journal commit failed`, { cause });
    this.name = "McpSubscriptionPersistenceError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMcpResourceUri(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value) > MCP_MAX_RESOURCE_URI_BYTES || /[\x00-\x20\x7f]/.test(value)) {
    throw new Error(`MCP resource URI requires a non-empty exact string without spaces/control characters, at most ${MCP_MAX_RESOURCE_URI_BYTES} UTF-8 bytes`);
  }
}

/** Only inert URI updates are retained; server payload fields are never copied. */
export class McpResourceSubscriptions {
  private readonly uris = new Set<string>();
  private readonly updates: { uri: string; bytes: number }[] = [];
  private bytes = 2; // JSON array brackets, plus serialized entries and commas.
  private dropped = 0;
  private changing = false;
  private closed = false;
  private replacement: object | undefined;
  private acknowledgement: ((method: McpSubscriptionMethod, uri: string) => void) | undefined;
  private persistenceFailure: McpSubscriptionPersistenceError | undefined;

  constructor(private readonly request: Request, private readonly advertised: () => boolean) {}

  supports(): boolean { return !this.closed && this.advertised(); }

  snapshot(): readonly string[] { return Object.freeze([...this.uris]); }

  setAcknowledgement(callback: ((method: McpSubscriptionMethod, uri: string) => void) | undefined): void {
    this.acknowledgement = callback;
  }

  poisonPersistence(error: McpSubscriptionPersistenceError): void {
    this.persistenceFailure ??= error;
  }

  private active(signal: AbortSignal): void {
    if (this.closed) throw new Error("MCP resource subscription connection closed");
    if (signal.aborted) { const error = new Error("MCP request aborted"); error.name = "AbortError"; throw error; }
    if (!this.advertised()) throw new Error("MCP server did not advertise resources.subscribe === true");
  }

  async change(method: McpSubscriptionMethod, uri: unknown, signal: AbortSignal): Promise<{ uri: string; subscribed: boolean }> {
    return this.mutate(method, uri, signal, false);
  }

  /** Replay only desired subscriptions; the caller owns the mutation freeze. */
  async restore(uris: readonly string[], signal: AbortSignal): Promise<void> {
    if (this.persistenceFailure) throw this.persistenceFailure;
    for (const uri of uris) await this.mutate("resources/subscribe", uri, signal, true);
  }

  private async mutate(method: McpSubscriptionMethod, uri: unknown, signal: AbortSignal, restoring: boolean): Promise<{ uri: string; subscribed: boolean }> {
    this.active(signal);
    if (this.persistenceFailure) throw this.persistenceFailure;
    validateMcpResourceUri(uri);
    if (this.replacement && !restoring) throw new Error("MCP resource subscription mutation blocked during transport replacement; retry after reconnect completes");
    if (this.changing) throw new Error("MCP resource subscription mutation already in flight");
    const subscribe = method === "resources/subscribe";
    if (subscribe && !this.uris.has(uri) && this.uris.size >= MCP_MAX_RESOURCE_SUBSCRIPTIONS) throw new Error("MCP resource subscription limit reached (32)");
    this.changing = true;
    try {
      await this.request(method, { uri }, signal, (result) => {
        this.active(signal);
        if (!record(result)) throw new Error("MCP resource subscription returned an invalid result");
        // Commit while dispatching the reply, before the next frame in its chunk.
        if (!restoring && this.acknowledgement) {
          try { this.acknowledgement(method, uri); }
          catch (cause) {
            // The remote effect is acknowledged even when its journal write fails.
            if (subscribe) this.uris.add(uri);
            else this.uris.delete(uri);
            const error = cause instanceof McpSubscriptionPersistenceError ? cause : new McpSubscriptionPersistenceError(method, cause);
            this.poisonPersistence(error);
            throw error;
          }
        }
        if (subscribe) this.uris.add(uri);
        else this.uris.delete(uri);
      });
      return { uri, subscribed: subscribe };
    } finally { this.changing = false; }
  }

  /** Freeze mutations before taking the acknowledged desired-state snapshot. */
  prepareReplacement(): { uris: readonly string[]; release(): void } {
    if (this.persistenceFailure) throw this.persistenceFailure;
    if (this.changing) throw new Error("MCP transport replacement blocked: resource subscription mutation already in flight");
    if (this.replacement) throw new Error("MCP resource subscription transport replacement already in flight");
    const token = {};
    this.replacement = token;
    return {
      uris: this.snapshot(),
      release: () => {
        if (this.replacement === token) this.replacement = undefined;
      },
    };
  }

  updated(params: unknown): void {
    if (this.closed || !record(params) || typeof params.uri !== "string" || !this.uris.has(params.uri)) return;
    const uri = params.uri;
    const bytes = Buffer.byteLength(JSON.stringify({ uri })) + 1;
    this.updates.push({ uri, bytes });
    this.bytes += bytes;
    while (this.updates.length > MCP_MAX_RESOURCE_NOTIFICATIONS || this.bytes > MCP_MAX_RESOURCE_NOTIFICATION_BYTES) {
      this.bytes -= this.updates.shift()!.bytes;
      this.dropped = Math.min(Number.MAX_SAFE_INTEGER, this.dropped + 1);
    }
  }

  /** Output caps leave undelivered entries and loss counters available to the next poll. */
  poll(server: string, limit: number, cap: number, signal: AbortSignal): string {
    this.active(signal);
    if (!Number.isInteger(limit) || limit < 1 || limit > MCP_MAX_RESOURCE_NOTIFICATIONS) throw new Error("MCP notification limit must be an integer from 1 to 128");
    const count = Math.min(limit, this.updates.length);
    const notifications = this.updates.slice(0, count).map(({ uri }) => ({ uri }));
    const render = () => JSON.stringify({ server, notifications, dropped: this.dropped, remaining: this.updates.length - notifications.length, subscriptions: this.uris.size });
    let text = render();
    while (notifications.length && Buffer.byteLength(text) > cap) { notifications.pop(); text = render(); }
    if (Buffer.byteLength(text) > cap || (count > 0 && notifications.length === 0)) throw new Error("MCP notification output budget too small; queued updates retained");
    for (let i = 0; i < notifications.length; i++) this.bytes -= this.updates.shift()!.bytes;
    this.dropped = 0;
    return text;
  }

  close(): void {
    this.closed = true;
    this.acknowledgement = undefined;
    this.replacement = undefined;
    this.uris.clear(); this.updates.length = 0; this.bytes = 2; this.dropped = 0;
  }
}
