import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { DEFAULT_GATEWAY, GatewayProvider, type ModelRequest } from '../src/provider.js';

const request: ModelRequest = {
  model: 'gateway/arbitrary-model', system: 'Personal harness', max_tokens: 128,
  messages: [{ role: 'user', content: '你好' }],
  tools: [{ name: 'read_file', input_schema: { type: 'object' }, eager_input_streaming: true }],
  thinking: { type: 'disabled' }, cache_control: { type: 'ephemeral' },
};
function responseStream(text: string) {
  const events = [
    { type: 'message_start', message: { id: 'fixture', type: 'message', role: 'assistant', model: request.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3 } },
    { type: 'message_stop' },
  ];
  return new Response(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

test('gateway uses explicit endpoint, bearer credential and model ID; text passes unchanged', async () => {
  const text = '中文输出保持原样\nCo-Authored-By is quoted data.';
  let calls = 0;
  const transport: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), 'http://gateway.test/v1/messages');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer fixture-key');
    assert.equal(headers.get('x-api-key'), null);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, request.model);
    assert.equal(body.stream, true);
    assert.equal(body.thinking, undefined);
    assert.equal(body.cache_control, undefined);
    assert.equal(body.tools[0].eager_input_streaming, undefined);
    return responseStream(text);
  };
  const provider = new GatewayProvider('fixture-key', { ...DEFAULT_GATEWAY, baseURL: 'http://gateway.test' }, transport);
  const streamed: string[] = [];
  const result = await provider.complete(request, new AbortController().signal, chunk => streamed.push(chunk));
  assert.equal(calls, 1);
  assert.equal(streamed.join(''), text);
  assert.equal(result.content.filter(b => b.type === 'text').map(b => b.text).join(''), text);
  assert.equal(request.tools?.[0] && 'eager_input_streaming' in request.tools[0] ? request.tools[0].eager_input_streaming : undefined, true);
});

test('gateway capability options explicitly enable thinking, cache and eager input', async () => {
  const transport: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-api-key'), 'fixture-key');
    assert.equal(headers.get('authorization'), null);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.thinking, { type: 'adaptive' });
    assert.deepEqual(body.cache_control, { type: 'ephemeral' });
    assert.equal(body.tools[0].eager_input_streaming, true);
    return responseStream('done');
  };
  const provider = new GatewayProvider('fixture-key', { ...DEFAULT_GATEWAY, auth: 'api-key', promptCaching: true, eagerToolInput: true }, transport);
  await provider.complete({ ...request, thinking: { type: 'adaptive' } }, new AbortController().signal);
});

test('estimated context budget works without a token-counting endpoint', async () => {
  const transport: typeof fetch = async () => { throw new Error('Unexpected network request'); };
  const provider = new GatewayProvider('fixture-key', DEFAULT_GATEWAY, transport);
  const budget = await provider.count(request, new AbortController().signal);
  assert.ok(budget >= Buffer.byteLength(JSON.stringify(request.messages), 'utf8'));
  await assert.rejects(provider.count(request, AbortSignal.abort()), /abort/i);
});

test('API token counting uses the configured endpoint and pruned capability fields', async () => {
  const transport: typeof fetch = async (input, init) => {
    assert.equal(String(input), 'http://gateway.test/v1/messages/count_tokens');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, request.model);
    assert.equal(body.thinking, undefined);
    assert.equal(body.tools[0].eager_input_streaming, undefined);
    return Response.json({ input_tokens: 123 });
  };
  const provider = new GatewayProvider('fixture-key', { ...DEFAULT_GATEWAY, baseURL: 'http://gateway.test', tokenCounting: 'api' }, transport);
  assert.equal(await provider.count(request, new AbortController().signal), 123);
});

test('pre-aborted completion never enters the gateway transport', async () => {
  const transport: typeof fetch = async () => { throw new Error('Unexpected network request'); };
  const provider = new GatewayProvider('fixture-key', DEFAULT_GATEWAY, transport);
  await assert.rejects(provider.complete(request, AbortSignal.abort()), /abort/i);
});

test('gateway isolates bearer and api-key requests from SDK environment headers', async (t) => {
  const requests: { url: string; headers: http.IncomingHttpHeaders }[] = [];
  const sse = await responseStream('isolated').text();
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      requests.push({ url: req.url!, headers: req.headers });
      const counting = req.url === '/v1/messages/count_tokens';
      res.writeHead(200, { 'content-type': counting ? 'application/json' : 'text/event-stream' });
      res.end(counting ? JSON.stringify({ input_tokens: 123 }) : sse);
    });
  });
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // Child environments exercise SDK construction without racing process.env in this runner.
    const script = `
      import assert from 'node:assert/strict';
      import { GatewayProvider, DEFAULT_GATEWAY } from ${JSON.stringify(new URL('../src/provider.ts', import.meta.url).href)};
      const before = { ...process.env };
      const provider = new GatewayProvider('fixture-key', {
        ...DEFAULT_GATEWAY, baseURL: process.argv[1], auth: process.argv[2], tokenCounting: 'api',
      });
      const request = ${JSON.stringify(request)};
      const [message, tokens] = await Promise.all([
        provider.complete(request, new AbortController().signal),
        provider.count(request, new AbortController().signal),
      ]);
      assert.equal(message.content[0].text, 'isolated');
      assert.equal(tokens, 123);
      assert.deepEqual({ ...process.env }, before);
    `;
    for (const auth of ['bearer', 'api-key'] as const) {
      requests.length = 0;
      await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, baseURL, auth], {
        cwd: new URL('..', import.meta.url), timeout: 10_000, maxBuffer: 16_384,
        env: { ...process.env, ANTHROPIC_API_KEY: 'env-api-key', ANTHROPIC_AUTH_TOKEN: 'env-token',
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:1', ANTHROPIC_CUSTOM_HEADERS:
            'Authorization: Bearer env-override\nauthorization: Bearer env-lower\nX-Api-Key: env-extra\nx-api-key: env-lower-key\nX-Fixture-Route: env-route\nanthropic-version: env-version\nContent-Type: text/plain' },
      });
      assert.deepEqual(requests.map(item => item.url).sort(), ['/v1/messages', '/v1/messages/count_tokens']);
      for (const { headers } of requests) {
        assert.equal(headers.authorization, auth === 'bearer' ? 'Bearer fixture-key' : undefined);
        assert.equal(headers['x-api-key'], auth === 'api-key' ? 'fixture-key' : undefined);
        assert.equal(headers['x-fixture-route'], undefined);
        assert.equal(headers['anthropic-version'], '2023-06-01');
        assert.equal(headers['content-type'], 'application/json');
      }
      t.diagnostic(`${auth}: stream + count_tokens; explicit auth only; environment route absent`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
