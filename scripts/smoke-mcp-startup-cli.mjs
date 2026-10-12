import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = process.argv.includes('--compiled');
const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-startup-cli-')));
const workspace = path.join(job, 'workspace');
const requests = [], calls = [], deleted = [], failures = [];
let peerInitializes = 0, downAttempts = 0, downInitializes = 0, unavailable = true;
let child, server, stdout = '', stderr = '', ended = false;
const wait = async (predicate, label) => {
  const deadline = Date.now() + 12000;
  while (!predicate()) {
    if (ended || Date.now() > deadline) throw new Error(`CLI ${label}: ${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
try {
  fs.mkdirSync(path.join(workspace, 'user'), { recursive: true });
  fs.mkdirSync(path.join(workspace, '.harness'));
  server = http.createServer((req, res) => {
    void (async () => {
      if (req.method === 'DELETE') { deleted.push(req.headers['mcp-session-id']); res.writeHead(204).end(); return; }
      let text = ''; for await (const chunk of req) {
        text += chunk; if (text.length > 4 * 1024 * 1024) throw new Error('fixture body limit');
      }
      const body = JSON.parse(text);
      if (req.url === '/peer' || req.url === '/down') {
        const peer = req.url === '/peer';
        const json = result => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); };
        if (!peer && body.method === 'initialize') downAttempts++;
        if (!peer && unavailable) { res.writeHead(503).end(); return; }
        if (body.method === 'initialize') {
          const session = peer ? `peer-${++peerInitializes}` : `down-${++downInitializes}`;
          res.setHeader('Mcp-Session-Id', session);
          json({ protocolVersion: '2025-06-18', capabilities: { tools: {} } });
        } else if (body.method === 'tools/list') json({ tools: [{ name: peer ? 'peer_ping' : 'fresh_ping',
          description: 'Owned startup fixture', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } }] });
        else if (body.method === 'tools/call') {
          calls.push({ server: peer ? 'peer' : 'down', session: req.headers['mcp-session-id'], name: body.params.name });
          json({ content: [{ type: 'text', text: peer ? 'PEER_READY' : 'DOWN_RECOVERED' }] });
        } else res.writeHead(202).end();
        return;
      }
      assert.equal(req.url, '/v1/messages');
      requests.push(body);
      const last = body.messages.at(-1), prompt = typeof last.content === 'string' ? last.content : '';
      const selected = prompt === 'peer' ? { name: 'mcp__peer__peer_ping', input: {} }
        : prompt === 'discover' ? { name: 'mcp_tool_search', input: { query: '', server: 'down' } }
        : prompt === 'recovered' ? { name: 'mcp_tool_call', input: { server: 'down', tool: 'fresh_ping', arguments: {} } } : undefined;
      const block = selected ? { type: 'tool_use', id: `startup-${requests.length}`, ...selected }
        : { type: 'text', text: 'startup fixture complete' };
      const events = [
        { type: 'message_start', message: { id: 'startup-message', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: selected ? { ...block, input: {} } : { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: selected ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: selected ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    })().catch(error => { failures.push(error.message); res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // mcpServers live in the user layer: a checkout-declared server is held as a decision to answer.
  fs.writeFileSync(path.join(workspace, 'user/settings.json'), JSON.stringify({
    mcpServers: { peer: { type: 'http', url: url + '/peer' }, down: { type: 'http', url: url + '/down' } },
  }));
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({
    permissions: { mode: 'bypass', allow: [], deny: [] },
    features: { mcpDynamic: true, mcpRecovery: true },
  }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: 'owned-startup-fixture', LLM_MODEL: 'fixture/startup', LLM_BASE_URL: url,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, 'bin/personal-harness.mjs')]
    : ['--import', 'tsx', path.join(root, 'src/cli.ts')]), '--workspace', workspace, '--user-dir', path.join(workspace, 'user'), '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-128000); });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-128000); });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { ended = true; resolve(code); }); });
  const task = async prompt => {
    const offset = stderr.length; child.stdin.write(prompt + '\n');
    await wait(() => stderr.slice(offset).includes('finished: end_turn'), prompt);
  };
  const result = () => requests.at(-1).messages.at(-1).content.find(block => block.type === 'tool_result');
  const status = async () => {
    const offset = stdout.length; child.stdin.write('/mcp\n');
    await wait(() => stdout.slice(offset).includes('connections'), 'status');
    return JSON.parse(stdout.slice(offset).trim());
  };
  await wait(() => stderr.includes('Personal harness.'), 'startup');
  await wait(() => downAttempts >= 2, 'first background attempt');
  const initial = await status();
  assert.equal(initial.connections.peer.state, 'connected');
  assert.equal(initial.connections.down.state, 'disconnected');
  assert.equal(initial.connections.down.generation, 0);
  await task('peer'); assert.equal(result().content, 'PEER_READY');
  await task('discover'); assert.deepEqual(JSON.parse(result().content).tools, []);
  const schemas = JSON.stringify(requests[0].tools);
  assert.ok(requests[0].tools.some(tool => tool.name === 'mcp__peer__peer_ping'));
  assert.equal(requests[0].tools.some(tool => tool.name.startsWith('mcp__down__')), false);
  unavailable = false;
  await wait(() => downInitializes === 1, 'automatic startup recovery');
  // The initialize response precedes candidate discovery and commit.
  let recovered;
  do { recovered = await status(); if (recovered.connections.down.state !== 'connected') await new Promise(resolve => setTimeout(resolve, 20)); }
  while (recovered.connections.down.state !== 'connected');
  assert.equal(recovered.connections.down.generation, 1);
  assert.equal(recovered.connections.peer.generation, 1);
  await task('discover'); assert.equal(JSON.parse(result().content).tools[0].tool, 'fresh_ping');
  await task('recovered'); assert.equal(result().content, 'DOWN_RECOVERED');
  await task('peer'); assert.equal(result().content, 'PEER_READY');
  assert.ok(requests.every(body => JSON.stringify(body.tools) === schemas));
  assert.equal(peerInitializes, 1); assert.equal(downInitializes, 1);
  assert.deepEqual(calls, [
    { server: 'peer', session: 'peer-1', name: 'peer_ping' },
    { server: 'down', session: 'down-1', name: 'fresh_ping' },
    { server: 'peer', session: 'peer-1', name: 'peer_ping' },
  ]);
  child.stdin.end('/exit\n'); assert.equal(await exited, 0); child = undefined;
  const journalDir = path.join(workspace, '.agent');
  const journals = fs.readdirSync(journalDir).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 1);
  const journal = fs.readFileSync(path.join(journalDir, journals[0]), 'utf8');
  const records = journal.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records[0].config.features.mcpRecovery, true);
  assert.equal(records.filter(record => record.kind === 'tool_start').length, 5);
  assert.equal(journal.includes('owned-startup-fixture'), false);
  assert.equal(fs.readdirSync(journalDir).some(name => name.endsWith('.lock')), false);
  assert.deepEqual(new Set(deleted), new Set(['peer-1', 'down-1']));
  assert.equal(requests.length, 10); assert.deepEqual(failures, []);
  console.log(JSON.stringify({ cli: 'passed', compiledCLI: compiled, startupDegraded: true, peerRetained: true,
    automaticRecovery: true, freshDiscovery: true, publishedSchemasPinned: true, noToolReplay: true,
    sameJournal: true, credentialExcluded: true, sessionsClosed: true, locksReleased: true,
    modelRequests: requests.length, remoteToolCalls: calls.length, downAttempts, gateway: 'owned loopback SSE', job }));
} finally {
  child?.kill('SIGKILL');
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(job, 'stdout.log'), stdout);
  fs.writeFileSync(path.join(job, 'stderr.log'), stderr);
  fs.rmSync(workspace, { recursive: true, force: true });
}
