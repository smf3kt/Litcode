import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  createBackgroundRegistry,
  type BackgroundRegistry,
  type BackgroundRegistryOptions,
} from "../src/background.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";

// ---------------------------------------------------------------------------
// Fixtures and helpers
//
// Only local mock Node processes are spawned. Scripts are written to a fresh
// temporary directory with no package.json, so Node treats the `.js` files as
// CommonJS (`require` is available).
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LINE_MARKER = "[monitor: line truncated]";

const tempDirs: string[] = [];
function tmpDir(prefix = "ccbg-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(20);
  }
  throw new Error("condition was not met before the timeout");
}
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Materialize a mock Node script and return the shell command that runs it. */
function scriptCommand(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, "utf8");
  return `${JSON.stringify(process.execPath)} ${JSON.stringify(file)}`;
}

// String.raw keeps `\n` and `\u....` escapes literal so they are parsed by the
// spawned Node process, and keeps this source file ASCII.
const OK = String.raw`process.stdout.write("hello");`;
const FAIL = String.raw`process.stderr.write("boom", function () { process.exit(3); });`;
const SLEEP = String.raw`setInterval(function () {}, 1000);`;
const PID = String.raw`process.stdout.write("PID:" + process.pid); setInterval(function () {}, 1000);`;
const MULTIBYTE = String.raw`process.stdout.write("你".repeat(100));`;
const STREAMS = String.raw`
process.stdout.write("out1\n");
process.stderr.write("err1\n");
`;
const LONG = String.raw`process.stdout.write("a".repeat(20000));`;
const LINES = String.raw`
for (let i = 1; i <= 5; i++) process.stdout.write("line" + i + "\n");
`;
const PACED = String.raw`
let i = 0;
const t = setInterval(function () {
  i += 1;
  if (i > 6) { clearInterval(t); return; }
  process.stdout.write("n" + i + "\n");
}, 20);
`;
const BURST = String.raw`
let i = 0;
const t = setInterval(function () {
  i += 1;
  if (i > 30) { clearInterval(t); return; }
  process.stdout.write("e" + i + "\n");
}, 3);
`;
const SPAWNCHILD = String.raw`
const cp = require("child_process");
cp.spawn(process.execPath, ["-e", "process.stdout.write('CHILD:'+process.pid);setInterval(()=>{},1000)"], { stdio: ["ignore", "inherit", "inherit"] });
process.stdout.write("PARENT:" + process.pid);
setInterval(function () {}, 1000);
`;

type Fixture = {
  ws: string;
  controller: AbortController;
  registry: BackgroundRegistry;
  tools: Map<string, ToolDefinition>;
};

function makeRegistry(overrides: Partial<BackgroundRegistryOptions> = {}): Fixture {
  const ws = tmpDir();
  const controller = new AbortController();
  const { registry, tools } = createBackgroundRegistry({
    workspace: ws,
    signal: controller.signal,
    maxOutputBytes: 100_000,
    ...overrides,
  });
  return { ws, controller, registry, tools: new Map(tools.map((t) => [t.schema.name, t])) };
}

function ctx(
  signal: AbortSignal = new AbortController().signal,
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return { workspace: os.tmpdir(), signal, allowShell: true, maxOutputBytes: 100_000, ...overrides };
}

async function call(
  tools: Map<string, ToolDefinition>,
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<string> {
  const tool = tools.get(name);
  assert.ok(tool, `tool ${name} is missing`);
  return tool.execute(input, context);
}

/** Poll a job's stdout tail until `needle` appears, returning the parsed match. */
async function awaitOutput(f: Fixture, id: string, needle: RegExp): Promise<RegExpMatchArray> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const match = f.registry.snapshot(id).stdout.match(needle);
    if (match) return match;
    await delay(20);
  }
  throw new Error(`output matching ${needle} did not appear`);
}

async function startJob(
  f: Fixture,
  tool: "run_background" | "monitor",
  command: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return JSON.parse(await call(f.tools, tool, { command, ...extra }, ctx())) as Record<
    string,
    unknown
  >;
}

async function waitDone(f: Fixture, id: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await call(f.tools, "get_background_task", { id, wait_ms: 5000 }, ctx()),
  ) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool surface
// ---------------------------------------------------------------------------

test("createBackgroundTools exposes the five job tools with the right flags", async () => {
  const f = makeRegistry();
  try {
    const names = [...f.tools.keys()].sort();
    assert.deepEqual(names, [
      "get_background_task",
      "monitor",
      "read_notifications",
      "run_background",
      "task_stop",
    ]);
    const flags = new Map([...f.tools.values()].map((t) => [t.schema.name, t.readOnly]));
    assert.equal(flags.get("get_background_task"), true);
    assert.equal(flags.get("read_notifications"), true);
    assert.equal(flags.get("run_background"), false);
    assert.equal(flags.get("monitor"), false);
    assert.equal(flags.get("task_stop"), false);
    for (const tool of f.tools.values()) {
      assert.equal(tool.schema.input_schema.type, "object");
      assert.equal(tool.schema.input_schema.additionalProperties, false);
    }
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Lifecycle: success, failure, timeout, cancellation, defaults
// ---------------------------------------------------------------------------

test("active reports only running jobs for the Stop payload", async () => {
  const f = makeRegistry();
  try {
    const job = f.registry.start("sleep 5", "fixture job", 30_000, "run");
    assert.deepEqual(f.registry.active(), [
      { id: job.id, kind: "run", state: "running", command: "sleep 5", description: "fixture job" },
    ]);
    f.registry.stop(job.id);
    await waitDone(f, job.id);
    assert.deepEqual(f.registry.active(), []);
  } finally { await f.registry.close(); }
});

test("run_background completes a natural success and reports exit 0", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "ok.js", OK);
    const descriptor = await startJob(f, "run_background", command);
    assert.match(String(descriptor.id), UUID_RE);
    assert.equal(descriptor.state, "running");
    assert.equal(typeof descriptor.pid, "number");
    assert.equal(descriptor.deadline_ms, 120_000); // run default

    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "completed");
    assert.equal(view.exit_code, 0);
    assert.equal(view.exit_signal, null);
    assert.equal(view.stdout, "hello");
    assert.equal(view.stdout_truncated, false);
    assert.equal(view.stdout_bytes, 5);
    assert.equal(view.error, null);
  } finally {
    await f.registry.close();
  }
});

test("monitor defaults to a longer deadline than run_background", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "ok.js", OK);
    const descriptor = await startJob(f, "monitor", command);
    assert.equal(descriptor.deadline_ms, 300_000);
    await waitDone(f, String(descriptor.id));
  } finally {
    await f.registry.close();
  }
});

test("run_background reports a natural failure with its nonzero exit code", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "fail.js", FAIL);
    const descriptor = await startJob(f, "run_background", command);
    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "failed");
    assert.equal(view.exit_code, 3);
    assert.equal(view.stderr, "boom");
  } finally {
    await f.registry.close();
  }
});

test("a job past its deadline is killed and reported as timed_out", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "sleep.js", SLEEP);
    const descriptor = await startJob(f, "run_background", command, { timeout_ms: 200 });
    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "timed_out");
  } finally {
    await f.registry.close();
  }
});

test("task_stop kills a running job and reports it cancelled", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "sleep.js", SLEEP);
    const descriptor = await startJob(f, "run_background", command);
    await call(f.tools, "task_stop", { id: descriptor.id }, ctx());
    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "cancelled");
    await waitFor(() => !processAlive(Number(descriptor.pid)));
    // Stopping again is idempotent.
    await call(f.tools, "task_stop", { id: descriptor.id }, ctx());
  } finally {
    await f.registry.close();
  }
});

test("get_background_task returns a running view when the deadline has not elapsed", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "sleep.js", SLEEP);
    const descriptor = await startJob(f, "run_background", command);
    const view = JSON.parse(
      await call(f.tools, "get_background_task", { id: descriptor.id, wait_ms: 50 }, ctx()),
    ) as Record<string, unknown>;
    assert.equal(view.state, "running");
    await call(f.tools, "task_stop", { id: descriptor.id }, ctx());
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// API: deadline validation and concurrency cap
// ---------------------------------------------------------------------------

test("start rejects a non-finite, non-positive or over-maximal deadline", async () => {
  const f = makeRegistry();
  try {
    assert.throws(() => f.registry.start("true", "d", 0, "run"), /deadline/);
    assert.throws(() => f.registry.start("true", "d", -1, "run"), /deadline/);
    assert.throws(() => f.registry.start("true", "d", Number.NaN, "run"), /deadline/);
    assert.throws(() => f.registry.start("true", "d", Number.POSITIVE_INFINITY, "run"), /deadline/);
    assert.throws(() => f.registry.start("true", "d", 1_800_001, "run"), /deadline/);
    // A valid deadline is accepted.
    const command = scriptCommand(f.ws, "ok.js", OK);
    const descriptor = f.registry.start(command, "d", 1_800_000, "run");
    assert.equal(descriptor.deadline_ms, 1_800_000);
  } finally {
    await f.registry.close();
  }
});

test("a concurrency cap refuses to start more than the allowed running jobs", async () => {
  const f = makeRegistry({ maxRunningJobs: 1 });
  try {
    const command = scriptCommand(f.ws, "sleep.js", SLEEP);
    await startJob(f, "run_background", command);
    assert.equal(f.registry.runningCount, 1);
    await assert.rejects(startJob(f, "run_background", command), /too many running jobs/);
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Bounded UTF-8 tails
// ---------------------------------------------------------------------------

test("output tails are byte-bounded and never emit a replacement character", async () => {
  const f = makeRegistry({ maxOutputBytes: 64 });
  try {
    const command = scriptCommand(f.ws, "multibyte.js", MULTIBYTE);
    const descriptor = await startJob(f, "run_background", command);
    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "completed");
    assert.equal(view.stdout_truncated, true);
    assert.equal(view.stdout_bytes, 300);
    const stdout = String(view.stdout);
    assert.ok(!stdout.includes("�"), "tail must not contain U+FFFD");
    assert.ok(Buffer.byteLength(stdout, "utf8") <= 64, "tail must respect the byte cap");
    assert.match(stdout, /^你+$/);
    assert.equal(stdout.length, 21);
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Unknown ids
// ---------------------------------------------------------------------------

test("unknown job ids are rejected by get and stop", async () => {
  const f = makeRegistry();
  try {
    const missing = "00000000-0000-4000-8000-000000000000";
    await assert.rejects(
      call(f.tools, "get_background_task", { id: missing }, ctx()),
      /unknown background task/,
    );
    await assert.rejects(
      call(f.tools, "task_stop", { id: missing }, ctx()),
      /unknown background task/,
    );
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Bounded finished history and ownership cleanup
// ---------------------------------------------------------------------------

test("the finished-job history is bounded and never evicts a running job", async () => {
  const f = makeRegistry({ maxFinishedJobs: 2 });
  try {
    const quick = scriptCommand(f.ws, "ok.js", OK);
    const long = scriptCommand(f.ws, "sleep.js", SLEEP);
    const running = await startJob(f, "run_background", long);

    const finished: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const job = await startJob(f, "run_background", quick);
      await waitDone(f, String(job.id));
      finished.push(String(job.id));
    }
    // Only the two newest finished jobs survive; the oldest is evicted.
    assert.doesNotThrow(() => f.registry.snapshot(finished[2]!));
    assert.doesNotThrow(() => f.registry.snapshot(finished[1]!));
    assert.throws(() => f.registry.snapshot(finished[0]!), /unknown background task/);
    // The running job is always retained.
    assert.equal(f.registry.snapshot(String(running.id)).state, "running");
  } finally {
    await f.registry.close();
  }
});

test("registry.close kills and reaps every running job", async () => {
  const f = makeRegistry();
  const command = scriptCommand(f.ws, "pid.js", PID);
  const descriptor = await startJob(f, "run_background", command);
  const match = await awaitOutput(f, String(descriptor.id), /PID:(\d+)/);
  const pid = Number(match[1]);
  assert.ok(processAlive(pid), "job process should be alive before close");

  await f.registry.close();
  await waitFor(() => !processAlive(pid));
  assert.throws(() => f.registry.snapshot(String(descriptor.id)), /unknown background task/);
});

test("stopping a job also kills descendants in its process group", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "spawnchild.js", SPAWNCHILD);
    const descriptor = await startJob(f, "run_background", command);
    const match = await awaitOutput(f, String(descriptor.id), /CHILD:(\d+)/);
    const childPid = Number(match[1]);
    assert.ok(processAlive(childPid), "grandchild should be alive before stop");

    await call(f.tools, "task_stop", { id: descriptor.id }, ctx());
    await waitFor(() => !processAlive(childPid));
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Notifications: stdout-only, per-line delivery, stderr stays a tail
// ---------------------------------------------------------------------------

test("monitor turns every stdout line into a notification without silent loss", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "lines.js", LINES);
    const descriptor = await startJob(f, "monitor", command);
    await waitDone(f, String(descriptor.id));

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: { job_id: string; kind: string; stream?: string; lines: string[] }[];
      dropped: number;
      pending: number;
    };
    const lines = drained.events
      .filter((e) => e.job_id === descriptor.id && e.kind === "line" && e.stream === "stdout")
      .flatMap((e) => e.lines)
      .sort();
    assert.deepEqual(lines, ["line1", "line2", "line3", "line4", "line5"]);
    assert.equal(drained.dropped, 0, "no events should be silently dropped");
    const exit = drained.events.find((e) => e.job_id === descriptor.id && e.kind === "exit") as
      | { state?: string }
      | undefined;
    assert.equal(exit?.state, "completed");
  } finally {
    await f.registry.close();
  }
});

test("monitor streams stdout only; stderr stays a readable tail", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "streams.js", STREAMS);
    const descriptor = await startJob(f, "monitor", command);
    const view = await waitDone(f, String(descriptor.id));

    assert.equal(view.stdout, "out1\n");
    assert.equal(view.stderr, "err1\n");

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: { job_id: string; kind: string; stream?: string; lines: string[] }[];
    };
    const forJob = drained.events.filter((e) => e.job_id === descriptor.id);
    assert.equal(
      forJob.some((e) => e.stream === "stderr"),
      false,
      "stderr must never become a notification",
    );
    const stdoutLines = forJob.filter((e) => e.kind === "line").flatMap((e) => e.lines);
    assert.deepEqual(stdoutLines, ["out1"]);
  } finally {
    await f.registry.close();
  }
});

test("an over-long newline-free line is emitted once with a truncation marker", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "long.js", LONG);
    const descriptor = await startJob(f, "monitor", command);
    const view = await waitDone(f, String(descriptor.id));
    assert.ok(Number(view.truncated_lines) >= 1, "truncation must be counted");

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: { job_id: string; kind: string; lines: string[] }[];
      dropped: number;
    };
    const lineEvents = drained.events.filter(
      (e) => e.job_id === descriptor.id && e.kind === "line",
    );
    assert.ok(lineEvents.length >= 1);
    const allLines = lineEvents.flatMap((e) => e.lines);
    assert.ok(
      allLines.some((line) => line.endsWith(LINE_MARKER)),
      "a truncated line must carry the marker",
    );
    // Every retained line is byte-bounded (4096-byte cap + marker headroom).
    assert.ok(allLines.every((line) => Buffer.byteLength(line, "utf8") <= 4200));
  } finally {
    await f.registry.close();
  }
});

test("the notification queue is bounded by event count and reports drops", async () => {
  const f = makeRegistry({ maxEvents: 4 });
  try {
    const command = scriptCommand(f.ws, "burst.js", BURST);
    const descriptor = await startJob(f, "monitor", command);
    await waitDone(f, String(descriptor.id));

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: unknown[];
      dropped: number;
    };
    assert.ok(drained.events.length <= 4, "queue must respect the event cap");
    assert.ok(drained.dropped > 0, "evictions must be reported, not silent");
  } finally {
    await f.registry.close();
  }
});

test("the notification queue is bounded by bytes and reports drops", async () => {
  const f = makeRegistry({ maxEventBytes: 40 });
  try {
    const command = scriptCommand(f.ws, "burst.js", BURST);
    const descriptor = await startJob(f, "monitor", command);
    await waitDone(f, String(descriptor.id));

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: { text: string }[];
      dropped: number;
    };
    const bytes = drained.events.reduce((sum, e) => sum + Buffer.byteLength(e.text, "utf8"), 0);
    assert.ok(bytes <= 40, "queue must respect the byte budget");
    assert.ok(drained.dropped > 0, "byte evictions must be reported");
  } finally {
    await f.registry.close();
  }
});

test("read_notifications honors a limit and reports the remaining queue", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "paced.js", PACED);
    const descriptor = await startJob(f, "monitor", command);
    await waitDone(f, String(descriptor.id));

    const first = JSON.parse(await call(f.tools, "read_notifications", { limit: 2 }, ctx())) as {
      events: unknown[];
      pending: number;
    };
    assert.equal(first.events.length, 2);
    assert.ok(first.pending > 0, "remaining events stay queued");

    const rest = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: unknown[];
      pending: number;
    };
    assert.ok(rest.events.length > 0);
    assert.equal(rest.pending, 0);
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// onNotification wake hook
// ---------------------------------------------------------------------------

test("an onNotification callback receives queued events", async () => {
  const seen: { job_id: string; kind: string }[] = [];
  const f = makeRegistry({
    onNotification: (event) => {
      seen.push({ job_id: event.job_id, kind: event.kind });
    },
  });
  try {
    const command = scriptCommand(f.ws, "lines.js", LINES);
    const descriptor = await startJob(f, "monitor", command);
    await waitDone(f, String(descriptor.id));
    const forJob = seen.filter((e) => e.job_id === descriptor.id);
    assert.ok(forJob.some((e) => e.kind === "line"), "line events should wake the callback");
    assert.ok(forJob.some((e) => e.kind === "exit"), "the exit event should wake the callback");
  } finally {
    await f.registry.close();
  }
});

test("a throwing onNotification callback is contained and never breaks the job", async () => {
  const f = makeRegistry({
    onNotification: () => {
      throw new Error("callback must be contained");
    },
  });
  try {
    const command = scriptCommand(f.ws, "lines.js", LINES);
    const descriptor = await startJob(f, "monitor", command);
    const view = await waitDone(f, String(descriptor.id));
    assert.equal(view.state, "completed");

    const drained = JSON.parse(await call(f.tools, "read_notifications", {}, ctx())) as {
      events: { job_id: string; kind: string; lines: string[] }[];
      dropped: number;
    };
    const lines = drained.events
      .filter((e) => e.job_id === descriptor.id && e.kind === "line")
      .flatMap((e) => e.lines)
      .sort();
    assert.deepEqual(lines, ["line1", "line2", "line3", "line4", "line5"]);
    assert.equal(drained.dropped, 0);
  } finally {
    await f.registry.close();
  }
});

// ---------------------------------------------------------------------------
// Preabort, shell gating and lifetime cancellation
// ---------------------------------------------------------------------------

test("run_background and monitor require allowShell", async () => {
  const f = makeRegistry();
  try {
    const command = scriptCommand(f.ws, "ok.js", OK);
    await assert.rejects(
      call(f.tools, "run_background", { command }, ctx(new AbortController().signal, { allowShell: false })),
      /allowShell is false/,
    );
    await assert.rejects(
      call(f.tools, "monitor", { command }, ctx(new AbortController().signal, { allowShell: false })),
      /allowShell is false/,
    );
  } finally {
    await f.registry.close();
  }
});

test("pre-aborted caller signals prevent start, waiting, drain, and stop", async () => {
  const f = makeRegistry();
  try {
    const okCommand = scriptCommand(f.ws, "ok.js", OK);
    const sleepCommand = scriptCommand(f.ws, "sleep.js", SLEEP);
    const aborted = new AbortController();
    aborted.abort();

    await assert.rejects(call(f.tools, "run_background", { command: okCommand }, ctx(aborted.signal)), /aborted/);

    const descriptor = await startJob(f, "run_background", sleepCommand);
    await assert.rejects(
      call(f.tools, "get_background_task", { id: descriptor.id, wait_ms: 5000 }, ctx(aborted.signal)),
      /aborted/,
    );
    await assert.rejects(call(f.tools, "read_notifications", {}, ctx(aborted.signal)), /aborted/);
    await assert.rejects(call(f.tools, "task_stop", { id: descriptor.id }, ctx(aborted.signal)), /aborted/);

    // A non-aborted signal still stops the job.
    await call(f.tools, "task_stop", { id: descriptor.id }, ctx());
  } finally {
    await f.registry.close();
  }
});

test("the registry lifetime signal cancels running jobs on abort", async () => {
  const f = makeRegistry();
  const command = scriptCommand(f.ws, "pid.js", PID);
  const descriptor = await startJob(f, "run_background", command);
  const match = await awaitOutput(f, String(descriptor.id), /PID:(\d+)/);
  const pid = Number(match[1]);
  assert.ok(processAlive(pid));

  f.controller.abort();
  await waitFor(() => !processAlive(pid));
  await f.registry.close();
});
