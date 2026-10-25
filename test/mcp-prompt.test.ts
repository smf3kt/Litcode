import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Anthropic } from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { connectMcpServers, type McpConnection } from '../src/mcp.js';
import { runMcpPrompt } from '../src/mcp-prompt-run.js';
import { type McpPromptCommand, mcpPromptCommands } from '../src/mcp-prompt.js';
import { interactiveLoop } from '../src/interactive.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import { commandSuggestions, tuiCommandsWithSkills } from '../src/tui-autocomplete.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'prompt-test-')));
const options = { catalog: true, recovery: true, notificationStream: true, requestTimeoutMs: 1200 };
const prompt = { name: 'review', description: 'FIRST', arguments: [{ name: 'target', required: true }, { name: 'style' }] };
async function until(predicate: () => boolean, message: string) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { assert.ok(Date.now() < deadline, message); await delay(5); }
}
type Rpc = { id: number; method: string; params: { name?: string; arguments?: Record<string, string>; cursor?: string } };
async function fixture() {
  const streams = new Map<string, ServerResponse>(), calls: { server: string; message: Rpc }[] = [];
  let prompts: unknown[] = [prompt], listError = 0, hold = false;
  const held: { response: ServerResponse; message: Rpc }[] = [];
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6lwAAAAASUVORK5CYII=';
  const reply = (response: ServerResponse, message: Rpc, result: unknown) => response.writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  const server = http.createServer((request, response) => {
    void (async () => {
      const name = decodeURIComponent(request.url!.slice(1));
      if (request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders(); response.write('retry: 5\n\n');
        streams.set(name, response); response.on('close', () => { if (streams.get(name) === response) streams.delete(name); }); return;
      }
      if (request.method === 'DELETE') { response.writeHead(204).end(); return; }
      let body = ''; for await (const part of request) body += part;
      const message: Rpc = JSON.parse(body); calls.push({ server: name, message });
      if (message.method === 'initialize') {
        response.setHeader('Mcp-Session-Id', encodeURIComponent(name));
        reply(response, message, { protocolVersion: '2025-06-18', capabilities: name === 'absent' ? {} : { prompts: { listChanged: true } } });
      } else if (message.method === 'prompts/list') {
        if (listError) response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: message.id,
          error: { code: listError, message: 'owned list failure' } }));
        else reply(response, message, { prompts: name === 'peer' ? [{ name: 'peer' }] : prompts });
      } else if (message.method === 'prompts/get') {
        if (hold) { held.push({ response, message }); return; }
        reply(response, message, { messages: [
          { role: 'user', content: { type: 'text', text: 'Review ' + message.params.arguments?.target } },
          { role: 'assistant', content: { type: 'resource', resource: { uri: 'doc://data', text: 'RESOURCE' } } },
          { role: 'user', content: { type: 'resource_link', name: 'link', uri: 'doc://link', description: 'linked data' } },
          { role: 'assistant', content: { type: 'image', data: png, mimeType: 'image/png' } },
          { role: 'user', content: { type: 'audio', data: Buffer.from('OWNED_AUDIO').toString('base64'), mimeType: 'audio/wav' } },
          { role: 'user', content: { type: 'resource', resource: { uri: 'doc://pdf', blob: Buffer.from('%PDF-owned').toString('base64'), mimeType: 'application/pdf' } } },
        ] });
      } else response.writeHead(202).end();
    })().catch(() => response.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { calls, streams, held, reply,
    setPrompts: (value: unknown[]) => { prompts = value; }, setError: (value: number) => { listError = value; }, setHold: (value: boolean) => { hold = value; },
    config: (names = ['docs local']) => Object.fromEntries(names.map(name => [name, { type: 'http' as const, url: `http://127.0.0.1:${address.port}/${name}` }])),
    notify: (name = 'docs local') => streams.get(name)?.write('data: {"jsonrpc":"2.0","method":"notifications/prompts/list_changed"}\n\n'),
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}
const count = (calls: Awaited<ReturnType<typeof fixture>>['calls'], method: string, server?: string) =>
  calls.filter(row => row.message.method === method && (server === undefined || row.server === server)).length;

test('live prompt catalogs preserve source positional arguments, content and per-server refresh semantics', async () => {
  const workspace = temporary(), remote = await fixture();
  const lifetime = new AbortController(), context = { workspace, signal: lifetime.signal, maxOutputBytes: 24000 };
  const connection = await connectMcpServers(remote.config(['docs local', 'peer', 'absent']), context, options)
    .catch(async error => { await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); throw error; });
  let commands: McpPromptCommand[] = [];
  const unsubscribe = connection.promptCommands!.subscribe(value => { commands = value; });
  try {
    assert.equal(count(remote.calls, 'prompts/list'), 0);
    commands = await connection.promptCommands!.list(lifetime.signal);
    assert.equal(count(remote.calls, 'prompts/list', 'absent'), 0);
    const command = commands.find(value => value.name === 'review')!;
    assert.equal(command.commandName, 'mcp__docs_local__review');
    assert.equal(command.displayName, 'docs local:review (MCP)');
    const suggestions = commandSuggestions('/mcp__docs_local__r', 19, tuiCommandsWithSkills([], { mcpPrompts: commands }));
    assert.equal(suggestions[0]?.name, command.commandName); assert.equal(suggestions[0]?.executeOnAccept, false);
    assert.equal(commandSuggestions('/mcp__peer__', 12, tuiCommandsWithSkills([], { mcpPrompts: commands }))[0]?.executeOnAccept, true);
    await assert.rejects(connection.promptCommands!.invoke(command, '', lifetime.signal), /Missing required argument: target/);
    assert.equal(count(remote.calls, 'prompts/get'), 0);
    const content = await connection.promptCommands!.invoke(command, ' "alpha beta" surplus ', lifetime.signal);
    assert.deepEqual(remote.calls.filter(row => row.message.method === 'prompts/get').at(-1)?.message.params,
      { name: 'review', arguments: { target: '"alpha', style: 'beta"' } });
    assert.deepEqual(content.slice(0, 3), [{ type: 'text', text: 'Review "alpha' }, { type: 'text', text: '[Resource from docs local at doc://data] RESOURCE' },
      { type: 'text', text: '[Resource link: link] doc://link (linked data)' }]);
    assert.equal(content[3]?.type, 'image');
    const paths = content.flatMap(block => block.type === 'text' ? [...block.text.matchAll(/(?:saved to |\[Image source: )([^\]\n]+)/g)].map(match => match[1]!) : []);
    assert.equal(paths.length, 3); assert.ok(paths.every(file => file.startsWith(workspace + path.sep)));
    assert.deepEqual(paths.map(file => fs.readFileSync(file)).slice(1), [Buffer.from('OWNED_AUDIO'), Buffer.from('%PDF-owned')]);
    assert.ok(paths.every(file => (fs.statSync(file).mode & 0o777) === 0o600));
    const schemas = JSON.stringify(connection.tools.map(tool => tool.schema)), peerCalls = count(remote.calls, 'prompts/list', 'peer');
    await until(() => remote.streams.size === 3, 'streams ready');
    remote.setPrompts([{ ...prompt, description: 'SECOND' }]); remote.notify();
    await until(() => commands.some(value => value.description === 'SECOND'), 'live prompt refresh');
    remote.setError(-32603); remote.streams.get('docs local')!.end();
    await until(() => count(remote.calls, 'prompts/list', 'docs local') === 3, 'failed reopen refresh'); await delay(15);
    assert.equal(commands.find(value => value.name === 'review')?.description, 'SECOND');
    remote.setError(0); remote.setPrompts([]); remote.streams.get('docs local')!.end();
    await until(() => commands.every(value => value.name !== 'review'), 'empty catalog removes prompts');
    assert.equal(count(remote.calls, 'prompts/list', 'peer'), peerCalls);
    assert.equal(JSON.stringify(connection.tools.map(tool => tool.schema)), schemas);
    await connection.setEnabled!('docs local', false, lifetime.signal);
    assert.equal(commands.some(value => value.server === 'docs local'), false);
    remote.setPrompts([prompt]); await connection.setEnabled!('docs local', true, lifetime.signal);
    await until(() => commands.some(value => value.name === 'review'), 'enabled generation refresh');
    remote.setError(-32601); remote.streams.get('docs local')!.end();
    await until(() => commands.every(value => value.name !== 'review'), 'method not found clears commands');
  } finally { unsubscribe(); await connection.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('stdio prompt cancellation and next-use recovery retain current generations and release owned work', async () => {
  const workspace = temporary(), file = path.join(workspace, 'server.cjs'), boots = path.join(workspace, 'boots');
  fs.writeFileSync(file, `const fs=require('node:fs'),readline=require('node:readline');
const boot=Number(fs.existsSync(${JSON.stringify(boots)})?fs.readFileSync(${JSON.stringify(boots)},'utf8'):0)+1;fs.writeFileSync(${JSON.stringify(boots)},String(boot));
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);
if(m.method==='initialize')reply(m.id,{protocolVersion:'2024-11-05',capabilities:{prompts:{listChanged:true}}});
if(m.method==='prompts/list')reply(m.id,{prompts:[{name:'review',arguments:[{name:'target',required:true}]}]});
if(m.method==='prompts/get'){if(m.params.arguments.target==='crash')process.exit(0);else if(m.params.arguments.target!=='hold')reply(m.id,{messages:[{role:'user',content:{type:'text',text:'boot='+boot}}]});}
if(m.method==='notifications/cancelled')fs.writeFileSync(${JSON.stringify(path.join(workspace, 'cancelled'))},'yes');});`);
  const lifetime = new AbortController();
  const connection = await connectMcpServers({ docs: { command: process.execPath, args: [file] } },
    { workspace, signal: lifetime.signal, maxOutputBytes: 24000 }, options);
  try {
    const command = (await connection.promptCommands!.list(lifetime.signal))[0]!;
    const controller = new AbortController();
    const pending = connection.promptCommands!.invoke(command, 'hold', controller.signal);
    const rejected = assert.rejects(pending, /abort/i);
    await delay(30); controller.abort(); await rejected;
    await until(() => fs.existsSync(path.join(workspace, 'cancelled')), 'stdio cancellation sent');
    await assert.rejects(connection.promptCommands!.invoke(command, 'crash', lifetime.signal));
    const recovered = (await connection.promptCommands!.list(lifetime.signal))[0]!;
    assert.deepEqual(await connection.promptCommands!.invoke(recovered, 'done', lifetime.signal), [{ type: 'text', text: 'boot=2' }]);
    assert.equal(connection.servers!().docs?.generation, 2);
    const hold = connection.promptCommands!.invoke(recovered, 'hold', lifetime.signal);
    const closed = assert.rejects(hold); await delay(15); await connection.close(); await closed;
    assert.equal(connection.servers!().docs?.state, 'closed');
  } finally { await connection.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('MCP command entrypoints journal typed input and meta expansion once, with hook and cancellation gates', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const remote = await fixture(), lifetime = new AbortController();
  let connection: McpConnection | undefined;
  try {
    connection = await connectMcpServers(remote.config(), { workspace, signal: lifetime.signal, maxOutputBytes: 24000 }, options);
    const commands = connection.promptCommands!, command = (await commands.list(lifetime.signal))[0]!;
    let requests = 0;
    const provider: ModelProvider = { count: async () => 1, complete: async request => {
      requests++; assert.match(JSON.stringify(request.messages), /Review alpha/);
      return { id: 'owned', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'done', citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    } };
    const config = { ...defaultConfig(workspace, []), model: 'fixture', watchConfig: false, configSources: { userDir },
      skills: [], promptSuggestionEnabled: false };
    const session = Session.open(workspace, { config });
    const input = new PassThrough(), output = new Writable({ write(_chunk, _encoding, done) { done(); } });
    try {
      const loop = interactiveLoop(session, provider, { tools: [], buildTools: () => [], close: async () => {}, limits: [], promptCommands: commands },
        { input, output, status: output, signal: lifetime.signal });
      input.end('/mcp__docs_local__review alpha concise\n/exit\n'); await loop;
      assert.equal(requests, 1);
      const raw = session.events.find(row => row.kind === 'message' && row.classifier?.humanText === '/mcp__docs_local__review alpha concise');
      assert.ok(raw && raw.kind === 'message'); assert.match(JSON.stringify(raw.message.content), /<command-name>\/mcp__docs_local__review<\/command-name>/);
      assert.ok(session.events.some(row => row.kind === 'message' && row.isMeta && JSON.stringify(row.message.content).includes('Review alpha')));
    } finally { input.destroy(); session.close(); }
    const pendingSession = Session.open(workspace, { config });
    try {
      pendingSession.append({ kind: 'message', message: { role: 'user', content: 'ORIGINAL_PENDING_TASK' } });
      const before = JSON.stringify(pendingSession.events), priorGets = count(remote.calls, 'prompts/get');
      const pendingAgent = new Agent(pendingSession, provider, []);
      for (const args of ['', 'alpha']) await assert.rejects(runMcpPrompt(pendingAgent, commands, command, args, lifetime.signal), /unfinished turn/);
      assert.equal(JSON.stringify(pendingSession.events), before);
      assert.equal(count(remote.calls, 'prompts/get'), priorGets);
      assert.equal(pendingSession.awaitingResponse, true);
      const continuation = new Agent(pendingSession, { ...provider, complete: async request => {
        assert.equal(request.messages.at(-1)?.content, 'ORIGINAL_PENDING_TASK');
        return { id: 'continued', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'continued', citations: null }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
      } }, []);
      assert.equal((await continuation.run(undefined, lifetime.signal)).text, 'continued');
      assert.equal(pendingSession.awaitingResponse, false);
    } finally { pendingSession.close(); }
    const blocked = Session.open(workspace, { config: { ...config, hooks: { UserPromptExpansion: [{ command: "printf blocked >&2; exit 2" }] } } });
    try {
      const before = count(remote.calls, 'prompts/get');
      const result = await runMcpPrompt(new Agent(blocked, provider, []), commands, command, 'alpha', lifetime.signal);
      assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 0);
      assert.equal(count(remote.calls, 'prompts/get'), before); assert.equal(blocked.messages.length, 0);
    } finally { blocked.close(); }
    const cancelled = Session.open(workspace, { config });
    try {
      remote.setHold(true); const controller = new AbortController();
      const pending = runMcpPrompt(new Agent(cancelled, provider, []), commands, command, 'alpha', controller.signal);
      await until(() => remote.held.length === 1, 'prompt fetch active'); controller.abort();
      assert.equal((await pending).reason, 'aborted');
      remote.reply(remote.held[0]!.response, remote.held[0]!.message, { messages: [{ role: 'user', content: { type: 'text', text: 'LATE' } }] });
      assert.equal(cancelled.messages.length, 2); assert.equal(requests, 1);
      assert.equal(cancelled.awaitingResponse, false);
      assert.equal(JSON.stringify(cancelled.messages).includes('LATE'), false);
      const failed = await runMcpPrompt(new Agent(cancelled, provider, []), commands, command, '', lifetime.signal);
      assert.equal(failed.reason, 'command_error'); assert.equal(failed.modelCalls, 0);
      assert.equal(cancelled.awaitingResponse, false);
      assert.match(JSON.stringify(cancelled.messages), /Missing required argument: target/);
      assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock') && name.includes(session.id)), false);
    } finally { cancelled.close(); }
    assert.equal(mcpPromptCommands('docs', [{ name: 'a'.repeat(600) }]).length, 0);
    assert.deepEqual(mcpPromptCommands('docs', [{ name: 'ｒｅｖｉｅｗ', description: 'a​b' }])
      .map(command => [command.name, command.description]), [['review', 'ab']]);
    assert.equal(mcpPromptCommands('docs', [{ name: 'first', description: '́'.repeat(1048577) }, { name: 'later' }]).length, 0);
  } finally { await connection?.close(); await remote.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
