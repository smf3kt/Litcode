import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";

import { connectMcpServers, mcpServersSchema, MCP_PROTOCOL_LIMITS, type McpConnection } from "../src/mcp.js";
import {
  McpHttpClient, MCP_HTTP_LIMITS, MCP_HTTP_CLEANUP_TIMEOUT_MS,
  MCP_HTTP_MAX_FRAME_BYTES, MCP_HTTP_MAX_BODY_BYTES, MCP_HTTP_MAX_SSE_LINE_BYTES,
  MCP_HTTP_MAX_SSE_EVENTS, validateMcpHttpUrl, validateMcpHeadersEnv,
} from "../src/mcp-http.js";
import type { ToolContext } from "../src/tools.js";

type Seen = { method: string; url: string; headers: IncomingMessage["headers"]; body: Record<string, any> };
type Handler = (item: Seen, res: ServerResponse, req: IncomingMessage) => boolean | void | Promise<boolean | void>;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const context = (signal = new AbortController().signal): ToolContext => ({
  workspace: process.cwd(), signal, allowShell: false, maxOutputBytes: 100_000,
});
const tools = [
  { name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } }, annotations: { readOnlyHint: true } },
  { name: "fallback", inputSchema: { type: "object", additionalProperties: false } },
];
function json(res: ServerResponse, id: number, result: unknown): void {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
}

async function fixture(fn: (url: string, seen: Seen[]) => Promise<void>, handler: Handler = () => false, version = "2025-06-18", session = true): Promise<void> {
  const seen: Seen[] = [];
  const failures: unknown[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString();
      const body = text ? JSON.parse(text) : {};
      const item = { method: req.method!, url: req.url!, headers: req.headers, body };
      seen.push(item);
      if (await handler(item, res, req)) return;
      if (req.method === "DELETE") { res.writeHead(204); res.end(); return; }
      if (body.method === "initialize") {
        if (session) res.setHeader("Mcp-Session-Id", "fixture-session");
        json(res, body.id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } });
      } else if (body.method === "tools/list") json(res, body.id, { tools });
      else if (body.method === "tools/call") json(res, body.id, { content: [{ type: "text", text: `echo:${body.params.arguments.text ?? ""}` }] });
      else { res.writeHead(202); res.end(); }
    })().catch((error) => { failures.push(error); res.destroy(); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await fn(`http://127.0.0.1:${address.port}/mcp`, seen); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.deepEqual(failures, []);
}
async function connect(url: string, options = {}): Promise<McpConnection> {
  return connectMcpServers({ http: { type: "http", url } }, context(), options);
}
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) { if (check()) return; await delay(10); }
  assert.fail("loopback fixture did not observe expected event");
}

for (const version of ["2025-06-18", "2025-03-26"]) {
  test(`HTTP initialize negotiates ${version}, session headers, tool adaptation and DELETE`, async () => {
    await fixture(async (url, seen) => {
      const connection = await connect(url);
      try {
        assert.equal(connection.limits, MCP_HTTP_LIMITS);
        assert.equal(seen[0].body.params.protocolVersion, "2025-06-18");
        assert.equal(seen[0].headers.accept, "application/json, text/event-stream");
        assert.equal(seen[0].headers["content-type"], "application/json");
        for (const item of seen.slice(1)) {
          assert.equal(item.headers["mcp-session-id"], "fixture-session");
          assert.equal(item.headers["mcp-protocol-version"], version);
        }
        assert.equal(seen[1].body.method, "notifications/initialized");
        const echo = connection.tools[0];
        assert.equal(echo.schema.name, "mcp__http__echo");
        assert.deepEqual(echo.schema.input_schema, tools[0].inputSchema);
        assert.equal(echo.readOnly, true);
        assert.equal(await echo.execute({ text: "hello" }, context()), "echo:hello");
        assert.equal(connection.tools[1].schema.description, 'Tool "fallback" provided by local MCP server "http".');
      } finally { await connection.close(); await connection.close(); }
      const deletes = seen.filter((item) => item.method === "DELETE");
      assert.equal(deletes.length, 1);
      assert.equal(deletes[0].headers["mcp-session-id"], "fixture-session");
      assert.equal(deletes[0].headers["mcp-protocol-version"], version);
      await assert.rejects(connection.tools[0].execute({}, context()), /closed/);
    }, undefined, version);
  });
}

test("stateless HTTP servers omit session headers and DELETE", async () => {
  await fixture(async (url, seen) => {
    const connection = await connect(url);
    await connection.close();
    assert.ok(seen.every((item) => item.headers["mcp-session-id"] === undefined));
    assert.ok(seen.every((item) => item.method === "POST"));
  }, undefined, "2025-06-18", false);
});

test("strict persisted config preserves old missing args and stores only env references", () => {
  assert.deepEqual(mcpServersSchema.parse({ local: { command: "node" } }), { local: { command: "node" } });
  const http = { remote: { type: "http", url: "http://localhost/mcp?region=local", headersEnv: { Authorization: "MCP_TEST_TOKEN" } } };
  assert.deepEqual(mcpServersSchema.parse(http), http);
  assert.throws(() => mcpServersSchema.parse({ local: { command: "node", env: { TOKEN: "secret" } } }));
  assert.throws(() => mcpServersSchema.parse({ remote: { ...http.remote, headers: { Authorization: "secret" } } }));
});

test("URL/header validation rejects credentials, fragments, schemes, pseudoheaders and transport overrides", () => {
  for (const url of ["http://u:p@localhost/mcp", "http://localhost/mcp?token=x", "http://localhost/mcp?api_key=x", "http://localhost/mcp?%61uth=x", "http://localhost/mcp#part", "http://localhost/mcp#", "file:///tmp/mcp", "bogus"]) {
    assert.throws(() => validateMcpHttpUrl(url));
    assert.throws(() => mcpServersSchema.parse({ remote: { type: "http", url } }));
  }
  for (const mapping of [{ ":authorization": "TOKEN" }, { Host: "TOKEN" }, { "Mcp-Session-Id": "TOKEN" }, { "Content-Type": "TOKEN" }, { "Proxy-Authorization": "TOKEN" }, { Connection: "TOKEN" }, { Authorization: "Bearer token" }, { Authorization: "TOKEN", authorization: "OTHER" }]) {
    assert.throws(() => validateMcpHeadersEnv(mapping));
    assert.throws(() => mcpServersSchema.parse({ remote: { type: "http", url: "http://localhost/mcp", headersEnv: mapping } }));
  }
});

test("HTTP request authentication reads env freshly, redacts RPC errors and never follows redirects", async () => {
  const envName = "CCREVERSE_HTTP_TEST_AUTH";
  const previous = process.env[envName];
  try {
    process.env[envName] = "Bearer first-secret";
    await fixture(async (url, seen) => {
      const connection = await connectMcpServers({ http: { type: "http", url, headersEnv: { Authorization: envName } } }, context());
      try {
        assert.ok(seen.every((item) => item.headers.authorization === "Bearer first-secret"));
        process.env[envName] = "Bearer second-secret";
        assert.equal(await connection.tools[0].execute({}, context()), "echo:");
        assert.equal(seen.at(-1)?.headers.authorization, "Bearer second-secret");
        await assert.rejects(connection.tools[0].execute({ text: "error" }, context()), (error: Error) => {
          assert.match(error.message, /-32001/);
          assert.ok(!error.message.includes("second-secret"));
          return true;
        });
        await assert.rejects(connection.tools[0].execute({ text: "redirect" }, context()), /redirect rejected/);
        assert.ok(!seen.some((item) => item.url === "/leaked"));
      } finally { await connection.close(); }
      assert.equal(seen.at(-1)?.headers.authorization, "Bearer second-secret");
    }, (item, res) => {
      if (item.body.params?.arguments?.text === "error") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: item.body.id, error: { code: -32001, message: `failure ${item.headers.authorization}` } }));
        return true;
      }
      if (item.body.params?.arguments?.text === "redirect") {
        res.writeHead(307, { Location: "/leaked" }); res.end(); return true;
      }
      if (item.url === "/leaked") assert.fail("redirect was followed");
      return false;
    });
  } finally { if (previous === undefined) delete process.env[envName]; else process.env[envName] = previous; }
});

test("RPC errors exclude credentials after rotation during an active request", async () => {
  const envName = "CCREVERSE_HTTP_TEST_ROTATING";
  const previous = process.env[envName];
  process.env[envName] = "Bearer earlier-secret";
  try {
    await fixture(async (url) => {
      const connection = await connectMcpServers({ http: { type: "http", url, headersEnv: { Authorization: envName } } }, context());
      try {
        await assert.rejects(connection.tools[0].execute({}, context()), (error: Error) => {
          assert.match(error.message, /code -32000/);
          assert.ok(!error.message.includes("earlier-secret"));
          return true;
        });
      } finally { await connection.close(); }
    }, (item, res) => {
      if (item.body.method !== "tools/call") return false;
      process.env[envName] = "Bearer later-secret";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: item.body.id, error: { code: -32000, message: item.headers.authorization } }));
      return true;
    });
  } finally { if (previous === undefined) delete process.env[envName]; else process.env[envName] = previous; }
});

test("missing or invalid auth environment fails before any network request without leaking values", async () => {
  const envName = "CCREVERSE_HTTP_TEST_MISSING";
  const previous = process.env[envName];
  try {
    await fixture(async (url, seen) => {
      for (const value of [undefined, "", "secret\nheader"]) {
        if (value === undefined) delete process.env[envName]; else process.env[envName] = value;
        await assert.rejects(connectMcpServers({ srv: { type: "http", url, headersEnv: { Authorization: envName } } }, context()), /environment value/);
      }
      assert.deepEqual(seen, []);
    });
  } finally { if (previous === undefined) delete process.env[envName]; else process.env[envName] = previous; }
});

test("JSON response streaming decodes a Unicode codepoint split across reads", async () => {
  await fixture(async (url) => {
    const connection = await connect(url);
    try { assert.equal(await connection.tools[0].execute({}, context()), "partial:你好"); }
    finally { await connection.close(); }
  }, async (item, res) => {
    if (item.body.method !== "tools/call") return false;
    res.writeHead(200, { "Content-Type": "application/json" });
    const payload = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: item.body.id, result: { content: [{ type: "text", text: "partial:你好" }] } }));
    const split = payload.indexOf(Buffer.from("你")) + 1;
    res.write(payload.subarray(0, split));
    await delay(10);
    res.end(payload.subarray(split));
    return true;
  });
});

test("SSE parses multiline data, partial UTF-8, comments, empty events and CR/LF boundaries", async () => {
  await fixture(async (url) => {
    const connection = await connect(url);
    try { assert.equal(await connection.tools[0].execute({}, context()), "chunk:你好"); }
    finally { await connection.close(); }
  }, async (item, res) => {
    if (item.body.method !== "tools/call") return false;
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
    const payload = Buffer.from(`﻿: comment\r\n\r\ndata:\r\n\r\nid: ignored\nretry: 42\n\ndata: {"jsonrpc":"2.0",\r\ndata: "id":${item.body.id},"result":{"content":[{"type":"text","text":"chunk:你好"}]}}\r\n\r\n`);
    const split = payload.indexOf(Buffer.from("你")) + 1;
    for (const byte of payload.subarray(0, split)) { if (res.destroyed) break; res.write(Buffer.from([byte])); }
    await delay(10);
    for (const byte of payload.subarray(split)) { if (res.destroyed) break; res.write(Buffer.from([byte])); }
    // Leave the response open: client must cancel after its result.
    return true;
  });
});

test("SSE responds to server requests with method-not-found and ignores notifications", async () => {
  await fixture(async (url, seen) => {
    const connection = await connect(url);
    try {
      assert.equal(await connection.tools[0].execute({}, context()), "completed");
      const reply = seen.find((item) => item.body.id === "server-request");
      assert.equal(reply?.body.error.code, -32601);
      assert.equal(reply?.headers["mcp-session-id"], "fixture-session");
    } finally { await connection.close(); }
  }, (item, res) => {
    if (item.body.method !== "tools/call") return false;
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end([
      { jsonrpc: "2.0", id: "server-request", method: "sampling/createMessage", params: {} },
      { jsonrpc: "2.0", method: "notifications/progress", params: {} },
      { jsonrpc: "2.0", id: item.body.id, result: { content: [{ type: "text", text: "completed" }] } },
    ].map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join(""));
    return true;
  });
});

for (const [name, raw] of [
  ["wrong id", (id: number) => ({ jsonrpc: "2.0", id: id + 1, result: {} })],
  ["string id", (id: number) => ({ jsonrpc: "2.0", id: String(id), result: {} })],
  ["wrong jsonrpc", (id: number) => ({ jsonrpc: "1.0", id, result: {} })],
  ["both result/error", (id: number) => ({ jsonrpc: "2.0", id, result: {}, error: { code: -1, message: "error" } })],
  ["missing result", (id: number) => ({ jsonrpc: "2.0", id })],
  ["invalid error", (id: number) => ({ jsonrpc: "2.0", id, error: "bad" })],
] as const) {
  test(`HTTP rejects ${name}`, async () => {
    await fixture(async (url) => {
      const connection = await connect(url);
      try { await assert.rejects(connection.tools[0].execute({}, context()), /JSON-RPC|response/); }
      finally { await connection.close(); }
    }, (item, res) => {
      if (item.body.method !== "tools/call") return false;
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(raw(item.body.id))); return true;
    });
  });
}

for (const version of ["2024-11-05", "2026-01-01", ""]) {
  test(`HTTP rejects unsupported initialize version ${version || "missing"} before initialized`, async () => {
    await fixture(async (url, seen) => {
      await assert.rejects(connect(url), /protocolVersion/);
      assert.ok(!seen.some((item) => item.body.method === "notifications/initialized"));
      assert.equal(seen.at(-1)?.method, "DELETE");
    }, undefined, version);
  });
}

test("HTTP rejects a non-202 initialized acknowledgement and rolls back session", async () => {
  await fixture(async (url, seen) => {
    await assert.rejects(connect(url), /202 acknowledgement/);
    assert.equal(seen.at(-1)?.method, "DELETE");
  }, (item, res) => {
    if (item.body.method !== "notifications/initialized") return false;
    res.writeHead(200); res.end(); return true;
  });
});

test("HTTP tools/list uses shared pagination and rejects cursor cycles", async () => {
  await fixture(async (url) => {
    const connection = await connect(url);
    assert.equal(connection.tools.length, 2);
    await connection.close();
  }, (item, res) => {
    if (item.body.method !== "tools/list") return false;
    json(res, item.body.id, item.body.params.cursor ? { tools: [tools[1]] } : { tools: [tools[0]], nextCursor: "p2" }); return true;
  });
  await fixture(async (url) => { await assert.rejects(connect(url), /cycle/); }, (item, res) => {
    if (item.body.method !== "tools/list") return false;
    json(res, item.body.id, { tools: [], nextCursor: "loop" }); return true;
  });
});

test("HTTP tool isError, structured results, invalid input and output caps retain adapter behavior", async () => {
  await fixture(async (url, seen) => {
    const connection = await connect(url);
    try {
      await assert.rejects(connection.tools[0].execute("wrong", context()), /object input/);
      assert.equal(seen.filter((item) => item.body.method === "tools/call").length, 0);
      await assert.rejects(connection.tools[0].execute({ text: "error" }, context()), /tool error/);
      assert.match(await connection.tools[0].execute({}, context()), /structuredContent/);
      const small = await connection.tools[0].execute({}, { ...context(), maxOutputBytes: 10 });
      assert.match(small, /truncated/);
      assert.ok(!small.includes("�"));
    } finally { await connection.close(); }
  }, (item, res) => {
    if (item.body.method !== "tools/call") return false;
    json(res, item.body.id, item.body.params.arguments.text === "error"
      ? { content: [{ type: "text", text: "tool error" }], isError: true }
      : { content: [{ type: "image", data: "AAAA", mimeType: "image/png" }], structuredContent: { ok: true } }); return true;
  });
});

for (const mode of ["abort", "timeout", "close"] as const) {
  test(`HTTP ${mode} tears down a hanging response and bounds cancellation/cleanup`, async () => {
    let streamClosed = false;
    await fixture(async (url, seen) => {
      const connection = await connect(url, { requestTimeoutMs: mode === "timeout" ? 200 : 3000 });
      try {
        const controller = new AbortController();
        const pending = connection.tools[0].execute({}, context(controller.signal));
        const rejected = assert.rejects(pending, (error: Error) => {
          if (mode === "timeout") assert.match(error.message, /tools\/call.*timed out after 200ms/);
          else assert.equal(error.name, "AbortError");
          return true;
        });
        await until(() => seen.some((item) => item.body.method === "tools/call"));
        if (mode === "abort") controller.abort();
        if (mode === "close") await connection.close();
        await rejected;
        await until(() => streamClosed);
        if (mode !== "close") {
          await until(() => seen.some((item) => item.body.method === "notifications/cancelled"));
          const cancelled = seen.find((item) => item.body.method === "notifications/cancelled")!;
          assert.equal(cancelled.body.params.requestId, seen.find((item) => item.body.method === "tools/call")?.body.id);
          assert.equal(cancelled.body.params.reason, mode === "abort" ? "client aborted" : "timeout");
        }
      } finally { await connection.close(); }
    }, (item, res) => {
      if (item.body.method !== "tools/call") return false;
      res.on("close", () => { streamClosed = true; });
      res.writeHead(200, { "content-type": "text/event-stream" }); res.write(": hang\n\n"); return true;
    });
  });
}

test("HTTP pre-aborted connect makes zero requests", async () => {
  await fixture(async (url, seen) => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(connectMcpServers({ http: { type: "http", url } }, context(controller.signal)), { name: "AbortError" });
    assert.deepEqual(seen, []);
  });
});

test("DELETE hanging headers and response bodies are aborted within the cleanup deadline", async () => {
  await fixture(async (url, seen) => {
    const connection = await connect(url);
    const start = Date.now();
    const first = connection.close();
    await Promise.all([first, connection.close()]);
    assert.ok(Date.now() - start < MCP_HTTP_CLEANUP_TIMEOUT_MS + 1000);
    assert.equal(seen.filter((item) => item.method === "DELETE").length, 1);
  }, (item) => item.method === "DELETE");
  await fixture(async (url) => {
    const connection = await connect(url);
    const start = Date.now();
    await connection.close();
    assert.ok(Date.now() - start < MCP_HTTP_CLEANUP_TIMEOUT_MS + 1000);
  }, (item, res) => {
    if (item.method !== "DELETE") return false;
    res.writeHead(200); res.write("infinite response"); return true;
  });
});

for (const mode of ["json", "json-chunks", "sse-line", "sse-event", "sse-body", "sse-count", "invalid-json", "invalid-utf8", "wrong-content-type", "truncated-sse"] as const) {
  test(`HTTP rejects ${mode} malformed/oversized response`, async () => {
    await fixture(async (url) => {
      const connection = await connect(url);
      try { await assert.rejects(connection.tools[0].execute({}, context()), /limit|invalid|requires|without a matching/); }
      finally { await connection.close(); }
    }, (item, res) => {
      if (item.body.method !== "tools/call") return false;
      res.writeHead(200, { "content-type": mode.startsWith("sse") || mode === "truncated-sse" ? "text/event-stream" : mode === "wrong-content-type" ? "text/plain" : "application/json" });
      if (mode === "json" || mode === "json-chunks") {
        const huge = "x".repeat(MCP_HTTP_MAX_FRAME_BYTES + 1);
        if (mode === "json") res.end(huge);
        else { for (let i = 0; i < huge.length; i += 65536) res.write(huge.slice(i, i + 65536)); res.end(); }
      } else if (mode === "sse-line") res.end(`data: ${"x".repeat(MCP_HTTP_MAX_SSE_LINE_BYTES)}\n\n`);
      else if (mode === "sse-event") res.end(`data: ${"x".repeat(60000)}\n`.repeat(20) + "\n");
      else if (mode === "sse-body") res.end(`: ${"x".repeat(60000)}\n\n`.repeat(Math.ceil(MCP_HTTP_MAX_BODY_BYTES / 60000) + 1));
      else if (mode === "sse-count") res.end("\n".repeat(MCP_HTTP_MAX_SSE_EVENTS + 1));
      else if (mode === "invalid-json") res.end("bad JSON");
      else if (mode === "invalid-utf8") res.end(Buffer.from([0xc3, 0x28]));
      else if (mode === "truncated-sse") res.end(`data: {"jsonrpc":"2.0","id":${item.body.id},"result":{}}\n`);
      else res.end("{}");
      return true;
    });
  });
}

test("HTTP connect collision rolls back all opened sessions", async () => {
  await fixture(async (url, seen) => {
    await assert.rejects(connectMcpServers({ "a.b": { type: "http", url }, a_b: { type: "http", url } }, context()), /collision/);
    assert.equal(seen.filter((item) => item.method === "DELETE").length, 2);
  });
});

test("mixed transports report conditional limits and preserve stdio direct env API", async () => {
  const script = `process.stdin.setEncoding('utf8');let b='';process.stdin.on('data',c=>{b+=c;let i;while((i=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,i));b=b.slice(i+1);if(m.method==='initialize')console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2024-11-05'}}));if(m.method==='tools/list')console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{tools:[{name:process.env.CCREVERSE_TEST_STDIO_ENV,inputSchema:{type:'object'}}]}}));}});`;
  await fixture(async (url) => {
    const connection = await connectMcpServers({
      remote: { type: "http", url },
      local: { command: process.execPath, args: ["-e", script], env: { CCREVERSE_TEST_STDIO_ENV: "fromenv" } },
    }, context());
    try {
      assert.ok(connection.tools.some((tool) => tool.schema.name === "mcp__local__fromenv"));
      assert.deepEqual(connection.limits, [...MCP_PROTOCOL_LIMITS, ...MCP_HTTP_LIMITS]);
    } finally { await connection.close(); }
  });
});

test("public HTTP client rejects calls before initialization", async () => {
  await fixture(async (url, seen) => {
    const client = new McpHttpClient("http", { type: "http", url });
    await assert.rejects(client.listTools(context().signal), /initialized/);
    await assert.rejects(client.callTool("echo", {}, context().signal), /initialized/);
    await client.close();
    assert.deepEqual(seen, []);
  });
});
