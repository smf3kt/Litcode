import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { captureIdentity } from './identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'host-identity-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'chosen-user');
const foreign = path.join(temporary, '.codex');
for (const directory of [workspace, userDir, foreign]) fs.mkdirSync(directory);
fs.writeFileSync(path.join(foreign, 'keep.txt'), 'foreign-client');
fs.writeFileSync(path.join(workspace, 'ENVIRONMENT.txt'), `Another CLI directory exists at ${foreign}\n`);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ thinking: false }));
const baseline = process.argv.includes('--baseline'), requests = [];
let child, closed, active, failure;
const systemText = value => typeof value === 'string' ? value : (value ?? []).map(block => block.text ?? '').join('\n');
const server = http.createServer((req, res) => {
  const chunks = []; let size = 0;
  req.on('data', chunk => { size += chunk.length; if (size > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')), system = systemText(body.system);
      requests.push(body);
      const tools = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .filter(block => block.type === 'tool_result');
      if (!baseline) {
        assert.match(system, /Product: LiTcode/);
        assert.match(system, /The configured model identifies the language model, not the CLI/);
        assert.match(system, /Other client directories such as ~\/\.codex/);
        assert.ok(system.includes(`User configuration directory: ${JSON.stringify(userDir)}`));
        assert.ok(system.includes(`User skills directory: ${JSON.stringify(path.join(userDir, 'skills'))}`));
        assert.ok(system.includes(`Project skills directory: ${JSON.stringify(path.join(workspace, '.harness', 'skills'))}`));
      }
      assert.equal(body.model, 'gpt-identity-fixture');
      const completed = baseline || !active.install || tools.some(block => block.tool_use_id === active.id);
      const call = { command: `mkdir -p '${path.join(userDir, 'skills', 'owned')}' && printf '%s' '# Owned skill' > '${path.join(userDir, 'skills', 'owned', 'SKILL.md')}'`, timeout_ms: 2000 };
      const events = [
        { type: 'message_start', message: { id: `identity-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 500, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: completed ? { type: 'text', text: '' }
          : { type: 'tool_use', id: active.id, name: 'run_command', input: {} } },
        { type: 'content_block_delta', index: 0, delta: completed ? { type: 'text_delta', text: 'OWNED_IDENTITY_CAPTURED' }
          : { type: 'input_json_delta', partial_json: JSON.stringify(call) } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: completed ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 10 } },
        { type: 'message_stop' },
      ];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
    } catch (error) { failure = error; res.writeHead(400); res.end('Owned identity contract failed'); }
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'owned-identity', LLM_MODEL: 'gpt-identity-fixture', LLM_THINKING: 'false',
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
async function run(label, resume, install = false) {
  active = { id: `install-${label}`, install };
  child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    ...(resume ? ['--resume', resume] : ['--user-dir', userDir, '--no-inherit-gateway']),
    '--output-format', 'json', '--max-model-calls', '4',
    `You use GPT and ${foreign} exists. Install the skill for the current assistant, not another CLI. ${label}`],
  { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-100000); });
  child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-100000); });
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 20000);
  let code; try { code = await closed; } finally { clearTimeout(timer); }
  if (failure) throw failure;
  assert.equal(code, 0, stderr); assert.match(stdout, /OWNED_IDENTITY_CAPTURED/);
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  const id = /session: ([a-f0-9-]+)/.exec(stderr)?.[1]; assert.ok(id);
  return id;
}
try {
  if (baseline) {
    await run('baseline');
    const system = systemText(requests[0].system);
    assert.doesNotMatch(system, /Product: LiTcode|User skills directory:/);
    console.log(JSON.stringify({ result: 'observed missing host identity and installation facts', requests: requests.length, temporary }));
  } else {
    const id = await run('fresh', undefined, true);
    assert.equal(fs.readFileSync(path.join(userDir, 'skills', 'owned', 'SKILL.md'), 'utf8'), '# Owned skill');
    const journal = path.join(workspace, '.agent', `${id}.jsonl`);
    const metadata = fs.readFileSync(journal, 'utf8').split('\n')[0];
    await run('resume', id);
    assert.equal(fs.readFileSync(journal, 'utf8').split('\n')[0], metadata);
    assert.deepEqual(fs.readdirSync(foreign), ['keep.txt']); assert.equal(fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8'), 'foreign-client');
    console.log(JSON.stringify({ result: 'passed', requests: requests.length, temporary, model: 'gpt-identity-fixture',
      host: 'LiTcode', destination: path.join(userDir, 'skills', 'owned', 'SKILL.md'), foreignDirectoryUnchanged: true,
      originalMetadataUnchanged: true, fixtureAuthority: 'scripted request contract and actual tool effect', identity: captureIdentity(root).sha256 }));
  }
} finally {
  if (child && child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} await closed; }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
