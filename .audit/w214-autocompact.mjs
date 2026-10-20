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
const server = http.createServer((req, res) => {
  req.on('data', () => {});
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    sse(res, textBlock('ok'), 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w214-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w214-user-')));
const settingsFile = path.join(user, 'settings.json');
const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
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
const down = '\u001b[B';

await delay(2000);
child.stdin.write('/autocompact\r'); await delay(1500);
const picker = screenNow().join('\n');
check('a bare /autocompact in a terminal opens the window dialog',
  picker.includes('Auto-compact window') && picker.includes('Current setting for fixture/probe:'));
check('the dialog carries the source, the explainer and both bounds',
  picker.includes('512k tokens (default for this model)')
  && picker.includes('This command configures when auto-compaction happens.')
  && picker.includes('strongly recommended')
  && picker.includes('auto') && picker.includes('100k tokens') && picker.includes('900k tokens'));
check('the default row is auto, because nothing is stored', picker.includes('>     auto'));
snap('after bare /autocompact');

child.stdin.write('\u001b'); await delay(1500);
const cancelled = screenNow().join('\n');
check('Escape closes the dialog and reports the unchanged caption',
  !cancelled.includes('This command configures when auto-compaction happens.')
  && cancelled.includes('Auto-compact windo'));
snap('after Escape');

child.stdin.write('/autocompact\r'); await delay(1500);
for (let i = 0; i < 5; i++) { child.stdin.write(down); await delay(120); }
await delay(600);
const stepped = screenNow().join('\n');
snap('after five downs');
check('five steps reach the 500k row',
  stepped.includes('>     500k tokens') && stepped.includes('Selected: 500k tokens'));
child.stdin.write('\r'); await delay(1800);
check('accepting writes the picked window to the settings file', stored().compactAt === 500000);
check('the answer names the stored window',
  screenNow().join('\n').includes('Auto-compact window for fixture/probe set to 500k tokens'));
snap('after picking 500k');

child.stdin.write('/autocompact 300k\r'); await delay(1500);
check('a shorthand argument sets its own window', stored().compactAt === 300000
  && screenNow().join('\n').includes('Auto-compact window for fixture/probe set to 300k tokens'));

child.stdin.write('/autocompact\r'); await delay(1500);
const reopened = screenNow().join('\n');
check('the dialog reopens on the rounded stored row and the settings source',
  reopened.includes('300k tokens (from settings)') && reopened.includes('>     300k tokens')
  && reopened.includes('Overriding auto may result in high token usage'));
child.stdin.write('\u001b'); await delay(1200);

child.stdin.write('/autocompact 1m\r'); await delay(1500);
check('an oversized window reports the ceiling cap',
  screenNow().join('\n').includes('(capped to model limit of 975.4k)'));
check('the store keeps the requested value', stored().compactAt === 1000000);

child.stdin.write('/autocompact reset\r'); await delay(1500);
check('reset clears the stored window', !('compactAt' in stored()));
check('the answer is the auto caption',
  screenNow().join('\n').includes('Auto-compact window for fixture/probe set to auto'));

child.stdin.write('/autocompact 2m\r'); await delay(1200);
check('an unparseable value repeats the recovered sentence',
  screenNow().join('\n').includes("Couldn't parse '2m'. Expected 'auto' or 100k"));
snap('after the invalid argument');

child.stdin.write('/exit\r'); await delay(1200);
child.kill();
server.close();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
