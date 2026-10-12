import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captureIdentity } from './identity.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const compiled = process.argv.includes('--compiled'), sigkill = process.argv.includes('--sigkill');
assert.ok(process.argv.slice(2).every(arg => ['--compiled', '--sigkill'].includes(arg)), 'Unknown smoke argument');
const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-persistence-cli-')));
const uriA = 'fixture://notes%2fExact?case=A', uriB = 'fixture://notes%2FExact?case=B';
const modelSecret = 'owned-persistence-model-secret', mcpSecret = 'owned-persistence-mcp-secret';
const transports = new Map(), streams = new Map(), rpcs = [], acknowledgements = [], deleted = [], requests = [], children = [];
let server, url, generation = 0, failRestore = false, resourceCapability = true, fixtureError;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const journalPath = (workspace, id) => path.join(workspace, '.agent', `${id}.jsonl`);
const journal = (workspace, id) => fs.readFileSync(journalPath(workspace, id), 'utf8');
const records = (workspace, id) => journal(workspace, id).split('\n').filter(Boolean).map(line => JSON.parse(line));
const events = (workspace, id) => records(workspace, id).filter(record => record.kind === 'mcp_subscription');
const locks = workspace => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock'));

async function wait(predicate, label, cli) {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    if (fixtureError) throw fixtureError;
    if (cli?.ended || Date.now() >= deadline) throw new Error(`${label}: ${cli?.stderr ?? 'fixture timeout'}`);
    await sleep(20);
  }
}

function workspace(name, persistence) {
  const directory = path.join(job, name);
  fs.mkdirSync(directory); fs.mkdirSync(path.join(directory, 'user')); fs.mkdirSync(path.join(directory, '.harness'));
  // mcpServers live in the user layer: a checkout-declared server is held as a decision to answer.
  fs.writeFileSync(path.join(directory, 'user/settings.json'), JSON.stringify({
    mcpServers: { owned: { type: 'http', url: `${url}/mcp`, headersEnv: { Authorization: 'MCP_PERSISTENCE_AUTH' } } },
  }));
  fs.writeFileSync(path.join(directory, '.harness/settings.json'), JSON.stringify({
    permissions: { mode: 'bypass', allow: [], deny: [] },
    features: { mcpDynamic: false, mcpRecovery: true, mcpSubscriptions: true, mcpNotificationStream: true,
      ...(persistence === undefined ? {} : { mcpPersistence: persistence }) },
  }));
  return directory;
}

function launch(directory, id, recoverLock = false) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_|MCP_PERSISTENCE_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: modelSecret, LLM_MODEL: 'fixture/persistence', LLM_BASE_URL: url,
    LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', MCP_PERSISTENCE_AUTH: `Bearer ${mcpSecret}` });
  const args = [...(compiled ? [path.join(root, 'bin/litcode.mjs')] : ['--import', 'tsx', path.join(root, 'src/cli.ts')]),
    '--workspace', directory, ...(id ? ['--resume', id] : ['--user-dir', path.join(directory, 'user')]),
    ...(recoverLock ? ['--recover-lock'] : []), '--interactive'];
  const cli = { process: spawn(process.execPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] }),
    stdout: '', stderr: '', ended: false, directory, startGeneration: generation, startRequests: requests.length };
  children.push(cli);
  cli.process.stdout.on('data', chunk => { cli.stdout = (cli.stdout + chunk).slice(-100000); });
  cli.process.stderr.on('data', chunk => { cli.stderr = (cli.stderr + chunk).slice(-100000); });
  cli.exited = new Promise((resolve, reject) => {
    cli.process.once('error', reject);
    cli.process.once('close', (code, signal) => { cli.ended = true; resolve({ code, signal }); });
  });
  return cli;
}

async function ready(cli, expectedId) {
  await wait(() => cli.stderr.includes('Personal harness.'), 'interactive startup', cli);
  const id = /session: ([a-f0-9-]{36})/.exec(cli.stderr)?.[1]; assert.ok(id, cli.stderr);
  if (expectedId) assert.equal(id, expectedId);
  assert.equal(requests.length, cli.startRequests, 'Startup issued a model request');
  cli.id = id;
  assert.equal(generation, cli.startGeneration + 1, 'Startup must own a new transport');
  cli.transport = `owned-${generation}`;
  await wait(() => streams.has(cli.transport), 'owned GET notification stream', cli);
  return id;
}

async function task(cli, prompt) {
  const offset = cli.stderr.length, requestOffset = requests.length;
  const rpcOffset = rpcs.length, ackOffset = acknowledgements.length;
  cli.process.stdin.write(`${prompt}\n`);
  await wait(() => cli.stderr.slice(offset).includes('finished: end_turn'), prompt, cli);
  const emitted = requests.slice(requestOffset);
  assert.equal(emitted.length, prompt === 'query' ? 1 : 2, `${prompt} model request count`);
  if (prompt === 'query') return;
  const result = emitted.at(-1).messages.at(-1).content.find(block => block.type === 'tool_result');
  assert.ok(result, `${prompt} tool result missing`); assert.equal(result.is_error === true, false, result.content);
  const mutation = /^(subscribe|unsubscribe) ([AB])$/.exec(prompt);
  if (mutation) {
    const expected = [{ session: cli.transport, method: `resources/${mutation[1]}`, uri: mutation[2] === 'A' ? uriA : uriB }];
    assert.deepEqual(rpcs.slice(rpcOffset), expected, 'Mutation RPC must execute exactly once');
    assert.deepEqual(acknowledgements.slice(ackOffset), expected, 'Mutation acknowledgement must occur exactly once');
  } else assert.equal(rpcs.length, rpcOffset, 'Local poll issued an MCP request');
  return JSON.parse(result.content);
}

async function command(cli, text, marker) {
  const offset = cli.stderr.length;
  cli.process.stdin.write(`${text}\n`);
  await wait(() => cli.stderr.slice(offset).includes(marker), text, cli);
}

async function exit(cli) {
  cli.process.stdin.end('/exit\n');
  await wait(() => cli.ended, 'CLI exit');
  assert.deepEqual(await cli.exited, { code: 0, signal: null }, cli.stderr);
  assert.deepEqual(locks(cli.directory), [], 'Session locks leaked');
}

function intent(directory, id, expected) {
  const actual = events(directory, id);
  assert.deepEqual(actual.map(({ method, uri }) => [method, uri]), expected);
  for (const event of actual) {
    assert.deepEqual(Object.keys(event).sort(), ['configDigest', 'kind', 'method', 'server', 'uri']);
    assert.equal(event.server, 'owned'); assert.match(event.configDigest, /^[a-f0-9]{64}$/);
    assert.equal(event.configDigest, actual[0].configDigest);
  }
}

function restored(cli, expected) {
  assert.deepEqual([...transports.get(cli.transport)].sort(), [...expected].sort());
  assert.deepEqual(rpcs.filter(rpc => rpc.session === cli.transport && rpc.method === 'resources/subscribe').map(rpc => rpc.uri),
    expected, 'Restore must subscribe each desired URI exactly once');
  assert.equal(rpcs.filter(rpc => rpc.session === cli.transport && ['tools/call', 'resources/read'].includes(rpc.method)).length, 0);
}

function update(session, uri) {
  assert.ok(transports.get(session)?.has(uri));
  const stream = streams.get(session); assert.ok(stream, 'Notification stream missing');
  stream.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/resources/updated', params: { uri } })}\n\n`);
}

try {
  const identity = captureIdentity(root);
  server = http.createServer((req, res) => {
    void (async () => {
      if (req.url === '/hostile') throw new Error('Resume read changed on-disk MCP settings');
      if (req.url === '/mcp') {
        assert.equal(req.headers.authorization, `Bearer ${mcpSecret}`);
        const session = req.headers['mcp-session-id'];
        if (req.method === 'DELETE') { deleted.push(session); streams.get(session)?.end(); res.writeHead(204).end(); return; }
        if (req.method === 'GET') {
          assert.ok(transports.has(session)); assert.equal(req.headers['last-event-id'], undefined);
          streams.set(session, res); res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders();
          const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 1000);
          res.on('close', () => { clearInterval(heartbeat); if (streams.get(session) === res) streams.delete(session); });
          return;
        }
      }
      assert.equal(req.method, 'POST');
      let text = ''; for await (const chunk of req) { text += chunk; assert.ok(text.length <= 4 * 1024 * 1024); }
      const body = JSON.parse(text);
      if (req.url === '/mcp') {
        const session = req.headers['mcp-session-id'];
        rpcs.push({ session, method: body.method, ...(body.params?.uri ? { uri: body.params.uri } : {}) });
        const json = result => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); };
        if (body.method === 'initialize') {
          const next = `owned-${++generation}`; transports.set(next, new Set()); res.setHeader('Mcp-Session-Id', next);
          json({ protocolVersion: '2025-06-18', capabilities: { tools: {}, ...(resourceCapability ? { resources: { subscribe: true } } : {}) } });
        } else if (body.method === 'tools/list') json({ tools: [{ name: 'ping', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }] });
        else if (body.method === 'resources/subscribe' || body.method === 'resources/unsubscribe') {
          assert.ok(transports.has(session));
          if (failRestore && body.method === 'resources/subscribe') { res.writeHead(503).end(); return; }
          if (body.method === 'resources/subscribe') transports.get(session).add(body.params.uri);
          else transports.get(session).delete(body.params.uri);
          acknowledgements.push({ session, method: body.method, uri: body.params.uri }); json({});
        } else if (body.method === 'tools/call' || body.method === 'resources/read') throw new Error(`Unexpected replay: ${body.method}`);
        else { assert.equal(body.id, undefined, `Unexpected MCP RPC ${body.method}`); res.writeHead(202).end(); }
        return;
      }
      assert.equal(req.url, '/v1/messages'); assert.equal(req.headers.authorization, `Bearer ${modelSecret}`);
      assert.equal(body.stream, true); requests.push(body);
      const last = body.messages.at(-1), prompt = typeof last.content === 'string' ? last.content : '';
      const match = /^(subscribe|unsubscribe) ([AB])$/.exec(prompt);
      const selected = match ? `mcp_resource_${match[1]}` : prompt === 'poll' ? 'mcp_resource_notifications' : undefined;
      const input = { server: 'owned', ...(match ? { uri: match[2] === 'A' ? uriA : uriB } : {}) };
      if (selected) assert.ok(body.tools.some(tool => tool.name === selected), `${selected} missing from pinned catalog`);
      const sse = [
        { type: 'message_start', message: { id: `persistence-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: selected
          ? { type: 'tool_use', id: `tool-${requests.length}`, name: selected, input: {} } : { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: selected ? { type: 'input_json_delta', partial_json: JSON.stringify(input) }
          : { type: 'text_delta', text: 'persistence complete' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: selected ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(sse.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    })().catch(error => { fixtureError = error; res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;

  // Group 1: real process exits, pinned resume, deletion, failed restore and retry.
  const directory = workspace('persistent', true), expected = [];
  let cli = launch(directory); const id = await ready(cli);
  assert.equal(records(directory, id)[0].config.features.mcpPersistence, true);
  for (const [method, uri, prompt] of [['resources/subscribe', uriA, 'subscribe A'], ['resources/subscribe', uriB, 'subscribe B'],
    ['resources/unsubscribe', uriB, 'unsubscribe B']]) {
    const result = await task(cli, prompt); assert.equal(result.uri, uri);
    assert.equal(result.subscribed, method === 'resources/subscribe'); expected.push([method, uri]); intent(directory, id, expected);
  }
  update(cli.transport, uriA); await sleep(60);
  const pinned = records(directory, id)[0]; await exit(cli);
  fs.writeFileSync(path.join(directory, 'user/settings.json'), JSON.stringify({
    mcpServers: { owned: { type: 'http', url: `${url}/hostile` } },
  }));
  fs.writeFileSync(path.join(directory, '.harness/settings.json'), JSON.stringify({
    permissions: { mode: 'plan' },
    features: { mcpPersistence: false, mcpRecovery: false, mcpSubscriptions: false, mcpNotificationStream: false },
  }));
  cli = launch(directory, id); await ready(cli, id); restored(cli, [uriA]); intent(directory, id, expected);
  assert.deepEqual(records(directory, id)[0], pinned);
  assert.equal((await task(cli, 'poll')).notifications.length, 0, 'Previous transport notifications leaked');
  update(cli.transport, uriA); await sleep(60);
  assert.deepEqual((await task(cli, 'poll')).notifications, [{ uri: uriA }]);
  await task(cli, 'unsubscribe A'); expected.push(['resources/unsubscribe', uriA]); intent(directory, id, expected); await exit(cli);
  cli = launch(directory, id); await ready(cli, id); restored(cli, []);
  assert.equal((await task(cli, 'poll')).subscriptions, 0);
  await task(cli, 'subscribe A'); expected.push(['resources/subscribe', uriA]); intent(directory, id, expected); await exit(cli);
  const retained = journal(directory, id), beforeFailureRequests = requests.length;
  failRestore = true; cli = launch(directory, id);
  await wait(() => cli.ended, 'failed restore exits');
  const failed = await cli.exited; assert.ok(Number.isInteger(failed.code) && failed.code !== 0, cli.stderr);
  assert.equal(requests.length, beforeFailureRequests); assert.equal(cli.stderr.includes('Personal harness.'), false);
  assert.equal(journal(directory, id), retained); assert.deepEqual(locks(directory), []);
  assert.ok(deleted.includes(`owned-${generation}`), 'Failed restore candidate DELETE missing');
  failRestore = false; cli = launch(directory, id); await ready(cli, id); restored(cli, [uriA]); intent(directory, id, expected);

  // Fork copies completed conversation, while the new owner starts with empty URI intent.
  await command(cli, '/fork', 'session:');
  const forkId = [...cli.stderr.matchAll(/session: ([a-f0-9-]{36})/g)].at(-1)[1]; assert.notEqual(forkId, id);
  cli.transport = `owned-${generation}`; await wait(() => streams.has(cli.transport), 'fork transport GET', cli);
  restored(cli, []); intent(directory, forkId, []);
  assert.equal((await task(cli, 'poll')).subscriptions, 0); await task(cli, 'query');
  await command(cli, `/resume ${id}`, 'Session resumed.'); cli.transport = `owned-${generation}`;
  await wait(() => streams.has(cli.transport), 'original owner GET', cli); restored(cli, [uriA]); intent(directory, id, expected);
  await task(cli, 'unsubscribe A'); expected.push(['resources/unsubscribe', uriA]); intent(directory, id, expected);
  if (sigkill) {
    await task(cli, 'subscribe A'); expected.push(['resources/subscribe', uriA]);
    await wait(() => events(directory, id).length === expected.length, 'durable subscription journal event', cli);
    const lock = `${journalPath(directory, id)}.lock`;
    assert.equal(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, cli.process.pid);
    cli.process.kill('SIGKILL'); await wait(() => cli.ended, 'SIGKILL process exit');
    assert.equal((await cli.exited).signal, 'SIGKILL'); assert.ok(fs.existsSync(lock));
    assert.throws(() => process.kill(cli.process.pid, 0), error => error.code === 'ESRCH');
    cli = launch(directory, id, true); await ready(cli, id); restored(cli, [uriA]); intent(directory, id, expected);
    await task(cli, 'unsubscribe A'); expected.push(['resources/unsubscribe', uriA]);
  }
  await exit(cli); intent(directory, id, expected); intent(directory, forkId, []);
  console.log(JSON.stringify({ group: 'persistent-process-chain', status: 'passed', journalEvents: expected.length,
    forkEmpty: true, failedRestoreBeforeModel: true, sigkillRecovery: sigkill }));

  // Group 2: both omitted and explicitly false flags preserve connection-local behavior.
  for (const persistence of [undefined, false]) {
    const legacy = workspace(persistence === undefined ? 'legacy-absent' : 'legacy-false', persistence);
    cli = launch(legacy); const legacyId = await ready(cli); await task(cli, 'subscribe A'); intent(legacy, legacyId, []);
    await command(cli, '/mcp-reconnect owned', 'MCP server owned reconnected'); cli.transport = `owned-${generation}`;
    restored(cli, [uriA]); assert.equal((await task(cli, 'poll')).subscriptions, 1); await exit(cli);
    cli = launch(legacy, legacyId); await ready(cli, legacyId); restored(cli, []); intent(legacy, legacyId, []); await exit(cli);
  }
  console.log(JSON.stringify({ group: 'legacy-gating', status: 'passed', absentAndFalse: true, recoveryPreserved: true, resumeEmpty: true }));

  // Group 3: a capability mismatch fails before publication and leaves the journal intact.
  cli = launch(directory, id); await ready(cli, id); await task(cli, 'subscribe A');
  expected.push(['resources/subscribe', uriA]); intent(directory, id, expected); await exit(cli);
  const capabilityJournal = journal(directory, id), capabilityRequests = requests.length;
  resourceCapability = false; cli = launch(directory, id);
  await wait(() => cli.ended, 'capability restore exits');
  const capabilityExit = await cli.exited; assert.ok(Number.isInteger(capabilityExit.code) && capabilityExit.code !== 0, cli.stderr);
  assert.equal(requests.length, capabilityRequests); assert.equal(journal(directory, id), capabilityJournal);
  assert.deepEqual(locks(directory), []); assert.ok(deleted.includes(`owned-${generation}`));
  resourceCapability = true; cli = launch(directory, id); await ready(cli, id); restored(cli, [uriA]); intent(directory, id, expected);
  await task(cli, 'unsubscribe A'); expected.push(['resources/unsubscribe', uriA]); await exit(cli); intent(directory, id, expected);
  console.log(JSON.stringify({ group: 'capability-prebind', status: 'passed', candidateClosed: true, journalRetained: true }));

  for (const name of fs.readdirSync(job)) {
    const directory = path.join(job, name); assert.deepEqual(locks(directory), []);
    for (const name of fs.readdirSync(path.join(directory, '.agent')).filter(name => name.endsWith('.jsonl'))) {
      const text = fs.readFileSync(path.join(directory, '.agent', name), 'utf8');
      assert.equal(text.includes(modelSecret), false); assert.equal(text.includes(mcpSecret), false);
    }
  }
  assert.equal(rpcs.filter(rpc => rpc.method === 'tools/call' || rpc.method === 'resources/read').length, 0);
  const killedGeneration = sigkill ? children.find(child => child.process.signalCode === 'SIGKILL') : undefined;
  for (const session of transports.keys()) {
    if (killedGeneration && session === killedGeneration.transport) continue;
    assert.equal(deleted.filter(item => item === session).length, 1, `Transport ${session} DELETE count`);
  }
  assert.equal(fixtureError, undefined);
  assert.equal(captureIdentity(root).sha256, identity.sha256, 'Product changed during driver validation');
  console.log(JSON.stringify({ cli: 'passed', compiledCLI: compiled, testGroups: 3, modelRequests: requests.length,
    generations: generation, acknowledgedMutations: acknowledgements.length, journalEvents: expected.length,
    deletes: deleted.length, sameJournal: true, pinnedResume: true, exactUri: true, noReplay: true,
    credentialExcluded: true, locksReleased: true, gateway: 'owned loopback SSE',
    identity: { sha256: identity.sha256, inputs: identity.inputs.sha256, build: identity.build.sha256 },
    driverSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))) }));
} finally {
  for (const cli of children) if (!cli.ended) cli.process.kill('SIGKILL');
  await Promise.allSettled(children.map(cli => cli.exited));
  for (const stream of streams.values()) stream.destroy();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(job, { recursive: true, force: true });
}
