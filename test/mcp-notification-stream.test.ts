import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { test } from "node:test";
import { connectMcpServers, type McpConnection, type McpConnectOptions } from "../src/mcp.js";
import type { ToolContext } from "../src/tools.js";
const context = (): ToolContext => ({ workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false });
async function until(check: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(check(), "fixture condition deadline");
}
const event = (res: ServerResponse, message: unknown) => res.write(`data: ${JSON.stringify(message)}\n\n`);
async function fixture(mode = "active") {
  let get: ServerResponse | undefined, gets = 0, closed = 0, lists = 0, initializes = 0, initialized = false, changed = false;
  const headers: Record<string, unknown>[] = [], failures: unknown[] = [], replies: any[] = [];
  let formPost: { res: ServerResponse; id: unknown } | undefined;
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === "GET") {
        gets++; headers.push(req.headers); assert.equal(initialized, true);
        if (["404", "405", "204", "401", "403"].includes(mode)) { res.writeHead(Number(mode)).end(); return; }
        if (mode === "redirect") { res.writeHead(302, { location: "/followed" }).end(); return; }
        if (mode === "headers") return;
        if (mode === "content-type") { res.writeHead(200, { "content-type": "application/json" }).end("{}"); return; }
        get = res; res.on("close", () => closed++);
        res.writeHead(200, { "content-type": "text/event-stream" }); res.flushHeaders();
        if (mode === "line") res.write("data: " + "x".repeat(65537));
        if (mode === "event") res.write(("data: " + "x".repeat(64000) + "\n").repeat(17));
        if (mode === "truncated") res.end("data: {");
        if (mode === "eof") res.end(": done\n\n");
        if (mode === "utf8") res.end(Buffer.from([0xff]));
        if (mode === "json") res.end("data: {\n\n");
        if (mode === "type") event(res, { jsonrpc: "2.0", method: 12 });
        return;
      }
      if (req.method === "DELETE") { res.writeHead(204).end(); return; }
      let text = ""; for await (const chunk of req) text += chunk;
      const msg = JSON.parse(text);
      const reply = (result: unknown) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
      if (msg.method === "initialize") {
        res.setHeader("Mcp-Session-Id", "stream-session");
        initializes++;
        reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: { subscribe: true }, logging: {} } });
      } else if (msg.method === "notifications/initialized") { initialized = true; res.writeHead(202).end(); }
      else if (msg.method === "tools/list") { lists++; reply({ tools: [{ name: changed ? "new" : "echo", inputSchema: { type: "object" } }] }); }
      else if (msg.method === "tools/call") {
        if (msg.params.arguments?.form) {
          res.writeHead(200, { "content-type": "text/event-stream" });
          formPost = { res, id: msg.id };
          event(res, { jsonrpc: "2.0", id: "pending-form", method: "elicitation/create", params: { message: "wait", requestedSchema: { type: "object", properties: {} } } });
        } else reply({ content: [{ type: "text", text: "ok" }] });
      } else if (["resources/subscribe", "resources/unsubscribe", "logging/setLevel"].includes(msg.method)) reply({});
      else {
        replies.push(msg); res.writeHead(202).end();
        if (msg.id === "pending-form" && formPost) { event(formPost.res, { jsonrpc: "2.0", id: formPost.id, result: { content: [{ type: "text", text: "cancelled" }] } }); formPost.res.end(); }
      }
    })().catch((error) => { failures.push(error); res.destroy(); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  return {
    config: { srv: { type: "http" as const, url: `http://127.0.0.1:${address.port}/mcp` } }, headers, failures, replies,
    get: () => get, gets: () => gets, closed: () => closed, lists: () => lists, initializes: () => initializes, change: () => { changed = true; },
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}
function tool(connection: McpConnection, name: string) { const found = connection.tools.find((item) => item.schema.name === name); assert.ok(found, name); return found; }
const call = async (connection: McpConnection, name: string, input: unknown) => JSON.parse(await tool(connection, name).execute(input, context()));

test("owned GET streams preserve schemas, push bounded logs/resources, refresh tools and cancel POST callbacks and dispatch GET client requests to the runtime callbacks", async () => {
  const remote = await fixture();
  let roots = 0, formSignal: AbortSignal | undefined;
  const options: McpConnectOptions = { logging: true, subscriptions: true, dynamic: true, requestTimeoutMs: 2000,
    clientRequests: { roots: () => { roots++; return []; }, elicitation: async (_params, signal) => {
      formSignal = signal;
      await new Promise<void>((resolve) => { signal.addEventListener("abort", () => resolve(), { once: true }); });
      return { action: "cancel" };
    } } };
  let connection: McpConnection | undefined;
  try {
    const baseline = await connectMcpServers(remote.config, context(), options);
    const schemas = baseline.tools.map((item) => item.schema); const oldLimits = [...baseline.limits];
    assert.equal(baseline.notificationStreams, undefined); await baseline.close();
    const disabled = await connectMcpServers(remote.config, context(), { ...options, notificationStream: false });
    assert.deepEqual(disabled.limits, oldLimits); assert.equal(remote.gets(), 0); await disabled.close();
    connection = await connectMcpServers(remote.config, context(), { ...options, notificationStream: true });
    assert.deepEqual(connection.tools.map((item) => item.schema), schemas);
    await until(() => connection!.notificationStreams!().srv?.state === "active");
    assert.equal(remote.gets(), 1);
    const headers = remote.headers[0]!;
    assert.equal(headers["mcp-session-id"], "stream-session"); assert.equal(headers["mcp-protocol-version"], "2025-06-18");
    assert.equal(headers.accept, "text/event-stream"); assert.equal(headers.origin, undefined);
    await call(connection, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
    for (let i = 0; i < 1100; i++) event(remote.get()!, { jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: i } });
    event(remote.get()!, { jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri: "fixture://exact%2f" } });
    event(remote.get()!, { jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri: "fixture://other" } });
    event(remote.get()!, { jsonrpc: "2.0", id: "get-request", method: "roots/list", params: {} });
    event(remote.get()!, { jsonrpc: "2.0", id: 12, result: { ignored: true } });
    remote.change(); event(remote.get()!, { jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    await until(() => remote.get()!.writableLength === 0);
    // Poll until the resource following the log burst is observed.
    let resources: any;
    const deadline = Date.now() + 2000;
    do {
      resources = await call(connection, "mcp_resource_notifications", { server: "srv" });
      if (resources.notifications.length) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    } while (Date.now() < deadline);
    assert.deepEqual(resources.notifications, [{ uri: "fixture://exact%2f" }]);
    const logs = await call(connection, "mcp_logging_notifications", { server: "srv" });
    assert.equal(logs.notifications.length, 128); assert.equal(logs.dropped, 972); assert.equal(logs.notifications.at(-1).data, 1099);
    await until(() => remote.replies.some((msg) => msg.id === "get-request"));
    assert.equal(roots, 1); assert.ok(remote.replies.find((msg) => msg.id === "get-request").result.roots.length === 0);
    const search = await call(connection, "mcp_tool_search", { query: "" });
    assert.equal(search.tools[0].tool, "new"); assert.equal(remote.lists(), 4);
    assert.equal(await tool(connection, "mcp_tool_call").execute({ server: "srv", tool: "new" }, context()), "ok");
    const pending = tool(connection, "mcp_tool_call").execute({ server: "srv", tool: "new", arguments: { form: true } }, context());
    await until(() => formSignal !== undefined);
    event(remote.get()!, { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "pending-form" } });
    assert.equal(await pending, "cancelled"); assert.equal(formSignal!.aborted, true);
    assert.equal(connection.notificationStreams!().srv?.state, "active");
    const start = Date.now(); await connection.close();
    assert.ok(Date.now() - start < 1500); await until(() => remote.closed() === 1);
    assert.deepEqual(remote.failures, []);
  } finally { await connection?.close(); await remote.close(); }
});

test("GET unavailable/end/failure/idle paths remain POST usable and never reconnect", async () => {
  for (const [mode, state] of [["404", "unavailable"], ["405", "unavailable"], ["204", "ended"], ["eof", "ended"], ["redirect", "failed"], ["line", "failed"], ["event", "failed"], ["truncated", "failed"], ["idle", "failed"], ["headers", "failed"]] as const) {
    const remote = await fixture(mode);
    const connection = await connectMcpServers(remote.config, context(), { notificationStream: true, requestTimeoutMs: 200 });
    try {
      await until(() => connection.notificationStreams!().srv?.state === state);
      assert.equal(await tool(connection, "mcp__srv__echo").execute({}, context()), "ok", mode);
      assert.equal(remote.gets(), 1, mode); assert.deepEqual(remote.failures, []);
      const snapshot = connection.notificationStreams!(); snapshot.srv!.state = "active";
      assert.equal(connection.notificationStreams!().srv?.state, state);
    } finally { await connection.close(); await remote.close(); }
    assert.equal(connection.notificationStreams!().srv?.state, "closed");
  }
});

test("recovery reopens GET after EOF/transport/idle while keeping POST and session headers", async () => {
  const envName = "CCREVERSE_GET_RECOVERY_HEADER";
  const previous = process.env[envName];
  process.env[envName] = "first";
  try {
    for (const mode of ["eof", "transport", "idle", "headers"]) {
      const remote = await fixture(mode === "eof" || mode === "transport" ? "active" : mode);
      process.env[envName] = "first";
      let roots = 0;
      const connection = await connectMcpServers({ srv: { ...remote.config.srv, headersEnv: { "X-Fixture": envName } } }, context(), {
        notificationStream: true, recovery: true, subscriptions: true, logging: true,
        requestTimeoutMs: mode === "idle" || mode === "headers" ? 100 : 2000,
        clientRequests: { roots: () => { roots++; return []; } },
      });
      try {
        await until(() => remote.gets() === 1);
        await call(connection, "mcp_resource_subscribe", { server: "srv", uri: "fixture://restored" });
        if (mode === "eof") remote.get()!.end(": ended\n\n");
        if (mode === "transport") remote.get()!.destroy();
        await until(() => connection.notificationStreams!().srv?.reason?.includes("backoff") === true);
        assert.equal(await tool(connection, "mcp__srv__echo").execute({}, context()), "ok");
        process.env[envName] = "second";
        await until(() => remote.gets() === 2);
        assert.equal(connection.notificationStreams!().srv?.reopenAttempts, 1);
        assert.equal(remote.initializes(), 1);
        assert.equal(remote.headers[1]!["x-fixture"], "second");
        assert.equal(remote.headers[1]!["mcp-session-id"], "stream-session");
        assert.equal(remote.headers[1]!["mcp-protocol-version"], "2025-06-18");
        assert.equal(remote.headers[1]!["last-event-id"], undefined);
        if (mode === "eof" || mode === "transport") {
          await until(() => connection.notificationStreams!().srv?.state === "active");
          event(remote.get()!, { jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri: "fixture://restored" } });
          event(remote.get()!, { jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: "fresh" } });
          event(remote.get()!, { jsonrpc: "2.0", id: "ignored", method: "roots/list", params: {} });
          let observed = false;
          await until(() => remote.get()!.writableLength === 0);
          for (let i = 0; i < 20 && !observed; i++) {
            const updates = await call(connection, "mcp_resource_notifications", { server: "srv" });
            observed = updates.notifications.length === 1;
            if (!observed) await new Promise((resolve) => setTimeout(resolve, 5));
          }
          assert.equal(observed, true);
          assert.equal((await call(connection, "mcp_logging_notifications", { server: "srv" })).notifications[0].data, "fresh");
          await until(() => remote.replies.some((msg) => msg.id === "ignored"));
          assert.equal(roots, 1);
          assert.equal(remote.closed(), 1);
        }
        assert.equal(await tool(connection, "mcp__srv__echo").execute({}, context()), "ok");
        assert.deepEqual(remote.failures, []);
      } finally { await connection.close(); await remote.close(); }
    }
  } finally { if (previous === undefined) delete process.env[envName]; else process.env[envName] = previous; }
});

test("recovery keeps terminal HTTP, UTF-8, JSON, frame, size and message-type failures at zero reopens", async () => {
  for (const mode of ["404", "405", "204", "401", "403", "redirect", "content-type", "utf8", "json", "type", "truncated", "line", "event"]) {
    const remote = await fixture(mode);
    const connection = await connectMcpServers(remote.config, context(), { notificationStream: true, recovery: true, requestTimeoutMs: 200 });
    try {
      await until(() => ["unavailable", "ended", "failed"].includes(connection.notificationStreams!().srv?.state ?? ""));
      await new Promise((resolve) => setTimeout(resolve, 15));
      assert.equal(connection.notificationStreams!().srv?.reopenAttempts, 0, mode);
      assert.equal(remote.gets(), 1, mode);
      assert.equal(await tool(connection, "mcp__srv__echo").execute({}, context()), "ok");
      assert.deepEqual(remote.failures, []);
    } finally { await connection.close(); await remote.close(); }
  }
});

test("GET recovery has a lifetime attempt budget and close clears backoff without late reopen", async (t) => {
  const remote = await fixture("eof");
  const connection = await connectMcpServers(remote.config, context(), { notificationStream: true, recovery: true, requestTimeoutMs: 2000 });
  try {
    await until(() => connection.notificationStreams!().srv?.reason?.includes("backoff") === true);
    await connection.close();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(remote.gets(), 1);
    assert.equal(connection.notificationStreams!().srv?.reopenAttempts, 0);
    assert.equal(connection.notificationStreams!().srv?.state, "closed");
  } finally { await connection.close(); await remote.close(); }

  const delays: number[] = [];
  const originalTimeout = globalThis.setTimeout;
  const recoveryDelays = new Set([1000, 2000, 4000, 8000]);
  // Advance only recovery backoffs; HTTP and fixture polling use real timers.
  t.mock.method(globalThis, "setTimeout", (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    if (recoveryDelays.has(delay ?? 0)) { delays.push(delay!); return originalTimeout(callback, 1, ...args); }
    return originalTimeout(callback, delay, ...args);
  });
  const boundedRemote = await fixture();
  const boundedConnection = await connectMcpServers(boundedRemote.config, context(), {
    notificationStream: true, recovery: true, requestTimeoutMs: 500,
  });
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      await until(() => boundedConnection.notificationStreams!().srv?.state === "active");
      assert.equal(boundedConnection.notificationStreams!().srv?.reopenAttempts, attempt);
      boundedRemote.get()!.end(": complete\n\n");
      await until(() => boundedRemote.gets() === attempt + 2);
    }
    await until(() => boundedConnection.notificationStreams!().srv?.state === "active");
    boundedRemote.get()!.end(": complete\n\n");
    await until(() => boundedConnection.notificationStreams!().srv?.reason?.includes("exhausted") === true);
    assert.equal(boundedRemote.gets(), 6);
    assert.equal(boundedRemote.initializes(), 1);
    assert.equal(boundedConnection.notificationStreams!().srv?.reopenAttempts, 5);
    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 8000]);
    assert.equal(await tool(boundedConnection, "mcp__srv__echo").execute({}, context()), "ok");
    assert.deepEqual(boundedRemote.failures, []);
  } finally { await boundedConnection.close(); await boundedRemote.close(); t.mock.restoreAll(); }
});
