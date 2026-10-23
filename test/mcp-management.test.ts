import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { Terminal } from '@xterm/headless';
import { createRequire } from 'node:module';
import { defaultConfig } from '../src/agent.js';
import { disabledMcpServers, MCP_STATE_FILE, saveMcpEnabled, setMcpMembership } from '../src/mcp-state.js';
import { mcpServerRequest, mcpToolRequest, mcpToolCounts } from '../src/mcp-panel.js';
import { truncateMcpDetail } from '../src/mcp-detail-source.js';
import { workspaceApprovalKey } from '../src/mcp-approval.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { Session } from '../src/session.js';
import { TuiTerminal } from '../src/tui.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ToolContext, ToolDefinition } from '../src/tools.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w300-test-')));
const fixtureScript = path.resolve('.audit/w300-mcp-fixture.mjs');
const until = async (predicate: () => boolean, label: string) => {
  const deadline = Date.now() + 5000;
  while (!predicate()) { assert.ok(Date.now() < deadline, label); await delay(10); }
};
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const chosen = (tools: ToolDefinition[], name: string) => {
  const tool = tools.find(item => item.schema.name === name); assert.ok(tool, name); return tool;
};
const unused: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model request'); } };

test('workspace MCP decisions preserve sibling fields, serialize and retain source text boundaries', async () => {
  const root = temporary(), user = path.join(root, 'user'), workspace = path.join(root, 'workspace');
  fs.mkdirSync(user); fs.mkdirSync(workspace);
  const file = path.join(user, MCP_STATE_FILE), key = workspaceApprovalKey(workspace);
  try {
    assert.deepEqual(disabledMcpServers(workspace, user), []);
    fs.writeFileSync(file, JSON.stringify({ marker: 'keep', projects: { [key]: { other: 7 }, sibling: { disabledMcpServers: ['peer'] } } }), { mode: 0o640 });
    await Promise.all([saveMcpEnabled(workspace, user, 'alpha', false), saveMcpEnabled(workspace, user, 'beta', false)]);
    assert.deepEqual(disabledMcpServers(workspace, user), ['alpha', 'beta']);
    await saveMcpEnabled(workspace, user, 'alpha', true);
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(document.marker, 'keep'); assert.equal(document.projects[key].other, 7);
    assert.deepEqual(document.projects.sibling.disabledMcpServers, ['peer']);
    assert.equal(fs.statSync(file).mode & 0o777, 0o640);
    const previous = ['beta']; assert.equal(setMcpMembership(previous, 'beta', true), previous);
    const stat = fs.statSync(file); await saveMcpEnabled(workspace, user, 'beta', false);
    assert.equal(fs.statSync(file).ino, stat.ino);
    assert.equal(truncateMcpDetail('a'.repeat(199) + '\u{1f600}tail', 200), 'a'.repeat(199) + '… [+6 chars]');
    assert.equal(truncateMcpDetail('short', 200), 'short');
    assert.deepEqual(mcpToolCounts(['local/server'], ['mcp__local_server__ping']), { 'local/server': 1 });
    const definition: ToolDefinition = { readOnly: true, mcpAnnotations: { destructive: true, openWorld: true },
      schema: { name: 'mcp__alpha__ping', description: 'x'.repeat(1001), input_schema: { type: 'object',
        properties: { text: { type: 'string', description: 'y'.repeat(201) } }, required: ['text'] } }, execute: async () => '' };
    const request = mcpToolRequest('alpha', definition);
    assert.ok(request.message.includes('x'.repeat(1000) + '… [+1 chars]'));
    assert.ok(request.message.includes('y'.repeat(200) + '… [+1 chars]'));
    assert.match(request.message, /\[read-only\][\s\S]*\[destructive\][\s\S]*\[open-world\]/);
    assert.deepEqual(mcpServerRequest('alpha', { command: 'fixture' }, { state: 'disabled', generation: 1, attempts: 0 }, 0)
      .choices?.map(item => item.label), ['Enable']);
    fs.writeFileSync(file, '{'); await assert.rejects(saveMcpEnabled(workspace, user, 'alpha', false));
    assert.equal(fs.readFileSync(file, 'utf8'), '{');
    fs.unlinkSync(file); fs.symlinkSync(path.join(root, 'missing'), file);
    await assert.rejects(saveMcpEnabled(workspace, user, 'alpha', false), /regular file/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('owned MCP transports toggle without replacing peers, jobs or child catalogs and reject late candidates', async () => {
  const root = temporary(), user = path.join(root, 'user'), notes = path.join(root, 'notes.jsonl'), control = path.join(root, 'control.json');
  fs.mkdirSync(user);
  const boots = (server: string): number[] => fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').trim().split('\n')
    .map(line => JSON.parse(line)).filter(row => row.kind === 'boot' && row.server === server).map(row => row.pid) : [];
  const config = defaultConfig(root, []); config.model = 'fixture'; config.allowShell = true;
  config.configSources = { userDir: user }; config.features = { tasks: false, background: true, subagents: true, mcpCatalog: true,
    mcpDynamic: true, mcpRecovery: true, mcpSubscriptions: true, mcpLogging: true };
  config.mcpServers = { alpha: { command: process.execPath, args: [fixtureScript, notes, 'alpha', control] },
    beta: { command: process.execPath, args: [fixtureScript, notes, 'beta'] } };
  const context: ToolContext = { workspace: root, signal: new AbortController().signal, allowShell: true, maxOutputBytes: 24000 };
  const requests: ModelRequest[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    requests.push(request);
    return { id: 'fixture', type: 'message', role: 'assistant', model: request.model, content: [{ type: 'text', text: 'done', citations: null }],
      container: null, diagnostics: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
        cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  let runtime = await createRuntime(config, provider, context.signal);
  try {
    const tools = runtime.buildTools(config, 'owner'), old = chosen(tools, 'mcp__alpha__ping');
    const beta = boots('beta')[0]!; assert.ok(alive(beta));
    assert.match(await old.execute({ text: 'ping' }, context), /^alpha:\d+$/);
    const job = JSON.parse(await chosen(tools, 'run_background').execute({ command: `${JSON.stringify(process.execPath)} -e 'setInterval(()=>{},1000)'`, timeout_ms: 15000 }, context));
    const jobId = job.job_id ?? job.id; assert.equal(typeof jobId, 'string');
    await chosen(tools, 'mcp_resource_subscribe').execute({ server: 'alpha', uri: 'fixture://alpha/item' }, context);
    const before = (await runtime.catalogListing!(context.signal)).resources;
    assert.equal(before.alpha?.length, 1);
    await runtime.setMcpEnabled!('alpha', false, context.signal);
    assert.equal(runtime.mcpServers!().alpha?.state, 'disabled');
    assert.deepEqual(disabledMcpServers(root, user), ['alpha']);
    assert.ok(boots('alpha').every(pid => !alive(pid))); assert.ok(alive(beta));
    assert.equal(boots('beta').length, 1);
    assert.equal(runtime.buildTools(config, 'owner').some(tool => tool.schema.name === 'mcp__alpha__ping'), false);
    assert.equal(runtime.backgroundTasks!('owner').jobs.some(task => task.id === jobId), true);
    await assert.rejects(old.execute({ text: 'stale' }, context), /disabled|absent|metadata changed/);
    await assert.rejects(runtime.reconnectMcp!('alpha', context.signal), /disabled/);
    assert.equal((await runtime.catalogListing!(context.signal)).resources.alpha, undefined);
    assert.equal((await runtime.catalogListing!(context.signal)).resources.beta?.length, 1);
    await runtime.setMcpEnabled!('alpha', true, context.signal);
    assert.equal(boots('alpha').length, 2); assert.ok(alive(boots('alpha')[1]!)); assert.ok(alive(beta));
    assert.match(await chosen(runtime.buildTools(config, 'owner'), 'mcp__alpha__ping').execute({ text: 'new' }, context), /^alpha:\d+$/);
    assert.equal(fs.readFileSync(notes, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
      .filter(row => row.server === 'alpha' && row.method === 'resources/subscribe').length, 1,
    'disable clears transient transport subscriptions; no effect is replayed');
    const state = path.join(user, MCP_STATE_FILE), saved = fs.readFileSync(state, 'utf8');
    fs.writeFileSync(state, '{');
    await assert.rejects(runtime.setMcpEnabled!('alpha', false, context.signal));
    assert.equal(runtime.mcpServers!().alpha?.state, 'connected'); assert.ok(alive(boots('alpha')[1]!));
    fs.writeFileSync(state, saved);
    await runtime.setMcpEnabled!('alpha', false, context.signal);
    await runtime.launchSubtask!(config, 'owner', 'inspect child tools', context.signal, [{ role: 'user', content: 'fixture history' }]);
    await until(() => requests.length === 1, 'child request');
    assert.equal(requests[0]!.tools?.some(tool => 'name' in tool && tool.name === 'mcp__alpha__ping'), false);
    assert.equal(requests[0]!.tools?.some(tool => 'name' in tool && tool.name === 'mcp__beta__ping'), true);
    await runtime.close();
    const starts = boots('alpha').length;
    runtime = await createRuntime(config, unused, context.signal);
    assert.equal(boots('alpha').length, starts);
    assert.equal(runtime.mcpServers!().alpha?.state, 'disabled');
    fs.writeFileSync(control, JSON.stringify({ holdMs: 1000 }));
    const enabling = runtime.setMcpEnabled!('alpha', true, context.signal);
    const rejected = assert.rejects(enabling);
    await until(() => boots('alpha').length === starts + 1, 'candidate boot');
    await runtime.setMcpEnabled!('alpha', false, context.signal); await rejected;
    assert.equal(runtime.mcpServers!().alpha?.state, 'disabled');
    assert.ok(boots('alpha').every(pid => !alive(pid)));
    fs.writeFileSync(control, JSON.stringify({ fail: true }));
    await assert.rejects(runtime.setMcpEnabled!('alpha', true, context.signal));
    assert.equal(runtime.mcpServers!().alpha?.state, 'disconnected');
    assert.deepEqual(disabledMcpServers(root, user), []);
    assert.ok(boots('alpha').every(pid => !alive(pid)));
    fs.writeFileSync(control, '{}');
    await runtime.reconnectMcp!('alpha', context.signal);
    assert.ok(runtime.buildTools(config, 'owner').some(tool => tool.schema.name === 'mcp__alpha__ping'));
    await runtime.setMcpEnabled!('alpha', false, context.signal);
    fs.writeFileSync(control, JSON.stringify({ holdMs: 1000 }));
    const controller = new AbortController(), attempt = runtime.setMcpEnabled!('alpha', true, controller.signal);
    const aborted = assert.rejects(attempt); await until(() => boots('alpha').length === starts + 4, 'abort candidate');
    controller.abort(); await aborted;
    assert.ok(boots('alpha').every(pid => !alive(pid)));
    await runtime.setMcpEnabled!('alpha', false, context.signal);
    const count = boots('alpha').length;
    const a = runtime.setMcpEnabled!('alpha', true, context.signal).then(() => undefined, () => undefined);
    await until(() => boots('alpha').length === count + 1, 'four-choice candidate');
    const b = runtime.setMcpEnabled!('alpha', false, context.signal);
    const c = runtime.setMcpEnabled!('alpha', true, context.signal).then(() => undefined, () => undefined);
    const d = runtime.setMcpEnabled!('alpha', false, context.signal);
    await Promise.all([a, b, c, d]);
    assert.equal(runtime.mcpServers!().alpha?.state, 'disabled');
    assert.deepEqual(disabledMcpServers(root, user), ['alpha']);
    assert.ok(boots('alpha').every(pid => !alive(pid)));
    const pinned = { ...config, tools: pinToolSchemas(runtime.buildTools(config, 'owner')) };
    let session = Session.open(root, { config: pinned });
    try {
      await runtime.bindSession!(session);
      fs.writeFileSync(control, JSON.stringify({ fail: true }));
      await assert.rejects(runtime.setMcpEnabled!('alpha', true, context.signal));
      const event = session.events.findLast(event => event.kind === 'mcp_catalog');
      assert.equal(event?.kind, 'mcp_catalog');
      assert.deepEqual(event?.kind === 'mcp_catalog' ? event.unavailableServers : [], ['alpha']);
      const id = session.id; await runtime.close(); session.close(); fs.writeFileSync(control, '{}');
      session = Session.open(root, { id }); runtime = await createRuntime(session.config, unused, context.signal);
      await runtime.bindSession!(session);
      assert.ok(session.config.tools.some(tool => tool.name === 'mcp__alpha__ping'));
      assert.deepEqual(session.config.tools, pinToolSchemas(runtime.buildTools(session.config, session.id)));
    } finally { session.close(); }
  } finally {
    await runtime.close();
    assert.ok([...boots('alpha'), ...boots('beta')].every(pid => !alive(pid)));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('real terminal navigates every MCP return page and drops stale resource loads', async () => {
  const root = temporary(), user = path.join(root, 'user'), notes = path.join(root, 'notes.jsonl'); fs.mkdirSync(user);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const decoded = new HeadlessTerminal({ cols: 110, rows: 40, allowProposedApi: true, logLevel: 'off' });
  const output = new Writable({ write(chunk, _encoding, done) {
    (decoded as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk)); done();
  } });
  Object.assign(output, { isTTY: true, columns: 110, rows: 40 });
  const config = defaultConfig(root, []); config.model = 'fixture'; config.configSources = { userDir: user };
  config.mcpServers = { alpha: { command: process.execPath, args: [fixtureScript, notes, 'alpha'] } };
  const context = new AbortController(), runtime = await createRuntime(config, unused, context.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config }), terminal = new TuiTerminal({ input, output, workspace: root });
  let error: Error | undefined; terminal.on('inputError', value => { error = value; });
  const frame = () => Array.from({ length: decoded.rows }, (_, row) => decoded.buffer.active
    .getLine(decoded.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n');
  const wait = async (text: string) => { try { await until(() => { if (error) throw error; return frame().includes(text); }, text); }
    catch (failure) { throw new Error(`${String(failure)}\n${frame()}`); } };
  const send = (text: string) => input.emit('data', text);
  const loop = interactiveLoop(session, unused, runtime, { input, output, status: output, signal: context.signal, terminal });
  try {
    await wait('· ready');
    send('/mcp\r'); await wait('Manage MCP servers');
    send('\r'); await wait('alpha MCP Server');
    send('\r'); await wait('Tools for alpha');
    send('\r'); await wait('Full name: mcp__alpha__ping');
    assert.ok(frame().includes('[destructive]')); assert.ok(frame().includes('text required: string'));
    send('\x1b'); await wait('Tools for alpha');
    send('\x1b'); await wait('alpha MCP Server');
    send('\x1b'); await wait('Manage MCP servers');
    send('\r'); await wait('alpha MCP Server'); send('\x1b[B\x1b[B\r');
    await wait('alpha: disabled'); assert.deepEqual(disabledMcpServers(root, user), ['alpha']);
    assert.equal(session.config.tools.some(tool => tool.name === 'mcp__alpha__ping'), false);
    send('\r'); await wait('alpha MCP Server'); assert.ok(frame().includes('Enable'));
    send('\r'); await wait('alpha: connected');
    assert.equal(session.config.tools.some(tool => tool.name === 'mcp__alpha__ping'), true);
    send('\x1b'); await wait('· ready');
    let finish!: (value: { resources: { retired: { server: string; uri: string; name: string }[] }; templates: {} }) => void;
    terminal.bindMcpCatalog(() => new Promise(resolve => { finish = resolve; }));
    send('@'); await until(() => typeof finish === 'function', 'old listing started');
    terminal.bindMcpCatalog(async () => ({ resources: { current: [{ server: 'current', uri: 'fixture://current/item', name: 'CurrentResource' }] }, templates: {} }));
    send('Current'); await wait('CurrentResource');
    finish({ resources: { retired: [{ server: 'retired', uri: 'fixture://retired/item', name: 'RetiredResource' }] }, templates: {} });
    await delay(20); assert.equal(frame().includes('RetiredResource'), false); assert.ok(frame().includes('CurrentResource'));
    send('\x15/exit\r'); await loop;
  } finally { context.abort(); terminal.close(); await loop; session.close(); await runtime.close(); decoded.dispose(); fs.rmSync(root, { recursive: true, force: true }); }
});
