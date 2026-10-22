// Independent in-memory background-job registry.
//
// This module owns ephemeral shell and WebSocket jobs for the personal harness.
// It is deliberately separate from `tasks.ts`: the durable task tools operate on
// `<workspace>/.agent/tasks.json` (persistent CRUD that survives a reopen),
// whereas this registry only tracks *running jobs* held in memory for the
// lifetime of one registry object. Configured commands are
// ordinary child processes spawned from the workspace.
//
// Guarantees:
//   - A shell job runs in its own process group. On timeout, explicit `task_stop`,
//     registry-signal abort or `close()`, that group is killed (descendants that
//     create another group are outside its lifetime), and pipes are drained
//     under a bounded grace window so a descendant holding a pipe open cannot
//     hang completion.
//   - stdout/stderr are retained as bounded tails (the last `maxOutputBytes`
//     bytes) alongside total byte counts and a truncation flag; tail decoding
//     never emits U+FFFD from a byte cut.
//   - Monitor stdout lines become bounded notification events. Every buffer that
//     could otherwise grow without limit is capped and reports what it dropped:
//       * the newline-free pending line is capped (`maxPendingLineBytes`) and an
//         over-long pending chunk is emitted with a truncation marker;
//       * per-event lines are capped by count and a rate guard coalesces bursts;
//       * the queue is capped by both event count and total bytes, and evictions
//         are surfaced as a `dropped` count.
//     shell stderr is never turned into notifications; it stays a readable tail.
//   - WebSocket messages preserve event boundaries, including embedded newlines.
//     Tails add a newline after each message. Errors and close details are events;
//     cancellation terminates connections even while the handshake is pending.
//   - The jobs map keeps a bounded history of finished jobs and never evicts a
//     running job; a concurrency cap bounds simultaneously running jobs.

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import WebSocket, { type RawData } from "ws";
import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./tools.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_DEFAULT_DEADLINE_MS = 120_000;
const MONITOR_DEFAULT_DEADLINE_MS = 300_000;
const MAX_DEADLINE_MS = 30 * 60 * 1000; // 30 minutes
const GET_WAIT_DEFAULT_MS = 0;
const GET_WAIT_MAX_MS = 30_000;
const DEFAULT_NOTIFICATION_LIMIT = 100;
const MAX_NOTIFICATION_LIMIT = 1000;
const BATCH_MAX_LINES = 64;
const MAX_LINES_PER_EVENT = 64;
const MAX_EVENTS = 2000;
const MAX_EVENT_BYTES = 512 * 1024;
const MAX_PENDING_LINE_BYTES = 4096;
const MAX_FINISHED_JOBS = 100;
const MAX_RUNNING_JOBS = 16;
const RATE_WINDOW_MS = 100;
const RATE_MAX_EVENTS = 200;
const PIPE_GRACE_MS = 200;
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;
const LINE_TRUNCATION_MARKER = " [monitor: line truncated]";
const WS_MAX_PAYLOAD_BYTES = 1024 * 1024;
const WS_MAX_EVENT_BYTES = 4096;
const WS_HANDSHAKE_TIMEOUT_MS = 10_000;
const WS_PROTOCOL_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export type WebSocketMonitor = { url: string; protocols?: string[] };

function validateWebSocket(input: WebSocketMonitor): WebSocketMonitor {
  if (!/^[\x21-\x7e]+$/.test(input.url)) {
    throw new Error("monitor: WebSocket URL must use printable ASCII without whitespace or controls");
  }
  const url = new URL(input.url);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("monitor: WebSocket URL must use ws: or wss:");
  }
  const authority = input.url.match(/^[^:]+:\/\/([^/?#]*)/)?.[1];
  if (url.username || url.password || authority?.includes("@") || input.url.includes("#")) {
    throw new Error("monitor: WebSocket URL must omit credentials and fragments");
  }
  const protocols = input.protocols;
  if (protocols && (
    protocols.some((protocol) => !WS_PROTOCOL_PATTERN.test(protocol)) ||
    new Set(protocols).size !== protocols.length
  )) {
    throw new Error("monitor: WebSocket protocols must be unique nonempty HTTP tokens");
  }
  return { url: url.href, ...(protocols ? { protocols: [...protocols] } : {}) };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export type BackgroundState = "running" | "completed" | "failed" | "cancelled" | "timed_out";
export type BackgroundKind = "run" | "monitor";
export type StreamName = "stdout" | "stderr";

function abortError(): Error {
  const error = new Error("operation aborted before it started");
  error.name = "AbortError";
  return error;
}

/** Resolve a workspace to its canonical real path; this is the closure identity. */
function canonicalWorkspace(workspace: string): string {
  const resolved = path.resolve(workspace);
  try {
    return fs.realpathSync(resolved);
  } catch {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
}

/** Largest prefix length <= maxBytes that ends on a UTF-8 code point boundary. */
function utf8PrefixEnd(buf: Buffer, maxBytes: number): number {
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return end;
}

/** Drop a trailing incomplete UTF-8 sequence so decoding cannot emit U+FFFD. */
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
  else return buf; // invalid lead byte: leave the bytes untouched
  if (buf.length - (index - 1) >= expected) return buf;
  return buf.subarray(0, index - 1);
}

/** Decode a bounded tail without a leading or trailing partial code point. */
function decodeTail(buf: Buffer): string {
  let start = 0;
  while (start < buf.length && (buf[start]! & 0xc0) === 0x80) start += 1;
  return trimIncompleteTail(buf.subarray(start)).toString("utf8");
}

/** UTF-8-safe head truncation so a byte cut never emits U+FFFD. */
function capOutput(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return `${buf.subarray(0, end).toString("utf8")}\n[background: output truncated; ${
    buf.length - end
  } more bytes omitted]`;
}

function outputLimit(context: ToolContext): number {
  const value = Math.floor(context.maxOutputBytes);
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_MAX_OUTPUT_BYTES;
}

function positiveInt(value: number | undefined, fallback: number): number {
  const num = Math.floor(value ?? fallback);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/** Validate a job deadline: finite, positive and within the maximum window. */
function validateDeadline(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_DEADLINE_MS) {
    throw new Error(
      `background: deadline must be a finite positive number <= ${MAX_DEADLINE_MS}ms`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export type BackgroundJobDescriptor = {
  id: string;
  kind: BackgroundKind;
  state: BackgroundState;
  pid: number | undefined;
  command: string;
  description: string;
  started_at: number;
  deadline_ms: number;
  source?: "websocket";
  ws?: WebSocketMonitor;
};

export type BackgroundJobView = {
  id: string;
  kind: BackgroundKind;
  state: BackgroundState;
  pid: number | null;
  command: string;
  description: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number;
  exit_code: number | null;
  exit_signal: string | null;
  error: string | null;
  stdout: string;
  stderr: string;
  stdout_bytes: number;
  stderr_bytes: number;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  truncated_lines: number;
  source?: "websocket";
  ws?: WebSocketMonitor;
  close_code?: number;
  close_reason?: string;
};

export type BackgroundEvent = {
  seq: number;
  job_id: string;
  kind: "line" | "exit";
  at: number;
  stream?: StreamName;
  lines: string[];
  text: string;
  state?: BackgroundState;
  exit_code?: number | null;
  exit_signal?: string | null;
  source?: "websocket";
  close_code?: number;
  close_reason?: string;
  truncated?: true;
  original_bytes?: number;
};

export type BackgroundRegistryOptions = {
  workspace: string;
  signal?: AbortSignal;
  /** Per-stream tail byte cap (default 100_000). */
  maxOutputBytes?: number;
  /** Max queued notification events (default 2000). */
  maxEvents?: number;
  /** Max total queued notification bytes (default 512 KiB). */
  maxEventBytes?: number;
  /** Max finished jobs retained in memory (default 100). */
  maxFinishedJobs?: number;
  /** Max simultaneously running jobs (default 16). */
  maxRunningJobs?: number;
  /**
   * Optional wake hook called for each newly queued notification event. It is
   * called synchronously and any throw it makes is contained so a callback can
   * never break a job.
   */
  onNotification?: (event: BackgroundEvent) => void;
};

// ---------------------------------------------------------------------------
// Internal job model
// ---------------------------------------------------------------------------

type StopReason = "user" | "timeout" | "abort" | null;

type Waiter = {
  timer: NodeJS.Timeout;
  resolve: (view: BackgroundJobView) => void;
  signal: AbortSignal;
  onAbort: () => void;
};

type Job = {
  id: string;
  kind: BackgroundKind;
  command: string;
  description: string;
  state: BackgroundState;
  pid: number | undefined;
  startedAt: number;
  endedAt: number | undefined;
  exitCode: number | null;
  exitSignal: NodeJS.Signals | null;
  spawnError: string | undefined;
  stopReason: StopReason;
  child: ChildProcess | undefined;
  ws?: WebSocketMonitor;
  socket?: WebSocket;
  deadlineAt?: number;
  closeCode?: number;
  closeReason?: string;
  frameTimes?: number[];
  outTail: Buffer;
  errTail: Buffer;
  outBytes: number;
  errBytes: number;
  outTruncated: boolean;
  errTruncated: boolean;
  timer: NodeJS.Timeout | undefined;
  grace: NodeJS.Timeout | undefined;
  groupKilled: boolean;
  reaped: boolean;
  /** stdout line decoder (monitor only); stderr is never parsed into events. */
  decoder: StringDecoder | undefined;
  /** Newline-free stdout remainder, capped at `maxPendingLineBytes`. */
  pending: string;
  truncatedLines: number;
  waiters: Waiter[];
  settled: Promise<void>;
  resolveSettled: () => void;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class BackgroundRegistry {
  private readonly workspace: string;
  private readonly signal: AbortSignal;
  private readonly maxOutputBytes: number;
  private readonly maxEvents: number;
  private readonly maxEventBytes: number;
  private readonly maxFinishedJobs: number;
  private readonly maxRunningJobs: number;
  private readonly maxPendingLineBytes: number;
  private readonly onNotification: ((event: BackgroundEvent) => void) | undefined;
  private readonly jobs = new Map<string, Job>();
  private readonly onAbort: () => void;

  private events: BackgroundEvent[] = [];
  private eventBytes = 0;
  private seq = 0;
  private dropped = 0;
  private rateWindowStart = 0;
  private rateWindowCount = 0;

  private closed = false;
  private closing: Promise<void> | null = null;

  constructor(options: BackgroundRegistryOptions) {
    this.workspace = canonicalWorkspace(options.workspace);
    this.signal = options.signal ?? new AbortController().signal;
    this.maxOutputBytes = positiveInt(options.maxOutputBytes, FALLBACK_MAX_OUTPUT_BYTES);
    this.maxEvents = positiveInt(options.maxEvents, MAX_EVENTS);
    this.maxEventBytes = positiveInt(options.maxEventBytes, MAX_EVENT_BYTES);
    this.maxFinishedJobs = positiveInt(options.maxFinishedJobs, MAX_FINISHED_JOBS);
    this.maxRunningJobs = positiveInt(options.maxRunningJobs, MAX_RUNNING_JOBS);
    this.maxPendingLineBytes = MAX_PENDING_LINE_BYTES;
    this.onNotification = options.onNotification;
    this.onAbort = () => {
      void this.close();
    };
    if (this.signal.aborted) this.closed = true;
    else this.signal.addEventListener("abort", this.onAbort, { once: true });
  }

  /** Number of currently running jobs. */
  get runningCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) if (job.endedAt === undefined) count += 1;
    return count;
  }

  /**
   * Spawn a job. `run` buffers stdout/stderr for `snapshot`; `monitor` also turns
   * stdout lines into notification events. Returns immediately. The deadline
   * must be finite and positive and at most `MAX_DEADLINE_MS`.
   */
  start(
    command: string,
    description: string,
    deadlineMs: number,
    kind: BackgroundKind,
  ): BackgroundJobDescriptor {
    if (this.closed || this.signal.aborted) throw abortError();
    const deadline = validateDeadline(deadlineMs);
    if (this.runningCount >= this.maxRunningJobs) {
      throw new Error(
        `background: too many running jobs (${this.maxRunningJobs}); stop one before starting another`,
      );
    }
    let child: ChildProcess;
    try {
      child = spawn("/bin/sh", ["-c", command], {
        cwd: this.workspace,
        env: process.env,
        detached: true, // own process group so the whole tree can be killed
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      throw new Error(`background: failed to spawn shell: ${(error as Error).message}`);
    }
    const id = crypto.randomUUID();
    const job = this.makeJob(id, kind, command, description, child);
    this.jobs.set(id, job);
    this.wire(job, child);
    job.timer = setTimeout(() => {
      job.stopReason ??= "timeout";
      this.killGroup(job);
    }, deadline);
    return {
      id,
      kind,
      state: "running",
      pid: child.pid,
      command,
      description,
      started_at: job.startedAt,
      deadline_ms: deadline,
    };
  }

  /** Connect immediately; each WebSocket message becomes one notification. */
  startWebSocket(
    ws: WebSocketMonitor,
    description: string,
    deadlineMs: number,
  ): BackgroundJobDescriptor {
    if (this.closed || this.signal.aborted) throw abortError();
    const deadline = validateDeadline(deadlineMs);
    const endpoint = validateWebSocket(ws);
    if (this.runningCount >= this.maxRunningJobs) {
      throw new Error(
        `background: too many running jobs (${this.maxRunningJobs}); stop one before starting another`,
      );
    }
    const id = crypto.randomUUID();
    const job = this.makeJob(id, "monitor", endpoint.url, description);
    job.deadlineAt = job.startedAt + deadline;
    const socket = new WebSocket(endpoint.url, endpoint.protocols, {
      maxPayload: WS_MAX_PAYLOAD_BYTES,
      perMessageDeflate: false,
      followRedirects: false,
      handshakeTimeout: Math.min(WS_HANDSHAKE_TIMEOUT_MS, deadline),
    });
    job.ws = endpoint;
    job.socket = socket;
    job.decoder = undefined;
    job.frameTimes = [];
    this.jobs.set(id, job);
    this.wireWebSocket(job, socket);
    job.timer = setTimeout(() => {
      job.stopReason ??= "timeout";
      this.killGroup(job);
    }, deadline);
    return {
      id,
      kind: "monitor",
      state: "running",
      pid: undefined,
      command: endpoint.url,
      description,
      started_at: job.startedAt,
      deadline_ms: deadline,
      source: "websocket",
      ws: { ...endpoint, ...(endpoint.protocols ? { protocols: [...endpoint.protocols] } : {}) },
    };
  }

  /** Immediate snapshot of a job; throws for an unknown (or evicted) id. */
  /** Active jobs that count as background work; finished jobs stay out. */
  active(): Array<Pick<BackgroundJobView, "id" | "kind" | "state" | "command" | "description" | "source">> {
    const jobs: Array<Pick<BackgroundJobView, "id" | "kind" | "state" | "command" | "description" | "source">> = [];
    for (const job of this.jobs.values()) {
      if (job.state !== "running") continue;
      jobs.push({ id: job.id, kind: job.kind, state: job.state, command: job.command, description: job.description,
        ...(job.ws ? { source: 'websocket' as const } : {}) });
    }
    return jobs;
  }

  snapshot(id: string): BackgroundJobView {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`unknown background task: ${id}`);
    return this.view(job);
  }

  /** Wait up to `waitMs` for a terminal state; cancellable via `signal`. */
  waitFor(id: string, waitMs: number, signal: AbortSignal): Promise<BackgroundJobView> {
    const job = this.jobs.get(id);
    if (!job) return Promise.reject(new Error(`unknown background task: ${id}`));
    if (job.endedAt !== undefined || waitMs <= 0) return Promise.resolve(this.view(job));
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise<BackgroundJobView>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        signal,
        timer: setTimeout(() => {
          this.removeWaiter(job, waiter);
          resolve(this.view(job));
        }, waitMs),
        onAbort: () => {
          this.removeWaiter(job, waiter);
          reject(abortError());
        },
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
      job.waiters.push(waiter);
    });
  }

  /** Stop a job: kill its process group. Idempotent; throws for an unknown id. */
  stop(id: string): BackgroundJobView {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`unknown background task: ${id}`);
    if (job.endedAt === undefined) {
      job.stopReason ??= "user";
      this.killGroup(job);
    }
    return this.view(job);
  }

  /** Drain up to `limit` queued notification events (oldest first). */
  drainNotifications(limit?: number): {
    events: BackgroundEvent[];
    dropped: number;
    pending: number;
  } {
    const take = Math.min(limit ?? DEFAULT_NOTIFICATION_LIMIT, this.events.length);
    const events = this.events.splice(0, take);
    for (const event of events) this.eventBytes -= Buffer.byteLength(event.text, "utf8");
    return { events, dropped: this.dropped, pending: this.events.length };
  }

  /** Kill and reap every running job. Idempotent. */
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.signal.removeEventListener("abort", this.onAbort);
    const jobs = [...this.jobs.values()];
    this.closing = (async () => {
      for (const job of jobs) {
        if (job.endedAt === undefined) {
          job.stopReason ??= "abort";
          this.killGroup(job);
        }
      }
      // Destroy pipes so a descendant holding one open cannot stall 'close'.
      for (const job of jobs) {
        try {
          job.child?.stdout?.destroy();
        } catch {
          /* ignore */
        }
        try {
          job.child?.stderr?.destroy();
        } catch {
          /* ignore */
        }
      }
      await Promise.all(jobs.map((job) => job.settled));
      this.jobs.clear();
      this.events = [];
      this.eventBytes = 0;
    })();
    return this.closing;
  }

  // -------------------------------------------------------------------------
  // Job plumbing
  // -------------------------------------------------------------------------

  private makeJob(
    id: string,
    kind: BackgroundKind,
    command: string,
    description: string,
    child?: ChildProcess,
  ): Job {
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    return {
      id,
      kind,
      command,
      description,
      state: "running",
      pid: child?.pid,
      startedAt: Date.now(),
      endedAt: undefined,
      exitCode: null,
      exitSignal: null,
      spawnError: undefined,
      stopReason: null,
      child,
      outTail: Buffer.alloc(0),
      errTail: Buffer.alloc(0),
      outBytes: 0,
      errBytes: 0,
      outTruncated: false,
      errTruncated: false,
      timer: undefined,
      grace: undefined,
      groupKilled: false,
      reaped: false,
      decoder: kind === "monitor" ? new StringDecoder("utf8") : undefined,
      pending: "",
      truncatedLines: 0,
      waiters: [],
      settled,
      resolveSettled,
    };
  }

  private wireWebSocket(job: Job, socket: WebSocket): void {
    socket.on("message", (data: RawData, binary: boolean) => {
      if (job.endedAt !== undefined || job.stopReason || job.spawnError) return;
      const now = Date.now();
      const times = job.frameTimes!;
      while (times.length > 0 && now - times[0]! >= RATE_WINDOW_MS) times.shift();
      times.push(now);
      if (times.length >= RATE_MAX_EVENTS) {
        this.failWebSocket(job, "WebSocket message flood (200 messages within 100ms)");
        return;
      }
      const buffer = Array.isArray(data)
        ? Buffer.concat(data)
        : data instanceof ArrayBuffer ? Buffer.from(data) : data;
      const text = binary ? `[binary frame, ${buffer.length} bytes]` : buffer.toString("utf8");
      this.append(job, "stdout", Buffer.from(`${text}\n`, "utf8"));
      this.pushWebSocketEvent(job, text);
    });
    socket.on("unexpected-response", (_request, response) => {
      this.failWebSocket(job, `WebSocket upgrade failed: HTTP ${response.statusCode}`);
      // A listener replaces ws's default rejection cleanup. Dispose the response
      // even if the peer keeps its HTTP body open indefinitely.
      response.destroy();
    });
    socket.on("error", (error: Error) => {
      if (job.stopReason || job.endedAt !== undefined) return;
      if (Date.now() >= job.deadlineAt!) {
        job.stopReason = "timeout";
        this.killGroup(job);
        return;
      }
      this.failWebSocket(job, `WebSocket error: ${error.message}`);
    });
    socket.once("close", (code: number, reason: Buffer) => {
      if (job.endedAt !== undefined) return;
      job.closeCode = code;
      job.closeReason = reason.toString("utf8");
      const state: BackgroundState = job.stopReason === "timeout" ? "timed_out"
        : job.stopReason ? "cancelled"
        : job.spawnError || (code !== 1000 && code !== 1001) ? "failed"
        : "completed";
      this.settle(job, state);
    });
  }

  private failWebSocket(job: Job, message: string): void {
    if (job.spawnError || job.endedAt !== undefined || job.stopReason) return;
    const buffer = Buffer.from(message, "utf8");
    job.spawnError = buffer.subarray(0, utf8PrefixEnd(buffer, WS_MAX_EVENT_BYTES)).toString("utf8");
    this.append(job, "stderr", Buffer.from(job.spawnError, "utf8"));
    this.pushWebSocketEvent(job, job.spawnError, job.spawnError);
    this.killGroup(job);
  }

  private pushWebSocketEvent(job: Job, message: string, error?: string): void {
    const buffer = Buffer.from(message, "utf8");
    const end = utf8PrefixEnd(buffer, Math.min(WS_MAX_EVENT_BYTES, this.maxEventBytes));
    if (end < buffer.length) job.truncatedLines += 1;
    const text = buffer.subarray(0, end).toString("utf8");
    this.enqueue({
      seq: (this.seq += 1),
      job_id: job.id,
      kind: "line",
      at: Date.now(),
      stream: error ? "stderr" : "stdout",
      lines: [text],
      text,
      source: "websocket",
      ...(end < buffer.length ? { truncated: true as const, original_bytes: buffer.length } : {}),
    });
  }

  private wire(job: Job, child: ChildProcess): void {
    const finalize = () => {
      if (job.reaped) return;
      job.reaped = true;
      if (job.grace) {
        clearTimeout(job.grace);
        job.grace = undefined;
      }
      let state: BackgroundState;
      if (job.stopReason === "timeout") state = "timed_out";
      else if (job.stopReason === "user" || job.stopReason === "abort") state = "cancelled";
      else if (job.spawnError !== undefined) state = "failed";
      else if (job.exitCode === 0) state = "completed";
      else state = "failed";
      this.settle(job, state);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      this.append(job, "stdout", chunk);
      if (job.kind === "monitor") this.consumeStdout(job, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      // stderr is only ever a readable tail; it never becomes a notification.
      this.append(job, "stderr", chunk);
    });
    child.on("error", (error) => {
      job.spawnError = (error as Error).message;
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
      finalize();
    });
    child.on("exit", (code, signalCode) => {
      job.exitCode = code;
      job.exitSignal = signalCode;
      if (job.timer) {
        clearTimeout(job.timer);
        job.timer = undefined;
      }
      // Reap any detached descendants that still hold the group.
      this.killGroup(job);
      job.grace = setTimeout(() => {
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
        finalize();
      }, PIPE_GRACE_MS);
    });
    child.on("close", () => finalize());
  }

  private settle(job: Job, state: BackgroundState): void {
    if (job.endedAt !== undefined) return;
    job.state = state;
    job.endedAt = Date.now();
    if (job.timer) {
      clearTimeout(job.timer);
      job.timer = undefined;
    }
    if (job.grace) {
      clearTimeout(job.grace);
      job.grace = undefined;
    }
    if (job.kind === "monitor") this.flushStdout(job);
    this.pushExit(job);
    this.resolveWaiters(job);
    this.pruneFinished();
    job.resolveSettled();
  }

  private resolveWaiters(job: Job): void {
    const waiters = job.waiters;
    job.waiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.resolve(this.view(job));
    }
  }

  private removeWaiter(job: Job, waiter: Waiter): void {
    const index = job.waiters.indexOf(waiter);
    if (index >= 0) job.waiters.splice(index, 1);
    clearTimeout(waiter.timer);
    waiter.signal.removeEventListener("abort", waiter.onAbort);
  }

  private killGroup(job: Job): void {
    if (job.groupKilled) return;
    job.groupKilled = true;
    if (job.socket) {
      job.socket.terminate();
      return;
    }
    const child = job.child;
    if (!child) return;
    try {
      if (job.pid !== undefined) process.kill(-job.pid, "SIGKILL");
      else child.kill("SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }

  /** Evict the oldest finished jobs when the finished history exceeds its cap.
   *  Running jobs are never evicted. */
  private pruneFinished(): void {
    const finished = [...this.jobs.values()].filter((job) => job.endedAt !== undefined);
    if (finished.length <= this.maxFinishedJobs) return;
    finished.sort((a, b) => a.endedAt! - b.endedAt!);
    const excess = finished.length - this.maxFinishedJobs;
    for (let index = 0; index < excess; index += 1) {
      this.jobs.delete(finished[index]!.id);
    }
  }

  private append(job: Job, stream: StreamName, chunk: Buffer): void {
    if (stream === "stdout") {
      job.outBytes += chunk.length;
      job.outTail = job.outTail.length === 0 ? Buffer.from(chunk) : Buffer.concat([job.outTail, chunk]);
      if (job.outTail.length > this.maxOutputBytes) {
        job.outTail = job.outTail.subarray(job.outTail.length - this.maxOutputBytes);
        job.outTruncated = true;
      }
    } else {
      job.errBytes += chunk.length;
      job.errTail = job.errTail.length === 0 ? Buffer.from(chunk) : Buffer.concat([job.errTail, chunk]);
      if (job.errTail.length > this.maxOutputBytes) {
        job.errTail = job.errTail.subarray(job.errTail.length - this.maxOutputBytes);
        job.errTruncated = true;
      }
    }
  }

  /**
   * Parse stdout into lines for the notification queue. The newline-free
   * remainder is bounded: an over-long pending chunk is emitted with a truncation
   * marker and its remainder discarded, so the pending buffer cannot grow
   * without limit.
   */
  private consumeStdout(job: Job, chunk: Buffer): void {
    if (!job.decoder) return;
    const text = job.pending + job.decoder.write(chunk);
    const lines: string[] = [];
    let start = 0;
    let index: number;
    while ((index = text.indexOf("\n", start)) >= 0) {
      lines.push(text.slice(start, index));
      start = index + 1;
    }
    let rest = text.slice(start);
    const restBuf = Buffer.from(rest, "utf8");
    if (restBuf.length > this.maxPendingLineBytes) {
      const end = utf8PrefixEnd(restBuf, this.maxPendingLineBytes);
      lines.push(`${restBuf.subarray(0, end).toString("utf8")}${LINE_TRUNCATION_MARKER}`);
      job.truncatedLines += 1;
      rest = "";
    }
    job.pending = rest;
    if (lines.length > 0) this.emitLines(job, "stdout", lines);
  }

  private flushStdout(job: Job): void {
    if (!job.decoder) return;
    const text = job.pending + job.decoder.end();
    job.pending = "";
    if (text.length > 0) this.emitLines(job, "stdout", text.split("\n"));
  }

  private emitLines(job: Job, stream: StreamName, lines: string[]): void {
    for (let i = 0; i < lines.length; i += BATCH_MAX_LINES) {
      this.pushLine(job, stream, lines.slice(i, i + BATCH_MAX_LINES));
    }
  }

  private pushLine(job: Job, stream: StreamName, lines: string[]): void {
    const now = Date.now();
    if (now - this.rateWindowStart >= RATE_WINDOW_MS) {
      this.rateWindowStart = now;
      this.rateWindowCount = 0;
    }
    const last = this.events[this.events.length - 1];
    // Rate guard: beyond the per-window budget, coalesce into the newest event
    // from the same job/stream while it still has line headroom. The per-event
    // line cap keeps a coalesced event bounded too.
    if (
      this.rateWindowCount >= RATE_MAX_EVENTS &&
      last !== undefined &&
      last.kind === "line" &&
      last.job_id === job.id &&
      last.stream === stream &&
      last.lines.length + lines.length <= MAX_LINES_PER_EVENT
    ) {
      const before = Buffer.byteLength(last.text, "utf8");
      last.lines.push(...lines);
      last.text = last.lines.join("\n");
      this.eventBytes += Buffer.byteLength(last.text, "utf8") - before;
      this.trimEvents();
      return;
    }
    this.rateWindowCount += 1;
    this.enqueue({
      seq: (this.seq += 1),
      job_id: job.id,
      kind: "line",
      at: now,
      stream,
      lines,
      text: lines.join("\n"),
    });
  }

  private pushExit(job: Job): void {
    const wsText = job.ws
      ? `WebSocket ${job.state}; close code ${job.closeCode ?? "unknown"}; reason ${JSON.stringify(job.closeReason ?? "")}${job.spawnError ? `; ${job.spawnError}` : ""}`
      : "";
    const buffer = Buffer.from(wsText, "utf8");
    const end = utf8PrefixEnd(buffer, Math.min(WS_MAX_EVENT_BYTES, this.maxEventBytes));
    if (end < buffer.length) job.truncatedLines += 1;
    this.enqueue({
      seq: (this.seq += 1),
      job_id: job.id,
      kind: "exit",
      at: Date.now(),
      lines: [],
      text: buffer.subarray(0, end).toString("utf8"),
      state: job.state,
      exit_code: job.exitCode,
      exit_signal: job.exitSignal,
      ...(job.ws ? {
        source: "websocket" as const,
        ...(job.closeCode !== undefined ? {
          close_code: job.closeCode,
          close_reason: (() => {
            const reason = Buffer.from(job.closeReason ?? "", "utf8");
            return reason.subarray(0, utf8PrefixEnd(reason, Math.min(WS_MAX_EVENT_BYTES, this.maxEventBytes))).toString("utf8");
          })(),
        } : {}),
        ...(end < buffer.length ? { truncated: true as const, original_bytes: buffer.length } : {}),
      } : {}),
    });
  }

  private enqueue(event: BackgroundEvent): void {
    if (Buffer.byteLength(event.text, "utf8") > this.maxEventBytes) {
      this.dropped += 1;
      return;
    }
    this.events.push(event);
    this.eventBytes += Buffer.byteLength(event.text, "utf8");
    this.trimEvents();
    this.fireNotification(event);
  }

  private fireNotification(event: BackgroundEvent): void {
    if (!this.onNotification) return;
    try {
      this.onNotification(event);
    } catch {
      /* a wake callback must never break a job */
    }
  }

  /** Evict oldest events until both queue budgets are satisfied. */
  private trimEvents(): void {
    while (
      (this.events.length > this.maxEvents || this.eventBytes > this.maxEventBytes) &&
      this.events.length > 0
    ) {
      const evicted = this.events.shift()!;
      this.eventBytes -= Buffer.byteLength(evicted.text, "utf8");
      this.dropped += 1;
    }
  }

  private view(job: Job): BackgroundJobView {
    const ended = job.endedAt;
    return {
      id: job.id,
      kind: job.kind,
      state: job.state,
      pid: job.pid ?? null,
      command: job.command,
      description: job.description,
      started_at: job.startedAt,
      ended_at: ended ?? null,
      duration_ms: (ended ?? Date.now()) - job.startedAt,
      exit_code: job.exitCode,
      exit_signal: job.exitSignal,
      error: job.spawnError ?? null,
      stdout: decodeTail(job.outTail),
      stderr: decodeTail(job.errTail),
      stdout_bytes: job.outBytes,
      stderr_bytes: job.errBytes,
      stdout_truncated: job.outTruncated,
      stderr_truncated: job.errTruncated,
      truncated_lines: job.truncatedLines,
      ...(job.ws ? {
        source: "websocket" as const,
        ws: { ...job.ws, ...(job.ws.protocols ? { protocols: [...job.ws.protocols] } : {}) },
        ...(job.closeCode !== undefined ? { close_code: job.closeCode, close_reason: job.closeReason } : {}),
      } : {}),
    };
  }
}

// ---------------------------------------------------------------------------
// Input schemas (strict)
// ---------------------------------------------------------------------------

const spawnSchema = z
  .object({
    command: z.string().min(1),
    description: z.string().min(1).max(2000).optional(),
    timeout_ms: z.number().int().min(1).max(MAX_DEADLINE_MS).optional(),
  })
  .strict();

const websocketSchema = z.object({
  url: z.string().min(1),
  protocols: z.array(z.string().regex(WS_PROTOCOL_PATTERN)).optional(),
}).strict().superRefine((value, context) => {
  try {
    validateWebSocket(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
  }
});

const monitorSchema = z.object({
  command: z.string().min(1).optional(),
  ws: websocketSchema.optional(),
  description: z.string().min(1).max(2000).optional(),
  timeout_ms: z.number().int().min(1).max(MAX_DEADLINE_MS).optional(),
}).strict().refine((value) => (value.command !== undefined) !== (value.ws !== undefined), {
  message: "monitor: supply exactly one of command or ws",
});

const getSchema = z
  .object({
    id: z.string().uuid(),
    wait_ms: z.number().int().min(0).max(GET_WAIT_MAX_MS).optional(),
  })
  .strict();

const stopSchema = z.object({ id: z.string().uuid() }).strict();

const readSchema = z
  .object({ limit: z.number().int().min(1).max(MAX_NOTIFICATION_LIMIT).optional() })
  .strict();

// ---------------------------------------------------------------------------
// Tools
//
// These operate on ephemeral *running jobs* held in memory by one registry.
// They are NOT the durable task store (`task_create`/`task_get`/`task_list`/
// `task_update` in `tasks.ts`, backed by `<workspace>/.agent/tasks.json`).
// ---------------------------------------------------------------------------

function runBackgroundTool(registry: BackgroundRegistry): ToolDefinition {
  return {
    toAutoClassifierInput(input) { return spawnSchema.parse(input).command; },
    readOnly: false,
    schema: {
      name: "run_background",
      description:
        "Start a shell command as a background job (`/bin/sh -c`, cwd = workspace) " +
        "and return immediately with its job id instead of waiting. stdout/stderr " +
        "are retained as bounded tails readable with `get_background_task`. The job " +
        "runs in its own process group; it is killed with `task_stop`, when its " +
        "deadline elapses, or when the registry closes. This is an in-memory " +
        "running job, not a durable task (`task_create`/`task_list` manage those). " +
        `Deadline defaults to ${RUN_DEFAULT_DEADLINE_MS}ms, maximum ${MAX_DEADLINE_MS}ms. ` +
        "Requires `allowShell`.",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command line passed to `/bin/sh -c`." },
          description: { type: "string", description: "Short human label for the job." },
          timeout_ms: {
            type: "integer",
            minimum: 1,
            maximum: MAX_DEADLINE_MS,
            description: "Deadline in milliseconds before the process group is killed.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      if (!context.allowShell) {
        throw new Error(
          "run_background: shell access is disabled for this agent (allowShell is false)",
        );
      }
      const { command, description, timeout_ms } = spawnSchema.parse(input);
      const descriptor = registry.start(
        command,
        description ?? "(no description)",
        timeout_ms ?? RUN_DEFAULT_DEADLINE_MS,
        "run",
      );
      return capOutput(JSON.stringify(descriptor, null, 2), outputLimit(context));
    },
  };
}

function monitorTool(registry: BackgroundRegistry, websocket = true): ToolDefinition {
  const legacy: ToolDefinition = {
    readOnly: false,
    schema: {
      name: "monitor",
      description:
        "Start a shell command as a background job and stream its stdout lines " +
        "into the notification queue (read them with `read_notifications`). " +
        "stderr is not streamed; it stays readable as a tail via " +
        "`get_background_task`. Lines are batched and the queue is bounded by both " +
        "event count and bytes; over-long newline-free lines are emitted once with " +
        "a truncation marker, and evicted events are reported as `dropped`, never " +
        "silently. The job runs in its own process group. Deadline defaults to " +
        `${MONITOR_DEFAULT_DEADLINE_MS}ms, maximum ${MAX_DEADLINE_MS}ms. Requires ` +
        "`allowShell`.",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command line passed to `/bin/sh -c`." },
          description: { type: "string", description: "Short human label for the job." },
          timeout_ms: {
            type: "integer",
            minimum: 1,
            maximum: MAX_DEADLINE_MS,
            description: "Deadline in milliseconds before the process group is killed.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      if (!context.allowShell) {
        throw new Error("monitor: shell access is disabled for this agent (allowShell is false)");
      }
      const { command, description, timeout_ms } = spawnSchema.parse(input);
      const descriptor = registry.start(
        command,
        description ?? "(no description)",
        timeout_ms ?? MONITOR_DEFAULT_DEADLINE_MS,
        "monitor",
      );
      return capOutput(JSON.stringify(descriptor, null, 2), outputLimit(context));
    },
  };
  if (!websocket) return legacy;
  return {
    readOnly: false,
    schema: {
      name: "monitor",
      description:
        "Start a background monitor with exactly one of command or ws. A command " +
        "streams stdout lines into the bounded notification queue; stderr stays " +
        "readable as a tail. WebSocket ws/wss connections emit one event per text " +
        "message, preserving newlines, and binary frames as '[binary frame, N bytes]'. " +
        "Read events with read_notifications and state/tails with get_background_task. " +
        "WebSocket messages are capped at 1 MiB, event text at 4096 UTF-8 bytes; " +
        "truncation and queue drops are counted. Errors and close code/reason are " +
        "reported; 200 messages within 100ms ends a flooded connection as failed. " +
        "task_stop, deadline and registry close terminate the job. " +
        `Deadline defaults to ${MONITOR_DEFAULT_DEADLINE_MS}ms, maximum ${MAX_DEADLINE_MS}ms. ` +
        "Only command requires allowShell; ws is available with shell access disabled.",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", minLength: 1, description: "Shell command line passed to `/bin/sh -c`." },
          ws: {
            type: "object",
            properties: {
              url: { type: "string", minLength: 1, description: "ws:// or wss:// URL without embedded credentials or a fragment." },
              protocols: {
                type: "array",
                items: { type: "string", pattern: WS_PROTOCOL_PATTERN.source },
                uniqueItems: true,
                description: "Optional unique HTTP token subprotocols offered in the handshake.",
              },
            },
            required: ["url"],
            additionalProperties: false,
          },
          description: { type: "string", minLength: 1, maxLength: 2000, description: "Short human label for the job." },
          timeout_ms: {
            type: "integer",
            minimum: 1,
            maximum: MAX_DEADLINE_MS,
            description: "Deadline in milliseconds before the job is terminated.",
          },
        },
        oneOf: [{ required: ["command"] }, { required: ["ws"] }],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed = monitorSchema.parse(input);
      const description = parsed.description ?? "(no description)";
      const deadline = parsed.timeout_ms ?? MONITOR_DEFAULT_DEADLINE_MS;
      let descriptor: BackgroundJobDescriptor;
      if (parsed.ws) {
        descriptor = registry.startWebSocket(parsed.ws, description, deadline);
      } else {
        if (!context.allowShell) {
          throw new Error("monitor: shell access is disabled for this agent (allowShell is false)");
        }
        descriptor = registry.start(parsed.command!, description, deadline, "monitor");
      }
      return capOutput(JSON.stringify(descriptor, null, 2), outputLimit(context));
    },
  };
}

function getBackgroundTaskTool(registry: BackgroundRegistry): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "get_background_task",
      description:
        "Read a background job's state and bounded stdout/stderr tails by id. " +
        "With `wait_ms` the call waits up to that many milliseconds (max " +
        `${GET_WAIT_MAX_MS}ms) for a terminal state before returning; the wait is ` +
        "cancelled if the caller's signal aborts. Reads a running job, not a " +
        "durable task.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Background job id (UUID)." },
          wait_ms: {
            type: "integer",
            minimum: 0,
            maximum: GET_WAIT_MAX_MS,
            description: "Milliseconds to wait for a terminal state.",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { id, wait_ms = GET_WAIT_DEFAULT_MS } = getSchema.parse(input);
      const view =
        wait_ms > 0
          ? await registry.waitFor(id, wait_ms, context.signal)
          : registry.snapshot(id);
      return capOutput(JSON.stringify(view, null, 2), outputLimit(context));
    },
  };
}

function taskStopTool(registry: BackgroundRegistry): ToolDefinition {
  return {
    readOnly: false,
    schema: {
      name: "task_stop",
      description:
        "Stop a running background job by id: kill its whole process group so " +
        "descendants cannot outlive it, and return the job's current view. " +
        "Idempotent on an already-finished job. This stops a running job, not a " +
        "durable task.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "Background job id (UUID)." } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { id } = stopSchema.parse(input);
      const view = registry.stop(id);
      return capOutput(JSON.stringify(view, null, 2), outputLimit(context));
    },
  };
}

function readNotificationsTool(registry: BackgroundRegistry): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "read_notifications",
      description:
        "Drain up to `limit` queued background notification events (oldest " +
        "first) and report how many remain (`pending`) and how many events were " +
        "ever evicted under the bounded queue (`dropped`). Monitor stdout lines " +
        "arrive as `line` events; each job also emits one `exit` event.",
      input_schema: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            minimum: 1,
            maximum: MAX_NOTIFICATION_LIMIT,
            description: "Maximum number of events to drain.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed = readSchema.parse(input == null ? {} : input);
      const result = registry.drainNotifications(parsed.limit);
      return capOutput(JSON.stringify(result, null, 2), outputLimit(context));
    },
  };
}

/** Build the background-job tools bound to one registry. */
export function createBackgroundTools(
  registry: BackgroundRegistry,
  options: { websocket?: boolean } = {},
): ToolDefinition[] {
  return [
    runBackgroundTool(registry),
    monitorTool(registry, options.websocket !== false),
    getBackgroundTaskTool(registry),
    taskStopTool(registry),
    readNotificationsTool(registry),
  ];
}

/**
 * Build a registry and its tools. The canonical workspace and lifetime signal
 * are captured by the registry; call `registry.close()` in a `finally` so no
 * child survives the session.
 */
export function createBackgroundRegistry(options: BackgroundRegistryOptions): {
  registry: BackgroundRegistry;
  tools: ToolDefinition[];
} {
  const registry = new BackgroundRegistry(options);
  return { registry, tools: createBackgroundTools(registry) };
}
