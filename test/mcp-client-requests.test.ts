import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type ServerResponse } from "node:http";
import { test } from "node:test";
import { connectMcpServers, MCP_PROTOCOL_LIMITS, type McpClientRequests, type McpConnectOptions, type McpConnection } from "../src/mcp.js";
import { MCP_HTTP_LIMITS } from "../src/mcp-http.js";
import { McpClientRequestHandler, MCP_CLIENT_REQUEST_MAX_INPUT_BYTES, MCP_CLIENT_REQUEST_MAX_RESULT_BYTES } from "../src/mcp-client-requests.js";
import type { ToolContext } from "../src/tools.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 3000;
  while (Date.now() < end) { if (check()) return; await delay(5); }
  assert.fail("fixture condition timed out");
}
const context = (signal = new AbortController().signal): ToolContext => ({ workspace: process.cwd(), signal, allowShell: false, maxOutputBytes: 100_000 });
const form = { message: "Approve fixture", requestedSchema: { type: "object", properties: { answer: { type: "string", enum: ["yes", "no"] } }, required: ["answer"] } };
const sampling = { messages: [{ role: "user", content: { type: "text", text: "fixture prompt" } }], maxTokens: 64 };
const sampled = { role: "assistant" as const, content: { type: "text" as const, text: "fixture response" }, model: "fixture-model", stopReason: "endTurn" };
function request(id: string | number, method: string, params: unknown = {}): any { return { jsonrpc: "2.0", id, method, params }; }
function cancelled(id: string | number): any { return { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id, reason: "fixture" } }; }

// Inline child script and loopback HTTP exercise real transport dispatch/replies.
const STDIO = String.raw`
const fs = require('node:fs');
const readline = require('node:readline');
const file = process.argv[1];
let active;
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  fs.appendFileSync(file, JSON.stringify(msg) + '\n');
  if (msg.method === 'initialize') send({ jsonrpc:'2.0', id:msg.id, result:{ protocolVersion:'2024-11-05', capabilities:{tools:{}} } });
  else if (msg.method === 'tools/list') send({ jsonrpc:'2.0', id:msg.id, result:{tools:[{name:'exercise',inputSchema:{type:'object'}}]} });
  else if (msg.method === 'tools/call') {
    const args = msg.params.arguments;
    active = { id:msg.id, expected:args.expected, count:0, hold:args.hold };
    for (const item of args.messages) send(item);
    if (args.completeImmediately) { send({ jsonrpc:'2.0', id:msg.id, result:{content:[{type:'text',text:'done'}]} }); active = undefined; }
  } else if (msg.id !== undefined && !msg.method && active && ++active.count === active.expected && !active.hold) {
    send({jsonrpc:'2.0',id:active.id,result:{content:[{type:'text',text:'done'}]}}); active = undefined;
  }
});
`;
type Fixture = { connection: McpConnection; seen: () => any[]; run: (messages: any[], expected?: number, extra?: Record<string, unknown>, signal?: AbortSignal) => Promise<string> };
async function fixture(transport: "stdio" | "http", options: McpConnectOptions, fn: (f: Fixture) => Promise<void>): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-client-requests-"));
  const notes = path.join(dir, "notes.jsonl");
  const seen: any[] = [];
  let active: { res: ServerResponse; id: number; expected: number; count: number; hold: boolean } | undefined;
  const failures: unknown[] = [];
  const server = transport === "http" ? createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const msg = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      seen.push({ ...msg, _path: req.url, _headers: req.headers });
      const respond = (result: unknown) => { res.writeHead(200, { "content-type": "application/json", "mcp-session-id": "fixture-session" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
      const emit = (out: unknown) => res.write(`data: ${JSON.stringify(out)}\n\n`);
      if (req.method === "DELETE") { res.writeHead(204); res.end(); }
      else if (msg.method === "initialize") respond({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
      else if (msg.method === "tools/list") respond({ tools: [{ name: "exercise", inputSchema: { type: "object" } }] });
      else if (msg.method === "tools/call") {
        const args = msg.params.arguments;
        if (args.jsonServerRequest) {
          res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(args.messages[0])); return;
        }
        active = { res, id: msg.id, expected: args.expected, count: 0, hold: args.hold };
        res.writeHead(200, { "content-type": "text/event-stream" });
        for (const item of args.messages) emit(item);
        if (args.completeImmediately) { emit({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "done" }] } }); res.end(); active = undefined; }
      } else {
        res.writeHead(202); res.end();
        if (msg.id !== undefined && !msg.method && active && ++active.count === active.expected && !active.hold) {
          active.res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: active.id, result: { content: [{ type: "text", text: "done" }] } })}\n\n`); active = undefined;
        }
      }
    })().catch((error) => { failures.push(error); res.destroy(); });
  }) : undefined;
  let connection: McpConnection | undefined;
  try {
    if (server) await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server?.address();
    const config = server && addr && typeof addr !== "string"
      ? { type: "http" as const, url: `http://127.0.0.1:${addr.port}/mcp` }
      : { command: process.execPath, args: ["-e", STDIO, notes] };
    connection = await connectMcpServers({ fixture: config }, context(), { requestTimeoutMs: 3000, ...options });
    const read = () => server ? seen : fs.readFileSync(notes, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const client = connection;
    await fn({ connection, seen: read, run: (messages, expected = messages.filter((item) => Object.hasOwn(item, "id")).length, extra = {}, signal) => client.tools[0].execute({ messages, expected, ...extra }, context(signal)) });
  } finally {
    await connection?.close();
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(failures, []);
}
const replies = (f: Fixture) => f.seen().filter((item) => item.id !== undefined && !item.method);

for (const transport of ["stdio", "http"] as const) {
  test(`${transport}: actual initialize advertises only supplied callbacks, legacy schemas/limits remain pinned`, async () => {
    await fixture(transport, {}, async (f) => {
      assert.deepEqual(f.seen()[0].params.capabilities, {});
      assert.equal(f.seen()[0].params.protocolVersion, transport === "stdio" ? "2024-11-05" : "2025-06-18");
      assert.equal(f.connection.limits, transport === "stdio" ? MCP_PROTOCOL_LIMITS : MCP_HTTP_LIMITS);
      assert.deepEqual(f.connection.tools.map((tool) => tool.schema.name), ["mcp__fixture__exercise"]);
      const messages = [request("r", "roots/list"), request("e", "elicitation/create", form), request("s", "sampling/createMessage", sampling), request("u", "unknown/secret", {})];
      assert.equal(await f.run(messages), "done");
      assert.ok(replies(f).every((item) => item.error.code === -32601));
      assert.ok(replies(f).every((item) => !item.error.message.includes("secret")));
    });
    await fixture(transport, { clientRequests: { roots: () => [] } }, async (f) => {
      assert.deepEqual(f.seen()[0].params.capabilities, { roots: { listChanged: false } });
      await f.run([request("missing", "sampling/createMessage", sampling)]);
      assert.equal(replies(f)[0].error.code, -32601);
    });
  });

  test(`${transport}: roots, form approval/decline/cancel and sampling round-trip with inert context`, async () => {
    let calls = 0;
    const callbacks: McpClientRequests = {
      roots: (ctx) => { assert.equal(ctx.serverName, "fixture"); return [{ uri: "file:///tmp/fixture", name: "fixture" }]; },
      elicitation: (params, signal, ctx) => {
        assert.ok(Object.isFrozen(params)); assert.equal(signal.aborted, false); assert.equal(ctx._meta?.trace, "fixture");
        return ++calls === 1 ? { action: "accept", content: { answer: "yes" } } : calls === 2 ? { action: "decline" } : { action: "cancel" };
      },
      sampling: (params, signal, ctx) => { assert.equal(params.maxTokens, 64); assert.equal(ctx.serverName, "fixture"); assert.equal(signal.aborted, false); return sampled; },
    };
    await fixture(transport, { clientRequests: callbacks }, async (f) => {
      assert.deepEqual(f.seen()[0].params.capabilities, { roots: { listChanged: false }, elicitation: { form: {} }, sampling: {} });
      await f.run([request("r", "roots/list"), ...[1, 2, 3].map((id) => request(`e${id}`, "elicitation/create", { ...form, _meta: { trace: "fixture" } })), request("s", "sampling/createMessage", sampling)]);
      const out = new Map(replies(f).map((item) => [item.id, item.result]));
      assert.deepEqual(out.get("r"), { roots: [{ uri: "file:///tmp/fixture", name: "fixture" }] });
      assert.deepEqual(out.get("e1"), { action: "accept", content: { answer: "yes" } });
      assert.deepEqual(out.get("e2"), { action: "decline" }); assert.deepEqual(out.get("e3"), { action: "cancel" });
      assert.deepEqual(out.get("s"), sampled);
      if (transport === "http") assert.ok(replies(f).every((item) => item._path === "/mcp" && item._headers["mcp-session-id"] === "fixture-session"));
    });
  });

  test(`${transport}: cancel/deadline isolate pending callbacks and ignore late completion`, async () => {
    let aborted = 0;
    const late: (() => void)[] = [];
    await fixture(transport, { clientRequests: { timeoutMs: 80, sampling: (_params, signal) => {
      signal.addEventListener("abort", () => aborted++);
      return new Promise((resolve) => late.push(() => resolve(sampled)));
    } } }, async (f) => {
      const running = f.run([request("cancel", "sampling/createMessage", sampling), cancelled("other"), cancelled("cancel"), request("deadline", "sampling/createMessage", sampling)]);
      await running;
      // The first callback can be cancelled before its invocation microtask.
      assert.ok(aborted >= 1 && aborted <= 2);
      assert.deepEqual(replies(f).map((item) => item.error.code), [-32603, -32603]);
      assert.match(replies(f)[0].error.message, /cancelled/); assert.match(replies(f)[1].error.message, /deadline/);
      for (const finish of late) finish();
      await delay(25); assert.equal(replies(f).length, 2);
    });
  });

  test(`${transport}: duplicate ids, max16 and asynchronous out-of-order replies`, async () => {
    let calls = 0;
    const release: (() => void)[] = [];
    await fixture(transport, { clientRequests: { sampling: () => { calls++; return new Promise((resolve) => release.push(() => resolve(sampled))); } } }, async (f) => {
      const messages = [...Array.from({ length: 16 }, (_, i) => request(`s${i}`, "sampling/createMessage", sampling)), request("s0", "sampling/createMessage", sampling), request("overflow", "sampling/createMessage", sampling)];
      const work = f.run(messages);
      await until(() => calls === 16 && replies(f).length === 2);
      assert.equal(replies(f)[0].error.code, -32602); assert.equal(replies(f)[1].error.code, -32603);
      for (const [index, finish] of release.reverse().entries()) { finish(); await until(() => replies(f).length === index + 3); }
      await work;
      assert.deepEqual(replies(f).slice(2).map((item) => item.id), Array.from({ length: 16 }, (_, i) => `s${15 - i}`));
    });
  });

  test(`${transport}: malformed inputs/outputs and thrown errors are bounded without payload echoes`, async () => {
    let invoked = 0;
    const callbacks: McpClientRequests = {
      roots: () => { invoked++; return [{ uri: "https://secret.invalid/", name: "secret" }]; },
      elicitation: () => { invoked++; return { action: "accept", content: { answer: "secret" } }; },
      sampling: () => { invoked++; throw new Error("secret token password"); },
    };
    await fixture(transport, { clientRequests: callbacks }, async (f) => {
      const messages = [request("url", "elicitation/create", { mode: "url", url: "https://secret.invalid/", message: "secret" }), request("bad-schema", "elicitation/create", { ...form, requestedSchema: { type: "object", properties: { nested: { type: "object" } } } }), request("bad-sampling", "sampling/createMessage", { ...sampling, maxTokens: -1 }), request("tools", "sampling/createMessage", { ...sampling, tools: [] }), request("input-cap", "sampling/createMessage", { ...sampling, systemPrompt: "x".repeat(MCP_CLIENT_REQUEST_MAX_INPUT_BYTES) }), request("root", "roots/list"), request("form", "elicitation/create", form), request("throw", "sampling/createMessage", sampling)];
      await f.run(messages);
      assert.equal(invoked, 3);
      assert.deepEqual(replies(f).map((item) => item.error.code).sort(), [-32603, -32603, -32603, -32602, -32602, -32602, -32602, -32602].sort());
      assert.ok(replies(f).every((item) => !JSON.stringify(item.error).includes("secret")));
    });
  });

  test(`${transport}: outer request abort leaves callback independent; close aborts noncooperative callback promptly`, async () => {
    let signal: AbortSignal | undefined;
    let finish!: () => void;
    await fixture(transport, { clientRequests: { sampling: (_p, s) => { signal = s; return new Promise((resolve) => { finish = () => resolve(sampled); }); } } }, async (f) => {
      const controller = new AbortController();
      const work = f.run([request("independent", "sampling/createMessage", sampling)], 1, { hold: true }, controller.signal);
      const rejected = assert.rejects(work, (error: Error) => error.name === "AbortError");
      await until(() => signal !== undefined);
      controller.abort(); await rejected;
      assert.equal(signal!.aborted, false);
      const start = Date.now(); await f.connection.close();
      assert.ok(Date.now() - start < 1500); assert.equal(signal!.aborted, true);
      finish(); await delay(25); assert.equal(replies(f).length, 0);
    });
  });
}

test("callback JSON rejects getters, cycles, oversized results, invalid file roots and missing form fields", async () => {
  const badRoots: unknown[] = [[{ uri: "file://remote/tmp/root" }], [{ uri: "file:///tmp/root?token=secret" }], [{ uri: "file:///tmp/%00" }], [{ uri: "file:///tmp/root", name: "bad\nname" }]];
  for (const value of badRoots) {
    const handler = new McpClientRequestHandler("fixture", { roots: () => value as any }); const out: any[] = [];
    await handler.handle(request("r", "roots/list"), (msg) => { out.push(msg); }); await handler.close(); assert.equal(out[0].error.code, -32603);
  }
  let getterCalled = false;
  const getter = { get role() { getterCalled = true; return "assistant"; }, content: sampled.content, model: "fixture" };
  const cycle: any = { ...sampled }; cycle.extra = cycle;
  for (const value of [getter, cycle, { ...sampled, content: { type: "text", text: "x".repeat(MCP_CLIENT_REQUEST_MAX_RESULT_BYTES) } }, { ...sampled, role: "system" }]) {
    const handler = new McpClientRequestHandler("fixture", { sampling: () => value as any }); const out: any[] = [];
    await handler.handle(request("s", "sampling/createMessage", sampling), (msg) => { out.push(msg); }); await handler.close(); assert.equal(out[0].error.code, -32603);
  }
  assert.equal(getterCalled, false);
  const handler = new McpClientRequestHandler("fixture", { elicitation: () => ({ action: "accept", content: {} }) }); const out: any[] = [];
  await handler.handle(request("e", "elicitation/create", form), (msg) => { out.push(msg); }); await handler.close(); assert.equal(out[0].error.code, -32603);
});

test("cancellation notification aborts the exact active callback and keeps the other live", async () => {
  const signals: AbortSignal[] = [];
  const releases: (() => void)[] = [];
  const handler = new McpClientRequestHandler("fixture", { sampling: (_p, signal) => { signals.push(signal); return new Promise((resolve) => releases.push(() => resolve(sampled))); } });
  const out: any[] = [];
  const a = handler.handle(request("a", "sampling/createMessage", sampling), (msg) => { out.push(msg); });
  const b = handler.handle(request("b", "sampling/createMessage", sampling), (msg) => { out.push(msg); });
  await until(() => signals.length === 2); handler.cancelled({ requestId: "a" }); await a;
  assert.equal(signals[0].aborted, true); assert.equal(signals[1].aborted, false);
  releases[0](); await delay(10); assert.equal(out.length, 1);
  releases[1](); await b; assert.deepEqual(JSON.parse(JSON.stringify(out[1].result)), sampled); await handler.close();
});

test("pending ids stay reserved through error delivery; reuse isolates old callback completion", async () => {
  let releaseOld!: () => void;
  let releaseNew!: () => void;
  let deliver!: () => void;
  let calls = 0;
  let held = false;
  const out: any[] = [];
  const handler = new McpClientRequestHandler("fixture", { timeoutMs: 1000, sampling: () => new Promise((resolve) => { if (++calls === 1) releaseOld = () => resolve(sampled); else releaseNew = () => resolve(sampled); }) });
  const first = handler.handle(request(7, "sampling/createMessage", sampling), async (msg: any) => {
    out.push(msg); held = true; await new Promise<void>((resolve) => { deliver = resolve; });
  });
  await until(() => calls === 1); handler.cancelled({ requestId: 7 }); await until(() => held);
  await handler.handle(request(7, "sampling/createMessage", sampling), (msg) => { out.push(msg); });
  assert.equal(out[1].error.code, -32602); assert.equal(calls, 1);
  deliver(); await first;
  await handler.handle(request(7, "sampling/createMessage", sampling), (msg) => { out.push(msg); });
  assert.equal(out[2].error.code, -32602); assert.equal(calls, 1);
  releaseOld(); await delay(15); assert.equal(out.length, 3);
  const second = handler.handle(request(7, "sampling/createMessage", sampling), (msg) => { out.push(msg); });
  await until(() => calls === 2); releaseNew(); await second;
  assert.deepEqual(JSON.parse(JSON.stringify(out[3].result)), sampled); await handler.close();
});

test("expired noncooperative host promises retain all16 slots and ids until actual settlement", async () => {
  for (const method of ["roots/list", "sampling/createMessage"] as const) {
    const releases: (() => void)[] = [];
    const signals: AbortSignal[] = [];
    const invoke = (signal: AbortSignal) => { signals.push(signal); return new Promise<any>((resolve) => releases.push(() => resolve(method === "roots/list" ? [] : sampled))); };
    const handler = new McpClientRequestHandler("fixture", { timeoutMs: 50, roots: (_ctx, signal) => invoke(signal!), sampling: (_params, signal) => invoke(signal) });
    const out: any[] = [];
    const calls = Array.from({ length: 16 }, (_, id) => handler.handle(request(id, method, method === "roots/list" ? {} : sampling), (msg) => { out.push(msg); }));
    await Promise.all(calls); assert.equal(signals.length, 16); assert.ok(signals.every((signal) => signal.aborted));
    await handler.handle(request(0, method, method === "roots/list" ? {} : sampling), (msg) => { out.push(msg); });
    assert.equal(out.at(-1).error.code, -32602);
    for (let id = 16; id < 40; id++) await handler.handle(request(id, method, method === "roots/list" ? {} : sampling), (msg) => { out.push(msg); });
    assert.equal(signals.length, 16); assert.ok(out.slice(17).every((msg) => msg.error.code === -32603 && /concurrency/.test(msg.error.message)));
    const before = out.length; releases[0](); await delay(10); assert.equal(out.length, before);
    const next = handler.handle(request(0, method, method === "roots/list" ? {} : sampling), (msg) => { out.push(msg); });
    await until(() => signals.length === 17); releases[16](); await next; assert.ok(out.at(-1).result);
    await handler.close(); for (const release of releases) release();
  }
});

test("HTTP JSON response server request still produces independent bounded callback POST", async () => {
  await fixture("http", { clientRequests: { roots: () => [{ uri: "file:///tmp/fixture" }] } }, async (f) => {
    await assert.rejects(f.run([request("json-root", "roots/list")], 1, { jsonServerRequest: true }), /without a matching response/);
    await until(() => replies(f).length === 1);
    assert.deepEqual(replies(f)[0].result, { roots: [{ uri: "file:///tmp/fixture" }] });
    assert.equal(replies(f)[0]._path, "/mcp");
  });
});

test("HTTP callback survives matching response stream completion and replies through same URL later", async () => {
  let release!: () => void;
  await fixture("http", { clientRequests: { sampling: () => new Promise((resolve) => { release = () => resolve(sampled); }) } }, async (f) => {
    assert.equal(await f.run([request("later", "sampling/createMessage", sampling)], 1, { completeImmediately: true }), "done");
    await until(() => release !== undefined); release(); await until(() => replies(f).length === 1);
    assert.deepEqual(replies(f)[0].result, sampled);
  });
});
