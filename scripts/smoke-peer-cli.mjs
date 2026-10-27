import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// Two independent CLI processes share a private user directory and one owned
// loopback gateway. A discovers B through the record files, the fixture model
// asks A's real send_peer_message tool to deliver exact text, B holds the
// mode-mismatched message and approves it through /peer-held, and B's next
// request carries the text as peer meta input. No cloud call leaves loopback.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled"), guard = process.argv.includes("--guard"), files = process.argv.includes("--files"), idle = process.argv.includes("--idle"), envelope = process.argv.includes("--envelope") || files || idle;
const acceptance = process.argv.includes("--acceptance") || guard;
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : fs.realpathSync(os.tmpdir());
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(scratch, "peer-cli-smoke-")));
const userDir = path.join(temporary, "user");
const workspaceA = path.join(temporary, "workspace-a");
const workspaceB = path.join(temporary, "workspace-b");
const requests = { a: [], b: [] };
let server, childA, childB, busyResponse;
const guardResults = {}, helpers = [];
function inputText(content) {
  if (typeof content !== 'string') return '';
  return envelope ? /^<cross-session-message[^>]*>\n([\s\S]*)\n<\/cross-session-message>$/.exec(content)?.[1] ?? content : content;
}
function journal(workspace) {
  return fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'))
    .flatMap(name => { const text = fs.readFileSync(path.join(workspace, '.agent', name), 'utf8');
      return text.slice(0, text.lastIndexOf('\n')).split('\n').filter(Boolean).map(JSON.parse); });
}

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
      JSON.stringify({ features: { crossSessionMessaging: true, ...(files ? { peerFileTransfers: true } : {}), ...(envelope ? {} : { peerSourceEnvelope: false }) } }) + "\n", { mode: 0o600 });
  }
  server = http.createServer((req, res) => {
    const label = String(req.headers.authorization ?? "").includes("owned-peer-b") ? "b" : "a";
    const chunks = []; req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests[label].push(body);
      if (idle && label === 'b' && body.messages.at(-1)?.content === 'IDLE_BUSY') { busyResponse = { res, body }; return; }
      const idleSubscribe = idle && label === 'a' && typeof body.messages.at(-1)?.content === 'string'
        ? /^PEER_IDLE (\S+)(?: (\S+))?$/.exec(body.messages.at(-1).content) : undefined;
      if (idleSubscribe) {
        sse(res, body, [{ type: 'tool_use', id: idleSubscribe[2] ?? 'peer-idle-subscribe', name: 'subscribe_peer_idle', input: { address: idleSubscribe[1] } }]); return;
      }
      if (guard && label === 'b' && body.messages.at(-1)?.content === 'GUARD_BUSY') {
        busyResponse = { res, body }; return;
      }
      if (guard && label === 'a' && typeof body.messages.at(-1)?.content === 'string' && body.messages.at(-1).content.startsWith('PEER_BURST ')) {
        const address = body.messages.at(-1).content.slice('PEER_BURST '.length);
        sse(res, body, Array.from({ length: 34 }, (_, index) => ({ type: 'tool_use', id: `guard-burst-${index}`,
          name: 'send_peer_message', input: { address, message: `GUARD_BURST_${index}`, wait_ms: 0 } }))); return;
      }
      const relay = guard ? /^GUARD_RELAY (\S+)(?: (\d+))?$/.exec(inputText(body.messages.at(-1)?.content)) : undefined;
      if (relay) {
        sse(res, body, [{ type: 'tool_use', id: `guard-relay-${label}-${requests[label].length}`, name: 'send_peer_message',
          input: { address: relay[1], message: `GUARD_RELAY ${label === 'a' ? guardResults.inboxA : guardResults.inboxB} ${Number(relay[2] ?? 0) + 1}`, wait_ms: 0 } }]); return;
      }
      if (files && label === 'b' && typeof body.messages.at(-1)?.content === 'string' && body.messages.at(-1).content.includes('PEER_FILE_CONTENT')) {
        const reference = /@"([^"]+)"/.exec(body.messages.at(-1).content);
        if (reference) { sse(res, body, [{ type: 'tool_use', id: 'peer-file-read', name: 'read_file', input: { path: reference[1] } }]); return; }
      }
      if (label === "a") {
        const pending = body.messages.at(-1);
        const text = typeof pending?.content === "string" ? pending.content : "";
        const match = /^PEER_SEND (\S+) ([\s\S]+)$/.exec(text);
        const fileSend = files ? /^PEER_FILES (\S+)$/.exec(text) : undefined;
        if (fileSend) {
          sse(res, body, [{ type: 'tool_use', id: 'peer-file-send', name: 'send_peer_files',
            input: { address: fileSend[1], files: ['payload.txt', 'missing.txt'], message: 'PEER_FILE_CONTENT' } }]); return;
        }
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
  assert.match(childB.combined, envelope ? /held for approval: <cross-session-message/ : /held for approval: EXACT_PEER_TEXT/);
  childB.child.stdin.write("/peer-held\n");
  await until(() => (envelope ? /1\. uds:\S+ \(mode-mismatch\): <cross-session-message/ : /1\. uds:\S+ \(mode-mismatch\): EXACT_PEER_TEXT/).test(childB.combined), "held listing");
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
  if (envelope) {
    const inboxA = /"inbox": "(uds:[^"]+)"/.exec(childA.combined)[1];
    const senderId = journal(workspaceA).find(row => row.kind === 'metadata').id;
    assert.equal(peerMessage.content, `<cross-session-message from="${inboxA}" from-session="${senderId}" from-name="${senderId}" from-mode="prompting">\nEXACT_PEER_TEXT\n</cross-session-message>`);
    const retained = journal(workspaceB).find(row => row.kind === 'message' && row.message.content === peerMessage.content);
    assert.deepEqual(retained.classifier.origin, { kind: 'peer', source: 'uds', name: senderId,
      fromSession: senderId, fromMode: 'prompting', body: 'EXACT_PEER_TEXT' });
  }

  if (idle) {
    await until(() => childB.combined.includes('event finished: end_turn') && (childA.combined.match(/finished: end_turn/g) ?? []).length === 2, 'text controls settled before idle subscription');
    childA.child.stdin.write('/peer-inbound accept\n');
    await until(() => childA.combined.includes('Peer inbound policy: accept'), 'idle requester policy');
    childB.child.stdin.write('IDLE_BUSY\n'); await until(() => busyResponse !== undefined, 'idle recipient has active turn');
    childA.child.stdin.write(`PEER_IDLE ${inboxB}\n`);
    await until(() => toolResult(requests.a, 'peer-idle-subscribe') !== undefined, 'idle subscription tool result');
    const subscribed = toolResult(requests.a, 'peer-idle-subscribe');
    assert.notEqual(subscribed.is_error, true, 'compiled CLI must expose and execute same-host idle subscription');
    assert.equal(JSON.parse(subscribed.content).success, true);
    assert.equal(requests.b.length, 2, 'pure subscription does not create a recipient model turn');
    const beforeNotices = requests.a.filter(request => String(request.messages.at(-1)?.content).includes('[Cross-session idle notice]')).length;
    const pending = busyResponse; busyResponse = undefined; sse(pending.res, pending.body, [{ type: 'text', text: 'Result: IDLE_FINISHED' }]);
    await until(() => requests.a.some(request => String(request.messages.at(-1)?.content).includes('[Cross-session idle notice]')), 'one idle notice reaches requester model');
    const notice = requests.a.find(request => String(request.messages.at(-1)?.content).includes('[Cross-session idle notice]'));
    assert.match(notice.messages.at(-1).content, /idle now/);
    await until(() => (childA.combined.match(/event finished: end_turn/g) ?? []).length === 1, 'idle notification turn committed');
    assert.equal(requests.a.filter(request => String(request.messages.at(-1)?.content).includes('[Cross-session idle notice]')).length, beforeNotices + 1);
    const row = journal(workspaceA).find(row => row.kind === 'message' && String(row.message.content).includes('[Cross-session idle notice]'));
    assert.equal(row.classifier.origin.kind, 'generated'); assert.equal(row.classifier.origin.source, 'peer-idle');
    guardResults.idleNotice = row.message.content;
    const requesterTurns = () => (childA.combined.match(/(?:^|\n)finished: end_turn/g) ?? []).length;
    const idleTurns = () => requests.a.filter(request => String(request.messages.at(-1)?.content).includes('[Cross-session idle notice]')).length;
    const subscribe = async suffix => {
      const before = requesterTurns();
      childA.child.stdin.write(`PEER_IDLE ${inboxB} idle-${suffix}\n`);
      await until(() => toolResult(requests.a, `idle-${suffix}`) !== undefined && requesterTurns() === before + 1, `${suffix} subscription turn settled`);
      return JSON.parse(toolResult(requests.a, `idle-${suffix}`).content);
    };
    const policy = async value => {
      const before = (childA.combined.match(/Peer inbound policy:/g) ?? []).length;
      childA.child.stdin.write(`/peer-inbound ${value}\n`);
      await until(() => (childA.combined.match(/Peer inbound policy:/g) ?? []).length === before + 1, `requester ${value} policy`);
    };
    await policy('hold');
    const heldRequests = idleTurns(), heldDisplay = (childA.combined.match(/ is idle/g) ?? []).length;
    assert.equal((await subscribe('held')).success, true);
    await until(() => (childA.combined.match(/ is idle/g) ?? []).length === heldDisplay + 1, 'held idle notice displayed');
    assert.equal(idleTurns(), heldRequests, 'hold displays a notice without a model turn');
    await policy('refuse');
    assert.deepEqual(await subscribe('refused'), { success: false, reason: 'requester-refuses-inbound' });
    assert.equal(idleTurns(), heldRequests);
    await policy('accept');
    childB.child.stdin.write('IDLE_BUSY\n'); await until(() => busyResponse !== undefined, 'second busy recipient');
    assert.equal((await subscribe('revoked')).success, true);
    await policy('refuse');
    const refusedEvents = (childA.combined.match(/event finished: end_turn/g) ?? []).length;
    const revokedResponse = busyResponse; busyResponse = undefined;
    sse(revokedResponse.res, revokedResponse.body, [{ type: 'text', text: 'Result: REVOKED_IDLE' }]);
    await until(() => (childB.combined.match(/(?:^|\n)finished: end_turn/g) ?? []).length === 2, 'revoked target turn settled');
    await sleep(1500);
    assert.equal((childA.combined.match(/event finished: end_turn/g) ?? []).length, refusedEvents);
    assert.equal(idleTurns(), heldRequests, 'policy revocation suppresses the correlated notice');
    await policy('accept');
    childB.child.stdin.write('/peer-inbound hold\n');
    await until(() => childB.combined.includes('Peer inbound policy: hold'), 'target explicitly holds input at exit');
    const beforeHeldSend = requesterTurns();
    const heldBeforeExit = (childB.combined.match(/held for approval: <cross-session-message/g) ?? []).length;
    childA.child.stdin.write(`PEER_SEND ${inboxB} IDLE_EXIT_HELD\n`);
    await until(() => (childB.combined.match(/held for approval: <cross-session-message/g) ?? []).length > heldBeforeExit, 'target holds exit input');
    childB.child.stdin.write('/peer-held\n');
    await until(() => childB.combined.includes('IDLE_EXIT_HELD\n</cross-session-message>'), 'target has held input at exit');
    await until(() => requesterTurns() === beforeHeldSend + 1, 'held send turn settled');
    assert.equal((await subscribe('exit')).success, true);
    const exitEvents = (childA.combined.match(/event finished: end_turn/g) ?? []).length;
    childB.child.stdin.write('/exit\n'); assert.equal(await childB.exit, 0);
    await until(() => (childA.combined.match(/event finished: end_turn/g) ?? []).length === exitEvents + 1, 'exit flush notification settled');
    assert.equal(idleTurns(), heldRequests + 1);
    assert.match(requests.a.at(-1).messages.at(-1).content, /has exited.*before going idle/);
    guardResults.idleBoundaries = { heldDisplayOnly: true, refused: true, revoked: true, exitFlush: true };
  }
  if (files) {
    await until(() => childB.combined.includes('event finished: end_turn') && (childA.combined.match(/finished: end_turn/g) ?? []).length === 2, 'text controls settled before file transfer');
    const bytes = 'snapshot before sender edits\nsecond line\n';
    fs.writeFileSync(path.join(workspaceA, 'payload.txt'), bytes);
    childA.child.stdin.write(`PEER_FILES ${inboxB}\n`);
    await until(() => toolResult(requests.a, 'peer-file-send') !== undefined, 'file sender tool result');
    const sent = toolResult(requests.a, 'peer-file-send');
    assert.notEqual(sent.is_error, true, 'compiled CLI must expose and execute the local file tool');
    const data = JSON.parse(sent.content);
    assert.equal(data.success, true); assert.equal(data.files.length, 2);
    assert.equal(data.files[0].size, Buffer.byteLength(bytes)); assert.equal(typeof data.files[1].error, 'string');
    const spool = path.join(userDir, 'file-transfers');
    await until(() => fs.readdirSync(spool).length === 0, 'owned staged copy consumed');
    fs.writeFileSync(path.join(workspaceA, 'payload.txt'), 'changed after snapshot');
    childB.child.stdin.write('/peer-held\n');
    await until(() => childB.combined.includes('PEER_FILE_CONTENT\n</cross-session-message>'), 'file held with materialized reference');
    childB.child.stdin.write('/peer-held approve 1\n');
    await until(() => toolResult(requests.b, 'peer-file-read') !== undefined, 'recipient reads the transferred file');
    const read = toolResult(requests.b, 'peer-file-read');
    assert.notEqual(read.is_error, true); assert.match(read.content, /snapshot before sender edits/);
    assert.equal(read.content.includes('changed after snapshot'), false);
    const row = journal(workspaceB).find(row => row.kind === 'message' && typeof row.message.content === 'string' && row.message.content.includes('PEER_FILE_CONTENT'));
    assert.ok(row); const reference = /@"([^"]+)"/.exec(row.message.content); assert.ok(reference);
    assert.equal(fs.readFileSync(path.join(workspaceB, reference[1]), 'utf8'), bytes);
    assert.equal(Object.hasOwn(row.classifier.origin, 'body'), false);
    assert.equal(row.classifier.origin.kind, 'peer');
    assert.equal(row.classifier.origin.fromSession, journal(workspaceA).find(row => row.kind === 'metadata').id);
    await until(() => (childB.combined.match(/event finished: end_turn/g) ?? []).length === 2, 'file recipient turn committed');
  }
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
      if (envelope) childB.child.stdin.write('/peer-held\n');
      await until(() => childB.combined.includes(envelope ? `${text}\n</cross-session-message>` : `held for approval: ${text}`), 'next held message');
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
    if (envelope) childB.child.stdin.write('/peer-held\n');
    await until(() => childB.combined.includes(envelope ? '/exit\n</cross-session-message>' : 'held for approval: /exit'), 'literal slash input held');
    childB.child.stdin.write('/peer-held approve 1\n');
    await until(() => requests.b.length === beforeB + 1 && childB.child.exitCode === null, 'peer slash input stays data');
    await status(originId, 'delivered');
    const lastB = requests.b.at(-1);
    assert.ok(lastB.messages.some(message => message.role === 'user' && inputText(message.content) === '/exit'));
    const records = journal(workspaceB);
    const peerEvent = records.find(row => row.kind === 'message' && row.message.role === 'user' && inputText(row.message.content) === '/exit');
    assert.ok(peerEvent);
    if (envelope) {
      const senderId = journal(workspaceA).find(row => row.kind === 'metadata').id;
      assert.deepEqual(peerEvent.classifier?.origin, { kind: 'peer', source: 'uds', name: senderId,
        fromSession: senderId, fromMode: 'prompting', body: '/exit' });
    } else assert.deepEqual(peerEvent.classifier?.origin, { kind: 'peer', source: 'uds' });
    if (guard) {
      childB.child.stdin.write('/peer-inbound accept\n');
      await until(() => childB.combined.includes('Peer inbound policy: accept'), 'guard accept policy');
      await send('GUARD_DUPLICATE');
      await until(() => requests.b.some(request => inputText(request.messages.at(-1)?.content) === 'GUARD_DUPLICATE'), 'first duplicate body admitted');
      const duplicateId = await send('GUARD_DUPLICATE');
      await status(duplicateId, 'dropped');
      assert.equal(requests.b.filter(request => inputText(request.messages.at(-1)?.content) === 'GUARD_DUPLICATE').length, 1);
      const inboxA = /"inbox": "(uds:[^"]+)"/.exec(childA.combined)[1];
      guardResults.inboxA = inboxA; guardResults.inboxB = inboxB;
      const relayDrops = () => (childA.combined.match(/\S+ dropped\n/g) ?? []).length + (childB.combined.match(/\S+ dropped\n/g) ?? []).length;
      const beforeRelayDrops = relayDrops();
      await until(() => (childB.combined.match(/event finished: end_turn/g) ?? []).length === 3, 'duplicate recipient turn settled');
      const beforeRelayTurns = turns(childA) + turns(childB);
      childA.child.stdin.write(`/peer-inbound accept\nGUARD_RELAY ${inboxB} 0\n`);
      await until(() => {
        const journalRows = journal(workspaceB);
        return journalRows.some(row => row.classifier?.origin?.hopChain?.length >= 18);
      }, 'relay chain persisted');
      await until(() => relayDrops() > beforeRelayDrops, 'relay guard reached');
      const relayRequests = [...requests.a, ...requests.b].filter(request => inputText(request.messages.at(-1)?.content).startsWith('GUARD_RELAY '));
      assert.ok(relayRequests.length >= 19 && relayRequests.length <= 22);
      guardResults.relayRequests = relayRequests.length;
      await until(() => turns(childA) + turns(childB) === beforeRelayTurns + relayRequests.length, 'relay turns settled');
      await command(childA, 'GUARD_HUMAN_RESET');
      await command(childA, `PEER_SEND ${inboxB} GUARD_AFTER_RESET`);
      await until(() => requests.b.some(request => inputText(request.messages.at(-1)?.content) === 'GUARD_AFTER_RESET'), 'human input resets relay chain');
      const currentRows = journal(workspaceB);
      const resetRow = currentRows.find(row => row.kind === 'message' && inputText(row.message.content) === 'GUARD_AFTER_RESET');
      if (envelope) {
        const senderId = journal(workspaceA).find(row => row.kind === 'metadata').id;
        assert.deepEqual(resetRow.classifier.origin, { kind: 'peer', source: 'uds', name: senderId,
          fromSession: senderId, fromMode: 'prompting', body: 'GUARD_AFTER_RESET' });
      } else assert.deepEqual(resetRow.classifier.origin, { kind: 'peer', source: 'uds' });
      const { createLocalPeerTransport, sendPeerFrame } = await import(pathToFileURL(path.join(root, 'dist/local-peer.js')).href);
      const helper = await createLocalPeerTransport({ userDir, workspace: workspaceA,
        socketPath: path.join(runtimeDir(), 'litcode-socks', `guard-${process.pid}.sock`), policy: () => 'accept', onEvent: () => {} });
      helpers.push(helper);
      const queued = (text, from = helper.address) => sendPeerFrame(inboxB, { type: 'user', from, msg_id: text,
        message: { role: 'user', content: text }, from_mode: 'prompting' }, { userDir });
      childB.child.stdin.write('GUARD_BUSY\n');
      await until(() => busyResponse !== undefined, 'recipient busy request');
      const burstStarted = Date.now();
      await command(childA, `PEER_BURST ${helper.address}`);
      const burstElapsedMs = Date.now() - burstStarted;
      const burstResults = Array.from({ length: 34 }, (_, index) => toolResult(requests.a, `guard-burst-${index}`));
      assert.ok(burstResults.every(Boolean));
      assert.ok(burstResults.some(block => block.is_error === true && /Too many messages/.test(block.content)));
      const admitted = burstResults.filter(block => block.is_error !== true).length;
      assert.ok(admitted > 0 && admitted <= 30 + Math.floor(burstElapsedMs / 2000));
      guardResults.pacedSends = burstResults.length - admitted;
      for (let index = 0; index < 50; index++) await queued(`GUARD_QUEUE_${index}`, `uds:${path.join(runtimeDir(), 'litcode-socks', `sender-${index}.sock`)}`);
      await queued('GUARD_QUEUE_SENTINEL');
      await until(() => helper.status('GUARD_QUEUE_SENTINEL')?.status === 'dropped', 'full peer queue receipt');
      const pendingBusy = busyResponse; busyResponse = undefined;
      const priorEvents = (childB.combined.match(/event finished: end_turn/g) ?? []).length;
      sse(pendingBusy.res, pendingBusy.body, [{ type: 'text', text: 'busy released' }]);
      await until(() => (childB.combined.match(/event finished: end_turn/g) ?? []).length === priorEvents + 50, 'all retained peer messages drained');
      const deliveredQueue = requests.b.map(request => request.messages.at(-1)?.content)
        .filter(content => typeof content === 'string' && /^GUARD_(?:BURST_|QUEUE_)/.test(content));
      assert.equal(deliveredQueue.length, 50);
      assert.ok(deliveredQueue.includes('GUARD_QUEUE_0')); assert.equal(deliveredQueue.includes('GUARD_QUEUE_SENTINEL'), false);
      guardResults.retainedQueue = 50;
      await helper.close(); helpers.splice(helpers.indexOf(helper), 1);
      childB.child.stdin.write('/peer-inbound hold\n');
      await until(() => childB.combined.endsWith('Peer inbound policy: hold\n') || childB.combined.lastIndexOf('Peer inbound policy: hold') > childB.combined.lastIndexOf('Peer inbound policy: accept'), 'guard hold policy restored');
    }
    const pendingId = await send('EXPIRE_ON_EXIT'); assert.ok(pendingId);
    if (envelope) childB.child.stdin.write('/peer-held\n');
    await until(() => childB.combined.includes(envelope ? 'EXPIRE_ON_EXIT\n</cross-session-message>' : 'held for approval: EXPIRE_ON_EXIT'), 'held at exit');
    childB.child.stdin.write('/exit\n'); assert.equal(await childB.exit, 0);
    await status(pendingId, 'expired');
    await command(childA, 'PEER_LIST');
    const content = requests.a.at(-1)?.messages.at(-1)?.content;
    const result = content.find(block => block.type === 'tool_result'); assert.ok(result);
    assert.deepEqual(JSON.parse(result.content).peers, []);
    assert.equal(fs.existsSync(inboxB.slice(4)), false);
  }
  childA.child.stdin.write("/exit\n");
  if (!acceptance && !idle) childB.child.stdin.write("/exit\n");
  const codes = await Promise.all([childA.exit, childB.exit]);
  assert.deepEqual(codes, [0, 0]);
  for (const state of [childA, childB]) assert.throws(() => process.kill(state.child.pid, 0), error => error.code === 'ESRCH');
  if (files) {
    const { Session } = await import(pathToFileURL(path.join(root, 'dist/session.js')).href);
    const id = journal(workspaceB).find(row => row.kind === 'metadata').id;
    const cold = Session.open(workspaceB, { id });
    try {
      const content = cold.messages.find(message => typeof message.content === 'string' && message.content.includes('PEER_FILE_CONTENT'))?.content;
      assert.equal(typeof content, 'string'); const reference = /@"([^"]+)"/.exec(content); assert.ok(reference);
      assert.equal(fs.readFileSync(path.join(workspaceB, reference[1]), 'utf8'), 'snapshot before sender edits\nsecond line\n');
    } finally { await cold.close(); }
  }
  if (idle) {
    const { Session } = await import(pathToFileURL(path.join(root, 'dist/session.js')).href);
    const id = journal(workspaceA).find(row => row.kind === 'metadata').id, cold = Session.open(workspaceA, { id });
    try { assert.ok(cold.messages.some(message => message.content === guardResults.idleNotice)); } finally { await cold.close(); }
  }
  for (const workspace of [workspaceA, workspaceB]) assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  for (const label of ['a', 'b']) assert.deepEqual(fs.readdirSync(path.join(runtimeDir(), 'litcode-socks')), []);
  const sessions = path.join(userDir, "sessions");
  assert.deepEqual(fs.existsSync(sessions) ? fs.readdirSync(sessions).filter(name => /\.(?:json|key)$/.test(name)) : [], []);
  console.log(JSON.stringify({ cli: "passed", processes: 2, inboxB, aRequests: requests.a.length, bRequests: requests.b.length,
    held: "mode-mismatch", receipt: "delivered", ownedCleanup: true,
    ...(compiled ? { compiledCLI: true } : {}), acceptance, heldDecisions: acceptance ? ['approve', 'deny', 'expire', 'refuse', 'exit-expiry'] : ['approve'],
    peerOrigin: acceptance || files, sourceEnvelope: envelope, ...(idle ? { peerIdle: { oneShot: true, pureSubscription: true, generatedOrigin: true, coldReopen: true, ...guardResults.idleBoundaries } } : {}), ...(files ? { localFiles: { sent: 1, failed: 1, snapshotPreserved: true, modelRead: true, originalBodyRemoved: true } } : {}), ...(guard ? { guard: { pacedSends: guardResults.pacedSends, retainedQueue: guardResults.retainedQueue,
      relayRequests: guardResults.relayRequests, duplicateRequests: 1, humanReset: true } } : {}), gateway: "owned loopback SSE", externalCalls: 0 }));
} catch (error) {
  console.error("A:", childA?.combined?.slice(-4000));
  console.error("B:", childB?.combined?.slice(-4000));
  throw error;
} finally {
  for (const helper of helpers) await helper.close();
  for (const state of [childA, childB]) if (state && state.child.exitCode === null && state.child.signalCode === null) state.child.kill("SIGKILL");
  await Promise.all([childA, childB].filter(Boolean).map(state => state.exit));
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
}
