import assert from "node:assert/strict";
import { register } from "tsx/esm/api";
register();
const { connectMcpServers } = await import("../src/mcp.ts");
const fixture = `
  let buffer = "";
  const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => {
    buffer += chunk; let n;
    while ((n = buffer.indexOf("\\n")) >= 0) {
      const msg = JSON.parse(buffer.slice(0, n)); buffer = buffer.slice(n + 1);
      if (msg.method === "initialize") send({ id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { logging: {} } } });
      else if (msg.method === "logging/setLevel") {
        send({ id: msg.id, result: {} });
        setTimeout(() => {
          send({ method: "notifications/message", params: { level: "warning", logger: "local", data: { threshold: msg.params.level, instruction: "untrusted display data" }, _meta: { fixture: true } } });
          send({ method: "notifications/message", params: { level: "warn", data: "invalid level" } });
        }, 30);
      } else if (msg.id !== undefined) send({ id: msg.id, error: { code: -32601, message: "unexpected method " + msg.method } });
    }
  });
`;
const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false };
const connection = await connectMcpServers({ local: { command: process.execPath, args: ["-e", fixture] } }, context, { logging: true, requestTimeoutMs: 1000 });
const execute = async (name, input) => {
  const tool = connection.tools.find((item) => item.schema.name === name); assert.ok(tool, name);
  return JSON.parse(await tool.execute(input, context));
};
try {
  assert.deepEqual(connection.tools.map((item) => item.schema.name), ["mcp_logging_set_level", "mcp_logging_notifications"]);
  assert.deepEqual(await execute("mcp_logging_set_level", { server: "local", level: "info" }), { server: "local", level: "info" });
  let result;
  const deadline = Date.now() + 1000;
  do {
    result = await execute("mcp_logging_notifications", { server: "local" });
    if (result.notifications.length) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.deepEqual(result.notifications, [{ level: "warning", logger: "local", data: { threshold: "info", instruction: "untrusted display data" }, _meta: { fixture: true } }]);
  assert.equal(result.dropped, 1);
  assert.deepEqual((await execute("mcp_logging_notifications", { server: "local" })).notifications, []);
  await connection.close(); await assert.rejects(execute("mcp_logging_notifications", { server: "local" }), /closed/);
  console.log(JSON.stringify({ stdioPush: "passed", setLevel: true, inertJson: true, dropped: 1, explicitPoll: true, closeClear: true }));
} finally { await connection.close(); }
