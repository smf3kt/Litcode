import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Two independent CLI processes share a private user directory and one owned
// loopback gateway. A discovers B through the record files, the fixture model
// asks A's real send_peer_message tool to deliver exact text, B holds the
// mode-mismatched message and approves it through /peer-held, and B's next
// request carries the text as peer meta input. No cloud call leaves loopback.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled"), acceptance = process.argv.includes("--acceptance");
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : fs.realpathSync(os.tmpdir());
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(scratch, "peer-cli-smoke-")));
const userDir = path.join(temporary, "user");
const workspaceA = path.join(temporary, "workspace-a");
const workspaceB = path.join(temporary, "workspace-b");
const requests = { a: [], b: [] };
let server, childA, childB;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runtimeRoot = path.join(scratch, `lp-${process.pid}`);
const runtimeDir = () => runtimeRoot;
async function until(check, what, timeoutMs = 20_000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`not reached: ${what}`);
    await sleep(50);
  }
}

function start(label, workspace, mode) {
  const inherited = { ...process.env };
  for (const key of Object.keys(inherited)) if (/^(ANTHROPIC_|LLM_)/.test(key)) delete inherited[key];
  const child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", userDir, "--interactive", "--no-inherit-gateway", "--permission-mode", mode], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"],
    env: { ...inherited, LLM_API_KEY: `owned-peer-${label}`, LLM_MODEL: `fixture/peer-${label}`,
      LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
      LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false", LLM_PROMPT_CACHE: "false",
      LLM_EAGER_TOOL_INPUT: "false", LLM_EFFORT: "medium",
      XDG_CONFIG_HOME: path.join(temporary, `xdg-${label}`), TMPDIR: path.join(temporary, `tmp-${label}`),
      XDG_RUNTIME_DIR: runtimeDir(),
      GIT_CONFIG_GLOBAL: path.join(temporary, `gitconfig-${label}`), GIT_CONFIG_SYSTEM: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
  const state = { child, stdout: "", stderr: "", combined: "", exit: new Promise(resolve => child.once("close", resolve)) };
  const capture = (chunk) => { state.combined = (state.combined + chunk).slice(-80_000); };
  child.stdout.on("data", chunk => { state.stdout = (state.stdout + chunk).slice(-60_000); capture(chunk); });
  child.stderr.on("data", chunk => { state.stderr = (state.stderr + chunk).slice(-60_000); capture(chunk); });
  return state;
}

// The send tool answers with the message id it minted; later turns read that
// id back through peer_message_status, exactly as a real caller would.
function sentMsgId(body) {
  for (const message of [...(body.messages ?? [])].reverse()) {
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block?.type !== "tool_result") continue;
      const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
      const found = /"msg_id":"([^"]+)"/.exec(text);
      if (found) return found[1];
    }
  }
  return undefined;
}

function toolResult(requests, toolUseId) {
  for (const request of [...requests].reverse()) {
    for (const message of [...(request.messages ?? [])].reverse()) {
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block?.type === "tool_result" && block.tool_use_id === toolUseId) return block;
      }
    }
  }
  return undefined;
}

function sse(res, body, blocks) {  const events = [
    { type: "message_start", message: { id: `peer-${Date.now()}`, type: "message", role: "assistant", model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
    ...blocks.flatMap((block, index) => block.type === "tool_use"
      ? [{ type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } },
         { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
         { type: "content_block_stop", index }]
      : [{ type: "content_block_start", index, content_block: { type: "text", text: "" } },
         { type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } },
         { type: "content_block_stop", index }]),
    { type: "message_delta", delta: { stop_reason: blocks.some(block => block.type === "tool_use") ? "tool_use" : "end_turn",
      stop_sequence: null }, usage: { output_tokens: 2 } },
    { type: "message_stop" },
  ];
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
}

try {
  fs.mkdirSync(userDir, { mode: 0o700 }); fs.mkdirSync(workspaceA, { mode: 0o700 }); fs.mkdirSync(workspaceB, { mode: 0o700 });
  for (const label of ["a", "b"]) {
    fs.mkdirSync(path.join(temporary, `xdg-${label}`), { recursive: true });
    fs.mkdirSync(path.join(temporary, `tmp-${label}`), { recursive: true });
    fs.mkdirSync(runtimeDir(), { recursive: true, mode: 0o700 });
  }
  for (const workspace of [workspaceA, workspaceB]) {
    fs.mkdirSync(path.join(workspace, ".harness"), { recursive: true });
    fs.writeFileSync(path.join(workspace, ".harness", "settings.json"),
      JSON.stringify({ features: { crossSessionMessaging: true } }) + "\n", { mode: 0o600 });
  }
  server = http.createServer((req, res) => {
    const label = String(req.headers.authorization ?? "").includes("owned-peer-b") ? "b" : "a";
    const chunks = []; req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests[label].push(body);
      if (label === "a") {
        const pending = body.messages.at(-1);
        const text = typeof pending?.content === "string" ? pending.content : "";
        const match = /^PEER_SEND (\S+) ([\s\S]+)$/.exec(text);
        if (text === "PEER_LIST") {
          sse(res, body, [{ type: "tool_use", id: "peer-list-1", name: "list_peers", input: {} }]); return;
        }
        if (match) {
          sse(res, body, [{ type: "tool_use", id: acceptance ? `peer-send-${requests.a.length}` : "peer-send-1", name: "send_peer_message",
            input: { address: match[1], message: match[2], wait_ms: 0 } }]);
          return;
        }
        const status = /^PEER_STATUS(?: (\S+))?$/.exec(text);
        if (status) {
          sse(res, body, [{ type: "tool_use", id: acceptance ? `peer-status-${requests.a.length}` : "peer-status-1", name: "peer_message_status",
            input: { msg_id: status[1] ?? sentMsgId(body) ?? "", wait_ms: 5000 } }]);
          return;
        }
      }
      sse(res, body, [{ type: "text", text: `ack ${label}` }]);
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

  // B is bypass; A asserts prompting from its default mode, so the gate holds.
  childB = start("b", workspaceB, "bypass");
  await until(() => childB.combined.includes("Personal harness."), "B ready");
  await until(() => childB.combined.includes("Peer inbox: uds:"), "B inbox start");
  childB.child.stdin.write("/peers\n");
  await until(() => /"inbox": "uds:/.test(childB.combined), "B inbox");
  const inboxB = /"inbox": "(uds:[^"]+)"/.exec(childB.combined)[1];

  childA = start("a", workspaceA, "default");
  await until(() => childA.combined.includes("Personal harness."), "A ready");
  childA.child.stdin.write("/peers\n");
  await until(() => childA.combined.includes(inboxB), "A discovers B");

  childA.child.stdin.write(`PEER_SEND ${inboxB} EXACT_PEER_TEXT\n`);
  await until(() => requests.a.length >= 2, "A send tool result");
  await until(() => childB.combined.includes("held for approval"), "B holds the message");
  assert.match(childB.combined, /held for approval: EXACT_PEER_TEXT/);
  childB.child.stdin.write("/peer-held\n");
  await until(() => /1\. uds:\S+ \(mode-mismatch\): EXACT_PEER_TEXT/.test(childB.combined), "held listing");
  childB.child.stdin.write("/peer-held approve 1\n");
  await until(() => childB.combined.includes("Peer held message approve: delivered"), "approval result");
  // The tool call answered "sent" with wait_ms 0; the delivery receipt is read
  // back through peer_message_status on a later turn.
  childA.child.stdin.write("PEER_STATUS\n");
  await until(() => toolResult(requests.a, acceptance ? "peer-status-3" : "peer-status-1") !== undefined, "A status tool result");
  const resultBlock = toolResult(requests.a, acceptance ? "peer-status-3" : "peer-status-1");
  assert.notEqual(resultBlock.is_error, true);
  assert.match(typeof resultBlock.content === "string" ? resultBlock.content : JSON.stringify(resultBlock.content), /"status":"delivered"/);
  await until(() => requests.b.length >= 1, "B event turn");
  const peerMessage = requests.b[0].messages.find(message => message.role === "user"
    && typeof message.content === "string" && message.content.includes("EXACT_PEER_TEXT"));
  assert.ok(peerMessage, "B received the exact text as input");

  if (acceptance) {
    const turns = state => (state.combined.match(/finished: end_turn/g) ?? []).length;
    await until(() => turns(childA) === 2 && childB.combined.includes('event finished: end_turn'), 'initial peer turns settled');
    const command = async (state, text) => {
      const before = turns(state); state.child.stdin.write(text + '\n');
      await until(() => turns(state) === before + 1, 'owned sender turn settled');
    };
    const send = async text => {
      await command(childA, `PEER_SEND ${inboxB} ${text}`);
      return sentMsgId(requests.a.at(-1));
    };
    const status = async (id, expected) => {
      await command(childA, `PEER_STATUS ${id}`);
      const content = requests.a.at(-1)?.messages.at(-1)?.content;
      const result = Array.isArray(content) ? content.find(block => block.type === 'tool_result') : undefined;
      assert.ok(result); assert.notEqual(result.is_error, true);
      assert.equal(JSON.parse(result.content).status, expected);
    };
    await command(childA, 'PEER_LIST');
    const listed = toolResult(requests.a, 'peer-list-1'); assert.ok(listed); assert.notEqual(listed.is_error, true);
    assert.ok(JSON.parse(listed.content).peers.some(peer => peer.address === inboxB && peer.pid === childB.child.pid));
    const beforeB = requests.b.length;
    for (const decision of ['deny', 'expire']) {
      const text = `HELD_${decision.toUpperCase()}`, id = await send(text); assert.ok(id);
      await until(() => childB.combined.includes(`held for approval: ${text}`), 'next held message');
      childB.child.stdin.write(`/peer-held ${decision} 1\n`);
      await until(() => childB.combined.includes(`Peer held message ${decision}: dropped`), 'held decision');
      await status(id, decision === 'deny' ? 'denied' : 'expired');
      assert.equal(requests.b.length, beforeB);
    }
    childB.child.stdin.write('/peer-inbound refuse\n');
    await until(() => childB.combined.includes('Peer inbound policy: refuse'), 'refuse policy');
    await status(await send('REFUSED_TEXT'), 'refused'); assert.equal(requests.b.length, beforeB);
    childB.child.stdin.write('/peer-inbound hold\n');
    await until(() => childB.combined.includes('Peer inbound policy: hold'), 'hold policy');
    const originId = await send('/exit'); assert.ok(originId);
    await until(() => childB.combined.includes('held for approval: /exit'), 'literal slash input held');
    childB.child.stdin.write('/peer-held approve 1\n');
    await until(() => requests.b.length === beforeB + 1 && childB.child.exitCode === null, 'peer slash input stays data');
    await status(originId, 'delivered');
    const lastB = requests.b.at(-1);
    assert.ok(lastB.messages.some(message => message.role === 'user' && message.content === '/exit'));
    const directory = path.join(workspaceB, '.agent');
    const records = fs.readdirSync(directory).filter(name => name.endsWith('.jsonl'))
      .flatMap(name => fs.readFileSync(path.join(directory, name), 'utf8').trim().split('\n').map(JSON.parse));
    const peerEvent = records.find(row => row.kind === 'message' && row.message.role === 'user' && row.message.content === '/exit');
    assert.ok(peerEvent); assert.deepEqual(peerEvent.classifier?.origin, { kind: 'peer', source: 'uds' });
    const pendingId = await send('EXPIRE_ON_EXIT'); assert.ok(pendingId);
    await until(() => childB.combined.includes('held for approval: EXPIRE_ON_EXIT'), 'held at exit');
    childB.child.stdin.write('/exit\n'); assert.equal(await childB.exit, 0);
    await status(pendingId, 'expired');
    await command(childA, 'PEER_LIST');
    const content = requests.a.at(-1)?.messages.at(-1)?.content;
    const result = content.find(block => block.type === 'tool_result'); assert.ok(result);
    assert.deepEqual(JSON.parse(result.content).peers, []);
    assert.equal(fs.existsSync(inboxB.slice(4)), false);
  }
  childA.child.stdin.write("/exit\n");
  if (!acceptance) childB.child.stdin.write("/exit\n");
  const codes = await Promise.all([childA.exit, childB.exit]);
  assert.deepEqual(codes, [0, 0]);
  for (const state of [childA, childB]) assert.throws(() => process.kill(state.child.pid, 0), error => error.code === 'ESRCH');
  for (const workspace of [workspaceA, workspaceB]) assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  for (const label of ['a', 'b']) assert.deepEqual(fs.readdirSync(path.join(runtimeDir(), 'litcode-socks')), []);
  const sessions = path.join(userDir, "sessions");
  assert.deepEqual(fs.existsSync(sessions) ? fs.readdirSync(sessions).filter(name => /\.(?:json|key)$/.test(name)) : [], []);
  console.log(JSON.stringify({ cli: "passed", processes: 2, inboxB, aRequests: requests.a.length, bRequests: requests.b.length,
    held: "mode-mismatch", receipt: "delivered", ownedCleanup: true,
    ...(compiled ? { compiledCLI: true } : {}), acceptance, heldDecisions: acceptance ? ['approve', 'deny', 'expire', 'refuse', 'exit-expiry'] : ['approve'],
    peerOrigin: acceptance, gateway: "owned loopback SSE", externalCalls: 0 }));
} catch (error) {
  console.error("A:", childA?.combined?.slice(-4000));
  console.error("B:", childB?.combined?.slice(-4000));
  throw error;
} finally {
  for (const state of [childA, childB]) if (state && state.child.exitCode === null && state.child.signalCode === null) state.child.kill("SIGKILL");
  await Promise.all([childA, childB].filter(Boolean).map(state => state.exit));
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
