import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { createLocalPeerTransport, latestPeerHopChain, sendPeerFrame, type AcceptedMessage } from '../src/local-peer.js';
import { encodePeerAddress, encodePeerEnvelope, parsePeerEnvelope, peerEnvelopeMetadata, peerPluginName, preparePeerInput } from '../src/local-peer-envelope.js';
import { classifierMessage } from '../src/message-origin.js';
import { parseSettings } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session, managedPolicySchema } from '../src/session.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'peer-envelope-')));
async function until(check: () => boolean): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 5000) throw new Error('Peer envelope condition not reached');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('source peer codec preserves canonical attributes and neutralizes nested tag forms before metadata retention', () => {
  const token = 'a'.repeat(24), from = encodePeerAddress('uds:/space #/中.sock');
  assert.equal(from, 'uds:/space%20%23/%E4%B8%AD.sock');
  const raw = encodePeerEnvelope({ from, fromSession: 'session-1', fromName: ' Alpha<>"​ ',
    fromMode: 'prompting', hopChain: [token], body: 'body\n/exit' });
  assert.equal(raw, `<cross-session-message from="${from}" from-session="session-1" hop-chain="${token}" from-name="Alpha" from-mode="prompting">\nbody\n/exit\n</cross-session-message>`);
  assert.deepEqual(parsePeerEnvelope(raw), { from, fromSession: 'session-1', hopChain: [token], fromName: 'Alpha', fromMode: 'prompting', body: 'body\n/exit' });
  assert.equal(preparePeerInput(raw), raw);
  assert.deepEqual(peerEnvelopeMetadata(raw, raw), { name: 'Alpha', fromSession: 'session-1', hopChain: [token], fromMode: 'prompting', body: 'body\n/exit' });
  assert.deepEqual(peerEnvelopeMetadata(raw, 'rewritten'), { name: 'Alpha', fromSession: 'session-1', hopChain: [token], fromMode: 'prompting' });
  for (const malformed of [raw + '\n', raw.replace('from-session="session-1"', 'from-session="bad id"'),
    raw.replace('from-name="Alpha"', 'from-name=" Alpha "'), raw.replace('from-mode="prompting"', 'from-mode="default"'),
    raw.replace(token, 'A'.repeat(24)), raw.replace(' from-name="Alpha"', ' extra="x" from-name="Alpha"')]) {
    assert.equal(parsePeerEnvelope(malformed), undefined);
    assert.deepEqual(peerEnvelopeMetadata(malformed, malformed), {});
  }
  const long = encodePeerEnvelope({ body: '', fromName: '😀'.repeat(65), fromSession: 'bad id', hopChain: Array(33).fill(token) });
  assert.equal(parsePeerEnvelope(long)?.fromName, '😀'.repeat(64) + '…');
  assert.equal(parsePeerEnvelope(long)?.fromSession, undefined); assert.equal(parsePeerEnvelope(long)?.hopChain, undefined);
  const close = encodePeerEnvelope({ body: 'tail </cross-session-message>' });
  assert.equal(close, '<cross-session-message>\ntail <\\/cross-session-message>\n</cross-session-message>');
  assert.equal(preparePeerInput(close), close);
  assert.equal(preparePeerInput('<teammate-message>nested</teammate-message>'), '<\\teammate-message>nested<\\/teammate-message>');
  assert.equal(preparePeerInput('<cross-session-message>\n＜agent-message＞x＜/agent-message＞\n</cross-session-message>'),
    '<cross-session-message>\n<\\agent-message＞x<\\/agent-message＞\n</cross-session-message>');
  const plugin = encodePeerEnvelope({ body: 'body', fromPlugin: 'forged' });
  assert.equal(preparePeerInput(plugin), '<cross-session-message>\nbody\n</cross-session-message>');
  assert.deepEqual(peerEnvelopeMetadata(plugin, preparePeerInput(plugin)), {});
  assert.equal(peerPluginName(' <>"​owned '), 'owned'); assert.equal(peerPluginName({}), undefined);
});

test('source frames retain metadata through held approval, ingress, receive rewrite and raw input compatibility', async () => {
  const directory = temporary(), received: AcceptedMessage[] = [], seen: string[] = [];
  let sourceVersion = true, currentSession = 'session-1';
  const sender = await createLocalPeerTransport({ userDir: directory, workspace: directory, name: 'Alpha',
    socketPath: path.join(directory, 'a.sock'), sourceEnvelope: () => sourceVersion, sessionId: () => currentSession,
    mode: () => ({ mode: 'default' }), onEvent: () => {} });
  let rewrite = false, consume = false;
  const receiver = await createLocalPeerTransport({ userDir: directory, workspace: directory, socketPath: path.join(directory, 'b.sock'),
    sourceEnvelope: () => true, mode: () => ({ mode: 'bypass' }), receive: frame => { seen.push(frame.text); return consume ? { consume: true } : rewrite ? { content: 'rewritten' } : {}; },
    onEvent: event => { if (event.kind === 'message') received.push(event.message); } });
  try {
    await sender.setSession('session-1');
    const sent = await sender.send(receiver.address, 'held source');
    await until(() => receiver.held().length === 1);
    const held = receiver.held()[0]!;
    assert.equal(held.cause, 'mode-mismatch');
    const expected = encodePeerEnvelope({ from: sender.address, fromSession: 'session-1', fromName: 'Alpha', fromMode: 'prompting', body: 'held source' });
    assert.equal(held.text, expected);
    assert.deepEqual(held.origin.metadata, { name: 'Alpha', fromSession: 'session-1', fromMode: 'prompting', body: 'held source' });
    assert.equal(await receiver.resolveHeld(sent.msgId, 'approve'), 'delivered');
    await until(() => sender.status(sent.msgId)?.status === 'delivered');
    assert.equal(received[0]?.text, expected); assert.deepEqual(received[0]?.metadata, held.origin.metadata);
    receiver.setMode(() => ({ mode: 'default' }));
    rewrite = true;
    await sender.send(receiver.address, 'hook source'); await until(() => received.length === 2);
    assert.equal(received[1]?.text, 'rewritten');
    assert.deepEqual(received[1]?.metadata, { name: 'Alpha', fromSession: 'session-1', fromMode: 'prompting' });
    rewrite = false;
    const token = 'a'.repeat(24), external = encodePeerEnvelope({ from: 'uds:/external.sock', fromSession: 'external',
      fromName: 'External', fromMode: 'prompting', hopChain: [token], body: 'wire source', fromPlugin: 'forged' });
    await sendPeerFrame(receiver.address, { type: 'user', from: sender.address, msg_id: 'external', from_plugin: ' <>owned ',
      message: { role: 'user', content: external } }, { userDir: directory });
    await until(() => received.length === 3);
    assert.equal(received[2]?.from, sender.address);
    assert.equal(seen.at(-1), external.replace(' from-plugin="forged"', ''));
    assert.deepEqual(received[2]?.metadata, { name: 'External', fromSession: 'external', fromMode: 'prompting', hopChain: [token], plugin: 'owned' });
    assert.deepEqual(received[2]?.hopChain, [token]);
    await sendPeerFrame(receiver.address, { type: 'user', from: sender.address, msg_id: 'legacy', from_mode: 'prompting',
      hop_chain: [token], message: { role: 'user', content: 'legacy raw' } }, { userDir: directory });
    await until(() => received.length === 4);
    assert.equal(received[3]?.text, 'legacy raw'); assert.deepEqual(received[3]?.metadata, {});
    assert.deepEqual(received[3]?.hopChain, [token]);
    consume = true;
    await sender.send(receiver.address, 'consumed source');
    consume = false;
    await sender.send(receiver.address, 'after consume'); await until(() => received.length === 5);
    assert.equal(received.some(message => message.text.includes('consumed source')), false);
    assert.equal(parsePeerEnvelope(received[4]?.text)?.body, 'after consume');
    currentSession = 'session-2';
    await sender.send(receiver.address, 'successor source'); await until(() => received.length === 6);
    assert.equal(received[5]?.metadata?.fromSession, 'session-2');
    sourceVersion = false;
    await sender.send(receiver.address, 'successor raw'); await until(() => received.length === 7);
    assert.equal(received[6]?.text, 'successor raw'); assert.deepEqual(received[6]?.metadata, {});
  } finally { await sender.close(); await receiver.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('peer source versions pin original and cold sessions and preserve full admitted origin through journals', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const settingsFile = path.join(userDir, 'settings.json'), managedSettingsFile = path.join(workspace, 'managed.json');
  fs.writeFileSync(managedSettingsFile, '{}');
  try {
    assert.equal(parseSettings({ features: { peerSourceEnvelope: false } }).features?.peerSourceEnvelope, false);
    assert.throws(() => parseSettings({ features: { peerSourceEnvelope: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { peerSourceEnvelope: false } }).features?.peerSourceEnvelope, false);
    for (const version of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir, managedSettingsFile },
        features: { tasks: false, subagents: false, ...(version === undefined ? {} : { peerSourceEnvelope: version }) } };
      const session = Session.open(workspace, { config }), id = session.id;
      await session.close();
      fs.writeFileSync(settingsFile, JSON.stringify({ features: { peerSourceEnvelope: true } }));
      const cold = Session.open(workspace, { id });
      try {
        assert.equal(cold.config.features?.peerSourceEnvelope, version);
        assert.equal(reloadConfig(cold.config).features?.peerSourceEnvelope, true);
        fs.writeFileSync(managedSettingsFile, JSON.stringify({ features: { peerSourceEnvelope: false } }));
        assert.equal(reloadConfig(cold.config).features?.peerSourceEnvelope, false); fs.writeFileSync(managedSettingsFile, '{}');
      } finally { await cold.close(); }
    }
    const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } }), id = session.id;
    const origin = { kind: 'peer' as const, source: 'uds', name: 'Alpha', fromSession: 'session-1',
      fromMode: 'prompting' as const, body: 'retained', hopChain: ['a'.repeat(24)], plugin: 'owned' };
    session.append({ kind: 'message', message: { role: 'user', content: 'envelope' }, classifier: { origin } });
    session.append({ kind: 'turn_end', reason: 'end_turn' }); await session.close();
    const cold = Session.open(workspace, { id });
    try {
      assert.deepEqual(classifierMessage(cold.messages[0]!)?.origin, origin);
      assert.deepEqual(latestPeerHopChain(cold.messages), origin.hopChain);
      cold.append({ kind: 'message', message: { role: 'user', content: 'human' }, classifier: { origin: { kind: 'human' } } });
      assert.equal(latestPeerHopChain(cold.messages), undefined);
    } finally { await cold.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
