import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TerminalScreen } from "./terminal-screen.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "hook-terminal-cli-")));
const workspace = path.join(temporary, "workspace"), user = path.join(temporary, "user"), drivers = path.join(temporary, "drivers");
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const sequences = ["\x1b]2;HOOK_START\x1b\\", "\x1b]2;HOOK_PROMPT\x1b\\\x07", "\x1b]2;HOOK_END\x1b\\"];
const asyncSequence = "\x1b]2;HOOK_ASYNC\x1b\\";
let server, child, modelCalls = 0;
const requests = [];
const compiled = process.argv.includes("--compiled");
const children = process.argv.includes("--children");
const postCompact = process.argv.includes("--post-compact");
const eventDisplay = process.argv.includes("--event-display");
let eventStage = 0;
const compactSequence = "\x1b]2;HOOK_COMPACT\x1b\\";
let route, parentToolSent = false;
const childSequences = ["\x1b]2;CHILD_START\x1b\\", "\x1b]2;CHILD_ASYNC\x1b\\", "\x1b]2;CHILD_END\x1b\\"];
const mux = process.argv.includes("--tmux") ? "tmux" : process.argv.includes("--screen") ? "screen" : undefined;
const emitted = sequence => mux ? "\x1bP" + (mux === "tmux" ? "tmux;" : "") + sequence.replaceAll("\x1b", "\x1b\x1b") + "\x1b\\" : sequence;
try {
  for (const directory of [workspace, user, drivers, path.join(workspace, ".harness")]) fs.mkdirSync(directory);
  const pty = path.join(drivers, "pty.exp");
  fs.writeFileSync(pty, `set stty_init "rows 40 columns 160"\nsource {${path.join(root, "scripts/pty-cli.exp")}}\n`);
  const driver = path.join(drivers, "hook.mjs");
  fs.writeFileSync(driver, `let input = "";
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input);
const event = payload.hook_event_name;
if (event === "Notification" || event === "TeammateIdle") {
  const mode = process.argv[2];
  process.stdout.write(JSON.stringify({ suppressOutput: mode === "hidden", continue: event !== "TeammateIdle",
    systemMessage: "EVENT_SYSTEM", additionalContext: mode === "bounded" ? "EVENT_CONTEXT\\x1b[2J " + "界".repeat(100) : "EVENT_CONTEXT" })); process.exit(0);
}
if (event === "PostCompact") {
  const mode = process.argv[2];
  if (mode === "raw") { process.stdout.write("  RAW_COMPACT_CONTEXT\\x1b[2J " + "界".repeat(100) + "  "); process.exit(0); }
  process.stdout.write(JSON.stringify({ terminalSequence: "\\x1b]2;HOOK_COMPACT\\x07", suppressOutput: mode === "hidden",
    systemMessage: "COMPACT_SYSTEM", additionalContext: mode === "bounded" ? "COMPACT_CONTEXT\\x1b[2J " + "界".repeat(100) : "COMPACT_CONTEXT" })); process.exit(0);
}
if (${children}) {
  if (event !== "SubagentStart" && event !== "SubagentStop") { process.stdout.write("{}"); process.exit(0); }
  const marker = process.argv[2] === "async" ? "CHILD_ASYNC" : event === "SubagentStart" ? "CHILD_START" : "CHILD_END";
  process.stdout.write(JSON.stringify({ terminalSequence: "\\x1b]2;" + marker + "\\x07", suppressOutput: true })); process.exit(0);
}
if (event === "UserPromptSubmit" && payload.prompt?.startsWith("Async hook completion (data):")) { process.stdout.write("{}"); process.exit(0); }
const mode = process.argv[2];
if (mode === "async") { await new Promise(resolve => setTimeout(resolve, 100)); process.stdout.write(JSON.stringify({ terminalSequence: "\\x1b]2;HOOK_ASYNC\\x07", suppressOutput: true })); process.exit(0); }
const invalid = { csi: "\\x1b[2J", clipboard: "\\x1b]52;c;YQ==\\x07", mixed: "text\\x1b]2;BAD\\x07", long: "\\x1b]2;" + "x".repeat(4097) + "\\x07" };
const value = mode ? invalid[mode] : "\\x1b]2;" + ({ SessionStart: "HOOK_START", UserPromptSubmit: "HOOK_PROMPT", SessionEnd: "HOOK_END" }[event]) + "\\x07" + (event === "UserPromptSubmit" ? "\\x07" : "");
process.stdout.write(JSON.stringify({ terminalSequence: value, suppressOutput: true, systemMessage: "HIDDEN_HOOK_TEXT" }));
`);
  const command = [process.execPath, driver].map(quote).join(" ");
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ hooks: {
    SessionStart: [{ command }, ...["csi", "clipboard", "mixed", "long"].map(mode => ({ command: command + " " + mode })),
      { command: command + " async", async: true }],
    UserPromptSubmit: [{ command }], SessionEnd: [{ command }],
  } }));
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body); modelCalls++;
      const launch = children && ["registry", "legacy"].includes(route) && !parentToolSent && !String(body.system).includes("You are a child agent");
      if (launch) parentToolSent = true;
      const eventTool = eventDisplay && !String(body.system).includes("You are a child agent") && eventStage < 2;
      const block = eventTool ? (eventStage++ === 0
        ? { type: "tool_use", id: "event-launch", name: "agent", input: { prompt: "event child", name: "worker", background: false } }
        : { type: "tool_use", id: "event-follow", name: "send_message", input: { id: "worker", message: "event followup", notify_when_idle: true } })
        : launch ? { type: "tool_use", id: "child-launch", name: "agent", input: { prompt: "child terminal task", mode: "general", ...(route === "registry" ? { background: false } : {}) } }
        : { type: "text", text: "terminal fixture complete" };
      const events = [
        { type: "message_start", message: { id: "fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } },
        { type: "content_block_delta", index: 0, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: launch || eventTool ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env };
  delete env.TMUX; delete env.STY;
  if (mux === "tmux") env.TMUX = "owned-mux-fixture";
  if (mux === "screen") env.STY = "owned-mux-fixture";
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-fixture", LLM_MODEL: "fixture/terminal", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  const run = async (args, tty, task) => {
    const baseline = modelCalls;
    const executable = tty ? "/usr/bin/expect" : process.execPath;
    const cli = [process.execPath, ...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]), "--workspace", workspace,
      ...(args.includes("--resume") ? [] : ["--user-dir", user]), ...args];
    const argv = tty ? [pty, ...cli] : cli.slice(1);
    const journalDirectory = path.join(workspace, ".agent");
    const knownJournals = new Set();
    try {
      for (const file of fs.readdirSync(journalDirectory)) if (file.endsWith(".jsonl")) knownJournals.add(file);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    child = spawn(executable, argv, { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", started = false, finished = false, compactStage = 0;
    const screen = route === "background" ? new TerminalScreen(160, 40) : undefined;
    const outputDecoder = screen ? new TextDecoder() : undefined;
    const backgroundId = () => /"id":"([a-f0-9-]{36})","session_id":"\1"/.exec(screen?.lines().join("\n") ?? "")?.[1];
    // A journal may end in a partially written line while the process is active.
    const newJournals = () => {
      let files;
      try { files = fs.readdirSync(journalDirectory); }
      catch (error) { if (error.code === "ENOENT") return []; throw error; }
      return files.filter(file => file.endsWith(".jsonl") && !knownJournals.has(file)).map(file => {
        const text = fs.readFileSync(path.join(journalDirectory, file), "utf8");
        const boundary = text.lastIndexOf("\n");
        const complete = boundary < 0 ? "" : text.slice(0, boundary);
        return complete ? complete.split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
      }).filter(records => records.length > 0);
    };
    const journalEvents = () => newJournals().flat();
    const parentJournal = () => {
      const id = /session: ([a-f0-9-]{36})/.exec(stdout + stderr)?.[1];
      return newJournals().find(records => records[0].kind === "metadata" && records[0].id === id) ?? [];
    };
    const turnDone = (records, prompt) => {
      const start = records.findLastIndex(event => event.kind === "message" && event.message?.role === "user" && event.message.content === prompt);
      if (start < 0) return false;
      return records.slice(start + 1).find(event => event.kind === "turn_end")?.reason === "end_turn";
    };
    const sessionsIdle = () => {
      const journals = newJournals();
      const parent = parentJournal();
      const children = journals.filter(records => records[0]?.config?.childMode);
      const childId = route === "background" ? backgroundId() : undefined;
      const parentDone = route === "background" ? childId !== undefined : turnDone(parent, "launch child");
      const childPrompt = route === "background" ? "child terminal task\n" : "child terminal task";
      return parent.length > 0 && parentDone && children.length > 0 &&
        children.every(records => (route !== "background" || records[0].id === childId) && turnDone(records, childPrompt));
    };
    const update = () => {
      const all = stdout + stderr;
      if (args.includes("--interactive") && !started && (tty ? all.includes("ready") : all.includes("Personal harness."))) {
        started = true; child.stdin.write((task ?? "/exit") + (tty ? "\r" : "\n"));
      }
      if (eventDisplay && task && args.includes("--interactive")) {
        if (!finished && journalEvents().some(event => event.kind === "hook_result" && event.event === "TeammateIdle")) {
          finished = true; child.stdin.write("/exit\r");
        }
        return;
      }
      if (postCompact && task && args.includes("--interactive")) {
        const events = parentJournal();
        const compact = events.findIndex(event => event.kind === "compact");
        if (compactStage === 0 && turnDone(events, task)) {
          compactStage = 1; child.stdin.write("/compact\r");
        } else if (compactStage === 1 && compact >= 0 && events.slice(compact + 1).some(event => event.kind === "turn_end" && event.reason === "manual_compact")) {
          compactStage = 2; child.stdin.write("after compact\r");
        } else if (compactStage === 2 && turnDone(events, "after compact")) {
          compactStage = 3; child.stdin.write("/exit\r");
        }
        return;
      }
      const childReady = children && all.includes(emitted(childSequences[2])) && all.includes(emitted(childSequences[1])) &&
        (route === "skill"
          ? newJournals().some(records => records[0]?.config?.childMode && turnDone(records, "child terminal task\n"))
          : sessionsIdle());
      if (task && args.includes("--interactive") && !finished && (children ? childReady : (tty ? turnDone(parentJournal(), task) : all.includes("event finished: end_turn")) && all.includes(emitted(asyncSequence)))) {
        finished = true; child.stdin.write("/exit\r");
      }
    };
    child.stdout.on("data", chunk => { stdout += chunk; if (screen) screen.write(outputDecoder.decode(chunk, { stream: true })); update(); });
    child.stderr.on("data", chunk => { stderr += chunk; update(); });
    const poller = setInterval(update, 50);
    const timer = setTimeout(() => child?.kill("SIGKILL"), 15000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); }); }
    finally { clearInterval(poller); clearTimeout(timer); screen?.close(); }
    child = undefined;
    assert.equal(code, 0, stderr || stdout); return { stdout, stderr, calls: modelCalls - baseline };
  };
  if (eventDisplay) {
    for (const mode of ["visible", "hidden", "bounded"]) {
      eventStage = 0;
      fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ maxOutputBytes: mode === "bounded" ? 96 : 24000,
        permissions: { mode: "bypass", allow: [], deny: [] },
        hooks: { Notification: [{ command: command + " " + mode }], TeammateIdle: [{ command: command + " " + mode }] } }));
      const baseline = requests.length;
      const result = await run(["--interactive"], true, "verify event display");
      const output = result.stdout + result.stderr;
      if (mode === "hidden") {
        assert.equal(output.includes("EVENT_SYSTEM"), false);
        assert.equal(output.includes("EVENT_CONTEXT"), false);
      } else {
        assert.ok(output.includes("EVENT_SYSTEM"), `${mode}: missing TeammateIdle system message`);
      }
      const id = /session: ([a-f0-9-]{36})/.exec(output)[1];
      const records = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
      const prompt = records.findIndex(item => item.kind === "message" && item.message?.role === "user" && item.message.content === "verify event display");
      assert.ok(prompt >= 0);
      assert.equal(records.slice(prompt + 1).find(item => item.kind === "turn_end")?.reason, "end_turn");
      const idle = records.find(item => item.kind === "hook_result" && item.event === "TeammateIdle");
      assert.ok(idle); assert.equal(idle.blocked, true);
      assert.deepEqual(idle.systemMessages, ["EVENT_SYSTEM"]);
      assert.ok(idle.additionalContext[0].startsWith("EVENT_CONTEXT"));
      if (mode === "bounded") assert.ok(idle.additionalContext[0].includes("\x1b[2J"));
      assert.equal(idle.suppressOutput, mode === "hidden");
      for (const request of requests.slice(baseline)) {
        assert.equal(JSON.stringify(request.messages).includes("EVENT_CONTEXT"), false);
        assert.equal(JSON.stringify(request.messages).includes("Subscribed local agent became idle"), false);
      }
    }
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", realPTY: true, teammateIdleMessage: true,
      hiddenOutput: true, idleGatePreserved: true, journalPreserved: true, modelHistoryClean: true,
      locksReleased: true, ...(compiled ? { compiledCLI: true } : {}), modelCalls, gateway: "owned loopback SSE" }));
  } else if (postCompact) {
    for (const mode of ["visible", "hidden", "bounded", "raw"]) {
      fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ maxOutputBytes: ["bounded", "raw"].includes(mode) ? 96 : 24000,
        hooks: { PostCompact: [{ command: command + " " + mode }] } }));
      const baseline = requests.length;
      const result = await run(["--interactive"], true, "before compact");
      assert.equal(result.calls, 3);
      const output = result.stdout + result.stderr;
      assert.equal(output.split(emitted(compactSequence)).length - 1, mode === "raw" ? 0 : 1);
      assert.ok(output.includes("PostCompact"), `${mode}: missing PostCompact status`);
      const id = /session: ([a-f0-9-]{36})/.exec(output)[1];
      const records = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
      const post = records.find(event => event.kind === "hook_result" && event.event === "PostCompact");
      assert.ok(post);
      assert.ok(post.userDisplayMessage.includes(mode === "raw" ? "RAW_COMPACT_CONTEXT" : "COMPACT_CONTEXT"));
      assert.deepEqual(post.additionalContext, []);
      assert.deepEqual(post.terminalSequences ?? [], mode === "raw" ? [] : [compactSequence]);
      // `avt` reads only the terminal sequence from a PostCompact JSON body, so a
      // structured suppressOutput is not applied to the display-only record.
      assert.equal(post.suppressOutput, undefined);
      const compact = records.findIndex(event => event.kind === "compact");
      const after = records.findIndex((event, index) => index > compact && event.kind === "message" && event.message?.role === "user" && event.message.content === "after compact");
      assert.ok(compact >= 0 && after > compact);
      assert.ok(records.slice(after + 1).some(event => event.kind === "turn_end" && event.reason === "end_turn"));
      for (const request of requests.slice(baseline)) assert.equal(JSON.stringify(request.messages).includes("COMPACT_CONTEXT"), false);
    }
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", realPTY: true, postCompactRecord: true, postCompactStatus: true,
      journalPreserved: true, terminalSequenceIndependent: true, modelHistoryClean: true, rawPostCompact: true,
      locksReleased: true, ...(compiled ? { compiledCLI: true } : {}), modelCalls, gateway: "owned loopback SSE" }));
  } else if (children) {
    fs.mkdirSync(path.join(workspace, ".harness/skills/childskill"), { recursive: true });
    for (route of ["registry", "legacy", "skill", "background"]) {
      parentToolSent = false;
      fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { agentMessaging: route !== "legacy" },
        permissions: { mode: "bypass", allow: [], deny: [] }, hooks: {
          SubagentStart: [{ command }, { command: command + " async", async: true }], SubagentStop: [{ command }],
        } }));
      fs.writeFileSync(path.join(workspace, ".harness/skills/childskill/SKILL.md"), `---\nname: childskill\ndescription: Fixture child\ncontext: fork\nbackground: ${route === "background"}\n---\nchild terminal task\n`);
      const result = await run(["--interactive"], true, ["skill", "background"].includes(route) ? "/childskill" : "launch child");
      for (const sequence of childSequences) assert.equal(result.stdout.split(emitted(sequence)).length - 1, 1, route);
      assert.equal(result.calls, { registry: 4, legacy: 3, skill: 1, background: 2 }[route], "terminal-only events never create model turns");
    }
    const journals = fs.readdirSync(path.join(workspace, ".agent")).filter(file => file.endsWith(".jsonl"));
    let forwarded = 0, persisted = 0;
    for (const file of journals) {
      const records = fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line));
      if (records[0].config.childMode) persisted += records.filter(event => event.kind === "hook_result").flatMap(event => event.terminalSequences ?? []).length;
      else forwarded += records.filter(event => event.kind === "hook_terminal").flatMap(event => event.sequences).length;
    }
    assert.equal(forwarded, 12); assert.equal(persisted, 12);
    const parentJournal = journals.find(file => !JSON.parse(fs.readFileSync(path.join(workspace, ".agent", file), "utf8").split("\n")[0]).config.childMode);
    const parentId = JSON.parse(fs.readFileSync(path.join(workspace, ".agent", parentJournal), "utf8").split("\n")[0]).id;
    const reopened = await run(["--resume", parentId, "--interactive"], false);
    assert.equal(reopened.stdout.includes("\x1b"), false); assert.equal(reopened.calls, 0);
    route = "legacy"; parentToolSent = false;
    const structured = await run(["--output-format", "json", "launch child"], false);
    assert.doesNotThrow(() => JSON.parse(structured.stdout));
    assert.equal(structured.stdout.includes("\x1b"), false); assert.equal(structured.stderr.includes("\x1b"), false);
    assert.equal(structured.calls, 3);
    for (const request of requests) assert.equal(JSON.stringify(request.messages).includes("CHILD_"), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", realPTY: true, childSyncAsync: true, registry: true, legacy: true, foregroundSkill: true,
      backgroundSkill: true, childAndParentJournals: true, terminalOnlyNoModelTurn: true, modelHistoryClean: true, locksReleased: true,
      pipedResumeSilent: true, headlessChildJson: true,
      ...(compiled ? { compiledCLI: true } : {}), modelCalls, gateway: "owned loopback SSE" }));
  } else {
  const tty = await run(["--interactive"], true, "verify terminal hooks");
  const id = /session: ([a-f0-9-]{36})/.exec(tty.stdout + tty.stderr)[1];
  let previous = -1;
  for (const sequence of sequences) {
    const expected = emitted(sequence);
    const position = tty.stdout.indexOf(expected); assert.ok(position > previous, "terminal sequences preserve event order");
    assert.equal(tty.stdout.indexOf(expected, position + expected.length), -1); previous = position;
  }
  assert.equal(tty.stdout.includes("HIDDEN_HOOK_TEXT"), false);
  assert.equal(tty.stdout.includes("\x1b]52;"), false);
  assert.equal(tty.stdout.split(emitted(asyncSequence)).length - 1, 1);
  const events = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.ok(events.some(event => event.kind === "turn_end" && event.reason === "end_turn"));
  const recorded = events.flatMap(event => event.kind === "hook_terminal" ? event.sequences : event.kind === "hook_result" ? event.terminalSequences ?? [] : []);
  assert.deepEqual(recorded.filter(value => value !== asyncSequence), sequences);
  assert.equal(recorded.filter(value => value === asyncSequence).length, 1);
  assert.ok(events.filter(event => event.kind === "hook_result").every(event => event.suppressOutput === undefined || event.suppressOutput === true));
  const resume = await run(["--resume", events[0].id, "--interactive"], false);
  assert.equal(resume.stdout.includes("\x1b"), false);
  const json = await run(["--output-format", "json", "verify structured output"], false);
  assert.doesNotThrow(() => JSON.parse(json.stdout));
  assert.equal(json.stdout.includes("\x1b"), false); assert.equal(json.stderr.includes("\x1b"), false);
  for (const request of requests) {
    assert.equal(JSON.stringify(request.messages).includes("HOOK_START"), false);
    assert.equal(JSON.stringify(request.messages).includes("HOOK_ASYNC"), false);
  }
  assert.equal(modelCalls, 3);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", realPTY: true, startupPromptExit: true, orderedOnce: true, suppressionIndependent: true,
    invalidSequencesDropped: true, asyncBoundaryDelivery: true, journalReopened: true, pipedSilent: true, jsonParseable: true, modelHistoryClean: true,
    ...(compiled ? { compiledCLI: true } : {}), ...(mux ? { muxEncoding: mux } : {}), locksReleased: true, modelCalls, gateway: "owned loopback SSE" }));
  }
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
