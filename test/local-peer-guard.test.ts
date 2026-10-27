import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { appendPeerHop, createPeerDropReporter, createPeerIngressGuard, createPeerPacer, peerHopToken, PEER_LIMITS } from '../src/local-peer-guard.js';
import { createLocalPeerTransport, latestPeerHopChain, sendPeerFrame, type AcceptedMessage } from '../src/local-peer.js';
import { markClassifierMessage } from '../src/message-origin.js';
import { Session } from '../src/session.js';
import { defaultConfig } from '../src/agent.js';
import { createTools } from '../src/tools.js';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 4000;
  while (!check()) { if (Date.now() >= deadline) throw new Error('Peer condition deadline'); await delay(10); }
}
function fixture(): string {
  const parent = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : fs.realpathSync(os.tmpdir());
  return fs.realpathSync(fs.mkdtempSync(path.join(parent, 'pg-')));
}

test('source peer reservations refill, refund once, credit held sends and bound sender state', () => {
  let at = 0;
  const pacer = createPeerPacer(() => PEER_LIMITS, () => at);
  const first = pacer.reserve('target'); assert.equal(first.ok, true);
  if (!first.ok) throw new Error('First reserve');
  first.refund(); first.refund();
  for (let index = 0; index < 30; index++) assert.equal(pacer.reserve('target').ok, true);
  assert.deepEqual(pacer.reserve('target'), { ok: false, sentInBurst: 30 });
  at = 1999; assert.equal(pacer.reserve('target').ok, false);
  at = 2000; assert.equal(pacer.reserve('target').ok, true);
  pacer.credit('target'); assert.equal(pacer.reserve('target').ok, true);
  pacer.debit('target'); assert.equal(pacer.reserve('target').ok, false);
  assert.equal(pacer.reserve('other').ok, true);
  const ingress = createPeerIngressGuard(() => PEER_LIMITS, () => at), ownTokens = new Set(['self']);
  assert.deepEqual(ingress.admit({ senderKey: 'a', body: 'same', ownTokens }), { admitted: true });
  assert.deepEqual(ingress.admit({ senderKey: 'a', body: 'same', ownTokens }), { admitted: false, reason: 'duplicate' });
  assert.deepEqual(ingress.admit({ senderKey: 'b', body: 'same', ownTokens }), { admitted: true });
  assert.deepEqual(ingress.admit({ senderKey: 'a', body: 'other', ownTokens }), { admitted: true });
  assert.deepEqual(ingress.admit({ senderKey: 'a', body: 'same', ownTokens }), { admitted: true });
  assert.deepEqual(ingress.checkHopChain(Array(10).fill('self'), ownTokens), { admitted: false, reason: 'hop-loop' });
  assert.deepEqual(ingress.checkHopChain(Array(29).fill('foreign'), ownTokens), { admitted: false, reason: 'hop-runaway' });
  for (let index = 0; index < 300; index++) ingress.admit({ senderKey: String(index), body: 'bounded', ownTokens });
  assert.equal(ingress.trackedSenderCount(), 256);
  const token = peerHopToken('uds:/owned/inbox.sock');
  assert.match(token, /^[0-9a-f]{24}$/); assert.equal(peerHopToken('uds:/owned/inbox.sock'), token);
  assert.equal(appendPeerHop(undefined, token), undefined);
  assert.deepEqual(appendPeerHop([], token), [token]);
  assert.equal(appendPeerHop(Array(32).fill('foreign'), token)?.length, 32);
});

test('source peer ingress rejects duplicates, relay loops and full queues before held publication', async () => {
  const directory = fixture(), received: AcceptedMessage[] = [];
  let policy: 'accept' | 'hold' = 'accept', queued = 0;
  const mode = () => ({ mode: 'default' });
  const a = await createLocalPeerTransport({ userDir: directory, workspace: directory, socketPath: path.join(directory, 'a.sock'), mode, onEvent: () => {} });
  const b = await createLocalPeerTransport({ userDir: directory, workspace: directory, socketPath: path.join(directory, 'b.sock'),
    mode, policy: () => policy, queuedPeerCount: () => queued, onEvent: event => { if (event.kind === 'message') received.push(event.message); } });
  try {
    await a.send(b.address, 'same'); await until(() => received.length === 1);
    const duplicate = await a.send(b.address, 'same');
    assert.equal((await a.waitStatus(duplicate.msgId, 3000))?.status, 'dropped');
    assert.equal(received.length, 1);
    policy = 'hold';
    const held = await a.send(b.address, 'held at capacity'); await until(() => b.held().length === 1);
    queued = 50;
    assert.equal(await b.resolveHeld(held.msgId, 'approve'), 'dropped-by-guard');
    assert.equal((await a.waitStatus(held.msgId, 3000))?.status, 'dropped');
    assert.equal(received.length, 1);
    policy = 'accept'; queued = 0;
    await sendPeerFrame(b.address, { type: 'user', from: a.address, msg_id: 'relay_loop', hop_chain: Array(10).fill(peerHopToken(b.address)),
      message: { role: 'user', content: 'loop' } }, { userDir: directory });
    await until(() => a.status('relay_loop') !== undefined); assert.equal(a.status('relay_loop')?.status, 'dropped');
    await sendPeerFrame(b.address, { type: 'user', from: a.address, msg_id: 'relay_long', hop_chain: Array(29).fill('a'.repeat(24)),
      message: { role: 'user', content: 'runaway' } }, { userDir: directory });
    await until(() => a.status('relay_long') !== undefined); assert.equal(a.status('relay_long')?.status, 'dropped');
    const recovered = await a.send(b.address, 'recovered'); await until(() => received.length === 2);
    assert.deepEqual(received.map(message => message.text), ['same', 'recovered']);
    assert.equal(a.status(recovered.msgId), undefined);
    const dead = 'uds:' + path.join(directory, 'dead.sock');
    for (let index = 0; index < 31; index++) await assert.rejects(a.send(dead, 'no effect'), /cannot be inspected/);
  } finally { await b.close(); await a.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('peer drop receipts coalesce with bounded shutdown and relay provenance survives cold journals', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const receipts: string[][] = [], reports: string[] = [];
  const reporter = createPeerDropReporter(value => reports.push(value.reason));
  reporter.noteDropForReceipt('a', 'one', ids => { receipts.push(ids); }, 60_000);
  reporter.noteDropForReceipt('a', 'two', ids => { receipts.push(ids); }, 60_001);
  reporter.noteDropForReceipt('a', 'three', ids => { receipts.push(ids); }, 60_002);
  assert.deepEqual([...receipts], [[]]);
  t.mock.timers.tick(4999); assert.equal(receipts.length, 1);
  t.mock.timers.tick(1); assert.deepEqual(receipts, [[], ['two', 'three']]);
  reporter.report({ from: 'a', reason: 'duplicate' }, 60_000);
  reporter.report({ from: 'a', reason: 'duplicate' }, 60_001);
  assert.deepEqual(reports, ['duplicate']);
  reporter.noteDropForReceipt('a', 'four', ids => { receipts.push(ids); }, 60_003);
  await reporter.flushPendingReceipts(); reporter.dispose();
  assert.deepEqual(receipts, [[], ['two', 'three'], ['four']]);
  t.mock.timers.reset();
  const directory = fixture(), token = 'a'.repeat(24), config = defaultConfig(directory, createTools());
  config.model = 'test';
  const session = Session.open(directory, { config });
  const id = session.id;
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'peer body' }, classifier: { origin: { kind: 'peer', source: 'uds', hopChain: [token] } } });
    session.append({ kind: 'message', message: markClassifierMessage({ role: 'user', content: 'result' }, { origin: { kind: 'generated', source: 'tool-results' } }) });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    assert.deepEqual(latestPeerHopChain(session.messages), [token]);
    await session.close();
    const cold = Session.open(directory, { id });
    try { assert.deepEqual(latestPeerHopChain(cold.messages), [token]); cold.append({ kind: 'message', message: { role: 'user', content: 'human reset' }, classifier: { origin: { kind: 'human' } } });
      assert.equal(latestPeerHopChain(cold.messages), undefined);
    } finally { await cold.close(); }
  } finally { await session.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
