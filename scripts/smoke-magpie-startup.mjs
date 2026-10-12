import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--launcher' && path.isAbsolute(args[1])),
  'Usage: node scripts/smoke-magpie-startup.mjs [--launcher ABSOLUTE_PATH]');
const launcher = args[1] ?? path.join(root, 'scripts/launch-magpie.mjs');
const cwd = path.resolve(path.dirname(fs.realpathSync(launcher)), '..');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'litcode-startup-')));
const fixture = path.join(tmp, 'server.mjs');
const secret = 'owned-startup-fixture-credential';
const model = 'fixture/model';
const children = new Set();
const ownedPids = new Set();
const servers = new Set();
const requests = [];
const passed = [];
let serial = 0;

// Generate only an owned fixture in this run's directory; its sole file output is a PID.
fs.writeFileSync(fixture, `
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [mode, port, marker] = process.argv.slice(2);
fs.writeFileSync(marker, String(process.pid));
if (mode === 'dead-command') {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'stall', port, marker + '.descendant.pid'], { stdio: 'ignore' });
  child.once('spawn', () => setInterval(() => {
    if (fs.existsSync(marker + '.descendant.pid')) process.exit(0);
  }, 10));
} else if (mode === 'stall') {
  setInterval(() => {}, 1000);
} else {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/') {
      if (mode === 'root-stall') return;
      res.end(JSON.stringify({ name: 'magpie', version: 'fixture', apis: ['/v1/messages'] }));
    } else if (req.url === '/v1/models') {
      res.end(JSON.stringify({ data: mode === 'missing-model' ? [] : [{ id: 'fixture/model', native_endpoints: ['/v1/messages'] }] }));
    } else {
      res.writeHead(500); res.end('{}');
    }
  });
  server.listen(Number(port), '127.0.0.1');
}
`, { mode: 0o600 });

function controlledEnv(base, extra = {}) {
  return {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: tmp,
    TMPDIR: tmp,
    LANG: 'C',
    ANTHROPIC_BASE_URL: base,
    ANTHROPIC_AUTH_TOKEN: secret,
    ...extra,
  };
}

function clean(text) {
  return text.split(secret).join('[credential]');
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function waitUntil(predicate, description, timeout = 6000) {
  const deadline = Date.now() + timeout;
  do {
    if (predicate()) return;
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail(description);
}

function markerFor(name) {
  return path.join(tmp, `${++serial}-${name}.pid`);
}

function readPid(marker) {
  assert.equal(fs.existsSync(marker), true, `starter PID marker missing: ${path.basename(marker)}`);
  const value = fs.readFileSync(marker, 'utf8');
  assert.match(value, /^[1-9][0-9]*$/);
  const pid = Number(value);
  assert.equal(Number.isSafeInteger(pid), true);
  assert.notEqual(pid, process.pid);
  ownedPids.add(pid);
  return pid;
}

async function assertReaped(marker) {
  const pid = readPid(marker);
  await waitUntil(() => !alive(pid), `owned PID ${pid} survived launcher exit`, 2000);
  ownedPids.delete(pid);
  fs.rmSync(marker);
}

async function closeServer(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  servers.delete(server);
}

async function unusedBase() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  await new Promise(resolve => server.close(resolve));
  return base;
}

async function listeningGateway(identity = 'magpie', available = true) {
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/') res.end(JSON.stringify({ name: identity, version: 'fixture', apis: ['/v1/messages'] }));
    else if (req.url === '/v1/models') res.end(JSON.stringify({ data: available ? [{ id: model, native_endpoints: ['/v1/messages'] }] : [] }));
    else { res.writeHead(500); res.end('{}'); }
  });
  servers.add(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function commandArgs(base, marker, mode = 'ready') {
  return ['--start-command', JSON.stringify([process.execPath, fixture, mode, new URL(base).port, marker])];
}

function launch(base, args = [], env = controlledEnv(base)) {
  const child = spawn(process.execPath, [launcher, '--check', '--base-url', base, '--model', model, ...args], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let stdout = '', stderr = '', timedOut = false;
  const started = Date.now();
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 10000);
  const done = new Promise((resolve, reject) => {
    child.once('error', error => { clearTimeout(timer); children.delete(child); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      try {
        assert.equal((stdout + stderr).includes(secret), false, 'credential appeared in launcher output');
        assert.equal(timedOut, false, 'launcher exceeded smoke watchdog');
        resolve({ code, signal, stdout: clean(stdout), stderr: clean(stderr), elapsedMs: Date.now() - started });
      } catch (error) { reject(error); }
    });
  });
  // Keep cleanup from leaving an early rejected capture unhandled while waiting on the PID marker.
  void done.catch(() => {});
  return { child, done };
}

function checkResult(result, action, credentialPresent) {
  assert.equal(result.code, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.startupAction, action);
  assert.equal(data.modelCalls, 0);
  assert.equal(data.model, model);
  assert.equal(data.credentialPresent, credentialPresent);
}

async function discoveryGates() {
  const healthy = await listeningGateway();
  const unused = await unusedBase();
  try {
    checkResult(await launch(healthy.base).done, 'none', true);
    checkResult(await launch(healthy.base, [], controlledEnv(unused)).done, 'none', false);
    // Even localhost and 127.0.0.1 must remain separate credential origins.
    const alias = healthy.base.replace('127.0.0.1', 'localhost');
    checkResult(await launch(healthy.base, [], controlledEnv(alias)).done, 'none', false);
  } finally { await closeServer(healthy.server); }

  const defaultMarker = markerFor('default');
  const absent = await launch(unused, ['--startup-timeout-ms', '100'], controlledEnv(unused, {
    MAGPIE_START_COMMAND: JSON.stringify([process.execPath, fixture, 'ready', new URL(unused).port, defaultMarker]),
  })).done;
  assert.notEqual(absent.code, 0);
  assert.equal(fs.existsSync(defaultMarker), false, 'default launcher unexpectedly spawned a server');

  for (const [name, identity, available] of [['identity', 'other', true], ['model', 'magpie', false]]) {
    const gateway = await listeningGateway(identity, available);
    const marker = markerFor(name);
    try {
      const result = await launch(gateway.base, commandArgs(gateway.base, marker)).done;
      assert.notEqual(result.code, 0, `${name} gate unexpectedly passed`);
      assert.equal(fs.existsSync(marker), false, `${name} failure executed a starter`);
    } finally { await closeServer(gateway.server); }
  }
  assert.equal(requests.every(url => url === '/' || url === '/v1/models'), true, 'discovery invoked a model endpoint');
  passed.push('discovery-gates');
}

async function commandOwnership() {
  const base = await unusedBase();
  const marker = markerFor('cold');
  const result = await launch(base, ['--startup-timeout-ms', '3000', ...commandArgs(base, marker)]).done;
  checkResult(result, 'command', true);
  await assertReaped(marker);

  const healthy = await listeningGateway();
  const suppressed = markerFor('healthy');
  try {
    checkResult(await launch(healthy.base, commandArgs(healthy.base, suppressed)).done, 'none', true);
    assert.equal(fs.existsSync(suppressed), false, 'healthy gateway executed a starter');
  } finally { await closeServer(healthy.server); }

  const missingBase = await unusedBase();
  const missingMarker = markerFor('cold-missing-model');
  const missing = await launch(missingBase, ['--startup-timeout-ms', '3000', ...commandArgs(missingBase, missingMarker, 'missing-model')]).done;
  assert.notEqual(missing.code, 0, 'cold startup passed before selected-model readiness');
  await assertReaped(missingMarker);

  const deadBase = await unusedBase();
  const deadMarker = markerFor('dead-command');
  const descendantMarker = deadMarker + '.descendant.pid';
  const dead = await launch(deadBase, ['--startup-timeout-ms', '3000', ...commandArgs(deadBase, deadMarker, 'dead-command')]).done;
  assert.notEqual(dead.code, 0, 'exited start command passed readiness');
  await waitUntil(() => fs.existsSync(descendantMarker), 'start command never recorded its descendant');
  await assertReaped(deadMarker);
  await assertReaped(descendantMarker);
  passed.push('command-ownership');
}

async function cancellation() {
  for (const timeout of [100, 300]) {
    const base = await unusedBase();
    const marker = markerFor(`deadline-${timeout}`);
    const result = await launch(base, ['--startup-timeout-ms', String(timeout), ...commandArgs(base, marker, 'stall')]).done;
    assert.notEqual(result.code, 0, `${timeout}ms startup deadline unexpectedly passed`);
    assert.ok(result.elapsedMs < 3000, `${timeout}ms deadline exceeded startup plus cleanup bound`);
    await assertReaped(marker);
  }

  // A listening process with a hanging discovery response exercises fetch cancellation too.
  const base = await unusedBase();
  const marker = markerFor('signal');
  const running = launch(base, ['--startup-timeout-ms', '5000', ...commandArgs(base, marker, 'root-stall')]);
  await waitUntil(() => fs.existsSync(marker) && fs.statSync(marker).size > 0, 'startup child never wrote its PID marker');
  const pid = readPid(marker);
  assert.equal(alive(pid), true, 'startup child exited before SIGTERM');
  await delay(100);
  const signalled = Date.now();
  assert.equal(running.child.kill('SIGTERM'), true);
  const result = await running.done;
  assert.ok(result.code !== 0 || result.signal !== null, 'cancelled startup reported success');
  assert.ok(Date.now() - signalled < 3000, 'SIGTERM startup cancellation exceeded cleanup bound');
  await assertReaped(marker);
  passed.push('cancellation');
}

try {
  await discoveryGates();
  await commandOwnership();
  await cancellation();
  console.log(JSON.stringify({ startup: 'passed', groups: passed, coldDiscovery: true, modelReadiness: true,
    exactCredentialOrigin: true, defaultNoSpawn: true, healthyNoStarter: true, invalidIdentityNoStarter: true,
    deadlinesMs: [100, 300], signalCancellation: true, ownedChildrenReaped: true, deadCommandGroupReaped: true,
    noSecretOutput: true, modelCalls: 0 }));
} catch (error) {
  console.error(clean(error.stack ?? String(error)));
  process.exitCode = 1;
} finally {
  for (const child of children) child.kill('SIGKILL');
  await Promise.all([...children].map(child => new Promise(resolve => child.once('close', resolve))));
  // Only markers generated inside this run's directory are eligible for fallback cleanup.
  for (const entry of fs.readdirSync(tmp)) {
    if (entry.endsWith('.pid')) {
      const marker = path.join(tmp, entry);
      try { readPid(marker); } catch { /* Incomplete marker carries no process identity. */ }
    }
  }
  try {
    for (const pid of ownedPids) {
      try { if (alive(pid)) process.kill(pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await waitUntil(() => [...ownedPids].every(pid => !alive(pid)), 'fallback child cleanup timed out', 2000);
  } catch (error) {
    console.error(clean(error.stack ?? String(error)));
    process.exitCode = 1;
  } finally {
    try {
      await Promise.all([...servers].map(closeServer));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
