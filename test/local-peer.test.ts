import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { after, test } from "node:test";
import { createLocalPeerTransport, createLocalPeerTools, createLocalPeerTools as peerTools, HeldQueue, inboundVerdict,
  isAuthFrame, listRecords, makeTokens, peerIdentity, probeSocket, publishKey, publishRecord, readKey, socketKeyName,
  verifyAuthFrame, type AcceptedMessage, type HeldMessage, type LocalPeerTransport, type PeerTransportEvent } from "../src/local-peer.js";
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
