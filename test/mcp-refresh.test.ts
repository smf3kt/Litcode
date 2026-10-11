import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { test } from "node:test";
import { connectMcpServers, MCP_MAX_TOTAL_TOOLS, type McpConnection, type McpConnectOptions } from "../src/mcp.js";
import type { ToolContext } from "../src/tools.js";

const ctx = (): ToolContext => ({ workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 100_000, allowShell: false });
const info = (name: string, readOnly = false) => ({ name, description: `${name} description`, inputSchema: { type: "object", properties: { text: { type: "string" } } }, annotations: { readOnlyHint: readOnly } });
type State = { tools: unknown[]; lists: number; calls: string[]; fail: boolean; notify: boolean; closed: number; result?: unknown; initializeChanged?: boolean; afterInitial?: unknown[] };
function json(res: ServerResponse, id: unknown, result: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
}
async function fixture(fn: (url: string, state: State) => Promise<void>): Promise<void> {
  const state: State = { tools: [info("original", true)], lists: 0, calls: [], fail: false, notify: false, closed: 0 };
  const server = createServer((req, res) => {
    void (async () => {
      let text = ""; for await (const chunk of req) text += chunk;
      if (req.method === "DELETE") { state.closed++; res.writeHead(204); res.end(); return; }
      const msg = JSON.parse(text);
      if (msg.method === "initialize") {
        res.setHeader("Mcp-Session-Id", "session");
        const result = { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: true } } };
        if (state.initializeChanged) {
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })}\n\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })}\n\n`);
        } else json(res, msg.id, result);
      }
      else if (msg.method === "tools/list") {
        state.lists++;
        if (state.fail) { res.writeHead(500); res.end(); }
        else {
          json(res, msg.id, { tools: state.tools });
          if (state.lists === 1 && state.afterInitial) state.tools = state.afterInitial;
        }
      } else if (msg.method === "tools/call") {
        state.calls.push(msg.params.name);
        const result = state.result ?? { content: [{ type: "text", text: `${msg.params.name}:${msg.params.arguments.text ?? ""}` }] };
        if (state.notify) {
          state.notify = false;
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })}\n\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result })}\n\n`);
        } else json(res, msg.id, result);
      } else { res.writeHead(202); res.end(); }
    })().catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await fn(`http://127.0.0.1:${address.port}/mcp`, state); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
const tool = (c: McpConnection, name: string) => { const t = c.tools.find((t) => t.schema.name === name); assert.ok(t, name); return t; };
const connect = (url: string, options: McpConnectOptions = { dynamic: true }) => connectMcpServers({ srv: { type: "http", url } }, ctx(), options);
const search = async (c: McpConnection, query = "", extra = {}) => JSON.parse(await tool(c, "mcp_tool_search").execute({ query, ...extra }, ctx()));

test("default MCP schemas remain exact and dynamic helpers require configured servers", async () => {
  await fixture(async (url) => {
    const c = await connect(url, {});
    try { assert.deepEqual(c.tools.map((t) => t.schema.name), ["mcp__srv__original"]); }
    finally { await c.close(); }
  });
  const empty = await connectMcpServers({}, ctx(), { dynamic: true, deferred: true });
  assert.deepEqual(empty.tools, []); await empty.close();
});

test("dynamic refresh adds/removes tools privately without mutating pinned schemas", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url);
    const snapshot = JSON.stringify(c.tools.map((t) => t.schema));
    try {
      assert.equal(tool(c, "mcp_tool_search").readOnly, true);
      assert.equal(tool(c, "mcp_refresh").readOnly, true);
      assert.equal(tool(c, "mcp_tool_call").readOnly, false);
      assert.equal((await search(c)).tools[0].tool, "original");
      state.tools = [info("new", true)];
      assert.deepEqual(JSON.parse(await tool(c, "mcp_refresh").execute({}, ctx())).refreshed, ["srv"]);
      assert.equal((await search(c)).tools[0].tool, "new");
      assert.equal(JSON.stringify(c.tools.map((t) => t.schema)), snapshot);
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "new", arguments: { text: "hello" } }, ctx()), "new:hello");
      await assert.rejects(tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), /absent/);
      await assert.rejects(tool(c, "mcp__srv__original").execute({}, ctx()), /absent/);
      assert.deepEqual(state.calls, ["new"]);
    } finally { await c.close(); }
    await assert.rejects(search(c), /closed/);
  });
});

test("single-server reconnect deduplicates attempts, keeps published schemas and refreshes private discovery", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url);
    try {
      const snapshot = JSON.stringify(c.tools.map(tool => tool.schema));
      state.tools = [info("replacement", true)];
      const controller = new AbortController(); controller.abort();
      const before = state.lists;
      await assert.rejects(async () => c.reconnect!("srv", controller.signal));
      assert.equal(state.lists, before);
      const result = await Promise.all([c.reconnect!("srv", ctx().signal), c.reconnect!("srv", ctx().signal)]);
      assert.equal(result[0]!.generation, 2); assert.equal(result[1]!.attempts, 1);
      assert.equal(JSON.stringify(c.tools.map(tool => tool.schema)), snapshot);
      assert.equal((await search(c)).tools[0].tool, "replacement");
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "replacement", arguments: { text: "ok" } }, ctx()), "replacement:ok");
      await assert.rejects(tool(c, "mcp__srv__original").execute({}, ctx()), /absent|metadata changed/);
      state.fail = true;
      await assert.rejects(c.reconnect!("srv", ctx().signal));
      assert.equal(c.servers!().srv!.generation, 2);
      assert.equal(c.servers!().srv!.state, "connected");
      state.fail = false;
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "replacement" }, ctx()), "replacement:");
    } finally { await c.close(); }
    assert.equal(c.servers!().srv!.state, "closed");
  });
});

test("deferred mode exposes generic discovery/call schemas and bounded valid JSON metadata", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url, { deferred: true });
    try {
      assert.deepEqual(c.tools.map((t) => t.schema.name), ["mcp_tool_search", "mcp_tool_call", "mcp_refresh"]);
      const result = await search(c, "original", { server: "srv", limit: 1 });
      assert.deepEqual(result.tools[0].input_schema, info("original").inputSchema);
      assert.equal(result.tools[0].readOnlyHint, true);
      assert.equal(tool(c, "mcp_tool_call").readOnly, false);
      const tiny = await tool(c, "mcp_tool_search").execute({ query: "" }, { ...ctx(), maxOutputBytes: 2 });
      assert.deepEqual(JSON.parse(tiny), {});
      const capped = await tool(c, "mcp_tool_search").execute({ query: "" }, { ...ctx(), maxOutputBytes: 100 });
      assert.equal(JSON.parse(capped).truncated, true);
      assert.ok(Buffer.byteLength(capped) <= 100);
      assert.equal(state.lists, 1, "search should reuse a clean private inventory");
    } finally { await c.close(); }
  });
});

test("HTTP list_changed marks dirty and next search/call refreshes once", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url, { dynamic: true, deferred: true });
    try {
      state.tools = [info("new")]; state.notify = true;
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), "original:");
      assert.equal(state.lists, 1);
      assert.equal((await search(c)).tools[0].tool, "new");
      assert.equal(state.lists, 2);
      await search(c); assert.equal(state.lists, 2);
      await assert.rejects(tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), /absent/);
    } finally { await c.close(); }
  });
});

test("notifications received during initialize remain dirty until discovery", async () => {
  await fixture(async (url, state) => {
    state.initializeChanged = true;
    state.afterInitial = [info("after")];
    const c = await connect(url, { deferred: true });
    try {
      assert.equal(state.lists, 1);
      assert.equal((await search(c)).tools[0].tool, "after");
      assert.equal(state.lists, 2);
    } finally { await c.close(); }
  });
});

test("generic calls retain structured JSON under caps and surface remote tool errors", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url, { deferred: true });
    try {
      state.result = { content: [{ type: "image", data: "A".repeat(1000), mimeType: "image/png" }], structuredContent: { ok: true } };
      const capped = await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, { ...ctx(), maxOutputBytes: 100 });
      assert.deepEqual(JSON.parse(capped), { truncated: true });
      state.result = { content: [{ type: "text", text: "remote tool error" }], isError: true };
      await assert.rejects(tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), /remote tool error/);
    } finally { await c.close(); }
  });
});

test("mutable metadata changes fail pinned read-only calls while generic calls stay mutable", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url);
    try {
      const pinned = tool(c, "mcp__srv__original");
      assert.equal(pinned.readOnly, true);
      state.tools = [info("original", false)];
      await tool(c, "mcp_refresh").execute({}, ctx());
      await assert.rejects(pinned.execute({}, ctx()), /metadata changed/);
      assert.equal(state.calls.length, 0);
      assert.equal(tool(c, "mcp_tool_call").readOnly, false);
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), "original:");
      state.tools = [{ ...info("original", true), inputSchema: { type: "object", required: ["newArgument"] } }];
      await tool(c, "mcp_refresh").execute({}, ctx());
      await assert.rejects(pinned.execute({}, ctx()), /metadata changed/);
      assert.equal(pinned.readOnly, true);
      assert.deepEqual(pinned.schema.input_schema, info("original").inputSchema);
    } finally { await c.close(); }
  });
});

for (const invalid of [[info("a.b"), info("a_b")], [{ name: "", inputSchema: {} }], [info("x".repeat(200))]]) {
  test("invalid refresh collisions/names preserve pinned schemas and recover atomically", async () => {
    await fixture(async (url, state) => {
      const c = await connect(url);
      const snapshot = JSON.stringify(c.tools.map((t) => t.schema));
      try {
        state.tools = invalid;
        await assert.rejects(tool(c, "mcp_refresh").execute({}, ctx()), /collision|valid name|invalid/);
        await assert.rejects(search(c), /collision|valid name|invalid/);
        assert.equal(JSON.stringify(c.tools.map((t) => t.schema)), snapshot);
        assert.equal(state.calls.length, 0);
        state.tools = [info("restored")];
        assert.equal((await search(c)).tools[0].tool, "restored");
      } finally { await c.close(); }
    });
  });
}

test("refresh transport failure remains dirty and retries before calls", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url);
    try {
      state.fail = true;
      await assert.rejects(tool(c, "mcp_refresh").execute({}, ctx()), /status 500/);
      await assert.rejects(tool(c, "mcp_tool_call").execute({ server: "srv", tool: "original" }, ctx()), /status 500/);
      assert.equal(state.calls.length, 0);
      state.fail = false; state.tools = [info("restored")];
      assert.equal((await search(c)).tools[0].tool, "restored");
      assert.equal(await tool(c, "mcp_tool_call").execute({ server: "srv", tool: "restored" }, ctx()), "restored:");
    } finally { await c.close(); }
  });
});

test("dynamic search/call validates input before remote requests", async () => {
  await fixture(async (url, state) => {
    const c = await connect(url);
    try {
      for (const args of [{ query: 1 }, { query: "", limit: 0 }, { query: "", limit: 101 }, { query: "", server: "missing" }, { query: "", extra: true }]) await assert.rejects(tool(c, "mcp_tool_search").execute(args, ctx()));
      for (const args of [{ server: "missing", tool: "original" }, { server: "srv", tool: "" }, { server: "srv", tool: "original", arguments: [] }]) await assert.rejects(tool(c, "mcp_tool_call").execute(args, ctx()));
      assert.equal(state.lists, 1); assert.equal(state.calls.length, 0);
    } finally { await c.close(); }
  });
});

test("tool catalogs cap the total discovered count", async () => {
  await fixture(async (url, state) => {
    state.tools = Array.from({ length: MCP_MAX_TOTAL_TOOLS + 1 }, (_, i) => ({ name: `t${i}` }));
    await assert.rejects(connect(url), /exceeds 10000 tools/);
    assert.equal(state.closed, 1);
  });
});

test("stdio list_changed refreshes private tools without spawning replacement clients", async () => {
  const script = `let b='',changed=false,lists=0;process.stdin.setEncoding('utf8');function send(m){console.log(JSON.stringify(m))}process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){const m=JSON.parse(b.slice(0,n));b=b.slice(n+1);if(m.method==='initialize')send({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2024-11-05',capabilities:{tools:{listChanged:true}}}});if(m.method==='tools/list'){lists++;send({jsonrpc:'2.0',id:m.id,result:{tools:[{name:changed?'new':'original',description:'pid '+process.pid+' lists '+lists,inputSchema:{type:'object'}}]}})}if(m.method==='tools/call'){changed=true;send({jsonrpc:'2.0',method:'notifications/tools/list_changed'});send({jsonrpc:'2.0',id:m.id,result:{content:[{type:'text',text:'pid '+process.pid}]}})}}});`;
  const c = await connectMcpServers({ local: { command: process.execPath, args: ["-e", script] } }, ctx(), { deferred: true });
  try {
    const before = await search(c);
    const pid = before.tools[0].description.match(/pid (\d+)/)[1];
    assert.equal(await tool(c, "mcp_tool_call").execute({ server: "local", tool: "original" }, ctx()), `pid ${pid}`);
    const after = await search(c);
    assert.equal(after.tools[0].tool, "new");
    assert.match(after.tools[0].description, new RegExp(`pid ${pid} lists 2`));
  } finally { await c.close(); }
});
