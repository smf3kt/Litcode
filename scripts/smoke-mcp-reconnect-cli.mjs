import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcp-reconnect-cli-")));
const compiled = process.argv.includes("--compiled"), requests = [], calls = [], deleted = [];
const scoped = process.argv.includes("--scoped");
let peerInitialized = 0, modelReconnect = false, stableSchema = false, expire = false;
let child, server, generation = 0, fail = false, ended = false, wake, stdout = "", stderr = "";
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
    if (req.method === "DELETE") { deleted.push(req.headers["mcp-session-id"]); res.writeHead(204).end(); return; }
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      if (req.url === "/mcp" || req.url === "/peer") {
        const peer = req.url === "/peer";
        const json = result => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
        if (body.method === "initialize") {
          if (peer) { peerInitialized++; res.setHeader("MCP-Session-Id", "peer-1"); json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } }); return; }
          if (fail) { res.writeHead(503).end("owned reconnect failure"); return; }
          generation++; wake?.(); res.setHeader("MCP-Session-Id", "owned-" + generation);
          json({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
        } else if (body.method === "tools/list") json({ tools: [{ name: peer ? "peer_ping" : stableSchema ? "ping1" : "ping" + generation, description: "owned generation", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }] });
        else if (body.method === "tools/call") {
          calls.push({ session: req.headers["mcp-session-id"], name: body.params.name });
          if (expire && !peer) { expire = false; res.writeHead(404).end(); return; }
          json({ content: [{ type: "text", text: "OWNED_PING" }] });
        }
        else res.writeHead(202).end();
        return;
      }
      requests.push(body);
      const block = modelReconnect && typeof body.messages.at(-1).content === "string"
        ? { type: "tool_use", id: "model-reconnect", name: "mcp_reconnect", input: { server: "owned" } }
        : requests.length % 2 === 1 ? { type: "tool_use", id: "ping-" + requests.length,
        name: body.tools.find(tool => tool.name.startsWith("mcp__owned__ping")).name, input: {} } : { type: "text", text: "ping complete" };
      const events = [
        { type: "message_start", message: { id: "reconnect", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  const url = `http://127.0.0.1:${server.address().port}`, settings = path.join(workspace, ".harness/settings.json");
  // mcpServers live in the user layer: a checkout-declared server is held as a decision to answer.
  fs.writeFileSync(path.join(workspace, "user/settings.json"), JSON.stringify({
    mcpServers: { owned: { type: "http", url: url + "/mcp" }, ...(scoped ? { peer: { type: "http", url: url + "/peer" } } : {}) } }));
  fs.writeFileSync(settings, JSON.stringify({ permissions: { mode: "bypass", allow: [], deny: [] }, features: { mcpDynamic: false } }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-reconnect", LLM_MODEL: "fixture/reconnect", LLM_BASE_URL: url, LLM_AUTH: "bearer",
    LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "--interactive"], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); wake?.(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
  const exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => { ended = true; wake?.(); resolve(code); }); });
  await wait(() => stderr.includes("Personal harness."));
  const files = () => fs.readdirSync(path.join(workspace, ".agent")).filter(file => file.endsWith(".jsonl"));
  if (scoped) {
    stableSchema = true;
    const task = async prompt => {
      const offset = stderr.length; child.stdin.write(prompt + "\n");
      await wait(() => stderr.slice(offset).includes("finished: end_turn"));
    };
    await task("ping initial");
    fail = true; let offset = stderr.length; child.stdin.write("/mcp-reconnect owned\n");
    await wait(() => stderr.slice(offset).includes("error:"));
    assert.equal(files().length, 1); assert.equal(peerInitialized, 1);
    await task("ping retained connection");
    fail = false; offset = stderr.length; child.stdin.write("/mcp-reconnect owned\n");
    await wait(() => stderr.slice(offset).includes("MCP server owned reconnected"));
    assert.equal(files().length, 1); assert.equal(peerInitialized, 1);
    await task("ping replaced connection");
    modelReconnect = true; await task("reconnect via model"); modelReconnect = false;
    assert.equal(generation, 3); assert.equal(peerInitialized, 1);
    fail = true; expire = true; await task("ping expired session");
    offset = stdout.length; child.stdin.write("/mcp\n");
    await wait(() => stdout.slice(offset).includes('"disconnected"'));
    fail = false;
    await wait(() => generation >= 4);
    await new Promise(resolve => setTimeout(resolve, 100));
    await task("ping recovered session");
    stableSchema = false; offset = stderr.length; child.stdin.write("/mcp-reconnect owned\n");
    await wait(() => stderr.slice(offset).includes("MCP server owned reconnected"));
    const beforeCalls = calls.length; await task("ping changed schema");
    assert.equal(calls.length, beforeCalls);
    assert.ok(JSON.stringify(requests.at(-1).messages).includes("pinned tool metadata changed"));
    assert.equal(files().length, 1); assert.equal(peerInitialized, 1);
    child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
    assert.deepEqual(calls.map(call => call.session), ["owned-1", "owned-1", "owned-2", "owned-3", "owned-4"]);
    assert.ok(deleted.includes("peer-1")); assert.ok(deleted.includes("owned-5"));
    const records = fs.readFileSync(path.join(workspace, ".agent", files()[0]), "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.equal(records.filter(event => event.kind === "tool_start" && event.name === "mcp_reconnect").length, 1);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", scopedReconnect: true, peerRetained: true, failedReconnectRetained: true,
      modelReconnect: true, expiredSessionStatus: true, automaticRecovery: true, recoveredSession: true, schemaChangeGuard: true, sameJournal: true,
      noEffectReplay: true, locksReleased: true, ...(compiled ? { compiledCLI: true } : {}), modelCalls: requests.length, gateway: "owned loopback SSE" }));
  } else {
  fs.writeFileSync(settings, "{"); fail = true;
  let offset = stderr.length; child.stdin.write("/mcp-reconnect\n");
  await wait(() => stderr.slice(offset).includes("error:"));
  assert.equal(files().length, 1);
  offset = stderr.length; child.stdin.write("ping after failed reconnect\n");
  await wait(() => stderr.slice(offset).includes("finished: end_turn"));
  fail = false; offset = stderr.length; child.stdin.write("/mcp-reconnect\n");
  await wait(() => stderr.slice(offset).includes("MCP servers reconnected"));
  assert.equal(files().length, 2);
  offset = stderr.length; child.stdin.write("ping new connection\n");
  await wait(() => stderr.slice(offset).includes("finished: end_turn"));
  child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
  assert.deepEqual(calls, [{ session: "owned-1", name: "ping1" }, { session: "owned-2", name: "ping2" }]);
  assert.deepEqual(new Set(deleted), new Set(["owned-1", "owned-2"]));
  assert.equal(requests.length, 4);
  const records = files().map(file => fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line)));
  assert.ok(records.some(events => events[0].config.tools.some(tool => tool.name === "mcp__owned__ping2") && events.some(event => event.kind === "branch" && event.reason === "reload")));
  assert.equal(records.reduce((sum, events) => sum + events.filter(event => event.kind === "tool_start").length, 0), 2);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", explicitReconnect: true, failedReconnectRetained: true, pinnedConfigUsed: true,
    changedSchemaJournaled: true, oldSessionClosed: true, noEffectReplay: true, locksReleased: true,
    ...(compiled ? { compiledCLI: true } : {}), modelCalls: requests.length, gateway: "owned loopback SSE" }));
  }
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
