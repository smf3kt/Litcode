import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { AsyncHookRegistry, type AsyncHookCompletion } from "../src/async-hooks.js";
import { runHooks, type AsyncHookRequest, type HookCommandHandle, type HookEvent, type HookPayload } from "../src/hooks.js";

const workspaces: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-async-hooks-")));
  workspaces.push(root);
  return root;
}
after(() => { for (const root of workspaces) fs.rmSync(root, { recursive: true, force: true }); });
function request(root: string, command: string, overrides: Partial<AsyncHookRequest> = {}): AsyncHookRequest {
  const payload: HookPayload = overrides.payload ?? { cwd: root, session_id: "s1", tool_name: "write_file", tool_use_id: "t1" };
  const event: HookEvent = overrides.event ?? "PostToolUse";
  return { definition: { command, async: true }, event, payload, input: `${JSON.stringify({ ...payload, hook_event_name: event })}\n`, cwd: root, timeoutMs: 60_000, signal: new AbortController().signal, ...overrides };
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function shellQuote(value: string): string { return `'${value.replaceAll("'", `'"'"'`)}'`; }
function emit(value: unknown): string { return `printf '%s' ${shellQuote(JSON.stringify(value))}`; }

test("async registry integrates start callback and executes command exactly once with original stdin/cwd", async () => {
  const root = workspace();
  const completions: AsyncHookCompletion[] = [];
  const registry = new AsyncHookRegistry({ workspace: root, onResult: completion => { completions.push(completion); } });
  try {
    const command = `printf x >> runs; printf '%s' "$PWD" > cwd; cat > input; ${emit({ additionalContext: "complete" })}`;
    const payload = { cwd: root, session_id: "s1", tool_name: "write_file", tool_use_id: "t1", tool_input: { secret: "payload-only" }, custom: "retained" };
    const result = await runHooks({ PostToolUse: [{ command, async: true }] }, "PostToolUse", payload, new AbortController().signal, { startAsyncCommand: registry.start });
    assert.equal(result.backgroundTasks?.length, 1);
    const id = result.backgroundTasks![0]!;
    const completed = await registry.wait(id);
    assert.equal(completed.state, "completed");
    assert.deepEqual(completed.result.additionalContext, ["complete"]);
    assert.equal(fs.readFileSync(path.join(root, "runs"), "utf8"), "x");
    assert.equal(fs.readFileSync(path.join(root, "cwd"), "utf8"), root);
    assert.equal(fs.readFileSync(path.join(root, "input"), "utf8"), `${JSON.stringify({ ...payload, hook_event_name: "PostToolUse" })}\n`);
    assert.deepEqual(completed.payload, { session_id: "s1", tool_use_id: "t1", tool_name: "write_file" });
    assert.equal(JSON.stringify(completed).includes("payload-only"), false);
    assert.equal(completions.length, 1);
    assert.equal(registry.get(id)?.state, "completed");
  } finally { await registry.close(); }
});

test("async registry preserves Stop continuation, PreCompact raw output and permission translation", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const stopped = await registry.wait(await registry.start(request(root, "printf 'another turn' >&2; exit 2", { event: "Stop" })));
    assert.equal(stopped.state, "blocked");
    assert.equal(stopped.result.reason, "another turn");
    assert.equal(stopped.result.stopRequested, undefined);
    const compact = await registry.wait(await registry.start(request(root, "printf 'raw summary hint'", { event: "PreCompact" })));
    assert.deepEqual(compact.result.additionalContext, ["raw summary hint"]);
    const permission = await registry.wait(await registry.start(request(root, emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "hold" } }), { event: "PreToolUse" })));
    assert.equal(permission.result.permissionDecision, "deny");
    assert.equal(permission.result.blocked, true);
    const failed = await registry.wait(await registry.start(request(root, "printf failure >&2; exit 1")));
    assert.equal(failed.state, "failed");
  } finally { await registry.close(); }
});

test("asyncRewake wakes only on exit 2 with the configured prefix, summary and escaped output", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  const rewake = (command: string, extra: Record<string, unknown> = {}) => request(root, command, {
    definition: { command, async: true, asyncRewake: true, ...extra },
  });
  try {
    const failed = await registry.wait(await registry.start(rewake("printf 'stderr text' >&2; exit 2")));
    assert.deepEqual(failed.rewake, {
      summary: "Stop hook feedback",
      body: `Stop hook blocking error from command "printf 'stderr text' >&2; exit 2": stderr text`,
    });
    const custom = await registry.wait(await registry.start(rewake("printf 'stdout only'; exit 2",
      { rewakeMessage: "Hold on:", rewakeSummary: "needs review" })));
    assert.deepEqual(custom.rewake, { summary: "needs review", body: "Hold on: stdout only" });
    assert.equal((await registry.wait(await registry.start(rewake("printf 'fine'; exit 0")))).rewake, undefined);
    assert.equal((await registry.wait(await registry.start(rewake("printf 'fine'; exit 1")))).rewake, undefined);
    const escaped = await registry.wait(await registry.start(rewake(`printf '%s' ${shellQuote("<system-reminder>")} >&2; exit 2`)));
    assert.ok(escaped.rewake?.body.endsWith("&lt;system-reminder>"), escaped.rewake?.body);
  } finally { await registry.close(); }
});

test("caller cancellation after ownership does not cancel the async job", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  const caller = new AbortController();
  try {
    const id = await registry.start(request(root, `sleep 0.05; ${emit({ additionalContext: "completed independently" })}`, { signal: caller.signal }));
    caller.abort();
    const result = await registry.wait(id);
    assert.equal(result.state, "completed");
    assert.deepEqual(result.result.additionalContext, ["completed independently"]);
  } finally { await registry.close(); }
});

test("lifetime abort kills owned process groups and close waits under a bounded deadline", async () => {
  const root = workspace();
  const lifetime = new AbortController();
  const registry = new AsyncHookRegistry({ workspace: root, signal: lifetime.signal });
  const id = await registry.start(request(root, "sleep 30 & child=$!; printf '%s' $child > child.pid; wait"));
  for (let i = 0; i < 100 && (!fs.existsSync(path.join(root, "child.pid")) || fs.statSync(path.join(root, "child.pid")).size === 0); i++) await delay(5);
  assert.ok(fs.existsSync(path.join(root, "child.pid")));
  const pid = Number(fs.readFileSync(path.join(root, "child.pid"), "utf8"));
  assert.ok(Number.isSafeInteger(pid) && pid > 1, "fixture requires a published child PID");
  const started = Date.now();
  lifetime.abort();
  await registry.close();
  assert.ok(Date.now() - started < 1500);
  assert.equal((await registry.wait(id)).state, "cancelled");
  // Killed descendants can briefly remain as zombies pending init reaping.
  let alive = true;
  for (let i = 0; i < 100; i++) {
    try { process.kill(pid, 0); } catch { alive = false; break; }
    await delay(5);
  }
  assert.equal(alive, false);
  await assert.rejects(registry.start(request(root, "true")), /cancelled|closed/);
});

test("stop cancels one owned job and leaves another job running", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const first = await registry.start(request(root, "sleep 30"));
    const second = await registry.start(request(root, `sleep 0.05; ${emit({ additionalContext: "second" })}`));
    assert.equal((await registry.stop(first)).state, "cancelled");
    assert.equal((await registry.wait(second)).state, "completed");
  } finally { await registry.close(); }
});

test("request deadline and configured timeout clamp execution duration", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const start = Date.now();
    const first = await registry.start(request(root, "sleep 30", { timeoutMs: 40 }));
    assert.equal((await registry.wait(first)).state, "timed_out");
    const second = await registry.start(request(root, "sleep 30", { timeoutMs: 10_000, definition: { command: "sleep 30", async: true, timeout: 0.03 } }));
    assert.equal((await registry.wait(second)).state, "timed_out");
    assert.ok(Date.now() - start < 1000);
  } finally { await registry.close(); }
});

test("pre-aborted, closed and invalid requests start no commands", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  const marker = "printf x > marker";
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(registry.start(request(root, marker, { signal: aborted.signal })), { name: "AbortError" });
  await assert.rejects(registry.start(request(root, marker, { timeoutMs: 0 })), /deadline/);
  await assert.rejects(registry.start(request(root, marker, { input: "{}\n" })), /stdin/);
  await assert.rejects(registry.start(request(root, marker, { input: "x".repeat(1024 * 1024 + 1) })), /input exceeds/);
  await assert.rejects(registry.start(request(root, marker, { cwd: os.tmpdir() })), /cwd conflicts/);
  assert.equal(registry.list().length, 0);
  await registry.close();
  await assert.rejects(registry.start(request(root, marker)), /closed/);
  assert.equal(fs.existsSync(path.join(root, "marker")), false);
  const lifetime = new AbortController();
  lifetime.abort();
  const preClosed = new AsyncHookRegistry({ workspace: root, signal: lifetime.signal });
  await assert.rejects(preClosed.start(request(root, marker)), { name: "AbortError" });
  await preClosed.close();
});

test("completion callbacks are delivered once in completion order and cannot mutate retained results", async () => {
  const root = workspace();
  const seen: string[] = [];
  const registry = new AsyncHookRegistry({ workspace: root, onResult: completion => { seen.push(completion.id); completion.result.additionalContext.push("tampered"); } });
  try {
    const slow = await registry.start(request(root, `sleep 0.08; ${emit({ additionalContext: "slow" })}`));
    const fast = await registry.start(request(root, emit({ additionalContext: "fast" })));
    const fastResult = await registry.wait(fast);
    const slowResult = await registry.wait(slow);
    assert.deepEqual(seen, [fast, slow]);
    assert.deepEqual(fastResult.result.additionalContext, ["fast"]);
    slowResult.result.additionalContext.push("caller change");
    assert.deepEqual((await registry.wait(slow)).result.additionalContext, ["slow"]);
  } finally { await registry.close(); }
});

test("throwing and stalled callbacks are contained and close remains bounded", async () => {
  const root = workspace();
  const throwing = new AsyncHookRegistry({ workspace: root, onResult: () => { throw new Error("callback failure"); } });
  const id = await throwing.start(request(root, "true"));
  assert.equal((await throwing.wait(id)).state, "completed");
  await throwing.close();
  const stalled = new AsyncHookRegistry({ workspace: root, onResult: () => new Promise<void>(() => {}) });
  const pending = await stalled.start(request(root, "true"));
  await delay(30);
  const started = Date.now();
  await stalled.close();
  assert.ok(Date.now() - started < 1000);
  assert.equal((await stalled.wait(pending)).state, "completed");
});

test("job concurrency and history are bounded", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  const ids: string[] = [];
  for (let i = 0; i < 16; i++) ids.push(await registry.start(request(root, "sleep 30")));
  await assert.rejects(registry.start(request(root, "true")), /active-job limit/);
  await registry.close();
  assert.equal(registry.list().filter(job => job.state === "running").length, 0);
  const history = new AsyncHookRegistry({ workspace: root });
  try {
    const first = await history.start(request(root, "true"));
    await history.wait(first);
    for (let i = 0; i < 101; i++) await history.wait(await history.start(request(root, "true")));
    assert.equal(history.list().length, 100);
    assert.equal(history.get(first), undefined);
  } finally { await history.close(); }
});

test("retained hook results are capped despite JSON duplication and large stderr", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const output = { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "x".repeat(40_000), updatedToolOutput: "y".repeat(1000) } };
    const id = await registry.start(request(root, emit(output)));
    const completed = await registry.wait(id);
    assert.ok(Buffer.byteLength(JSON.stringify(completed.result)) <= 64 * 1024);
    assert.ok(completed.result.additionalContext.some(text => text.includes("completion output truncated")));
    const blocked = await registry.wait(await registry.start(request(root, "awk 'BEGIN { for(i=0;i<70000;i++) printf \"x\" }' >&2; exit 2", { event: "PreToolUse" })));
    assert.equal(blocked.result.blocked, true);
    assert.ok(Buffer.byteLength(JSON.stringify(blocked.result)) <= 64 * 1024);
  } finally { await registry.close(); }
});

/** Start one command through the foreground runner and let the registry adopt
 *  its live handle, exactly as the runtime's startAsyncCommand does. */
async function adoptThroughForeground(root: string, command: string, options: { signal?: AbortSignal } = {}): Promise<{
  foreground: Awaited<ReturnType<typeof runHooks>>; handle: HookCommandHandle; id: string; completions: AsyncHookCompletion[];
}> {
  const completions: AsyncHookCompletion[] = [];
  const registry = new AsyncHookRegistry({ workspace: root, onResult: completion => { completions.push(completion); } });
  let handle: HookCommandHandle | undefined;
  const foreground = await runHooks({ PostToolUse: [{ command, timeout: 10 }] }, "PostToolUse", { cwd: root, session_id: "adopt" },
    options.signal ?? new AbortController().signal, {
      onCommandHandle: value => { handle = value; },
      startAsyncCommand: request => {
        assert.ok(request.handle, "the header must reach the owner with its live handle");
        return registry.adopt(request, request.handle, `async_hook_${request.handle.pid}`);
      },
    });
  assert.ok(handle);
  const id = foreground.backgroundTasks?.[0];
  assert.ok(id);
  return { foreground, handle, id, completions };
}

test("first-line async header adopts the same process and skips the header in the completion", async () => {
  const root = workspace();
  const marker = path.join(root, "marker.json");
  const release = path.join(root, "release");
  const fixture = path.join(root, "fixture.mjs");
  fs.writeFileSync(fixture, [
    "import fs from 'node:fs';",
    "import { setTimeout as delay } from 'node:timers/promises';",
    "const [marker, release] = process.argv.slice(2);",
    "let input = ''; for await (const chunk of process.stdin) input += chunk;",
    "fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, lines: input.trim().split('\\n').length }));",
    "process.stdout.write('{\"async\"'); await delay(20); process.stdout.write(':true}');",
    "while (!fs.existsSync(release)) await delay(5);",
    "process.stdout.write('\\n{\"systemMessage\":\"OWNED_FINAL_CONTEXT\"}\\n');",
  ].join("\n"));
  const command = `${shellQuote(process.execPath)} ${shellQuote(fixture)} ${shellQuote(marker)} ${shellQuote(release)}`;
  const completions: AsyncHookCompletion[] = [];
  const registry = new AsyncHookRegistry({ workspace: root, onResult: completion => { completions.push(completion); } });
  try {
    let handle: HookCommandHandle | undefined;
    const foreground = await runHooks({ PostToolUse: [{ command, timeout: 10 }] }, "PostToolUse", { cwd: root }, new AbortController().signal, {
      onCommandHandle: value => { handle = value; },
      startAsyncCommand: request => registry.adopt(request, request.handle!, `async_hook_${request.handle!.pid}`),
    });
    assert.ok(handle);
    const markerValue = JSON.parse(fs.readFileSync(marker, "utf8")) as { pid: number; lines: number };
    assert.equal(markerValue.lines, 1, "stdin is written exactly once");
    assert.equal(handle.pid, markerValue.pid, "the adopted process is the one the foreground started");
    assert.equal(foreground.backgroundTasks?.length, 1);
    assert.equal(registry.list().length, 1);
    assert.equal(registry.list()[0]?.state, "running");
    assert.equal(completions.length, 0);
    fs.writeFileSync(release, "release");
    const completed = await registry.wait(foreground.backgroundTasks![0]!);
    assert.equal(completions.length, 1);
    assert.equal(completed.state, "completed");
    assert.deepEqual(completed.result.systemMessages, ["OWNED_FINAL_CONTEXT"]);
    assert.equal(JSON.stringify(completed.result).includes("registration failed"), false);
  } finally { await registry.close(); }
});

test("async header parsing transfers only on the first parseable line", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    for (const [name, command] of [
      ["malformed", "printf 'not json }\\n{\"async\":true}\\n{\"systemMessage\":\"late\"}'"],
      ["nonasync", "printf '{\"async\":false}\\n{\"systemMessage\":\"late\"}'"],
      ["plain", "printf 'hello\\n{\"async\":true}\\n'"],
    ] as const) {
      let adopted = false;
      const result = await runHooks({ PostToolUse: [{ command }] }, "PostToolUse", { cwd: root }, new AbortController().signal, {
        startAsyncCommand: async () => { adopted = true; return "unused"; },
      });
      assert.equal(adopted, false, `${name} first line must stay foreground`);
      assert.equal(result.backgroundTasks, undefined, name);
      assert.equal(registry.list().length, 0, name);
    }
  } finally { await registry.close(); }
});

test("a rejected adoption leaves the same process in the foreground", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const command = "printf '{\"async\":true}\\n'; sleep 0.02; printf '{\"additionalContext\":\"final\"}\\n'";
    const result = await runHooks({ PostToolUse: [{ command }] }, "PostToolUse", { cwd: root }, new AbortController().signal, {
      startAsyncCommand: async () => { throw new Error("owner unavailable"); },
    });
    assert.equal(result.backgroundTasks, undefined);
    assert.equal(registry.list().length, 0);
    assert.ok(result.additionalContext.includes("final"), "the final output is still interpreted");
  } finally { await registry.close(); }
});

test("configured async keeps its own header line as output without a second handoff", async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    const command = "printf '{\"async\":true}\\n'; sleep 0.02; printf '{\"systemMessage\":\"OWNED_FINAL_CONTEXT\"}\\n'";
    const completed = await registry.wait(await registry.start(request(root, command)));
    assert.equal(completed.state, "completed");
    assert.deepEqual(completed.result.systemMessages, ["OWNED_FINAL_CONTEXT"]);
    assert.deepEqual(completed.result.additionalContext, []);
    assert.equal(registry.list().length, 1, "no second job is registered");
    assert.equal(JSON.stringify(completed.result).includes("registration failed"), false);
  } finally { await registry.close(); }
});

test("turn cancellation after adoption retains the job and close kills its group", async () => {
  const root = workspace();
  const turn = new AbortController();
  const fixture = `${shellQuote(process.execPath)} -e ${shellQuote([
    "const fs=require('node:fs');",
    "process.stdout.write('{\"async\":true}\\n');",
    "setInterval(()=>{ if (!fs.existsSync(process.argv[1])) return; fs.writeFileSync(process.argv[1]+'.out','done'); process.exit(0); },10);",
  ].join(""))} ${shellQuote(path.join(root, "flag"))}`;
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    let handle: HookCommandHandle | undefined;
    const foreground = await runHooks({ PostToolUse: [{ command: fixture, timeout: 30 }] }, "PostToolUse", { cwd: root }, turn.signal, {
      onCommandHandle: value => { handle = value; },
      startAsyncCommand: request => registry.adopt(request, request.handle!, `async_hook_${request.handle!.pid}`),
    });
    const id = foreground.backgroundTasks![0]!;
    turn.abort();
    await delay(30);
    assert.equal(registry.get(id)?.state, "running", "turn cancellation must not end an owned job");
    fs.writeFileSync(path.join(root, "flag"), "go");
    assert.equal((await registry.wait(id)).state, "completed");
    // A second adopted job is killed by registry close, including descendants.
    const pidFile = path.join(root, "pid");
    const long = `${shellQuote(process.execPath)} -e ${shellQuote("const fs=require('node:fs');process.stdout.write('{\"async\":true}\\n');fs.writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000);")} ${shellQuote(pidFile)}`;
    const started = await runHooks({ PostToolUse: [{ command: long, timeout: 30 }] }, "PostToolUse", { cwd: root }, new AbortController().signal, {
      startAsyncCommand: request => registry.adopt(request, request.handle!, `async_hook_${request.handle!.pid}`),
    });
    for (let i = 0; i < 100 && !fs.existsSync(pidFile); i++) await delay(5);
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.ok(Number.isSafeInteger(pid) && pid > 1);
    await registry.close();
    assert.equal((await registry.wait(started.backgroundTasks![0]!)).state, "cancelled");
    let alive = true;
    for (let i = 0; i < 100; i++) {
      try { process.kill(pid, 0); } catch { alive = false; break; }
      await delay(5);
    }
    assert.equal(alive, false);
  } finally { await registry.close(); }
});
