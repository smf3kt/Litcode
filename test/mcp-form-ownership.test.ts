import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type ServerResponse } from "node:http";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { defaultConfig } from "../src/agent.js";
import { interactiveLoop } from "../src/interactive.js";
import { createRuntime } from "../src/runtime.js";
import { Session } from "../src/session.js";
import type { ModelProvider } from "../src/provider.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const form = { message: "Choose a label", requestedSchema: { type: "object", properties: { label: { type: "string" } }, required: ["label"] } };
async function fixture(onCall: (res: ServerResponse, id: number) => void, elicitation: unknown = form) {
  const answer = deferred<any>();
  const failures: unknown[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === "DELETE") { res.writeHead(204).end(); return; }
      let text = ""; for await (const chunk of req) text += chunk;
      const msg = JSON.parse(text);
      const reply = (result: unknown) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
      };
      if (msg.method === "initialize") reply({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
      else if (msg.method === "tools/list") reply({ tools: [{ name: "choose", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } }] });
      else if (msg.method === "tools/call") {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: "form-1", method: "elicitation/create", params: elicitation })}\n\n`);
        onCall(res, msg.id);
      } else {
        if (msg.id === "form-1") answer.resolve(msg);
        res.writeHead(202).end();
      }
    })().catch((error) => { failures.push(error); res.destroy(); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}/mcp`, answer, failures,
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}
function finishCall(res: ServerResponse, id: number) {
  res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "form tool finished early" }] } })}\n\n`);
}
function message(content: Anthropic.ContentBlockParam[], stop: "end_turn" | "tool_use"): Anthropic.Message {
  return { id: "fixture", type: "message", model: "fixture", role: "assistant", content, stop_reason: stop,
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

test("real runtime release aborts in-flight form callbacks and stale unregister preserves the new owner", { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-form-owner-")));
  const entered = deferred<AbortSignal>(), exited = deferred<void>();
  const remote = await fixture((res, id) => { void remote.answer.promise.then(() => finishCall(res, id)); });
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error("Unexpected model call"); } };
  const lifetime = AbortSignal.timeout(5000);
  const config = { ...defaultConfig(workspace, []), model: "fixture", mcpClient: { elicitation: true }, mcpServers: { fixture: { type: "http" as const, url: remote.url } } };
  const runtime = await createRuntime(config, provider, lifetime);
  let unregisterNext: (() => void) | undefined;
  try {
    const unregisterOld = runtime.registerElicitation!("old", async (_params, requestSignal) => {
      entered.resolve(requestSignal);
      await new Promise<void>((resolve) => {
        requestSignal.addEventListener("abort", () => resolve(), { once: true });
        if (requestSignal.aborted) resolve();
      });
      exited.resolve(); return { action: "cancel" };
    });
    const choose = runtime.buildTools(config, "old").find((tool) => tool.schema.name === "mcp__fixture__choose"); assert.ok(choose);
    const pending = choose.execute({}, { workspace, signal: lifetime, maxOutputBytes: 24_000, allowShell: false });
    const requestSignal = await entered.promise;
    assert.equal(requestSignal.aborted, false);
    await runtime.releaseSession!("old");
    assert.equal(requestSignal.aborted, true);
    await exited.promise;
    let nextCalls = 0;
    unregisterNext = runtime.registerElicitation!("next", async () => { nextCalls++; return { action: "decline" }; });
    unregisterOld();
    assert.equal(await pending, "form tool finished early");
    assert.deepEqual((await remote.answer.promise).result, { action: "cancel" });
    // A later invocation on the same live connection verifies identity cleanup.
    const nextTool = runtime.buildTools(config, "next").find((tool) => tool.schema.name === "mcp__fixture__choose"); assert.ok(nextTool);
    assert.equal(await nextTool.execute({}, { workspace, signal: lifetime, maxOutputBytes: 24_000, allowShell: false }), "form tool finished early");
    assert.equal(nextCalls, 1);
    assert.deepEqual(remote.failures, []);
  } finally { unregisterNext?.(); await runtime.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("interactive early tool completion cancels the pending form before permission takes terminal input", { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-form-permission-")));
  const input = new PassThrough();
  let pending: { res: ServerResponse; id: number } | undefined;
  const remote = await fixture((res, id) => { pending = { res, id }; });
  let calls = 0, stdout = "", stderr = "", formShown = false, permissionShown = false;
  const target = path.join(workspace, "approved.txt");
  const asynchronousFailures: unknown[] = [];
  const provider: ModelProvider = {
    count: async () => 1,
    complete: async () => {
      calls++;
      if (calls === 1) return message([{ type: "tool_use", id: "choose", name: "mcp__fixture__choose", input: {} }], "tool_use");
      if (calls === 2) return message([{ type: "tool_use", id: "write", name: "write_file", input: { path: "approved.txt", content: "approved" } }], "tool_use");
      assert.equal(calls, 3, "permission answer must never become another user task");
      assert.equal(fs.readFileSync(target, "utf8"), "approved");
      return message([{ type: "text", text: "done" }], "end_turn");
    },
  };
  const lifetime = AbortSignal.timeout(5000);
  const config = { ...defaultConfig(workspace, []), model: "fixture", permissions: { mode: "ask" as const, allow: [], deny: [] },
    mcpClient: { elicitation: true }, mcpServers: { fixture: { type: "http" as const, url: remote.url } } };
  const runtime = await createRuntime(config, provider, lifetime);
  config.tools = runtime.buildTools(config, "schema").map((tool) => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  const output = new Writable({ write(chunk, _encoding, done) {
    stdout += String(chunk);
    if (!formShown && stdout.includes("Enter a JSON object")) {
      formShown = true;
      setImmediate(() => { assert.ok(pending); finishCall(pending.res, pending.id); });
    }
    if (!permissionShown && stdout.includes("Allow once?")) {
      permissionShown = true;
      // Wait until cancellation has settled remotely before answering the new
      // prompt, exercising late form cleanup against the permission owner.
      void remote.answer.promise.then((answer) => {
        assert.equal(fs.existsSync(target), false, "write must wait for approval");
        assert.deepEqual(answer.result, { action: "cancel" });
        setImmediate(() => input.write("y\n"));
      }).catch((error) => { asynchronousFailures.push(error); input.end("/exit\n"); });
    }
    done();
  } });
  const status = new Writable({ write(chunk, _encoding, done) {
    stderr += String(chunk);
    if (stderr.includes("finished: end_turn")) setImmediate(() => input.end("/exit\n"));
    done();
  } });
  try {
    const loop = interactiveLoop(session, provider, runtime, { input, output, status, signal: lifetime });
    input.write("use the form then write\n");
    await loop;
    assert.equal(formShown, true, JSON.stringify({ stdout, stderr, calls })); assert.equal(permissionShown, true, JSON.stringify({ stdout, stderr, calls }));
    assert.equal(calls, 3); assert.equal(fs.readFileSync(target, "utf8"), "approved");
    assert.match(stderr, /finished: end_turn/); assert.doesNotMatch(stderr, /Another interaction|MCP form error/);
    assert.deepEqual(asynchronousFailures, []); assert.deepEqual(remote.failures, []);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).filter((name) => name.endsWith(".lock")).length, 0);
  } finally { input.destroy(); session.close(); await runtime.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("interactive URL elicitation shows the URL, answers with no content and reports the server's completion", { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-url-elicit-")));
  const input = new PassThrough();
  const url = { mode: "url", message: "Authorise the fixture", url: "https://example.invalid/consent?token=fixture", elicitationId: "elicit-1" };
  let pending: { res: ServerResponse; id: number } | undefined;
  // The notice is delivered on the same stream, before the tool result, so it lands inside the turn.
  const remote = await fixture((res, id) => { pending = { res, id }; }, url);
  let calls = 0, stdout = "", stderr = "", urlShown = false;
  const asynchronousFailures: unknown[] = [];
  const provider: ModelProvider = {
    count: async () => 1,
    complete: async () => {
      calls++;
      if (calls === 1) return message([{ type: "tool_use", id: "choose", name: "mcp__fixture__choose", input: {} }], "tool_use");
      assert.equal(calls, 2, "the URL answer must never become another user task");
      return message([{ type: "text", text: "done" }], "end_turn");
    },
  };
  const lifetime = AbortSignal.timeout(5000);
  const config = { ...defaultConfig(workspace, []), model: "fixture",
    mcpClient: { elicitation: true }, mcpServers: { fixture: { type: "http" as const, url: remote.url } } };
  const runtime = await createRuntime(config, provider, lifetime);
  config.tools = runtime.buildTools(config, "schema").map((tool) => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  const output = new Writable({ write(chunk, _encoding, done) {
    stdout += String(chunk);
    if (!urlShown && stdout.includes("MCP URL from fixture:")) {
      urlShown = true;
      // Deferred like the permission answer: the prompt is written before its reader owns input.
      setImmediate(() => input.write(":accept\n"));
      void remote.answer.promise.then((answer) => {
        try {
          assert.deepEqual(answer.result, { action: "accept" });
          assert.ok(pending);
          pending.res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/elicitation/complete", params: { elicitationId: "elicit-1" } })}\n\n`);
          finishCall(pending.res, pending.id);
        } catch (error) { asynchronousFailures.push(error); input.end("/exit\n"); }
      }).catch((error) => { asynchronousFailures.push(error); input.end("/exit\n"); });
    }
    done();
  } });
  const status = new Writable({ write(chunk, _encoding, done) {
    stderr += String(chunk);
    if (stderr.includes("finished: end_turn")) setImmediate(() => input.end("/exit\n"));
    done();
  } });
  try {
    const loop = interactiveLoop(session, provider, runtime, { input, output, status, signal: lifetime });
    input.write("open the fixture URL\n");
    await loop;
    assert.equal(urlShown, true, JSON.stringify({ stdout, stderr }));
    assert.match(stdout, /https:\/\/example\.invalid\/consent\?token=fixture/);
    assert.match(stdout, /Open it, then answer :accept, :decline or :cancel/);
    assert.match(stderr, /MCP server "fixture" confirmed elicitation elicit-1 complete/);
    assert.equal(calls, 2);
    assert.doesNotMatch(stderr, /Another interaction|MCP form error/);
    assert.deepEqual(asynchronousFailures, []); assert.deepEqual(remote.failures, []);
  } finally { input.destroy(); session.close(); await runtime.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("Elicitation hooks answer the form without a dialog", { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-hook-elicit-")));
  const input = new PassThrough();
  const remote = await fixture((res, id) => { void remote.answer.promise.then(() => finishCall(res, id)); });
  let calls = 0, stdout = "", stderr = "";
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    calls++;
    if (calls === 1) return message([{ type: "tool_use", id: "choose", name: "mcp__fixture__choose", input: {} }], "tool_use");
    return message([{ type: "text", text: "done" }], "end_turn");
  } };
  const lifetime = AbortSignal.timeout(5000);
  const config = { ...defaultConfig(workspace, []), model: "fixture",
    mcpClient: { elicitation: true }, mcpServers: { fixture: { type: "http" as const, url: remote.url } },
    hooks: { Elicitation: [{ hooks: [{ type: "command" as const,
      command: "printf '%s' '{\"hookSpecificOutput\":{\"hookEventName\":\"Elicitation\",\"action\":\"accept\",\"content\":{\"label\":\"hook\"}}}'" }] }] } };
  const runtime = await createRuntime(config, provider, lifetime);
  config.tools = runtime.buildTools(config, "schema").map((tool) => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  const output = new Writable({ write(chunk, _encoding, done) { stdout += String(chunk); done(); } });
  const status = new Writable({ write(chunk, _encoding, done) {
    stderr += String(chunk);
    if (stderr.includes("finished: end_turn")) setImmediate(() => input.end("/exit\n"));
    done();
  } });
  try {
    const loop = interactiveLoop(session, provider, runtime, { input, output, status, signal: lifetime });
    input.write("use the form\n");
    await loop;
    assert.deepEqual((await remote.answer.promise).result, { action: "accept", content: { label: "hook" } });
    assert.doesNotMatch(stdout, /Enter a JSON object/);
    assert.equal(calls, 2);
    assert.match(stderr, /finished: end_turn/);
    assert.doesNotMatch(stderr, /Another interaction|MCP form error/);
    assert.deepEqual(remote.failures, []);
  } finally { input.destroy(); session.close(); await runtime.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("ElicitationResult hooks override the person's action and content", { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-hook-result-")));
  const input = new PassThrough();
  const remote = await fixture((res, id) => { void remote.answer.promise.then(() => finishCall(res, id)); });
  let calls = 0, stdout = "", stderr = "", formShown = false;
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    calls++;
    if (calls === 1) return message([{ type: "tool_use", id: "choose", name: "mcp__fixture__choose", input: {} }], "tool_use");
    return message([{ type: "text", text: "done" }], "end_turn");
  } };
  const lifetime = AbortSignal.timeout(5000);
  const config = { ...defaultConfig(workspace, []), model: "fixture",
    mcpClient: { elicitation: true }, mcpServers: { fixture: { type: "http" as const, url: remote.url } },
    hooks: { ElicitationResult: [{ hooks: [{ type: "command" as const,
      command: "printf '%s' '{\"hookSpecificOutput\":{\"hookEventName\":\"ElicitationResult\",\"action\":\"accept\",\"content\":{\"label\":\"hook-result\"}}}'" }] }] } };
  const runtime = await createRuntime(config, provider, lifetime);
  config.tools = runtime.buildTools(config, "schema").map((tool) => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  const output = new Writable({ write(chunk, _encoding, done) {
    stdout += String(chunk);
    if (!formShown && stdout.includes("Enter a JSON object")) {
      formShown = true;
      setImmediate(() => input.write('{"label":"user"}\n'));
    }
    done();
  } });
  const status = new Writable({ write(chunk, _encoding, done) {
    stderr += String(chunk);
    if (stderr.includes("finished: end_turn")) setImmediate(() => input.end("/exit\n"));
    done();
  } });
  try {
    const loop = interactiveLoop(session, provider, runtime, { input, output, status, signal: lifetime });
    input.write("use the form\n");
    await loop;
    assert.equal(formShown, true, JSON.stringify({ stdout, stderr }));
    assert.deepEqual((await remote.answer.promise).result, { action: "accept", content: { label: "hook-result" } });
    assert.equal(calls, 2);
    assert.match(stderr, /finished: end_turn/);
    assert.doesNotMatch(stderr, /Another interaction|MCP form error/);
    assert.deepEqual(remote.failures, []);
  } finally { input.destroy(); session.close(); await runtime.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
