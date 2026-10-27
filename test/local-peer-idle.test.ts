import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createSourcePeerIdle } from '../src/peer-idle-state-source.js';
import { createPeerIdleIdentity } from '../src/peer-idle-identity-source.js';
import { kg, u6 } from '../src/peer-idle-log-source.js';
import type { PeerIdleNotice, PeerIdleSourceHost, PeerIdleWireNotice } from '../src/peer-idle-host.js';
import { LocalPeerIdle, type PeerIdleHost } from '../src/local-peer-idle.js';
import { createLocalPeerTransport, createLocalPeerTools, PeerSendRefusal, sendPeerFrame, type InboundPolicy } from '../src/local-peer.js';
import { defaultConfig } from '../src/agent.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { parseSettings } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';

const immediate = () => new Promise<void>(resolve => setImmediate(resolve));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean): Promise<void> {
  const started = Date.now();
  while (!predicate()) { if (Date.now() - started > 5000) throw new Error('Idle notice condition not reached'); await delay(10); }
}
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'pi-')));

function stateHost(): PeerIdleSourceHost {
  return { conversation: () => 'conversation', canonicalTarget: target => path.resolve(target), policy: () => 'accept', admission: () => 'accept',
    queueLength: () => 0, heldCount: () => 0, enabled: () => true, refusalClass: PeerSendRefusal, errorKind: () => 'other',
    log: () => {}, reportError: error => { throw error; }, safeText: text => text, safeError: text => text, enqueue: () => {} };
}

test('idle state preserves queue and held gates, revalidation, one retry, correlation and twelve-hour expiry', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let queued = 1, held = 0, conversation = 'conversation', failures = 0;
  const sent: PeerIdleWireNotice[] = [], notices: PeerIdleNotice[] = [];
  const host = stateHost(); host.queueLength = () => queued; host.heldCount = () => held; host.conversation = () => conversation;
  const source = createSourcePeerIdle(host);
  source.onNotice(notice => notices.push(notice));
  source.sender(async (_target, notice) => { if (failures++ === 0) throw new PeerSendRefusal('endpoint-unverifiable', 'retry'); sent.push(notice); });
  source.registeredInboxes(async () => new Map([[42, '/requester.sock']]));
  source.lastText(() => 'Result: finished <work>\n');
  const msg = crypto.randomUUID();
  try {
    assert.equal(source.recordSubscriber('uds:/requester.sock', '/requester.sock', msg, 42, undefined, true, 'prompting', false), 'recorded');
    source.status(false, true); source.status(true, false);
    t.mock.timers.tick(750); await immediate(); assert.equal(sent.length, 0);
    queued = 0; held = 1; t.mock.timers.tick(750); await immediate(); assert.equal(sent.length, 0);
    held = 0; t.mock.timers.tick(30_000); await immediate(); assert.equal(sent.length, 0);
    t.mock.timers.tick(750); await immediate(); assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], { orig_msg_id: msg, state: 'idle', finished_at: 1000, detail: 'finished work' });
    t.mock.timers.tick(60_000); await immediate(); assert.equal(sent.length, 1);
    const outgoing = crypto.randomUUID(); assert.equal(source.track(outgoing, '<Target> [Cross-session idle notice]', '/target.sock').ok, true);
    assert.equal(source.receive(outgoing, 'idle', Infinity, 'Result: ready', 'prompting', false), true);
    assert.equal(source.receive(outgoing, 'idle', 1, 'duplicate', 'prompting', false), false);
    assert.equal(notices[0]?.label, 'Target'); assert.equal(notices[0]?.finishedAt, undefined); assert.equal(notices[0]?.modelVisible, true);
    const stale = crypto.randomUUID(); source.track(stale, 'stale', '/target.sock'); conversation = 'successor';
    source.receive(stale, 'idle', 1, 'old', 'prompting', false); assert.equal(notices.length, 1);
    const expiring = crypto.randomUUID(); source.track(expiring, 'expires', '/another.sock');
    t.mock.timers.tick(43_199_999); await immediate(); assert.equal(notices.length, 1);
    t.mock.timers.tick(1); await immediate(); assert.equal(notices[1]?.kind, 'expired'); assert.equal(source.has(expiring), false);
    let revoke = false;
    const revalidation = createSourcePeerIdle({ ...host, queueLength: () => 0, policy: () => revoke ? 'refuse' : 'accept' });
    try {
      let resolveRegistry: ((value: Map<number, string>) => void) | undefined;
      revalidation.sender(async () => { assert.fail('revoked subscriber must receive no detail or notice'); });
      revalidation.registeredInboxes(() => new Promise(resolve => { resolveRegistry = resolve; }));
      revalidation.recordSubscriber('uds:/x.sock', '/x.sock', crypto.randomUUID(), 42, undefined, true, 'prompting', false);
      revalidation.status(false, true); revalidation.status(true, false);
      const flush = revalidation.flush('idle'); assert.ok(resolveRegistry); revoke = true; resolveRegistry(new Map([[42, '/x.sock']])); await flush;
    } finally { revalidation.reset(); }
    assert.equal(kg('token=private'), '(withheld)'); assert.equal(u6('token=private'), '(redacted: fragment may carry an auth token)');
    assert.doesNotMatch(kg('a'.repeat(32)), /a{32}/);
    let tokenReads = 0, runs = 0;
    const identity = createPeerIdleIdentity({ readStartToken: async () => { tokenReads++; return 'birth'; },
      run: async () => { runs++; return { code: 0, stdout: `${process.pid}\nEND\n` }; } });
    const principal = { verifiedPeerPid: 42, childTokenPresented: false, needsVerdict: true, platform: 'macos' };
    assert.equal(await identity(principal), true); assert.equal(runs, 1); assert.equal(tokenReads, 2);
    assert.equal(await identity(principal), true); assert.equal(runs, 1); assert.equal(tokenReads, 3);
    assert.equal(await identity({ ...principal, needsVerdict: false, childTokenPresented: true }), false);
  } finally { source.reset(); t.mock.timers.reset(); }
});

test('idle host filters cleared conversations, coalesces model notices and preserves original feature pins', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  let conversation = 'first', policy: InboundPolicy = 'accept';
  const displayed: PeerIdleNotice[] = [], prompts: string[] = [];
  const root = temporary(), config = { ...defaultConfig(root, []), model: 'fixture' };
  const host: PeerIdleHost = { enabled: () => true, conversation: () => conversation, queueLength: () => 0, lastText: () => '',
    onNotice: notice => displayed.push(notice), enqueue: text => prompts.push(text) };
  const local = new LocalPeerIdle({ host, userDir: root, address: 'uds:/a.sock', heldCount: () => 0,
    policy: () => policy, mode: () => ({ mode: 'default' }), logger: () => {} });
  try {
    const stale = crypto.randomUUID(); local.source.track(stale, 'old', '/old.sock');
    local.source.receive(stale, 'idle', 1, 'stale', 'prompting', false); conversation = 'second';
    t.mock.timers.tick(500); assert.equal(displayed.length, 0); assert.equal(prompts.length, 0);
    policy = 'hold'; const held = crypto.randomUUID(); local.source.track(held, 'held', '/held.sock');
    local.source.receive(held, 'idle', 1, 'private', 'prompting', false); t.mock.timers.tick(500);
    assert.equal(displayed[0]?.modelVisible, false); assert.equal(displayed[0]?.detail, undefined); assert.equal(prompts.length, 0);
    policy = 'refuse'; const refused = crypto.randomUUID(); local.source.track(refused, 'refused', '/refused.sock');
    local.source.receive(refused, 'exited', 1, undefined, 'prompting', false); t.mock.timers.tick(500); assert.equal(displayed.length, 1);
    policy = 'accept';
    for (const label of ['one', 'two']) { const msg = crypto.randomUUID(); local.source.track(msg, label, `/${label}.sock`); local.source.receive(msg, 'idle', 1, label, 'prompting', false); }
    t.mock.timers.tick(499); assert.equal(prompts.length, 0); t.mock.timers.tick(1); assert.equal(prompts.length, 1);
    assert.match(prompts[0]!, /"one".*idle now[\s\S]*"two".*idle now/);
    assert.equal(parseSettings({ features: { peerIdleNotifications: true } }).features?.peerIdleNotifications, true);
    assert.equal(managedPolicySchema.parse({ features: { peerIdleNotifications: false } }).features?.peerIdleNotifications, false);
    assert.equal(reloadConfig(config).features?.peerIdleNotifications, true);
    const original = Session.open(root, { config }); const id = original.id; original.close();
    const cold = Session.open(root, { id });
    try { assert.equal(cold.config.features?.peerIdleNotifications, undefined); } finally { cold.close(); }
  } finally { local.dispose(); fs.rmSync(root, { recursive: true, force: true }); t.mock.timers.reset(); }
});

test('real local idle subscriptions are pure and one-shot, obey inbound policy, ignore unknown frames and settle before close', async () => {
  const root = temporary(); let policy: InboundPolicy = 'accept';
  const notices: PeerIdleNotice[] = [], prompts: string[] = [], subscriptions: string[] = [];
  const host = (name: string): PeerIdleHost => ({ enabled: () => true, conversation: () => name, queueLength: () => 0, lastText: () => 'Result: done',
    onNotice: notice => notices.push(notice), enqueue: text => prompts.push(text), onSubscribed: text => subscriptions.push(text) });
  const a = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'a.sock'), mode: () => ({ mode: 'default' }),
    idleHost: host('a'), policy: () => policy, onEvent: () => {} });
  const b = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'b.sock'), mode: () => ({ mode: 'default' }),
    idleHost: host('b'), onEvent: () => {} });
  const old = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'old.sock'), onEvent: () => {} });
  const signal = new AbortController().signal;
  try {
    a.setIdleStatus('idle'); b.setIdleStatus('busy');
    assert.equal(createLocalPeerTools(old).some(tool => tool.schema.name === 'subscribe_peer_idle'), false);
    assert.equal(createLocalPeerTools(a).some(tool => tool.schema.name === 'subscribe_peer_idle'), true);
    assert.deepEqual(await a.subscribeIdle(old.address, signal), { success: false, reason: 'peer-unsupported' });
    assert.deepEqual(await a.subscribeIdle(a.address, signal), { success: false, reason: 'self-target' });
    const first = await a.subscribeIdle(b.address, signal); assert.equal(first.success, true);
    await until(() => subscriptions.length === 1); assert.equal(notices.length, 0); assert.equal(prompts.length, 0);
    b.setIdleStatus('idle'); await until(() => notices.length === 1); assert.equal(notices[0]?.kind, 'idle'); assert.equal(prompts.length, 1);
    await sendPeerFrame(a.address, { type: 'control', action: 'peer_idle_notice', orig_msg_id: crypto.randomUUID(), state: 'idle' }, { userDir: root });
    if (first.success) await sendPeerFrame(a.address, { type: 'control', action: 'peer_idle_notice', orig_msg_id: first.msg_id, state: 'idle' }, { userDir: root });
    await delay(50); assert.equal(notices.length, 1);
    policy = 'hold'; b.setIdleStatus('busy'); await a.subscribeIdle(b.address, signal); b.setIdleStatus('idle');
    await until(() => notices.length === 2); assert.equal(notices[1]?.modelVisible, false); assert.equal(prompts.length, 1);
    policy = 'refuse'; assert.deepEqual(await a.subscribeIdle(b.address, signal), { success: false, reason: 'requester-refuses-inbound' });
    policy = 'accept'; b.setIdleStatus('waiting'); assert.equal((await a.subscribeIdle(b.address, signal)).success, true);
    await b.close(); await until(() => notices.length === 3); assert.equal(notices[2]?.kind, 'exited'); assert.equal(prompts.length, 2);
    assert.equal(fs.existsSync(b.address.slice(4)), false);
  } finally { await old.close(); await b.close(); await a.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
