import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-transcript-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-parent', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_TRANSCRIPT_FILE');
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const requests = [], held = new Map();
const screen = new TerminalScreen(120, 40);
let child, exited, server;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().includes('Prompt') && !frame().split('\n').includes('Background');
const until = async (check, label, timeout = 7000) => {
  const end = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, label); await delay(30); }
};
function respond(res, body, block, index) {
  const events = [
    { type: 'message_start', message: { id: `transcript-${index}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} } },
    { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
      : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length, latest = body.messages.at(-1)?.content;
      if (body.model === 'fixture-child') {
        const name = body.messages.some(message => message.content === 'AGENT_VIEW_SECOND') ? 'second' : 'first';
        if (typeof latest === 'string' && latest === 'CHILD_FOLLOWUP_QUEUED')
          respond(res, body, { type: 'text', text: 'CHILD_FOLLOWUP_COMPLETE' }, index);
        else if (typeof latest === 'string') respond(res, body,
          { type: 'tool_use', id: `read-${name}`, name: 'read_file', input: { path: 'fixture.txt' } }, index);
        else {
          assert.match(JSON.stringify(latest), /OWNED_TRANSCRIPT_FILE/);
          const event = value => res.write(`event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`);
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          event({ type: 'message_start', message: { id: `transcript-${index}`, type: 'message', role: 'assistant', model: body.model,
            content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } });
          event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
          held.set(name, { finish() {
            event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `CHILD_${name.toUpperCase()}_COMPLETE` } });
            event({ type: 'content_block_stop', index: 0 });
            event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 25 } });
            event({ type: 'message_stop' }); res.end();
          } });
        }
      } else if (typeof latest === 'string' && latest.startsWith('launch view ')) {
        const second = latest.includes('second');
        respond(res, body, { type: 'tool_use', id: `launch-${index}`, name: 'agent', input: {
          prompt: second ? 'AGENT_VIEW_SECOND' : 'AGENT_VIEW_FIRST', name: second ? 'view-second' : 'view-first',
          model: 'fixture-child', background: true, mode: 'explore',
        } }, index);
      } else respond(res, body, { type: 'text', text: 'MAIN_TRANSCRIPT_SENTINEL' }, index);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-parent', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(text));
  await until(ready, 'startup', 15000);
  send('launch view first\r'); await until(() => held.has('first') && ready(), 'first child read and held', 15000);
  send('/tasks\r'); await until(() => frame().includes('AGENT_VIEW_FIRST') && frame().includes('Prompt'), 'agent details');
  send('f'); await until(() => frame().includes('Viewing agent') && !frame().includes('Prompt'), 'f opens selected agent transcript');
  assert.match(frame(), /AGENT_VIEW_FIRST/); assert.match(frame(), /read_file/); assert.doesNotMatch(frame(), /MAIN_TRANSCRIPT_SENTINEL/);
  if (!process.argv.includes('--entry-only')) {
    const before = requests.length;
    send('CHILD_FOLLOWUP_QUEUED\r');
    await until(() => frame().includes('CHILD_FOLLOWUP_QUEUED'), 'queued human row visible');
    await delay(150); assert.equal(requests.length, before, 'running child owns the pending input');
    held.get('first').finish();
    await until(() => frame().includes('CHILD_FOLLOWUP_COMPLETE'), 'queued human message resumes the same child', 15000);
    assert.equal(requests.filter(body => body.model === 'fixture-child' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED').length, 1);
    assert.equal(requests.some(body => body.model === 'fixture-parent' && body.messages.at(-1)?.content === 'CHILD_FOLLOWUP_QUEUED'), false);
    send('/model fixture-other\r'); await until(() => frame().includes('main conversation') && frame().includes('/model fixture-other'), 'model gate retains draft');
    assert.equal(requests.length, before + 2);
    send('\x15/compact\r'); await until(() => frame().includes('acts on the main conversation'), 'compact confirmation');
    send('\x1b'); await until(() => frame().includes('Viewing agent') && !frame().includes('acts on the main conversation'), 'cancel compact confirmation');
    send('\x15\x0f'); await until(() => frame().includes('ctrl+e all'), 'selected child transcript screen');
    assert.match(frame(), /CHILD_FOLLOWUP_COMPLETE/); send('q');
    await until(() => frame().includes('Viewing agent') && !frame().includes('ctrl+e all'), 'transcript exit retains agent view');
    send('\x1b'); await until(() => !frame().includes('Viewing agent') && frame().includes('MAIN_TRANSCRIPT_SENTINEL'), 'settled Escape returns main');
    assert.doesNotMatch(frame(), /CHILD_FOLLOWUP_COMPLETE/);
    send('launch view second\r'); await until(() => held.has('second') && ready(), 'second child read and held', 15000);
    send('/tasks\r'); await until(() => frame().includes('AGENT_VIEW_SECOND') && frame().includes('Prompt'), 'second child details');
    send('f'); await until(() => frame().includes('Viewing agent') && frame().includes('AGENT_VIEW_SECOND'), 'second child view', 15000);
    send('\x1b'); await until(() => frame().includes('Viewing agent') && frame().includes('cancelled'), 'Escape stops selected child');
    send('\x1b'); await until(() => !frame().includes('Viewing agent'), 'second Escape releases view');
  }
  send('/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'passed', entryOnly: process.argv.includes('--entry-only'), childView: true,
    modelRequests: requests.length, gateway: 'owned loopback SSE', locksReleased: true }));
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child && child.exitCode === null && child.signalCode === null) {
    child.stdin.write('\x03\x03'); await Promise.race([exited, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  screen.close(); console.log(JSON.stringify({ fixture: temporary }));
}
