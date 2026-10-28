import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "managed-instructions-cli-")));
const managed = path.join(workspace, "managed"), user = path.join(workspace, "user");
const requests = [];
const compiled = process.argv.includes("--compiled");
let child, server;
const git = args => {
  const result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const commit = message => git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", message, "--no-gpg-sign"]);

try {
  for (const directory of [user, managed, path.join(managed, ".harness/rules"), path.join(workspace, ".harness/agents"), path.join(workspace, "src")]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(path.join(managed, "managed-settings.json"),
    JSON.stringify({ allowShell: false, claudeMd: "MANAGED_SETTINGS_TEXT" }));
  fs.writeFileSync(path.join(managed, "HARNESS.md"), "MANAGED_FILE_TEXT\n");
  fs.writeFileSync(path.join(managed, ".harness/rules/managed.md"), "MANAGED_RULE_TEXT\n");
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "PARENT_WORKING_TREE_VARIANT\n");
  fs.writeFileSync(path.join(workspace, "src/AGENTS.md"), "NESTED_INSTRUCTION_TEXT\n");
  fs.writeFileSync(path.join(workspace, "src/fixture.txt"), "FIXTURE\n");
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { agentTypes: true } }));
  fs.writeFileSync(path.join(workspace, ".harness/agents/iso.md"),
    "---\nname: iso\ndescription: isolated fixture\nmode: explore\ntools: [read_file]\nmaxTurns: 2\nisolation: worktree\n---\nISO_AGENT_BODY\n");
  fs.writeFileSync(path.join(workspace, ".harness/agents/no-md.md"),
    "---\nname: no-md\ndescription: managed-only fixture\nmode: explore\ntools: [read_file]\nmaxTurns: 2\nomitClaudeMd: true\n---\nNO_MD_AGENT_BODY\n");
  git(["init", "-q", "-b", "main"]);
  git(["add", "-A"]);
  commit("fixture");
  // The checkout reads HEAD, so a committed variant differs from the parent's working tree.
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "CHECKOUT_COMMITTED_VARIANT\n");
  git(["add", "HARNESS.md"]);
  commit("instructions");
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "PARENT_WORKING_TREE_VARIANT\n");

  const isChild = body => String(body.system ?? "").includes("You are a child agent assigned a focused task");
  const parentRequests = () => requests.filter(body => !isChild(body));
  const blocksFor = body => {
    if (isChild(body)) return [{ type: "text", text: "child done" }];
    const index = parentRequests().length - 1;
    if (index === 0) return [{ type: "tool_use", id: "read-nested", name: "read_file", input: { path: "src/fixture.txt" } }];
    if (index === 1) return [{ type: "tool_use", id: "launch-iso", name: "agent", input: { prompt: "ISO_CHILD_TASK", subagent_type: "iso" } }];
    if (index === 2) return [{ type: "tool_use", id: "launch-no-md", name: "agent", input: { prompt: "NO_MD_CHILD_TASK", subagent_type: "no-md" } }];
    return [{ type: "text", text: "parent done" }];
  };
  server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      requests.push(body);
      const blocks = blocksFor(body);
      const events = [{ type: "message_start", message: { id: "fixture", type: "message", role: "assistant", model: body.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }];
      for (const [index, block] of blocks.entries()) {
        events.push({ type: "content_block_start", index, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } });
        events.push({ type: "content_block_delta", index, delta: block.type === "text" ? { type: "text_delta", text: block.text }
          : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
        events.push({ type: "content_block_stop", index });
      }
      events.push({ type: "message_delta", delta: { stop_reason: blocks.some(block => block.type === "tool_use") ? "tool_use" : "end_turn",
        stop_sequence: null }, usage: { output_tokens: 1 } }, { type: "message_stop" });
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-instructions", LLM_MODEL: "fixture/instructions", LLM_AUTH: "bearer",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", user, "--managed-settings", path.join(managed, "managed-settings.json"),
    "--permission-mode", "bypass", "read the fixture, then launch the isolated agent"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });

  const parent = parentRequests(), children = requests.filter(isChild);
  assert.equal(code, 0, stderr);
  assert.equal(parent.length, 4, `parent requests: ${parent.length}`);
  assert.equal(children.length, 2, `child requests: ${children.length}`);

  const first = String(parent[0].system);
  const order = ["MANAGED_FILE_TEXT", "MANAGED_SETTINGS_TEXT", "MANAGED_RULE_TEXT", "PARENT_WORKING_TREE_VARIANT"]
    .map(marker => first.indexOf(marker));
  assert.ok(order.every(position => position >= 0), `managed tier and project text in the first prompt: ${order}`);
  assert.deepEqual([...order].sort((left, right) => left - right), order, `instruction order: ${order}`);
  assert.equal(first.includes("NESTED_INSTRUCTION_TEXT"), false, "a nested file is not in the session prompt before it is touched");

  const nested = JSON.stringify(parent[1].messages);
  assert.ok(nested.includes("NESTED_INSTRUCTION_TEXT"), "the touched directory's instructions reach the next request");

  const isoChild = children.find(body => String(body.system).includes("ISO_AGENT_BODY"));
  assert.ok(isoChild, "the isolated child ran");
  const childSystem = String(isoChild.system);
  assert.ok(childSystem.includes("CHECKOUT_COMMITTED_VARIANT"), "the isolated child reads the checkout's own instructions");
  assert.equal(childSystem.includes("PARENT_WORKING_TREE_VARIANT"), false, "the isolated child does not carry the parent's instruction text");
  assert.ok(childSystem.includes("MANAGED_FILE_TEXT"), "the managed tier reaches the isolated child");
  assert.ok(childSystem.includes("ISO_AGENT_BODY"), "the child's own suffix survives the instruction rewrite");
  assert.ok(/You are a child agent assigned a focused task/.test(childSystem), "the child prompt keeps its suffix");

  const managedChild = children.find(body => String(body.system).includes("NO_MD_AGENT_BODY"));
  assert.ok(managedChild, "the omitClaudeMd child ran");
  const managedSystem = String(managedChild.system);
  assert.ok(managedSystem.includes("MANAGED_FILE_TEXT"), "the omitClaudeMd child keeps the managed file text");
  assert.ok(managedSystem.includes("MANAGED_SETTINGS_TEXT"), "the omitClaudeMd child keeps the managed settings text");
  assert.ok(managedSystem.includes("MANAGED_RULE_TEXT"), "the omitClaudeMd child keeps the managed rule text");
  assert.equal(managedSystem.includes("PARENT_WORKING_TREE_VARIANT"), false, "the omitClaudeMd child drops the project text");
  assert.equal(managedSystem.includes("CHECKOUT_COMMITTED_VARIANT"), false, "the omitClaudeMd child drops the checkout text");
  assert.ok(/You are a child agent assigned a focused task/.test(managedSystem), "the managed-only child keeps its suffix");

  assert.ok(String(parent[3].system).includes("PARENT_WORKING_TREE_VARIANT"), "the parent prompt keeps its own instructions");
  console.log(JSON.stringify({ cli: "passed", managedTierFirst: true, nestedInstructionOnTouch: true, isolatedChildReadsCheckout: true,
    childSuffixPreserved: true, managedOnlyChild: true, parentPromptUnchanged: true, ...(compiled ? { compiledCLI: true } : {}),
    modelCalls: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
