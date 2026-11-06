import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const project = path.resolve(import.meta.dirname, '..');
const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : project, 'plan-relocation-cli-')));
const parent = path.join(root, 'parent'), child = path.join(root, 'child'), user = path.join(child, '.local');
fs.mkdirSync(parent); fs.mkdirSync(child); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ prefersReducedMotion: true, promptSuggestionEnabled: false, plansDirectory: 'owned-plans' }));
const screen = new TerminalScreen(120, 38);
let server, processChild, failure, closed = true, stderr = '', count = 0, plan, sibling;
const requests = [];
function send(res, block) {
  const tool = block.type === 'tool_use';
  const events = [
    { type: 'message_start', message: { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: tool ? { ...block, input: {} } : { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: tool ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
const tool = (id, name, input = {}) => ({ type: 'tool_use', id, name, input });
try {
  server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body); count++;
      const result = body.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).findLast(b => b.type === 'tool_result');
      if (count === 1) return send(res, tool('enter-plan', 'enter_plan_mode'));
      if (count === 2) {
        assert.equal(result?.is_error ?? false, false);
        const system = typeof body.system === 'string' ? body.system : body.system.map(b => b.text).join('\n');
        const match = /^Plan file: (".*")$/m.exec(system); assert.ok(match);
        plan = JSON.parse(match[1]); assert.equal(path.dirname(plan), path.join(child, 'owned-plans'));
        return send(res, tool('relative-plan', 'write_file', { path: path.relative(child, plan), content: '# PLAN FIXTURE\n' }));
      }
      if (count === 3) {
        assert.equal(result?.is_error ?? false, false);
        assert.equal(fs.readFileSync(plan, 'utf8'), '# PLAN FIXTURE\n');
        return send(res, tool('absolute-plan', 'write_file', { path: plan, content: '# ABSOLUTE FIXTURE\n', overwrite: true }));
      }
      if (count === 4) {
        assert.equal(result?.is_error ?? false, false);
        assert.equal(fs.readFileSync(plan, 'utf8'), '# ABSOLUTE FIXTURE\n');
        return send(res, tool('read-relative-plan', 'read_file', { path: path.relative(child, plan) }));
      }
      if (count === 5) {
        assert.equal(result?.is_error ?? false, false);
        assert.match(JSON.stringify(result?.content), /ABSOLUTE FIXTURE/);
        sibling = plan.slice(0, -3) + '-agent-cli.md';
        return send(res, tool('sibling-plan', 'write_file', { path: sibling, content: '# SIBLING FIXTURE\n' }));
      }
      if (count === 6) {
        assert.equal(result?.is_error ?? false, false);
        assert.equal(fs.readFileSync(sibling, 'utf8'), '# SIBLING FIXTURE\n');
        return send(res, tool('sibling-read', 'read_file', { path: path.relative(child, sibling) }));
      }
      if (count === 7) {
        assert.equal(result?.is_error ?? false, false);
        assert.match(JSON.stringify(result?.content), /SIBLING FIXTURE/);
        return send(res, { type: 'text', text: 'PLAN_FIXTURE_DONE' });
      }
      throw new Error(`Unexpected request ${count}`);
    } catch (error) { failure = error; send(res, { type: 'text', text: 'PLAN_FIXTURE_FAILED' }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, HOME: root, TERM: 'xterm-256color', HARNESS_LOOP_KEEPALIVE: 'off' };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: 'owned-plan', LLM_MODEL: 'fixture', LLM_AUTH: 'bearer',
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
  closed = false;
  processChild = spawn('/usr/bin/expect', [path.join(project, 'scripts/pty-cli.exp'), process.execPath,
    path.join(project, 'bin/litcode.mjs'), '--workspace', parent, '--user-dir', user,
    '--no-inherit-gateway', '--interactive', '--no-tui'], { cwd: project, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  processChild.stdout.setEncoding('utf8'); processChild.stdout.on('data', text => screen.write(text));
  processChild.stderr.on('data', text => { stderr += text; });
  const exited = new Promise((resolve, reject) => { processChild.once('error', reject); processChild.once('close', code => { closed = true; resolve(code); }); });
  const frame = () => screen.lines().join('\n');
  const until = async (predicate, label) => {
    const deadline = Date.now() + 15000;
    while (!predicate()) { if (failure) throw failure; assert.equal(closed, false, stderr); assert.ok(Date.now() < deadline, `${label}\n${frame()}\n${stderr}`); await delay(20); }
    if (failure) throw failure;
  };
  await until(() => frame().includes('>'), 'startup');
  processChild.stdin.write(`/cwd ${child}\r`);
  await until(() => fs.existsSync(path.join(child, '.agent')) && fs.readdirSync(path.join(child, '.agent')).some(name => name.endsWith('.jsonl.lock')), 'relocation');
  processChild.stdin.write('PLAN_FIXTURE\r');
  await until(() => count === 7 && frame().includes('PLAN_FIXTURE_DONE'), 'plan result');
  processChild.stdin.write('/exit\r');
  const exit = await Promise.race([exited, delay(5000).then(() => { throw new Error('CLI exit timed out'); })]);
  assert.equal(exit, 0);
  assert.equal(count, 7);
  assert.equal(fs.readdirSync(path.join(child, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ actualCli: true, requests: count, relativeWrote: true, absoluteOverwrote: true, relativeRead: true, siblingWroteAndRead: true, exit }));
} finally {
  if (processChild && !closed) { try { process.kill(-processChild.pid, 'SIGKILL'); } catch {} await new Promise(resolve => processChild.once('close', resolve)); }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  screen.close(); fs.rmSync(root, { recursive: true, force: true });
}
