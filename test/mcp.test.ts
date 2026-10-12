import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  connectMcpServers,
  mcpToolName,
  MCP_MAX_FRAME_BYTES,
  MCP_PROTOCOL_LIMITS,
  MCP_REQUEST_TIMEOUT_MS,
  MCP_STDERR_CAP_BYTES,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  type McpConnectContext,
  type McpConnection,
  type McpServerConfig,
} from "../src/mcp.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";

// ---------------------------------------------------------------------------
// Fixtures: a self-contained MCP stdio server run as `node -e <script> <mode> <out>`.
// It speaks only the JSON-RPC subset the client exercises and never touches the
// network, models, credentials or any file outside the caller's temp dir.
// ---------------------------------------------------------------------------

const MOCK_SERVER = String.raw`
const fs = require("fs");
const cp = require("child_process");
const MODE = process.argv[1] || "basic";
const OUT_FILE = process.argv[2] || "";
const TICKS_FILE = process.argv[3] || "";
function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }
function note(obj) { if (OUT_FILE) { try { fs.appendFileSync(OUT_FILE, JSON.stringify(obj) + "\n"); } catch (e) {} } }
if (OUT_FILE) note({ pid: process.pid });
// A real same-process-group descendant that inherits this server's stdout/stderr
// (so it also holds the client's pipes open) and keeps running after the server
// exits. It must be reaped by the retained process-group kill.
if (MODE === "descendant" && TICKS_FILE) {
  const script = "const fs=require('fs');const f=process.argv[1];setInterval(function(){try{fs.appendFileSync(f,'t');}catch(e){}},30);";
  const desc = cp.spawn(process.execPath, ["-e", script, TICKS_FILE], { stdio: ["ignore", "inherit", "inherit"] });
  note({ descendantPid: desc.pid });
}
function tools() {
  return [
    { name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } },
    { name: "ro", description: "Read only tool", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } },
    { name: "boom", description: "Always errors", inputSchema: { type: "object" } },
    { name: "structured", description: "Non-text content", inputSchema: { type: "object" } },
    { name: "big", description: "Large text", inputSchema: { type: "object" } },
    { name: "slow", description: "Never responds in hang mode", inputSchema: { type: "object" } },
    { name: "exit", description: "Exits the server process", inputSchema: { type: "object" } }
  ];
}
function handle(msg) {
  if (msg.method === "initialize") {
    if (MODE === "badjson") process.stdout.write("this is definitely not json\n");
    if (MODE === "huge") process.stdout.write("a".repeat(1048576 + 32) + "\n");
    if (MODE === "wrongversion") { send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } } }); return; }
    if (MODE === "noversion") { send({ jsonrpc: "2.0", id: msg.id, result: { capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } } }); return; }
    send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } } });
    if (MODE === "serverreq") send({ jsonrpc: "2.0", id: "server-request-1", method: "roots/list", params: {} });
    return;
  }
  if (msg.method === "notifications/initialized") { note({ initialized: true }); return; }
  if (msg.method === "notifications/cancelled") { note({ cancelled: msg.params }); return; }
  if (msg.id === "server-request-1") { note({ refused: msg.error ? msg.error.code : null }); return; }
  if (msg.method === "tools/list") {
    if (MODE === "paginate") {
      const cursor = msg.params ? msg.params.cursor : undefined;
      if (!cursor) send({ jsonrpc: "2.0", id: msg.id, result: { tools: [tools()[0]], nextCursor: "page2" } });
      else send({ jsonrpc: "2.0", id: msg.id, result: { tools: [tools()[2]] } });
      return;
    }
    if (MODE === "cycle") { send({ jsonrpc: "2.0", id: msg.id, result: { tools: [], nextCursor: "loop" } }); return; }
    send({ jsonrpc: "2.0", id: msg.id, result: { tools: tools() } });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params.name;
    const args = msg.params.arguments || {};
    if (MODE === "exitcall") { process.stderr.write("Z".repeat(20000), function () { process.exit(3); }); return; }
    if (MODE === "hang" && name === "slow") { note({ called: name, requestId: msg.id }); return; }
    if (name === "exit") { note({ exited: true }); process.exit(0); return; }
    if (name === "boom") { send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "kaboom" }], isError: true } }); return; }
    if (name === "structured") { send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "image", data: "AAAA", mimeType: "image/png" }], structuredContent: { ok: true } } }); return; }
    if (name === "big") { send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "X".repeat(5000) }] } }); return; }
    if (name === "slow") { send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "slow-done" }] } }); return; }
    send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "echo:" + (args.text === undefined ? "" : String(args.text)) }] } });
    return;
  }
}
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (chunk) {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { continue; }
    try { handle(msg); } catch (e) {}
  }
});
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const tempDirs: string[] = [];
function tmpDir(prefix = "ccrev-mcp-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(25);
  }
  throw new Error("condition was not met before the timeout");
}

function readNotes(file: string): Record<string, unknown>[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

function mockServer(mode = "basic", outFile = "", extra: string[] = []): McpServerConfig {
  return { command: process.execPath, args: ["-e", MOCK_SERVER, mode, outFile, ...extra] };
}

function connectContext(
  workspace: string,
  overrides: Partial<Pick<McpConnectContext, "signal" | "maxOutputBytes">> = {},
): McpConnectContext {
  return {
    workspace,
    signal: new AbortController().signal,
    maxOutputBytes: 100_000,
    ...overrides,
  };
}

function makeContext(workspace: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workspace,
    signal: new AbortController().signal,
    allowShell: false,
    maxOutputBytes: 100_000,
    ...overrides,
  };
}

function findTool(tools: ToolDefinition[], name: string): ToolDefinition {
  const found = tools.find((tool) => tool.schema.name === name);
  assert.ok(found, `tool ${name} is missing`);
  return found;
}

async function withConnection<T>(
  config: Record<string, McpServerConfig>,
  context: McpConnectContext,
  fn: (connection: McpConnection) => Promise<T>,
  options?: { requestTimeoutMs?: number; recovery?: boolean },
): Promise<T> {
  const connection = await connectMcpServers(config, context, options);
  try {
    return await fn(connection);
  } finally {
    await connection.close();
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handshake, tool adaptation and calls
// ---------------------------------------------------------------------------

test("completes the 2024-11-05 handshake and adapts server tools", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("basic") }, connectContext(ws), async (connection) => {
    assert.deepEqual(
      connection.tools.map((tool) => tool.schema.name).sort(),
      [
        "mcp__srv__big",
        "mcp__srv__boom",
        "mcp__srv__echo",
        "mcp__srv__exit",
        "mcp__srv__ro",
        "mcp__srv__slow",
        "mcp__srv__structured",
      ],
    );
    assert.equal(connection.limits, MCP_PROTOCOL_LIMITS);
    assert.ok(
      connection.limits.some((entry) => entry.includes("2024-11-05")),
      "limits should record the negotiated protocol version",
    );

    const echo = findTool(connection.tools, "mcp__srv__echo");
    // The server's input schema is passed through, with an object root guaranteed.
    assert.deepEqual(echo.schema.input_schema, {
      type: "object",
      properties: { text: { type: "string" } },
    });
    assert.equal(echo.readOnly, false);
    assert.match(String(echo.schema.description), /Echo text/);

    assert.equal(await echo.execute({ text: "hi" }, makeContext(ws)), "echo:hi");

    // readOnlyHint annotations become the workspace read-only flag.
    assert.equal(findTool(connection.tools, "mcp__srv__ro").readOnly, true);
  });
});

test("a tool result flagged isError is thrown, not returned", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("basic") }, connectContext(ws), async (connection) => {
    const boom = findTool(connection.tools, "mcp__srv__boom");
    await assert.rejects(boom.execute({}, makeContext(ws)), /kaboom/);
  });
});

test("non-text results render as JSON and every result is capped to UTF-8 bytes", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("basic") }, connectContext(ws), async (connection) => {
    const structured = findTool(connection.tools, "mcp__srv__structured");
    const rendered = await structured.execute({}, makeContext(ws));
    assert.match(rendered, /"structuredContent"/);
    assert.match(rendered, /"ok": true/);
    assert.match(rendered, /image\/png/);

    const big = findTool(connection.tools, "mcp__srv__big");
    const capped = await big.execute({}, makeContext(ws, { maxOutputBytes: 80 }));
    assert.match(capped, /\[mcp:mcp__srv__big output truncated/);
    assert.ok(!capped.includes("�"), "truncation must stay valid UTF-8");
    assert.ok(Buffer.byteLength(capped, "utf8") < 300, "capped output should be small");
  });
});

test("a tool input that is not a JSON object is rejected before any request", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("basic") }, connectContext(ws), async (connection) => {
    const echo = findTool(connection.tools, "mcp__srv__echo");
    await assert.rejects(echo.execute("not-an-object", makeContext(ws)), /object input/);
  });
});

// ---------------------------------------------------------------------------
// Timeout and cancellation
// ---------------------------------------------------------------------------

test("requests default to a 30s timeout and a hung call times out", async () => {
  assert.equal(MCP_REQUEST_TIMEOUT_MS, 30_000);
  const ws = tmpDir();
  // The connection applies one deadline to the whole session, so this value
  // must double as an initialization budget (large enough that fixture
  // startup + the initialize/tools-list round trips survive a loaded,
  // parallel full suite) and as the bounded hang deadline for the call.
  const sessionDeadlineMs = 3_000;
  await withConnection(
    { srv: mockServer("hang") },
    connectContext(ws),
    async (connection) => {
      const slow = findTool(connection.tools, "mcp__srv__slow");
      // Pin the failure to the tools/call request: if instead the handshake or
      // tools/list had timed out, the method would differ and this assertion
      // would fail loudly rather than masquerade as the hung-call outcome.
      await assert.rejects(slow.execute({}, makeContext(ws)), (error: Error) => {
        assert.match(error.message, /"tools\/call"/);
        assert.match(error.message, new RegExp(`timed out after ${sessionDeadlineMs}ms`));
        return true;
      });
    },
    { requestTimeoutMs: sessionDeadlineMs },
  );
});

test("aborting a call rejects it and sends notifications/cancelled", async () => {
  const ws = tmpDir();
  const out = path.join(ws, "notes.jsonl");
  await withConnection({ srv: mockServer("hang", out) }, connectContext(ws), async (connection) => {
    const slow = findTool(connection.tools, "mcp__srv__slow");
    const controller = new AbortController();
    const pending = slow.execute({}, makeContext(ws, { signal: controller.signal }));
    setTimeout(() => controller.abort(), 60);

    await assert.rejects(pending, (error: Error) => {
      assert.equal(error.name, "AbortError");
      return true;
    });

    await waitFor(() => readNotes(out).some((note) => note.cancelled !== undefined));
    const cancelled = readNotes(out).find((note) => note.cancelled !== undefined);
    const params = cancelled?.cancelled as { requestId: number; reason: string };
    assert.equal(typeof params.requestId, "number");
    assert.equal(params.reason, "client aborted");
  });
});

test("a pre-aborted connect signal rejects and spawns nothing", async () => {
  const ws = tmpDir();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    connectMcpServers({ srv: mockServer("basic") }, connectContext(ws, { signal: controller.signal })),
    (error: Error) => {
      assert.equal(error.name, "AbortError");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// tools/list pagination and protocol strictness
// ---------------------------------------------------------------------------

test("tools/list follows nextCursor across pages", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("paginate") }, connectContext(ws), async (connection) => {
    assert.deepEqual(
      connection.tools.map((tool) => tool.schema.name).sort(),
      ["mcp__srv__boom", "mcp__srv__echo"],
    );
  });
});

test("tools/list cursor cycles are rejected", async () => {
  const ws = tmpDir();
  await assert.rejects(
    connectMcpServers({ srv: mockServer("cycle") }, connectContext(ws)),
    /cursor .*cycle|cycle/,
  );
});

test("non-JSON stdout is a fatal protocol violation", async () => {
  const ws = tmpDir();
  await assert.rejects(
    connectMcpServers({ srv: mockServer("badjson") }, connectContext(ws)),
    /non-JSON/,
  );
});

test("an inbound frame larger than 1 MiB is rejected", async () => {
  const ws = tmpDir();
  await assert.rejects(
    connectMcpServers({ srv: mockServer("huge") }, connectContext(ws)),
    new RegExp(String(MCP_MAX_FRAME_BYTES)),
  );
});

test("server-initiated requests are refused with method-not-found", async () => {
  const ws = tmpDir();
  const out = path.join(ws, "notes.jsonl");
  await withConnection({ srv: mockServer("serverreq", out) }, connectContext(ws), async () => {
    await waitFor(() => readNotes(out).some((note) => note.refused !== undefined));
    const refusal = readNotes(out).find((note) => note.refused !== undefined);
    assert.equal(refusal?.refused, -32601);
  });
});

// ---------------------------------------------------------------------------
// Process teardown and stderr bounding
// ---------------------------------------------------------------------------

test("closing kills the owned child, is idempotent, and fails later calls", async () => {
  const ws = tmpDir();
  const out = path.join(ws, "notes.jsonl");
  const connection = await connectMcpServers({ srv: mockServer("basic", out) }, connectContext(ws));
  const echo = findTool(connection.tools, "mcp__srv__echo");

  await waitFor(() => readNotes(out).some((note) => typeof note.pid === "number"));
  const pid = readNotes(out).find((note) => typeof note.pid === "number")?.pid as number;
  assert.ok(processAlive(pid), "child should be running while connected");

  await connection.close();
  await connection.close(); // idempotent
  await waitFor(() => !processAlive(pid));

  await assert.rejects(echo.execute({ text: "x" }, makeContext(ws)), /not connected|closed/);
});

test("stderr from a crashed server is surfaced as a bounded diagnostic tail", async () => {
  const ws = tmpDir();
  await withConnection({ srv: mockServer("exitcall") }, connectContext(ws), async (connection) => {
    const echo = findTool(connection.tools, "mcp__srv__echo");
    await assert.rejects(echo.execute({}, makeContext(ws)), (error: Error) => {
      assert.match(error.message, /exited/);
      assert.ok(
        Buffer.byteLength(error.message, "utf8") <= MCP_STDERR_CAP_BYTES + 200,
        `stderr tail should be capped, got ${Buffer.byteLength(error.message, "utf8")} bytes`,
      );
      return true;
    });
    assert.equal(connection.servers?.().srv?.state, "disconnected");
    assert.equal(connection.servers?.().srv?.attempts, 0);
    const replacement = await connection.reconnect!("srv", new AbortController().signal);
    assert.equal(replacement.state, "connected"); assert.equal(replacement.generation, 2);
    assert.equal(replacement.attempts, 1);
  });
});

test("a failed stdio child is re-dialed once on the next use only when recovery is enabled", async () => {
  const ws = tmpDir();
  const notes = path.join(ws, "notes.jsonl");
  await withConnection({ srv: mockServer("basic", notes) }, connectContext(ws), async (connection) => {
    const exit = findTool(connection.tools, "mcp__srv__exit");
    const echo = findTool(connection.tools, "mcp__srv__echo");
    await assert.rejects(exit.execute({}, makeContext(ws)));
    await waitFor(() => connection.servers?.().srv?.state === "disconnected");
    assert.equal(connection.servers?.().srv?.generation, 1);
    assert.equal(connection.servers?.().srv?.attempts, 0, "stdio keeps no background timer");
    await assert.rejects(echo.execute({ text: "plain" }, makeContext(ws)), /disconnected/,
      "without recovery the dead child is not re-dialed");
  }, { recovery: false });
  const first = readNotes(notes).filter((note) => typeof note.pid === "number").map((note) => note.pid as number);
  assert.equal(first.length, 1, "without recovery only the original child was spawned");

  const wsRetry = tmpDir();
  const retryNotes = path.join(wsRetry, "notes.jsonl");
  await withConnection({ srv: mockServer("exitcall", retryNotes) }, connectContext(wsRetry), async (connection) => {
    const echo = findTool(connection.tools, "mcp__srv__echo");
    await assert.rejects(echo.execute({}, makeContext(wsRetry)), /exited|stderr/);
    await waitFor(() => connection.servers?.().srv?.state === "disconnected");
    // The recovered client dials a fresh process on the next use; this fixture exits on every call,
    // so the redial succeeds while the call itself fails again and nothing loops.
    await assert.rejects(echo.execute({}, makeContext(wsRetry)), /exited|stderr/);
    const status = connection.servers!().srv!;
    assert.equal(status.generation, 2); assert.equal(status.attempts, 1);
    assert.equal(status.state, "disconnected");
  }, { recovery: true });
  const spawned = readNotes(retryNotes).filter((note) => typeof note.pid === "number").map((note) => note.pid as number);
  assert.equal(new Set(spawned).size, 2, "one lazy re-dial spawned exactly one new process");

  const wsHealthy = tmpDir();
  const healthyNotes = path.join(wsHealthy, "notes.jsonl");
  await withConnection({ srv: mockServer("basic", healthyNotes) }, connectContext(wsHealthy), async (connection) => {
    const exit = findTool(connection.tools, "mcp__srv__exit");
    const echo = findTool(connection.tools, "mcp__srv__echo");
    await assert.rejects(exit.execute({}, makeContext(wsHealthy)));
    await waitFor(() => connection.servers?.().srv?.state === "disconnected");
    assert.equal(await echo.execute({ text: "recovered" }, makeContext(wsHealthy)), "echo:recovered");
    const status = connection.servers!().srv!;
    assert.equal(status.state, "connected"); assert.equal(status.generation, 2); assert.equal(status.attempts, 1);
  }, { recovery: true });
  const healthy = readNotes(healthyNotes).filter((note) => typeof note.pid === "number").map((note) => note.pid as number);
  assert.equal(new Set(healthy).size, 2, "exactly one replacement process served the next call");
});

// ---------------------------------------------------------------------------
// Naming: sanitize, reject invalid, detect collisions
// ---------------------------------------------------------------------------

test("tool names are sanitized and invalid names are rejected", () => {
  assert.equal(mcpToolName("srv", "echo"), "mcp__srv__echo");
  assert.equal(mcpToolName("my server", "weird.tool"), "mcp__my_server__weird_tool");
  assert.throws(() => mcpToolName("", "echo"), /empty after sanitizing/);
  assert.throws(() => mcpToolName("srv", ""), /empty after sanitizing/);
  assert.throws(() => mcpToolName("srv", "x".repeat(200)), /invalid after sanitizing/);
});

test("tool-name collisions across servers are rejected", async () => {
  const ws = tmpDir();
  // "a.b" and "a_b" both sanitize to "a_b", so their shared tool collides.
  await assert.rejects(
    connectMcpServers(
      { "a.b": mockServer("basic"), a_b: mockServer("basic") },
      connectContext(ws),
    ),
    /collision/,
  );
});

test("an empty server name is rejected before any spawn", async () => {
  const ws = tmpDir();
  await assert.rejects(
    connectMcpServers({ "": mockServer("basic") }, connectContext(ws)),
    /non-empty/,
  );
});

// ---------------------------------------------------------------------------
// Process-group teardown across a normal server exit
// ---------------------------------------------------------------------------

test("a same-group descendant is swept even when the server leader exits first", async () => {
  const ws = tmpDir();
  const out = path.join(ws, "notes.jsonl");
  const ticks = path.join(ws, "ticks.txt");
  const connection = await connectMcpServers(
    { srv: mockServer("descendant", out, [ticks]) },
    connectContext(ws),
  );
  try {
    await waitFor(() => readNotes(out).some((note) => typeof note.descendantPid === "number"));
    const pid = readNotes(out).find((note) => typeof note.descendantPid === "number")
      ?.descendantPid as number;
    assert.ok(processAlive(pid), "descendant should start alive");
    await waitFor(() => fs.existsSync(ticks) && fs.statSync(ticks).size > 0);

    // The server exits on its own (normal MCP parent exit). The descendant is
    // still running in the same process group and must be reaped by the group
    // kill rather than surviving because the leader's exitCode was already set.
    const exitTool = findTool(connection.tools, "mcp__srv__exit");
    await assert.rejects(exitTool.execute({}, makeContext(ws)), /exited/);

    await waitFor(() => !processAlive(pid));
    const sizeAfterSweep = fs.existsSync(ticks) ? fs.statSync(ticks).size : 0;
    await delay(200);
    assert.equal(
      fs.existsSync(ticks) ? fs.statSync(ticks).size : 0,
      sizeAfterSweep,
      "descendant must be dead after the group sweep",
    );
  } finally {
    // The descendant held the server's stdout/stderr open, so teardown must be
    // bounded rather than waiting on an inherited pipe.
    const started = Date.now();
    await connection.close();
    assert.ok(Date.now() - started < 3_000, "close must not block on inherited pipes");
  }
});

// ---------------------------------------------------------------------------
// initialize protocol-version negotiation
// ---------------------------------------------------------------------------

test("initialize must negotiate a supported protocol version before initialized", async () => {
  assert.ok(MCP_SUPPORTED_PROTOCOL_VERSIONS.includes("2024-11-05"));
  const ws = tmpDir();

  // Success path: notifications/initialized is announced after a good version.
  const okOut = path.join(ws, "ok.jsonl");
  await withConnection({ srv: mockServer("basic", okOut) }, connectContext(ws), async () => {
    await waitFor(() => readNotes(okOut).some((note) => note.initialized === true));
  });

  // Wrong version: rejected, and initialized is never announced.
  const wrongOut = path.join(ws, "wrong.jsonl");
  await assert.rejects(
    connectMcpServers({ srv: mockServer("wrongversion", wrongOut) }, connectContext(ws)),
    /unsupported protocolVersion "2025-06-18"/,
  );
  assert.ok(
    !readNotes(wrongOut).some((note) => note.initialized === true),
    "must not send notifications/initialized after a wrong version",
  );

  // Missing version: rejected before initialized.
  await assert.rejects(
    connectMcpServers({ srv: mockServer("noversion") }, connectContext(ws)),
    /did not report a protocolVersion/,
  );
});
