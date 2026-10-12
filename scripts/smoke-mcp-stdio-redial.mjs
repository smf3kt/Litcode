import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The recovered client keeps no background timer for stdio: a dead child is closed and the next use
// dials a fresh process. This driver runs the real CLI against a stdio fixture that exits on its first
// tool call and serves the second one from a freshly spawned process.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-stdio-redial-")));
const compiled = process.argv.includes("--compiled");
const recovery = !process.argv.includes("--no-recovery");
const marker = path.join(workspace, "crashed.once");
const notes = path.join(workspace, "notes.jsonl");
const serverScript = path.join(workspace, "owned-stdio.mjs");
let child, server, ended = false, wake, stdout = "", stderr = "";
const requests = [];
const wait = predicate => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { wake = undefined; reject(new Error("CLI wait expired: " + stderr)); }, 15000);
  wake = () => {
    if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); }
    else if (ended) { clearTimeout(timer); wake = undefined; reject(new Error("CLI exited: " + stderr)); }
  }; wake();
});
const pids = () => {
  try {
    return fs.readFileSync(notes, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line).pid);
  } catch { return []; }
};
try {
  fs.mkdirSync(path.join(workspace, "user")); fs.mkdirSync(path.join(workspace, ".harness"));
  fs.writeFileSync(serverScript, `import fs from 'node:fs';
import readline from 'node:readline';
const marker = ${JSON.stringify(marker)}, notes = ${JSON.stringify(notes)};
fs.appendFileSync(notes, JSON.stringify({ pid: process.pid }) + '\\n');
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
const tools = [{ name: 'ping', description: 'Owned stdio ping', inputSchema: { type: 'object', properties: {} } }];
readline.createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  const m = JSON.parse(line);
  if (m.method === 'initialize') reply(m.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'owned-stdio', version: '1' } });
  else if (m.method === 'notifications/initialized') return;
  else if (m.method === 'tools/list') reply(m.id, { tools });
  else if (m.method === 'tools/call') {
    if (!fs.existsSync(marker)) { fs.writeFileSync(marker, 'once'); process.exit(7); }
    reply(m.id, { content: [{ type: 'text', text: 'STDIO_PONG' }] });
  } else if (m.id !== undefined) reply(m.id, {});
});
`);
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      requests.push(body);
      const last = body.messages.at(-1);
      const answered = Array.isArray(last.content) && last.content.some(block => block.type === "tool_result");
      const block = answered ? { type: "text", text: "turn complete" }
        : { type: "tool_use", id: `ping-${requests.length}`, name: body.tools.find(tool => tool.name.startsWith("mcp__owned__ping")).name, input: {} };
      const events = [
        { type: "message_start", message: { id: "redial", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  fs.writeFileSync(path.join(workspace, "user/settings.json"), JSON.stringify({ mcpServers: { owned: { command: process.execPath, args: [serverScript] } } }));
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ permissions: { mode: "bypass", allow: [], deny: [] },
    features: { mcpRecovery: recovery } }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-stdio-redial", LLM_MODEL: "fixture/redial", LLM_BASE_URL: url, LLM_AUTH: "bearer",
    LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "--interactive"], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); wake?.(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
  const exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => { ended = true; wake?.(); resolve(code); }); });
  await wait(() => stderr.includes("Personal harness."));
  const turn = async prompt => {
    const offset = stderr.length; child.stdin.write(prompt + "\n");
    await wait(() => stderr.slice(offset).includes("finished: end_turn"));
  };
  // A tool_result carrying the fixture's text is the evidence that the call reached the model's context.
  const results = () => requests.flatMap(request => request.messages.flatMap(message =>
    Array.isArray(message.content) ? message.content : [])).filter(block => block.type === "tool_result");
  const delivered = () => results().some(block => JSON.stringify(block).includes("STDIO_PONG"));
  const errorResults = () => results().filter(block => block.is_error === true).map(block => JSON.stringify(block));
  await turn("call ping");
  assert.equal(pids().length, 1, "the first call ran in the original child");
  assert.equal(delivered(), false, "the crashed child returned no result");
  const before = pids().length;
  await turn("call ping again");
  if (recovery) {
    assert.equal(delivered(), true, "the re-dialed process served the next call");
    assert.equal(new Set(pids()).size, 2, "the second call ran in exactly one fresh process");
    assert.equal(pids().length, before + 1);
  } else {
    assert.equal(delivered(), false, "without recovery the call is not retried");
    assert.equal(new Set(pids()).size, 1, "without recovery no fresh process is dialed");
    assert.ok(errorResults().some(result => result.includes("disconnected")),
      "without recovery the model sees the disconnected error");
  }
  child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
  console.log(JSON.stringify({ stdioRedial: "passed", compiledCLI: compiled, recovery,
    processes: pids().length, modelRequests: requests.length, toolResults: delivered() }));
} finally {
  if (child) child.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
