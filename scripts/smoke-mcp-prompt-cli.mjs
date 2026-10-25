import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'mcp-prompt-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
let generation = 1, failList = false, gets = 0, deletes = 0;
const rpc = [], models = [], streams = new Set();
let current;
const server = http.createServer((request, response) => {
  void (async () => {
    if (request.url === '/mcp' && request.method === 'GET') {
      gets++; current = response; streams.add(response); response.on('close', () => streams.delete(response));
      response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
      response.write('retry: 50\n\n'); return;
    }
    if (request.method === 'DELETE') { deletes++; response.writeHead(204).end(); return; }
    let text = ''; for await (const part of request) text += part;
    const message = JSON.parse(text);
    if (request.url !== '/mcp') {
      models.push(message);
      const events = [
        { type: 'message_start', message: { id: 'owned-prompt', type: 'message', role: 'assistant', model: message.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'PROMPT_COMPLETE' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')); return;
    }
    rpc.push({ method: message.method, params: message.params, generation });
    const reply = result => response.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    if (message.method === 'initialize') {
      response.setHeader('Mcp-Session-Id', `owned-prompt-${deletes}`);
      reply({ protocolVersion: message.params.protocolVersion, capabilities: { prompts: { listChanged: true } } });
    } else if (message.method === 'prompts/list') {
      if (failList) response.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'owned discovery failure' } }));
      else reply({ prompts: generation === 4 ? [] : [{ name: 'review', description: `PROMPT_GENERATION_${generation}`,
        arguments: [{ name: 'target', required: true }, { name: 'style' }] }, { name: 'hello', description: 'NO_ARGS_PROMPT' }] });
    } else if (message.method === 'prompts/get') reply({ messages: [
      { role: 'user', content: { type: 'text', text: `Review ${message.params.arguments?.target ?? 'hello'}` } },
      { role: 'assistant', content: { type: 'resource', resource: { uri: 'doc://guide', text: 'OWNED_RESOURCE' } } },
    ] });
    else response.writeHead(202).end();
  })().catch(() => response.destroy());
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-prompt', thinking: false,
  promptSuggestionEnabled: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
  features: { mcpCatalog: true, mcpRecovery: true, mcpNotificationStream: true },
  mcpServers: { 'docs local': { type: 'http', url: base + '/mcp' } } }));
const pty = path.join(temporary, 'terminal.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', HOME: temporary };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'fixture', LLM_BASE_URL: base, LLM_MODEL: 'fixture-prompt', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
const terminal = new TerminalScreen(120, 40);
const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'),
  '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway'],
{ cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const closed = new Promise(resolve => child.once('close', resolve));
let errors = '', oneShot;
child.stdout.setEncoding('utf8'); child.stdout.on('data', text => terminal.write(text));
child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { errors += text; });
const screen = () => terminal.lines().join('\n');
const checks = [];
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function until(predicate, label) {
  const end = Date.now() + 12000;
  while (!predicate()) { assert.ok(Date.now() < end, `${label}\n${errors}\n${screen()}`); await delay(20); }
}
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
try {
  await until(() => screen().includes('? for shortcuts') && gets === 1, 'CLI ready');
  child.stdin.write('/mcp__docs_local__r');
  await until(() => screen().includes('PROMPT_GENERATION_1'), 'MCP prompt appears in slash menu');
  pass('live prompt discovery reaches slash menu');
  child.stdin.write('\t'); await delay(80);
  pass('argument command acceptance completes without a model turn', models.length === 0 && rpc.every(row => row.method !== 'prompts/get'));
  child.stdin.write('alpha concise surplus\r');
  await until(() => models.length === 1 && screen().includes('finished: end_turn'), 'expanded prompt model turn committed');
  pass('source positional arguments ignore surplus words', JSON.stringify(rpc.find(row => row.method === 'prompts/get').params)
    === JSON.stringify({ name: 'review', arguments: { target: 'alpha', style: 'concise' } }));
  pass('both source roles flatten into model user content', JSON.stringify(models[0].messages).includes('Review alpha')
    && JSON.stringify(models[0].messages).includes('[Resource from docs local at doc://guide] OWNED_RESOURCE'));
  const journal = path.join(workspace, '.agent', journals()[0]);
  const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  pass('journal preserves raw command and expanded meta content', records.some(row => row.kind === 'message' && row.classifier?.humanText === '/mcp__docs_local__review alpha concise surplus')
    && records.some(row => row.kind === 'message' && row.isMeta && JSON.stringify(row.message.content).includes('Review alpha')));
  const before = fs.readFileSync(journal);
  child.stdin.write('/mcp__docs_local__r'); generation = 2;
  current.write('data: {"jsonrpc":"2.0","method":"notifications/prompts/list_changed"}\n\n');
  await until(() => screen().includes('PROMPT_GENERATION_2'), 'notification changes current slash draft');
  pass('prompt notification repaints the same draft', !screen().includes('PROMPT_GENERATION_1'));
  failList = true; const previousLists = rpc.filter(row => row.method === 'prompts/list').length;
  current.end(); await until(() => gets === 2 && rpc.filter(row => row.method === 'prompts/list').length > previousLists, 'reopen refetch');
  await delay(80); pass('failed reopened prompt discovery retains commands', screen().includes('PROMPT_GENERATION_2'));
  failList = false; generation = 3; current.end();
  await until(() => screen().includes('PROMPT_GENERATION_3'), 'reopen updates prompts without a notification');
  pass('reopen supplies a missed prompt catalog change');
  generation = 4; current.end();
  await until(() => gets === 4 && !screen().includes('PROMPT_GENERATION_3'), 'empty prompt catalog removes commands');
  pass('passive catalog updates preserve journal and model count', before.equals(fs.readFileSync(journal)) && models.length === 1);
  child.stdin.write('\x01\x0b/exit\r'); assert.equal(await Promise.race([closed, delay(6000).then(() => 'timeout')]), 0, errors);
  generation = 1;
  oneShot = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--user-dir', user,
    '--no-inherit-gateway', '/mcp__docs_local__review beta'], { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let oneErrors = ''; oneShot.stdout.resume(); oneShot.stderr.on('data', part => { oneErrors += part; });
  const oneDone = new Promise(resolve => oneShot.once('close', resolve));
  assert.equal(await Promise.race([oneDone, delay(12000).then(() => 'timeout')]), 0, oneErrors);
  pass('compiled one-shot command expands with an omitted optional argument', models.length === 2
    && JSON.stringify(rpc.filter(row => row.method === 'prompts/get').at(-1).params) === JSON.stringify({ name: 'review', arguments: { target: 'beta' } })
    && JSON.stringify(models[1].messages).includes('Review beta'));
  await until(() => streams.size === 0, 'GET cleanup');
  pass('both entrypoints release transports and locks', deletes === 2 && fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, gets, deletes, rpc, modelRequests: models.length }, null, 2));
  console.log(`${checks.length} checks, ${models.length} owned loopback model requests, fixture ${temporary}`);
} finally {
  for (const active of [child, oneShot]) if (active && active.exitCode === null && active.signalCode === null) {
    try { process.kill(-active.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise(resolve => active.once('close', resolve)), delay(1000)]);
    if (active.exitCode === null && active.signalCode === null) { try { process.kill(-active.pid, 'SIGKILL'); } catch {} }
  }
  terminal.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
