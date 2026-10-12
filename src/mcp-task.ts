import { z } from "zod";

// Adapted from ojr [3621,7532) UTF-16, chunk-f79f00pg.js
// SHA-256 73d50b557ed49b7de0783b46a8f6804d5c45068cd92317c413d821948032b421.
// The host owns headers/deadlines; this module owns polling and bounded cleanup.
const MIN_POLL_MS = 250;
const MAX_POLL_MS = 30_000;
const DEFAULT_POLL_MS = 2_000;
const MAX_FAILURES = 5;
const MAX_INPUT_KEYS = 16;
const CANCEL_MS = 5_000;
const identifier = z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/);
const optionalText = z.string().nullish().transform((value) => value ?? undefined);
const optionalNumber = z.number().finite().nullish().transform((value) => value ?? undefined);
const taskSchema = z.object({
  taskId: identifier,
  status: z.enum(["working", "input_required", "completed", "failed", "cancelled"]),
  statusMessage: optionalText,
  createdAt: optionalText,
  lastUpdatedAt: optionalText,
  ttlMs: optionalNumber,
  pollIntervalMs: optionalNumber,
});
const handleSchema = taskSchema.extend({ resultType: z.literal("task") });
const inputSchema = z.object({
  method: identifier,
  params: z.record(z.unknown()).nullish().transform((value) => value ?? undefined),
});
const statusSchema = z.discriminatedUnion("status", [
  taskSchema.extend({ status: z.literal("working") }),
  taskSchema.extend({
    status: z.literal("input_required"),
    inputRequests: z.record(z.string().min(1).max(512), inputSchema).nullish().transform((value) => value ?? {}),
  }),
  taskSchema.extend({
    status: z.literal("completed"),
    result: z.record(z.unknown()).nullish().transform((value) => value ?? {}),
  }),
  taskSchema.extend({
    status: z.literal("failed"),
    error: z.object({ code: optionalNumber, message: optionalText, data: z.unknown().optional() })
      .nullish().transform((value) => value ?? {}),
  }),
  taskSchema.extend({ status: z.literal("cancelled") }),
]);

export type McpTaskHandle = z.infer<typeof handleSchema>;
export type McpTaskInputRequest = z.infer<typeof inputSchema>;
export type McpTaskErrorKind = "malformed" | "poll_failed" | "failed" | "cancelled" | "unsupported_input" | "input_unservable";

const messages: Record<McpTaskErrorKind, string> = {
  malformed: "Malformed MCP task response",
  poll_failed: "MCP task request failed",
  failed: "MCP task failed",
  cancelled: "MCP task cancelled",
  unsupported_input: "MCP task input is unsupported",
  input_unservable: "MCP task input callback failed",
};

export class McpTaskError extends Error {
  constructor(readonly kind: McpTaskErrorKind, readonly code?: number, readonly phase?: "update") {
    super(messages[kind]);
    this.name = "McpTaskError";
  }
}

export function parseTaskHandle(value: unknown): McpTaskHandle | undefined {
  if (typeof value !== "object" || value === null || !("resultType" in value) || value.resultType !== "task") return undefined;
  const parsed = handleSchema.safeParse(value);
  if (!parsed.success) throw new McpTaskError("malformed");
  return parsed.data;
}

function pollInterval(value: number | undefined): number {
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, value ?? DEFAULT_POLL_MS));
}

function rpcCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || error instanceof DOMException) return undefined;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"
    || error.message.startsWith("SSE error: ") || error.message.startsWith("Streamable HTTP error: "))) return undefined;
  if (!("code" in error) || typeof error.code !== "number" || !Number.isFinite(error.code)
    || !("message" in error) || typeof error.message !== "string") return undefined;
  return error.code;
}

function retryableCode(code: number): boolean {
  if (code === -32003) return false;
  return code === -32603 || code === -32700 || (code >= -32099 && code <= -32000);
}

export function waitForPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new McpTaskError("cancelled")); return; }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new McpTaskError("cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Race even noncooperative host promises, consume late rejection, and release listeners.
async function withSignal<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new McpTaskError("cancelled");
  let abort!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new McpTaskError("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => {
      if (signal.aborted) throw new McpTaskError("cancelled");
      return work();
    }), interrupted]);
  } finally { signal.removeEventListener("abort", abort); }
}

export async function driveMcpTask({ task, request, signal, resolveInputRequest }: {
  task: McpTaskHandle;
  request: (method: string, params: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  resolveInputRequest: (key: string, input: McpTaskInputRequest, signal: AbortSignal) => Promise<unknown>;
}): Promise<unknown> {
  const initial = parseTaskHandle(task);
  if (!initial) throw new McpTaskError("malformed");
  const { taskId } = initial;
  const answered = new Set<string>();
  const rejected = new Set<string>();
  const cachedAnswers = new Map<string, unknown>();
  const served = new Set<string>();
  let interval = pollInterval(initial.pollIntervalMs);
  let nextInterval: number | undefined;
  let pollFailures = 0;
  let updateFailures = 0;
  let first = true;
  let cleanupRequired = false;

  const cancel = async () => {
    const cleanupSignal = AbortSignal.timeout(CANCEL_MS);
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        withSignal(() => request("tasks/cancel", { taskId }, cleanupSignal), cleanupSignal).catch(() => undefined),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, CANCEL_MS); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  };
  const stop = (kind: McpTaskErrorKind): never => {
    cleanupRequired = true;
    throw new McpTaskError(kind);
  };

  try {
    for (;;) {
      if (first) first = false;
      else {
        const wait = nextInterval ?? interval;
        nextInterval = undefined;
        await waitForPoll(wait, signal);
      }
      if (signal.aborted) stop("cancelled");
      let response: unknown;
      try {
        response = await withSignal(() => request("tasks/get", { taskId }, signal), signal);
      } catch (error) {
        if (signal.aborted) stop("cancelled");
        const code = rpcCode(error);
        if (code !== undefined && !retryableCode(code)) throw new McpTaskError("poll_failed", code);
        if (++pollFailures >= MAX_FAILURES) throw new McpTaskError("poll_failed");
        continue;
      }
      const parsed = statusSchema.safeParse(response);
      if (!parsed.success || parsed.data.taskId !== taskId) return stop("malformed");
      const status = parsed.data;
      pollFailures = 0;
      interval = pollInterval(status.pollIntervalMs ?? interval);
      if (status.status !== "input_required") updateFailures = 0;
      switch (status.status) {
        case "working": continue;
        case "completed": return status.result;
        case "failed": throw new McpTaskError("failed", status.error.code);
        case "cancelled": throw new McpTaskError("cancelled");
        case "input_required": {
          const outstanding = Object.entries(status.inputRequests).filter(([key]) => !answered.has(key));
          if (outstanding.length === 0) continue;
          const pending = outstanding.filter(([key]) => !rejected.has(key));
          if (pending.length === 0) stop("unsupported_input");
          const inputs = pending.filter(([key]) => {
            if (served.has(key)) return true;
            if (served.size >= MAX_INPUT_KEYS) return false;
            served.add(key);
            return true;
          });
          if (inputs.length === 0) continue;
          const responses: Record<string, unknown> = Object.create(null);
          for (const [key, input] of inputs) {
            if (signal.aborted) stop("cancelled");
            if (input.method !== "roots/list" && input.method !== "elicitation/create") stop("unsupported_input");
            let answer: unknown;
            if (cachedAnswers.has(key)) answer = cachedAnswers.get(key);
            else {
              try {
                answer = await withSignal(() => resolveInputRequest(key, input, signal), signal);
              } catch {
                if (signal.aborted) stop("cancelled");
                stop("input_unservable");
              }
              if (answer === undefined) stop("unsupported_input");
              cachedAnswers.set(key, answer);
            }
            responses[key] = answer;
          }
          if (signal.aborted) stop("cancelled");
          try {
            await withSignal(() => request("tasks/update", { taskId, inputResponses: responses }, signal), signal);
            updateFailures = 0;
            for (const key of Object.keys(responses)) answered.add(key);
          } catch (error) {
            if (signal.aborted) stop("cancelled");
            const code = rpcCode(error);
            if (code === -32601 || code === -32003) throw new McpTaskError("poll_failed", code, "update");
            if (code !== undefined && !retryableCode(code)) {
              for (const key of Object.keys(responses)) rejected.add(key);
              nextInterval = MIN_POLL_MS;
              continue;
            }
            if (++updateFailures >= MAX_FAILURES) throw new McpTaskError("poll_failed", undefined, "update");
          }
          nextInterval = MIN_POLL_MS;
          continue;
        }
      }
    }
  } catch (error) {
    if (signal.aborted) {
      cleanupRequired = true;
      throw new McpTaskError("cancelled");
    }
    if (error instanceof McpTaskError) throw error;
    cleanupRequired = true;
    throw new McpTaskError("malformed");
  } finally {
    if (cleanupRequired) await cancel();
  }
}
