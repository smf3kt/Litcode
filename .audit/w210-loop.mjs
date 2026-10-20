import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const bodies = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    bodies.push(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'probe', type: 'message', role: 'assistant', model: 'fixture/probe',
      content: [{ type: 'text', text: 'probe reply' }], stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'w210-ws-'));
const user = fs.mkdtempSync(path.join(os.tmpdir(), 'w210-user-'));
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
  const screen = new TerminalScreen(110, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  console.log('=====', label);
  for (const row of screen.lines()) if (row.trim()) console.log(JSON.stringify(row));
  screen.close();
};
await delay(2000);
snap('idle');
child.stdin.write('/loop'); await delay(900); snap('typed /loop (autocomplete row)');
child.stdin.write(' 5m /probe-task\r'); await delay(2500); snap('after enter /loop 5m /probe-task');
const sent = bodies.map(body => { try { return JSON.parse(body); } catch { return null; } })
  .flatMap(parsed => Array.isArray(parsed?.messages) ? parsed.messages : [])
  .filter(message => message.role === 'user')
  .map(message => typeof message.content === 'string' ? message.content
    : (message.content ?? []).filter(block => block.type === 'text').map(block => block.text).join(''));
console.log('REQUESTS', bodies.length, 'USER TEXTS', sent.length);
console.log('HEAD', JSON.stringify(sent[0]?.slice(0, 60)));
console.log('TAIL', JSON.stringify(sent[0]?.slice(-30)));
console.log('HAS CRON', sent[0]?.includes('Call cron_create with'), 'HAS SKILL', sent[0]?.includes('invoke it via the `skill` tool'));
console.log('VENDOR NAMES', /CronCreate|ScheduleWakeup|TaskStop|TaskList|Monitor\b/.test(sent[0] ?? ''));
child.kill('SIGKILL');
await new Promise(resolve => child.once('close', resolve));
server.close();
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
