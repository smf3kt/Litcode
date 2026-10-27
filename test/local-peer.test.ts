import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { after, test } from "node:test";
import { spawn } from "node:child_process";
import { createLocalPeerTransport, createLocalPeerTools, createLocalPeerTools as peerTools, HeldQueue, heldApprovalTimeoutMs,
  inboundVerdict, isAuthFrame, listRecords, makeTokens, peerIdentity, probeSocket, publishKey, publishRecord, readKey,
  socketKeyName, verifyAuthFrame, sendPeerFrame, type AcceptedMessage, type HeldCause, type HeldMessage, type LocalPeerTransport,
  type PeerTransportEvent } from "../src/local-peer.js";
import type { ToolContext } from "../src/tools.js";

const roots: string[] = [];
function root(): string {
  const value = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-local-peer-")));
  roots.push(value);
  return value;
}
after(() => { for (const value of roots) fs.rmSync(value, { recursive: true, force: true }); });
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const signal = () => new AbortController().signal;
const context = (workspace: string): ToolContext => ({ workspace, signal: signal(), allowShell: false, maxOutputBytes: 24_000 });

async function until(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("condition not reached");
    await delay(20);
  }
}

// Receipts arrive after the gate returns, and `waitStatus` resolves with any
// already-recorded status, so polling is the only way to observe a change.
async function untilStatus(transport: LocalPeerTransport, msgId: string, status: string, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (transport.status(msgId)?.status !== status) {
    if (Date.now() - started > timeoutMs) throw new Error(`status ${status} not reached; last ${transport.status(msgId)?.status}`);
    await delay(20);
  }
}

test("inbound verdict follows explicit policy, self-sent and the recipient mode", () => {
  assert.deepEqual(inboundVerdict({ explicit: "accept", recipient: { mode: "bypass" }, fromMode: "prompting" }), { policy: "accept" });
  assert.deepEqual(inboundVerdict({ explicit: "refuse", selfSent: true }), { policy: "refuse" });
  assert.deepEqual(inboundVerdict({ explicit: "hold" }), { policy: "hold", holdCause: "explicit" });
  assert.deepEqual(inboundVerdict({ selfSent: true }), { policy: "accept" });
  assert.deepEqual(inboundVerdict({ recipient: null }), { policy: "hold", holdCause: "mode-unknown" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "not-a-mode" } }), { policy: "hold", holdCause: "mode-unknown" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "bypass" }, fromMode: "bypass" }), { policy: "accept" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "bypass" }, fromMode: "prompting" }), { policy: "hold", holdCause: "mode-mismatch" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "bypass" } }), { policy: "hold", holdCause: "no-mode-asserted" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "default" } }), { policy: "accept" });
  assert.deepEqual(inboundVerdict({ recipient: { mode: "default" }, fromMode: "bypass" }), { policy: "hold", holdCause: "mode-mismatch" });
});

test("held queue keeps a bounded FIFO, re-evaluates on release and expires on close", async () => {
  let policy: "accept" | "hold" | "refuse" = "hold";
  const receipts: string[] = [];
  const delivered: string[] = [];
  const queue = new HeldQueue({
    verdict: () => ({ policy }),
    deliver: message => { delivered.push(message.text); return true; },
    receipt: (message, status) => { receipts.push(`${message.text}:${status}`); },
  }, { limit: 2 });
  const message = (text: string): HeldMessage => ({ text, cause: "explicit", receivedAt: Date.now(), origin: { selfSent: false } });
  queue.hold(message("one")); queue.hold(message("two")); queue.hold(message("three"));
  assert.deepEqual(queue.list().map(item => item.text), ["two", "three"]);
  assert.ok(receipts.includes("one:expired"));
  assert.equal(queue.release("mode-change"), 0);
  policy = "accept";
  assert.equal(queue.release("mode-change"), 2);
  assert.deepEqual(delivered, ["two", "three"]);
  assert.deepEqual(queue.list(), []);
  policy = "hold";
  queue.hold(message("four"));
  await queue.expireAll();
  assert.deepEqual(queue.list(), []);
  assert.ok(receipts.includes("four:expired"));
});

test("held shutdown waits for asynchronous expiry receipts within the source settlement window", async t => {
  const calls: string[] = [];
  let complete: (() => void) | undefined;
  const queue = new HeldQueue({
    verdict: () => ({ policy: "hold" }), deliver: () => true,
    receipt: (_message, status) => {
      if (status !== "expired") return;
      calls.push(status);
      return new Promise<void>(resolve => { complete = resolve; });
    },
  });
  queue.hold({ text: "pending", cause: "explicit", receivedAt: 1, origin: { selfSent: false } });
  let settled = false;
  const pending = queue.expireAll().then(() => { settled = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ["expired"]);
  assert.equal(settled, false);
  assert.equal(queue.size(), 0);
  assert.ok(complete); complete(); await pending;
  assert.equal(settled, true);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const bounded = new HeldQueue({ verdict: () => ({ policy: "hold" }), deliver: () => true,
      receipt: (_message, status) => status === "expired" ? new Promise<void>(() => {}) : undefined });
    bounded.hold({ text: "budget", cause: "explicit", receivedAt: 1, origin: { selfSent: false } });
    let budgetSettled = false;
    const budget = bounded.expireAll().then(() => { budgetSettled = true; });
    await new Promise<void>(resolve => setImmediate(resolve));
    t.mock.timers.tick(749);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(budgetSettled, false);
    t.mock.timers.tick(1); await budget;
    assert.equal(budgetSettled, true);
  } finally { t.mock.timers.reset(); }
});

test("receipt control frames normalize source refusal details and ignore unknown statuses", async () => {
  const userDir = root(), workspace = root(), events: PeerTransportEvent[] = [];
  const receiver = await createLocalPeerTransport({ userDir, workspace, onEvent: event => events.push(event) });
  try {
    await sendPeerFrame(receiver.address, { type: "control", action: "peer_message_status", status: "expired",
      status_detail: "refused", orig_msg_id: "source-refusal", msgV: 1, msg_id: "control-1" }, { userDir });
    await until(() => receiver.status("source-refusal") !== undefined);
    assert.equal(receiver.status("source-refusal")?.status, "refused");
    await sendPeerFrame(receiver.address, { type: "control", action: "peer_message_status", status: "invented",
      orig_msg_id: "unknown-status" }, { userDir });
    await sendPeerFrame(receiver.address, { type: "control", action: "peer_message_status", status: "delivered",
      orig_msg_id: "source-delivery" }, { userDir });
    await until(() => receiver.status("source-delivery") !== undefined);
    assert.equal(receiver.status("source-delivery")?.status, "delivered");
    assert.equal(receiver.status("unknown-status"), undefined);
  } finally { await receiver.close(); }
});

test("receipt replies use source wire fields and only shaped local socket namespaces", async () => {
  const userDir = root(), directory = root(), elsewhere = root(), received: { status?: unknown; status_detail?: unknown; orig_msg_id?: unknown; msgV?: unknown; msg_id?: unknown }[] = [];
  const clients = new Set<net.Socket>();
  const bind = async (sock: string) => {
    const server = net.createServer(socket => {
      clients.add(socket); socket.on("close", () => clients.delete(socket)); socket.on("error", () => {});
      let buffer = "";
      socket.on("data", chunk => {
        buffer += String(chunk);
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          const frame = JSON.parse(line);
          if (frame.type === "control") received.push(frame);
        }
      });
      socket.on("end", () => socket.end());
    });
    await new Promise<void>(resolve => server.listen(sock, resolve));
    return server;
  };
  const replyPath = path.join(directory, "reply.sock"), reply = await bind(replyPath);
  const foreignPath = path.join(elsewhere, "reply.sock"), foreign = await bind(foreignPath);
  const receiver = await createLocalPeerTransport({ userDir, workspace: directory, socketPath: path.join(directory, "inbox.sock"),
    policy: () => "refuse", mode: () => ({ mode: "default" }), onEvent: () => {} });
  try {
    await sendPeerFrame(receiver.address, { type: "user", message: { role: "user", content: "refuse" },
      from: `uds:${replyPath}`, msg_id: "original-refusal" }, { userDir });
    await until(() => received.length === 1);
    assert.equal(received[0]?.status, "expired");
    assert.equal(received[0]?.status_detail, "refused");
    assert.equal(received[0]?.orig_msg_id, "original-refusal");
    assert.equal(received[0]?.msgV, 1);
    assert.equal(typeof received[0]?.msg_id, "string");
    await sendPeerFrame(receiver.address, { type: "user", message: { role: "user", content: "foreign" },
      from: `uds:${foreignPath}`, msg_id: "foreign-namespace" }, { userDir });
    assert.equal(received.length, 1);
    const traversal = path.join(directory, "nested") + "/../reply.sock";
    await sendPeerFrame(receiver.address, { type: "user", message: { role: "user", content: "traversal" },
      from: `uds:${traversal}`, msg_id: "dotdot-namespace" }, { userDir });
    await sendPeerFrame(receiver.address, { type: "user", message: { role: "user", content: "encoded" },
      from: `uds:${encodeURIComponent(replyPath)}`, msg_id: "encoded-reply" }, { userDir });
    await until(() => received.some(frame => frame.orig_msg_id === "encoded-reply"));
    assert.deepEqual(received.map(frame => frame.orig_msg_id), ["original-refusal", "encoded-reply"]);
  } finally {
    await receiver.close(); for (const socket of clients) socket.destroy();
    await Promise.all([reply, foreign].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
});

test("the held approval window resolves the setting and the environment override", () => {
  assert.equal(heldApprovalTimeoutMs(undefined, {}), 300_000);
  assert.equal(heldApprovalTimeoutMs("60s", {}), 60_000);
  assert.equal(heldApprovalTimeoutMs("5m", {}), 300_000);
  assert.equal(heldApprovalTimeoutMs("10m", {}), 600_000);
  assert.equal(heldApprovalTimeoutMs("never", {}), 0);
  assert.equal(heldApprovalTimeoutMs("5m", { CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS: "1500" }), 1500);
  // A unit suffix is not numeric, so the setting wins (the recovered release-note fix).
  assert.equal(heldApprovalTimeoutMs("10m", { CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS: "5m" }), 600_000);
});

test("only mode causes expire a held message after the approval window", async () => {
  const receipts: string[] = [];
  const dropped: string[] = [];
  let windowMs = 25;
  const queue = new HeldQueue({
    verdict: () => ({ policy: "hold", holdCause: "mode-mismatch" }),
    deliver: () => true,
    receipt: (message, status) => { receipts.push(`${message.text}:${status}`); },
    onDropped: (message, reason) => { dropped.push(`${message.text}:${reason}`); },
  }, { heldTimeoutMs: () => windowMs });
  const message = (text: string, cause: HeldCause): HeldMessage =>
    ({ text, cause, receivedAt: Date.now(), origin: { selfSent: false } });
  queue.hold(message("mismatch", "mode-mismatch"));
  queue.hold(message("explicit", "explicit"));
  queue.hold(message("unknown", "mode-unknown"));
  await delay(70);
  assert.deepEqual(queue.list().map(item => item.text), ["explicit", "unknown"]);
  assert.ok(receipts.includes("mismatch:expired"));
  assert.deepEqual(dropped, ["mismatch:expired"]);
  // `never` (0) disables the timer for every cause.
  windowMs = 0;
  queue.hold(message("never", "no-mode-asserted"));
  await delay(70);
  assert.deepEqual(queue.list().map(item => item.text), ["explicit", "unknown", "never"]);
  await queue.expireAll();
});

test("auth frames accept only the published peer or child token", () => {
  const tokens = makeTokens();
  assert.equal(isAuthFrame({ type: "auth", token: tokens.peerToken }), true);
  assert.equal(isAuthFrame({ type: "user" }), false);
  assert.equal(verifyAuthFrame({ token: tokens.peerToken }, tokens), "peer");
  assert.equal(verifyAuthFrame({ token: tokens.childToken }, tokens), "child");
  assert.equal(verifyAuthFrame({ token: "0".repeat(32) }, tokens), undefined);
  assert.match(socketKeyName(process.pid, "/tmp/a.sock"), /^\d+\.[0-9a-f]{64}\.key$/);
  assert.throws(() => socketKeyName(process.pid, "relative.sock"), /non-canonical/);
});

test("key publication is per-socket, 0600 and resolved by the sender", async () => {
  const userDir = root();
  const tokens = makeTokens();
  const file = await publishKey(userDir, "/tmp/peer-key.sock", tokens.peerToken);
  assert.equal(path.dirname(file), path.join(userDir, "sessions"));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  assert.deepEqual(await readKey(userDir, "/tmp/peer-key.sock"), { kind: "token", token: tokens.peerToken });
  assert.deepEqual(await readKey(userDir, "/tmp/other.sock"), { kind: "no-key" });
  assert.deepEqual(await readKey(userDir, "/tmp/peer-key.sock", { requireLiveOwner: true }), { kind: "token", token: tokens.peerToken });
});

test("key candidates prefer matching live process identities over stale owners in either order", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const exited = new Promise<void>(resolve => child.once("close", () => resolve()));
  await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  const pid = child.pid; assert.ok(pid);
  try {
    for (const stalePid of [2, 2147483646, 999999999]) {
      const userDir = root(), sock = path.join(userDir, "ranking.sock");
      const liveToken = makeTokens().peerToken, staleToken = makeTokens().peerToken;
      await publishKey(userDir, sock, liveToken);
      fs.writeFileSync(path.join(userDir, "sessions", socketKeyName(stalePid, sock)), JSON.stringify({ peerToken: staleToken }), { mode: 0o600 });
      const required = await readKey(userDir, sock, { requireLiveOwner: true });
      assert.equal(required.kind === "token" && required.token === liveToken, true);
      const optional = await readKey(userDir, sock);
      assert.equal(optional.kind === "token" && optional.token === liveToken, true);
    }
    const userDir = root(), sock = path.join(userDir, "birth.sock");
    const liveToken = makeTokens().peerToken, staleToken = makeTokens().peerToken;
    await publishKey(userDir, sock, liveToken);
    const stalePath = path.join(userDir, "sessions", socketKeyName(pid, sock));
    fs.writeFileSync(stalePath, JSON.stringify({ peerToken: staleToken, procStart: "recycled-process-start" }), { mode: 0o600 });
    const required = await readKey(userDir, sock, { requireLiveOwner: true });
    assert.equal(required.kind === "token" && required.token === liveToken, true);
    const gone = root(), goneSock = path.join(gone, "gone.sock");
    fs.mkdirSync(path.join(gone, "sessions"));
    for (const deadPid of [2147483645, 2147483646]) fs.writeFileSync(path.join(gone, "sessions", socketKeyName(deadPid, goneSock)), JSON.stringify({ peerToken: staleToken }), { mode: 0o600 });
    assert.deepEqual(await readKey(gone, goneSock, { requireLiveOwner: true }), { kind: "dead-owner" });
  } finally { child.kill("SIGTERM"); await exited; }
});

test("records publish, enumerate and sweep only dead same-domain owners", async () => {
  const userDir = root();
  await publishRecord(userDir, { cwd: userDir, startedAt: 1, sock: "/tmp/record-a.sock", kind: "interactive", sessionId: "s1" });
  const records = await listRecords(userDir);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.sock, "/tmp/record-a.sock");
  assert.equal(records[0]!.sessionId, "s1");
  assert.equal(fs.statSync(records[0]!.file).mode & 0o777, 0o600);
  // A live record for a socket nobody listens on is not a peer.
  assert.equal(await probeSocket("/tmp/record-a.sock"), false);
});

test("two transports discover each other, deliver exact text and report receipts", async () => {
  const userDir = root();
  const workspace = root();
  const eventsA: PeerTransportEvent[] = [];
  const eventsB: PeerTransportEvent[] = [];
  // A normal recipient mode accepts an unasserted sender (`E`: absent
  // assertion bypasses holds for every mode but bypass).
  const mode = () => ({ mode: "default" });
  const a = await createLocalPeerTransport({ userDir, workspace, name: "a", mode, onEvent: event => eventsA.push(event) });
  const b = await createLocalPeerTransport({ userDir, workspace, name: "b", mode, onEvent: event => eventsB.push(event) });
  try {
    const peers = await a.list();
    assert.deepEqual(peers.map(peer => peer.pid), [process.pid]);
    assert.equal(peers[0]!.address, b.address);
    const sent = await a.send(b.address, "EXACT_PEER_TEXT");
    assert.equal(typeof sent.msgId, "string");
    await until(() => eventsB.some(event => event.kind === "message"));
    const message = eventsB.find(event => event.kind === "message") as Extract<PeerTransportEvent, { kind: "message" }>;
    assert.equal(message.message.text, "EXACT_PEER_TEXT");
    assert.equal(message.message.from, a.address);
    assert.equal(message.message.selfSent, false);
    const tools = createLocalPeerTools(b);
    const list = JSON.parse(await tools.find(tool => tool.schema.name === "list_peers")!.execute({}, context(workspace))) as { peers: { pid: number }[] };
    assert.deepEqual(list.peers.map(peer => peer.pid), [process.pid]);
  } finally {
    await a.close(); await b.close();
  }
  // Owned cleanup removes both records and keys.
  assert.deepEqual(await listRecords(userDir), []);
  assert.deepEqual(fs.readdirSync(path.join(userDir, "sessions")).filter(name => name.endsWith(".key")), []);
});

test("a mode-mismatched message is held, then approved, denied or released with receipts", async () => {
  const userDir = root();
  const workspace = root();
  const eventsA: PeerTransportEvent[] = [];
  const eventsB: PeerTransportEvent[] = [];
  let senderMode: { mode: string } | null = { mode: "default" };
  let recipientMode: { mode: string } | null = { mode: "bypass" };
  const a = await createLocalPeerTransport({ userDir, workspace, mode: () => senderMode, onEvent: event => eventsA.push(event) });
  const b = await createLocalPeerTransport({ userDir, workspace, mode: () => recipientMode, onEvent: event => eventsB.push(event) });
  try {
    // Sender `a` asserts prompting; recipient `b` is bypass, so the
    // mismatch holds (`E` mode-mismatch).
    const first = await a.send(b.address, "HELD_ONE");
    await until(() => eventsB.some(event => event.kind === "held"));
    assert.equal(b.held().length, 1);
    assert.equal(b.held()[0]!.cause, "mode-mismatch");
    // `wht` approve checks only refuse and the ingress guard, so an explicit
    // approval releases the message even while the modes still differ.
    assert.equal(await b.resolveHeld(first.msgId, "approve"), "delivered");
    await until(() => eventsB.some(event => event.kind === "message" && event.message.text === "HELD_ONE"));
    await untilStatus(a, first.msgId, "delivered");
    const second = await a.send(b.address, "HELD_TWO");
    await until(() => b.held().some(item => item.origin.msgId === second.msgId));
    assert.equal(await b.resolveHeld(second.msgId, "deny"), "dropped");
    await untilStatus(a, second.msgId, "denied");
    const third = await a.send(b.address, "HELD_THREE");
    await until(() => b.held().some(item => item.origin.msgId === third.msgId));
    recipientMode = { mode: "default" };
    assert.equal(b.releaseHeld("mode-change"), 1);
    await until(() => eventsB.some(event => event.kind === "message" && event.message.text === "HELD_THREE"));
    await untilStatus(a, third.msgId, "delivered");
    // A held message left at close is settled as expired with a receipt.
    recipientMode = { mode: "bypass" };
    const fourth = await a.send(b.address, "HELD_FOUR");
    await until(() => b.held().some(item => item.origin.msgId === fourth.msgId));
    await b.close();
    await untilStatus(a, fourth.msgId, "expired");
  } finally { await a.close(); if (b.held().length > 0) await b.close(); }
});

test("an explicit refuse policy answers with a refusal receipt and no delivery", async () => {
  const userDir = root();
  const workspace = root();
  const eventsA: PeerTransportEvent[] = [];
  const eventsB: PeerTransportEvent[] = [];
  const mode = () => ({ mode: "default" });
  const a = await createLocalPeerTransport({ userDir, workspace, mode, name: "a", onEvent: event => eventsA.push(event) });
  const b = await createLocalPeerTransport({ userDir, workspace, mode, policy: () => "refuse", name: "b", onEvent: event => eventsB.push(event) });
  try {
    const sent = await a.send(b.address, "REFUSED_TEXT");
    const receipt = await a.waitStatus(sent.msgId, 3000);
    assert.equal(receipt?.status, "refused");
    await delay(150);
    assert.equal(eventsB.some(event => event.kind === "message"), false);
    assert.equal(b.held().length, 0);
  } finally { await a.close(); await b.close(); }
});

test("a forged record identity is rejected before the frame is written", async () => {
  const userDir = root();
  const workspace = root();
  const received: string[] = [];
  const server = net.createServer(socket => { socket.on("data", chunk => received.push(String(chunk))); socket.on("error", () => {}); });
  const sock = path.join(root(), "forged.sock");
  await new Promise<void>(resolve => server.listen(sock, resolve));
  try {
    const a = await createLocalPeerTransport({ userDir, workspace, onEvent: () => {} });
    try {
      // A live listener, but not the process the record names.
      await publishRecord(userDir, { cwd: workspace, startedAt: 1, sock, pid: process.pid + 1 });
      await assert.rejects(a.send(`uds:${sock}`, "SHOULD_NOT_ARRIVE"), /connected endpoint is not the expected process/);
      await delay(150);
      assert.equal(received.join(""), "");
    } finally { await a.close(); }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("a stale record is swept and a crashed owner leaves no live peer", async () => {
  const userDir = root();
  const workspace = root();
  const mode = () => ({ mode: "default" });
  const a = await createLocalPeerTransport({ userDir, workspace, mode, name: "a", onEvent: () => {} });
  const b = await createLocalPeerTransport({ userDir, workspace, mode, name: "b", onEvent: () => {} });
  try {
    // A record whose pid cannot exist, pointing at a live listener.
    const dead = path.join(root(), "dead.sock");
    await publishRecord(userDir, { cwd: workspace, startedAt: 1, sock: dead, pid: 0x7ffffffe });
    const peers = await a.list();
    assert.deepEqual(peers.map(peer => peer.name), ["b"]);
    const records = await listRecords(userDir);
    assert.equal(records.some(record => record.pid === 0x7ffffffe), false);
  } finally { await a.close(); await b.close(); }
});

test("an unauthenticated connection is dropped when auth is required", async () => {
  const userDir = root();
  const workspace = root();
  const events: PeerTransportEvent[] = [];
  const mode = () => ({ mode: "default" });
  const a = await createLocalPeerTransport({ userDir, workspace, mode, requireAuth: true, onEvent: event => events.push(event) });
  try {
    // A raw unauthenticated user frame is refused; the same frame with the
    // published key's token is accepted.
    const sock = a.address.slice(4);
    const key = await readKey(userDir, sock);
    assert.equal(key.kind, "token");
    const raw = net.connect({ path: sock });
    await new Promise<void>(resolve => raw.on("connect", resolve));
    raw.write(`${JSON.stringify({ type: "user", message: { role: "user", content: "NO_AUTH" } })}\n`);
    await delay(200);
    assert.equal(events.some(event => event.kind === "message"), false);
    raw.destroy();
    const authed = net.connect({ path: sock });
    await new Promise<void>(resolve => authed.on("connect", resolve));
    authed.write(`${JSON.stringify({ type: "auth", token: (key as { token: string }).token })}\n`);
    authed.write(`${JSON.stringify({ type: "user", message: { role: "user", content: "WITH_AUTH" } })}\n`);
    await until(() => events.some(event => event.kind === "message"));
    const message = events.find(event => event.kind === "message") as Extract<PeerTransportEvent, { kind: "message" }>;
    assert.equal(message.message.text, "WITH_AUTH");
    authed.destroy();
  } finally { await a.close(); }
});

test("peer tools list, send and report status without child-agent routing", async () => {
  const userDir = root();
  const workspace = root();
  const received: AcceptedMessage[] = [];
  const mode = () => ({ mode: "default" });
  const a = await createLocalPeerTransport({ userDir, workspace, mode, onEvent: () => {} });
  const b = await createLocalPeerTransport({ userDir, workspace, mode, onEvent: event => { if (event.kind === "message") received.push(event.message); } });
  try {
    const tools = peerTools(a);
    assert.deepEqual(tools.map(tool => tool.schema.name), ["list_peers", "send_peer_message", "peer_message_status"]);
    const sent = JSON.parse(await tools.find(tool => tool.schema.name === "send_peer_message")!
      .execute({ address: b.address, message: "TOOL_TEXT", wait_ms: 2000 }, context(workspace))) as { status: string };
    assert.equal(sent.status, "sent");
    await until(() => received.length === 1);
    assert.equal(received[0]!.text, "TOOL_TEXT");
  } finally { await a.close(); await b.close(); }
});

test("connected socket identity matches the peer process on this platform", async () => {
  const dir = root();
  const sock = path.join(dir, "identity.sock");
  let observed: ReturnType<typeof peerIdentity>;
  const server = net.createServer(socket => {
    const fd = (socket as unknown as { _handle?: { fd?: number } })._handle?.fd;
    observed = fd === undefined ? undefined : peerIdentity(fd);
    socket.end();
  });
  await new Promise<void>(resolve => server.listen(sock, resolve));
  const client = net.connect({ path: sock });
  await new Promise<void>(resolve => client.on("close", resolve));
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (process.platform === "darwin") {
    assert.deepEqual(observed, { pid: process.pid, uid: process.getuid!(), gid: process.getgid!() });
  } else {
    assert.equal(observed, undefined);
  }
});
