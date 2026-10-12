import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { savedMcpTasks, commitMcpTask } from '../src/mcp-session-tasks.js';
import { createRuntime } from '../src/runtime.js';
const handle = { taskId: 'owned', status: 'working' as const, createdAt: '2026-10-12T00:00:00Z', lastUpdatedAt: '2026-10-12T00:00:00Z', ttl: 30000 };
const configFor = (workspace: string, url = 'http://127.0.0.1:1/mcp') => {
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, mcpStandardTasks: true, mcpPersistence: true, mcpRecovery: true };
  config.mcpServers = { srv: { type: 'http', url } }; return config;
};
test('saved tasks pin identities, retain resolved payloads and stay isolated from forks and legacy sessions', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-task-journal-')));
  const session = Session.open(workspace, { config: configFor(workspace) });
  try {
    commitMcpTask(session, 'srv', 'run', handle, false);
    assert.equal(savedMcpTasks(session).length, 1);
    assert.throws(() => commitMcpTask(session, 'srv', 'different', handle, true, '{}'), /identity/);
    assert.throws(() => commitMcpTask(session, 'srv', 'run', handle, true), /result/);
    commitMcpTask(session, 'srv', 'run', handle, true, '{"content":[]}');
    assert.equal(savedMcpTasks(session)[0]!.result, '{"content":[]}');
    const fork = forkSession(session); try { assert.deepEqual(savedMcpTasks(fork), []); } finally { fork.close(); }
    const id = session.id; session.close();
    const reopened = Session.open(workspace, { id });
    try {
      assert.equal(savedMcpTasks(reopened)[0]!.resolved, true);
      reopened.config.mcpServers!.srv = { type: 'http', url: 'http://127.0.0.1:2/mcp' };
      assert.throws(() => savedMcpTasks(reopened), /configuration/);
      reopened.config.features!.mcpPersistence = false; assert.deepEqual(savedMcpTasks(reopened), []);
    } finally { reopened.close(); }
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
test('runtime task journal fsync failure blocks subsequent effects and recovery; owner guards precede calls', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-task-owner-')));
  let calls = 0; const failures: unknown[] = [];
  const server = http.createServer((req, res) => { void (async () => {
    if (req.method !== 'POST') { res.writeHead(req.method === 'DELETE' ? 204 : 405).end(); return; }
    let text = ''; for await (const chunk of req) text += chunk; const m = JSON.parse(text);
    const reply = (result: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result })); };
    if (m.method === 'initialize') reply({ protocolVersion: '2025-11-25', capabilities: { tools: {}, tasks: { requests: { tools: { call: {} } } } } });
    else if (m.method === 'tools/list') reply({ tools: [{ name: 'run', inputSchema: { type: 'object' }, execution: { taskSupport: 'required' } }] });
    else if (m.method === 'tools/call') { calls++; reply({ task: handle }); }
    else res.writeHead(202).end();
  })().catch(error => { failures.push(error); res.destroy(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert.ok(address && typeof address !== 'string');
  const config = configFor(workspace, 'http://127.0.0.1:' + address.port + '/mcp');
  const session = Session.open(workspace, { config });
  const runtime = await createRuntime(config, { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } }, new AbortController().signal);
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
  try {
    await runtime.bindSession!(session);
    const foreign = runtime.buildTools(config, 'other-owner').find(tool => tool.schema.name === 'mcp__srv__run')!;
    await assert.rejects(foreign.execute({}, context), /journal owner/); assert.equal(calls, 0);
    const tools = runtime.buildTools(config, session.id), run = tools.find(tool => tool.schema.name === 'mcp__srv__run')!, recover = tools.find(tool => tool.schema.name === 'mcp_task_recover')!;
    assert.deepEqual(JSON.parse(await recover.execute({}, context)), { tasks: [] });
    t.mock.method(fs, 'fsyncSync', () => { throw new Error('owned fsync fault'); });
    await assert.rejects(run.execute({}, context), /journal commit failed/); t.mock.restoreAll(); assert.equal(calls, 1);
    await assert.rejects(run.execute({}, context), /reconciliation/);
    await assert.rejects(recover.execute({}, context), /reconciliation/); assert.equal(calls, 1);
    assert.deepEqual(failures, []);
  } finally { t.mock.restoreAll(); await runtime.close(); session.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(workspace, { recursive: true, force: true }); }
});


test('explicit recovery retains unknown tasks, preserves remote work on abort and reuses failed cached results', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-task-resume-')));
  let mode = 'missing', polls = 0, resultReads = 0, cancels = 0, creates = 0;
  const server = http.createServer((req, res) => { void (async () => {
    if (req.method !== 'POST') { res.writeHead(req.method === 'DELETE' ? 204 : 405).end(); return; }
    let text = ''; for await (const chunk of req) text += chunk; const m = JSON.parse(text);
    const reply = (result: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result })); };
    if (m.method === 'initialize') reply({ protocolVersion: '2025-11-25', capabilities: { tools: {}, tasks: { requests: { tools: { call: {} } }, cancel: {} } } });
    else if (m.method === 'tools/list') reply({ tools: [] });
    else if (m.method === 'tools/call') { creates++; reply({}); }
    else if (m.method === 'tasks/cancel') { cancels++; reply({}); }
    else if (m.method === 'tasks/get') { polls++;
      if (mode === 'missing') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32602, message: 'expired owned fixture' } })); }
      else reply({ ...handle, taskId: m.params.taskId, ...(mode === 'identity' ? { createdAt: '2026-10-11T00:00:00Z' } : {}), status: mode === 'pending' ? 'working' : 'failed', pollInterval: 250 });
    } else if (m.method === 'tasks/result') { resultReads++; reply({ content: [{ type: 'text', text: 'OWNED_FAILED_RESULT' + 'x'.repeat(25000) }], isError: true, _meta: { 'io.modelcontextprotocol/related-task': { taskId: m.params.taskId } } }); }
    else res.writeHead(202).end();
  })().catch(() => res.destroy()); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert.ok(address && typeof address !== 'string');
  const config = configFor(workspace, 'http://127.0.0.1:' + address.port + '/mcp');
  const session = Session.open(workspace, { config }); commitMcpTask(session, 'srv', 'run', handle, false);
  const runtime = await createRuntime(config, { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } }, new AbortController().signal);
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
  try {
    await runtime.bindSession!(session); const recover = runtime.buildTools(config, session.id).find(tool => tool.schema.name === 'mcp_task_recover')!;
    const args = { server: 'srv', taskId: 'owned' };
    await assert.rejects(recover.execute(args, context), /request failed/i); assert.equal(savedMcpTasks(session)[0]!.resolved, false);
    mode = 'identity'; await assert.rejects(recover.execute(args, context), /malformed/i);
    mode = 'pending'; const abort = new AbortController(); const waiting = recover.execute(args, { ...context, signal: abort.signal });
    const checked = assert.rejects(waiting, /cancel/i); await new Promise(resolve => setTimeout(resolve, 20));
    await assert.rejects(recover.execute(args, context), /already active/); abort.abort(); await checked;
    assert.equal(savedMcpTasks(session)[0]!.resolved, false); assert.equal(cancels, 0);
    mode = 'failed'; await assert.rejects(recover.execute(args, context), /OWNED_FAILED_RESULT/);
    const before = polls; await assert.rejects(recover.execute(args, context), /OWNED_FAILED_RESULT/);
    await assert.rejects(recover.execute(args, { ...context, maxOutputBytes: 1 }));
    assert.equal(polls, before); assert.equal(resultReads, 1); assert.equal(creates, 0); assert.equal(savedMcpTasks(session)[0]!.resolved, true);
  } finally { await runtime.close(); session.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(workspace, { recursive: true, force: true }); }
});
