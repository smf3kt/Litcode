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
const turns = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a non-JSON body is still recorded */ }
    const last = (parsed.messages ?? []).at(-1);
    const blocks = typeof last?.content === 'string' ? [{ type: 'text', text: last.content }] : last?.content ?? [];
    const asked = last?.role === 'user' && !blocks.some(block => block.type === 'tool_result')
      && blocks.some(block => block.type === 'text' && block.text.includes('arm-a-loop-job'));
    if (last?.role === 'user' && !blocks.some(block => block.type === 'tool_result')) turns.push(blocks);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    if (asked) sse(res, toolBlock(`tu-${turns.length}`, 'cron_create',
      { cron: '*/5 * * * *', prompt: '<<loop.md>>', recurring: true }), 'tool_use');
    else sse(res, textBlock('probe reply'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w208-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w208-user-')));
fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
const loopFile = path.join(workspace, '.harness', 'loop.md');
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
const userText = () => turns.at(-1).filter(block => block.type === 'text').map(block => block.text).join('\n');
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);

await delay(2000);
child.stdin.write('/loop\r'); await delay(2500);
const autonomous = userText();
check('the no-argument form is the dynamic autonomous default', autonomous.startsWith('# /loop — autonomous default with dynamic pacing\n'));
check('the autonomous default inlines the bundled preamble', autonomous.includes('# Autonomous loop check\n') && autonomous.includes('You\'re being invoked on a timer while the user is away or occupied.'));
check('the autonomous default names the dynamic sentinel', autonomous.includes('`<<autonomous-loop-dynamic>>`'));
check('the autonomous default carries the monitor and stop instructions', autonomous.includes('arm one now with `timeout_ms: 1800000`') && autonomous.includes('call schedule_wakeup with `stop: true`'));
snap('after /loop with no loop.md');

child.stdin.write('/loop 5m\r'); await delay(2500);
const fixed = userText();
check('a bare interval is the fixed autonomous default', fixed.startsWith('# /loop — schedule the autonomous default\n'));
check('the fixed default schedules the autonomous sentinel', fixed.includes('`prompt`: the literal string `<<autonomous-loop>>`'));
check('the fixed default carries the typed interval', fixed.includes('input was empty or just the interval `5m`'));

fs.writeFileSync(loopFile, 'run the tests\n');
child.stdin.write('/loop\r'); await delay(2500);
const tasks = userText();
check('a loop file turns the same form into the tasks branch', tasks.startsWith('# /loop — loop.md tasks with dynamic pacing\n'));
check('the tasks branch names the file it read', tasks.includes(`## Loop tasks (from ${loopFile})`));
check('the tasks branch inlines the file body', tasks.endsWith('run the tests'));
check('the tasks branch points the wakeup at the loop-file sentinel', tasks.includes('`prompt`: the literal string `<<loop.md-dynamic>>`'));
snap('after /loop with a loop file');

child.stdin.write('arm-a-loop-job\r'); await delay(5000);
snap('after the cron job turn');
child.stdin.write('/cron\r'); await delay(2000);
snap('the cron list');
const screen = new TerminalScreen(120, 30);
screen.write(Buffer.concat(chunks).toString('utf8'));
const rows = screen.lines();
screen.close();
check('the cron list shows the loop job as a loop label', rows.some(row => row.includes('"/loop (loop.md)"')));
check('the cron list keeps the other job prompts', rows.some(row => row.includes('arm-a-loop-job')));

child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
server.close();
console.log('TURNS', turns.length);
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
