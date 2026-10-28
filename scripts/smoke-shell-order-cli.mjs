import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { captureIdentity } from './identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'shell-order-cli-')));
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
      { type: 'content_block_delta', index: 0, delta: result ? { type: 'text_delta', text: 'OWNED_ORDER_DONE' }
        : { type: 'input_json_delta', partial_json: JSON.stringify({ command: active.command, timeout_ms: 2000 }) } },
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
Object.assign(env, { LLM_API_KEY: 'owned-shell-order', LLM_MODEL: 'fixture-order', LLM_THINKING: 'false',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });

async function run(label, command, flags, settings = {}) {
  const workspace = path.join(temporary, label), userDir = path.join(temporary, `${label}-user`);
  fs.mkdirSync(workspace, { recursive: true }); fs.mkdirSync(userDir);
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ thinking: false, ...settings }));
  active = { label, command, callId: `order-${label}`, result: undefined };
  const target = active, before = requests.length;
  child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--no-inherit-gateway', '--output-format', 'json', '--max-model-calls', '4', ...flags, label],
  { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-100000); });
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-100000); });
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 20000);
  let code;
  try { code = await closed; } finally { clearTimeout(timer); }
  assert.equal(code, 0, stderr);
  assert.match(stdout, /OWNED_ORDER_DONE/);
  assert.ok(requests.length - before >= 2, 'tool call and paired-result continuation');
  assert.ok(target.result);
  const id = /session: ([a-f0-9-]+)/.exec(stderr)?.[1]; assert.ok(id);
  const journal = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  return { workspace, id, config: journal[0].config, result: target.result, marker: path.join(workspace, 'order.txt') };
}

function refused(result, reason, marker = result.marker) {
  assert.equal(result.result.is_error, true);
  assert.match(String(result.result.content), reason);
  assert.equal(fs.existsSync(marker), false, 'the command must not run');
}

try {
  // An exact allow on the quoted line; the de-quoted alternate reading asks.
  const alternate = await run('alternate', 'printf "shell-order" > order.txt',
    ['--permission-mode', 'ask', '--allow-tool', 'run_command(printf "shell-order" > order.txt)']);
  assert.equal(alternate.config.permissions.mode, 'ask');
  if (baseline) {
    refused(alternate, /Alternate command reading requires approval: printf shell-order > order\.txt/);
    checks.push('baseline: the alternate ask keeps its own reason on a complete set');
  } else {
    refused(alternate, /Alternate command reading requires approval: printf shell-order > order\.txt/);
    checks.push('an alternate reading ask keeps its own reason on a complete set');
  }
  // In auto mode the primary hold is a plain ask with no floor, so an
  // alternate ask outranks it; the recovered entry turns every passthrough
  // back into an ask, so the command never runs.
  const held = await run('auto', 'printf "auto-order" > auto.txt',
    ['--permission-mode', 'auto', '--allow-tool', 'run_command(printf "auto-order" > auto.txt)']);
  assert.equal(held.config.permissions.mode, 'auto');
  if (baseline) {
    assert.equal(held.result.is_error ?? false, false);
    assert.equal(fs.readFileSync(path.join(held.workspace, 'auto.txt'), 'utf8'), 'auto-order');
    checks.push('baseline: the alternate soft ask is downgraded to a passthrough and the command runs');
  } else {
    // The alternate ask wins with no floor, so auto mode holds it for the
    // classifier; the owned fixture returns no verdict and the command never
    // runs.
    refused(held, /Classifier returned no policy verdict/, path.join(held.workspace, 'auto.txt'));
    checks.push('an alternate ask outranks the auto-mode hold and the command never runs');
  }
  console.log(JSON.stringify({ result: 'passed', baseline, checks, requests: requests.length, temporary,
    identity: captureIdentity(root).sha256 }));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {} await closed;
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
