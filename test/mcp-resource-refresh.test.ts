import assert from 'node:assert/strict';
import fs from 'node:fs';
import http, { type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import { McpResourceCatalog, type ResourceCatalogSource } from '../src/mcp-resource-catalog.js';
import { connectMcpServers, type McpCatalogListing } from '../src/mcp.js';
import { TuiTerminal } from '../src/tui.js';

const temporaryRoot = () => process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
async function until(predicate: () => boolean, description: string) {
  const end = Date.now() + 5000;
  while (!predicate()) { assert.ok(Date.now() < end, description); await delay(10); }
}
const fields = (name: string) => ({ resources: [{ server: 'alpha', uri: `fixture://${name}`, name }],
  templates: [{ server: 'alpha', uriTemplate: `fixture://${name}/{id}`, name }] });
const listing = (name: string): McpCatalogListing => ({ resources: { alpha: fields(name).resources }, templates: { alpha: fields(name).templates } });

test('resource snapshots coalesce bursts with source cooldowns and retire generations, readers and timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 100000;
  t.mock.method(performance, 'now', () => now);
  let identity: object | undefined = {};
  const listeners = new Set<() => void>();
  const pending: { signal: AbortSignal; resolve(value: Awaited<ReturnType<ResourceCatalogSource['load']>>): void }[] = [];
  let peerLoads = 0;
  const lifetime = new AbortController();
  const source: ResourceCatalogSource = { name: 'alpha', identity: () => identity,
    load: signal => new Promise(resolve => pending.push({ signal, resolve })),
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  const peerIdentity = {};
  const catalog = new McpResourceCatalog([source, { name: 'peer', identity: () => peerIdentity,
    load: async () => { peerLoads++; return {}; }, subscribe: () => () => {} }], lifetime.signal);
  const snapshots: McpCatalogListing[] = [];
  catalog.subscribe(value => snapshots.push(value));
  const changed = () => { for (const listener of listeners) listener(); };
  const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
  const tick = async (ms: number) => { now += ms; t.mock.timers.tick(ms); await flush(); };
  try {
    changed(); assert.equal(pending.length, 0);
    const first = catalog.read(lifetime.signal);
    assert.equal(pending.length, 1);
    changed(); assert.equal(pending.length, 2, 'first notification starts during initial discovery');
    changed(); changed();
    pending[1]!.resolve(fields('initial')); await flush();
    pending[0]!.resolve(fields('stale initial'));
    assert.deepEqual(await first, listing('initial'));
    await flush();
    let count = 2;
    for (const wait of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      await tick(wait - 1); assert.equal(pending.length, count);
      await tick(1); assert.equal(pending.length, ++count);
      changed(); changed();
      pending.at(-1)!.resolve(fields(`round${count}`)); await flush();
    }
    assert.equal(peerLoads, 1);
    identity = {};
    changed(); assert.equal(pending.length, ++count);
    pending.at(-1)!.resolve(fields('replacement')); await flush();
    await tick(30001); assert.equal(pending.length, count);
    assert.equal(snapshots.at(-1)?.resources.alpha?.[0]?.name, 'replacement');
    snapshots.at(-1)!.resources.alpha![0]!.name = 'consumer mutation';
    assert.equal((await catalog.read(lifetime.signal)).resources.alpha?.[0]?.name, 'replacement');
    changed(); assert.equal(pending.length, ++count, 'first post-discovery notification starts immediately');
    const stale = pending.at(-1)!;
    identity = {}; changed();
    assert.equal(stale.signal.aborted, true);
    pending.at(-1)!.resolve(fields('accepted')); await flush();
    stale.resolve(fields('retired')); await flush();
    assert.equal(snapshots.at(-1)?.resources.alpha?.[0]?.name, 'accepted');
    identity = undefined; changed();
    assert.deepEqual(snapshots.at(-1), { resources: {}, templates: {} });
    identity = {}; changed();
    const cancelled = new AbortController();
    const reader = catalog.read(cancelled.signal);
    cancelled.abort(); await assert.rejects(reader);
    pending.at(-1)!.resolve(fields('restored')); await flush();
    changed(); const closing = pending.at(-1)!;
    const publications = snapshots.length;
    const teardown = catalog.close();
    assert.equal(closing.signal.aborted, true);
    closing.resolve(fields('closed')); lifetime.abort(); await teardown;
    await tick(30001);
    assert.equal(snapshots.length, publications);
    assert.equal(listeners.size, 0);
    await assert.rejects(catalog.read(new AbortController().signal), /closed/);
  } finally { await catalog.close(); t.mock.restoreAll(); t.mock.timers.reset(); }
});

test('HTTP notifications refresh only their server, retain failed families and cancel retired transport results', async () => {
  const streams = new Map<string, ServerResponse>();
  const generations = new Map<string, number>();
  const calls: { server: string; generation: number; method: string }[] = [];
  const held: { response: ServerResponse; id: number }[] = [];
  let revision = 1, templatesFail = false, resourcesFail = false, malformed = false, missing = false, empty = false, hold = false;
  const server = http.createServer((request, response) => {
    void (async () => {
      const name = request.url!.slice(1);
      const session = request.headers['mcp-session-id'];
      if (request.method === 'GET') {
        assert.equal(typeof session, 'string');
        response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
        streams.set(String(session), response);
        response.on('close', () => { streams.delete(String(session)); }); return;
      }
      if (request.method === 'DELETE') { response.writeHead(204).end(); return; }
      let body = ''; for await (const part of request) body += part;
      const message: { id: number; method: string } = JSON.parse(body);
      const generation = generations.get(name) ?? 0;
      calls.push({ server: name, generation, method: message.method });
      const reply = (result: unknown) => response.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
      if (message.method === 'initialize') {
        generations.set(name, generation + 1); response.setHeader('Mcp-Session-Id', `${name}-${generation + 1}`);
        reply({ protocolVersion: '2025-06-18', capabilities: { resources: { listChanged: true } } });
      } else if (message.method.startsWith('resources/')) {
        if (name === 'alpha' && hold) { held.push({ response, id: message.id }); return; }
        if (name === 'alpha' && malformed) { reply({ resources: 'malformed', resourceTemplates: 'malformed' }); return; }
        if (name === 'alpha' && (missing || (resourcesFail && message.method === 'resources/list'))) {
          response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: message.id,
            error: { code: missing ? -32601 : -32603, message: 'owned listing error' } })); return;
        }
        if (message.method === 'resources/templates/list') {
          if (name === 'alpha' && templatesFail) response.writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'owned failure' } }));
          else reply({ resourceTemplates: name === 'alpha' && empty ? [] : [{ uriTemplate: `${name}://${revision}/{id}`, name: `T${revision}` }] });
        } else reply({ resources: name === 'alpha' && empty ? [] : [{ uri: `${name}://${revision}`, name: `R${revision}` }] });
      } else response.writeHead(202).end();
    })().catch(() => response.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 24000 };
  const connection = await connectMcpServers(Object.fromEntries(['alpha', 'peer'].map(name =>
    [name, { type: 'http' as const, url: `http://127.0.0.1:${address.port}/${name}` }])), context,
  { catalog: true, notificationStream: true, requestTimeoutMs: 3000 });
  let current: McpCatalogListing | undefined;
  const unsubscribe = connection.subscribeCatalog!(value => { current = value; });
  const changed = () => streams.get(`alpha-${generations.get('alpha')}`)!.write(
    `data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/resources/list_changed' })}\n\n`);
  try {
    await until(() => streams.size === 2, 'owned GET streams');
    changed(); await delay(20); assert.equal(calls.filter(call => call.method.startsWith('resources/')).length, 0);
    current = await connection.catalogListing!(context.signal);
    assert.equal(current.resources.alpha?.[0]?.name, 'R1');
    const schemas = JSON.stringify(connection.tools.map(tool => tool.schema));
    const peers = calls.filter(call => call.server === 'peer').length;
    revision = 2; templatesFail = true; changed();
    await until(() => current?.resources.alpha?.[0]?.name === 'R2', 'partial resource refresh');
    assert.equal(current.templates.alpha?.[0]?.name, 'T1');
    templatesFail = false; resourcesFail = true; changed();
    await until(() => current?.templates.alpha?.[0]?.name === 'T2', 'partial template refresh');
    assert.equal(current.resources.alpha?.[0]?.name, 'R2');
    resourcesFail = false; malformed = true;
    const count = calls.filter(call => call.server === 'alpha' && call.method === 'resources/templates/list').length;
    changed();
    await until(() => calls.filter(call => call.server === 'alpha' && call.method === 'resources/templates/list').length > count, 'malformed refresh');
    await delay(30); assert.equal(current.resources.alpha?.[0]?.name, 'R2');
    assert.equal(current.templates.alpha?.[0]?.name, 'T2');
    malformed = false; missing = true; changed();
    await until(() => !current?.resources.alpha && !current?.templates.alpha, 'method absence clears families');
    missing = false; revision = 3; changed();
    await until(() => current?.resources.alpha?.[0]?.name === 'R3', 'recover methods');
    empty = true; changed();
    await until(() => !current?.resources.alpha && !current?.templates.alpha, 'empty removes families');
    empty = false; revision = 3; hold = true; changed();
    await until(() => held.length === 2, 'held old transport refresh');
    hold = false; revision = 4;
    await connection.reconnect!('alpha', context.signal);
    await until(() => current?.resources.alpha?.[0]?.name === 'R4', 'replacement resources');
    for (const item of held) item.response.end(JSON.stringify({ jsonrpc: '2.0', id: item.id, result: { resources: [{ uri: 'retired://old' }] } }));
    await delay(30); assert.equal(current.resources.alpha?.[0]?.name, 'R4');
    assert.equal(current.templates.alpha?.[0]?.name, 'T4');
    await connection.setEnabled!('alpha', false, context.signal);
    assert.equal(current.resources.alpha, undefined);
    assert.equal(current.resources.peer?.[0]?.name, 'R1');
    await connection.setEnabled!('alpha', true, context.signal);
    await until(() => current?.resources.alpha?.[0]?.name === 'R4', 're-enabled resources');
    assert.equal(calls.filter(call => call.server === 'peer').length, peers);
    assert.equal(JSON.stringify(connection.tools.map(tool => tool.schema)), schemas);
    hold = true; changed(); await until(() => held.length === 4, 'held close refresh');
    await connection.close(); await until(() => streams.size === 0, 'GET streams close');
  } finally {
    unsubscribe(); await connection.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
  const root = fs.realpathSync(fs.mkdtempSync(path.join(temporaryRoot(), 'mcp-resource-redial-')));
  const notes = path.join(root, 'boots');
  const script = `import fs from 'node:fs';import readline from 'node:readline';
    fs.appendFileSync(process.argv[1],process.pid+'\\n');
    readline.createInterface({input:process.stdin}).on('line',line=>{
      const m=JSON.parse(line);let result;
      if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{resources:{}}};
      if(m.method==='resources/list')result={resources:[{uri:'owned://recovered'}]};
      if(m.method==='resources/templates/list')result={resourceTemplates:[]};
      if(result)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');
    });`;
  const childConnection = await connectMcpServers({ owned: { command: process.execPath,
    args: ['--input-type=module', '-e', script, notes] } }, context, { catalog: true, recovery: true });
  const pids = () => fs.readFileSync(notes, 'utf8').trim().split('\n').map(Number);
  try {
    assert.equal((await childConnection.catalogListing!(context.signal)).resources.owned?.[0]?.uri, 'owned://recovered');
    process.kill(pids()[0]!, 'SIGTERM');
    await until(() => childConnection.servers!().owned?.state === 'disconnected', 'owned stdio disconnected');
    assert.equal((await childConnection.catalogListing!(context.signal)).resources.owned?.[0]?.uri, 'owned://recovered');
    assert.equal(pids().length, 2);
    assert.equal(childConnection.servers!().owned?.generation, 2);
  } finally { await childConnection.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('live catalog publication repaints the same draft and retires argument completions and terminal listeners', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(temporaryRoot(), 'mcp-resource-ui-')));
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { screen.write(String(chunk), done); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const listeners = new Set<(value: McpCatalogListing) => void>();
  const subscribe = (listener: (value: McpCatalogListing) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const completions: { signal: AbortSignal; resolve(values: string[]): void }[] = [];
  const submitted: string[] = [];
  let finish!: (value: McpCatalogListing) => void;
  const terminal = new TuiTerminal({ input, output, workspace: root, userDir: root, prefersReducedMotion: true,
    mcpCatalog: () => new Promise(resolve => { finish = resolve; }), subscribeMcpCatalog: subscribe,
    completeResourceTemplate: (_request, signal) => new Promise(resolve => completions.push({ signal, resolve })),
    onSubmit: text => submitted.push(text) });
  const key = (text: string) => input.emit('data', text);
  const frame = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n');
  const publish = (value: McpCatalogListing) => { for (const listener of listeners) listener(value); };
  try {
    terminal.start(); assert.equal(listeners.size, 0);
    key('@alpha'); await until(() => typeof finish === 'function', 'lazy catalog read');
    const draft = terminal.state;
    publish(listing('NEW_RESOURCE')); await until(() => frame().includes('NEW_RESOURCE'), 'live rows');
    finish(listing('STALE_INITIAL')); await delay(20);
    assert.ok(!frame().includes('STALE_INITIAL')); assert.equal(terminal.state.text, draft.text); assert.equal(terminal.state.cursor, draft.cursor);
    publish({ resources: {}, templates: {} }); await until(() => !frame().includes('NEW_RESOURCE'), 'removed rows');
    publish(listing('fresh')); key(':fixture://fresh/a');
    await until(() => completions.length === 1, 'pending argument');
    publish({ resources: {}, templates: {} }); assert.equal(completions[0]!.signal.aborted, true);
    completions[0]!.resolve(['RETIRED_VALUE']); await delay(80); assert.ok(!frame().includes('RETIRED_VALUE'));
    const retiredListener = [...listeners][0]!;
    terminal.bindMcpCatalog(async () => listing('replacement'), undefined, subscribe);
    assert.equal(listeners.size, 1);
    retiredListener(listing('RETIRED_BINDING')); await delay(20); assert.ok(!frame().includes('RETIRED_BINDING'));
    terminal.close(); assert.equal(listeners.size, 0); assert.deepEqual(submitted, []);
  } finally {
    terminal.close(); await new Promise<void>(resolve => screen.write('', resolve)); screen.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(input.listenerCount('data'), 0); assert.equal(output.listenerCount('resize'), 0);
});
