import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { connectMcpServers, type McpConnection } from "../src/mcp.js";
import { McpLogging, MCP_LOG_LEVELS, MCP_MAX_LOG_QUEUE_BYTES } from "../src/mcp-logging.js";
import type { ToolContext } from "../src/tools.js";
const signal = () => new AbortController().signal;
const context = (): ToolContext => ({ workspace: process.cwd(), signal: signal(), allowShell: false, maxOutputBytes: 100_000 });
function tool(connection: McpConnection, name: string) {
  const found = connection.tools.find((item) => item.schema.name === name); assert.ok(found, name); return found;
}
const call = async (connection: McpConnection, name: string, input: unknown, ctx = context()) => JSON.parse(await tool(connection, name).execute(input, ctx));

test("logging preserves inert JSON, validates levels/data/metadata and reports bounded queue loss without draining capped polls", async () => {
  const levels: unknown[] = [];
  const logging = new McpLogging(async (_method, params, _signal, commit) => { levels.push(params.level); commit({}); return {}; }, () => true);
  for (const level of MCP_LOG_LEVELS) await logging.setLevel(level, signal());
  assert.deepEqual(levels, MCP_LOG_LEVELS);
  for (const level of ["WARN", "warn", "INFO", "", 1, null]) await assert.rejects(logging.setLevel(level, signal()), /level must/);
  assert.equal(levels.length, 8);
  const data = JSON.parse("{\"__proto__\":{\"polluted\":true},\"text\":\"execute shell command\"}");
  logging.message({ level: "info", logger: "fixture", data, _meta: { source: "local" } });
  assert.deepEqual(JSON.parse(logging.poll("srv", 1, 100_000, signal())).notifications, [{ level: "info", logger: "fixture", data, _meta: { source: "local" } }]);
  let deep: unknown = null; for (let i = 0; i < 20; i++) deep = { child: deep };
  const invalid = [
    { level: "info" }, { level: "warn", data: null }, { level: "info", data: null, logger: 1 },
    { level: "info", data: null, logger: "x".repeat(1025) }, { level: "info", data: "x".repeat(16384) },
    { level: "info", data: null, _meta: "bad" }, { level: "info", data: null, _meta: { long: "x".repeat(4096) } },
    { level: "info", data: deep }, { level: "info", data: Array.from({ length: 2049 }, () => 0) },
    { level: "info", data: Number.NaN }, { level: "info", data: null, extra: true },
  ];
  for (const params of invalid) logging.message(params);
  let getterCalls = 0;
  logging.message({ level: "info", get data() { getterCalls++; return "bad"; } });
  assert.equal(getterCalls, 0);
  for (let i = 0; i < 150; i++) logging.message({ level: "debug", data: i });
  assert.throws(() => logging.poll("srv", 128, 2, signal()), /budget/);
  const batch = JSON.parse(logging.poll("srv", 1, 100_000, signal()));
  assert.equal(batch.dropped, invalid.length + 1 + 22); assert.equal(batch.remaining, 127); assert.equal(batch.notifications[0].data, 22);
  assert.equal(JSON.parse(logging.poll("srv", 128, 100_000, signal())).dropped, 0);
  for (let i = 0; i < 10; i++) logging.message({ level: "emergency", data: "x".repeat(12000) });
  const bytes = JSON.parse(logging.poll("srv", 128, 100_000, signal()));
  assert.equal(bytes.notifications.length, 2); assert.equal(bytes.dropped, 8);
  assert.ok(Buffer.byteLength(JSON.stringify(bytes.notifications)) <= MCP_MAX_LOG_QUEUE_BYTES);
  logging.close(); logging.message({ level: "info", data: null });
  assert.equal(logging.supports(), false); assert.throws(() => logging.poll("srv", 1, 100_000, signal()), /closed/);
});

test("HTTP logging preserves defaults, exact capability gating, POST SSE isolation and bounded setLevel failures/cancellation", async () => {
  let capability: unknown = {}, response: "ok" | "error" | "malformed" | "hang" = "ok";
  const seen: any[] = [], methods: string[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      methods.push(req.method!);
      if (req.method === "DELETE") { res.writeHead(204).end(); return; }
      let text = ""; for await (const chunk of req) text += chunk;
      const msg = JSON.parse(text); seen.push(msg);
      const reply = (result: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
      if (msg.method === "initialize") { res.setHeader("Mcp-Session-Id", "logging-session"); reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, logging: capability } }); }
      else {
        assert.equal(req.headers["mcp-session-id"], "logging-session");
        assert.equal(req.headers["mcp-protocol-version"], "2025-06-18");
        if (msg.method === "tools/list") reply({ tools: [] });
        else if (msg.method === "logging/setLevel") {
          res.writeHead(200, { "content-type": "text/event-stream" });
          res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: { level: "notice", logger: "fixture", data: { selected: msg.params.level } } })}\n\n`);
          if (response === "hang") return;
          if (response === "error") res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -1, message: "remote error" } })}\n\n`);
          else res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: response === "malformed" ? null : {} })}\n\n`);
        } else res.writeHead(202).end();
      }
    })().catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const config = { srv: { type: "http" as const, url: `http://127.0.0.1:${address.port}/mcp` } };
  try {
    const defaults = await connectMcpServers(config, context());
    const oldLimits = [...defaults.limits]; assert.deepEqual(defaults.tools, []); await defaults.close();
    const off = await connectMcpServers(config, context(), { logging: false }); assert.deepEqual(off.tools, []); assert.deepEqual(off.limits, oldLimits); await off.close();
    for (const absent of [undefined, true, null, []]) {
      capability = absent; const gated = await connectMcpServers(config, context(), { logging: true }); assert.deepEqual(gated.tools, []); await gated.close();
    }
    capability = {};
    // The budget covers the spawned server's own boot and handshake, which costs 150-170ms on a busy host.
    const connection = await connectMcpServers(config, context(), { logging: true, requestTimeoutMs: 2000 });
    const other = await connectMcpServers(config, context(), { logging: true });
    try {
      assert.deepEqual(connection.tools.map((item) => item.schema.name), ["mcp_logging_set_level", "mcp_logging_notifications"]);
      assert.equal(tool(connection, "mcp_logging_set_level").readOnly, false); assert.equal(tool(connection, "mcp_logging_notifications").readOnly, true);
      assert.deepEqual(await call(connection, "mcp_logging_set_level", { server: "srv", level: "info" }), { server: "srv", level: "info" });
      const beforePoll = seen.length;
      assert.deepEqual((await call(connection, "mcp_logging_notifications", { server: "srv", limit: 1 })).notifications, [{ level: "notice", logger: "fixture", data: { selected: "info" } }]);
      assert.equal((await call(other, "mcp_logging_notifications", { server: "srv" })).notifications.length, 0);
      assert.equal(seen.length, beforePoll);
      for (const args of [{ server: "srv", level: "warn" }, { server: "missing", level: "info" }, { server: "srv", level: "info", extra: true }]) await assert.rejects(call(connection, "mcp_logging_set_level", args));
      for (const limit of [0, 129, "1"]) await assert.rejects(call(connection, "mcp_logging_notifications", { server: "srv", limit }));
      const aborted = new AbortController(); aborted.abort();
      await assert.rejects(call(connection, "mcp_logging_set_level", { server: "srv", level: "info" }, { ...context(), signal: aborted.signal }), { name: "AbortError" });
      assert.equal(seen.length, beforePoll);
      for (const mode of ["error", "malformed", "hang"] as const) {
        response = mode;
        await assert.rejects(call(connection, "mcp_logging_set_level", { server: "srv", level: "error" }), /code -1|invalid result|timed out/);
      }
      assert.ok(methods.every((method) => method === "POST" || method === "DELETE"));
    } finally { await Promise.all([connection.close(), other.close()]); }
    await assert.rejects(call(connection, "mcp_logging_notifications", { server: "srv" }), /closed/);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
