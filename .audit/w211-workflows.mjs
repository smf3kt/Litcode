import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

/** The provider streams, so the stub answers with Anthropic SSE events, not one JSON body. */
function sse(res, blocks, stopReason) {
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_probe', type: 'message', role: 'assistant',
    model: 'fixture/probe', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } } });
  for (const [index, block] of blocks.entries()) {
    send('content_block_start', { type: 'content_block_start', index, content_block: block.start });
    send('content_block_delta', { type: 'content_block_delta', index, delta: block.delta });
    send('content_block_stop', { type: 'content_block_stop', index });
  }
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

const textBlock = text => [
  { start: { type: 'text', text: '', citations: null }, delta: { type: 'text_delta', text } },
];
const toolBlock = (id, name, input) => [
  { start: { type: 'tool_use', id, name, input: {} },
    delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
];

const root = '/Users/mant1ssa/Projects/cc_reverse';
const calls = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    calls.push(body);
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a non-JSON body is still counted */ }
    // Only a fresh typed turn asks for a run: the history keeps the marker, and the tool result
    // that follows it must not start another one.
    const last = (parsed.messages ?? []).at(-1);
    const blocks = typeof last?.content === 'string' ? [{ type: 'text', text: last.content }] : last?.content ?? [];
    const asked = last?.role === 'user' && !blocks.some(block => block.type === 'tool_result')
      && blocks.some(block => block.type === 'text' && block.text.includes('start-a-workflow'));
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    if (asked) {
      sse(res, toolBlock(`tu-${calls.length}`, 'workflow_run',
        { tasks: [{ id: 'build', prompt: 'do the build' }, { id: 'test', prompt: 'run the tests' }] }), 'tool_use');
    } else sse(res, textBlock('probe reply'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'w211-ws-'));
const user = fs.mkdtempSync(path.join(os.tmpdir(), 'w211-user-'));
fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'fixture/probe', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)) delete env[key];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const snap = label => {
  const screen = new TerminalScreen(120, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  console.log('=====', label);
  for (const row of screen.lines()) if (row.trim()) console.log(JSON.stringify(row));
  screen.close();
};
await delay(2000);
child.stdin.write('start-a-workflow\r'); await delay(5000); snap('after the workflow turn');
child.stdin.write('start-a-workflow\r'); await delay(5000); snap('after a second workflow turn');
child.stdin.write('/workflows\r'); await delay(1500); snap('panel: the run list');
child.stdin.write('\r'); await delay(1200); snap('panel: one run');
child.stdin.write('\r'); await delay(1200); snap('panel: one task');
child.stdin.write('\x1b'); await delay(800); snap('panel: back at the run');
child.stdin.write('\x1b'); await delay(800);
child.stdin.write('\x1b'); await delay(800); snap('panel: closed');
child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
server.close();
console.log('REQUESTS', calls.length);
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
