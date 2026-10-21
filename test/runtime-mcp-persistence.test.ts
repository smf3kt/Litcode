import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';

const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };

test('durable runtime rejects other owners and cancels pending replacements without killing accepted replacements', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-mcp-journal-')));
  const controller = new AbortController();
  const sessions: Session[] = [];
  const runtimes: Runtime[] = [];
  const effects: string[] = [];
  const failures: unknown[] = [];
  let initialized = 0;
  let releaseInitialize: (() => void) | undefined;
  let initializationBlocked!: () => void;
  const blocked = new Promise<void>(resolve => { initializationBlocked = resolve; });
  const server = http.createServer((request, response) => {
    void (async () => {
      if (request.method !== 'POST') { response.writeHead(request.method === 'DELETE' ? 204 : 405); response.end(); return; }
      let text = '';
      for await (const chunk of request) { text += String(chunk); assert(text.length < 65536); }
      const body = JSON.parse(text);
      const reply = (result: unknown) => {
        if (response.destroyed) return;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      };
      if (body.method === 'initialize') {
        initialized++;
        if (initialized === 3) {
          initializationBlocked();
          await new Promise<void>(resolve => { releaseInitialize = resolve; });
        }
        reply({ protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: { subscribe: true } } });
      } else if (body.method === 'tools/list') reply({ tools: [] });
      else if (body.method === 'resources/subscribe' || body.method === 'resources/unsubscribe') {
        effects.push(body.params.uri); reply({});
      } else { response.writeHead(202); response.end(); }
    })().catch(error => { failures.push(error); response.destroy(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert(address && typeof address !== 'string');
    const config = defaultConfig(workspace, []); config.model = 'fixture';
    config.features = { tasks: false, subagents: false, mcpSubscriptions: true, mcpRecovery: true, mcpPersistence: true };
    config.mcpServers = { srv: { type: 'http', url: `http://127.0.0.1:${address.port}/mcp` } };
    const parent = Session.open(workspace, { config }); sessions.push(parent);
    const runtime = await createRuntime(config, provider, controller.signal); runtimes.push(runtime);
    assert.equal(await runtime.bindSession!(parent), runtime);
    const context = { workspace, signal: controller.signal, allowShell: false, maxOutputBytes: config.maxOutputBytes };
    const otherTools = runtime.buildTools(config, 'other-owner');
    await assert.rejects(otherTools.find(tool => tool.schema.name === 'mcp_resource_subscribe')!.execute({ server: 'srv', uri: 'fixture://wrong-owner' }, context), /journal owner/);
    await assert.rejects(otherTools.find(tool => tool.schema.name === 'mcp_reconnect')!.execute({ server: 'srv' }, context), /journal owner/);
    assert.deepEqual(effects, []); assert.equal(initialized, 1);
    assert.equal(parent.events.filter(event => event.kind === 'mcp_subscription').length, 0);

    // The live request fields move in place while a turn runs (`w9`/`MOe`/`kp`); the journal
    // owner digest must not read that as a configuration change.
    parent.config.model = 'moved-model'; parent.config.effort = 'high'; parent.config.thinking = true;
    assert.equal(await runtime.bindSession!(parent), runtime);

    const fork = Session.open(workspace, { config }); sessions.push(fork);
    const accepted = await runtime.bindSession!(fork); runtimes.push(accepted);
    assert.notEqual(accepted, runtime);
    await runtime.close();
    await accepted.buildTools(config, fork.id).find(tool => tool.schema.name === 'mcp_resource_subscribe')!.execute({ server: 'srv', uri: 'fixture://accepted' }, context);
    assert.deepEqual(effects, ['fixture://accepted']);
    assert.equal(fork.events.filter(event => event.kind === 'mcp_subscription').length, 1);
    assert.equal(parent.events.filter(event => event.kind === 'mcp_subscription').length, 0);

    const pendingSession = Session.open(workspace, { config }); sessions.push(pendingSession);
    const pending = accepted.bindSession!(pendingSession);
    const rejected = assert.rejects(pending, /Runtime.*closed|abort/i);
    await blocked;
    await accepted.close();
    releaseInitialize!();
    await rejected;
    assert.equal(pendingSession.events.filter(event => event.kind === 'mcp_subscription').length, 0);

    const releasedSession = Session.open(workspace, { config }); sessions.push(releasedSession);
    const released = await createRuntime(config, provider, controller.signal); runtimes.push(released);
    await released.bindSession!(releasedSession);
    await released.releaseSession!(releasedSession.id);
    const afterReleaseSession = Session.open(workspace, { config }); sessions.push(afterReleaseSession);
    const afterRelease = await released.bindSession!(afterReleaseSession); runtimes.push(afterRelease);
    await released.close();
    await afterRelease.buildTools(config, afterReleaseSession.id).find(tool => tool.schema.name === 'mcp_resource_subscribe')!.execute({ server: 'srv', uri: 'fixture://after-release' }, context);
    assert.equal(afterReleaseSession.events.filter(event => event.kind === 'mcp_subscription').length, 1);
    assert.deepEqual(failures, []);
  } finally {
    releaseInitialize?.(); controller.abort();
    await Promise.allSettled(runtimes.map(runtime => runtime.close()));
    for (const session of sessions) session.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('a first bind rejects a session whose live model differs from the runtime settings', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-mcp-digest-')));
  const controller = new AbortController();
  const server = http.createServer((request, response) => {
    if (request.method !== 'POST') { response.writeHead(request.method === 'DELETE' ? 204 : 405); response.end(); return; }
    let text = '';
    request.on('data', chunk => { text += String(chunk); });
    request.on('end', () => {
      const body = JSON.parse(text);
      const reply = (result: unknown) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      };
      if (body.method === 'initialize') reply({ protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: { subscribe: true } } });
      else if (body.method === 'tools/list') reply({ tools: [] });
      else { response.writeHead(202); response.end(); }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert(address && typeof address !== 'string');
    const config = defaultConfig(workspace, []); config.model = 'fixture';
    config.features = { tasks: false, subagents: false, mcpSubscriptions: true, mcpRecovery: true, mcpPersistence: true };
    config.mcpServers = { srv: { type: 'http', url: `http://127.0.0.1:${address.port}/mcp` } };
    // A same-session rebind may ignore the live request fields (`w9`/`MOe`/`kp`), but the first
    // bind must still compare them so one runtime never adopts another session's choice.
    const other = Session.open(workspace, { config: { ...structuredClone(config), model: 'other-model' } });
    const runtime = await createRuntime(config, provider, controller.signal);
    try {
      await assert.rejects(runtime.bindSession!(other), /differs from its connected settings/);
    } finally { await runtime.close(); other.close(); }
  } finally {
    controller.abort(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
