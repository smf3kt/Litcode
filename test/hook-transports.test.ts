import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  HookLifecycle, hookDefinitionSchema, hooksSchema, runHooks,
  type CallbackHookDefinition, type McpHookDefinition, type HookRunOptions, type HooksConfig,
} from "../src/hooks.js";

const signal = () => new AbortController().signal;

test("transport schemas retain absent fields and script hooks are refused without execution", async () => {
  const callback: CallbackHookDefinition = { type: "callback", name: "check" };
  const mcp: McpHookDefinition = { type: "mcp_tool", tool: "mcp__fixture__read", arguments: { id: 1 } };
  const definitions = [{ command: "true" }, callback, mcp, { type: "script", command: "true", once: true }];
  for (const definition of definitions) assert.deepEqual(hookDefinitionSchema.parse(definition), definition);
  assert.deepEqual(hooksSchema.parse({ PreToolUse: [{ matcher: "Read", hooks: definitions }] }),
    { PreToolUse: [{ matcher: "Read", hooks: definitions }] });
  for (const type of ["callback", "mcp_tool"] as const) {
    const field = type === "callback" ? "name" : "tool";
    assert.ok(hookDefinitionSchema.safeParse({ type, [field]: "a".repeat(256) }).success);
    assert.ok(hookDefinitionSchema.safeParse({ type, [field]: "é".repeat(128) }).success);
    for (const name of ["", "a".repeat(257), "é".repeat(129), "bad\0name"]) {
      assert.equal(hookDefinitionSchema.safeParse({ type, [field]: name }).success, false);
    }
  }
  for (const definition of [
    { ...callback, extra: true }, { ...mcp, arguments: [] }, { ...mcp, arguments: null },
    { type: "script", command: "true", async: true }, { type: "script", command: "bad\0text" },
  ]) assert.equal(hookDefinitionSchema.safeParse(definition).success, false);

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-hook-transports-"));
  try {
    const config: HooksConfig = { PreToolUse: [{ matcher: "Read|Write", hooks: [{
      type: "script", matcher: "Read",
      command: "IFS= read -r line; printf \"%s\\n\" \"$line\" > payload.json; printf \"%s\" \"$PWD\" > cwd.txt",
    }] }] };
    assert.deepEqual(await runHooks(config, "PreToolUse", { cwd, tool_name: "Write" }, signal()),
      { blocked: false, additionalContext: [] });
    const refused = await runHooks(config, "PreToolUse", { cwd, tool_name: "Read" }, signal());
    assert.equal(refused.blocked, true);
    assert.equal(refused.reason, "script hooks are not available in this build");
    assert.ok(refused.additionalContext.some(text => text.includes("script hooks are not available in this build")));
    assert.equal(fs.existsSync(path.join(cwd, "payload.json")), false);
    assert.equal(fs.existsSync(path.join(cwd, "cwd.txt")), false);
    const passive = await runHooks({ SessionStart: [{ type: "script", command: "printf ran" }] }, "SessionStart", { cwd });
    assert.equal(passive.blocked, false);
    assert.ok(passive.additionalContext.some(text => text.includes("script hooks are not available in this build")));
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("callback and MCP prerequisites, once, cancellation and JSON results share existing translation", async () => {
  for (const definition of [
    { type: "callback", name: "verify", once: true },
    { type: "mcp_tool", tool: "mcp__fixture__read", arguments: { id: 1 }, once: true },
  ] satisfies (CallbackHookDefinition | McpHookDefinition)[]) {
    const lifecycle = new HookLifecycle();
    const config: HooksConfig = { PreToolUse: [{ matcher: "Read", hooks: [definition] }] };
    const payload = { tool_name: "Read", tool_input: { path: "before" } };
    const missing = await runHooks(config, "PreToolUse", payload, signal(), { lifecycle });
    assert.equal(missing.blocked, true);
    assert.equal(missing.pendingHooks?.[0]?.type, definition.type);
    assert.match(missing.reason!, /HookRunOptions\.resolve/);
    assert.deepEqual(lifecycle.snapshot(), []);
    const display = await runHooks({ PostToolUse: [definition] }, "PostToolUse", payload);
    assert.equal(display.blocked, false);
    assert.equal(display.pendingHooks?.length, 1);
    let calls = 0;
    const resolver = async (received: CallbackHookDefinition | McpHookDefinition, event: string, data: unknown, hookSignal: AbortSignal) => {
      calls++;
      assert.deepEqual(received, definition);
      assert.equal(event, "PreToolUse");
      assert.equal(data, payload);
      assert.equal(hookSignal.aborted, false);
      assert.equal(lifecycle.snapshot().length, 1, "journal claim precedes resolver effect");
      return { ok: true, additionalContext: "checked", hookSpecificOutput: {
        hookEventName: event, permissionDecision: "allow", updatedInput: { path: "after" },
      } };
    };
    const options: HookRunOptions = { lifecycle, resolveCallbackHook: resolver, resolveMcpHook: resolver };
    const controller = new AbortController();
    controller.abort();
    await runHooks(config, "PreToolUse", payload, controller.signal, options);
    await runHooks(config, "PreToolUse", { tool_name: "Write" }, signal(), options);
    assert.equal(calls, 0);
    const result = await runHooks(config, "PreToolUse", payload, signal(), options);
    assert.deepEqual(result.additionalContext, ["checked"]);
    assert.deepEqual(result.updatedInput, { path: "after" });
    await runHooks(config, "PreToolUse", payload, signal(), options);
    assert.equal(calls, 1);
    for (const value of ["invalid", "[]", "{bad}", { additionalContext: "x".repeat(65536) }, undefined, 1n]) {
      const invalidResolver = async () => value;
      const invalid = await runHooks({ PreToolUse: [definition] }, "PreToolUse", payload, signal(), {
        resolveCallbackHook: invalidResolver, resolveMcpHook: invalidResolver,
      });
      assert.ok(invalid.additionalContext.some(text => text.includes("exit code 1")));
      assert.equal(invalid.updatedInput, undefined);
    }
    const verdict = async () => JSON.stringify({ ok: false, reason: "fixture block" });
    const denied = await runHooks({ PreToolUse: [definition] }, "PreToolUse", payload, signal(), {
      resolveCallbackHook: verdict, resolveMcpHook: verdict,
    });
    assert.equal(denied.blocked, true);
    assert.equal(denied.reason, "fixture block");
    const throwing = () => { throw new Error("fixture failure"); };
    const failed = await runHooks({ PreToolUse: [definition] }, "PreToolUse", payload, signal(), {
      resolveCallbackHook: throwing, resolveMcpHook: throwing,
    });
    assert.ok(failed.additionalContext.some(text => text.includes("resolver failed")));
    assert.equal(failed.consumedOnce?.length, 1);
    const abort = new AbortController();
    let receivedSignal!: AbortSignal;
    const cancelling = async (_definition: unknown, _event: unknown, _payload: unknown, hookSignal: AbortSignal) => {
      receivedSignal = hookSignal;
      abort.abort();
      return { ok: true, additionalContext: "ignored" };
    };
    const cancelled = await runHooks({ PreToolUse: [definition] }, "PreToolUse", payload, abort.signal, {
      resolveCallbackHook: cancelling, resolveMcpHook: cancelling,
    });
    assert.equal(receivedSignal.aborted, true);
    assert.ok(cancelled.additionalContext.some(text => text.includes("aborted")));
    assert.equal(cancelled.additionalContext.includes("ignored"), false);
  }
});

test("sixteen actual resolver stages survive timeout across recreated wrappers until settlement", async () => {
  for (const definition of [
    { type: "callback", name: "held", timeout: 0.01 },
    { type: "mcp_tool", tool: "mcp__fixture__read", timeout: 0.01 },
  ] satisfies (CallbackHookDefinition | McpHookDefinition)[]) {
    const lifecycle = new HookLifecycle();
    const releases: ((value: unknown) => void)[] = [];
    const signals: AbortSignal[] = [];
    let calls = 0;
    const options = (): HookRunOptions => ({ lifecycle,
      resolveCallbackHook: (_d, _e, _p, hookSignal) => hold(hookSignal),
      resolveMcpHook: (_d, _e, _p, hookSignal) => hold(hookSignal),
    });
    function hold(hookSignal: AbortSignal): Promise<unknown> {
      calls++;
      signals.push(hookSignal);
      return new Promise(resolve => releases.push(resolve));
    }
    const config: HooksConfig = { PreToolUse: [definition] };
    try {
      const runs = Array.from({ length: 16 }, () => runHooks(config, "PreToolUse", {}, signal(), options()));
      assert.equal(calls, 16);
      const results = await Promise.all(runs);
      assert.ok(results.every(result => result.additionalContext.some(text => text.includes("timed out"))));
      assert.ok(signals.every(hookSignal => hookSignal.aborted));
      const once: HooksConfig = { PreToolUse: [{ ...definition, once: true }] };
      const full = await runHooks(once, "PreToolUse", {}, signal(), options());
      assert.equal(full.blocked, true);
      assert.match(full.reason!, /16 active stages/);
      assert.equal(calls, 16);
      assert.deepEqual(lifecycle.snapshot(), [], "capacity failure precedes once claim");
      const other = async () => ({ ok: true, additionalContext: "other owner" });
      const independent = await runHooks(config, "PreToolUse", {}, signal(), {
        lifecycle: new HookLifecycle(), resolveCallbackHook: other, resolveMcpHook: other,
      });
      assert.deepEqual(independent.additionalContext, ["other owner"]);
      releases[0]!({ ok: true, additionalContext: "late output" });
      await new Promise<void>(resolve => setImmediate(resolve));
      const retry = await runHooks(once, "PreToolUse", {}, signal(), options());
      assert.equal(calls, 17);
      assert.equal(retry.consumedOnce?.length, 1);
      assert.ok(retry.additionalContext.some(text => text.includes("timed out")));
      assert.equal(retry.additionalContext.includes("late output"), false);
    } finally {
      for (const release of releases) release({ ok: true });
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    const healthy = async () => ({ ok: true, additionalContext: "released" });
    const recovered = await runHooks(config, "PreToolUse", {}, signal(), {
      lifecycle, resolveCallbackHook: healthy, resolveMcpHook: healthy,
    });
    assert.deepEqual(recovered.additionalContext, ["released"]);

    const directReleases: ((value: unknown) => void)[] = [];
    const direct = () => new Promise(resolve => directReleases.push(resolve));
    const directOptions = { resolveCallbackHook: direct, resolveMcpHook: direct };
    try {
      const directRuns = Array.from({ length: 16 }, () => runHooks(config, "PreToolUse", {}, signal(), directOptions));
      await Promise.all(directRuns);
      const full = await runHooks(config, "PreToolUse", {}, signal(), directOptions);
      assert.match(full.reason!, /16 active stages/);
      assert.equal(directReleases.length, 16, "resolver identity owns capacity when lifecycle is absent");
    } finally {
      for (const release of directReleases) release({ ok: true });
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  }
});
