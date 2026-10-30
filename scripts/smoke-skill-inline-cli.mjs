import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tsImport } from 'tsx/esm/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const quoted = process.argv.includes("--quoted");
const fallback = process.argv.includes("--fallback");
const extended = process.argv.includes("--extended");
const named = process.argv.includes("--named");
const aliases = process.argv.includes("--aliases");
const fenced = process.argv.includes("--fenced");
const sourceArguments = process.argv.includes("--source-arguments");
const hookHome = !quoted && !fallback && !extended && !named && !aliases && !fenced && !sourceArguments;
const launcher = compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "skill-inline-cli-")));
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
  if (hookHome) {
    fs.mkdirSync(path.join(workspace, ".harness/skills/hook-home"));
    fs.writeFileSync(path.join(workspace, ".harness/skills/hook-home/SKILL.md"), `---\nname: hook-home\ndescription: Owned hook environment fixture\ncontext: fork\nhooks:\n  SessionStart:\n    - command: 'printf "%s" "$HOME" > hook-home-result'\n    - command: 'printf "%s" "$HOME" > hook-home-async'\n      async: true\n---\nCheck hook environment.\n`);
  }
  if (fenced) writeSkill("fenced", "before\n```!\nprintf FENCED\n```\nafter");
  const settings = (enabled, extra = {}) => fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { skillInlineCommands: enabled, skillExtendedArguments: false, ...(quoted ? { skillQuotedArguments: true } : {}), ...(fallback ? { skillArgumentFallback: true } : {}), ...(extended ? { skillExtendedArguments: true } : {}) }, ...extra }));
  const run = async (prompt, flags = [], omitHome = false) => {
    const env = { ...process.env, LLM_API_KEY: "owned-inline-fixture", LLM_MODEL: "smoke/inline",
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" };
    if (omitHome) delete env.HOME;
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, ...(flags.includes("--resume") ? [] : ["--user-dir", path.join(workspace, "user")]), ...flags, ...(flags.includes("--interactive") ? [] : [prompt])], {
      cwd: root, stdio: [flags.includes("--interactive") ? "pipe" : "ignore", "pipe", "pipe"], env
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
      const sourceTool = body.messages.at(-1).content === 'load source skill';
      const preloadTool = body.messages.at(-1).content === 'launch source preload';
      const useTool = preloadTool || sourceTool || body.messages.at(-1).content === "load inline skill";
      const block = preloadTool ? { type: 'tool_use', id: 'preload-tool', name: 'agent',
        input: { prompt: 'source preload child', subagent_type: 'preload:source-helper' } }
        : useTool ? { type: "tool_use", id: "inline-tool", name: "skill", input: sourceTool
          ? { name: 'source-args', args: 'A=1 alpha beta; touch source-model-marker' }
          : { name: "inline", args: "alpha" } } : { type: "text", text: "inline complete" };
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
  let result = await run(quoted ? "/inline \"alpha beta\"" : "/inline alpha");
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
  settings(true, { allowShell: false });
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
  if (hookHome) {
    result = await run("/hook-home", shell);
    assert.equal(result.code, 0, result.errors);
    assert.equal(fs.readFileSync(path.join(workspace, "hook-home-result"), "utf8"), process.env.HOME ?? "");
    assert.equal(fs.readFileSync(path.join(workspace, "hook-home-async"), "utf8"), process.env.HOME ?? "");
  }
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
  if (fenced) {
    settings(true);
    const beforeFenced = requests.length;
    result = await run("/fenced", shell);
    assert.equal(result.code, 0, result.errors);
    assert.ok(messageText().includes("before\nFENCED\nafter"));
    assert.equal(requests.length, beforeFenced + 1);
  }
  const policy = path.join(workspace, "policy.json");
  fs.writeFileSync(policy, JSON.stringify({ features: { skillInlineCommands: false } }));
  result = await run("/inline alpha", [...shell, "--managed-settings", policy]);
  assert.equal(result.code, 0, result.errors);
  assert.ok(messageText().includes("!`printf"));
  assert.equal(requests.length, (fallback ? 9 : 8) + (fenced ? 1 : 0) + (hookHome ? 1 : 0));
  if (sourceArguments) {
    writeSkill('source-args', '$target|$0|$1|$2|RAW=$ARGUMENTS');
    const sourceFile = path.join(workspace, '.harness/skills/source-args/SKILL.md');
    fs.writeFileSync(sourceFile, fs.readFileSync(sourceFile, 'utf8').replace('description: Owned inline fixture', 'description: Owned inline fixture\narguments: target'));
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { skillInlineCommands: true } }));
    const firstSource = await run('/source-args A=1 alpha "beta gamma"; touch source-argument-marker');
    assert.equal(firstSource.code, 0, firstSource.errors);
    assert.ok(messageText().includes('alpha|alpha|beta gamma|$2|RAW=A=1 alpha "beta gamma"; touch source-argument-marker'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-argument-marker')), false);
    const sourceId = /session: ([a-f0-9-]{36})/.exec(firstSource.errors)[1];
    const sourceJournal = path.join(workspace, '.agent', `${sourceId}.jsonl`);
    const sourceMetadata = fs.readFileSync(sourceJournal, 'utf8').split('\n')[0];
    assert.equal(JSON.parse(sourceMetadata).config.features.skillSourceArguments, true);
    settings(false);
    const resumed = await run('/source-args alpha beta # ignored', ['--resume', sourceId]);
    assert.equal(resumed.code, 0, resumed.errors);
    assert.ok(messageText().includes('alpha|alpha|beta|$2|RAW=alpha beta # ignored'));
    assert.equal(fs.readFileSync(sourceJournal, 'utf8').split('\n')[0], sourceMetadata);
    fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ features: { skillSourceArguments: true, skillInlineCommands: true } }));
    const literalSource = await run('/source-args alpha $(touch source-substitution-marker) trailing');
    assert.equal(literalSource.code, 0, literalSource.errors);
    assert.ok(messageText().includes('alpha|alpha|$1|$2|RAW=alpha $(touch source-substitution-marker) trailing'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-substitution-marker')), false);
    const modelSource = await run('load source skill');
    assert.equal(modelSource.code, 0, modelSource.errors);
    assert.ok(messageText().includes('alpha|alpha|beta|$2|RAW=A=1 alpha beta; touch source-model-marker'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-model-marker')), false);
    const inlineSource = await run('/inline A=1 alpha beta; touch source-inline-marker', shell);
    assert.equal(inlineSource.code, 0, inlineSource.errors);
    assert.ok(messageText().includes('value=alpha missing=$ARGUMENTS[12]'));
    assert.equal(fs.existsSync(path.join(workspace, 'source-inline-marker')), false);
    assert.equal(requests.length, (fallback ? 9 : 8) + (fenced ? 1 : 0) + 6);
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const pluginSource = path.join(workspace, 'preload-source');
    fs.mkdirSync(path.join(pluginSource, 'skills/source-preload'), { recursive: true });
    fs.mkdirSync(path.join(pluginSource, 'agents'));
    fs.writeFileSync(path.join(pluginSource, 'plugin.json'), JSON.stringify({ name: 'preload', version: '1', skills: 'skills', agents: 'agents' }));
    fs.writeFileSync(path.join(pluginSource, 'skills/source-preload/SKILL.md'), '---\nname: source-preload\narguments: target\n---\nNAMED=$target|PRELOAD=$1|$ARGUMENTS|\\$1');
    fs.writeFileSync(path.join(pluginSource, 'agents/source-helper.md'),
      '---\nname: source-helper\ndescription: Owned source preload\nskills: [source-preload]\ntools: [read_file]\n---\nPRELOAD_HELPER');
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: pluginSource }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    for (const sourceMode of [true, false]) {
      for (const messaging of [true, false]) {
        fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ plugins: { enabled: true },
          features: { skillSourceArguments: sourceMode, agentMessaging: messaging, agentTypes: true } }));
        const offset = requests.length;
        const preloadSource = await run('launch source preload');
        assert.equal(preloadSource.code, 0, preloadSource.errors);
        const loaded = requests.slice(offset).find(request => request.system.includes('PRELOAD_HELPER'));
        assert.ok(loaded, JSON.stringify(requests.slice(offset).map(request => ({ system: request.system, messages: request.messages }))));
        assert.ok(JSON.stringify(loaded.messages).includes(sourceMode ? 'NAMED=|PRELOAD=$1||$1' : 'NAMED=$target|PRELOAD=||\\\\'));
        assert.equal(requests.length, offset + 3);
      }
    }
  }
  let customShellHome = false;
  if (hookHome && fs.existsSync('/bin/zsh')) {
    const { createPluginTools } = await tsImport('../src/plugins.ts', import.meta.url);
    const plugin = path.join(workspace, 'shell-home-plugin');
    fs.mkdirSync(path.join(plugin, 'skills/shell-home'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'plugin.json'), JSON.stringify({ name: 'shell-home', version: '1', skills: 'skills' }));
    fs.writeFileSync(path.join(plugin, 'skills/shell-home/SKILL.md'),
      '---\nname: shell-home\ndescription: Owned custom-shell fixture\nshell: /bin/zsh\n---\n!`X=old; X=new export Y; printf "$HOME" > shell-home-marker`');
    const installer = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
    await installer.execute({ directory: plugin }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    settings(true, { plugins: { enabled: true }, permissions: { mode: 'bypass', allow: [], deny: [`Bash(printf ${os.userInfo().homedir})`] } });
    const beforeCustom = requests.length;
    result = await run('/shell-home', shell, true);
    assert.equal(result.code, 2, result.errors);
    assert.match(result.errors, /denied/i);
    assert.equal(fs.existsSync(path.join(workspace, 'shell-home-marker')), false);
    assert.equal(requests.length, beforeCustom);
    customShellHome = true;
  }
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", inlineWithoutMetadata: true, modelSkillCall: true, pinnedResume: true,
    disabledLiteral: true, shellGate: true, wholeGroupPreflight: true, injectedDirectivesLiteral: true, managedOverride: true, interactive: true,
    ...(hookHome ? { skillHookHome: true } : {}), ...(customShellHome ? { customShellHome: true } : {}), locksReleased: true, ...(sourceArguments ? { sourceArguments: true, sourceDefault: true, sourcePinnedResume: true, sourceSubstitutionInert: true } : {}), ...(aliases ? { interactiveAlias: true, visibleAliases: true } : {}), ...(named ? { namedInlineArguments: true } : {}), ...(extended ? { extendedInlineArguments: true } : {}), ...(fallback ? { argumentFallbackOutsideShell: true } : {}), ...(fenced ? { fencedBlock: true } : {}), ...(quoted ? { quotedInlineArguments: true } : {}), ...(compiled ? { compiledCLI: true } : {}), modelRequests: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
