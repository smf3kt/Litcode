import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { captureIdentity } from './identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'default-shell-cli-')));
const baseline = process.argv.includes('--baseline');
const checks = [], requests = [];
let active, child, closed;
const server = http.createServer((req, res) => {
  const chunks = []; let bytes = 0;
  req.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push({ label: active.label, body });
    const result = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
      .find(block => block.type === 'tool_result' && block.tool_use_id === active.callId);
    if (result) active.result = result;
    const events = [
      { type: 'message_start', message: { id: `owned-${requests.length}`, type: 'message', role: 'assistant',
        model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: result ? { type: 'text', text: '' }
        : { type: 'tool_use', id: active.callId, name: 'run_command', input: {} } },
      { type: 'content_block_delta', index: 0, delta: result ? { type: 'text_delta', text: 'OWNED_SHELL_DONE' }
        : { type: 'input_json_delta', partial_json: JSON.stringify({ command: 'printf shell-default > shell.txt', timeout_ms: 2000 }) } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: result ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 10 } },
      { type: 'message_stop' },
    ];
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'owned-shell-default', LLM_MODEL: 'fixture-shell', LLM_THINKING: 'false',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });

async function run(label, options = {}) {
  const workspace = options.workspace ?? path.join(temporary, label), userDir = path.join(temporary, `${label}-user`);
  fs.mkdirSync(workspace, { recursive: true }); fs.mkdirSync(userDir);
  const settings = { thinking: false, ...(options.settings ?? {}) };
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify(settings));
  const flags = options.flags ?? [];
  if (options.managed) {
    const file = path.join(temporary, `${label}-managed.json`);
    fs.writeFileSync(file, JSON.stringify(options.managed)); flags.push('--managed-settings', file);
  }
  active = { label, callId: `shell-${label}`, result: undefined };
  const target = active, before = requests.length;
  child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    ...(options.resume ? ['--resume', options.resume] : ['--user-dir', userDir, '--no-inherit-gateway']),
    '--output-format', 'json', '--max-model-calls', '4', ...flags, label],
  { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-100000); });
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-100000); });
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 20000);
  let code;
  try { code = await closed; } finally { clearTimeout(timer); }
  assert.equal(code, 0, stderr);
  assert.match(stdout, /OWNED_SHELL_DONE/);
  assert.equal(requests.length - before, 2, 'exact tool call and paired-result continuation');
  assert.ok(target.result);
  const id = /session: ([a-f0-9-]+)/.exec(stderr)?.[1]; assert.ok(id);
  const directory = path.join(workspace, '.agent');
  const journal = fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(fs.readdirSync(directory).some(name => name.endsWith('.lock')), false);
  return { workspace, userDir, id, config: journal[0].config, result: target.result, marker: path.join(workspace, 'shell.txt') };
}
function denied(result, label) {
  assert.equal(result.result.is_error, true, label);
  assert.equal(fs.existsSync(result.marker), false, label);
  checks.push(label);
}
try {
  const first = await run('default');
  assert.equal(first.config.permissions.mode, 'bypass');
  if (baseline) {
    assert.equal(first.config.allowShell, false);
    denied(first, 'default bypass still blocks Shell');
    assert.match(String(first.result.content), /allowShell is false/);
  } else {
    assert.equal(first.config.allowShell, true);
    assert.equal(first.result.is_error ?? false, false);
    assert.equal(fs.readFileSync(first.marker, 'utf8'), 'shell-default');
    checks.push('default bypass executes real Shell without an enable flag');
    const disabled = await run('disabled', { settings: { allowShell: false } });
    assert.equal(disabled.config.allowShell, false); denied(disabled, 'authored false blocks Shell');
    const flagged = await run('flagged', { settings: { allowShell: false }, flags: ['--allow-shell'] });
    assert.equal(flagged.config.allowShell, true); assert.equal(flagged.result.is_error ?? false, false);
    assert.equal(fs.readFileSync(flagged.marker, 'utf8'), 'shell-default');
    checks.push('explicit enable overrides authored false');
    const managed = await run('managed', { settings: { allowShell: true }, flags: ['--allow-shell'], managed: { allowShell: false } });
    assert.equal(managed.config.allowShell, false); denied(managed, 'managed false overrides explicit enable');
    const plan = await run('plan', { flags: ['--permission-mode', 'plan'] });
    assert.equal(plan.config.allowShell, true); denied(plan, 'explicit plan still blocks mutating Shell');
    fs.writeFileSync(path.join(disabled.userDir, 'settings.json'), JSON.stringify({ thinking: false, allowShell: true }));
    const resumed = await run('resumed', { workspace: disabled.workspace, resume: disabled.id });
    assert.equal(resumed.config.allowShell, false); denied(resumed, 'original resume retains pinned false');
  }
  console.log(JSON.stringify({ result: 'passed', baseline, checks, requests: requests.length, temporary,
    identity: captureIdentity(root).sha256 }));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {} await closed;
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
