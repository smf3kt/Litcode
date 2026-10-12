import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-list-changed-cli-")));
const compiled = process.argv.includes("--compiled");
const requests = [], calls = [];
let child, server, notificationResponse, lists = 0, listsAtFirstRequest, stdout = "", stderr = "", wake, ended = false;
const wait = predicate => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { wake = undefined; reject(new Error("CLI wait expired: " + stderr)); }, 10000);
  wake = () => {
    if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); }
    else if (ended) { clearTimeout(timer); wake = undefined; reject(new Error("CLI exited: " + stderr)); }
  }; wake();
});
try {
  fs.mkdirSync(path.join(workspace, "user")); fs.mkdirSync(path.join(workspace, ".harness"));
  server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/mcp") {
      assert.equal(req.headers["mcp-session-id"], "owned-list-changed");
      notificationResponse = res;
      res.writeHead(200, { "content-type": "text/event-stream" }); res.flushHeaders();
      wake?.();
      return;
    }
    if (req.method === "DELETE") { res.writeHead(204).end(); return; }
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      if (req.url === "/mcp") {
        const json = result => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
        if (body.method === "initialize") { res.setHeader("MCP-Session-Id", "owned-list-changed"); json({ protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: true } } }); }
        else if (body.method === "tools/list") { lists++; wake?.(); json({ tools: [{ name: "gen" + lists, description: "owned generation", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }] }); }
        else if (body.method === "tools/call") { calls.push({ session: req.headers["mcp-session-id"], name: body.params.name }); json({ content: [{ type: "text", text: "OWNED_GEN" }] }); }
        else res.writeHead(202).end();
        return;
      }
      requests.push(body);
      if (listsAtFirstRequest === undefined) listsAtFirstRequest = lists;
      const block = requests.length === 1 ? { type: "tool_use", id: "search", name: "mcp_tool_search", input: { query: "gen" } }
        : requests.length === 2 ? { type: "tool_use", id: "call-changed", name: "mcp_tool_call", input: { server: "owned", tool: "gen2" } }
        : { type: "text", text: "list change adopted" };
      const events = [
        { type: "message_start", message: { id: "list-changed", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } },
        { type: "content_block_delta", index: 0, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: block.type === "text" ? "end_turn" : "tool_use", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ]; res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ permissions: { mode: "bypass", allow: [], deny: [] },
    mcpServers: { owned: { type: "http", url: url + "/mcp" } }, features: { mcpNotificationStream: true } }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-list-changed", LLM_MODEL: "fixture/list-changed", LLM_BASE_URL: url, LLM_AUTH: "bearer",
    LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "--interactive"], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); wake?.(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
  const exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => { ended = true; wake?.(); resolve(code); }); });
  await wait(() => stderr.includes("Personal harness."));
  await wait(() => lists >= 1);
  await wait(() => notificationResponse !== undefined);
  assert.equal(lists, 1);
  // An idle GET-stream notification must refetch by itself, with no turn and no discovery call.
  notificationResponse.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })}\n\n`);
  await wait(() => lists === 2);
  child.stdin.write("adopt the changed tool list\n");
  await wait(() => stderr.includes("finished: end_turn"));
  child.stdin.end("/exit\n");
  assert.equal(await exited, 0); child = undefined;
  assert.equal(listsAtFirstRequest, 2);
  assert.equal(lists, 2);
  assert.equal(requests.length, 3);
  assert.match(JSON.stringify(requests[1].messages), /gen2/);
  assert.ok(requests[1].tools.some(tool => tool.name === "mcp_tool_search"));
  const result = requests[2].messages.at(-1).content.find(block => block.type === "tool_result");
  assert.equal(result.is_error, undefined);
  assert.match(JSON.stringify(result), /OWNED_GEN/);
  assert.deepEqual(calls, [{ session: "owned-list-changed", name: "gen2" }]);
  const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"));
  const records = fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(records[0].config.features.mcpNotificationStream, true);
  assert.equal(records.filter(record => record.kind === "tool_start").length, 2);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", eagerRefetch: true, idleNotification: true, refreshedBeforeModelRequest: true,
    changedToolCallable: true, noDiscoveryCall: true, journalPinned: true, locksReleased: true,
    ...(compiled ? { compiledCLI: true } : {}), modelCalls: requests.length, lists, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  notificationResponse?.destroy();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
