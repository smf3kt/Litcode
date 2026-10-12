import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-logging-cli-")));
let server, child, notificationResponse;
let modelCalls = 0, level;
const streamMode = process.argv.includes("--notification-stream");
const compiled = process.argv.includes("--compiled");
let getCount = 0, sent = false, getClosed = false;
const requests = [];
try {
  fs.mkdirSync(path.join(workspace, "user")); fs.mkdirSync(path.join(workspace, ".harness"));
  server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/mcp") {
      getCount++; assert.equal(req.headers["mcp-session-id"], "owned-notification-session");
      assert.equal(req.headers["mcp-protocol-version"], "2025-06-18");
      notificationResponse = res;
      res.writeHead(200, { "content-type": "text/event-stream" }); res.flushHeaders();
      res.on("close", () => { getClosed = true; });
      return;
    }
    if (req.method === "DELETE") { res.writeHead(204).end(); return; }
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      if (req.url === "/mcp") {
        const json = result => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
        if (body.method === "initialize") { if (streamMode) res.setHeader("MCP-Session-Id", "owned-notification-session"); json({ protocolVersion: "2025-06-18", capabilities: { tools: {}, logging: {} } }); }
        else if (body.method === "tools/list") json({ tools: [] });
        else if (body.method === "logging/setLevel") {
          level = body.params.level;
          if (streamMode) json({});
          else {
            res.writeHead(200, { "content-type": "text/event-stream" });
            res.end([{ jsonrpc: "2.0", method: "notifications/message", params: { level: "info", logger: "fixture", data: { message: "OWNED_LOG_MESSAGE", nested: [1, true] } } },
              { jsonrpc: "2.0", id: body.id, result: {} }].map(frame => `data: ${JSON.stringify(frame)}\n\n`).join(""));
          }
        } else res.writeHead(202).end();
        return;
      }
      requests.push(body); modelCalls++;
      const block = modelCalls === 1 ? { type: "tool_use", id: "set-level", name: "mcp_logging_set_level", input: { server: "logs", level: "info" } }
        : modelCalls === 2 ? { type: "tool_use", id: "poll-logs", name: "mcp_logging_notifications", input: { server: "logs", limit: 10 } }
        : { type: "text", text: "logs collected" };
      const events = [
        { type: "message_start", message: { id: "logging-model", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } },
        { type: "content_block_delta", index: 0, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: block.type === "text" ? "end_turn" : "tool_use", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // mcpServers live in the user layer: a checkout-declared server is held as a decision to answer.
  fs.writeFileSync(path.join(workspace, "user/settings.json"), JSON.stringify({ mcpServers: { logs: { type: "http", url: url + "/mcp" } } }));
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({
    features: { mcpLogging: true, ...(streamMode ? { mcpNotificationStream: true } : {}) }, permissions: { mode: "bypass", allow: [], deny: [] } }));
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive"], { cwd: root, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/logging", LLM_BASE_URL: url,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
  let stderr = "", stdout = "";
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); });
  const timer = setTimeout(() => child?.kill("SIGKILL"), 15000);
  child.stderr.on("data", chunk => {
    stderr = (stderr + chunk).slice(-32000);
    if (streamMode && !sent && stderr.includes("Personal harness.")) {
      sent = true;
      const deadline = Date.now() + 2000;
      const ready = setInterval(() => {
        if (!notificationResponse) {
          if (Date.now() >= deadline) { clearInterval(ready); child?.kill("SIGKILL"); }
          return;
        }
        clearInterval(ready);
        notificationResponse.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: { level: "info", logger: "fixture", data: { message: "OWNED_LOG_MESSAGE", nested: [1, true] } } })}\n\n`);
        setTimeout(() => child?.stdin.write("/mcp\ncollect fixture MCP logs\n"), 100);
      }, 5);
    }
    if (stderr.includes("finished: end_turn")) child.stdin.end("/exit\n");
  });
  if (!streamMode) child.stdin.write("collect fixture MCP logs\n");
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  clearTimeout(timer); child = undefined;
  assert.equal(code, 0, stderr); assert.equal(level, "info"); assert.equal(modelCalls, 3);
  assert.ok(requests[0].tools.some(tool => tool.name === "mcp_logging_set_level"));
  const result = requests[2].messages.at(-1).content.find(block => block.type === "tool_result");
  assert.equal(result.is_error, undefined);
  assert.match(JSON.stringify(result), /OWNED_LOG_MESSAGE/);
  const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"));
  const records = fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(records[0].config.features.mcpLogging, true);
  if (streamMode) {
    assert.equal(records[0].config.features.mcpNotificationStream, true); assert.equal(getCount, 1); assert.equal(getClosed, true);
    assert.match(stdout, /"notificationStreams":\s*\{\s*"logs":\s*\{\s*"state": "active"/);
  }
  assert.equal(records.filter(record => record.kind === "tool_start").length, 2);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", setLevel: true, activePostSseLog: !streamMode, explicitPoll: true,
    ...(streamMode ? { continuousGetLog: true, idleNotification: true, streamClosed: true, streamInspection: true } : {}),
    ...(compiled ? { compiledCLI: true } : {}), journalPinned: true, modelCalls, locksReleased: true, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  notificationResponse?.destroy();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
