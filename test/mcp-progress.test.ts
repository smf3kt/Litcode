import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig } from "../src/agent.js";
import { MCP_HTTP_LIMITS } from "../src/mcp-http.js";
import { connectMcpServers, type McpConnectOptions } from "../src/mcp.js";
import { MCP_PROGRESS_LIMITS, MCP_PROGRESS_MESSAGE_BYTES, McpProgressRegistry, mcpProgressUpdate, type McpProgressUpdate } from "../src/mcp-progress.js";
import { createRuntime } from "../src/runtime.js";
import type { ToolContext } from "../src/tools.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const context = (signal = new AbortController().signal): ToolContext => ({ workspace: process.cwd(), signal, allowShell: false, maxOutputBytes: 100_000 });

test("progress payloads are bounded to a token, a finite progress and a bounded message", () => {
  const token = "litcode-progress-1";
  assert.deepEqual(mcpProgressUpdate({ progressToken: token, progress: 1 }), { token, progress: 1 });
  assert.deepEqual(mcpProgressUpdate({ progressToken: token, progress: 2, total: 4, message: "half" }),
    { token, progress: 2, total: 4, message: "half" });
  for (const params of [
    undefined, null, [], "progress", {},
    { progressToken: "", progress: 1 },
    { progressToken: "x".repeat(129), progress: 1 },
    { progressToken: token, progress: Number.NaN },
    { progressToken: token, progress: "1" },
    { progressToken: token, progress: 1, total: Number.POSITIVE_INFINITY },
    { progressToken: token, progress: 1, message: "x".repeat(MCP_PROGRESS_MESSAGE_BYTES + 1) },
  ]) assert.equal(mcpProgressUpdate(params), undefined, JSON.stringify(params)?.slice(0, 60));
});

test("only an open call receives its own token's progress, and settling retires it", () => {
  const registry = new McpProgressRegistry("t-");
  const first = registry.reserve();
  const second = registry.reserve();
  assert.notEqual(first, second);
  const seen: unknown[] = [];
  registry.arm(first, (update) => { seen.push(update); });
  assert.equal(registry.dispatch({ progressToken: second, progress: 1 }), false, "a token that names no open call is dropped");
  assert.equal(registry.dispatch({ progressToken: first, progress: 1, message: "live" }), true);
  assert.deepEqual(seen, [{ token: first, progress: 1, message: "live" }]);
  registry.settle(first);
  assert.equal(registry.dispatch({ progressToken: first, progress: 2 }), false, "a retired token is dropped");
  assert.equal(registry.size, 0);
});

// Inline child: reports progress on its own token every 40ms and answers after three reports.
// A call that brings no token is answered at once, which is how the test detects token issuance.
const STDIO = String.raw`
const readline = require('node:readline');
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') send({ jsonrpc:'2.0', id:msg.id, result:{ protocolVersion:'2024-11-05', capabilities:{ tools:{} } } });
  else if (msg.method === 'tools/list') send({ jsonrpc:'2.0', id:msg.id, result:{ tools:[{ name:'slow', inputSchema:{ type:'object' } }] } });
  else if (msg.method === 'tools/call') {
    const token = msg.params && msg.params._meta && msg.params._meta.progressToken;
    if (typeof token !== 'string') return send({ jsonrpc:'2.0', id:msg.id, result:{ content:[{ type:'text', text:'no-token' }] } });
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      send({ jsonrpc:'2.0', method:'notifications/progress', params:{ progressToken:token, progress:n, total:3, message:'step ' + n } });
      if (n === 3) { clearInterval(timer); send({ jsonrpc:'2.0', id:msg.id, result:{ content:[{ type:'text', text:'done' }] } }); }
    }, 40);
  }
});
`;

// A child that ignores the token it is given: nothing reports progress, so only a deadline ends it.
const STDIO_SILENT = String.raw`
const readline = require('node:readline');
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') send({ jsonrpc:'2.0', id:msg.id, result:{ protocolVersion:'2024-11-05', capabilities:{ tools:{} } } });
  else if (msg.method === 'tools/list') send({ jsonrpc:'2.0', id:msg.id, result:{ tools:[{ name:'slow', inputSchema:{ type:'object' } }] } });
  else if (msg.method === 'tools/call') setTimeout(() => send({ jsonrpc:'2.0', id:msg.id, result:{ content:[{ type:'text', text:'done' }] } }), 3000);
});
`;

async function withServer<T>(options: McpConnectOptions, fn: (call: () => Promise<string>) => Promise<T>, script = STDIO): Promise<T> {
  const connection = await connectMcpServers(
    { fixture: { command: process.execPath, args: ["-e", script] } }, context(),
    { requestTimeoutMs: 400, ...options });
  try {
    const tool = connection.tools[0]!;
    return await fn(async () => {
      const result = await tool.execute({}, context());
      return result;
    });
  } finally { await connection.close(); }
}

test("a tool call carries a token and stays alive while it reports progress", { timeout: 5000 }, async () => {
  const updates: { server: string; progress: number; total?: number; message?: string }[] = [];
  await withServer({ toolIdleTimeoutMs: 60, onProgress: (event) => { updates.push(event); } }, async (call) => {
    // Three reports 40ms apart outlive the 60ms idle deadline twice, and finish inside the 400ms total.
    assert.equal(await call(), "done");
  });
  assert.equal(updates.length, 3);
  assert.deepEqual(updates.map((update) => update.progress), [1, 2, 3]);
  assert.deepEqual(updates.map((update) => update.message), ["step 1", "step 2", "step 3"]);
  assert.ok(updates.every((update) => update.server === "fixture" && update.total === 3));
});

test("a call that never reports is still cut off at its idle deadline", { timeout: 5000 }, async () => {
  await withServer({ toolIdleTimeoutMs: 60 }, async (call) => {
    await assert.rejects(call, /timed out after 60ms/);
  }, STDIO_SILENT);
});

test("the idle deadline never moves past the total deadline", { timeout: 5000 }, async () => {
  await withServer({ requestTimeoutMs: 300, toolIdleTimeoutMs: 60 }, async (call) => {
    // Reports keep arriving every 40ms, so the call outlives its idle deadline twice and still ends.
    assert.equal(await call(), "done");
  });

  // Reporting every 40ms cannot outlive the 90ms ceiling: the call still ends at the total.
  await withServer({ requestTimeoutMs: 90, toolIdleTimeoutMs: 60 }, async (call) => {
    await assert.rejects(call, /timed out after 90ms/);
  });
  await delay(10);
});

// The progress envelope is one contract spoken by both transports, so both limits lists state it.
test("both transports describe the progress envelope they speak", { timeout: 5000 }, async () => {
  const connection = await connectMcpServers({ fixture: { command: process.execPath, args: ["-e", STDIO] } }, context(), { toolIdleTimeoutMs: 60 });
  try {
    for (const limit of MCP_PROGRESS_LIMITS) {
      assert.ok(connection.limits.includes(limit), limit);
      assert.ok(MCP_HTTP_LIMITS.includes(limit), limit);
    }
  } finally { await connection.close(); }
});

test("HTTP tool calls carry a token and route progress on the call's own stream", { timeout: 5000 }, async () => {
  const notifications: unknown[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const json = (result: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
      if (body.method === "initialize") return json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
      if (body.method === "tools/list") return json({ tools: [{ name: "slow", inputSchema: { type: "object" } }] });
      if (body.method === "tools/call") {
        const token = body.params?._meta?.progressToken;
        res.writeHead(200, { "content-type": "text/event-stream" });
        let n = 0;
        const timer = setInterval(() => {
          n += 1;
          res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: token, progress: n, total: 3 } })}\n\n`);
          if (n === 3) { clearInterval(timer); res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "done" }] } })}\n\n`); }
        }, 40);
        return;
      }
      res.writeHead(202); res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const connection = await connectMcpServers({ fixture: { type: "http", url: `http://127.0.0.1:${address.port}/mcp` } }, context(),
    { requestTimeoutMs: 300, toolIdleTimeoutMs: 60, onProgress: (event) => { notifications.push(event); } });
  try {
    assert.equal(await connection.tools[0]!.execute({}, context()), "done");
    assert.deepEqual(notifications.map((event) => (event as { progress: number }).progress), [1, 2, 3]);
  } finally {
    await connection.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// The runtime is the only product caller of connectMcpServers, so the observer has to reach a
// server's progress through it rather than only through a hand-built connection.
test("the runtime hands a server's call progress to its own observer", { timeout: 5000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-progress-runtime-")));
  const failures: unknown[] = [];
  const server = http.createServer((req, res) => { void (async () => {
    if (req.method !== "POST") { res.writeHead(req.method === "DELETE" ? 204 : 405).end(); return; }
    let text = ""; for await (const chunk of req) text += String(chunk);
    const body = JSON.parse(text);
    const json = (result: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
    if (body.method === "initialize") return json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
    if (body.method === "tools/list") return json({ tools: [{ name: "slow", inputSchema: { type: "object" } }] });
    if (body.method === "tools/call") {
      const token = body.params?._meta?.progressToken;
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const n of [1, 2]) res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: token, progress: n } })}\n\n`);
      res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "done" }] } })}\n\n`);
      return;
    }
    res.writeHead(202).end();
  })().catch((error) => { failures.push(error); res.destroy(); }); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const config = { ...defaultConfig(workspace, []), model: "fixture", mcpServers: { fixture: { type: "http" as const, url: `http://127.0.0.1:${address.port}/mcp` } } };
  const pinned: string[] = [];
  const seen: (McpProgressUpdate & { server: string })[] = [];
  const runtime = await createRuntime(config, { count: async () => 0, complete: async () => { throw new Error("no model call"); } },
    new AbortController().signal, { mcpProgress: (current) => { pinned.push(current.workspace); return (event) => { seen.push(event); }; } });
  try {
    const tool = runtime.tools.find((candidate) => candidate.schema.name === "mcp__fixture__slow");
    assert.ok(tool, "the server's tool is exposed to the session");
    assert.equal(await tool.execute({}, context()), "done");
    assert.deepEqual(pinned, [workspace], "the observer is rebuilt from the runtime's own configuration");
    assert.deepEqual(seen.map((event) => [event.server, event.progress]), [["fixture", 1], ["fixture", 2]]);
    assert.equal(new Set(seen.map((event) => event.token)).size, 1, "both reports name the one call");
    assert.deepEqual(failures, []);
  } finally {
    await runtime.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
