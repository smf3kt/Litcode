import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w270-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  plugins: { enabled: true } }));
// Two inert local plugin packages, installed through the same store the CLI reads.
const { createPluginTools } = await import('../dist/plugins.js');
const installTool = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
const toolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
for (const [name, version] of [['zeta', '2.0.0'], ['alpha', '1.0.0']]) {
  const source = path.join(temporary, `${name}-source`);
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name, version, description: `${name} fixture` }));
  await installTool.execute({ directory: source }, toolContext);
}
const checks = [], captures = {};
let active;

const server = http.createServer((_request, response) => { response.writeHead(500); response.end(); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  HOME: temporary, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(110, 40);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const ready = () => screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');

  // Both packages are in the store before start, so the panel lists them.
  send('/plugin\r');
  await until(() => screen().includes('Installed plugins:'), 'plugin panel');
  captures.panel = screen();
  pass('/plugin opens the Installed list');
  pass('the panel title reads Plugins', screen().includes('Plugins'));
  pass('the rows are sorted and carry version, scope and state',
    screen().includes('alpha (v1.0.0, project)') && screen().includes('zeta (v2.0.0, project)') &&
    screen().includes('enabled'));
  pass('the hint line names the filter key', screen().includes('f filter enabled'));
  send('\x1b');
  await until(ready, 'panel closed');
  pass('Escape closes the panel');

  send('/plugins\r');
  await until(() => screen().includes('Installed plugins:'), 'alias panel');
  captures.alias = screen();
  pass('/plugins reaches the same panel');
  send('\x1b');
  await until(ready, 'alias closed');

  send('/marketplace\r');
  await until(() => screen().includes('Installed plugins:'), 'marketplace panel');
  pass('/marketplace reaches the same panel');
  send('\x1b');
  await until(ready, 'marketplace closed');

  send('/plugin install foo\r');
  await until(() => screen().includes('error: Use'), 'refused arm');
  captures.refused = screen();
  pass('an unknown arm is refused with the list usage');
  await until(ready, 'refusal settled');

  send('/quit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/quit exits the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    ok: checks.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
