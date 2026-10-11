import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  flattenHookDefinitions, HookLifecycle, hookDefinitionSchema, hookEntrySchema,
  hooksSchema, hooksSettingsSchema, MAX_HOOK_DEFINITIONS, runHooks,
  type HookDefinition, type HooksConfig,
} from "../src/hooks.js";

const signal = () => new AbortController().signal;
const context = (text: string): HookDefinition => ({ command: `printf '%s' '${JSON.stringify({ additionalContext: text })}'` });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("mixed matcher groups retain entry and inner positions and execution order", async () => {
  const config: HooksConfig = { PreToolUse: [
    context("flat"),
    { matcher: "Read|Write", hooks: [context("group"), { ...context("write"), matcher: "Write" }, { ...context("miss"), matcher: "Bash" }] },
    { hooks: [context("unmatched group")] },
    context("last"),
  ] };
  assert.deepEqual(hooksSchema.parse(config), config);
  const entries = flattenHookDefinitions(config, "PreToolUse");
  assert.deepEqual(entries.map(entry => [entry.entryIndex, entry.innerIndex]), [[0, null], [1, 0], [1, 1], [1, 2], [2, 0], [3, null]]);
  assert.deepEqual(entries[2]!.matchers, ["Read|Write", "Write"]);
  assert.equal(entries[2]!.matches("Write"), true);
  assert.equal(entries[2]!.matches("Read"), false);
  assert.equal(entries[3]!.matches("Bash"), false);
  assert.equal(new Set(entries.map(entry => entry.identity.key)).size, entries.length);
  const result = await runHooks(config, "PreToolUse", { tool_name: "Write" });
  assert.deepEqual(result.additionalContext, ["flat", "group", "write", "unmatched group", "last"]);
  assert.equal(result.consumedOnce, undefined);
});

test("group and inner matchers intersect for exact, regex, wildcard and absent selectors", async () => {
  const config: HooksConfig = { SubagentStart: [
    { matcher: "research.*", hooks: [{ ...context("hit"), matcher: "researcher" }] },
    { matcher: "*", hooks: [{ ...context("other"), matcher: "writer" }] },
    { matcher: "(", hooks: [context("invalid regex")] },
  ] };
  const matched = await runHooks(config, "SubagentStart", { agent_type: "researcher" });
  assert.deepEqual(matched.additionalContext, ["hit"]);
  const noSelector = await runHooks(config, "SubagentStart", {});
  assert.deepEqual(noSelector.additionalContext, []);
  const missing = await runHooks({ SessionStart: [{ matcher: ".*", hooks: [context("all")] }] }, "SessionStart");
  assert.deepEqual(missing.additionalContext, ["all"]);
});

test("groups are strict, nonrecursive, nonempty and bounded across events", () => {
  for (const entry of [
    { hooks: [] }, { hooks: [{ hooks: [context("nested")] }] },
    { hooks: [context("x")], once: true }, { hooks: [context("x")], command: "true" },
    { matcher: 1, hooks: [context("x")] }, { hooks: [null] },
  ]) {
    assert.equal(hookEntrySchema.safeParse(entry).success, false);
    assert.throws(() => flattenHookDefinitions({ PreToolUse: [entry] } as unknown as HooksConfig, "PreToolUse"));
  }
  const full = Array.from({ length: MAX_HOOK_DEFINITIONS }, () => ({ command: "true" }));
  assert.ok(hooksSchema.safeParse({ PreToolUse: [{ hooks: full }] }).success);
  for (const config of [
    { PreToolUse: [...full, { command: "true" }] },
    { PreToolUse: [{ hooks: full }, { hooks: [{ command: "true" }] }] },
    { PreToolUse: full, Stop: [{ command: "true" }] },
  ]) {
    assert.equal(hooksSchema.safeParse(config).success, false);
    assert.throws(() => flattenHookDefinitions(config, "PreToolUse"));
  }
  assert.deepEqual(hooksSettingsSchema.parse({ UnknownEvent: [null], PreToolUse: [context("known")] }), { PreToolUse: [context("known")] });
});

test("legacy optional fields remain absent and flattening/once never changes raw fingerprints", async () => {
  const config: HooksConfig = { PreToolUse: [{ command: "true" }], Stop: [{ command: "true", once: false }] };
  assert.deepEqual(hooksSchema.parse(config), config);
  assert.deepEqual(hookDefinitionSchema.parse({ command: "true" }), { command: "true" });
  const onceConfig: HooksConfig = { PreToolUse: [{ matcher: "Bash", hooks: [{ once: true, command: "true" }] }] };
  const before = JSON.stringify(onceConfig);
  const fingerprint = hash(onceConfig);
  const lifecycle = new HookLifecycle();
  await runHooks(onceConfig, "PreToolUse", { tool_name: "Bash" }, signal(), { lifecycle });
  assert.equal(JSON.stringify(onceConfig), before);
  assert.equal(hash(onceConfig), fingerprint);
  assert.equal(lifecycle.snapshot().length, 1);
  const old = await runHooks(config, "PreToolUse");
  assert.deepEqual(old, { blocked: false, additionalContext: [] });
});

test("once is accepted without defaults for every transport", () => {
  for (const definition of [
    { command: "true", once: true }, { type: "command", command: "true", async: true, once: true },
    { type: "http", url: "http://127.0.0.1/hook", once: true },
    { type: "prompt", prompt: "check", once: true }, { type: "agent", prompt: "check", once: false },
  ]) assert.deepEqual(hookDefinitionSchema.parse(definition), definition);
  assert.equal(hookDefinitionSchema.safeParse({ command: "true", once: "yes" }).success, false);
});

test("once claims synchronously before resolver execution and concurrent runs execute once", async () => {
  let calls = 0;
  let release!: (value: unknown) => void;
  const journal: string[] = [];
  const config: HooksConfig = { PreToolUse: [{ hooks: [{ type: "prompt", prompt: "check", once: true }] }] };
  const lifecycle = new HookLifecycle([], key => journal.push(key));
  const options = { lifecycle, resolveModelHook: () => {
    assert.equal(journal.length, 1);
    calls++;
    return new Promise<unknown>(resolve => { release = resolve; });
  } };
  const first = runHooks(config, "PreToolUse", {}, signal(), options);
  assert.equal(calls, 1, "resolver starts before runHooks yields");
  assert.equal(lifecycle.snapshot().length, 1);
  const second = await runHooks(config, "PreToolUse", {}, signal(), options);
  assert.deepEqual(second, { blocked: false, additionalContext: [] });
  release({ ok: true, additionalContext: "ran" });
  const completed = await first;
  assert.deepEqual(completed.additionalContext, ["ran"]);
  assert.deepEqual(completed.consumedOnce, [flattenHookDefinitions(config, "PreToolUse")[0]!.identity]);
  assert.equal(calls, 1);
});

test("durable claim callback failure prevents execution and leaves once available", async () => {
  const config: HooksConfig = { PreToolUse: [{ type: "agent", prompt: "check", once: true }] };
  const key = flattenHookDefinitions(config, "PreToolUse")[0]!.identity.key;
  let calls = 0;
  let failed = true;
  const lifecycle = new HookLifecycle([], () => { if (failed) throw new Error("journal fsync failed"); });
  const options = { lifecycle, resolveModelHook: async () => { calls++; return { ok: true }; } };
  await assert.rejects(runHooks(config, "PreToolUse", {}, signal(), options), /journal fsync failed/);
  assert.equal(calls, 0);
  assert.equal(lifecycle.has(key), false);
  assert.deepEqual(lifecycle.snapshot(), []);
  failed = false;
  await runHooks(config, "PreToolUse", {}, signal(), options);
  assert.equal(calls, 1);
  assert.equal(lifecycle.has(key), true);
});

test("lifecycle callback reentrancy cannot claim the same key twice", () => {
  const key = flattenHookDefinitions({ Stop: [{ command: "true", once: true }] }, "Stop")[0]!.identity.key;
  let callbacks = 0;
  const lifecycle = new HookLifecycle([], claimed => {
    callbacks++;
    assert.equal(lifecycle.claim(claimed), false);
    assert.deepEqual(lifecycle.snapshot(), []);
  });
  assert.equal(lifecycle.claim(key), true);
  assert.equal(lifecycle.claim(key), false);
  assert.equal(callbacks, 1);
});

test("started failure, malformed output and cancellation consume once", async () => {
  for (const behavior of ["throw", "malformed", "abort"] as const) {
    let calls = 0;
    const controller = new AbortController();
    const lifecycle = new HookLifecycle();
    const config: HooksConfig = { PreToolUse: [{ type: "prompt", prompt: behavior, once: true }] };
    const options = { lifecycle, resolveModelHook: async () => {
      calls++;
      if (behavior === "throw") throw new Error("fixture failure");
      if (behavior === "abort") controller.abort();
      return behavior === "malformed" ? "invalid JSON" : { ok: true };
    } };
    const result = await runHooks(config, "PreToolUse", {}, controller.signal, options);
    assert.equal(result.consumedOnce?.length, 1, behavior);
    assert.equal(lifecycle.snapshot().length, 1, behavior);
    await runHooks(config, "PreToolUse", {}, signal(), options);
    assert.equal(calls, 1, behavior);
  }
  const config: HooksConfig = { PreToolUse: [{ command: "exit 1", once: true }] };
  const lifecycle = new HookLifecycle();
  const failed = await runHooks(config, "PreToolUse", {}, signal(), { lifecycle });
  assert.equal(failed.consumedOnce?.length, 1);
  assert.ok(failed.additionalContext.some(text => text.includes("exit code 1")));
  assert.deepEqual(await runHooks(config, "PreToolUse", {}, signal(), { lifecycle }), { blocked: false, additionalContext: [] });
});

test("pre-cancellation and mismatch leave once unused", async () => {
  const config: HooksConfig = { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "check", once: true }] }] };
  let calls = 0;
  const lifecycle = new HookLifecycle();
  const options = { lifecycle, resolveModelHook: async () => { calls++; return { ok: true }; } };
  const aborted = new AbortController();
  aborted.abort();
  const cancelled = await runHooks(config, "PreToolUse", { tool_name: "Bash" }, aborted.signal, options);
  const mismatch = await runHooks(config, "PreToolUse", { tool_name: "Read" }, signal(), options);
  assert.equal(cancelled.consumedOnce, undefined);
  assert.equal(mismatch.consumedOnce, undefined);
  assert.equal(calls, 0);
  assert.deepEqual(lifecycle.snapshot(), []);
  const result = await runHooks(config, "PreToolUse", { tool_name: "Bash" }, signal(), options);
  assert.equal(result.consumedOnce?.length, 1);
  assert.equal(calls, 1);
});

test("missing model/async resolvers leave once unused, then injection executes once", async () => {
  for (const definition of [
    { type: "prompt", prompt: "check", once: true },
    { type: "agent", prompt: "check", once: true },
    { command: "true", async: true, once: true },
  ] satisfies HookDefinition[]) {
    const lifecycle = new HookLifecycle();
    const config: HooksConfig = { PreToolUse: [definition] };
    const pending = await runHooks(config, "PreToolUse", {}, signal(), { lifecycle });
    assert.equal(pending.pendingHooks?.length, 1);
    assert.equal(pending.consumedOnce, undefined);
    assert.deepEqual(lifecycle.snapshot(), []);
    let calls = 0;
    const options = { lifecycle,
      resolveModelHook: async () => { calls++; return { ok: true }; },
      startAsyncCommand: async () => { calls++; return "owned-task"; },
    };
    const result = await runHooks(config, "PreToolUse", {}, signal(), options);
    await runHooks(config, "PreToolUse", {}, signal(), options);
    assert.equal(result.consumedOnce?.length, 1);
    assert.equal(calls, 1);
  }
});

test("async registration failure consumes its execution claim", async () => {
  let calls = 0;
  const lifecycle = new HookLifecycle();
  const config: HooksConfig = { PreToolUse: [{ command: "true", async: true, once: true }] };
  const options = { lifecycle, startAsyncCommand: async () => { calls++; throw new Error("fixture registration failed"); } };
  const result = await runHooks(config, "PreToolUse", {}, signal(), options);
  assert.equal(result.consumedOnce?.length, 1);
  await runHooks(config, "PreToolUse", {}, signal(), options);
  assert.equal(calls, 1);
});

test("once seed resumes without repeats, identities bind event/coordinates/content and owners separate", async () => {
  const definition: HookDefinition = { type: "prompt", prompt: "check", once: true };
  const config: HooksConfig = { PreToolUse: [definition, { hooks: [definition, definition] }], Stop: [definition] };
  const entries = flattenHookDefinitions(config, "PreToolUse");
  assert.deepEqual(entries.map(entry => entry.identity), flattenHookDefinitions(config, "PreToolUse").map(entry => entry.identity));
  assert.equal(new Set(entries.map(entry => entry.identity.key)).size, 3);
  assert.notEqual(entries[0]!.identity.key, flattenHookDefinitions(config, "Stop")[0]!.identity.key);
  const changed = flattenHookDefinitions({ PreToolUse: [{ ...definition, prompt: "changed" }] }, "PreToolUse")[0]!.identity.key;
  assert.notEqual(changed, entries[0]!.identity.key);
  const groupChanged = flattenHookDefinitions({ PreToolUse: [definition, { matcher: "*", hooks: [definition, definition] }] }, "PreToolUse")[1]!.identity.key;
  assert.notEqual(groupChanged, entries[1]!.identity.key);
  let calls = 0;
  const firstOwner = new HookLifecycle();
  const resolver = async () => { calls++; return { ok: true }; };
  await runHooks(config, "PreToolUse", {}, signal(), { lifecycle: firstOwner, resolveModelHook: resolver });
  assert.equal(calls, 3);
  const resumed = new HookLifecycle(firstOwner.snapshot());
  const result = await runHooks(config, "PreToolUse", {}, signal(), { lifecycle: resumed, resolveModelHook: resolver });
  assert.equal(calls, 3);
  assert.equal(result.consumedOnce, undefined);
  await runHooks(config, "PreToolUse", {}, signal(), { lifecycle: new HookLifecycle(), resolveModelHook: resolver });
  assert.equal(calls, 6);
});

test("lifecycle validates seed and copies it; omitted lifecycle has no global state", async () => {
  const config: HooksConfig = { PreToolUse: [{ type: "prompt", prompt: "check", once: true }] };
  const key = flattenHookDefinitions(config, "PreToolUse")[0]!.identity.key;
  for (const seed of [["bad"], [key.replace("PreToolUse", "UnknownEvent")], [key.replace(":0:flat:", ":1024:flat:")], [key.toUpperCase()]]) assert.throws(() => new HookLifecycle(seed));
  const seed = [key];
  const lifecycle = new HookLifecycle(seed);
  seed.length = 0;
  const snapshot = lifecycle.snapshot();
  snapshot.length = 0;
  assert.equal(lifecycle.has(key), true);
  let calls = 0;
  const options = { resolveModelHook: async () => { calls++; return { ok: true }; } };
  await runHooks(config, "PreToolUse", {}, signal(), options);
  await runHooks(config, "PreToolUse", {}, signal(), options);
  assert.equal(calls, 2);
});

test("input byte cap, serialization and invalid flat prechecks never claim once", async () => {
  let calls = 0;
  const lifecycle = new HookLifecycle();
  const config: HooksConfig = { PreToolUse: [{ hooks: [{ type: "prompt", prompt: "check", once: true }] }] };
  const options = { lifecycle, resolveModelHook: async () => { calls++; return { ok: true }; } };
  const bytes = await runHooks(config, "PreToolUse", { prompt: "界".repeat(400_000) }, signal(), options);
  assert.equal(bytes.blocked, true);
  assert.equal(bytes.consumedOnce, undefined);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  await assert.rejects(runHooks(config, "PreToolUse", circular, signal(), options), /circular/i);
  const invalid = await runHooks({ PreToolUse: [{ command: "", once: true } as HookDefinition] }, "PreToolUse", {}, signal(), { lifecycle });
  assert.deepEqual(invalid, { blocked: false, additionalContext: [] });
  assert.equal(calls, 0);
  assert.deepEqual(lifecycle.snapshot(), []);
});

test("real command concurrent starts execute once and launch failure consumes once", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-hook-once-"));
  try {
    const config: HooksConfig = { PreToolUse: [{ command: "printf x >> starts; sleep 0.03", once: true }] };
    const lifecycle = new HookLifecycle();
    const results = await Promise.all(Array.from({ length: 5 }, () => runHooks(config, "PreToolUse", { cwd: dir }, signal(), { lifecycle })));
    assert.equal(fs.readFileSync(path.join(dir, "starts"), "utf8"), "x");
    assert.equal(results.flatMap(result => result.consumedOnce ?? []).length, 1);
    const failure = new HookLifecycle();
    const missingCwd = await runHooks(config, "PreToolUse", { cwd: path.join(dir, "missing") }, signal(), { lifecycle: failure });
    assert.equal(missingCwd.consumedOnce?.length, 1);
    assert.ok(missingCwd.additionalContext.some(text => text.includes("failed to launch")));
    await runHooks(config, "PreToolUse", { cwd: dir }, signal(), { lifecycle: failure });
    assert.equal(fs.readFileSync(path.join(dir, "starts"), "utf8"), "x");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("cancellation between grouped definitions leaves unstarted hooks claimable", async () => {
  const config: HooksConfig = { PreToolUse: [{ hooks: [
    { type: "prompt", prompt: "first", once: true },
    { type: "prompt", prompt: "second", once: true },
  ] }] };
  const controller = new AbortController();
  const lifecycle = new HookLifecycle();
  const calls: string[] = [];
  const resolveModelHook = async (definition: { prompt: string }) => {
    calls.push(definition.prompt);
    if (definition.prompt === "first") controller.abort();
    return { ok: true };
  };
  const first = await runHooks(config, "PreToolUse", {}, controller.signal, { lifecycle, resolveModelHook });
  assert.equal(first.consumedOnce?.length, 1);
  assert.deepEqual(calls, ["first"]);
  const second = await runHooks(config, "PreToolUse", {}, signal(), { lifecycle, resolveModelHook });
  assert.equal(second.consumedOnce?.length, 1);
  assert.deepEqual(calls, ["first", "second"]);
});

test("an asynchronous journal callback is rejected before execution and claim commit", async () => {
  const config: HooksConfig = { PreToolUse: [{ type: "prompt", prompt: "check", once: true }] };
  const lifecycle = new HookLifecycle([], async () => {});
  let calls = 0;
  await assert.rejects(runHooks(config, "PreToolUse", {}, signal(), {
    lifecycle, resolveModelHook: async () => { calls++; return { ok: true }; },
  }), /must be synchronous/);
  assert.equal(calls, 0);
  assert.deepEqual(lifecycle.snapshot(), []);
});

test("HTTP header prechecks leave once available and concurrent loopback starts claim once", async () => {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests++;
    assert.equal(request.headers["x-fixture"], "token");
    request.resume();
    response.end(JSON.stringify({ additionalContext: "http ran" }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const lifecycle = new HookLifecycle();
    const config: HooksConfig = { PreToolUse: [{ type: "http", url: `http://127.0.0.1:${address.port}/hook`, headersEnv: { "X-Fixture": "FIXTURE_TOKEN" }, once: true }] };
    const missing = await runHooks(config, "PreToolUse", {}, signal(), { lifecycle, environment: {} });
    assert.equal(missing.consumedOnce, undefined);
    assert.equal(requests, 0);
    assert.deepEqual(lifecycle.snapshot(), []);
    const results = await Promise.all(Array.from({ length: 4 }, () => runHooks(config, "PreToolUse", {}, signal(), { lifecycle, environment: { FIXTURE_TOKEN: "token" } })));
    assert.equal(requests, 1);
    assert.equal(results.flatMap(result => result.consumedOnce ?? []).length, 1);
    assert.deepEqual(results.flatMap(result => result.additionalContext), ["http ran"]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
