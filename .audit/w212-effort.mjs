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
const requests = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a non-JSON body is still recorded */ }
    requests.push(parsed);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    sse(res, textBlock('probe reply'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w212-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w212-user-')));
const settingsFile = path.join(user, 'settings.json');
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'fixture/probe', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || key === 'LLM_EFFORT') delete env[key];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const screenNow = () => {
  const screen = new TerminalScreen(120, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const rows = screen.lines();
  screen.close();
  return rows;
};
const snap = label => {
  console.log('=====', label);
  for (const row of screenNow()) if (row.trim()) console.log(JSON.stringify(row));
};
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};

await delay(2000);
child.stdin.write('/effort\r'); await delay(1200);
const shortUsage = screenNow().join('\n');
check('a bare /effort prints the short argument hint', shortUsage.includes('Usage: /effort <low|medium|high|xhigh|max|auto>'));
snap('after bare /effort');

child.stdin.write('/effort help\r'); await delay(1200);
const usage = screenNow().join('\n');
check('a help word prints the full usage block', usage.includes('Usage: /effort [low|medium|high|xhigh|max|auto]')
  && usage.includes('- low: Quick, straightforward implementation')
  && usage.includes('- auto: Use the default effort level for your model'));
snap('after /effort help');

child.stdin.write('/effort status\r'); await delay(1200);
check('status on a fresh session reports auto at the fallback',
  screenNow().join('\n').includes('Effort level: auto (currently high)'));

child.stdin.write('/effort high\r'); await delay(1500);
const setScreen = screenNow().join('\n');
check('setting a level reports the save scope and the description',
  setScreen.includes('Set effort level to high (saved as your default for new sessions)'));
check('the level-change notice follows the answer', setScreen.includes('● high · /effort'));
check('the level is written to the user settings', stored().effort === 'high');
snap('after /effort high');

child.stdin.write('/effort max\r'); await delay(1500);
check('max is reported as session-only', screenNow().join('\n').includes('Set effort level to max (this session only)'));
check('max leaves the stored default alone', stored().effort === 'high');

child.stdin.write('/effort extreme\r'); await delay(1200);
check('an unknown argument names itself and the valid options',
  screenNow().join('\n').includes('Invalid argument: extreme. Valid options are: low, medium, high, xhigh, max, auto'));

child.stdin.write('/effort auto\r'); await delay(1500);
check('auto clears the stored key', !('effort' in stored()));
snap('after /effort auto');

// The level reaches the request itself: `output_config.effort` is the recovered wire shape.
child.stdin.write('/effort low\r'); await delay(1500);
child.stdin.write('say hi\r'); await delay(3000);
const sent = requests.at(-1);
check('the chosen level reaches the request as output_config.effort', sent?.output_config?.effort === 'low');

child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
server.close();
console.log('SETTINGS', JSON.stringify(stored()));
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
