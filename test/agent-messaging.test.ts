import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { createAgentNames } from '../src/agent-names-source.js';
import { createAgentResolver } from '../src/agent-resolver-source.js';
import { createUnifiedAgentTools } from '../src/agent-messaging.js';
import type { AgentResolverState } from '../src/agent-messaging-host.js';
import { createLocalPeerTransport, type InboundPolicy, type LocalPeerTransport } from '../src/local-peer.js';
import { createRuntime, parseSettings } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session, managedPolicySchema, type SessionConfig } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'um-')));
const response = (text: string): Anthropic.Message => ({ id: 'owned', model: 'fixture', type: 'message', role: 'assistant',
  container: null, diagnostics: null, stop_details: null, content: [{ type: 'text', text, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null,
    inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } });
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Unified messaging condition timed out'); await delay(10); }
}

test('source names preserve child precedence, explicit refs, local pin ambiguity and Unicode limits', () => {
  const names = createAgentNames({ sessionId: () => 'owner', socket: () => '/own.sock' });
  const state: AgentResolverState = { agentNameRegistry: new Map([['worker', 'child']]), tasks: {
    child: { id: 'child', type: 'local_agent', agentType: 'general', status: 'running', startTime: 1 },
  }, sendMessagePins: Object.create(null) };
  const records = ['/a.sock', '/b.sock'].map(sock => ({ sock, cwd: '/work', name: 'same', pid: 42, startedAt: 1, spare: false }));
  records.push({ sock: '/worker.sock', cwd: '/work', name: 'worker', pid: 42, startedAt: 1, spare: false });
  const index = names.index(state, { teamFile: null, sessions: records, cloud: [], bridge: [] });
  const resolver = createAgentResolver({ names, isChildId: id => id === 'child' });
  const availability = { bridgeSettled: true, cloudUnavailable: false, bridgeUnavailable: false, localUnavailable: false,
    localClaimedRemoteBodies: new Set<string>(), socksMirroredRemotely: new Set<string>(), searchTruncated: false } satisfies Parameters<typeof resolver.exact>[4];
  assert.equal(names.key('  ＷORKER​ '), 'worker');
  assert.equal(names.clean('😀'.repeat(201)), '😀'.repeat(200));
  assert.deepEqual(resolver.exact(index, 'worker', 'worker', state, availability), { kind: 'agent-live', agentId: 'child', agentName: 'worker' });
  const peers = index.byName.get('same')!; assert.equal(peers.length, 2); assert.notEqual(peers[0]!.ref, peers[1]!.ref);
  assert.equal(resolver.byRef(index, 'same', peers[1]!.ref)?.id, '/b.sock');
  assert.equal(resolver.exact(index, 'same', 'same', state, availability)?.kind, 'ambiguous');
  state.sendMessagePins.same = { id: '/a.sock', name: 'same', sock: '/a.sock', ref: peers[0]!.ref };
  const pinned = resolver.exact(index, 'same', 'same', state, availability);
  assert.equal(pinned?.kind, 'local-session'); if (pinned?.kind === 'local-session') assert.equal(pinned.sock, '/a.sock');
  assert.equal(resolver.prefix(index, 'wor', state, availability)?.kind, 'agent-live');
});

test('unified tools route children and authenticated peers, preserve pure subscriptions and cold recipient pins', async () => {
  const root = temporary(), calls: string[] = [], received: string[] = [], notices: string[] = [];
  const config = { ...defaultConfig(root, []), model: 'fixture', features: { tasks: true, subagents: true, agentMessaging: true, agentIdle: true, unifiedAgentMessaging: true } };
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls.push(String(request.messages.at(-1)?.content)); return response('done');
  } };
  const registry = new AgentRegistry({ source: () => config, tools: [], provider });
  let session = Session.open(root, { config }), current = true;
  const owner = session.id;
  let a: LocalPeerTransport | undefined, b: LocalPeerTransport | undefined;
  const inbox = (id: string) => ({ enabled: () => true, conversation: () => id, queueLength: () => 0, lastText: () => '',
    onNotice: (_notice: unknown, text: string) => notices.push(text), enqueue: () => {} });
  try {
    a = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'a.sock'), name: 'sender',
      policy: () => 'accept', idleHost: inbox(owner), onEvent: () => {} });
    b = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'b.sock'), name: 'peer',
      policy: () => 'accept', idleHost: inbox('peer'), onEvent: event => { if (event.kind === 'message') received.push(event.message.text); } });
    a.setIdleStatus('idle'); b.setIdleStatus('busy');
    const child = await registry.launch({ prompt: 'seed', mode: 'general', name: 'child' });
    const make = () => createUnifiedAgentTools(registry, { owner, peer: () => a, session: () => session, idle: true,
      assertCurrent: () => { if (!current) throw new Error('released'); } });
    const tools = make(), context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
    const list = tools.find(tool => tool.schema.name === 'list_agents')!, send = tools.find(tool => tool.schema.name === 'send_message')!;
    const listing = JSON.parse(await list.execute({}, context));
    assert.deepEqual(listing.sections.map((section: { kind: string }) => section.kind), ['subagents', 'sessions']);
    assert.match(listing.listing, /Subagents[\s\S]*child \[[0-9a-f]+\][\s\S]*Peer sessions[\s\S]*peer \[[0-9a-f]+\]/);
    assert.equal(JSON.parse(await send.execute({ id: 'child', message: 'child followup' }, context)).id, child.id);
    await registry.get(child.id, { waitMs: 5000 }); assert.equal(calls.includes('child followup'), true);
    const delivered = JSON.parse(await send.execute({ id: 'peer', message: '/literal peer data', notify_when_idle: true }, context));
    assert.equal(delivered.success, true); assert.equal(delivered.subscription.success, true);
    await until(() => received.length === 1); assert.equal(received[0], '/literal peer data');
    b.setIdleStatus('idle'); await until(() => notices.length === 1);
    assert.equal(session.events.filter(event => event.kind === 'agent_message_pin').length, 2);
    session.close(); session = Session.open(root, { id: owner });
    assert.equal(session.events.filter(event => event.kind === 'agent_message_pin').length, 2);
    const namesake = await registry.launch({ prompt: 'namesake', name: 'peer', mode: 'general' });
    const rebound = JSON.parse(await make().find(tool => tool.schema.name === 'send_message')!.execute({ id: 'peer', message: 'wrong child' }, context));
    assert.equal(rebound.reason, 'recipient-rebound'); assert.equal(calls.includes('wrong child'), false); assert.equal(received.length, 1);
    const directChild = JSON.parse(await send.execute({ id: namesake.id, message: 'explicit child ID' }, context));
    assert.equal(directChild.id, namesake.id); await registry.get(namesake.id, { waitMs: 5000 });
    assert.equal(calls.filter(text => text === 'explicit child ID').length, 1);
    const direct = JSON.parse(await send.execute({ id: b.address, notify_when_idle: true }, context)); assert.equal(direct.success, true);
    await until(() => notices.length === 2); assert.equal(received.length, 1);
    const sender = a, unicodeName = '\u{1f600}'.repeat(200);
    const unicodePeer = { ...sender, records: async () => (await sender.records()).map(record => ({ ...record, name: unicodeName })) };
    const unicodeTools = createUnifiedAgentTools(registry, { owner, peer: () => unicodePeer, session: () => session, idle: true,
      assertCurrent: () => { if (!current) throw new Error('released'); } });
    const unicodeResult = JSON.parse(await unicodeTools.find(tool => tool.schema.name === 'send_message')!.execute({ id: unicodeName, message: 'unicode peer' }, context));
    assert.equal(unicodeResult.success, true); await until(() => received.length === 2);
    assert.equal(session.events.findLast(event => event.kind === 'agent_message_pin')?.kind, 'agent_message_pin');
    session.close(); session = Session.open(root, { id: owner });
    assert.equal(session.events.some(event => event.kind === 'agent_message_pin' && event.pin.name === unicodeName), true);
    for (const id of ['peer\nother', '\u{1f600}'.repeat(301)]) await assert.rejects(send.execute({ id, message: 'invalid' }, context), /Invalid/);
    current = false; await assert.rejects(list.execute({}, context), /released/);
  } finally { await registry.close(); await b?.close(); await a?.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime binds the current peer owner and retains original schemas and managed feature pins', async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', features: { tasks: true, subagents: true, agentMessaging: true, agentIdle: true, unifiedAgentMessaging: true } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => response('done') };
  const runtime = await createRuntime(config, provider, controller.signal), session = Session.open(root, { config });
  let peer: LocalPeerTransport | undefined;
  try {
    await runtime.bindSession!(session);
    peer = await createLocalPeerTransport({ userDir: root, workspace: root, socketPath: path.join(root, 'b.sock'), onEvent: () => {} });
    const retained = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'list_agents')!;
    const context = { workspace: root, signal: controller.signal, allowShell: false, maxOutputBytes: 24000 };
    assert.deepEqual(JSON.parse(await retained.execute({}, context)).sections, []);
    runtime.bindPeerMessaging!(session.id, peer);
    let continueRecords!: (records: Awaited<ReturnType<LocalPeerTransport['records']>>) => void;
    const waitingRecords = new Promise<Awaited<ReturnType<LocalPeerTransport['records']>>>(resolve => { continueRecords = resolve; });
    runtime.bindPeerMessaging!(session.id, { ...peer, records: () => waitingRecords });
    const lateList = retained.execute({}, context), lateSend = runtime.buildTools(session.config, session.id)
      .find(tool => tool.schema.name === 'send_message')!.execute({ id: peer.address, message: 'NEVER_SEND_RELEASED' }, context);
    const listRejection = assert.rejects(lateList, /released|aborted/), sendRejection = assert.rejects(lateSend, /released|aborted/);
    assert.equal(parseSettings({ features: { unifiedAgentMessaging: true } }).features?.unifiedAgentMessaging, true);
    assert.equal(managedPolicySchema.parse({ features: { unifiedAgentMessaging: false } }).features?.unifiedAgentMessaging, false);
    assert.equal(reloadConfig(config).features?.unifiedAgentMessaging, true);
    const legacy = { ...config, features: { ...config.features, unifiedAgentMessaging: false } };
    const legacyTools = runtime.buildTools(legacy, 'legacy');
    assert.equal(legacyTools.find(tool => tool.schema.name === 'list_agents')!.schema.description, "List this session owner's children, statuses, session IDs, names, summaries and errors.");
    const original: SessionConfig = { ...legacy, features: { ...legacy.features } }; delete original.features!.unifiedAgentMessaging;
    assert.deepEqual(runtime.buildTools(original, 'original').map(tool => tool.schema), legacyTools.map(tool => tool.schema));
    await runtime.releaseSession!(session.id); continueRecords([]);
    await Promise.all([listRejection, sendRejection]);
    await assert.rejects(retained.execute({}, context), /released|aborted/);
  } finally { await runtime.close(); await peer?.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
