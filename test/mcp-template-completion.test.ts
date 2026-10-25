import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import { activeTemplateArgument, completeTemplateArguments, templateParts } from '../src/tui-mcp-suggestions.js';
import { connectMcpServers, type McpTemplateCompletionRequest } from '../src/mcp.js';
import type { McpTemplate } from '../src/tui-at-suggestions.js';
import { TuiTerminal } from '../src/tui.js';

const temporaryRoot = () => process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
async function until(predicate: () => boolean, description: string) {
  const end = Date.now() + 4000;
  while (!predicate()) { assert.ok(Date.now() < end, description); await delay(10); }
}

test('recovered template parsing, ranking and value splicing preserve sequential and quoted arguments', async () => {
  assert.deepEqual(templateParts('repo://{+org:4}/{file*}{?query,ignored}'), [
    { type: 'literal', value: 'repo://' }, { type: 'variable', name: 'org' },
    { type: 'literal', value: '/' }, { type: 'variable', name: 'file' }, { type: 'variable', name: 'query' },
  ]);
  assert.deepEqual(templateParts('repo://{unfinished'), [
    { type: 'literal', value: 'repo://' }, { type: 'literal', value: '{unfinished' },
  ]);
  const templates: Record<string, McpTemplate[]> = { repo: [
    { server: 'repo', uriTemplate: 'repo://{org}/{file}', name: 'Files' },
    { server: 'repo', uriTemplate: 'repo://quote/{name}', name: 'Quote' },
    { server: 'repo', uriTemplate: 'ui://{id}', name: 'Hidden' },
  ] };
  const selected = activeTemplateArgument('repo://quote/x', templates.repo!);
  assert.equal(selected?.template.uriTemplate, 'repo://{org}/{file}');
  assert.deepEqual(selected?.resolvedArgs, { org: 'quote' });
  assert.equal(selected?.argName, 'file');
  const calls: McpTemplateCompletionRequest[] = [];
  const complete = async (request: McpTemplateCompletionRequest) => {
    calls.push(request); return request.argument.name === 'org' ? ['acme', 'a b'] : ['report.md'];
  };
  const signal = new AbortController().signal;
  assert.deepEqual(await completeTemplateArguments('repo:repo://a', templates, complete, signal), [
    { id: 'mcp-template-value::repo__repo://acme/', displayText: 'acme/', description: 'Files',
      replacement: '@repo:repo://acme/', partial: true },
    { id: 'mcp-template-value::repo__repo://a b/', displayText: 'a b/', description: 'Files',
      replacement: '@"repo:repo://a b/', partial: true },
  ]);
  assert.deepEqual(await completeTemplateArguments('repo:repo://a b/r', templates, complete, signal), [
    { id: 'mcp-template-value::repo__repo://a b/report.md', displayText: 'report.md', description: 'Files',
      replacement: '@"repo:repo://a b/report.md"', partial: false },
  ]);
  assert.deepEqual(calls, [
    { server: 'repo', uriTemplate: 'repo://{org}/{file}', argument: { name: 'org', value: 'a' }, resolvedArgs: {} },
    { server: 'repo', uriTemplate: 'repo://{org}/{file}', argument: { name: 'file', value: 'r' }, resolvedArgs: { org: 'a b' } },
  ]);
  assert.equal(await completeTemplateArguments('repo:ui://x', templates, complete, signal), null);
  assert.equal(await completeTemplateArguments('missing:repo://a', templates, complete, signal), null);
  const capped = await completeTemplateArguments('repo:repo://a', templates,
    async () => Array.from({ length: 18 }, (_, index) => String(index)), signal);
  assert.equal(capped?.length, 15);
  assert.equal(capped?.at(-1)?.replacement, '@repo:repo://14/');
});

test('catalog completion sends capability-gated RPC, validates responses and cancels without replay', async () => {
  const calls: { id: number; method: string; params?: Record<string, any> }[] = [];
  let completionsEnabled = true;
  const server = http.createServer((request, response) => {
    let text = '';
    request.setEncoding('utf8'); request.on('data', part => { text += part; });
    request.on('end', () => {
      const message = JSON.parse(text); calls.push(message);
      const reply = (result: unknown) => response.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
      if (message.method === 'initialize') reply({ protocolVersion: '2025-06-18',
        capabilities: { resources: {}, ...(completionsEnabled ? { completions: {} } : {}) } });
      else if (message.method === 'completion/complete') {
        if (message.params.argument.value === 'held') return;
        if (message.params.argument.value === 'broken') reply({ completion: { values: [1] } });
        else reply({ completion: { values: ['report.md'] } });
      } else response.writeHead(202).end();
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const context = { workspace: process.cwd(), signal: new AbortController().signal, maxOutputBytes: 24000 };
  const connection = await connectMcpServers({ repo: { type: 'http', url: `http://127.0.0.1:${address.port}/mcp` } },
    context, { catalog: true, requestTimeoutMs: 2000 });
  const request = { server: 'repo', uriTemplate: 'repo://{org}/{file}', argument: { name: 'file', value: 'r' },
    resolvedArgs: { org: 'acme' } };
  try {
    assert.deepEqual(await connection.completeResourceTemplate!(request, context.signal), ['report.md']);
    assert.deepEqual(calls.find(call => call.method === 'completion/complete')?.params, {
      ref: { type: 'ref/resource', uri: 'repo://{org}/{file}' }, argument: { name: 'file', value: 'r' },
      context: { arguments: { org: 'acme' } },
    });
    assert.deepEqual(await connection.completeResourceTemplate!({ ...request, resolvedArgs: {} }, context.signal), ['report.md']);
    assert.equal(calls.filter(call => call.method === 'completion/complete').at(-1)?.params?.context, undefined);
    assert.deepEqual(await connection.completeResourceTemplate!({ ...request, argument: { name: 'file', value: 'broken' } }, context.signal), []);
    const cancelled = new AbortController();
    const held = connection.completeResourceTemplate!({ ...request, argument: { name: 'file', value: 'held' } }, cancelled.signal);
    await until(() => calls.some(call => call.method === 'completion/complete' && call.params?.argument.value === 'held'), 'held RPC');
    cancelled.abort(); assert.deepEqual(await held, []);
    const sent = calls.filter(call => call.method === 'completion/complete').length;
    await connection.setEnabled!('repo', false, context.signal);
    assert.deepEqual(await connection.completeResourceTemplate!(request, context.signal), []);
    assert.equal(calls.filter(call => call.method === 'completion/complete').length, sent);
    completionsEnabled = false;
    await connection.setEnabled!('repo', true, context.signal);
    assert.deepEqual(await connection.completeResourceTemplate!(request, context.signal), []);
    assert.equal(calls.filter(call => call.method === 'completion/complete').length, sent);
    completionsEnabled = true;
    await connection.reconnect!('repo', context.signal);
    assert.deepEqual(await connection.completeResourceTemplate!(request, context.signal), ['report.md']);
  } finally {
    await connection.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
  assert.deepEqual(await connection.completeResourceTemplate!(request, context.signal), []);
});

test('the composer retires stale values, preserves suffixes and continues partial arguments without submission', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(temporaryRoot(), 'mcp-completion-test-')));
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_raw: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { screen.write(String(chunk), done); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const submitted: string[] = [];
  const pending: { request: McpTemplateCompletionRequest; signal: AbortSignal; resolve(values: string[]): void }[] = [];
  const catalog = async () => ({ resources: {}, templates: { repo: [{ server: 'repo', uriTemplate: 'repo://{org}/{file}', name: 'Files' }] } });
  const complete = (request: McpTemplateCompletionRequest, signal: AbortSignal) => new Promise<string[]>(resolve => pending.push({ request, signal, resolve }));
  const terminal = new TuiTerminal({ input, output, userDir: root, workspace: root, prefersReducedMotion: true,
    mcpCatalog: catalog, completeResourceTemplate: complete, onSubmit: text => submitted.push(text) });
  const key = (text: string) => input.emit('data', text);
  const frame = () => Array.from({ length: screen.rows }, (_, index) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + index)?.translateToString(true) ?? '').join('\n');
  try {
    terminal.start(); key('inspect @repo:repo://a');
    await until(() => pending.length === 1, 'first completion');
    key('b'); await until(() => pending.length === 2, 'replacement completion');
    assert.equal(pending[0]!.signal.aborted, true);
    pending[0]!.resolve(['STALE_VALUE']); pending[1]!.resolve(['acme']);
    await until(() => frame().includes('acme/'), 'current values');
    assert.ok(!frame().includes('STALE_VALUE'));
    key('\t'); assert.equal(terminal.state.text, 'inspect @repo:repo://acme/');
    await until(() => pending.length === 3, 'second argument');
    assert.deepEqual(pending[2]!.request, { server: 'repo', uriTemplate: 'repo://{org}/{file}',
      argument: { name: 'file', value: '' }, resolvedArgs: { org: 'acme' } });
    pending[2]!.resolve(['a b']); await until(() => frame().includes('a b'), 'last value');
    key('\t'); assert.equal(terminal.state.text, 'inspect @"repo:repo://acme/a b" ');
    assert.deepEqual(submitted, []);
    key('\x01\x0b@repo:repo://r suffix');
    key('\x01' + '\x1b[C'.repeat('@repo:repo://r'.length));
    await until(() => pending.at(-1)?.request.argument.value === 'r', 'caret-bounded completion');
    pending.at(-1)!.resolve(['red']); await until(() => frame().includes('red/'), 'caret values');
    key('\t'); assert.equal(terminal.state.text, '@repo:repo://red/ suffix');
    await until(() => pending.at(-1)?.request.argument.name === 'file', 'pending before rebind');
    const retired = pending.at(-1)!;
    terminal.bindMcpCatalog(catalog, complete);
    assert.equal(retired.signal.aborted, true);
    retired.resolve(['OLD_CATALOG']);
    key('x'); await until(() => pending.at(-1)?.request.argument.value === 'x', 'new catalog request');
    assert.ok(!frame().includes('OLD_CATALOG'));
    const beforeDialog = pending.at(-1)!;
    const dialog = terminal.prompt({ title: 'Owned modal', message: 'completion paused', readOnly: true }, new AbortController().signal);
    assert.equal(beforeDialog.signal.aborted, true);
    beforeDialog.resolve(['MODAL_STALE']);
    key('\x1b'); await dialog;
    const count = pending.length;
    await until(() => pending.length > count, 'completion after modal');
    assert.ok(!frame().includes('MODAL_STALE'));
    const closing = pending.at(-1)!;
    terminal.close(); assert.equal(closing.signal.aborted, true);
    closing.resolve(['CLOSED_VALUE']); await delay(80);
    assert.deepEqual(submitted, []);
  } finally {
    terminal.close(); await new Promise<void>(resolve => screen.write('', resolve)); screen.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(input.listenerCount('data'), 0);
  assert.equal(output.listenerCount('resize'), 0);
});
