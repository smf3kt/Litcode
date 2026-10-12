import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAugmentTask, parseStandardTask, driveStandardMcpTask, MCP_TASK_PROTOCOL_VERSION, MCP_RELATED_TASK } from '../src/mcp-standard-task.js';
import { McpClientRequestHandler } from '../src/mcp-client-requests.js';
const state = (status = 'working', taskId = 'owned') => ({ taskId, status, ttl: 30000, createdAt: '2026-10-12T00:00:00Z', lastUpdatedAt: '2026-10-12T00:00:00Z', pollInterval: 250 });
const flush = async () => { for (let i=0;i<100;i++) await Promise.resolve(); };
const result = { content: [{ type: 'text', text: 'owned result' }], _meta: { [MCP_RELATED_TASK]: { taskId: 'owned' } } };

test('standard task requestor gates capabilities and validates correlated terminal/result streams', async t => {
  const caps = { tasks: { requests: { tools: { call: {} } }, cancel: {} } };
  assert.equal(canAugmentTask(MCP_TASK_PROTOCOL_VERSION, caps, 'optional'), true);
  assert.equal(canAugmentTask(MCP_TASK_PROTOCOL_VERSION, caps, 'forbidden'), false);
  assert.equal(canAugmentTask('2025-06-18', caps, 'optional'), false);
  assert.throws(() => canAugmentTask(MCP_TASK_PROTOCOL_VERSION, {}, 'required'));
  assert.throws(() => parseStandardTask({ task: state('completed') }));
  const task = parseStandardTask({ task: state() });
  for (const status of ['completed','failed','cancelled','input_required']) {
    const calls: string[] = [];
    const out = await driveStandardMcpTask(task, async method => { calls.push(method); return method==='tasks/get'?state(status):result; }, new AbortController().signal, true);
    assert.deepEqual(out, result); assert.deepEqual(calls, ['tasks/get','tasks/result']);
  }
  for (const bad of [state('working','foreign'), {...state(),ttl:-1}, {...state(),createdAt:'invalid'}]) {
    const calls: string[]=[];
    await assert.rejects(driveStandardMcpTask(task,async method=>{calls.push(method);return bad;},new AbortController().signal,true),/Malformed/);
    assert.deepEqual(calls,['tasks/get','tasks/cancel']);
  }
  await assert.rejects(driveStandardMcpTask(task,async method=>method==='tasks/get'?state('completed'):{...result,_meta:{[MCP_RELATED_TASK]:{taskId:'foreign'}}},new AbortController().signal,true),/Malformed/);
  t.mock.timers.enable({apis:['setTimeout']});
  try {
    let polls=0;const pending=driveStandardMcpTask(task,async method=>method==='tasks/result'?result:(++polls===1?state():state('completed')),new AbortController().signal,true);
    await flush();assert.equal(polls,1);t.mock.timers.tick(250);await flush();assert.deepEqual(await pending,result);
    const owner=new AbortController();let cancels=0;const work=driveStandardMcpTask(task,async method=>{if(method==='tasks/cancel'){cancels++;return {};}return state();},owner.signal,true);
    const checked=assert.rejects(work,/cancel/);await flush();owner.abort();await checked;assert.equal(cancels,1);
  } finally {t.mock.timers.reset();}
});

test('related task reverse RPCs require active ownership and return correlated metadata', async () => {
  let called=0;const handler=new McpClientRequestHandler('fixture',{roots:()=>{called++;return[{uri:'file:///owned'}];}});
  const params={_meta:{[MCP_RELATED_TASK]:{taskId:'owned'}}};const replies:any[]=[];
  const request=(id:number)=>handler.handle({jsonrpc:'2.0',id,method:'roots/list',params},value=>{replies.push(value);});
  try {
    await request(1);assert.equal(replies[0].error.code,-32602);assert.equal(called,0);
    const release=handler.ownTask('owned');await request(2);release();
    assert.equal(called,1);assert.equal(replies[1].result._meta[MCP_RELATED_TASK].taskId,'owned');
    await request(3);assert.equal(replies[2].error.code,-32602);assert.equal(called,1);
    let observed: AbortSignal | undefined;
    const slow = new McpClientRequestHandler('fixture', { roots: (_context, signal) => { observed = signal; return new Promise(() => {}); } });
    const releaseSlow = slow.ownTask('owned');
    const pending = slow.handle({ jsonrpc: '2.0', id: 4, method: 'roots/list', params }, value => { replies.push(value); });
    await flush(); releaseSlow(); await pending;
    assert.equal(observed?.aborted, true);
    assert.equal(replies.at(-1).error.code, -32603);
    assert.equal(replies.at(-1)._meta[MCP_RELATED_TASK].taskId, 'owned');
    await slow.close();
  } finally {await handler.close();}
});


test('GET task inputs enforce ownership, keep cancellation flowing and release callbacks on close', async () => {
  const { createServer } = await import('node:http');
  const { connectMcpServers } = await import('../src/mcp.js');
  let stream: import('node:http').ServerResponse | undefined;
  let resultPost: { res: import('node:http').ServerResponse; id: number } | undefined;
  const replies: any[] = [], failures: unknown[] = [], signals: AbortSignal[] = [];
  let roots = 0, forms = 0, samples = 0;
  const until = async (check: () => boolean) => {
    const end = Date.now() + 2000;
    while (!check() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(check(), 'GET task fixture deadline');
  };
  const send = (message: unknown) => stream!.write('data: ' + JSON.stringify(message) + '\n\n');
  const input = (id: string, taskId = 'owned', method = 'roots/list', extra = {}) => send({ jsonrpc: '2.0', id, method,
    params: { ...extra, _meta: { [MCP_RELATED_TASK]: { taskId } } } });
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') { stream = res; res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders(); return; }
      if (req.method === 'DELETE') { res.writeHead(204).end(); return; }
      let text = ''; for await (const chunk of req) text += chunk;
      const m = JSON.parse(text);
      const reply = (value: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: value })); };
      if (m.method === 'initialize') { res.setHeader('mcp-session-id', 'owned-get'); reply({ protocolVersion: MCP_TASK_PROTOCOL_VERSION, capabilities: { tools: {}, tasks: { requests: { tools: { call: {} } }, cancel: {} } } }); }
      else if (m.method === 'tools/list') reply({ tools: [{ name: 'run', inputSchema: { type: 'object' }, execution: { taskSupport: 'required' } }] });
      else if (m.method === 'tools/call') reply({ task: state() });
      else if (m.method === 'tasks/get') reply(state('input_required'));
      else if (m.method === 'tasks/result') { resultPost = { res, id: m.id }; res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders(); }
      else if (m.method === 'tasks/cancel') reply(state('cancelled'));
      else { if (m.id) replies.push(m); res.writeHead(202).end(); }
    })().catch(error => { failures.push(error); res.destroy(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 24000, allowShell: false };
  const connection = await connectMcpServers({ srv: { type: 'http', url: 'http://127.0.0.1:' + address.port + '/mcp' } }, context,
    { standardTasks: true, notificationStream: true, recovery: true, requestTimeoutMs: 4000,
      clientRequests: { roots: (_context, signal) => { roots++; assert.ok(signal); signals.push(signal); return new Promise(() => {}); },
        elicitation: () => { forms++; return { action: 'accept', content: { label: 'owned' } }; },
        sampling: () => { samples++; throw new Error('unexpected sampling'); } } });
  const run = () => connection.tools.find(tool => tool.schema.name === 'mcp__srv__run')!.execute({}, context);
  try {
    await until(() => connection.notificationStreams!().srv?.state === 'active');
    input('absent'); await until(() => replies.some(m => m.id === 'absent'));
    assert.equal(replies.at(-1).error.code, -32602); assert.equal(roots, 0);
    const pending = run(); await until(() => resultPost !== undefined);
    input('foreign', 'foreign'); input('invalid', 'owned', 'elicitation/create', { message: 'bad', requestedSchema: [] });
    send({ jsonrpc: '2.0', id: 'unrelated', method: 'roots/list', params: {} });
    input('sampling', 'owned', 'sampling/createMessage');
    input('form', 'owned', 'elicitation/create', { message: 'owned form', requestedSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } });
    input('slow'); await until(() => roots === 2 && replies.some(m => m.id === 'form'));
    send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'slow' } });
    await until(() => replies.some(m => m.id === 'slow'));
    assert.equal(signals[1]!.aborted, true); assert.equal(forms, 1); assert.equal(samples, 0);
    assert.equal(replies.find(m => m.id === 'foreign').error.code, -32602);
    assert.equal(replies.find(m => m.id === 'invalid').error.code, -32602);
    assert.equal(replies.find(m => m.id === 'form').result._meta[MCP_RELATED_TASK].taskId, 'owned');
    assert.equal(replies.find(m => m.id === 'slow')._meta[MCP_RELATED_TASK].taskId, 'owned');
    assert.equal(replies.find(m => m.id === 'sampling').error.code, -32602); assert.ok(!replies.some(m => m.id === 'unrelated'), 'unresolved GET roots keeps no reply');
    resultPost!.res.end('data: ' + JSON.stringify({ jsonrpc: '2.0', id: resultPost!.id, result }) + '\n\n');
    assert.equal(await pending, 'owned result'); resultPost = undefined;
    input('late'); await until(() => replies.some(m => m.id === 'late')); assert.equal(roots, 2);
    const closing = run(); const checked = assert.rejects(async () => await closing, /cancel|closed/i);
    await until(() => resultPost !== undefined); input('closing'); await until(() => roots === 3);
    await connection.close(); await checked; assert.equal(signals[2]!.aborted, true);
    assert.equal(connection.notificationStreams!().srv?.state, 'closed'); assert.deepEqual(failures, []);
  } finally { await connection.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('GET client requests dispatch without standard tasks and stop stream auto-reopen', async () => {
  const { createServer } = await import('node:http');
  const { connectMcpServers } = await import('../src/mcp.js');
  const failures: unknown[] = [], replies: any[] = [];
  let carry = true, gets = 0;
  const until = async (check: () => boolean, label: string) => {
    const end = Date.now() + 4000;
    while (!check() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(check(), label);
  };
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') {
        gets++; res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders();
        // A carried client request followed by EOF must not be replayed, while a
        // notification-only stream keeps the finite reopen budget.
        res.write('data: ' + JSON.stringify(carry
          ? { jsonrpc: '2.0', id: 'carried', method: 'roots/list', params: {} }
          : { jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', data: 'tick' } }) + '\n\n');
        res.end(); return;
      }
      if (req.method === 'DELETE') { res.writeHead(204).end(); return; }
      let text = ''; for await (const chunk of req) text += chunk;
      const m = JSON.parse(text);
      const reply = (value: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: value })); };
      if (m.method === 'initialize') reply({ protocolVersion: '2025-06-18', capabilities: { tools: {} } });
      else if (m.method === 'tools/list') reply({ tools: [] });
      else { replies.push(m); res.writeHead(202).end(); }
    })().catch(error => { failures.push(error); res.destroy(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 24000, allowShell: false };
  const options = { notificationStream: true, recovery: true, requestTimeoutMs: 3000,
    clientRequests: { roots: () => [{ uri: new URL('file://' + process.cwd()).href }] } };
  const config = { srv: { type: 'http' as const, url: 'http://127.0.0.1:' + address.port + '/mcp' } };
  try {
    const first = await connectMcpServers(config, context, options);
    try {
      await until(() => replies.some(m => m.id === 'carried'), 'GET roots reply');
      assert.ok(String(replies.find(m => m.id === 'carried').result.roots[0].uri).startsWith('file:'));
      await new Promise(resolve => setTimeout(resolve, 1600));
      assert.equal(gets, 1, 'carried GET stream is not reopened');
      assert.equal(first.notificationStreams!().srv?.state, 'ended');
    } finally { await first.close(); }
    carry = false; const before = gets;
    const second = await connectMcpServers(config, context, options);
    try { await until(() => gets > before, 'notification-only GET stream reopens'); }
    finally { await second.close(); }
    assert.deepEqual(failures, []);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
