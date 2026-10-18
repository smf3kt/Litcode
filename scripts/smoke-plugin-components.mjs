import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const { createPluginTools, discoverInstalledPluginComponents } = await tsImport("../src/plugins.ts", import.meta.url);
const { loadProjectConfig } = await tsImport("../src/config.ts", import.meta.url);
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "plugin-components-cli-")));
const workspace = path.join(temporary, "workspace");
const source = path.join(temporary, "source");
const drivers = path.join(temporary, "drivers");
const userDir = path.join(temporary, "user");
const marker = path.join(temporary, "effects.jsonl");
let child;
let exited;
const put = (base, relative, value) => {
  const target = path.join(base, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
};
const quote = value => {
  const q = String.fromCharCode(39);
  return q + value.replaceAll(q, q + "\\" + q + q) + q;
};
try {
  for (const directory of [workspace, source, drivers, userDir]) fs.mkdirSync(directory);
  put(drivers, "hook.mjs", `import fs from "node:fs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input);
const transport = process.argv[3];
fs.appendFileSync(process.argv[2], JSON.stringify({ kind: "hook", transport, event: payload.hook_event_name }) + "\\n");
process.stdout.write(JSON.stringify({ systemMessage: "PLUGIN_" + transport.toUpperCase() + "_DISPLAY",
  suppressOutput: transport === "script", hookSpecificOutput: { hookEventName: payload.hook_event_name,
  additionalContext: "PLUGIN_" + transport.toUpperCase() + "_STARTUP_CONTEXT" } }));
`);
  put(drivers, "server.mjs", `import fs from "node:fs";
import readline from "node:readline";
const marker = process.argv[2];
fs.appendFileSync(marker, JSON.stringify({ kind: "mcp-start" }) + "\\n");
const lines = readline.createInterface({ input: process.stdin });
for await (const line of lines) {
  const request = JSON.parse(line);
  fs.appendFileSync(marker, JSON.stringify({ kind: "rpc", method: request.method, params: request.params }) + "\\n");
  if (request.id === undefined) continue;
  const result = request.method === "initialize"
    ? { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }
    : request.method === "tools/list" ? { tools: [{ name: "ping", description: "Local fixture", inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true } }] }
    : { content: [], structuredContent: { continue: true, hookSpecificOutput: {
      hookEventName: "SessionStart", additionalContext: "PLUGIN_MCP_STARTUP_CONTEXT" } } };
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\\n");
}
`);
  put(source, "plugin.json", { name: "fixture", version: "1", skills: "skills", agents: "agents",
    hooks: "hooks/config.json", mcpServers: "mcp/config.json" });
  put(source, "skills/example/SKILL.md", "---\nname: plugin-example\ndescription: Installed plugin CLI skill\n---\nFixture body");
  put(source, "agents/reviewer.md", "---\nname: plugin-reviewer\ndescription: Installed plugin reviewer\n---\nPinned plugin reviewer body");
  const hookCommand = [process.execPath, path.join(drivers, "hook.mjs"), marker].map(quote).join(" ");
  put(source, "hooks/config.json", { hooks: { SessionStart: [
    { command: hookCommand + " command" },
    { command: hookCommand + " script" },
    { type: "mcp_tool", tool: "mcp__fixture_local__ping", arguments: { startup: true } },
  ], SessionEnd: [{ command: hookCommand + " visible" }] } });
  put(source, "mcp/config.json", { mcpServers: { local: { command: process.execPath,
    args: [path.join(drivers, "server.mjs"), marker] } } });
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === "plugin_install");
  const installed = JSON.parse(await install.execute({ directory: source }, context));
  assert.equal(installed.status, "installed");
  assert.deepEqual(discoverInstalledPluginComponents(workspace), []);
  put(workspace, ".harness/settings.json", { plugins: { enabled: true }, features: { mcpDynamic: false, lsp: false } });
  const loaded = loadProjectConfig(workspace, { userDir });
  assert.equal(loaded.agentTypes[0].name, "fixture:plugin-reviewer");
  assert.deepEqual(Object.keys(loaded.settings.mcpServers), ["fixture/local"]);
  assert.equal(fs.existsSync(marker), false, "Install and config discovery must remain inert");

  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  env.LLM_API_KEY = "local-unused-fixture";
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]), "--workspace", workspace,
    "--user-dir", userDir, "--model", "fixture/plugin", "--base-url", "http://127.0.0.1:1", "--interactive", "--watch-config"],
  { cwd: root, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "", waiter;
  const update = () => waiter?.();
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64_000); update(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64_000); update(); });
  exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  const wait = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiter = undefined; reject(new Error(`CLI wait expired: ${stderr}`)); }, 10_000);
    waiter = () => { if (predicate()) { clearTimeout(timer); waiter = undefined; resolve(); } }; waiter();
  });
  await wait(() => stderr.includes("Personal harness."));
  assert.equal(stderr.includes("PLUGIN_SCRIPT_DISPLAY"), false);
  assert.equal(stderr.includes("PLUGIN_COMMAND_DISPLAY"), false);
  const command = async (text, marker, stream = "stdout") => {
    const offset = (stream === "stdout" ? stdout : stderr).length;
    child.stdin.write(text + "\n");
    await wait(() => (stream === "stdout" ? stdout : stderr).slice(offset).includes(marker));
    return (stream === "stdout" ? stdout : stderr).slice(offset);
  };
  child.stdin.write("/skills\n");
  await wait(() => stdout.includes("plugin-example"));
  child.stdin.write("/status\n");
  await wait(() => stdout.includes("\"modelCalls\": 0"));
  const agents = JSON.parse(await command("/agents", "fixture:plugin-reviewer"));
  assert.ok(agents.types.some(type => type.name === "fixture:plugin-reviewer" && type.description === "Installed plugin reviewer"));
  const mcp = JSON.parse(await command("/mcp", "fixture/local"));
  assert.deepEqual(mcp.servers, ["fixture/local"]);
  await command("/rename plugin smoke", "Session title: plugin smoke", "stderr");
  const sessions = JSON.parse(await command("/sessions plugin smoke", "plugin smoke"));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, "plugin smoke");
  assert.equal(sessions[0].active, true);
  const events = fs.readFileSync(marker, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(events.filter(event => event.kind === "hook").map(event => [event.transport, event.event]),
    [["command", "SessionStart"], ["script", "SessionStart"]]);
  assert.ok(events.some(event => event.method === "initialize"));
  assert.ok(events.some(event => event.method === "tools/list"));
  const calls = events.filter(event => event.method === "tools/call");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.name, "ping");
  assert.deepEqual(calls[0].params.arguments, { startup: true });
  assert.equal(typeof calls[0].params._meta?.progressToken, "string");
  const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"));
  const records = fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse);
  const metadata = records[0];
  assert.equal(metadata.config.agentTypes[0].name, "fixture:plugin-reviewer");
  assert.ok(metadata.config.tools.some(tool => tool.name === "mcp__fixture_local__ping"));
  assert.equal(metadata.id, sessions[0].id);
  assert.deepEqual(metadata.config.hooks.SessionStart.map(hook => hook.type ?? "command"), ["command", "command", "mcp_tool"]);
  assert.ok(records.some(record => record.kind === "title" && record.title === "plugin smoke"));
  const startup = records.find(record => record.kind === "hook_result" && record.event === "SessionStart");
  assert.equal(startup.blocked, false);
  assert.deepEqual(startup.additionalContext, ["PLUGIN_COMMAND_STARTUP_CONTEXT", "PLUGIN_SCRIPT_STARTUP_CONTEXT", "PLUGIN_MCP_STARTUP_CONTEXT"]);
  assert.equal(startup.suppressOutput, true);
  assert.deepEqual(startup.systemMessages, ["PLUGIN_COMMAND_DISPLAY", "PLUGIN_SCRIPT_DISPLAY"]);
  assert.equal(records.filter(record => record.kind === "hook_start").length, 1, "MCP hook dispatch must avoid recursive tool hooks");
  const installedSkill = path.join(workspace, ".harness/plugins/fixture/skills/example/SKILL.md");
  const originalSkill = fs.readFileSync(installedSkill);
  const changedOffset = stderr.length;
  fs.writeFileSync(installedSkill, "edited installed bytes");
  await wait(() => stderr.slice(changedOffset).includes("Installed plugin changed"));
  assert.equal(stderr.slice(changedOffset).includes("Local configuration reloaded"), false);
  await command("/skills", "plugin-example");
  const restoredOffset = stderr.length;
  fs.writeFileSync(installedSkill, originalSkill);
  await wait(() => stderr.slice(restoredOffset).includes("Local configuration reloaded"));
  child.stdin.end("/exit\n");
  const code = await Promise.race([exited, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("CLI exit timeout")), 10_000); timer.unref();
  })]);
  assert.equal(code, 0, stderr);
  assert.ok(stderr.includes("PLUGIN_VISIBLE_DISPLAY"));
  child = undefined;
  console.log(JSON.stringify({ install: "passed", discovery: "inert", config: "passed", cli: "passed",
    agentPinned: true, skillListed: true, sessionStartHook: true, stdioMcpHandshake: true,
    secondCommandStartupHook: true, readOnlyMcpStartupHook: true, startupHookContextJournal: true,
    agentsListed: true, mcpListed: true, renamedSessionSearch: true,
    hookDisplaySuppressed: true, hookDisplayJournal: true, sessionEndDisplay: true,
    namespacedTool: true, pluginBytesWatched: true, tamperReloadRetained: true, restoredDigestReloaded: true,
    ...(compiled ? { compiledCLI: true } : {}), modelCalls: 0, networkRequests: 0 }));
} finally {
  if (child) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    await exited?.catch(() => {});
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
