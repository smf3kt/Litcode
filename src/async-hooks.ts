// Parent-owned async command hooks. Reuse runHooks once per job so stdin,
// process-group teardown and output interpretation stay identical to sync hooks.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redactCredentialShapes } from "./credential-shapes.js";
import { HOOK_EVENTS, hookDefinitionSchema, runHooks, type AsyncHookRequest, type CommandHookExecution,
  type HookEvent, type HookPayload, type HookResult } from "./hooks.js";

const MAX_ACTIVE = 16;
const MAX_HISTORY = 100;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;
const CALLBACK_GRACE_MS = 200;

export type AsyncHookState = "running" | "completed" | "blocked" | "failed" | "cancelled" | "timed_out";
/** What an asyncRewake hook asks the host to deliver when its run exits 2
 *  (`m5e`, chunk-sfn1dbxq.js offset 2956018): a one-line summary and the body
 *  the model reads, whose default prefix is `Stop hook blocking error from
 *  command "…":` followed by stderr (else stdout). */
export type AsyncHookRewake = { summary: string; body: string };
export type AsyncHookCompletion = {
  id: string;
  event: HookEvent;
  /** Correlation metadata only; command, tool parameters and environment are omitted. */
  payload: HookPayload;
  result: HookResult;
  state: Exclude<AsyncHookState, "running">;
  started_at: number;
  completed_at: number;
  /** Present only when this job's definition set asyncRewake and it exited 2. */
  rewake?: AsyncHookRewake;
};
export type AsyncHookDescriptor = {
  id: string;
  event: HookEvent;
  state: AsyncHookState;
  started_at: number;
  completed_at?: number;
};
export type AsyncHookRegistryOptions = {
  workspace: string;
  signal?: AbortSignal;
  onResult?: (completion: AsyncHookCompletion) => void | Promise<void>;
};
type Job = {
  descriptor: AsyncHookDescriptor;
  controller: AbortController;
  done: Promise<AsyncHookCompletion>;
  settled: boolean;
};
function abortError(): Error {
  const error = new Error("Async hook cancelled before start.");
  error.name = "AbortError";
  return error;
}
function truncate(text: string, cap: number): string {
  const bytes = Buffer.from(text);
  let end = Math.min(bytes.length, cap);
  while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8");
}
function minimalPayload(payload: HookPayload): HookPayload {
  const output: HookPayload = {};
  for (const key of ["session_id", "tool_use_id", "tool_name", "agent_id", "agent_type", "task_id", "elicitation_id"] as const) {
    if (typeof payload[key] === "string") output[key] = truncate(payload[key], 256);
  }
  return output;
}
function boundedResult(result: HookResult): HookResult {
  if (Buffer.byteLength(JSON.stringify(result)) <= MAX_RESULT_BYTES) return structuredClone(result);
  const output: HookResult = {
    blocked: result.blocked,
    additionalContext: ["[async hook: completion output truncated at 65536 bytes]"],
    ...(result.stopRequested !== undefined ? { stopRequested: result.stopRequested } : {}),
    ...(result.reason ? { reason: truncate(result.reason, 8192) } : {}),
    ...(result.permissionDecision ? { permissionDecision: result.permissionDecision } : {}),
    ...(result.suppressOutput !== undefined ? { suppressOutput: result.suppressOutput } : {}),
  };
  for (const text of result.additionalContext) {
    const room = MAX_RESULT_BYTES - Buffer.byteLength(JSON.stringify(output)) - 16;
    if (room <= 0) break;
    // JSON escaping can expand text sixfold; charge the serialized string.
    let kept = truncate(text, room);
    while (kept && Buffer.byteLength(JSON.stringify(kept)) > room) kept = truncate(kept, Math.floor(Buffer.byteLength(kept) / 2));
    if (kept) output.additionalContext.push(kept);
  }
  return output;
}
function terminalState(result: HookResult, signal: AbortSignal): Exclude<AsyncHookState, "running"> {
  if (signal.aborted || result.additionalContext.some(text => text.includes("hook: aborted") || text.includes("cancelled before start"))) return "cancelled";
  if (result.additionalContext.some(text => text.includes("hook: timed out"))) return "timed_out";
  if (result.blocked) return "blocked";
  if (result.additionalContext.some(text => text.includes("hook: exit code") || text.includes("failed to launch") || text.includes("invalid definition"))) return "failed";
  return "completed";
}
type RewakeDefinition = { command: string; rewakeMessage?: string; rewakeSummary?: string };
type RewakeSource = { definition: RewakeDefinition; raw?: CommandHookExecution };
/** `UT` over `Ait` (chunk-sfn1dbxq.js offset 632948, `Ait` in chunk-hwpb27as.js):
 *  hook output must not open or close the reminder channel that carries it. */
function escapeReminderText(text: string): string {
  return text.replace(/<(?=\s*(?:\/\s*)?system-reminder\b)/gi, "&lt;").replace(/<(?=\s*(?:\/\s*)?$)/, "&lt;");
}
/** The wake `m5e` queues for an exit-2 asyncRewake run: the configured prefix
 *  followed by stderr (else stdout), and the configured summary. */
function rewakeFor(source: RewakeSource): AsyncHookRewake | undefined {
  const raw = source.raw;
  if (!raw || raw.code !== 2 || raw.timedOut || raw.aborted) return undefined;
  const prefix = source.definition.rewakeMessage ?? `Stop hook blocking error from command "${source.definition.command}":`;
  return {
    summary: redactCredentialShapes(source.definition.rewakeSummary ?? "Stop hook feedback"),
    body: redactCredentialShapes(escapeReminderText(`${prefix} ${raw.stderr || raw.stdout}`)),
  };
}

export class AsyncHookRegistry {
  readonly workspace: string;
  private readonly jobs = new Map<string, Job>();
  private readonly onResult?: AsyncHookRegistryOptions["onResult"];
  private readonly signal?: AbortSignal;
  private closed = false;
  private closing?: Promise<void>;
  private readonly onAbort = (): void => { void this.close(); };

  constructor(options: AsyncHookRegistryOptions) {
    this.workspace = fs.realpathSync(path.resolve(options.workspace));
    if (!fs.statSync(this.workspace).isDirectory()) throw new Error("Async hook workspace must be a directory.");
    this.onResult = options.onResult;
    this.signal = options.signal;
    this.closed = options.signal?.aborted ?? false;
    options.signal?.addEventListener("abort", this.onAbort, { once: true });
  }

  /** Arrow binding can be passed directly as HookRunOptions.startAsyncCommand. */
  readonly start = async (request: AsyncHookRequest): Promise<string> => {
    if (request.signal.aborted || this.signal?.aborted) throw abortError();
    if (this.closed) throw new Error("Async hook registry is closed.");
    if ([...this.jobs.values()].filter(job => !job.settled).length >= MAX_ACTIVE) throw new Error("Async hook active-job limit exceeded (16).");
    if (!HOOK_EVENTS.includes(request.event)) throw new Error("Invalid async hook event.");
    const definition = hookDefinitionSchema.parse(request.definition);
    if (!("command" in definition)) throw new Error("Async hook registry accepts command definitions only.");
    if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0 || request.timeoutMs > 3600_000) throw new Error("Async hook deadline must be positive and at most one hour.");
    if (Buffer.byteLength(request.input) > MAX_INPUT_BYTES) throw new Error("Async hook input exceeds byte cap.");
    const payload = JSON.parse(request.input) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.hook_event_name !== request.event || request.input !== `${JSON.stringify({ ...request.payload, hook_event_name: request.event })}\n`) throw new Error("Async hook stdin must match the original newline-terminated event payload.");
    // runHooks selects cwd from payload or process.cwd; validate instead of
    // silently changing the original stdin record while forwarding cwd.
    const requestedCwd = fs.realpathSync(path.resolve(request.cwd));
    const payloadCwd = typeof request.payload.cwd === "string" && request.payload.cwd ? request.payload.cwd : process.cwd();
    if (fs.realpathSync(path.resolve(payloadCwd)) !== requestedCwd) throw new Error("Async hook cwd conflicts with original payload.");
    if (requestedCwd !== this.workspace && !requestedCwd.startsWith(this.workspace + path.sep)) throw new Error("Async hook cwd leaves registry workspace.");
    if (!fs.statSync(requestedCwd).isDirectory()) throw new Error("Async hook cwd must be a directory.");
    const forwarded = structuredClone(request.payload);
    const correlation = minimalPayload(forwarded);
    const timeout = Math.min(request.timeoutMs, (definition.timeout ?? 60) * 1000) / 1000;
    const controller = new AbortController();
    const id = crypto.randomUUID();
    const descriptor: AsyncHookDescriptor = { id, event: request.event, state: "running", started_at: Date.now() };
    let complete!: (value: AsyncHookCompletion) => void;
    const done = new Promise<AsyncHookCompletion>(resolve => { complete = resolve; });
    const job: Job = { descriptor, controller, done, settled: false };
    this.jobs.set(id, job);
    // The caller's per-call signal is intentionally detached after ownership.
    // asyncRewake implies async; the forwarded run must not re-enter the registry.
    const { asyncRewake: _asyncRewake, ...foreground } = definition as typeof definition & { asyncRewake?: boolean };
    const config = { [request.event]: [{ ...foreground, async: false, timeout }] };
    const wakeFields = "asyncRewake" in definition ? definition : undefined;
    const wake = wakeFields?.asyncRewake === true
      ? { definition: { command: wakeFields.command,
          ...(wakeFields.rewakeMessage !== undefined ? { rewakeMessage: wakeFields.rewakeMessage } : {}),
          ...(wakeFields.rewakeSummary !== undefined ? { rewakeSummary: wakeFields.rewakeSummary } : {}) } }
      : undefined;
    let execution: CommandHookExecution | undefined;
    void runHooks(config, request.event, forwarded, controller.signal, {
      onCommandResult: raw => { execution = raw; },
    }).then(
      result => this.finish(job, result, correlation, complete, undefined, wake ? { definition: wake.definition, raw: execution } : undefined),
      () => this.finish(job, { blocked: false, additionalContext: ["[async hook: execution failed]"] }, correlation, complete, "failed"),
    );
    return id;
  };

  get(id: string): AsyncHookDescriptor | undefined {
    const job = this.jobs.get(id);
    return job ? { ...job.descriptor } : undefined;
  }
  list(): AsyncHookDescriptor[] { return [...this.jobs.values()].map(job => ({ ...job.descriptor })); }
  async wait(id: string): Promise<AsyncHookCompletion> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown async hook job: ${id}`);
    return structuredClone(await job.done);
  }
  async stop(id: string): Promise<AsyncHookCompletion> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown async hook job: ${id}`);
    job.controller.abort();
    return structuredClone(await job.done);
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.signal?.removeEventListener("abort", this.onAbort);
    const jobs = [...this.jobs.values()];
    for (const job of jobs) if (job.descriptor.state === "running") job.controller.abort();
    this.closing = Promise.all(jobs.map(job => job.done)).then(() => {});
    return this.closing;
  }

  private async finish(job: Job, raw: HookResult, payload: HookPayload, complete: (value: AsyncHookCompletion) => void,
    failed?: "failed", wake?: RewakeSource): Promise<void> {
    const result = boundedResult(raw);
    const state = failed ?? terminalState(raw, job.controller.signal);
    const rewake = wake ? rewakeFor(wake) : undefined;
    const completion: AsyncHookCompletion = { id: job.descriptor.id, event: job.descriptor.event, payload, result, state,
      started_at: job.descriptor.started_at, completed_at: Date.now(), ...(rewake ? { rewake } : {}) };
    job.descriptor.state = state;
    job.descriptor.completed_at = completion.completed_at;
    if (this.onResult) {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(() => this.onResult!(structuredClone(completion))).catch(() => {}),
          new Promise<void>(resolve => { timer = setTimeout(resolve, CALLBACK_GRACE_MS); }),
        ]);
      } finally { if (timer) clearTimeout(timer); }
    }
    job.settled = true;
    complete(completion);
    const finished = [...this.jobs.values()].filter(entry => entry.settled);
    for (const entry of finished.slice(0, Math.max(0, finished.length - MAX_HISTORY))) this.jobs.delete(entry.descriptor.id);
  }
}
