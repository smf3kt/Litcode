import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test, type TestContext } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig, type AgentEvents } from '../src/agent.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { createRuntime, parseSettings, pinToolSchemas, type Runtime } from '../src/runtime.js';
import { Session, type SessionConfig, type ToolResult } from '../src/session.js';
import { listSessions } from '../src/sessions.js';

const TIMEOUT = { timeout: 20_000 };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const FEATURES: NonNullable<SessionConfig['features']> = {
  tasks: true, subagents: true, agentMessaging: true, background: true, scheduler: true,
  web: true, media: true, memory: true, checkpoints: true, worktrees: true, workflow: true,
  notebooks: true, lsp: true, mcpCatalog: true,
};

function workspace(t: TestContext): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-migration-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}
function response(text = 'done', calls?: { name: string; input: unknown; id?: string }[]): Anthropic.Message {
  return { id: randomUUID(), model: 'fixture', role: 'assistant', type: 'message',
    content: calls ? calls.map(call => ({ type: 'tool_use', id: call.id ?? randomUUID(), name: call.name, input: call.input }))
      : [{ type: 'text', text }], stop_reason: calls ? 'tool_use' : 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function tool(name: string, input: unknown, id = name): Anthropic.Message { return response('', [{ name, input, id }]); }
function results(request: ModelRequest): ToolResult[] {
  const content = request.messages.at(-1)?.content;
  assert.ok(Array.isArray(content), 'model must see the paired tool result batch');
  return content.filter((block): block is ToolResult => block.type === 'tool_result');
}
function jsonResult(request: ModelRequest, id?: string): any {
  const result = results(request).find(item => !id || item.tool_use_id === id);
  assert.ok(result); assert.equal(result.is_error, undefined, String(result.content));
  assert.equal(typeof result.content, 'string'); return JSON.parse(result.content as string);
}
function savedResult(session: Session, id: string): ToolResult {
  const event = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === id);
  assert.ok(event?.kind === 'tool_result'); return event.result;
}
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve };
}
async function until(check: () => boolean, timeout = 4000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() >= deadline) assert.fail('integration fixture timed out waiting for its observable condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function waitForGate(wait: Promise<void>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    void wait.then(() => { cleanup(); resolve(); }, error => { cleanup(); reject(error); });
  });
}
async function fixture(root: string, complete: ModelProvider['complete'], configure?: (config: SessionConfig) => void,
  events: AgentEvents = {}) {
  const provider: ModelProvider = { count: async request => { assertPaired(request.messages); return 1; }, complete };
  const config = defaultConfig(root, []); config.model = 'fixture'; config.features = { ...FEATURES };
  config.configSources = { userDir: path.join(root, 'user') };
  config.maxOutputBytes = 100_000; configure?.(config);
  const controller = new AbortController();
  const runtime = await createRuntime(config, provider, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  let session: Session;
  try { session = Session.open(root, { config }); }
  catch (error) { await runtime.close(); throw error; }
  const agent = new Agent(session, provider, runtime.buildTools(session.config, session.id), events);
  return { config, provider, controller, runtime, session, agent,
    run: (prompt: string) => agent.run(prompt, AbortSignal.timeout(10_000)),
    async close() { try { await runtime.close(); } finally { session.close(); } },
  };
}

test('migration runtime Agent launches/messages/resumes children, isolates owners and closes active locks', TIMEOUT, async t => {
  const root = workspace(t), entered = gate(), release = gate(), hangingEntered = gate(), never = gate();
  let childId = '', parentCall = 0, childCalls = 0, resumedModel = '';
  const childRequests: ModelRequest[] = [];
  const f = await fixture(root, async (request, signal) => {
    if (String(request.system).includes('child agent')) {
      childRequests.push(structuredClone(request));
      assert.equal(request.tools?.some(tool => 'name' in tool && ['agent', 'send_message', 'run_background'].includes(tool.name)), false);
      const prompt = request.messages.at(-1)?.content;
      if (prompt === 'hold until runtime close') { hangingEntered.resolve(); await waitForGate(never.promise, signal); }
      childCalls++;
      if (childCalls === 1) { entered.resolve(); await waitForGate(release.promise, signal); }
      resumedModel = request.model; return response(`child-${childCalls}`);
    }
    switch (++parentCall) {
      case 1: return tool('agent', { prompt: 'initial child task', name: 'worker', background: true });
      case 2: childId = jsonResult(request).id; await entered.promise;
        return tool('send_message', { id: 'worker', message: 'queued followup' });
      case 3: assert.equal(jsonResult(request).id, childId); release.resolve();
        return tool('get_agent', { id: childId, wait_ms: 5000 });
      case 4: { const child = jsonResult(request); assert.equal(child.status, 'completed'); assert.equal(child.model_calls, 2); return response(); }
      case 5: return tool('send_message', { id: 'worker', message: 'resume same child' });
      case 6: assert.equal(jsonResult(request).id, childId); return tool('get_agent', { id: 'worker', wait_ms: 5000 });
      case 7: assert.equal(jsonResult(request).model_calls, 3); return response();
      case 8: return tool('agent', { prompt: 'hold until runtime close', name: 'held', background: true });
      case 9: assert.ok(['queued', 'running'].includes(jsonResult(request).status)); return response();
      default: assert.fail('unexpected parent call');
    }
  });
  let other: Session | undefined;
  try {
    assert.equal((await f.run('launch and queue')).reason, 'end_turn');
    assert.equal(childRequests[1]!.messages.at(-1)!.content, 'queued followup');
    f.config.model = 'changed-parent-model';
    await f.run('resume worker'); assert.equal(resumedModel, 'fixture');
    assert.equal(childRequests[2]!.messages.at(-1)!.content, 'resume same child');
    const child = Session.open(root, { id: childId });
    try { assertPaired(child.messages); assert.equal(child.events.filter(event => event.kind === 'turn_end').length, 3); }
    finally { child.close(); }
    let otherCall = 0;
    other = Session.open(root, { config: f.session.config });
    const foreignProvider: ModelProvider = { count: async () => 1, complete: async request => {
      if (++otherCall === 1) return tool('get_agent', { id: childId });
      assert.equal(results(request)[0]!.is_error, true); assert.match(String(results(request)[0]!.content), /Unknown/);
      return response();
    } };
    await new Agent(other, foreignProvider, f.runtime.buildTools(other.config, other.id)).run('lookup foreign child');
    other.close();
    assert.deepEqual(f.runtime.drainEvents!(other.id), []);
    assert.ok(f.runtime.drainEvents!(f.session.id).some(event => event.prompt?.includes(childId)));
    await f.run('launch held worker'); await hangingEntered.promise;
    const locked = listSessions(root).filter(item => item.active); assert.ok(locked.length >= 2);
    await f.runtime.close(); f.session.close();
    assert.equal(listSessions(root).some(item => item.active), false);
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally { release.resolve(); never.resolve(); other?.close(); await f.close(); }
});

test('migration read_media tool reaches subsequent provider request and reopens durable image journal', TIMEOUT, async t => {
  const root = workspace(t); fs.writeFileSync(path.join(root, 'one.png'), PNG);
  let calls = 0;
  const f = await fixture(root, async request => {
    if (++calls === 1) return tool('read_media', { path: 'one.png' }, 'image');
    const result = results(request)[0]!; assert.equal(result.is_error, undefined);
    assert.ok(Array.isArray(result.content));
    const image = result.content.find(block => block.type === 'image'); assert.ok(image?.type === 'image');
    assert.equal(image.source.type, 'base64');
    if (image.source.type === 'base64') assert.equal(image.source.data, PNG.toString('base64'));
    return response('image inspected');
  });
  try {
    await f.run('inspect local image'); const id = f.session.id;
    assert.ok(Array.isArray(savedResult(f.session, 'image').content)); f.session.close();
    const reopened = Session.open(root, { id });
    try {
      assertPaired(reopened.messages); assert.deepEqual(savedResult(reopened, 'image').content, savedResult(f.session, 'image').content);
      let resumed = false;
      const provider: ModelProvider = { count: async () => 1, complete: async request => {
        resumed = true; assert.ok(JSON.stringify(request.messages).includes(PNG.toString('base64'))); return response('remembered');
      } };
      await new Agent(reopened, provider, f.runtime.buildTools(reopened.config, id)).run('recall the image'); assert.equal(resumed, true);
    } finally { reopened.close(); }
  } finally { await f.close(); }
});

test('migration checkpoint Agent previews, rejects stale digest, then restores actual file bytes', TIMEOUT, async t => {
  const root = workspace(t); fs.writeFileSync(path.join(root, 'target.txt'), 'original');
  let calls = 0, digest = '';
  const f = await fixture(root, async request => {
    switch (++calls) {
      case 1: return tool('checkpoint_create', { name: 'baseline' }, 'create');
      case 2: assert.equal(jsonResult(request).files, 1);
        return tool('write_file', { path: 'target.txt', content: 'edited', overwrite: true }, 'edit');
      case 3: assert.equal(results(request)[0]!.is_error, undefined); return tool('checkpoint_diff', { name: 'baseline' });
      case 4: digest = jsonResult(request).current_digest;
        return tool('checkpoint_restore', { name: 'baseline', expected_current_digest: digest }, 'preview');
      case 5: assert.equal(jsonResult(request).dry_run, true);
        assert.equal(fs.readFileSync(path.join(root, 'target.txt'), 'utf8'), 'edited');
        fs.writeFileSync(path.join(root, 'changed-after-diff.txt'), 'new state');
        return tool('checkpoint_restore', { name: 'baseline', expected_current_digest: digest, dry_run: false }, 'stale');
      case 6: assert.equal(results(request)[0]!.is_error, true); assert.match(String(results(request)[0]!.content), /changed since diff/);
        assert.equal(fs.readFileSync(path.join(root, 'target.txt'), 'utf8'), 'edited');
        return tool('checkpoint_diff', { name: 'baseline' }, 'fresh');
      case 7: return tool('checkpoint_restore', { name: 'baseline', expected_current_digest: jsonResult(request).current_digest,
        dry_run: false, paths: ['target.txt'] }, 'restore');
      case 8: assert.equal(jsonResult(request).dry_run, false); return response();
      default: assert.fail('unexpected checkpoint call');
    }
  });
  try {
    await f.run('snapshot edit and restore'); assertPaired(f.session.messages);
    assert.equal(fs.readFileSync(path.join(root, 'target.txt'), 'utf8'), 'original');
    assert.equal(fs.readFileSync(path.join(root, 'changed-after-diff.txt'), 'utf8'), 'new state');
    assert.equal(fs.existsSync(path.join(root, '.agent/checkpoints/lock')), false);
    assert.equal(savedResult(f.session, 'stale').is_error, true);
  } finally { await f.close(); }
});

test('migration HTTP MCP settings wire tools/catalog and web fetch through Agent with DELETE cleanup', TIMEOUT, async t => {
  const root = workspace(t); const methods: string[] = [], failures: unknown[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Fixture</title><p>local page</p>'); return; }
      if (req.method === 'DELETE') { methods.push('DELETE'); res.writeHead(204); res.end(); return; }
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const rpc = JSON.parse(Buffer.concat(chunks).toString()); methods.push(rpc.method);
      const send = (result: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
      };
      if (rpc.method === 'initialize') {
        res.setHeader('Mcp-Session-Id', 'migration-fixture');
        send({ protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: 'migration', version: '1' } });
      } else {
        assert.equal(req.headers['mcp-session-id'], 'migration-fixture');
        if (rpc.method === 'tools/list') send({ tools: [{ name: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } }, annotations: { readOnlyHint: true } }] });
        else if (rpc.method === 'tools/call') send({ content: [{ type: 'text', text: `echo:${rpc.params.arguments.text}` }] });
        else if (rpc.method === 'resources/list') send({ resources: [{ uri: 'fixture://note', name: 'note' }] });
        else if (rpc.method === 'resources/read') send({ contents: [{ uri: 'fixture://note', text: 'inert resource' }] });
        else if (rpc.method === 'prompts/list') send({ prompts: [{ name: 'inert' }] });
        else if (rpc.method === 'prompts/get') send({ messages: [{ role: 'user', content: { type: 'text', text: 'inert prompt' } }] });
        else { res.writeHead(202); res.end(); }
      }
    })().catch(error => { failures.push(error); res.destroy(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/mcp`; let f: Awaited<ReturnType<typeof fixture>> | undefined;
  let calls = 0;
  try {
    f = await fixture(root, async request => {
      if (++calls === 1) return response('', [
        { name: 'mcp__fixture__echo', input: { text: 'through Agent' }, id: 'echo' },
        { name: 'mcp_resources_list', input: { server: 'fixture' }, id: 'resources' },
        { name: 'mcp_resource_read', input: { server: 'fixture', uri: 'fixture://note' }, id: 'read' },
        { name: 'mcp_prompts_list', input: { server: 'fixture' }, id: 'prompts' },
        { name: 'mcp_prompt_get', input: { server: 'fixture', name: 'inert' }, id: 'prompt' },
        { name: 'web_fetch', input: { url: url.replace('/mcp', '/page') }, id: 'web' },
      ]);
      assert.equal(results(request).length, 6);
      for (const result of results(request)) assert.equal(result.is_error, undefined, String(result.content));
      assert.match(String(results(request)[0]!.content), /echo:through Agent/);
      assert.equal(jsonResult(request, 'resources').resources[0].uri, 'fixture://note');
      assert.equal(jsonResult(request, 'read').contents[0].text, 'inert resource');
      assert.equal(jsonResult(request, 'prompt').messages[0].content.text, 'inert prompt');
      assert.match(jsonResult(request, 'web').text, /local page/); return response();
    }, config => { config.mcpServers = parseSettings({ mcpServers: { fixture: { type: 'http', url } } }).mcpServers; });
    await f.run('exercise local connectors'); const id = f.session.id; f.session.close();
    const reopened = Session.open(root, { id });
    try { assert.equal((reopened.config.mcpServers!.fixture as { url: string }).url, url); assertPaired(reopened.messages); }
    finally { reopened.close(); }
    await f.runtime.close(); assert.equal(methods.filter(method => method === 'DELETE').length, 1);
    assert.ok(methods.includes('resources/read')); assert.ok(methods.includes('prompts/get')); assert.deepEqual(failures, []);
  } finally {
    try { await f?.close(); } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});

for (const approved of [true, false, undefined]) {
  test(`migration Agent permission ask callback ${String(approved)} controls actual write effects`, TIMEOUT, async t => {
    const root = workspace(t); let calls = 0, approvals = 0;
    const events: AgentEvents = approved === undefined ? {} : { permission: async request => {
      approvals++; assert.equal(request.tool, 'write_file'); assert.deepEqual(request.input, { path: 'effect.txt', content: 'approved bytes' });
      assert.equal(request.signal.aborted, false); return approved;
    } };
    const f = await fixture(root, async request => {
      if (++calls === 1) return tool('write_file', { path: 'effect.txt', content: 'approved bytes' }, 'ask');
      assert.equal(Boolean(results(request)[0]!.is_error), approved !== true); return response();
    }, config => { config.permissions = { mode: 'ask', allow: [], deny: [] }; }, events);
    try {
      await f.run('try write'); assert.equal(approvals, approved === undefined ? 0 : 1);
      assert.equal(fs.existsSync(path.join(root, 'effect.txt')), approved === true);
      assert.equal(f.session.events.some(event => event.kind === 'tool_start' && event.id === 'ask'), approved === true);
      assertPaired(f.session.messages);
    } finally { await f.close(); }
  });
}

test('migration PreToolUse updatedInput is reauthorized before filesystem effects', TIMEOUT, async t => {
  const root = workspace(t); fs.mkdirSync(path.join(root, 'private')); let calls = 0;
  const f = await fixture(root, async request => {
    if (++calls === 1) return tool('write_file', { path: 'public.txt', content: 'original' }, 'rewrite');
    assert.equal(results(request)[0]!.is_error, true); assert.match(String(results(request)[0]!.content), /input denied/); return response();
  }, config => {
    config.permissions = { mode: 'bypass', allow: [], deny: [], inputRules: [{ tool: 'write_file', path: 'private/*', decision: 'deny' }] };
    const output = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse',
      updatedInput: { path: 'private/secret.txt', content: 'rewritten' } } });
    config.hooks = { PreToolUse: [{ matcher: 'write_file', command:
      `'${process.execPath.replace(/'/g, "'\\''")}' -e '${`process.stdout.write(${JSON.stringify(output)})`.replace(/'/g, "'\\''")}'`, timeout: 2 }],
      PermissionDenied: [{ command: `'${process.execPath}' -e 'process.stdout.write("{}")'`, timeout: 2 }] };
  });
  try {
    await f.run('hook alters input'); assert.equal(fs.existsSync(path.join(root, 'public.txt')), false);
    assert.equal(fs.existsSync(path.join(root, 'private/secret.txt')), false);
    assert.equal(f.session.events.some(event => event.kind === 'tool_start' && event.id === 'rewrite'), false);
    assert.ok(f.session.events.some(event => event.kind === 'hook_result' && event.event === 'PermissionDenied'));
  } finally { await f.close(); }
});

test('migration memory and workflow tools execute through runtime Agent and retain child journals', TIMEOUT, async t => {
  const root = workspace(t); let parentCall = 0; const childPrompts: string[] = [];
  const f = await fixture(root, async request => {
    if (String(request.system).includes('child agent')) {
      childPrompts.push(String(request.messages.at(-1)!.content)); return response(`dependency-result-${childPrompts.length}`);
    }
    switch (++parentCall) {
      case 1: return tool('memory_write', { name: 'project', content: 'workspace memory', title: 'Project' });
      case 2: assert.equal(jsonResult(request).created, true); return tool('memory_read', { name: 'project' });
      case 3: { const entry = jsonResult(request); assert.equal(entry.content, 'workspace memory');
        return tool('memory_write', { name: 'project', content: 'updated memory', expected_sha256: entry.sha256 }); }
      case 4: assert.equal(jsonResult(request).created, false); return tool('workflow_run', { tasks: [
        { id: 'first', prompt: 'inspect fixture' }, { id: 'second', prompt: 'use dependency', depends_on: ['first'] },
      ], max_parallel: 1, timeout_ms: 5000 });
      case 5: { const workflow = jsonResult(request); assert.equal(workflow.status, 'completed');
        assert.ok(workflow.tasks.every((task: { status: string }) => task.status === 'completed'));
        return tool('workflow_get', { id: workflow.id }); }
      case 6: assert.equal(jsonResult(request).tasks.length, 2); return response();
      default: assert.fail('unexpected memory workflow call');
    }
  });
  try {
    await f.run('remember and orchestrate'); assert.equal(childPrompts.length, 2);
    assert.match(childPrompts[1]!, /dependency-result-1/); assert.equal(fs.readFileSync(path.join(root, '.harness/memory/project.md'), 'utf8'), 'updated memory');
    assert.equal(listSessions(root).length, 3);
    for (const child of listSessions(root).filter(item => item.id !== f.session.id)) {
      const session = Session.open(root, { id: child.id }); try { assertPaired(session.messages); } finally { session.close(); }
    }
  } finally { await f.close(); }
});

test('migration worktree tools create/list/remove fixture checkout through Agent without changing workspace', TIMEOUT, async t => {
  const root = workspace(t);
  const git = (args: string[]) => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], {
      cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    }); assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  git(['init', '-b', 'fixture']); fs.writeFileSync(path.join(root, '.gitignore'), '.agent/\n.harness-worktrees/\n');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'baseline'); git(['add', '.gitignore', 'tracked.txt']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'fixture']);
  let calls = 0, target = '';
  const f = await fixture(root, async request => {
    switch (++calls) {
      case 1: return tool('worktree_create', { name: 'migration' });
      case 2: { const created = jsonResult(request); target = created.path; assert.equal(created.owned, true);
        assert.equal(fs.readFileSync(path.join(target, 'tracked.txt'), 'utf8'), 'baseline'); return tool('worktree_list', {}); }
      case 3: assert.ok(jsonResult(request).some((entry: { path: string; owned: boolean }) => entry.path === target && entry.owned));
        return tool('worktree_remove', { name: 'migration' });
      case 4: assert.equal(jsonResult(request).branchDeleted, true); return response();
      default: assert.fail('unexpected worktree call');
    }
  });
  try {
    await f.run('create isolated checkout and remove'); assert.equal(f.session.config.workspace, root);
    assert.equal(fs.existsSync(target), false); assert.equal(git(['branch', '--list', 'harness/migration']).trim(), '');
  } finally { await f.close(); }
});

test('migration actual interactive TTY preserves multiline submit, cancels a turn, resumes and restores raw mode', TIMEOUT, async t => {
  const { interactiveLoop } = await import('../src/interactive.js');
  const root = workspace(t), entered = gate(); let calls = 0, captured = '', turnSignal: AbortSignal | undefined;
  class Input extends PassThrough {
    isTTY = true; isRaw = false; rawCalls: boolean[] = [];
    setRawMode(value: boolean) { this.isRaw = value; this.rawCalls.push(value); return this; }
    key(text: string) { this.emit('data', Buffer.from(text)); }
  }
  class Output extends Writable {
    isTTY = true; columns = 80; rows = 24; text = '';
    _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) { this.text += chunk.toString(); done(); }
  }
  const input = new Input(), output = new Output(), status = new Output(); status.isTTY = false;
  const lifetime = new AbortController(); let runtime: Runtime | undefined, session: Session | undefined;
  const provider: ModelProvider = { count: async () => 1, complete: async (request, signal, onText) => {
    calls++;
    if (calls === 1) {
      captured = String(request.messages.at(-1)!.content); turnSignal = signal; entered.resolve(); onText?.('partial');
      await waitForGate(new Promise<void>(() => {}), signal); assert.fail('first provider call must be interrupted');
    }
    onText?.('resumed'); return response('resumed');
  } };
  let running: Promise<void> | undefined;
  try {
    const config = defaultConfig(root, []); config.model = 'fixture'; config.features = { ...FEATURES };
    config.configSources = { userDir: path.join(root, 'user') };
    runtime = await createRuntime(config, provider, lifetime.signal); config.tools = pinToolSchemas(runtime.tools);
    session = Session.open(root, { config });
    running = interactiveLoop(session, provider, runtime, { input, output, status, signal: lifetime.signal });
    await until(() => input.listenerCount('data') > 0);
    input.key('\x1b[200~first line\nsecond line\x1b[201~\r');
    await until(() => calls > 0).catch(error => { throw new Error(`${String(error)}; status=${status.text}; output=${output.text}`); });
    assert.equal(captured, 'first line\nsecond line'); input.key('\x03');
    await until(() => status.text.includes('finished: aborted')); assert.equal(turnSignal!.aborted, true);
    assert.equal(lifetime.signal.aborted, false); input.key('continue the cancelled task\r');
    await until(() => status.text.includes('finished: end_turn')); input.key('\x04');
    assert.equal(input.isRaw,true);assert.ok(output.text.includes('Press Ctrl-D again to exit'));input.key('\x04');await running;
    assert.equal(calls, 2); assert.deepEqual(input.rawCalls, [true, false]); assert.equal(input.isRaw, false);
    assert.equal(input.listenerCount('data'), 0); assertPaired(session.messages); assert.equal(session.awaitingResponse, false);
    assert.ok(output.text.includes('resumed'));
    assert.equal(listSessions(root).some(item => item.active), false);
  } finally {
    lifetime.abort(); input.emit('end');
    try { await running; } finally { await runtime?.close(); session?.close(); }
  }
});

test('migration interactive cwd rebuilds runtime scope, copies stable conversation and keeps source files/journal', TIMEOUT, async t => {
  const { interactiveLoop } = await import('../src/interactive.js');
  const source = workspace(t), target = workspace(t); let calls = 0;
  fs.writeFileSync(path.join(source, 'identity.txt'), 'source'); fs.writeFileSync(path.join(target, 'identity.txt'), 'target');
  const sourceSnapshots: string[] = [];
  const f = await fixture(source, async request => {
    switch (++calls) {
      case 1: return tool('write_file', { path: 'effect.txt', content: 'source effect' }, 'source-write');
      case 2: assert.equal(results(request)[0]!.is_error, undefined); return response('source complete');
      case 3:
        sourceSnapshots.push(fs.readFileSync(f.session.file, 'utf8'));
        assert.ok(JSON.stringify(request.messages).includes('source complete'));
        assert.ok(JSON.stringify(request.messages).includes('Workspace relocation context'));
        return response('', [{ name: 'read_file', input: { path: 'identity.txt' }, id: 'target-read' },
          { name: 'write_file', input: { path: 'effect.txt', content: 'target effect' }, id: 'target-write' }]);
      case 4: assert.match(String(results(request)[0]!.content), /target/); return response('target complete');
      default: assert.fail('unexpected cwd model call');
    }
  });
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } }); let status = '';
  const statusStream = new Writable({ write(chunk, _encoding, done) { status += chunk.toString(); done(); } });
  try {
    await interactiveLoop(f.session, f.provider, f.runtime, { input: Readable.from([
      `source task\n/cwd ${target}\ntarget task\n/exit\n`,
    ]), output, status: statusStream, signal: f.controller.signal });
    assert.equal(calls, 4, status); assert.equal(sourceSnapshots.length, 1);
    assert.equal(fs.readFileSync(f.session.file, 'utf8'), sourceSnapshots[0]);
    assert.equal(fs.readFileSync(path.join(source, 'effect.txt'), 'utf8'), 'source effect');
    assert.equal(fs.readFileSync(path.join(target, 'effect.txt'), 'utf8'), 'target effect');
    assert.equal(listSessions(source).length, 1); assert.equal(listSessions(target).length, 1);
    const moved = listSessions(target)[0]!; assert.equal(moved.active, false);
    const reopened = Session.open(target, { id: moved.id });
    try {
      assert.equal(reopened.config.workspace, target); assert.deepEqual(reopened.config.features, FEATURES);
      assertPaired(reopened.messages);
      assert.equal(reopened.events.some(event => event.kind === 'tool_start' && event.id === 'source-write'), false);
      assert.ok(reopened.events.some(event => event.kind === 'turn_end' && event.reason === 'workspace_relocated'));
    } finally { reopened.close(); }
    assert.equal(listSessions(source).some(session => session.active), false);
    assert.equal(listSessions(target).some(session => session.active), false);
  } finally { await f.close(); }
});

test('migration idle interactive host abort and pre-aborted entry wake the queue and close TTY/session', TIMEOUT, async t => {
  const { interactiveLoop } = await import('../src/interactive.js');
  for (const preAborted of [false, true]) {
    const root = workspace(t);
    const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false, rawCalls: [] as boolean[],
      setRawMode(value: boolean) { this.isRaw = value; this.rawCalls.push(value); return this; } });
    const output = Object.assign(new Writable({ write(_chunk, _encoding, done) { done(); } }),
      { isTTY: true, columns: 80, rows: 24 });
    const f = await fixture(root, async () => { assert.fail('idle abort must not call the provider'); });
    const controller = new AbortController();
    try {
      if (preAborted) controller.abort();
      const running = interactiveLoop(f.session, f.provider, f.runtime,
        { input, output, status: output, signal: controller.signal });
      if (!preAborted) { await until(() => input.listenerCount('data') > 0); controller.abort(); }
      await running;
      assert.equal(input.isRaw, false); assert.equal(input.listenerCount('data'), 0);
      assert.deepEqual(input.rawCalls, preAborted ? [] : [true, false]);
      assert.equal(listSessions(root).some(session => session.active), false);
    } finally { controller.abort(); input.emit('end'); await f.close(); }
  }
});

test('migration Agent async hooks notify only their owner and clear/runtime close reap active commands', TIMEOUT, async t => {
  const root = workspace(t), release = path.join(root, 'release-start'), pidFile = path.join(root, 'hook.pid');
  // Exec keeps the recorded PID directly owned/reaped by the hook runner under parallel load.
  const nodeCommand = (script: string) => `exec '${process.execPath.replace(/'/g, "'\\''")}' -e '${script.replace(/'/g, "'\\''")}'`;
  const startCommand = nodeCommand(`const fs=require("node:fs");const timer=setInterval(()=>{
    if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);process.stdout.write(JSON.stringify({additionalContext:"async startup ready"}));}
  },10);`);
  const longCommand = nodeCommand(`require("node:fs").writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000);`);
  let calls = 0;
  const f = await fixture(root, async request => {
    if (++calls === 1) return tool('write_file', { path: 'effect.txt', content: 'tool completed before async hook' }, 'hook-write');
    assert.equal(results(request)[0]!.is_error, undefined); return response('parent is idle');
  }, config => { config.hooks = {
    SessionStart: [{ command: startCommand, async: true, timeout: 10 }],
    PostToolUse: [{ command: longCommand, async: true, timeout: 10, matcher: 'write_file' }],
  }; });
  const notified: string[] = [], unsubscribe = f.runtime.subscribe!(owner => notified.push(owner));
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  let second: Session | undefined;
  try {
    assert.ok(f.runtime.hookOptions);
    const agent = new Agent(f.session, f.provider, f.runtime.buildTools(f.session.config, f.session.id),
      { hookOptions: f.runtime.hookOptions(f.session.config, f.session.id) });
    await agent.startSession('startup', AbortSignal.timeout(5000));
    assert.equal(calls, 0); assert.equal(fs.existsSync(release), false);
    assert.deepEqual(f.runtime.drainEvents!(f.session.id), []);
    fs.writeFileSync(release, 'ready'); await until(() => notified.includes(f.session.id));
    assert.deepEqual(f.runtime.drainEvents!('foreign-owner'), []);
    const completion = f.runtime.drainEvents!(f.session.id);
    assert.equal(completion.length, 1); assert.equal(completion[0]!.kind, 'notification');
    assert.match(completion[0]!.prompt!, /async startup ready/);
    assert.match(completion[0]!.prompt!, /"state":"completed"/);
    assert.deepEqual(f.runtime.drainEvents!(f.session.id), []);
    await agent.run('execute with async post hook', AbortSignal.timeout(5000));
    await until(() => fs.existsSync(pidFile)); const firstPid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(alive(firstPid), true); assert.equal(f.session.awaitingResponse, false);
    await f.runtime.releaseSession!(f.session.id); await until(() => !alive(firstPid));
    assert.deepEqual(f.runtime.drainEvents!(f.session.id), []);
    fs.unlinkSync(pidFile);
    second = Session.open(root, { config: f.session.config });
    const secondAgent = new Agent(second, f.provider, f.runtime.buildTools(second.config, second.id),
      { hookOptions: f.runtime.hookOptions(second.config, second.id) });
    await secondAgent.emitHook('PostToolUse', { tool_name: 'write_file', tool_use_id: 'closing' }, AbortSignal.timeout(5000));
    await until(() => fs.existsSync(pidFile)); const secondPid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(alive(secondPid), true); await f.runtime.close(); await until(() => !alive(secondPid));
    second.close(); f.session.close();
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
    assert.equal(listSessions(root).some(session => session.active), false);
  } finally { unsubscribe(); second?.close(); await f.close(); }
});

for (const allow of [true, false]) {
  test(`migration interactive skill command approval ${allow} controls actual command effects`, TIMEOUT, async t => {
    const { interactiveLoop } = await import('../src/interactive.js');
    const root = workspace(t), marker = path.join(root, 'skill-effect.txt'); let calls = 0;
    const command = `'${process.execPath}' -e 'require("node:fs").writeFileSync(${JSON.stringify(marker)},"approved")'`;
    const f = await fixture(root, async () => { calls++; return response('skill completed'); }, config => {
      config.allowShell = true; config.permissions = { mode: 'ask', allow: [], deny: [] };
      config.skills = [{ name: 'approval', path: path.join(root, 'SKILL.md'), description: 'fixture',
        userInvocable: true, disableModelInvocation: false, shell: '/bin/sh', body: `Execute !\`${command}\`` }];
    });
    const input = new PassThrough(); let outputText = '', statusText = '';
    const output = new Writable({ write(chunk, _encoding, done) { outputText += chunk.toString(); done(); } });
    const status = new Writable({ write(chunk, _encoding, done) { statusText += chunk.toString(); done(); } });
    let running: Promise<void> | undefined;
    try {
      running = interactiveLoop(f.session, f.provider, f.runtime, { input, output, status, signal: f.controller.signal });
      input.write('/approval\n'); await until(() => outputText.includes('Allow once? [y/N]'));
      input.write(allow ? 'yes\n' : 'no\n');
      await until(() => allow ? statusText.includes('finished: end_turn') : statusText.includes('error:'));
      input.end('/exit\n'); await running;
      assert.equal(fs.existsSync(marker), allow); assert.equal(calls, allow ? 1 : 0);
      assert.equal(listSessions(root).some(session => session.active), false);
    } finally { f.controller.abort(); input.end(); await running; await f.close(); }
  });
}

test('migration interactive TTY consumes pinned custom submit binding instead of Enter', TIMEOUT, async t => {
  const { interactiveLoop } = await import('../src/interactive.js');
  const root = workspace(t); let captured = '', calls = 0;
  const f = await fixture(root, async request => { calls++; captured = String(request.messages.at(-1)!.content); return response('mapped complete'); },
    config => { config.keybindings = { '\r': 'newline', '\x1b[99~': 'submit' }; });
  const input = Object.assign(new PassThrough(), { isTTY: true, isRaw: false,
    setRawMode(value: boolean) { this.isRaw = value; return this; } });
  let status = '';
  const output = Object.assign(new Writable({ write(_chunk, _encoding, done) { done(); } }), { isTTY: true, columns: 80, rows: 24 });
  const statusStream = new Writable({ write(chunk, _encoding, done) { status += chunk.toString(); done(); } });
  let running: Promise<void> | undefined;
  try {
    running = interactiveLoop(f.session, f.provider, f.runtime, { input, output, status: statusStream, signal: f.controller.signal });
    await until(() => input.listenerCount('data') > 0);
    input.emit('data', Buffer.from('first\rsecond\x1b[99~'));
    await until(() => status.includes('finished: end_turn'));
    assert.equal(calls,1);assert.equal(captured,'first\nsecond');input.emit('data',Buffer.from('\x04'));
    assert.equal(input.isRaw,true);input.emit('data',Buffer.from('\x04'));await running;
    assert.equal(input.isRaw, false); assert.equal(input.listenerCount('data'), 0);
  } finally { f.controller.abort(); input.emit('end'); await running; await f.close(); }
});
