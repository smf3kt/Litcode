import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "memory-reload-cli-")));
const requests = [];
let child, server;
try {
  fs.mkdirSync(path.join(workspace, "user"));
  fs.mkdirSync(path.join(workspace, "src"));
  fs.mkdirSync(path.join(workspace, ".harness"));
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "INITIAL_INSTRUCTION");
  fs.writeFileSync(path.join(workspace, "src/AGENTS.md"), "NESTED_INSTRUCTION: keep the file concise.");
  let retry = false;
  const blocksFor = body => {
    const messages = body.messages;
    const last = messages.at(-1);
    const prompt = typeof last.content === "string" ? last.content : last.content.filter(block => block.type === "text").map(block => block.text).join("\n");
    if (prompt.startsWith("remember preference")) return [{ type: "tool_use", id: `m-${requests.length}`, name: "memory_list", input: {} }];
    if (Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
      const prior = messages.at(-2).content.find(block => block.type === "tool_use");
      if (prior?.name === "memory_list") return [{ type: "tool_use", id: `m-${requests.length}`, name: "memory_write",
        input: { name: "validation", title: "Validation preference", description: "Prefer practical CLI checks",
          content: "User prefers actual CLI usage checks and only a few essential regressions." } }];
      if (prior?.name === "write_file" && last.content[0].is_error && !retry) {
        retry = true;
        assert.ok(last.content.some(block => block.type === "text" && block.text.includes("NESTED_INSTRUCTION")));
        return [{ type: "tool_use", id: `m-${requests.length}`, name: "write_file", input: { path: "src/result.txt", content: "concise result" } }];
      }
    }
    if (prompt.startsWith("write nested file")) return [{ type: "tool_use", id: `m-${requests.length}`, name: "write_file",
      input: { path: "src/result.txt", content: "concise result" } }];
    return [{ type: "text", text: "done" }];
  };
  server = http.createServer((req, res) => {
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const blocks = blocksFor(body);
      const events = [{ type: "message_start", message: { id: "smoke", type: "message", role: "assistant", model: body.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }];
      for (const [index, block] of blocks.entries()) {
        events.push({ type: "content_block_start", index, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } });
        events.push({ type: "content_block_delta", index, delta: block.type === "text" ? { type: "text_delta", text: block.text }
          : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
        events.push({ type: "content_block_stop", index });
      }
      events.push({ type: "message_delta", delta: { stop_reason: blocks.some(block => block.type === "tool_use") ? "tool_use" : "end_turn", stop_sequence: null },
        usage: { output_tokens: 5 } }, { type: "message_stop" });
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src/cli.ts"), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive", "--auto-memory"], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "local-smoke-key",
      LLM_MODEL: "smoke/memory", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" },
  });
  let stdout = "", stderr = "", waiter;
  const update = () => waiter?.();
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64_000); update(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64_000); update(); });
  const exited = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  const wait = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiter = undefined; reject(new Error(`CLI wait expired: ${stderr}`)); }, 10_000);
    waiter = () => { if (predicate()) { clearTimeout(timer); waiter = undefined; resolve(); } }; waiter();
  });
  const command = async (text, marker, stream = "stderr") => {
    const offset = (stream === "stdout" ? stdout : stderr).length;
    child.stdin.write(text + "\n");
    await wait(() => (stream === "stdout" ? stdout : stderr).slice(offset).includes(marker));
  };
  await wait(() => stderr.includes("Personal harness."));
  await command("remember preference", "finished: end_turn");
  assert.match(requests[0].system, /Automatic memory is enabled/);
  assert.match(fs.readFileSync(path.join(workspace, ".harness/memory/validation.md"), "utf8"), /actual CLI usage/);
  await command("recall preference", "finished: end_turn");
  assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /actual CLI usage/);
  const memoryPath = path.join(workspace, ".harness/memory/validation.md");
  const originalMemory = fs.readFileSync(memoryPath, "utf8");
  fs.writeFileSync(memoryPath, "Changed preference marker B");
  await command("recall changed preference", "finished: end_turn");
  assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /Changed preference marker B/);
  fs.writeFileSync(memoryPath, originalMemory);
  await command("recall restored preference", "finished: end_turn");
  assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /actual CLI usage/);
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "RELOADED_INSTRUCTION");
  fs.mkdirSync(path.join(workspace, ".harness/skills/reloaded"), { recursive: true });
  fs.writeFileSync(path.join(workspace, ".harness/skills/reloaded/SKILL.md"), "---\nname: reloaded\ndescription: Loaded by reload\n---\nReloaded skill");
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { media: false } }));
  await command("/reload", "Local configuration reloaded");
  await command("/skills", "reloaded", "stdout");
  await command("write nested file", "finished: end_turn");
  assert.ok(retry); assert.equal(fs.readFileSync(path.join(workspace, "src/result.txt"), "utf8"), "concise result");
  const final = requests.at(-1); assert.match(final.system, /RELOADED_INSTRUCTION/);
  assert.equal(final.system.includes("INITIAL_INSTRUCTION"), false);
  assert.equal(final.tools.some(tool => tool.name === "read_media"), false);
  assert.equal(final.model, "smoke/memory");
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), "{");
  await command("/reload", "error:");
  await command("still usable after invalid reload", "finished: end_turn");
  child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", memoryWrite: true, nextTurnMemory: true, reloadInstructions: true,
    memoryCycleRefresh: true,
    reloadSkills: true, reloadToolPool: true, nestedPreWriteInstructions: true, failedReloadPreservesRuntime: true,
    gateway: "owned loopback SSE", requests: requests.length }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
