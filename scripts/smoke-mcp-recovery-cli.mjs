import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = process.argv.includes('--compiled');
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-recovery-cli-')));
const uri = 'fixture://notes%2fExact';
const subscriptions = new Map(), streams = new Map(), subscribed = [], deleted = [], requests = [], calls = [];
let generation = 0, gets = 0, peers = 0, failRestore = false, expire = false;
let child, server, stdout = '', stderr = '', ended = false;
const wait = async (predicate, label) => {
  const deadline = Date.now() + 12000;
  while (!predicate()) {
    if (ended || Date.now() > deadline) throw new Error(`CLI ${label}: ${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const update = session => {
  const res = streams.get(session);
  if (res && subscriptions.get(session)?.has(uri)) res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/resources/updated', params: { uri } })}\n\n`);
};
try {
  fs.mkdirSync(path.join(workspace, 'user')); fs.mkdirSync(path.join(workspace, '.harness'));
  server = http.createServer((req, res) => {
    void (async () => {
      if (req.method === 'DELETE') { deleted.push(req.headers['mcp-session-id']); res.writeHead(204).end(); return; }
      if (req.method === 'GET') {
        const session = req.headers['mcp-session-id']; assert.ok(subscriptions.has(session));
        assert.equal(req.headers['last-event-id'], undefined); gets++; streams.set(session, res);
        res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders();
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 1000);
        res.on('close', () => { clearInterval(heartbeat); if (streams.get(session) === res) streams.delete(session); });
        setTimeout(() => update(session), 30); return;
      }
      let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 4 * 1024 * 1024) throw new Error('fixture body limit'); }
      const body = JSON.parse(text);
      if (req.url === '/mcp' || req.url === '/peer') {
        const peer = req.url === '/peer', session = req.headers['mcp-session-id'];
        const json = result => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); };
        if (body.method === 'initialize') {
          const next = peer ? `peer-${++peers}` : `owned-${++generation}`;
          subscriptions.set(next, new Set()); res.setHeader('Mcp-Session-Id', next);
          json({ protocolVersion: '2025-06-18', capabilities: { tools: {}, ...(peer ? {} : { resources: { subscribe: true } }) } });
        } else if (body.method === 'tools/list') json({ tools: [{ name: 'ping', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }] });
        else if (body.method === 'resources/subscribe') {
          subscribed.push({ session, uri: body.params.uri });
          if (failRestore && session !== 'owned-1') { res.writeHead(503).end(); return; }
          subscriptions.get(session).add(body.params.uri); json({}); setTimeout(() => update(session), 30);
        } else if (body.method === 'resources/unsubscribe') { subscriptions.get(session).delete(body.params.uri); json({}); }
        else if (body.method === 'tools/call') {
          calls.push({ session, name: body.params.name });
          if (expire && !peer) { expire = false; res.writeHead(404).end(); return; }
          json({ content: [{ type: 'text', text: 'recovery ping' }] });
        } else res.writeHead(202).end();
        return;
      }
      requests.push(body);
      const last = body.messages.at(-1), prompt = typeof last.content === 'string' ? last.content : '';
      const names = { subscribe: 'mcp_resource_subscribe', unsubscribe: 'mcp_resource_unsubscribe', poll: 'mcp_resource_notifications', ping: 'mcp__owned__ping' };
      const selected = names[prompt];
      const block = selected ? { type: 'tool_use', id: `recovery-${requests.length}`, name: selected,
        input: prompt === 'ping' ? {} : { server: 'owned', ...(prompt === 'poll' ? {} : { uri }) } } : { type: 'text', text: 'recovery complete' };
      const events = [
        { type: 'message_start', message: { id: 'recovery-message', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: selected ? { ...block, input: {} } : { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: selected ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: selected ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ]; res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    })().catch(error => { stderr += `\nfixture error:${error.message}`; res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // mcpServers live in the user layer: a checkout-declared server is held as a decision to answer.
  fs.writeFileSync(path.join(workspace, 'user/settings.json'), JSON.stringify({
    mcpServers: { owned: { type: 'http', url: url + '/mcp' }, peer: { type: 'http', url: url + '/peer' } } }));
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ permissions: { mode: 'bypass', allow: [], deny: [] },
    features: { mcpDynamic: false, mcpSubscriptions: true, mcpNotificationStream: true, mcpRecovery: true } }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: 'owned-recovery-fixture', LLM_MODEL: 'fixture/recovery', LLM_BASE_URL: url,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  child = spawn(process.execPath, [...(compiled ? [path.join(root, 'bin/personal-harness.mjs')] : ['--import', 'tsx', path.join(root, 'src/cli.ts')]),
    '--workspace', workspace, '--user-dir', path.join(workspace, 'user'), '--interactive'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-100000); });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-100000); });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { ended = true; resolve(code); }); });
  const task = async prompt => { const offset = stderr.length; child.stdin.write(prompt + '\n'); await wait(() => stderr.slice(offset).includes('finished: end_turn'), prompt); };
  const command = async (text, marker) => { const offset = stderr.length; child.stdin.write(text + '\n'); await wait(() => stderr.slice(offset).includes(marker), text); };
  const result = () => requests.at(-1).messages.at(-1).content.find(block => block.type === 'tool_result');
  await wait(() => stderr.includes('Personal harness.'), 'startup');
  await task('subscribe'); await wait(() => streams.has('owned-1'), 'first GET');
  await new Promise(resolve => setTimeout(resolve, 100)); await task('poll');
  assert.ok(JSON.parse(result().content).notifications.some(item => item.uri === uri));
  failRestore = true; await command('/mcp-reconnect owned', 'error:');
  assert.equal(generation, 2); assert.equal(subscriptions.get('owned-1').has(uri), true);
  failRestore = false; await command('/mcp-reconnect owned', 'MCP server owned reconnected');
  assert.equal(generation, 3); assert.equal(subscriptions.get('owned-3').has(uri), true); assert.equal(peers, 1);
  await new Promise(resolve => setTimeout(resolve, 100)); await task('poll');
  assert.ok(JSON.parse(result().content).notifications.some(item => item.uri === uri));
  expire = true; await task('ping');
  await wait(() => generation >= 4 && subscriptions.get('owned-4')?.has(uri), 'automatic restored URI');
  await wait(() => streams.has('owned-4'), 'new generation GET');
  const beforeGets = gets, beforeGeneration = generation; streams.get('owned-4').end(': EOF\n\n');
  await wait(() => gets > beforeGets && streams.has('owned-4'), 'GET reopened');
  assert.equal(generation, beforeGeneration);
  await new Promise(resolve => setTimeout(resolve, 100)); await task('poll');
  assert.ok(JSON.parse(result().content).notifications.some(item => item.uri === uri));
  const offset = stdout.length; child.stdin.write('/mcp\n'); await wait(() => stdout.slice(offset).includes('reopenAttempts'), 'status');
  assert.match(stdout.slice(offset), /"reopenAttempts":\s*1/);
  await task('unsubscribe'); await command('/mcp-reconnect owned', 'MCP server owned reconnected');
  assert.equal(subscriptions.get(`owned-${generation}`).size, 0); assert.equal(peers, 1);
  child.stdin.end('/exit\n'); assert.equal(await exited, 0); child = undefined;
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')); assert.equal(journals.length, 1);
  const journal = fs.readFileSync(path.join(workspace, '.agent', journals[0]), 'utf8');
  const records = journal.trim().split('\n').map(line => JSON.parse(line)); assert.equal(records[0].config.features.mcpRecovery, true);
  assert.equal(journal.includes('owned-recovery-fixture'), false); assert.equal(calls.length, 1);
  assert.equal(subscribed.filter(item => item.session === 'owned-3').length, 1); assert.equal(subscribed.filter(item => item.session === 'owned-4').length, 1);
  assert.ok(deleted.includes(`owned-${generation}`));
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'passed', compiledCLI: compiled, failedRestoreRetained: true, exactUriRestored: true,
    automaticReplacement: true, sameSessionGetReopened: true, peerRetained: true, unsubscribedExcluded: true,
    noToolReplay: true, noResourceReads: true, sameJournal: true, pinnedRecovery: true, credentialExcluded: true,
    locksReleased: true, modelRequests: requests.length, generations: generation, getRequests: gets, gateway: 'owned loopback SSE' }));
} finally {
  child?.kill('SIGKILL');
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
