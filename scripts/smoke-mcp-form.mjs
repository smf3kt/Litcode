import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-form-cli-")));
let server, child, pending;
let capabilities, formResult, urlResult, modelCalls = 0, elicitations = 0;
try {
  fs.mkdirSync(path.join(workspace, "user")); fs.mkdirSync(path.join(workspace, ".harness"));
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      const json = value => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: value })); };
      if (req.url === "/mcp") {
        if (body.method === "initialize") { capabilities = body.params.capabilities; json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } }); }
        else if (body.method === "tools/list") json({ tools: [{ name: "choose", inputSchema: { type: "object", properties: {} } }] });
        else if (body.method === "tools/call") {
          pending = { res, id: body.id };
          res.writeHead(200, { "content-type": "text/event-stream" });
          // The first call asks with a form; the second asks the same way the recovered client
          // reaches an out-of-band URL, and confirms completion on the tool's own stream.
          const params = elicitations++ === 0
            ? { message: "Choose a label", requestedSchema: { type: "object", properties: { label: { type: "string", minLength: 1 } }, required: ["label"] } }
            : { mode: "url", message: "Open the fixture page", url: "https://example.invalid/consent", elicitationId: "url-1" };
          res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", id: elicitations === 1 ? "form-1" : "url-1", method: "elicitation/create", params })}\n\n`);
        } else if (body.id === "form-1") {
          formResult = body.result; res.writeHead(202).end();
          pending.res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: pending.id, result: { content: [{ type: "text", text: "Form answered" }] } })}\n\n`);
        } else if (body.id === "url-1") {
          urlResult = body.result; res.writeHead(202).end();
          pending.res.write(`data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/elicitation/complete", params: { elicitationId: "url-1" } })}\n\n`);
          pending.res.end(`data: ${JSON.stringify({ jsonrpc: "2.0", id: pending.id, result: { content: [{ type: "text", text: "URL answered" }] } })}\n\n`);
        } else res.writeHead(202).end();
        return;
      }
      modelCalls++;
      const block = modelCalls === 1 ? { type: "tool_use", id: "call-form", name: "mcp__form__choose", input: {} }
        : modelCalls === 2 ? { type: "tool_use", id: "call-url", name: "mcp__form__choose", input: {} }
          : { type: "text", text: "done" };
      const events = [
        { type: "message_start", message: { id: "model", type: "message", role: "assistant", model: body.model, content: [],
          stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: block.type === "text" ? { type: "text", text: "" } : block },
        { type: "content_block_delta", index: 0, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: "{}" } },
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
  const emit = JSON.stringify(JSON.stringify({ continue: true }));
  // The server is declared in the user layer, which is configuration. A server declared by the
  // checkout's own .harness/settings.json is a decision this driver would have to answer first.
  fs.writeFileSync(path.join(workspace, "user/settings.json"), JSON.stringify({ mcpServers: { form: { type: "http", url: url + "/mcp" } } }));
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ hooks: {
    Elicitation: [{ command: `printf %s ${emit}` }], ElicitationResult: [{ command: `printf %s ${emit}` }] } }));
  child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src/cli.ts"), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive", "--mcp-elicitation"], { cwd: root,
    stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "fixture", LLM_MODEL: "fixture", LLM_BASE_URL: url,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
  let stdout = "", stderr = "", attempts = 0, urlAnswered = false;
  const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
  child.stdout.on("data", chunk => {
    stdout = (stdout + chunk).slice(-16_000);
    if (attempts === 0 && stdout.includes("Enter a JSON object")) { attempts++; child.stdin.write("{\"label\":42}\n"); }
    else if (attempts === 1 && stdout.includes("Answer does not match")) { attempts++; child.stdin.write("{\"label\":\"selected\"}\n"); }
    if (!urlAnswered && stdout.includes("MCP URL from form:")) { urlAnswered = true; setImmediate(() => child.stdin.write(":accept\n")); }
  });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-16_000); if (stderr.includes("finished: end_turn")) child.stdin.end("/exit\n"); });
  child.stdin.write("use the form\n");
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  clearTimeout(timer); child = undefined;
  assert.equal(code, 0, stderr); assert.deepEqual(capabilities.elicitation, { form: {}, url: {} });
  assert.deepEqual(formResult, { action: "accept", content: { label: "selected" } });
  assert.deepEqual(urlResult, { action: "accept" });
  assert.match(stderr, /MCP server "form" confirmed elicitation url-1 complete/);
  assert.match(stderr, /finished: end_turn/);
  const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"));
  const events = fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(events.some(event => event.kind === "hook_result" && event.event === "Elicitation"));
  assert.ok(events.some(event => event.kind === "hook_result" && event.event === "ElicitationResult"));
  assert.equal(attempts, 2); assert.equal(urlAnswered, true); assert.equal(elicitations, 2);
  console.log(JSON.stringify({ cli: "passed", formAccepted: true, invalidAnswerRetry: true, urlAcceptedWithoutContent: true,
    completionForwarded: true, capabilities: true, elicitationHooks: true, modelCalls }));
} finally {
  child?.kill("SIGKILL"); pending?.res.destroy();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
