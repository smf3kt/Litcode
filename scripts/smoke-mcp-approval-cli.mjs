// A project can ship `.harness/settings.json` naming MCP servers, so the
// declaration alone must not start a child process. This driver runs the real
// CLI three times against one owned fixture endpoint: unapproved (held, never
// dialed), approved (connected), and edited after approval (held again), and
// checks the approval store the first run wrote.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = process.argv.includes('--compiled');
const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-approval-cli-')));
const workspace = path.join(job, 'workspace');
const userDir = path.join(job, 'user');
const settingsFile = path.join(workspace, '.harness/settings.json');
const store = path.join(userDir, 'mcp-approvals.json');
const mcpRequests = [];
let server, mcpInitializes = 0;

const declaration = url => ({ permissions: { mode: 'bypass', allow: [], deny: [] },
  mcpServers: { team: { type: 'http', url: url + '/mcp' } } });

// The peer is only reachable if the declaration was honored; the harness
// endpoint answers the model so a run always terminates.
const start = async () => {
  server = http.createServer((req, res) => {
    void (async () => {
      let text = '';
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 4 * 1024 * 1024) throw new Error('fixture body limit');
      }
      const body = JSON.parse(text);
      if (req.url !== '/v1/messages') {
        // Every other path is the peer, so an edited declaration is still
        // reachable and a connection to it would be counted.
        mcpRequests.push(body.method);
        if (body.method === 'initialize') mcpInitializes++;
        // Notifications carry no id and are acknowledged with an empty 202.
        if (body.id === undefined) { res.writeHead(202).end(); return; }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id,
          result: body.method === 'initialize'
            ? { protocolVersion: '2025-06-18', capabilities: { tools: {} } }
            : body.method === 'tools/list' ? { tools: [] } : {} }));
        return;
      }
      assert.equal(req.url, '/v1/messages');
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const events = [
        { type: 'message_start', message: { id: 'approval-message', type: 'message', role: 'assistant', model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'approval fixture complete' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      res.end();
    })().catch(error => { res.destroy(); process.stderr.write(String(error?.stack ?? error)); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
};

const base = await start();
const url = base;
let stdout = '', stderr = '';

const run = async args => {
  stdout = ''; stderr = '';
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: 'owned-approval-fixture', LLM_MODEL: 'fixture/approval', LLM_BASE_URL: base,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  const child = spawn(process.execPath, [...(compiled ? [path.join(root, 'bin/personal-harness.mjs')]
    : ['--import', 'tsx', path.join(root, 'src/cli.ts')]),
    '--workspace', workspace, '--user-dir', userDir, ...args], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-64000); });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-64000); });
  const exited = new Promise(resolve => child.once('close', resolve));
  const wait = async (predicate, label) => {
    const deadline = Date.now() + 15000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`CLI ${label}: ${stderr}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  };
  if (args.includes('--interactive')) {
    await wait(() => stderr.includes('Personal harness.'), 'startup');
    const offset = stdout.length;
    child.stdin.write('/mcp\n');
    await wait(() => stdout.slice(offset).includes('connections'), 'status');
    const status = JSON.parse(stdout.slice(offset).trim());
    child.stdin.end('/exit\n');
    await exited;
    return { code: 0, status };
  }
  const code = await exited;
  return { code, status: undefined };
};

try {
  fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
  fs.mkdirSync(path.join(workspace, '.git'));
  fs.mkdirSync(userDir);
  fs.writeFileSync(settingsFile, JSON.stringify(declaration(url)));

  // 1. Declared, never answered: held, absent from connections, never dialed.
  const first = await run(['--interactive']);
  assert.match(stderr, /1 project server\(s\) awaiting approval \(team\)/);
  assert.match(stderr, /--approve-mcp-server NAME or decline with --reject-mcp-server NAME/);
  assert.equal(first.status.connections.team, undefined);
  assert.equal(mcpInitializes, 0);
  assert.deepEqual(mcpRequests, []);
  assert.equal(fs.existsSync(store), false, 'a held server writes nothing');

  // 2. The answering action records the declaration and starts nothing.
  const approved = await run(['--approve-mcp-server', 'team']);
  assert.equal(approved.code, 0);
  assert.match(stdout, /Project MCP server\(s\) approved team/);
  assert.equal(mcpInitializes, 0, 'answering connects nothing');
  const written = JSON.parse(fs.readFileSync(store, 'utf8'));
  const key = Object.keys(written.workspaces);
  assert.equal(key.length, 1);
  assert.match(key[0], /^[a-f0-9]{32}$/, 'the answer is keyed to the workspace');
  assert.equal(written.workspaces[key[0]].team.decision, 'approved');
  assert.match(written.workspaces[key[0]].team.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fs.statSync(store).mode & 0o777, 0o600);

  // An unknown name is refused instead of silently recorded.
  const refused = await run(['--approve-mcp-server', 'nope']);
  assert.notEqual(refused.code, 0);
  assert.match(stderr, /no project-declared MCP server named nope/);
  const contradictory = await run(['--approve-mcp-server', 'team', '--reject-mcp-server', 'team']);
  assert.notEqual(contradictory.code, 0);
  assert.match(stderr, /cannot be both approved and declined: team/);

  // 3. The approved declaration connects on the next run, with no notice.
  mcpRequests.length = 0;
  const second = await run(['--interactive']);
  assert.doesNotMatch(stderr, /awaiting approval/);
  assert.equal(second.status.connections.team.state, 'connected');
  assert.equal(mcpInitializes, 1);
  assert.deepEqual(mcpRequests, ['initialize', 'notifications/initialized', 'tools/list']);

  // 4. Editing the declaration invalidates the answer it was granted for.
  fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { mode: 'bypass', allow: [], deny: [] },
    mcpServers: { team: { type: 'http', url: url + '/elsewhere' } } }));
  const before = mcpInitializes;
  const third = await run(['--interactive']);
  assert.match(stderr, /changed since approval: team/);
  assert.equal(third.status.connections.team, undefined);
  assert.equal(mcpInitializes, before, 'an edited declaration is not dialed');

  // 5. Declining that new declaration is an answer, and it is never asked again.
  const declined = await run(['--reject-mcp-server', 'team']);
  assert.equal(declined.code, 0);
  assert.match(stdout, /declined team/);
  const fourth = await run(['--interactive']);
  assert.match(stderr, /mcp: declined: team/);
  assert.doesNotMatch(stderr, /awaiting approval/);
  assert.equal(fourth.status.connections.team, undefined);
  assert.equal(mcpInitializes, before, 'a declined declaration is not dialed');

  // 6. The user's own switch admits a declaration without recording an answer,
  //    but an answer the person already gave still stands over it.
  const answers = fs.readFileSync(store, 'utf8');
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ approveAllProjectMcpServers: true }));
  const stillDeclined = await run(['--interactive']);
  assert.match(stderr, /mcp: declined: team/);
  assert.equal(stillDeclined.status.connections.team, undefined);
  assert.equal(mcpInitializes, before, 'a stored answer outranks the switch');

  fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { mode: 'bypass', allow: [], deny: [] },
    mcpServers: { team: { type: 'http', url: url + '/third' } } }));
  const fifth = await run(['--interactive']);
  assert.doesNotMatch(stderr, /awaiting approval/);
  assert.equal(fifth.status.connections.team.state, 'connected');
  assert.equal(mcpInitializes, before + 1);
  assert.equal(fs.readFileSync(store, 'utf8'), answers, 'the switch records no answer');

  process.stdout.write('mcp approval cli smoke ok\n');
} finally {
  server?.close();
  fs.rmSync(job, { recursive: true, force: true });
}
