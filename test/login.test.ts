import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  CREDENTIALS_FILE, LOGIN_PROFILES, UNCONFIGURED_MODEL, createProviderSlot, credentialsPath,
  providerFromCredential, readCredentialFile, readStoredCredential, removeStoredCredential,
  runLogin, storedCredentialFor, writeStoredCredential, type LoginPrompts, type StoredCredential,
} from '../src/login.js';
import { DEFAULT_GATEWAY, type ModelRequest } from '../src/provider.js';

function userDir(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'login-user-')));
}

function scripted(answers: readonly (string | undefined)[], choices: readonly (string | undefined)[] = [], notices: string[] = []): LoginPrompts {
  let textIndex = 0, choiceIndex = 0;
  return {
    notice: text => { notices.push(text); },
    text: async () => answers[textIndex++],
    choose: async () => choices[choiceIndex++],
  };
}

function storedCredential(overrides: Partial<StoredCredential> = {}): StoredCredential {
  return {
    provider: 'deepseek', kind: 'api-key', baseURL: 'https://api.deepseek.com/anthropic',
    auth: 'api-key', model: 'deepseek-flash', key: 'sk-fixture-value', updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('the DeepSeek profile matches the documented Anthropic-compatible endpoint and models', () => {
  const profile = LOGIN_PROFILES.deepseek!;
  assert.equal(profile.baseURL, 'https://api.deepseek.com/anthropic');
  assert.equal(profile.auth, 'api-key');
  assert.deepEqual([...profile.models], ['deepseek-flash', 'deepseek-v4-pro']);
  assert.equal(profile.defaultModel, 'deepseek-flash');
  assert.equal(LOGIN_PROFILES.oauth!.oauth, true);
});

test('a stored credential round-trips through a mode-0600 file and never appears in a notice', () => {
  const dir = userDir();
  try {
    const credential = storedCredential();
    writeStoredCredential(dir, credential);
    const file = credentialsPath(dir);
    assert.equal(path.basename(file), CREDENTIALS_FILE);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(readStoredCredential(dir), credential);
    assert.equal(readCredentialFile(dir).active, 'deepseek');
    assert.deepEqual(storedCredentialFor(dir, 'https://api.deepseek.com/anthropic'), credential);
    // A different endpoint does not receive this key.
    assert.equal(storedCredentialFor(dir, 'https://gateway.example.test'), undefined);
    assert.deepEqual(storedCredentialFor(dir), credential);
    // The raw value is on disk for the owner only; no other file is created.
    assert.deepEqual(fs.readdirSync(dir), [CREDENTIALS_FILE]);
    assert.equal(removeStoredCredential(dir), true);
    assert.equal(readStoredCredential(dir), undefined);
    assert.equal(fs.existsSync(file), false);
    assert.equal(removeStoredCredential(dir), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed, linked or oversized credential file answers an empty store', () => {
  const dir = userDir();
  try {
    const file = credentialsPath(dir);
    fs.writeFileSync(file, '{ not json');
    assert.deepEqual(readCredentialFile(dir).providers, {});
    fs.writeFileSync(file, JSON.stringify({ version: 1, providers: { deepseek: { provider: 'deepseek' } } }));
    assert.deepEqual(readCredentialFile(dir).providers, {});
    fs.rmSync(file);
    fs.symlinkSync('/etc/hosts', file);
    assert.deepEqual(readCredentialFile(dir).providers, {});
    fs.rmSync(file);
    fs.writeFileSync(file, 'x'.repeat(65 * 1024));
    assert.deepEqual(readCredentialFile(dir).providers, {});
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the DeepSeek login stores the pasted key with the profile endpoint and the chosen model', async () => {
  const dir = userDir();
  const notices: string[] = [];
  try {
    const credential = await runLogin({
      kind: 'deepseek', userDir: dir, signal: new AbortController().signal,
      prompts: scripted(['  sk-fixture-key  '], ['deepseek-v4-pro'], notices),
    });
    assert.equal(credential.key, 'sk-fixture-key');
    assert.equal(credential.baseURL, 'https://api.deepseek.com/anthropic');
    assert.equal(credential.auth, 'api-key');
    assert.equal(credential.kind, 'api-key');
    assert.equal(credential.model, 'deepseek-v4-pro');
    assert.deepEqual(readStoredCredential(dir), credential);
    assert.ok(notices.some(line => line.includes('platform.deepseek.com')));
    // No notice carries the key.
    assert.ok(notices.every(line => !line.includes('sk-fixture-key')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a custom login keeps the chosen header and refuses an incomplete answer', async () => {
  const dir = userDir();
  try {
    const credential = await runLogin({
      kind: 'custom', userDir: dir, signal: new AbortController().signal,
      prompts: scripted(['https://gateway.example.test', 'model-x', 'secret-x'], ['api-key']),
    });
    assert.equal(credential.baseURL, 'https://gateway.example.test');
    assert.equal(credential.auth, 'api-key');
    assert.equal(credential.model, 'model-x');
    await assert.rejects(runLogin({
      kind: 'custom', userDir: dir, signal: new AbortController().signal,
      prompts: scripted([undefined, undefined, undefined], [undefined]),
    }), /needs a base URL/);
    await assert.rejects(runLogin({
      kind: 'nope', userDir: dir, signal: new AbortController().signal, prompts: scripted([]),
    }), /must be one of/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the OAuth login runs the PKCE loopback flow and refreshes an expired token', async () => {
  const dir = userDir();
  const requests: { grant: string | null; verifier: string | null; code: string | null }[] = [];
  let issued = 0;
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const form = new URLSearchParams(body);
      requests.push({ grant: form.get('grant_type'), verifier: form.get('code_verifier'), code: form.get('code') });
      issued += 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(issued === 1
        ? { access_token: 'access-first', refresh_token: 'refresh-first', expires_in: 1, token_type: 'Bearer' }
        : { access_token: 'access-second', expires_in: 3600, token_type: 'Bearer' }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    // The callback arrives on a loopback listener the login itself opens; drive it from the
    // authorization URL the login reports, the way a browser would.
    const controller = new AbortController();
    const prompts: LoginPrompts = {
      notice: text => {
        const match = /^https?:\/\/\S+$/m.exec(text);
        if (match === null) return;
        const target = new URL(match[0]);
        const redirect = target.searchParams.get('redirect_uri')!;
        const state = target.searchParams.get('state')!;
        assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
        assert.ok((target.searchParams.get('code_challenge') ?? '').length > 20);
        setTimeout(() => {
          http.get(`${redirect}?code=code-1&state=${state}`, response => response.resume());
        }, 10);
      },
      text: async (_title, message) => message.includes('authorization') ? 'https://auth.example.test/authorize'
        : message.includes('endpoint base') ? 'https://gateway.example.test'
        : message.includes('token') ? `http://127.0.0.1:${port}/token` : 'model-oauth',
      choose: async () => undefined,
    };
    const credential = await runLogin({
      kind: 'oauth', userDir: dir, signal: controller.signal, prompts,
      oauth: { clientId: 'client-fixture' },
    });
    assert.equal(credential.kind, 'oauth');
    assert.equal(credential.key, 'access-first');
    assert.equal(credential.refreshToken, 'refresh-first');
    assert.equal(credential.auth, 'bearer');
    assert.equal(credential.baseURL, 'https://gateway.example.test');
    assert.equal(credential.model, 'model-oauth');
    assert.ok(credential.expiresAt !== undefined && credential.expiresAt <= Date.now() + 2_000);
    assert.equal(requests[0]!.grant, 'authorization_code');
    assert.equal(requests[0]!.code, 'code-1');
    assert.ok((requests[0]!.verifier ?? '').length > 20);
    assert.deepEqual(readStoredCredential(dir), credential);

    // The stored token is already near expiry, so the first call refreshes and rewrites the store.
    const seen: string[] = [];
    const transport = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push(headers.get('authorization') ?? headers.get('x-api-key') ?? '');
      const events: [string, unknown][] = [
        ['message_start', { type: 'message_start', message: { id: 'msg', type: 'message', role: 'assistant', model: 'model-oauth',
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }],
        ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
        ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } }],
        ['content_block_stop', { type: 'content_block_stop', index: 0 }],
        ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
        ['message_stop', { type: 'message_stop' }],
      ];
      const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }) as typeof fetch;
    const provider = providerFromCredential(credential, { ...DEFAULT_GATEWAY, baseURL: credential.baseURL, auth: 'bearer' }, dir, transport);
    const request = { model: 'model-oauth', max_tokens: 8, messages: [{ role: 'user', content: 'hi' }] } as ModelRequest;
    const message = await provider.complete(request, new AbortController().signal);
    assert.equal(message.content[0]!.type, 'text');
    assert.equal(requests[1]!.grant, 'refresh_token');
    assert.match(seen[0]!, /Bearer access-second/);
    assert.equal(readStoredCredential(dir)!.key, 'access-second');
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a provider slot fails with the sign-in message until a credential is adopted', async () => {
  let message = 'no credential yet';
  const slot = createProviderSlot(() => message);
  const request = { model: UNCONFIGURED_MODEL, max_tokens: 8, messages: [{ role: 'user', content: 'hi' }] } as ModelRequest;
  assert.equal(slot.adopted(), false);
  await assert.rejects(slot.provider.complete(request, new AbortController().signal), /no credential yet/);
  assert.equal(await slot.provider.count(request, new AbortController().signal), 0);
  message = 'changed message';
  await assert.rejects(slot.provider.complete(request, new AbortController().signal), /changed message/);

  const adopted = providerFromCredential(storedCredential(), { ...DEFAULT_GATEWAY, baseURL: 'https://api.deepseek.com/anthropic', auth: 'api-key' });
  slot.adopt(adopted);
  assert.equal(slot.adopted(), true);
  assert.equal(slot.current(), adopted);
});
