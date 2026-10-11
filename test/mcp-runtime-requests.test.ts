import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
import type { ModelProvider } from '../src/provider.js';

const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('No model calls in roots fixture'); } };

test('runtime callbacks are explicitly advertised and rebound to relocated workspaces without entering config', async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-mcp-roots-')));
  const relocated = path.join(workspace, 'relocated'); fs.mkdirSync(relocated);
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const capabilities: unknown[] = [];
  const roots: unknown[] = [];
  const failures: unknown[] = [];
  const server = http.createServer((request, response) => {
    void (async () => {
      let text = ''; for await (const chunk of request) { text += String(chunk); assert.ok(text.length <= 65536); }
      const body = text ? JSON.parse(text) : {};
      if (request.method === 'DELETE') { response.writeHead(204); response.end(); return; }
      if (body.method === 'initialize') {
        capabilities.push(body.params.capabilities);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } } }));
      } else if (body.method === 'tools/list') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 'root-request', method: 'roots/list', params: {} })}\n\n`);
        response.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: [] } })}\n\n`);
      } else {
        if (body.id === 'root-request') roots.push(body.result);
        response.writeHead(202); response.end();
      }
    })().catch(error => { failures.push(error); response.destroy(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', mcpServers: { fixture: { type: 'http' as const, url: `http://127.0.0.1:${address.port}/mcp` } } };
  const before = JSON.stringify(config);
  const factoryWorkspaces: string[] = [];
  const runtime = await createRuntime(config, provider, new AbortController().signal, {
    mcpClientRequests: pinned => {
      factoryWorkspaces.push(pinned.workspace);
      return { roots: () => [{ uri: pathToFileURL(pinned.workspace).href }] };
    },
  });
  let next: Runtime | undefined;
  const settledRoots = async (count: number) => {
    const deadline = Date.now() + 2000;
    while (roots.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(roots.length, count);
  };
  try {
    await settledRoots(1);
    next = await runtime.reconfigure!({ ...config, workspace: relocated });
    await settledRoots(2);
    assert.deepEqual(factoryWorkspaces, [workspace, relocated]);
    assert.deepEqual(roots, [{ roots: [{ uri: pathToFileURL(workspace).href }] }, { roots: [{ uri: pathToFileURL(relocated).href }] }]);
    assert.deepEqual(capabilities, [{ roots: { listChanged: false } }, { roots: { listChanged: false } }]);
    assert.equal(JSON.stringify(config), before);
    assert.deepEqual(failures, []);
  } finally { await next?.close(); await runtime.close(); }
});
