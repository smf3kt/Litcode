import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--launcher' && path.isAbsolute(args[1])),
  'Usage: node scripts/smoke-magpie-launcher.mjs [--launcher ABSOLUTE_PATH]');
const launcher = args[1] ?? path.join(root, 'scripts/launch-magpie.mjs');
const cwd = path.resolve(path.dirname(fs.realpathSync(launcher)), '..');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-launcher-')));
const requests = [];
let invalid = false;
const server = http.createServer((req, res) => {
  requests.push(req.url); res.setHeader('Content-Type', 'application/json');
  if (req.url === '/') res.end(JSON.stringify({ name: invalid ? 'other' : 'magpie', version: 'fixture', apis: ['/v1/messages'] }));
  else if (req.url === '/v1/models') res.end(JSON.stringify({ data: [{ id: 'fixture/model', native_endpoints: ['/v1/messages'] }] }));
  else { res.writeHead(500); res.end('{}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LLM_') && !key.startsWith('ANTHROPIC_')));
// Keep discovery hermetic: no real client settings or Magpie wiring may leak into the checks.
env.HOME = tmp; env.XDG_CONFIG_HOME = path.join(tmp, '.config');
env.ANTHROPIC_AUTH_TOKEN = 'owned-launcher-fixture'; env.ANTHROPIC_BASE_URL = base;
async function run(args) {
  const child = spawn(process.execPath, [launcher, ...args], { cwd, env });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
  const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearTimeout(timer); assert.equal((stdout + stderr).includes(env.ANTHROPIC_AUTH_TOKEN), false);
  return { code, stdout, stderr };
}
try {
  const check = await run(['--check', '--base-url', base, '--model', 'fixture/model']);
  assert.equal(check.code, 0); assert.equal(JSON.parse(check.stdout).credentialPresent, true);
  const demo = await run(['--base-url', base, '--model', 'fixture/model', '--', '--demo']);
  assert.equal(demo.code, 0, demo.stderr); assert.match(demo.stdout, /Offline demo passed/);
  const demoPath = /^workspace: (.+)$/m.exec(demo.stderr)?.[1]; assert.ok(demoPath);
  const id = '11111111-1111-4111-8111-111111111111';
  fs.mkdirSync(path.join(tmp, '.agent'));
  fs.writeFileSync(path.join(tmp, '.agent', `${id}.jsonl`), JSON.stringify({ kind: 'metadata', config: { model: 'fixture/model', gateway: { baseURL: base } } }) + '\n');
  const pinned = await run(['--check', '--model', 'wrong/model', '--', '--workspace', tmp, '--resume', id]);
  assert.equal(pinned.code, 0); assert.equal(JSON.parse(pinned.stdout).resumePinned, true);
  assert.equal(JSON.parse(pinned.stdout).model, 'fixture/model');
  env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1';
  const equalPinned = await run(['--check', '--model', 'wrong/model', '--', `--workspace=${tmp}`, `--resume=${id}`]);
  assert.equal(equalPinned.code, 0); assert.equal(JSON.parse(equalPinned.stdout).model, 'fixture/model');
  const malformedId = await run(['--check', '--base-url', base, '--model', 'fixture/model', '--', '--resume', '11111111-1111-4111-8111-xxxxxxxxxxxx']);
  assert.notEqual(malformedId.code, 0); assert.match(malformedId.stderr, /UUID/);
  const linked = path.join(tmp, 'linked'); fs.mkdirSync(linked);
  fs.symlinkSync(path.join(tmp, '.agent'), path.join(linked, '.agent'));
  const linkResume = await run(['--check', '--', '--workspace', linked, '--resume', id]);
  assert.notEqual(linkResume.code, 0); assert.match(linkResume.stderr, /real directory/);
  const duplicate = await run(['--check', '--base-url', base, '--model', 'fixture/model', '--', '--workspace', tmp, '--resume', id, `--resume=${id}`]);
  assert.notEqual(duplicate.code, 0); assert.match(duplicate.stderr, /duplicate/);
  const offOrigin = await run(['--check', '--base-url', 'https://example.test', '--model', 'fixture/model']);
  assert.notEqual(offOrigin.code, 0); assert.match(offOrigin.stderr, /loopback/);
  const absent = await run(['--check', '--base-url', base, '--model', 'fixture/model']);
  assert.equal(JSON.parse(absent.stdout).credentialPresent, false);
  env.MAGPIE_ADDR = `127.0.0.1:${server.address().port}`;
  const configured = await run(['--check', '--model', 'fixture/model']);
  assert.equal(configured.code, 0, configured.stderr);
  assert.equal(JSON.parse(configured.stdout).baseURL, base);
  assert.equal(JSON.parse(configured.stdout).baseSource, 'MAGPIE_ADDR');
  delete env.MAGPIE_ADDR;
  const wiredHome = path.join(tmp, 'wired-home');
  fs.mkdirSync(path.join(wiredHome, '.config', 'magpie'), { recursive: true });
  fs.writeFileSync(path.join(wiredHome, '.config', 'magpie', 'stash.json'),
    JSON.stringify({ 'claude.wired_at': base, 'other.wired_at': 'http://127.0.0.1:1' }));
  env.HOME = wiredHome;
  const wired = await run(['--check', '--model', 'fixture/model']);
  assert.equal(wired.code, 0, wired.stderr);
  assert.equal(JSON.parse(wired.stdout).baseURL, base);
  assert.equal(JSON.parse(wired.stdout).baseSource, 'magpie-wiring');
  env.HOME = tmp;
  env.LLM_API_KEY = 'sk-magpie-revoked-smoke-key';
  env.ANTHROPIC_BASE_URL = base;
  const rotated = await run(['--check', '--base-url', base, '--model', 'fixture/model']);
  assert.equal(rotated.code, 0, rotated.stderr);
  assert.equal(JSON.parse(rotated.stdout).credentialPresent, true);
  assert.equal(JSON.parse(rotated.stdout).credentialSource, 'ANTHROPIC_AUTH_TOKEN');
  env.ANTHROPIC_AUTH_TOKEN = 'sk-magpie-revoked-smoke-token';
  const allRevoked = await run(['--check', '--base-url', base, '--model', 'fixture/model']);
  assert.notEqual(allRevoked.code, 0);
  assert.match(allRevoked.stderr, /Revoked caller key/);
  assert.equal((allRevoked.stdout + allRevoked.stderr).includes('sk-magpie-revoked-smoke'), false);
  delete env.LLM_API_KEY; env.ANTHROPIC_AUTH_TOKEN = 'owned-launcher-fixture';
  const missing = await run(['--check', '--base-url', base, '--model', 'missing']);
  assert.notEqual(missing.code, 0); assert.match(missing.stderr, /absent/);
  invalid = true;
  const other = await run(['--check', '--base-url', base, '--model', 'fixture/model']);
  assert.notEqual(other.code, 0); assert.match(other.stderr, /advertise/);
  assert.equal(requests.every(p => p === '/' || p === '/v1/models'), true);
  fs.rmSync(demoPath, { recursive: true, force: true });
  console.log(JSON.stringify({ launcher: 'passed', discovery: true, modelValidation: true, pinnedResume: true,
    exactCredentialOrigin: true, compiledDemo: true, noSecretOutput: true, modelCalls: 0 }));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(tmp, { recursive: true, force: true }); }
