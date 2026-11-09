import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { spawnSync } from 'node:child_process';
import { AsyncHookRegistry, type AsyncHookCompletion, type AsyncHookObserver } from "../src/async-hooks.js";
import { Session } from '../src/session.js';
import { defaultConfig } from '../src/agent.js';
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

test('root-bound lifecycle admits actual configured/adopted commands and rejects forged, reused and foreign capabilities', async () => {
  const root = workspace(), owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  const foreign = Session.open(root, { config: owner.config });
  const record = owner.recordAsyncHookLifecycle.bind(owner); let captured: object | undefined;
  const append = owner.append.bind(owner); let capturedWrite: object | undefined;
  owner.append = (...args) => { if (args[4]) capturedWrite = args[4]; return append(...args); };
  owner.recordAsyncHookLifecycle = token => { captured = token; record(token); };
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: () => {} });
  try {
    await assert.rejects(registry.start(request(root, 'touch forbidden')), /owner mismatch/);
    for (const adopted of [false, true]) {
      const command = (adopted ? `printf '%s\\n' '{"async":true}'; sleep 0.03; ` : '') + 'printf x >> effects';
      const result = await runHooks({ SessionStart: [{ command, ...(!adopted ? { async: true } : {}) }] }, 'SessionStart',
        { cwd: root, session_id: owner.id }, new AbortController().signal, { startAsyncCommand: req =>
          req.handle ? registry.adopt(req, req.handle, 'lifecycle') : registry.start(req) });
      assert.equal(result.backgroundTasks?.length, 1); await registry.wait(result.backgroundTasks![0]!);
    }
    const rows = owner.events.filter(row => row.kind === 'async_hook_lifecycle');
    assert.equal(rows.length, 8);
    assert.equal(new Set(rows.map(row => row.generation)).size, 1);
    assert.deepEqual(rows.filter(row => row.transition.phase === 'admitted').map(row => row.transition),
      [{ phase: 'admitted', mode: 'configured' }, { phase: 'admitted', mode: 'adopted' }]);
    assert.throws(() => owner.append(rows[0]!), /authorization invalid/);
    assert.throws(() => append(rows.at(-1)!, undefined, undefined, undefined, capturedWrite), /authorization invalid/);
    assert.throws(() => owner.recordAsyncHookLifecycle({}), /authorization invalid/);
    assert.throws(() => owner.recordAsyncHookLifecycle(captured!), /authorization invalid/);
    owner.append = (...args) => {
      const [row, ...rest] = args;
      if (row.kind === 'async_hook_lifecycle') return append({ ...row, owner: foreign.id }, ...rest);
      return append(...args);
    };
    await assert.rejects(registry.start(request(root, 'touch forbidden', { payload: { cwd: root, session_id: owner.id } })), /authorization invalid/);
    owner.append = append;
    owner.recordAsyncHookLifecycle = token => foreign.recordAsyncHookLifecycle(token);
    await assert.rejects(registry.start(request(root, 'touch forbidden', { payload: { cwd: root, session_id: owner.id } })), /authorization invalid/);
    assert.equal(fs.existsSync(path.join(root, 'forbidden')), false);
    assert.equal(fs.readFileSync(path.join(root, 'effects'), 'utf8'), 'xx');
    await registry.close(); await owner.close();
    const cold = Session.open(root, { id: owner.id });
    try { assert.deepEqual(cold.events.filter(row => row.kind === 'async_hook_lifecycle'), rows); } finally { await cold.close(); }
    const contents = fs.readFileSync(owner.file, 'utf8');
    const records = contents.trimEnd().split('\n').map(line => JSON.parse(line));
    const admission = records.findIndex(row => row.kind === 'async_hook_lifecycle'); records.splice(admission, 1);
    fs.writeFileSync(owner.file, records.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.throws(() => Session.open(root, { id: owner.id }), /lifecycle identity mismatch/);
    fs.writeFileSync(owner.file, contents);
  } finally { owner.recordAsyncHookLifecycle = record; await registry.close(); await owner.close(); await foreign.close(); }
});

test('lifecycle journal failures stop publication and failed adoption keeps foreground cancellation', async () => {
  for (const phase of ['admitted', 'completed', 'pending', 'returned']) {
    const root = workspace(), owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    const append = owner.append.bind(owner); let callback = false;
    owner.append = (...args) => {
      const row = args[0];
      if (row.kind === 'async_hook_lifecycle' && (row.transition.phase === phase || row.transition.phase === 'callback' && row.transition.state === phase))
        throw Error('injected lifecycle journal failure');
      return append(...args);
    };
    const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: () => { callback = true; } });
    try {
      const start = registry.start(request(root, 'touch effect', { payload: { cwd: root, session_id: owner.id } }));
      if (phase === 'admitted') { await assert.rejects(start, /journal failure/); await registry.close(); }
      else { await registry.wait(await start); await assert.rejects(registry.close(), /journal failure/); }
      assert.equal(fs.existsSync(path.join(root, 'effect')), phase !== 'admitted');
      assert.equal(callback, phase === 'returned');
      if (phase === 'admitted') {
        const result = await runHooks({ SessionStart: [{ command: `printf '%s\\n' '{"async":true}'; sleep 3; touch forbidden`, timeout: 0.1 }] },
          'SessionStart', { cwd: root, session_id: owner.id }, new AbortController().signal,
          { startAsyncCommand: async req => {
            const adopted = new AsyncHookRegistry({ workspace: root, journalOwner: owner });
            try { return await adopted.adopt(req, req.handle!, 'journal-failure'); } finally { await adopted.close(); }
          } });
        assert.equal(result.backgroundTasks?.length ?? 0, 0);
        assert.equal(fs.existsSync(path.join(root, 'forbidden')), false);
        assert.match(JSON.stringify(result), /timed out/);
      }
    } finally { await registry.close().catch(() => {}); await owner.close(); }
  }
});

test('late callback settlement stays pending in the original journal after bounded close and reopening', async () => {
  const root = workspace(), owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: async () => { await gate; throw Error('late'); } });
  try {
    const id = await registry.start(request(root, 'printf ok', { payload: { cwd: root, session_id: owner.id } }));
    await registry.wait(id); await registry.close(); await owner.close();
    const cold = Session.open(root, { id: owner.id });
    try {
      const before = fs.readFileSync(cold.file, 'utf8'); release(); await delay(20);
      assert.equal(fs.readFileSync(cold.file, 'utf8'), before);
      const descriptor = registry.get(id); assert.ok(descriptor?.state !== 'running');
      assert.equal(descriptor?.callbackState, 'threw');
      assert.deepEqual(cold.events.filter(row => row.kind === 'async_hook_lifecycle').map(row => row.transition.phase), ['admitted', 'completed', 'callback']);
      const last = cold.events.at(-1); assert.ok(last?.kind === 'async_hook_lifecycle');
      assert.deepEqual(last.transition, { phase: 'callback', state: 'pending' });
    } finally { await cold.close(); }
  } finally { release(); await registry.close(); await owner.close(); }
});

test('nested observer capability stays with its actual job and rejects duplicate, fabricated and retired calls', async () => {
  const root = workspace(), owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  let saved: AsyncHookObserver | undefined, effects = 0;
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: async (completion, observe) => {
    saved = observe; completion.id = 'forged'; completion.result.terminalSequences?.push('forged');
    await assert.rejects(observe({ kind: 'terminal', index: 1 }, () => { effects++; }), /invocation invalid/);
    const observer = { kind: 'terminal', index: 0 } as const;
    await observe(observer, () => { effects++; });
    await assert.rejects(observe(observer, () => { effects++; }), /invocation invalid/);
    await observe({ kind: 'completion' }, () => { effects++; });
  } });
  try {
    const id = await registry.start(request(root, `printf '%s' '{"terminalSequence":"\\u001b]2;bound\\u0007"}'`,
      { payload: { cwd: root, session_id: owner.id } }));
    await registry.wait(id); assert.equal(effects, 2); assert.ok(saved);
    await assert.rejects(saved({ kind: 'completion' }, () => { effects++; }), /owner retired/);
    const rows = owner.events.filter(row => row.kind === 'async_hook_lifecycle');
    assert.ok(rows.every(row => row.jobId === id && row.owner === owner.id));
    const observerRows = rows.filter(row => row.transition.phase === 'observer'); assert.equal(observerRows.length, 4);
    assert.throws(() => owner.append(observerRows[0]!), /authorization invalid/);
    assert.throws(() => owner.append({ kind: 'hook_observer', id, owner: owner.id, jobId: id,
      observer: { kind: 'completion' }, state: 'returned' }), /read-only/);
    await registry.close(); await owner.close();
    const original = fs.readFileSync(owner.file, 'utf8');
    const cold = Session.open(root, { id: owner.id });
    try { await assert.rejects(saved({ kind: 'completion' }, () => { effects++; }), /owner retired/); }
    finally { await cold.close(); }
    assert.equal(effects, 2); assert.equal(fs.readFileSync(owner.file, 'utf8'), original);
    const records = original.trimEnd().split('\n').map(line => JSON.parse(line));
    for (const corrupt of ['missing-pending', 'changed-observer', 'duplicate-settlement']) {
      const altered = structuredClone(records);
      const index = altered.findIndex(row => row.kind === 'async_hook_lifecycle' && row.transition.phase === 'observer');
      if (corrupt === 'missing-pending') altered.splice(index, 1);
      else if (corrupt === 'changed-observer') altered[index + 1].transition.observer.index = 1;
      else altered.splice(index + 2, 0, structuredClone(altered[index + 1]));
      fs.writeFileSync(owner.file, altered.map(row => JSON.stringify(row)).join('\n') + '\n');
      assert.throws(() => Session.open(root, { id: owner.id }), /observer settlement identity invalid/);
    }
    const historical = { kind: 'hook_observer', id, owner: owner.id, jobId: id, observer: { kind: 'completion' }, state: 'returned' };
    fs.writeFileSync(owner.file, original + JSON.stringify(historical) + '\n');
    const legacy = Session.open(root, { id: owner.id });
    try { assert.deepEqual(legacy.events.at(-1), historical); }
    finally { await legacy.close(); }
  } finally { await registry.close(); await owner.close(); }
});

test('outer callback return does not settle an in-flight nested observer', async () => {
  const root = workspace(), owner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  let release!: () => void, pending: Promise<void> | undefined, late: Promise<void> | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: owner, onResult: (_completion, observe) => {
    pending = observe({ kind: 'completion' }, async () => { await gate; throw Error('nested failure'); });
    late = Promise.resolve().then(() => assert.rejects(observe({ kind: 'terminal', index: 0 }, () => {
      throw Error('retired observer invoked');
    }), /owner retired/));
  } });
  try {
    const id = await registry.start(request(root, 'printf ok', { payload: { cwd: root, session_id: owner.id } }));
    await registry.wait(id); await late;
    const before = owner.events.filter(row => row.kind === 'async_hook_lifecycle').map(row => row.transition);
    assert.deepEqual(before.at(-1), { phase: 'callback', state: 'returned' });
    assert.ok(before.some(row => row.phase === 'observer' && row.state === 'pending'));
    assert.equal(before.some(row => row.phase === 'observer' && row.state !== 'pending'), false);
    release(); await pending; await registry.close(); await owner.close();
    const cold = Session.open(root, { id: owner.id });
    try {
      const last = cold.events.at(-1);
      assert.ok(last?.kind === 'async_hook_lifecycle' && last.transition.phase === 'observer');
      assert.equal(last.transition.state, 'threw');
    } finally { await cold.close(); }
  } finally { release(); await pending; await registry.close(); await owner.close(); }
});

test('plugin origin survives configured and header-adopted completion and rejects changed adoption identity', async () => {
  const root = workspace();
  const registry = new AsyncHookRegistry({ workspace: root });
  try {
    for (const adopted of [false, true]) {
      const pluginOrigin = { id: 'local:fixture', name: 'fixture', root };
      const command = (adopted ? `printf '%s\\n' '{"async":true}'; sleep 0.05; ` : '') + `printf '%s' '{"systemMessage":"visible"}'`;
      let rejected = false;
      const result = await runHooks({ SessionStart: [{ pluginOrigin, hooks: [{ command, ...(!adopted ? { async: true } : {}) }] }] },
        'SessionStart', { cwd: root }, new AbortController().signal, { startAsyncCommand: async req => {
          assert.equal(req.pluginId, 'local:fixture');
          if (req.handle) {
            await assert.rejects(registry.adopt({ ...req, pluginId: 'other' }, req.handle, 'wrong'), /original live command/);
            rejected = true;
          }
          const id = req.handle ? await registry.adopt(req, req.handle, 'original') : await registry.start(req);
          req.pluginId = 'mutated'; pluginOrigin.id = 'mutated';
          return id;
        } });
      assert.equal(rejected, adopted); assert.equal(result.backgroundTasks?.length, 1);
      const completion = await registry.wait(result.backgroundTasks![0]!);
      assert.equal(completion.delivery.kind, 'attachment');
      if (completion.delivery.kind === 'attachment') assert.equal(completion.delivery.attachment.pluginId, 'local:fixture');
    }
  } finally { await registry.close(); }
});
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

test('process completion and bounded close preserve the actual callback settlement', async () => {
  for (const route of ['configured', 'adopted'] as const) for (const outcome of ['returned', 'threw'] as const) {
    const root = workspace(), effect = path.join(root, 'callback-effect'), processRelease = path.join(root, 'process-release');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const registry = new AsyncHookRegistry({ workspace: root, onResult: async () => {
      await gate; fs.writeFileSync(effect, outcome);
      if (outcome === 'threw') throw new Error('late callback failure');
    } });
    try {
      let id: string;
      if (route === 'configured') id = await registry.start(request(root, emit({})));
      else {
        const command = `printf '%s\\n' '{"async":true}'; while [ ! -f ${shellQuote(processRelease)} ]; do sleep 0.01; done; printf '{}'`;
        const foreground = await runHooks({ PostToolUse: [{ command }] }, 'PostToolUse', { cwd: root }, new AbortController().signal, {
          startAsyncCommand: async request => { assert.ok(request.handle); return registry.adopt(request, request.handle, 'callback-adoption'); },
        });
        assert.equal(foreground.backgroundTasks?.length, 1); id = foreground.backgroundTasks![0]!;
        fs.writeFileSync(processRelease, 'release');
      }
      assert.equal((await registry.wait(id)).state, 'completed');
      const read = () => {
        const descriptor = registry.get(id); assert.ok(descriptor);
        return descriptor.state === 'running' ? 'running' : descriptor.callbackState;
      };
      assert.equal(read(), 'pending'); assert.equal(fs.existsSync(effect), false);
      const snapshot = registry.get(id); assert.ok(snapshot);
      Object.assign(snapshot, { callbackState: 'returned' }); assert.equal(read(), 'pending');
      await registry.close(); assert.equal(read(), 'pending'); assert.equal(fs.existsSync(effect), false);
      release(); await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(fs.readFileSync(effect, 'utf8'), outcome); assert.equal(read(), outcome);
      assert.equal((await registry.wait(id)).state, 'completed');
    } finally { release(); await new Promise<void>(resolve => setImmediate(resolve)); await registry.close(); }
  }
  const root = workspace(), plain = new AsyncHookRegistry({ workspace: root });
  try {
    const id = await plain.start(request(root, 'true')); await plain.wait(id);
    const descriptor = plain.get(id); assert.ok(descriptor);
    if (descriptor.state === 'running') assert.fail('wait returned before process completion');
    assert.equal(descriptor.callbackState, 'none'); assert.equal(plain.get('missing'), undefined);
  } finally { await plain.close(); }
});

test('compiled CLI distinguishes a completed hook process from its held completion callback', { timeout: 30000 }, () => {
  for (const outcome of ['returned', 'threw'] as const) {
    const root = workspace(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
    const preload = path.join(root, 'callback-provider.mjs'), observed = path.join(root, 'callback-state.json'), marker = path.join(root, 'callback-effect');
    fs.mkdirSync(user); fs.mkdirSync(settings); fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ command: 'printf "{}"', async: true }] } }));
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
      const {AsyncHookRegistry}=await import(${JSON.stringify(new URL('../dist/async-hooks.js', import.meta.url).href)});
      const finish=AsyncHookRegistry.prototype.finish,close=AsyncHookRegistry.prototype.close;let open,entered;
      const gate=new Promise(resolve=>open=resolve),started=new Promise(resolve=>entered=resolve),closing=new WeakMap;
      AsyncHookRegistry.prototype.finish=function(...args){const notify=this.onResult;this.onResult=async completion=>{
        await notify?.(completion);entered();await gate;fs.writeFileSync(${JSON.stringify(marker)},'LATE_CALLBACK_EFFECT');
        if(${JSON.stringify(outcome)}==='threw')throw Error('late fixture failure')};return finish.apply(this,args)};
      AsyncHookRegistry.prototype.close=function(){let done=closing.get(this);if(done)return done;done=(async()=>{
        await started;const id=this.list()[0].id,completion=await this.wait(id),afterWait=this.get(id);await close.call(this);
        const afterClose=this.get(id),beforeEffect=fs.existsSync(${JSON.stringify(marker)});open();await new Promise(resolve=>setImmediate(resolve));
        fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify({process:completion.state,afterWait:afterWait.callbackState,
          afterClose:afterClose.callbackState,beforeEffect,afterCallback:this.get(id).callbackState,effect:fs.readFileSync(${JSON.stringify(marker)},'utf8')}));
      })();closing.set(this,done);return done};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let n=0;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{const first=n++===0;
        const content=first?[{type:'tool_use',id:'callback-write',name:'write_file',input:{path:'value.txt',content:'CLI_CALLBACK'}}]:[{type:'text',text:'done'}];
        if(!first)onText?.('done');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason:first?'tool_use':'end_turn',
          stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
    const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture-model',
      '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], { cwd: process.cwd(),
      input: 'write the callback fixture\n/exit\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(cli.status, 0, cli.stderr + cli.stdout); assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'CLI_CALLBACK');
    assert.deepEqual(JSON.parse(fs.readFileSync(observed, 'utf8')), { process: 'completed', afterWait: 'pending', afterClose: 'pending',
      beforeEffect: false, afterCallback: outcome, effect: 'LATE_CALLBACK_EFFECT' });
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(file => file.endsWith('.lock')), false);
  }
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

test('adoption binds the original live command and request before transferring ownership', async () => {
  for (const mode of ['copy', 'proxy', 'command', 'stdin', 'deadline', 'signal', 'home', 'done', 'kill'] as const) {
    const root = workspace(), controller = new AbortController();
    const registry = new AsyncHookRegistry({ workspace: root });
    const other = new AsyncHookRegistry({ workspace: root });
    let kill: (() => void) | undefined;
    let accessed = 0;
    let admissionChecked = false;
    try {
      const result = await runHooks({ PostToolUse: [{ command: `printf '{"async":true}\\n'; sleep 10`, timeout: 15 }] },
        'PostToolUse', { cwd: root }, controller.signal, { startAsyncCommand: async original => {
          const handle = original.handle; assert.ok(handle); kill = handle.kill;
          let candidate = handle, changed = { ...original };
          const descriptors = Object.getOwnPropertyDescriptors(handle);
          if (mode === 'copy') candidate = { ...handle };
          if (mode === 'proxy') candidate = new Proxy(handle, {});
          if (mode === 'command') changed.definition = { command: 'true' };
          if (mode === 'stdin') {
            changed.payload = { ...original.payload, session_id: 'other' };
            changed.input = `${JSON.stringify({ ...changed.payload, hook_event_name: changed.event })}\n`;
          }
          if (mode === 'deadline') changed.timeoutMs++;
          if (mode === 'signal') changed.signal = new AbortController().signal;
          if (mode === 'home') changed.commandHome = { value: root };
          if (mode === 'done') Object.defineProperty(handle, 'done', { configurable: true, get: () => { accessed++; return Promise.resolve({ stdout: '', stderr: '', code: 0, timedOut: false, aborted: false, truncated: false, spawnError: null }); } });
          if (mode === 'kill') handle.kill = () => { accessed++; };
          try { await assert.rejects(registry.adopt(changed, candidate, 'invalid'), /original live command/, mode); }
          finally { Object.defineProperties(handle, descriptors); }
          assert.equal(accessed, 0, 'rejected bindings must not execute');
          assert.deepEqual(registry.list(), []);
          if (mode === 'signal') {
            controller.abort();
            await assert.rejects(registry.adopt(original, handle, 'cancelled'), /cancelled before start/);
            assert.deepEqual(registry.list(), []);
            admissionChecked = true;
            throw new Error('retain cancelled foreground');
          }
          const id = await registry.adopt(original, handle, 'accepted');
          await assert.rejects(other.adopt(original, handle, 'duplicate'), /original live command/);
          admissionChecked = true;
          return id;
        } });
      assert.equal(admissionChecked, true, `all admission checks completed for ${mode}`);
      if (mode === 'signal') { assert.equal(result.backgroundTasks, undefined); continue; }
      assert.equal(result.backgroundTasks?.length, 1, mode);
      await registry.close();
      const completion = await registry.wait(result.backgroundTasks![0]!);
      assert.equal(completion.state, 'cancelled');
    } finally { kill?.(); await registry.close(); await other.close(); }
  }
});

test('accepted adoption pins process teardown and completion and forwards command HOME', async () => {
  const root = workspace(), home = path.join(root, 'hook-home'); fs.mkdirSync(home);
  const completions: AsyncHookCompletion[] = [];
  const registry = new AsyncHookRegistry({ workspace: root, onResult: completion => { completions.push(completion); } });
  let originalKill: (() => void) | undefined, changedCalls = 0;
  try {
    const result = await runHooks({ PostToolUse: [{ command: `printf '%s' "$HOME" > actual-home; printf '{"async":true}\\n'; sleep 10; touch late`, timeout: 15 }] },
      'PostToolUse', { cwd: root }, new AbortController().signal, { commandHome: () => ({ value: home }), startAsyncCommand: async request => {
        const handle = request.handle; assert.ok(handle); originalKill = handle.kill;
        assert.deepEqual(request.commandHome, { value: home });
        void handle.done.then(raw => { raw.code = 0; raw.aborted = false; raw.stdout = '{}'; });
        Object.defineProperty(handle.done, 'then', { get: () => { changedCalls++; throw Error('replaced subscription'); } });
        const id = await registry.adopt(request, handle, 'home');
        handle.kill = () => { changedCalls++; };
        Object.defineProperty(handle, 'done', { configurable: true, get: () => { changedCalls++; throw Error('replaced completion'); } });
        request.event = 'Stop'; request.timeoutMs = 1;
        return id;
      } });
    assert.equal(result.backgroundTasks?.length, 1);
    await registry.close();
    const completion = await registry.wait(result.backgroundTasks![0]!);
    assert.equal(completion.state, 'cancelled'); assert.equal(completion.event, 'PostToolUse');
    assert.equal(changedCalls, 0); assert.equal(completions.length, 1);
    assert.equal(fs.readFileSync(path.join(root, 'actual-home'), 'utf8'), home);
    assert.equal(fs.existsSync(path.join(root, 'late')), false);
  } finally { originalKill?.(); await registry.close(); }
});

test('compiled CLI adopts one actual command and retains its tool correlation', { timeout: 30000 }, () => {
  const root = workspace(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
  const preload = path.join(root, 'binding-provider.mjs'), observed = path.join(root, 'completion.json');
  const release = path.join(root, 'release'), runs = path.join(root, 'runs');
  fs.mkdirSync(user); fs.mkdirSync(settings); fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: { PostToolUse: [{
    command: `printf x >> ${shellQuote(runs)}; printf '{"async":true}\\n'; while [ ! -f ${shellQuote(release)} ]; do sleep 0.01; done; printf '{"systemMessage":"ACTUAL_COMMAND"}\\n'`, timeout: 10,
  }] } }));
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
    const {AsyncHookRegistry}=await import(${JSON.stringify(new URL('../dist/async-hooks.js', import.meta.url).href)});
    const close=AsyncHookRegistry.prototype.close;const closing=new WeakMap;
    AsyncHookRegistry.prototype.close=function(){let pending=closing.get(this);if(pending)return pending;
      pending=(async()=>{const jobs=this.list();const results=await Promise.all(jobs.map(job=>this.wait(job.id)));
        fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify(results));await close.call(this)})();closing.set(this,pending);return pending};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let n=0;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const first=n++===0;
      if(!first)fs.writeFileSync(${JSON.stringify(release)},'release');
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',
        content:first?[{type:'tool_use',id:'binding-write',name:'write_file',input:{path:'value.txt',content:'BOUND'}}]:[{type:'text',text:'done'}],
        stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user,
    '--model', 'fixture-model', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
    cwd: process.cwd(), input: 'write the bound fixture\n/exit\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
  });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'BOUND');
  assert.equal(fs.readFileSync(runs, 'utf8'), 'x');
  const completed: AsyncHookCompletion[] = JSON.parse(fs.readFileSync(observed, 'utf8'));
  assert.equal(completed.length, 1); assert.equal(completed[0]?.state, 'completed');
  assert.equal(completed[0]?.payload.tool_use_id, 'binding-write');
  assert.deepEqual(completed[0]?.result.systemMessages, ['ACTUAL_COMMAND']);
  assert.equal(fs.readdirSync(path.join(root, '.agent')).some(file => file.endsWith('.lock')), false);
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

test("rejected async adoption retains foreground cancellation and deadline", async () => {
  for (const mode of ['cancel', 'deadline'] as const) {
    const root = workspace();
    const marker = path.join(root, 'unowned-effect');
    const controller = new AbortController();
    let handle: HookCommandHandle | undefined;
    let accepted = false;
    const command = `printf '{"async":true}\\n'; sleep 0.6; touch '${marker}'; printf '{"systemMessage":"late"}\\n'`;
    try {
      const result = await runHooks({ PostToolUse: [{ command, timeout: mode === 'deadline' ? 0.25 : 5 }] },
        'PostToolUse', { cwd: root }, controller.signal, {
          onCommandHandle: value => { handle = value; },
          startAsyncCommand: async () => {
            accepted = true;
            if (mode === 'cancel') controller.abort();
            throw new Error('owned registration rejection');
          },
        });
      assert.equal(accepted, true, 'the first-line candidate reached the owner');
      assert.ok(handle);
      const raw = await handle.done;
      assert.equal(mode === 'cancel' ? raw.aborted : raw.timedOut, true, mode);
      assert.equal(result.backgroundTasks, undefined);
      assert.equal(fs.existsSync(marker), false, 'rejected ownership must not detach foreground protection');
    } finally { handle?.kill(); handle?.cleanup(); }
  }
});

test('compiled CLI retains deadline when a full async owner rejects a header', { timeout: 30000 }, () => {
  const root = workspace(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
  const marker = path.join(root, 'unowned-effect'), preload = path.join(root, 'provider.mjs');
  const candidate = path.join(root, 'candidate-entered'), ownerState = path.join(root, 'owner-state.json');
  fs.mkdirSync(user); fs.mkdirSync(settings); fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: { PostToolUse: [
    ...Array.from({ length: 16 }, () => ({ command: 'sleep 30', async: true })),
    { command: `touch '${candidate}'; printf '{"async":true}\\n'; sleep 0.6; touch '${marker}'`, timeout: 0.25 },
  ] } }));
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
    const {AsyncHookRegistry}=await import(${JSON.stringify(new URL('../dist/async-hooks.js', import.meta.url).href)});
    const close=AsyncHookRegistry.prototype.close;
    AsyncHookRegistry.prototype.close=function(){if(!fs.existsSync(${JSON.stringify(ownerState)}))
      fs.writeFileSync(${JSON.stringify(ownerState)},JSON.stringify(this.list()));return close.call(this)};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let n=0;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const first=n++===0;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',
        content:first?[{type:'tool_use',id:'owned-write',name:'write_file',input:{path:'value.txt',content:'OWNED'}}]:[{type:'text',text:'done'}],
        stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user,
    '--model', 'fixture-model', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
    cwd: process.cwd(), input: 'write the owned fixture\n/exit\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
  });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'OWNED');
  assert.equal(fs.existsSync(candidate), true, 'the rejected header command actually ran');
  const jobs: { state: string }[] = JSON.parse(fs.readFileSync(ownerState, 'utf8'));
  assert.equal(jobs.length, 16, 'the actual runtime owner reached its active limit');
  assert(jobs.every(job => job.state === 'running'));
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.readdirSync(path.join(root, '.agent')).some(file => file.endsWith('.lock')), false);
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
    for (let i = 0; i < 100 && (!fs.existsSync(pidFile) || fs.statSync(pidFile).size === 0); i++) await delay(5);
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
