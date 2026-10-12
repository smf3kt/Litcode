import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { connectMcpServers, type McpConnection } from "../src/mcp.js";
import { McpResourceSubscriptions, MCP_MAX_RESOURCE_NOTIFICATION_BYTES, validateMcpResourceUri } from "../src/mcp-subscriptions.js";
import type { ToolContext } from "../src/tools.js";

const context = (): ToolContext => ({ workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false });
const signal = () => new AbortController().signal;
function tool(connection: McpConnection, name: string) {
  const found = connection.tools.find((item) => item.schema.name === name); assert.ok(found, name); return found;
}
const call = async (connection: McpConnection, name: string, args: unknown, ctx = context()) => JSON.parse(await tool(connection, name).execute(args, ctx));

test("subscription state enforces count/byte bounds, explicit loss, poll retention and successful acknowledgements", async () => {
  let reject = false, calls = 0;
  const state = new McpResourceSubscriptions(async (_method, _params, _signal, commit) => {
    calls++; if (reject) throw new Error("fixture failed"); commit({}); return {};
  }, () => true);
  await state.change("resources/subscribe", "fixture://exact%2f", signal());
  state.updated({ uri: "fixture://exact%2F" });
  state.updated({ uri: "fixture://exact%2f", text: "untrusted resource body" });
  assert.deepEqual(JSON.parse(state.poll("srv", 128, 100_000, signal())).notifications, [{ uri: "fixture://exact%2f" }]);
  reject = true;
  await assert.rejects(state.change("resources/unsubscribe", "fixture://exact%2f", signal()), /failed/);
  await assert.rejects(state.change("resources/subscribe", "fixture://failed", signal()), /failed/);
  state.updated({ uri: "fixture://failed" }); state.updated({ uri: "fixture://exact%2f" });
  assert.equal(JSON.parse(state.poll("srv", 128, 100_000, signal())).notifications.length, 1);
  reject = false;
  for (let i = 0; i < 31; i++) await state.change("resources/subscribe", `fixture://${i}`, signal());
  const beforeLimit = calls;
  await assert.rejects(state.change("resources/subscribe", "fixture://overflow", signal()), /limit reached/);
  assert.equal(calls, beforeLimit);
  for (let i = 0; i < 150; i++) state.updated({ uri: "fixture://0" });
  await assert.rejects(async () => state.poll("srv", 128, 2, signal()), /budget/);
  const first = JSON.parse(state.poll("srv", 1, 100_000, signal()));
  assert.equal(first.dropped, 22); assert.equal(first.remaining, 127);
  assert.equal(JSON.parse(state.poll("srv", 128, 100_000, signal())).dropped, 0);
  await state.change("resources/unsubscribe", "fixture://0", signal());
  const long = `fixture://${"x".repeat(4086)}`;
  validateMcpResourceUri(long);
  await state.change("resources/subscribe", long, signal());
  for (let i = 0; i < 20; i++) state.updated({ uri: long });
  const capped = JSON.parse(state.poll("srv", 128, 100_000, signal()));
  assert.ok(capped.notifications.length < 20); assert.equal(capped.dropped + capped.notifications.length, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(capped.notifications)) <= MCP_MAX_RESOURCE_NOTIFICATION_BYTES);
  for (const uri of ["", "fixture://has space", "fixture://control\n", `fixture://${"x".repeat(4090)}`, `fixture://${"é".repeat(2048)}`]) assert.throws(() => validateMcpResourceUri(uri));
  state.close(); assert.equal(state.supports(), false);
  assert.throws(() => state.poll("srv", 1, 100_000, signal()), /closed/);
});

test("real stdio delivers subscribed push, commits before adjacent frames and clears on cancellation/close", async () => {
  const script = `
    let buffer = "";
    const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
    const updated = uri => send({ method: "notifications/resources/updated", params: { uri, text: "ignored" } });
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => {
      buffer += chunk; let n;
      while ((n = buffer.indexOf("\\n")) >= 0) {
        const msg = JSON.parse(buffer.slice(0, n)); buffer = buffer.slice(n + 1);
        if (msg.method === "initialize") send({ id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {}, resources: { subscribe: true } } } });
        else if (msg.method === "tools/list") send({ id: msg.id, result: { tools: [{ name: "emit", inputSchema: { type: "object" } }] } });
        else if (msg.method === "resources/subscribe" || msg.method === "resources/unsubscribe") {
          const uri = msg.params.uri;
          if (uri.endsWith("slow")) { setTimeout(() => { send({ id: msg.id, result: {} }); updated(uri); }, 120); continue; }
          if (uri.endsWith("failed")) { send({ id: msg.id, error: { code: -1, message: "fixture failure" } }); updated(uri); continue; }
          updated(uri); send({ id: msg.id, result: {} }); updated(uri);
        } else if (msg.method === "tools/call") {
          updated("fixture://other"); send({ method: "notifications/resources/updated", params: { uri: 1 } });
          send({ id: "server-request", method: "notifications/resources/updated", params: { uri: "fixture://a" } });
          send({ id: msg.id, result: { content: [{ type: "text", text: "ok" }] } });
        }
      }
    });
  `;
  const connection = await connectMcpServers({ local: { command: process.execPath, args: ["-e", script] } }, context(), { subscriptions: true, requestTimeoutMs: 300 });
  try {
    assert.equal(tool(connection, "mcp_resource_subscribe").readOnly, false);
    assert.equal(tool(connection, "mcp_resource_unsubscribe").readOnly, false);
    assert.equal(tool(connection, "mcp_resource_notifications").readOnly, true);
    await call(connection, "mcp_resource_subscribe", { server: "local", uri: "fixture://a" });
    await tool(connection, "mcp__local__emit").execute({}, context());
    assert.deepEqual((await call(connection, "mcp_resource_notifications", { server: "local" })).notifications, [{ uri: "fixture://a" }]);
    await assert.rejects(call(connection, "mcp_resource_subscribe", { server: "local", uri: "fixture://failed" }), /failure/);
    const controller = new AbortController();
    const pending = call(connection, "mcp_resource_subscribe", { server: "local", uri: "fixture://slow" }, { ...context(), signal: controller.signal });
    await assert.rejects(call(connection, "mcp_resource_subscribe", { server: "local", uri: "fixture://second" }), /in flight/);
    controller.abort(); await assert.rejects(pending, { name: "AbortError" });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal((await call(connection, "mcp_resource_notifications", { server: "local" })).subscriptions, 1);
    await call(connection, "mcp_resource_unsubscribe", { server: "local", uri: "fixture://a" });
    await tool(connection, "mcp__local__emit").execute({}, context());
    const end = await call(connection, "mcp_resource_notifications", { server: "local" });
    assert.equal(end.subscriptions, 0); assert.equal(end.notifications.length, 1, "update before unsubscribe acknowledgement was subscribed");
  } finally { await connection.close(); }
  await assert.rejects(call(connection, "mcp_resource_notifications", { server: "local" }), /closed/);
});

test("HTTP subscription opt-in and exact capabilities preserve defaults, observe active POST SSE and bound failed RPCs", async () => {
  let subscribe: unknown = true, deleted = 0;
  const methods: string[] = [], uris: string[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      methods.push(req.method!);
      if (req.method === "DELETE") { assert.equal(req.headers["mcp-session-id"], "fixture-session"); deleted++; res.writeHead(204).end(); return; }
      let text = ""; for await (const chunk of req) text += chunk;
      const msg = JSON.parse(text);
      const reply = (result: unknown) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
      if (msg.method === "initialize") { res.setHeader("Mcp-Session-Id", "fixture-session"); reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: { subscribe } } }); return; }
      assert.equal(req.headers["mcp-session-id"], "fixture-session");
      assert.equal(req.headers["mcp-protocol-version"], "2025-06-18");
      if (msg.method === "tools/list") reply({ tools: [{ name: "emit", inputSchema: { type: "object" } }] });
      else if (msg.method === "resources/subscribe" || msg.method === "resources/unsubscribe") {
        uris.push(msg.params.uri);
        if (msg.params.uri.endsWith("slow")) { res.writeHead(200, { "Content-Type": "text/event-stream" }); res.flushHeaders(); }
        else if (msg.params.uri.endsWith("failed")) { res.writeHead(500).end(); }
        else reply(msg.params.uri.endsWith("malformed") ? null : {});
      } else if (msg.method === "tools/call") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const uri of ["fixture://a%2f", "fixture://a%2F", "fixture://failed", "fixture://malformed", "fixture://slow"]) res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri } })}\n\n`);
        res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "ok" }] } })}\n\n`);
      } else res.writeHead(202).end();
    })().catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const config = { srv: { type: "http" as const, url: `http://127.0.0.1:${address.port}/mcp` } };
  try {
    const defaults = await connectMcpServers(config, context());
    assert.deepEqual(defaults.tools.map((item) => item.schema.name), ["mcp__srv__emit"]); await defaults.close();
    for (const capability of [false, "true"]) {
      subscribe = capability;
      const disabled = await connectMcpServers(config, context(), { subscriptions: true });
      assert.deepEqual(disabled.tools.map((item) => item.schema.name), ["mcp__srv__emit"]); await disabled.close();
    }
    subscribe = true;
    const connection = await connectMcpServers(config, context(), { subscriptions: true, requestTimeoutMs: 100 });
    const other = await connectMcpServers(config, context(), { subscriptions: true });
    try {
      assert.match(connection.limits.join("\n"), /no GET stream or continuous HTTP push/);
      await call(connection, "mcp_resource_subscribe", { server: "srv", uri: "fixture://a%2f" });
      for (const suffix of ["failed", "malformed", "slow"]) await assert.rejects(call(connection, "mcp_resource_subscribe", { server: "srv", uri: `fixture://${suffix}` }), /500|invalid result|timed out/);
      await tool(connection, "mcp__srv__emit").execute({}, context());
      const result = await call(connection, "mcp_resource_notifications", { server: "srv" });
      assert.deepEqual(result.notifications, [{ uri: "fixture://a%2f" }]); assert.equal(result.subscriptions, 1);
      await tool(other, "mcp__srv__emit").execute({}, context());
      assert.equal((await call(other, "mcp_resource_notifications", { server: "srv" })).notifications.length, 0);
      for (const args of [{ server: "missing", uri: "fixture://a" }, { server: "srv", uri: "" }, { server: "srv", uri: "fixture://a", extra: 1 }]) await assert.rejects(call(connection, "mcp_resource_subscribe", args));
      for (const limit of [0, 129, "1"]) await assert.rejects(call(connection, "mcp_resource_notifications", { server: "srv", limit }));
      const aborted = new AbortController(); aborted.abort();
      await assert.rejects(call(connection, "mcp_resource_unsubscribe", { server: "srv", uri: "fixture://a%2f" }, { ...context(), signal: aborted.signal }), { name: "AbortError" });
      await call(connection, "mcp_resource_unsubscribe", { server: "srv", uri: "fixture://a%2f" });
      await tool(connection, "mcp__srv__emit").execute({}, context());
      assert.equal((await call(connection, "mcp_resource_notifications", { server: "srv" })).notifications.length, 0);
      assert.deepEqual(uris, ["fixture://a%2f", "fixture://failed", "fixture://malformed", "fixture://slow", "fixture://a%2f"]);
      assert.ok(methods.every((method) => method === "POST" || method === "DELETE"));
    } finally { await Promise.all([connection.close(), other.close()]); }
    assert.equal(deleted, 5);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

type RecoveryFixture = {
  next: number;
  capability: boolean;
  startupFailures?: number;
  invalidTools?: boolean;
  expire: string | undefined;
  deleted: string[];
  requests: { session: string; method: string; uri?: string }[];
  subscribe?: (session: string, uri: string) => Promise<unknown>;
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function recoveryFixture(run: (url: string, state: RecoveryFixture) => Promise<void>) {
  const state: RecoveryFixture = { next: 0, capability: true, expire: undefined, deleted: [], requests: [] };
  const server = createServer((req, res) => {
    void (async () => {
      const session = String(req.headers["mcp-session-id"] ?? "");
      if (req.method === "DELETE") { state.deleted.push(session); res.writeHead(204).end(); return; }
      let text = ""; for await (const chunk of req) text += chunk;
      const msg = JSON.parse(text);
      const reply = (result: unknown) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })); };
      if (msg.method === "initialize") {
        if (state.startupFailures) { state.startupFailures--; res.writeHead(503).end(); return; }
        res.setHeader("Mcp-Session-Id", `session-${++state.next}`);
        reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: { subscribe: state.capability } } }); return;
      }
      state.requests.push({ session, method: msg.method, ...(msg.params?.uri ? { uri: msg.params.uri } : {}) });
      if (msg.method === "tools/list") reply({ tools: [{ name: state.invalidTools ? "x".repeat(129) : "emit", inputSchema: { type: "object" } }] });
      else if (msg.method === "resources/subscribe") reply(state.subscribe ? await state.subscribe(session, msg.params.uri) : {});
      else if (msg.method === "resources/unsubscribe") reply({});
      else if (msg.method === "tools/call") {
        if (state.expire === session) { state.expire = undefined; res.writeHead(404).end(); return; }
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const uri of ["fixture://exact%2f", "fixture://exact%2F", "fixture://second"]) res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri } })}\n\n`);
        res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: session }] } })}\n\n`);
      } else res.writeHead(202).end();
    })().catch(() => res.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}/mcp`, state); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const subscribed = (state: RecoveryFixture, session: string) => state.requests.filter(item => item.session === session && item.method === "resources/subscribe").map(item => item.uri);
const recoveryConnect = (url: string, peer = false) => connectMcpServers({ srv: { type: "http", url }, ...(peer ? { peer: { type: "http" as const, url } } : {}) }, context(), { subscriptions: true, recovery: true, requestTimeoutMs: 1000 });

test("manual and automatic HTTP session replacement restore exact acknowledged URIs and future updates", async () => {
  await recoveryFixture(async (url, state) => {
    const c = await recoveryConnect(url);
    try {
      const schemas = JSON.stringify(c.tools.map(item => item.schema));
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://second" });
      await call(c, "mcp_resource_unsubscribe", { server: "srv", uri: "fixture://second" });
      await tool(c, "mcp__srv__emit").execute({}, context());
      await Promise.all([c.reconnect!("srv", signal()), c.reconnect!("srv", signal())]);
      assert.deepEqual(subscribed(state, "session-2"), ["fixture://exact%2f"]);
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).notifications.length, 0);
      state.expire = "session-2";
      await assert.rejects(tool(c, "mcp__srv__emit").execute({}, context()), /404/);
      const deadline = Date.now() + 2000;
      while (c.servers!().srv!.generation < 3 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(c.servers!().srv!.generation, 3);
      assert.deepEqual(subscribed(state, "session-3"), ["fixture://exact%2f"]);
      await tool(c, "mcp__srv__emit").execute({}, context());
      const updates = await call(c, "mcp_resource_notifications", { server: "srv" });
      assert.deepEqual(updates.notifications, [{ uri: "fixture://exact%2f" }]);
      assert.equal(updates.subscriptions, 1);
      assert.equal(JSON.stringify(c.tools.map(item => item.schema)), schemas);
      assert.ok(state.requests.every(item => item.method !== "resources/read"));
      assert.equal(state.requests.filter(item => item.method === "tools/call").length, 3);
      assert.match(c.limits.join("\n"), /no durable persistence.*event replay/);
    } finally { await c.close(); }
    for (const recovery of [undefined, false]) {
      const baseline = await connectMcpServers({ srv: { type: "http", url } }, context(), { subscriptions: true, recovery });
      try {
        await call(baseline, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
        await baseline.reconnect!("srv", signal());
        assert.equal((await call(baseline, "mcp_resource_notifications", { server: "srv" })).subscriptions, 0);
      } finally { await baseline.close(); }
    }
  });
});

test("failed, missing-capability and cancelled restoration retain old subscriptions, transport and peers", async () => {
  await recoveryFixture(async (url, state) => {
    const c = await recoveryConnect(url, true);
    try {
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
      await tool(c, "mcp__srv__emit").execute({}, context());
      state.subscribe = async () => null;
      await assert.rejects(c.reconnect!("srv", signal()), /invalid result/);
      assert.deepEqual(state.deleted, ["session-3"]);
      state.capability = false;
      await assert.rejects(c.reconnect!("srv", signal()), /advertise/);
      assert.deepEqual(subscribed(state, "session-4"), []);
      state.capability = true;
      const entered = deferred<void>(), release = deferred<unknown>();
      state.subscribe = async () => { entered.resolve(); return release.promise; };
      const controller = new AbortController();
      const replacement = c.reconnect!("srv", controller.signal);
      await entered.promise; controller.abort();
      await assert.rejects(replacement, { name: "AbortError" });
      release.resolve({});
      assert.equal(c.servers!().srv!.generation, 1);
      assert.equal(c.servers!().srv!.state, "connected");
      assert.equal(await tool(c, "mcp__srv__emit").execute({}, context()), "session-1");
      assert.equal(await tool(c, "mcp__peer__emit").execute({}, context()), "session-2");
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).notifications.length, 2);
      assert.deepEqual(state.deleted, ["session-3", "session-4", "session-5"]);
      state.subscribe = undefined;
      state.invalidTools = true;
      await assert.rejects(c.reconnect!("srv", signal()), /name.*invalid/);
      assert.equal(c.servers!().srv!.generation, 1);
      assert.deepEqual(subscribed(state, "session-6"), []);
      state.invalidTools = false;
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://second" });
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).subscriptions, 2);
    } finally { await c.close(); }
  });
});

test("replacement freezes mutations, rejects in-flight snapshots and prevents late close commits", async () => {
  await recoveryFixture(async (url, state) => {
    const c = await recoveryConnect(url);
    try {
      const entered = deferred<void>(), release = deferred<unknown>();
      state.subscribe = async () => { entered.resolve(); return release.promise; };
      const mutation = call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://exact%2f" });
      await entered.promise;
      await assert.rejects(c.reconnect!("srv", signal()), /mutation already in flight/);
      assert.equal(state.next, 1);
      release.resolve({}); await mutation;
      const restoring = deferred<void>(), restored = deferred<unknown>();
      state.subscribe = async () => { restoring.resolve(); return restored.promise; };
      const replacement = c.reconnect!("srv", signal());
      await restoring.promise;
      for (const name of ["mcp_resource_subscribe", "mcp_resource_unsubscribe"]) await assert.rejects(call(c, name, { server: "srv", uri: "fixture://second" }), /blocked during transport replacement/);
      assert.deepEqual(subscribed(state, "session-1"), ["fixture://exact%2f"]);
      await tool(c, "mcp__srv__emit").execute({}, context());
      restored.resolve({}); await replacement;
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).notifications.length, 0);
      const closing = deferred<void>(), late = deferred<unknown>();
      state.subscribe = async () => { closing.resolve(); return late.promise; };
      const last = c.reconnect!("srv", signal());
      await closing.promise;
      const closed = c.close();
      await assert.rejects(last, { name: "AbortError" });
      await closed; late.resolve({});
      assert.equal(c.servers!().srv!.state, "closed");
      assert.equal(c.servers!().srv!.generation, 2);
      await assert.rejects(call(c, "mcp_resource_notifications", { server: "srv" }), /closed/);
    } finally { await c.close(); }
  });
});

test("persistence acknowledgement validates before synchronous commit and poisons replay after fsync EIO", async t => {
  const root = fs.mkdtempSync(path.join(tmpdir(), "mcp-journal-eio-"));
  const journal = path.join(root, "journal.jsonl");
  const fd = fs.openSync(journal, "a");
  t.after(() => { fs.closeSync(fd); fs.rmSync(root, { recursive: true, force: true }); });
  let malformed = false, failCommit = false;
  let requests = 0;
  const commits: string[] = [];
  const s = new McpResourceSubscriptions(async (method, params, _signal, acknowledge) => {
    requests++;
    s.updated(params);
    acknowledge(malformed ? null : {});
    s.updated(params);
    return {};
  }, () => true);
  s.setAcknowledgement((method, uri) => {
    assert.equal(s.snapshot().includes(uri), method === "resources/unsubscribe");
    fs.writeSync(fd, JSON.stringify({ method, uri }) + "\n");
    if (failCommit) {
      t.mock.method(fs, "fsyncSync", () => { throw Object.assign(new Error("EIO: fixture fsync failed"), { code: "EIO", syscall: "fsync" }); });
      try { fs.fsyncSync(fd); }
      finally { t.mock.restoreAll(); }
    }
    fs.fsyncSync(fd);
    commits.push(`${method}:${uri}`);
  });
  malformed = true;
  await assert.rejects(s.change("resources/subscribe", "fixture://a", signal()), /invalid result/);
  assert.deepEqual(commits, []);
  malformed = false;
  await s.change("resources/subscribe", "fixture://a", signal());
  assert.deepEqual(JSON.parse(s.poll("srv", 128, 100_000, signal())).notifications, [{ uri: "fixture://a" }]);
  failCommit = true;
  await assert.rejects(s.change("resources/unsubscribe", "fixture://a", signal()), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "McpSubscriptionPersistenceError");
    assert.match(error.message, /acknowledged but not recorded/);
    assert.equal((error.cause as NodeJS.ErrnoException).code, "EIO");
    assert.equal((error.cause as NodeJS.ErrnoException).syscall, "fsync");
    return true;
  });
  const acknowledgedRequests = requests;
  await assert.rejects(s.change("resources/subscribe", "fixture://b", signal()), /acknowledged but not recorded/);
  await assert.rejects(s.restore(["fixture://a"], signal()), /acknowledged but not recorded/);
  assert.throws(() => s.prepareReplacement(), /acknowledged but not recorded/);
  assert.equal(requests, acknowledgedRequests);
  assert.deepEqual(s.snapshot(), []);
  s.updated({ uri: "fixture://a" });
  assert.equal(JSON.parse(s.poll("srv", 128, 100_000, signal())).subscriptions, 0);
  assert.equal(commits.length, 1);
  // Written bytes are observable; failed fsync leaves their crash durability unknown.
  assert.deepEqual(fs.readFileSync(journal, "utf8").trim().split("\n").map(line => JSON.parse(line)), [
    { method: "resources/subscribe", uri: "fixture://a" }, { method: "resources/unsubscribe", uri: "fixture://a" },
  ]);
  s.close();
  assert.deepEqual(s.snapshot(), []);
});

test("session persistence validates ownership, restores stable snapshots and retains disconnected startup intent", async () => {
  await recoveryFixture(async (url, state) => {
    const config = { srv: { type: "http" as const, url } };
    for (const options of [{ persistence: true }, { persistence: true, recovery: true }, { persistence: true, subscriptions: true }]) {
      const baseline = await connectMcpServers(config, context(), options);
      assert.equal(baseline.bindSubscriptions, undefined); await baseline.close();
    }
    const options = { persistence: true, recovery: true, subscriptions: true, requestTimeoutMs: 1000 };
    const c = await connectMcpServers(config, context(), options);
    const commits: string[] = [];
    let fail = false;
    const commit = (server: string, method: string, uri: string) => {
      if (fail) throw new Error("journal full");
      commits.push(`${server}:${method}:${uri}`);
    };
    try {
      const invalidStates: Record<string, readonly string[]>[] = [{ missing: [] }, { srv: ["fixture://a", "fixture://a"] }, { srv: ["bad uri"] }, { srv: Array.from({ length: 33 }, (_, i) => `fixture://${i}`) }];
      for (const initial of invalidStates) {
        await assert.rejects(c.bindSubscriptions!(initial, commit, signal()));
      }
      const desired = ["fixture://exact%2f"], entered = deferred<void>(), release = deferred<unknown>();
      state.subscribe = async () => { entered.resolve(); return release.promise; };
      const binding = c.bindSubscriptions!({ srv: desired }, commit, signal());
      await entered.promise; desired.push("fixture://second");
      await assert.rejects(call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://second" }), /blocked during transport replacement/);
      release.resolve({}); await binding; state.subscribe = undefined;
      const first = `session-${state.next}`;
      assert.deepEqual(subscribed(state, first), ["fixture://exact%2f"]);
      assert.deepEqual(commits, []);
      await assert.rejects(c.bindSubscriptions!({}, commit, signal()), /owner changes require a fresh connection/);
      await call(c, "mcp_resource_subscribe", { server: "srv", uri: "fixture://second" });
      state.subscribe = async () => null;
      await assert.rejects(c.reconnect!("srv", signal()), /invalid result/);
      assert.equal(c.servers!().srv!.generation, 1);
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).subscriptions, 2);
      state.subscribe = undefined;
      await c.reconnect!("srv", signal());
      assert.deepEqual(subscribed(state, `session-${state.next}`), ["fixture://exact%2f", "fixture://second"]);
      fail = true;
      await assert.rejects(call(c, "mcp_resource_unsubscribe", { server: "srv", uri: "fixture://second" }), /acknowledged but not recorded/);
      assert.equal((await call(c, "mcp_resource_notifications", { server: "srv" })).subscriptions, 1);
      const acknowledgedRequests = state.requests.length, acknowledgedSessions = state.next;
      await assert.rejects(c.reconnect!("srv", signal()), /acknowledged but not recorded/);
      for (const name of ["mcp_resource_subscribe", "mcp_resource_unsubscribe"]) {
        await assert.rejects(call(c, name, { server: "srv", uri: "fixture://second" }), /acknowledged but not recorded/);
      }
      assert.equal(state.requests.length, acknowledgedRequests);
      assert.equal(state.next, acknowledgedSessions);
      assert.equal(c.servers!().srv!.retryPhase, "stopped");
      assert.equal(commits.length, 1);
    } finally { await c.close(); }
    for (const mode of ["malformed", "capability", "cancel"] as const) {
      state.capability = mode !== "capability";
      state.subscribe = async () => mode === "malformed" ? null : {};
      const failed = await connectMcpServers(config, context(), options);
      const controller = new AbortController();
      if (mode === "cancel") controller.abort();
      try { await assert.rejects(failed.bindSubscriptions!({ srv: ["fixture://exact%2f"] }, commit, controller.signal), /invalid result|advertise|aborted/i); }
      finally { await failed.close(); }
    }
    state.capability = true; state.subscribe = undefined; state.startupFailures = 1;
    const disconnected = await connectMcpServers(config, context(), options);
    try {
      assert.equal(disconnected.servers!().srv!.state, "disconnected");
      const schemas = JSON.stringify(disconnected.tools.map(item => item.schema));
      await disconnected.bindSubscriptions!({ srv: ["fixture://exact%2f"] }, commit, signal());
      const deadline = Date.now() + 2000;
      while (disconnected.servers!().srv!.state !== "connected" && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(disconnected.servers!().srv!.state, "connected");
      assert.deepEqual(subscribed(state, `session-${state.next}`), ["fixture://exact%2f"]);
      assert.equal((await call(disconnected, "mcp_resource_notifications", { server: "srv" })).subscriptions, 1);
      assert.equal(JSON.stringify(disconnected.tools.map(item => item.schema)), schemas);
      assert.equal(commits.length, 1);
    } finally { await disconnected.close(); }
  });
});

test("persisted desired subscriptions survive fatal stdio and manual restart without duplicate journal acknowledgements", async () => {
  const script = `
    let buffer = "";
    const send = message => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => {
      buffer += chunk; let n;
      while ((n = buffer.indexOf("\\n")) >= 0) {
        const msg = JSON.parse(buffer.slice(0, n)); buffer = buffer.slice(n + 1);
        if (msg.method === "initialize") send({ id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {}, resources: { subscribe: true } } } });
        else if (msg.method === "tools/list") send({ id: msg.id, result: { tools: [{ name: "crash", inputSchema: { type: "object" } }] } });
        else if (msg.method === "resources/subscribe" || msg.method === "resources/unsubscribe") {
          process.stdout.write([{ method: "notifications/resources/updated", params: msg.params },
            { id: msg.id, result: {} }, { method: "notifications/resources/updated", params: msg.params }]
            .map(message => JSON.stringify({ jsonrpc: "2.0", ...message }) + "\\n").join(""));
        } else if (msg.method === "tools/call") process.exit(7);
      }
    });
  `;
  const c = await connectMcpServers({ local: { command: process.execPath, args: ["-e", script] } }, context(), { subscriptions: true, recovery: true, persistence: true });
  const commits: string[] = [];
  try {
    await c.bindSubscriptions!({ local: ["fixture://exact%2f"] }, (_server, method, uri) => commits.push(`${method}:${uri}`), signal());
    assert.equal((await call(c, "mcp_resource_notifications", { server: "local" })).notifications.length, 1);
    await call(c, "mcp_resource_subscribe", { server: "local", uri: "fixture://second" });
    await assert.rejects(tool(c, "mcp__local__crash").execute({}, context()), /exited/);
    assert.equal(c.servers!().local!.state, "disconnected");
    await c.reconnect!("local", signal());
    const restored = await call(c, "mcp_resource_notifications", { server: "local" });
    assert.equal(restored.subscriptions, 2);
    assert.deepEqual(restored.notifications, [{ uri: "fixture://exact%2f" }, { uri: "fixture://second" }]);
    assert.deepEqual(commits, ["resources/subscribe:fixture://second"]);
    await call(c, "mcp_resource_unsubscribe", { server: "local", uri: "fixture://second" });
    assert.equal(commits.length, 2);
  } finally { await c.close(); }
});
