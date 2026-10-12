import assert from "node:assert/strict";
import { test } from "node:test";
import { driveMcpTask, McpTaskError, parseTaskHandle } from "../src/mcp-task.js";

const task = (pollIntervalMs?: number) => parseTaskHandle({ resultType: "task", taskId: "fixture", status: "working", pollIntervalMs })!;
const state = (status: string, fields: Record<string, unknown> = {}) => ({ taskId: "fixture", status, ...fields });
const rpc = (code: number) => ({ code, message: "fixture-secret", data: { credential: "fixture-secret" } });
const flush = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };

test("MCP task polling preserves clamps, retry state, cached inputs and parsed terminal results", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const [configured, expected] of [[undefined, 2_000], [-1, 250], [99_999, 30_000]] as const) {
      let polls = 0;
      const work = driveMcpTask({ task: task(configured), signal: new AbortController().signal,
        request: async () => ++polls === 1 ? state("working") : state("completed", { result: { ok: true } }),
        resolveInputRequest: async () => undefined });
      await flush(); assert.equal(polls, 1);
      t.mock.timers.tick(expected - 1); await flush(); assert.equal(polls, 1);
      t.mock.timers.tick(1); await flush(); assert.deepEqual(await work, { ok: true });
    }

    let polls = 0, updates = 0, resolved = 0;
    const input = state("input_required", { inputRequests: { form: { method: "elicitation/create", params: {} } } });
    const work = driveMcpTask({ task: task(250), signal: new AbortController().signal,
      request: async (method, params) => {
        if (method === "tasks/get") { polls++; return updates < 2 ? input : state("completed", { result: { content: [] } }); }
        assert.equal(method, "tasks/update");
        assert.deepEqual(params.inputResponses, Object.assign(Object.create(null), { form: { action: "accept" } }));
        if (++updates === 1) throw rpc(-32603);
        return {};
      }, resolveInputRequest: async () => { resolved++; return { action: "accept" }; } });
    await flush(); t.mock.timers.tick(250); await flush(); t.mock.timers.tick(250); await flush();
    assert.deepEqual(await work, { content: [] }); assert.equal(resolved, 1); assert.equal(polls, 3); assert.equal(updates, 2);

    let served = 0, keys: string[] = [];
    const capped = driveMcpTask({ task: task(250), signal: new AbortController().signal,
      request: async (method, params) => {
        if (method === "tasks/update") { keys = Object.keys(params.inputResponses as object); return {}; }
        return keys.length ? state("completed") : state("input_required", {
          inputRequests: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, { method: "roots/list" }])) });
      }, resolveInputRequest: async () => { served++; return { roots: [] }; } });
    await flush(); await flush(); t.mock.timers.tick(250); await flush();
    assert.deepEqual(await capped, {}); assert.equal(served, 16); assert.equal(keys.length, 16);

    for (const [code, expectedPolls] of [[-32603, 5], [-32700, 5], [-32099, 5], [-32003, 1], [-32602, 1]] as const) {
      let attempts = 0;
      const failed = driveMcpTask({ task: task(250), signal: new AbortController().signal,
        request: async () => { attempts++; throw rpc(code); }, resolveInputRequest: async () => undefined });
      const checked = assert.rejects(failed, (error: McpTaskError) => error.kind === "poll_failed" && !error.message.includes("fixture-secret") && !("data" in error));
      await flush();
      for (let i = 1; i < expectedPolls; i++) { t.mock.timers.tick(250); await flush(); }
      await checked; assert.equal(attempts, expectedPolls);
    }

    let attempts = 0;
    const reset = driveMcpTask({ task: task(250), signal: new AbortController().signal,
      request: async () => {
        attempts++;
        if (attempts === 5) return state("working");
        if (attempts === 10) return state("completed");
        throw new Error("fixture-secret");
      }, resolveInputRequest: async () => undefined });
    await flush(); for (let i = 0; i < 9; i++) { t.mock.timers.tick(250); await flush(); }
    assert.deepEqual(await reset, {}); assert.equal(attempts, 10);

    for (const code of [-32602, -32601, -32003]) {
      let polls = 0, updates = 0;
      const rejected = driveMcpTask({ task: task(250), signal: new AbortController().signal,
        request: async (method) => {
          if (method === "tasks/get") { polls++; return input; }
          if (method === "tasks/update") { updates++; throw rpc(code); }
          return {};
        }, resolveInputRequest: async () => ({ action: "accept" }) });
      const checked = assert.rejects(rejected, { kind: code === -32602 ? "unsupported_input" : "poll_failed" });
      await flush(); if (code === -32602) { t.mock.timers.tick(250); await flush(); }
      await checked; assert.equal(updates, 1); assert.equal(polls, code === -32602 ? 2 : 1);
    }
  } finally { t.mock.timers.reset(); }
});

test("MCP task validation, unsupported input and lifecycle cancellation sanitize errors and await bounded cleanup", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(parseTaskHandle({ content: [] }), undefined);
    for (const invalid of [state("secret"), state("working", { taskId: "bad\nfixture-secret" }),
      state("working", { pollIntervalMs: NaN }), state("working", { ttlMs: Infinity })]) {
      assert.throws(() => parseTaskHandle({ ...invalid, resultType: "task" }), { kind: "malformed" });
    }
    for (const response of [state("completed", { taskId: "different", result: { secret: true } }),
      state("working", { pollIntervalMs: Infinity }), state("completed", { result: "fixture-secret" }),
      state("input_required", { inputRequests: { sample: { method: "sampling/createMessage" } } }),
      state("failed", { error: { code: -32602, message: "fixture-secret", data: { secret: true } } }), state("cancelled", { statusMessage: "fixture-secret" })]) {
      let cancels = 0, callbacks = 0;
      const kind = response.status === "input_required" ? "unsupported_input" : response.status === "failed" ? "failed"
        : response.status === "cancelled" ? "cancelled" : "malformed";
      await assert.rejects(driveMcpTask({ task: task(), signal: new AbortController().signal,
        request: async (method) => { if (method === "tasks/cancel") { cancels++; return {}; } return response; },
        resolveInputRequest: async () => { callbacks++; return {}; } }), (error: McpTaskError) => error.kind === kind && !error.message.includes("fixture-secret") && !("data" in error));
      assert.equal(callbacks, 0); assert.equal(cancels, kind === "failed" || response.status === "cancelled" ? 0 : 1);
    }

    for (const phase of ["wait", "poll", "input", "update"] as const) {
      const owner = new AbortController();
      let cancelSignal: AbortSignal | undefined, finishCancel!: () => void, settled = false;
      const work = driveMcpTask({ task: task(250), signal: owner.signal,
        request: async (method, _params, requestSignal) => {
          if (method === "tasks/cancel") { cancelSignal = requestSignal; await new Promise<void>((resolve) => { finishCancel = resolve; }); return {}; }
          if (phase === "poll" || (phase === "update" && method === "tasks/update")) return new Promise(() => {});
          return phase === "wait" ? state("working") : state("input_required", { inputRequests: { roots: { method: "roots/list" } } });
        }, resolveInputRequest: async () => phase === "input" ? new Promise(() => {}) : { roots: [] } });
      const checked = assert.rejects(work, { kind: "cancelled" }).then(() => { settled = true; });
      await flush(); owner.abort("fixture-secret"); await flush();
      assert.ok(cancelSignal); assert.notEqual(cancelSignal, owner.signal); assert.equal(cancelSignal.aborted, false);
      assert.equal(settled, false); finishCancel(); await checked;
    }

    const owner = new AbortController(); owner.abort();
    let cancels = 0;
    const bounded = driveMcpTask({ task: task(), signal: owner.signal,
      request: async (method) => { assert.equal(method, "tasks/cancel"); cancels++; return new Promise(() => {}); },
      resolveInputRequest: async () => undefined });
    let finished = false;
    const checked = assert.rejects(bounded, { kind: "cancelled" }).then(() => { finished = true; });
    await flush(); t.mock.timers.tick(4_999); await flush(); assert.equal(finished, false);
    t.mock.timers.tick(1); await checked; assert.equal(cancels, 1);
  } finally { t.mock.timers.reset(); }
});
