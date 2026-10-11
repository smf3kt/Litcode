import assert from "node:assert/strict";
import { createServer } from "node:http";
import { register } from "tsx/esm/api";
register();
const { connectMcpServers } = await import("../src/mcp.ts");
let stream, gets = 0, streamClosed = false, initialized = false;
const failures = [];
const server = createServer((req, res) => {
  void (async () => {
    if (req.method === "GET") {
      gets++; assert.equal(initialized, true);
      assert.equal(req.headers["mcp-session-id"], "owned-stream");
      assert.equal(req.headers["mcp-protocol-version"], "2025-06-18");
      res.writeHead(200, { "content-type": "text/event-stream" }); res.flushHeaders();
      stream = res; res.on("close", () => { streamClosed = true; }); return;
    }
    if (req.method === "DELETE") { res.writeHead(204).end(); return; }
    let text = ""; for await (const chunk of req) text += chunk;
    const msg = JSON.parse(text);
    const reply = (result) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
    if (msg.method === "initialize") { res.setHeader("Mcp-Session-Id", "owned-stream"); reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, logging: {}, resources: { subscribe: true } } }); }
    else if (msg.method === "notifications/initialized") { initialized = true; res.writeHead(202).end(); }
    else if (msg.method === "tools/list") reply({ tools: [{ name: "echo", inputSchema: { type: "object" } }] });
    else if (msg.method === "resources/subscribe" || msg.method === "logging/setLevel") reply({});
    else if (msg.method === "tools/call") reply({ content: [{ type: "text", text: "POST remains available" }] });
    else res.writeHead(202).end();
  })().catch((error) => { failures.push(error); res.destroy(); });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false };
let connection;
const wait = async (check) => {
  const deadline = Date.now() + 2000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(check());
};
try {
  connection = await connectMcpServers({ local: { type: "http", url: `http://127.0.0.1:${server.address().port}/mcp` } }, context,
    { notificationStream: true, logging: true, subscriptions: true, requestTimeoutMs: 2000 });
  const execute = async (name, input) => {
    const tool = connection.tools.find((item) => item.schema.name === name); assert.ok(tool);
    return tool.execute(input, context);
  };
  await wait(() => connection.notificationStreams().local.state === "active");
  await execute("mcp_resource_subscribe", { server: "local", uri: "fixture://notes" });
  // Send unsolicited updates with no POST request active.
  stream.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: "idle GET push" } })}\n\n`);
  stream.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri: "fixture://notes" } })}\n\n`);
  let resources;
  const deadline = Date.now() + 2000;
  do {
    resources = JSON.parse(await execute("mcp_resource_notifications", { server: "local" }));
    if (resources.notifications.length) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  } while (Date.now() < deadline);
  assert.deepEqual(resources.notifications, [{ uri: "fixture://notes" }]);
  assert.deepEqual(JSON.parse(await execute("mcp_logging_notifications", { server: "local" })).notifications, [{ level: "info", data: "idle GET push" }]);
  assert.equal(await execute("mcp__local__echo", {}), "POST remains available");
  await connection.close(); await wait(() => streamClosed);
  assert.equal(connection.notificationStreams().local.state, "closed");
  assert.equal(gets, 1); assert.deepEqual(failures, []);
  console.log(JSON.stringify({ ownedHttpGetPush: "passed", idleLogs: true, resources: true, postConcurrent: true, closeReader: true, gets }));
} finally {
  await connection?.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(() => resolve()));
}
