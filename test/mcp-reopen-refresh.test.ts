import assert from 'node:assert/strict';
import http, { type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { McpResourceCatalog, type ResourceCatalogChange, type ResourceCatalogSource } from '../src/mcp-resource-catalog.js';
import { connectMcpServers, type McpCatalogListing, type McpConnectOptions } from '../src/mcp.js';

const context = () => ({ workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 24000, allowShell: false });
async function until(predicate: () => boolean, description: string) {
  const end = Date.now() + 5000;
  while (!predicate()) { assert.ok(Date.now() < end, description); await delay(5); }
}

test('reopened catalogs bypass notification cooldown and close awaits every raw refresh', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 10000;
  t.mock.method(performance, 'now', () => now);
  const identity = {}, lifetime = new AbortController();
  let changed!: (cause: ResourceCatalogChange) => void;
  const pending: { signal: AbortSignal; resolve(value: Awaited<ReturnType<ResourceCatalogSource['load']>>): void }[] = [];
  const snapshots: McpCatalogListing[] = [];
  let unsubscribed = false;
  const catalog = new McpResourceCatalog([{ name: 'docs', identity: () => identity,
    load: signal => new Promise(resolve => pending.push({ signal, resolve })),
    subscribe: listener => { changed = listener; return () => { unsubscribed = true; }; } }], lifetime.signal);
  catalog.subscribe(listing => snapshots.push(listing));
  const values = (name: string) => ({ resources: [{ server: 'docs', uri: `doc://${name}` }], templates: [] });
  const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
  const tick = async (ms: number) => { now += ms; t.mock.timers.tick(ms); await flush(); };
  try {
    changed('reopen'); assert.equal(pending.length, 0, 'catalog stays lazy');
    const initial = catalog.read(lifetime.signal); pending[0]!.resolve(values('initial')); await initial; await flush();
    changed('notification'); assert.equal(pending.length, 2);
    pending[1]!.resolve(values('notification')); await flush();
    changed('notification'); assert.equal(pending.length, 2);
    changed('reopen'); assert.equal(pending.length, 3, 'raw reopen bypasses pending cooldown');
    pending[2]!.resolve(values('reopened')); await flush();
    assert.equal(snapshots.at(-1)?.resources.docs?.[0]?.uri, 'doc://reopened');
    await tick(999); assert.equal(pending.length, 3);
    await tick(1); assert.equal(pending.length, 4, 'queued real notification retains its source deadline');
    changed('reopen'); changed('reopen'); assert.equal(pending.length, 6);
    const before = snapshots.length;
    let closed = false;
    const teardown = catalog.close().then(() => { closed = true; });
    assert.equal(unsubscribed, true);
    assert.ok(pending.slice(3).every(item => item.signal.aborted));
    pending[5]!.resolve(values('last')); await flush(); assert.equal(closed, false);
    pending[3]!.resolve(values('queued')); await flush(); assert.equal(closed, false);
    pending[4]!.resolve(values('other')); await teardown;
    await tick(30000); changed('reopen');
    assert.equal(pending.length, 6); assert.equal(snapshots.length, before);
  } finally {
    for (const item of pending) item.resolve({});
    await catalog.close(); t.mock.restoreAll(); t.mock.timers.reset();
  }
});

type Remote = {
  revision: number;
  failTemplate: boolean;
  holdReopen: boolean;
  reopenStatus: number;
  gets: number;
  deleted: number;
  stream?: ServerResponse;
  held?: ServerResponse;
  calls: string[];
};
async function fixture(capabilities: Record<string, unknown> = { resources: { listChanged: true }, tools: { listChanged: true } }) {
  const servers = new Map<string, Remote>();
  const streams = new Set<ServerResponse>();
  const failures: unknown[] = [];
  const server = http.createServer((request, response) => {
    void (async () => {
      const name = request.url!.slice(1);
      let state = servers.get(name);
      if (!state) { state = { revision: 1, failTemplate: false, holdReopen: false, reopenStatus: 200, gets: 0, deleted: 0, calls: [] }; servers.set(name, state); }
      if (request.method === 'GET') {
        state.gets++;
        if (state.gets > 1 && state.holdReopen) { state.held = response; return; }
        if (state.gets > 1 && state.reopenStatus !== 200) { response.writeHead(state.reopenStatus).end(); return; }
        open(state, response); return;
      }
      if (request.method === 'DELETE') { state.deleted++; response.writeHead(204).end(); return; }
      let text = ''; for await (const part of request) text += part;
      const message = JSON.parse(text); state.calls.push(message.method);
      const reply = (result: unknown) => response.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
      if (message.method === 'initialize') { response.setHeader('Mcp-Session-Id', name); reply({ protocolVersion: message.params.protocolVersion, capabilities }); }
      else if (message.method === 'tools/list') reply({ tools: [{ name: `tool${state.revision}`, inputSchema: { type: 'object' } }] });
      else if (message.method === 'resources/list') reply({ resources: [{ uri: `doc://${state.revision}`, name: `RESOURCE_${state.revision}` }] });
      else if (message.method === 'resources/templates/list') {
        if (state.failTemplate) response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: message.id,
          error: { code: -32603, message: 'owned failure' } }));
        else reply({ resourceTemplates: [{ uriTemplate: `doc://${state.revision}/{id}`, name: `TEMPLATE_${state.revision}` }] });
      } else response.writeHead(202).end();
    })().catch(error => { failures.push(error); response.destroy(); });
  });
  function open(state: Remote, response: ServerResponse) {
    state.stream = response; streams.add(response); response.on('close', () => streams.delete(response));
    response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders(); response.write('retry: 20\n\n');
  }
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { servers, streams, failures, open,
    config: (names = ['docs']) => Object.fromEntries(names.map(name => [name, { type: 'http' as const, url: `http://127.0.0.1:${address.port}/${name}` }])),
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
const options: McpConnectOptions = { catalog: true, dynamic: true, recovery: true, notificationStream: true, requestTimeoutMs: 2000 };
const count = (remote: Remote, method: string) => remote.calls.filter(value => value === method).length;

test('successful GET reopens refresh advertised resource and tool catalogs while preserving peers,schemas and failed families', async () => {
  const remote = await fixture();
  const ctx = context();
  const connection = await connectMcpServers(remote.config(['docs', 'peer']), ctx, options);
  let current: McpCatalogListing | undefined;
  const unsubscribe = connection.subscribeCatalog!(listing => { current = listing; });
  try {
    current = await connection.catalogListing!(ctx.signal);
    await until(() => remote.streams.size === 2, 'initial streams');
    const docs = remote.servers.get('docs')!, peer = remote.servers.get('peer')!;
    const schemas = JSON.stringify(connection.tools.map(tool => tool.schema)), peerCalls = peer.calls.length;
    assert.equal(count(docs, 'resources/list'), 1); assert.equal(count(docs, 'tools/list'), 1);
    docs.revision = 2; docs.holdReopen = true; docs.stream!.end(': remote close\n\n');
    await until(() => docs.held !== undefined, 'held reopen');
    assert.equal(count(docs, 'resources/list'), 1); assert.equal(count(docs, 'tools/list'), 1);
    remote.open(docs, docs.held!); docs.held = undefined; docs.holdReopen = false;
    await until(() => current?.resources.docs?.[0]?.name === 'RESOURCE_2' && count(docs, 'tools/list') === 2, 'synthetic refresh');
    assert.equal(current.templates.docs?.[0]?.name, 'TEMPLATE_2');
    const search = connection.tools.find(tool => tool.schema.name === 'mcp_tool_search')!;
    const found = JSON.parse(await search.execute({ query: '' }, ctx));
    assert.ok(found.tools.some((tool: { server: string; tool: string }) => tool.server === 'docs' && tool.tool === 'tool2'));
    assert.equal(JSON.stringify(connection.tools.map(tool => tool.schema)), schemas);
    docs.failTemplate = true; docs.revision = 3; docs.stream!.end(': remote close\n\n');
    await until(() => current?.resources.docs?.[0]?.name === 'RESOURCE_3', 'partial reopen');
    assert.equal(current.templates.docs?.[0]?.name, 'TEMPLATE_2');
    assert.equal(peer.calls.length, peerCalls);
    assert.equal(count(docs, 'initialize'), 1);
    docs.failTemplate = false; docs.revision = 4; docs.holdReopen = true; docs.stream!.end(': remote close\n\n');
    await until(() => docs.held !== undefined, 'reopen before real notification');
    const beforeNotification = count(docs, 'resources/list');
    remote.open(docs, docs.held!); docs.held = undefined; docs.holdReopen = false;
    docs.stream!.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/resources/list_changed' })}\n\n`);
    await until(() => count(docs, 'resources/list') === beforeNotification + 2, 'synthetic and real notification both refresh');
    await until(() => current?.templates.docs?.[0]?.name === 'TEMPLATE_4', 'real notification publication');
    const prior = count(docs, 'resources/list');
    docs.reopenStatus = 204; docs.stream!.end(': remote close\n\n');
    await until(() => connection.notificationStreams!().docs?.reason === 'HTTP 204', 'terminal reopen');
    assert.equal(count(docs, 'resources/list'), prior);
    assert.deepEqual(remote.failures, []);
  } finally { unsubscribe(); await connection.close(); await until(() => remote.streams.size === 0, 'closed streams'); await remote.close(); }
});

test('reopen refresh honors listChanged and recovery gates and closes pending recovery without later publication', async () => {
  const bounded = await fixture();
  const boundedContext = context(), boundedConnection = await connectMcpServers(bounded.config(), boundedContext, options);
  try {
    await boundedConnection.catalogListing!(boundedContext.signal);
    const docs = bounded.servers.get('docs')!;
    await until(() => docs.stream !== undefined, 'initial bounded stream');
    for (let attempt = 0; attempt < 5; attempt++) {
      docs.stream!.end(': complete\n\n');
      await until(() => docs.gets === attempt + 2 && count(docs, 'resources/list') === attempt + 2, 'server retry bounded reopen');
    }
    docs.stream!.end(': complete\n\n');
    await until(() => boundedConnection.notificationStreams!().docs?.reason?.includes('exhausted') === true, 'server retry exhausts');
    await delay(40);
    assert.equal(docs.gets, 6); assert.equal(count(docs, 'resources/list'), 6);
    assert.equal(boundedConnection.notificationStreams!().docs?.reopenAttempts, 5);
  } finally { await boundedConnection.close(); await bounded.close(); }
  for (const config of [
    { capabilities: { resources: {}, tools: {} }, options },
    { capabilities: { resources: { listChanged: true }, tools: { listChanged: true } }, options: { ...options, recovery: false } },
    { capabilities: { resources: { listChanged: true }, tools: { listChanged: true } }, options: { ...options, notificationStream: false } },
  ]) {
    const remote = await fixture(config.capabilities);
    const ctx = context(), connection = await connectMcpServers(remote.config(), ctx, config.options);
    try {
      await connection.catalogListing!(ctx.signal);
      const docs = remote.servers.get('docs')!;
      if (config.options.notificationStream) {
        await until(() => docs.stream !== undefined, 'initial stream');
        docs.revision = 2; docs.stream!.end(': remote close\n\n');
        if (config.options.recovery) await until(() => docs.gets === 2, 'capability-gated reopen');
        else await until(() => connection.notificationStreams!().docs?.state === 'ended', 'recovery off');
        await delay(40);
      }
      assert.equal(count(docs, 'resources/list'), 1); assert.equal(count(docs, 'tools/list'), 1);
    } finally { await connection.close(); await remote.close(); }
  }
  for (const disable of [false, true]) {
    const remote = await fixture();
    const ctx = context(), connection = await connectMcpServers(remote.config(), ctx, options);
    let publications = 0;
    connection.subscribeCatalog!(() => { publications++; });
    try {
      await connection.catalogListing!(ctx.signal);
      const docs = remote.servers.get('docs')!;
      await until(() => docs.stream !== undefined, 'initial stream');
      docs.holdReopen = true; docs.stream!.end(': remote close\n\n');
      await until(() => docs.held !== undefined, 'pending recovery headers');
      if (disable) await connection.setEnabled!('docs', false, ctx.signal);
      else await connection.close();
      const before = publications, lists = count(docs, 'resources/list');
      remote.open(docs, docs.held!); await delay(40);
      assert.equal(count(docs, 'resources/list'), lists); assert.equal(publications, before);
    } finally { await connection.close(); await remote.close(); }
  }
});
