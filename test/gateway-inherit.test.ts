import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  CLIENT_GATEWAY_VARIABLES,
  GATEWAY_INHERIT_LIMITS,
  clientGatewayDirectory,
  resolveInheritedGateway,
  sameGateway,
} from '../src/gateway-inherit.js';

function clientDir(settings: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-inherit-'));
  if (settings !== undefined) {
    fs.writeFileSync(path.join(dir, 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings));
  }
  return dir;
}
function fieldSources(inherited: ReturnType<typeof resolveInheritedGateway>): Record<string, string> {
  return Object.fromEntries((inherited?.sources ?? []).map(entry => [entry.field, entry.source]));
}

test('a client settings file supplies the gateway, the credential and the model', () => {
  const dir = clientDir({
    env: {
      ANTHROPIC_BASE_URL: 'https://gateway.example.test',
      ANTHROPIC_AUTH_TOKEN: 'fixture-token-value',
      ANTHROPIC_MODEL: 'example-model',
    },
  });
  const inherited = resolveInheritedGateway({ enabled: true, env: {}, directory: dir });
  assert.equal(inherited?.baseURL, 'https://gateway.example.test');
  assert.equal(inherited?.model, 'example-model');
  assert.deepEqual(inherited?.credential, {
    value: 'fixture-token-value', auth: 'bearer', variable: CLIENT_GATEWAY_VARIABLES.authToken,
  });
  // The notice names the file and the variable, which is all a report may carry.
  const sources = fieldSources(inherited);
  assert.match(sources.credential!, /ANTHROPIC_AUTH_TOKEN in .*settings\.json$/);
  assert.match(sources.baseURL!, /ANTHROPIC_BASE_URL in .*settings\.json$/);
  assert.equal(inherited?.directory, dir);
});

test('the key variable is an api-key credential unless the token variable is also set', () => {
  const keyOnly = resolveInheritedGateway({ enabled: true, env: { ANTHROPIC_API_KEY: 'fixture-key' }, directory: clientDir(undefined) });
  assert.equal(keyOnly?.credential?.auth, 'api-key');
  assert.equal(keyOnly?.credential?.variable, CLIENT_GATEWAY_VARIABLES.apiKey);

  const both = resolveInheritedGateway({ enabled: true, env: {
    ANTHROPIC_API_KEY: 'fixture-key', ANTHROPIC_AUTH_TOKEN: 'fixture-token',
  }, directory: clientDir(undefined) });
  assert.equal(both?.credential?.auth, 'bearer');
  assert.equal(both?.credential?.value, 'fixture-token');
});

test('the file answers first and the process environment fills the gaps', () => {
  const dir = clientDir({ env: { ANTHROPIC_BASE_URL: 'https://from-file.example.test', ANTHROPIC_AUTH_TOKEN: 'from-file' } });
  const inherited = resolveInheritedGateway({ enabled: true, env: {
    ANTHROPIC_BASE_URL: 'https://from-environment.example.test',
    ANTHROPIC_AUTH_TOKEN: 'from-environment',
    ANTHROPIC_MODEL: 'environment-model',
  }, directory: dir });
  assert.equal(inherited?.baseURL, 'https://from-file.example.test');
  assert.equal(inherited?.credential?.value, 'from-file');
  assert.equal(inherited?.model, 'environment-model');
  assert.equal(fieldSources(inherited).model, CLIENT_GATEWAY_VARIABLES.model);
});

test("a client's own top-level model is read when its environment does not name one", () => {
  const dir = clientDir({ model: 'selected-model', env: {} });
  const inherited = resolveInheritedGateway({ enabled: true, env: {}, directory: dir });
  assert.equal(inherited?.model, 'selected-model');
  assert.match(fieldSources(inherited).model!, /^model in .*settings\.json$/);
});

test('a disabled or empty source yields nothing at all', () => {
  const dir = clientDir({ env: { ANTHROPIC_AUTH_TOKEN: 'fixture-token' } });
  assert.equal(resolveInheritedGateway({ enabled: false, env: { ANTHROPIC_AUTH_TOKEN: 'x' }, directory: dir }), undefined);
  assert.equal(resolveInheritedGateway({ enabled: true, env: {}, directory: clientDir(undefined) }), undefined);
  assert.equal(resolveInheritedGateway({ enabled: true, env: {}, directory: clientDir({ env: {} }) }), undefined);
});

test('a settings file that cannot be trusted is ignored rather than fatal', () => {
  const cases = [
    clientDir('{ not json'),
    clientDir([{ env: { ANTHROPIC_AUTH_TOKEN: 'x' } }]),
    clientDir('"a string"'),
    clientDir({ env: 'not an object' }),
    clientDir({ env: { ANTHROPIC_AUTH_TOKEN: 42 } }),
    clientDir({ env: { ANTHROPIC_AUTH_TOKEN: '   ' } }),
    clientDir({ env: { ANTHROPIC_AUTH_TOKEN: 'has\u0000control' } }),
    clientDir({ env: { ANTHROPIC_BASE_URL: 'ftp://gateway.example.test' } }),
    clientDir({ env: { ANTHROPIC_BASE_URL: 'not a url' } }),
    clientDir({ env: { ANTHROPIC_AUTH_TOKEN: 'x'.repeat(GATEWAY_INHERIT_LIMITS.credentialChars + 1) } }),
    path.join(clientDir(undefined), 'no-such-directory'),
  ];
  for (const dir of cases) {
    assert.equal(resolveInheritedGateway({ enabled: true, env: {}, directory: dir }), undefined, dir);
  }
  // A directory where the file should be is not a settings file either.
  const asDirectory = clientDir(undefined);
  fs.mkdirSync(path.join(asDirectory, 'settings.json'));
  assert.equal(resolveInheritedGateway({ enabled: true, env: {}, directory: asDirectory }), undefined);
});

test('an oversized settings file is not read', () => {
  const dir = clientDir(undefined);
  const filler = 'x'.repeat(GATEWAY_INHERIT_LIMITS.fileBytes);
  fs.writeFileSync(path.join(dir, 'settings.json'), `{"env":{"ANTHROPIC_AUTH_TOKEN":"${filler}"}}`);
  assert.equal(resolveInheritedGateway({ enabled: true, env: {}, directory: dir }), undefined);
});

test('the directory search follows this harness, then the client, then the home default', () => {
  const env = { LLM_INHERIT_DIR: '/tmp/explicit', CLAUDE_CONFIG_DIR: '/tmp/client' } as NodeJS.ProcessEnv;
  assert.equal(clientGatewayDirectory(env, '/home/person'), '/tmp/explicit');
  assert.equal(clientGatewayDirectory({ CLAUDE_CONFIG_DIR: '/tmp/client' } as NodeJS.ProcessEnv, '/home/person'), '/tmp/client');
  assert.equal(clientGatewayDirectory({} as NodeJS.ProcessEnv, '/home/person'), '/home/person/.claude');
  assert.equal(clientGatewayDirectory({ LLM_INHERIT_DIR: '  ' } as NodeJS.ProcessEnv, '/home/person'), '/home/person/.claude');
});

test('only the endpoint a credential was configured for compares equal', () => {
  assert.equal(sameGateway('http://127.0.0.1:3425', 'http://127.0.0.1:3425/'), true);
  assert.equal(sameGateway('https://Gateway.Example.Test', 'https://gateway.example.test/'), true);
  assert.equal(sameGateway('https://gateway.example.test', 'https://gateway.example.test/other'), false);
  assert.equal(sameGateway('http://127.0.0.1:3425', 'http://127.0.0.1:3426'), false);
  assert.equal(sameGateway('file:///tmp/socket', 'file:///tmp/socket'), false);
  assert.equal(sameGateway('not a url', 'not a url'), false);
  assert.equal(sameGateway('https://gateway.example.test', 'http://gateway.example.test'), false);
});

test('a resolved credential is a copy of the file contents, not the document itself', () => {
  const dir = clientDir({ env: { ANTHROPIC_AUTH_TOKEN: 'fixture-token', ANTHROPIC_BASE_URL: 'https://gateway.example.test' } });
  const first = resolveInheritedGateway({ enabled: true, env: {}, directory: dir });
  const second = resolveInheritedGateway({ enabled: true, env: {}, directory: dir });
  assert.deepEqual(first, second);
  assert.notEqual(first?.sources, second?.sources);
});

test('the home default is only consulted when no directory was chosen', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'fixture-token', ANTHROPIC_BASE_URL: 'https://gateway.example.test' } }));
  const inherited = resolveInheritedGateway({ enabled: true, env: {}, home });
  assert.equal(inherited?.baseURL, 'https://gateway.example.test');
  assert.equal(inherited?.directory, path.join(home, '.claude'));
});
