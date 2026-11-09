// Parent-owned async command hooks. Reuse runHooks once per job so stdin,
// process-group teardown and output interpretation stay identical to sync hooks.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from 'zod';
import { redactCredentialShapes } from "./credential-shapes.js";
import { asyncHookAttachment, type AsyncHookAttachment } from './async-hook-response.js';
import { HOOK_EVENTS, claimOwnedHookCommand, hookDefinitionSchema, interpretRawCommand, runConfiguredHookCommand, syncOutputAfterHeader, type AsyncHookRequest,
  type CommandHookExecution, type HookEvent, type HookPayload, type HookResult, type HookCommandHandle } from "./hooks.js";

const MAX_ACTIVE = 16;
const MAX_HISTORY = 100;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;
const CALLBACK_GRACE_MS = 200;

const asyncHookObserverSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('completion') }).strict(),
  z.object({ kind: z.literal('terminal'), index: z.number().int().nonnegative() }).strict()]);
export type AsyncHookObserver = (observer: z.infer<typeof asyncHookObserverSchema>, invoke: () => void | Promise<void>) => Promise<void>;
const observerKey = (observer: z.infer<typeof asyncHookObserverSchema>) => observer.kind === 'completion' ? 'completion' : `terminal:${observer.index}`;

export const asyncHookLifecycleSchema = z.object({
  kind: z.literal('async_hook_lifecycle'), owner: z.string().uuid(), generation: z.string().uuid(), jobId: z.string().uuid(),
  event: z.enum(HOOK_EVENTS), startedAt: z.number().finite(),
  transition: z.discriminatedUnion('phase', [
    z.object({ phase: z.literal('admitted'), mode: z.enum(['configured', 'adopted']) }).strict(),
    z.object({ phase: z.literal('completed'), state: z.enum(['completed', 'blocked', 'failed', 'cancelled', 'timed_out']) }).strict(),
    z.object({ phase: z.literal('callback'), state: z.enum(['pending', 'returned', 'threw']) }).strict(),
    z.object({ phase: z.literal('observer'), id: z.string().uuid(), observer: asyncHookObserverSchema,
      state: z.enum(['pending', 'returned', 'threw']) }).strict(),
  ]),
}).strict();
export type AsyncHookLifecycleEvent = z.infer<typeof asyncHookLifecycleSchema>;
/** Cold records describe observed transitions; incomplete tails remain unknown. */
export function validateAsyncHookLifecycles(events: readonly AsyncHookLifecycleEvent[], owner: string): void {
  const jobs = new Map<string, { initial: AsyncHookLifecycleEvent; phase: 'admitted' | 'completed' | 'pending' | 'settled';
    observers: Map<string, { key: string; settled: boolean }>; observerKeys: Set<string> }>();
  for (const event of events) {
    if (event.owner !== owner) throw new Error('Async hook lifecycle owner mismatch');
    const previous = jobs.get(event.jobId), transition = event.transition;
    if (transition.phase === 'admitted') {
      if (previous) throw new Error('Duplicate async hook lifecycle admission');
      jobs.set(event.jobId, { initial: event, phase: 'admitted', observers: new Map(), observerKeys: new Set() });
      continue;
    }
    if (!previous || previous.initial.generation !== event.generation || previous.initial.event !== event.event ||
        previous.initial.startedAt !== event.startedAt) throw new Error('Async hook lifecycle identity mismatch');
    if (transition.phase === 'observer') {
      const key = observerKey(transition.observer), observer = previous.observers.get(transition.id);
      if (transition.state === 'pending') {
        if (previous.phase !== 'pending' || observer || previous.observerKeys.has(key)) throw new Error('Async hook observer invocation order invalid');
        previous.observers.set(transition.id, { key, settled: false }); previous.observerKeys.add(key);
      } else {
        if (!observer || observer.settled || observer.key !== key) throw new Error('Async hook observer settlement identity invalid');
        observer.settled = true;
      }
    } else if (transition.phase === 'completed') {
      if (previous.phase !== 'admitted') throw new Error('Async hook lifecycle completion order invalid');
      previous.phase = 'completed';
    } else if (transition.state === 'pending') {
      if (previous.phase !== 'completed') throw new Error('Async hook lifecycle callback order invalid');
      previous.phase = 'pending';
    } else {
      if (previous.phase !== 'pending') throw new Error('Async hook lifecycle settlement order invalid');
      previous.phase = 'settled';
    }
  }
}
type JournalOwner = { readonly id: string; readonly isOpen: boolean; readonly isJournalFenced: boolean;
  recordAsyncHookLifecycle(authorization: object): void };
const lifecycleGrants = new WeakMap<object, { owner: JournalOwner; event: AsyncHookLifecycleEvent }>();

/** Only registry transitions mint these one-use, exact-Session capabilities. */
export function consumeAsyncHookLifecycle(authorization: object, owner: JournalOwner): AsyncHookLifecycleEvent {
  const grant = lifecycleGrants.get(authorization);
  lifecycleGrants.delete(authorization);
  if (!grant || grant.owner !== owner || !owner.isOpen || owner.isJournalFenced)
    throw new Error('Async hook lifecycle authorization invalid');
  return structuredClone(grant.event);
}

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
  commandScope: string;
  result: HookResult;
  state: Exclude<AsyncHookState, "running">;
  started_at: number;
  completed_at: number;
  /** Present only when this job's definition set asyncRewake and it exited 2. */
  rewake?: AsyncHookRewake;
  delivery: { kind: 'none' } | { kind: 'attachment'; attachment: AsyncHookAttachment } | { kind: 'rewake'; wake: AsyncHookRewake } | { kind: 'unavailable' };
};
export type AsyncHookDescriptor = {
  id: string;
  event: HookEvent;
  started_at: number;
} & ({ state: 'running' } | {
  state: Exclude<AsyncHookState, 'running'>;
  completed_at: number;
  callbackState: 'none' | 'pending' | 'returned' | 'threw';
});
export type AsyncHookRegistryOptions = {
  workspace: string;
  journalOwner?: JournalOwner;
  signal?: AbortSignal;
  onResult?: (completion: AsyncHookCompletion, observe: AsyncHookObserver) => void | Promise<void>;
};
type Job = {
  pluginId?: string;
  commandScope: string;
  descriptor: AsyncHookDescriptor;
  controller: AbortController;
  done: Promise<AsyncHookCompletion>;
  settled: boolean;
  /** Owned process teardown for an adopted foreground handle. */
  kill?: () => void;
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
// Host ownership adapter for _yn's command/plugin boundary: explicit hook HOME must not share dedup history.
// This key is delivery metadata, not a claimed source plugin ID or effect attestation.
function commandScope(home: AsyncHookRequest['commandHome']): string {
  return crypto.createHash('sha256').update(JSON.stringify(home === undefined ? { inherited: true } : { home: home.value ?? null })).digest('hex');
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
  private readonly journalOwner?: JournalOwner;
  private readonly generation = crypto.randomUUID();
  private journalError: unknown;
  private journalRetired = false;
  private readonly onAbort = (): void => { void this.close().catch(() => {}); };

  constructor(options: AsyncHookRegistryOptions) {
    this.workspace = fs.realpathSync(path.resolve(options.workspace));
    if (!fs.statSync(this.workspace).isDirectory()) throw new Error("Async hook workspace must be a directory.");
    this.onResult = options.onResult;
    this.journalOwner = options.journalOwner;
    this.signal = options.signal;
    this.closed = options.signal?.aborted ?? false;
    options.signal?.addEventListener("abort", this.onAbort, { once: true });
  }

  // Host S3 rewrite: m5e/gc/WLe/CXo, chunk-sfn1dbxq.js UTF-16
  // [2955889,2958184)/[621218,621853)/[626248,626520)/[630237,630565).
  // Record against the captured Session, independently of notification routing.
  private record(job: Job, transition: AsyncHookLifecycleEvent['transition']): void {
    const owner = this.journalOwner;
    if (!owner) return;
    if (this.journalRetired || !owner.isOpen || owner.isJournalFenced) throw new Error('Async hook journal owner retired or fenced');
    const authorization = {};
    lifecycleGrants.set(authorization, { owner, event: { kind: 'async_hook_lifecycle', owner: owner.id,
      generation: this.generation, jobId: job.descriptor.id, event: job.descriptor.event, startedAt: job.descriptor.started_at, transition } });
    try { owner.recordAsyncHookLifecycle(authorization); }
    finally { lifecycleGrants.delete(authorization); }
  }

  private checkOwner(request: AsyncHookRequest): void {
    if (this.journalOwner && (!this.journalOwner.isOpen || this.journalOwner.isJournalFenced || request.payload.session_id !== this.journalOwner.id))
      throw new Error('Async hook request owner mismatch or retired');
  }

  // gc/WLe/CXo source ranges above publish synchronously. Host nested observers
  // use the same captured job writer; outer return never implies their settlement.
  private observerFor(job: Job, active: () => boolean, terminalCount: number): AsyncHookObserver {
    const invoked = new Set<string>();
    return async (input, invoke) => {
      if (!active() || this.journalRetired || this.journalOwner && (!this.journalOwner.isOpen || this.journalOwner.isJournalFenced))
        throw new Error('Async hook observer owner retired');
      const observer = asyncHookObserverSchema.parse(input), key = observerKey(observer);
      if (invoked.has(key) || observer.kind === 'terminal' && observer.index >= terminalCount)
        throw new Error('Async hook observer invocation invalid');
      invoked.add(key);
      const id = crypto.randomUUID();
      try { this.record(job, { phase: 'observer', id, observer, state: 'pending' }); }
      catch (error) { this.journalError ??= error; return; }
      let state: 'returned' | 'threw' = 'returned';
      try { await invoke(); } catch { state = 'threw'; }
      if (this.journalRetired || this.journalOwner && !this.journalOwner.isOpen) return;
      try { this.record(job, { phase: 'observer', id, observer, state }); }
      catch (error) { this.journalError ??= error; }
    };
  }

  /** Arrow binding can be passed directly as HookRunOptions.startAsyncCommand. */
  readonly start = async (request: AsyncHookRequest): Promise<string> => {
    this.checkOwner(request);
    if (request.signal.aborted || this.signal?.aborted) throw abortError();
    if (this.closed) throw new Error("Async hook registry is closed.");
    if ([...this.jobs.values()].filter(job => !job.settled).length >= MAX_ACTIVE) throw new Error("Async hook active-job limit exceeded (16).");
    if (!HOOK_EVENTS.includes(request.event)) throw new Error("Invalid async hook event.");
    const definition = hookDefinitionSchema.parse(request.definition);
    if (!("command" in definition)) throw new Error("Async hook registry accepts command definitions only.");
    if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) throw new Error("Async hook deadline must be positive.");
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
    const home = request.commandHome === undefined ? undefined : { value: request.commandHome.value };
    // The source resolves one deadline and uses it on both sides: the foreground
    // run takes `js=uo.timeout?uo.timeout*1000:b` (chunk-sfn1dbxq.js offset
    // 3021682) and the async record is registered with the same expression
    // (`asyncTimeout:e.timeout?e.timeout*1000:lu`, offset 2970018), where `b` is
    // the caller's deadline and `lu` is 600000 (offset 2915815).
    const controller = new AbortController();
    const id = crypto.randomUUID();
    const descriptor: AsyncHookDescriptor = { id, event: request.event, state: "running", started_at: Date.now() };
    let complete!: (value: AsyncHookCompletion) => void;
    const done = new Promise<AsyncHookCompletion>(resolve => { complete = resolve; });
    const job: Job = { descriptor, controller, done, settled: false, commandScope: commandScope(home), pluginId: request.pluginId };
    this.record(job, { phase: 'admitted', mode: 'configured' });
    this.jobs.set(id, job);
    // The caller's per-call signal is intentionally detached after ownership.
    // asyncRewake implies async; the forwarded run must not re-enter the registry.
    const wakeFields = "asyncRewake" in definition ? definition : undefined;
    const wake = wakeFields?.asyncRewake === true
      ? { definition: { command: wakeFields.command,
          ...(wakeFields.rewakeMessage !== undefined ? { rewakeMessage: wakeFields.rewakeMessage } : {}),
          ...(wakeFields.rewakeSummary !== undefined ? { rewakeSummary: wakeFields.rewakeSummary } : {}) } }
      : undefined;
    let execution: CommandHookExecution | undefined;
    let handle: HookCommandHandle | undefined;
    void runConfiguredHookCommand(request, controller.signal, {
      onCommandResult: raw => { execution = raw; },
      onCommandHandle: value => { handle = value; },
      commandHome: () => home,
      // This run already owns the process; a header line is ordinary output for
      // `gbt` to skip, not a second handoff (`UF` `_e` forceSync path).
      adoptAsyncHeaders: false,
      stripAsyncHeader: true,
    }, this.journalOwner ? { jobId: id, generation: this.generation } : undefined).then(
      result => this.finish(job, result, correlation, complete, undefined, wake ? { definition: wake.definition, raw: execution } : undefined, execution),
      () => this.finish(job, { blocked: false, additionalContext: ["[async hook: execution failed]"] }, correlation, complete, "failed"),
    );
    return id;
  };

  /**
   * Source `m5e` normal path: the foreground run detected the first-line async
   * header and hands its live handle here. The per-call signal is detached on
   * success; the registry owns the process until it exits. A rejected
   * registration leaves the foreground run owning the process.
   */
  readonly adopt = async (request: AsyncHookRequest, handle: HookCommandHandle, taskId: string): Promise<string> => {
    this.checkOwner(request);
    if (request.signal.aborted || this.signal?.aborted) throw abortError();
    if (this.closed) throw new Error("Async hook registry is closed.");
    if ([...this.jobs.values()].filter(job => !job.settled).length >= MAX_ACTIVE) throw new Error("Async hook active-job limit exceeded (16).");
    if (!HOOK_EVENTS.includes(request.event)) throw new Error("Invalid async hook event.");
    const definition = hookDefinitionSchema.parse(request.definition);
    if (!("command" in definition)) throw new Error("Async hook registry accepts command definitions only.");
    if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) throw new Error("Async hook deadline must be positive.");
    if (Buffer.byteLength(request.input) > MAX_INPUT_BYTES) throw new Error("Async hook input exceeds byte cap.");
    const payload = JSON.parse(request.input) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.hook_event_name !== request.event ||
        request.input !== `${JSON.stringify({ ...request.payload, hook_event_name: request.event })}\n`) {
      throw new Error("Async hook stdin must match the original newline-terminated event payload.");
    }
    const requestedCwd = fs.realpathSync(path.resolve(request.cwd));
    const payloadCwd = typeof request.payload.cwd === "string" && request.payload.cwd ? request.payload.cwd : process.cwd();
    if (fs.realpathSync(path.resolve(payloadCwd)) !== requestedCwd) throw new Error("Async hook cwd conflicts with original payload.");
    if (requestedCwd !== this.workspace && !requestedCwd.startsWith(this.workspace + path.sep)) throw new Error("Async hook cwd leaves registry workspace.");
    const forwarded = structuredClone(request.payload);
    const correlation = minimalPayload(forwarded);
    const { event, timeoutMs } = request;
    const home = request.commandHome === undefined ? undefined : { value: request.commandHome.value };
    const command = claimOwnedHookCommand(handle, { command: definition.command, cwd: request.cwd, timeoutMs,
      input: request.input, signal: request.signal, commandHome: home, pluginId: request.pluginId }, taskId);
    if (!command) throw new Error("Async hook adoption requires the original live command and request.");
    const controller = new AbortController();
    const id = crypto.randomUUID();
    const descriptor: AsyncHookDescriptor = { id, event: request.event, state: "running", started_at: Date.now() };
    let complete!: (value: AsyncHookCompletion) => void;
    const done = new Promise<AsyncHookCompletion>(resolve => { complete = resolve; });
    const job: Job = { descriptor, controller, done, settled: false, kill: command.kill, commandScope: commandScope(home), pluginId: request.pluginId };
    // UF/m5e retain foreground ownership on rejected transfer. Our durable
    // admission/link must succeed before detaching that deadline and signal.
    try {
      this.record(job, { phase: 'admitted', mode: 'adopted' });
      if (this.journalOwner) command.associateJob?.({ jobId: id, generation: this.generation });
    } catch (error) {
      command.restoreForeground();
      throw error;
    }
    command.detachForeground();
    this.jobs.set(id, job);
    // The header bytes were already read by the foreground run and stay part of
    // the final output. `gbt` (chunk-sfn1dbxq.js [622557,622798)) skips the
    // async header and takes the first joined tail or line object without an
    // `async` property, so the final sync payload is interpreted, not the header.
    void command.done.then(raw => {
      const result: HookResult = { blocked: false, additionalContext: [] };
      const output = syncOutputAfterHeader(raw);
      if (output) interpretRawCommand(event, definition, output, timeoutMs, result, []);
      this.finish(job, result, correlation, complete, undefined,
        "asyncRewake" in definition && definition.asyncRewake === true
          ? { definition: { command: definition.command,
              ...(definition.rewakeMessage !== undefined ? { rewakeMessage: definition.rewakeMessage } : {}),
              ...(definition.rewakeSummary !== undefined ? { rewakeSummary: definition.rewakeSummary } : {}) },
            raw: { command: definition.command, code: raw.code, stdout: raw.stdout, stderr: raw.stderr,
              timedOut: raw.timedOut, aborted: raw.aborted } }
          : undefined, { command: definition.command, code: raw.code, stdout: raw.stdout, stderr: raw.stderr,
            timedOut: raw.timedOut, aborted: raw.aborted }).catch(() => {});
    }, () => this.finish(job, { blocked: false, additionalContext: ["[async hook: execution failed]"] }, correlation, complete, "failed"));
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
    job.kill?.();
    return structuredClone(await job.done);
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.signal?.removeEventListener("abort", this.onAbort);
    const jobs = [...this.jobs.values()];
    for (const job of jobs) if (job.descriptor.state === "running") {
      job.controller.abort();
      job.kill?.();
    }
    this.closing = Promise.all(jobs.map(job => job.done)).then(() => {
      this.journalRetired = true;
      if (this.journalError) throw this.journalError;
    });
    return this.closing;
  }

  // Host promise observation over gc/WLe/CXo, sfn1dbxq [621218,621853)/[626248,626520)/[630237,630565), UTF-16.
  // The source publishes synchronously; this host retains its existing callback grace independently of actual settlement.
  private async finish(job: Job, raw: HookResult, payload: HookPayload, complete: (value: AsyncHookCompletion) => void,
    failed?: "failed", wake?: RewakeSource, execution?: CommandHookExecution): Promise<void> {
    const result = boundedResult(raw);
    const state = failed ?? terminalState(raw, job.controller.signal);
    const rewake = wake ? rewakeFor(wake) : undefined;
    const attachment = !wake && execution ? asyncHookAttachment(execution, { id: job.descriptor.id, event: job.descriptor.event,
      ...(job.pluginId === undefined ? {} : { pluginId: job.pluginId }),
      ...(typeof payload.tool_name === 'string' ? { toolName: payload.tool_name } : {}) }) : undefined;
    const delivery: AsyncHookCompletion['delivery'] = wake ? rewake ? { kind: 'rewake', wake: rewake } : { kind: 'none' }
      : !execution ? { kind: 'unavailable' } : attachment ? { kind: 'attachment', attachment } : { kind: 'none' };
    const completion: AsyncHookCompletion = { id: job.descriptor.id, event: job.descriptor.event, payload, result, state,
      commandScope: job.commandScope,
      started_at: job.descriptor.started_at, completed_at: Date.now(), delivery, ...(rewake ? { rewake } : {}) };
    const descriptor: AsyncHookDescriptor = { id: completion.id, event: completion.event, state,
      started_at: completion.started_at, completed_at: completion.completed_at, callbackState: this.onResult ? 'pending' : 'none' };
    job.descriptor = descriptor;
    let publish = true;
    try { this.record(job, { phase: 'completed', state }); }
    catch (error) { this.journalError ??= error; descriptor.callbackState = 'none'; publish = false; }
    if (this.onResult && publish) {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(async () => {
            try { this.record(job, { phase: 'callback', state: 'pending' }); }
            catch (error) { this.journalError ??= error; descriptor.callbackState = 'none'; return; }
            let callbackState: 'returned' | 'threw' = 'returned';
            let active = true;
            const observe = this.observerFor(job, () => active, completion.result.terminalSequences?.length ?? 0);
            try {
              const result = this.onResult!(structuredClone(completion), observe);
              if (result === undefined) active = false;
              else await result;
            } catch { callbackState = 'threw'; }
            finally { active = false; }
            descriptor.callbackState = callbackState;
            if (this.journalRetired || this.journalOwner && !this.journalOwner.isOpen) return;
            try { this.record(job, { phase: 'callback', state: callbackState }); }
            catch (error) { this.journalError ??= error; }
          }),
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
