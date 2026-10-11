import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const quoted = process.argv.includes("--quoted");
const fallback = process.argv.includes("--fallback");
const extended = process.argv.includes("--extended");
const named = process.argv.includes("--named");
const aliases = process.argv.includes("--aliases");
const plugins = process.argv.includes("--plugins");
const agentAlias = process.argv.includes("--agent-alias");
const reviewName = aliases ? "fixture:review" : "review";
const reviewInvoke = aliases ? "quick-review" : "review";
const indexedName = aliases ? "fixture:indexed" : "indexed";
const indexedInvoke = aliases ? "quick-indexed" : "indexed";
const argumentHeader = named ? "arguments: [target, target_long]\n" : "";
const launcher = compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
const args = "alpha \"beta gamma\" $1";
const bodyTemplate = named ? "target=$target; longer=$target_long; boundary=$targetSuffix; escaped=\\$target; raw=$ARGUMENTS" : extended ? "zero=$0; one=$1; missing=$12; escaped=\\$ARGUMENTS[0]/\\$1; raw=$ARGUMENTS" : fallback ? "UNUSED_ARGS_BODY missing=$ARGUMENTS[12]" : "first=$ARGUMENTS[0]; second=$ARGUMENTS[1]; missing=$ARGUMENTS[12]; literal=$ARGUMENTS[3]; legacy=$1; raw=$ARGUMENTS";
const expanded = named ? `target=alpha; longer=${quoted ? "beta gamma" : "\"beta"}; boundary=$targetSuffix; escaped=$target; raw=${args}` : extended ? `zero=alpha; one=${quoted ? "beta gamma" : "\"beta"}; missing=$12; escaped=$ARGUMENTS[0]/$1; raw=${args}` : fallback ? `UNUSED_ARGS_BODY missing=$ARGUMENTS[12]\n\n\nARGUMENTS: ${args}` : `first=alpha; second=${quoted ? "beta gamma" : "\"beta"}; missing=$ARGUMENTS[12]; literal=${quoted ? "$ARGUMENTS[3]" : "$1"}; legacy=alpha; raw=${args}`;
const hasExpanded = messages => messages.some(message => typeof message.content === "string" ? message.content.includes(expanded)
  : message.content.some(block => (block.text ?? (typeof block.content === "string" ? block.content : "")).includes(expanded)));
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "skill-agent-cli-")));
const requests = []; let child, server;
try {
  fs.mkdirSync(path.join(workspace, "user"));
  if (quoted || fallback || extended) {
    fs.mkdirSync(path.join(workspace, ".harness"));
    fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { ...(quoted ? { skillQuotedArguments: true } : {}), ...(fallback ? { skillArgumentFallback: true } : {}), ...(extended ? { skillExtendedArguments: true } : {}) } }));
  }
  fs.mkdirSync(path.join(workspace, ".harness/skills/review"), { recursive: true });
  fs.mkdirSync(path.join(workspace, ".harness/agents"));
  fs.writeFileSync(path.join(workspace, ".harness/skills/review/SKILL.md"), `---\nname: ${reviewName}\n${aliases ? "aliases: [quick-review]\n" : ""}description: Fixture review\n${argumentHeader}context: fork\nagent: reviewer\nallowed-tools: [read_file, write_file]\n---\nRead fixture.txt and summarize.\n${bodyTemplate}\n`);
  fs.mkdirSync(path.join(workspace, ".harness/skills/indexed"));
  fs.writeFileSync(path.join(workspace, ".harness/skills/indexed/SKILL.md"), `---\nname: ${indexedName}\n${aliases ? "aliases: [quick-indexed]\n" : ""}description: Fixture indexed arguments\n${argumentHeader}---\n${bodyTemplate}\n`);
  fs.writeFileSync(path.join(workspace, ".harness/agents/reviewer.md"), "---\nname: reviewer\ndescription: Fixture reviewer\nmode: explore\nmodel: smoke/reviewer\neffort: high\ntools: [read_file, write_file]\nmaxTurns: 3\n---\nROUTED_REVIEWER_BODY\n");
  fs.writeFileSync(path.join(workspace, "fixture.txt"), "OWNED_REVIEW_CONTENT");
  if (agentAlias) {
    const skillFile = path.join(workspace, ".harness/skills/review/SKILL.md");
    fs.writeFileSync(skillFile, fs.readFileSync(skillFile, "utf8").replace("agent: reviewer", "agent: quick-reviewer"));
    const agentFile = path.join(workspace, ".harness/agents/reviewer.md");
    fs.writeFileSync(agentFile, fs.readFileSync(agentFile, "utf8").replace("name: reviewer", "name: reviewer\naliases: [quick-reviewer]"));
  }
  if (plugins) {
    const { createPluginTools } = await tsImport("../src/plugins.ts", import.meta.url);
    for (const name of ["fixture", "other"]) {
      const source = path.join(workspace, `${name}-source`);
      fs.mkdirSync(path.join(source, "skills/indexed"), { recursive: true });
      fs.writeFileSync(path.join(source, "plugin.json"), JSON.stringify({ name, version: "1", skills: "skills" }));
      fs.writeFileSync(path.join(source, "skills/indexed/SKILL.md"), `---\nname: indexed\ndescription: ${name} plugin\n---\nPLUGIN_${name} $ARGUMENTS\n`);
      const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === "plugin_install");
      await install.execute({ directory: source }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    }
    fs.mkdirSync(path.join(workspace, ".harness"), { recursive: true });
    fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ plugins: { enabled: true }, features: { pluginSkillNamespaces: true, ...(quoted ? { skillQuotedArguments: true } : {}) } }));
  }
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const block = agentAlias && body.messages.at(-1).content === "launch aliased agent"
        ? { type: "tool_use", id: "alias-agent", name: "agent", input: { prompt: "ALIAS_MODEL_LAUNCH", subagent_type: "quick-reviewer", background: false } }
        : body.messages.at(-1).content === "load indexed skill"
        ? { type: "tool_use", id: "indexed-tool", name: "skill", input: { name: indexedInvoke, args } }
        : requests.length <= 6 && requests.length % 2 === 1 ? { type: "tool_use", id: `read-fixture-${requests.length}`, name: "read_file", input: { path: "fixture.txt" } } : { type: "text", text: "review complete" };
      const events = [
        { type: "message_start", message: { id: "review-model", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), `/${reviewInvoke} ${args}`],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent",
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
  let stdout = "", stderr = ""; child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
  const timer = setTimeout(() => child?.kill("SIGKILL"), 15000);
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  clearTimeout(timer); child = undefined; assert.equal(code, 0, stderr); assert.match(stdout, /review complete/);
  assert.equal(requests.length, 2); assert.equal(requests[0].model, "smoke/reviewer"); assert.equal(requests[0].output_config.effort, "high");
  assert.match(requests[0].system, /ROUTED_REVIEWER_BODY/); assert.deepEqual(requests[0].tools.map(tool => tool.name), ["read_file"]);
  assert.ok(hasExpanded(requests[0].messages));
  assert.match(JSON.stringify(requests[1].messages.at(-1)), /OWNED_REVIEW_CONTENT/);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  const git = args => { const result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(["init", "-q", "-b", "main"]); git(["add", "fixture.txt"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "-m", "Owned fixture", "--no-gpg-sign"]);
  const head = git(["rev-parse", "HEAD"]);
  for (const background of [true, false]) {
    fs.writeFileSync(path.join(workspace, ".harness/skills/review/SKILL.md"), `---\nname: ${reviewName}\n${aliases ? "aliases: [quick-review]\n" : ""}description: Fixture review\n${argumentHeader}context: fork\nagent: reviewer\nbackground: ${background}\nallowed-tools: [read_file, write_file]\n---\nRead fixture.txt and summarize.\n${bodyTemplate}\n`);
    fs.writeFileSync(path.join(workspace, ".harness/agents/reviewer.md"), `---\nname: reviewer\ndescription: Fixture reviewer\nmode: explore\nmodel: smoke/reviewer\neffort: high\ntools: [read_file, write_file]\nmaxTurns: 3\n${background ? "" : "isolation: worktree\n"}---\nROUTED_REVIEWER_BODY\n`);
    if (agentAlias) {
      const skillFile = path.join(workspace, ".harness/skills/review/SKILL.md");
      fs.writeFileSync(skillFile, fs.readFileSync(skillFile, "utf8").replace("agent: reviewer", "agent: quick-reviewer"));
      const agentFile = path.join(workspace, ".harness/agents/reviewer.md");
      fs.writeFileSync(agentFile, fs.readFileSync(agentFile, "utf8").replace("name: reviewer", "name: reviewer\naliases: [quick-reviewer]"));
    }
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), `/${aliases && !background ? reviewName : reviewInvoke} ${args}`],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent",
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
    let output = "", errors = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { errors += chunk; });
    const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const status = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    clearTimeout(deadline); child = undefined; assert.equal(status, 0, errors); assert.match(output, /review complete/);
    const first = requests.at(-2); assert.equal(first.model, "smoke/reviewer"); assert.equal(first.output_config.effort, "high");
    assert.deepEqual(first.tools.map(tool => tool.name), ["read_file"]); assert.match(first.system, /ROUTED_REVIEWER_BODY/);
    assert.ok(hasExpanded(first.messages));
    assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /OWNED_REVIEW_CONTENT/);
  }
  assert.equal(git(["rev-parse", "HEAD"]), head);
  for (const prompt of [`/${indexedName} ${args}`, "load indexed skill"]) {
    const start = requests.length;
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), prompt],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent",
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
    let output = "", errors = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { errors += chunk; });
    const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const status = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    clearTimeout(deadline); child = undefined; assert.equal(status, 0, errors); assert.match(output, /review complete/);
    assert.equal(requests.length - start, prompt.startsWith("/") ? 1 : 2);
    assert.ok(hasExpanded(requests.at(-1).messages));
  }
  assert.equal(requests.length, 9);
  if (agentAlias) {
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "launch aliased agent"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" } });
    let errors = ""; child.stdout.resume(); child.stderr.on("data", chunk => { errors += chunk; });
    const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(deadline); child = undefined; assert.equal(code, 0, errors);
    assert.equal(requests.length, 12);
    assert.equal(requests.at(-2).model, "smoke/reviewer"); assert.match(requests.at(-2).system, /ROUTED_REVIEWER_BODY/);
    assert.ok(requests.at(-2).messages.some(message => message.content === "ALIAS_MODEL_LAUNCH"));
  }
  if (plugins) {
    for (const [prompt, marker] of [["/fixture:indexed plugin-arg", "PLUGIN_fixture plugin-arg"], ["/other:indexed plugin-arg", "PLUGIN_other plugin-arg"]]) {
      child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), prompt],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" } });
      let errors = ""; child.stdout.resume(); child.stderr.on("data", chunk => { errors += chunk; });
      const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
      const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
      clearTimeout(deadline); child = undefined; assert.equal(code, 0, errors);
      assert.ok(requests.at(-1).messages.some(message => typeof message.content === "string" && message.content.includes(marker)));
    }
    assert.equal(requests.length, agentAlias ? 14 : 11);
    fs.rmSync(path.join(workspace, ".harness/skills/indexed"), { recursive: true });
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "/indexed ambiguous"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/parent", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" } });
    let errors = ""; child.stdout.resume(); child.stderr.on("data", chunk => { errors += chunk; });
    const deadline = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(deadline); child = undefined; assert.equal(code, 2, errors);
    assert.match(errors, /Ambiguous skill alias: indexed/); assert.equal(requests.length, agentAlias ? 14 : 11);
  }
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  assert.equal(fs.existsSync(path.join(workspace, ".harness-worktrees")) && fs.readdirSync(path.join(workspace, ".harness-worktrees")).length > 0, false);
  console.log(JSON.stringify({ cli: "passed", agentTypeModel: true, agentBody: true, effort: true, toolIntersection: true, actualRead: true,
    backgroundRouting: true, worktreeRouting: true, worktreeCleanup: true, indexedArguments: true, missingIndexPreserved: true,
    literalArgumentsPreserved: true, modelSkillCall: true, ...(agentAlias ? { agentTypeAliases: true } : {}), ...(plugins ? { installedPluginNamespaces: true, sameNamePluginsRetained: true, projectNameWins: true } : {}), ...(aliases ? { skillAliases: true, namespacedSlash: true } : {}), ...(named ? { namedArguments: true, namedBoundaryPreserved: true } : {}), ...(extended ? { extendedArguments: true, escapedArguments: true } : {}), ...(fallback ? { unusedArgumentFallback: true } : {}), ...(quoted ? { quotedArguments: true } : {}), ...(compiled ? { compiledCLI: true } : {}), modelRequests: requests.length, locksReleased: true, gateway: "owned loopback SSE" }));
} finally { child?.kill("SIGKILL"); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } fs.rmSync(workspace, { recursive: true, force: true }); }
