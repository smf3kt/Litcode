import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const cli = compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-cli-")));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [];
let child, server, deferred;
let stdout = "", stderr = "", wake;
let ended = false;
const changed = () => wake?.();
const wait = predicate => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { wake = undefined; reject(new Error(`CLI wait expired: ${stderr}`)); }, 10000);
  wake = () => {
    if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); }
    else if (ended) { clearTimeout(timer); wake = undefined; reject(new Error(`CLI exited early: ${stderr}`)); }
  };
  wake();
});
const reply = (res, body) => {
  const last = body.messages.at(-1).content;
  const launch = last === "discover child instructions" || last === "discover empty child directory";
  const read = last === "discover dynamic instructions" || last === "CHILD_WATCH_READ" || last === "CHILD_EMPTY_READ";
  const tool = launch || read;
  const block = launch ? { type: "tool_use", id: `child-launch-${requests.length}`, name: "agent", input: { prompt: last === "discover empty child directory" ? "CHILD_EMPTY_READ" : "CHILD_WATCH_READ", subagent_type: "explore", background: false } }
    : read ? { type: "tool_use", id: `deep-read-${requests.length}`, name: "read_file", input: { path: last === "CHILD_EMPTY_READ" ? "empty/deep/file.txt" : last === "CHILD_WATCH_READ" ? "child/deep/file.txt" : "src/deep/file.txt" } } : { type: "text", text: "done" };
  const events = [
    { type: "message_start", message: { id: "watch-smoke", type: "message", role: "assistant", model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: tool ? { ...block, input: {} } : { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: tool ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) } : { type: "text_delta", text: "done" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: tool ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ];
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
};
try {
  fs.mkdirSync(path.join(workspace, "user"));
  fs.mkdirSync(path.join(workspace, ".harness"));
  const instruction = path.join(workspace, "HARNESS.md");
  const settings = path.join(workspace, ".harness/settings.json");
  const imported = path.join(workspace, "docs/context.md");
  fs.mkdirSync(path.dirname(imported));
  fs.writeFileSync(imported, "IMPORTED_INITIAL");
  fs.writeFileSync(instruction, "WATCH_INITIAL");
  server = http.createServer((req, res) => {
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      if (requests.length === 1) deferred = () => reply(res, body); else reply(res, body);
      changed();
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  child = spawn(process.execPath, [...cli, "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive", "--watch-config"], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-smoke-key",
      LLM_MODEL: "smoke/watch", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
      LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" },
  });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); changed(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); changed(); });
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject); child.on("close", code => { ended = true; changed(); resolve(code); });
  });
  await wait(() => stderr.includes("Personal harness."));
  await delay(100);
  child.stdin.write("/rename watch retained title\n");
  await wait(() => stderr.includes("Session title: watch retained title"));
  child.stdin.write("hold first task\n");
  await wait(() => deferred);
  assert.match(requests[0].system, /WATCH_INITIAL/);
  const before = stderr.length;
  fs.writeFileSync(instruction, "WATCH_UPDATED\n@docs/context.md\n");
  await delay(650);
  assert.equal(stderr.slice(before).includes("Local configuration reloaded"), false);
  deferred(); deferred = undefined;
  await wait(() => stderr.slice(before).includes("Local configuration reloaded"));
  await delay(100);
  const task = async prompt => {
    const offset = stderr.length;
    child.stdin.write(prompt + "\n");
    await wait(() => stderr.slice(offset).includes("finished: end_turn"));
  };
  await task("use changed configuration");
  assert.match(requests.at(-1).system, /WATCH_UPDATED/);
  assert.equal(requests.at(-1).system.includes("WATCH_INITIAL"), false);
  assert.match(requests.at(-1).system, /IMPORTED_INITIAL/);
  const importOffset = stderr.length;
  fs.writeFileSync(imported, "IMPORTED_UPDATED");
  await wait(() => stderr.slice(importOffset).includes("Local configuration reloaded"));
  await delay(100);
  await task("use changed imported instructions");
  assert.match(requests.at(-1).system, /IMPORTED_UPDATED/);
  const nestedOffset = stderr.length;
  const nestedRule = path.join(workspace, ".harness/rules/nested/rule.md");
  fs.mkdirSync(path.dirname(nestedRule), { recursive: true });
  fs.writeFileSync(nestedRule, "NESTED_RULE_INITIAL");
  await wait(() => stderr.slice(nestedOffset).includes("Local configuration reloaded"));
  await new Promise(resolve => setTimeout(resolve, 150));
  const changedRuleOffset = stderr.length;
  fs.writeFileSync(nestedRule, "NESTED_RULE_UPDATED");
  await wait(() => stderr.slice(changedRuleOffset).includes("Local configuration reloaded"));
  await delay(100);
  await task("use nested rule update");
  assert.match(requests.at(-1).system, /NESTED_RULE_UPDATED/);
  const modelOffset = stderr.length;
  child.stdin.write("/model smoke/changed\n");
  await wait(() => stderr.slice(modelOffset).includes("session:"));
  await delay(100);
  await task("use changed model");
  assert.equal(requests.at(-1).model, "smoke/changed");
  const invalidOffset = stderr.length;
  fs.writeFileSync(settings, "{");
  await wait(() => stderr.slice(invalidOffset).includes("error:"));
  await delay(650);
  assert.equal((stderr.slice(invalidOffset).match(/error:/g) ?? []).length, 1);
  await task("usable after invalid configuration");
  assert.match(requests.at(-1).system, /WATCH_UPDATED/);
  const fixedOffset = stderr.length;
  fs.writeFileSync(settings, JSON.stringify({ features: { media: false } }));
  await wait(() => stderr.slice(fixedOffset).includes("Local configuration reloaded"));
  await delay(100);
  await task("use reloaded tool catalog");
  assert.equal(requests.at(-1).tools.some(tool => tool.name === "read_media"), false);
  const deep = path.join(workspace, "src/deep"); fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(deep, "file.txt"), "owned deep file");
  fs.writeFileSync(path.join(deep, "AGENTS.md"), "@detail.md\nDEEP_INITIAL");
  fs.writeFileSync(path.join(deep, "detail.md"), "DYNAMIC_IMPORT_INITIAL");
  await task("discover dynamic instructions");
  assert.match(JSON.stringify(requests.at(-1).messages), /DYNAMIC_IMPORT_INITIAL/);
  const dynamicOffset = stderr.length;
  fs.writeFileSync(path.join(deep, "detail.md"), "DYNAMIC_IMPORT_UPDATED");
  await wait(() => stderr.slice(dynamicOffset).includes("Local configuration reloaded"));
  await delay(100);
  await task("discover dynamic instructions");
  assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /DYNAMIC_IMPORT_UPDATED/);
  const childDeep = path.join(workspace, "child/deep"); fs.mkdirSync(childDeep, { recursive: true });
  fs.writeFileSync(path.join(childDeep, "file.txt"), "owned child file");
  fs.writeFileSync(path.join(childDeep, "AGENTS.md"), "@detail.md\nCHILD_DEEP");
  fs.writeFileSync(path.join(childDeep, "detail.md"), "CHILD_IMPORT_INITIAL");
  await task("discover child instructions");
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes("CHILD_IMPORT_INITIAL")));
  await delay(150);
  const childOffset = stderr.length;
  fs.writeFileSync(path.join(childDeep, "detail.md"), "CHILD_IMPORT_UPDATED");
  await wait(() => stderr.slice(childOffset).includes("Local configuration reloaded"));
  await delay(100);
  await task("discover child instructions");
  assert.ok(requests.slice(-4).some(request => JSON.stringify(request.messages).includes("CHILD_IMPORT_UPDATED")));
  const ignoredOffset = stderr.length;
  fs.mkdirSync(path.join(workspace, ".harness/memory"), { recursive: true });
  fs.writeFileSync(path.join(workspace, ".harness/memory/owned.md"), "memory write");
  await delay(650);
  assert.equal(stderr.slice(ignoredOffset).includes("Local configuration reloaded"), false);
  assert.equal((stderr.match(/Local configuration reloaded/g) ?? []).length, 7);
  child.stdin.end("/exit\n");
  assert.equal(await exited, 0); child = undefined;
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  const journals = fs.readdirSync(path.join(workspace, ".agent")).filter(name => name.endsWith(".jsonl"));
  assert.ok(journals.length >= 4);
  for (const journal of journals) {
    const records = fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse);
    if (!records[0].config.childMode) assert.equal(records.findLast(record => record.kind === "title")?.title, "watch retained title");
  }
  const parents = journals.flatMap(journal => fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").trim().split("\n").map(JSON.parse)
    .filter(record => record.kind === "branch"));
  assert.ok(parents.some(record => record.reason === "reload"));
  assert.ok(parents.some(record => record.reason === "configuration"));
  for (const parent of parents) assert.ok(fs.existsSync(path.join(workspace, ".agent", `${parent.source}.jsonl`)));
  const persisted = journals.map(file => ({ file, records: fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(JSON.parse) }));
  const resumedId = persisted.find(item => !item.records[0].config.childMode && item.records.some(event => event.kind === "instruction_watch" && event.paths.includes(path.join(childDeep, "detail.md"))))?.records[0].id;
  assert.ok(resumedId);
  ended = false; stdout = ""; stderr = "";
  child = spawn(process.execPath, [...cli, "--workspace", workspace, "--resume", resumedId, "--interactive"], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-smoke-key", LLM_MODEL: "smoke/watch",
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" }
  });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64000); changed(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); changed(); });
  const resumedExit = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => { ended = true; changed(); resolve(code); }); });
  await wait(() => stderr.includes("Personal harness.")); await delay(100);
  const resumeOffset = stderr.length;
  fs.writeFileSync(path.join(childDeep, "detail.md"), "CHILD_IMPORT_AFTER_RESTART");
  await wait(() => stderr.slice(resumeOffset).includes("Local configuration reloaded"));
  await task("discover child instructions");
  assert.ok(requests.slice(-4).some(request => JSON.stringify(request.messages).includes("CHILD_IMPORT_AFTER_RESTART")));
  await delay(100);
  const createdOffset = stderr.length;
  fs.writeFileSync(path.join(childDeep, "HARNESS.md"), "CHILD_NEW_INSTRUCTIONS");
  await wait(() => stderr.slice(createdOffset).includes("Local configuration reloaded"));
  await task("discover child instructions");
  assert.ok(requests.slice(-4).some(request => JSON.stringify(request.messages).includes("CHILD_NEW_INSTRUCTIONS")));
  const emptyDeep = path.join(workspace, "empty/deep"); fs.mkdirSync(emptyDeep, { recursive: true });
  fs.writeFileSync(path.join(emptyDeep, "file.txt"), "empty instruction fixture");
  await task("discover empty child directory"); await delay(100);
  const emptyOffset = stderr.length;
  fs.writeFileSync(path.join(emptyDeep, "AGENTS.md"), "FIRST_CREATED_INSTRUCTIONS");
  await wait(() => stderr.slice(emptyOffset).includes("Local configuration reloaded"));
  await task("discover empty child directory");
  assert.ok(requests.slice(-4).some(request => JSON.stringify(request.messages).includes("FIRST_CREATED_INSTRUCTIONS")));
  child.stdin.end("/exit\n"); assert.equal(await resumedExit, 0); child = undefined;
  let ttyKeys = false;
  if (process.platform === "darwin") {
    ended = false; stderr = ""; stdout = "";
    child = spawn("/usr/bin/expect", [path.join(root, "scripts/pty-cli.exp"), process.execPath, ...cli,
      "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "--interactive", "--watch-config"], {
      cwd: root, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "owned-smoke-key",
        LLM_MODEL: "smoke/watch", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
        LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false", TERM: "xterm-256color" },
    });
    child.stdout.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); changed(); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); changed(); });
    const ttyExit = new Promise((resolve, reject) => {
      child.on("error", reject); child.on("close", code => { ended = true; changed(); resolve(code); });
    });
    await wait(() => stderr.includes("Personal harness."));
    await delay(150);
    child.stdin.write("preserved");
    const keysOffset = stderr.length;
    const keys = path.join(workspace, ".harness/keybindings.json");
    fs.writeFileSync(keys, JSON.stringify({ "\u0014": "submit", "\r": "newline" }));
    await wait(() => stderr.slice(keysOffset).includes("Local configuration reloaded"));
    child.stdin.write("\rnext\u0014");
    await wait(() => stderr.slice(keysOffset).includes("finished: end_turn"));
    const content = requests.at(-1).messages.at(-1).content;
    assert.equal(typeof content === "string" ? content : content.find(block => block.type === "text")?.text, "preserved\nnext");
    const badKeysOffset = stderr.length;
    fs.writeFileSync(keys, JSON.stringify({ "\u0014": "bad-command" }));
    await wait(() => stderr.slice(badKeysOffset).includes("error:"));
    child.stdin.write("old keys remain\u0014");
    await wait(() => stderr.slice(badKeysOffset).includes("finished: end_turn"));
    const forkOffset = stderr.length;
    child.stdin.write("/fork\u0014");
    await wait(() => stderr.slice(forkOffset).includes("session:"));
    const rewindOffset = stderr.length;
    child.stdin.write("/rewind 0\u0014");
    await wait(() => stderr.slice(rewindOffset).includes("session:"));
    const listingOffset = stderr.length;
    child.stdin.write("/sessions\u0014");
    await wait(() => stderr.slice(listingOffset).includes('"parent"'));
    const resumeOffset = stderr.length;
    child.stdin.write("/resume\u0014");
    await wait(() => stderr.slice(resumeOffset).includes("Choose a number, or :cancel"));
    child.stdin.write("1\u0014");
    await wait(() => stderr.slice(resumeOffset).includes("Session resumed."));
    const cancelOffset = stderr.length;
    child.stdin.write("/resume\u0014");
    await wait(() => stderr.slice(cancelOffset).includes("Choose a number, or :cancel"));
    child.stdin.write(":cancel\u0014");
    await wait(() => stderr.slice(cancelOffset).includes("Session selection cancelled."));
    child.stdin.write("/exit\u0014");
    assert.equal(await ttyExit, 0); child = undefined; ttyKeys = true;
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    const records = fs.readdirSync(path.join(workspace, ".agent")).filter(name => name.endsWith(".jsonl")).flatMap(name =>
      fs.readFileSync(path.join(workspace, ".agent", name), "utf8").trim().split("\n").map(JSON.parse));
    assert.ok(records.some(record => record.kind === "branch" && record.reason === "fork"));
    assert.ok(records.some(record => record.kind === "branch" && record.reason === "rewind" && record.boundary === 0));
  }
  console.log(JSON.stringify({ cli: "passed", reloadAfterTurn: true, changedInstructions: true,
    importedInstructions: true, ttyKeybindings: ttyKeys,
    modelSwitch: true, titleInherited: true,
    branchLineage: true,
    nestedRuleDiscovery: true,
    dynamicImportWatch: true, childImportWatch: true, resumedInstructionWatch: true, newInstructionDiscovery: true, emptyDirectoryDiscovery: true, ...(compiled ? { compiledCLI: true } : {}),
    sessionPicker: true, pickerCancellation: true,
    invalidConfigOnce: true, oldRuntimeUsable: true, toolCatalogReloaded: true, memoryIgnored: true,
    locksReleased: true, modelRequests: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
