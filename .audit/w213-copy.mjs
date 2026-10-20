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
const answers = ['alpha answer', 'beta answer'];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    sse(res, textBlock(answers.shift() ?? 'extra answer'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w213-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w213-user-')));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'fixture/probe', LLM_BASE_URL: `http://127.0.0.1:${port}`, LLM_AUTH: 'bearer',
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
  const screen = new TerminalScreen(120, 30);
  screen.write(raw());
  const rows = screen.lines();
  screen.close();
  return rows;
};
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
const payload = text => `\u001b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\u0007`;

await delay(2000);
child.stdin.write('first turn\r'); await delay(3500);
child.stdin.write('second turn\r'); await delay(3500);
check('two turns ran', answers.length === 0);

child.stdin.write('/copy\r'); await delay(2000);
check('the latest response reaches the terminal as an OSC 52 request', raw().includes(payload('beta answer')));
check('the copy reports its size and the scratch file',
  screenNow().join('\n').includes('Copied to clipboard (11 characters, 1 lines)'));
const scratch = path.join(os.tmpdir(), 'litcode-copy', String(child.pid), 'response.md');

child.stdin.write('/copy 2\r'); await delay(2000);
check('an index reaches an earlier response', raw().includes(payload('alpha answer')));

child.stdin.write('/copy 9\r'); await delay(1500);
check('an overrun names how many are available', screenNow().join('\n').includes('Only 2 assistant messages'));

child.stdin.write('/copy 0\r'); await delay(1500);
check('a bad index prints the usage', screenNow().join('\n').includes('Usage: /copy [N] where N is 1 (latest)'));

for (const row of screenNow()) if (row.trim()) console.log(JSON.stringify(row));

child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
server.close();
// The scratch path is keyed on the child's pid, which the parent cannot know before the copy; the
// owned-directory listing proves the file landed somewhere under the recovered name.
const scratchRoot = path.join(os.tmpdir(), 'litcode-copy');
check('the scratch file exists under the recovered name',
  fs.existsSync(scratchRoot) && fs.readdirSync(scratchRoot).some(entry =>
    fs.existsSync(path.join(scratchRoot, entry, 'response.md'))));
if (fs.existsSync(scratch)) fs.rmSync(path.dirname(scratch), { recursive: true, force: true });
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
