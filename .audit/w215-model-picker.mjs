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

const root = '/Users/mant1ssa/Projects/cc_reverse';
const sent = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { sent.push(JSON.parse(body)); } catch { sent.push(null); }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    sse(res, textBlock('ok'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w215-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w215-user-')));
fs.mkdirSync(path.join(user, 'agents'));
fs.writeFileSync(path.join(user, 'agents', 'probe.md'),
  '---\nname: probe-agent\ndescription: Probe agent for the model picker\nmodel: probe-model\n---\nProbe body.\n');
const settingsFile = path.join(user, 'settings.json');
const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const raw = () => Buffer.concat(chunks).toString('utf8');
const screenNow = () => {
  const screen = new TerminalScreen(140, 40);
  screen.write(raw());
  const rows = screen.lines();
  screen.close();
  return rows;
};
const snap = label => {
  console.log('=====', label);
  for (const row of screenNow()) if (row.trim()) console.log(JSON.stringify(row));
};
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
const right = '\u001b[C';
const down = '\u001b[B';

await delay(2000);
child.stdin.write('/model\r'); await delay(1500);
const picker = screenNow().join('\n');
check('a bare /model opens the recovered picker title and caption',
  picker.includes('Select model')
  && picker.includes('Switch between models. Your pick becomes the default for new sessions.'));
check('the picker lists the gateway model and the agent-declared one',
  picker.includes('base-model') && picker.includes('probe-model'));
check('the current row carries the synthesized description', picker.includes('Current model'));
check('the effort line names the level, the default and the guide',
  picker.includes('● high effort (default)')
  && picker.includes('Enter set as default / s use this session only / Esc cancel'));
snap('after bare /model');

child.stdin.write(right); await delay(150);
check('one step right reaches xhigh', screenNow().join('\n').includes('◉ xHigh effort'));
child.stdin.write(right); await delay(400);
check('a second step reaches max', screenNow().join('\n').includes('◈ max effort'));
child.stdin.write(down); await delay(300);
check('the arrow axis does not move the selection',
  screenNow().join('\n').includes('>     probe-model')
  && screenNow().join('\n').includes('Selected: probe-model'));
snap('after right right down');

child.stdin.write('\r'); await delay(2000);
check('enter switches to the focused row and writes the default', stored().model === 'probe-model'
  && screenNow().join('\n').includes('Model: probe-model'));

child.stdin.write('turn\r'); await delay(3000);
check('the adjusted effort reaches the request', sent.at(-1)?.output_config?.effort === 'max');
snap('after the turn');

child.stdin.write('/model\r'); await delay(1500);
const second = screenNow().join('\n');
check('the picker reopens on the new current row with its description',
  second.includes('Current model') && second.includes('base-model'));
child.stdin.write(down); await delay(250);
child.stdin.write('s'); await delay(2000);
check('s accepts session-only and leaves the stored default alone',
  stored().model === 'probe-model' && screenNow().join('\n').includes('Model: base-model'));
snap('after s');

child.stdin.write('/exit\r'); await delay(1200);
child.kill();
server.close();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
