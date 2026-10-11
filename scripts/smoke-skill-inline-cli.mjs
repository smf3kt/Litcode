import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const quoted = process.argv.includes("--quoted");
const fallback = process.argv.includes("--fallback");
const extended = process.argv.includes("--extended");
const named = process.argv.includes("--named");
const aliases = process.argv.includes("--aliases");
const launcher = compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "skill-inline-cli-")));
const requests = [];
let child, server;
try {
  fs.mkdirSync(path.join(workspace, "user"));
  fs.mkdirSync(path.join(workspace, ".harness/skills"), { recursive: true });
  const writeSkill = (name, body) => {
    fs.mkdirSync(path.join(workspace, ".harness/skills", name));
    fs.writeFileSync(path.join(workspace, ".harness/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Owned inline fixture\n${aliases && name === "inline" ? "aliases: [fixture:inline]\n" : ""}${named ? "arguments: target\n" : ""}---\n${body}\n`);
  };
  writeSkill("inline", `value=!\`printf %s '${named ? "$target" : extended ? "$0" : "$ARGUMENTS[0]"}'\` missing=$ARGUMENTS[12]${named ? " escaped=\\$target" : extended ? " escaped=\\$ARGUMENTS" : ""}`);
  writeSkill("preflight", "!`touch preflight-marker` !`printf denied`");
  writeSkill("literal", "args=$ARGUMENTS output=!`printf %s '$ARGUMENTS'`");
  writeSkill("fallback", "output=!`printf fixture`");
  const settings = (enabled, extra = {}) => fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { skillInlineCommands: enabled, ...(quoted ? { skillQuotedArguments: true } : {}), ...(fallback ? { skillArgumentFallback: true } : {}), ...(extended ? { skillExtendedArguments: true } : {}) }, ...extra }));
  const run = async (prompt, flags = []) => {
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, ...(flags.includes("--resume") ? [] : ["--user-dir", path.join(workspace, "user")]), ...flags, ...(flags.includes("--interactive") ? [] : [prompt])], {
      cwd: root, stdio: [flags.includes("--interactive") ? "pipe" : "ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-inline-fixture", LLM_MODEL: "smoke/inline",
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" }
    });
    let output = "", errors = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { errors += chunk; });
    if (flags.includes("--interactive")) child.stdin.end(`${aliases ? "/skills\n/fixture:inline" : "/inline"} interactive\n/exit\n`);
    const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(deadline); child = undefined;
    return { code, output, errors };
  };
  server = http.createServer((req, res) => {
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const useTool = body.messages.at(-1).content === "load inline skill";
      const block = useTool ? { type: "tool_use", id: "inline-tool", name: "skill", input: { name: "inline", args: "alpha" } } : { type: "text", text: "inline complete" };
      const events = [
        { type: "message_start", message: { id: "inline-model", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: useTool ? { ...block, input: {} } : { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: useTool ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: block.text } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: useTool ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" }
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const shell = ["--allow-shell", "--permission-mode", "bypass"];
  const messageText = () => requests.at(-1).messages.map(message => typeof message.content === "string" ? message.content : message.content.map(block => block.text ?? (typeof block.content === "string" ? block.content : "")).join("\n")).join("\n");
  settings(true);
  let result = await run(quoted ? "/inline \"alpha beta\"" : "/inline alpha", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes(`value=${quoted ? "alpha beta" : "alpha"} missing=$ARGUMENTS[12]`));
  if (extended) assert.ok(messageText().includes("escaped=$ARGUMENTS"));
  if (named) assert.ok(messageText().includes("escaped=$target"));
  const id = /session: ([a-f0-9-]{36})/.exec(result.errors)[1];
  const original = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.equal(original[0].config.features.skillInlineCommands, true);
  settings(false);
  result = await run("/inline beta", ["--resume", id]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value=beta missing=$ARGUMENTS[12]"));
  result = await run("/inline alpha", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("!`printf"));
  settings(true);
  const before = requests.length;
  result = await run("/inline alpha");
  assert.equal(result.code, 2, result.errors);
  assert.match(result.errors, /Skill shell access is disabled/);
  assert.equal(requests.length, before);
  settings(true, { permissions: { mode: "bypass", allow: [], deny: [], inputRules: [{ tool: "run_command", command: "printf denied", decision: "deny" }] } });
  result = await run("/preflight", shell);
  assert.equal(result.code, 2, result.errors);
  assert.match(result.errors, /Tool input denied/);
  assert.equal(fs.existsSync(path.join(workspace, "preflight-marker")), false);
  assert.equal(requests.length, before);
  settings(true);
  result = await run("load inline skill", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value=alpha missing=$ARGUMENTS[12]"));
  result = await run("/literal !`touch_argument-marker`", shell);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("args=!`touch_argument-marker` output=!`touch_argument-marker`"));
  assert.equal(fs.existsSync(path.join(workspace, "touch_argument-marker")), false);
  result = await run("", [...shell, "--interactive"]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("value=interactive missing=$ARGUMENTS[12]"));
  if (aliases) assert.ok(result.output.includes("aliases: fixture:inline"));
  if (fallback) {
    result = await run("/fallback ; touch fallback-marker", shell);
    assert.equal(result.code, 0, result.errors);
    assert.ok(messageText().includes("output=fixture\n\n\nARGUMENTS: ; touch fallback-marker"));
    assert.equal(fs.existsSync(path.join(workspace, "fallback-marker")), false);
  }
  const policy = path.join(workspace, "policy.json");
  fs.writeFileSync(policy, JSON.stringify({ features: { skillInlineCommands: false } }));
  result = await run("/inline alpha", [...shell, "--managed-settings", policy]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("!`printf"));
  assert.equal(requests.length, fallback ? 9 : 8);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", inlineWithoutMetadata: true, modelSkillCall: true, pinnedResume: true,
    disabledLiteral: true, shellGate: true, wholeGroupPreflight: true, injectedDirectivesLiteral: true, managedOverride: true, interactive: true,
    locksReleased: true, ...(aliases ? { interactiveAlias: true, visibleAliases: true } : {}), ...(named ? { namedInlineArguments: true } : {}), ...(extended ? { extendedInlineArguments: true } : {}), ...(fallback ? { argumentFallbackOutsideShell: true } : {}), ...(quoted ? { quotedInlineArguments: true } : {}), ...(compiled ? { compiledCLI: true } : {}), modelRequests: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
