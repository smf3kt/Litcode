import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "managed-cli-")));
const workspace = path.join(temporary, "workspace"), user = path.join(temporary, "user"), policy = path.join(temporary, "policy.json");
const compiled = process.argv.includes("--compiled"), requests = [];
let child, server, stdout = "", stderr = "", wake, ended = false;
const wait = predicate => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { wake = undefined; reject(new Error("CLI wait expired: " + stderr)); }, 10000);
  wake = () => {
    if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); }
    else if (ended) { clearTimeout(timer); wake = undefined; reject(new Error("CLI exited: " + stderr)); }
  };
  wake();
});
const journals = () => fs.readdirSync(path.join(workspace, ".agent")).filter(file => file.endsWith(".jsonl"))
  .map(file => fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line)));
try {
  for (const directory of [workspace, user, path.join(workspace, ".harness")]) fs.mkdirSync(directory);
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ allowShell: true,
    permissions: { mode: "bypass", allow: ["write_file"], deny: [] }, features: { tasks: true, subagents: true } }));
  const initial = { allowShell: false, permissions: { mode: "default", allow: [], deny: ["write_file"] },
    features: { tasks: false, subagents: false }, mcpClient: { roots: false, sampling: false } };
  fs.writeFileSync(policy, JSON.stringify(initial));
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const block = requests.length === 1 ? { type: "tool_use", id: "denied-write", name: "write_file", input: { path: "blocked.txt", content: "blocked" } }
        : { type: "text", text: "managed fixture complete" };
      const events = [
        { type: "message_start", message: { id: "managed", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-managed", LLM_MODEL: "fixture/managed", LLM_AUTH: "bearer",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  const launch = args => {
    stdout = ""; stderr = ""; ended = false;
    child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, ...args], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); wake?.(); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
    return new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => { ended = true; wake?.(); resolve(code); }); });
  };
  let exit = launch(["--user-dir", user, "--managed-settings", policy, "--interactive", "--watch-config", "--allow-shell",
    "--permission-mode", "bypass", "--allow-tool", "write_file", "--tasks", "--subagents", "--mcp-roots", "--mcp-sampling"]);
  await wait(() => stderr.includes("Personal harness."));
  child.stdin.write("/permissions bypass\n/plan\nverify denied write\n");
  await wait(() => stderr.includes("finished: end_turn"));
  assert.equal((stderr.match(/Permission mode is pinned by managed settings/g) ?? []).length, 2);
  assert.equal(fs.existsSync(path.join(workspace, "blocked.txt")), false);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].tools.some(tool => ["agent", "task_create"].includes(tool.name)), false);
  assert.equal(requests[1].messages.at(-1).content[0].is_error, true);
  const first = journals()[0][0];
  assert.deepEqual(first.config.managedPolicy, initial);
  assert.equal(first.config.allowShell, false); assert.equal(first.config.mcpClient.roots, false);
  let offset = stderr.length;
  fs.writeFileSync(policy, "{");
  await wait(() => stderr.slice(offset).includes("error:"));
  assert.equal(journals().length, 1);
  offset = stderr.length;
  const updated = { ...initial, features: { tasks: true, subagents: false }, permissions: { mode: "default", allow: [], deny: ["write_file", "bash"] } };
  fs.writeFileSync(policy, JSON.stringify(updated));
  await wait(() => stderr.slice(offset).includes("Local configuration reloaded"));
  offset = stderr.length; child.stdin.write("verify updated policy\n");
  await wait(() => stderr.slice(offset).includes("finished: end_turn"));
  assert.ok(requests.at(-1).tools.some(tool => tool.name === "task_create"));
  const last = journals().find(records => records[0].config.managedPolicy.permissions.deny.includes("bash"))[0];
  child.stdin.end("/exit\n"); assert.equal(await exit, 0); child = undefined;
  fs.unlinkSync(policy);
  exit = launch(["--resume", last.id, "--interactive"]);
  await wait(() => stderr.includes("Personal harness."));
  child.stdin.end("/permissions bypass\n/exit\n"); assert.equal(await exit, 0); child = undefined;
  assert.match(stderr, /Permission mode is pinned by managed settings/);
  assert.equal(requests.length, 3);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", managedOverrides: true, deniedEffect: true, permissionCommandsPinned: true,
    watchedExternalPolicy: true, invalidReloadRetained: true, pinnedResumeWithoutFile: true, locksReleased: true,
    ...(compiled ? { compiledCLI: true } : {}), modelCalls: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
