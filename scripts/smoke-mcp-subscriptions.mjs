import assert from "node:assert/strict";
import { register } from "tsx/esm/api";
register();
const { connectMcpServers } = await import("../src/mcp.ts");

// The child is an owned local protocol fixture. Its timer emits unsolicited
// stdout push after the subscribe response, with no active client request.
const fixture = `
  let buffer = "";
  const subscriptions = new Set();
  const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => {
    buffer += chunk; let n;
    while ((n = buffer.indexOf("\\n")) >= 0) {
      const msg = JSON.parse(buffer.slice(0, n)); buffer = buffer.slice(n + 1);
      if (msg.method === "initialize") send({ id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { resources: { subscribe: true } } } });
      else if (msg.method === "resources/subscribe") {
        subscriptions.add(msg.params.uri); send({ id: msg.id, result: {} });
        setTimeout(() => {
          send({ method: "notifications/resources/updated", params: { uri: "fixture://unsubscribed" } });
          if (subscriptions.has(msg.params.uri)) send({ method: "notifications/resources/updated", params: { uri: msg.params.uri, text: "never fetched" } });
        }, 30);
      } else if (msg.method === "resources/unsubscribe") {
        subscriptions.delete(msg.params.uri); send({ id: msg.id, result: {} });
        send({ method: "notifications/resources/updated", params: { uri: msg.params.uri } });
      } else if (msg.id !== undefined) send({ id: msg.id, error: { code: -32601, message: "unexpected RPC " + msg.method } });
    }
  });
`;
const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false };
const connection = await connectMcpServers({ local: { command: process.execPath, args: ["-e", fixture] } }, context, { subscriptions: true, requestTimeoutMs: 1000 });
const execute = async (name, args) => {
  const tool = connection.tools.find(tool => tool.schema.name === name); assert.ok(tool, name);
  return JSON.parse(await tool.execute(args, context));
};
try {
  assert.deepEqual(connection.tools.map(tool => tool.schema.name), ["mcp_resource_subscribe", "mcp_resource_unsubscribe", "mcp_resource_notifications"]);
  const uri = "fixture://notes%2fExact";
  assert.deepEqual(await execute("mcp_resource_subscribe", { server: "local", uri }), { server: "local", uri, subscribed: true });
  let result;
  const deadline = Date.now() + 1000;
  do {
    result = await execute("mcp_resource_notifications", { server: "local" });
    if (result.notifications.length) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  assert.deepEqual(result.notifications, [{ uri }]); assert.equal(result.dropped, 0);
  await execute("mcp_resource_unsubscribe", { server: "local", uri });
  await new Promise(resolve => setTimeout(resolve, 30));
  result = await execute("mcp_resource_notifications", { server: "local" });
  assert.equal(result.subscriptions, 0); assert.deepEqual(result.notifications, []);
  await connection.close();
  await assert.rejects(execute("mcp_resource_notifications", { server: "local" }), /closed/);
  console.log(JSON.stringify({ stdioPush: "passed", exactUri: true, unsubscribe: true, connectionClose: true, automaticReads: 0 }));
} finally { await connection.close(); }
