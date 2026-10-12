// Progress for outbound MCP tool calls.
//
// The recovered client registers a progress handler on its own tool calls, which mints a token into
// the request's `_meta` and routes each inbound `notifications/progress` back to that call. A
// notification is a sign of life: the call's idle deadline moves forward (its total deadline does
// not) and the update is reported to the session. Tokens are per call and never reused, and a
// notification naming an unknown token is dropped rather than reported.

export const MCP_PROGRESS_TOKEN_BYTES = 128;
export const MCP_PROGRESS_MESSAGE_BYTES = 4096;
export const MCP_PROGRESS_LIMITS: readonly string[] = [
  "progress: opt-in per tool call; the client mints one token, sends it in the request's _meta and retires it when the call settles",
  `progress bounds: token ${MCP_PROGRESS_TOKEN_BYTES} bytes, message ${MCP_PROGRESS_MESSAGE_BYTES} bytes; a notification with an unknown, absent or malformed token is ignored, never reported`,
  "progress effect: a notification resets that call's idle deadline, while the call's total deadline keeps running; progress never extends the total",
];

export type McpProgressUpdate = { token: string; progress: number; total?: number; message?: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bounded, inert view of a `notifications/progress` payload, or undefined when it is not one. */
export function mcpProgressUpdate(params: unknown): McpProgressUpdate | undefined {
  if (!record(params)) return undefined;
  const token = params.progressToken;
  if (typeof token !== "string" || token.length === 0 || Buffer.byteLength(token) > MCP_PROGRESS_TOKEN_BYTES) return undefined;
  const progress = params.progress;
  if (typeof progress !== "number" || !Number.isFinite(progress)) return undefined;
  const total = params.total;
  if (total !== undefined && (typeof total !== "number" || !Number.isFinite(total))) return undefined;
  const message = params.message;
  if (message !== undefined && (typeof message !== "string" || Buffer.byteLength(message) > MCP_PROGRESS_MESSAGE_BYTES)) return undefined;
  return { token, progress, ...(total === undefined ? {} : { total }), ...(message === undefined ? {} : { message }) };
}

/**
 * Tokens for calls in flight on one connection. Mints, dispatches and retires; it holds no state
 * beyond the calls that are still open, and a token is never handed out twice on a connection.
 */
export class McpProgressRegistry {
  private counter = 0;
  private readonly armed = new Map<string, (update: McpProgressUpdate) => void>();
  constructor(private readonly prefix: string) {}
  /** Mint a token for one call. A token is never handed out twice on a connection. */
  reserve(): string {
    return `${this.prefix}${++this.counter}`;
  }
  /** Register where that call's notifications are delivered. */
  arm(token: string, onUpdate: (update: McpProgressUpdate) => void): void {
    this.armed.set(token, onUpdate);
  }
  /** Retire a token when its call settles or its connection closes. */
  settle(token: string | undefined): void {
    if (token !== undefined) this.armed.delete(token);
  }
  /** Deliver a notification to its call; false when no open call owns the token. */
  dispatch(params: unknown): boolean {
    const update = mcpProgressUpdate(params);
    if (update === undefined) return false;
    const handler = this.armed.get(update.token);
    if (handler === undefined) return false;
    try { handler(update); } catch { /* the owning call owns its errors */ }
    return true;
  }
  get size(): number { return this.armed.size; }
}
