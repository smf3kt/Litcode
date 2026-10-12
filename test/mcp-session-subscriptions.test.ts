import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { commitMcpSubscription, mcpSubscriptionState } from '../src/mcp-session-subscriptions.js';

test('subscription journal retains exact acknowledged intent across restart and isolates new sessions', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-journal-')));
  const config = defaultConfig(workspace, []); config.model = "fixture/model";
  config.features = { tasks: false, subagents: false, mcpSubscriptions: true, mcpRecovery: true, mcpPersistence: true };
  config.mcpServers = { srv: { type: 'http', url: 'http://127.0.0.1:1234/mcp', headersEnv: { Authorization: 'FIXTURE_HEADER_REFERENCE' } } };
  let session = Session.open(workspace, { config });
  try {
    const uri = 'fixture://notes%2fExact';
    commitMcpSubscription(session, 'srv', 'resources/subscribe', uri);
    commitMcpSubscription(session, 'srv', 'resources/subscribe', 'fixture://cancelled');
    commitMcpSubscription(session, 'srv', 'resources/unsubscribe', 'fixture://cancelled');
    const id = session.id; session.close(); session = Session.open(workspace, { id });
    assert.deepEqual(mcpSubscriptionState(session).srv, [uri]);
    assert.equal(session.awaitingResponse, false);
    const next = Session.open(workspace, { config });
    try { assert.deepEqual(Object.keys(mcpSubscriptionState(next)), []); } finally { next.close(); }
    session.config.mcpServers!.srv = { type: 'http', url: 'http://127.0.0.1:4321/mcp' };
    assert.throws(() => mcpSubscriptionState(session), /digest mismatch/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('subscription journal enforces gates, URI bounds and durable append failures', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-journal-gates-')));
  const config = defaultConfig(workspace, []); config.model = "fixture/model";
  config.features = { tasks: false, subagents: false, mcpSubscriptions: true, mcpRecovery: true, mcpPersistence: true };
  config.mcpServers = { srv: { type: 'http', url: 'http://127.0.0.1:1234/mcp' } };
  const session = Session.open(workspace, { config });
  try {
    assert.throws(() => commitMcpSubscription(session, 'unknown', 'resources/subscribe', 'fixture://one'), /absent/);
    assert.throws(() => commitMcpSubscription(session, 'srv', 'resources/subscribe', 'bad uri'), /URI/);
    for (let i = 0; i < 32; i++) commitMcpSubscription(session, 'srv', 'resources/subscribe', `fixture://${i}`);
    assert.throws(() => commitMcpSubscription(session, 'srv', 'resources/subscribe', 'fixture://overflow'), /limit/);
    commitMcpSubscription(session, 'srv', 'resources/unsubscribe', 'fixture://0');
    commitMcpSubscription(session, 'srv', 'resources/subscribe', 'fixture://replacement');
    const original = session.append;
    session.append = () => { throw new Error('owned fsync failure'); };
    assert.throws(() => commitMcpSubscription(session, 'srv', 'resources/unsubscribe', 'fixture://1'), /fsync/);
    session.append = original;
    assert(mcpSubscriptionState(session).srv.includes('fixture://1'));
    session.config.features!.mcpPersistence = false;
    assert.deepEqual(Object.keys(mcpSubscriptionState(session)), []);
    assert.throws(() => commitMcpSubscription(session, 'srv', 'resources/subscribe', 'fixture://new'), /disabled/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
